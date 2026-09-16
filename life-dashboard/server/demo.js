import { addDays } from './lib/dates.js'
import { createObjective } from './objectives.js'

/**
 * A worked example of a life, so the dashboard can be seen working before you
 * have typed a single thing into it.
 *
 * Dates are generated relative to today rather than hard-coded, so the demo
 * always looks like a real week rather than a museum piece — and it is built
 * to show the parts that matter: a month that ends fine but dips hard in the
 * middle, a direct debit that quietly went up, one that did not come out at
 * all, a subscription nobody set up, and an objective that has stopped moving.
 */
export function demoData(today) {
  const monthStart = `${today.slice(0, 7)}-01`

  return {
    profile: {
      name: 'Chris',
      timezone: 'Europe/London',
      currency: 'GBP',
      locale: 'en-GB',
      bufferPence: 25_000,
      horizonDays: 60,
      agendaDays: 7,
      newsDays: 7,
    },

    accounts: [
      { id: 'current', name: 'Everyday current account', balancePence: 214_300, kind: 'account' },
      { id: 'savings', name: 'Savings', balancePence: 1_250_000, kind: 'account', includeInForecast: false },
    ],

    commitments: [
      { id: 'salary', name: 'Salary — Acme Trading', kind: 'income', category: 'salary', amountPence: 280_000, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 24), shift: 'before' } },
      { id: 'invoice', name: 'Invoice 114 — Harper & Co', kind: 'income', category: 'invoice', amountPence: 96_000, accountId: 'current', schedule: { frequency: 'one-off', anchor: addDays(today, 9) } },
      { id: 'rent', name: 'Rent', kind: 'outgoing', category: 'rent-mortgage', amountPence: 120_000, accountId: 'current', schedule: { frequency: 'monthly', anchor: monthStart, shift: 'after' } },
      { id: 'council', name: 'Council tax', kind: 'outgoing', category: 'direct-debit', amountPence: 18_500, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 4), shift: 'after' } },
      { id: 'gas', name: 'British Gas', kind: 'outgoing', category: 'direct-debit', amountPence: 7_800, variable: true, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 2), shift: 'after' } },
      { id: 'water', name: 'Water', kind: 'outgoing', category: 'direct-debit', amountPence: 4_200, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 9), shift: 'after' } },
      { id: 'broadband', name: 'Broadband', kind: 'outgoing', category: 'direct-debit', amountPence: 3_499, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 11), shift: 'after' } },
      { id: 'phone', name: 'Mobile', kind: 'outgoing', category: 'direct-debit', amountPence: 2_200, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 17), shift: 'after' } },
      { id: 'gym', name: 'Gym membership', kind: 'outgoing', category: 'subscription', amountPence: 3_500, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 14) } },
      { id: 'car', name: 'Car insurance', kind: 'outgoing', category: 'bill', amountPence: 62_000, accountId: 'current', schedule: { frequency: 'annual', anchor: addDays(today, 21) } },
      { id: 'pension', name: 'Pension contribution', kind: 'outgoing', category: 'standing-order', amountPence: 25_000, accountId: 'current', schedule: { frequency: 'monthly', anchor: addDays(monthStart, 25) } },
    ],

    // A month of statement lines: most match, one bill is higher than expected,
    // the water bill never came out, and something recurring is unaccounted for.
    transactions: [
      { id: 'tx-1', accountId: 'current', day: addDays(monthStart, 0), description: 'RENT PAYMENT TO HIGHFIELD LETTINGS', amountPence: -120_000, source: 'demo' },
      { id: 'tx-2', accountId: 'current', day: addDays(monthStart, 2), description: 'DD BRITISH GAS ENERGY 8829301', amountPence: -9_140, source: 'demo' },
      { id: 'tx-3', accountId: 'current', day: addDays(monthStart, 4), description: 'DD COUNCIL TAX BOROUGH 4471', amountPence: -18_500, source: 'demo' },
      { id: 'tx-4', accountId: 'current', day: addDays(monthStart, 11), description: 'DD BROADBAND CO UK LTD REF 99213', amountPence: -3_499, source: 'demo' },
      { id: 'tx-5', accountId: 'current', day: addDays(monthStart, 14), description: 'DD THE GYM GROUP PLC', amountPence: -3_500, source: 'demo' },
      { id: 'tx-6', accountId: 'current', day: addDays(monthStart, 6), description: 'CARD PAYMENT TESCO STORES 3364', amountPence: -6_218, source: 'demo' },
      { id: 'tx-7', accountId: 'current', day: addDays(monthStart, -93), description: 'DD CLOUDSTORE PRO PLAN', amountPence: -1_999, source: 'demo' },
      { id: 'tx-8', accountId: 'current', day: addDays(monthStart, -62), description: 'DD CLOUDSTORE PRO PLAN', amountPence: -1_999, source: 'demo' },
      { id: 'tx-9', accountId: 'current', day: addDays(monthStart, -31), description: 'DD CLOUDSTORE PRO PLAN', amountPence: -1_999, source: 'demo' },
      { id: 'tx-10', accountId: 'current', day: addDays(monthStart, 0), description: 'DD CLOUDSTORE PRO PLAN', amountPence: -1_999, source: 'demo' },
    ],

    events: [
      { id: 'ev-1', title: 'Quarterly review with Harper & Co', day: addDays(today, 2), time: '11:00', endTime: '12:30', location: 'Their office' },
      { id: 'ev-2', title: 'Dentist', day: addDays(today, 5), time: '08:40' },
      { id: 'ev-3', title: 'Five-a-side', day: today, time: '19:00', rrule: 'FREQ=WEEKLY' },
      { id: 'ev-4', title: 'Mum’s birthday', day: addDays(today, 11) },
    ],

    feeds: [],

    targets: [
      { id: 'harper', name: 'Harper & Co', kind: 'company', aliases: ['Harper and Co'], active: true },
      { id: 'acme', name: 'Acme Trading', kind: 'company', active: true },
      { id: 'okafor', name: 'Jane Okafor', kind: 'person', active: true },
    ],

    newsSources: [],

    objectives: [
      {
        ...createObjective({
          title: 'Land three retainer clients',
          detail: 'Recurring revenue, not one-off projects.',
          horizon: 'quarter',
          dueOn: addDays(today, 45),
          targetIds: ['harper'],
          metric: { name: 'retainers', start: 0, current: 1, goal: 3, unit: '' },
          steps: [
            { id: 's1', title: 'Write the one-page offer', done: true },
            { id: 's2', title: 'Send proposal to Harper & Co', dueOn: addDays(today, 2) },
            { id: 's3', title: 'Follow up the two warm leads', dueOn: addDays(today, 7) },
          ],
        }),
        id: 'obj-1',
        lastMovedAt: new Date(Date.parse(`${today}T09:00:00Z`) - 2 * 86_400_000).toISOString(),
      },
      {
        ...createObjective({
          title: 'Get the emergency fund to £5,000',
          horizon: 'year',
          metric: { name: 'saved', start: 1_200, current: 2_650, goal: 5_000, unit: '' },
          steps: [{ id: 's1', title: 'Move £250 across on payday', dueOn: addDays(today, 12) }],
        }),
        id: 'obj-2',
        lastMovedAt: new Date(Date.parse(`${today}T09:00:00Z`) - 9 * 86_400_000).toISOString(),
      },
      {
        ...createObjective({
          title: 'Rewrite the services page',
          horizon: 'now',
          dueOn: addDays(today, -4),
          steps: [
            { id: 's1', title: 'Draft the copy', done: true },
            { id: 's2', title: 'Get photographs taken' },
          ],
        }),
        id: 'obj-3',
        lastMovedAt: new Date(Date.parse(`${today}T09:00:00Z`) - 23 * 86_400_000).toISOString(),
      },
    ],

    newsItems: [],
    dismissals: [],
    connections: [],
  }
}

/** Writes the demo into a store, replacing whatever is there. */
export async function loadDemo(store, today) {
  const data = demoData(today)
  for (const [collection, value] of Object.entries(data)) {
    await store.set(collection, value)
  }
  return data
}
