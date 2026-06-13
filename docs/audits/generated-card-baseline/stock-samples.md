# Stock Samples

## stock_shortage

- **Scenario:** stock_shortage
- **Card id:** stock_shortage.warning
- **Seed:** `seed-stock_shortage-ale_quiet_day-d1`
- **Family/type/timing:** stock_shortage / warning / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 42 / 57 / 100 / 67
- **Domain:** stock, customers

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-stock_shortage-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.stock_shortage",
      "sourceType": "pressure",
      "target": "pressure:stock_shortage",
      "targetType": "pressure",
      "amount": 32,
      "direction": "increase",
      "weight": 32,
      "readable": "Ale stock very low (0).",
      "tags": [
        "stock",
        "ale",
        "shortage"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-stock_shortage-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.stock_shortage",
      "sourceType": "pressure",
      "target": "pressure:stock_shortage",
      "targetType": "pressure",
      "amount": 10,
      "direction": "increase",
      "weight": 10,
      "readable": "Recent shortage memories still in effect.",
      "tags": [
        "memory",
        "shortage"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-22",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "customers.adventurers.dish_ale",
      "sourceType": "customer",
      "target": "coin",
      "targetType": "coin",
      "amount": 30,
      "direction": "increase",
      "weight": 30,
      "readable": "customers.adventurers.dish_ale",
      "tags": [
        "coin",
        "sale",
        "ale",
        "buyer:adventurers"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 1
    },
    {
      "id": "c-0-44",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "stock",
      "sourceType": "stock",
      "target": "stock:stew.quantity",
      "targetType": "stock",
      "amount": -30,
      "direction": "decrease",
      "weight": 30,
      "readable": "sale",
      "tags": [
        "stock",
        "stew",
        "quantity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 1
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "ale_stake",
      "target": "stock:ale",
      "readable": "Ale may run out",
      "direction": "loss",
      "tags": [
        "ale",
        "stock"
      ]
    },
    {
      "id": "miner_stake",
      "target": "customer:miners",
      "readable": "Miners may stop visiting",
      "direction": "loss",
      "tags": [
        "customer",
        "miners"
      ]
    }
  ],
  "memoriesCreated": [],
  "futureHooks": [],
  "textIngredients": {
    "subject": "ale stock",
    "problemNoun": "low stock",
    "sensoryDetails": [
      "empty kegs",
      "thirsty regulars"
    ],
    "actorOpinions": {
      "miners": "glance at the taps"
    },
    "recentContext": [
      "ale sales heavy this week"
    ],
    "stakesReadable": [
      "ale may run dry",
      "miners may leave"
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

#### Slot: restock

```json
{
  "responseSlot": {
    "id": "restock",
    "labelHint": "Restock ale",
    "allowedVerbs": [
      "buy"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise ale quantity",
      "spend coin"
    ],
    "choiceContract": {
      "archetype": "buy_stock",
      "primaryTarget": "stock.ale.quantity",
      "solves": [
        "stock_shortage"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "immediate",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "restock_profile",
    "responseSlotId": "restock",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.ale.quantity",
        "amount": 60,
        "readable": "Add ale to stock",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "quantity",
        "meterLabel": "quantity",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -30,
        "readable": "Spend coin restocking",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": -15,
        "readable": "Lower shortage pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "restocked_ale_recently",
        "tags": [
          "stock",
          "ale"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 100
  }
}
```

#### Slot: raise_prices

```json
{
  "responseSlot": {
    "id": "raise_prices",
    "labelHint": "Raise prices",
    "allowedVerbs": [
      "raise_price"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise margin",
      "risk customer satisfaction"
    ],
    "choiceContract": {
      "archetype": "policy_change",
      "primaryTarget": "stock.ale.salePrice",
      "doesNotSolve": [
        "stock_shortage"
      ],
      "costTypes": [
        "relationship_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "raise_prices_profile",
    "responseSlotId": "raise_prices",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.ale.salePrice",
        "amount": 1,
        "readable": "Raise ale price",
        "tags": [
          "stock",
          "price"
        ],
        "targetKind": "stock",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "salePrice",
        "meterLabel": "sale price",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "state_change",
        "target": "customers.miners.satisfaction",
        "amount": -8,
        "readable": "Miners grumble",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 4,
        "readable": "Regulars consider walking",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "memories": [
      {
        "id": "raised_prices_recently",
        "tags": [
          "price",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "price_complaint_possible",
        "tags": [
          "price",
          "rumor"
        ]
      }
    ],
    "impactScore": 19
  }
}
```

#### Slot: water_down

```json
{
  "responseSlot": {
    "id": "water_down",
    "labelHint": "Stretch the ale",
    "allowedVerbs": [
      "serve"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise quantity",
      "lower quality",
      "risk reputation"
    ],
    "choiceContract": {
      "archetype": "cut_corners",
      "primaryTarget": "stock.ale.quantity",
      "doesNotSolve": [
        "real_stock_shortage"
      ],
      "costTypes": [
        "reputation_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "water_down_profile",
    "responseSlotId": "water_down",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.ale.quantity",
        "amount": 20,
        "readable": "Stretch ale",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "quantity",
        "meterLabel": "quantity",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "state_change",
        "target": "stock.ale.quality",
        "amount": -15,
        "readable": "Lower ale quality",
        "tags": [
          "stock",
          "quality"
        ],
        "targetKind": "stock",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "quality",
        "meterLabel": "quality",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:reputation_drift",
        "amount": 5,
        "readable": "Reputation drifts",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "reputation_drift",
        "meterLabel": "Reputation Drift Pressure",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "ale_watering_rumor_possible",
        "amount": 0,
        "readable": "Watered ale rumor may emerge",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "ale_watering_rumor_possible"
      }
    ],
    "memories": [
      {
        "id": "watered_ale_recently",
        "tags": [
          "ale",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "ale_watering_rumor_possible",
        "tags": [
          "ale",
          "rumor"
        ]
      }
    ],
    "impactScore": 47
  }
}
```

#### Slot: limit_sales

```json
{
  "responseSlot": {
    "id": "limit_sales",
    "labelHint": "Limit sales",
    "allowedVerbs": [
      "delay"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "conserve stock",
      "risk customer satisfaction"
    ],
    "choiceContract": {
      "archetype": "delay",
      "primaryTarget": "pressure.stock_shortage",
      "solves": [
        "demand_spike"
      ],
      "doesNotSolve": [
        "low_stock_quantity"
      ],
      "costTypes": [
        "relationship_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "limit_sales_profile",
    "responseSlotId": "limit_sales",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.miners.satisfaction",
        "amount": -5,
        "readable": "Miners disappointed",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": -4,
        "readable": "Demand vents naturally",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "memories": [
      {
        "id": "limited_sales_recently",
        "tags": [
          "stock",
          "service"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 10
  }
}
```

#### Slot: ignore

```json
{
  "responseSlot": {
    "id": "ignore",
    "labelHint": "Ignore the shortage",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no immediate change",
      "risk shortage backlash"
    ],
    "choiceContract": {
      "archetype": "ignore",
      "primaryTarget": "pressure.stock_shortage",
      "doesNotSolve": [
        "stock_shortage"
      ],
      "costTypes": [
        "none"
      ],
      "payoffTiming": "delayed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "ignore_profile",
    "responseSlotId": "ignore",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": 6,
        "readable": "Shortage worsens",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "memories": [
      {
        "id": "ignored_shortage_recently",
        "tags": [
          "stock",
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
    "slotId": "restock",
    "label": "Send for a fresh load",
    "verb": "buy",
    "targetId": "ale",
    "shape": "safe_costly",
    "previewEffects": [
      "a wide leap would refill the cellar shelves",
      "a clear drop of silver would leave the till",
      "the shortage risk would loosen a real slip overnight"
    ],
    "mechanicalEffects": [
      "Ale Quantity +60",
      "Coin -30",
      "Stock Shortage Risk -15"
    ]
  },
  {
    "slotId": "raise_prices",
    "label": "Raise prices",
    "verb": "raise_price",
    "targetId": "ale",
    "shape": "risky_profitable",
    "previewEffects": [
      "a hair would lift the shelf count",
      "satisfaction would sour a clear drop among the patrons (Miners)",
      "later: a hair of pressure would press onto the reading"
    ],
    "mechanicalEffects": [
      "Ale Sale Price +1",
      "Miners Satisfaction -8",
      "later: Regular Customer Loss Risk +4"
    ]
  },
  {
    "slotId": "water_down",
    "label": "Stretch what is left",
    "verb": "serve",
    "targetId": "ale",
    "shape": "deception",
    "previewEffects": [
      "a step would deepen the pantry stores",
      "a notch would draw from the cellar stores",
      "a measure of risk would thicken on the meter",
      "later: A rumour might surface from this later"
    ],
    "mechanicalEffects": [
      "Ale Quantity +20",
      "Ale Quality -15",
      "Reputation Drift Pressure +5",
      "later: Watered ale rumor may emerge"
    ]
  },
  {
    "slotId": "limit_sales",
    "label": "Ration the pours",
    "verb": "delay",
    "targetId": "ale",
    "shape": "compromise",
    "previewEffects": [
      "satisfaction would slip a step from the regulars (Miners)",
      "later: a hair of pressure would lift off the meter"
    ],
    "mechanicalEffects": [
      "Miners Satisfaction -5",
      "later: Stock Shortage Risk -4"
    ]
  },
  {
    "slotId": "ignore",
    "label": "Leave it for tomorrow",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "a measure of risk would build with no answer"
    ],
    "mechanicalEffects": [
      "Stock Shortage Risk +6"
    ]
  }
]
```

## supplier_relationship

- **Scenario:** supplier_relationship
- **Card id:** supplier_relationship.supplier_offer
- **Seed:** `seed-supplier_relationship-brakka_mushroom_cart-d1`
- **Family/type/timing:** supplier_relationship / supplier_offer / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 35 / 34 / 100 / 75
- **Domain:** suppliers, market, stock

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-supplier_distrust-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.supplier_distrust",
      "sourceType": "pressure",
      "target": "pressure:supplier_distrust",
      "targetType": "pressure",
      "amount": 14,
      "direction": "increase",
      "weight": 14,
      "readable": "Brakka Mushroom Cart is publicly blamed (strength 72).",
      "tags": [
        "supplier",
        "blame",
        "attribution"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-supplier_distrust-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.supplier_distrust",
      "sourceType": "pressure",
      "target": "pressure:supplier_distrust",
      "targetType": "pressure",
      "amount": 20,
      "direction": "increase",
      "weight": 20,
      "readable": "Brakka Mushroom Cart remembers late payment (strength 80).",
      "tags": [
        "supplier",
        "memory",
        "late_payment"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-market_instability-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.market_instability",
      "sourceType": "pressure",
      "target": "pressure:market_instability",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "Supplier reliability low on average (60).",
      "tags": [
        "supplier",
        "reliability"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-136",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.supplier_distrust",
      "sourceType": "pressure",
      "target": "pressure:supplier_distrust",
      "targetType": "pressure",
      "amount": 34,
      "direction": "increase",
      "weight": 34,
      "readable": "Brakka Mushroom Cart remembers late payment (strength 80).",
      "tags": [
        "pressure",
        "supplier_distrust",
        "supplier",
        "distrust",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "suppliers",
        "memories",
        "attribution",
        "market"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-137",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.supplier_distrust",
      "sourceType": "pressure",
      "target": "pressure:supplier_distrust",
      "targetType": "pressure",
      "amount": 34,
      "direction": "increase",
      "weight": 34,
      "readable": "Brakka Mushroom Cart remembers late payment (strength 80).",
      "tags": [
        "pressure",
        "supplier_distrust",
        "supplier",
        "distrust",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "suppliers",
        "memories",
        "attribution",
        "market"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "supplier_distrust",
      "label": "Supplier Distrust",
      "value": 34,
      "previousValue": 0,
      "delta": 34,
      "trend": "stable",
      "severity": 34,
      "urgency": 34,
      "volatility": 100,
      "causes": [
        {
          "id": "blame_brakka_mushroom_cart",
          "readable": "Brakka Mushroom Cart is publicly blamed (strength 72).",
          "amount": 14,
          "weight": 14,
          "direction": "increase",
          "tags": [
            "supplier",
            "blame",
            "attribution"
          ],
          "relatedActors": [
            {
              "kind": "supplier",
              "id": "brakka_mushroom_cart"
            }
          ],
          "relatedSystems": [
            "suppliers",
            "attribution"
          ],
          "origin": "discovered"
        },
        {
          "id": "late_payment_mem_brakka_mushroom_cart",
          "readable": "Brakka Mushroom Cart remembers late payment (strength 80).",
          "amount": 20,
          "weight": 20,
          "direction": "increase",
          "tags": [
            "supplier",
            "memory",
            "late_payment"
          ],
          "relatedActors": [
            {
              "kind": "supplier",
              "id": "brakka_mushroom_cart"
            }
          ],
          "relatedSystems": [
            "suppliers",
            "memories"
          ],
          "origin": "player_caused"
        }
      ],
      "relatedActors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "suppliers",
        "memories",
        "attribution",
        "market"
      ],
      "tags": [
        "supplier",
        "distrust",
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
    },
    {
      "id": "market_instability",
      "label": "Market Instability",
      "value": 8,
      "previousValue": 0,
      "delta": 8,
      "trend": "stable",
      "severity": 8,
      "urgency": 8,
      "volatility": 64,
      "causes": [
        {
          "id": "avg_reliability_low",
          "readable": "Supplier reliability low on average (60).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "supplier",
            "reliability"
          ],
          "relatedActors": [
            {
              "kind": "supplier",
              "id": "brakka_mushroom_cart"
            },
            {
              "kind": "supplier",
              "id": "crystalspine_traders"
            },
            {
              "kind": "supplier",
              "id": "marsh_root_peddler"
            },
            {
              "kind": "supplier",
              "id": "mudroad_grain_runner"
            },
            {
              "kind": "supplier",
              "id": "north_pier_smokehouse"
            },
            {
              "kind": "supplier",
              "id": "old_keg_brewers"
            },
            {
              "kind": "supplier",
              "id": "scrap_meat_vendor"
            },
            {
              "kind": "supplier",
              "id": "silken_road_caravan"
            }
          ],
          "relatedSystems": [
            "suppliers"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        },
        {
          "kind": "supplier",
          "id": "crystalspine_traders"
        },
        {
          "kind": "supplier",
          "id": "marsh_root_peddler"
        },
        {
          "kind": "supplier",
          "id": "mudroad_grain_runner"
        },
        {
          "kind": "supplier",
          "id": "north_pier_smokehouse"
        },
        {
          "kind": "supplier",
          "id": "old_keg_brewers"
        },
        {
          "kind": "supplier",
          "id": "scrap_meat_vendor"
        },
        {
          "kind": "supplier",
          "id": "silken_road_caravan"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "suppliers",
        "market",
        "localArcs",
        "stock"
      ],
      "tags": [
        "market",
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
      "id": "supplier_stake",
      "target": "supplier:brakka_mushroom_cart",
      "readable": "Supplier may walk",
      "direction": "risk",
      "tags": [
        "supplier"
      ]
    },
    {
      "id": "stock_stake",
      "target": "stock:flow",
      "readable": "Stock flow may break",
      "direction": "loss",
      "tags": [
        "stock"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "supplier_seed_brakka_mushroom_cart",
      "actors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        }
      ],
      "tags": [
        "supplier",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Brakka Mushroom Cart",
    "problemNoun": "supply dispute",
    "sensoryDetails": [
      "stacked crates",
      "tight handshake"
    ],
    "actorOpinions": {
      "supplier": "demands an answer"
    },
    "recentContext": [
      "reliability 45"
    ],
    "stakesReadable": [
      "supplier may walk",
      "stock may run dry"
    ],
    "namedEntities": [
      {
        "role": "supplier",
        "ref": {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        },
        "displayName": "Brakka Mushroom Cart"
      }
    ],
    "socialContext": [
      "market tension"
    ],
    "relevantMemories": [
      "supplier late payment"
    ],
    "perceivedBlame": [
      "Supplier blamed publicly for spoiled goods."
    ],
    "pressureContext": [
      "distrust 34"
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

#### Slot: pay_supplier

```json
{
  "responseSlot": {
    "id": "pay_supplier",
    "labelHint": "Pay Brakka Mushroom Cart",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "clear debt",
      "spend coin"
    ],
    "choiceContract": {
      "archetype": "compensate",
      "primaryTarget": "pressure.supplier_distrust",
      "solves": [
        "late_supplier_payment"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "pay_supplier_profile",
    "responseSlotId": "pay_supplier",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Pay supplier",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": -10,
        "readable": "Lower distrust",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": -8,
        "readable": "Steady payments steady prices",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 10,
        "readable": "Supplier paid on time",
        "tags": [
          "supplier",
          "paid_on_time",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "supplier_goodwill_return_brakka_mushroom_cart",
        "amount": 8,
        "readable": "Goodwill returns next delivery",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_goodwill_return_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_paid_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "supplier",
          "payment",
          "paid_on_time",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "supplier_faction_paid_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "faction",
          "memory",
          "hosted_event"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "supplier_goodwill_return_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "opportunity"
        ]
      }
    ],
    "impactScore": 50
  }
}
```

#### Slot: negotiate_supplier

```json
{
  "responseSlot": {
    "id": "negotiate_supplier",
    "labelHint": "Negotiate",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "shift price",
      "spend coin concession"
    ],
    "choiceContract": {
      "archetype": "negotiate",
      "primaryTarget": "pressure.stock_shortage",
      "solves": [
        "supplier_terms"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "negotiate_supplier_profile",
    "responseSlotId": "negotiate_supplier",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -5,
        "readable": "Concession sweetens the negotiation",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 12,
        "readable": "Negotiation succeeds",
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": -6,
        "readable": "New pricing eases stock",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": -5,
        "readable": "Locked price calms market",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "world.suppliers.brakka_mushroom_cart.relationship",
        "amount": 3,
        "readable": "Relationship up",
        "tags": [
          "supplier"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "relationship",
        "meterLabel": "relationship",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "supplier_renegotiation_brakka_mushroom_cart",
        "amount": 8,
        "readable": "Terms may need revisiting",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_renegotiation_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_negotiated_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "supplier",
          "negotiation",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "supplier_negotiation_faction_brakka_mushroom_cart",
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
    "futureHooks": [
      {
        "id": "supplier_renegotiation_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier"
        ]
      }
    ],
    "impactScore": 38
  }
}
```

#### Slot: blame_supplier

```json
{
  "responseSlot": {
    "id": "blame_supplier",
    "labelHint": "Blame supplier",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "shed blame",
      "destroy relationship"
    ],
    "choiceContract": {
      "archetype": "appease",
      "primaryTarget": "supplier.relationship",
      "doesNotSolve": [
        "supplier_distrust"
      ],
      "costTypes": [
        "relationship_risk",
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "blame_supplier_profile",
    "responseSlotId": "blame_supplier",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -15,
        "readable": "Relationship damaged",
        "tags": [
          "supplier",
          "blame",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": 8,
        "readable": "Distrust rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 5,
        "readable": "Blame leaks publicly",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "world.suppliers.brakka_mushroom_cart.relationship",
        "amount": -10,
        "readable": "Bond strained",
        "tags": [
          "supplier"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "relationship",
        "meterLabel": "relationship",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "supplier_retaliation_brakka_mushroom_cart",
        "amount": 12,
        "readable": "Supplier may retaliate",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_retaliation_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_blamed_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "supplier",
          "grudge",
          "delivery_dispute",
          "attribution"
        ]
      },
      {
        "id": "tavern_blamed_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "blame"
        ]
      },
      {
        "id": "supplier_faction_blame_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "faction",
          "grudge",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "supplier_retaliation_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "risk"
        ]
      }
    ],
    "impactScore": 48
  }
}
```

#### Slot: switch_supplier

```json
{
  "responseSlot": {
    "id": "switch_supplier",
    "labelHint": "Switch supplier",
    "allowedVerbs": [
      "fire"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "change goods quality",
      "lose relationship"
    ],
    "choiceContract": {
      "archetype": "major_project",
      "primaryTarget": "supplier.reliability",
      "solves": [
        "supplier_distrust"
      ],
      "doesNotSolve": [
        "today_stock_gap"
      ],
      "costTypes": [
        "coin",
        "relationship_risk",
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "mustShowDelayedPayoff": true,
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "switch_supplier_profile",
    "responseSlotId": "switch_supplier",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -20,
        "readable": "Relationship ends",
        "tags": [
          "supplier",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": -8,
        "readable": "Clean slate with new supplier",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": 10,
        "readable": "Gap while transitioning",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Switching cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "new_supplier_uncertainty_scrap_meat_vendor",
        "amount": 10,
        "readable": "Scrap Meat Vendor reliability unproven",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "new_supplier_uncertainty_scrap_meat_vendor"
      }
    ],
    "memories": [
      {
        "id": "supplier_switched_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "switched",
          "grudge",
          "delivery_dispute"
        ]
      },
      {
        "id": "supplier_new_scrap_meat_vendor",
        "actors": [
          {
            "kind": "supplier",
            "id": "scrap_meat_vendor"
          }
        ],
        "tags": [
          "supplier",
          "opportunity",
          "fair_deal"
        ]
      },
      {
        "id": "supplier_faction_drop_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "faction",
          "memory",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "new_supplier_uncertainty_scrap_meat_vendor",
        "actors": [
          {
            "kind": "supplier",
            "id": "scrap_meat_vendor"
          }
        ],
        "tags": [
          "supplier",
          "risk"
        ]
      }
    ],
    "impactScore": 65
  }
}
```

#### Slot: accept_suspicious_goods

```json
{
  "responseSlot": {
    "id": "accept_suspicious_goods",
    "labelHint": "Accept suspicious goods",
    "allowedVerbs": [
      "buy"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "mushrooms"
      }
    ],
    "expectedEffects": [
      "cheap stock quantity",
      "spend discounted coin",
      "raise spoilage risk"
    ],
    "choiceContract": {
      "archetype": "cheap_supplier",
      "primaryTarget": "stock.mushrooms.quantity",
      "solves": [
        "stock_shortage"
      ],
      "doesNotSolve": [
        "food_safety_risk"
      ],
      "costTypes": [
        "coin",
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "accept_suspicious_profile",
    "responseSlotId": "accept_suspicious_goods",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.mushrooms.quantity",
        "amount": 18,
        "readable": "Discount goods added to stock",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "quantity",
        "meterLabel": "quantity",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -8,
        "readable": "Pay discounted supplier cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "state_change",
        "target": "stock.mushrooms.spoilage",
        "amount": 6,
        "readable": "Questionable goods spoil faster",
        "tags": [
          "stock",
          "risk"
        ],
        "targetKind": "stock",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "spoilage",
        "meterLabel": "spoilage",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 4,
        "readable": "Supplier owes a favour",
        "tags": [
          "supplier",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": 8,
        "readable": "Food safety risk rises",
        "tags": [
          "pressure",
          "risk"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "food_safety",
        "meterLabel": "Food Safety Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "future_hook",
        "target": "food_poisoning_outbreak_brakka_mushroom_cart",
        "amount": 0,
        "readable": "Outbreak risk grows",
        "tags": [
          "future_hook",
          "risk"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "food_poisoning_outbreak_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_suspicious_goods_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "deception",
          "delivery_dispute"
        ]
      },
      {
        "id": "tavern_kept_secret_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "food_poisoning_outbreak_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "food_safety",
          "risk"
        ]
      }
    ],
    "impactScore": 50
  }
}
```

#### Slot: refuse_supplier_offer

```json
{
  "responseSlot": {
    "id": "refuse_supplier_offer",
    "labelHint": "Refuse the offer",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "avoid food safety risk",
      "risk supplier relationship",
      "less stock"
    ],
    "choiceContract": {
      "archetype": "delay",
      "primaryTarget": "pressure.food_safety",
      "solves": [
        "suspicious_goods"
      ],
      "doesNotSolve": [
        "stock_shortage"
      ],
      "costTypes": [
        "relationship_risk",
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "refuse_supplier_profile",
    "responseSlotId": "refuse_supplier_offer",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -10,
        "readable": "Refusal stings",
        "tags": [
          "supplier",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": 6,
        "readable": "Distrust rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "world.suppliers.brakka_mushroom_cart.relationship",
        "amount": -5,
        "readable": "Bond cools",
        "tags": [
          "supplier"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "relationship",
        "meterLabel": "relationship",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": 4,
        "readable": "Stock pressure rises",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "memories": [
      {
        "id": "supplier_refused_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "refused",
          "delivery_dispute",
          "attribution"
        ]
      },
      {
        "id": "tavern_stood_firm_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "standards"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 24
  }
}
```

#### Slot: place_standing_order

```json
{
  "responseSlot": {
    "id": "place_standing_order",
    "labelHint": "Place a standing order with Brakka Mushroom Cart",
    "allowedVerbs": [
      "buy",
      "negotiate"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "lock weekly volume",
      "spend coin",
      "reduce market exposure"
    ],
    "choiceContract": {
      "archetype": "buy_stock",
      "primaryTarget": "pressure.market_instability",
      "solves": [
        "market_exposure"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "mixed",
      "mustShowDelayedPayoff": true,
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "place_standing_order_profile",
    "responseSlotId": "place_standing_order",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -25,
        "readable": "Weekly volume locked",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": -10,
        "readable": "Market exposure trimmed",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "world.suppliers.brakka_mushroom_cart.reliability",
        "amount": 5,
        "readable": "Reliability climbs",
        "tags": [
          "supplier"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "reliability",
        "meterLabel": "reliability",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 8,
        "readable": "Standing order signed",
        "tags": [
          "supplier",
          "fair_deal",
          "paid_on_time",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "standing_order_due_brakka_mushroom_cart",
        "amount": 10,
        "readable": "Weekly volume is now owed",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "standing_order_due_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_standing_order_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "supplier",
          "fair_deal",
          "paid_on_time",
          "attribution"
        ]
      },
      {
        "id": "supplier_faction_signed_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "brewers_guild"
          }
        ],
        "tags": [
          "faction",
          "memory",
          "hosted_event"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "standing_order_due_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "rent_like"
        ]
      }
    ],
    "impactScore": 58
  }
}
```

#### Slot: inspect_delivery

```json
{
  "responseSlot": {
    "id": "inspect_delivery",
    "labelHint": "Inspect today’s delivery",
    "allowedVerbs": [
      "inspect"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      },
      {
        "kind": "stock",
        "id": "mushrooms"
      }
    ],
    "expectedEffects": [
      "gate suspicious goods",
      "spend inspection time",
      "show supplier you care"
    ],
    "choiceContract": {
      "archetype": "policy_change",
      "primaryTarget": "pressure.food_safety",
      "solves": [
        "suspicious_goods"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "immediate",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "inspect_delivery_profile",
    "responseSlotId": "inspect_delivery",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -3,
        "readable": "Time lost inspecting",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": -8,
        "readable": "Bad goods rejected",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "food_safety",
        "meterLabel": "Food Safety Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": -4,
        "readable": "Surprises trimmed",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 6,
        "readable": "Supplier respects the diligence",
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "supplier_delivery_inspected_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "inspection_practice_witness_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "memory",
          "hosted_event"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 23
  }
}
```

#### Slot: split_orders

```json
{
  "responseSlot": {
    "id": "split_orders",
    "labelHint": "Split orders with Scrap Meat Vendor",
    "allowedVerbs": [
      "buy",
      "negotiate"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      },
      {
        "kind": "supplier",
        "id": "scrap_meat_vendor"
      }
    ],
    "expectedEffects": [
      "dilute supply risk",
      "spend coin",
      "spread relationship cost"
    ],
    "choiceContract": {
      "archetype": "major_project",
      "primaryTarget": "pressure.market_instability",
      "solves": [
        "single_supplier_risk"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "mixed",
      "mustShowDelayedPayoff": true,
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "split_orders_profile",
    "responseSlotId": "split_orders",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": -12,
        "readable": "Two suppliers dilute risk",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": -6,
        "readable": "Reduced single-supplier pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Split orders cost more upfront",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "cause",
        "target": "supplier:scrap_meat_vendor",
        "amount": 8,
        "readable": "Order placed with Scrap Meat Vendor",
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "scrap_meat_vendor"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "dual_supplier_balance_brakka_mushroom_cart",
        "amount": 8,
        "readable": "Balancing two suppliers ongoing",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dual_supplier_balance_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_split_primary_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "supplier_split_secondary_scrap_meat_vendor",
        "actors": [
          {
            "kind": "supplier",
            "id": "scrap_meat_vendor"
          }
        ],
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "supplier_split_faction_brakka_mushroom_cart",
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
    "futureHooks": [
      {
        "id": "dual_supplier_balance_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "supplier",
            "id": "scrap_meat_vendor"
          }
        ],
        "tags": [
          "supplier"
        ]
      }
    ],
    "impactScore": 47
  }
}
```

#### Slot: supplier_exclusivity_deal

```json
{
  "responseSlot": {
    "id": "supplier_exclusivity_deal",
    "labelHint": "Sign exclusivity with Brakka Mushroom Cart",
    "allowedVerbs": [
      "negotiate",
      "buy"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "unlock discount",
      "single point of failure"
    ],
    "choiceContract": {
      "archetype": "cheap_supplier",
      "primaryTarget": "coin",
      "solves": [
        "short_term_supplier_cost"
      ],
      "doesNotSolve": [
        "single_supplier_risk"
      ],
      "costTypes": [
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "supplier_exclusivity_profile",
    "responseSlotId": "supplier_exclusivity_deal",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 12,
        "readable": "Exclusivity discount applied",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": -10,
        "readable": "Locked-in trust",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:market_instability",
        "amount": 8,
        "readable": "Single point of failure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "market_instability",
        "meterLabel": "Market Instability Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 12,
        "readable": "Exclusivity earns commitment",
        "tags": [
          "supplier",
          "fair_deal",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "exclusivity_risk_brakka_mushroom_cart",
        "amount": 15,
        "readable": "Exclusivity locks tavern in",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "exclusivity_risk_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_exclusivity_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "supplier",
          "paid_on_time",
          "fair_deal",
          "attribution"
        ]
      },
      {
        "id": "supplier_exclusivity_rival_scrap_meat_vendor",
        "actors": [
          {
            "kind": "supplier",
            "id": "scrap_meat_vendor"
          }
        ],
        "tags": [
          "supplier",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "exclusivity_risk_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "risk"
        ]
      }
    ],
    "impactScore": 50
  }
}
```

#### Slot: investigate_suspicious_goods

```json
{
  "responseSlot": {
    "id": "investigate_suspicious_goods",
    "labelHint": "Investigate suspicious goods",
    "allowedVerbs": [
      "inspect",
      "discard"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      },
      {
        "kind": "stock",
        "id": "mushrooms"
      }
    ],
    "expectedEffects": [
      "close food safety gap",
      "spend coin on inspection hours"
    ],
    "choiceContract": {
      "archetype": "policy_change",
      "primaryTarget": "pressure.food_safety",
      "solves": [
        "suspicious_goods"
      ],
      "costTypes": [
        "coin",
        "relationship_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "investigate_suspicious_goods_profile",
    "responseSlotId": "investigate_suspicious_goods",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": -10,
        "readable": "Suspicious stock contained",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "food_safety",
        "meterLabel": "Food Safety Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -6,
        "readable": "Records show diligence",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -8,
        "readable": "Supplier feels investigated",
        "tags": [
          "supplier",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -8,
        "readable": "Hours and discarded stock",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "supplier_investigation_concluded_brakka_mushroom_cart",
        "amount": 10,
        "readable": "Findings will go on record",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_investigation_concluded_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "supplier_investigation_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier",
          "delivery_dispute",
          "attribution"
        ]
      },
      {
        "id": "inspection_investigation_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "memory",
          "hosted_event"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "supplier_investigation_concluded_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "supplier"
        ]
      }
    ],
    "impactScore": 41
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "pay_supplier",
    "label": "Pay Brakka Mushroom Cart",
    "verb": "pay",
    "targetId": "brakka_mushroom_cart",
    "shape": "safe_costly",
    "previewEffects": [
      "coin would leave the till by a step",
      "the distrust reading would fall a real slip tonight",
      "a measure of risk would loosen its grip",
      "later: Goodwill returns next delivery"
    ],
    "mechanicalEffects": [
      "Coin -15",
      "Supplier Distrust Risk -10",
      "Market Instability Risk -8",
      "later: Goodwill returns next delivery"
    ]
  },
  {
    "slotId": "negotiate_supplier",
    "label": "Cut the terms shorter",
    "verb": "negotiate",
    "targetId": "brakka_mushroom_cart",
    "shape": "compromise",
    "previewEffects": [
      "a notch of silver would slip from the purse",
      "the supplier would lift a real step closer",
      "the shortage risk would settle a notch in the cellar",
      "later: Terms may need revisiting"
    ],
    "mechanicalEffects": [
      "Coin -5",
      "Brakka Mushroom Cart +12",
      "Stock Shortage Risk -6",
      "later: Terms may need revisiting"
    ]
  },
  {
    "slotId": "blame_supplier",
    "label": "Pin it on the wagon",
    "verb": "blame",
    "targetId": "brakka_mushroom_cart",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "the deal would slip a clear drop with the supplier",
      "supplier distrust would climb a step tonight",
      "Bond strained",
      "later: Supplier may retaliate"
    ],
    "mechanicalEffects": [
      "Brakka Mushroom Cart -15",
      "Supplier Distrust Risk +8",
      "Brakka Mushroom Cart Relationship -10",
      "later: Supplier may retaliate"
    ]
  },
  {
    "slotId": "switch_supplier",
    "label": "Send them down the road",
    "verb": "fire",
    "targetId": "brakka_mushroom_cart",
    "shape": "long_term_investment",
    "previewEffects": [
      "a heavy fall would sever the supplier lane",
      "the distrust reading would ease a step tonight",
      "a marked fall of silver would empty the till",
      "later: Scrap Meat Vendor reliability unproven"
    ],
    "mechanicalEffects": [
      "Brakka Mushroom Cart -20",
      "Supplier Distrust Risk -8",
      "Coin -20",
      "later: Scrap Meat Vendor reliability unproven"
    ]
  },
  {
    "slotId": "accept_suspicious_goods",
    "label": "Accept suspicious goods",
    "verb": "buy",
    "targetId": "mushrooms",
    "shape": "risky_profitable",
    "previewEffects": [
      "a step would deepen the pantry stores",
      "the till would lighten by a step",
      "a hair of stock would slip from the pantry",
      "later: the food-safety risk would climb a step higher",
      "later: Outbreak risk grows"
    ],
    "mechanicalEffects": [
      "Mushrooms Quantity +18",
      "Coin -8",
      "Mushrooms Spoilage +6",
      "later: Food Safety Risk +8",
      "later: Outbreak risk grows"
    ]
  },
  {
    "slotId": "refuse_supplier_offer",
    "label": "Wave the offer off",
    "verb": "ignore",
    "targetId": "brakka_mushroom_cart",
    "shape": "safe_costly",
    "previewEffects": [
      "a marked fall would chill the merchant route",
      "Distrust rises",
      "the trader would step back a notch",
      "later: a hair of pressure would press onto the reading"
    ],
    "mechanicalEffects": [
      "Brakka Mushroom Cart -10",
      "Supplier Distrust Risk +6",
      "Brakka Mushroom Cart Relationship -5",
      "later: Stock Shortage Risk +4"
    ]
  }
]
```

## debt_rent

- **Scenario:** debt_rent
- **Card id:** debt_rent.debt_pressure
- **Seed:** `seed-debt_rent-arrears-d1`
- **Family/type/timing:** debt_rent / debt_pressure / end_month
- **Severity/urgency/novelty/cardWorthiness:** 83 / 93 / 100 / 99
- **Domain:** economy, monthly, landlord

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-debt-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.debt",
      "sourceType": "pressure",
      "target": "pressure:debt",
      "targetType": "pressure",
      "amount": 26,
      "direction": "increase",
      "weight": 26,
      "readable": "Coin reserves very low (5).",
      "tags": [
        "coin"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-debt-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.debt",
      "sourceType": "pressure",
      "target": "pressure:debt",
      "targetType": "pressure",
      "amount": 22,
      "direction": "increase",
      "weight": 22,
      "readable": "Rent (370) exceeds coin (5).",
      "tags": [
        "rent",
        "monthly"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-landlord-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.landlord",
      "sourceType": "pressure",
      "target": "pressure:landlord",
      "targetType": "pressure",
      "amount": 59,
      "direction": "increase",
      "weight": 59,
      "readable": "Monthly landlord pressure (65).",
      "tags": [
        "monthly",
        "landlord"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-landlord-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.landlord",
      "sourceType": "pressure",
      "target": "pressure:landlord",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "1 missed rent payment(s).",
      "tags": [
        "rent",
        "missed"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-52",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.landlord",
      "sourceType": "pressure",
      "target": "pressure:landlord",
      "targetType": "pressure",
      "amount": 63,
      "direction": "increase",
      "weight": 63,
      "readable": "Monthly landlord pressure (65).",
      "tags": [
        "pressure",
        "landlord",
        "rent",
        "risk"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "monthly",
        "rent",
        "landlord"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-53",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.landlord",
      "sourceType": "pressure",
      "target": "pressure:landlord",
      "targetType": "pressure",
      "amount": 63,
      "direction": "increase",
      "weight": 63,
      "readable": "Monthly landlord pressure (65).",
      "tags": [
        "pressure",
        "landlord",
        "rent",
        "risk"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "monthly",
        "rent",
        "landlord"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "rent_stake",
      "target": "rent",
      "readable": "Rent may be missed",
      "direction": "loss",
      "tags": [
        "rent"
      ]
    },
    {
      "id": "landlord_stake",
      "target": "pressure:landlord",
      "readable": "Landlord may evict",
      "direction": "risk",
      "tags": [
        "landlord"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "debt_warning_seen",
      "tags": [
        "debt",
        "rent"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "eviction_threat_possible",
      "tags": [
        "landlord",
        "risk"
      ]
    }
  ],
  "textIngredients": {
    "subject": "rent due",
    "problemNoun": "shrinking coin pile",
    "sensoryDetails": [
      "scratched ledger",
      "thin coin stack"
    ],
    "actorOpinions": {
      "landlord": "arms folded, frowning"
    },
    "recentContext": [
      "rent missed previously"
    ],
    "stakesReadable": [
      "rent may be missed",
      "landlord may evict"
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

#### Slot: pay

```json
{
  "responseSlot": {
    "id": "pay",
    "labelHint": "Pay what we owe",
    "allowedVerbs": [
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "system",
        "id": "landlord"
      }
    ],
    "expectedEffects": [
      "clear arrears",
      "spend coin"
    ],
    "choiceContract": {
      "archetype": "compensate",
      "primaryTarget": "pressure.landlord",
      "solves": [
        "rent_arrears",
        "landlord_pressure"
      ],
      "costTypes": [
        "coin"
      ],
      "payoffTiming": "immediate",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "pay_profile",
    "responseSlotId": "pay",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -120,
        "readable": "Pay rent",
        "tags": [
          "coin",
          "rent"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:landlord",
        "amount": -15,
        "readable": "Lower landlord pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "landlord",
        "meterLabel": "Landlord Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:debt",
        "amount": -10,
        "readable": "Lower debt pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "debt",
        "meterLabel": "Debt Pressure",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "rent_paid_recently",
        "tags": [
          "rent",
          "landlord"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 100
  }
}
```

#### Slot: borrow

```json
{
  "responseSlot": {
    "id": "borrow",
    "labelHint": "Borrow coin",
    "allowedVerbs": [
      "borrow"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "system",
        "id": "lender"
      }
    ],
    "expectedEffects": [
      "gain coin now",
      "create future debt"
    ],
    "choiceContract": {
      "archetype": "cut_corners",
      "primaryTarget": "coin",
      "solves": [
        "immediate_coin_shortfall"
      ],
      "doesNotSolve": [
        "debt_pressure"
      ],
      "costTypes": [
        "pressure_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "borrow_profile",
    "responseSlotId": "borrow",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 40,
        "readable": "Borrowed coin",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:debt",
        "amount": 12,
        "readable": "Future debt builds",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "debt",
        "meterLabel": "Debt Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "future_hook",
        "target": "loan_due_soon",
        "amount": 0,
        "readable": "Loan will come due",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "loan_due_soon"
      }
    ],
    "memories": [
      {
        "id": "borrowed_coin_recently",
        "tags": [
          "coin",
          "debt"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "loan_due_soon",
        "tags": [
          "debt",
          "risk"
        ]
      }
    ],
    "impactScore": 55
  }
}
```

#### Slot: delay

```json
{
  "responseSlot": {
    "id": "delay",
    "labelHint": "Delay payment",
    "allowedVerbs": [
      "delay"
    ],
    "shape": "delay_problem",
    "targetOptions": [
      {
        "kind": "system",
        "id": "landlord"
      }
    ],
    "expectedEffects": [
      "no immediate coin cost",
      "raise landlord pressure later"
    ],
    "choiceContract": {
      "archetype": "delay",
      "primaryTarget": "pressure.landlord",
      "doesNotSolve": [
        "rent_arrears",
        "landlord_pressure"
      ],
      "costTypes": [
        "none"
      ],
      "payoffTiming": "delayed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "delay_profile",
    "responseSlotId": "delay",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:landlord",
        "amount": 10,
        "readable": "Landlord angrier",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "landlord",
        "meterLabel": "Landlord Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "future_hook",
        "target": "eviction_threat_possible",
        "amount": 0,
        "readable": "Landlord may threaten eviction",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "eviction_threat_possible"
      }
    ],
    "memories": [
      {
        "id": "rent_delayed_recently",
        "tags": [
          "rent",
          "delay"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "eviction_threat_possible",
        "tags": [
          "landlord",
          "risk"
        ]
      }
    ],
    "impactScore": 14
  }
}
```

#### Slot: raise_prices

```json
{
  "responseSlot": {
    "id": "raise_prices",
    "labelHint": "Raise prices",
    "allowedVerbs": [
      "raise_price"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise sale price",
      "risk customer trust"
    ],
    "choiceContract": {
      "archetype": "cut_corners",
      "primaryTarget": "stock.ale.salePrice",
      "solves": [
        "immediate_coin_shortfall"
      ],
      "doesNotSolve": [
        "customer_trust"
      ],
      "costTypes": [
        "relationship_risk"
      ],
      "payoffTiming": "mixed",
      "requiresVisibleTradeoff": true
    }
  },
  "consequenceProfile": {
    "id": "raise_prices_profile",
    "responseSlotId": "raise_prices",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.ale.salePrice",
        "amount": 1,
        "readable": "Raise ale price",
        "tags": [
          "price"
        ],
        "targetKind": "stock",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "salePrice",
        "meterLabel": "sale price",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "customers.miners.satisfaction",
        "amount": -6,
        "readable": "Miners grumble",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "satisfaction",
        "meterLabel": "satisfaction",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "memories": [
      {
        "id": "raised_prices_recently",
        "tags": [
          "price",
          "rent"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 8
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "pay",
    "label": "Pay it down clean",
    "verb": "pay",
    "targetId": "landlord",
    "shape": "safe_costly",
    "previewEffects": [
      "a heavy fall of coin would drain the purse bare",
      "the landlord's pressure would lift a clear drop overhead",
      "Lower debt pressure"
    ],
    "mechanicalEffects": [
      "Coin -120",
      "Landlord Pressure -15",
      "Debt Pressure -10"
    ]
  },
  {
    "slotId": "borrow",
    "label": "Borrow against next month",
    "verb": "borrow",
    "targetId": "lender",
    "shape": "risky_profitable",
    "previewEffects": [
      "a real step of silver would land in the till",
      "later: debt pressure would build a clear lift up the slate",
      "later: A loan would come due in time"
    ],
    "mechanicalEffects": [
      "Coin +40",
      "later: Debt Pressure +12",
      "later: Loan will come due"
    ]
  },
  {
    "slotId": "delay",
    "label": "Delay payment",
    "verb": "delay",
    "targetId": "landlord",
    "shape": "delay_problem",
    "previewEffects": [
      "the landlord's pressure would mount a marked rise overhead",
      "The landlord would loop back to the door"
    ],
    "mechanicalEffects": [
      "Landlord Pressure +10",
      "Landlord may threaten eviction"
    ]
  },
  {
    "slotId": "raise_prices",
    "label": "Lift the prices to cover it",
    "verb": "raise_price",
    "targetId": "ale",
    "shape": "compromise",
    "previewEffects": [
      "a hair would lift the shelf count",
      "later: satisfaction would slip a step from the regulars (Miners)"
    ],
    "mechanicalEffects": [
      "Ale Sale Price +1",
      "later: Miners Satisfaction -6"
    ]
  }
]
```

## inspection

- **Scenario:** inspection
- **Card id:** inspection.inspection_threat
- **Seed:** `seed-inspection-threat-d1`
- **Family/type/timing:** inspection / inspection_threat / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 44 / 44 / 100 / 69
- **Domain:** inspection, food, areas, reputation

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-inspection-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.inspection",
      "sourceType": "pressure",
      "target": "pressure:inspection",
      "targetType": "pressure",
      "amount": 18,
      "direction": "increase",
      "weight": 18,
      "readable": "Food safety pressure high (62).",
      "tags": [
        "food_safety",
        "pressure"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-inspection-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.inspection",
      "sourceType": "pressure",
      "target": "pressure:inspection",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "Privy smell above acceptable (90).",
      "tags": [
        "privy",
        "smell"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-inspection-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.inspection",
      "sourceType": "pressure",
      "target": "pressure:inspection",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
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
      "id": "c-0-111",
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
      "id": "c-0-112",
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
  "pressures": [],
  "stakes": [
    {
      "id": "inspection_stake",
      "target": "pressure:inspection",
      "readable": "Inspector may visit",
      "direction": "risk",
      "tags": [
        "inspection"
      ]
    },
    {
      "id": "rep_stake",
      "target": "reputation:filthy",
      "readable": "Reputation may rot",
      "direction": "loss",
      "tags": [
        "reputation"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "inspection_warning_seen",
      "tags": [
        "inspection",
        "warning"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "inspector_followup_possible",
      "tags": [
        "inspection",
        "risk"
      ]
    }
  ],
  "textIngredients": {
    "subject": "the tavern",
    "problemNoun": "inspection looming",
    "sensoryDetails": [
      "privy stench",
      "grimy floor"
    ],
    "actorOpinions": {
      "merchants": "whisper about inspectors"
    },
    "recentContext": [
      "privy left filthy",
      "kitchen dirty for days"
    ],
    "stakesReadable": [
      "inspector may visit",
      "reputation may rot"
    ],
    "namedEntities": [
      {
        "role": "inspector",
        "ref": {
          "kind": "notable_npc",
          "id": "notable_npc_watch_captain"
        },
        "displayName": "Ulric Aldridge"
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

#### Slot: clean

```json
{
  "responseSlot": {
    "id": "clean",
    "labelHint": "Clean the worst areas",
    "allowedVerbs": [
      "clean"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "kitchen"
      },
      {
        "kind": "area",
        "id": "privy"
      },
      {
        "kind": "area",
        "id": "main_room"
      }
    ],
    "expectedEffects": [
      "lower inspection pressure",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "clean_profile",
    "responseSlotId": "clean",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.kitchen.cleanliness",
        "amount": 20,
        "readable": "Kitchen cleaner",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "state_change",
        "target": "areas.privy.cleanliness",
        "amount": 15,
        "readable": "Privy scrubbed",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.cleanliness",
        "amount": 10,
        "readable": "Main room polished",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -12,
        "readable": "Lower inspection pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.fatigue",
        "amount": 8,
        "readable": "Cleaning shift adds load",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "fatigue",
        "meterLabel": "fatigue",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "faction:town_watch",
        "amount": 6,
        "readable": "Town watch notes the cleanup",
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "town_watch"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "inspection_prep_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "inspection",
          "cleanliness",
          "attribution"
        ]
      },
      {
        "id": "town_watch_clean_witness",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 73
  }
}
```

#### Slot: bribe

```json
{
  "responseSlot": {
    "id": "bribe",
    "labelHint": "Bribe the inspector",
    "allowedVerbs": [
      "bribe"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "stall inspection",
      "spend coin",
      "risk corruption"
    ]
  },
  "consequenceProfile": {
    "id": "bribe_profile",
    "responseSlotId": "bribe",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -30,
        "readable": "Pay bribe",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -10,
        "readable": "Stall inspection",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 12,
        "readable": "Whispers of corruption",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 8,
        "readable": "Bribery rumours start",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "faction:town_watch",
        "amount": -10,
        "readable": "Honest watchmen disgusted",
        "tags": [
          "faction",
          "grudge",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "town_watch"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "corrupt_inspector_relationship",
        "amount": 15,
        "readable": "Inspector may demand more",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "corrupt_inspector_relationship"
      }
    ],
    "memories": [
      {
        "id": "bribed_inspector",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "bribe",
          "corruption",
          "grudge",
          "attribution"
        ]
      },
      {
        "id": "tavern_bribe_secret",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "corrupt_inspector_relationship",
        "actors": [
          {
            "kind": "notable_npc",
            "id": "notable_npc_watch_captain"
          }
        ],
        "tags": [
          "inspection",
          "risk"
        ]
      }
    ],
    "impactScore": 77
  }
}
```

#### Slot: hide

```json
{
  "responseSlot": {
    "id": "hide",
    "labelHint": "Hide the evidence",
    "allowedVerbs": [
      "hide"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "area",
        "id": "cellar"
      }
    ],
    "expectedEffects": [
      "stall inspection",
      "risk discovery"
    ]
  },
  "consequenceProfile": {
    "id": "hide_profile",
    "responseSlotId": "hide",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -6,
        "readable": "Briefly lower risk",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 8,
        "readable": "Staff gossips about hidden goods",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.loyalty",
        "amount": -4,
        "readable": "Staff worried by hiding",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty",
        "meterDisplayCategory": "good_when_higher"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": 6,
        "readable": "Hidden goods rot quietly",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "future_hook",
        "target": "inspection_discovery_possible",
        "amount": 12,
        "readable": "Inspectors may dig deeper",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "inspection_discovery_possible"
      }
    ],
    "memories": [
      {
        "id": "hid_evidence",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "inspection",
          "deception"
        ]
      },
      {
        "id": "tavern_hid_evidence",
        "actors": [
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "inspection_discovery_possible",
        "actors": [
          {
            "kind": "notable_npc",
            "id": "notable_npc_watch_captain"
          }
        ],
        "tags": [
          "inspection",
          "risk"
        ]
      }
    ],
    "impactScore": 34
  }
}
```

#### Slot: improve_food_safety

```json
{
  "responseSlot": {
    "id": "improve_food_safety",
    "labelHint": "Improve food safety",
    "allowedVerbs": [
      "discard",
      "clean"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "stew"
      },
      {
        "kind": "stock",
        "id": "mushrooms"
      }
    ],
    "expectedEffects": [
      "lower food safety pressure",
      "lose stock"
    ]
  },
  "consequenceProfile": {
    "id": "improve_food_safety_profile",
    "responseSlotId": "improve_food_safety",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "stock.mushrooms.quantity",
        "amount": -15,
        "readable": "Discard mushrooms",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "quantity",
        "meterLabel": "quantity",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "state_change",
        "target": "stock.stew.quantity",
        "amount": -10,
        "readable": "Discard stew",
        "tags": [
          "stock"
        ],
        "targetKind": "stock",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "quantity",
        "meterLabel": "quantity",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -8,
        "readable": "Lower inspection pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:food_safety",
        "amount": -10,
        "readable": "Lower food safety",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "food_safety",
        "meterLabel": "Food Safety Risk",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.morale",
        "amount": 5,
        "readable": "Cook proud of standard",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "morale",
        "meterLabel": "morale",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "cause",
        "target": "pressure:food_safety",
        "amount": -10,
        "readable": "Food safety closed off",
        "tags": [
          "food_safety",
          "attribution"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "food_safety",
        "meterLabel": "Food Safety Risk",
        "meterDisplayCategory": "bad_when_higher"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "food_safety_improved_recently",
        "actors": [
          {
            "kind": "staff",
            "id": "cook"
          }
        ],
        "tags": [
          "food_safety",
          "inspection",
          "attribution"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 54
  }
}
```

#### Slot: ignore

```json
{
  "responseSlot": {
    "id": "ignore",
    "labelHint": "Ignore it",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "risk full inspection"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_profile",
    "responseSlotId": "ignore",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": 8,
        "readable": "Inspection looms",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 6,
        "readable": "Bad word spreads",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 4,
        "readable": "Reputation sours",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "dangerous",
        "meterLabel": "dangerous",
        "meterDisplayCategory": "contextual"
      }
    ],
    "memories": [
      {
        "id": "inspection_ignored_recently",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "inspection",
          "ignored"
        ]
      },
      {
        "id": "tavern_ignored_inspection",
        "actors": [
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
    "futureHooks": [],
    "impactScore": 17
  }
}
```

#### Slot: cleaning_roster

```json
{
  "responseSlot": {
    "id": "cleaning_roster",
    "labelHint": "Set up a cleaning roster",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "staff",
        "id": "server"
      }
    ],
    "expectedEffects": [
      "ongoing cleanliness",
      "staff fatigue"
    ]
  },
  "consequenceProfile": {
    "id": "cleaning_roster_profile",
    "responseSlotId": "cleaning_roster",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "areas.kitchen.cleanliness",
        "amount": 12,
        "readable": "Roster keeps kitchen clean",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "state_change",
        "target": "areas.privy.cleanliness",
        "amount": 12,
        "readable": "Roster covers privy",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "state_change",
        "target": "areas.main_room.cleanliness",
        "amount": 10,
        "readable": "Floor mopped each shift",
        "tags": [
          "area"
        ],
        "targetKind": "area",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleanliness",
        "meterLabel": "cleanliness",
        "meterDisplayCategory": "good_when_higher"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -12,
        "readable": "Routine keeps inspection at bay",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "staff.server.fatigue",
        "amount": 8,
        "readable": "Cleaning shifts tire",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "fatigue",
        "meterLabel": "fatigue",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "cause",
        "target": "staff:server",
        "amount": 5,
        "readable": "Staff trusted with roster",
        "tags": [
          "staff",
          "protected",
          "attribution"
        ],
        "targetKind": "staff",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "server"
      },
      {
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": 8,
        "readable": "Scrap collectors appreciate the routine",
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "local_shrine"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "cleaning_routine_streak",
        "amount": 10,
        "readable": "Routine becomes a habit",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cleaning_routine_streak"
      }
    ],
    "memories": [
      {
        "id": "staff_cleaning_roster_server",
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
        "id": "scrap_collectors_routine",
        "actors": [
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "cleaning_routine_streak",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "inspection",
          "opportunity"
        ]
      }
    ],
    "impactScore": 74
  }
}
```

#### Slot: preinspection_walkthrough

```json
{
  "responseSlot": {
    "id": "preinspection_walkthrough",
    "labelHint": "Walk Town Watch through proactively",
    "allowedVerbs": [
      "invite"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "lower inspection",
      "show good faith"
    ]
  },
  "consequenceProfile": {
    "id": "preinspection_walkthrough_profile",
    "responseSlotId": "preinspection_walkthrough",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -5,
        "readable": "Drinks and time for the visit",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "coin",
        "meterLabel": "coin",
        "meterDisplayCategory": "resource"
      },
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -15,
        "readable": "Walkthrough cools the watch",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 5,
        "readable": "Honest tavern signal",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable",
        "meterDisplayCategory": "contextual"
      },
      {
        "kind": "cause",
        "target": "faction:town_watch",
        "amount": 12,
        "readable": "Watch impressed by the openness",
        "tags": [
          "faction",
          "hosted_event",
          "honoured_discount",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "town_watch"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "town_watch_goodwill",
        "amount": 10,
        "readable": "Watch may return with goodwill",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "town_watch_goodwill"
      }
    ],
    "memories": [
      {
        "id": "town_watch_walkthrough",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ]
      },
      {
        "id": "tavern_walkthrough_done",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "standards"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "town_watch_goodwill",
        "actors": [
          {
            "kind": "notable_npc",
            "id": "notable_npc_watch_captain"
          }
        ],
        "tags": [
          "inspection",
          "opportunity"
        ]
      }
    ],
    "impactScore": 44
  }
}
```

#### Slot: ask_town_watch_for_guidance

```json
{
  "responseSlot": {
    "id": "ask_town_watch_for_guidance",
    "labelHint": "Ask Town Watch for guidance",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "build watch relationship",
      "spend hours"
    ]
  },
  "consequenceProfile": {
    "id": "ask_town_watch_for_guidance_profile",
    "responseSlotId": "ask_town_watch_for_guidance",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:inspection",
        "amount": -10,
        "readable": "Watch advises soft pre-checks",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "inspection",
        "meterLabel": "Inspection Pressure",
        "meterDisplayCategory": "bad_when_higher"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 5,
        "readable": "Earnest signal helps reputation",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "respectable",
        "meterLabel": "respectable",
        "meterDisplayCategory": "contextual"
      },
      {
        "kind": "cause",
        "target": "faction:town_watch",
        "amount": 10,
        "readable": "Watch flattered to advise",
        "tags": [
          "faction",
          "honoured_discount",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "town_watch"
      },
      {
        "kind": "cause",
        "target": "faction:scrap_collectors",
        "amount": 4,
        "readable": "Shrine appreciates the discretion",
        "tags": [
          "faction",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "scrap_collectors"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "town_watch_advisor",
        "amount": 8,
        "readable": "Watch may keep an open door",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "town_watch_advisor"
      }
    ],
    "memories": [
      {
        "id": "town_watch_advisor_memory",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ]
      },
      {
        "id": "staff_escorted_watch_server",
        "actors": [
          {
            "kind": "staff",
            "id": "server"
          }
        ],
        "tags": [
          "staff",
          "protected"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "town_watch_advisor",
        "actors": [
          {
            "kind": "notable_npc",
            "id": "notable_npc_watch_captain"
          }
        ],
        "tags": [
          "inspection",
          "opportunity"
        ]
      }
    ],
    "impactScore": 36
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "clean",
    "label": "Scrub it",
    "verb": "clean",
    "targetId": "kitchen",
    "shape": "long_term_investment",
    "previewEffects": [
      "fresh joinery would firm the floor a notch",
      "the inspection risk would fall a marked fall overhead",
      "fatigue would drag the crew down a real slip (Ib Mudshank)"
    ],
    "mechanicalEffects": [
      "Kitchen Cleanliness +20",
      "Inspection Pressure -12",
      "Ib Mudshank Fatigue +8"
    ]
  },
  {
    "slotId": "bribe",
    "label": "Slide coin across the bar",
    "verb": "bribe",
    "targetId": "town_watch",
    "shape": "risky_profitable",
    "previewEffects": [
      "a clear drop of silver would leave the till",
      "a marked fall would ease the risk taken",
      "cultural tension would climb a marked rise tonight",
      "later: A risk of return would remain on the slate"
    ],
    "mechanicalEffects": [
      "Coin -30",
      "Inspection Pressure -10",
      "Cultural Tension +12",
      "later: Inspector may demand more"
    ]
  },
  {
    "slotId": "cleaning_roster",
    "label": "Set a cleaning roster",
    "verb": "delegate",
    "targetId": "server",
    "shape": "long_term_investment",
    "previewEffects": [
      "a measure of repair would steady the floor",
      "Routine keeps inspection at bay",
      "fatigue would drag the crew down a real slip (Mira the Resolute)",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Kitchen Cleanliness +12",
      "Inspection Pressure -12",
      "Mira the Resolute Fatigue +8",
      "later: Routine becomes a habit"
    ]
  },
  {
    "slotId": "preinspection_walkthrough",
    "label": "Walk them through",
    "verb": "invite",
    "targetId": "town_watch",
    "shape": "safe_costly",
    "previewEffects": [
      "coin would leave the till by a step",
      "Walkthrough cools the watch",
      "respectable standing would gain a step in talk",
      "later: Watch may return with goodwill"
    ],
    "mechanicalEffects": [
      "Coin -5",
      "Inspection Pressure -15",
      "Respectable Reputation +5",
      "later: Watch may return with goodwill"
    ]
  },
  {
    "slotId": "ask_town_watch_for_guidance",
    "label": "Ask their guidance plainly",
    "verb": "negotiate",
    "targetId": "town_watch",
    "shape": "safe_costly",
    "previewEffects": [
      "Watch advises soft pre-checks",
      "Earnest signal helps reputation",
      "a marked rise would settle the guild's favour (Town Watch)",
      "later: Watch may keep an open door"
    ],
    "mechanicalEffects": [
      "Inspection Pressure -10",
      "Respectable Reputation +5",
      "Town Watch +10",
      "later: Watch may keep an open door"
    ]
  },
  {
    "slotId": "hide",
    "label": "Tuck it out of sight",
    "verb": "hide",
    "targetId": "cellar",
    "shape": "deception",
    "previewEffects": [
      "the inspection risk would ease a step tonight",
      "the rumour pressure would spread a step through the room",
      "loyalty would slip a step from the crew (Ib Mudshank)",
      "later: the inspection risk would climb a step overhead",
      "later: Inspectors may dig deeper"
    ],
    "mechanicalEffects": [
      "Inspection Pressure -6",
      "Rumour Pressure +8",
      "Ib Mudshank Loyalty -4",
      "later: Inspection Pressure +6",
      "later: Inspectors may dig deeper"
    ]
  },
  {
    "slotId": "ignore",
    "label": "Let it ride",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "pressure would keep climbing a step unchecked",
      "Bad word spreads",
      "a hair of repute would settle on the name"
    ],
    "mechanicalEffects": [
      "Inspection Pressure +8",
      "Rumour Pressure +6",
      "Dangerous Reputation +4"
    ]
  }
]
```
