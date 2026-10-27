import type { Session, Workspace, WorkspaceRecord } from "./types";
const URL = "https://qedlkndcfzyqvintkvud.supabase.co";
const KEY = "sb_publishable_hQij9qv4gtfDUpyuWjlwQg_kf1Zh7sn";
const AUTH_KEY = "supervisor-supabase-session-v1";
export const LOCAL_KEY = "supervisor-equipe-v1";
let session: Session | null = null;
let refreshing: Promise<Session | null> | null = null;
export class ConflictError extends Error {
  constructor() {
    super(
      "Outra sessão alterou os dados. Baixe seu backup e carregue a versão da nuvem antes de editar novamente.",
    );
  }
}
export class AuthError extends Error {
  constructor() {
    super("Sua sessão expirou. Entre novamente para continuar.");
  }
}
export function storedSession() {
  if (session) return session;
  try {
    session = JSON.parse(
      localStorage.getItem(AUTH_KEY) || "null",
    ) as Session | null;
  } catch {
    session = null;
  }
  return session;
}
function storeSession(value: Session) {
  if (!value.expires_at)
    value.expires_at =
      Math.floor(Date.now() / 1000) + (value.expires_in || 3600);
  localStorage.setItem(AUTH_KEY, JSON.stringify(value));
  session = value;
  return value;
}
export function clearSession() {
  session = null;
  localStorage.removeItem(AUTH_KEY);
}
async function request(path: string, options: RequestInit = {}) {
  try {
    return await fetch(URL + "/" + path, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar. Verifique sua internet e tente novamente.",
    );
  }
}
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const current = storedSession();
    if (!current?.refresh_token) return null;
    const r = await request("auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!r.ok) {
      if (r.status === 400 || r.status === 401) clearSession();
      throw new AuthError();
    }
    return storeSession((await r.json()) as Session);
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
async function cloud(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  let current = storedSession();
  if (current?.expires_at && current.expires_at * 1000 < Date.now() + 30000)
    current = await refresh();
  if (!current?.access_token) throw new AuthError();
  const headers = new Headers(options.headers);
  headers.set("apikey", KEY);
  headers.set("Authorization", "Bearer " + current.access_token);
  const response = await request(path, { ...options, headers });
  if (response.status === 401 && retry) {
    await refresh();
    return cloud(path, options, false);
  }
  if (response.status === 401) throw new AuthError();
  return response;
}
export async function login(username: string, pin: string) {
  const r = await request("functions/v1/supervisor-login", {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      result.error || "Não foi possível entrar. Confira seu usuário e PIN.",
    );
  if (!result.session?.access_token)
    throw new Error("A sessão não foi criada. Tente novamente.");
  storeSession(result.session as Session);
}
export function normalize(record: WorkspaceRecord): WorkspaceRecord {
  const state = record.state;
  if (
    !state ||
    !state.teams ||
    !state.schedule ||
    !Array.isArray(state.absences)
  )
    throw new Error(
      "Os dados recebidos estão incompletos. Nenhuma alteração foi feita.",
    );
  for (const team of ["TM", "TT", "TN"] as const)
    if (!Array.isArray(state.teams[team]))
      throw new Error("Cadastro de equipes inválido.");
  state.employeeIds ??= {};
  state.employeeRestNumbers ??= {};
  state.teamLeaders ??= {};
  state.leaderRotation ??= {};
  state.journals ??= {};
  return { ...record, revision: Number(record.revision) };
}
export async function loadWorkspace(): Promise<WorkspaceRecord> {
  const r = await cloud(
    "rest/v1/workspace_states?select=state,revision,updated_at&workspace_id=eq.supervisor-equipe",
  );
  if (!r.ok)
    throw new Error("Não foi possível carregar os dados compartilhados.");
  const rows = (await r.json()) as WorkspaceRecord[];
  if (!rows.length)
    throw new Error("Espaço de trabalho indisponível para esta conta.");
  return normalize(rows[0]);
}
export async function saveWorkspace(
  state: Workspace,
  revision: number,
): Promise<WorkspaceRecord> {
  const r = await cloud(
    "rest/v1/workspace_states?workspace_id=eq.supervisor-equipe&revision=eq." +
      revision,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ state }),
    },
  );
  if (!r.ok)
    throw new Error(
      "A gravação não foi confirmada. Suas alterações continuam nesta tela. Tente novamente.",
    );
  const rows = (await r.json()) as WorkspaceRecord[];
  if (!rows.length) throw new ConflictError();
  return normalize(rows[0]);
}
export async function logout() {
  try {
    const r = await cloud("auth/v1/logout", { method: "POST" });
    if (!r.ok)
      throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }
  clearSession();
  localStorage.removeItem(LOCAL_KEY);
}
