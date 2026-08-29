import type { RepositoryRef } from '@hono-kun/schemas'

/**
 * A request for a policy decision about a repository maintenance task.
 * Deliberately task-agnostic: pull request triage is the first task,
 * but issue triage, reproduction, coding, etc. use the same contract.
 */
export interface PolicyInput {
  /** Task kind, e.g. "pull-request-triage". */
  task: string
  repository: RepositoryRef
  /** Task-specific payload. Concrete shapes are defined per workflow. */
  payload: unknown
}

/** The decision returned by a policy service. */
export interface PolicyDecision {
  action: 'proceed' | 'skip' | 'escalate'
  reason?: string
}

/**
 * Contract implemented by a policy service. The production policy for
 * Hono lives in a private Worker connected via a Cloudflare Service
 * Binding; this public repository defines only the interface.
 */
export interface PolicyService {
  decide(input: PolicyInput): Promise<PolicyDecision>
}
