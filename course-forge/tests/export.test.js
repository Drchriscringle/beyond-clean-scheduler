import test from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { createZip } from '../server/export/zip.js'
import { renderCourseHtml, embedJson, escapeHtml, toPlayerCourse } from '../server/export/html.js'
import { renderCourseMarkdown } from '../server/export/markdown.js'
import { buildScormPackage, renderManifest } from '../server/export/scorm.js'
import { sampleCourse } from './helpers.js'

/** Reads a zip back through its central directory, the way a real reader does. */
function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.notEqual(end, -1, 'end-of-central-directory record is present')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)

  const files = {}
  for (let i = 0; i < count; i += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'central directory signature')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    const content = method === 8 ? inflateRawSync(raw) : raw

    assert.equal(content.length, uncompressedSize, `${name} inflates to its recorded size`)
    files[name] = content.toString('utf8')
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
  }
  return files
}

test('createZip produces an archive that reads back byte for byte', () => {
  const entries = [
    { name: 'a.txt', content: 'hello world' },
    { name: 'nested/dir/b.txt', content: 'unicode: café ✓ — dash' },
    { name: 'big.txt', content: 'repeat me '.repeat(500) },
    { name: 'empty.txt', content: '' },
  ]
  const files = readZip(createZip(entries))

  assert.deepEqual(Object.keys(files).sort(), ['a.txt', 'big.txt', 'empty.txt', 'nested/dir/b.txt'])
  for (const entry of entries) assert.equal(files[entry.name], entry.content)
})

test('createZip never stores an entry larger than its source', () => {
  // Random bytes do not compress; the writer must fall back to storing them.
  const incompressible = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 37) % 251))
  const buffer = createZip([{ name: 'r.bin', content: incompressible }])
  assert.ok(buffer.length < incompressible.length + 400, 'no size blow-up from a failed deflate')
  assert.equal(Buffer.from(readZip(buffer)['r.bin'], 'utf8').length > 0, true)
})

test('embedJson closes the </script> break-out', () => {
  const payload = embedJson({ evil: '</script><img src=x onerror=alert(1)>' })
  assert.ok(!payload.includes('</script'), 'no literal closing script tag survives')
  assert.ok(!payload.includes('<'), 'no raw angle brackets at all')
  assert.deepEqual(JSON.parse(payload), { evil: '</script><img src=x onerror=alert(1)>' })
})

test('escapeHtml escapes every character that can break out of an attribute', () => {
  assert.equal(escapeHtml(`<a href="x" id='y'>&`), '&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;')
})

test('the player payload leaves the brief and the generation log behind', () => {
  const player = toPlayerCourse(sampleCourse())
  assert.equal(player.brief, undefined, 'the author brief is not published to learners')
  assert.equal(player.generation, undefined, 'the generation log is not published either')
  assert.ok(player.modules[0].lessons[0].scenes.length > 0)
})

test('the HTML export is one self-contained file', () => {
  const html = renderCourseHtml(sampleCourse())
  assert.match(html, /^<!doctype html>/)
  assert.ok(!/<script[^>]+\ssrc=/.test(html), 'no external scripts')
  assert.ok(!/<link[^>]+stylesheet/.test(html), 'no external stylesheets')
  assert.ok(html.includes('window.__COURSE__'), 'the course travels with the page')
  assert.ok(html.includes('speechSynthesis'), 'narration playback ships with it')
  assert.ok(html.includes('<noscript>'), 'there is something to read without JavaScript')
})

test('a hostile course title cannot inject markup into the export', () => {
  const course = sampleCourse()
  course.title = '</title><script>alert(1)</script>'
  const html = renderCourseHtml(course)
  assert.ok(!html.includes('<script>alert(1)</script>'), 'the title is escaped in the document')
})

test('the Markdown export carries narration, visuals and an answer key', () => {
  const markdown = renderCourseMarkdown(sampleCourse())
  assert.match(markdown, /^# /)
  assert.ok(markdown.includes('**Narration**'))
  assert.ok(markdown.includes('**Visual:**'))
  assert.ok(markdown.includes('*Answer: b.'), 'the answer letter matches the answer index')
  assert.ok(!markdown.includes('\n\n\n'), 'no runs of blank lines')
})

test('the SCORM package holds a manifest a 1.2 LMS will accept', () => {
  const { filename, buffer } = buildScormPackage(sampleCourse())
  assert.match(filename, /-scorm12\.zip$/)

  const files = readZip(buffer)
  assert.deepEqual(Object.keys(files).sort(), ['course.md', 'imsmanifest.xml', 'index.html'])

  const manifest = files['imsmanifest.xml']
  assert.ok(manifest.includes('<schemaversion>1.2</schemaversion>'))
  assert.ok(manifest.includes('adlcp:scormtype="sco"'), 'the resource is a SCO, so it reports back')
  assert.ok(manifest.includes('href="index.html"'))
  assert.ok(manifest.includes('<adlcp:masteryscore>70</adlcp:masteryscore>'))
  assert.ok(files['index.html'].includes('LMSInitialize'), 'the packaged player talks to the LMS')
})

test('the manifest escapes a course title containing XML metacharacters', () => {
  const course = sampleCourse()
  course.title = 'Tables & <Charts>'
  const manifest = renderManifest(course, 'COURSE-TEST')
  assert.ok(manifest.includes('Tables &amp; &lt;Charts&gt;'))
  assert.ok(!manifest.includes('<Charts>'))
})

test('the manifest max time allowed is a SCORM timeInterval', () => {
  const manifest = renderManifest(sampleCourse(), 'COURSE-TEST')
  const match = manifest.match(/<adlcp:maxtimeallowed>([^<]+)</)
  assert.match(match[1], /^\d{2}:\d{2}:\d{2}$/)
})
