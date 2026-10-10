// Service + AI status (API-01). Mutable so a dev toggle can simulate the AI going
// down (degraded-mode drill, FR-040). Default: AI available in demo mode.
import type { HealthResponse } from '../api/types'

export const health: HealthResponse = {
  status: 'ok',
  service: 'medivara-api (dummy-data)',
  contract_version: '1.0.0',
  demo_mode: true,
  ai: {
    mode: 'live',
    available: true,
    model: 'google/gemini-2.5-flash',
  },
  time: new Date().toISOString(),
}

export function setAiMode(mode: HealthResponse['ai']['mode']) {
  health.ai.mode = mode
  health.ai.available = mode === 'live'
  health.ai.model = mode === 'off' ? null : 'google/gemini-2.5-flash'
}
