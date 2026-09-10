import { writeFileSync, rmSync } from "node:fs"

const marker = "/tmp/replayqa-pr-ready"
rmSync(marker, { force: true })
const repository = `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`
const url = process.env.CIRCLE_PULL_REQUEST
if (!url) {
  console.log("No pull request associated with this build; skipping Replay QA.")
  process.exit(0)
}
const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/)
if (!match || match[1] !== repository) throw new Error("Unexpected GitHub pull request URL.")
const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${match[2]}`, {
  headers: { Accept: "application/vnd.github+json" },
  signal: AbortSignal.timeout(30_000),
})
if (!response.ok) throw new Error(`Cannot validate pull request: GitHub HTTP ${response.status}`)
const pr = await response.json()
if (pr.state !== "open" || pr.draft || pr.head.repo?.full_name !== repository || pr.head.sha !== process.env.CIRCLE_SHA1) {
  console.log("Skipping closed, draft, fork, or superseded pull request revision.")
  process.exit(0)
}
writeFileSync(marker, "ready\n")
console.log(`Running Replay QA for ${repository}#${match[2]} at ${pr.head.sha}`)
