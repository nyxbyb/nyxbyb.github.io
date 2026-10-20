import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const updateScript = await readFile(new URL("../../scripts/update.sh", import.meta.url), "utf8");

// Exercise the actual publishing helper with inert npm/git stubs. No commit or push is made.
async function maintenanceRun(failure = "") {
  const fixture = await mkdtemp(path.join(tmpdir(), "caelum-maintenance-"));
  try {
    await mkdir(path.join(fixture, "scripts"));
    await mkdir(path.join(fixture, "web/public/data"), { recursive: true });
    await mkdir(path.join(fixture, "bin"));
    await mkdir(path.join(fixture, "corpus"));
    await mkdir(path.join(fixture, ".venv/bin"), { recursive: true });
    await writeFile(path.join(fixture, "scripts/update.sh"), updateScript);
    await writeFile(path.join(fixture, "caelum.html"), "legacy snapshot");
    await writeFile(path.join(fixture, "web/index.html"), "current website");
    await writeFile(path.join(fixture, "web/public/data/graph.json"), "existing public graph");
    await writeFile(path.join(fixture, "corpus/books_raw.json"), "private local source");
    await writeFile(path.join(fixture, ".venv/bin/python"), `#!/bin/bash
printf 'python %s\\n' "$*" >> "$TASK_LOG"
printf 'overwritten graph' > web/public/data/graph.json
`, { mode: 0o755 });
    await writeFile(path.join(fixture, "bin/npm"), `#!/bin/bash
printf 'npm %s\\n' "$*" >> "$TASK_LOG"
if [[ "$MAINTENANCE_FAIL" == build && "$*" == *"run build"* ]]; then exit 17; fi
if [[ "$MAINTENANCE_FAIL" == test && "$*" == *" test"* ]]; then exit 17; fi
`, { mode: 0o755 });
    await writeFile(path.join(fixture, "bin/git"), `#!/bin/bash
printf 'git %s\\n' "$*" >> "$TASK_LOG"
if [[ "$1" == diff ]]; then exit 1; fi
if [[ "$MAINTENANCE_FAIL" == commit && "$1" == commit ]]; then exit 23; fi
`, { mode: 0o755 });
    const result = spawnSync("bash", [path.join(fixture, "scripts/update.sh"), "verified update"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(fixture, "bin")}:${process.env.PATH}`,
        TASK_LOG: path.join(fixture, "calls.log"),
        MAINTENANCE_FAIL: failure,
      },
    });
    const calls = (await readFile(path.join(fixture, "calls.log"), "utf8")).trim().split("\n");
    const page = await readFile(path.join(fixture, "web/index.html"), "utf8");
    const graph = await readFile(path.join(fixture, "web/public/data/graph.json"), "utf8");
    return { result, calls, page, graph };
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

test("publishing helper preserves current page and graph despite private source files", async () => {
  const { result, calls, page, graph } = await maintenanceRun();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(page, "current website");
  assert.equal(graph, "existing public graph");
  assert.deepEqual(calls, [
    "npm --prefix web run build",
    "npm --prefix web test",
    "git add -- web index.html .github/workflows docs scripts/update.sh",
    "git diff --cached --quiet",
    "git commit -m verified update",
    "git push",
  ]);
});

for (const failure of ["build", "test"]) {
  test(`publishing helper stops before git when ${failure} fails`, async () => {
    const { result, calls, page, graph } = await maintenanceRun(failure);
    assert.equal(result.status, 17);
    assert.equal(page, "current website");
    assert.equal(graph, "existing public graph");
    assert.ok(calls.every(call => call.startsWith("npm ")));
  });
}

test("publishing helper does not push when commit fails", async () => {
  const { result, calls } = await maintenanceRun("commit");
  assert.equal(result.status, 23);
  assert.ok(!calls.includes("git push"));
});
