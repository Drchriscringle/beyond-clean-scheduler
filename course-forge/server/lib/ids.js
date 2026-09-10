import { randomUUID } from 'node:crypto'

export function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`
}

/**
 * A URL- and filename-safe slug. Used for export filenames and SCORM
 * resource identifiers, so it must never be empty.
 */
export function slugify(text, fallback = 'course') {
  const slug = String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || fallback
}
