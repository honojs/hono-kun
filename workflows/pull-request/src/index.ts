import type { PullRequestEvent } from '@hono-kun/schemas'

/** Label that manually invokes an evaluation on a pull request — including ones opened before Hono-kun was installed. */
export const EVALUATE_LABEL = 'ai:evaluate'

/** What started an evaluation, or `null` when the event is not a trigger. */
export type EvaluationTrigger = 'pr-opened' | 'evaluate-label' | null

/**
 * Entry point for pull request events: decides whether the event starts an evaluation.
 * The evaluation itself is not implemented yet; callers log the trigger so decisions can be observed in shadow mode.
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
