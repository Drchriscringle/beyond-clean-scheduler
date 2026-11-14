import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { ErrorNote, Stars, formatDate } from '../components/ui.jsx'

const WORDS = ['', 'Poor', 'Not great', 'OK', 'Good', 'Excellent']

export default function Review({ settings }) {
  const { token } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [fix, setFix] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!rating) return setError('Tap the stars to rate your clean.')
    setBusy(true); setError('')
    try { await api.submitReview(token, rating, comment.trim(), date, rating <= 3 && fix); setDone(true) } catch (e) { setError(e.message) }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="card p-6 text-center space-y-3">
        <div className="text-4xl">{rating >= 4 ? '💙' : '🙏'}</div>
        <h1 className="text-2xl font-extrabold text-brand-900">Thank you!</h1>
        {rating >= 4 && settings.googleReviewUrl && (
          <>
            <p className="text-slate-700">Would you share that on Google? It really helps a small local business.</p>
            <a className="btn-leaf" href={settings.googleReviewUrl} target="_blank" rel="noreferrer">Leave a Google review</a>
          </>
        )}
        {rating <= 3 && fix && <p className="text-slate-700">We're sorry it wasn't right. We'll call you today to arrange coming back to put it right, free of charge.</p>}
        {rating <= 3 && !fix && <p className="text-slate-700">Thanks for telling us. We'll use it to do better next time.</p>}
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">How was your clean?</h1>
        {date && <p className="text-slate-600">{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
      </div>
      <div className="text-center">
        <Stars value={rating} onChange={(n) => { setRating(n); setError('') }} size="text-5xl" />
        <div className="h-6 font-bold text-slate-600">{WORDS[rating]}</div>
      </div>
      <div>
        <label className="label" htmlFor="rc">{rating && rating <= 3 ? 'What could we have done better?' : 'Anything you’d like to tell us?'}</label>
        <textarea id="rc" rows={3} className="field" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {rating > 0 && rating <= 3 && (
        <label className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <input type="checkbox" className="size-5 mt-0.5 accent-brand-600" checked={fix} onChange={(e) => setFix(e.target.checked)} />
          <span><b>Please come back and put it right.</b> Our 100% satisfaction guarantee: tell us within 24 hours and we'll return free of charge.</span>
        </label>
      )}
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
    </div>
  )
}
