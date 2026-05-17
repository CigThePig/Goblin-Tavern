// Design tokens for runtime consumers. CSS variables in global.css are
// the source of truth for visual styling; this file exists for the few
// places JS needs token values (pressure color interpolation, motion
// timings, layout constants).

export const palette = {
  inkDeep: '#14100c',
  ink: '#1f1812',
  inkRaised: '#2a2018',
  parchment: '#e8dcc4',
  parchmentDim: '#c8bca0',
  ash: '#8a8170',
  candle: '#d4a460',
  candleSoft: '#8a6a3a',
  blood: '#a8413a',
  moss: '#6a8a4a',
  rust: '#b8632c',
  seal: '#5a2a2a',
} as const

export const motion = {
  fast: 150,
  base: 180,
  slow: 220,
} as const

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

/**
 * Map a 0–100 pressure value to a candle→rust→blood color stop.
 * Used by PressureRibbon to grade bar tint by severity.
 */
export function pressureColor(value: number): string {
  if (value < 30) return palette.candleSoft
  if (value < 50) return palette.candle
  if (value < 70) return palette.rust
  return palette.blood
}
