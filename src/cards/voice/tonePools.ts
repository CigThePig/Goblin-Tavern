// Phase 95 — Voice & Identity Pass.
//
// Fragment pools keyed by tone hint. Card templates declare toneHints
// (`['urgent', 'visceral']`, …) and issue-seed generators emit their
// own toneHints; the composer in `./composer.ts` looks up these pools
// by tone, picks deterministic fragments via FNV-1a hash of the seed
// id, and folds them into title / body output.
//
// Rules:
//   - Fragments are ≤ 4 words each. They are *adjectives*,
//     *connectors*, or *closing flavour* — never named actors, never
//     numeric values. The composer never invents facts; it only picks
//     among ways to phrase the facts the seed already carries.
//   - Pool entries are frozen const arrays so callers cannot mutate
//     the source vocabulary.
//   - Mirrors the pattern in `src/sim/content/text/descriptors.ts`
//     (Phase 85): a tiny vocabulary that the card layer composes
//     against, not card prose.

export type TonePool = {
  /** Adjective prefixes for the title or first body line. */
  prefixAdjectives: readonly string[]
  /** Short connector phrases that can lead a body line. */
  bodyConnectors: readonly string[]
  /** Tail-of-line flavour fragments — kept tiny to honour word caps. */
  closingFlavour: readonly string[]
}

const EMPTY_POOL: TonePool = {
  prefixAdjectives: [],
  bodyConnectors: [],
  closingFlavour: [],
}

/**
 * Tones in active use across the card templates and issue-seed
 * generators (see `src/cards/templates/*.ts` and
 * `src/sim/modules/issues/*Generators.ts`). Tones the composer
 * doesn't recognise are silently ignored — they don't break
 * composition, the pool just contributes nothing.
 */
export const TONE_POOLS: Readonly<Record<string, TonePool>> = Object.freeze({
  urgent: {
    prefixAdjectives: ['Sudden', 'Pressing', 'Unignorable', 'Spiking'],
    bodyConnectors: ['right now', 'this very service', 'before it spreads'],
    closingFlavour: ['no time to dawdle', 'the room knows'],
  },
  visceral: {
    prefixAdjectives: ['Acrid', 'Sour', 'Pungent', 'Rank'],
    bodyConnectors: ['the smell carries', 'the air thickens'],
    closingFlavour: ['eyes water', 'noses wrinkle'],
  },
  internal: {
    prefixAdjectives: ['Quiet', 'Whispered', 'Backroom', 'Side-pulled'],
    bodyConnectors: ['off the floor', 'away from patrons'],
    closingFlavour: ['no one else hears', 'kept between you'],
  },
  personal: {
    prefixAdjectives: ['Heartfelt', 'Plain-spoken', 'Earnest'],
    bodyConnectors: ['meeting your eye', 'not joking now'],
    closingFlavour: ['this matters to them', 'said and meant'],
  },
  strategic: {
    prefixAdjectives: ['Cool-headed', 'Long-view', 'Balanced'],
    bodyConnectors: ['weighing the month', 'across the ledger'],
    closingFlavour: ['the shape is clear', 'the trend stands'],
  },
  reflective: {
    prefixAdjectives: ['Quiet', 'Settled', 'Considered'],
    bodyConnectors: ['looking back', 'as the dust settles'],
    closingFlavour: ['a pattern emerges', 'the week reads plain'],
  },
  transactional: {
    prefixAdjectives: ['Brisk', 'Clear-eyed', 'Cards-up'],
    bodyConnectors: ['palm out', 'numbers on the bar'],
    closingFlavour: ['a deal on the table', 'they want an answer'],
  },
  market: {
    prefixAdjectives: ['Shrewd', 'Worldly', 'Trader-keen'],
    bodyConnectors: ['the road brings', 'word from caravans'],
    closingFlavour: ['the market shifts', 'prices wobble'],
  },
  relational: {
    prefixAdjectives: ['Hopeful', 'Wary', 'Halfway'],
    bodyConnectors: ['between you two', 'across the table'],
    closingFlavour: ['trust hangs on it', 'the bond holds or breaks'],
  },
  social: {
    prefixAdjectives: ['Public', 'Talked-of', 'Charged'],
    bodyConnectors: ['the room watching', 'voices half-pitched'],
    closingFlavour: ['eyes flick', 'the floor leans in'],
  },
  delayed_risk: {
    prefixAdjectives: ['Looming', 'Slow-burn', 'Mounting'],
    bodyConnectors: ['it can wait', 'but not forever'],
    closingFlavour: ['the bill will come', 'time is the enemy'],
  },
  premises: {
    prefixAdjectives: ['Creaking', 'Weather-worn', 'Patched'],
    bodyConnectors: ['the building groans', 'beams settle'],
    closingFlavour: ['stone and timber tire', 'wear is plain'],
  },
  staff: {
    prefixAdjectives: ['Tired', 'Knotted', 'Stretched'],
    bodyConnectors: ['hands shaking', 'shoulders set'],
    closingFlavour: ['the apron knows', 'a long shift'],
  },
  customer: {
    prefixAdjectives: ['Loud', 'Bothered', 'Restless'],
    bodyConnectors: ['at your bar', 'across the room'],
    closingFlavour: ['the patron speaks', 'a drinker complains'],
  },
  violence: {
    prefixAdjectives: ['Rowdy', 'Edgy', 'Bristling'],
    bodyConnectors: ['fists half-clenched', 'a glance turns ugly'],
    closingFlavour: ['something will break', 'tempers fray'],
  },
  inspection: {
    prefixAdjectives: ['Official', 'Cold-eyed', 'Imminent'],
    bodyConnectors: ['ledger in hand', 'gloves on'],
    closingFlavour: ['the city watches', 'paper trails matter'],
  },
  arc: {
    prefixAdjectives: ['Long-running', 'Slow-built', 'Seasonal'],
    bodyConnectors: ['weeks in motion', 'building toward'],
    closingFlavour: ['a thread tightens', 'the season turns'],
  },
  policy: {
    prefixAdjectives: ['House-set', 'Standing', 'On the books'],
    bodyConnectors: ['the rule reads', 'as the rule has it'],
    closingFlavour: ['for now it stands', 'or the rule shifts'],
  },
  culture: {
    prefixAdjectives: ['Old-country', 'Custom-bound', 'Folk-kept'],
    bodyConnectors: ['as their people would', 'by their lights'],
    closingFlavour: ['respect or rupture', 'a way of doing'],
  },
  area: {
    prefixAdjectives: ['Lived-in', 'Crowded', 'Marked'],
    bodyConnectors: ['the corner of', 'in this part of the place'],
    closingFlavour: ['the spot has weight', 'the wood remembers'],
  },
  supplier: {
    prefixAdjectives: ['Road-tired', 'Hard-bargaining', 'Steady-handed'],
    bodyConnectors: ['from the supplier', 'with the wagon'],
    closingFlavour: ['the deal sits open', 'the line holds or snaps'],
  },
  regular: {
    prefixAdjectives: ['Familiar', 'Long-faced', 'Worn'],
    bodyConnectors: ['the usual seat', 'their corner'],
    closingFlavour: ['they noticed', 'they always notice'],
  },
  faction: {
    prefixAdjectives: ['Stiff-backed', 'Banner-aware', 'Watched-over'],
    bodyConnectors: ['representing the lot', 'with the colours on'],
    closingFlavour: ['the house behind them', 'the order behind them'],
  },
  rumour: {
    prefixAdjectives: ['Whispered', 'Half-told', 'Spreading'],
    bodyConnectors: ['word travels', 'they say'],
    closingFlavour: ['true or not', 'the talk persists'],
  },
  high_demand: {
    prefixAdjectives: ['Sought-after', 'Sold-out', 'Asked-for'],
    bodyConnectors: ['demand thick', 'orders mounting'],
    closingFlavour: ['shelves thin', 'the want is real'],
  },
  warning: {
    prefixAdjectives: ['Cautionary', 'Telltale', 'Early'],
    bodyConnectors: ['a sign of', 'first hint of'],
    closingFlavour: ['act or wait', 'a window opens'],
  },
  identity: {
    prefixAdjectives: ['Tavern-deep', 'House-shaped', 'Banner-touching'],
    bodyConnectors: ['who you are', 'the place you keep'],
    closingFlavour: ['the keg knows itself', 'reputation has a shape'],
  },
  reputation: {
    prefixAdjectives: ['Talked-about', 'Spoken-of', 'Marked'],
    bodyConnectors: ['outside the door', 'past your tap'],
    closingFlavour: ['the word gets around', 'rumour follows'],
  },
  summary: {
    prefixAdjectives: ['Ledger-clean', 'Account-settled', 'Counted'],
    bodyConnectors: ['for the month', 'across twenty-eight days'],
    closingFlavour: ['the period closes', 'totals stand'],
  },
  monthly: {
    prefixAdjectives: ['Month-long', 'Twenty-eight-day', 'Closing'],
    bodyConnectors: ['by month-end', 'as the month settles'],
    closingFlavour: ['rent waits', 'the calendar turns'],
  },
  debt: {
    prefixAdjectives: ['Unpaid', 'Outstanding', 'Owed'],
    bodyConnectors: ['the slate carries', 'against your name'],
    closingFlavour: ['interest hums', 'collectors remember'],
  },
  pressure: {
    prefixAdjectives: ['Mounting', 'Tightening', 'Tensed'],
    bodyConnectors: ['something gives soon', 'the rope frays'],
    closingFlavour: ['it will not stay quiet', 'release or rupture'],
  },
  fatigue: {
    prefixAdjectives: ['Worn', 'Frayed', 'Bone-tired'],
    bodyConnectors: ['shifts piled', 'no day off'],
    closingFlavour: ['rest is overdue', 'they keep going anyway'],
  },
  atmosphere: {
    prefixAdjectives: ['Heavy', 'Charged', 'Settled'],
    bodyConnectors: ['the room reads', 'the place feels'],
    closingFlavour: ['mood follows', 'the floor remembers'],
  },
  tension: {
    prefixAdjectives: ['Wound', 'Edged', 'Hair-trigger'],
    bodyConnectors: ['a word could spark', 'an eye-line stiffens'],
    closingFlavour: ['glass could break', 'someone could swing'],
  },
  calendar: {
    prefixAdjectives: ['Date-pressed', 'Day-shaped', 'Season-bound'],
    bodyConnectors: ['the calendar leans', 'this date carries'],
    closingFlavour: ['the day has weight', 'time presses'],
  },
  backlash: {
    prefixAdjectives: ['Pushed-back', 'Stung', 'Crossed'],
    bodyConnectors: ['the room reacts', 'the floor pushes back'],
    closingFlavour: ['cost shows', 'the policy bites back'],
  },
  rowdy: {
    prefixAdjectives: ['Loud', 'Boisterous', 'Spirited'],
    bodyConnectors: ['voices climbing', 'shouts crossing'],
    closingFlavour: ['noise has weight', 'a quiet room is gone'],
  },
  kitchen: {
    prefixAdjectives: ['Steaming', 'Knife-quick', 'Heat-thick'],
    bodyConnectors: ['behind the cookline', 'over the flame'],
    closingFlavour: ['fire and grease', 'the pass keeps moving'],
  },
  risk: {
    prefixAdjectives: ['Sharp-edged', 'Hazardous', 'Walking-the-line'],
    bodyConnectors: ['a slip would', 'one wrong step'],
    closingFlavour: ['the price is paid late', 'the wound waits'],
  },
  maintenance: {
    prefixAdjectives: ['Cracked', 'Splintering', 'Sagging'],
    bodyConnectors: ['the timber', 'the fitting'],
    closingFlavour: ['repair or replace', 'time wears it'],
  },
  neutral: {
    prefixAdjectives: ['Plain', 'Routine', 'Workaday'],
    bodyConnectors: ['as days go', 'in the ordinary way'],
    closingFlavour: ['nothing remarkable', 'a usual matter'],
  },
})

/** Pool of opening lines for the day-screen empty-state beats. */
export const EMPTY_STATE_POOLS: Readonly<
  Record<'morning' | 'service' | 'closing' | 'header' | 'quiet', readonly string[]>
> = Object.freeze({
  morning: [
    'the tavern is quiet. no urgent matters this morning.',
    'a slow morning. nothing pressing yet.',
    'first light, no fires. coffee and a count.',
    'the floor is calm. the day waits.',
    'no one shouting yet. the morning belongs to you.',
  ],
  service: [
    'service runs quietly. nothing to react to.',
    'plates clear and mugs refill. no incidents.',
    'the floor moves itself. patrons drink, eat, leave.',
    'a working service, no fuss.',
    'service: routine. the rare gift.',
  ],
  closing: [
    'nothing left to resolve. close up?',
    'lamps low, doors barred. close the day?',
    'the last patron drained their cup. close?',
    'a clean close. ready when you are.',
    'all settled. lock the keg and call it.',
  ],
  header: [
    'closed and counted.',
    'the keg shutters for the night.',
    'lamps out, ledger in.',
    'doors barred, books squared.',
    'another day on the slate.',
  ],
  quiet: [
    'a quiet day. the tavern simply was.',
    'little to write down. the day passed.',
    'the kind of day a tavern needs more of.',
    'no fires, no songs. just the work.',
  ],
})
