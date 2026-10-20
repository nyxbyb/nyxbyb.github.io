import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Execute the exact authenticated, read-only check used by the deploy job.
const workflow = await readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
const sourceStep = workflow.split("      - name: Verify GitHub Pages source\n")[1];
assert.ok(sourceStep, "workflow must verify the configured Pages source");
const lines = sourceStep.split("          script: |\n")[1].split("\n");
const script = [];
for (const line of lines) {
  if (line && !line.startsWith("            ")) break;
  script.push(line.slice(12));
}

async function checkSource(build_type, apiError) {
  const logs = [];
  let calls = 0;
  await runInNewContext(`(async () => {\n${script.join("\n")}\n})()`, {
    context: { repo: { owner: "nyxbyb", repo: "nyxbyb.github.io" } },
    core: { info: message => logs.push(message) },
    github: { rest: { repos: { getPages: async options => {
      calls++;
      assert.equal(options.owner, "nyxbyb");
      assert.equal(options.repo, "nyxbyb.github.io");
      assert.equal(options.request.timeout, 15000);
      if (apiError) throw new Error(apiError);
      return { data: { build_type } };
    } } } },
  });
  return { calls, logs };
}

test("Pages source check accepts GitHub Actions through one authenticated read", async () => {
  const result = await checkSource("workflow");
  assert.equal(result.calls, 1);
  assert.deepEqual(result.logs, ["Verified Pages Source: GitHub Actions."]);
});

test("Pages source check rejects legacy or unknown configuration before deploying", async () => {
  for (const build_type of ["legacy", undefined]) {
    await assert.rejects(checkSource(build_type), /Pages Source must be GitHub Actions/);
  }
});

test("Pages source API failure stops deployment instead of silently bypassing the check", async () => {
  await assert.rejects(checkSource("workflow", "Pages API unavailable"), /Pages API unavailable/);
});
