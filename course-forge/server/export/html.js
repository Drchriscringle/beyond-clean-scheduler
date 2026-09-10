import { PLAYER_CSS, PLAYER_JS } from './player/assets.js'

/**
 * Renders the course as a single self-contained HTML file: no build step, no
 * network, no dependencies. The same document is what goes inside the SCORM
 * package, so the player detects an LMS at runtime rather than being built
 * two different ways.
 */
export function renderCourseHtml(course) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(course.title)}</title>
<meta name="description" content="${escapeHtml(course.summary)}">
<style>
${PLAYER_CSS}
</style>
</head>
<body>
<div class="shell">
  <aside class="sidebar" id="sidebar"></aside>
  <main class="main" id="main"></main>
</div>
<noscript>
  <div style="padding:32px;max-width:760px">
    <h1>${escapeHtml(course.title)}</h1>
    <p>${escapeHtml(course.summary)}</p>
    <p>This course player needs JavaScript. The full written course is available as the Markdown export.</p>
  </div>
</noscript>
<script>window.__COURSE__ = ${embedJson(toPlayerCourse(course))};</script>
<script>
${PLAYER_JS}
</script>
</body>
</html>
`
}

/** Only what the player reads — briefs, prompts and generation logs stay out of a published course. */
export function toPlayerCourse(course) {
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    summary: course.summary,
    outcomes: course.outcomes,
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        minutes: lesson.minutes,
        scenes: lesson.scenes,
        takeaways: lesson.takeaways,
        glossary: lesson.glossary,
      })),
      quiz: module.quiz,
    })),
    finalAssessment: course.finalAssessment,
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * JSON safe to inline in a <script> block. Escaping `<`, `>` and `&` closes
 * the `</script>` break-out, and the line separators are escaped because they
 * are literal newlines to a JavaScript parser but not to JSON.
 */
export function embedJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
