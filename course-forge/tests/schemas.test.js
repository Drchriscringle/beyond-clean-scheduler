import test from 'node:test'
import assert from 'node:assert/strict'
import { blueprintSchema, lessonSchema, quizSchema } from '../server/ai/schemas.js'
import { SYSTEM_PROMPT, blueprintPrompt, lessonPrompt, moduleQuizPrompt, finalAssessmentPrompt } from '../server/ai/prompts.js'
import { sampleCourse } from './helpers.js'

/**
 * Structured outputs rejects an object schema that does not list every
 * property in `required` or that allows extra ones, so this walks each schema
 * and enforces the rule the API enforces.
 */
function walk(schema, path, visit) {
  visit(schema, path)
  if (schema.type === 'object') {
    for (const [key, value] of Object.entries(schema.properties ?? {})) walk(value, `${path}.${key}`, visit)
  }
  if (schema.type === 'array' && schema.items) walk(schema.items, `${path}[]`, visit)
}

for (const [name, schema] of Object.entries({ blueprintSchema, lessonSchema, quizSchema })) {
  test(`${name} satisfies the structured-output rules`, () => {
    walk(schema, name, (node, path) => {
      if (node.type !== 'object') return
      assert.equal(node.additionalProperties, false, `${path} must forbid extra properties`)
      const properties = Object.keys(node.properties ?? {})
      assert.deepEqual(
        [...(node.required ?? [])].sort(),
        properties.sort(),
        `${path} must require every property it declares`,
      )
    })
  })
}

test('quiz options are always four, so the answer index always has a home', () => {
  const options = quizSchema.properties.questions.items.properties.options
  assert.equal(options.minItems, 4)
  assert.equal(options.maxItems, 4)
})

test('the system prompt is frozen, so it stays a cacheable prefix', () => {
  assert.equal(SYSTEM_PROMPT, SYSTEM_PROMPT.trim())
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(SYSTEM_PROMPT), 'no dates')
  assert.ok(!SYSTEM_PROMPT.includes('${'), 'nothing interpolated into it')
})

test('the blueprint prompt states the brief it must design against', () => {
  const prompt = blueprintPrompt({
    topic: 'Kubernetes autoscaling',
    audience: 'Platform engineers',
    level: 'advanced',
    tone: 'professional',
    durationMinutes: 90,
    moduleCount: 4,
    goals: 'Tune HPA without thrashing',
    sourceMaterial: '',
  })
  for (const expected of ['Kubernetes autoscaling', 'Platform engineers', 'advanced', '90 minutes', '4 modules', 'Tune HPA']) {
    assert.ok(prompt.includes(expected), `prompt mentions ${expected}`)
  }
})

test('a lesson prompt scopes the writer to one lesson among its siblings', () => {
  const course = sampleCourse()
  const module = course.modules[0]
  const prompt = lessonPrompt({ course, module, lesson: module.lessons[1], moduleIndex: 0, lessonIndex: 1 })

  assert.ok(prompt.includes('<- write this one'), 'the target lesson is marked')
  assert.ok(prompt.includes(module.lessons[0].title), 'its siblings are listed so it does not repeat them')
  assert.ok(prompt.includes('do not pre-empt them'))
})

test('quiz prompts are built from what the lessons actually said', () => {
  const course = sampleCourse()
  const prompt = moduleQuizPrompt({ course, module: course.modules[0], questionCount: 4 })
  assert.ok(prompt.includes('4-question'))
  assert.ok(prompt.includes(course.modules[0].lessons[0].scenes[0].heading))

  const final = finalAssessmentPrompt({ course, questionCount: 8 })
  assert.ok(final.includes('8-question'))
  assert.ok(final.includes(course.outcomes[0]))
})
