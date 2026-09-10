import { createAnthropicProvider } from './anthropic.js'
import { createMockProvider } from './mock.js'

/**
 * Picks a provider. The mock is used when explicitly requested, or when no
 * Anthropic credentials are resolvable — so a fresh clone runs end to end
 * without setup, and says so rather than failing at the first request.
 */
export function selectProvider(options = {}) {
  const requested = options.provider ?? process.env.COURSE_FORGE_PROVIDER
  if (requested === 'mock') return createMockProvider()
  if (requested === 'anthropic') return createAnthropicProvider(options)
  return hasCredentials(options) ? createAnthropicProvider(options) : createMockProvider()
}

/**
 * A key supplied with the request counts as credentials — that is how the
 * hosted studio works, where each author brings their own and the server
 * keeps none.
 */
export function hasCredentials(options = {}) {
  return Boolean(options.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}
