import { newId } from './ids.js'

export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const TONES = ['friendly', 'professional', 'energetic', 'academic', 'plain-spoken']
export const STAGES = ['brief', 'blueprint', 'lessons', 'assessments', 'ready']

/** Seconds of narration per word, used to estimate scene and lesson length. */
const SECONDS_PER_WORD = 60 / 140

export function createCourse(brief) {
  const now = new Date().toISOString()
  return {
    id: newId('crs'),
    createdAt: now,
    updatedAt: now,
    stage: 'brief',
    brief: normalizeBrief(brief),
    title: brief?.topic ? String(brief.topic).trim() : 'Untitled course',
    subtitle: '',
    summary: '',
    outcomes: [],
    prerequisites: [],
    modules: [],
    finalAssessment: { questions: [] },
    generation: { log: [], provider: null, model: null, usage: null },
  }
}

export function normalizeBrief(brief = {}) {
  const durationMinutes = clampInt(brief.durationMinutes, 10, 1200, 60)
  return {
    topic: text(brief.topic, 200) || 'Untitled course',
    audience: text(brief.audience, 300) || 'General learners',
    level: LEVELS.includes(brief.level) ? brief.level : 'beginner',
    tone: TONES.includes(brief.tone) ? brief.tone : 'friendly',
    durationMinutes,
    moduleCount: clampInt(brief.moduleCount, 1, 12, defaultModuleCount(durationMinutes)),
    goals: text(brief.goals, 2000),
    // Source material grounds generation in the author's own content rather
    // than the model's general knowledge. Capped so a pasted book does not
    // blow past the context window in a single request.
    sourceMaterial: text(brief.sourceMaterial, 200_000),
  }
}

function defaultModuleCount(durationMinutes) {
  return clampInt(Math.round(durationMinutes / 20), 2, 8, 3)
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function text(value, maxLength) {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, maxLength)
}

function list(value, maxItems, maxLength = 400) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

/**
 * Merge a model-produced blueprint into a course. The model is instructed to
 * return this shape, but nothing downstream may assume it complied: every
 * field is coerced, clamped, and defaulted here so a malformed response
 * degrades into a thin course rather than a crash in the exporter.
 */
export function applyBlueprint(course, blueprint = {}) {
  const modules = (Array.isArray(blueprint.modules) ? blueprint.modules : [])
    .slice(0, 12)
    .map((module, moduleIndex) => {
      const existing = course.modules[moduleIndex]
      return {
        id: existing?.id ?? newId('mod'),
        title: text(module?.title, 200) || `Module ${moduleIndex + 1}`,
        summary: text(module?.summary, 1000),
        objectives: list(module?.objectives, 8),
        lessons: (Array.isArray(module?.lessons) ? module.lessons : [])
          .slice(0, 12)
          .map((lesson, lessonIndex) => ({
            id: existing?.lessons?.[lessonIndex]?.id ?? newId('lsn'),
            title: text(lesson?.title, 200) || `Lesson ${lessonIndex + 1}`,
            summary: text(lesson?.summary, 1000),
            minutes: clampInt(lesson?.minutes, 1, 120, 8),
            objectives: list(lesson?.objectives, 6),
            scenes: [],
            takeaways: [],
            glossary: [],
          })),
        quiz: { questions: [] },
      }
    })
    .filter((module) => module.lessons.length > 0)

  return touch({
    ...course,
    title: text(blueprint.title, 200) || course.title,
    subtitle: text(blueprint.subtitle, 300),
    summary: text(blueprint.summary, 3000),
    outcomes: list(blueprint.outcomes, 10),
    prerequisites: list(blueprint.prerequisites, 8),
    modules,
    stage: modules.length > 0 ? 'blueprint' : course.stage,
  })
}

export function applyLesson(course, moduleId, lessonId, generated = {}) {
  const scenes = (Array.isArray(generated.scenes) ? generated.scenes : [])
    .slice(0, 20)
    .map((scene, index) => {
      const narration = text(scene?.narration, 6000)
      return {
        heading: text(scene?.heading, 160) || `Scene ${index + 1}`,
        bullets: list(scene?.bullets, 6, 240),
        narration,
        visual: text(scene?.visual, 500),
        seconds: estimateSeconds(narration),
      }
    })
    .filter((scene) => scene.narration || scene.bullets.length > 0)

  return mapLesson(course, moduleId, lessonId, (lesson) => ({
    ...lesson,
    scenes,
    takeaways: list(generated.takeaways, 6),
    glossary: (Array.isArray(generated.glossary) ? generated.glossary : [])
      .slice(0, 12)
      .map((entry) => ({
        term: text(entry?.term, 120),
        definition: text(entry?.definition, 600),
      }))
      .filter((entry) => entry.term && entry.definition),
    minutes: scenes.length > 0
      ? Math.max(1, Math.round(scenes.reduce((total, s) => total + s.seconds, 0) / 60))
      : lesson.minutes,
  }))
}

export function applyQuiz(course, moduleId, generated = {}) {
  const questions = normalizeQuestions(generated.questions)
  const modules = course.modules.map((module) =>
    module.id === moduleId ? { ...module, quiz: { questions } } : module,
  )
  return touch({ ...course, modules })
}

export function applyFinalAssessment(course, generated = {}) {
  return touch({ ...course, finalAssessment: { questions: normalizeQuestions(generated.questions) } })
}

function normalizeQuestions(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 25)
    .map((question) => {
      const options = list(question?.options, 6, 400)
      const answerIndex = clampInt(question?.answerIndex, 0, Math.max(0, options.length - 1), 0)
      return {
        stem: text(question?.stem, 800),
        options,
        answerIndex,
        explanation: text(question?.explanation, 1200),
      }
    })
    // A question with fewer than two options cannot be answered wrongly, so
    // it teaches nothing — drop it rather than ship a broken quiz.
    .filter((question) => question.stem && question.options.length >= 2)
}

function mapLesson(course, moduleId, lessonId, update) {
  const modules = course.modules.map((module) => {
    if (module.id !== moduleId) return module
    return {
      ...module,
      lessons: module.lessons.map((lesson) => (lesson.id === lessonId ? update(lesson) : lesson)),
    }
  })
  return touch({ ...course, modules })
}

export function estimateSeconds(narration) {
  const words = String(narration ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(4, Math.round(words * SECONDS_PER_WORD))
}

export function touch(course) {
  return { ...course, updatedAt: new Date().toISOString() }
}

/** Where the course stands, derived from content rather than trusted state. */
export function courseProgress(course) {
  const lessons = allLessons(course)
  const written = lessons.filter((entry) => entry.lesson.scenes.length > 0).length
  const quizzed = course.modules.filter((module) => module.quiz.questions.length > 0).length
  return {
    modules: course.modules.length,
    lessons: lessons.length,
    lessonsWritten: written,
    modulesQuizzed: quizzed,
    hasFinalAssessment: course.finalAssessment.questions.length > 0,
    totalMinutes: lessons.reduce((total, entry) => total + entry.lesson.minutes, 0),
    complete:
      lessons.length > 0 && written === lessons.length && quizzed === course.modules.length,
  }
}

export function allLessons(course) {
  return course.modules.flatMap((module, moduleIndex) =>
    module.lessons.map((lesson, lessonIndex) => ({ module, moduleIndex, lesson, lessonIndex })),
  )
}

export function deriveStage(course) {
  const progress = courseProgress(course)
  if (progress.complete && progress.hasFinalAssessment) return 'ready'
  if (progress.modulesQuizzed > 0) return 'assessments'
  if (progress.lessonsWritten > 0) return 'lessons'
  if (progress.modules > 0) return 'blueprint'
  return 'brief'
}
