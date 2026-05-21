// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Thin wrapper over @anthropic-ai/sdk. The pipeline only ever asks for
// "given a system prompt and a user message split into a cached prefix
// + a per-retry tail, return the model's text reply." Tests inject a
// mock implementation; production runs hit the API.
//
// The cached prefix is marked with cache_control: ephemeral so retries
// within a single run hit the cache. Anthropic's prompt-caching limits
// apply (the prefix must be ≥ the minimum cacheable size — Sonnet's
// limit is ~1024 tokens; our spec/exemplars block is well over that for
// drink_order).

import Anthropic from '@anthropic-ai/sdk'

export const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_MAX_TOKENS = 2048

export type GenerateCompletionArgs = {
  system: string
  cachedUserPrefix: string
  retryTail: string
  model?: string
  maxTokens?: number
}

export type GenerateCompletion = (
  args: GenerateCompletionArgs,
) => Promise<string>

let cachedClient: Anthropic | null = null

function getClient(): Anthropic {
  if (cachedClient) return cachedClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Provide it in the environment before running the pipeline.',
    )
  }
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

/** Production implementation — calls the Anthropic API. */
export const callAnthropic: GenerateCompletion = async ({
  system,
  cachedUserPrefix,
  retryTail,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
}) => {
  const client = getClient()
  const content: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text',
      text: cachedUserPrefix,
      cache_control: { type: 'ephemeral' },
    },
  ]
  if (retryTail.length > 0) {
    content.push({ type: 'text', text: retryTail })
  }
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('model returned no text block')
  }
  return textBlock.text
}
