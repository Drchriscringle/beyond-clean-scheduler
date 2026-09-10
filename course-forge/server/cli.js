#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv } from './lib/env.js'
import { createCourse } from './lib/course.js'
import { buildCourse } from './pipeline.js'
import { selectProvider, hasCredentials } from './ai/provider.js'
import { createStore } from './store.js'
import { renderCourseHtml } from './export/html.js'
import { renderCourseMarkdown } from './export/markdown.js'
import { buildScormPackage } from './export/scorm.js'
import { courseProgress } from './lib/course.js'
import { slugify } from './lib/ids.js'

const USAGE = `CourseForge — build a digital course from a brief.

Usage:
  course-forge build --topic "..." --audience "..." [options]
  course-forge demo
  course-forge list
  course-forge export <course-id> [--out <dir>]

Options:
  --topic <text>        What the course teaches            (required for build)
  --audience <text>     Who it is for                      (required for build)
  --level <name>        beginner | intermediate | advanced (default: beginner)
  --tone <name>         friendly | professional | energetic | academic | plain-spoken
  --minutes <n>         Target runtime in minutes          (default: 60)
  --modules <n>         How many modules                   (default: from runtime)
  --goals <text>        What learners should walk away with
  --source <file>       Source material to teach from
  --out <dir>           Where to write exports             (default: ./exports)
  --provider <name>     anthropic | mock
`

loadEnv()

const [command, ...rest] = process.argv.slice(2)
const flags = parseFlags(rest)

try {
  await main(command)
} catch (error) {
  console.error(`\n${error.message}\n`)
  process.exitCode = 1
}

async function main(name) {
  switch (name) {
    case 'build':
      return build()
    case 'demo':
      return build({
        topic: 'Writing incident postmortems that people actually read',
        audience: 'On-call backend engineers at a mid-size SaaS company',
        level: 'intermediate',
        durationMinutes: 45,
        moduleCount: 3,
      })
    case 'list':
      return list()
    case 'export':
      return exportOnly(rest[0])
    default:
      console.log(USAGE)
      if (name) process.exitCode = 1
  }
}

async function build(preset) {
  const brief = preset ?? {
    topic: required('topic'),
    audience: required('audience'),
    level: flags.level,
    tone: flags.tone,
    durationMinutes: Number(flags.minutes) || 60,
    moduleCount: flags.modules ? Number(flags.modules) : undefined,
    goals: flags.goals,
    sourceMaterial: flags.source ? await readSource(flags.source) : '',
  }

  const provider = selectProvider({ provider: flags.provider })
  if (provider.name === 'mock' && !hasCredentials()) {
    console.log(
      'No ANTHROPIC_API_KEY found — building with the offline mock generator, so the prose will be\n' +
        'placeholder. Copy .env.example to .env and add your key for a real course.\n',
    )
  }

  const store = createStore()
  const started = Date.now()
  const built = await buildCourse({
    course: createCourse(brief),
    provider,
    onEvent: (event) => {
      if (event.type === 'step:start') process.stdout.write(`  ${event.label}… `)
      if (event.type === 'step:done') process.stdout.write(`${(event.ms / 1000).toFixed(1)}s\n`)
    },
  })

  await store.save(built)
  const progress = courseProgress(built)
  console.log(`\n${built.title}`)
  console.log(
    `  ${progress.modules} modules · ${progress.lessons} lessons · ${progress.totalMinutes} min · ` +
      `${built.finalAssessment.questions.length}-question final`,
  )
  console.log(`  Built in ${((Date.now() - started) / 1000).toFixed(1)}s as ${built.id}`)

  await writeExports(built)
}

async function exportOnly(id) {
  if (!id) throw new Error('Which course? Pass a course id — `course-forge list` shows them.')
  const course = await createStore().get(id)
  if (!course) throw new Error(`No course with id ${id}.`)
  await writeExports(course)
}

async function writeExports(course) {
  const directory = flags.out ?? join(process.cwd(), 'exports')
  await mkdir(directory, { recursive: true })
  const base = slugify(course.title, course.id)
  const scorm = buildScormPackage(course)

  await Promise.all([
    writeFile(join(directory, `${base}.html`), renderCourseHtml(course)),
    writeFile(join(directory, `${base}.md`), renderCourseMarkdown(course)),
    writeFile(join(directory, `${base}.json`), JSON.stringify(course, null, 2)),
    writeFile(join(directory, scorm.filename), scorm.buffer),
  ])

  console.log(`\nWrote to ${directory}:`)
  console.log(`  ${base}.html        open it in a browser to take the course`)
  console.log(`  ${base}.md          production script with narration and answer keys`)
  console.log(`  ${base}.json        the course data`)
  console.log(`  ${scorm.filename}   upload to an LMS`)
}

async function list() {
  const courses = await createStore().list()
  if (courses.length === 0) return console.log('No courses yet. Try `course-forge demo`.')
  for (const course of courses) {
    const progress = courseProgress(course)
    console.log(
      `${course.id}  ${course.title}\n` +
        `             ${progress.lessonsWritten}/${progress.lessons} lessons · ${course.stage} · ${course.updatedAt.slice(0, 10)}`,
    )
  }
}

async function readSource(path) {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf8')
}

function required(name) {
  const value = flags[name]
  if (!value) throw new Error(`Missing --${name}. Run \`course-forge\` with no arguments for usage.`)
  return value
}

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    out[key] = next && !next.startsWith('--') ? next : 'true'
    if (out[key] !== 'true') i += 1
  }
  return out
}
