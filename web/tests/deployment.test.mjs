import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(webRoot, "dist");
let server;
let origin;

// A strict static server models Pages: missing files return 404, never an SPA fallback.
before(async () => {
  await stat(path.join(output, "web", "index.html"));
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let filename = path.join(output, pathname);
      if (!filename.startsWith(output + path.sep) && filename !== output) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
      response.writeHead(200).end(await readFile(filename));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test("root redirect preserves existing section links and query parameters", async () => {
  const response = await fetch(`${origin}/?lang=en#stars`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /https:\/\/nyxbyb\.github\.io\/web\//);
  let destination;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  runInNewContext(script, {
    location: { search: "?lang=en", hash: "#stars", replace: value => { destination = value; } },
  });
  assert.equal(destination, "/web/?lang=en#stars");
  assert.match(html, /href="\/web\/"/);
});

test("canonical /web/ and old /web/index.html serve the same complete homepage", async () => {
  const current = await fetch(`${origin}/web/`);
  const legacy = await fetch(`${origin}/web/index.html`);
  assert.equal(current.status, 200);
  assert.equal(legacy.status, 200);
  const html = await current.text();
  assert.equal(html, await legacy.text());
  assert.match(html, /Caelum/);
  assert.ok(html.includes("room.html"), "Homepage must link to the room.");
});

test("homepage and room build references resolve beneath the public /web/ path", async () => {
  for (const entry of ["/web/index.html", "/web/room.html"]) {
    const response = await fetch(origin + entry);
    assert.equal(response.status, 200, entry);
    const html = await response.text();
    // Ignore template strings in classic inline scripts, but keep script src tags.
    const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    const references = [...markup.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
    let bundledAssets = 0;
    for (const reference of references) {
      const url = new URL(reference, origin + entry);
      if (url.origin !== origin) continue;
      assert.ok(url.pathname.startsWith("/web/"), `${entry}: ${reference}`);
      assert.equal((await fetch(url)).status, 200, `${entry}: ${reference}`);
      if (url.pathname.startsWith("/web/assets/")) bundledAssets++;
    }
    if (entry.endsWith("room.html")) {
      assert.ok(bundledAssets > 0, "the room must load its built module");
    }
  }
});

test("public graph, writing, text, tree, room configuration, and guide are reachable", async () => {
  for (const resource of [
    "data/graph.json", "data/articles.json", "data/text.json", "tree.json", "data/room.json",
  ]) {
    const response = await fetch(`${origin}/web/${resource}`);
    assert.equal(response.status, 200, resource);
    assert.ok(await response.json(), resource);
  }
  const guide = await fetch(`${origin}/web/docs/${encodeURIComponent("更新指南.md")}`);
  assert.equal(guide.status, 200);
  const oldGuide = await fetch(`${origin}/docs/${encodeURIComponent("更新指南.md")}`);
  assert.equal(oldGuide.status, 200);
});

test("artifact publishes only built app and root compatibility files", async () => {
  assert.deepEqual((await readdir(output)).sort(), [".nojekyll", "docs", "index.html", "web"]);
  for (const privatePath of ["/.git/config", "/web/package.json", "/corpus/README.md", "/web/room/room.js"]) {
    assert.equal((await fetch(origin + privatePath)).status, 404, privatePath);
  }
  assert.equal((await fetch(`${origin}/web/does-not-exist.js`)).status, 404);
});

test("only one workflow deploys the verified build output", async () => {
  const workflows = path.join(webRoot, "../.github/workflows");
  const files = (await readdir(workflows)).filter(name => /\.ya?ml$/.test(name));
  const deployments = [];
  for (const name of files) {
    const source = await readFile(path.join(workflows, name), "utf8");
    if (source.includes("actions/deploy-pages@")) deployments.push(source);
  }
  assert.equal(deployments.length, 1);
  const workflow = deployments[0];
  assert.match(workflow, /run: npm ci\s/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /path: web\/dist/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /name: github-pages/);
  assert.doesNotMatch(workflow, /npm ci\s*\|\||path:\s*['"]?\.['"]?\s/);
});
