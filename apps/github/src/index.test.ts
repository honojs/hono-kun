import { describe, expect, it } from 'vitest'
import app from './index'

const secret = 'test-secret'
const env = { GITHUB_WEBHOOK_SECRET: secret }
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

const deliver = async (body: string, headers: Record<string, string>) =>
  await app.request('/webhooks/github', { method: 'POST', body, headers }, env)

describe('GET /', () => {
  it('responds with the service name', async () => {
    const res = await app.request('/', {}, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'hono-kun', service: 'github' })
  })
})

describe('POST /webhooks/github', () => {
  const body = JSON.stringify({ action: 'opened' })

  it('accepts a correctly signed delivery', async () => {
    const res = await deliver(body, {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-id',
      'x-hub-signature-256': await sign(secret, body),
    })
    expect(res.status).toBe(202)
  })

  it('rejects an invalid signature', async () => {
    const res = await deliver(body, {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-id',
      'x-hub-signature-256': await sign('other-secret', body),
    })
    expect(res.status).toBe(401)
  })

  it('rejects a delivery without a signature', async () => {
    const res = await deliver(body, {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-id',
    })
    expect(res.status).toBe(401)
  })

  it('rejects a delivery without webhook headers', async () => {
    const res = await deliver(body, {
      'x-hub-signature-256': await sign(secret, body),
    })
    expect(res.status).toBe(400)
  })
})
