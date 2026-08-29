import type { PolicyService } from '@hono-kun/policy'

/**
 * Pull request triage workflow: will orchestrate agents over incoming
 * pull requests, consulting a PolicyService for decisions.
 * Not implemented yet.
 */
export interface PullRequestWorkflowDeps {
  policy: PolicyService
}
