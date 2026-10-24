import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const password = "test-only-supervisor-password";
const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
const passwordHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
const ownerPassword = "test-only-owner-password";
const ownerDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerPassword));
const ownerPasswordHash = Array.from(new Uint8Array(ownerDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");
const source = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const worker = (await import(moduleUrl)).default;
const env = {
  SUPERVISOR_USERS_JSON: JSON.stringify([
    { email: "paulo.sbarbosa@aperam.com", passwordHash },
    { email: "rodineypatrick69@gmail.com", passwordHash: ownerPasswordHash },
  ]),
  SUPERVISOR_SESSION_SECRET: "test-only-signing-secret-32-bytes-long",
};
const base = "https://supervisor.example";

const unauthenticated = await worker.fetch(new Request(base + "/"), env);
assert.equal(unauthenticated.status, 302);
assert.equal(unauthenticated.headers.get("location"), base + "/login");

const loginPage = await worker.fetch(new Request(base + "/login"), env);
assert.equal(loginPage.status, 200);
const loginPageHtml = await loginPage.text();
assert.match(loginPageHtml, /Acesso restrito/u);
assert.match(loginPageHtml, /type="email"/u);

const denied = await worker.fetch(new Request(base + "/api/login", {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ email: "unauthorized@example.com", password }),
}), env);
assert.equal(denied.status, 401);

const login = await worker.fetch(new Request(base + "/api/login", {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ email: "PAULO.SBARBOSA@APERAM.COM", password }),
}), env);
assert.equal(login.status, 200);
const setCookie = login.headers.get("set-cookie");
assert.match(setCookie, /HttpOnly/u);
assert.match(setCookie, /Secure/u);
assert.match(setCookie, /SameSite=Strict/u);
const cookie = setCookie.split(";", 1)[0];

const ownerLogin = await worker.fetch(new Request(base + "/api/login", {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ email: "rodineypatrick69@gmail.com", password: ownerPassword }),
}), env);
assert.equal(ownerLogin.status, 200);

const app = await worker.fetch(new Request(base + "/", { headers: { cookie } }), env);
assert.equal(app.status, 200);
const appHtml = await app.text();
assert.match(appHtml, /Supervisor de Equipe/u);
assert.match(appHtml, /Versão 20 · Atualizada em 22\/10\/2026/u);

const protectedSeed = await worker.fetch(new Request(base + "/seed.json", { headers: { cookie } }), env);
assert.equal(protectedSeed.status, 200);
assert.ok((await protectedSeed.json()).teams);
const deniedSeed = await worker.fetch(new Request(base + "/seed.json"), env);
assert.equal(deniedSeed.status, 401);

const logout = await worker.fetch(new Request(base + "/api/logout", {
  method: "POST",
  headers: { origin: base, cookie },
}), env);
assert.equal(logout.status, 200);
assert.match(logout.headers.get("set-cookie"), /Max-Age=0/u);
const afterLogout = await worker.fetch(new Request(base + "/"), env);
assert.equal(afterLogout.status, 302);

console.log("Authentication flow passed: private routes, rejected login, signed session, protected seed, and logout.");
