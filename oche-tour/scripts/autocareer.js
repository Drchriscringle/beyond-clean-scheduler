// Headless career: confirms every entry, auto-sims every match for N seasons.
// Usage: node scripts/autocareer.js [seasons] [avg] [mode]
import { advance, finishEvent, handleAction, newCareer, nextUserTask, setEntry, simulateUntilUserMatch, simulateUserMatch, currentEvent } from '../src/career/career.js'

const seasons = Number(process.argv[2] ?? 2)
const avg = Number(process.argv[3] ?? 85)
const career = newCareer({ name: 'Test Player', nation: 'ENG', age: 22, avg, difficultyMode: process.argv[4] ?? 'progressive' })
const t0 = Date.now()
let guard = 0
while (career.seasons.length < seasons && guard++ < 5000) {
  const res = advance(career)
  if (res.needs === 'qschool') {
    const m = career.inbox.find((x) => x.actions?.some((a) => a.action === 'registerQschool') && !x.resolved)
    handleAction(career, m.id, 'registerQschool')
    continue
  }
  if (res.needs === 'premier') {
    const m = career.inbox.find((x) => x.actions?.some((a) => a.action === 'acceptPL') && !x.resolved)
    handleAction(career, m.id, 'acceptPL')
    continue
  }
  if (res.needs === 'entry') {
    setEntry(career, currentEvent(career).id, 'confirmed')
    continue
  }
  if (!career.active) continue
  for (;;) {
    simulateUntilUserMatch(career)
    const task = nextUserTask(career)
    if (task.kind === 'qualifier' || task.kind === 'round') simulateUserMatch(career)
    else break
  }
  finishEvent(career)
}
for (const s of career.seasons) console.log(s.year, s.tour, 'OoM#', s.oomRank, 'CT#', s.ctRank, 'DT#', s.dtRank, '£' + s.money, s.titles.length, 'titles |', s.outcome)
console.log('bank', career.finance.bank, 'won', career.stats.won, '/', career.stats.simulated, 'ms', Date.now() - t0, 'inbox', career.inbox.length, 'save KB', Math.round(JSON.stringify(career).length / 1024))
console.log(career.news.slice(0, 12).map((n) => n.date + ' ' + n.text).join('\n'))
if (process.env.DEBUG) {
  const top = Object.values(career.players).sort((a, b) => (b.earn[career.year - 1]?.total ?? 0) - (a.earn[career.year - 1]?.total ?? 0)).slice(0, 6)
  console.log(top.map((p) => `${p.id} ${p.name} r=${p.rating} age=${p.age} ${p.tour} £${p.earn[career.year - 1]?.total}`))
}
