import { describe, expect, it } from 'vitest'
import { verifyWebhookSignature } from './index'

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
