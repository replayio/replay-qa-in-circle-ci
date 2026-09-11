import { test } from "node:test"
import assert from "node:assert/strict"
import { ensureProjectRunning, assertProjectRunning } from "./replayqa-project.mjs"

test("initial paused project resumes and is read back before CI proceeds", async () => {
  const calls = []
  await ensureProjectRunning(async (...args) => {
    calls.push(args)
    return calls.length === 1 ? { status: "paused", paused_reason: "awaiting_start" } : { status: "active" }
  }, "example")
  assert.deepEqual(calls, [["GET", "/projects/example"], ["PATCH", "/projects/example", { status: "active" }], ["GET", "/projects/example"]])
})
test("active project is not modified", async () => {
  let count = 0
  await ensureProjectRunning(async () => { count++; return { status: "active" } }, "example")
  assert.equal(count, 1)
})
for (const reason of ["no_credits", "budget", "manual", null]) {
  test(`does not override pause ${reason}`, async () => {
    let count = 0
    await assert.rejects(ensureProjectRunning(async () => { count++; return { status: "paused", paused_reason: reason } }, "example"), /QA cannot proceed/)
    assert.equal(count, 1)
  })
}
test("unsuccessful activation fails instead of submitting work", async () => {
  await assert.rejects(ensureProjectRunning(async () => ({ status: "paused", paused_reason: "awaiting_start" }), "example"), /QA cannot proceed/)
})
test("a project pausing during polling fails", () => {
  assert.throws(() => assertProjectRunning({ status: "paused", paused_reason: "no_credits" }), /no_credits/)
})
