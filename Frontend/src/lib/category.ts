// Categorical colour mapping across the full logo palette (blue→cyan→teal→green
// →violet). Used to tell fact/event TYPES apart at a glance — never to signal that
// a value is good or bad (that rule still holds for lab results).

export type BadgeToneName =
  | 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'cyan' | 'teal' | 'violet'

interface CategoryStyle {
  tone: BadgeToneName
  dot: string // hex for timeline node dots
  grad: string // tailwind bg-* gradient class for icon chips
}

export const CATEGORY: Record<string, CategoryStyle> = {
  document: { tone: 'brand', dot: '#0B3B8C', grad: 'bg-grad-blue' },
  medication: { tone: 'info', dot: '#0284F7', grad: 'bg-grad-blue' },
  lab_result: { tone: 'cyan', dot: '#06B6D4', grad: 'bg-grad-cyan' },
  condition: { tone: 'teal', dot: '#0F766E', grad: 'bg-grad-teal' },
  allergy: { tone: 'warn', dot: '#D97706', grad: 'bg-grad-green' },
  procedure: { tone: 'violet', dot: '#5B46C9', grad: 'bg-grad-violet' },
  vital_sign: { tone: 'teal', dot: '#0F766E', grad: 'bg-grad-teal' },
  follow_up: { tone: 'violet', dot: '#5B46C9', grad: 'bg-grad-violet' },
  instruction: { tone: 'neutral', dot: '#64748B', grad: 'bg-brand-gradient' },
}

export function categoryOf(type: string): CategoryStyle {
  return CATEGORY[type] ?? CATEGORY.instruction
}

// Glossary categories → tone.
export const GLOSSARY_TONE: Record<string, BadgeToneName> = {
  people_places: 'info',
  medicines: 'brand',
  tests: 'cyan',
  conditions: 'teal',
  communication: 'violet',
}

// Rotating gradients for the dashboard stat tiles.
export const TILE_GRADS = ['bg-grad-blue', 'bg-grad-cyan', 'bg-grad-teal', 'bg-grad-green']
