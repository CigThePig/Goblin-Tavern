import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { Registry } from '../../src/sim/registries/Registry'

// Phase 22 §"Required Tests" — verify the new `src/sim/content/*`
// structure is in place, barrels load without throwing, registries use
// the existing `Registry<T>` utility, no UI/runtime libraries leak in,
// and no card folders were introduced.

const CONTENT_ROOT = resolve(__dirname, '../../src/sim/content')

const CONTENT_DOMAINS = [
  'naming',
  'cultures',
  'factions',
  'npc',
  'suppliers',
  'tavern',
  'events',
  'text',
] as const

describe('Phase 22 content folder structure', () => {
  it('creates src/sim/content/ with the expected domain folders', () => {
    expect(existsSync(CONTENT_ROOT)).toBe(true)
    for (const domain of CONTENT_DOMAINS) {
      const dir = join(CONTENT_ROOT, domain)
      expect(existsSync(dir), `missing folder: ${domain}`).toBe(true)
      expect(statSync(dir).isDirectory()).toBe(true)
    }
  })

  it('gives every content domain an index.ts barrel', () => {
    for (const domain of CONTENT_DOMAINS) {
      const barrel = join(CONTENT_ROOT, domain, 'index.ts')
      expect(existsSync(barrel), `missing barrel: ${domain}/index.ts`).toBe(true)
    }
  })

  it('includes the required type and registry files per domain', () => {
    const expectedFiles: Record<string, string[]> = {
      naming: ['nameTypes.ts', 'namingProfiles.ts', 'nameGenerator.ts'],
      cultures: ['cultureTypes.ts', 'cultureRegistry.ts'],
      factions: ['factionTypes.ts', 'factionRegistry.ts'],
      npc: ['npcTypes.ts', 'npcFactory.ts'],
      suppliers: ['supplierTypes.ts', 'supplierRegistry.ts'],
      tavern: ['atmosphereTypes.ts', 'upgradeTypes.ts'],
      events: ['eventTypes.ts', 'seasonalEventRegistry.ts', 'localEventRegistry.ts'],
      text: ['textIngredientTypes.ts', 'descriptors.ts'],
    }
    for (const [domain, files] of Object.entries(expectedFiles)) {
      for (const file of files) {
        const path = join(CONTENT_ROOT, domain, file)
        expect(existsSync(path), `missing file: ${domain}/${file}`).toBe(true)
      }
    }
  })
})

describe('Phase 22 barrels import cleanly', () => {
  it('imports each content barrel without throwing', async () => {
    await expect(import('../../src/sim/content/naming/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/cultures/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/factions/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/npc/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/suppliers/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/tavern/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/events/index')).resolves.toBeDefined()
    await expect(import('../../src/sim/content/text/index')).resolves.toBeDefined()
  })
})

describe('Phase 22 registries use the shared Registry utility', () => {
  it('cultureRegistry is a Registry instance and starts empty', async () => {
    const { cultureRegistry } = await import(
      '../../src/sim/content/cultures/cultureRegistry'
    )
    expect(cultureRegistry).toBeInstanceOf(Registry)
    expect(cultureRegistry.all()).toEqual([])
  })

  it('factionRegistry is a Registry instance and starts empty', async () => {
    const { factionRegistry } = await import(
      '../../src/sim/content/factions/factionRegistry'
    )
    expect(factionRegistry).toBeInstanceOf(Registry)
    expect(factionRegistry.all()).toEqual([])
  })

  it('supplierRegistry is a Registry instance and starts empty', async () => {
    const { supplierRegistry } = await import(
      '../../src/sim/content/suppliers/supplierRegistry'
    )
    expect(supplierRegistry).toBeInstanceOf(Registry)
    expect(supplierRegistry.all()).toEqual([])
  })

  it('seasonalEventRegistry is a Registry instance and starts empty', async () => {
    const { seasonalEventRegistry } = await import(
      '../../src/sim/content/events/seasonalEventRegistry'
    )
    expect(seasonalEventRegistry).toBeInstanceOf(Registry)
    expect(seasonalEventRegistry.all()).toEqual([])
  })

  it('localEventRegistry is a Registry instance and starts empty', async () => {
    const { localEventRegistry } = await import(
      '../../src/sim/content/events/localEventRegistry'
    )
    expect(localEventRegistry).toBeInstanceOf(Registry)
    expect(localEventRegistry.all()).toEqual([])
  })

  it('namingProfileRegistry is a Registry instance and starts empty until a starter set is registered', async () => {
    const { namingProfileRegistry } = await import(
      '../../src/sim/content/naming/namingProfiles'
    )
    expect(namingProfileRegistry).toBeInstanceOf(Registry)
    expect(namingProfileRegistry.all()).toEqual([])
  })
})

// Collect every .ts file under src/sim/content for the import-policy
// and card-folder bans below.
function collectContentFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    const s = statSync(full)
    if (s.isDirectory()) {
      out.push(...collectContentFiles(full))
    } else if (entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

const FORBIDDEN_IMPORT_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'react', regex: /from\s+['"]react['"]/ },
  { name: 'react-dom', regex: /from\s+['"]react-dom['"]/ },
  { name: 'phaser', regex: /from\s+['"]phaser['"]/ },
  { name: 'pixi.js', regex: /from\s+['"]pixi\.js['"]/ },
  { name: 'three', regex: /from\s+['"]three['"]/ },
  { name: 'dom api: document', regex: /\bdocument\s*\./ },
  { name: 'dom api: window', regex: /\bwindow\s*\./ },
  { name: 'browser storage: localStorage', regex: /\blocalStorage\b/ },
  { name: 'browser storage: sessionStorage', regex: /\bsessionStorage\b/ },
  { name: 'browser storage: indexedDB', regex: /\bindexedDB\b/ },
]

describe('Phase 22 content files stay pure and headless', () => {
  const files = collectContentFiles(CONTENT_ROOT)

  it('finds at least one content file', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('does not import React, DOM, Phaser, or browser-storage APIs', () => {
    const violations: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const { name, regex } of FORBIDDEN_IMPORT_PATTERNS) {
        if (regex.test(text)) {
          violations.push(`${file} uses ${name}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})

describe('Phase 22 does not introduce card content', () => {
  const CARD_FORBIDDEN_NAMES = [
    'cards',
    'card',
    'deck',
    'decks',
    'cardDeck',
    'cardDecks',
    'cardPro se',
    'cardUi',
    'cardUI',
  ]

  it('has no card/deck/cardUI folder anywhere under src/sim/content', () => {
    const offending: string[] = []
    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const s = statSync(full)
        if (s.isDirectory()) {
          if (CARD_FORBIDDEN_NAMES.includes(entry)) {
            offending.push(full)
          }
          walk(full)
        }
      }
    }
    walk(CONTENT_ROOT)
    expect(offending).toEqual([])
  })

  it('has no card/deck/cardUI folder under src/sim', () => {
    // Phase 22 forbade card folders anywhere under src/. Phase 88
    // explicitly introduces the card layer at `src/cards/` per
    // `cards-contract.md` and `game-loop-and-ux.md §10`, so the
    // `src` root scan is removed. The rule still stands inside the
    // simulation: cards must NOT live under `src/sim/` because the
    // simulation never imports cards (cards consume sim, not the
    // other way around).
    const offending: string[] = []
    const root = resolve(__dirname, '../../src/sim')
    for (const entry of readdirSync(root)) {
      if (CARD_FORBIDDEN_NAMES.includes(entry)) {
        offending.push(join(root, entry))
      }
    }
    expect(offending).toEqual([])
  })
})

describe('Phase 22 type surfaces match the plan', () => {
  it('cultures reference naming profile ids', async () => {
    // Compile-time-style check: the field exists on a sample literal.
    const { } = await import('../../src/sim/content/cultures/cultureTypes')
    // Phase 30 §30.1 extends the Phase 22 skeleton additively. The
    // Phase 22 fields still exist on the type; the new Phase 30 fields
    // (description, conflictTags, defaultFamiliarity, defaultComfort,
    // defaultTension) are required and provided here.
    //
    // Expansion Phase 8 §8.2 adds three more (frictionWith, defaultTrust,
    // observanceHonouredBy) on the same additive terms — nothing is renamed,
    // so this sample keeps its original shape and gains the new fields.
    const sample: import('../../src/sim/content/cultures/cultureTypes').CultureDefinition = {
      id: 'sample',
      label: 'Sample',
      tags: [],
      namingProfileId: 'goblin_common',
      preferredStockTags: [],
      dislikedTags: [],
      importantCalendarTags: [],
      description: 'Sample culture for the type-surface check.',
      conflictTags: [],
      defaultFamiliarity: 50,
      defaultComfort: 50,
      defaultTension: 50,
      frictionWith: [],
      defaultTrust: 50,
      observanceHonouredBy: [],
    }
    expect(sample.namingProfileId).toBe('goblin_common')
  })

  it('NpcIdentity carries a GeneratedName', async () => {
    const npc: import('../../src/sim/content/npc/npcTypes').NpcIdentity = {
      id: 'npc_1',
      kind: 'regular',
      name: {
        display: 'Nib Cracket',
        profileId: 'goblin_common',
        parts: { given: 'Nib', family: 'Cracket' },
        patternId: 'given_family',
        generatedBy: 'test',
      },
      tags: [],
    }
    expect(npc.name.display).toBe('Nib Cracket')
  })

  it('TextIngredient kinds cover staff/regular/supplier/faction/culture and more', async () => {
    const kinds: Array<
      import('../../src/sim/content/text/textIngredientTypes').TextIngredientKind
    > = [
      'staff',
      'regular',
      'supplier',
      'faction',
      'culture',
      'customer_group',
      'area',
      'stock',
      'calendar_tag',
      'market_condition',
      'memory',
      'cause',
      'pressure',
    ]
    expect(new Set(kinds).size).toBe(kinds.length)
  })
})
