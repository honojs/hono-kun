import { describe, expect, it } from 'vitest'
import app from './index'

const secret = 'test-secret'
const encoder = new TextEncoder()

const memoryKV = (): KVNamespace => {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
  } as unknown as KVNamespace
}

const makeEnv = () => ({
  GITHUB_WEBHOOK_SECRET: secret,
  DELIVERIES: memoryKV(),
})

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

const deliver = async (
  body: string,
  headers: Record<string, string>,
  env: ReturnType<typeof makeEnv> = makeEnv(),
) =>
  await app.request('/webhooks/github', { method: 'POST', body, headers }, env)

const signedHeaders = async (body: string, delivery = 'delivery-id') => ({
  'x-github-event': 'pull_request',
  'x-github-delivery': delivery,
  'x-hub-signature-256': await sign(secret, body),
})

const prPayload = JSON.stringify({
  action: 'opened',
  number: 42,
  repository: { name: 'hono', owner: { login: 'honojs' } },
  pull_request: {
    title: 'feat: add thing',
    html_url: 'https://github.com/honojs/hono/pull/42',
    user: { login: 'someone' },
  },
})

describe('GET /', () => {
  it('responds with the service name', async () => {
    const res = await app.request('/', {}, makeEnv())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'hono-kun', service: 'github' })
  })
})

describe('POST /webhooks/github', () => {
  it('accepts a correctly signed pull_request delivery', async () => {
    const res = await deliver(prPayload, await signedHeaders(prPayload))
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('skips a replayed delivery id', async () => {
    const env = makeEnv()
    const first = await deliver(prPayload, await signedHeaders(prPayload), env)
    expect(first.status).toBe(202)
    const second = await deliver(prPayload, await signedHeaders(prPayload), env)
    expect(second.status).toBe(202)
    expect(await second.json()).toEqual({ ok: true, duplicate: true })
  })

  it('rejects a signed pull_request delivery with a broken JSON body', async () => {
    const body = '{not json'
    const res = await deliver(body, await signedHeaders(body))
    expect(res.status).toBe(400)
  })

  it('accepts a signed non-pull_request delivery without parsing it', async () => {
    const body = '{not json'
    const res = await deliver(body, {
      ...(await signedHeaders(body)),
      'x-github-event': 'ping',
    })
    expect(res.status).toBe(202)
  })

  it('rejects an invalid signature', async () => {
    const res = await deliver(prPayload, {
      ...(await signedHeaders(prPayload)),
      'x-hub-signature-256': await sign('other-secret', prPayload),
    })
    expect(res.status).toBe(401)
  })

  it('rejects a delivery without a signature', async () => {
    const res = await deliver(prPayload, {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-id',
    })
    expect(res.status).toBe(401)
  })

  it('rejects a delivery without webhook headers', async () => {
    const res = await deliver(prPayload, {
      'x-hub-signature-256': await sign(secret, prPayload),
    })
    expect(res.status).toBe(400)
  })

  it('fails closed when the secret is not configured', async () => {
    const res = await deliver(prPayload, await signedHeaders(prPayload), {
      ...makeEnv(),
      GITHUB_WEBHOOK_SECRET: '',
    })
    expect(res.status).toBe(500)
  })
})
