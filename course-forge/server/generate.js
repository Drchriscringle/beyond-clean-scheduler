import { buildCourse } from './pipeline.js'
import { selectProvider } from './ai/provider.js'
import { courseProgress, touch } from './lib/course.js'

export const ALL_STEPS = ['blueprint', 'lessons', 'assessments']

/**
 * Runs a build, recording its progress on the course itself.
 *
 * A course build is many model calls over several minutes — longer than any
 * request should be held open, and longer than a serverless function is
 * allowed to run synchronously. So the job writes its own state as it goes
 * and the studio polls for it, which also means a build survives the author
 * closing the tab.
 */
export async function runGeneration({ store, course, steps, reset, providerOptions = {} }) {
  const requested = Array.isArray(steps) && steps.length ? steps : ALL_STEPS
  let working = reset ? clearGenerated(course, requested) : course

  const provider = selectProvider(providerOptions)
  const startedAt = new Date().toISOString()
  let job = {
    status: 'running',
    steps: [],
    startedAt,
    finishedAt: null,
    message: null,
    provider: provider.name,
    model: provider.model,
  }

  const persist = async (next, jobState) => {
    working = withJob(next, jobState)
    await store.save(working)
  }

  await persist(working, job)

  try {
    const result = await buildCourse({
      course: working,
      provider,
      steps: requested,
      onEvent: (event) => {
        if (event.type === 'step:start') {
          job = { ...job, steps: [...job.steps, { label: event.label, state: 'running' }] }
        }
        if (event.type === 'step:done') {
          job = {
            ...job,
            steps: job.steps.map((step, index) =>
              index === job.steps.length - 1 ? { ...step, state: 'done', ms: event.ms } : step,
            ),
          }
        }
        // Persisting on every stage means a build that dies halfway leaves the
        // author with the lessons already written, not an empty course.
        const snapshot = event.course ?? working
        persist(snapshot, job).catch(() => {})
      },
    })

    job = { ...job, status: 'done', finishedAt: new Date().toISOString() }
    await persist(result, job)
    return working
  } catch (error) {
    job = {
      ...job,
      status: 'error',
      finishedAt: new Date().toISOString(),
      message: error.expected ? error.message : 'Generation failed. Check the function log.',
    }
    if (!error.expected) console.error('[course-forge] generation failed:', error)
    await persist(working, job)
    return working
  }
}

function withJob(course, job) {
  return touch({ ...course, generation: { ...course.generation, job } })
}

export function clearGenerated(course, steps) {
  let next = { ...course }
  if (steps.includes('blueprint')) {
    return { ...next, modules: [], finalAssessment: { questions: [] } }
  }
  if (steps.includes('lessons')) {
    next.modules = next.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, scenes: [], takeaways: [], glossary: [] })),
    }))
  }
  if (steps.includes('assessments')) {
    next.modules = next.modules.map((module) => ({ ...module, quiz: { questions: [] } }))
    next.finalAssessment = { questions: [] }
  }
  return next
}

/** True while a build for this course is still going. */
export function isRunning(course) {
  return course.generation?.job?.status === 'running'
}

export { courseProgress }
