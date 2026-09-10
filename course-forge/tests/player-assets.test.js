import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderAssets, assetsPath } from '../scripts/generate-player-assets.mjs'
import { PLAYER_CSS, PLAYER_JS } from '../server/export/player/assets.js'

test('the generated player assets match their source files', () => {
  // The assets are committed so the exporter works with no build step, which
  // means they can drift from the .css and .js they came from. Editing the
  // player and forgetting to regenerate should fail here, not ship.
  assert.equal(
    readFileSync(assetsPath, 'utf8'),
    renderAssets(),
    'server/export/player/assets.js is stale — run `npm run generate:player`',
  )
})

test('the player assets carry the real stylesheet and runtime', () => {
  assert.ok(PLAYER_CSS.includes('.shell'), 'the layout is there')
  assert.ok(PLAYER_JS.includes('speechSynthesis'), 'narration playback is there')
  assert.ok(PLAYER_JS.includes('LMSInitialize'), 'the SCORM adapter is there')
})
