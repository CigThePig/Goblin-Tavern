export function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    throw new Error(`clamp: max (${max}) must be >= min (${min})`)
  }
  if (value < min) return min
  if (value > max) return max
  return value
}
