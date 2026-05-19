// Phase 119 / ISSUE-058 — MoreScreen smoke test.
//
// MoreScreen is a thin shell that vertically stacks four sections.
// Asserting the four section headings render proves the screen mounts
// and the children render under the expected wiring.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

const { default: MoreScreen } = await import(
  '../../../web/src/lib/screens/MoreScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('MoreScreen — smoke (Phase 119 / ISSUE-058)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all four sections (Settings, Saves, Help, About)', () => {
    render(MoreScreen, { props: { onreplaced: () => {} } })
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^saves$/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^help$/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^about$/i })).toBeTruthy()
  })
})
