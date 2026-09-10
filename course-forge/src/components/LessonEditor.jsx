import { useState } from 'react'

/**
 * Edits one lesson's script. Local state is the draft; the course only
 * changes when the author saves, so a half-typed narration is never what
 * gets exported. The caller keys this component by lesson id, so switching
 * lessons remounts it with a fresh draft rather than carrying one over.
 */
export default function LessonEditor({ module, lesson, onSave, onRegenerate, busy }) {
  const [draft, setDraft] = useState(lesson)
  const [dirty, setDirty] = useState(false)

  const editScene = (index, key, value) => {
    setDirty(true)
    setDraft((current) => ({
      ...current,
      scenes: current.scenes.map((scene, sceneIndex) =>
        sceneIndex === index ? { ...scene, [key]: value } : scene,
      ),
    }))
  }

  if (draft.scenes.length === 0) {
    return (
      <div className="card">
        <h2>{draft.title}</h2>
        <p className="muted">{draft.summary}</p>
        <p className="muted small">
          This lesson has not been written yet. Generate the course, or write just this lesson.
        </p>
        <button className="btn primary" disabled={busy} onClick={onRegenerate}>
          Write this lesson
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>{draft.title}</h2>
        <span className="pill">
          {draft.minutes} min · {draft.scenes.length} scenes
        </span>
      </div>
      <p className="muted small">
        {module.title} — {draft.summary}
      </p>

      {draft.scenes.map((scene, index) => (
        <div className="scene" key={index}>
          <div className="scene-head">
            <span className="muted small">Scene {index + 1}</span>
            <input
              value={scene.heading}
              onChange={(event) => editScene(index, 'heading', event.target.value)}
              aria-label={`Scene ${index + 1} heading`}
            />
            <span className="muted small">{scene.seconds}s</span>
          </div>

          <label>
            On-screen bullets (one per line)
            <textarea
              rows={Math.max(2, scene.bullets.length)}
              value={scene.bullets.join('\n')}
              onChange={(event) => editScene(index, 'bullets', event.target.value.split('\n'))}
            />
          </label>

          <label>
            Narration
            <textarea
              rows={5}
              value={scene.narration}
              onChange={(event) => editScene(index, 'narration', event.target.value)}
            />
          </label>

          <label>
            Visual direction
            <textarea rows={2} value={scene.visual} onChange={(event) => editScene(index, 'visual', event.target.value)} />
          </label>
        </div>
      ))}

      {draft.takeaways.length > 0 && (
        <div className="scene">
          <label>
            Takeaways (one per line)
            <textarea
              rows={draft.takeaways.length + 1}
              value={draft.takeaways.join('\n')}
              onChange={(event) => {
                setDirty(true)
                setDraft((current) => ({ ...current, takeaways: event.target.value.split('\n') }))
              }}
            />
          </label>
        </div>
      )}

      <div className="row">
        <button
          className="btn primary"
          disabled={!dirty || busy}
          onClick={() => {
            onSave({
              moduleId: module.id,
              lessonId: draft.id,
              title: draft.title,
              scenes: draft.scenes,
              takeaways: draft.takeaways.filter(Boolean),
            })
            setDirty(false)
          }}
        >
          {dirty ? 'Save changes' : 'Saved'}
        </button>
        <button className="btn" disabled={busy} onClick={onRegenerate}>
          Rewrite with AI
        </button>
      </div>
    </div>
  )
}
