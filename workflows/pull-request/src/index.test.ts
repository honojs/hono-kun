import type { PullRequestEvent } from '@hono-kun/schemas'
import { describe, expect, it, vi } from 'vitest'
import {
  EVALUATE_LABEL,
  buildReviewerPrompt,
  evaluatePullRequest,
  handlePullRequestEvent,
} from './index'

const event = (overrides: Partial<PullRequestEvent>): PullRequestEvent => ({
  action: 'opened',
  number: 1,
  repository: { owner: 'honojs', repo: 'hono' },
  title: 'feat: add thing',
  author: 'someone',
  url: 'https://github.com/honojs/hono/pull/1',
  ...overrides,
})

describe('handlePullRequestEvent', () => {
  it('triggers on a newly opened PR', async () => {
    expect(await handlePullRequestEvent(event({}))).toBe('pr-opened')
  })

  it('triggers when the evaluate label is added', async () => {
    expect(
      await handlePullRequestEvent(
        event({ action: 'labeled', label: EVALUATE_LABEL }),
      ),
    ).toBe('evaluate-label')
  })

  it('ignores other labels', async () => {
    expect(
      await handlePullRequestEvent(event({ action: 'labeled', label: 'bug' })),
    ).toBeNull()
  })

  it('ignores other actions', async () => {
    expect(
      await handlePullRequestEvent(event({ action: 'synchronize' })),
    ).toBeNull()
    expect(await handlePullRequestEvent(event({ action: 'closed' }))).toBeNull()
  })
})

describe('evaluatePullRequest', () => {
  it('submits the prompt built from the fetched diff', async () => {
    const submitToReviewer = vi.fn(async () => {})
    const dispatched = await evaluatePullRequest(event({}), 'conv-1', {
      fetchDiff: async () => 'diff --git a/x b/x',
      submitToReviewer,
    })
    expect(dispatched).toBe(true)
    expect(submitToReviewer).toHaveBeenCalledWith(
      'conv-1',
      buildReviewerPrompt(event({}), 'diff --git a/x b/x'),
    )
  })

  it('does nothing when the diff is unavailable', async () => {
    const submitToReviewer = vi.fn(async () => {})
    const dispatched = await evaluatePullRequest(event({}), 'conv-1', {
      fetchDiff: async () => null,
      submitToReviewer,
    })
    expect(dispatched).toBe(false)
    expect(submitToReviewer).not.toHaveBeenCalled()
  })
})

describe('buildReviewerPrompt', () => {
  it('includes the PR metadata and the diff', () => {
    const prompt = buildReviewerPrompt(event({}), 'diff --git a/x b/x')
    expect(prompt).toContain('PR #1 by someone: feat: add thing')
    expect(prompt).toContain('https://github.com/honojs/hono/pull/1')
    expect(prompt).toContain('diff --git a/x b/x')
  })
})
