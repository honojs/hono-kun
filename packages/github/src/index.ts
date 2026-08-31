/**
 * Read-side GitHub helpers. Write operations never live here — they belong exclusively to apps/publisher.
 */

import type { PullRequestEvent, RepositoryRef } from '@hono-kun/schemas'

const encoder = new TextEncoder()

/** Caps what we feed to agents; beyond this a PR is too large to review meaningfully anyway. */
const MAX_DIFF_CHARS = 80_000

// Lockfile diffs add nothing to a review and burn tokens, so their contents are omitted.
const GENERATED_FILE_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb?$/,
]

/**
 * Replaces diff sections of generated files (lockfiles) with a one-line marker, keeping the fact that the file changed visible to the reviewer.
 */
export const stripGeneratedDiffs = (diff: string): string =>
  diff
    .split(/(?=^diff --git )/m)
    .map((section) => {
      const path = section.match(/^diff --git a\/(\S+) /)?.[1]
      return path && GENERATED_FILE_PATTERNS.some((re) => re.test(path))
        ? `(diff for ${path} omitted)\n`
        : section
    })
    .join('')

/**
 * Fetches the diff of a public pull request, without authentication.
 *
 * @returns The diff (lockfile sections omitted, truncated to {@link MAX_DIFF_CHARS}), or `null` when it cannot be fetched.
 */
export const fetchPullRequestDiff = async (
  repository: RepositoryRef,
  number: number,
): Promise<string | null> => {
  const res = await fetch(
    `https://github.com/${repository.owner}/${repository.repo}/pull/${number}.diff`,
    {
      headers: { 'user-agent': 'hono-kun' },
      redirect: 'follow',
    },
  )
  if (!res.ok) {
    return null
  }
  const diff = stripGeneratedDiffs(await res.text())
  return diff.length > MAX_DIFF_CHARS
    ? `${diff.slice(0, MAX_DIFF_CHARS)}\n… (diff truncated)`
    : diff
}

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
  const label =
    isRecord(payload.label) && typeof payload.label.name === 'string'
      ? payload.label.name
      : undefined
  return {
    action,
    number,
    repository: { owner: owner.login, repo: repository.name },
    title: pr.title,
    author: user.login,
    url: pr.html_url,
    ...(label === undefined ? {} : { label }),
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
