import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Loads a .env file into the environment, if there is one.
 *
 * Only the entry points call this — importing a module should never have the
 * side effect of reading the author's environment file, and the tests must
 * not pick up whatever key happens to be sitting on the machine.
 *
 * Variables already set in the real environment win, so an exported
 * ANTHROPIC_API_KEY is never clobbered by a stale file.
 */
export function loadEnv() {
  if (typeof process.loadEnvFile !== 'function') return null

  // The working directory first, so running the CLI inside a project picks up
  // that project's file; the package's own .env is the fallback.
  for (const directory of [process.cwd(), packageRoot]) {
    const file = resolve(directory, '.env')
    if (!existsSync(file)) continue
    try {
      process.loadEnvFile(file)
      return file
    } catch {
      return null
    }
  }
  return null
}
