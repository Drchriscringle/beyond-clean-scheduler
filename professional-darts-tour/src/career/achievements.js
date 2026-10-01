// Achievements. Skill ones only count matches played on the oche (not auto-simmed).
import { TV_EVENTS } from './data/competitions.js'
import { dateStr, sendMail } from './inbox.js'
import { ranking, rankOf } from './rankings.js'

const tv = (h) => TV_EVENTS.includes(h.key)

// check(c) -> boolean; c = { career, stats, records, user, oomRank, honoursWon }
export const ACHIEVEMENTS = [
  // At the board
  { id: 'first180', icon: '💯', group: 'At the board', name: 'Maximum!', desc: 'Hit your first 180 in a match', check: (c) => c.stats.s180 >= 1 },
  { id: 'ten180', icon: '🎯', group: 'At the board', name: 'Ton-eighty machine', desc: '10 career 180s', check: (c) => c.stats.s180 >= 10 },
  { id: 'hundred180', icon: '🔥', group: 'At the board', name: 'Maximum century', desc: '100 career 180s', check: (c) => c.stats.s180 >= 100 },
  { id: 'three180', icon: '🎰', group: 'At the board', name: 'Treble top', desc: 'Three 180s in one match', check: (c) => (c.records.most180s?.value ?? 0) >= 3 },
  { id: 'tonOut', icon: '✅', group: 'At the board', name: 'Ton-plus finish', desc: 'Check out 100 or more', check: (c) => c.stats.highCheckout >= 100 },
  { id: 'big150', icon: '💥', group: 'At the board', name: 'Big finish', desc: 'Check out 150 or more', check: (c) => c.stats.highCheckout >= 150 },
  { id: 'bigFish', icon: '🐟', group: 'At the board', name: 'The Big Fish', desc: 'Check out 170', check: (c) => c.stats.highCheckout >= 170 },
  { id: 'nine', icon: '✨', group: 'At the board', name: 'Perfection', desc: 'Hit a nine-dart finish', check: (c) => c.stats.nineDarters >= 1 },
  { id: 'twelveDarter', icon: '⚡', group: 'At the board', name: 'Twelve darter', desc: 'Win a leg in 12 darts or fewer', check: (c) => (c.records.lowestLeg?.value ?? 99) <= 12 },
  { id: 'fifteenDarter', icon: '👟', group: 'At the board', name: 'Quick leg', desc: 'Win a leg in 15 darts or fewer', check: (c) => (c.records.lowestLeg?.value ?? 99) <= 15 },
  { id: 'avg60', icon: '📈', group: 'At the board', name: 'Sixty club', desc: 'Average 60+ in a match', check: (c) => (c.records.bestAverage?.value ?? 0) >= 60 },
  { id: 'avg80', icon: '📈', group: 'At the board', name: 'Eighty club', desc: 'Average 80+ in a match', check: (c) => (c.records.bestAverage?.value ?? 0) >= 80 },
  { id: 'avg100', icon: '🏅', group: 'At the board', name: 'Ton average', desc: 'Average 100+ in a match', check: (c) => (c.records.bestAverage?.value ?? 0) >= 100 },
  { id: 'played50', icon: '🎽', group: 'At the board', name: 'Dedicated', desc: 'Play 50 matches on the oche', check: (c) => c.stats.played >= 50 },
  // Career
  { id: 'firstWin', icon: '👊', group: 'Career', name: 'Off the mark', desc: 'Win your first match', check: (c) => c.stats.won >= 1 },
  { id: 'tourCard', icon: '🎫', group: 'Career', name: 'Card carrier', desc: 'Win a PDC Tour Card', check: (c) => c.user.tour === 'pro' },
  { id: 'firstTitle', icon: '🏆', group: 'Career', name: 'Champion', desc: 'Win your first title', check: (c) => c.user.titles.length >= 1 },
  { id: 'tenTitles', icon: '👑', group: 'Career', name: 'Serial winner', desc: 'Win 10 titles', check: (c) => c.user.titles.length >= 10 },
  { id: 'tvTitle', icon: '📺', group: 'Career', name: 'Live on TV', desc: 'Win a televised title', check: (c) => c.honoursWon.some(tv) },
  { id: 'worlds', icon: '🌍', group: 'Career', name: 'World Champion', desc: 'Win the World Championship', check: (c) => c.honoursWon.some((h) => h.key === 'worlds') },
  { id: 'premier', icon: '⭐', group: 'Career', name: 'Prime time', desc: 'Get invited to the Premier League', check: (c) => !!c.career.pl?.players.includes('user') && !c.career.pl.pending },
  { id: 'top64', icon: '6️⃣', group: 'Career', name: 'Safe', desc: 'Reach the top 64', check: (c) => c.oomRank && c.oomRank <= 64 },
  { id: 'top16', icon: '🔝', group: 'Career', name: 'Elite', desc: 'Reach the top 16', check: (c) => c.oomRank && c.oomRank <= 16 },
  { id: 'number1', icon: '🥇', group: 'Career', name: 'World number one', desc: 'Top the Order of Merit', check: (c) => c.oomRank === 1 },
  { id: 'giantKiller', icon: '🪓', group: 'Career', name: 'Giant killer', desc: 'Beat a top-16 player', check: (c) => !!c.career.flags?.beatTop16 },
  { id: 'hundredK', icon: '💷', group: 'Career', name: 'Six figures', desc: 'Earn £100,000 in prize money', check: (c) => c.earnings >= 100000 },
  { id: 'million', icon: '💰', group: 'Career', name: 'Millionaire', desc: 'Earn £1,000,000 in prize money', check: (c) => c.earnings >= 1000000 },
  { id: 'sponsor', icon: '🤝', group: 'Career', name: 'Sponsored', desc: 'Sign your first sponsor', check: (c) => c.career.sponsors.length > 0 || !!c.career.flags?.signedSponsor },
]

function context(career) {
  const user = career.players.user
  const ranked = (user.earn[career.year]?.ranked ?? 0) + (user.earn[career.year - 1]?.ranked ?? 0) > 0
  return {
    career,
    user,
    stats: career.stats,
    records: career.records ?? {},
    oomRank: ranked ? rankOf(ranking(career, 'oom'), 'user') : null,
    honoursWon: career.honours.filter((h) => h.winner === 'user' || (typeof h.winner === 'string' && h.winner.startsWith('T:') && career.active?.userSide === h.winner)),
    earnings: Object.values(user.earn).reduce((t, e) => t + (e.total ?? 0), 0),
  }
}

// Unlocks anything newly earned. Returns the newly unlocked achievements.
export function checkAchievements(career) {
  career.achievements ??= {}
  const c = context(career)
  const fresh = []
  for (const a of ACHIEVEMENTS) {
    if (career.achievements[a.id]) continue
    let ok = false
    try { ok = !!a.check(c) } catch { ok = false }
    if (!ok) continue
    career.achievements[a.id] = dateStr(career)
    fresh.push(a)
  }
  if (fresh.length) {
    career.newAchievements = [...(career.newAchievements ?? []), ...fresh.map((a) => a.id)]
    sendMail(career, {
      from: 'Achievements',
      subject: `🏅 ${fresh.length === 1 ? `Achievement unlocked: ${fresh[0].name}` : `${fresh.length} achievements unlocked`}`,
      body: fresh.map((a) => `${a.icon} ${a.name}: ${a.desc}`).join('\n'),
    })
  }
  return fresh
}
