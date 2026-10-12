// Recorded sign examples (DEC-28). Two sources:
//  - the team's sign pack, /signs/pack.json, recorded by a qualified ISL signer (shared);
//  - this browser's own examples, recorded in "Teach signs" (kept on this device only).
// Examples are hand and body point positions (numbers), never video.
import { FRAME_SIZE, SIGN_FRAMES, type SignExample } from './recognizer'
import { SIGN_BY_ID } from './vocabulary'

const KEY = 'mv.sign-examples.v1'

export interface SignPack {
  format: 'medivara-sign-pack'
  version: 1
  frame_size: number
  frames_per_sign: number
  examples: SignExample[]
}

function valid(ex: unknown): ex is SignExample {
  const e = ex as SignExample
  return Boolean(
    e && typeof e.label === 'string' && SIGN_BY_ID[e.label] && Array.isArray(e.frames) &&
      e.frames.length === SIGN_FRAMES && e.frames.every((f) => Array.isArray(f) && f.length === FRAME_SIZE),
  )
}

export function readLocalExamples(): SignExample[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : []
    return parsed.filter(valid)
  } catch {
    return []
  }
}

export function writeLocalExamples(examples: SignExample[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(examples))
    return true
  } catch {
    return false
  }
}

export function clearLocalExamples(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: nothing stored */
  }
}

export async function loadSignPack(): Promise<SignExample[]> {
  try {
    const res = await fetch('/signs/pack.json', { cache: 'no-cache' })
    if (!res.ok) return []
    const pack = (await res.json()) as SignPack
    if (pack.format !== 'medivara-sign-pack' || pack.frame_size !== FRAME_SIZE) return []
    return pack.examples.filter(valid)
  } catch {
    return []
  }
}

export function toPack(examples: SignExample[]): SignPack {
  return { format: 'medivara-sign-pack', version: 1, frame_size: FRAME_SIZE, frames_per_sign: SIGN_FRAMES, examples }
}
