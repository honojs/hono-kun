import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPullRequestDiff,
  stripGeneratedDiffs,
  toPullRequestEvent,
  verifyWebhookSignature,
} from './index'

describe('stripGeneratedDiffs', () => {
  const diff = [
    'diff --git a/src/index.ts b/src/index.ts',
    '--- a/src/index.ts',
    '+++ b/src/index.ts',
    '@@ -1 +1 @@',
    '+const a = 1',
    'diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml',
    '--- a/pnpm-lock.yaml',
    '+++ b/pnpm-lock.yaml',
    '@@ -1,100 +1,200 @@',
    '+  lots-of-lockfile-noise: true',
    'diff --git a/README.md b/README.md',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1 +1 @@',
    '+# hi',
    '',
  ].join('\n')

  it('replaces lockfile sections with a marker and keeps the rest', () => {
    const stripped = stripGeneratedDiffs(diff)
    expect(stripped).toContain('diff --git a/src/index.ts b/src/index.ts')
    expect(stripped).toContain('diff --git a/README.md b/README.md')
    expect(stripped).toContain('(diff for pnpm-lock.yaml omitted)')
    expect(stripped).not.toContain('lots-of-lockfile-noise')
  })

  it('handles lockfiles in subdirectories', () => {
    const nested =
      'diff --git a/apps/web/package-lock.json b/apps/web/package-lock.json\n+noise\n'
    expect(stripGeneratedDiffs(nested)).toBe(
      '(diff for apps/web/package-lock.json omitted)\n',
    )
  })

  it('leaves diffs without lockfiles untouched', () => {
    const plain = 'diff --git a/src/a.ts b/src/a.ts\n+const a = 1\n'
    expect(stripGeneratedDiffs(plain)).toBe(plain)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPullRequestDiff', () => {
  const repo = { owner: 'honojs', repo: 'hono' }

  it('fetches the diff from the public .diff URL', async () => {
    const fetchMock = vi.fn(async () => new Response('diff --git a/x b/x'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchPullRequestDiff(repo, 42)).toBe('diff --git a/x b/x')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://github.com/honojs/hono/pull/42.diff',
      expect.anything(),
    )
  })

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 })),
    )
    expect(await fetchPullRequestDiff(repo, 42)).toBeNull()
  })

  it('truncates oversized diffs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x'.repeat(100_000))),
    )
    const diff = await fetchPullRequestDiff(repo, 42)
    expect(diff?.length).toBeLessThan(90_000)
    expect(diff?.endsWith('… (diff truncated)')).toBe(true)
  })
})

const encoder = new TextEncoder()

const sign = async (secret: string, body: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(body)),
  )
  return (
    'sha256=' + [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  )
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret'
  const body = '{"action":"opened"}'

  it('accepts a valid signature', async () => {
    expect(
      await verifyWebhookSignature(secret, body, await sign(secret, body)),
    ).toBe(true)
  })

  it('rejects a signature made with another secret', async () => {
    expect(
      await verifyWebhookSignature(
        secret,
        body,
        await sign('other-secret', body),
      ),
    ).toBe(false)
  })

  it('rejects a signature for a different body', async () => {
    expect(
      await verifyWebhookSignature(
        secret,
        body,
        await sign(secret, '{"action":"closed"}'),
      ),
    ).toBe(false)
  })

  it('rejects a missing header', async () => {
    expect(await verifyWebhookSignature(secret, body, undefined)).toBe(false)
  })

  it('rejects a header without the sha256= prefix', async () => {
    const signature = (await sign(secret, body)).slice('sha256='.length)
    expect(await verifyWebhookSignature(secret, body, signature)).toBe(false)
  })

  it('rejects a malformed hex digest', async () => {
    expect(await verifyWebhookSignature(secret, body, 'sha256=zz')).toBe(false)
  })
})

describe('toPullRequestEvent', () => {
  const payload = {
    action: 'opened',
    number: 42,
    repository: { name: 'hono', owner: { login: 'honojs' } },
    pull_request: {
      title: 'feat: add thing',
      html_url: 'https://github.com/honojs/hono/pull/42',
      user: { login: 'someone' },
    },
  }

  it('normalizes a pull_request payload', () => {
    expect(toPullRequestEvent(payload)).toEqual({
      action: 'opened',
      number: 42,
      repository: { owner: 'honojs', repo: 'hono' },
      title: 'feat: add thing',
      author: 'someone',
      url: 'https://github.com/honojs/hono/pull/42',
    })
  })

  it('includes the label name for labeled actions', () => {
    expect(
      toPullRequestEvent({
        ...payload,
        action: 'labeled',
        label: { name: 'ai:evaluate' },
      }),
    ).toMatchObject({ action: 'labeled', label: 'ai:evaluate' })
  })

  it('omits the label field when the payload has no label', () => {
    expect(toPullRequestEvent(payload)).not.toHaveProperty('label')
  })

  it('returns null for non-object payloads', () => {
    expect(toPullRequestEvent(null)).toBeNull()
    expect(toPullRequestEvent('x')).toBeNull()
  })

  it('returns null when required fields are missing or mistyped', () => {
    expect(toPullRequestEvent({ ...payload, action: 1 })).toBeNull()
    expect(
      toPullRequestEvent({ ...payload, repository: { name: 'hono' } }),
    ).toBeNull()
    expect(
      toPullRequestEvent({ ...payload, pull_request: { title: 'x' } }),
    ).toBeNull()
  })
})
