# Phase 81 — Staff identity profile pool coverage (ISSUE-041)

See `docs/ISSUE_TRACKER.md` ISSUE-041 for full evidence and impact.

## Context

`staffIdentityProfiles.ts` registered 6 profiles total — confined to
the `goblin_common`, `human_town`, `dwarf_caravan` naming pools.
Customer groups already use the wider set (`miner_workcrew`,
`merchant_roadfolk`, `ogre_clans`, `adventuring_bands`), but staff
hires never escaped goblin/human/dwarf because `createStaffIdentity`
used `Registry.find` (first match by role).

## Implementation

`src/sim/content/staff/staffIdentityProfiles.ts` — add 9 new
profiles:

- `cook_miner` (miner_workcrew culture + naming)
- `kitchen_hand_merchant` (merchant_roadfolk)
- `seasoned_cook_ogre` (ogre_clans)
- `master_chef_adventuring` (adventuring_bands)
- `server_miner`, `server_merchant`, `server_adventuring`
- `cleaner_bouncer_ogre`, `cleaner_bouncer_miner`

Each carries an explicit `cultureId`, matching `namingProfileId`, and
flavoured personality/work-style/stress-response/loyalty/dislike
tags. The pool now covers 5 cultures with culture-bearing profiles
across cook, server, and cleaner_bouncer roles (every cook tier
gains ≥1 cultured variant).

New `getStaffIdentityProfilesForRole(roleId)` helper returns all
role-matching profiles (existing first-match `getStaffIdentityProfileForRole`
is preserved for callers and the error-message path).

`src/sim/content/staff/staffIdentityFactory.ts`:
- `CreateStaffIdentityArgs.preferredCultureId?: string` — optional
  caller-supplied culture bias.
- `resolveProfile` now does a weighted pick across all role-matching
  profiles when no explicit `profileId` is passed. Weights:
  - base `1`;
  - `+3` when `profile.cultureId === preferredCultureId`;
  - `× 0.1` for `shrine_devotees` cultureId on `cleaner_bouncer` role
    (heuristic preserved even though no shrine-cultured profile is
    registered today — future additions automatically follow the
    cultural-plausibility intent);
  - `× 2` for `ogre_clans` cultureId on `cleaner_bouncer` role.

The pick uses `args.rng.float()`, so callers can plug in a named RNG
stream (the staff_identity stream from Phase 24) and get
deterministic identity-pool sampling.

## Verification

`tests/sim/phase81.staffIdentityCoverage.test.ts` (new, 7 tests):
- registry covers ≥5 culture ids;
- every cook tier has ≥1 culture-bearing profile;
- 50 deterministic server hires cover ≥3 cultures;
- 50 deterministic hires across all roles cover ≥5 cultures;
- `preferredCultureId` produces strictly more matches than the
  unbiased baseline over 60 trials;
- explicit `profileId` still resolves to exactly that profile;
- every registered profile is invokable without throwing.

Adjacent suites still green: `phase31.staffIdentity` (17),
`phase11.staff` (32), `phase26.expandedValidation` (17),
`phase50.culturesTagAlignment` (10). Typecheck clean.

## Files

- `src/sim/content/staff/staffIdentityProfiles.ts`
- `src/sim/content/staff/staffIdentityFactory.ts`
- `tests/sim/phase81.staffIdentityCoverage.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
