/**
 * Bridges Node's http server to the web-standard API handler, so the local
 * server and the hosted function run the same code.
 */
export async function toRequest(req, origin) {
  const url = new URL(req.url, origin)
  const method = req.method ?? 'GET'
  const init = { method, headers: req.headers }

  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (chunks.length > 0) init.body = Buffer.concat(chunks)
  }

  return new Request(url, init)
}

export async function sendResponse(res, response) {
  const headers = {}
  for (const [key, value] of response.headers) headers[key] = value
  res.writeHead(response.status, headers)
  if (!response.body) return res.end()
  res.end(Buffer.from(await response.arrayBuffer()))
}
