// Isolated-sign recognition for sign-assisted questions (DEC-28, FR-064). Pure functions, no
// browser APIs: features from MediaPipe landmarks, splitting the stream into single signs,
// and matching a sign against recorded examples (dynamic time warping, nearest neighbour).
// It recognises only signs it has examples of, and says "not sure" rather than guess.

export interface Point {
  x: number
  y: number
}

export interface FrameInput {
  /** Hands seen in the frame: 21 landmarks each, with MediaPipe's handedness label. */
  hands: { label: 'Left' | 'Right'; points: Point[] }[]
  /** Pose landmarks (MediaPipe pose indices), or null when no body is seen. */
  pose: Point[] | null
}

export const FRAME_SIZE = 2 * (21 * 2 + 1) // two hand slots: 21 (x, y) points + a presence flag
export const SIGN_FRAMES = 24 // every sign is resampled to this many frames

const SHOULDER_L = 11
const SHOULDER_R = 12

/**
 * One frame as numbers, relative to the body: origin between the shoulders, unit = shoulder
 * width. So the same sign gives similar numbers wherever the person sits in the picture.
 * Returns null when no hand is visible.
 */
export function frameFeatures(frame: FrameInput): number[] | null {
  if (frame.hands.length === 0) return null
  let ox = 0.5
  let oy = 0.5
  let scale = 0.3
  const pose = frame.pose
  if (pose && pose[SHOULDER_L] && pose[SHOULDER_R]) {
    const l = pose[SHOULDER_L]
    const r = pose[SHOULDER_R]
    ox = (l.x + r.x) / 2
    oy = (l.y + r.y) / 2
    scale = Math.max(Math.hypot(l.x - r.x, l.y - r.y), 0.05)
  }
  const out: number[] = []
  for (const slot of ['Left', 'Right'] as const) {
    const hand = frame.hands.find((h) => h.label === slot)
    if (!hand || hand.points.length < 21) {
      out.push(...new Array(42).fill(0), 0)
      continue
    }
    for (const p of hand.points.slice(0, 21)) out.push((p.x - ox) / scale, (p.y - oy) / scale)
    out.push(1)
  }
  return out
}

/** Linear resampling of a sequence of frames to `n` frames. */
export function resample(frames: number[][], n = SIGN_FRAMES): number[][] {
  if (frames.length === 0) return []
  if (frames.length === 1) return Array.from({ length: n }, () => [...frames[0]])
  const out: number[][] = []
  for (let i = 0; i < n; i++) {
    const t = (i * (frames.length - 1)) / (n - 1)
    const a = Math.floor(t)
    const b = Math.min(a + 1, frames.length - 1)
    const w = t - a
    out.push(frames[a].map((v, k) => v * (1 - w) + frames[b][k] * w))
  }
  return out
}

/**
 * Splits the frame stream into signs: a sign starts when a hand appears and ends when no
 * hand has been seen for `gapFrames` frames (hands lowered) or after `maxFrames`.
 */
export class SignSegmenter {
  private frames: number[][] = []
  private missing = 0

  constructor(
    private readonly minFrames = 8,
    private readonly gapFrames = 10,
    private readonly maxFrames = 120,
  ) {}

  /** Feed one frame (null = no hand). Returns a finished sign, resampled, or null. */
  push(features: number[] | null): number[][] | null {
    if (features) {
      this.frames.push(features)
      this.missing = 0
      if (this.frames.length >= this.maxFrames) return this.finish()
      return null
    }
    if (this.frames.length === 0) return null
    this.missing += 1
    return this.missing >= this.gapFrames ? this.finish() : null
  }

  get collecting(): boolean {
    return this.frames.length > 0
  }

  reset(): void {
    this.frames = []
    this.missing = 0
  }

  private finish(): number[][] | null {
    const frames = this.frames
    this.reset()
    return frames.length >= this.minFrames ? resample(frames) : null
  }
}

function frameDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum / a.length)
}

/** Dynamic time warping distance, normalised by path length, within a Sakoe-Chiba band. */
export function dtw(a: number[][], b: number[][], band = 6): number {
  const n = a.length
  const m = b.length
  const INF = Number.POSITIVE_INFINITY
  let prev = new Array<number>(m + 1).fill(INF)
  let prevLen = new Array<number>(m + 1).fill(0)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1).fill(INF)
    const curLen = new Array<number>(m + 1).fill(0)
    const lo = Math.max(1, i - band)
    const hi = Math.min(m, i + band)
    for (let j = lo; j <= hi; j++) {
      const cost = frameDistance(a[i - 1], b[j - 1])
      let best = prev[j - 1]
      let len = prevLen[j - 1]
      if (prev[j] < best) { best = prev[j]; len = prevLen[j] }
      if (cur[j - 1] < best) { best = cur[j - 1]; len = curLen[j - 1] }
      cur[j] = best + cost
      curLen[j] = len + 1
    }
    prev = cur
    prevLen = curLen
  }
  return prevLen[m] ? prev[m] / prevLen[m] : INF
}

export interface SignExample {
  label: string
  frames: number[][]
}

export interface Guess {
  label: string
  distance: number
  /** 0..1, relative to the other candidates; not a probability of being right. */
  confidence: number
}

export interface Recognition {
  guesses: Guess[] // best first, up to 3
  /** True when even the best match is too far from every example: ask the user to sign again. */
  unsure: boolean
}

/** Distance above which a sign counts as "not one we know". Tuned on recorded examples. */
export const DEFAULT_MAX_DISTANCE = 0.35

export function recognise(sign: number[][], examples: SignExample[], maxDistance = DEFAULT_MAX_DISTANCE): Recognition {
  const best = new Map<string, number>()
  for (const ex of examples) {
    const d = dtw(sign, ex.frames)
    if (d < (best.get(ex.label) ?? Number.POSITIVE_INFINITY)) best.set(ex.label, d)
  }
  const ranked = [...best.entries()].sort((x, y) => x[1] - y[1]).slice(0, 3)
  if (ranked.length === 0) return { guesses: [], unsure: true }
  const weights = ranked.map(([, d]) => Math.exp(-d / 0.05))
  const total = weights.reduce((s, w) => s + w, 0) || 1
  const guesses = ranked.map(([label, distance], i) => ({ label, distance, confidence: weights[i] / total }))
  return { guesses, unsure: guesses[0].distance > maxDistance }
}
