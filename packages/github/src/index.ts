/**
 * Read-side GitHub helpers. Write operations never live here — they belong exclusively to apps/publisher.
 */

const encoder = new TextEncoder()

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
