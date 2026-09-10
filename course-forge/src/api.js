const KEY_STORAGE = 'course-forge:anthropic-key'

/**
 * The author's Anthropic key.
 *
 * The hosted studio keeps no key of its own, so each author brings theirs.
 * It lives in this browser and is sent with the requests that generate, so
 * the deployment never stores anyone's credentials.
 */
export const key = {
  get() {
    try {
      return window.localStorage.getItem(KEY_STORAGE) ?? ''
    } catch {
      return ''
    }
  },
  set(value) {
    try {
      if (value) window.localStorage.setItem(KEY_STORAGE, value)
      else window.localStorage.removeItem(KEY_STORAGE)
    } catch {
      /* a browser refusing storage still works for this session */
    }
  },
}

function headers(extra = {}) {
  const current = key.get()
  return { ...extra, ...(current ? { 'x-anthropic-key': current } : {}) }
}

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: headers(options.body ? { 'content-type': 'application/json' } : {}),
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
  return body
}

export const api = {
  meta: () => request('/meta'),
  listCourses: () => request('/courses'),
  getCourse: (id) => request(`/courses/${id}`),
  createCourse: (brief) => request('/courses', { method: 'POST', body: JSON.stringify({ brief }) }),
  updateCourse: (id, patch) => request(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  exportUrl: (id, format) => `/api/courses/${id}/export/${format}`,
}

/**
 * Starts a build at the path the server named in /api/meta. Hosted, that is
 * the background function that owns the long-running work; locally it is the
 * API route, which starts it in this process.
 */
export async function startGeneration(id, { steps, reset, generatePath } = {}) {
  const path = (generatePath ?? '/api/courses/:id/generate').replace(':id', id)
  const response = await fetch(path, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ steps, reset }),
  })

  if (!response.ok && response.status !== 202) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error ?? `Could not start the build (${response.status})`)
  }
}

/**
 * Polls a running build until it finishes, reporting the course each time.
 * Polling rather than a held-open connection is what lets a build outlive the
 * request that started it — and the tab that started it.
 */
export function watchGeneration(id, onUpdate, { intervalMs = 1500 } = {}) {
  let stopped = false

  const done = (async () => {
    // A build that has not written its first job state yet still reads as
    // running, so a few empty polls at the start are expected.
    for (let attempt = 0; !stopped; attempt += 1) {
      const state = await api.getCourse(id).catch(() => null)
      if (state) {
        onUpdate(state)
        if (state.job && state.job.status !== 'running') return state
        if (!state.job && attempt > 10) return state
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    return null
  })()

  return { done, stop: () => { stopped = true } }
}
