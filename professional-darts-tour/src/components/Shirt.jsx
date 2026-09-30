import { useId } from 'react'
import { flag } from '../career/players.js'

export const PATTERNS = ['plain', 'stripes', 'hoops', 'sash', 'halves', 'flames', 'chevron', 'panels']
export const FONTS = {
  block: 'Oswald, Impact, sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
  script: '"Brush Script MT", "Segoe Script", cursive',
  modern: 'Inter, Arial, sans-serif',
}
export const THEMES = [
  ['Classic red', '#c62828', '#111111', '#ffffff'],
  ['Royal blue', '#1e3a8a', '#f4c542', '#ffffff'],
  ['Orange lion', '#f97316', '#111111', '#ffffff'],
  ['Emerald', '#15803d', '#f1e9d2', '#111111'],
  ['Purple reign', '#6d28d9', '#f4c542', '#ffffff'],
  ['Black & gold', '#111111', '#f4c542', '#f4c542'],
  ['Pink panther', '#ec4899', '#111111', '#ffffff'],
  ['Sky', '#38bdf8', '#0f172a', '#0f172a'],
]

export function defaultShirt(career) {
  const u = career.players.user
  return {
    primary: '#c62828', secondary: '#111111', accent: '#ffffff', pattern: 'flames',
    name: (u.name.split(' ').slice(-1)[0] || u.name).toUpperCase().slice(0, 14),
    nickname: u.nickname ?? '', font: 'block', showFlag: true,
  }
}

const BODY = 'M62,12 L86,6 Q100,20 114,6 L138,12 L190,42 L173,80 L150,68 L150,212 L50,212 L50,68 L27,80 L10,42 Z'

function Pattern({ s }) {
  switch (s.pattern) {
    case 'stripes':
      return Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 24 + 6} y="0" width="11" height="220" fill={s.secondary} />)
    case 'hoops':
      return Array.from({ length: 6 }, (_, i) => <rect key={i} x="0" y={i * 38 + 18} width="200" height="16" fill={s.secondary} />)
    case 'sash':
      return <polygon points="40,0 80,0 190,220 150,220" fill={s.secondary} />
    case 'halves':
      return <rect x="100" y="0" width="100" height="220" fill={s.secondary} />
    case 'flames':
      return (
        <>
          <path d="M40,220 L40,170 Q52,140 60,168 Q66,120 80,160 Q88,110 100,150 Q110,105 120,158 Q132,118 140,166 Q150,138 162,170 L162,220 Z" fill={s.secondary} />
          <path d="M55,220 Q62,185 70,200 Q78,165 92,195 Q100,160 110,192 Q122,168 130,198 Q140,180 148,220 Z" fill={s.accent} opacity="0.85" />
        </>
      )
    case 'chevron':
      return <polygon points="30,70 100,120 170,70 170,95 100,145 30,95" fill={s.secondary} />
    case 'panels':
      return (
        <>
          <rect x="0" y="0" width="68" height="220" fill={s.secondary} />
          <rect x="132" y="0" width="68" height="220" fill={s.secondary} />
        </>
      )
    default:
      return null
  }
}

// shirt: design; sponsors: [{slot, brand}]; side: 'front' | 'back'
export default function Shirt({ shirt, sponsors = [], nation, side = 'front', size = 150 }) {
  const id = useId().replace(/:/g, '')
  const s = shirt
  const font = FONTS[s.font] ?? FONTS.block
  const main = sponsors.find((x) => x.slot === 'shirt')
  const equip = sponsors.find((x) => x.slot === 'equipment')
  const sleeve = sponsors.find((x) => x.slot === 'sleeve')
  const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={`Shirt ${side}`}>
      <defs>
        <clipPath id={`c${id}`}><path d={BODY} /></clipPath>
      </defs>
      <path d={BODY} fill={s.primary} />
      <g clipPath={`url(#c${id})`}>
        <Pattern s={s} />
        <rect x="8" y="60" width="26" height="8" fill={s.accent} transform="rotate(-62 21 64)" opacity="0.9" />
        <rect x="166" y="60" width="26" height="8" fill={s.accent} transform="rotate(62 179 64)" opacity="0.9" />
      </g>
      <path d={BODY} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
      <path d={side === 'front' ? 'M86,6 Q100,26 114,6' : 'M86,6 Q100,14 114,6'} fill="none" stroke={s.secondary} strokeWidth="5" />
      {side === 'front' ? (
        <>
          {main && (
            <g>
              <rect x="58" y="92" width="84" height="26" rx="5" fill="rgba(255,255,255,0.92)" />
              <text x="100" y="109" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="11" fontWeight="700" fill="#111">{fit(main.brand, 17).toUpperCase()}</text>
            </g>
          )}
          {equip && <text x="78" y="52" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7" fontWeight="700" fill={s.accent}>{fit(equip.brand, 14)}</text>}
          {s.showFlag && nation && <text x="124" y="54" textAnchor="middle" fontSize="14">{flag(nation)}</text>}
          {sleeve && <text x="170" y="52" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="6" fontWeight="700" fill={s.accent} transform="rotate(30 170 52)">{fit(sleeve.brand, 12)}</text>}
          <text x="100" y="200" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="7" fill={s.accent} opacity="0.8">PROFESSIONAL DARTS TOUR</text>
        </>
      ) : (
        <>
          <text x="100" y="78" textAnchor="middle" fontFamily={font} fontSize={s.name.length > 10 ? 18 : 24} fontWeight="700" fill={s.accent} stroke={s.secondary} strokeWidth="0.8" paintOrder="stroke">{s.name}</text>
          {s.nickname && <text x="100" y="98" textAnchor="middle" fontFamily={font} fontSize="10" fill={s.accent} fontStyle={s.font === 'script' ? 'normal' : 'italic'}>{fit(s.nickname, 24)}</text>}
          {sleeve && <text x="30" y="52" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="6" fontWeight="700" fill={s.accent} transform="rotate(-30 30 52)">{fit(sleeve.brand, 12)}</text>}
          {main && <text x="100" y="150" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="9" fill={s.accent} opacity="0.9">{fit(main.brand, 20).toUpperCase()}</text>}
        </>
      )}
    </svg>
  )
}
