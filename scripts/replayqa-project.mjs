export function assertProjectRunning(project) {
  if (project.status !== "active") {
    throw new Error(`Replay QA project is ${project.status} (reason: ${project.paused_reason ?? "unspecified"}); QA cannot proceed.`)
  }
}

export async function ensureProjectRunning(request, projectId) {
  const path = `/projects/${projectId}`
  let project = await request("GET", path)
  if (project.status === "paused" && project.paused_reason === "awaiting_start") {
    console.log("Starting Replay QA project paused awaiting its first run.")
    await request("PATCH", path, { status: "active" })
    project = await request("GET", path)
  }
  assertProjectRunning(project)
}
