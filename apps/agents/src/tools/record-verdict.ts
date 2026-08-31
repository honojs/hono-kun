import { defineTool } from '@flue/runtime'
import {
  getCloudflareContext,
  getDurableObjectIdentity,
} from '@flue/runtime/cloudflare'
import * as v from 'valibot'

/**
 * Writes the reviewer's verdict into the shared evaluations table (D1).
 * The conversation id doubles as the delivery id, so the verdict lands on the row hono-kun-github created when it dispatched the evaluation.
 */
export const recordVerdict = defineTool({
  name: 'record_verdict',
  description:
    'Record your final verdict for this pull request. Call exactly once, after reading the whole diff.',
  input: v.object({
    summary: v.string(),
    risks: v.array(v.string()),
    quality: v.picklist(['good', 'acceptable', 'poor']),
  }),
  run: async ({ data }) => {
    const db = getCloudflareContext().env.DB as D1Database
    const delivery = getDurableObjectIdentity().name
    await db
      .prepare(
        `INSERT INTO evaluations (delivery_id, status, summary, risks, quality, completed_at)
         VALUES (?1, 'done', ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(delivery_id) DO UPDATE SET
           status = 'done', summary = ?2, risks = ?3, quality = ?4, completed_at = datetime('now')`,
      )
      .bind(delivery, data.summary, JSON.stringify(data.risks), data.quality)
      .run()
    return 'Verdict recorded.'
  },
})
