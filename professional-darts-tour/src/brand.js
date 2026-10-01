// Store-safe naming. The real PDC event names are trademarks, so the app-store build swaps
// them (on screen and in the caller's voice) for the game's own names. The test build keeps
// the real names; Settings has a preview toggle.
//
// Build the store version with:  npm run build:store

// Longest names first so "World Series Finals" wins over "World Series".
export const STORE_NAMES = [
  ["Women's World Matchplay", "Women's Matchplay"],
  ['World Seniors Championship', 'Seniors Championship'],
  ['World Seniors Masters', 'Seniors Masters'],
  ['World Seniors Matchplay', 'Seniors Matchplay'],
  ['World Seniors Darts Tour', 'Seniors Tour'],
  ['Players Championship Finals', 'Pro Tour Finals'],
  ['Players Championships', 'Pro Tour Opens'],
  ['Players Championship', 'Pro Tour Open'],
  ['Premier League Darts', 'Super League'],
  ['Premier League', 'Super League'],
  ['Grand Slam of Darts', 'Champions Slam'],
  ['Grand Slam', 'Champions Slam'],
  ['World Grand Prix', 'Double-In Grand Prix'],
  ['World Matchplay', 'Blackpool Matchplay'],
  ['World Series Finals', 'Global Series Finals'],
  ['World Series of Darts', 'Global Series'],
  ['World Series', 'Global Series'],
  ['World Cup of Darts', 'Nations Cup'],
  ['World Masters', 'Masters Invitational'],
  ['World Darts Championship', 'World Championship'],
  ['European Championship', 'Continental Championship'],
  ['European Tour', 'Continental Tour'],
  ['UK Open', 'National Open'],
  ["Women's Series", "Women's Tour"],
  ['Development Tour', 'Youth Tour'],
  ['Challenge Tour', 'Challenger Tour'],
  ['Q-School', 'Tour School'],
  ['PDPA', "Players' Association"],
  ['PDC', 'PDT'],
]

function envFlag() {
  try {
    return import.meta.env?.VITE_STORE_SAFE === '1'
  } catch {
    return false
  }
}

function previewFlag() {
  try {
    return localStorage.getItem('pdt-store-names') === '1'
  } catch {
    return false
  }
}

export const STORE_BUILD = envFlag()
export const storeNames = () => STORE_BUILD || previewFlag()

export function setStoreNamePreview(on) {
  try {
    if (on) localStorage.setItem('pdt-store-names', '1')
    else localStorage.removeItem('pdt-store-names')
  } catch { /* ignore */ }
}

const PATTERN = new RegExp(STORE_NAMES.map(([real]) => real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
const LOOKUP = Object.fromEntries(STORE_NAMES)

// PDC event titles follow "<Place> Darts Masters/Open/Trophy/Grand Prix/Championship".
const EVENT_TITLE = /\b([A-Z][\w-]*(?: [A-Z][\w-]*)?) Darts (Masters|Open|Trophy|Grand Prix|Championship)\b/g

export function brandText(text) {
  if (!text || typeof text !== 'string' || !storeNames()) return text
  return text.replace(PATTERN, (m) => LOOKUP[m]).replace(EVENT_TITLE, '$1 $2')
}

// Rewrites text on screen as React renders it.
export function installStoreNames(root) {
  if (!storeNames() || typeof MutationObserver === 'undefined') return
  const fix = (node) => {
    if (node.nodeType === 3) {
      const next = brandText(node.nodeValue)
      if (next !== node.nodeValue) node.nodeValue = next
      return
    }
    if (node.nodeType !== 1) return
    for (const attr of ['placeholder', 'title', 'alt', 'aria-label']) {
      const v = node.getAttribute?.(attr)
      if (v) {
        const next = brandText(v)
        if (next !== v) node.setAttribute(attr, next)
      }
    }
    for (const child of node.childNodes) fix(child)
  }
  fix(root)
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fix(r.target)
      else if (r.type === 'attributes') fix(r.target)
      else r.addedNodes.forEach(fix)
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'alt', 'aria-label'] })
  document.title = brandText(document.title)
}
