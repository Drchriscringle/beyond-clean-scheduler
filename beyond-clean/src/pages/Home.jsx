import { Link } from 'react-router-dom'
import { formatPounds, planPrice } from '../../supabase/functions/_shared/pricing.js'
import { Logo } from '../components/ui.jsx'

export default function Home({ settings }) {
  const from = planPrice(settings, 1, Math.min(...settings.hoursPerVisitOptions))
  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-50 to-white px-5 pt-7 pb-6 text-center">
          <div className="flex justify-center mb-3"><Logo size={120} /></div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-900 tracking-tight">A cleaner home, without the hassle</h1>
          <p className="mt-2 text-slate-600 max-w-lg mx-auto">
            Tell us what needs cleaning and when suits you. We'll come back to you with a price and a time, usually the same day.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 p-4">
          <Link to="/enquire" className="group rounded-2xl border-2 border-brand-100 hover:border-brand-500 p-4 transition">
            <div className="text-2xl">🧽</div>
            <div className="mt-1 font-extrabold text-lg text-brand-900">One-off clean</div>
            <p className="text-sm text-slate-600 mt-1">Deep cleans, end of tenancy, after builders, holiday lets and more. Get a free quote.</p>
            <span className="btn-primary mt-3 w-full">Get a quote</span>
          </Link>
          <Link to="/plans" className="group rounded-2xl border-2 border-leaf-100 hover:border-leaf-500 p-4 transition">
            <div className="text-2xl">📅</div>
            <div className="mt-1 font-extrabold text-lg text-brand-900">Regular cleaning plan</div>
            <p className="text-sm text-slate-600 mt-1">
              1, 2 or 3 cleans a week at fixed times. One monthly payment, from {formatPounds(from.monthlyPence)}/month.
            </p>
            <span className="btn-leaf mt-3 w-full">See plans</span>
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        {[
          ['✨', 'Local & trusted', `Friendly cleaners based in ${settings.area}.`],
          ['🕒', 'Times that suit you', 'Pick the days and times that work around your week.'],
          ['💬', 'Quick replies', 'We reply to every enquiry personally, by text or email.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="card p-4">
            <div className="text-xl">{icon}</div>
            <div className="font-bold mt-1">{title}</div>
            <p className="text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
