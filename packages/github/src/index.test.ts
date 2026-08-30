import { describe, expect, it } from 'vitest'
import { toPullRequestEvent, verifyWebhookSignature } from './index'

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
        label: { name: 'hono-kun' },
      }),
    ).toMatchObject({ action: 'labeled', label: 'hono-kun' })
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
