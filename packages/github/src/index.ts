/**
 * Read-side GitHub helpers. Write operations never live here — they belong exclusively to apps/publisher.
 */

import type { PullRequestEvent } from '@hono-kun/schemas'

const encoder = new TextEncoder()

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

/**
 * Extracts a normalized {@link PullRequestEvent} from a `pull_request` webhook payload.
 *
 * @param payload - The parsed JSON body of the webhook delivery.
 * @returns The normalized event, or `null` when the payload does not have the expected shape.
 */
export const toPullRequestEvent = (
  payload: unknown,
): PullRequestEvent | null => {
  if (!isRecord(payload)) {
    return null
  }
  const { action, number, repository, pull_request: pr } = payload
  if (
    typeof action !== 'string' ||
    typeof number !== 'number' ||
    !isRecord(repository) ||
    !isRecord(pr)
  ) {
    return null
  }
  const owner = repository.owner
  if (
    !isRecord(owner) ||
    typeof owner.login !== 'string' ||
    typeof repository.name !== 'string'
  ) {
    return null
  }
  const user = pr.user
  if (
    typeof pr.title !== 'string' ||
    typeof pr.html_url !== 'string' ||
    !isRecord(user) ||
    typeof user.login !== 'string'
  ) {
    return null
  }
  return {
    action,
    number,
    repository: { owner: owner.login, repo: repository.name },
    title: pr.title,
    author: user.login,
    url: pr.html_url,
  }
}

const SIGNATURE_PREFIX = 'sha256='
const HEX_64 = /^[0-9a-f]{64}$/

/**
 * Verifies a GitHub webhook delivery against the raw request body.
 *
 * @param secret - The webhook secret configured on the GitHub App/repository.
 * @param body - The raw request body, before any JSON parsing.
 * @param signature - The `x-hub-signature-256` header value (`sha256=<hex>`).
 * @returns `true` only if the signature matches. The comparison is constant-time via `crypto.subtle.verify`.
 */
export const verifyWebhookSignature = async (
  secret: string,
  body: string,
  signature: string | undefined,
): Promise<boolean> => {
  if (!signature || !signature.startsWith(SIGNATURE_PREFIX)) {
    return false
  }
  const hex = signature.slice(SIGNATURE_PREFIX.length)
  if (!HEX_64.test(hex)) {
    return false
  }
  const mac = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    mac[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return await crypto.subtle.verify('HMAC', key, mac, encoder.encode(body))
}
