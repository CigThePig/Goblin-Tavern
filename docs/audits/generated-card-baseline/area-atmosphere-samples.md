# Area & Atmosphere Samples

## food_safety

- **Scenario:** food_safety
- **Card id:** food_safety.crisis
- **Seed:** `seed-food_safety-mushrooms-d1`
- **Family/type/timing:** food_safety / crisis / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 62 / 62 / 100 / 80
- **Domain:** food, kitchen, stock

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-food_safety-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.food_safety",
      "sourceType": "pressure",
      "target": "pressure:food_safety",
      "targetType": "pressure",
      "amount": 22,
      "direction": "increase",
      "weight": 22,
      "readable": "Kitchen cleanliness very low (10).",
      "tags": [
        "kitchen",
        "cleanliness"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-food_safety-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.food_safety",
      "sourceType": "pressure",
      "target": "pressure:food_safety",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Kitchen smell heavy (80).",
      "tags": [
        "kitchen",
        "smell"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-food_safety-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.food_safety",
      "sourceType": "pressure",
      "target": "pressure:food_safety",
      "targetType": "pressure",
      "amount": 18,
      "direction": "increase",
      "weight": 18,
      "readable": "Stew spoilage high (80).",
      "tags": [
        "stock",
        "stew",
        "spoilage"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-114",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.food_safety",
      "sourceType": "pressure",
      "target": "pressure:food_safety",
      "targetType": "pressure",
      "amount": 27,
      "direction": "increase",
      "weight": 27,
      "readable": "Kitchen cleanliness very low (10).",
      "tags": [
        "pressure",
        "food_safety",
        "food",
        "kitchen",
        "risk"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "kitchen"
        }
      ],
      "relatedSystems": [
        "stock",
        "areas",
        "staff"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-115",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.food_safety",
      "sourceType": "pressure",
      "target": "pressure:food_safety",
      "targetType": "pressure",
      "amount": 27,
      "direction": "increase",
      "weight": 27,
      "readable": "Kitchen cleanliness very low (10).",
      "tags": [
        "pressure",
        "food_safety",
        "food",
        "kitchen",
        "risk"
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "kitchen"
        }
      ],
      "relatedSystems": [
        "stock",
        "areas",
        "staff"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "food_safety",
      "label": "Food Safety",
      "value": 62,
      "previousValue": 35,
      "delta": 27,
      "trend": "stable",
      "severity": 62,
      "urgency": 62,
      "volatility": 100,
      "causes": [
        {
          "id": "kitchen_filthy_heavy",
          "readable": "Kitchen cleanliness very low (10).",
          "amount": 22,
          "weight": 22,
          "direction": "increase",
          "tags": [
            "kitchen",
            "cleanliness"
          ],
          "relatedLocations": [
            {
              "kind": "area",
              "id": "kitchen"
            }
          ],
          "relatedSystems": [
            "areas"
          ],
          "origin": "inherited"
        },
        {
          "id": "kitchen_smell_heavy",
          "readable": "Kitchen smell heavy (80).",
          "amount": 12,
          "weight": 12,
          "direction": "increase",
          "tags": [
            "kitchen",
            "smell"
          ],
          "relatedLocations": [
            {
              "kind": "area",
              "id": "kitchen"
            }
          ],
          "relatedSystems": [
            "areas"
          ],
          "origin": "inherited"
        },
        {
          "id": "stew_spoiled_heavy",
          "readable": "Stew spoilage high (80).",
          "amount": 18,
          "weight": 18,
          "direction": "increase",
          "tags": [
            "stock",
            "stew",
            "spoilage"
          ],
          "relatedSystems": [
            "stock"
          ],
          "origin": "decay"
        },
        {
          "id": "mushrooms_spoiled",
          "readable": "Mushroom spoilage high (90).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "stock",
            "mushrooms",
            "spoilage"
          ],
          "relatedSystems": [
            "stock"
          ],
          "origin": "decay"
        }
      ],
      "relatedActors": [
        {
          "kind": "staff",
          "id": "cook"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "kitchen"
        }
      ],
      "relatedSystems": [
        "stock",
        "areas",
        "staff"
      ],
      "tags": [
        "food",
        "kitchen",
        "risk"
      ],
      "consequences": [
        "Customers may fall ill if pressure keeps climbing.",
        "Inspection pressure will rise."
      ],
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
      "id": "food_safety_stake",
      "target": "pressure:food_safety",
      "readable": "Customers may get sick",
      "direction": "loss",
      "tags": [
        "food_safety"
      ]
    },
    {
      "id": "inspection_stake",
      "target": "pressure:inspection",
      "readable": "Inspectors may visit",
      "direction": "risk",
      "tags": [
        "inspection"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "food_safety_warning_seen",
      "tags": [
        "food_safety",
        "warning"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "food_poisoning_rumor_possible",
      "tags": [
        "food_safety",
        "rumor"
      ]
    }
  ],
  "textIngredients": {
    "subject": "the mushrooms",
    "problemNoun": "blue foam",
    "sensoryDetails": [
      "blue mushroom foam",
      "vinegar stew stink",
      "greasy floor"
    ],
    "actorOpinions": {
      "cook": "insists it is fine",
      "merchants": "look horrified"
    },
    "recentContext": [
      "kitchen filthy for days"
    ],
    "stakesReadable": [
      "customers may get sick",
      "inspectors may visit"
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

#### Slot: discard_stock

```json
{
  "responseSlot": {
    "id": "discard_stock",
    "labelHint": "Discard questionable stock",
    "allowedVerbs": [
      "discard"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "mushrooms"
      },
      {
        "kind": "stock",
        "id": "stew"
      }
    ],
    "expectedEffects": [
      "reduce food safety pressure",
      "lose stock"
    ]
  },
  "consequenceProfile": {
    "id": "discard_stock_profile",
    "responseSlotId": "discard_stock",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.mushrooms.quantity",
        "amount": -20,
        "readable": "Discard mushrooms",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "quantity",
        "meterLabel": "quantity"
      },
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": -12,
        "readable": "Lower food safety risk",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "food_safety",
        "meterLabel": "Food Safety"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -3,
        "readable": "Customers notice the shortage",
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
    "memories": [
      {
        "id": "discarded_unsafe_stock_recently",
        "tags": [
          "stock",
          "food_safety"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 35
  }
}
```

#### Slot: clean_kitchen

```json
{
  "responseSlot": {
    "id": "clean_kitchen",
    "labelHint": "Clean the kitchen",
    "allowedVerbs": [
      "clean"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "kitchen"
      }
    ],
    "expectedEffects": [
      "raise kitchen cleanliness",
      "time and effort cost"
    ]
  },
  "consequenceProfile": {
    "id": "clean_kitchen_profile",
    "responseSlotId": "clean_kitchen",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.kitchen.cleanliness",
        "amount": 25,
        "readable": "Kitchen cleaner",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness"
      },
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": -10,
        "readable": "Lower food safety risk",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "food_safety",
        "meterLabel": "Food Safety"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "kitchen_cleaned_recently",
        "tags": [
          "kitchen",
          "cleanliness"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "kitchen_inspection_followup",
        "tags": [
          "food_safety",
          "inspection"
        ]
      }
    ],
    "impactScore": 41
  }
}
```

#### Slot: serve_anyway

```json
{
  "responseSlot": {
    "id": "serve_anyway",
    "labelHint": "Serve it anyway",
    "allowedVerbs": [
      "serve"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "stew"
      }
    ],
    "expectedEffects": [
      "keep coin from sales",
      "raise food safety risk",
      "raise inspection pressure"
    ]
  },
  "consequenceProfile": {
    "id": "serve_anyway_profile",
    "responseSlotId": "serve_anyway",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 15,
        "readable": "Earn coin from sales",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": 8,
        "readable": "Food safety risk rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "food_safety",
        "meterLabel": "Food Safety"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": 6,
        "readable": "Inspection risk rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "food_poisoning_rumor_possible",
        "amount": 0,
        "readable": "Food poisoning rumor may emerge later",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "food_poisoning_rumor_possible"
      }
    ],
    "memories": [
      {
        "id": "served_questionable_stew",
        "tags": [
          "stew",
          "food_safety",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "food_poisoning_rumor_possible",
        "tags": [
          "food_safety",
          "rumor"
        ]
      }
    ],
    "impactScore": 34
  }
}
```

#### Slot: blame_supplier

```json
{
  "responseSlot": {
    "id": "blame_supplier",
    "labelHint": "Blame the supplier",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "system",
        "id": "supplier"
      }
    ],
    "expectedEffects": [
      "avoid immediate blame",
      "create supplier grudge memory"
    ]
  },
  "consequenceProfile": {
    "id": "blame_supplier_profile",
    "responseSlotId": "blame_supplier",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "global",
        "amount": 0,
        "readable": "Push blame onto supplier",
        "tags": [
          "blame"
        ],
        "targetKind": "global",
        "direction": "neutral",
        "meterId": "global"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "supplier_retaliation_possible",
        "amount": 0,
        "readable": "Supplier may retaliate later",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "supplier_retaliation_possible"
      }
    ],
    "memories": [
      {
        "id": "supplier_blamed_for_bad_mushrooms",
        "tags": [
          "supplier",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "supplier_retaliation_possible",
        "tags": [
          "supplier",
          "risk"
        ]
      }
    ],
    "impactScore": 8
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "discard_stock",
    "label": "Bin the bad stock",
    "verb": "discard",
    "targetId": "mushrooms",
    "shape": "safe_costly",
    "previewEffects": [
      "a notch would draw from the cellar stores",
      "the food-safety risk would ease a clear drop tonight"
    ],
    "mechanicalEffects": [
      "Mushrooms Quantity -20",
      "Food Safety -12"
    ]
  },
  {
    "slotId": "clean_kitchen",
    "label": "Scrub it",
    "verb": "clean",
    "targetId": "kitchen",
    "shape": "long_term_investment",
    "previewEffects": [
      "a clear lift would brighten the room",
      "the kitchen risk would fall a real slip tonight"
    ],
    "mechanicalEffects": [
      "Kitchen Cleanliness +25",
      "Food Safety -10"
    ]
  },
  {
    "slotId": "serve_anyway",
    "label": "Run it through service",
    "verb": "serve",
    "targetId": "stew",
    "shape": "risky_profitable",
    "previewEffects": [
      "a notch of silver would land in the purse",
      "the food-safety risk would climb a step higher",
      "Inspection risk rises",
      "later: A flag would mark the slate for later"
    ],
    "mechanicalEffects": [
      "Coin +15",
      "Food Safety +8",
      "Inspection +6",
      "later: Food poisoning rumor may emerge later"
    ]
  },
  {
    "slotId": "blame_supplier",
    "label": "Pin it on the supplier",
    "verb": "blame",
    "targetId": "supplier",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "The blame would land elsewhere, for now",
      "later: A rumour would sit on the slate, waiting to surface"
    ],
    "mechanicalEffects": [
      "Push blame onto supplier",
      "later: Supplier may retaliate later"
    ]
  }
]
```

## maintenance

- **Scenario:** maintenance
- **Card id:** maintenance.maintenance_problem
- **Seed:** `seed-maintenance-main_room-d1`
- **Family/type/timing:** maintenance / maintenance_problem / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 92 / 92 / 100 / 99
- **Domain:** areas, maintenance

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-maintenance-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.maintenance",
      "sourceType": "pressure",
      "target": "pressure:maintenance",
      "targetType": "pressure",
      "amount": 16,
      "direction": "increase",
      "weight": 16,
      "readable": "Main Room damage heavy (89).",
      "tags": [
        "area",
        "damage",
        "main_room"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-maintenance-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.maintenance",
      "sourceType": "pressure",
      "target": "pressure:maintenance",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Main Room condition poor (15).",
      "tags": [
        "area",
        "condition",
        "main_room"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-maintenance-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.maintenance",
      "sourceType": "pressure",
      "target": "pressure:maintenance",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Privy condition poor (25).",
      "tags": [
        "area",
        "condition",
        "privy"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-35",
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
      "amount": 4,
      "direction": "increase",
      "weight": 16,
      "readable": "Adventurers traffic caused +4 main room damage.",
      "tags": [
        "service",
        "customer_impact",
        "adventurers",
        "damage",
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
      "ageDays": 1
    },
    {
      "id": "c-0-78",
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
      "amount": 4,
      "direction": "increase",
      "weight": 16,
      "readable": "Ogres traffic caused +4 main room damage.",
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
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "damage_stake",
      "target": "area:main_room",
      "readable": "Main Room may collapse",
      "direction": "loss",
      "tags": [
        "maintenance"
      ]
    },
    {
      "id": "service_stake",
      "target": "service:capacity",
      "readable": "Service may suffer",
      "direction": "risk",
      "tags": [
        "service"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "maintenance_warning_seen",
      "tags": [
        "maintenance",
        "warning"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "area_failure_possible",
      "tags": [
        "maintenance",
        "risk"
      ]
    }
  ],
  "textIngredients": {
    "subject": "main room",
    "problemNoun": "visible damage",
    "sensoryDetails": [
      "cracked plank",
      "creaking timber"
    ],
    "actorOpinions": {
      "staff": "eye the damage warily"
    },
    "recentContext": [
      "damage worsening over days"
    ],
    "stakesReadable": [
      "Main Room may collapse",
      "service may suffer"
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

#### Slot: repair

```json
{
  "responseSlot": {
    "id": "repair",
    "labelHint": "Repair Main Room",
    "allowedVerbs": [
      "repair"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "raise area condition",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "repair_profile",
    "responseSlotId": "repair",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -25,
        "readable": "Repair damage",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "damage",
        "meterLabel": "damage"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": 20,
        "readable": "Raise condition",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "condition",
        "meterLabel": "condition"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -25,
        "readable": "Pay for repair",
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
        "target": "pressure:maintenance",
        "amount": -12,
        "readable": "Lower maintenance pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "maintenance",
        "meterLabel": "Maintenance"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:maintenance",
        "amount": -4,
        "readable": "Repair beds in",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "maintenance",
        "meterLabel": "Maintenance"
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
        "id": "repair_inspection_followup",
        "tags": [
          "maintenance",
          "inspection"
        ]
      }
    ],
    "impactScore": 90
  }
}
```

#### Slot: patch

```json
{
  "responseSlot": {
    "id": "patch",
    "labelHint": "Patch temporarily",
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
      "small condition gain",
      "cheap"
    ]
  },
  "consequenceProfile": {
    "id": "patch_profile",
    "responseSlotId": "patch",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -10,
        "readable": "Patch damage",
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
        "amount": -8,
        "readable": "Cheap patch cost",
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
        "kind": "future_hook",
        "target": "failed_patch_possible",
        "amount": 0,
        "readable": "Patch may fail later",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "failed_patch_possible"
      }
    ],
    "memories": [
      {
        "id": "main_room_patched_recently",
        "tags": [
          "maintenance",
          "main_room",
          "patch"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "failed_patch_possible",
        "tags": [
          "maintenance",
          "risk"
        ]
      }
    ],
    "impactScore": 26
  }
}
```

#### Slot: ignore

```json
{
  "responseSlot": {
    "id": "ignore",
    "labelHint": "Ignore the damage",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "risk failure later"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_profile",
    "responseSlotId": "ignore",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:maintenance",
        "amount": 6,
        "readable": "Maintenance pressure worsens",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "maintenance",
        "meterLabel": "Maintenance"
      }
    ],
    "memories": [
      {
        "id": "habitual_roof_neglect",
        "tags": [
          "maintenance",
          "ignored"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 7
  }
}
```

#### Slot: close_area

```json
{
  "responseSlot": {
    "id": "close_area",
    "labelHint": "Close Main Room",
    "allowedVerbs": [
      "delay"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "stop further damage",
      "lose service capacity"
    ]
  },
  "consequenceProfile": {
    "id": "close_area_profile",
    "responseSlotId": "close_area",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.risk",
        "amount": -10,
        "readable": "Reduce risk",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "risk",
        "meterLabel": "risk"
      },
      {
        "kind": "state_change",
        "target": "customers.miners.satisfaction",
        "amount": -5,
        "readable": "Customers inconvenienced",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "main_room_closed_recently",
        "tags": [
          "maintenance",
          "main_room"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 18
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "repair",
    "label": "Fix it before it falls",
    "verb": "repair",
    "targetId": "main_room",
    "shape": "long_term_investment",
    "previewEffects": [
      "the floor would gain a real step of polish",
      "a clear drop of silver would leave the till",
      "the reading would quiet by a real slip"
    ],
    "mechanicalEffects": [
      "Main Room Damage -25",
      "Coin -25",
      "Maintenance -12"
    ]
  },
  {
    "slotId": "patch",
    "label": "Patch it for now",
    "verb": "repair",
    "targetId": "main_room",
    "shape": "short_term_patch",
    "previewEffects": [
      "a quick patch would lift the corner a step",
      "a notch of silver would slip from the purse",
      "later: A risk of failure would remain on the slate"
    ],
    "mechanicalEffects": [
      "Main Room Damage -10",
      "Coin -8",
      "later: Patch may fail later"
    ]
  },
  {
    "slotId": "ignore",
    "label": "Leave it as is",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "the meter would mount a notch with every hour"
    ],
    "mechanicalEffects": [
      "Maintenance +6"
    ]
  },
  {
    "slotId": "close_area",
    "label": "Close the room off",
    "verb": "delay",
    "targetId": "main_room",
    "shape": "compromise",
    "previewEffects": [
      "the floor would read by a step cleaner",
      "satisfaction would slip a step from the regulars (Miners)"
    ],
    "mechanicalEffects": [
      "Main Room Risk -10",
      "Miners Satisfaction -5"
    ]
  }
]
```

## area_atmosphere

- **Scenario:** area_atmosphere
- **Card id:** area_atmosphere.warning
- **Seed:** `seed-area_atmosphere-main_room-d1`
- **Family/type/timing:** area_atmosphere / warning / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 75 / 30 / 100 / 71
- **Domain:** areas, atmosphere

### Authored simulation data

```json
{
  "causes": [
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
      "amount": 4,
      "direction": "increase",
      "weight": 16,
      "readable": "Ogres traffic caused +4 main room damage.",
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
      "id": "c-0-81",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:adventurers.satisfaction",
      "targetType": "customer",
      "amount": -6,
      "direction": "decrease",
      "weight": 12,
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
      "target": "customer:foreign_envoy.satisfaction",
      "targetType": "customer",
      "amount": -6,
      "direction": "decrease",
      "weight": 12,
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
      "ageDays": 1
    },
    {
      "id": "c-0-93",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers",
      "sourceType": "service",
      "target": "customer:gourmand.satisfaction",
      "targetType": "customer",
      "amount": -6,
      "direction": "decrease",
      "weight": 12,
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
      "ageDays": 1
    },
    {
      "id": "pressure-maintenance-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.maintenance",
      "sourceType": "pressure",
      "target": "pressure:maintenance",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "Main Room damage visible (56).",
      "tags": [
        "area",
        "damage",
        "main_room"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-maintenance-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.maintenance",
      "sourceType": "pressure",
      "target": "pressure:maintenance",
      "targetType": "pressure",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "Privy condition poor (40).",
      "tags": [
        "area",
        "condition",
        "privy"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    }
  ],
  "pressures": [
    {
      "id": "maintenance",
      "label": "Maintenance",
      "value": 18,
      "previousValue": 35,
      "delta": -17,
      "trend": "stable",
      "severity": 18,
      "urgency": 18,
      "volatility": 100,
      "causes": [
        {
          "id": "damage_light_main_room",
          "readable": "Main Room damage visible (56).",
          "amount": 6,
          "weight": 6,
          "direction": "increase",
          "tags": [
            "area",
            "damage",
            "main_room"
          ],
          "relatedLocations": [
            {
              "kind": "area",
              "id": "main_room"
            }
          ],
          "relatedSystems": [
            "areas"
          ]
        },
        {
          "id": "condition_privy",
          "readable": "Privy condition poor (40).",
          "amount": 12,
          "weight": 12,
          "direction": "increase",
          "tags": [
            "area",
            "condition",
            "privy"
          ],
          "relatedLocations": [
            {
              "kind": "area",
              "id": "privy"
            }
          ],
          "relatedSystems": [
            "areas"
          ]
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "areas"
      ],
      "tags": [
        "maintenance",
        "areas"
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
      "id": "atmosphere_stake",
      "target": "area:main_room",
      "readable": "Atmosphere may rot",
      "direction": "loss",
      "tags": [
        "area"
      ]
    },
    {
      "id": "reputation_stake",
      "target": "reputation:filthy",
      "readable": "Reputation may drift",
      "direction": "risk",
      "tags": [
        "reputation"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "area_atmosphere_seed_main_room",
      "actors": [
        {
          "kind": "area",
          "id": "main_room"
        }
      ],
      "tags": [
        "area",
        "atmosphere",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "main room",
    "problemNoun": "sour atmosphere",
    "sensoryDetails": [
      "dim light",
      "dust haze"
    ],
    "actorOpinions": {
      "regulars": "wrinkle their noses"
    },
    "recentContext": [
      "cleanliness 7"
    ],
    "stakesReadable": [
      "atmosphere may rot",
      "rep may drift"
    ],
    "namedEntities": [
      {
        "role": "area",
        "ref": {
          "kind": "area",
          "id": "main_room"
        },
        "displayName": "Main Room"
      }
    ],
    "pressureContext": [
      "maintenance pressure"
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

#### Slot: repair_area

```json
{
  "responseSlot": {
    "id": "repair_area",
    "labelHint": "Repair Main Room",
    "allowedVerbs": [
      "repair"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "restore condition",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "repair_area_profile",
    "responseSlotId": "repair_area",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": 15,
        "readable": "Condition restored",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "condition",
        "meterLabel": "condition"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -15,
        "readable": "Damage reduced",
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
        "amount": -15,
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
    "delayedEffects": [],
    "memories": [
      {
        "id": "area_repaired_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "repair"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 48
  }
}
```

#### Slot: clean_area

```json
{
  "responseSlot": {
    "id": "clean_area",
    "labelHint": "Clean Main Room",
    "allowedVerbs": [
      "clean"
    ],
    "shape": "short_term_patch",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "raise cleanliness",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "clean_area_profile",
    "responseSlotId": "clean_area",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.cleanliness",
        "amount": 20,
        "readable": "Area cleaned",
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
        "target": "areas.main_room.smell",
        "amount": -12,
        "readable": "Smell reduced",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "smell",
        "meterLabel": "smell"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.mess",
        "amount": -10,
        "readable": "Mess cleared",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "mess",
        "meterLabel": "mess"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "area_cleaned_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "cleaning"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 45
  }
}
```

#### Slot: start_project

```json
{
  "responseSlot": {
    "id": "start_project",
    "labelHint": "Start a project",
    "allowedVerbs": [
      "upgrade"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "major upgrade",
      "coin and time cost"
    ]
  },
  "consequenceProfile": {
    "id": "start_project_profile",
    "responseSlotId": "start_project",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -25,
        "readable": "Project investment",
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
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": 10,
        "readable": "Initial upgrade work",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "condition",
        "meterLabel": "condition"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": 20,
        "readable": "Project completes",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "condition",
        "meterLabel": "condition"
      },
      {
        "kind": "pressure",
        "target": "pressure:maintenance",
        "amount": -10,
        "readable": "Maintenance pressure eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "maintenance",
        "meterLabel": "Maintenance"
      }
    ],
    "memories": [
      {
        "id": "area_project_started_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "project",
          "upgrade"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "area_project_completion_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "project"
        ]
      }
    ],
    "impactScore": 63
  }
}
```

#### Slot: close_area_temporarily

```json
{
  "responseSlot": {
    "id": "close_area_temporarily",
    "labelHint": "Close Main Room",
    "allowedVerbs": [
      "delay"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "stop damage",
      "lose capacity"
    ]
  },
  "consequenceProfile": {
    "id": "close_area_temporarily_profile",
    "responseSlotId": "close_area_temporarily",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": -8,
        "readable": "Damage stops accruing",
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
        "target": "areas.main_room.cleanliness",
        "amount": 10,
        "readable": "Empty area gets tidied",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": 6,
        "readable": "Capacity loss strains service",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage"
      }
    ],
    "memories": [
      {
        "id": "area_closed_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "closed",
          "compromise"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 25
  }
}
```

#### Slot: rebrand_area

```json
{
  "responseSlot": {
    "id": "rebrand_area",
    "labelHint": "Rebrand the area",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "reputation_play",
    "targetOptions": [
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "shift identity",
      "risk audience"
    ]
  },
  "consequenceProfile": {
    "id": "rebrand_area_profile",
    "responseSlotId": "rebrand_area",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -8,
        "readable": "Reputation shifts on identity gamble",
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
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": 5,
        "readable": "Coat of paint masks problem",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "condition",
        "meterLabel": "condition"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "area_rebrand_audience_shift_main_room",
        "amount": 0,
        "readable": "Audience may narrow",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "area_rebrand_audience_shift_main_room"
      }
    ],
    "memories": [
      {
        "id": "area_rebranded_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "rebrand",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "area_rebrand_audience_shift_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "risk"
        ]
      }
    ],
    "impactScore": 21
  }
}
```

#### Slot: ignore_area_problem

```json
{
  "responseSlot": {
    "id": "ignore_area_problem",
    "labelHint": "Ignore the problem",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "rep drifts"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_area_problem_profile",
    "responseSlotId": "ignore_area_problem",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:maintenance",
        "amount": 10,
        "readable": "Maintenance pressure rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "maintenance",
        "meterLabel": "Maintenance"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.condition",
        "amount": -8,
        "readable": "Slow decay",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "condition",
        "meterLabel": "condition"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.damage",
        "amount": 6,
        "readable": "Damage accrues",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "damage",
        "meterLabel": "damage"
      }
    ],
    "memories": [
      {
        "id": "area_ignored_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "neglected"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "area_collapse_risk_main_room",
        "actors": [
          {
            "kind": "area",
            "id": "main_room"
          }
        ],
        "tags": [
          "area",
          "risk"
        ]
      }
    ],
    "impactScore": 24
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "repair_area",
    "label": "Repair what is broken",
    "verb": "repair",
    "targetId": "main_room",
    "shape": "long_term_investment",
    "previewEffects": [
      "a measure of new timber would brace the room",
      "Damage reduced",
      "coin would leave the till by a step"
    ],
    "mechanicalEffects": [
      "Main Room Condition +15",
      "Main Room Damage -15",
      "Coin -15"
    ]
  },
  {
    "slotId": "clean_area",
    "label": "Scrub it back to shape",
    "verb": "clean",
    "targetId": "main_room",
    "shape": "short_term_patch",
    "previewEffects": [
      "a quick patch would lift the corner a step",
      "Smell reduced",
      "Mess cleared"
    ],
    "mechanicalEffects": [
      "Main Room Cleanliness +20",
      "Main Room Smell -12",
      "Main Room Mess -10"
    ]
  },
  {
    "slotId": "start_project",
    "label": "Start a real project",
    "verb": "upgrade",
    "targetId": "main_room",
    "shape": "long_term_investment",
    "previewEffects": [
      "a real slip of coin would leave the purse",
      "fresh joinery would firm the floor a notch"
    ],
    "mechanicalEffects": [
      "Coin -25",
      "Main Room Condition +10"
    ]
  },
  {
    "slotId": "close_area_temporarily",
    "label": "Close the room for now",
    "verb": "delay",
    "targetId": "main_room",
    "shape": "compromise",
    "previewEffects": [
      "a hair of order would touch the kitchen",
      "the floor would read by a step cleaner"
    ],
    "mechanicalEffects": [
      "Main Room Damage -8",
      "Main Room Cleanliness +10"
    ]
  },
  {
    "slotId": "rebrand_area",
    "label": "Rebrand the space",
    "verb": "rebrand",
    "targetId": "main_room",
    "shape": "reputation_play",
    "previewEffects": [
      "the respectable name would slip a notch in word",
      "the corner would lift a hair",
      "later: A reminder would sit on the slate"
    ],
    "mechanicalEffects": [
      "Reputation Respectable -8",
      "Main Room Condition +5",
      "later: Audience may narrow"
    ]
  },
  {
    "slotId": "ignore_area_problem",
    "label": "Leave it for another day",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "pressure would mount unchecked by a clear lift",
      "the room would keep slipping a hair through the night",
      "Damage accrues"
    ],
    "mechanicalEffects": [
      "Maintenance +10",
      "Main Room Condition -8",
      "Main Room Damage +6"
    ]
  }
]
```
