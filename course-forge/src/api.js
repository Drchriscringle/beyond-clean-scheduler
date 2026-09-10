async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options,
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
 * Runs a generation and yields the server's progress events.
 *
 * fetch + a reader rather than EventSource, because the request is a POST
 * carrying which steps to run, and because the returned abort function has to
 * be able to cancel a build that is minutes long.
 */
export function generate(id, { steps, reset } = {}, onEvent) {
  const controller = new AbortController()

  const done = (async () => {
    const response = await fetch(`/api/courses/${id}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ steps, reset }),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) throw new Error(`Generation failed (${response.status})`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done: finished, value } = await reader.read()
      if (finished) break
      buffer += decoder.decode(value, { stream: true })
      // Events are separated by a blank line; the trailing fragment is an
      // incomplete event and stays in the buffer for the next chunk.
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.split('\n').find((entry) => entry.startsWith('data: '))
        if (!line) continue
        try {
          onEvent(JSON.parse(line.slice(6)))
        } catch {
          /* ignore a malformed frame rather than kill the stream */
        }
      }
    }
  })()

  return { done, abort: () => controller.abort() }
}
