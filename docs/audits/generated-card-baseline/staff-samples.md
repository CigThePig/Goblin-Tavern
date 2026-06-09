# Staff Samples

## staff_burnout

- **Scenario:** staff_burnout
- **Card id:** staff_burnout.staff_request
- **Seed:** `seed-staff_burnout-cleaner_bouncer-d1`
- **Family/type/timing:** staff_burnout / staff_request / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 100 / 100 / 100 / 100
- **Domain:** staff

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-staff_burnout-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Nash is stressed (85).",
      "tags": [
        "staff",
        "stress"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-staff_burnout-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 10,
      "direction": "increase",
      "weight": 10,
      "readable": "Nash is fatigued (79).",
      "tags": [
        "staff",
        "fatigue"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-staff_burnout-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "Nash morale low (25).",
      "tags": [
        "staff",
        "morale"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-138",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 87,
      "direction": "increase",
      "weight": 87,
      "readable": "Nash is publicly blamed (strength 461).",
      "tags": [
        "pressure",
        "staff_loyalty_risk",
        "staff",
        "loyalty",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "memories",
        "attribution",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-139",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 87,
      "direction": "increase",
      "weight": 87,
      "readable": "Nash is publicly blamed (strength 461).",
      "tags": [
        "pressure",
        "staff_loyalty_risk",
        "staff",
        "loyalty",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "memories",
        "attribution",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "quit_stake",
      "target": "staff:cleaner_bouncer",
      "readable": "Nash may quit",
      "direction": "loss",
      "tags": [
        "staff"
      ]
    },
    {
      "id": "service_stake",
      "target": "service:capacity",
      "readable": "Service quality may drop",
      "direction": "risk",
      "tags": [
        "service"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "staff_burnout_warning_seen",
      "actors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        }
      ],
      "tags": [
        "staff"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Nash",
    "problemNoun": "exhaustion",
    "sensoryDetails": [
      "hunched shoulders",
      "dark eyes"
    ],
    "actorOpinions": {
      "cleaner_bouncer": "looks ready to snap"
    },
    "recentContext": [
      "heavy week of service"
    ],
    "stakesReadable": [
      "Nash may quit",
      "service may decline"
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: pay_bonus

```json
{
  "responseSlot": {
    "id": "pay_bonus",
    "labelHint": "Pay Nash a bonus",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "raise staff morale",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "pay_bonus_profile",
    "responseSlotId": "pay_bonus",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": 15,
        "readable": "Boost Nash morale",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -10,
        "readable": "Lower stress",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Pay bonus cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:debt",
        "amount": 3,
        "readable": "Bonus tightens the ledger over the week",
        "tags": [
          "pressure",
          "debt",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "debt",
        "meterLabel": "Debt"
      },
      {
        "kind": "future_hook",
        "target": "staff_bonus_expected_cleaner_bouncer",
        "amount": 30,
        "readable": "Nash may expect another bonus",
        "tags": [
          "future_hook",
          "staff"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "staff_bonus_expected_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_bonus_paid_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "bonus"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_bonus_expected_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "bonus"
        ]
      }
    ],
    "impactScore": 60
  }
}
```

#### Slot: reduce_workload

```json
{
  "responseSlot": {
    "id": "reduce_workload",
    "labelHint": "Lighten Nash's load",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "lower stress",
      "reduce service capacity"
    ]
  },
  "consequenceProfile": {
    "id": "reduce_workload_profile",
    "responseSlotId": "reduce_workload",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.fatigue",
        "amount": -15,
        "readable": "Lower fatigue",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -10,
        "readable": "Lower stress",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "staff.cook.fatigue",
        "amount": 6,
        "readable": "Ib Mudshank picks up the slack",
        "tags": [
          "staff",
          "coverage_gap",
          "delay:3"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      },
      {
        "kind": "future_hook",
        "target": "coverage_gap_cleaner_bouncer",
        "amount": 7,
        "readable": "Coverage gap may resurface when Nash returns",
        "tags": [
          "future_hook",
          "staff",
          "coverage"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "coverage_gap_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "workload_reduced_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "workload"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "coverage_gap_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "coverage"
        ]
      }
    ],
    "impactScore": 40
  }
}
```

#### Slot: push_through

```json
{
  "responseSlot": {
    "id": "push_through",
    "labelHint": "Push through",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "no cost",
      "risk staff quitting"
    ]
  },
  "consequenceProfile": {
    "id": "push_through_profile",
    "responseSlotId": "push_through",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": 8,
        "readable": "Burnout worsens",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      },
      {
        "kind": "future_hook",
        "target": "staff_quit_risk_cleaner_bouncer",
        "amount": 14,
        "readable": "Nash may quit",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_quit_risk_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "pushed_staff_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "risk"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_quit_risk_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "risk"
        ]
      }
    ],
    "impactScore": 18
  }
}
```

#### Slot: reassign

```json
{
  "responseSlot": {
    "id": "reassign",
    "labelHint": "Reassign priorities",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "shift workload",
      "side effects elsewhere"
    ]
  },
  "consequenceProfile": {
    "id": "reassign_profile",
    "responseSlotId": "reassign",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -8,
        "readable": "Slight relief",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.fatigue",
        "amount": 6,
        "readable": "Ib Mudshank absorbs reassigned duties",
        "tags": [
          "staff",
          "reassign"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": 3,
        "readable": "Cross-staff load creeps the burnout meter",
        "tags": [
          "pressure",
          "staff",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      },
      {
        "kind": "future_hook",
        "target": "cross_staff_grumble_cook",
        "amount": 10,
        "readable": "Ib Mudshank may grumble about the reassign",
        "tags": [
          "future_hook",
          "staff"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cross_staff_grumble_cook"
      }
    ],
    "memories": [
      {
        "id": "reassigned_priorities_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "priority"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "cross_staff_grumble_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "reassign"
        ]
      }
    ],
    "impactScore": 27
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "pay_bonus",
    "label": "Pay the bonus",
    "verb": "pay",
    "targetId": "cleaner_bouncer",
    "shape": "safe_costly",
    "previewEffects": [
      "morale would surge through the whole crew, a wide leap",
      "stress would lift a real step off the crew",
      "a notch of silver would slip from the purse",
      "later: the rota would mark it for later"
    ],
    "mechanicalEffects": [
      "Nash Morale +15",
      "Nash Stress -10",
      "Coin -15",
      "later: Nash may expect another bonus"
    ]
  },
  {
    "slotId": "reduce_workload",
    "label": "Shift the rota",
    "verb": "delegate",
    "targetId": "cleaner_bouncer",
    "shape": "compromise",
    "previewEffects": [
      "fatigue would drop away, a wide leap for the crew",
      "stress would loosen a clear lift across the rota",
      "later: a thread would loop back round"
    ],
    "mechanicalEffects": [
      "Nash Fatigue -15",
      "Nash Stress -10",
      "later: Coverage gap may resurface when Nash returns"
    ]
  },
  {
    "slotId": "push_through",
    "label": "Let them sweat it",
    "verb": "ignore",
    "targetId": "cleaner_bouncer",
    "shape": "risky_profitable",
    "previewEffects": [
      "the meter would mount a notch with every hour",
      "a thread would loop back round"
    ],
    "mechanicalEffects": [
      "Staff Burnout +8",
      "Nash may quit"
    ]
  },
  {
    "slotId": "reassign",
    "label": "Move them to another post",
    "verb": "delegate",
    "targetId": "cleaner_bouncer",
    "shape": "compromise",
    "previewEffects": [
      "Slight relief",
      "fatigue would creep a step across the shift (Ib Mudshank)",
      "later: Ib Mudshank may grumble about the reassign"
    ],
    "mechanicalEffects": [
      "Nash Stress -8",
      "Ib Mudshank Fatigue +6",
      "later: Ib Mudshank may grumble about the reassign"
    ]
  }
]
```

## staff_identity

- **Scenario:** staff_identity
- **Card id:** staff_identity.staff_aside
- **Seed:** `seed-staff_identity-cleaner_bouncer-d1`
- **Family/type/timing:** staff_identity / relationship_test / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 60 / 67 / 100 / 96
- **Domain:** staff, identity, social

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-staff_loyalty_risk-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 14,
      "direction": "increase",
      "weight": 14,
      "readable": "Staff loyalty is fragile on average (38).",
      "tags": [
        "staff",
        "loyalty"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-staff_loyalty_risk-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 4,
      "direction": "increase",
      "weight": 4,
      "readable": "1 staff with low morale.",
      "tags": [
        "staff",
        "morale"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-staff_burnout-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Nash is stressed (75).",
      "tags": [
        "staff",
        "stress"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-staff_burnout-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 10,
      "direction": "increase",
      "weight": 10,
      "readable": "Nash is fatigued (69).",
      "tags": [
        "staff",
        "fatigue"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-127",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 76,
      "direction": "increase",
      "weight": 76,
      "readable": "Nash is publicly blamed (strength 470).",
      "tags": [
        "pressure",
        "staff_loyalty_risk",
        "staff",
        "loyalty",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "memories",
        "attribution",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-128",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.staff_loyalty_risk",
      "sourceType": "pressure",
      "target": "pressure:staff_loyalty_risk",
      "targetType": "pressure",
      "amount": 76,
      "direction": "increase",
      "weight": 76,
      "readable": "Nash is publicly blamed (strength 470).",
      "tags": [
        "pressure",
        "staff_loyalty_risk",
        "staff",
        "loyalty",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "memories",
        "attribution",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-111",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.staff_burnout",
      "sourceType": "pressure",
      "target": "pressure:staff_burnout",
      "targetType": "pressure",
      "amount": 19,
      "direction": "increase",
      "weight": 19,
      "readable": "1 staff with unpaid wages this week.",
      "tags": [
        "pressure",
        "staff_burnout",
        "staff",
        "risk"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "weekly"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "staff_loyalty_risk",
      "label": "Staff Loyalty Risk",
      "value": 76,
      "previousValue": 0,
      "delta": 76,
      "trend": "stable",
      "severity": 76,
      "urgency": 84,
      "volatility": 100,
      "causes": [
        {
          "id": "avg_loyalty_low",
          "readable": "Staff loyalty is fragile on average (38).",
          "amount": 14,
          "weight": 14,
          "direction": "increase",
          "tags": [
            "staff",
            "loyalty"
          ],
          "relatedSystems": [
            "staff"
          ],
          "origin": "inherited"
        },
        {
          "id": "low_morale_count",
          "readable": "1 staff with low morale.",
          "amount": 4,
          "weight": 4,
          "direction": "increase",
          "tags": [
            "staff",
            "morale"
          ],
          "relatedSystems": [
            "staff"
          ],
          "origin": "inherited"
        },
        {
          "id": "unpaid_wages",
          "readable": "1 staff with unpaid wages.",
          "amount": 7,
          "weight": 7,
          "direction": "increase",
          "tags": [
            "staff",
            "wages"
          ],
          "relatedSystems": [
            "staff",
            "weekly"
          ],
          "origin": "player_caused"
        },
        {
          "id": "blame_cleaner_bouncer",
          "readable": "Nash is publicly blamed (strength 470).",
          "amount": 26,
          "weight": 26,
          "direction": "increase",
          "tags": [
            "staff",
            "blame",
            "attribution"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cleaner_bouncer"
            }
          ],
          "relatedSystems": [
            "staff",
            "attribution"
          ],
          "origin": "discovered"
        },
        {
          "id": "scapegoat_cleaner_bouncer",
          "readable": "Nash remembers being scapegoated (strength 80).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "staff",
            "memory",
            "scapegoat"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cleaner_bouncer"
            }
          ],
          "relatedSystems": [
            "staff",
            "memories"
          ],
          "origin": "player_caused"
        },
        {
          "id": "blame_cook",
          "readable": "Ib Mudshank is publicly blamed (strength 142).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "staff",
            "blame",
            "attribution"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cook"
            }
          ],
          "relatedSystems": [
            "staff",
            "attribution"
          ],
          "origin": "discovered"
        },
        {
          "id": "burnout_contribution",
          "readable": "Staff burnout pressure 44 bleeds into loyalty risk.",
          "amount": 9,
          "weight": 9,
          "direction": "increase",
          "tags": [
            "staff",
            "burnout",
            "web"
          ],
          "relatedSystems": [
            "staff",
            "pressures"
          ],
          "origin": "decay"
        }
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "memories",
        "attribution",
        "pressures"
      ],
      "tags": [
        "staff",
        "loyalty",
        "social",
        "expanded"
      ],
      "consequences": [
        "Staff request seeds become more likely.",
        "Staff quitting warnings appear.",
        "Service quality drops.",
        "Staff conflict scenes may follow."
      ],
      "lastUpdated": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      }
    },
    {
      "id": "staff_burnout",
      "label": "Staff Burnout",
      "value": 44,
      "previousValue": 25,
      "delta": 19,
      "trend": "stable",
      "severity": 44,
      "urgency": 49,
      "volatility": 100,
      "causes": [
        {
          "id": "stress_cleaner_bouncer",
          "readable": "Nash is stressed (75).",
          "amount": 12,
          "weight": 12,
          "direction": "increase",
          "tags": [
            "staff",
            "stress"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cleaner_bouncer"
            }
          ],
          "relatedSystems": [
            "staff"
          ]
        },
        {
          "id": "fatigue_cleaner_bouncer",
          "readable": "Nash is fatigued (69).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "staff",
            "fatigue"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cleaner_bouncer"
            }
          ],
          "relatedSystems": [
            "staff"
          ]
        },
        {
          "id": "morale_cleaner_bouncer",
          "readable": "Nash morale low (25).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "staff",
            "morale"
          ],
          "relatedActors": [
            {
              "kind": "staff",
              "id": "cleaner_bouncer"
            }
          ],
          "relatedSystems": [
            "staff"
          ]
        },
        {
          "id": "unpaid_wages",
          "readable": "1 staff with unpaid wages this week.",
          "amount": 14,
          "weight": 14,
          "direction": "increase",
          "tags": [
            "staff",
            "wages",
            "unpaid"
          ],
          "relatedSystems": [
            "staff",
            "weekly"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "staff",
        "weekly"
      ],
      "tags": [
        "staff",
        "risk",
        "burnout"
      ],
      "consequences": [],
      "lastUpdated": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      }
    }
  ],
  "stakes": [
    {
      "id": "quit_stake",
      "target": "staff:cleaner_bouncer",
      "readable": "Nash may quit",
      "direction": "loss",
      "tags": [
        "staff"
      ]
    },
    {
      "id": "loyalty_stake",
      "target": "staff:cleaner_bouncer",
      "readable": "Loyalty may break",
      "direction": "risk",
      "tags": [
        "staff"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "staff_identity_warning_cleaner_bouncer",
      "actors": [
        {
          "kind": "staff",
          "id": "cleaner_bouncer"
        }
      ],
      "tags": [
        "staff",
        "identity",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Nash",
    "problemNoun": "public blame",
    "sensoryDetails": [
      "tight jaw",
      "long silence"
    ],
    "actorOpinions": {
      "cleaner_bouncer": "feels watched"
    },
    "recentContext": [
      "tense week of service"
    ],
    "stakesReadable": [
      "Nash may quit",
      "service may collapse"
    ],
    "namedEntities": [
      {
        "role": "staff",
        "ref": {
          "kind": "staff",
          "id": "cleaner_bouncer"
        },
        "displayName": "Nash"
      }
    ],
    "socialContext": [
      "publicly blamed"
    ],
    "relevantMemories": [
      "scapegoat memory",
      "Staff Snapped"
    ],
    "perceivedBlame": [
      "Cook publicly blamed for botched service."
    ],
    "pressureContext": [
      "loyalty risk 76",
      "burnout 44"
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: comfort_staff

```json
{
  "responseSlot": {
    "id": "comfort_staff",
    "labelHint": "Comfort Nash",
    "allowedVerbs": [
      "appease"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "raise loyalty",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "comfort_staff_profile",
    "responseSlotId": "comfort_staff",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 10,
        "readable": "Loyalty rises",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -8,
        "readable": "Stress drops",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": 6,
        "readable": "Morale lifts",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "cause",
        "target": "staff:cleaner_bouncer",
        "amount": 5,
        "readable": "Private gratitude",
        "tags": [
          "staff",
          "attribution"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleaner_bouncer"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "staff_emotional_debt_cleaner_bouncer",
        "amount": 8,
        "readable": "Owner owes the moment back",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_emotional_debt_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_comforted_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "loyalty",
          "comforted",
          "attribution"
        ]
      },
      {
        "id": "staff_comfort_peer_witness_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "witness"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_emotional_debt_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "attribution"
        ]
      }
    ],
    "impactScore": 41
  }
}
```

#### Slot: publicly_back_staff

```json
{
  "responseSlot": {
    "id": "publicly_back_staff",
    "labelHint": "Publicly back Nash",
    "allowedVerbs": [
      "rebrand",
      "appease"
    ],
    "shape": "reputation_play",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "shift blame off staff",
      "risk owner reputation"
    ]
  },
  "consequenceProfile": {
    "id": "publicly_back_staff_profile",
    "responseSlotId": "publicly_back_staff",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 12,
        "readable": "Public backing earns loyalty",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 5,
        "readable": "Owner stood up for staff",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": -3,
        "readable": "Crew-defender signal",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -8,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "staff_publicly_backed_cleaner_bouncer",
        "amount": 10,
        "readable": "Crew remembers being defended",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_publicly_backed_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_publicly_backed_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "reputation",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "staff_back_witness_local_goblins",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "customer_group",
            "id": "local_goblins"
          }
        ],
        "tags": [
          "staff",
          "witness",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_publicly_backed_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "reputation"
        ]
      }
    ],
    "impactScore": 41
  }
}
```

#### Slot: pay_bonus

```json
{
  "responseSlot": {
    "id": "pay_bonus",
    "labelHint": "Pay a bonus",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "raise morale",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "pay_bonus_profile",
    "responseSlotId": "pay_bonus",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": 12,
        "readable": "Morale up",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 6,
        "readable": "Bonus earns loyalty",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Bonus paid",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "cause",
        "target": "staff:cleaner_bouncer",
        "amount": 8,
        "readable": "Bonus felt directly",
        "tags": [
          "staff",
          "bonus"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cleaner_bouncer"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -10,
        "readable": "Loyalty risk drops",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "wage_expectation_cleaner_bouncer",
        "amount": 8,
        "readable": "Bonus becomes the new floor",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "wage_expectation_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_bonus_paid_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "bonus",
          "attribution"
        ]
      },
      {
        "id": "staff_bonus_peer_notice_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "witness",
          "wages"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "wage_expectation_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "wages"
        ]
      }
    ],
    "impactScore": 55
  }
}
```

#### Slot: blame_staff

```json
{
  "responseSlot": {
    "id": "blame_staff",
    "labelHint": "Blame Nash",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "shed owner blame",
      "destroy loyalty"
    ]
  },
  "consequenceProfile": {
    "id": "blame_staff_profile",
    "responseSlotId": "blame_staff",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": -20,
        "readable": "Loyalty collapses",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": -12,
        "readable": "Morale crumbles",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -8,
        "readable": "Owner scapegoats publicly",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "cause",
        "target": "staff:cleaner_bouncer",
        "amount": -12,
        "readable": "Owner publicly blamed staff",
        "tags": [
          "staff",
          "blame",
          "attribution"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "cleaner_bouncer"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 6,
        "readable": "Scapegoat story spreads",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": 12,
        "readable": "Loyalty risk spikes",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "future_hook",
        "target": "staff_quit_risk_cleaner_bouncer",
        "amount": 15,
        "readable": "Staff may quit",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "staff_quit_risk_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_scapegoated_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "grudge",
          "scapegoat",
          "attribution"
        ]
      },
      {
        "id": "staff_scapegoat_witness_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "witness",
          "grudge"
        ]
      },
      {
        "id": "tavern_blamed_staff_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_quit_risk_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "risk"
        ]
      }
    ],
    "impactScore": 79
  }
}
```

#### Slot: change_priority

```json
{
  "responseSlot": {
    "id": "change_priority",
    "labelHint": "Change priority",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "lower stress",
      "reduce service capacity"
    ]
  },
  "consequenceProfile": {
    "id": "change_priority_profile",
    "responseSlotId": "change_priority",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -10,
        "readable": "Stress drops",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.fatigue",
        "amount": -5,
        "readable": "Some rest",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": -6,
        "readable": "Burnout eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "staff_priority_changed_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "priority",
          "protected"
        ]
      },
      {
        "id": "staff_priority_peer_pickup_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "workload"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 26
  }
}
```

#### Slot: ignore_request

```json
{
  "responseSlot": {
    "id": "ignore_request",
    "labelHint": "Ignore the moment",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "risk staff quitting"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_request_profile",
    "responseSlotId": "ignore_request",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": -3,
        "readable": "Slight loyalty drop",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": 4,
        "readable": "Unspoken stress lingers",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "stress",
        "meterLabel": "stress"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": 6,
        "readable": "Loyalty risk rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "future_hook",
        "target": "staff_quit_risk_cleaner_bouncer",
        "amount": 10,
        "readable": "Quiet quitting watch",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_quit_risk_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_ignored_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "ignored",
          "scapegoat"
        ]
      },
      {
        "id": "tavern_owner_walked_past_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "ignored"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_quit_risk_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "risk"
        ]
      }
    ],
    "impactScore": 25
  }
}
```

#### Slot: give_authority

```json
{
  "responseSlot": {
    "id": "give_authority",
    "labelHint": "Give Nash more authority",
    "allowedVerbs": [
      "promote",
      "delegate"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "raise loyalty sharply",
      "raise stress",
      "service capacity grows"
    ]
  },
  "consequenceProfile": {
    "id": "give_authority_profile",
    "responseSlotId": "give_authority",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 15,
        "readable": "Authority earns deep loyalty",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": 6,
        "readable": "Authority weighs",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -8,
        "readable": "Training tools and badges",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -10,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "authority_test_cleaner_bouncer",
        "amount": 12,
        "readable": "Authority will be tested",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "authority_test_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_given_authority_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "authority",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "staff_authority_witness_local_goblins",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "customer_group",
            "id": "local_goblins"
          }
        ],
        "tags": [
          "staff",
          "witness",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "authority_test_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "risk",
          "authority"
        ]
      }
    ],
    "impactScore": 53
  }
}
```

#### Slot: quieter_role

```json
{
  "responseSlot": {
    "id": "quieter_role",
    "labelHint": "Move Nash to a quieter role",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "lower stress",
      "service capacity drops"
    ]
  },
  "consequenceProfile": {
    "id": "quieter_role_profile",
    "responseSlotId": "quieter_role",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.stress",
        "amount": -12,
        "readable": "Quiet station relieves",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stress",
        "meterLabel": "stress"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.fatigue",
        "amount": -8,
        "readable": "Rest returns",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 5,
        "readable": "Recognised the need",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -6,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": -8,
        "readable": "Burnout falls",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "staff_quieter_role_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "staff_quiet_peer_workload_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "workload"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 43
  }
}
```

#### Slot: promise_raise

```json
{
  "responseSlot": {
    "id": "promise_raise",
    "labelHint": "Promise Nash a raise",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "delay_problem",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      }
    ],
    "expectedEffects": [
      "raise loyalty now",
      "future wage cost"
    ]
  },
  "consequenceProfile": {
    "id": "promise_raise_profile",
    "responseSlotId": "promise_raise",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 14,
        "readable": "Promise of more",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": 8,
        "readable": "Hope lifts mood",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -10,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Raise becomes due",
        "tags": [
          "coin",
          "wages"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "future_hook",
        "target": "raise_promised_cleaner_bouncer",
        "amount": 15,
        "readable": "Promise must be kept",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "raise_promised_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_raise_promised_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "wages",
          "bonus",
          "attribution"
        ]
      },
      {
        "id": "tavern_promised_raise_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "wages"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "raise_promised_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          }
        ],
        "tags": [
          "staff",
          "wages",
          "risk"
        ]
      }
    ],
    "impactScore": 57
  }
}
```

#### Slot: staff_meeting

```json
{
  "responseSlot": {
    "id": "staff_meeting",
    "labelHint": "Hold a staff meeting",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      },
      {
        "kind": "staff",
        "id": "cook"
      }
    ],
    "expectedEffects": [
      "lower burnout",
      "spread context to peers"
    ]
  },
  "consequenceProfile": {
    "id": "staff_meeting_profile",
    "responseSlotId": "staff_meeting",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.morale",
        "amount": 6,
        "readable": "Crew heard out",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -8,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": -6,
        "readable": "Burnout eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      },
      {
        "kind": "cause",
        "target": "staff:cleaner_bouncer",
        "amount": 6,
        "readable": "Public acknowledgement",
        "tags": [
          "staff",
          "attribution"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleaner_bouncer"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "staff_meeting_held_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "staff_meeting_peer_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "protected"
        ]
      },
      {
        "id": "staff_meeting_faction_signal",
        "actors": [
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "faction",
          "memory"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 30
  }
}
```

#### Slot: training_helper

```json
{
  "responseSlot": {
    "id": "training_helper",
    "labelHint": "Pair Nash with Ib Mudshank",
    "allowedVerbs": [
      "delegate",
      "promote"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "cleaner_bouncer"
      },
      {
        "kind": "staff",
        "id": "cook"
      }
    ],
    "expectedEffects": [
      "lower burnout",
      "raise peer loyalty",
      "service quality climbs"
    ]
  },
  "consequenceProfile": {
    "id": "training_helper_profile",
    "responseSlotId": "training_helper",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.loyalty",
        "amount": 8,
        "readable": "Mentor role earns loyalty",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cleaner_bouncer.fatigue",
        "amount": 4,
        "readable": "Mentoring is work",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.loyalty",
        "amount": 8,
        "readable": "Apprentice gains loyalty",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.morale",
        "amount": 6,
        "readable": "Apprentice morale rises",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": -8,
        "readable": "Workload spreads",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "training_helper_cleaner_bouncer",
        "amount": 10,
        "readable": "Pair becomes a station",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "training_helper_cleaner_bouncer"
      }
    ],
    "memories": [
      {
        "id": "staff_training_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "staff_training_peer_cook",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "comforted"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "training_helper_cleaner_bouncer",
        "actors": [
          {
            "kind": "staff",
            "id": "cleaner_bouncer"
          },
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "staff",
          "opportunity"
        ]
      }
    ],
    "impactScore": 47
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "comfort_staff",
    "label": "Address it",
    "verb": "appease",
    "targetId": "cleaner_bouncer",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "loyalty would deepen a clear lift across the rota",
      "Stress drops",
      "morale would warm a notch through the crew",
      "later: the rota would loop back to it"
    ],
    "mechanicalEffects": [
      "Nash Loyalty +10",
      "Nash Stress -8",
      "Nash Morale +6",
      "later: Owner owes the moment back"
    ]
  },
  {
    "slotId": "publicly_back_staff",
    "label": "Back them in public",
    "verb": "rebrand",
    "targetId": "cleaner_bouncer",
    "shape": "reputation_play",
    "previewEffects": [
      "loyalty would climb a real step with the crew",
      "respectable standing would gain a step in talk",
      "the loyalty risk would ease a step off the crew",
      "later: a thread would surface later"
    ],
    "mechanicalEffects": [
      "Nash Loyalty +12",
      "Reputation Respectable +5",
      "Staff Loyalty Risk -8",
      "later: Crew remembers being defended"
    ]
  },
  {
    "slotId": "pay_bonus",
    "label": "Pay a bonus",
    "verb": "pay",
    "targetId": "cleaner_bouncer",
    "shape": "safe_costly",
    "previewEffects": [
      "morale would climb a clear lift in the crew",
      "the till would lighten by a step",
      "the loyalty risk would fall a clear drop tonight",
      "later: Bonus becomes the new floor"
    ],
    "mechanicalEffects": [
      "Nash Morale +12",
      "Coin -10",
      "Staff Loyalty Risk -10",
      "later: Bonus becomes the new floor"
    ]
  },
  {
    "slotId": "blame_staff",
    "label": "Blame Nash",
    "verb": "blame",
    "targetId": "cleaner_bouncer",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "loyalty would collapse a heavy fall in the crew",
      "morale would sink a clear drop in the crew",
      "the rumour pressure would spread a step through the room",
      "later: Staff may quit"
    ],
    "mechanicalEffects": [
      "Nash Loyalty -20",
      "Nash Morale -12",
      "Rumour Pressure +6",
      "later: Staff may quit"
    ]
  },
  {
    "slotId": "change_priority",
    "label": "Change priority",
    "verb": "delegate",
    "targetId": "cleaner_bouncer",
    "shape": "compromise",
    "previewEffects": [
      "stress would loosen a clear lift across the rota",
      "fatigue would ease a step across the rota",
      "the burnout meter would settle a step lower tonight"
    ],
    "mechanicalEffects": [
      "Nash Stress -10",
      "Nash Fatigue -5",
      "Staff Burnout -6"
    ]
  },
  {
    "slotId": "ignore_request",
    "label": "Let it sit",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "loyalty would slip a step from the crew",
      "Unspoken stress lingers",
      "later: Quiet quitting watch"
    ],
    "mechanicalEffects": [
      "Nash Loyalty -3",
      "Nash Stress +4",
      "later: Quiet quitting watch"
    ]
  }
]
```

## regular_customer_relationship

- **Scenario:** regular_customer_relationship
- **Card id:** fallback.everySeed
- **Seed:** `seed-regular_customer-phase163_regular_brik-d1`
- **Family/type/timing:** regular_customer / relationship_test / during_service
- **Severity/urgency/novelty/cardWorthiness:** 44 / 30 / 100 / 71
- **Domain:** regulars, customers, social

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-regular_customer_loss-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.regular_customer_loss",
      "sourceType": "pressure",
      "target": "pressure:regular_customer_loss",
      "targetType": "pressure",
      "amount": 13,
      "direction": "increase",
      "weight": 13,
      "readable": "Average regular irritation 43.",
      "tags": [
        "regulars",
        "irritation"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-regular_customer_loss-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.regular_customer_loss",
      "sourceType": "pressure",
      "target": "pressure:regular_customer_loss",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "1 regular(s) with low loyalty.",
      "tags": [
        "regulars",
        "loyalty"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-68",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "service.tabs.miners",
      "sourceType": "service",
      "target": "coin",
      "targetType": "coin",
      "amount": -7,
      "direction": "decrease",
      "weight": 7,
      "readable": "service.tabs.miners",
      "tags": [
        "coin",
        "unpaid_tab",
        "miners"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 1
    },
    {
      "id": "c-0-90",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:miners.satisfaction",
      "targetType": "customer",
      "amount": -3,
      "direction": "decrease",
      "weight": 6,
      "readable": "Main room cleanliness fell below Miners tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "miners",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "miners"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 1
    },
    {
      "id": "c-1-90",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:miners.satisfaction",
      "targetType": "customer",
      "amount": -3,
      "direction": "decrease",
      "weight": 6,
      "readable": "Main room cleanliness fell below Miners tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "miners",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "miners"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    }
  ],
  "pressures": [
    {
      "id": "regular_customer_loss",
      "label": "Regular Customer Loss",
      "value": 27,
      "previousValue": 0,
      "delta": 27,
      "trend": "stable",
      "severity": 27,
      "urgency": 27,
      "volatility": 100,
      "causes": [
        {
          "id": "avg_irritation",
          "readable": "Average regular irritation 43.",
          "amount": 13,
          "weight": 13,
          "direction": "increase",
          "tags": [
            "regulars",
            "irritation"
          ],
          "relatedSystems": [
            "regulars"
          ]
        },
        {
          "id": "low_loyalty_regulars",
          "readable": "1 regular(s) with low loyalty.",
          "amount": 6,
          "weight": 6,
          "direction": "increase",
          "tags": [
            "regulars",
            "loyalty"
          ],
          "relatedSystems": [
            "regulars"
          ]
        },
        {
          "id": "ignored_phase163_regular_brik",
          "readable": "Brik Tallowmug remembers ignored complaints (strength 60).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "regular",
            "memory",
            "ignored"
          ],
          "relatedActors": [
            {
              "kind": "regular",
              "id": "phase163_regular_brik"
            }
          ],
          "relatedSystems": [
            "regulars",
            "memories"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "regular",
          "id": "phase163_regular_brik"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "regulars",
        "customers",
        "memories",
        "areas"
      ],
      "tags": [
        "regulars",
        "social",
        "expanded"
      ],
      "consequences": [],
      "lastUpdated": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      }
    }
  ],
  "stakes": [
    {
      "id": "regular_loss",
      "target": "regular:phase163_regular_brik",
      "readable": "Brik Tallowmug may walk out",
      "direction": "loss",
      "tags": [
        "regular"
      ]
    },
    {
      "id": "group_loyalty",
      "target": "customer:miners",
      "readable": "Group loyalty may drop",
      "direction": "risk",
      "tags": [
        "customer"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "regular_seed_phase163_regular_brik",
      "actors": [
        {
          "kind": "regular",
          "id": "phase163_regular_brik"
        }
      ],
      "tags": [
        "regular",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Brik Tallowmug",
    "problemNoun": "sour mood",
    "sensoryDetails": [
      "half-empty mug",
      "cold stare"
    ],
    "actorOpinions": {
      "phase163_regular_brik": "looks ready to leave"
    },
    "recentContext": [
      "irritation 44"
    ],
    "stakesReadable": [
      "regular may walk out",
      "group loyalty may drop"
    ],
    "namedEntities": [
      {
        "role": "regular",
        "ref": {
          "kind": "regular",
          "id": "phase163_regular_brik"
        },
        "displayName": "Brik Tallowmug"
      },
      {
        "role": "group",
        "ref": {
          "kind": "customer_group",
          "id": "miners"
        },
        "displayName": "Miners"
      }
    ],
    "socialContext": [
      "group: miners"
    ],
    "relevantMemories": [
      "mild dissatisfaction"
    ],
    "pressureContext": [
      "regular loss 27"
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: apologize_to_regular

```json
{
  "responseSlot": {
    "id": "apologize_to_regular",
    "labelHint": "Apologise to Brik Tallowmug",
    "allowedVerbs": [
      "appease"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "raise loyalty",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "apologize_profile",
    "responseSlotId": "apologize_to_regular",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": 8,
        "readable": "Loyalty rises",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_apology_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "apology",
          "gratitude"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 8
  }
}
```

#### Slot: comp_regular_meal

```json
{
  "responseSlot": {
    "id": "comp_regular_meal",
    "labelHint": "Comp a meal",
    "allowedVerbs": [
      "discount",
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "raise loyalty",
      "lose coin"
    ]
  },
  "consequenceProfile": {
    "id": "comp_regular_profile",
    "responseSlotId": "comp_regular_meal",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -8,
        "readable": "Comp cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": 10,
        "readable": "Loyalty rises sharply",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_comped_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "comp"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 17
  }
}
```

#### Slot: refuse_request

```json
{
  "responseSlot": {
    "id": "refuse_request",
    "labelHint": "Refuse the request",
    "allowedVerbs": [
      "blame",
      "ignore"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "hold the line",
      "lose regular"
    ]
  },
  "consequenceProfile": {
    "id": "refuse_profile",
    "responseSlotId": "refuse_request",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": -12,
        "readable": "Regular grudges",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "regular_grudge_phase163_regular_brik",
        "amount": 0,
        "readable": "Regular may turn rival",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "regular_grudge_phase163_regular_brik"
      }
    ],
    "memories": [
      {
        "id": "regular_refused_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "regular_grudge_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "risk"
        ]
      }
    ],
    "impactScore": 15
  }
}
```

#### Slot: ask_regular_to_spread_word

```json
{
  "responseSlot": {
    "id": "ask_regular_to_spread_word",
    "labelHint": "Ask them to spread the word",
    "allowedVerbs": [
      "invite",
      "negotiate"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      },
      {
        "kind": "customer_group",
        "id": "miners"
      }
    ],
    "expectedEffects": [
      "raise reputation",
      "risk credibility"
    ]
  },
  "consequenceProfile": {
    "id": "ask_regular_word_profile",
    "responseSlotId": "ask_regular_to_spread_word",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.miners.loyalty",
        "amount": 5,
        "readable": "Word spreads",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_word_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "reputation"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 8
  }
}
```

#### Slot: ban_regular

```json
{
  "responseSlot": {
    "id": "ban_regular",
    "labelHint": "Ban Brik Tallowmug",
    "allowedVerbs": [
      "ban"
    ],
    "shape": "escalation",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "lose regular",
      "send signal"
    ]
  },
  "consequenceProfile": {
    "id": "ban_regular_profile",
    "responseSlotId": "ban_regular",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": -25,
        "readable": "Regular banned",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_banned_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "ban"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 18
  }
}
```

#### Slot: ignore_regular

```json
{
  "responseSlot": {
    "id": "ignore_regular",
    "labelHint": "Ignore the regular",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "raise regular loss pressure"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_regular_profile",
    "responseSlotId": "ignore_regular",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 6,
        "readable": "Loss pressure rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      }
    ],
    "memories": [
      {
        "id": "regular_ignored_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "ignored"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 7
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "apologize_to_regular",
    "label": "Apologise to Brik Tallowmug",
    "verb": "appease",
    "targetId": "phase163_regular_brik",
    "shape": "safe_costly",
    "previewEffects": [
      "Loyalty rises"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik +8"
    ]
  },
  {
    "slotId": "comp_regular_meal",
    "label": "Comp a meal",
    "verb": "discount",
    "targetId": "phase163_regular_brik",
    "shape": "safe_costly",
    "previewEffects": [
      "Comp cost",
      "Loyalty rises sharply"
    ],
    "mechanicalEffects": [
      "Coin -8",
      "Phase163 Regular Brik +10"
    ]
  },
  {
    "slotId": "refuse_request",
    "label": "Refuse the request",
    "verb": "blame",
    "targetId": "phase163_regular_brik",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "Regular grudges"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik -12"
    ]
  },
  {
    "slotId": "ask_regular_to_spread_word",
    "label": "Ask them to spread the word",
    "verb": "invite",
    "targetId": "phase163_regular_brik",
    "shape": "long_term_investment",
    "previewEffects": [
      "Word spreads"
    ],
    "mechanicalEffects": [
      "Miners Loyalty +5"
    ]
  },
  {
    "slotId": "ban_regular",
    "label": "Ban Brik Tallowmug",
    "verb": "ban",
    "targetId": "phase163_regular_brik",
    "shape": "escalation",
    "previewEffects": [
      "Regular banned"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik -25"
    ]
  },
  {
    "slotId": "ignore_regular",
    "label": "Ignore the regular",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [],
    "mechanicalEffects": []
  }
]
```

## regular_customer_complaint

- **Scenario:** regular_customer_complaint
- **Card id:** fallback.everySeed
- **Seed:** `seed-regular_customer-phase163_regular_brik-d1`
- **Family/type/timing:** regular_customer / complaint / during_service
- **Severity/urgency/novelty/cardWorthiness:** 82 / 40 / 100 / 96
- **Domain:** regulars, customers, social

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-regular_customer_loss-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.regular_customer_loss",
      "sourceType": "pressure",
      "target": "pressure:regular_customer_loss",
      "targetType": "pressure",
      "amount": 24,
      "direction": "increase",
      "weight": 24,
      "readable": "Average regular irritation 81.",
      "tags": [
        "regulars",
        "irritation"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-regular_customer_loss-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.regular_customer_loss",
      "sourceType": "pressure",
      "target": "pressure:regular_customer_loss",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "1 regular(s) with low loyalty.",
      "tags": [
        "regulars",
        "loyalty"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-65",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "service.tabs.miners",
      "sourceType": "service",
      "target": "coin",
      "targetType": "coin",
      "amount": -7,
      "direction": "decrease",
      "weight": 7,
      "readable": "service.tabs.miners",
      "tags": [
        "coin",
        "unpaid_tab",
        "miners"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 1
    },
    {
      "id": "c-1-76",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:miners.satisfaction",
      "targetType": "customer",
      "amount": -3,
      "direction": "decrease",
      "weight": 6,
      "readable": "Main room cleanliness fell below Miners tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "miners",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "miners"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    },
    {
      "id": "c-0-87",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:miners.satisfaction",
      "targetType": "customer",
      "amount": -2,
      "direction": "decrease",
      "weight": 4,
      "readable": "Main room cleanliness fell below Miners tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "miners",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "miners"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 1
    }
  ],
  "pressures": [
    {
      "id": "regular_customer_loss",
      "label": "Regular Customer Loss",
      "value": 40,
      "previousValue": 0,
      "delta": 40,
      "trend": "stable",
      "severity": 40,
      "urgency": 40,
      "volatility": 100,
      "causes": [
        {
          "id": "avg_irritation",
          "readable": "Average regular irritation 81.",
          "amount": 24,
          "weight": 24,
          "direction": "increase",
          "tags": [
            "regulars",
            "irritation"
          ],
          "relatedSystems": [
            "regulars"
          ]
        },
        {
          "id": "low_loyalty_regulars",
          "readable": "1 regular(s) with low loyalty.",
          "amount": 6,
          "weight": 6,
          "direction": "increase",
          "tags": [
            "regulars",
            "loyalty"
          ],
          "relatedSystems": [
            "regulars"
          ]
        },
        {
          "id": "ignored_phase163_regular_brik",
          "readable": "Brik Tallowmug remembers ignored complaints (strength 80).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "regular",
            "memory",
            "ignored"
          ],
          "relatedActors": [
            {
              "kind": "regular",
              "id": "phase163_regular_brik"
            }
          ],
          "relatedSystems": [
            "regulars",
            "memories"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "regular",
          "id": "phase163_regular_brik"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "regulars",
        "customers",
        "memories",
        "areas"
      ],
      "tags": [
        "regulars",
        "social",
        "expanded"
      ],
      "consequences": [],
      "lastUpdated": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      }
    }
  ],
  "stakes": [
    {
      "id": "regular_loss",
      "target": "regular:phase163_regular_brik",
      "readable": "Brik Tallowmug may walk out",
      "direction": "loss",
      "tags": [
        "regular"
      ]
    },
    {
      "id": "group_loyalty",
      "target": "customer:miners",
      "readable": "Group loyalty may drop",
      "direction": "risk",
      "tags": [
        "customer"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "regular_seed_phase163_regular_brik",
      "actors": [
        {
          "kind": "regular",
          "id": "phase163_regular_brik"
        }
      ],
      "tags": [
        "regular",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Brik Tallowmug",
    "problemNoun": "sour mood",
    "sensoryDetails": [
      "half-empty mug",
      "cold stare"
    ],
    "actorOpinions": {
      "phase163_regular_brik": "looks ready to leave"
    },
    "recentContext": [
      "irritation 82"
    ],
    "stakesReadable": [
      "regular may walk out",
      "group loyalty may drop"
    ],
    "namedEntities": [
      {
        "role": "regular",
        "ref": {
          "kind": "regular",
          "id": "phase163_regular_brik"
        },
        "displayName": "Brik Tallowmug"
      },
      {
        "role": "group",
        "ref": {
          "kind": "customer_group",
          "id": "miners"
        },
        "displayName": "Miners"
      }
    ],
    "socialContext": [
      "group: miners"
    ],
    "relevantMemories": [
      "ignored regular complaint",
      "Regular Complained"
    ],
    "perceivedBlame": [
      "blames the house"
    ],
    "pressureContext": [
      "regular loss 40"
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: apologize_to_regular

```json
{
  "responseSlot": {
    "id": "apologize_to_regular",
    "labelHint": "Apologise to Brik Tallowmug",
    "allowedVerbs": [
      "appease"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "raise loyalty",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "apologize_profile",
    "responseSlotId": "apologize_to_regular",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": 8,
        "readable": "Loyalty rises",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_apology_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "apology",
          "gratitude"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 8
  }
}
```

#### Slot: comp_regular_meal

```json
{
  "responseSlot": {
    "id": "comp_regular_meal",
    "labelHint": "Comp a meal",
    "allowedVerbs": [
      "discount",
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "raise loyalty",
      "lose coin"
    ]
  },
  "consequenceProfile": {
    "id": "comp_regular_profile",
    "responseSlotId": "comp_regular_meal",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -8,
        "readable": "Comp cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": 10,
        "readable": "Loyalty rises sharply",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_comped_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "comp"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 17
  }
}
```

#### Slot: refuse_request

```json
{
  "responseSlot": {
    "id": "refuse_request",
    "labelHint": "Refuse the request",
    "allowedVerbs": [
      "blame",
      "ignore"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "hold the line",
      "lose regular"
    ]
  },
  "consequenceProfile": {
    "id": "refuse_profile",
    "responseSlotId": "refuse_request",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": -12,
        "readable": "Regular grudges",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "regular_grudge_phase163_regular_brik",
        "amount": 0,
        "readable": "Regular may turn rival",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "regular_grudge_phase163_regular_brik"
      }
    ],
    "memories": [
      {
        "id": "regular_refused_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "regular_grudge_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "risk"
        ]
      }
    ],
    "impactScore": 15
  }
}
```

#### Slot: ask_regular_to_spread_word

```json
{
  "responseSlot": {
    "id": "ask_regular_to_spread_word",
    "labelHint": "Ask them to spread the word",
    "allowedVerbs": [
      "invite",
      "negotiate"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      },
      {
        "kind": "customer_group",
        "id": "miners"
      }
    ],
    "expectedEffects": [
      "raise reputation",
      "risk credibility"
    ]
  },
  "consequenceProfile": {
    "id": "ask_regular_word_profile",
    "responseSlotId": "ask_regular_to_spread_word",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.miners.loyalty",
        "amount": 5,
        "readable": "Word spreads",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_word_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "reputation"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 8
  }
}
```

#### Slot: ban_regular

```json
{
  "responseSlot": {
    "id": "ban_regular",
    "labelHint": "Ban Brik Tallowmug",
    "allowedVerbs": [
      "ban"
    ],
    "shape": "escalation",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "phase163_regular_brik"
      }
    ],
    "expectedEffects": [
      "lose regular",
      "send signal"
    ]
  },
  "consequenceProfile": {
    "id": "ban_regular_profile",
    "responseSlotId": "ban_regular",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "regular:phase163_regular_brik",
        "amount": -25,
        "readable": "Regular banned",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "phase163_regular_brik"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "regular_banned_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "ban"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 18
  }
}
```

#### Slot: ignore_regular

```json
{
  "responseSlot": {
    "id": "ignore_regular",
    "labelHint": "Ignore the regular",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "raise regular loss pressure"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_regular_profile",
    "responseSlotId": "ignore_regular",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 6,
        "readable": "Loss pressure rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      }
    ],
    "memories": [
      {
        "id": "regular_ignored_phase163_regular_brik",
        "actors": [
          {
            "kind": "regular",
            "id": "phase163_regular_brik"
          }
        ],
        "tags": [
          "regular",
          "ignored"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 7
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "apologize_to_regular",
    "label": "Apologise to Brik Tallowmug",
    "verb": "appease",
    "targetId": "phase163_regular_brik",
    "shape": "safe_costly",
    "previewEffects": [
      "Loyalty rises"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik +8"
    ]
  },
  {
    "slotId": "comp_regular_meal",
    "label": "Comp a meal",
    "verb": "discount",
    "targetId": "phase163_regular_brik",
    "shape": "safe_costly",
    "previewEffects": [
      "Comp cost",
      "Loyalty rises sharply"
    ],
    "mechanicalEffects": [
      "Coin -8",
      "Phase163 Regular Brik +10"
    ]
  },
  {
    "slotId": "refuse_request",
    "label": "Refuse the request",
    "verb": "blame",
    "targetId": "phase163_regular_brik",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "Regular grudges"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik -12"
    ]
  },
  {
    "slotId": "ask_regular_to_spread_word",
    "label": "Ask them to spread the word",
    "verb": "invite",
    "targetId": "phase163_regular_brik",
    "shape": "long_term_investment",
    "previewEffects": [
      "Word spreads"
    ],
    "mechanicalEffects": [
      "Miners Loyalty +5"
    ]
  },
  {
    "slotId": "ban_regular",
    "label": "Ban Brik Tallowmug",
    "verb": "ban",
    "targetId": "phase163_regular_brik",
    "shape": "escalation",
    "previewEffects": [
      "Regular banned"
    ],
    "mechanicalEffects": [
      "Phase163 Regular Brik -25"
    ]
  },
  {
    "slotId": "ignore_regular",
    "label": "Ignore the regular",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [],
    "mechanicalEffects": []
  }
]
```

## customer_complaint

- **Scenario:** customer_complaint
- **Card id:** customer_complaint.complaint
- **Seed:** `seed-customer_complaint-merchants-d1`
- **Family/type/timing:** customer_complaint / complaint / during_service
- **Severity/urgency/novelty/cardWorthiness:** 71 / 71 / 100 / 86
- **Domain:** customers, reputation, service

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "c-1-61",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:adventurers.satisfaction",
      "targetType": "customer",
      "amount": -7,
      "direction": "decrease",
      "weight": 14,
      "readable": "Main room cleanliness fell below Adventurers tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "adventurers",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "adventurers"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    },
    {
      "id": "c-1-67",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:food_critic.satisfaction",
      "targetType": "customer",
      "amount": -7,
      "direction": "decrease",
      "weight": 14,
      "readable": "Main room cleanliness fell below Food Critics tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "food_critic",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "food_critic"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    },
    {
      "id": "c-1-70",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:foreign_envoy.satisfaction",
      "targetType": "customer",
      "amount": -7,
      "direction": "decrease",
      "weight": 14,
      "readable": "Main room cleanliness fell below Foreign Envoys tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "foreign_envoy",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "foreign_envoy"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    },
    {
      "id": "c-1-73",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:gourmand.satisfaction",
      "targetType": "customer",
      "amount": -7,
      "direction": "decrease",
      "weight": 14,
      "readable": "Main room cleanliness fell below Gourmands tolerance.",
      "tags": [
        "service",
        "satisfaction",
        "gourmand",
        "cleanliness",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "gourmand"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    },
    {
      "id": "pressure-reputation_drift-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "1 reputation axis/axes pushing past 70.",
      "tags": [
        "reputation",
        "identity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "merchants_loss",
      "target": "customer:merchants",
      "readable": "Merchants may stop visiting",
      "direction": "loss",
      "tags": [
        "merchants",
        "customer"
      ]
    },
    {
      "id": "reliability_loss",
      "target": "reputation:respectable",
      "readable": "Respectability may drop",
      "direction": "loss",
      "tags": [
        "reputation"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "merchants_complaint_seen",
      "actors": [
        {
          "kind": "customer_group",
          "id": "merchants"
        }
      ],
      "tags": [
        "customer",
        "complaint"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "the Merchants",
    "problemNoun": "a filthy room",
    "sensoryDetails": [
      "pursed lips",
      "half-finished mugs"
    ],
    "actorOpinions": {
      "merchants": "eye the filthy floor"
    },
    "recentContext": [
      "Main room cleanliness fell below Adventurers tolerance."
    ],
    "stakesReadable": [
      "Merchants may stop visiting",
      "respectability may drop"
    ],
    "namedEntities": [
      {
        "role": "customer_group",
        "ref": {
          "kind": "customer_group",
          "id": "merchants"
        },
        "displayName": "Merchants"
      }
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: discount

```json
{
  "responseSlot": {
    "id": "discount",
    "labelHint": "Offer Merchants a discount",
    "allowedVerbs": [
      "discount"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "merchants"
      }
    ],
    "expectedEffects": [
      "raise merchants satisfaction",
      "lose coin"
    ]
  },
  "consequenceProfile": {
    "id": "discount_profile",
    "responseSlotId": "discount",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": 10,
        "readable": "Discount appeases",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Discount cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.loyalty",
        "amount": 5,
        "readable": "Goodwill builds",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "world.regulars.starter_regular_merchants_1.loyalty",
        "amount": 6,
        "readable": "Regular feels heard",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": 6,
        "readable": "Group thawed by discount",
        "tags": [
          "customer",
          "favorite_order",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "merchants"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "merchants_discount_recently",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "customer",
          "merchants",
          "favorite_order",
          "attribution"
        ]
      },
      {
        "id": "regular_discount_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 41
  }
}
```

#### Slot: fix_root

```json
{
  "responseSlot": {
    "id": "fix_root",
    "labelHint": "Fix the root cause",
    "allowedVerbs": [
      "clean",
      "repair"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      },
      {
        "kind": "area",
        "id": "kitchen"
      }
    ],
    "expectedEffects": [
      "raise cleanliness",
      "time/coin cost"
    ]
  },
  "consequenceProfile": {
    "id": "fix_root_profile",
    "responseSlotId": "fix_root",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.cleanliness",
        "amount": 18,
        "readable": "Cleaner main_room",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -8,
        "readable": "Patched as part of clean-up",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "damage",
        "meterLabel": "damage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Cleaning cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:reputation_drift",
        "amount": -5,
        "readable": "Stabilize reputation",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "reputation_drift",
        "meterLabel": "Reputation Drift"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": 6,
        "readable": "Visible cleanup wins respect",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "cleanliness_streak_merchants",
        "amount": 8,
        "readable": "Group may expect this standard",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness_streak_merchants"
      }
    ],
    "memories": [
      {
        "id": "merchants_root_cleaned_recently",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "cleanliness",
          "main_room",
          "attribution"
        ]
      },
      {
        "id": "staff_led_cleanup_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "protected",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "cleanliness_streak_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "customer",
          "opportunity"
        ]
      }
    ],
    "impactScore": 60
  }
}
```

#### Slot: mock

```json
{
  "responseSlot": {
    "id": "mock",
    "labelHint": "Mock the complaint",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "merchants"
      },
      {
        "kind": "regular",
        "id": "starter_regular_merchants_1"
      }
    ],
    "expectedEffects": [
      "save coin",
      "lose merchants trust"
    ]
  },
  "consequenceProfile": {
    "id": "mock_profile",
    "responseSlotId": "mock",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": -15,
        "readable": "Merchants offended",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.loyalty",
        "amount": -10,
        "readable": "Trust broken",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -6,
        "readable": "Owner mocked a complaint",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": -12,
        "readable": "Merchants bear a grudge",
        "tags": [
          "customer",
          "bad_reputation",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "merchants"
      },
      {
        "kind": "cause",
        "target": "regular:starter_regular_merchants_1",
        "amount": -15,
        "readable": "Regular humiliated in public",
        "tags": [
          "regular",
          "grudge",
          "attribution"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "starter_regular_merchants_1"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 8,
        "readable": "Group spreads the story",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 6,
        "readable": "Cultural snub",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      },
      {
        "kind": "future_hook",
        "target": "merchants_boycott_possible",
        "amount": 15,
        "readable": "Merchants may boycott",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "merchants_boycott_possible"
      }
    ],
    "memories": [
      {
        "id": "merchants_mocked",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "grudge",
          "merchants",
          "bad_reputation",
          "attribution"
        ]
      },
      {
        "id": "regular_mocked_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "regular",
          "grudge",
          "ignored_complaint"
        ]
      },
      {
        "id": "tavern_mocked_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "merchants_boycott_possible",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "merchants",
          "risk"
        ]
      }
    ],
    "impactScore": 75
  }
}
```

#### Slot: rebrand

```json
{
  "responseSlot": {
    "id": "rebrand",
    "labelHint": "Rebrand the issue",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "reputation_play",
    "targetOptions": [
      {
        "kind": "system",
        "id": "reputation"
      }
    ],
    "expectedEffects": [
      "shift reputation",
      "risk audience"
    ]
  },
  "consequenceProfile": {
    "id": "rebrand_profile",
    "responseSlotId": "rebrand",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -3,
        "readable": "Respectability slips",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "state_change",
        "target": "reputation.goblinAuthentic",
        "amount": 4,
        "readable": "Authenticity grows",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "goblinAuthentic",
        "meterLabel": "goblin-authentic"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": 4,
        "readable": "Group placated by spin",
        "tags": [
          "customer",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "merchants"
      },
      {
        "kind": "state_change",
        "target": "staff.server.loyalty",
        "amount": -5,
        "readable": "Staff finds spin embarrassing",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "rebrand_locks_in_merchants",
        "amount": 10,
        "readable": "Rebrand becomes the brand",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rebrand_locks_in_merchants"
      }
    ],
    "memories": [
      {
        "id": "rebrand_attempted_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "reputation",
          "rebrand",
          "attribution"
        ]
      },
      {
        "id": "staff_witness_rebrand_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "witness"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rebrand_locks_in_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "reputation",
          "risk"
        ]
      }
    ],
    "impactScore": 29
  }
}
```

#### Slot: public_apology

```json
{
  "responseSlot": {
    "id": "public_apology",
    "labelHint": "Make a public apology to Merchants",
    "allowedVerbs": [
      "appease",
      "confess"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "merchants"
      },
      {
        "kind": "regular",
        "id": "starter_regular_merchants_1"
      }
    ],
    "expectedEffects": [
      "raise satisfaction",
      "staff feels overruled"
    ]
  },
  "consequenceProfile": {
    "id": "public_apology_profile",
    "responseSlotId": "public_apology",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 8,
        "readable": "Public humility plays well",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": 10,
        "readable": "Group accepts the apology",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": -10,
        "readable": "Regulars stay",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      },
      {
        "kind": "cause",
        "target": "regular:starter_regular_merchants_1",
        "amount": 10,
        "readable": "Named regular accepts apology",
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "starter_regular_merchants_1"
      },
      {
        "kind": "state_change",
        "target": "staff.server.morale",
        "amount": -8,
        "readable": "Staff felt thrown under",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "morale",
        "meterLabel": "morale"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "apology_expectation_merchants",
        "amount": 8,
        "readable": "Group may expect more apologies",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "apology_expectation_merchants"
      }
    ],
    "memories": [
      {
        "id": "merchants_apology_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "customer",
          "favorite_order",
          "attribution"
        ]
      },
      {
        "id": "staff_overruled_apology_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "scapegoat"
        ]
      },
      {
        "id": "tavern_apology_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "honesty"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "apology_expectation_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "customer"
        ]
      }
    ],
    "impactScore": 57
  }
}
```

#### Slot: side_with_staff

```json
{
  "responseSlot": {
    "id": "side_with_staff",
    "labelHint": "Back Mira the Resolute over the complaint",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "server"
      },
      {
        "kind": "customer_group",
        "id": "merchants"
      }
    ],
    "expectedEffects": [
      "raise staff loyalty",
      "lose group trust"
    ]
  },
  "consequenceProfile": {
    "id": "side_with_staff_profile",
    "responseSlotId": "side_with_staff",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "staff.server.loyalty",
        "amount": 12,
        "readable": "Staff backed by owner",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "cause",
        "target": "staff:server",
        "amount": 8,
        "readable": "Staff publicly backed",
        "tags": [
          "staff",
          "protected",
          "attribution"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "server"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": -10,
        "readable": "Group rebuffed",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -4,
        "readable": "Public side-taking",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": -10,
        "readable": "Group feels dismissed",
        "tags": [
          "customer",
          "bad_reputation",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "merchants"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": -6,
        "readable": "Loyalty risk eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "staff_backing_remembered_server",
        "amount": 10,
        "readable": "Staff remember the backing",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_backing_remembered_server"
      }
    ],
    "memories": [
      {
        "id": "staff_publicly_backed_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "protected",
          "attribution"
        ]
      },
      {
        "id": "merchants_dismissed",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "grudge",
          "merchants",
          "ignored_complaint",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_backing_remembered_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "opportunity"
        ]
      }
    ],
    "impactScore": 56
  }
}
```

#### Slot: side_with_regular

```json
{
  "responseSlot": {
    "id": "side_with_regular",
    "labelHint": "Side with Master Faline Cargoright",
    "allowedVerbs": [
      "appease"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "starter_regular_merchants_1"
      }
    ],
    "expectedEffects": [
      "raise regular loyalty",
      "staff feels betrayed"
    ]
  },
  "consequenceProfile": {
    "id": "side_with_regular_profile",
    "responseSlotId": "side_with_regular",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "world.regulars.starter_regular_merchants_1.loyalty",
        "amount": 12,
        "readable": "Regular elevated",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "cause",
        "target": "regular:starter_regular_merchants_1",
        "amount": 12,
        "readable": "Regular championed",
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "starter_regular_merchants_1"
      },
      {
        "kind": "state_change",
        "target": "staff.server.loyalty",
        "amount": -10,
        "readable": "Staff publicly overruled",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "state_change",
        "target": "staff.server.morale",
        "amount": -6,
        "readable": "Staff morale slumps",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "morale",
        "meterLabel": "morale"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": 8,
        "readable": "Loyalty risk spikes",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": -8,
        "readable": "Regulars stay",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "staff_betrayal_remembered_server",
        "amount": 12,
        "readable": "Staff remember being overruled",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_betrayal_remembered_server"
      }
    ],
    "memories": [
      {
        "id": "regular_championed_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ]
      },
      {
        "id": "staff_overruled_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "scapegoat",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "staff_betrayal_remembered_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "risk"
        ]
      }
    ],
    "impactScore": 64
  }
}
```

#### Slot: house_rule_change

```json
{
  "responseSlot": {
    "id": "house_rule_change",
    "labelHint": "Change the house rules",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "system",
        "id": "house_rules"
      },
      {
        "kind": "customer_group",
        "id": "merchants"
      }
    ],
    "expectedEffects": [
      "policy shift",
      "cultural friction"
    ]
  },
  "consequenceProfile": {
    "id": "house_rule_change_profile",
    "responseSlotId": "house_rule_change",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 4,
        "readable": "Codifies a standard",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 6,
        "readable": "Some groups bristle",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      },
      {
        "kind": "pressure",
        "target": "pressure:policy_backlash",
        "amount": 10,
        "readable": "Rule sticks in throats",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "policy_backlash",
        "meterLabel": "Policy Backlash"
      },
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 5,
        "readable": "Some regulars drift",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": 4,
        "readable": "Group sees the change",
        "tags": [
          "customer",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "merchants"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "house_rule_friction_merchants",
        "amount": 12,
        "readable": "House rule will see friction",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "house_rule_friction_merchants"
      }
    ],
    "memories": [
      {
        "id": "house_rule_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "policy",
          "attribution"
        ]
      },
      {
        "id": "regular_rule_witness_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "regular",
          "memory"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "house_rule_friction_merchants",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          }
        ],
        "tags": [
          "policy",
          "risk"
        ]
      }
    ],
    "impactScore": 39
  }
}
```

#### Slot: comp_table

```json
{
  "responseSlot": {
    "id": "comp_table",
    "labelHint": "Comp Merchants's table",
    "allowedVerbs": [
      "discount",
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "merchants"
      },
      {
        "kind": "regular",
        "id": "starter_regular_merchants_1"
      }
    ],
    "expectedEffects": [
      "raise satisfaction broadly",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "comp_table_profile",
    "responseSlotId": "comp_table",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Comp cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.satisfaction",
        "amount": 12,
        "readable": "Whole table beams",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "state_change",
        "target": "customers.miners.satisfaction",
        "amount": 5,
        "readable": "Neighbouring table cheers",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      },
      {
        "kind": "cause",
        "target": "customer_group:miners",
        "amount": 5,
        "readable": "Hospitality spreads",
        "tags": [
          "customer",
          "favorite_order",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "miners"
      },
      {
        "kind": "cause",
        "target": "customer_group:merchants",
        "amount": 10,
        "readable": "Group remembers the comp",
        "tags": [
          "customer",
          "favorite_order",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "merchants"
      },
      {
        "kind": "state_change",
        "target": "world.regulars.starter_regular_merchants_1.loyalty",
        "amount": 10,
        "readable": "Regular elevated",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "merchants_comped_table",
        "actors": [
          {
            "kind": "customer_group",
            "id": "merchants"
          },
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "customer",
          "merchants",
          "favorite_order",
          "attribution"
        ]
      },
      {
        "id": "regular_comped_starter_regular_merchants_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_merchants_1"
          }
        ],
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 57
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "fix_root",
    "label": "Fix the root cause",
    "verb": "clean",
    "targetId": "main_room",
    "shape": "long_term_investment",
    "previewEffects": [
      "a step of real work would settle the kitchen",
      "coin would leave the till by a step",
      "the meter would settle a step lower",
      "later: Group may expect this standard"
    ],
    "mechanicalEffects": [
      "Main Room Cleanliness +18",
      "Coin -10",
      "Reputation Drift -5",
      "later: Group may expect this standard"
    ]
  },
  {
    "slotId": "public_apology",
    "label": "Apologise to the whole room",
    "verb": "appease",
    "targetId": "merchants",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "respectable standing would gain a step in talk",
      "satisfaction would rise a real step with the patrons",
      "pressure would fall back a clear drop",
      "later: Group may expect more apologies"
    ],
    "mechanicalEffects": [
      "Reputation Respectable +8",
      "Merchants Satisfaction +10",
      "Regular Customer Loss -10",
      "later: Group may expect more apologies"
    ]
  },
  {
    "slotId": "side_with_regular",
    "label": "Side with Master Faline Cargoright",
    "verb": "appease",
    "targetId": "starter_regular_merchants_1",
    "shape": "safe_costly",
    "previewEffects": [
      "loyalty would deepen a real step with the regular (Master Faline Cargoright)",
      "Regular championed",
      "the loyalty risk would climb a step higher tonight",
      "later: Staff remember being overruled"
    ],
    "mechanicalEffects": [
      "Master Faline Cargoright Loyalty +12",
      "Master Faline Cargoright +12",
      "Staff Loyalty Risk +8",
      "later: Staff remember being overruled"
    ]
  },
  {
    "slotId": "house_rule_change",
    "label": "Reframe the night",
    "verb": "rebrand",
    "targetId": "house_rules",
    "shape": "long_term_investment",
    "previewEffects": [
      "a hair of repute would settle on the name",
      "cultural tension would climb a step tonight",
      "a marked rise would press onto the meter",
      "later: House rule will see friction"
    ],
    "mechanicalEffects": [
      "Reputation Respectable +4",
      "Cultural Tension +6",
      "Policy Backlash +10",
      "later: House rule will see friction"
    ]
  },
  {
    "slotId": "side_with_staff",
    "label": "Back Mira the Resolute over the complaint",
    "verb": "blame",
    "targetId": "server",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "loyalty would climb a real step with the crew (Mira the Resolute)",
      "Staff publicly backed",
      "the loyalty risk would ease a step off the crew",
      "later: Staff remember the backing"
    ],
    "mechanicalEffects": [
      "Mira the Resolute Loyalty +12",
      "Mira the Resolute +8",
      "Staff Loyalty Risk -6",
      "later: Staff remember the backing"
    ]
  },
  {
    "slotId": "discount",
    "label": "Comp the round",
    "verb": "discount",
    "targetId": "merchants",
    "shape": "safe_costly",
    "previewEffects": [
      "Discount appeases",
      "a measure of coppers would leave the till",
      "loyalty would warm a step with the regular"
    ],
    "mechanicalEffects": [
      "Merchants Satisfaction +10",
      "Coin -10",
      "Merchants Loyalty +5"
    ]
  }
]
```

## violence

- **Scenario:** violence
- **Card id:** violence.customer_incident
- **Seed:** `seed-violence-ogres-d1`
- **Family/type/timing:** violence / customer_incident / during_service
- **Severity/urgency/novelty/cardWorthiness:** 60 / 68 / 100 / 81
- **Domain:** customers, service, maintenance

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-violence-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.violence",
      "sourceType": "pressure",
      "target": "pressure:violence",
      "targetType": "pressure",
      "amount": 14,
      "direction": "increase",
      "weight": 14,
      "readable": "Ogre patronage heavy (85).",
      "tags": [
        "customer",
        "ogres"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-violence-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.violence",
      "sourceType": "pressure",
      "target": "pressure:violence",
      "targetType": "pressure",
      "amount": 10,
      "direction": "increase",
      "weight": 10,
      "readable": "Ogres rowdy (90).",
      "tags": [
        "customer",
        "rowdiness"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-violence-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.violence",
      "sourceType": "pressure",
      "target": "pressure:violence",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "Adventurers in the room (60).",
      "tags": [
        "customer",
        "adventurers"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-73",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers.impact",
      "sourceType": "service",
      "target": "area:main_room.damage",
      "targetType": "area",
      "amount": 34,
      "direction": "increase",
      "weight": 136,
      "readable": "Ogres traffic caused +34 main room damage.",
      "tags": [
        "service",
        "customer_impact",
        "ogres",
        "damage",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "ogres"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 1
    },
    {
      "id": "c-1-83",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "customers.impact",
      "sourceType": "service",
      "target": "area:main_room.damage",
      "targetType": "area",
      "amount": 17,
      "direction": "increase",
      "weight": 68,
      "readable": "Ogres traffic caused +17 main room damage.",
      "tags": [
        "service",
        "customer_impact",
        "ogres",
        "damage",
        "main_room"
      ],
      "relatedActors": [
        {
          "kind": "customer_group",
          "id": "ogres"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "relatedSystems": [
        "customers",
        "areas"
      ],
      "ageDays": 0
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "damage_stake",
      "target": "area:private_booth",
      "readable": "Customer-facing space may take damage",
      "direction": "loss",
      "tags": [
        "damage"
      ]
    },
    {
      "id": "merchant_loss",
      "target": "customer:merchants",
      "readable": "Merchants may flee",
      "direction": "risk",
      "tags": [
        "merchants"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "violence_warning_seen",
      "tags": [
        "violence",
        "warning"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "brawl_possible",
      "tags": [
        "violence",
        "risk"
      ]
    }
  ],
  "textIngredients": {
    "subject": "main room",
    "problemNoun": "persistent volatile energy",
    "sensoryDetails": [
      "shouting voices",
      "patched stools"
    ],
    "actorOpinions": {
      "ogres": "spoiling for trouble"
    },
    "recentContext": [
      "brawl this week",
      "damage rising"
    ],
    "stakesReadable": [
      "main room may break",
      "merchants may flee"
    ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "contractChecks": {
      "clear_situation": true,
      "reason_now": true,
      "actor_or_group": true,
      "location_or_system": true,
      "at_least_two_causes": true,
      "at_least_two_responses": true,
      "short_term_consequences": true,
      "memory_or_future_hook": true,
      "no_contradictions": true,
      "reason_to_care": true
    }
  }
}
```

### Authored slots and consequence profiles

#### Slot: hire_security

```json
{
  "responseSlot": {
    "id": "hire_security",
    "labelHint": "Hire security",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "system",
        "id": "security"
      }
    ],
    "expectedEffects": [
      "lower violence pressure",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "hire_security_profile",
    "responseSlotId": "hire_security",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Hire security cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:violence",
        "amount": -15,
        "readable": "Lower violence pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "violence",
        "meterLabel": "Violence"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": 4,
        "readable": "Security crew tires the staff coordination",
        "tags": [
          "pressure",
          "staff",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      },
      {
        "kind": "future_hook",
        "target": "security_routine_possible",
        "amount": 14,
        "readable": "Security may become a routine fixture",
        "tags": [
          "future_hook",
          "security"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "security_routine_possible"
      }
    ],
    "memories": [
      {
        "id": "security_hired_recently",
        "tags": [
          "security",
          "violence"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "security_routine_possible",
        "tags": [
          "security",
          "violence",
          "opportunity"
        ]
      }
    ],
    "impactScore": 47
  }
}
```

#### Slot: ban_group

```json
{
  "responseSlot": {
    "id": "ban_group",
    "labelHint": "Ban the rowdiest group",
    "allowedVerbs": [
      "ban"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "ogres"
      }
    ],
    "expectedEffects": [
      "lower danger",
      "lose patronage"
    ]
  },
  "consequenceProfile": {
    "id": "ban_group_profile",
    "responseSlotId": "ban_group",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.ogres.patronage",
        "amount": -25,
        "readable": "Group banned",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "pressure",
        "target": "pressure:violence",
        "amount": -12,
        "readable": "Lower violence pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "violence",
        "meterLabel": "Violence"
      },
      {
        "kind": "cause",
        "target": "customer_group:ogres",
        "amount": -20,
        "readable": "ogres group banned",
        "tags": [
          "customer",
          "ban",
          "ogres"
        ],
        "targetKind": "cohort",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "ogres"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "banned_group_returns_ogres",
        "amount": 14,
        "readable": "ogres may try to return",
        "tags": [
          "future_hook",
          "customer",
          "ogres"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "banned_group_returns_ogres"
      }
    ],
    "memories": [
      {
        "id": "ogres_banned",
        "actors": [
          {
            "kind": "customer_group",
            "id": "ogres"
          }
        ],
        "tags": [
          "ban",
          "customer",
          "ogres"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "banned_group_returns_ogres",
        "actors": [
          {
            "kind": "customer_group",
            "id": "ogres"
          }
        ],
        "tags": [
          "customer",
          "ogres",
          "risk"
        ]
      }
    ],
    "impactScore": 60
  }
}
```

#### Slot: embrace_rowdy

```json
{
  "responseSlot": {
    "id": "embrace_rowdy",
    "labelHint": "Embrace the chaos",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "reputation_play",
    "targetOptions": [
      {
        "kind": "system",
        "id": "reputation"
      }
    ],
    "expectedEffects": [
      "raise dangerous reputation",
      "lose merchants"
    ]
  },
  "consequenceProfile": {
    "id": "embrace_rowdy_profile",
    "responseSlotId": "embrace_rowdy",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 6,
        "readable": "Dangerous rises",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -4,
        "readable": "Respectability falls",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": -8,
        "readable": "Merchants drift away from the rowdy rep",
        "tags": [
          "customer",
          "merchants",
          "delay:5"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "future_hook",
        "target": "dangerous_rep_locked",
        "amount": 10,
        "readable": "Dangerous reputation may lock in",
        "tags": [
          "future_hook",
          "reputation",
          "dangerous"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dangerous_rep_locked"
      }
    ],
    "memories": [
      {
        "id": "rowdy_identity_embraced",
        "tags": [
          "reputation",
          "identity"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "dangerous_rep_locked",
        "tags": [
          "reputation",
          "dangerous",
          "identity"
        ]
      }
    ],
    "impactScore": 27
  }
}
```

#### Slot: repair_damage

```json
{
  "responseSlot": {
    "id": "repair_damage",
    "labelHint": "Repair the damage",
    "allowedVerbs": [
      "repair"
    ],
    "shape": "short_term_patch",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "lower damage",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "repair_damage_profile",
    "responseSlotId": "repair_damage",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -20,
        "readable": "Repair damage",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "damage",
        "meterLabel": "damage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -12,
        "readable": "Repair cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": 3,
        "readable": "Repair shifts tire the crew",
        "tags": [
          "pressure",
          "staff",
          "delay:3"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      },
      {
        "kind": "future_hook",
        "target": "main_room_resilient",
        "amount": 10,
        "readable": "main_room may shrug off later damage",
        "tags": [
          "future_hook",
          "area",
          "main_room"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "main_room_resilient"
      }
    ],
    "memories": [
      {
        "id": "main_room_repaired_recently",
        "tags": [
          "maintenance",
          "main_room"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "main_room_resilient",
        "tags": [
          "area",
          "main_room",
          "opportunity"
        ]
      }
    ],
    "impactScore": 45
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "hire_security",
    "label": "Bring shoulders in tonight",
    "verb": "pay",
    "targetId": "security",
    "shape": "safe_costly",
    "previewEffects": [
      "a clear drop of silver would leave the till",
      "the violence risk would fall a real slip back",
      "later: A risk of return would remain on the slate"
    ],
    "mechanicalEffects": [
      "Coin -20",
      "Violence -15",
      "later: Security may become a routine fixture"
    ]
  },
  {
    "slotId": "ban_group",
    "label": "Bar them at the door",
    "verb": "ban",
    "targetId": "ogres",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "patronage would collapse a heavy fall among the regulars",
      "the violence risk would drain a clear drop tonight",
      "a heavy fall would empty the cohort table",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Ogres Patronage -25",
      "Violence -12",
      "Ogres -20",
      "later: ogres may try to return"
    ]
  },
  {
    "slotId": "embrace_rowdy",
    "label": "Make a virtue of the chaos",
    "verb": "rebrand",
    "targetId": "reputation",
    "shape": "reputation_play",
    "previewEffects": [
      "a dangerous name would spread a step through talk",
      "talk would dim a touch around the tavern",
      "later: The house would gain a rougher name"
    ],
    "mechanicalEffects": [
      "Reputation Dangerous +6",
      "Reputation Respectable -4",
      "later: Dangerous reputation may lock in"
    ]
  },
  {
    "slotId": "repair_damage",
    "label": "Fix the room",
    "verb": "repair",
    "targetId": "main_room",
    "shape": "short_term_patch",
    "previewEffects": [
      "a quick patch would lift the corner a step",
      "a notch of silver would slip from the purse",
      "later: main_room may shrug off later damage"
    ],
    "mechanicalEffects": [
      "Main Room Damage -20",
      "Coin -12",
      "later: main_room may shrug off later damage"
    ]
  }
]
```
