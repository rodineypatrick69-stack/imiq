import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import workerModule from "../dist/server/index.js";

const html = await readFile(new URL("../dist/vercel/index.html", import.meta.url), "utf8");
assert.match(html, /id="loginForm"/u);
assert.match(html, /functions\/v1\/supervisor-login/u);
assert.match(html, /workspace_states/u);
assert.match(html, /Versão 21/u);
assert.doesNotMatch(html, /PUBLISHABLE_PLACEHOLDER/u);
await assert.rejects(access(new URL("../dist/vercel/seed.json", import.meta.url)));
const response = await workerModule.fetch(new Request("https://example.test/"));
assert.equal(response.status, 200);
assert.match(await response.text(), /Acesso seguro/u);
const hiddenSeed = await workerModule.fetch(new Request("https://example.test/seed.json"));
assert.equal(hiddenSeed.status, 404);
console.log("Build smoke test passed: login shell, cloud endpoints, version label, and no public seed artifact.");
