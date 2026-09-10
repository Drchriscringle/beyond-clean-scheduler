import { createZip } from './zip.js'
import { renderCourseHtml, escapeHtml } from './html.js'
import { renderCourseMarkdown } from './markdown.js'
import { slugify } from '../lib/ids.js'

/**
 * Packages the course as SCORM 1.2 — still the format nearly every corporate
 * LMS will accept as an upload. The package is the exported player plus a
 * manifest describing it; the player's SCORM adapter reports completion and
 * score once an LMS is actually hosting it.
 */
export function buildScormPackage(course) {
  const identifier = `COURSE-${slugify(course.title, course.id).toUpperCase()}`
  const entries = [
    { name: 'imsmanifest.xml', content: renderManifest(course, identifier) },
    { name: 'index.html', content: renderCourseHtml(course) },
    { name: 'course.md', content: renderCourseMarkdown(course) },
  ]
  return { filename: `${slugify(course.title, course.id)}-scorm12.zip`, buffer: createZip(entries) }
}

export function renderManifest(course, identifier) {
  const items = course.modules
    .map(
      (module, index) =>
        `      <item identifier="ITEM-${index + 1}" identifierref="RES-CONTENT" isvisible="true">
        <title>${escapeHtml(module.title)}</title>
      </item>`,
    )
    .join('\n')

  const totalMinutes = course.modules.reduce(
    (total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    0,
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeHtml(identifier)}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-DEFAULT">
    <organization identifier="ORG-DEFAULT">
      <title>${escapeHtml(course.title)}</title>
      <item identifier="ITEM-ROOT" identifierref="RES-CONTENT" isvisible="true">
        <title>${escapeHtml(course.title)}</title>
        <adlcp:masteryscore>70</adlcp:masteryscore>
        <adlcp:datafromlms>${escapeHtml(course.summary)}</adlcp:datafromlms>
        <adlcp:maxtimeallowed>${formatDuration(totalMinutes * 3)}</adlcp:maxtimeallowed>
      </item>
${items}
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-CONTENT" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="course.md"/>
    </resource>
  </resources>
</manifest>
`
}

/** SCORM 1.2 timeInterval: HHHH:MM:SS. */
function formatDuration(minutes) {
  const total = Math.max(1, Math.round(minutes)) * 60
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
