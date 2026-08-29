import { toPullRequestEvent, verifyWebhookSignature } from '@hono-kun/github'
import { handlePullRequestEvent } from '@hono-kun/workflow-pull-request'
import { Hono } from 'hono'

type Bindings = {
  GITHUB_WEBHOOK_SECRET: string
  DELIVERIES: KVNamespace
}

// GitHub does not redeliver automatically after this window, so remembering deliveries longer buys nothing.
const DELIVERY_TTL_SECONDS = 60 * 60 * 24

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.json({ name: 'hono-kun', service: 'github' }))

app.post('/webhooks/github', async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    return c.json({ ok: false, error: 'webhook secret is not configured' }, 500)
  }
  const event = c.req.header('x-github-event')
  const delivery = c.req.header('x-github-delivery')
  if (!event || !delivery) {
    return c.json({ ok: false, error: 'missing webhook headers' }, 400)
  }
  const body = await c.req.text()
  const verified = await verifyWebhookSignature(
    secret,
    body,
    c.req.header('x-hub-signature-256'),
  )
  if (!verified) {
    return c.json({ ok: false, error: 'invalid signature' }, 401)
  }
  if (await c.env.DELIVERIES.get(delivery)) {
    return c.json({ ok: true, duplicate: true }, 202)
  }
  await c.env.DELIVERIES.put(delivery, '1', {
    expirationTtl: DELIVERY_TTL_SECONDS,
  })
  if (event === 'pull_request') {
    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      return c.json({ ok: false, error: 'invalid JSON payload' }, 400)
    }
    const pullRequestEvent = toPullRequestEvent(payload)
    if (pullRequestEvent) {
      await handlePullRequestEvent(pullRequestEvent)
    }
  }
  return c.json({ ok: true }, 202)
})

export default app
