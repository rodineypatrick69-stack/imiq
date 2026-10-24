const appPage = "__APP_HTML_JSON__";
const seedData = __SEED_DATA_JSON__;

const encoder = new TextEncoder();
const cookieName = "__Host-supervisor-session";
const sessionMs = 8 * 60 * 60 * 1000;
const commonHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
};

function respond(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { ...commonHeaders, ...headers },
  });
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function authUsers(env) {
  try {
    const users = JSON.parse(env.SUPERVISOR_USERS_JSON || "[]");
    if (!Array.isArray(users)) return [];
    return users.filter((user) => typeof user?.email === "string" && /^[a-f0-9]{64}$/u.test(user.passwordHash || ""));
  } catch {
    return [];
  }
}

async function issueSession(email, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    email,
    expiresAt: Date.now() + sessionMs,
  })));
  return `${payload}.${await hmac(payload, secret)}`;
}

async function hasSession(request, env) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const users = authUsers(env);
  if (!match || !env.SUPERVISOR_SESSION_SECRET || !users.length) return false;
  const [payload, signature, extra] = match.slice(cookieName.length + 1).split(".");
  if (!payload || !signature || extra) return false;
  const expected = await hmac(payload, env.SUPERVISOR_SESSION_SECRET);
  if (!safeEqual(signature, expected)) return false;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return users.some((user) => user.email.toLowerCase() === session.email) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function loginPage(email, message = "") {
  const escapedEmail = String(email || "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#762681"><title>Acesso do supervisor</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#27232b;background:#e8e7ea;font-synthesis:none}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:22px;background:radial-gradient(ellipse at 15% 10%,#f8f1f8 0,transparent 50%),linear-gradient(145deg,#ece9ee,#d8d8de)}.card{width:min(100%,420px);border:1px solid #ebe4ed;border-radius:22px;padding:32px;background:#fff;box-shadow:0 24px 70px #32193620}.brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}.mark{width:46px;height:46px;border-radius:15px;background:#762681;color:white;display:grid;place-items:center;font-size:23px;font-weight:800}.brand b{display:block;font-size:15px}.brand small{color:#77717b;font-size:12px}.eyebrow{color:#762681;text-transform:uppercase;letter-spacing:.14em;font-size:10px;font-weight:800}h1{font-size:27px;letter-spacing:-.04em;margin:8px 0}.intro{margin:0 0 24px;color:#6d6871;font-size:14px}.field{display:grid;gap:7px;margin:15px 0}.field label{font-size:12px;font-weight:700;color:#56515b}.field input{width:100%;height:46px;border:1px solid #ded9e1;border-radius:10px;padding:0 12px;font:inherit;outline-color:#a45d93}.submit{width:100%;height:46px;border:0;border-radius:10px;margin-top:6px;background:#762681;color:#fff;font:inherit;font-weight:750}.submit:hover{background:#63206c}.error{min-height:20px;color:#b73232;font-size:12px;margin:10px 0 0}.foot{margin:20px 0 0;padding-top:17px;border-top:1px solid #eeeaf0;color:#77717b;font-size:11px;line-height:1.5}@media(max-width:420px){.card{padding:25px 21px;border-radius:18px}h1{font-size:24px}}
</style></head><body><main class="card"><div class="brand"><div class="mark">S</div><div><b>Supervisor de Equipe</b><small>Painel de acompanhamento operacional</small></div></div><div class="eyebrow">Acesso restrito</div><h1>Entrar no painel</h1><p class="intro">Use seu e-mail autorizado e sua senha pessoal.</p><form id="loginForm"><div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" value="${escapedEmail}" autocomplete="email" required></div><div class="field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="submit" id="submitButton" type="submit">Entrar</button><p class="error" id="error" role="status" aria-live="polite">${message}</p></form><p class="foot">O acesso é pessoal. A sessão será encerrada automaticamente após 8 horas.</p></main><script>
const form=document.querySelector('#loginForm'),button=document.querySelector('#submitButton'),error=document.querySelector('#error');form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Verificando…';try{const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value})});if(!response.ok){error.textContent=response.status===503?'Login ainda não configurado. Avise o administrador.':'E-mail ou senha incorretos.';button.disabled=false;button.textContent='Entrar';return}location.replace('/')}catch{error.textContent='Não foi possível conectar. Tente novamente.';button.disabled=false;button.textContent='Entrar'}});
</script></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const users = authUsers(env);

    if (url.pathname === "/api/login" && request.method === "POST") {
      if (request.headers.get("origin") !== url.origin) return respond("Forbidden", 403);
      if (!users.length || !env.SUPERVISOR_SESSION_SECRET) {
        return respond(JSON.stringify({ error: "Login não configurado." }), 503, { "content-type": "application/json; charset=utf-8" });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return respond(JSON.stringify({ error: "Requisição inválida." }), 400, { "content-type": "application/json; charset=utf-8" });
      }
      const submittedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const submittedPassword = typeof body.password === "string" ? body.password : "";
      const account = users.find((user) => user.email.toLowerCase() === submittedEmail);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(submittedPassword)));
      const actualHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const valid = account && safeEqual(actualHash, account.passwordHash);
      if (!valid) return respond(JSON.stringify({ error: "E-mail ou senha incorretos." }), 401, { "content-type": "application/json; charset=utf-8" });
      const token = await issueSession(submittedEmail, env.SUPERVISOR_SESSION_SECRET);
      return respond(JSON.stringify({ ok: true }), 200, {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionMs / 1000}`,
      });
    }

    if (url.pathname === "/api/logout" && request.method === "POST") {
      if (request.headers.get("origin") !== url.origin) return respond("Forbidden", 403);
      return respond(JSON.stringify({ ok: true }), 200, {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      });
    }

    if (url.pathname === "/login" && request.method === "GET") {
      if (await hasSession(request, env)) return Response.redirect(new URL("/", request.url), 302);
      return respond(loginPage(""), 200, { "content-type": "text/html; charset=utf-8" });
    }

    if (url.pathname === "/" || url.pathname === "/seed.json") {
      if (!(await hasSession(request, env))) {
        if (url.pathname === "/seed.json") return respond(JSON.stringify({ error: "Não autenticado." }), 401, { "content-type": "application/json; charset=utf-8" });
        return Response.redirect(new URL("/login", request.url), 302);
      }
      if (url.pathname === "/seed.json") return respond(JSON.stringify(seedData), 200, { "content-type": "application/json; charset=utf-8" });
      return respond(appPage, 200, { "content-type": "text/html; charset=utf-8" });
    }

    return respond("Not found", 404, { "content-type": "text/plain; charset=utf-8" });
  },
};
