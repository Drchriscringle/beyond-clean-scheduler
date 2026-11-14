import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { formatPounds, inServiceArea, planPrice } from '../../supabase/functions/_shared/pricing.js'
import { Logo, Stars } from '../components/ui.jsx'

export const PROMISES = [
  ['🛡️', 'Fully insured', 'Our cleaners are fully insured, so your home is protected.'],
  ['🧴', 'We bring everything', 'All equipment and cleaning products included. Nothing to buy.'],
  ['💯', '100% satisfaction guarantee', "Not happy? Tell us within 24 hours and we'll come back and put it right, free."],
  ['📅', 'Skip, pause or move', 'Going away? Pause your plan from your phone. No hassle, no fees with notice.'],
]

export default function Home({ settings }) {
  const from = planPrice(settings, Math.min(...settings.visitsPerWeekOptions), Math.min(...settings.hoursPerVisitOptions))
  const [reviews, setReviews] = useState(null)
  useEffect(() => { api.getPublicReviews().then(setReviews).catch(() => {}) }, [])

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-50 to-white px-5 pt-7 pb-6 text-center">
          <div className="flex justify-center mb-3"><Logo size={120} /></div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-900 tracking-tight">A cleaner home, without the hassle</h1>
          <p className="mt-2 text-slate-600 max-w-lg mx-auto">
            Tell us what needs cleaning and when suits you. See a price straight away, and we'll confirm a time, usually the same day.
          </p>
          {reviews?.count > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1 text-sm font-bold">
              <Stars value={Math.round(reviews.average)} size="text-base" /> {reviews.average} from {reviews.count} review{reviews.count > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 p-4">
          <Link to="/enquire" className="rounded-2xl border-2 border-brand-100 hover:border-brand-500 p-4 transition">
            <div className="text-2xl">🧽</div>
            <div className="mt-1 font-extrabold text-lg text-brand-900">One-off clean</div>
            <p className="text-sm text-slate-600 mt-1">Deep cleans, end of tenancy, after builders, holiday lets and more. Instant estimate.</p>
            <span className="btn-primary mt-3 w-full">Get a price</span>
          </Link>
          <Link to="/plans" className="rounded-2xl border-2 border-leaf-100 hover:border-leaf-500 p-4 transition">
            <div className="text-2xl">📅</div>
            <div className="mt-1 font-extrabold text-lg text-brand-900">Regular cleaning plan</div>
            <p className="text-sm text-slate-600 mt-1">
              Every 2 weeks, or 1, 2 or 3 times a week at fixed times. One monthly payment, from {formatPounds(from.monthlyPence)}/month.
            </p>
            <span className="btn-leaf mt-3 w-full">See plans</span>
          </Link>
        </div>
        <PostcodeCheck settings={settings} />
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        {PROMISES.map(([icon, title, text]) => (
          <div key={title} className="card p-4 flex gap-3">
            <div className="text-2xl">{icon}</div>
            <div>
              <div className="font-extrabold">{title}</div>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {reviews?.items?.length > 0 && (
        <section>
          <h2 className="font-extrabold text-xl text-brand-900 mb-2">What customers say</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {reviews.items.map((r, i) => (
              <figure key={i} className="card p-4">
                <Stars value={r.rating} size="text-lg" />
                {r.comment && <blockquote className="mt-1 text-slate-700">“{r.comment}”</blockquote>}
                <figcaption className="mt-1 text-sm font-bold text-slate-500">{r.name}</figcaption>
                {r.owner_reply && <p className="mt-2 text-sm rounded-lg bg-brand-50 px-3 py-2"><b>Beyond Clean:</b> {r.owner_reply}</p>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="font-extrabold">🏘️ Landlords & holiday lets</div>
          <p className="text-sm text-slate-600 mt-1">Save all your properties and rebook a turnover or end-of-tenancy clean in a couple of taps.</p>
          <Link to="/account" className="btn-secondary btn-sm mt-3">Open my account</Link>
        </div>
        <div className="card p-4">
          <div className="font-extrabold">🎁 Refer a friend</div>
          <p className="text-sm text-slate-600 mt-1">
            Plan customers get a personal code. Your friend gets {formatPounds(settings.referralRewardPence)} off and you get {formatPounds(settings.referralRewardPence)} off your next bill.
          </p>
        </div>
      </section>
    </div>
  )
}

function PostcodeCheck({ settings }) {
  const [pc, setPc] = useState('')
  const [result, setResult] = useState(null)
  return (
    <form className="border-t border-slate-100 px-4 py-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); if (pc.trim()) setResult(inServiceArea(settings, pc)) }}>
      <label htmlFor="pc-check" className="text-sm font-bold">Do we cover you?</label>
      <input id="pc-check" className="field !w-36 !py-1.5 uppercase" placeholder="Postcode" value={pc} onChange={(e) => { setPc(e.target.value); setResult(null) }} />
      <button className="btn-secondary btn-sm">Check</button>
      {result === true && <span className="text-sm font-bold text-leaf-600">✓ Yes, we cover {pc.toUpperCase()}</span>}
      {result === false && <span className="text-sm font-bold text-slate-600">Not yet. Send an enquiry anyway and we'll see what we can do.</span>}
    </form>
  )
}
