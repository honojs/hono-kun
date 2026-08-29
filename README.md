<p align="center">
  <img src="docs/hono-kun.png" width="320" alt="Hono-kun" />
</p>

# Hono-kun

Hono-kun is an AI maintainer for [Hono](https://github.com/honojs/hono).

Its first feature is pull request triage, but the architecture is deliberately not PR-specific: future features may include issue triage, issue reproduction, coding, and other repository maintenance tasks.

> [!NOTE]
> This project is at a very early stage — nothing useful is implemented yet.

## Architecture

Hono-kun is a set of Cloudflare Workers and workspace packages with a strict trust boundary between reading from GitHub and writing to GitHub:

- **`apps/github`** — the public GitHub-facing Worker. It receives GitHub events and exposes Hono-kun's HTTP surface. Built with Hono.
- **`apps/publisher`** — a separate trusted Worker that is the _only_ component holding privileged GitHub write credentials. Everything that posts comments, adds labels, or otherwise writes to GitHub goes through it.
- **`agents/*`** — AI agents (verifier, reviewer, contributor, coder) that analyze and produce results. Agents never receive GitHub write credentials; they hand results to the publisher. Agents will be built with [Flue](https://github.com/withastro/flue).
- **`workflows/*`** — orchestration of agents for a concrete task, such as pull request triage.
- **`packages/policy`** — interfaces and types for policy decisions only. The real production policy for Hono lives in a separate private Worker and is connected via a Cloudflare Service Binding. This public repository always builds without it.

## Repository structure

```text
hono-kun/
├── apps/
│   ├── github/          # Public GitHub-facing Worker (Hono)
│   └── publisher/       # Trusted Worker for privileged GitHub writes
├── agents/
│   ├── verifier/        # Verifies changes behave as claimed
│   ├── reviewer/        # Reviews code changes
│   ├── contributor/     # Interacts with contributors
│   └── coder/           # Writes and modifies code
├── workflows/
│   └── pull-request/    # Pull request triage orchestration
├── packages/
│   ├── github/          # Read-side GitHub helpers
│   ├── sandbox/         # Cloudflare Sandbox execution helpers
│   ├── schemas/         # Shared types
│   ├── policy/          # Policy decision interfaces (contract only)
│   └── config/          # Shared runtime configuration
├── skills/              # Skills used by agents
└── evals/               # Evaluation suites
```

## Development

Requirements: Node.js >= 20 and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

To run a Worker locally:

```sh
pnpm --filter @hono-kun/app-github dev
```

There is no build step for internal packages: workspace packages expose TypeScript source directly, and the Workers are bundled by Wrangler.

## Tech stack

- TypeScript + pnpm workspaces
- [Hono](https://hono.dev/) for HTTP applications
- [Flue](https://github.com/withastro/flue) for agents (planned)
- [oxlint](https://oxc.rs/) and [oxfmt](https://oxc.rs/) for linting and formatting
- Cloudflare Workers as the deployment target

## Authors

The Hono team.

## License

MIT
