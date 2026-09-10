import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCourse,
  normalizeBrief,
  applyBlueprint,
  applyLesson,
  applyQuiz,
  applyFinalAssessment,
  courseProgress,
  deriveStage,
  estimateSeconds,
} from '../server/lib/course.js'

test('normalizeBrief clamps and defaults every field', () => {
  const brief = normalizeBrief({
    topic: '  Kubernetes  ',
    level: 'wizard',
    tone: 'sarcastic',
    durationMinutes: 99999,
    moduleCount: 0,
  })
  assert.equal(brief.topic, 'Kubernetes')
  assert.equal(brief.level, 'beginner', 'unknown level falls back')
  assert.equal(brief.tone, 'friendly', 'unknown tone falls back')
  assert.equal(brief.durationMinutes, 1200, 'runtime is capped')
  assert.equal(brief.moduleCount, 1, 'module count has a floor of 1')
})

test('normalizeBrief derives a module count from the runtime', () => {
  assert.equal(normalizeBrief({ topic: 'x', durationMinutes: 120 }).moduleCount, 6)
  assert.equal(normalizeBrief({ topic: 'x', durationMinutes: 10 }).moduleCount, 2)
})

test('applyBlueprint coerces a malformed model response instead of trusting it', () => {
  const course = createCourse({ topic: 'Testing' })
  const applied = applyBlueprint(course, {
    title: 42,
    outcomes: 'not an array',
    modules: [
      { title: null, lessons: [{ minutes: 'soon' }] },
      { title: 'No lessons', lessons: [] },
    ],
  })

  assert.equal(applied.modules.length, 1, 'a module with no lessons is dropped')
  assert.deepEqual(applied.outcomes, [], 'a non-array outcome list becomes empty')
  assert.equal(applied.modules[0].title, 'Module 1', 'a missing title is filled in')
  assert.equal(applied.modules[0].lessons[0].minutes, 8, 'an unparseable duration falls back')
  assert.equal(applied.stage, 'blueprint')
})

test('applyBlueprint keeps existing ids so edits survive a re-plan', () => {
  const course = applyBlueprint(createCourse({ topic: 'Testing' }), {
    modules: [{ title: 'A', lessons: [{ title: 'One' }] }],
  })
  const moduleId = course.modules[0].id
  const lessonId = course.modules[0].lessons[0].id

  const replanned = applyBlueprint(course, {
    modules: [{ title: 'A renamed', lessons: [{ title: 'One renamed' }] }],
  })
  assert.equal(replanned.modules[0].id, moduleId)
  assert.equal(replanned.modules[0].lessons[0].id, lessonId)
})

test('applyLesson estimates runtime from the narration it was given', () => {
  const course = applyBlueprint(createCourse({ topic: 'Testing' }), {
    modules: [{ title: 'A', lessons: [{ title: 'One', minutes: 5 }] }],
  })
  const { id: moduleId } = course.modules[0]
  const { id: lessonId } = course.modules[0].lessons[0]

  const narration = 'word '.repeat(280).trim()
  const applied = applyLesson(course, moduleId, lessonId, {
    scenes: [
      { heading: 'Intro', bullets: ['a', 'b'], narration, visual: 'diagram' },
      { heading: 'Empty', bullets: [], narration: '' },
    ],
    takeaways: ['Remember this'],
    glossary: [{ term: 'T', definition: 'D' }, { term: '', definition: 'no term' }],
  })

  const lesson = applied.modules[0].lessons[0]
  assert.equal(lesson.scenes.length, 1, 'a scene with no narration and no bullets is dropped')
  assert.equal(lesson.glossary.length, 1, 'a glossary entry missing a term is dropped')
  assert.equal(lesson.minutes, 2, '280 words at 140wpm is two minutes')
  assert.equal(lesson.scenes[0].seconds, estimateSeconds(narration))
})

test('applyQuiz drops questions that cannot be answered wrongly', () => {
  const course = applyBlueprint(createCourse({ topic: 'Testing' }), {
    modules: [{ title: 'A', lessons: [{ title: 'One' }] }],
  })
  const applied = applyQuiz(course, course.modules[0].id, {
    questions: [
      { stem: 'Good?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'because' },
      { stem: 'Only one option', options: ['a'], answerIndex: 0 },
      { stem: '', options: ['a', 'b'], answerIndex: 0 },
      { stem: 'Out of range', options: ['a', 'b'], answerIndex: 9 },
    ],
  })

  const { questions } = applied.modules[0].quiz
  assert.equal(questions.length, 2)
  assert.equal(questions[0].answerIndex, 2)
  assert.equal(questions[1].answerIndex, 1, 'an out-of-range answer is clamped into the options')
})

test('progress and stage are derived from content, not from a stored flag', () => {
  let course = createCourse({ topic: 'Testing' })
  assert.equal(deriveStage(course), 'brief')

  course = applyBlueprint(course, {
    modules: [{ title: 'A', lessons: [{ title: 'One' }, { title: 'Two' }] }],
  })
  assert.equal(deriveStage(course), 'blueprint')
  assert.equal(courseProgress(course).complete, false)

  const [module] = course.modules
  for (const lesson of module.lessons) {
    course = applyLesson(course, module.id, lesson.id, {
      scenes: [{ heading: 'H', bullets: [], narration: 'Some narration here.' }],
    })
  }
  assert.equal(deriveStage(course), 'lessons')

  course = applyQuiz(course, module.id, {
    questions: [{ stem: 'Q', options: ['a', 'b'], answerIndex: 0 }],
  })
  assert.equal(courseProgress(course).complete, true)

  course = applyFinalAssessment(course, {
    questions: [{ stem: 'Q', options: ['a', 'b'], answerIndex: 1 }],
  })
  assert.equal(deriveStage(course), 'ready')
})

test('a lesson with no narration still gets a floor duration', () => {
  assert.equal(estimateSeconds(''), 4)
  assert.equal(estimateSeconds(null), 4)
})
