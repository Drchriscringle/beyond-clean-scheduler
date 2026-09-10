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
  return hasCredentials() ? createAnthropicProvider(options) : createMockProvider()
}

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}
