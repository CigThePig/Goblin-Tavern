import { Registry } from '../../registries/Registry'

// Expansion Phase 7 §7.1 — who will lend the tavern money.
//
// Lenders are a REGISTRY rather than a hardcoded list, per architectural
// rule 4: "borrow" is an expandable concept and a later phase (or a faction
// with a grudge) should be able to add one without touching the finance
// module. Their identities are fixed content, not generated names, so this
// registry stays inside architectural rule 8 — nothing here is rolled, and
// the per-run standing that DOES vary lives in `modules.finance.lenders`.
//
// The three shipped lenders are deliberately different bargains rather than
// three prices for the same bargain: the guild is cheap, slow to approve and
// unforgiving; the merchant is quick and dear; the goblin will lend to
// anybody and takes it out of the till when you are late. A player who can
// only tell them apart by their fee has no decision to make.

export type LenderDefinition = {
  id: string
  label: string
  description: string
  /** Flat fee on the principal, as a fraction. Captured at disbursement. */
  feeRate: number
  /** Most this lender will advance in one loan, before standing adjusts it. */
  maxPrincipal: number
  minPrincipal: number
  /** Days between instalments. */
  periodDays: number
  instalmentCount: number
  /** Standing (0–100) the tavern needs before this lender will deal. */
  standingRequired: number
  /**
   * How hard the lender comes after a defaulted loan.
   *
   * `seizure` takes coin from the till on a collections beat; `refusal`
   * simply stops lending and lets the debt sit. Both are real consequences
   * that change what the player can do next — neither is a pressure nudge,
   * which §5 lists as a fail condition.
   */
  collections: 'seizure' | 'refusal'
  /** Fraction of the outstanding balance a seizure takes per collections beat. */
  seizureFraction: number
  /** Days of refusal after a default before the lender will talk again. */
  refusalDays: number
  tags: string[]
}

export const lenderRegistry = new Registry<LenderDefinition>()

const STARTER_LENDERS: LenderDefinition[] = [
  {
    id: 'coin_hall',
    label: 'The Coin Hall',
    description:
      'The town chapter of the moneylenders. Cheap, patient, and it writes everything down.',
    feeRate: 0.12,
    minPrincipal: 60,
    maxPrincipal: 400,
    periodDays: 7,
    instalmentCount: 4,
    // The one lender with a bar to clear. A tavern nobody has heard of, or
    // one that has already defaulted, is exactly who the Coin Hall exists
    // not to lend to.
    standingRequired: 45,
    collections: 'refusal',
    seizureFraction: 0,
    refusalDays: 60,
    tags: ['guild', 'cheap', 'strict'],
  },
  {
    id: 'merchant_syndicate',
    label: 'The Merchant Syndicate',
    description:
      'Road merchants with spare coin. They will lend today and expect it back soon.',
    feeRate: 0.22,
    minPrincipal: 40,
    maxPrincipal: 220,
    periodDays: 5,
    instalmentCount: 3,
    standingRequired: 25,
    collections: 'refusal',
    seizureFraction: 0,
    refusalDays: 30,
    tags: ['merchant', 'fast'],
  },
  {
    id: 'grimwick',
    label: 'Grimwick the Obliging',
    description:
      'Lends to anyone, asks nothing, and helps himself to the till when you are late.',
    feeRate: 0.35,
    minPrincipal: 20,
    maxPrincipal: 140,
    periodDays: 4,
    instalmentCount: 3,
    standingRequired: 0,
    collections: 'seizure',
    seizureFraction: 0.35,
    refusalDays: 14,
    tags: ['informal', 'dangerous', 'goblin'],
  },
]

let initialized = false

export function ensureRequiredLendersRegistered(): void {
  if (initialized) return
  for (const lender of STARTER_LENDERS) lenderRegistry.register(lender)
  initialized = true
}

export function listLenders(): LenderDefinition[] {
  ensureRequiredLendersRegistered()
  return lenderRegistry.all()
}

export function getLenderDefinition(id: string): LenderDefinition | undefined {
  ensureRequiredLendersRegistered()
  return lenderRegistry.has(id) ? lenderRegistry.get(id) : undefined
}

/**
 * The lender the response-card `borrow` choice deals with.
 *
 * The card offers a hurried, unsecured loan at the moment the rent is due,
 * which is exactly Grimwick's business. Naming it here rather than inside
 * the issue generator keeps the card from inventing a counterparty the
 * finance module has never heard of.
 */
export const INFORMAL_LENDER_ID = 'grimwick'
