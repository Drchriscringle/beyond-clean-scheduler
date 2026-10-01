// Save backups: automatic snapshots on the device, plus export/import of a save file so a
// career survives deleting the app or changing phone.
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { migrate } from './persistence.js'

const SNAP_KEY = 'pdt-snapshots-v1'
const MAX_SNAPSHOTS = 3

function describe(career) {
  const e = career.calendar?.[Math.min(career.eventIndex, career.calendar.length - 1)]
  return { name: career.players?.user?.name ?? 'Career', year: career.year, next: e?.name ?? '', savedAt: new Date().toISOString() }
}

export function listSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAP_KEY) ?? '[]')
  } catch {
    return []
  }
}

// Called after each event: keeps the last few careers states in case something goes wrong.
export function snapshot(career) {
  try {
    const { _rankCache, ...rest } = career
    void _rankCache
    const list = listSnapshots().filter((x) => !(x.year === career.year && x.eventIndex === career.eventIndex))
    list.unshift({ ...describe(career), eventIndex: career.eventIndex, data: JSON.stringify(rest) })
    localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)))
  } catch {
    // Out of space: drop the snapshots rather than the live save.
    try { localStorage.removeItem(SNAP_KEY) } catch { /* ignore */ }
  }
}

export function restoreSnapshot(i) {
  const s = listSnapshots()[i]
  return s ? migrate(JSON.parse(s.data)) : null
}

export function saveFileName(career) {
  const who = (career.players?.user?.name ?? 'career').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return `professional-darts-tour-${who}-${career.year}.json`
}

export async function exportSave(career) {
  const { _rankCache, ...rest } = career
  void _rankCache
  const text = JSON.stringify({ app: 'professional-darts-tour', exportedAt: new Date().toISOString(), career: rest })
  const name = saveFileName(career)
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'Professional Darts Tour save', text: 'My Professional Darts Tour career save', files: [file.uri] })
    return name
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return name
}

// Accepts an exported file's text. Returns the career or throws with a readable message.
export function parseSave(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a Professional Darts Tour save.")
  }
  const career = obj?.career ?? obj
  if (!career?.players?.user || career.version !== 2) throw new Error("That file isn't a Professional Darts Tour save (or it's from an older version).")
  return migrate(career)
}
