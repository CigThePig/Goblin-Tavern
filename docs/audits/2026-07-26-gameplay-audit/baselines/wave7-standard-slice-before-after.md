# Balance matrix

40 cells · 28 days · seeds: phase7-integrated-shared
Decision load priced by: **real card render**

## Verdict — DC-03: identity through viability

**Balanced.** Every intended strategy is viable under the DC-04 floors, none is dominant, none is Pareto-dominated (foils excepted), and the strategy set expresses distinct identities.

## Trust

Every cell validated and held the Phase 8 §8.2 invariants on every day.

## standard · Actions + all responses

| Strategy | Coin | Min coin | Patrons | Satisf. | Clean | Damage | Morale | Days@100 | Cards/day | Choices/day | Streak | Identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto_no_owner_actions | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_random_owner | 942 ±0 | 100 | 982 | 18.27 | 50.96 | 10.73 | 52.46 | 5 | 3.50 | 16.43 | 4 | filthy+goblinAuthentic |
| auto_clean_focused | 1512 ±0 | 100 | 1463 | 35.33 | 65.76 | 3.76 | 60.49 | 2 | 3.39 | 16.11 | 5 | filthy+respectable |
| auto_profit_focused | 4945 ±0 | 100 | 1183 | 10.35 | 43.81 | 17.91 | 58.87 | 0 | 4.36 | 20.39 | 5 | cheap+goblinAuthentic |
| auto_merchant_focused | 1902 ±0 | 100 | 1698 | 46.27 | 60.95 | 17.44 | 61.82 | 1 | 4 | 18.04 | 5 | cheap+respectable |
| auto_miner_focused | 1986 ±0 | 100 | 1185 | 12.20 | 52.33 | 11.17 | 55.94 | 6 | 4.46 | 19.82 | 6 | filthy+goblinAuthentic |
| auto_ignore_repairs | 796 ±0 | 100 | 1042 | 10.46 | 40.46 | 19.23 | 58.75 | 7 | 4.43 | 19.25 | 5 | filthy+goblinAuthentic |
| auto_staff_friendly | 1039 ±0 | 100 | 1481 | 41.39 | 69.15 | 15.74 | 73.74 | 1 | 3.96 | 17.71 | 4 | filthy+respectable |

**Leadership** (seed median; a strategy leading on every
rankable outcome axis would be a balance failure under any objective):

| Strategy | Leads on | Trails on |
|---|---|---|
| auto_no_owner_actions | — | totalPatrons, meanSatisfaction, meanMorale |
| auto_random_owner | — | — |
| auto_clean_focused | meanDamage | — |
| auto_profit_focused | finalCoin, pressureDaysAtCeiling | — |
| auto_merchant_focused | totalPatrons, meanSatisfaction | — |
| auto_miner_focused | — | — |
| auto_ignore_repairs | — | finalCoin, meanDamage, pressureDaysAtCeiling |
| auto_staff_friendly | meanCleanliness, meanMorale | — |

- Dominant strategy: **none**
- Pareto-dominated strategies (some other strategy is at least as good on every rankable axis and better on one): auto_no_owner_actions, auto_random_owner, auto_ignore_repairs
- Distinct identities: cheap+goblinAuthentic, cheap+respectable, filthy+goblinAuthentic, filthy+respectable
- Distinct dominant customer groups: local_goblins

## standard · No action at all

| Strategy | Coin | Min coin | Patrons | Satisf. | Clean | Damage | Morale | Days@100 | Cards/day | Choices/day | Streak | Identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto_no_owner_actions | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_random_owner | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_clean_focused | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_profit_focused | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_merchant_focused | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_miner_focused | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_ignore_repairs | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_staff_friendly | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |

**Leadership** (seed median; a strategy leading on every
rankable outcome axis would be a balance failure under any objective):

| Strategy | Leads on | Trails on |
|---|---|---|
| auto_no_owner_actions | — | — |
| auto_random_owner | — | — |
| auto_clean_focused | — | — |
| auto_profit_focused | — | — |
| auto_merchant_focused | — | — |
| auto_miner_focused | — | — |
| auto_ignore_repairs | — | — |
| auto_staff_friendly | — | — |

- **Every strategy produced an identical outcome.** Expected for `no_action` (the bot controls no lever that variant pulls); a balance failure anywhere else.
- Distinct identities: filthy+goblinAuthentic
- Distinct dominant customer groups: local_goblins

## standard · Owner actions only

| Strategy | Coin | Min coin | Patrons | Satisf. | Clean | Damage | Morale | Days@100 | Cards/day | Choices/day | Streak | Identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto_no_owner_actions | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_random_owner | 942 ±0 | 100 | 982 | 18.27 | 50.96 | 10.73 | 52.46 | 5 | 3.50 | 16.43 | 4 | filthy+goblinAuthentic |
| auto_clean_focused | 1035 ±0 | 100 | 1271 | 32.17 | 65.38 | 4.38 | 53.61 | 3 | 3.18 | 15.57 | 4 | filthy+goblinAuthentic |
| auto_profit_focused | 2852 ±0 | 100 | 980 | 8.66 | 40.46 | 17.96 | 51.55 | 5 | 3.64 | 16.25 | 3 | filthy+goblinAuthentic |
| auto_merchant_focused | 1244 ±0 | 100 | 1327 | 40.43 | 59.36 | 20.13 | 53.61 | 3 | 3.57 | 16.79 | 3 | cheap+goblinAuthentic |
| auto_miner_focused | 725 ±0 | 100 | 1072 | 8.83 | 40.46 | 15.01 | 49.83 | 0 | 4 | 17.93 | 3 | filthy+goblinAuthentic |
| auto_ignore_repairs | 1121 ±0 | 100 | 1038 | 9.14 | 40.46 | 18.50 | 53.61 | 5 | 3.61 | 15.79 | 3 | filthy+goblinAuthentic |
| auto_staff_friendly | 1019 ±0 | 100 | 1341 | 40.96 | 65.06 | 20.51 | 64.86 | 3 | 3.68 | 17.25 | 3 | filthy+goblinAuthentic |

**Leadership** (seed median; a strategy leading on every
rankable outcome axis would be a balance failure under any objective):

| Strategy | Leads on | Trails on |
|---|---|---|
| auto_no_owner_actions | — | totalPatrons |
| auto_random_owner | — | — |
| auto_clean_focused | meanCleanliness, meanDamage | — |
| auto_profit_focused | finalCoin | meanSatisfaction |
| auto_merchant_focused | — | — |
| auto_miner_focused | pressureDaysAtCeiling | finalCoin, meanMorale |
| auto_ignore_repairs | — | — |
| auto_staff_friendly | totalPatrons, meanSatisfaction, meanMorale | meanDamage |

- Dominant strategy: **none**
- Pareto-dominated strategies (some other strategy is at least as good on every rankable axis and better on one): auto_random_owner
- Distinct identities: cheap+goblinAuthentic, filthy+goblinAuthentic
- Distinct dominant customer groups: local_goblins

## standard · Card responses only

| Strategy | Coin | Min coin | Patrons | Satisf. | Clean | Damage | Morale | Days@100 | Cards/day | Choices/day | Streak | Identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto_no_owner_actions | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_random_owner | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_clean_focused | 1686 ±0 | 100 | 1279 | 12.56 | 43.94 | 13.02 | 59.86 | 2 | 4 | 17.57 | 4 | filthy+respectable |
| auto_profit_focused | 2225 ±0 | 100 | 1091 | 11.22 | 43.01 | 17.17 | 56.50 | 1 | 4.25 | 19.64 | 4 | cozy+goblinAuthentic |
| auto_merchant_focused | 1753 ±0 | 100 | 1225 | 12.70 | 43 | 14.79 | 58.62 | 5 | 3.82 | 17.07 | 4 | filthy+respectable |
| auto_miner_focused | 2078 ±0 | 100 | 1062 | 13.81 | 50.69 | 15.57 | 56.50 | 1 | 4.21 | 19.75 | 5 | filthy+goblinAuthentic |
| auto_ignore_repairs | 772 ±0 | 100 | 847 | 10.19 | 40.45 | 21.91 | 56.27 | 15 | 4.39 | 18.79 | 5 | filthy+goblinAuthentic |
| auto_staff_friendly | 1686 ±0 | 100 | 1279 | 12.56 | 43.94 | 13.02 | 59.86 | 2 | 4 | 17.57 | 4 | filthy+respectable |

**Leadership** (seed median; a strategy leading on every
rankable outcome axis would be a balance failure under any objective):

| Strategy | Leads on | Trails on |
|---|---|---|
| auto_no_owner_actions | — | — |
| auto_random_owner | — | — |
| auto_clean_focused | — | — |
| auto_profit_focused | finalCoin | — |
| auto_merchant_focused | — | — |
| auto_miner_focused | meanSatisfaction, meanCleanliness | — |
| auto_ignore_repairs | — | finalCoin, meanCleanliness, meanDamage, pressureDaysAtCeiling |
| auto_staff_friendly | — | — |

- Dominant strategy: **none**
- Pareto-dominated strategies (some other strategy is at least as good on every rankable axis and better on one): auto_no_owner_actions, auto_random_owner, auto_ignore_repairs
- Distinct identities: cozy+goblinAuthentic, filthy+goblinAuthentic, filthy+respectable
- Distinct dominant customer groups: local_goblins

## standard · Actions + every other response

| Strategy | Coin | Min coin | Patrons | Satisf. | Clean | Damage | Morale | Days@100 | Cards/day | Choices/day | Streak | Identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auto_no_owner_actions | 1043 ±0 | 100 | 828 | 9.09 | 40.46 | 17.67 | 51.89 | 5 | 3.36 | 14.96 | 3 | filthy+goblinAuthentic |
| auto_random_owner | 942 ±0 | 100 | 982 | 18.27 | 50.96 | 10.73 | 52.46 | 5 | 3.50 | 16.43 | 4 | filthy+goblinAuthentic |
| auto_clean_focused | 1604 ±0 | 100 | 1343 | 32.95 | 65.99 | 3.62 | 61.69 | 1 | 3.11 | 14.82 | 5 | filthy+respectable |
| auto_profit_focused | 4026 ±0 | 100 | 1181 | 9.70 | 41.73 | 17.76 | 54.96 | 4 | 4.29 | 19.04 | 5 | filthy+goblinAuthentic |
| auto_merchant_focused | 1826 ±0 | 100 | 1537 | 41.73 | 60.44 | 18.21 | 56.78 | 1 | 3.82 | 17 | 5 | cheap+goblinAuthentic |
| auto_miner_focused | 863 ±0 | 100 | 1135 | 10.74 | 45.29 | 14.42 | 53.82 | 0 | 4.36 | 19.29 | 5 | filthy+goblinAuthentic |
| auto_ignore_repairs | 977 ±0 | 100 | 1047 | 9.71 | 40.46 | 19.19 | 55.89 | 5 | 4.14 | 18.29 | 5 | filthy+goblinAuthentic |
| auto_staff_friendly | 1811 ±0 | 100 | 1475 | 41.86 | 67.41 | 17.74 | 73.71 | 1 | 3.61 | 16.29 | 4 | filthy+respectable |

**Leadership** (seed median; a strategy leading on every
rankable outcome axis would be a balance failure under any objective):

| Strategy | Leads on | Trails on |
|---|---|---|
| auto_no_owner_actions | — | totalPatrons, meanSatisfaction, meanMorale |
| auto_random_owner | — | — |
| auto_clean_focused | meanDamage | — |
| auto_profit_focused | finalCoin | — |
| auto_merchant_focused | totalPatrons | — |
| auto_miner_focused | pressureDaysAtCeiling | finalCoin |
| auto_ignore_repairs | — | meanDamage |
| auto_staff_friendly | meanSatisfaction, meanCleanliness, meanMorale | — |

- Dominant strategy: **none**
- Pareto-dominated strategies (some other strategy is at least as good on every rankable axis and better on one): auto_no_owner_actions, auto_random_owner, auto_ignore_repairs
- Distinct identities: cheap+goblinAuthentic, filthy+goblinAuthentic, filthy+respectable
- Distinct dominant customer groups: local_goblins

## Agency — does acting beat not acting?

Baseline is `no_action`. `DC-04` (the failure contract) cannot be
written until this table has an answer.

### Actions + all responses vs no action

| Metric | Strategies improved | Of |
|---|---|---|
| finalCoin | 4 | 8 |
| totalPatrons | 7 | 8 |
| meanSatisfaction | 7 | 8 |
| meanCleanliness | 6 | 8 |
| meanDamage | 5 | 8 |
| meanMorale | 7 | 8 |
| pressureDaysAtCeiling | 4 | 8 |

### Owner actions only vs no action

| Metric | Strategies improved | Of |
|---|---|---|
| finalCoin | 3 | 8 |
| totalPatrons | 7 | 8 |
| meanSatisfaction | 5 | 8 |
| meanCleanliness | 4 | 8 |
| meanDamage | 3 | 8 |
| meanMorale | 5 | 8 |
| pressureDaysAtCeiling | 4 | 8 |

### Card responses only vs no action

| Metric | Strategies improved | Of |
|---|---|---|
| finalCoin | 5 | 8 |
| totalPatrons | 6 | 8 |
| meanSatisfaction | 6 | 8 |
| meanCleanliness | 5 | 8 |
| meanDamage | 5 | 8 |
| meanMorale | 6 | 8 |
| pressureDaysAtCeiling | 4 | 8 |

### Actions + every other response vs no action

| Metric | Strategies improved | Of |
|---|---|---|
| finalCoin | 4 | 8 |
| totalPatrons | 7 | 8 |
| meanSatisfaction | 7 | 8 |
| meanCleanliness | 6 | 8 |
| meanDamage | 3 | 8 |
| meanMorale | 7 | 8 |
| pressureDaysAtCeiling | 5 | 8 |


## Baseline diff

Baseline: `docs/audits/2026-07-26-gameplay-audit/baselines/pre-wave7-standard.json` (generated 2026-07-28T18:39:34.725Z)

240 metric(s) moved:

| Cell | Metric | Before | After | Δ |
|---|---|---|---|---|
| auto_no_owner_actions/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_no_owner_actions/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_no_owner_actions/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_no_owner_actions/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_no_owner_actions/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_no_owner_actions/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_no_owner_actions/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_no_owner_actions/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_no_owner_actions/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_no_owner_actions/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_no_owner_actions/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_no_owner_actions/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_no_owner_actions/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_no_owner_actions/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_no_owner_actions/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_random_owner/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 23 | 5 | -18 |
| auto_random_owner/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 3.54 | 3.50 | -0.04 |
| auto_random_owner/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 16.61 | 16.43 | -0.18 |
| auto_random_owner/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_random_owner/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_random_owner/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_random_owner/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 23 | 5 | -18 |
| auto_random_owner/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.54 | 3.50 | -0.04 |
| auto_random_owner/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 16.61 | 16.43 | -0.18 |
| auto_random_owner/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_random_owner/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_random_owner/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_random_owner/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 23 | 5 | -18 |
| auto_random_owner/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 3.54 | 3.50 | -0.04 |
| auto_random_owner/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 16.61 | 16.43 | -0.18 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 1014 | 1512 | 498 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1378 | 1463 | 85 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 34.32 | 35.33 | 1.01 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCleanliness | 65.80 | 65.76 | -0.04 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 3.50 | 3.76 | 0.26 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 66.52 | 60.49 | -6.03 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 2 | -19 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 3.86 | 3.39 | -0.47 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 17.25 | 16.11 | -1.14 |
| auto_clean_focused/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 108 | 95 | -13 |
| auto_clean_focused/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_clean_focused/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_clean_focused/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_clean_focused/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 3 | -18 |
| auto_clean_focused/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.07 | 3.18 | 0.11 |
| auto_clean_focused/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 14.93 | 15.57 | 0.64 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 1700 | 1686 | -14 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | totalPatrons | 1236 | 1279 | 43 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 12.50 | 12.56 | 0.06 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanCleanliness | 43.26 | 43.94 | 0.68 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 12.89 | 13.02 | 0.13 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanMorale | 62.57 | 59.86 | -2.71 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 2 | -19 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.11 | 4 | -0.11 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 18.64 | 17.57 | -1.07 |
| auto_clean_focused/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 115 | 112 | -3 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 1570 | 1604 | 34 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1354 | 1343 | -11 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 33.75 | 32.95 | -0.80 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCleanliness | 66.12 | 65.99 | -0.13 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 3.73 | 3.62 | -0.11 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 60.37 | 61.69 | 1.32 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 3.54 | 3.11 | -0.43 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 15.71 | 14.82 | -0.89 |
| auto_clean_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalResponsesResolved | 55 | 49 | -6 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 4443 | 4945 | 502 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1132 | 1183 | 51 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 10.83 | 10.35 | -0.48 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCleanliness | 44.28 | 43.81 | -0.47 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 17.66 | 17.91 | 0.25 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 55.47 | 58.87 | 3.40 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 0 | -21 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 4.64 | 4.36 | -0.28 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 20.54 | 20.39 | -0.15 |
| auto_profit_focused/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 130 | 122 | -8 |
| auto_profit_focused/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_profit_focused/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_profit_focused/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_profit_focused/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 25 | 5 | -20 |
| auto_profit_focused/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.71 | 3.64 | -0.07 |
| auto_profit_focused/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 16.54 | 16.25 | -0.29 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 2551 | 2225 | -326 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | totalPatrons | 1132 | 1091 | -41 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 10.75 | 11.22 | 0.47 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanCleanliness | 42.96 | 43.01 | 0.05 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 17.32 | 17.17 | -0.15 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanMorale | 56.75 | 56.50 | -0.25 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.46 | 4.25 | -0.21 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 20.18 | 19.64 | -0.54 |
| auto_profit_focused/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 125 | 119 | -6 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 3735 | 4026 | 291 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1019 | 1181 | 162 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 9.36 | 9.70 | 0.34 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCleanliness | 40.98 | 41.73 | 0.75 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 17.86 | 17.76 | -0.10 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 56.48 | 54.96 | -1.52 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 4 | -17 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 4.43 | 4.29 | -0.14 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 19.07 | 19.04 | -0.03 |
| auto_profit_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalResponsesResolved | 71 | 68 | -3 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 1866 | 1902 | 36 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1721 | 1698 | -23 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 44.81 | 46.27 | 1.46 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCleanliness | 60.46 | 60.95 | 0.49 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 16.49 | 17.44 | 0.95 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 63.56 | 61.82 | -1.74 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 4.32 | 4 | -0.32 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 19.14 | 18.04 | -1.10 |
| auto_merchant_focused/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 121 | 112 | -9 |
| auto_merchant_focused/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_merchant_focused/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_merchant_focused/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_merchant_focused/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 3 | -18 |
| auto_merchant_focused/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.43 | 3.57 | 0.14 |
| auto_merchant_focused/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 16.79 | 1.11 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 1775 | 1753 | -22 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | totalPatrons | 1227 | 1225 | -2 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 12.49 | 12.70 | 0.21 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanCleanliness | 43.08 | 43 | -0.08 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 14.87 | 14.79 | -0.08 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanMorale | 62.19 | 58.62 | -3.57 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 5 | -16 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.04 | 3.82 | -0.22 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 17.93 | 17.07 | -0.86 |
| auto_merchant_focused/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 113 | 107 | -6 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 1885 | 1826 | -59 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1527 | 1537 | 10 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 43.52 | 41.73 | -1.79 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCleanliness | 59.29 | 60.44 | 1.15 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 15.87 | 18.21 | 2.34 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 59.52 | 56.78 | -2.74 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 3.89 | 3.82 | -0.07 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 17.29 | 17 | -0.29 |
| auto_merchant_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalResponsesResolved | 61 | 60 | -1 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 2016 | 1986 | -30 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1183 | 1185 | 2 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 12.29 | 12.20 | -0.09 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCleanliness | 47.83 | 52.33 | 4.50 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 13.47 | 11.17 | -2.30 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 55.01 | 55.94 | 0.93 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 6 | -15 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 4.50 | 4.46 | -0.04 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 19.86 | 19.82 | -0.04 |
| auto_miner_focused/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 126 | 125 | -1 |
| auto_miner_focused/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_miner_focused/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_miner_focused/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_miner_focused/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 25 | 0 | -25 |
| auto_miner_focused/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.93 | 4 | 0.07 |
| auto_miner_focused/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 17.46 | 17.93 | 0.47 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 2116 | 2078 | -38 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | totalPatrons | 1079 | 1062 | -17 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 13.94 | 13.81 | -0.13 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | meanCleanliness | 50.45 | 50.69 | 0.24 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 15.77 | 15.57 | -0.20 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.43 | 4.21 | -0.22 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 20.32 | 19.75 | -0.57 |
| auto_miner_focused/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 124 | 118 | -6 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 1045 | 863 | -182 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1152 | 1135 | -17 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 11.26 | 10.74 | -0.52 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCleanliness | 44.31 | 45.29 | 0.98 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 13.10 | 14.42 | 1.32 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 56.32 | 53.82 | -2.50 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 0 | -21 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 4.29 | 4.36 | 0.07 |
| auto_miner_focused/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 19.11 | 19.29 | 0.18 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 774 | 796 | 22 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1040 | 1042 | 2 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 10.56 | 10.46 | -0.10 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 19.31 | 19.23 | -0.08 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 61.13 | 58.75 | -2.38 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 7 | -14 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 4.54 | 4.43 | -0.11 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 19.86 | 19.25 | -0.61 |
| auto_ignore_repairs/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 127 | 124 | -3 |
| auto_ignore_repairs/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_ignore_repairs/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_ignore_repairs/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_ignore_repairs/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 23 | 5 | -18 |
| auto_ignore_repairs/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.71 | 3.61 | -0.10 |
| auto_ignore_repairs/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 16.29 | 15.79 | -0.50 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 732 | 772 | 40 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 10.33 | 10.19 | -0.14 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 21.72 | 21.91 | 0.19 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | meanMorale | 60.56 | 56.27 | -4.29 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 15 | -6 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.57 | 4.39 | -0.18 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 19.64 | 18.79 | -0.85 |
| auto_ignore_repairs/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 128 | 123 | -5 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 960 | 977 | 17 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1046 | 1047 | 1 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 9.61 | 9.71 | 0.10 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 19.26 | 19.19 | -0.07 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 61.20 | 55.89 | -5.31 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 5 | -16 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 4.07 | 4.14 | 0.07 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 18.46 | 18.29 | -0.17 |
| auto_ignore_repairs/standard/act-bot/res-partial/phase7-integrated-shared | totalResponsesResolved | 64 | 66 | 2 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | finalCoin | 1825 | 1039 | -786 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | totalPatrons | 1574 | 1481 | -93 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanSatisfaction | 43.74 | 41.39 | -2.35 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanCleanliness | 69.27 | 69.15 | -0.12 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanDamage | 16.07 | 15.74 | -0.33 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanMorale | 75.93 | 73.74 | -2.19 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanCardsPerDay | 4.25 | 3.96 | -0.29 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | meanChoicesPerDay | 18.39 | 17.71 | -0.68 |
| auto_staff_friendly/standard/act-bot/res-all/phase7-integrated-shared | totalResponsesResolved | 119 | 111 | -8 |
| auto_staff_friendly/standard/act-none/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 22 | 5 | -17 |
| auto_staff_friendly/standard/act-none/res-none/phase7-integrated-shared | meanCardsPerDay | 3.46 | 3.36 | -0.10 |
| auto_staff_friendly/standard/act-none/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.68 | 14.96 | -0.72 |
| auto_staff_friendly/standard/act-bot/res-none/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 3 | -18 |
| auto_staff_friendly/standard/act-bot/res-none/phase7-integrated-shared | meanCardsPerDay | 3.39 | 3.68 | 0.29 |
| auto_staff_friendly/standard/act-bot/res-none/phase7-integrated-shared | meanChoicesPerDay | 15.57 | 17.25 | 1.68 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | finalCoin | 1700 | 1686 | -14 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | totalPatrons | 1236 | 1279 | 43 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanSatisfaction | 12.50 | 12.56 | 0.06 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanCleanliness | 43.26 | 43.94 | 0.68 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanDamage | 12.89 | 13.02 | 0.13 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanMorale | 62.57 | 59.86 | -2.71 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 2 | -19 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanCardsPerDay | 4.11 | 4 | -0.11 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | meanChoicesPerDay | 18.64 | 17.57 | -1.07 |
| auto_staff_friendly/standard/act-none/res-all/phase7-integrated-shared | totalResponsesResolved | 115 | 112 | -3 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | finalCoin | 1720 | 1811 | 91 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | totalPatrons | 1487 | 1475 | -12 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanSatisfaction | 42.64 | 41.86 | -0.78 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanCleanliness | 66.96 | 67.41 | 0.45 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanDamage | 18.43 | 17.74 | -0.69 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanMorale | 75.70 | 73.71 | -1.99 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | pressureDaysAtCeiling | 21 | 1 | -20 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanCardsPerDay | 3.54 | 3.61 | 0.07 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | meanChoicesPerDay | 16.21 | 16.29 | 0.08 |
| auto_staff_friendly/standard/act-bot/res-partial/phase7-integrated-shared | totalResponsesResolved | 57 | 58 | 1 |
