// Checks for the sign-recognition core (src/lib/signs). Run: node scripts/test-signs.mjs
// Synthetic hand movements stand in for real signs: they test the maths (body-relative
// features, splitting, matching, "not sure"), not how well real ISL signs are recognised.
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'signs-'))
const entry = join(dir, 'entry.ts')
writeFileSync(entry, `export * from '${process.cwd()}/src/lib/signs/recognizer'\nexport * from '${process.cwd()}/src/lib/signs/vocabulary'\n`)
const outfile = join(dir, 'signs.mjs')
// The interface-language module needs the browser and Vite; the checks use English as is.
const i18nStub = {
  name: 'i18n-stub',
  setup(b) {
    b.onResolve({ filter: /\/i18n$/ }, () => ({ path: 'i18n-stub', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `export const t = (s, o = {}) => s.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => String(o[k] ?? ''))
export const currentLanguage = () => ({ code: 'en', speech: 'en-IN' })`,
      loader: 'js',
    }))
  },
}
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', plugins: [i18nStub] })
const S = await import(outfile)

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const noise = (s) => (rand() - 0.5) * s

// A "person" in the picture: shoulders somewhere, at some size.
function person() {
  const cx = 0.4 + rand() * 0.2, cy = 0.45 + rand() * 0.1, half = 0.1 + rand() * 0.06
  const pose = Array.from({ length: 33 }, () => ({ x: cx, y: cy }))
  pose[11] = { x: cx + half, y: cy }
  pose[12] = { x: cx - half, y: cy }
  return { pose, cx, cy, unit: 2 * half }
}
// Hand shape: 21 points around the wrist.
const handAt = (x, y, unit, spread) =>
  Array.from({ length: 21 }, (_, i) => ({ x: x + Math.cos(i) * spread * unit + noise(0.004), y: y - (i / 21) * 0.5 * unit + noise(0.004) }))

const MOVES = {
  circle: (t) => [Math.cos(t * 2 * Math.PI) * 0.6, -0.6 + Math.sin(t * 2 * Math.PI) * 0.6, 0.2],
  swipe: (t) => [-1 + 2 * t, -0.2, 0.05],
  tap: (t) => [0.3, -1.2 + Math.abs(Math.sin(t * 3 * Math.PI)) * 0.8, 0.35],
}
function perform(move, frames = 20 + Math.floor(rand() * 30)) {
  const p = person()
  const out = []
  for (let i = 0; i < frames; i++) {
    const [dx, dy, spread] = MOVES[move](i / (frames - 1))
    const pts = handAt(p.cx + dx * p.unit, p.cy + dy * p.unit, p.unit, spread)
    out.push(S.frameFeatures({ hands: [{ label: 'Right', points: pts }], pose: p.pose }))
  }
  return S.resample(out)
}

// 1. Features are relative to the body: same movement, different place and size → close.
const a = perform('swipe', 30), b = perform('swipe', 30)
assert.ok(S.dtw(a, b) < 0.1, `same sign far apart: ${S.dtw(a, b)}`)
assert.equal(a[0].length, S.FRAME_SIZE)
assert.equal(S.frameFeatures({ hands: [], pose: null }), null)

// 2. Splitting the stream: hands up for 15 frames, down for 10 → one sign; short blips ignored.
const seg = new S.SignSegmenter()
const f = S.frameFeatures({ hands: [{ label: 'Right', points: handAt(0.5, 0.5, 0.2, 0.2) }], pose: null })
let done = null
for (let i = 0; i < 15; i++) assert.equal(seg.push(f), null)
for (let i = 0; i < 10; i++) done = seg.push(null) ?? done
assert.equal(done.length, S.SIGN_FRAMES)
for (let i = 0; i < 3; i++) seg.push(f)
let blip = null
for (let i = 0; i < 10; i++) blip = seg.push(null) ?? blip
assert.equal(blip, null)

// 3. Recognition with 3 examples per sign, tested on 20 new performances each.
const examples = Object.keys(MOVES).flatMap((label) => [0, 1, 2].map(() => ({ label, frames: perform(label) })))
let right = 0, total = 0, unsure = 0
for (const label of Object.keys(MOVES)) {
  for (let i = 0; i < 20; i++) {
    const r = S.recognise(perform(label), examples)
    total += 1
    if (r.guesses[0].label === label) right += 1
    if (r.unsure) unsure += 1
  }
}
console.log(`known signs: ${right}/${total} top-1 correct, ${unsure} marked unsure`)
assert.ok(right / total >= 0.95)
assert.ok(unsure / total <= 0.05)

// 4. A movement we have no examples of is "not sure" (never silently guessed).
let rejected = 0
for (let i = 0; i < 20; i++) {
  const p = person()
  const frames = Array.from({ length: 30 }, (_, k) =>
    S.frameFeatures({ hands: [{ label: 'Left', points: handAt(p.cx + noise(2) * p.unit, p.cy + noise(2) * p.unit, p.unit, 0.5) }], pose: p.pose }))
  if (S.recognise(S.resample(frames), examples).unsure) rejected += 1
}
console.log(`unknown movements: ${rejected}/20 marked unsure`)
assert.ok(rejected >= 18)
assert.deepEqual(S.recognise(a, []), { guesses: [], unsure: true })

// 5. Chosen signs become questions the records can answer.
const timeline = {
  groups: [
    { date: '2026-05-04', events: [{ event_type: 'lab_result', title: 'HbA1c (Glycated haemoglobin) 7.6 %', date: '2026-05-04', status: 'unverified' }] },
    { date: '2025-03-18', events: [{ event_type: 'lab_result', title: 'HbA1c (Glycated haemoglobin) 8.4 %', date: '2025-03-18', status: 'confirmed' }] },
  ],
  undated: [], counts: { events: 2, documents: 2, unverified: 1 }, generated_at: '',
}
assert.equal(S.buildSignQuestion(['what'], timeline), null)
assert.equal(S.buildSignQuestion(['medicine'], timeline), 'Which medicines are listed in my most recent document?')
assert.equal(S.buildSignQuestion(['diabetes', 'change'], timeline), 'How has my HbA1c changed over time?')
assert.equal(S.buildSignQuestion(['test'], timeline), 'What was my most recent HbA1c?')
assert.equal(S.buildSignQuestion(['test'], undefined), 'Which test results are in my records?')
assert.equal(S.buildSignQuestion(['doctor', 'when'], timeline), 'When was my follow-up advised?')
assert.match(S.EMERGENCY_PHRASES.chest_pain, /chest pain/)
console.log('sign recognition checks passed')
