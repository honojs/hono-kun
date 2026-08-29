import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ name: 'hono-kun', service: 'github' }))

export default app
