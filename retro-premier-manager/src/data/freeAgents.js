import { generateName } from './namePool.js'
import { mulberry32, hashString, buildPlayer } from './generateSquad.js'

const POSITIONS = ['GK', 'DF', 'MF', 'FW']

export function generateFreeAgents(seasonSeed, count = 18) {
  const rng = mulberry32(hashString(`free-agents-${seasonSeed}`))
  const agents = []
  for (let i = 0; i < count; i++) {
    const position = POSITIONS[Math.floor(rng() * POSITIONS.length)]
    const age = 20 + Math.floor(rng() * 18)
    const ability = 35 + Math.floor(rng() * 40)
    const player = buildPlayer({
      id: `free-agent-${i}`,
      name: generateName(rng),
      position,
      age,
      ability,
      potential: age <= 23 ? ability + Math.round(rng() * 10) : ability,
      reputation: 1,
      rng,
    })
    player.wage = Math.round((player.wage * 0.6) / 100) * 100
    player.contractYears = 0
    agents.push(player)
  }
  return agents
}
