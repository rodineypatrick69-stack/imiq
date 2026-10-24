import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(await readFile(resolve(root, "app/version.json"), "utf8"));
if (!Number.isInteger(version.number) || version.number < 1 || !/^\d{2}\/\d{2}\/\d{4}$/u.test(version.updated_at_display)) {
  throw new Error("App version metadata is invalid.");
}
const appHtml = (await readFile(resolve(root, "app/index.html"), "utf8"))
  .replaceAll("__APP_VERSION_LABEL__", `Versão ${version.number} · Atualizada em ${version.updated_at_display}`);
const template = await readFile(resolve(root, "worker/index.js"), "utf8");
if (!template.includes("__APP_HTML_JSON__")) throw new Error("Worker placeholder is missing.");
const worker = template.replace('"__APP_HTML_JSON__"', JSON.stringify(appHtml));
const output = resolve(root, "dist");
await mkdir(resolve(output, "server"), { recursive: true });
await mkdir(resolve(output, ".openai"), { recursive: true });
await mkdir(resolve(output, "vercel"), { recursive: true });
await writeFile(resolve(output, "server/index.js"), worker);
await writeFile(resolve(output, "vercel/index.html"), appHtml);
await copyFile(resolve(root, ".openai/hosting.json"), resolve(output, ".openai/hosting.json"));
console.log("Built the shared-cloud supervisor app for Vercel and Sites.");
