# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What is Hono-kun?

Hono-kun is an AI maintainer for [Hono](https://github.com/honojs/hono), deployed as Cloudflare Workers. It evaluates incoming pull requests and acts on them: good ones proceed to review; low-quality, context-blind, or suspicious ones are closed with a reason. When a closed PR points at a real issue, Hono-kun authors a replacement PR itself — referencing the original, with code it derives from scratch, never copied. Decision thresholds (what to close, what to escalate to a human) live in the private policy service, so autonomy can be dialed up gradually. Nothing in the architecture may be PR-specific: issue triage, issue reproduction, and other maintenance tasks will follow.

## Current status

Early days. `apps/github` receives GitHub webhook deliveries, verifies their signatures (via `@hono-kun/github`), deduplicates delivery ids in KV, and routes `pull_request` events to `@hono-kun/workflow-pull-request`. The workflow decides whether an event starts an evaluation (a newly opened PR, or the `ai:evaluate` label being added) and the app logs that decision — shadow mode. On a trigger, the app fetches the PR diff and submits it over a Service Binding to `apps/agents`, where the Reviewer Flue agent produces a structured verdict via Claude through the `hono-kun` AI Gateway (unified billing, no provider keys). Verdicts are persisted in the shared `hono-kun` D1 database (`evaluations` table, schema in `apps/agents/schema.sql`): the github Worker inserts the metadata row, the Reviewer's `record_verdict` tool fills in the verdict. Shadow mode: nothing is written to GitHub. Cloudflare Sandbox execution and the other agents are not implemented. Do not implement features that have not been requested.

## Repository layout

| Path                     | Package                           | Purpose                                         |
| ------------------------ | --------------------------------- | ----------------------------------------------- |
| `apps/github`            | `@hono-kun/app-github`            | Public GitHub-facing Worker (Hono)              |
| `apps/publisher`         | `@hono-kun/app-publisher`         | Trusted Worker for privileged GitHub writes     |
| `apps/agents`            | `@hono-kun/app-agents`            | Flue agents Worker (Service Binding only)       |
| `agents/verifier`        | `@hono-kun/agent-verifier`        | Verifies changes behave as claimed              |
| `agents/reviewer`        | `@hono-kun/agent-reviewer`        | Reviews code changes                            |
| `agents/contributor`     | `@hono-kun/agent-contributor`     | Interacts with contributors                     |
| `agents/coder`           | `@hono-kun/agent-coder`           | Writes and modifies code                        |
| `workflows/pull-request` | `@hono-kun/workflow-pull-request` | PR triage orchestration                         |
| `packages/github`        | `@hono-kun/github`                | Read-side GitHub helpers                        |
| `packages/sandbox`       | `@hono-kun/sandbox`               | Cloudflare Sandbox execution helpers            |
| `packages/schemas`       | `@hono-kun/schemas`               | Shared types                                    |
| `packages/policy`        | `@hono-kun/policy`                | Policy decision interfaces (contract only)      |
| `packages/config`        | `@hono-kun/config`                | Shared runtime configuration                    |
| `skills/`                | —                                 | Skills used by agents (not a workspace package) |
| `evals/`                 | —                                 | Evaluation suites (not a workspace package)     |

## Architecture rules (do not violate)

1. `apps/github` is the public GitHub-facing Worker; it handles untrusted input from GitHub.
2. `apps/publisher` is the only component allowed to hold privileged GitHub write credentials. All GitHub write operations go through it.
3. Agents must never directly receive GitHub write credentials.
4. `packages/policy` defines interfaces/types only. The real Hono production policy lives in a separate private Worker/repository and will be connected via a Cloudflare Service Binding. This public repository must always build and typecheck without that private policy service.
5. Keep packages minimal. No speculative abstractions; no functionality that has not been requested.
6. Do not add Turborepo, Nx, or similar — plain package.json scripts with `pnpm -r` are enough.

## Pull Request Workflow

1. Branch from latest `main`: `<type>/<short-slug>`. `<type>` is `feat` / `fix` / `chore` / `docs` / `refactor`.
2. Implement.
3. Run the quality gates. All must pass:

   ```sh
   pnpm format && pnpm lint:fix
   pnpm typecheck
   pnpm test
   ```

   CI (`.github/workflows/ci.yml`) runs the same gates (`format:check`, `lint`, `typecheck`, `test`) on every PR.

4. Commit with conventional commits: `<type>(<scope>): <description>`. Example: `feat(publisher): add comment endpoint`.
5. Open a PR against `main`. Keep the body short: what and why, in a few sentences. No fixed section labels — write it like a human note. Add notes the checklist does not cover as plain sentences. Use bullets only when there are several items. Add `Closes #<n>` only if an issue exists. End the body with the checklist from `.github/pull_request_template.md` and check the items you did.
6. Self-review the diff with the checklist from the PR template before asking for review.

**No AI attribution.** Do not add `Co-Authored-By`, session links, or "Generated with ..." to commits or PR bodies.

One PR = one concern. Do not force-push a branch under review.

## Conventions

- pnpm workspaces; all workspace packages are named `@hono-kun/*` and reference each other with the `workspace:*` protocol.
- No build step for internal packages: `exports` points at TypeScript source (`./src/index.ts`); Workers are bundled by Wrangler.
- TypeScript 7. Every package extends the root `tsconfig.json` and has a `typecheck` script (`tsc --noEmit`). Run `pnpm typecheck` at the root.
- Tests use [Vitest](https://vitest.dev/) (`pnpm test` at the root, `vitest run` per package). Hono apps are tested with `app.request()` — no running server needed.
- Worker secrets (e.g. `GITHUB_WEBHOOK_SECRET` for `apps/github`) are set with `wrangler secret put`; locally, put them in a gitignored `.dev.vars` in the app directory.
- Linting and formatting use the [Oxc](https://oxc.rs/) toolchain: oxlint (`pnpm lint`) and oxfmt (`pnpm format` / `pnpm format:check`, configured in `.oxfmtrc.json`).
- Do not hard-wrap prose in Markdown files — write each paragraph and list item on a single line.
- HTTP applications use Hono. Agents are built with [Flue](https://github.com/withastro/flue) and live in `apps/agents` (vite build: `flue()` + `cloudflare({ config: flueWorkerConfig() })`; one Durable Object SQLite migration per agent). Model calls go through the `hono-kun` AI Gateway via the AI binding — never add provider API keys. Claude 5 models need `thinkingLevel: 'off'` until Flue supports adaptive thinking. The `agents/*` packages will host shared agent logic as it grows.
- `hono-kun-agents` has no route and no workers.dev — it must stay reachable only via a Service Binding.
- Deployment target is Cloudflare Workers (`wrangler.jsonc` per app). Custom domains follow "worker name = subdomain" (e.g. `hono-kun-github.hono.dev`); `hono-kun.hono.dev` is reserved for a future public-facing page.
- Merges to `main` deploy `apps/github` automatically via `.github/workflows/deploy.yml`. Do not deploy manually except in emergencies.
- Documentation, code comments, and commit messages are in English. Conversation in PR and issue comments may be in Japanese.
- README.md (English) and README.ja.md (Japanese) must stay in sync — any PR touching one updates the other with the same content.
- The product name is written "Hono-kun" in prose. The repository, directory paths, and package scope stay lowercase (`hono-kun`, `@hono-kun/*`).
