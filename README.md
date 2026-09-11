# Reminders · Replay QA in CircleCI

A local-first Next.js reminders app demonstrating Replay QA in CircleCI. Based on
[replayio/replayqa-cli-in-ci](https://github.com/replayio/replayqa-cli-in-ci), with
GitHub Actions replaced by [`.circleci/config.yml`](.circleci/config.yml).

## Run locally

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Reminders and custom lists are saved in browser local storage.
The app includes Today, Scheduled, All Reminders, Flagged, and Completed smart lists.

## Connect CircleCI

1. Add `replayio/replay-qa-in-circle-ci` as a CircleCI project using the **GitHub OAuth**
   integration and the existing `.circleci/config.yml`. This example uses OAuth integration
   variables, including `CIRCLE_PULL_REQUEST`; the GitHub App integration is not a drop-in replacement.
2. Keep **Build forked pull requests** and **Pass secrets to builds from forked pull requests**
   disabled. Only trusted contributors should be able to run code with the project credentials.
3. Add the environment variables below in **Project Settings → Environment Variables**.
4. Open a same-repository PR and push a commit after marking it ready for review. Draft PRs,
   closed PRs, forks, and superseded commit revisions skip QA. If the PR was created after the
   branch build, or was just marked ready, trigger a new pipeline for that branch.
5. Optionally enable **Auto-cancel redundant workflows** to stop outdated branch builds.
   The Replay QA API also replaces the previous in-flight revision for the same PR.

The `main` branch runs `npm run check`. Other branches run PR QA when CircleCI supplies a
PR URL and GitHub confirms eligibility. The public GitHub API verifies PR state without an
additional token; an API error fails the job rather than bypassing validation.

CircleCI references: [built-in variables](https://circleci.com/docs/reference/variables/),
[configuration](https://circleci.com/docs/reference/configuration-reference/).

## Replay QA setup

Create a dedicated reverse-proxy project so Replay's browsers can reach the CI runner:

```bash
REPLAY_QA_API_KEY=lqa_... npx --yes replayqa@0.2.4 create-project \
  --name "Reminders · CircleCI" \
  --target-url http://127.0.0.1:3000 \
  --reverse-proxy \
  --instructions "Test creating, completing, searching, and switching reminder lists."
```

Set these CircleCI project environment variables:

- `REPLAY_QA_PROJECT_ID`: the dedicated reverse-proxy project's `proj-...` ID.
- `REPLAY_QA_API_KEY`: a durable API key with access to that project. Do not use the
  short-lived OAuth token from `~/.replay/profile/auth.json`.

Use a separate project from the original GitHub Actions example to avoid competing tunnels.
No project IDs or credentials are included in this repository.

The PR job validates credentials, runs TypeScript, ESLint, and a production build, and starts
Next.js as a CircleCI background step. [`scripts/run-replayqa-ci.mjs`](scripts/run-replayqa-ci.mjs)
waits for the proxy's JSON `heartbeat` with `ready: true`, submits repository/PR/commit/branch
metadata from CircleCI, and polls the run to a terminal status while keeping the tunnel alive.
The run identity combines the CircleCI workflow UUID and job number, including on job reruns.
The Replay API's `workflow_run_id` field is retained because it is part of the CLI contract.

CI resumes a project paused with `awaiting_start` after the tunnel is ready and verifies that
it becomes active. Other pause reasons fail with an actionable error. While polling a run,
CI checks project state and fails if it pauses, rather than waiting for a queued run indefinitely.

QA polling is bounded to 40 minutes; the command has a 50-minute outer timeout so cleanup and
log upload can happen before CircleCI’s one-hour job limit. Individual CLI calls time out after
two minutes. Failed runs request cancellation before disconnecting the tunnel. SIGINT/SIGTERM asks Replay QA to cancel the matching revision;
hard runner termination cannot guarantee cleanup. App, proxy, and QA logs are saved in the
CircleCI job's **Artifacts** tab, including when QA fails.

For a manual local proxy, copy `.replay/config.example.json` to `.replay/config.json` and run:

```bash
REPLAY_QA_API_KEY=lqa_... npx --yes replayqa@0.2.4 run http://127.0.0.1:3000 \
  --no-app --project "$REPLAY_QA_PROJECT_ID" --qa-url https://qa.replay.io
```

## Production QA after deployment

Vercel's Git integration can deploy the app independently. CircleCI does not receive the
original GitHub Actions `deployment_status` trigger. Instead, after a successful production
deployment, trigger a pipeline on `main` with boolean parameter `run-production-qa: true`,
using the CircleCI UI or a deployment webhook service calling the CircleCI API.
Do not trigger it merely because a commit was pushed: that could test the previous deployment.
See [triggering pipelines with parameters](https://circleci.com/docs/guides/orchestrate/pipeline-variables/).

Set these additional CircleCI environment variables:

- `REPLAY_QA_PRODUCTION_PROJECT_ID`: a public Replay QA project configured with the production URL.
- `REPLAY_QA_PRODUCTION_URL`: the same public production URL.

The API key must also access the production project. The job checks HTTP availability and
requests an exploration, then prints the latest five test runs. As in the source repository,
**production job success means the request was accepted, not that QA passed**. Review the
result in Replay QA. The URL must be publicly accessible to Replay's browsers. The production
script uses the project's configured target URL; the environment variable must match it.

Connecting CircleCI, adding credentials, provisioning Replay projects, and wiring an automatic
post-deployment trigger are external setup steps; creating this repository does not perform them.

## Checks

```bash
npm run check
node --test scripts/circleci-pr.test.mjs
circleci config validate
```
