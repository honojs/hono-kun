import { setProvider } from '@flue/runtime'
import { getCloudflareContext } from '@flue/runtime/cloudflare'
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai'
import { createAgentRouter } from '@flue/runtime/routing'
import { Hono } from 'hono'
import { Reviewer } from './agents/reviewer'

interface AIBinding {
  run(
    modelId: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<Response | Record<string, unknown>>
}

// Route model calls through the "hono-kun" AI Gateway (unified billing — no provider keys).
// The binding is resolved lazily because env is only available inside a request/agent context.
setProvider(
  cloudflareBindingProvider({
    binding: {
      run: (modelId, inputs, options) =>
        (getCloudflareContext().env as { AI: AIBinding }).AI.run(
          modelId,
          inputs,
          options,
        ),
    },
    gateway: { id: 'hono-kun' },
  }),
)

const app = new Hono()

app.get('/', (c) => c.json({ name: 'hono-kun', service: 'agents' }))
app.route('/agents/reviewer', createAgentRouter(Reviewer))

export default app
