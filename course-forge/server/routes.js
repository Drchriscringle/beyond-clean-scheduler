import { createCourse, normalizeBrief, courseProgress, deriveStage, touch, LEVELS, TONES } from './lib/course.js'
import { buildCourse } from './pipeline.js'
import { selectProvider, hasCredentials } from './ai/provider.js'
import { renderCourseHtml } from './export/html.js'
import { renderCourseMarkdown } from './export/markdown.js'
import { buildScormPackage } from './export/scorm.js'
import { slugify } from './lib/ids.js'

const MAX_BODY_BYTES = 5_000_000

export function createApi({ store, providerOptions = {} }) {
  /**
   * Returns a handler result, or null when the path is not an API route so
   * the caller can fall through to static files.
   */
  return async function handle(req, res, url) {
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

    if (segments[0] === 'meta' && req.method === 'GET') {
      const provider = selectProvider(providerOptions)
      return json(res, 200, {
        provider: provider.name,
        model: provider.model,
        hasCredentials: hasCredentials(),
        levels: LEVELS,
        tones: TONES,
      })
    }

    if (segments[0] !== 'courses') return notFound(res)

    // /api/courses
    if (segments.length === 1) {
      if (req.method === 'GET') {
        const courses = await store.list()
        return json(res, 200, { courses: courses.map(summarize) })
      }
      if (req.method === 'POST') {
        const body = await readJson(req)
        const course = createCourse(body.brief ?? body)
        await store.save(course)
        return json(res, 201, { course })
      }
      return methodNotAllowed(res)
    }

    const course = await store.get(segments[1])
    if (!course) return json(res, 404, { error: 'No course with that id.' })

    // /api/courses/:id
    if (segments.length === 2) {
      if (req.method === 'GET') return json(res, 200, { course, progress: courseProgress(course) })
      if (req.method === 'DELETE') {
        await store.remove(course.id)
        return json(res, 200, { ok: true })
      }
      if (req.method === 'PATCH') {
        const body = await readJson(req)
        const updated = applyEdit(course, body)
        await store.save(updated)
        return json(res, 200, { course: updated, progress: courseProgress(updated) })
      }
      return methodNotAllowed(res)
    }

    // /api/courses/:id/generate
    if (segments[2] === 'generate' && req.method === 'POST') {
      const body = await readJson(req)
      return streamGeneration({ req, res, store, course, steps: body.steps, providerOptions, reset: body.reset })
    }

    // /api/courses/:id/export/:format
    if (segments[2] === 'export' && req.method === 'GET') {
      return exportCourse(res, course, segments[3])
    }

    return notFound(res)
  }
}

function summarize(course) {
  const progress = courseProgress(course)
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    stage: course.stage,
    updatedAt: course.updatedAt,
    brief: { topic: course.brief.topic, audience: course.brief.audience, level: course.brief.level },
    progress,
  }
}

/**
 * Applies author edits. Only fields an author is meant to hand-edit are
 * writable, and each one is re-normalized — the studio is not the only thing
 * that can call this endpoint.
 */
export function applyEdit(course, body) {
  let next = { ...course }

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

/**
 * Runs a build and streams progress as server-sent events. A course build is
 * many model calls over several minutes, so the studio needs to show it
 * happening rather than hold one long request open with nothing to show.
 */
async function streamGeneration({ req, res, store, course, steps, providerOptions, reset }) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const controller = new AbortController()
  req.on('close', () => controller.abort())

  const requested = Array.isArray(steps) && steps.length ? steps : ['blueprint', 'lessons', 'assessments']
  let working = course
  if (reset) working = clearGenerated(working, requested)

  try {
    const provider = selectProvider(providerOptions)
    send({ type: 'start', provider: provider.name, model: provider.model, steps: requested })

    // Persist after each completed stage: a build that dies halfway leaves
    // the author with the lessons already written, not an empty course.
    const result = await buildCourse({
      course: working,
      provider,
      signal: controller.signal,
      steps: requested,
      onEvent: (event) => {
        if (event.course) {
          working = event.course
          store.save(event.course).catch(() => {})
        }
        send(stripCourse(event))
      },
    })

    await store.save(result)
    send({ type: 'done', course: result, progress: courseProgress(result) })
  } catch (error) {
    if (error.name === 'AbortError') {
      await store.save(working).catch(() => {})
    } else {
      send({ type: 'error', message: error.expected ? error.message : 'Generation failed. Check the server log.' })
      if (!error.expected) console.error('[course-forge] generation failed:', error)
    }
  } finally {
    res.end()
  }
}

/** Course snapshots are large; progress events carry counts, and `done` carries the course. */
function stripCourse(event) {
  if (!event.course) return event
  const { course, ...rest } = event
  return { ...rest, progress: courseProgress(course), title: course.title }
}

function clearGenerated(course, steps) {
  let next = { ...course }
  if (steps.includes('blueprint')) {
    next = { ...next, modules: [], finalAssessment: { questions: [] } }
  } else {
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
  }
  return next
}

function exportCourse(res, course, format) {
  const base = slugify(course.title, course.id)
  switch (format) {
    case 'html': {
      const html = renderCourseHtml(course)
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': `attachment; filename="${base}.html"`,
      })
      return res.end(html)
    }
    case 'preview': {
      // Same document, served inline so the studio can show it in a frame.
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(renderCourseHtml(course))
    }
    case 'md': {
      res.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${base}.md"`,
      })
      return res.end(renderCourseMarkdown(course))
    }
    case 'json': {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${base}.json"`,
      })
      return res.end(JSON.stringify(course, null, 2))
    }
    case 'scorm': {
      const pkg = buildScormPackage(course)
      res.writeHead(200, {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${pkg.filename}"`,
        'content-length': pkg.buffer.length,
      })
      return res.end(pkg.buffer)
    }
    default:
      return json(res, 400, { error: `Unknown export format: ${format}. Use html, md, json or scorm.` })
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large.'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('Request body was not valid JSON.'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

function notFound(res) {
  return json(res, 404, { error: 'Not found.' })
}

function methodNotAllowed(res) {
  return json(res, 405, { error: 'Method not allowed.' })
}
