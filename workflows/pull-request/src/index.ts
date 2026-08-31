import type { PullRequestEvent, RepositoryRef } from '@hono-kun/schemas'

/** Label that manually invokes an evaluation on a pull request — including ones opened before Hono-kun was installed. */
export const EVALUATE_LABEL = 'ai:evaluate'

/** What started an evaluation, or `null` when the event is not a trigger. */
export type EvaluationTrigger = 'pr-opened' | 'evaluate-label' | null

/**
 * Entry point for pull request events: decides whether the event starts an evaluation.
 */
export const handlePullRequestEvent = async (
  event: PullRequestEvent,
): Promise<EvaluationTrigger> => {
  if (event.action === 'opened') {
    return 'pr-opened'
  }
  if (event.action === 'labeled' && event.label === EVALUATE_LABEL) {
    return 'evaluate-label'
  }
  return null
}

/** What the workflow needs from its host: read the diff and reach the Reviewer agent. */
export interface EvaluationDeps {
  fetchDiff(repository: RepositoryRef, number: number): Promise<string | null>
  submitToReviewer(conversationId: string, prompt: string): Promise<void>
}

/** The message handed to the Reviewer agent. */
export const buildReviewerPrompt = (
  event: PullRequestEvent,
  diff: string,
): string =>
  [
    `PR #${event.number} by ${event.author}: ${event.title}`,
    event.url,
    '',
    diff,
  ].join('\n')

/**
 * Shadow-mode evaluation: fetch the PR diff and hand it to the Reviewer agent.
 * The verdict is observable in the agents Worker and AI Gateway logs; nothing is written to GitHub.
 *
 * @returns `false` when the diff could not be fetched and nothing was submitted.
 */
export const evaluatePullRequest = async (
  event: PullRequestEvent,
  conversationId: string,
  deps: EvaluationDeps,
): Promise<boolean> => {
  const diff = await deps.fetchDiff(event.repository, event.number)
  if (diff === null) {
    return false
  }
  await deps.submitToReviewer(conversationId, buildReviewerPrompt(event, diff))
  return true
}
