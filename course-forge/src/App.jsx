import { useCallback, useEffect, useState } from 'react'
import { api, key, startGeneration, watchGeneration } from './api.js'
import BriefForm from './components/BriefForm.jsx'
import LessonEditor from './components/LessonEditor.jsx'
import QuizView from './components/QuizView.jsx'
import GenerationLog from './components/GenerationLog.jsx'
import KeyPanel from './components/KeyPanel.jsx'

/** The open course lives in the URL, so a reload or a shared link lands back on it. */
function courseFromHash() {
  const match = /^#\/course\/([A-Za-z0-9_-]+)$/.exec(window.location.hash)
  return match ? match[1] : null
}

export default function App() {
  const [meta, setMeta] = useState(null)
  const [courses, setCourses] = useState([])
  const [openId, setOpenId] = useState(courseFromHash)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [hasKey, setHasKey] = useState(() => Boolean(key.get()))

  const refresh = useCallback(async () => {
    const { courses: list } = await api.listCourses()
    setCourses(list)
  }, [])

  const reloadMeta = useCallback(() => {
    api.meta().then(setMeta).catch(() => setMeta(null))
  }, [])

  useEffect(() => {
    reloadMeta()
    refresh().catch((problem) => setError(problem.message))
  }, [refresh, reloadMeta])

  // Back and forward move between the list and a course.
  useEffect(() => {
    const onHashChange = () => setOpenId(courseFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const open = useCallback((id) => {
    window.location.hash = id ? `#/course/${id}` : ''
    setOpenId(id)
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="logo">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#7c9cff" />
            <path d="M8 10.5h11M8 16h16M8 21.5h8" stroke="#0f1115" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="24" cy="10.5" r="3" fill="#0f1115" />
          </svg>
          CourseForge
        </div>
        <span className="muted small">AI course studio</span>
        <div className="spacer" />
        {meta && (
          <span className={`pill ${meta.hasCredentials ? 'live' : 'mock'}`}>
            {meta.hasCredentials ? `${meta.model}` : 'no API key — placeholder courses'}
          </span>
        )}
        {openId && (
          <button className="btn sm" onClick={() => open(null)}>
            All courses
          </button>
        )}
      </header>

      {openId ? (
        <Studio id={openId} meta={meta} onBack={() => { open(null); refresh() }} />
      ) : (
        <main className="page">
          {error && <div className="banner err">{error}</div>}

          {meta?.needsKey && (
            <KeyPanel
              hasKey={hasKey}
              onChange={() => {
                setHasKey(Boolean(key.get()))
                reloadMeta()
              }}
            />
          )}

          {meta && !meta.hasCredentials && !meta.needsKey && (
            <div className="banner warn">
              No Anthropic API key on this server, so courses are built by the offline mock generator —
              structurally complete, but the prose is placeholder. Set <code>ANTHROPIC_API_KEY</code> in
              a <code>.env</code> file and restart to generate real courses.
            </div>
          )}

          {creating ? (
            <BriefForm
              onCancel={() => setCreating(false)}
              onSubmit={async (brief) => {
                try {
                  const { course } = await api.createCourse(brief)
                  setCreating(false)
                  await refresh()
                  open(course.id)
                } catch (problem) {
                  setError(problem.message)
                }
              }}
            />
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                <h1 style={{ margin: 0 }}>Your courses</h1>
                <button className="btn primary" onClick={() => setCreating(true)}>
                  New course
                </button>
              </div>

              {courses.length === 0 ? (
                <div className="card empty">
                  <p>No courses yet.</p>
                  <p className="small">
                    Start from a brief — a topic, an audience, and how long it should run — and CourseForge
                    writes the outline, the lesson scripts, the slides and the assessments.
                  </p>
                </div>
              ) : (
                <div className="grid">
                  {courses.map((course) => (
                    <button className="card course-card" key={course.id} onClick={() => open(course.id)}>
                      <h3>{course.title}</h3>
                      <p className="muted small" style={{ margin: '0 0 10px' }}>
                        {course.brief.audience} · {course.brief.level}
                      </p>
                      <div className="bar">
                        <i style={{ width: `${percent(course.progress)}%` }} />
                      </div>
                      <p className="muted small" style={{ marginBottom: 0 }}>
                        {course.progress.lessonsWritten}/{course.progress.lessons} lessons ·{' '}
                        {course.progress.totalMinutes} min · {course.stage}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}
    </>
  )
}

function percent(progress) {
  if (!progress.lessons) return 0
  return Math.round((progress.lessonsWritten / progress.lessons) * 100)
}

function Studio({ id, meta, onBack }) {
  const [course, setCourse] = useState(null)
  const [progress, setProgress] = useState(null)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('script')
  const [log, setLog] = useState([])
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const data = await api.getCourse(id)
    setCourse(data.course)
    setProgress(data.progress)
    return data.course
  }, [id])

  useEffect(() => {
    load().catch((problem) => setError(problem.message))
  }, [load])

  /** Turns the job the server recorded into the lines shown in the log. */
  const render = (state) => {
    if (state.progress) setProgress(state.progress)
    if (state.course) setCourse(state.course)
    const current = state.job
    if (!current) return

    const lines = current.steps.map((step) =>
      step.state === 'done'
        ? { text: `✓ ${step.label} (${((step.ms ?? 0) / 1000).toFixed(1)}s)`, kind: 'ok' }
        : { text: `→ ${step.label}`, kind: '' },
    )
    if (current.status === 'done') lines.push({ text: 'Course build complete.', kind: 'ok' })
    if (current.status === 'error') lines.push({ text: `✗ ${current.message}`, kind: 'err' })
    setLog([{ text: `Building with ${current.provider} (${current.model})…`, kind: '' }, ...lines])
  }

  const run = async (options = {}) => {
    if (job) return
    setError(null)
    setLog([{ text: 'Starting the build…', kind: '' }])

    try {
      await startGeneration(id, { ...options, generatePath: meta?.generatePath })
    } catch (problem) {
      setLog([])
      setError(problem.message)
      return
    }

    const handle = watchGeneration(id, render)
    setJob(handle)
    try {
      await handle.done
    } catch (problem) {
      setError(problem.message)
    } finally {
      setJob(null)
      const fresh = await load().catch(() => null)
      if (fresh && selected && !fresh.modules.some((entry) => entry.id === selected.moduleId)) {
        // The lesson that was open no longer exists after a rebuild.
        setSelected(null)
      }
    }
  }

  // A build started in another tab, or before a reload, is still running.
  useEffect(() => {
    if (job || !course?.generation?.job || course.generation.job.status !== 'running') return
    const handle = watchGeneration(id, render)
    setJob(handle)
    handle.done.finally(() => {
      setJob(null)
      load().catch(() => {})
    })
    return () => handle.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.generation?.job?.status])

  if (error && !course) return <main className="page"><div className="banner err">{error}</div></main>
  if (!course) return <main className="page"><p className="muted">Loading…</p></main>

  const selectedModule = selected && course.modules.find((module) => module.id === selected.moduleId)
  const selectedLesson = selectedModule?.lessons.find((lesson) => lesson.id === selected.lessonId)
  const built = progress?.lessons > 0

  return (
    <main className="page wide">
      {error && <div className="banner err">{error}</div>}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 2px' }}>{course.title}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {course.brief.audience} · {course.brief.level} · target {course.brief.durationMinutes} min
            {progress ? ` · ${progress.totalMinutes} min written` : ''}
          </p>
        </div>
        <div className="row">
          {job ? (
            <button className="btn" disabled>
              Building…
            </button>
          ) : (
            <button className="btn primary" onClick={() => run({})}>
              {built ? 'Generate what is missing' : 'Generate course'}
            </button>
          )}
          <button className="btn" disabled={!!job} onClick={() => run({ reset: true })}>
            Rebuild from scratch
          </button>
          <button className="btn" onClick={onBack}>
            Close
          </button>
        </div>
      </div>

      {meta && !meta.hasCredentials && (
        <div className="banner warn">
          No API key, so this build will be placeholder prose. Add your key on the courses screen for
          real courses.
        </div>
      )}

      {(job || log.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <b>{job ? 'Building… (you can close this tab)' : 'Last build'}</b>
            {progress && (
              <span className="muted small">
                {progress.lessonsWritten}/{progress.lessons} lessons · {progress.modulesQuizzed}/{progress.modules} checks
              </span>
            )}
          </div>
          <GenerationLog entries={log} />
        </div>
      )}

      <div className="studio">
        <aside className="card outline">
          <b className="muted small">Outline</b>
          {course.modules.length === 0 && <p className="muted small">Not generated yet.</p>}
          {course.modules.map((module, moduleIndex) => (
            <div className="outline-mod" key={module.id}>
              <b>
                {moduleIndex + 1}. {module.title}
              </b>
              {module.lessons.map((lesson) => (
                <button
                  className="outline-item"
                  key={lesson.id}
                  aria-current={selected?.lessonId === lesson.id ? 'true' : 'false'}
                  onClick={() => {
                    setSelected({ moduleId: module.id, lessonId: lesson.id })
                    setTab('script')
                  }}
                >
                  <span className={`dot ${lesson.scenes.length ? 'written' : ''}`} />
                  <span>{lesson.title}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section>
          <div className="tabs">
            {['script', 'assessments', 'preview', 'export'].map((name) => (
              <button
                key={name}
                className="tab"
                aria-selected={tab === name ? 'true' : 'false'}
                onClick={() => setTab(name)}
              >
                {name[0].toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'script' &&
            (selectedLesson ? (
              <LessonEditor
                key={selectedLesson.id}
                module={selectedModule}
                lesson={selectedLesson}
                busy={!!job}
                onSave={async (lesson) => {
                  try {
                    const { course: updated } = await api.updateCourse(id, { lesson })
                    setCourse(updated)
                  } catch (problem) {
                    setError(problem.message)
                  }
                }}
                onRegenerate={() => run({ steps: ['lessons'] })}
              />
            ) : (
              <div className="card">
                <h2>{course.title}</h2>
                {course.summary ? <p>{course.summary}</p> : <p className="muted">No summary generated yet.</p>}
                {course.outcomes.length > 0 && (
                  <>
                    <h3>Learners will be able to</h3>
                    <ul>
                      {course.outcomes.map((outcome, index) => (
                        <li key={index}>{outcome}</li>
                      ))}
                    </ul>
                  </>
                )}
                {course.modules.length > 0 && <p className="muted small">Pick a lesson from the outline to edit its script.</p>}
              </div>
            ))}

          {tab === 'assessments' && (
            <div className="card">
              {course.modules.map((module) => (
                <QuizView key={module.id} title={`Check: ${module.title}`} questions={module.quiz.questions} />
              ))}
              <QuizView title="Final assessment" questions={course.finalAssessment.questions} />
            </div>
          )}

          {tab === 'preview' &&
            (built ? (
              <iframe className="frame" title="Course preview" src={api.exportUrl(id, 'preview')} />
            ) : (
              <div className="card empty">Generate the course to preview the player.</div>
            ))}

          {tab === 'export' && (
            <div className="card">
              <h2>Publish</h2>
              <p className="muted small">
                Every export is self-contained. The HTML player and the SCORM package are the same course —
                the SCORM build additionally reports completion and score to an LMS.
              </p>
              <div className="row">
                <a className="btn primary" href={api.exportUrl(id, 'scorm')}>
                  SCORM 1.2 package (.zip)
                </a>
                <a className="btn" href={api.exportUrl(id, 'html')}>
                  Standalone player (.html)
                </a>
                <a className="btn" href={api.exportUrl(id, 'md')}>
                  Production script (.md)
                </a>
                <a className="btn" href={api.exportUrl(id, 'json')}>
                  Course data (.json)
                </a>
              </div>
              {course.generation.usage && (
                <p className="muted small" style={{ marginTop: 16 }}>
                  Last build: {course.generation.usage.requests} requests ·{' '}
                  {course.generation.usage.inputTokens.toLocaleString()} in /{' '}
                  {course.generation.usage.outputTokens.toLocaleString()} out tokens
                  {course.generation.usage.cacheReadTokens > 0 &&
                    ` · ${course.generation.usage.cacheReadTokens.toLocaleString()} cached`}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
