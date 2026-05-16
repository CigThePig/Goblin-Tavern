import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { ensureRequiredFactionsRegistered, factionRegistry } from '../../src/sim/content/factions/factionRegistry'
import {
  ensureRequiredNotableNpcProfilesRegistered,
  notableNpcProfileRegistry,
} from '../../src/sim/content/npc/notableNpcProfiles'

// Phase 82 — ISSUE-042: niche factions carry NPC profiles.
//
// Before this phase, the three niche factions added in ISSUE-012
// (smugglers_ring, silvermark_house, rival_taverns) had no notable
// NPC representation. Pressure chains and card-flavour lookups that
// targeted those factions could only resolve faction-level refs.

describe('Phase 82 / ISSUE-042 — niche factions carry notable NPC profiles', () => {
  it('every registered faction has ≥1 NPC profile pointing at it', () => {
    ensureRequiredFactionsRegistered()
    ensureRequiredNotableNpcProfilesRegistered()
    const factionIds = factionRegistry.all().map((f) => f.id)
    const factionsWithNpc = new Set<string>()
    for (const profile of notableNpcProfileRegistry.all()) {
      if (profile.factionId !== undefined) {
        factionsWithNpc.add(profile.factionId)
      }
    }
    for (const id of factionIds) {
      expect(factionsWithNpc.has(id)).toBe(true)
    }
  })

  it('each of the three niche factions has a profile by name', () => {
    ensureRequiredNotableNpcProfilesRegistered()
    const lookup = (factionId: string) =>
      notableNpcProfileRegistry
        .all()
        .find((p) => p.factionId === factionId)
    expect(lookup('smugglers_ring')).toBeDefined()
    expect(lookup('silvermark_house')).toBeDefined()
    expect(lookup('rival_taverns')).toBeDefined()
  })

  it('day-zero state seeds the three new NPCs into world.notableNpcs', () => {
    const state = createInitialTavernState()
    const npcs = Object.values(state.world.notableNpcs)
    const smuggler = npcs.find((n) => n.id === 'notable_npc_smuggler_contact')
    const silvermark = npcs.find(
      (n) => n.id === 'notable_npc_silvermark_factor',
    )
    const rival = npcs.find((n) => n.id === 'notable_npc_rival_tavern_keeper')
    expect(smuggler).toBeDefined()
    expect(silvermark).toBeDefined()
    expect(rival).toBeDefined()
    expect(smuggler!.factionId).toBe('smugglers_ring')
    expect(silvermark!.factionId).toBe('silvermark_house')
    expect(rival!.factionId).toBe('rival_taverns')
    // Each gets a generated display name.
    expect(smuggler!.name.display.length).toBeGreaterThan(0)
    expect(silvermark!.name.display.length).toBeGreaterThan(0)
    expect(rival!.name.display.length).toBeGreaterThan(0)
  })

  it('niche-faction NPC profiles use plausible naming + culture pairings', () => {
    ensureRequiredNotableNpcProfilesRegistered()
    const smuggler = notableNpcProfileRegistry
      .all()
      .find((p) => p.factionId === 'smugglers_ring')!
    expect(smuggler.namingProfileId).toBe('goblin_common')
    expect(smuggler.cultureId).toBe('goblin_local')

    const silvermark = notableNpcProfileRegistry
      .all()
      .find((p) => p.factionId === 'silvermark_house')!
    expect(silvermark.namingProfileId).toBe('merchant_roadfolk')
    expect(silvermark.cultureId).toBe('merchant_roadfolk')

    const rival = notableNpcProfileRegistry
      .all()
      .find((p) => p.factionId === 'rival_taverns')!
    expect(rival.namingProfileId).toBe('human_town')
  })
})
