import { formatPounds } from '../../supabase/functions/_shared/pricing.js'
import { PROMISES } from './Home.jsx'

// Plain-English policies. The numbers come from Settings so they always match what the app does.
export default function Policies({ settings: s }) {
  const sections = [
    ['Our promise', PROMISES.map(([, t, d]) => `${t}: ${d}`)],
    ['One-off cleans', [
      'You get an estimate straight away. We confirm the exact price before anything is booked.',
      s.depositPercent > 0 ? `A ${s.depositPercent}% card deposit secures your date. It comes off the final price.` : 'No deposit is needed to book.',
      `Cancel or move for free with ${s.cancelNoticeHours} hours' notice, and any deposit is refunded.`,
      `With less notice, up to ${s.lateCancelPercent}% of the price may be charged, because your cleaner has kept that time for you.`,
      'The balance is due once the clean is finished. You can pay by card from your booking page.',
    ]],
    ['Regular cleaning plans', [
      'One fixed monthly payment. It is the same every month, averaged over the year (52 weeks ÷ 12 months).',
      `Skip a clean with ${s.skipNoticeHours} hours' notice and the full value comes off your next bill. With less notice the clean is still skipped but not credited.`,
      'Going away? Pause for up to 8 weeks at a time from your plan page, with the same credit rule.',
      'Need a different day? Ask to move a clean from your plan page and we will confirm by email.',
      'Extras like an oven clean can be added to any clean and are added to your next bill.',
      'Cancel any time from your plan page. Your plan stops at the end of the month you have paid for, with no exit fee.',
      `Refer a friend: they get ${formatPounds(s.referralRewardPence)} off their first month and you get ${formatPounds(s.referralRewardPence)} off your next bill.`,
    ]],
    ['If something is not right', [
      'Tell us within 24 hours (reply to any email, call us, or rate your clean in the app) and we will come back and fix it free of charge.',
      'If anything is damaged, tell us straight away. We are fully insured.',
    ]],
    ['Your details', [
      'We only use your details to arrange and carry out your cleans. We never sell or share them.',
      'Key safe codes and access notes are only shown to the cleaner doing your clean.',
      'Card payments are handled by Stripe. We never see or store your card number.',
    ]],
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-900">Our promise & policies</h1>
      {sections.map(([title, items]) => (
        <section key={title} className="card p-4 sm:p-5">
          <h2 className="font-extrabold text-lg mb-2">{title}</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-700">{items.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      ))}
      <p className="text-sm text-slate-500">{s.businessName}{s.phone ? ` · ${s.phone}` : ''}{s.email ? ` · ${s.email}` : ''}</p>
    </div>
  )
}
