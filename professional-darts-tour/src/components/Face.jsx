import { useId } from 'react'

// A simple illustrated face, built from options. Players pick theirs; AI players get one
// generated from their id so they always look the same.
export const FACE_OPTIONS = {
  skin: ['#f6d7c3', '#eac0a1', '#d7a27c', '#b47c57', '#8d5a3b', '#5e3a24'],
  shape: ['oval', 'round', 'square'],
  hair: ['bald', 'buzz', 'short', 'quiff', 'side', 'slick', 'curly', 'mohawk', 'receding', 'long', 'ponytail'],
  hairColour: ['#1c1714', '#3b2a20', '#6b4a2f', '#c99b5a', '#e8cf8a', '#a2471f', '#8c8c8c', '#e6e6e6', '#c4161c'],
  facial: ['none', 'stubble', 'moustache', 'goatee', 'beard', 'horseshoe'],
  eyes: ['#4a2e1c', '#2f6db5', '#3d7a4a', '#7a5a2c', '#5b6b75'],
  brows: ['normal', 'thick', 'thin'],
  glasses: ['none', 'round', 'square', 'shades'],
  mouth: ['smile', 'grin', 'serious', 'determined'],
  earring: ['none', 'left', 'both'],
}

export const FACE_LABELS = {
  skin: 'Skin', shape: 'Face shape', hair: 'Hair', hairColour: 'Hair colour', facial: 'Facial hair', eyes: 'Eyes', brows: 'Eyebrows', glasses: 'Glasses', mouth: 'Expression', earring: 'Earrings',
}

export function defaultFace() {
  return { skin: FACE_OPTIONS.skin[1], shape: 'oval', hair: 'short', hairColour: FACE_OPTIONS.hairColour[1], facial: 'stubble', eyes: FACE_OPTIONS.eyes[0], brows: 'normal', glasses: 'none', mouth: 'smile', earring: 'none' }
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

// Deterministic face for an AI player.
export function faceFor(player) {
  let h = hash(`${player?.id ?? ''}${player?.name ?? ''}`)
  const next = (list) => {
    const v = list[h % list.length]
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0
    return v
  }
  const female = player?.gender === 'f'
  const older = (player?.age ?? 30) > 45
  const face = {
    skin: next(FACE_OPTIONS.skin),
    shape: next(FACE_OPTIONS.shape),
    hair: female ? next(['long', 'ponytail', 'short', 'curly', 'side']) : next(older ? ['bald', 'receding', 'short', 'buzz', 'slick'] : FACE_OPTIONS.hair.slice(0, 9)),
    hairColour: older && h % 3 === 0 ? next(['#8c8c8c', '#e6e6e6']) : next(FACE_OPTIONS.hairColour.slice(0, 6)),
    facial: female ? 'none' : next(['none', 'none', 'stubble', 'moustache', 'goatee', 'beard', 'horseshoe']),
    eyes: next(FACE_OPTIONS.eyes),
    brows: next(FACE_OPTIONS.brows),
    glasses: next(['none', 'none', 'none', 'round', 'square']),
    mouth: next(FACE_OPTIONS.mouth),
    earring: female ? next(['none', 'both']) : next(['none', 'none', 'none', 'left']),
  }
  return face
}

const HEAD = { oval: [60, 58, 25, 31], round: [60, 59, 28, 29], square: [60, 58, 27, 30] }

function HairBack({ f }) {
  if (f.hair === 'long') return <path d="M31,52 Q30,20 60,19 Q90,20 89,52 L92,96 Q78,100 74,84 L46,84 Q42,100 28,96 Z" fill={f.hairColour} />
  if (f.hair === 'ponytail') return <path d="M84,46 Q102,58 94,92 Q86,80 86,62 Z" fill={f.hairColour} />
  return null
}

function HairFront({ f }) {
  const c = f.hairColour
  switch (f.hair) {
    case 'buzz': return <path d="M35,50 Q36,24 60,23 Q84,24 85,50 Q80,36 60,35 Q40,36 35,50 Z" fill={c} opacity="0.8" />
    case 'short': return <path d="M34,52 Q31,22 60,20 Q89,22 86,52 Q82,34 70,31 Q60,36 48,32 Q38,36 34,52 Z" fill={c} />
    case 'quiff': return <path d="M34,52 Q30,26 50,18 Q62,8 82,20 Q90,30 86,52 Q82,34 66,30 Q50,34 40,36 Q36,42 34,52 Z" fill={c} />
    case 'side': return <path d="M33,54 Q30,22 60,20 Q90,22 87,50 Q76,30 52,34 Q44,36 38,44 Z" fill={c} />
    case 'slick': return <path d="M34,48 Q34,22 60,21 Q86,22 86,48 Q80,30 60,29 Q40,30 34,48 Z" fill={c} />
    case 'curly': return <g fill={c}>{[[38, 34], [46, 25], [56, 21], [66, 21], [76, 25], [83, 34], [35, 44], [86, 44], [50, 30], [70, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" />)}</g>
    case 'mohawk': return <path d="M54,40 Q52,10 60,6 Q68,10 66,40 Z" fill={c} />
    case 'receding': return <g fill={c}><path d="M34,52 Q32,34 40,30 Q38,42 36,52 Z" /><path d="M86,52 Q88,34 80,30 Q82,42 84,52 Z" /></g>
    case 'long': return <path d="M34,50 Q32,20 60,19 Q88,20 86,50 Q80,30 64,29 Q50,40 36,44 Z" fill={c} />
    case 'ponytail': return <path d="M34,50 Q32,20 60,19 Q88,20 86,50 Q82,30 60,29 Q40,30 34,50 Z" fill={c} />
    default: return null
  }
}

function Facial({ f }) {
  const c = f.hairColour === '#c4161c' ? '#3b2a20' : f.hairColour
  switch (f.facial) {
    case 'stubble': return <path d="M38,66 Q40,90 60,92 Q80,90 82,66 Q78,82 60,84 Q42,82 38,66 Z" fill={c} opacity="0.28" />
    case 'moustache': return <path d="M48,73 Q54,69 60,72 Q66,69 72,73 Q66,76 60,74 Q54,76 48,73 Z" fill={c} />
    case 'goatee': return <g fill={c}><path d="M50,73 Q60,68 70,73 Q60,75 50,73 Z" /><path d="M54,82 Q60,94 66,82 Q60,85 54,82 Z" /></g>
    case 'beard': return <path d="M36,62 Q38,94 60,96 Q82,94 84,62 Q80,72 74,72 Q66,70 60,74 Q54,70 46,72 Q40,72 36,62 Z M52,80 Q60,84 68,80 Q60,78 52,80 Z" fill={c} fillRule="evenodd" />
    case 'horseshoe': return <path d="M48,72 Q60,67 72,72 L72,90 L68,90 L68,76 Q60,73 52,76 L52,90 L48,90 Z" fill={c} />
    default: return null
  }
}

function Glasses({ f }) {
  if (f.glasses === 'none') return null
  const stroke = f.glasses === 'shades' ? '#000' : '#111'
  const fill = f.glasses === 'shades' ? '#0a0a0a' : 'rgba(255,255,255,0.12)'
  if (f.glasses === 'round') return <g stroke={stroke} strokeWidth="2" fill={fill}><circle cx="49" cy="56" r="7" /><circle cx="71" cy="56" r="7" /><path d="M56,56 L64,56" /></g>
  return <g stroke={stroke} strokeWidth="2" fill={fill}><rect x="40" y="50" width="17" height="12" rx="3" /><rect x="63" y="50" width="17" height="12" rx="3" /><path d="M57,55 L63,55" /></g>
}

function Mouth({ f }) {
  switch (f.mouth) {
    case 'grin': return <path d="M50,76 Q60,86 70,76 Z" fill="#fff" stroke="#5a2a20" strokeWidth="1.5" />
    case 'serious': return <path d="M52,78 L68,78" stroke="#5a2a20" strokeWidth="2" strokeLinecap="round" />
    case 'determined': return <path d="M52,79 Q60,76 68,79" stroke="#5a2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
    default: return <path d="M51,76 Q60,83 69,76" stroke="#5a2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
  }
}

// face: options; shirt: { primary, secondary } for the shoulders
export default function Face({ face, shirt, size = 80, ring = false }) {
  const id = useId().replace(/:/g, '')
  const f = face ?? defaultFace()
  const [cx, cy, rx, ry] = HEAD[f.shape] ?? HEAD.oval
  const browW = f.brows === 'thick' ? 3.2 : f.brows === 'thin' ? 1.2 : 2
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`face ${ring ? 'ring' : ''}`} role="img" aria-label="Player face">
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="35%" r="70%"><stop offset="0%" stopColor="#2a2a2e" /><stop offset="100%" stopColor="#050505" /></radialGradient>
        <clipPath id={`clip${id}`}><circle cx="60" cy="60" r="60" /></clipPath>
      </defs>
      <g clipPath={`url(#clip${id})`}>
        <rect width="120" height="120" fill={`url(#bg${id})`} />
        <HairBack f={f} />
        <path d="M14,120 Q18,96 44,92 L76,92 Q102,96 106,120 Z" fill={shirt?.primary ?? '#c62828'} />
        <path d="M48,92 L60,104 L72,92 Z" fill={shirt?.secondary ?? '#111'} />
        <rect x="52" y="80" width="16" height="16" fill={f.skin} />
        <ellipse cx={cx - rx} cy="60" rx="5" ry="7" fill={f.skin} />
        <ellipse cx={cx + rx} cy="60" rx="5" ry="7" fill={f.skin} />
        {f.earring !== 'none' && <circle cx={cx - rx} cy="68" r="2" fill="#f5c542" />}
        {f.earring === 'both' && <circle cx={cx + rx} cy="68" r="2" fill="#f5c542" />}
        {f.shape === 'square'
          ? <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx="12" fill={f.skin} />
          : <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.skin} />}
        <Facial f={f} />
        <path d={`M43,${48 - browW / 2} Q49,${45 - browW / 2} 55,48`} stroke={f.hairColour === '#e6e6e6' ? '#9a9a9a' : f.hairColour} strokeWidth={browW} fill="none" strokeLinecap="round" />
        <path d={`M65,48 Q71,${45 - browW / 2} 77,${48 - browW / 2}`} stroke={f.hairColour === '#e6e6e6' ? '#9a9a9a' : f.hairColour} strokeWidth={browW} fill="none" strokeLinecap="round" />
        <ellipse cx="49" cy="56" rx="4" ry="3" fill="#fff" />
        <ellipse cx="71" cy="56" rx="4" ry="3" fill="#fff" />
        <circle cx="49" cy="56" r="2.2" fill={f.eyes} />
        <circle cx="71" cy="56" r="2.2" fill={f.eyes} />
        <path d="M60,58 Q57,67 60,68 Q62,68 63,67" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" fill="none" />
        <Mouth f={f} />
        <HairFront f={f} />
        <Glasses f={f} />
      </g>
    </svg>
  )
}
