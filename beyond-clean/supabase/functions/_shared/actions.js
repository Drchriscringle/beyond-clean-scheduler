// What happens when a customer skips, moves, pauses or adds an extra to a plan clean.
// Pure: it returns what to write and what to charge or credit, and the caller (the
// plan-action Edge Function, or demo mode in the browser) carries it out.

import { planVisitValue } from './pricing.js'
import { addDays, daysBetween, hoursUntil, planVisits, todayUK } from './schedule.js'

const MAX_PAUSE_DAYS = 8 * 7

export function decidePlanAction(settings, plan, changes, req, now = new Date()) {
  const fail = (error) => ({ error })
  if (!['active', 'past_due'].includes(plan.status)) return fail('Your plan is not active, so cleans cannot be changed online.')
  const today = todayUK(now)
  const visits = planVisits(plan, changes, today, addDays(today, 180))
  const notice = Number(settings.skipNoticeHours) || 0
  const value = planVisitValue(plan)
  const out = { inserts: [], deletes: [], balance: [], invoiceItems: [], message: '' }

  const findVisit = () => visits.find((v) => v.originalDate === req.date && v.originalStart === req.start)
  const creditFor = (v) => {
    if (!settings.skipCredit || hoursUntil(v.date, v.start, now) < notice) return 0
    return value + v.extras.reduce((sum, e) => sum + (Number(e.amount_pence) || 0), 0)
  }
  const skipRow = (v, credit, note) => ({
    subscription_id: plan.id, kind: 'skip', visit_date: v.originalDate, visit_start: v.originalStart,
    credit_pence: credit, made_by: 'customer', note: note || null,
  })

  switch (req.action) {
    case 'skip': {
      const v = findVisit()
      if (!v || v.skipped) return fail('That clean is not on your schedule.')
      if (hoursUntil(v.date, v.start, now) < 0) return fail('That clean has already started.')
      const credit = creditFor(v)
      out.inserts.push(skipRow(v, credit, req.note))
      if (credit) out.balance.push({ amount: -credit, description: `Skipped clean ${v.date}` })
      out.message = credit
        ? 'Clean skipped. It has been taken off your next bill.'
        : `Clean skipped. As it's less than ${notice} hours away it can't be credited.`
      return out
    }
    case 'unskip': {
      const skip = changes.find((c) => c.kind === 'skip' && c.visit_date === req.date && c.visit_start === req.start)
      if (!skip) return fail('That clean is not skipped.')
      if (hoursUntil(req.date, req.start, now) < 24) return fail('Too close to the day to undo online. Please call us.')
      out.deletes.push(skip.id)
      if (skip.credit_pence) out.balance.push({ amount: skip.credit_pence, description: `Clean back on ${req.date}` })
      out.message = 'Clean back on.'
      return out
    }
    case 'move': {
      const v = findVisit()
      if (!v || v.skipped) return fail('That clean is not on your schedule.')
      if (v.movePending) return fail('You have already asked to move this clean. We will confirm soon.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.newDate || '') || req.newDate < today) return fail('Choose a new date.')
      if (Math.abs(daysBetween(v.originalDate, req.newDate)) > 14) return fail('Please pick a date within 2 weeks of the original clean.')
      if (hoursUntil(v.date, v.start, now) < 24) return fail('Too close to the day to move online. Please call us.')
      out.inserts.push({
        subscription_id: plan.id, kind: 'move', status: 'requested', visit_date: v.originalDate, visit_start: v.originalStart,
        new_date: req.newDate, new_time: /^\d{2}:\d{2}$/.test(req.newTime || '') ? req.newTime : null,
        note: String(req.note || '').slice(0, 500) || null, made_by: 'customer',
      })
      out.message = 'Request sent. We will confirm the new time shortly.'
      return out
    }
    case 'extra': {
      const v = findVisit()
      if (!v || v.skipped) return fail('That clean is not on your schedule.')
      const amount = Number((settings.extras || {})[req.extraId]) || 0
      if (!amount) return fail('Choose an extra.')
      if (v.extras.some((e) => e.extra_id === req.extraId)) return fail('That extra is already added.')
      if (hoursUntil(v.date, v.start, now) < 24) return fail('Too close to the day to add online. Please call us.')
      out.inserts.push({
        subscription_id: plan.id, kind: 'extra', visit_date: v.originalDate, visit_start: v.originalStart,
        extra_id: req.extraId, amount_pence: amount, made_by: 'customer',
      })
      out.invoiceItems.push({ amount, description: `${req.extraLabel || req.extraId} on ${v.date}` })
      out.message = 'Extra added. It will be on your next bill.'
      return out
    }
    case 'pause': {
      const { from, to } = req
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || to < from) return fail('Choose the first and last day you are away.')
      if (from < today) return fail('The pause has to start today or later.')
      if (daysBetween(from, to) > MAX_PAUSE_DAYS) return fail('You can pause for up to 8 weeks at a time. Call us for longer.')
      const hit = visits.filter((v) => !v.skipped && v.date >= from && v.date <= to && hoursUntil(v.date, v.start, now) > 0)
      if (!hit.length) return fail('There are no cleans in those dates.')
      let total = 0
      for (const v of hit) {
        const credit = creditFor(v)
        total += credit
        out.inserts.push(skipRow(v, credit, 'Holiday pause'))
      }
      if (total) out.balance.push({ amount: -total, description: `Holiday pause ${from} to ${to}` })
      out.message = `${hit.length} clean${hit.length === 1 ? '' : 's'} paused.${total ? ' They have been taken off your next bill.' : ''}`
      out.credited = total
      return out
    }
    default:
      return fail('Unknown action.')
  }
}
