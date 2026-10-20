// Package only Vite's public output. Never upload the repository to Pages.
import { constants } from "node:fs";
import { copyFile, mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(webRoot, "dist");
const appOutput = path.join(output, "web");
const entries = await readdir(output);

if (!entries.includes("index.html") || !entries.includes("room.html")) {
  throw new Error("Run Vite's multi-page build before packaging GitHub Pages.");
}
if (entries.includes("web")) {
  throw new Error("Pages output is already packaged. Run npm run build for a clean build.");
}

await mkdir(appOutput);
for (const entry of entries) {
  await rename(path.join(output, entry), path.join(appOutput, entry));
}
await copyFile(path.join(webRoot, "../index.html"), path.join(output, "index.html"));
// Keep already published /docs links; fill missing guides under /web/docs too.
// Existing web/public/docs content is authoritative at the canonical app path.
const sourceDocs = path.join(webRoot, "../docs");
await mkdir(path.join(output, "docs"));
await mkdir(path.join(appOutput, "docs"), { recursive: true });
for (const entry of await readdir(sourceDocs, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
  const source = path.join(sourceDocs, entry.name);
  await copyFile(source, path.join(output, "docs", entry.name));
  try {
    await copyFile(source, path.join(appOutput, "docs", entry.name), constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
await writeFile(path.join(output, ".nojekyll"), "");
console.log("Pages artifact ready: / → /web/; /web/index.html remains available.");
