// Puts the MediaPipe files that sign-assisted questions need (DEC-28) under public/mediapipe/,
// so the browser loads them from this app and never from a third party at run time:
//   wasm/   copied from node_modules/@mediapipe/tasks-vision
//   models/ hand and pose landmark models, downloaded once from Google's model storage
// Runs before `npm run dev` and `npm run build`; safe to run again (skips what is there).
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'mediapipe')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const MODELS = {
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
}

mkdirSync(join(out, 'wasm'), { recursive: true })
mkdirSync(join(out, 'models'), { recursive: true })

for (const name of readdirSync(wasmSrc)) {
  const target = join(out, 'wasm', name)
  if (!existsSync(target) || statSync(target).size !== statSync(join(wasmSrc, name)).size) {
    copyFileSync(join(wasmSrc, name), target)
  }
}

let failed = false
for (const [name, url] of Object.entries(MODELS)) {
  const target = join(out, 'models', name)
  if (existsSync(target) && statSync(target).size > 100_000) continue
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length < 100_000) throw new Error('file too small')
    writeFileSync(target, data)
    console.log(`mediapipe: downloaded ${name} (${(data.length / 1e6).toFixed(1)} MB)`)
  } catch (err) {
    failed = true
    console.warn(`mediapipe: could not download ${name} (${err.message}). Sign questions will say the models are missing.`)
  }
}
if (!failed) console.log('mediapipe: files ready in public/mediapipe/')
