import { createCourse, normalizeBrief, courseProgress, deriveStage, touch, LEVELS, TONES } from '../lib/course.js'
import { selectProvider, hasCredentials } from '../ai/provider.js'
import { renderCourseHtml } from '../export/html.js'
import { renderCourseMarkdown } from '../export/markdown.js'
import { buildScormPackage } from '../export/scorm.js'
import { slugify } from '../lib/ids.js'
import { ALL_STEPS, isRunning } from '../generate.js'

const MAX_BODY_BYTES = 5_000_000

/**
 * The API as a web-standard handler: Request in, Response out.
 *
 * Written this way so one implementation serves both the local Node server
 * and the hosted Netlify function, rather than the two drifting apart.
 */
export function createApiHandler({ store, providerOptions = {}, startGeneration, generatePath }) {
  return async function handle(request) {
    try {
      return await route(request)
    } catch (error) {
      const status = error.status ?? 500
      if (status >= 500) console.error('[course-forge]', error)
      return json(status, { error: status >= 500 ? 'Internal server error.' : error.message })
    }
  }

  async function route(request) {
    const url = new URL(request.url)
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    // The author's key travels per request and is never written down.
    const options = { ...providerOptions, apiKey: request.headers.get('x-anthropic-key') || undefined }

    if (segments[0] === 'meta' && request.method === 'GET') {
      const provider = selectProvider(options)
      return json(200, {
        provider: provider.name,
        model: provider.model,
        hasCredentials: hasCredentials(options),
        // True when the deployment holds no key of its own, so the studio
        // knows to ask the author for one.
        needsKey: !hasCredentials({}),
        // Where builds are started. Hosted, that is the background function;
        // locally it is this same handler. The studio is told rather than
        // having to probe for it.
        generatePath: generatePath ?? '/api/courses/:id/generate',
        levels: LEVELS,
        tones: TONES,
      })
    }

    if (segments[0] !== 'courses') return json(404, { error: 'Not found.' })

    if (segments.length === 1) {
      if (request.method === 'GET') {
        const courses = await store.list()
        return json(200, { courses: courses.map(summarize) })
      }
      if (request.method === 'POST') {
        const body = await readJson(request)
        const course = createCourse(body.brief ?? body)
        await store.save(course)
        return json(201, { course })
      }
      return json(405, { error: 'Method not allowed.' })
    }

    const course = await store.get(segments[1])
    if (!course) return json(404, { error: 'No course with that id.' })

    if (segments.length === 2) {
      if (request.method === 'GET') {
        return json(200, { course, progress: courseProgress(course), job: course.generation?.job ?? null })
      }
      if (request.method === 'DELETE') {
        await store.remove(course.id)
        return json(200, { ok: true })
      }
      if (request.method === 'PATCH') {
        const updated = applyEdit(course, await readJson(request))
        await store.save(updated)
        return json(200, { course: updated, progress: courseProgress(updated) })
      }
      return json(405, { error: 'Method not allowed.' })
    }

    if (segments[2] === 'generate' && request.method === 'POST') {
      if (!startGeneration) {
        return json(501, { error: 'This deployment starts builds through its background function.' })
      }
      if (isRunning(course)) return json(409, { error: 'A build is already running for this course.' })
      const body = await readJson(request)
      await startGeneration({
        course,
        steps: Array.isArray(body.steps) && body.steps.length ? body.steps : ALL_STEPS,
        reset: Boolean(body.reset),
        providerOptions: options,
      })
      return json(202, { started: true })
    }

    if (segments[2] === 'export' && request.method === 'GET') {
      return exportCourse(course, segments[3])
    }

    return json(404, { error: 'Not found.' })
  }
}

function summarize(course) {
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    stage: course.stage,
    updatedAt: course.updatedAt,
    brief: { topic: course.brief.topic, audience: course.brief.audience, level: course.brief.level },
    progress: courseProgress(course),
    job: course.generation?.job ? { status: course.generation.job.status } : null,
  }
}

/**
 * Applies author edits. Only fields an author is meant to hand-edit are
 * writable, and each is re-normalized — the studio is not the only thing that
 * can call this endpoint.
 */
export function applyEdit(course, body) {
  const next = { ...course }

  if (body.brief) next.brief = normalizeBrief({ ...course.brief, ...body.brief })
  if (typeof body.title === 'string') next.title = body.title.trim().slice(0, 200) || course.title
  if (typeof body.subtitle === 'string') next.subtitle = body.subtitle.trim().slice(0, 300)
  if (typeof body.summary === 'string') next.summary = body.summary.trim().slice(0, 3000)

  if (body.lesson) {
    const { moduleId, lessonId, scenes, takeaways, title } = body.lesson
    next.modules = next.modules.map((module) => {
      if (module.id !== moduleId) return module
      return {
        ...module,
        lessons: module.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson
          return {
            ...lesson,
            title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : lesson.title,
            scenes: Array.isArray(scenes)
              ? scenes.map((scene, index) => ({
                  ...lesson.scenes[index],
                  heading: String(scene.heading ?? '').slice(0, 160),
                  bullets: (Array.isArray(scene.bullets) ? scene.bullets : []).map((b) => String(b).slice(0, 240)),
                  narration: String(scene.narration ?? '').slice(0, 6000),
                  visual: String(scene.visual ?? '').slice(0, 500),
                  seconds: estimate(scene.narration),
                }))
              : lesson.scenes,
            takeaways: Array.isArray(takeaways)
              ? takeaways.map((t) => String(t).slice(0, 400)).filter(Boolean)
              : lesson.takeaways,
          }
        }),
      }
    })
  }

  next.stage = deriveStage(next)
  return touch(next)
}

function estimate(narration) {
  const words = String(narration ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(4, Math.round(words * (60 / 140)))
}

function exportCourse(course, format) {
  const base = slugify(course.title, course.id)
  switch (format) {
    case 'html':
      return file(renderCourseHtml(course), 'text/html; charset=utf-8', `${base}.html`)
    case 'preview':
      // The same document, served inline so the studio can frame it.
      return new Response(renderCourseHtml(course), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    case 'md':
      return file(renderCourseMarkdown(course), 'text/markdown; charset=utf-8', `${base}.md`)
    case 'json':
      return file(JSON.stringify(course, null, 2), 'application/json; charset=utf-8', `${base}.json`)
    case 'scorm': {
      const pkg = buildScormPackage(course)
      return file(pkg.buffer, 'application/zip', pkg.filename)
    }
    default:
      return json(400, { error: `Unknown export format: ${format}. Use html, md, json or scorm.` })
  }
}

function file(body, contentType, filename) {
  return new Response(body, {
    headers: { 'content-type': contentType, 'content-disposition': `attachment; filename="${filename}"` },
  })
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function readJson(request) {
  const text = await request.text()
  if (!text) return {}
  if (text.length > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large.'), { status: 413 })
  try {
    return JSON.parse(text)
  } catch {
    throw Object.assign(new Error('Request body was not valid JSON.'), { status: 400 })
  }
}
