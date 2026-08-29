import { verifyWebhookSignature } from '@hono-kun/github'
import { Hono } from 'hono'

type Bindings = {
  GITHUB_WEBHOOK_SECRET: string
}

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
  return c.json({ ok: true }, 202)
})

export default app
