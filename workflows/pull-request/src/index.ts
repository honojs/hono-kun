import type { PullRequestEvent } from '@hono-kun/schemas'

/**
 * Entry point for pull request events. Triage will be orchestrated from here; for now the event is accepted and dropped.
 */
export const handlePullRequestEvent = async (
  _event: PullRequestEvent,
): Promise<void> => {}
