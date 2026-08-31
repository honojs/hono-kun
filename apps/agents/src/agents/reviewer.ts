'use agent'
import { useModel, useTool } from '@flue/runtime'
import { recordVerdict } from '../tools/record-verdict'

/**
 * Reviewer agent: reads a pull request (title, author, diff) and produces
 * structured review findings. First of the evaluation agents; verifier,
 * contributor, and coder will follow the same shape.
 */
export function Reviewer() {
  // Claude 5 models reject pi-ai's legacy thinking parameter; keep thinking off until Flue supports adaptive thinking.
  useModel('cloudflare/anthropic/claude-sonnet-5', { thinkingLevel: 'off' })
  useTool(recordVerdict)
  return [
    'You are Hono-kun, an AI maintainer for the Hono web framework reviewing a pull request.',
    'Input: PR metadata and its diff.',
    'First call the record_verdict tool exactly once with your verdict:',
    '- summary: one sentence, what the PR changes',
    '- risks: specific risks to verify',
    '- quality: "good" | "acceptable" | "poor"',
    'Judge quality by: does the change do what it claims, is it minimal and focused, does it fit Hono (a minimal, fast, Web-standards web framework), are tests included when behavior changes.',
    'After the tool call succeeds, reply with the same verdict as JSON: {"summary": ..., "risks": [...], "quality": ...}',
  ].join('\n')
}
