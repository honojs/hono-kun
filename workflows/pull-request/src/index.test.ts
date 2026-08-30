import type { PullRequestEvent } from '@hono-kun/schemas'
import { describe, expect, it } from 'vitest'
import { EVALUATE_LABEL, handlePullRequestEvent } from './index'

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
