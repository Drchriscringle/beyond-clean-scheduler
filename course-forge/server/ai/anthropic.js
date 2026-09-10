import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './prompts.js'

export const DEFAULT_MODEL = 'claude-opus-5'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/**
 * Structured-output caller. Streams (course scripts run long, and a
 * non-streaming request with this max_tokens risks an HTTP timeout), pins the
 * response to a JSON Schema, and returns parsed JSON.
 */
export function createAnthropicProvider(options = {}) {
  const client = options.client ?? new Anthropic()
  const model = options.model ?? process.env.COURSE_FORGE_MODEL ?? DEFAULT_MODEL
  const effort = options.effort ?? process.env.COURSE_FORGE_EFFORT ?? 'high'
  // Server-side fallbacks reroute a request the safety classifiers decline,
  // rather than failing the course build. Opt out for deployments that need
  // every request pinned to one model.
  const useFallbacks = process.env.COURSE_FORGE_DISABLE_FALLBACKS !== '1'

  async function generate({ prompt, schema, maxTokens = 16000, signal }) {
    const request = {
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema }, effort },
    }

    const message = useFallbacks
      ? await client.beta.messages
          .stream({ ...request, betas: [FALLBACK_BETA], fallbacks: 'default' }, { signal })
          .finalMessage()
      : await client.messages.stream(request, { signal }).finalMessage()

    if (message.stop_reason === 'refusal') {
      const category = message.stop_details?.category ?? 'unspecified'
      throw new GenerationError(
        `Claude declined to generate this content (${category}). Try rewording the topic or source material.`,
      )
    }
    if (message.stop_reason === 'max_tokens') {
      throw new GenerationError(
        'The response was cut off before it was complete. Shorten the lesson or raise COURSE_FORGE_MAX_TOKENS.',
      )
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return {
      data: parseJson(text),
      usage: {
        model: message.model ?? model,
        inputTokens: message.usage?.input_tokens ?? 0,
        outputTokens: message.usage?.output_tokens ?? 0,
        cacheReadTokens: message.usage?.cache_read_input_tokens ?? 0,
      },
    }
  }

  return { name: 'anthropic', model, generate }
}

export class GenerationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GenerationError'
    this.expected = true
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new GenerationError('Claude returned a response that was not valid JSON.')
  }
}
