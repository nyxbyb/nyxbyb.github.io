import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Execute the exact inline CI guard, not a second implementation of its logic.
const workflow = await readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
const guardStep = workflow.split("      - name: Wait for legacy Pages publishers\n")[1];
assert.ok(guardStep, "workflow must include the legacy publisher guard");
const scriptLines = guardStep.split("          script: |\n")[1].split("\n");
const script = [];
for (const line of scriptLines) {
  if (line && !line.startsWith("            ")) break;
  script.push(line.slice(12));
}
const source = `(async () => {\n${script.join("\n")}\n})()`;
const sha = "tested-public-commit";
const legacy = (id, status, head_sha = sha) => ({
  id, status, head_sha, path: "dynamic/pages/pages-build-deployment",
});

async function runGuard(histories, { status = 200, totalCount, fetchError } = {}) {
  let elapsed = 0;
  let calls = 0;
  const logs = [];
  const promise = runInNewContext(source, {
    context: { repo: { owner: "nyxbyb", repo: "nyxbyb.github.io" }, sha },
    Date: { now: () => elapsed },
    AbortSignal: { timeout(milliseconds) { assert.equal(milliseconds, 15000); return "bounded-public-request"; } },
    setTimeout(callback, milliseconds) { elapsed += milliseconds; callback(); },
    core: { info: message => logs.push(message) },
    fetch: async (endpoint, options) => {
      const url = new URL(endpoint);
      assert.equal(url.origin, "https://api.github.com");
      assert.equal(url.pathname, "/repos/nyxbyb/nyxbyb.github.io/actions/runs");
      assert.equal(url.searchParams.get("head_sha"), sha);
      assert.equal(options.signal, "bounded-public-request");
      assert.ok(!Object.keys(options.headers).some(key => key.toLowerCase() === "authorization"));
      assert.ok(!options.method || options.method === "GET");
      const runs = histories[Math.min(calls++, histories.length - 1)];
      if (fetchError) throw new Error(fetchError);
      return {
        ok: status === 200, status,
        json: async () => ({ workflow_runs: runs, total_count: totalCount ?? runs?.length }),
      };
    },
  });
  await promise;
  return { elapsed, calls, logs };
}

test("guard waits for same-commit queued/running legacy publisher and confirms completion", async () => {
  const result = await runGuard([
    [legacy(1, "queued")], [legacy(1, "in_progress")],
    [legacy(1, "completed")], [legacy(1, "completed")],
  ]);
  assert.equal(result.calls, 4);
  assert.equal(result.elapsed, 60000);
  assert.match(result.logs.at(-1), /publishing the verified artifact last/);
});

test("guard proceeds without legacy publishing after two quiet observations", async () => {
  const result = await runGuard([[]]);
  assert.equal(result.calls, 2);
  assert.equal(result.elapsed, 20000);
});

test("guard ignores other commits and current custom workflow", async () => {
  const result = await runGuard([[
    legacy(1, "in_progress", "older-commit"),
    { ...legacy(2, "in_progress"), path: ".github/workflows/deploy.yml" },
  ]]);
  assert.equal(result.calls, 2);
});

test("guard waits for every generated publisher and rechecks late discovery", async () => {
  const result = await runGuard([
    [], [legacy(1, "completed"), legacy(2, "in_progress")],
    [legacy(1, "completed"), legacy(2, "completed")],
    [legacy(1, "completed"), legacy(2, "completed")],
  ]);
  assert.equal(result.calls, 4);
});

test("guard fails after bounded eight minutes instead of publishing during legacy run", async () => {
  await assert.rejects(runGuard([[legacy(1, "in_progress")]]), /within 8 minutes; deployment stopped/);
});

test("guard fails clearly on public API errors, timeout, or incomplete history", async () => {
  await assert.rejects(runGuard([[]], { status: 403 }), /HTTP 403/);
  await assert.rejects(runGuard([[]], { fetchError: "request timed out" }), /request timed out/);
  await assert.rejects(runGuard([[]], { totalCount: 101 }), /Incomplete public workflow history/);
  await assert.rejects(runGuard([undefined]), /Incomplete public workflow history/);
});
