import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearSession,
  ConflictError,
  loadWorkspace,
  login,
  saveWorkspace,
} from "../src/lib/api";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
const state = {
  teams: { TM: [], TT: [], TN: [] },
  schedule: {},
  absences: [],
  journals: {},
  employeeIds: {},
};
beforeEach(() => {
  clearSession();
});
async function authorize() {
  globalThis.fetch = async () =>
    Response.json({
      session: {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: 9999999999,
      },
    });
  await login("test", "0000");
}
test("unauthenticated state is not loaded", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json([]);
  };
  await assert.rejects(loadWorkspace(), /sessão expirou/);
  assert.equal(calls, 0);
});
test("load sends publishable key and user token independently", async () => {
  await authorize();
  globalThis.fetch = async (url, opts) => {
    assert.match(String(url), /workspace_states/);
    assert.equal(
      new Headers(opts?.headers).get("Authorization"),
      "Bearer test-access",
    );
    assert.match(new Headers(opts?.headers).get("apikey")!, /^sb_publishable_/);
    return Response.json([{ state, revision: 7 }]);
  };
  assert.equal((await loadWorkspace()).revision, 7);
});
test("stale revision produces conflict instead of overwriting newer state", async () => {
  await authorize();
  globalThis.fetch = async (url, opts) => {
    assert.match(String(url), /revision=eq.7/);
    assert.equal(opts?.method, "PATCH");
    return Response.json([]);
  };
  await assert.rejects(saveWorkspace(state, 7), ConflictError);
});
test("save confirms the server revision and preserves extra fields", async () => {
  await authorize();
  globalThis.fetch = async (_, opts) => {
    const sent = JSON.parse(String(opts?.body)).state;
    assert.equal(sent.customField, "preserve-me");
    return Response.json([{ state: sent, revision: 8 }]);
  };
  assert.equal(
    (await saveWorkspace({ ...state, customField: "preserve-me" }, 7)).revision,
    8,
  );
});
test("expired access refreshes once and retries the protected read", async () => {
  await authorize();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).includes("auth/v1/token"))
      return Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_at: 9999999999,
      });
    if (calls === 1) return new Response("", { status: 401 });
    return Response.json([{ state, revision: 9 }]);
  };
  assert.equal((await loadWorkspace()).revision, 9);
  assert.equal(calls, 3);
});
test("login failures return the server message", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "Tente novamente mais tarde." }, { status: 429 });
  await assert.rejects(login("test", "0000"), /Tente novamente mais tarde/);
});
