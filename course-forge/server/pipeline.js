import { blueprintSchema, lessonSchema, quizSchema } from './ai/schemas.js'
import {
  blueprintPrompt,
  lessonPrompt,
  moduleQuizPrompt,
  finalAssessmentPrompt,
} from './ai/prompts.js'
import {
  applyBlueprint,
  applyFinalAssessment,
  applyLesson,
  applyQuiz,
  allLessons,
  deriveStage,
  touch,
} from './lib/course.js'

const MAX_TOKENS = Number(process.env.COURSE_FORGE_MAX_TOKENS) || 16000
const QUESTIONS_PER_MODULE = 4

/**
 * Builds a course stage by stage, reporting progress through `onEvent` so the
 * studio can stream it.
 *
 * Each step writes its result back into the course before the next one runs:
 * lessons are written against the finished blueprint, quizzes against the
 * finished lessons. That ordering is what stops the assessment testing
 * material the course never covered.
 */
export async function buildCourse({ course, provider, onEvent = () => {}, signal, steps }) {
  const wanted = new Set(steps ?? ['blueprint', 'lessons', 'assessments'])
  let current = { ...course, generation: { ...course.generation, provider: provider.name, model: provider.model } }
  const usage = []

  const run = async (label, { kind, prompt, schema, context }) => {
    onEvent({ type: 'step:start', label })
    const started = Date.now()
    const result = await provider.generate({ kind, prompt, schema, context, maxTokens: MAX_TOKENS, signal })
    usage.push(result.usage)
    onEvent({ type: 'step:done', label, ms: Date.now() - started, usage: result.usage })
    return result.data
  }

  // Resume, do not restart: a course that already has an outline keeps it,
  // because re-planning would replace the lessons already written under it.
  // Rebuilding from scratch clears the modules first, so the blueprint runs.
  if (wanted.has('blueprint') && current.modules.length === 0) {
    const data = await run('Designing the course blueprint', {
      kind: 'blueprint',
      prompt: blueprintPrompt(current.brief),
      schema: blueprintSchema,
      context: { brief: current.brief },
    })
    current = applyBlueprint(current, data)
    onEvent({ type: 'blueprint', course: current })
  }

  if (wanted.has('lessons')) {
    const lessons = allLessons(current).filter((entry) => entry.lesson.scenes.length === 0)
    for (const entry of lessons) {
      throwIfAborted(signal)
      // Re-read the module and lesson from `current` each time: earlier
      // iterations replaced those objects, and a stale reference would write
      // the new scenes onto a copy that gets thrown away.
      const module = current.modules[entry.moduleIndex]
      const lesson = module.lessons[entry.lessonIndex]
      const data = await run(`Writing "${lesson.title}"`, {
        kind: 'lesson',
        prompt: lessonPrompt({
          course: current,
          module,
          lesson,
          moduleIndex: entry.moduleIndex,
          lessonIndex: entry.lessonIndex,
        }),
        schema: lessonSchema,
        context: { course: current, module, lesson },
      })
      current = applyLesson(current, module.id, lesson.id, data)
      onEvent({ type: 'lesson', moduleId: module.id, lessonId: lesson.id, course: current })
    }
  }

  if (wanted.has('assessments')) {
    for (const [index, module] of current.modules.entries()) {
      throwIfAborted(signal)
      if (module.quiz.questions.length > 0) continue
      const data = await run(`Building the check for "${module.title}"`, {
        kind: 'quiz',
        prompt: moduleQuizPrompt({ course: current, module, questionCount: QUESTIONS_PER_MODULE }),
        schema: quizSchema,
        context: { course: current, module, questionCount: QUESTIONS_PER_MODULE },
      })
      current = applyQuiz(current, current.modules[index].id, data)
      onEvent({ type: 'quiz', moduleId: module.id, course: current })
    }

    if (current.finalAssessment.questions.length === 0 && current.modules.length > 0) {
      throwIfAborted(signal)
      const questionCount = Math.min(20, Math.max(5, current.modules.length * 2))
      const data = await run('Writing the final assessment', {
        kind: 'final',
        prompt: finalAssessmentPrompt({ course: current, questionCount }),
        schema: quizSchema,
        context: { course: current, questionCount },
      })
      current = applyFinalAssessment(current, data)
      onEvent({ type: 'final', course: current })
    }
  }

  current = touch({
    ...current,
    stage: deriveStage(current),
    generation: {
      ...current.generation,
      provider: provider.name,
      model: provider.model,
      usage: totalUsage(usage),
      log: [
        ...current.generation.log,
        { at: new Date().toISOString(), steps: [...wanted], provider: provider.name, model: provider.model },
      ].slice(-20),
    },
  })

  onEvent({ type: 'complete', course: current })
  return current
}

function totalUsage(entries) {
  if (entries.length === 0) return null
  return entries.reduce(
    (total, entry) => ({
      requests: total.requests + 1,
      inputTokens: total.inputTokens + (entry.inputTokens ?? 0),
      outputTokens: total.outputTokens + (entry.outputTokens ?? 0),
      cacheReadTokens: total.cacheReadTokens + (entry.cacheReadTokens ?? 0),
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  )
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('Generation cancelled')
    error.name = 'AbortError'
    throw error
  }
}
