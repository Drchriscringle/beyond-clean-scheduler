// Headless career: auto-sims every user match for N seasons and prints the story.
// Usage: node scripts/autocareer.js [seasons] [difficulty]
import { advance, finishEvent, newCareer, nextUserTask, simulateUntilUserMatch, simulateUserMatch } from '../src/career/career.js'

const seasons = Number(process.argv[2] ?? 3)
const career = newCareer({ name: 'Test', avg: 60, difficulty: process.argv[3] ?? 'normal' })
const t0 = Date.now()
while (career.seasons.length < seasons) {
  advance(career)
  if (!career.active) continue
  for (;;) {
    simulateUntilUserMatch(career)
    const task = nextUserTask(career)
    if (task.kind === 'qualifier' || task.kind === 'round') simulateUserMatch(career)
    else break
  }
  finishEvent(career)
}
for (const s of career.seasons) console.log(s.year, s.tour, 'pro#', s.proRank, 'ct#', s.ctRank, '£' + s.money, s.titles.join(', '), '|', s.outcome)
console.log('stats', career.stats, 'ms', Date.now() - t0)
console.log(career.news.slice(0, 8).map((n) => n.text).join('\n'))
