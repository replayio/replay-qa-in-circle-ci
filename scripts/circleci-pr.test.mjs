import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

function gate(pr, overrides = {}, status = 200) {
  const source = `
    globalThis.fetch = async () => ({ok: ${status === 200}, status: ${status}, json: async () => (${JSON.stringify(pr)})});
    await import('./scripts/check-circleci-pr.mjs');
  `
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    env: { ...process.env, CIRCLE_PROJECT_USERNAME: "replayio", CIRCLE_PROJECT_REPONAME: "example", CIRCLE_PULL_REQUEST: "https://github.com/replayio/example/pull/7", CIRCLE_SHA1: "abc", ...overrides },
  })
}
const ready = { state: "open", draft: false, head: { sha: "abc", repo: { full_name: "replayio/example" } } }
test("ready same-repository PR runs", () => {
  const result = gate(ready)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Running Replay QA/)
})
for (const [label, pr] of Object.entries({ draft: { ...ready, draft: true }, closed: { ...ready, state: "closed" }, fork: { ...ready, head: { ...ready.head, repo: { full_name: "fork/example" } } }, stale: { ...ready, head: { ...ready.head, sha: "old" } } })) {
  test(`${label} PR skips`, () => { const result = gate(pr); assert.equal(result.status, 0); assert.match(result.stdout, /Skipping/) })
}
test("branch without a PR skips", () => { const result = gate(ready, { CIRCLE_PULL_REQUEST: "" }); assert.equal(result.status, 0); assert.match(result.stdout, /No pull request/) })
test("API failure fails closed", () => assert.notEqual(gate(ready, {}, 403).status, 0))
test("unexpected repository fails closed", () => assert.notEqual(gate(ready, { CIRCLE_PULL_REQUEST: "https://github.com/other/repo/pull/7" }).status, 0))
