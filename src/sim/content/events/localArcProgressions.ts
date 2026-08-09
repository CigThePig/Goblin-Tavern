import type { LocalArcProgression } from './localArcTypes'

// Expansion Phase 9 §9.2 — the progression half of the arc catalog.
//
// One entry per definition, keyed by definition id and attached in
// `localArcRegistry.ts`. Split out because these are CONTENT — goals,
// stages, the moves on both sides, and what the world keeps — and the
// registry file is already the place the arc's mechanical spine lives.
//
// §9.2 requires the catalog to collectively exercise eight materially
// different shapes. It does, and `shape` says which is which so that is a
// checkable property of the registry rather than a claim:
//
//   state_driven_crisis  sickness_in_the_quarter
//   faction_conflict     guild_turf_dispute
//   market_disruption    mushroom_blight
//   cultural_event       festival_approaching, miner_payday_boom
//   rival_move           rival_tavern_expansion
//   regulatory_event     inspection_campaign
//   recovery             back_from_the_brink
//   transformation       the_road_moves
//
// The five that existed before this phase are MIGRATED rather than
// duplicated, as §9.2 asks: the blight is still the blight, the inspection
// campaign is still the watch leaning on the house. What each gained is a
// goal it can fail, an owner who pushes back, and something the player can
// actually do about it.

export const ARC_PROGRESSIONS: Record<string, LocalArcProgression> = {
  // -------------------------------------------------------------------------
  // MARKET DISRUPTION — the supply of one good stops behaving
  // -------------------------------------------------------------------------
  mushroom_blight: {
    shape: 'market_disruption',
    goal: 'Keep the kitchen supplied and the cellar clean through the blight.',
    owner: { kind: 'supplier', pick: 'worst_relationship' },
    stages: [
      {
        id: 'first_bad_crates',
        readable: 'The first bad crates come in.',
        stakes: 'Nobody is sure yet how far it has spread.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 5 }],
        next: 'spreading',
        effects: [{ kind: 'issue_seed_tag', id: 'supplier_suspicious_goods' }],
      },
      {
        id: 'spreading',
        readable: 'The blight is through the whole quarter now.',
        stakes: 'Every crate has to be checked, and the cellar is where it takes hold.',
        legacyStage: 'rising',
        advanceWhen: [{ kind: 'days_in_stage', days: 7 }],
        branches: [
          {
            when: [
              { kind: 'goal_progress_at_least', value: 55 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'contained',
            readable: 'The house got ahead of it — clean stock, clean cellar.',
          },
          {
            when: [
              { kind: 'days_in_stage', days: 7 },
              { kind: 'area_cleanliness_below', id: 'cellar', threshold: 35 },
            ],
            toStage: 'in_the_cellar',
            readable: 'It has got into the cellar.',
          },
        ],
        next: 'in_the_cellar',
        timeoutDays: 21,
        onTimeout: 'in_the_cellar',
        effects: [
          { kind: 'pressure_delta', id: 'stock_shortage', amount: 8 },
          { kind: 'market_condition', id: 'cheap_mushrooms' },
        ],
      },
      {
        id: 'in_the_cellar',
        readable: 'It is in the cellar, and the kitchen is short.',
        stakes: 'Every day it stays is a day the food safety inspector would notice.',
        legacyStage: 'climax',
        advanceWhen: [{ kind: 'goal_progress_at_least', value: 70 }],
        branches: [
          {
            when: [
              { kind: 'goal_progress_at_least', value: 70 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'contained',
            readable: 'Scrubbed out and re-sourced. It is over.',
          },
        ],
        next: 'ruined_stores',
        timeoutDays: 24,
        onTimeout: 'ran_its_course',
        effects: [
          { kind: 'pressure_delta', id: 'stock_shortage', amount: 10 },
          { kind: 'pressure_delta', id: 'food_safety', amount: 8 },
        ],
      },
      {
        // An inconclusive ending. NO declared outcome, which is the point:
        // §9.2 asks for a compromise alongside success and failure, and an
        // arc that simply ran out of days should be judged on how it was
        // actually going rather than counted a loss by default. `computeOutcome`
        // reads the margin — a house that nearly got there ends level.
        id: 'ran_its_course',
        readable: 'The blight ran its course one way or another.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'contained',
        readable: 'The blight is contained.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'ruined_stores',
        readable: 'The stores are ruined and the quarter knows it.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'scrub_the_cellar',
        label: 'Scrub the cellar out',
        readable: 'The cellar was scrubbed down to the stone.',
        minuteCost: 120,
        goalProgress: 22,
        cooldownDays: 3,
      },
      {
        id: 'source_clean_stock',
        label: 'Pay over the odds for clean stock',
        readable: 'Clean stock was bought in at a price.',
        coinCost: 45,
        minuteCost: 60,
        goalProgress: 28,
        oppositionDelta: -8,
        cooldownDays: 5,
      },
      {
        id: 'blame_the_supplier',
        label: 'Put it on the supplier publicly',
        readable: 'The house told everybody whose crates it was.',
        minuteCost: 30,
        goalProgress: 12,
        // Cheap and it works a little, and they will not forget it.
        oppositionDelta: 18,
        maxUses: 1,
        stakesHook: 'arc_supplier_favour_owed',
      },
    ],
    opposingMoves: [
      {
        id: 'short_deliveries',
        readable: 'are sending less, and later',
        everyDays: 6,
        opposition: 9,
        domainMove: 'harden_terms',
      },
    ],
    outcomes: {
      success: {
        readable: 'The blight passed without the house losing a night to it.',
        effects: [{ kind: 'pressure_delta', id: 'stock_shortage', amount: -12 }],
        permanentChange: {
          kind: 'area_trait',
          areaId: 'cellar',
          trait: 'blight_hardened',
          readable: 'The cellar was rebuilt to keep the damp out for good.',
        },
        memoryId: 'arc_blight_contained',
        cooldownDays: 84,
      },
      compromise: {
        readable: 'The blight ran its course. The house got through it, barely.',
        effects: [{ kind: 'pressure_delta', id: 'stock_shortage', amount: -6 }],
        memoryId: 'arc_blight_endured',
      },
      failure: {
        readable: 'The stores rotted, and the quarter remembers which house served it.',
        effects: [
          { kind: 'pressure_delta', id: 'food_safety', amount: 12 },
          { kind: 'reputation_signal', id: 'filthy', amount: 6 },
        ],
        permanentChange: {
          kind: 'identity_known_for',
          label: 'the place with the bad mushrooms',
          readable: 'The house is known for the bad mushrooms now.',
        },
        memoryId: 'arc_blight_ruined',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // CULTURAL EVENT — an occasion with customs to meet or fumble
  // -------------------------------------------------------------------------
  festival_approaching: {
    shape: 'cultural_event',
    goal: 'Be the house the festival crowd chooses, and keep their customs.',
    owner: { kind: 'culture', pick: 'largest' },
    stages: [
      {
        id: 'word_goes_round',
        readable: 'Word of the festival goes round.',
        stakes: 'Whoever prepares now gets the crowd.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 4 }],
        next: 'preparations',
        effects: [{ kind: 'calendar_tag', id: 'festival_preparation' }],
      },
      {
        id: 'preparations',
        readable: 'Everybody is preparing.',
        stakes: 'Stock, room and goodwill all have to be ready at once.',
        legacyStage: 'rising',
        advanceWhen: [{ kind: 'days_in_stage', days: 6 }],
        next: 'the_night',
        timeoutDays: 14,
        onTimeout: 'the_night',
        effects: [
          { kind: 'pressure_delta', id: 'festival_readiness', amount: 6 },
          { kind: 'issue_seed_tag', id: 'festival_preparation' },
        ],
      },
      {
        id: 'the_night',
        readable: 'The festival is on.',
        stakes: 'One night decides how the whole quarter talks about this house.',
        legacyStage: 'climax',
        advanceWhen: [{ kind: 'days_in_stage', days: 3 }],
        branches: [
          {
            when: [
              { kind: 'days_in_stage', days: 3 },
              { kind: 'goal_progress_at_least', value: 50 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'the_house_they_name',
            readable: 'The festival crowd came here, and they will again.',
          },
          // Decisively lost: somebody else did the work and the house did
          // not. Anything short of that ends inconclusively below, so a
          // house that kept pace is not handed a loss it did not earn.
          {
            when: [
              { kind: 'opposition_at_least', value: 45 },
              { kind: 'goal_progress_below', value: 25 },
            ],
            toStage: 'passed_us_by',
            readable: 'The festival went to whoever actually prepared for it.',
          },
        ],
        next: 'a_night_like_any_other',
        timeoutDays: 6,
        onTimeout: 'a_night_like_any_other',
        effects: [{ kind: 'customer_group_modifier', id: 'merchants', tags: ['festival'] }],
      },
      {
        id: 'a_night_like_any_other',
        readable: 'The festival came and went.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'the_house_they_name',
        readable: 'This was the house the festival happened in.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'passed_us_by',
        readable: 'The festival happened somewhere else.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'lay_in_stock',
        label: 'Lay in stock for the festival',
        readable: 'The cellar was stocked for a big night.',
        coinCost: 40,
        minuteCost: 60,
        goalProgress: 24,
        cooldownDays: 4,
      },
      {
        id: 'keep_their_customs',
        label: 'Keep their customs properly',
        readable: 'The house kept the observance the way it should be kept.',
        minuteCost: 120,
        goalProgress: 30,
        oppositionDelta: -12,
        maxUses: 2,
      },
      {
        id: 'gouge_the_crowd',
        label: 'Charge the festival crowd what they will bear',
        readable: 'The house charged the festival crowd what it could.',
        minuteCost: 30,
        goalProgress: 16,
        oppositionDelta: 22,
        maxUses: 1,
        stakesHook: 'arc_exploit_backlash',
      },
    ],
    opposingMoves: [
      {
        id: 'another_house_courts_them',
        readable: 'are being courted by somebody else',
        everyDays: 5,
        opposition: 10,
        domainMove: 'talk',
      },
    ],
    outcomes: {
      success: {
        readable: 'The festival crowd made this their house.',
        effects: [{ kind: 'reputation_signal', id: 'cozy', amount: 4 }],
        permanentChange: {
          kind: 'customer_group_patronage',
          groupId: 'merchants',
          delta: 6,
          readable: 'The road merchants made a habit of stopping here.',
        },
        memoryId: 'arc_festival_won',
      },
      compromise: {
        readable: 'A decent festival. Nobody will tell stories about it.',
        memoryId: 'arc_festival_ordinary',
      },
      failure: {
        readable: 'The festival went to another house, and took the crowd with it.',
        effects: [{ kind: 'pressure_delta', id: 'regular_customer_loss', amount: 8 }],
        memoryId: 'arc_festival_lost',
      },
    },
    recurrence: 'recurring',
  },

  miner_payday_boom: {
    shape: 'cultural_event',
    goal: 'Take the payday trade without the room going up.',
    owner: { kind: 'customer_group', id: 'miners' },
    stages: [
      {
        id: 'coin_in_pockets',
        readable: 'The crews have been paid.',
        stakes: 'They will drink it somewhere.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 3 }],
        next: 'the_run',
        effects: [{ kind: 'customer_group_modifier', id: 'miners', tags: ['boom'] }],
      },
      {
        id: 'the_run',
        readable: 'A run of loud, profitable nights.',
        stakes: 'Good money, and one bad night away from a brawl.',
        legacyStage: 'active',
        advanceWhen: [{ kind: 'days_in_stage', days: 7 }],
        branches: [
          {
            when: [{ kind: 'pressure_above', id: 'violence', threshold: 65 }],
            toStage: 'it_went_up',
            readable: 'It went up, exactly as everybody said it would.',
          },
        ],
        next: 'spent_out',
        timeoutDays: 21,
        onTimeout: 'spent_out',
        effects: [
          { kind: 'pressure_delta', id: 'violence', amount: 7 },
          { kind: 'issue_seed_tag', id: 'rowdy_crowd' },
        ],
      },
      {
        // No declared outcome: a payday run that merely ended is judged on
        // how it actually went, so a house that only just held the room ends
        // level rather than being handed a win.
        id: 'spent_out',
        readable: 'The coin ran out and the crews went home.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'it_went_up',
        readable: 'The room went up, and the watch heard about it.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'put_on_extra_hands',
        label: 'Put extra hands on for the run',
        readable: 'Extra hands were on the floor for the payday run.',
        coinCost: 30,
        minuteCost: 60,
        goalProgress: 26,
        oppositionDelta: -10,
        cooldownDays: 4,
      },
      {
        id: 'water_the_last_round',
        label: 'Water the last round',
        readable: 'The last round went out watered.',
        minuteCost: 30,
        goalProgress: 18,
        oppositionDelta: 20,
        maxUses: 1,
      },
    ],
    opposingMoves: [
      {
        id: 'they_get_louder',
        readable: 'are getting louder every night',
        everyDays: 4,
        opposition: 8,
      },
    ],
    outcomes: {
      success: {
        readable: 'A good payday run, and the room held.',
        effects: [{ kind: 'reputation_signal', id: 'goblinAuthentic', amount: 3 }],
        memoryId: 'arc_payday_held',
      },
      compromise: {
        readable: 'The payday run was survived rather than enjoyed.',
        memoryId: 'arc_payday_survived',
      },
      failure: {
        readable: 'The payday run ended in a brawl the watch had to hear about.',
        effects: [
          { kind: 'pressure_delta', id: 'inspection', amount: 10 },
          { kind: 'reputation_signal', id: 'dangerous', amount: 6 },
        ],
        memoryId: 'arc_payday_brawl',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // REGULATORY EVENT — the watch running a campaign, not a single visit
  // -------------------------------------------------------------------------
  inspection_campaign: {
    shape: 'regulatory_event',
    goal: 'Come out of the campaign with the house on the right list.',
    owner: { kind: 'faction', id: 'town_watch' },
    stages: [
      {
        id: 'notices_posted',
        readable: 'Notices go up: the watch is going through the quarter.',
        stakes: 'Everybody has a few days to put their house in order.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 4 }],
        next: 'walkthroughs',
        effects: [{ kind: 'calendar_tag', id: 'inspection_campaign_active' }],
      },
      {
        id: 'walkthroughs',
        readable: 'The watch is walking through houses unannounced.',
        stakes: 'What they find now is what goes in the record.',
        legacyStage: 'rising',
        advanceWhen: [{ kind: 'days_in_stage', days: 8 }],
        branches: [
          {
            when: [
              { kind: 'days_in_stage', days: 8 },
              { kind: 'goal_progress_at_least', value: 45 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'commended',
            readable: 'The house came through clean.',
          },
        ],
        next: 'the_hearing',
        timeoutDays: 18,
        onTimeout: 'the_hearing',
        effects: [
          { kind: 'pressure_delta', id: 'inspection', amount: 10 },
          { kind: 'issue_seed_tag', id: 'inspection_pressure' },
        ],
      },
      {
        id: 'the_hearing',
        readable: 'The house has been called to answer for what they found.',
        stakes: 'An answer now, or an order the house will be living under.',
        legacyStage: 'climax',
        advanceWhen: [{ kind: 'goal_progress_at_least', value: 60 }],
        branches: [
          {
            when: [
              { kind: 'goal_progress_at_least', value: 60 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'commended',
            readable: 'The house answered well enough.',
          },
        ],
        next: 'on_the_list',
        timeoutDays: 12,
        onTimeout: 'a_warning_on_file',
        effects: [{ kind: 'pressure_delta', id: 'inspection', amount: 14 }],
      },
      {
        id: 'a_warning_on_file',
        readable: 'The campaign ended with the house on file, but not on the list.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'commended',
        readable: 'The house came out of the campaign well.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'on_the_list',
        readable: 'The house is on the watch’s list now.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'deep_clean_before_they_come',
        label: 'Deep-clean ahead of the walkthrough',
        readable: 'The rooms were put right before anybody came round.',
        minuteCost: 240,
        goalProgress: 32,
        cooldownDays: 5,
      },
      {
        id: 'put_the_books_in_order',
        label: 'Put the books in order',
        readable: 'The books were made ready for anybody who asked.',
        minuteCost: 120,
        goalProgress: 22,
        cooldownDays: 6,
      },
      {
        id: 'a_word_with_the_sergeant',
        label: 'Have a quiet word with the sergeant',
        readable: 'A quiet word was had, and coin changed hands.',
        coinCost: 60,
        minuteCost: 30,
        goalProgress: 26,
        oppositionDelta: 14,
        maxUses: 1,
      },
    ],
    opposingMoves: [
      {
        id: 'another_walkthrough',
        readable: 'came round again, unannounced',
        everyDays: 5,
        opposition: 11,
        domainMove: 'press_grievance',
      },
    ],
    outcomes: {
      success: {
        readable: 'The campaign ended with the house named as one of the good ones.',
        effects: [
          { kind: 'pressure_delta', id: 'inspection', amount: -18 },
          { kind: 'reputation_signal', id: 'respectable', amount: 5 },
        ],
        permanentChange: {
          kind: 'identity_known_for',
          label: 'a house the watch speaks well of',
          readable: 'The watch speaks well of this house now, and says so.',
        },
        memoryId: 'arc_campaign_commended',
      },
      compromise: {
        readable: 'The campaign ended with a warning and no order.',
        effects: [{ kind: 'pressure_delta', id: 'inspection', amount: -8 }],
        memoryId: 'arc_campaign_warned',
      },
      failure: {
        readable: 'The house came out of the campaign on the watch’s list.',
        effects: [{ kind: 'pressure_delta', id: 'inspection', amount: 8 }],
        permanentChange: {
          kind: 'house_rule',
          label: 'watch inspects on demand',
          readable: 'The watch may walk in whenever it likes now.',
        },
        memoryId: 'arc_campaign_listed',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // RIVAL MOVE — the other house making a play
  // -------------------------------------------------------------------------
  rival_tavern_expansion: {
    shape: 'rival_move',
    goal: 'Stop the other house taking the quarter while it is building.',
    owner: { kind: 'system', id: 'rival_tavern' },
    stages: [
      {
        id: 'the_builders_arrive',
        readable: 'Builders are at the other house.',
        stakes: 'Whatever they are putting in, they mean to take trade with it.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 6 }],
        next: 'they_open_the_new_room',
        effects: [{ kind: 'calendar_tag', id: 'rival_expansion' }],
      },
      {
        id: 'they_open_the_new_room',
        readable: 'The new room is open and the quarter has gone to look.',
        stakes: 'Every regular who tries it is one who might stay.',
        legacyStage: 'active',
        advanceWhen: [{ kind: 'days_in_stage', days: 10 }],
        branches: [
          {
            when: [{ kind: 'goal_progress_at_least', value: 55 }],
            toStage: 'held_the_quarter',
            readable: 'The regulars came back. The new room is just a room.',
          },
        ],
        next: 'they_took_the_quarter',
        timeoutDays: 26,
        onTimeout: 'they_took_the_quarter',
        effects: [
          { kind: 'pressure_delta', id: 'reputation_drift', amount: 7 },
          { kind: 'issue_seed_tag', id: 'rival_pressure' },
        ],
      },
      {
        id: 'held_the_quarter',
        readable: 'The house held its trade.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'they_took_the_quarter',
        readable: 'The other house took the quarter.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'answer_with_our_own_room',
        label: 'Answer with something of our own',
        readable: 'The house put money into something worth coming for.',
        coinCost: 70,
        minuteCost: 120,
        goalProgress: 30,
        cooldownDays: 6,
      },
      {
        id: 'hold_the_regulars',
        label: 'Hold the regulars personally',
        readable: 'The owner spent the evening with the regulars who matter.',
        minuteCost: 120,
        goalProgress: 24,
        oppositionDelta: -6,
        cooldownDays: 4,
      },
    ],
    opposingMoves: [
      {
        id: 'they_advertise',
        readable: 'are making sure everybody hears about the new room',
        everyDays: 5,
        opposition: 10,
        domainMove: 'talk',
      },
    ],
    outcomes: {
      success: {
        readable: 'The other house built a room nobody needed.',
        effects: [{ kind: 'pressure_delta', id: 'rival_tavern_pressure', amount: -14 }],
        memoryId: 'arc_rival_held',
      },
      compromise: {
        readable: 'The quarter split between the two houses.',
        memoryId: 'arc_rival_split',
      },
      failure: {
        readable: 'The other house is where the quarter drinks now.',
        effects: [
          { kind: 'pressure_delta', id: 'rival_tavern_pressure', amount: 12 },
          { kind: 'pressure_delta', id: 'regular_customer_loss', amount: 10 },
        ],
        permanentChange: {
          kind: 'customer_group_patronage',
          groupId: 'local_goblins',
          delta: -8,
          readable: 'A slice of the local trade moved across the road for good.',
        },
        memoryId: 'arc_rival_took_quarter',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // STATE-DRIVEN CRISIS — starts because the house is actually in a state
  // -------------------------------------------------------------------------
  sickness_in_the_quarter: {
    shape: 'state_driven_crisis',
    goal: 'Stop the sickness being traced to this house.',
    owner: { kind: 'customer_group', pick: 'largest' },
    stages: [
      {
        id: 'a_few_bad_stomachs',
        readable: 'A few people are unwell, and one of them drank here.',
        stakes: 'It is nothing yet. It could be something.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 3 }],
        branches: [
          {
            when: [
              { kind: 'days_in_stage', days: 3 },
              { kind: 'pressure_below', id: 'food_safety', threshold: 30 },
            ],
            toStage: 'nothing_came_of_it',
            readable: 'It came to nothing. The kitchen was never the problem.',
          },
        ],
        next: 'fingers_pointed',
        effects: [{ kind: 'issue_seed_tag', id: 'food_quality' }],
      },
      {
        id: 'fingers_pointed',
        readable: 'People are saying it started here.',
        stakes: 'The kitchen has to be visibly right, and quickly.',
        legacyStage: 'rising',
        advanceWhen: [{ kind: 'goal_progress_at_least', value: 50 }],
        branches: [
          // The way out is WORK, not a pressure reading. An earlier draft
          // gated this on `food_safety` falling below a line the arc's own
          // stage effect pushed it above, which made the arc unwinnable by
          // construction — the exact failure §5 names, dressed as content.
          {
            when: [
              { kind: 'goal_progress_at_least', value: 50 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'nothing_came_of_it',
            readable: 'The kitchen came up clean and the talk moved on.',
          },
          // Decisively lost: they are sure, and the house did little about it.
          {
            when: [
              { kind: 'opposition_at_least', value: 55 },
              { kind: 'goal_progress_below', value: 30 },
            ],
            toStage: 'the_house_is_blamed',
            readable: 'The quarter has made its mind up.',
          },
        ],
        next: 'still_talked_about',
        timeoutDays: 14,
        onTimeout: 'still_talked_about',
        effects: [
          { kind: 'pressure_delta', id: 'food_safety', amount: 10 },
          { kind: 'pressure_delta', id: 'rumour_pressure', amount: 6 },
        ],
      },
      {
        // Inconclusive: the margin decides between a quiet win, a level
        // compromise, and a loss.
        id: 'still_talked_about',
        readable: 'It is still talked about, on and off.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'nothing_came_of_it',
        readable: 'Nothing came of it.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'the_house_is_blamed',
        readable: 'The quarter has settled on this house as the cause.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'strip_the_kitchen',
        label: 'Strip the kitchen and start again',
        readable: 'The kitchen was stripped out and scrubbed.',
        minuteCost: 240,
        goalProgress: 34,
        cooldownDays: 4,
      },
      {
        id: 'throw_out_the_doubtful_stock',
        label: 'Throw out anything doubtful',
        readable: 'Anything doubtful went out the back door.',
        minuteCost: 60,
        goalProgress: 22,
        cooldownDays: 3,
      },
      {
        id: 'stand_up_and_say_so',
        label: 'Stand up in the room and say so',
        readable: 'The owner stood up in the room and told everybody what had been done.',
        minuteCost: 30,
        goalProgress: 18,
        oppositionDelta: -10,
        maxUses: 1,
      },
    ],
    opposingMoves: [
      {
        id: 'the_talk_spreads',
        readable: 'are telling everybody where they think it started',
        everyDays: 4,
        opposition: 12,
        domainMove: 'talk',
      },
    ],
    outcomes: {
      success: {
        readable: 'The sickness passed and nobody blamed the house.',
        effects: [{ kind: 'pressure_delta', id: 'food_safety', amount: -14 }],
        memoryId: 'arc_sickness_cleared',
      },
      compromise: {
        readable: 'Some still think it was the house. Most have forgotten.',
        memoryId: 'arc_sickness_doubted',
      },
      failure: {
        readable: 'This is the house that made the quarter sick.',
        effects: [
          { kind: 'pressure_delta', id: 'regular_customer_loss', amount: 14 },
          { kind: 'reputation_signal', id: 'filthy', amount: 8 },
        ],
        permanentChange: {
          kind: 'identity_known_for',
          label: 'the house that made people ill',
          readable: 'That is what the house is known for now.',
        },
        memoryId: 'arc_sickness_blamed',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // FACTION CONFLICT — two of them at odds, the house in the middle
  // -------------------------------------------------------------------------
  guild_turf_dispute: {
    shape: 'faction_conflict',
    goal: 'Get through the dispute without making an enemy.',
    owner: { kind: 'faction', pick: 'worst_relationship' },
    stages: [
      {
        id: 'words_in_the_room',
        readable: 'The two of them are arguing in the room.',
        stakes: 'Whoever the house is seen to favour, the other will remember.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 4 }],
        next: 'they_want_a_side',
        effects: [{ kind: 'pressure_delta', id: 'faction_anger', amount: 5 }],
      },
      {
        id: 'they_want_a_side',
        readable: 'Both of them want the house to take a side.',
        stakes: 'Saying nothing is itself an answer, and both will read it.',
        legacyStage: 'active',
        advanceWhen: [{ kind: 'days_in_stage', days: 8 }],
        branches: [
          {
            when: [
              { kind: 'goal_progress_at_least', value: 55 },
              { kind: 'margin_at_least', value: 20 },
            ],
            toStage: 'both_still_drink_here',
            readable: 'Both of them still drink here. That was the whole job.',
          },
          {
            when: [{ kind: 'opposition_at_least', value: 65 }],
            toStage: 'an_enemy_made',
            readable: 'One of them has stopped coming, and says why.',
          },
        ],
        next: 'both_still_drink_here',
        timeoutDays: 20,
        onTimeout: 'it_went_quiet',
        effects: [
          { kind: 'pressure_delta', id: 'faction_anger', amount: 8 },
          { kind: 'issue_seed_tag', id: 'faction_pressure' },
        ],
      },
      {
        id: 'it_went_quiet',
        readable: 'The argument went quiet without anybody settling it.',
        legacyStage: 'resolved',
        advanceWhen: [],
      },
      {
        id: 'both_still_drink_here',
        readable: 'The dispute went elsewhere and both still drink here.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'an_enemy_made',
        readable: 'One of them will not be back.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'hear_them_both_out',
        label: 'Hear them both out',
        readable: 'The owner sat with both of them and listened.',
        minuteCost: 120,
        goalProgress: 26,
        oppositionDelta: -10,
        cooldownDays: 4,
      },
      {
        id: 'ban_the_argument',
        label: 'Ban the argument from the room',
        readable: 'The argument was banned from the room, from both sides.',
        minuteCost: 60,
        goalProgress: 20,
        oppositionDelta: 8,
        maxUses: 2,
      },
      {
        id: 'take_a_side',
        label: 'Take a side, openly',
        readable: 'The house took a side and said so.',
        minuteCost: 60,
        goalProgress: 34,
        oppositionDelta: 26,
        maxUses: 1,
        stakesHook: 'arc_faction_debt',
      },
    ],
    opposingMoves: [
      {
        id: 'press_the_house',
        readable: 'are pressing the house to declare itself',
        everyDays: 5,
        opposition: 11,
        domainMove: 'press_grievance',
      },
    ],
    outcomes: {
      success: {
        readable: 'The dispute burned out and the house kept both of them.',
        effects: [{ kind: 'pressure_delta', id: 'faction_anger', amount: -12 }],
        memoryId: 'arc_dispute_kept_both',
      },
      compromise: {
        readable: 'The dispute ended cold. Neither side is warm about it.',
        memoryId: 'arc_dispute_cold',
      },
      failure: {
        readable: 'The house made an enemy over somebody else’s argument.',
        effects: [{ kind: 'pressure_delta', id: 'faction_anger', amount: 12 }],
        memoryId: 'arc_dispute_enemy',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // RECOVERY — digging out of something that already went wrong
  // -------------------------------------------------------------------------
  back_from_the_brink: {
    shape: 'recovery',
    goal: 'Get the house trading properly again.',
    owner: { kind: 'faction', pick: 'most_influential' },
    stages: [
      {
        id: 'the_bad_month',
        readable: 'The house is not paying its way.',
        stakes: 'Everybody who is owed something is watching.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 5 }],
        next: 'clawing_back',
        effects: [{ kind: 'issue_seed_tag', id: 'debt_pressure' }],
      },
      {
        id: 'clawing_back',
        readable: 'Clawing back, night by night.',
        stakes: 'Every good night counts, and there is no room for a bad one.',
        legacyStage: 'active',
        advanceWhen: [{ kind: 'goal_progress_at_least', value: 60 }],
        branches: [
          {
            when: [{ kind: 'goal_progress_at_least', value: 60 }],
            toStage: 'trading_again',
            readable: 'The house is trading properly again.',
          },
          {
            when: [{ kind: 'coin_below', value: 15 }],
            toStage: 'went_under',
            readable: 'The till is empty and there is nothing left to try.',
          },
        ],
        next: 'trading_again',
        timeoutDays: 28,
        onTimeout: 'went_under',
        effects: [{ kind: 'pressure_delta', id: 'debt', amount: 6 }],
      },
      {
        id: 'trading_again',
        readable: 'The house is back on its feet.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'went_under',
        readable: 'The house did not come back from it.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'work_the_floor_yourself',
        label: 'Work the floor yourself',
        readable: 'The owner worked the floor personally, every night.',
        minuteCost: 240,
        goalProgress: 28,
        cooldownDays: 3,
      },
      {
        id: 'go_round_the_creditors',
        label: 'Go round the creditors in person',
        readable: 'The owner went round everybody who was owed and talked to them.',
        minuteCost: 120,
        goalProgress: 24,
        oppositionDelta: -14,
        cooldownDays: 6,
      },
    ],
    opposingMoves: [
      {
        id: 'they_lose_patience',
        readable: 'are running out of patience',
        everyDays: 6,
        opposition: 10,
        domainMove: 'press_grievance',
      },
    ],
    outcomes: {
      success: {
        readable: 'The house came back, and everybody saw it come back.',
        effects: [{ kind: 'reputation_signal', id: 'reliable', amount: 6 }],
        permanentChange: {
          kind: 'identity_known_for',
          label: 'the house that came back',
          readable: 'The quarter remembers that this house came back from it.',
        },
        memoryId: 'arc_recovery_made_it',
      },
      compromise: {
        readable: 'The house is still standing. Nobody would call it recovered.',
        memoryId: 'arc_recovery_limped',
      },
      failure: {
        readable: 'The house never got back on its feet.',
        effects: [{ kind: 'pressure_delta', id: 'debt', amount: 12 }],
        memoryId: 'arc_recovery_failed',
      },
    },
    recurrence: 'recurring',
  },

  // -------------------------------------------------------------------------
  // TRANSFORMATION — ends by changing the world for good
  // -------------------------------------------------------------------------
  the_road_moves: {
    shape: 'transformation',
    goal: 'Be on the right side of the road when it moves.',
    owner: { kind: 'customer_group', id: 'merchants' },
    stages: [
      {
        id: 'surveyors_in_the_quarter',
        readable: 'Surveyors are walking the quarter with the caravan masters.',
        stakes: 'Where the road goes, the trade goes, for good.',
        legacyStage: 'seeded',
        advanceWhen: [{ kind: 'days_in_stage', days: 7 }],
        next: 'the_decision',
        effects: [{ kind: 'calendar_tag', id: 'road_survey' }],
      },
      {
        id: 'the_decision',
        readable: 'They are deciding where the road will run.',
        stakes: 'This is decided once, and then it is decided forever.',
        legacyStage: 'climax',
        advanceWhen: [{ kind: 'days_in_stage', days: 10 }],
        branches: [
          {
            when: [
              { kind: 'days_in_stage', days: 10 },
              { kind: 'goal_progress_at_least', value: 60 },
            ],
            toStage: 'the_road_comes_past',
            readable: 'The road will run past this door.',
          },
        ],
        next: 'the_road_goes_elsewhere',
        timeoutDays: 20,
        onTimeout: 'the_road_goes_elsewhere',
        effects: [{ kind: 'pressure_delta', id: 'market_instability', amount: 6 }],
      },
      {
        id: 'the_road_comes_past',
        readable: 'The road runs past this door now.',
        legacyStage: 'resolved',
        advanceWhen: [],
        outcome: 'success',
      },
      {
        id: 'the_road_goes_elsewhere',
        readable: 'The road runs somewhere else now.',
        legacyStage: 'failed',
        advanceWhen: [],
        outcome: 'failure',
      },
    ],
    interventions: [
      {
        id: 'host_the_caravan_masters',
        label: 'Host the caravan masters',
        readable: 'The caravan masters were hosted properly, at the house’s expense.',
        coinCost: 55,
        minuteCost: 120,
        goalProgress: 30,
        cooldownDays: 5,
      },
      {
        id: 'make_the_case_to_the_watch',
        label: 'Make the case to the watch',
        readable: 'The house made its case to the people who will sign it off.',
        minuteCost: 120,
        goalProgress: 24,
        cooldownDays: 6,
      },
    ],
    opposingMoves: [
      {
        id: 'the_other_end_of_the_quarter',
        readable: 'are being courted by the other end of the quarter',
        everyDays: 6,
        opposition: 12,
      },
    ],
    outcomes: {
      success: {
        readable: 'The new road runs past the door, and it always will.',
        permanentChange: {
          kind: 'customer_group_patronage',
          groupId: 'merchants',
          delta: 14,
          readable: 'The road merchants pass this door now, permanently.',
        },
        effects: [{ kind: 'reputation_signal', id: 'respectable', amount: 4 }],
        memoryId: 'arc_road_came_past',
      },
      compromise: {
        readable: 'The road runs near enough. Some of the trade comes past.',
        permanentChange: {
          kind: 'customer_group_patronage',
          groupId: 'merchants',
          delta: 4,
          readable: 'A little of the road trade comes past now.',
        },
        memoryId: 'arc_road_nearby',
      },
      failure: {
        readable: 'The road went the other way, and took the road trade with it.',
        permanentChange: {
          kind: 'customer_group_patronage',
          groupId: 'merchants',
          delta: -12,
          readable: 'The road merchants do not come this way any more.',
        },
        memoryId: 'arc_road_went_elsewhere',
      },
    },
    // The road is only laid once.
    recurrence: 'once_per_run',
  },
}
