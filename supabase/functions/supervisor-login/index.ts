import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function derivePin(pin: string, saltHex: string, iterations: number): Promise<string> {
  const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map((byte) => Number.parseInt(byte, 16)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256)));
}
function constantEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function clientHash(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ error: "Solicitação inválida." }, 400); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!/^[a-z0-9._-]{2,64}$/.test(username) || !/^\d{4}$/.test(pin)) return response({ error: "Usuário ou PIN incorreto." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !publicKey) return response({ error: "Serviço de autenticação indisponível." }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const clientKey = await clientHash(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-client");
  const { data: limitRows, error: limitError } = await admin.rpc("record_supervisor_login_attempt", {
    p_username: username, p_client_key: clientKey, p_succeeded: false,
  });
  if (limitError) return response({ error: "Serviço de autenticação indisponível." }, 503);
  if (!limitRows?.[0]?.allowed) return response({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, 429);

  const { data: account, error } = await admin.from("supervisor_credentials")
    .select("username,email,full_name,role,pin_salt,pin_hash,pin_iterations,auth_user_id,is_active")
    .eq("username", username).eq("is_active", true).maybeSingle();
  let valid = false;
  if (!error && account?.pin_salt && account.pin_hash && account.pin_iterations >= 100000) {
    valid = constantEqual(await derivePin(pin, account.pin_salt, account.pin_iterations), account.pin_hash);
  }
  if (!valid) return response({ error: "Usuário ou PIN incorreto." }, 401);

  const { error: clearError } = await admin.rpc("record_supervisor_login_attempt", {
    p_username: username, p_client_key: clientKey, p_succeeded: true,
  });
  if (clearError) return response({ error: "Serviço de autenticação indisponível." }, 503);

  let userId = account.auth_user_id as string | null;
  let userExists = false;
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    userExists = Boolean(data?.user);
  }
  if (!userExists) {
    const internalPassword = hex(crypto.getRandomValues(new Uint8Array(24))) + "aA1!";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: account.email, password: internalPassword, email_confirm: true,
      user_metadata: { username, full_name: account.full_name },
    });
    if (createError || !created.user) return response({ error: "Não foi possível inicializar o acesso. Contate o administrador." }, 503);
    userId = created.user.id;
  }
  const { error: profileError } = await admin.from("supervisor_profiles").upsert({
    user_id: userId, username, full_name: account.full_name, email: account.email,
    role: account.role, is_active: true, last_login_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profileError) return response({ error: "Não foi possível inicializar o perfil." }, 503);
  await admin.from("supervisor_credentials").update({ auth_user_id: userId }).eq("username", username);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: account.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return response({ error: "Não foi possível iniciar a sessão." }, 503);
  const sessionClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError || !verified.session) return response({ error: "Não foi possível iniciar a sessão." }, 503);
  return response({ session: verified.session });
});
