import { clamp } from '../utils/clamp'
import type {
  AreaState,
  AreaUpgradeState,
  CultureWorldState,
  FactionWorldState,
  LocalEventWorldState,
  NotableNpcWorldState,
  RegularWorldState,
  SocialRumourState,
  StockState,
  SupplierWorldState,
  TavernState,
  WorldState,
} from './TavernState'

// Phase 6 §6.4 — Normalization helpers.
//
// These are intentionally explicit: callers reach for them when slight
// numeric drift is expected (a small overshoot from an arithmetic step,
// for instance). `validateState` does NOT silently apply them — invalid
// values still fail validation. See `phases-06-10.md` §6.4 for the
// "do not hide bugs" guidance.

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return clamp(value, 0, 100)
}

export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

// Phase 28 §28.1 — repair pre-Phase-28 saves that lack the new identity
// fields. Missing arrays default to `[]` and missing upgrade records
// default to `{}`. This keeps `validateState` from rejecting older saves
// the moment Phase 28 lands; new state created via `createInitialTavernState`
// is already populated by the area registry.
export function normalizeArea(area: AreaState): AreaState {
  const rawUpgrades = (area as Partial<AreaState>).upgrades ?? {}
  const upgrades: Record<string, AreaUpgradeState> = {}
  for (const [id, upgrade] of Object.entries(rawUpgrades)) {
    upgrades[id] = {
      ...upgrade,
      tags: upgrade?.tags ? [...upgrade.tags] : [],
    }
  }
  return {
    ...area,
    condition: clampPercent(area.condition),
    cleanliness: clampPercent(area.cleanliness),
    mess: clampPercent(area.mess),
    damage: clampPercent(area.damage),
    smell: clampPercent(area.smell),
    risk: clampPercent(area.risk),
    traits: area.traits ? [...area.traits] : [],
    atmosphere: area.atmosphere ? [...area.atmosphere] : [],
    upgrades,
  }
}

export function normalizeStockItem(item: StockState): StockState {
  return {
    ...item,
    quantity: clampNonNegative(item.quantity),
    quality: clampPercent(item.quality),
    spoilage: clampPercent(item.spoilage),
  }
}

// Phase 25 §"Normalization" — clamp the numeric meter fields on world
// records to [0, 100]. This does NOT invent missing entries or fill in
// generated names; it only repairs slight numeric drift on existing
// records. Normalization must never create simulation truth.
function normalizeCulture(culture: CultureWorldState): CultureWorldState {
  return {
    ...culture,
    familiarity: clampPercent(culture.familiarity),
    comfort: clampPercent(culture.comfort),
    tension: clampPercent(culture.tension),
  }
}

function normalizeFaction(faction: FactionWorldState): FactionWorldState {
  return {
    ...faction,
    relationship: clampPercent(faction.relationship),
    influence: clampPercent(faction.influence),
    trust: clampPercent(faction.trust),
    fear: clampPercent(faction.fear),
  }
}

function normalizeSupplier(supplier: SupplierWorldState): SupplierWorldState {
  return {
    ...supplier,
    reliability: clampPercent(supplier.reliability),
    relationship: clampPercent(supplier.relationship),
    debtTolerance: clampPercent(supplier.debtTolerance),
  }
}

function normalizeRegular(regular: RegularWorldState): RegularWorldState {
  return {
    ...regular,
    loyalty: clampPercent(regular.loyalty),
    irritation: clampPercent(regular.irritation),
    visits: clampNonNegative(regular.visits),
  }
}

function normalizeNotableNpc(npc: NotableNpcWorldState): NotableNpcWorldState {
  return { ...npc }
}

function normalizeLocalEvent(event: LocalEventWorldState): LocalEventWorldState {
  return {
    ...event,
    intensity: clampPercent(event.intensity),
  }
}

function normalizeSocialRumour(rumour: SocialRumourState): SocialRumourState {
  return {
    ...rumour,
    strength: clampPercent(rumour.strength),
  }
}

export function normalizeWorldState(world: WorldState): WorldState {
  const cultures: Record<string, CultureWorldState> = {}
  for (const [id, culture] of Object.entries(world.cultures)) {
    cultures[id] = normalizeCulture(culture)
  }
  const factions: Record<string, FactionWorldState> = {}
  for (const [id, faction] of Object.entries(world.factions)) {
    factions[id] = normalizeFaction(faction)
  }
  const suppliers: Record<string, SupplierWorldState> = {}
  for (const [id, supplier] of Object.entries(world.suppliers)) {
    suppliers[id] = normalizeSupplier(supplier)
  }
  const regulars: Record<string, RegularWorldState> = {}
  for (const [id, regular] of Object.entries(world.regulars)) {
    regulars[id] = normalizeRegular(regular)
  }
  const notableNpcs: Record<string, NotableNpcWorldState> = {}
  for (const [id, npc] of Object.entries(world.notableNpcs)) {
    notableNpcs[id] = normalizeNotableNpc(npc)
  }
  const localEvents: Record<string, LocalEventWorldState> = {}
  for (const [id, event] of Object.entries(world.localEvents)) {
    localEvents[id] = normalizeLocalEvent(event)
  }
  const socialRumours: Record<string, SocialRumourState> = {}
  for (const [id, rumour] of Object.entries(world.socialRumours)) {
    socialRumours[id] = normalizeSocialRumour(rumour)
  }
  return {
    ...world,
    cultures,
    factions,
    suppliers,
    regulars,
    notableNpcs,
    localEvents,
    socialRumours,
  }
}

export function normalizeTavernState(state: TavernState): TavernState {
  const areas: Record<string, AreaState> = {}
  for (const [id, area] of Object.entries(state.areas)) {
    areas[id] = normalizeArea(area)
  }
  const stock: Record<string, StockState> = {}
  for (const [id, item] of Object.entries(state.stock)) {
    stock[id] = normalizeStockItem(item)
  }
  return { ...state, areas, stock, world: normalizeWorldState(state.world) }
}
