import test from 'node:test'
import assert from 'node:assert/strict'
import { createAnthropicProvider, GenerationError, DEFAULT_MODEL } from '../server/ai/anthropic.js'
import { blueprintSchema } from '../server/ai/schemas.js'

/** Stands in for the SDK client, recording the request and replaying one message. */
function fakeClient(message) {
  const requests = []
  const stream = (request) => {
    requests.push(request)
    return { finalMessage: async () => message }
  }
  return { requests, messages: { stream }, beta: { messages: { stream } } }
}

const okMessage = (data) => ({
  stop_reason: 'end_turn',
  model: DEFAULT_MODEL,
  content: [{ type: 'text', text: JSON.stringify(data) }],
  usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 1000 },
})

test('a generation is pinned to the schema and streamed', async () => {
  const client = fakeClient(okMessage({ title: 'Built' }))
  const provider = createAnthropicProvider({ client })

  const result = await provider.generate({ prompt: 'Design a course', schema: blueprintSchema, maxTokens: 16000 })

  assert.deepEqual(result.data, { title: 'Built' })
  assert.deepEqual(result.usage, {
    model: DEFAULT_MODEL,
    inputTokens: 1200,
    outputTokens: 800,
    cacheReadTokens: 1000,
  })

  const [request] = client.requests
  assert.equal(request.model, DEFAULT_MODEL)
  assert.equal(request.output_config.format.type, 'json_schema')
  assert.equal(request.output_config.format.schema, blueprintSchema)
  assert.equal(request.max_tokens, 16000)
  assert.deepEqual(request.messages, [{ role: 'user', content: 'Design a course' }])
})

test('the frozen system prompt is marked for caching', async () => {
  const client = fakeClient(okMessage({}))
  await createAnthropicProvider({ client }).generate({ prompt: 'x', schema: blueprintSchema })

  const [{ system }] = client.requests
  assert.equal(system[0].type, 'text')
  assert.deepEqual(system[0].cache_control, { type: 'ephemeral' })
})

test('a refusal is reported as something the author can act on', async () => {
  const client = fakeClient({
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category: 'cyber' },
    content: [],
  })

  await assert.rejects(
    () => createAnthropicProvider({ client }).generate({ prompt: 'x', schema: blueprintSchema }),
    (error) => {
      assert.ok(error instanceof GenerationError)
      assert.ok(error.expected, 'shown to the author rather than logged as a crash')
      assert.match(error.message, /cyber/)
      return true
    },
  )
})

test('a truncated response is not passed off as a course', async () => {
  const client = fakeClient({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"title": "cut o' }] })

  await assert.rejects(
    () => createAnthropicProvider({ client }).generate({ prompt: 'x', schema: blueprintSchema }),
    /cut off/,
  )
})

test('a non-JSON response fails loudly', async () => {
  const client = fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure! Here you go:' }] })

  await assert.rejects(
    () => createAnthropicProvider({ client }).generate({ prompt: 'x', schema: blueprintSchema }),
    /not valid JSON/,
  )
})

test('thinking blocks are ignored when the JSON is collected', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: 'considering the outline' },
      { type: 'text', text: '{"title":' },
      { type: 'text', text: '"Split across blocks"}' },
    ],
    usage: {},
  })

  const result = await createAnthropicProvider({ client }).generate({ prompt: 'x', schema: blueprintSchema })
  assert.deepEqual(result.data, { title: 'Split across blocks' })
})

test('server-side fallbacks are on by default and can be turned off', async (t) => {
  const withFallbacks = fakeClient(okMessage({}))
  await createAnthropicProvider({ client: withFallbacks }).generate({ prompt: 'x', schema: blueprintSchema })
  assert.equal(withFallbacks.requests[0].fallbacks, 'default')
  assert.ok(withFallbacks.requests[0].betas.some((beta) => beta.startsWith('server-side-fallback-')))

  t.after(() => {
    delete process.env.COURSE_FORGE_DISABLE_FALLBACKS
  })
  process.env.COURSE_FORGE_DISABLE_FALLBACKS = '1'

  const without = fakeClient(okMessage({}))
  await createAnthropicProvider({ client: without }).generate({ prompt: 'x', schema: blueprintSchema })
  assert.equal(without.requests[0].fallbacks, undefined)
  assert.equal(without.requests[0].betas, undefined)
})

test('the model and effort can be overridden without touching the code', async (t) => {
  t.after(() => {
    delete process.env.COURSE_FORGE_MODEL
    delete process.env.COURSE_FORGE_EFFORT
  })
  process.env.COURSE_FORGE_MODEL = 'claude-sonnet-5'
  process.env.COURSE_FORGE_EFFORT = 'medium'

  const client = fakeClient(okMessage({}))
  const provider = createAnthropicProvider({ client })
  await provider.generate({ prompt: 'x', schema: blueprintSchema })

  assert.equal(provider.model, 'claude-sonnet-5')
  assert.equal(client.requests[0].output_config.effort, 'medium')
})
