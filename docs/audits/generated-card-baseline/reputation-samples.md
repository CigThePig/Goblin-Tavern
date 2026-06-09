# Reputation Samples

## faction_request

- **Scenario:** faction_request
- **Card id:** faction_request.social_conflict
- **Seed:** `seed-faction_request-town_watch-d1`
- **Family/type/timing:** faction_request / social_conflict / during_service
- **Severity/urgency/novelty/cardWorthiness:** 100 / 100 / 100 / 100
- **Domain:** factions, social

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-faction_anger-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.faction_anger",
      "sourceType": "pressure",
      "target": "pressure:faction_anger",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "Factions are cautious toward the tavern (avg relationship 15).",
      "tags": [
        "faction",
        "relationship"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-faction_anger-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.faction_anger",
      "sourceType": "pressure",
      "target": "pressure:faction_anger",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "Faction fear is high in town (avg fear 70).",
      "tags": [
        "faction",
        "fear"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-faction_anger-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.faction_anger",
      "sourceType": "pressure",
      "target": "pressure:faction_anger",
      "targetType": "pressure",
      "amount": 252,
      "direction": "increase",
      "weight": 252,
      "readable": "9 faction(s) are under visible strain.",
      "tags": [
        "faction",
        "relationship"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-134",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.faction_anger",
      "sourceType": "pressure",
      "target": "pressure:faction_anger",
      "targetType": "pressure",
      "amount": 100,
      "direction": "increase",
      "weight": 100,
      "readable": "9 faction(s) are under visible strain.",
      "tags": [
        "pressure",
        "faction_anger",
        "faction",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "faction",
          "id": "brewers_guild"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "factions",
        "memories",
        "attribution",
        "localArcs"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-135",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.faction_anger",
      "sourceType": "pressure",
      "target": "pressure:faction_anger",
      "targetType": "pressure",
      "amount": 100,
      "direction": "increase",
      "weight": 100,
      "readable": "9 faction(s) are under visible strain.",
      "tags": [
        "pressure",
        "faction_anger",
        "faction",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "faction",
          "id": "brewers_guild"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "factions",
        "memories",
        "attribution",
        "localArcs"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
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
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": 22,
      "direction": "increase",
      "weight": 22,
      "readable": "Cultural taboo/conflict memories (strength 100).",
      "tags": [
        "pressure",
        "cultural_tension",
        "culture",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "cultures",
        "customers",
        "memories",
        "policies"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "faction_anger",
      "label": "Faction Anger",
      "value": 100,
      "previousValue": 0,
      "delta": 100,
      "trend": "stable",
      "severity": 100,
      "urgency": 100,
      "volatility": 100,
      "causes": [
        {
          "id": "avg_faction_cautious",
          "readable": "Factions are cautious toward the tavern (avg relationship 15).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "faction",
            "relationship"
          ],
          "relatedSystems": [
            "factions"
          ],
          "origin": "discovered"
        },
        {
          "id": "avg_faction_fear",
          "readable": "Faction fear is high in town (avg fear 70).",
          "amount": 6,
          "weight": 6,
          "direction": "increase",
          "tags": [
            "faction",
            "fear"
          ],
          "relatedSystems": [
            "factions"
          ],
          "origin": "external"
        },
        {
          "id": "individual_faction_strain",
          "readable": "9 faction(s) are under visible strain.",
          "amount": 252,
          "weight": 252,
          "direction": "increase",
          "tags": [
            "faction",
            "relationship"
          ],
          "relatedActors": [
            {
              "kind": "faction",
              "id": "brewers_guild"
            },
            {
              "kind": "faction",
              "id": "local_shrine"
            },
            {
              "kind": "faction",
              "id": "market_caravan_circle"
            },
            {
              "kind": "faction",
              "id": "miners_union"
            },
            {
              "kind": "faction",
              "id": "rival_taverns"
            },
            {
              "kind": "faction",
              "id": "scrap_collectors"
            },
            {
              "kind": "faction",
              "id": "silvermark_house"
            },
            {
              "kind": "faction",
              "id": "smugglers_ring"
            },
            {
              "kind": "faction",
              "id": "town_watch"
            }
          ],
          "relatedSystems": [
            "factions"
          ],
          "origin": "discovered"
        },
        {
          "id": "blame_brewers_guild",
          "readable": "Brewers Guild carries blame attributions (strength 77).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "faction",
            "blame",
            "attribution"
          ],
          "relatedActors": [
            {
              "kind": "faction",
              "id": "brewers_guild"
            }
          ],
          "relatedSystems": [
            "factions",
            "attribution"
          ],
          "origin": "discovered"
        }
      ],
      "relatedActors": [
        {
          "kind": "faction",
          "id": "brewers_guild"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "factions",
        "memories",
        "attribution",
        "localArcs"
      ],
      "tags": [
        "faction",
        "social",
        "expanded"
      ],
      "consequences": [
        "Faction demands may surface.",
        "Boycotts or brawls become more likely.",
        "Angry factions may tip off inspectors."
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
      "id": "cultural_tension",
      "label": "Cultural Tension",
      "value": 22,
      "previousValue": 0,
      "delta": 22,
      "trend": "stable",
      "severity": 22,
      "urgency": 22,
      "volatility": 100,
      "causes": [
        {
          "id": "observance_active",
          "readable": "3 cultural observance tag(s) active today.",
          "amount": 4,
          "weight": 4,
          "direction": "increase",
          "tags": [
            "culture",
            "calendar"
          ],
          "relatedSystems": [
            "cultures",
            "calendar"
          ],
          "origin": "discovered"
        },
        {
          "id": "taboo_memory",
          "readable": "Cultural taboo/conflict memories (strength 100).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "culture",
            "memory"
          ],
          "relatedSystems": [
            "cultures",
            "memories"
          ],
          "origin": "player_caused"
        },
        {
          "id": "faction_anger_bleed",
          "readable": "Faction anger (100) bleeds into cultural tension.",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "faction",
            "web"
          ],
          "relatedSystems": [
            "factions",
            "pressures"
          ],
          "origin": "external"
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "cultures",
        "customers",
        "memories",
        "policies"
      ],
      "tags": [
        "culture",
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
      "id": "faction_stake",
      "target": "faction:town_watch",
      "readable": "Relationship may break",
      "direction": "risk",
      "tags": [
        "faction"
      ]
    },
    {
      "id": "reputation_stake",
      "target": "reputation:respectable",
      "readable": "Audience may narrow",
      "direction": "risk",
      "tags": [
        "reputation"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "faction_seed_town_watch",
      "actors": [
        {
          "kind": "faction",
          "id": "town_watch"
        }
      ],
      "tags": [
        "faction",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Town Watch",
    "problemNoun": "faction demand",
    "sensoryDetails": [
      "drawn-out silence",
      "folded arms"
    ],
    "actorOpinions": {
      "faction": "wants something specific"
    },
    "recentContext": [
      "relationship 15"
    ],
    "stakesReadable": [
      "relationship may break",
      "audience may narrow"
    ],
    "namedEntities": [
      {
        "role": "faction",
        "ref": {
          "kind": "faction",
          "id": "town_watch"
        },
        "displayName": "Town Watch"
      }
    ],
    "socialContext": [
      "no culture link"
    ],
    "pressureContext": [
      "faction anger 100"
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

#### Slot: appease_faction

```json
{
  "responseSlot": {
    "id": "appease_faction",
    "labelHint": "Appease Town Watch",
    "allowedVerbs": [
      "appease",
      "pay"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "raise relationship",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "appease_faction_profile",
    "responseSlotId": "appease_faction",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": 15,
        "readable": "Relationship rises",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Appeasement cost",
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
        "target": "pressure:faction_anger",
        "amount": -10,
        "readable": "Faction anger eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "faction_anger",
        "meterLabel": "Faction Anger"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "faction_appeased_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "appease",
          "gratitude"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 46
  }
}
```

#### Slot: negotiate_terms

```json
{
  "responseSlot": {
    "id": "negotiate_terms",
    "labelHint": "Negotiate terms",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "raise relationship",
      "concede something"
    ]
  },
  "consequenceProfile": {
    "id": "negotiate_terms_profile",
    "responseSlotId": "negotiate_terms",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": 10,
        "readable": "Relationship improves",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "factions.town_watch.trust",
        "amount": 8,
        "readable": "Trust grows",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "trust",
        "meterLabel": "trust"
      },
      {
        "kind": "pressure",
        "target": "pressure:faction_anger",
        "amount": -6,
        "readable": "Anger softens",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "faction_anger",
        "meterLabel": "Faction Anger"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "faction_negotiated_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "negotiation"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 26
  }
}
```

#### Slot: refuse_faction

```json
{
  "responseSlot": {
    "id": "refuse_faction",
    "labelHint": "Refuse outright",
    "allowedVerbs": [
      "blame",
      "ignore"
    ],
    "shape": "escalation",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "hold ground",
      "raise faction anger"
    ]
  },
  "consequenceProfile": {
    "id": "refuse_faction_profile",
    "responseSlotId": "refuse_faction",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": -20,
        "readable": "Relationship collapses",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "factions.town_watch.trust",
        "amount": -12,
        "readable": "Trust drops",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "trust",
        "meterLabel": "trust"
      },
      {
        "kind": "pressure",
        "target": "pressure:faction_anger",
        "amount": 12,
        "readable": "Faction anger spikes",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "faction_anger",
        "meterLabel": "Faction Anger"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "faction_grudge_town_watch",
        "amount": 0,
        "readable": "Faction may retaliate",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "faction_grudge_town_watch"
      }
    ],
    "memories": [
      {
        "id": "faction_refused_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "grudge",
          "refusal"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "faction_grudge_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "risk"
        ]
      }
    ],
    "impactScore": 50
  }
}
```

#### Slot: host_faction_night

```json
{
  "responseSlot": {
    "id": "host_faction_night",
    "labelHint": "Host Town Watch night",
    "allowedVerbs": [
      "invite"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "raise relationship",
      "narrow audience"
    ]
  },
  "consequenceProfile": {
    "id": "host_faction_night_profile",
    "responseSlotId": "host_faction_night",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": 18,
        "readable": "Hosting wins favour",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "factions.town_watch.influence",
        "amount": 5,
        "readable": "Faction influence rises",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "influence",
        "meterLabel": "influence"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Event costs",
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
        "target": "pressure:cultural_tension",
        "amount": 5,
        "readable": "Other groups feel sidelined",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "memories": [
      {
        "id": "faction_hosted_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "host",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 44
  }
}
```

#### Slot: call_watch

```json
{
  "responseSlot": {
    "id": "call_watch",
    "labelHint": "Call the watch",
    "allowedVerbs": [
      "threaten"
    ],
    "shape": "escalation",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "lower tension",
      "destroy relationship"
    ]
  },
  "consequenceProfile": {
    "id": "call_watch_profile",
    "responseSlotId": "call_watch",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": -25,
        "readable": "Faction sees betrayal",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "factions.town_watch.fear",
        "amount": 15,
        "readable": "Faction fears retaliation",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "fear",
        "meterLabel": "fear"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "faction_revenge_town_watch",
        "amount": 0,
        "readable": "Faction may seek revenge",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "faction_revenge_town_watch"
      }
    ],
    "memories": [
      {
        "id": "faction_watch_called_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "escalation",
          "betrayal"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "faction_revenge_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "risk"
        ]
      }
    ],
    "impactScore": 48
  }
}
```

#### Slot: play_rival_faction

```json
{
  "responseSlot": {
    "id": "play_rival_faction",
    "labelHint": "Play rival factions",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "town_watch"
      }
    ],
    "expectedEffects": [
      "shift tension",
      "risk discovery"
    ]
  },
  "consequenceProfile": {
    "id": "play_rival_faction_profile",
    "responseSlotId": "play_rival_faction",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "factions.town_watch.relationship",
        "amount": 5,
        "readable": "Shift relationship slightly",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "relationship",
        "meterLabel": "relationship"
      },
      {
        "kind": "state_change",
        "target": "factions.town_watch.trust",
        "amount": -8,
        "readable": "Trust quietly erodes",
        "tags": [
          "faction"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "trust",
        "meterLabel": "trust"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 8,
        "readable": "Whispers spread",
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
        "kind": "future_hook",
        "target": "faction_deception_exposed_town_watch",
        "amount": 0,
        "readable": "Deception may surface",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "faction_deception_exposed_town_watch"
      }
    ],
    "memories": [
      {
        "id": "faction_played_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "deception"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "faction_deception_exposed_town_watch",
        "actors": [
          {
            "kind": "faction",
            "id": "town_watch"
          }
        ],
        "tags": [
          "faction",
          "risk",
          "deception"
        ]
      }
    ],
    "impactScore": 26
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "appease_faction",
    "label": "Offer a formal concession",
    "verb": "appease",
    "targetId": "town_watch",
    "shape": "safe_costly",
    "previewEffects": [
      "a marked rise would settle the guild's favour",
      "a real slip of coin would leave the purse",
      "the faction's anger would settle a clear drop tonight"
    ],
    "mechanicalEffects": [
      "Relationship +15",
      "Coin -20",
      "Faction Anger -10"
    ]
  },
  {
    "slotId": "negotiate_terms",
    "label": "Strike a quick bargain",
    "verb": "negotiate",
    "targetId": "town_watch",
    "shape": "compromise",
    "previewEffects": [
      "the order would warm a marked rise on terms",
      "a notch of trust would settle with the guild",
      "the faction's anger would settle a notch cooler"
    ],
    "mechanicalEffects": [
      "Relationship +10",
      "Trust +8",
      "Faction Anger -6"
    ]
  },
  {
    "slotId": "refuse_faction",
    "label": "Refuse the petition",
    "verb": "blame",
    "targetId": "town_watch",
    "shape": "escalation",
    "previewEffects": [
      "a sharp drop would freeze the guild against the bar",
      "a clear drop would harden the guild stance",
      "the faction's anger would climb a marked rise tonight",
      "later: a thread would sit on the council slate"
    ],
    "mechanicalEffects": [
      "Relationship -20",
      "Trust -12",
      "Faction Anger +12",
      "later: Faction may retaliate"
    ]
  },
  {
    "slotId": "host_faction_night",
    "label": "Host Town Watch night",
    "verb": "invite",
    "targetId": "town_watch",
    "shape": "long_term_investment",
    "previewEffects": [
      "a clear lift would draw the faction closer",
      "a step of goodwill would reach the order",
      "a measure of coppers would leave the till"
    ],
    "mechanicalEffects": [
      "Relationship +18",
      "Influence +5",
      "Coin -15"
    ]
  },
  {
    "slotId": "call_watch",
    "label": "Call the watch",
    "verb": "threaten",
    "targetId": "town_watch",
    "shape": "escalation",
    "previewEffects": [
      "a heavy fall would sever ties with the faction",
      "the house would warm by a real step",
      "later: Faction may seek revenge"
    ],
    "mechanicalEffects": [
      "Relationship -25",
      "Fear +15",
      "later: Faction may seek revenge"
    ]
  },
  {
    "slotId": "play_rival_faction",
    "label": "Set the factions against each other",
    "verb": "negotiate",
    "targetId": "town_watch",
    "shape": "deception",
    "previewEffects": [
      "Shift relationship slightly",
      "the order would cool by a step",
      "later: Deception may surface"
    ],
    "mechanicalEffects": [
      "Relationship +5",
      "Trust -8",
      "later: Deception may surface"
    ]
  }
]
```

## culture_conflict

- **Scenario:** culture_conflict
- **Card id:** culture_conflict.social_conflict
- **Seed:** `seed-culture_conflict-goblin_local-d1`
- **Family/type/timing:** culture_conflict / social_conflict / during_service
- **Severity/urgency/novelty/cardWorthiness:** 40 / 40 / 100 / 60
- **Domain:** cultures, social

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-cultural_tension-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": 8,
      "direction": "increase",
      "weight": 8,
      "readable": "Cultural expectations are tense on average (46).",
      "tags": [
        "culture"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-cultural_tension-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": 18,
      "direction": "increase",
      "weight": 18,
      "readable": "1 culture(s) are visibly tense.",
      "tags": [
        "culture",
        "tension"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-cultural_tension-2-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": 4,
      "direction": "increase",
      "weight": 4,
      "readable": "3 cultural observance tag(s) active today.",
      "tags": [
        "culture",
        "calendar"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-135",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": -20,
      "direction": "decrease",
      "weight": 20,
      "readable": "1 culture(s) are visibly tense.",
      "tags": [
        "pressure",
        "cultural_tension",
        "culture",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "cultures",
        "customers",
        "memories",
        "policies"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
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
      "source": "pressures.cultural_tension",
      "sourceType": "pressure",
      "target": "pressure:cultural_tension",
      "targetType": "pressure",
      "amount": -20,
      "direction": "decrease",
      "weight": 20,
      "readable": "1 culture(s) are visibly tense.",
      "tags": [
        "pressure",
        "cultural_tension",
        "culture",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "cultures",
        "customers",
        "memories",
        "policies"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "cultural_tension",
      "label": "Cultural Tension",
      "value": 40,
      "previousValue": 60,
      "delta": -20,
      "trend": "stable",
      "severity": 40,
      "urgency": 40,
      "volatility": 100,
      "causes": [
        {
          "id": "avg_cultural_tension",
          "readable": "Cultural expectations are tense on average (46).",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "culture"
          ],
          "relatedSystems": [
            "cultures"
          ],
          "origin": "inherited"
        },
        {
          "id": "high_culture_tension",
          "readable": "1 culture(s) are visibly tense.",
          "amount": 18,
          "weight": 18,
          "direction": "increase",
          "tags": [
            "culture",
            "tension"
          ],
          "relatedSystems": [
            "cultures"
          ],
          "origin": "discovered"
        },
        {
          "id": "observance_active",
          "readable": "3 cultural observance tag(s) active today.",
          "amount": 4,
          "weight": 4,
          "direction": "increase",
          "tags": [
            "culture",
            "calendar"
          ],
          "relatedSystems": [
            "cultures",
            "calendar"
          ],
          "origin": "discovered"
        },
        {
          "id": "taboo_memory",
          "readable": "Cultural taboo/conflict memories (strength 100).",
          "amount": 10,
          "weight": 10,
          "direction": "increase",
          "tags": [
            "culture",
            "memory"
          ],
          "relatedSystems": [
            "cultures",
            "memories"
          ],
          "origin": "player_caused"
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "cultures",
        "customers",
        "memories",
        "policies"
      ],
      "tags": [
        "culture",
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
      "id": "culture_stake",
      "target": "culture:goblin_local",
      "readable": "Culture tension may rise",
      "direction": "risk",
      "tags": [
        "culture"
      ]
    },
    {
      "id": "comfort_stake",
      "target": "culture:goblin_local:comfort",
      "readable": "Comfort may collapse",
      "direction": "loss",
      "tags": [
        "culture"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "culture_seed_goblin_local",
      "actors": [
        {
          "kind": "culture",
          "id": "goblin_local"
        }
      ],
      "tags": [
        "culture",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Local Goblins",
    "problemNoun": "cultural friction",
    "sensoryDetails": [
      "drawn breath",
      "shifted seat"
    ],
    "actorOpinions": {
      "goblin_local": "expects a gesture"
    },
    "recentContext": [
      "tension 80"
    ],
    "stakesReadable": [
      "tension may rise",
      "group may walk"
    ],
    "namedEntities": [
      {
        "role": "culture",
        "ref": {
          "kind": "culture",
          "id": "goblin_local"
        },
        "displayName": "Local Goblins"
      }
    ],
    "socialContext": [
      "prefers: drink, goblin_favourite"
    ],
    "pressureContext": [
      "cultural tension 40"
    ],
    "calendarContext": [
      "tags: quiet_day, season_mudwake, road_danger_risk"
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

#### Slot: mediate_groups

```json
{
  "responseSlot": {
    "id": "mediate_groups",
    "labelHint": "Mediate between groups",
    "allowedVerbs": [
      "appease",
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "culture",
        "id": "goblin_local"
      }
    ],
    "expectedEffects": [
      "lower tension",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "mediate_groups_profile",
    "responseSlotId": "mediate_groups",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.tension",
        "amount": -15,
        "readable": "Tension drops",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "tension",
        "meterLabel": "tension"
      },
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.comfort",
        "amount": 10,
        "readable": "Comfort rises",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "comfort",
        "meterLabel": "comfort"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": -10,
        "readable": "Tension eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "culture_mediated_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "mediation",
          "compromise"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 36
  }
}
```

#### Slot: honour_custom

```json
{
  "responseSlot": {
    "id": "honour_custom",
    "labelHint": "Honour Local Goblins custom",
    "allowedVerbs": [
      "invite",
      "serve"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "culture",
        "id": "goblin_local"
      }
    ],
    "expectedEffects": [
      "raise familiarity",
      "narrow audience"
    ]
  },
  "consequenceProfile": {
    "id": "honour_custom_profile",
    "responseSlotId": "honour_custom",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.familiarity",
        "amount": 15,
        "readable": "Familiarity grows",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "familiarity",
        "meterLabel": "familiarity"
      },
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.comfort",
        "amount": 12,
        "readable": "Group feels seen",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "comfort",
        "meterLabel": "comfort"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Custom honoured",
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
        "target": "pressure:cultural_tension",
        "amount": -8,
        "readable": "Cultural tension eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "memories": [
      {
        "id": "culture_honoured_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "honour",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 45
  }
}
```

#### Slot: ignore_custom

```json
{
  "responseSlot": {
    "id": "ignore_custom",
    "labelHint": "Ignore the custom",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "raise tension"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_custom_profile",
    "responseSlotId": "ignore_custom",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.tension",
        "amount": 12,
        "readable": "Tension rises",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "tension",
        "meterLabel": "tension"
      },
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.comfort",
        "amount": -8,
        "readable": "Comfort erodes",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "comfort",
        "meterLabel": "comfort"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 10,
        "readable": "Tension grows",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "memories": [
      {
        "id": "culture_ignored_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "ignored",
          "neglected"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "culture_walkout_risk_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "risk"
        ]
      }
    ],
    "impactScore": 28
  }
}
```

#### Slot: change_seating_policy

```json
{
  "responseSlot": {
    "id": "change_seating_policy",
    "labelHint": "Change seating policy",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "area",
        "id": "private_booth"
      }
    ],
    "expectedEffects": [
      "lower tension",
      "displease other groups"
    ]
  },
  "consequenceProfile": {
    "id": "change_seating_policy_profile",
    "responseSlotId": "change_seating_policy",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.tension",
        "amount": -10,
        "readable": "Seating eases this group",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "tension",
        "meterLabel": "tension"
      },
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.comfort",
        "amount": 8,
        "readable": "Group settles",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "comfort",
        "meterLabel": "comfort"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 5,
        "readable": "Other groups feel sidelined",
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
        "kind": "state_change",
        "target": "reputation.strange",
        "amount": 6,
        "readable": "House reads as taking sides",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "strange",
        "meterLabel": "strange"
      }
    ],
    "memories": [
      {
        "id": "culture_seating_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "seating",
          "compromise"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "culture_seating_backlash_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "risk"
        ]
      }
    ],
    "impactScore": 33
  }
}
```

#### Slot: offer_discount

```json
{
  "responseSlot": {
    "id": "offer_discount",
    "labelHint": "Offer a discount",
    "allowedVerbs": [
      "discount"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "culture",
        "id": "goblin_local"
      }
    ],
    "expectedEffects": [
      "raise comfort",
      "lose coin"
    ]
  },
  "consequenceProfile": {
    "id": "offer_discount_profile",
    "responseSlotId": "offer_discount",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.comfort",
        "amount": 15,
        "readable": "Discount buys comfort",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "comfort",
        "meterLabel": "comfort"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
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
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": -8,
        "readable": "Tension eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "culture_discounted_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "discount",
          "gratitude"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 40
  }
}
```

#### Slot: ask_staff_to_intervene

```json
{
  "responseSlot": {
    "id": "ask_staff_to_intervene",
    "labelHint": "Ask staff to intervene",
    "allowedVerbs": [
      "delegate"
    ],
    "shape": "delay_problem",
    "targetOptions": [
      {
        "kind": "system",
        "id": "staff"
      }
    ],
    "expectedEffects": [
      "lower visible tension",
      "add staff stress"
    ]
  },
  "consequenceProfile": {
    "id": "ask_staff_to_intervene_profile",
    "responseSlotId": "ask_staff_to_intervene",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "cultures.goblin_local.tension",
        "amount": -8,
        "readable": "Visible tension drops",
        "tags": [
          "culture"
        ],
        "targetKind": "culture",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "tension",
        "meterLabel": "tension"
      },
      {
        "kind": "pressure",
        "target": "pressure:staff_burnout",
        "amount": 8,
        "readable": "Staff carry the strain",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_burnout",
        "meterLabel": "Staff Burnout"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": 5,
        "readable": "Staff resent the burden",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      }
    ],
    "memories": [
      {
        "id": "culture_staff_intervene_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "staff",
          "delegate"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 20
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "mediate_groups",
    "label": "Mediate between groups",
    "verb": "appease",
    "targetId": "goblin_local",
    "shape": "compromise",
    "previewEffects": [
      "a clear lift would warm the people gathered",
      "Comfort rises",
      "cultural tension would settle a clear drop tonight"
    ],
    "mechanicalEffects": [
      "Tension -15",
      "Comfort +10",
      "Cultural Tension -10"
    ]
  },
  {
    "slotId": "honour_custom",
    "label": "Honour Local Goblins custom",
    "verb": "invite",
    "targetId": "goblin_local",
    "shape": "long_term_investment",
    "previewEffects": [
      "the kin would warm a marked rise for good",
      "Group feels seen",
      "a notch of silver would slip from the purse"
    ],
    "mechanicalEffects": [
      "Familiarity +15",
      "Comfort +12",
      "Coin -10"
    ]
  },
  {
    "slotId": "ignore_custom",
    "label": "Let it pass tonight",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "a clear drop would mark the culture standing",
      "the kin would cool by a step",
      "cultural tension would climb a marked rise tonight"
    ],
    "mechanicalEffects": [
      "Tension +12",
      "Comfort -8",
      "Cultural Tension +10"
    ]
  },
  {
    "slotId": "change_seating_policy",
    "label": "Adjust the seating",
    "verb": "rebrand",
    "targetId": "private_booth",
    "shape": "compromise",
    "previewEffects": [
      "a marked rise would steady the folk in the room",
      "the kin would warm by a step into the room"
    ],
    "mechanicalEffects": [
      "Tension -10",
      "Comfort +8"
    ]
  },
  {
    "slotId": "offer_discount",
    "label": "Stand a round for them",
    "verb": "discount",
    "targetId": "goblin_local",
    "shape": "safe_costly",
    "previewEffects": [
      "a marked rise would ease the gathered folk",
      "coin would leave the till by a step",
      "cultural tension would settle a notch tonight"
    ],
    "mechanicalEffects": [
      "Comfort +15",
      "Coin -15",
      "Cultural Tension -8"
    ]
  },
  {
    "slotId": "ask_staff_to_intervene",
    "label": "Send the staff over",
    "verb": "delegate",
    "targetId": "staff",
    "shape": "delay_problem",
    "previewEffects": [
      "a measure of ease would reach the gathered kin",
      "the burnout meter would climb a step higher tonight"
    ],
    "mechanicalEffects": [
      "Tension -8",
      "Staff Burnout +8"
    ]
  }
]
```

## reputation_shift

- **Scenario:** reputation_shift
- **Card id:** reputation_shift.reputation_shift
- **Seed:** `seed-reputation_shift-cheap-d0`
- **Family/type/timing:** reputation_shift / reputation_shift / closing
- **Severity/urgency/novelty/cardWorthiness:** 45 / 48 / 100 / 68
- **Domain:** reputation, customers, reputation.cheap

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-reputation_drift-0-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 24,
      "direction": "increase",
      "weight": 24,
      "readable": "3 reputation axis/axes pushing past 70.",
      "tags": [
        "reputation",
        "identity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-reputation_drift-1-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 14,
      "direction": "increase",
      "weight": 14,
      "readable": "cheap reputation extreme (95).",
      "tags": [
        "reputation",
        "cheap"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-reputation_drift-2-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 10,
      "direction": "increase",
      "weight": 10,
      "readable": "miners dominate patronage (89%).",
      "tags": [
        "customer",
        "identity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-104",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 28,
      "direction": "increase",
      "weight": 28,
      "readable": "3 reputation axis/axes pushing past 70.",
      "tags": [
        "pressure",
        "reputation_drift",
        "reputation",
        "identity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "reputation",
        "customers"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-105",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.reputation_drift",
      "sourceType": "pressure",
      "target": "pressure:reputation_drift",
      "targetType": "pressure",
      "amount": 28,
      "direction": "increase",
      "weight": 28,
      "readable": "3 reputation axis/axes pushing past 70.",
      "tags": [
        "pressure",
        "reputation_drift",
        "reputation",
        "identity"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "reputation",
        "customers"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [],
  "stakes": [
    {
      "id": "identity_stake",
      "target": "reputation:cheap",
      "readable": "Identity may lock in",
      "direction": "risk",
      "tags": [
        "reputation",
        "cheap"
      ]
    },
    {
      "id": "audience_stake",
      "target": "service:audience",
      "readable": "Audience may narrow",
      "direction": "risk",
      "tags": [
        "customer"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "reputation_shift_cheap_seen",
      "tags": [
        "reputation",
        "cheap"
      ]
    }
  ],
  "futureHooks": [
    {
      "id": "identity_lock_in_possible",
      "tags": [
        "reputation",
        "identity"
      ]
    }
  ],
  "textIngredients": {
    "subject": "the tavern",
    "problemNoun": "identity shift",
    "sensoryDetails": [
      "regulars settle in",
      "newcomers turn away"
    ],
    "actorOpinions": {
      "regulars": "feel at home here"
    },
    "recentContext": [
      "cheap reputation rising"
    ],
    "stakesReadable": [
      "identity may lock in",
      "audience may narrow"
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

#### Slot: embrace

```json
{
  "responseSlot": {
    "id": "embrace",
    "labelHint": "Embrace the identity",
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
      "lean into reputation",
      "narrow audience"
    ]
  },
  "consequenceProfile": {
    "id": "embrace_profile",
    "responseSlotId": "embrace",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": 5,
        "readable": "Lean into reputation",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cheap",
        "meterLabel": "cheap"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": 3,
        "readable": "Embraced identity continues to drift",
        "tags": [
          "reputation",
          "delay:7"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "cheap",
        "meterLabel": "cheap"
      },
      {
        "kind": "future_hook",
        "target": "identity_lock_in_cheap",
        "amount": 14,
        "readable": "cheap identity may lock in",
        "tags": [
          "future_hook",
          "reputation",
          "cheap"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "identity_lock_in_cheap"
      }
    ],
    "memories": [
      {
        "id": "embraced_cheap_identity",
        "tags": [
          "reputation",
          "cheap"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "identity_lock_in_cheap",
        "tags": [
          "reputation",
          "cheap",
          "identity"
        ]
      }
    ],
    "impactScore": 20
  }
}
```

#### Slot: correct

```json
{
  "responseSlot": {
    "id": "correct",
    "labelHint": "Correct the identity",
    "allowedVerbs": [
      "clean",
      "repair",
      "pay"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "system",
        "id": "reputation"
      }
    ],
    "expectedEffects": [
      "shift reputation away",
      "costly effort"
    ]
  },
  "consequenceProfile": {
    "id": "correct_profile",
    "responseSlotId": "correct",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": -5,
        "readable": "Shift reputation",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "cheap",
        "meterLabel": "cheap"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Effort cost",
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
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": -3,
        "readable": "Correction shows through across the week",
        "tags": [
          "reputation",
          "delay:5"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "cheap",
        "meterLabel": "cheap"
      },
      {
        "kind": "future_hook",
        "target": "identity_correction_cheap",
        "amount": 10,
        "readable": "cheap correction may settle",
        "tags": [
          "future_hook",
          "reputation",
          "cheap"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "identity_correction_cheap"
      }
    ],
    "memories": [
      {
        "id": "corrected_cheap_identity",
        "tags": [
          "reputation",
          "cheap"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "identity_correction_cheap",
        "tags": [
          "reputation",
          "cheap",
          "correction"
        ]
      }
    ],
    "impactScore": 29
  }
}
```

#### Slot: advertise

```json
{
  "responseSlot": {
    "id": "advertise",
    "labelHint": "Advertise to matching group",
    "allowedVerbs": [
      "invite"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "miners"
      },
      {
        "kind": "customer_group",
        "id": "merchants"
      }
    ],
    "expectedEffects": [
      "raise patronage",
      "lock identity"
    ]
  },
  "consequenceProfile": {
    "id": "advertise_profile",
    "responseSlotId": "advertise",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.miners.patronage",
        "amount": 8,
        "readable": "Bring in matching group",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:reputation_drift",
        "amount": 4,
        "readable": "Targeted advertising deepens the drift",
        "tags": [
          "pressure",
          "reputation",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "reputation_drift",
        "meterLabel": "Reputation Drift"
      },
      {
        "kind": "future_hook",
        "target": "audience_lock_cheap",
        "amount": 10,
        "readable": "cheap audience may lock in",
        "tags": [
          "future_hook",
          "reputation",
          "cheap",
          "audience"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "audience_lock_cheap"
      }
    ],
    "memories": [
      {
        "id": "advertised_to_group_recently",
        "tags": [
          "customer",
          "reputation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "audience_lock_cheap",
        "tags": [
          "reputation",
          "cheap",
          "audience"
        ]
      }
    ],
    "impactScore": 22
  }
}
```

#### Slot: diversify

```json
{
  "responseSlot": {
    "id": "diversify",
    "labelHint": "Diversify",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "system",
        "id": "customers"
      }
    ],
    "expectedEffects": [
      "broaden appeal",
      "risk dilution"
    ]
  },
  "consequenceProfile": {
    "id": "diversify_profile",
    "responseSlotId": "diversify",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": -3,
        "readable": "Soften identity",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "cheap",
        "meterLabel": "cheap"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": 4,
        "readable": "Broader appeal lands",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "patronage",
        "meterLabel": "patronage"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 3,
        "readable": "Mixed messages breed gossip",
        "tags": [
          "pressure",
          "rumour",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "future_hook",
        "target": "audience_dilution_cheap",
        "amount": 12,
        "readable": "cheap audience may dilute",
        "tags": [
          "future_hook",
          "reputation",
          "cheap",
          "dilution"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "audience_dilution_cheap"
      }
    ],
    "memories": [
      {
        "id": "diversification_attempted",
        "tags": [
          "reputation",
          "identity"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "audience_dilution_cheap",
        "tags": [
          "reputation",
          "cheap",
          "dilution"
        ]
      }
    ],
    "impactScore": 21
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "embrace",
    "label": "Lean into the identity",
    "verb": "rebrand",
    "targetId": "reputation",
    "shape": "reputation_play",
    "previewEffects": [
      "the cheap name would ease a step from word",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Reputation Cheap +5",
      "later: cheap identity may lock in"
    ]
  },
  {
    "slotId": "correct",
    "label": "Pull the name back",
    "verb": "clean",
    "targetId": "reputation",
    "shape": "long_term_investment",
    "previewEffects": [
      "the cheap name would creep a notch into talk",
      "the till would lighten by a step",
      "later: The identity might lock in further later"
    ],
    "mechanicalEffects": [
      "Reputation Cheap -5",
      "Coin -10",
      "later: cheap correction may settle"
    ]
  },
  {
    "slotId": "advertise",
    "label": "Call the matching crowd in",
    "verb": "invite",
    "targetId": "miners",
    "shape": "compromise",
    "previewEffects": [
      "patronage would climb a real step among the regulars (Miners)",
      "later: cheap audience may lock in"
    ],
    "mechanicalEffects": [
      "Miners Patronage +8",
      "later: cheap audience may lock in"
    ]
  },
  {
    "slotId": "diversify",
    "label": "Broaden the offer",
    "verb": "rebrand",
    "targetId": "customers",
    "shape": "compromise",
    "previewEffects": [
      "talk would dim a touch around the tavern",
      "patronage would rise a step at the regular tables (Merchants)",
      "later: cheap audience may dilute"
    ],
    "mechanicalEffects": [
      "Reputation Cheap -3",
      "Merchants Patronage +4",
      "later: cheap audience may dilute"
    ]
  }
]
```

## rumour_crisis

- **Scenario:** rumour_crisis
- **Card id:** rumour_crisis.rumour
- **Seed:** `seed-rumour_crisis-supplier-brakka_mushroom_cart-d0`
- **Family/type/timing:** rumour_crisis / rumour / closing
- **Severity/urgency/novelty/cardWorthiness:** 100 / 100 / 100 / 100
- **Domain:** rumours, reputation, social, rumour.false, rumour.target.supplier

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-rumour_pressure-0-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rumour_pressure",
      "sourceType": "pressure",
      "target": "pressure:rumour_pressure",
      "targetType": "pressure",
      "amount": 50,
      "direction": "increase",
      "weight": 50,
      "readable": "Active rumours total strength 165.",
      "tags": [
        "rumour"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-rumour_pressure-1-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rumour_pressure",
      "sourceType": "pressure",
      "target": "pressure:rumour_pressure",
      "targetType": "pressure",
      "amount": 26,
      "direction": "increase",
      "weight": 26,
      "readable": "distrust supplier:brakka_mushroom_cart circulating (strength 85).",
      "tags": [
        "rumour",
        "attribution",
        "rumour",
        "supplier"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-rumour_pressure-2-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rumour_pressure",
      "sourceType": "pressure",
      "target": "pressure:rumour_pressure",
      "targetType": "pressure",
      "amount": 24,
      "direction": "increase",
      "weight": 24,
      "readable": "Spoiled goods rumour spreads circulating (strength 80).",
      "tags": [
        "rumour",
        "rumour",
        "supplier"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-143",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rumour_pressure",
      "sourceType": "pressure",
      "target": "pressure:rumour_pressure",
      "targetType": "pressure",
      "amount": 100,
      "direction": "increase",
      "weight": 100,
      "readable": "Active rumours total strength 165.",
      "tags": [
        "pressure",
        "rumour_pressure",
        "rumour",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "rumours",
        "attribution",
        "memories"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-144",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rumour_pressure",
      "sourceType": "pressure",
      "target": "pressure:rumour_pressure",
      "targetType": "pressure",
      "amount": 100,
      "direction": "increase",
      "weight": 100,
      "readable": "Active rumours total strength 165.",
      "tags": [
        "pressure",
        "rumour_pressure",
        "rumour",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "rumours",
        "attribution",
        "memories"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
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
      "source": "attribution.rumour_seeded",
      "sourceType": "memory",
      "target": "rumour_distrust_supplier_brakka_mushroom_cart",
      "targetType": "rumour",
      "amount": 85,
      "direction": "increase",
      "weight": 85,
      "readable": "Attribution seeded rumour rumour_distrust_supplier_brakka_mushroom_cart",
      "tags": [
        "attribution",
        "rumour",
        "new"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "rumour",
        "attribution"
      ],
      "ageDays": 0
    }
  ],
  "pressures": [
    {
      "id": "rumour_pressure",
      "label": "Rumour Pressure",
      "value": 100,
      "previousValue": 0,
      "delta": 100,
      "trend": "stable",
      "severity": 100,
      "urgency": 100,
      "volatility": 100,
      "causes": [
        {
          "id": "active_rumours",
          "readable": "Active rumours total strength 165.",
          "amount": 50,
          "weight": 50,
          "direction": "increase",
          "tags": [
            "rumour"
          ],
          "relatedSystems": [
            "rumours"
          ]
        },
        {
          "id": "rumour_rumour_distrust_supplier_brakka_mushroom_cart",
          "readable": "distrust supplier:brakka_mushroom_cart circulating (strength 85).",
          "amount": 26,
          "weight": 26,
          "direction": "increase",
          "tags": [
            "rumour",
            "attribution",
            "rumour",
            "supplier"
          ],
          "relatedActors": [
            {
              "kind": "rumour",
              "id": "rumour_distrust_supplier_brakka_mushroom_cart"
            },
            {
              "kind": "supplier",
              "id": "brakka_mushroom_cart"
            }
          ],
          "relatedSystems": [
            "rumours"
          ]
        },
        {
          "id": "rumour_rumour_spoiled_goods",
          "readable": "Spoiled goods rumour spreads circulating (strength 80).",
          "amount": 24,
          "weight": 24,
          "direction": "increase",
          "tags": [
            "rumour",
            "rumour",
            "supplier"
          ],
          "relatedActors": [
            {
              "kind": "rumour",
              "id": "rumour_spoiled_goods"
            },
            {
              "kind": "supplier",
              "id": "brakka_mushroom_cart"
            }
          ],
          "relatedSystems": [
            "rumours"
          ]
        },
        {
          "id": "false_rumours",
          "readable": "False or partial rumours circulating (strength 165).",
          "amount": 33,
          "weight": 33,
          "direction": "increase",
          "tags": [
            "rumour",
            "false"
          ],
          "relatedSystems": [
            "rumours"
          ]
        },
        {
          "id": "public_attributions",
          "readable": "Highly public attributions (strength 226).",
          "amount": 19,
          "weight": 19,
          "direction": "increase",
          "tags": [
            "attribution",
            "public"
          ],
          "relatedSystems": [
            "attribution"
          ]
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "rumours",
        "attribution",
        "memories"
      ],
      "tags": [
        "rumour",
        "social",
        "expanded"
      ],
      "consequences": [
        "Reputation shift seeds become likely.",
        "False accusation seeds may appear.",
        "Apology / social-action response slots open up."
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
      "id": "reputation_drift",
      "label": "Reputation Drift",
      "value": 8,
      "previousValue": 20,
      "delta": -12,
      "trend": "stable",
      "severity": 8,
      "urgency": 8,
      "volatility": 96,
      "causes": [
        {
          "id": "strong_axes",
          "readable": "1 reputation axis/axes pushing past 70.",
          "amount": 8,
          "weight": 8,
          "direction": "increase",
          "tags": [
            "reputation",
            "identity"
          ],
          "relatedSystems": [
            "reputation"
          ]
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "reputation",
        "customers"
      ],
      "tags": [
        "reputation",
        "identity"
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
      "id": "rumour_stake",
      "target": "rumour:supplier:brakka_mushroom_cart",
      "readable": "Rumour may spread",
      "direction": "risk",
      "tags": [
        "rumour"
      ]
    },
    {
      "id": "reputation_stake",
      "target": "reputation:dangerous",
      "readable": "Reputation may rot",
      "direction": "loss",
      "tags": [
        "reputation"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "rumour_seed_supplier_brakka_mushroom_cart",
      "actors": [
        {
          "kind": "supplier",
          "id": "brakka_mushroom_cart"
        }
      ],
      "tags": [
        "rumour",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Brakka Mushroom Cart",
    "problemNoun": "false rumour",
    "sensoryDetails": [
      "whispered word",
      "turned heads"
    ],
    "actorOpinions": {
      "source": "will not stop talking"
    },
    "recentContext": [
      "publicness 95"
    ],
    "stakesReadable": [
      "rumour may spread",
      "reputation may rot"
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
      "accuracy: false"
    ],
    "perceivedBlame": [
      "False rumour blames supplier."
    ],
    "pressureContext": [
      "rumour pressure 100"
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

#### Slot: deny_rumour

```json
{
  "responseSlot": {
    "id": "deny_rumour",
    "labelHint": "Deny the rumour",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "reputation_play",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "shift attribution",
      "risk credibility"
    ]
  },
  "consequenceProfile": {
    "id": "deny_rumour_profile",
    "responseSlotId": "deny_rumour",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -10,
        "readable": "Public denial blunts rumour",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -6,
        "readable": "Credibility takes a hit",
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
        "target": "reputation.reliable",
        "amount": -8,
        "readable": "Audience doubts the protest",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "reliable",
        "meterLabel": "reliable"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 4,
        "readable": "Friction lingers",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 6,
        "readable": "Whisper rebounds",
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
        "kind": "future_hook",
        "target": "rumour_denial_backfire_supplier_brakka_mushroom_cart",
        "amount": 12,
        "readable": "Denial may backfire if true",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_denial_backfire_supplier_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "rumour_denied_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "denial",
          "reputation",
          "false_blame"
        ]
      },
      {
        "id": "tavern_denial_brakka_mushroom_cart",
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
          "rumour"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rumour_denial_backfire_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "risk"
        ]
      }
    ],
    "impactScore": 44
  }
}
```

#### Slot: confess_partial_truth

```json
{
  "responseSlot": {
    "id": "confess_partial_truth",
    "labelHint": "Confess partial truth",
    "allowedVerbs": [
      "confess"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "lower distrust",
      "admit fault"
    ]
  },
  "consequenceProfile": {
    "id": "confess_partial_truth_profile",
    "responseSlotId": "confess_partial_truth",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -15,
        "readable": "Honesty disarms the rumour",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 8,
        "readable": "Audience respects candour",
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
        "target": "reputation.reliable",
        "amount": 10,
        "readable": "Reliable reputation grows",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "reliable",
        "meterLabel": "reliable"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": 8,
        "readable": "Target gets context",
        "tags": [
          "rumour",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": -4,
        "readable": "Open-hand signal",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "rumour_confessed_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "confess",
          "honesty",
          "attribution"
        ]
      },
      {
        "id": "tavern_confession_brakka_mushroom_cart",
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
          "honesty"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 45
  }
}
```

#### Slot: blame_someone_else

```json
{
  "responseSlot": {
    "id": "blame_someone_else",
    "labelHint": "Blame someone else",
    "allowedVerbs": [
      "blame"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      },
      {
        "kind": "customer_group",
        "id": "miners"
      }
    ],
    "expectedEffects": [
      "shift blame",
      "create grudge"
    ]
  },
  "consequenceProfile": {
    "id": "blame_someone_else_profile",
    "responseSlotId": "blame_someone_else",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -8,
        "readable": "Deflection muddies the story",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -4,
        "readable": "Audience smells dishonesty",
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
        "target": "supplier:brakka_mushroom_cart",
        "amount": -10,
        "readable": "Tavern smeared the target",
        "tags": [
          "rumour",
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
        "target": "pressure:cultural_tension",
        "amount": 6,
        "readable": "Blamed party simmers",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 8,
        "readable": "Simmer becomes a glare",
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
        "target": "pressure:faction_anger",
        "amount": 6,
        "readable": "Faction tied to blame is sore",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "faction_anger",
        "meterLabel": "Faction Anger"
      },
      {
        "kind": "future_hook",
        "target": "rumour_blame_grudge_supplier_brakka_mushroom_cart",
        "amount": 14,
        "readable": "Blamed party may grudge",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_blame_grudge_supplier_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "rumour_deflected_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "deception",
          "blame",
          "grudge",
          "attribution"
        ]
      },
      {
        "id": "rumour_source_blamed_customer_group_miners",
        "actors": [
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "grudge",
          "attribution"
        ]
      },
      {
        "id": "tavern_deflection_brakka_mushroom_cart",
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
        "id": "rumour_blame_grudge_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "risk",
          "grudge"
        ]
      }
    ],
    "impactScore": 49
  }
}
```

#### Slot: prove_truth

```json
{
  "responseSlot": {
    "id": "prove_truth",
    "labelHint": "Prove the truth",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      }
    ],
    "expectedEffects": [
      "lower rumour",
      "effort cost"
    ]
  },
  "consequenceProfile": {
    "id": "prove_truth_profile",
    "responseSlotId": "prove_truth",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -20,
        "readable": "Evidence ends the rumour",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 12,
        "readable": "Credibility climbs",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "respectable",
        "meterLabel": "respectable"
      },
      {
        "kind": "state_change",
        "target": "reputation.reliable",
        "amount": 8,
        "readable": "Reliable reputation grows",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "reliable",
        "meterLabel": "reliable"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -10,
        "readable": "Investigation costs",
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
        "target": "supplier:brakka_mushroom_cart",
        "amount": 12,
        "readable": "Target name cleared",
        "tags": [
          "rumour",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [],
    "memories": [
      {
        "id": "rumour_disproved_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "truth",
          "investment",
          "attribution"
        ]
      },
      {
        "id": "rumour_witness_starter_regular_local_goblins_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_local_goblins_1"
          }
        ],
        "tags": [
          "regular",
          "witness",
          "favorite_order"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 60
  }
}
```

#### Slot: bribe_gossip

```json
{
  "responseSlot": {
    "id": "bribe_gossip",
    "labelHint": "Bribe the gossip",
    "allowedVerbs": [
      "bribe"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "miners"
      }
    ],
    "expectedEffects": [
      "silence source",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "bribe_gossip_profile",
    "responseSlotId": "bribe_gossip",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Pay the gossip",
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
        "target": "pressure:rumour_pressure",
        "amount": -12,
        "readable": "Source quiets down",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -6,
        "readable": "Bribery whispers anyway",
        "tags": [
          "rumour",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "brakka_mushroom_cart"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 8,
        "readable": "Trust in tavern dents",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 5,
        "readable": "Someone always talks",
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
        "kind": "future_hook",
        "target": "rumour_bribe_exposed_supplier_brakka_mushroom_cart",
        "amount": 15,
        "readable": "Bribe may be exposed",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rumour_bribe_exposed_supplier_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "rumour_bribed_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "bribe",
          "risk",
          "attribution"
        ]
      },
      {
        "id": "tavern_bribed_gossip_brakka_mushroom_cart",
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
        "id": "rumour_bribe_exposed_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "risk",
          "corruption"
        ]
      }
    ],
    "impactScore": 59
  }
}
```

#### Slot: ignore_rumour

```json
{
  "responseSlot": {
    "id": "ignore_rumour",
    "labelHint": "Ignore the rumour",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "rumour grows"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_rumour_profile",
    "responseSlotId": "ignore_rumour",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -4,
        "readable": "Silence reads as guilt",
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
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 12,
        "readable": "Silence lets rumour grow",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 8,
        "readable": "Reputation rots",
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
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 6,
        "readable": "Regulars drift away",
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
        "id": "rumour_ignored_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "ignored",
          "false_blame"
        ]
      },
      {
        "id": "tavern_silent_brakka_mushroom_cart",
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
          "rumour"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rumour_escalation_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "risk"
        ]
      }
    ],
    "impactScore": 31
  }
}
```

#### Slot: counter_rumour

```json
{
  "responseSlot": {
    "id": "counter_rumour",
    "labelHint": "Plant a counter-rumour",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "brakka_mushroom_cart"
      },
      {
        "kind": "regular",
        "id": "starter_regular_local_goblins_1"
      }
    ],
    "expectedEffects": [
      "drown out original rumour",
      "add new lie to ledger"
    ]
  },
  "consequenceProfile": {
    "id": "counter_rumour_profile",
    "responseSlotId": "counter_rumour",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -8,
        "readable": "Counter-rumour confuses gossip",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": -4,
        "readable": "Sleight of tongue noticed",
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
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 10,
        "readable": "Two stories collide",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      },
      {
        "kind": "cause",
        "target": "supplier:brakka_mushroom_cart",
        "amount": -4,
        "readable": "New lie cluster planted",
        "tags": [
          "rumour",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "brakka_mushroom_cart"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "counter_rumour_runaway_brakka_mushroom_cart",
        "amount": 14,
        "readable": "Counter-rumour may run away",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "counter_rumour_runaway_brakka_mushroom_cart"
      }
    ],
    "memories": [
      {
        "id": "rumour_counter_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "deception",
          "false_blame",
          "attribution"
        ]
      },
      {
        "id": "rumour_counter_source_starter_regular_local_goblins_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_local_goblins_1"
          }
        ],
        "tags": [
          "regular",
          "deception"
        ]
      },
      {
        "id": "tavern_counter_rumour_brakka_mushroom_cart",
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
        "id": "counter_rumour_runaway_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          }
        ],
        "tags": [
          "rumour",
          "risk"
        ]
      }
    ],
    "impactScore": 40
  }
}
```

#### Slot: ask_regular_to_vouch

```json
{
  "responseSlot": {
    "id": "ask_regular_to_vouch",
    "labelHint": "Ask Nib Pickle-Foot to vouch",
    "allowedVerbs": [
      "invite",
      "negotiate"
    ],
    "shape": "safe_costly",
    "targetOptions": [
      {
        "kind": "regular",
        "id": "starter_regular_local_goblins_1"
      }
    ],
    "expectedEffects": [
      "lower rumour",
      "spend regular goodwill"
    ]
  },
  "consequenceProfile": {
    "id": "ask_regular_to_vouch_profile",
    "responseSlotId": "ask_regular_to_vouch",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -12,
        "readable": "Regular vouches publicly",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 5,
        "readable": "Credible voice helps",
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
        "target": "world.regulars.starter_regular_local_goblins_1.loyalty",
        "amount": -3,
        "readable": "Favour drawn down",
        "tags": [
          "regular"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "loyalty",
        "meterLabel": "loyalty"
      },
      {
        "kind": "cause",
        "target": "regular:starter_regular_local_goblins_1",
        "amount": -5,
        "readable": "Tavern owes the vouch",
        "tags": [
          "regular",
          "attribution"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "starter_regular_local_goblins_1"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "regular_favour_owed_starter_regular_local_goblins_1",
        "amount": 10,
        "readable": "Owed favour returns later",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "regular_favour_owed_starter_regular_local_goblins_1"
      }
    ],
    "memories": [
      {
        "id": "rumour_vouch_starter_regular_local_goblins_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_local_goblins_1"
          }
        ],
        "tags": [
          "regular",
          "favorite_order",
          "attribution"
        ]
      },
      {
        "id": "rumour_vouched_target_supplier_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "regular",
            "id": "starter_regular_local_goblins_1"
          }
        ],
        "tags": [
          "rumour",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "regular_favour_owed_starter_regular_local_goblins_1",
        "actors": [
          {
            "kind": "regular",
            "id": "starter_regular_local_goblins_1"
          }
        ],
        "tags": [
          "regular",
          "opportunity"
        ]
      }
    ],
    "impactScore": 36
  }
}
```

#### Slot: name_source_publicly

```json
{
  "responseSlot": {
    "id": "name_source_publicly",
    "labelHint": "Name Miners publicly",
    "allowedVerbs": [
      "blame",
      "confess"
    ],
    "shape": "escalation",
    "targetOptions": [
      {
        "kind": "customer_group",
        "id": "miners"
      }
    ],
    "expectedEffects": [
      "flip blame onto source",
      "risk faction anger"
    ]
  },
  "consequenceProfile": {
    "id": "name_source_publicly_profile",
    "responseSlotId": "name_source_publicly",
    "immediateEffects": [
      {
        "kind": "cause",
        "target": "customer_group:miners",
        "amount": -15,
        "readable": "Source named in public",
        "tags": [
          "rumour",
          "blame",
          "attribution"
        ],
        "targetKind": "cohort",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "miners"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": -6,
        "readable": "Story flips toward source",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "pressure",
        "target": "pressure:cultural_tension",
        "amount": 12,
        "readable": "Public naming heats culture",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "cultural_tension",
        "meterLabel": "Cultural Tension"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 6,
        "readable": "Owner shows teeth",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "public_naming_blowback_miners",
        "amount": 16,
        "readable": "Public naming risks blowback",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "public_naming_blowback_miners"
      }
    ],
    "memories": [
      {
        "id": "rumour_source_named_customer_group_miners",
        "actors": [
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "grudge",
          "attribution",
          "false_blame"
        ]
      },
      {
        "id": "rumour_publicly_named_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "supplier",
            "id": "brakka_mushroom_cart"
          },
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "attribution"
        ]
      },
      {
        "id": "tavern_publicly_named_brakka_mushroom_cart",
        "actors": [
          {
            "kind": "customer_group",
            "id": "miners"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "escalation"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "public_naming_blowback_miners",
        "actors": [
          {
            "kind": "customer_group",
            "id": "miners"
          }
        ],
        "tags": [
          "rumour",
          "risk"
        ]
      }
    ],
    "impactScore": 50
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "deny_rumour",
    "label": "Cut the story dead",
    "verb": "rebrand",
    "targetId": "brakka_mushroom_cart",
    "shape": "reputation_play",
    "previewEffects": [
      "the rumour pressure would fall a real slip tonight",
      "the respectable name would slip a notch in word",
      "Audience doubts the protest",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Rumour Pressure -10",
      "Reputation Respectable -6",
      "Reputation Reliable -8",
      "later: Denial may backfire if true"
    ]
  },
  {
    "slotId": "confess_partial_truth",
    "label": "Tell the honest part",
    "verb": "confess",
    "targetId": "brakka_mushroom_cart",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "Honesty disarms the rumour",
      "respectable standing would gain a step in talk",
      "reliable standing would steady a real step in talk"
    ],
    "mechanicalEffects": [
      "Rumour Pressure -15",
      "Reputation Respectable +8",
      "Reputation Reliable +10"
    ]
  },
  {
    "slotId": "blame_someone_else",
    "label": "Push it onto another",
    "verb": "blame",
    "targetId": "brakka_mushroom_cart",
    "shape": "deception",
    "previewEffects": [
      "the rumour pressure would ease a step from the room",
      "talk would dim a touch around the tavern",
      "a marked fall would chill the merchant route",
      "later: A risk would remain on the slate for later"
    ],
    "mechanicalEffects": [
      "Rumour Pressure -8",
      "Reputation Respectable -4",
      "Brakka Mushroom Cart -10",
      "later: Blamed party may grudge"
    ]
  },
  {
    "slotId": "prove_truth",
    "label": "Settle it with evidence",
    "verb": "rebrand",
    "targetId": "brakka_mushroom_cart",
    "shape": "long_term_investment",
    "previewEffects": [
      "a heavy fall would lift the worst pressure off",
      "respectable standing would climb a real step in talk",
      "a measure of coppers would leave the till"
    ],
    "mechanicalEffects": [
      "Rumour Pressure -20",
      "Reputation Respectable +12",
      "Coin -10"
    ]
  },
  {
    "slotId": "bribe_gossip",
    "label": "Buy the silence outright",
    "verb": "bribe",
    "targetId": "miners",
    "shape": "risky_profitable",
    "previewEffects": [
      "a marked fall of silver would empty the till",
      "a marked fall would ease the risk taken",
      "a notch would loosen the supplier deal",
      "later: Bribe may be exposed"
    ],
    "mechanicalEffects": [
      "Coin -20",
      "Rumour Pressure -12",
      "Brakka Mushroom Cart -6",
      "later: Bribe may be exposed"
    ]
  },
  {
    "slotId": "counter_rumour",
    "label": "Plant a louder story",
    "verb": "rebrand",
    "targetId": "brakka_mushroom_cart",
    "shape": "deception",
    "previewEffects": [
      "Counter-rumour confuses gossip",
      "a hair of standing would slip from the name",
      "cultural tension would climb a marked rise tonight",
      "later: Counter-rumour may run away"
    ],
    "mechanicalEffects": [
      "Rumour Pressure -8",
      "Reputation Respectable -4",
      "Cultural Tension +10",
      "later: Counter-rumour may run away"
    ]
  },
  {
    "slotId": "ignore_rumour",
    "label": "Let it travel",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "Silence reads as guilt"
    ],
    "mechanicalEffects": [
      "Reputation Respectable -4"
    ]
  }
]
```

## rival_tavern_arc

- **Scenario:** rival_tavern_arc
- **Card id:** rival_tavern.social_conflict
- **Seed:** `seed-rival_tavern-rival_tavern_arc-d0`
- **Family/type/timing:** rival_tavern / social_conflict / closing
- **Severity/urgency/novelty/cardWorthiness:** 42 / 42 / 100 / 76
- **Domain:** rival, market, customers, rival.arc

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-rival_tavern_pressure-0-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": 42,
      "direction": "increase",
      "weight": 42,
      "readable": "1 rival arc(s) active (intensity 70).",
      "tags": [
        "rival",
        "arc"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-151",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": -18,
      "direction": "decrease",
      "weight": 18,
      "readable": "1 rival arc(s) active (intensity 70).",
      "tags": [
        "pressure",
        "rival_tavern_pressure",
        "rival",
        "market",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "rival_tavern_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-152",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": -18,
      "direction": "decrease",
      "weight": 18,
      "readable": "1 rival arc(s) active (intensity 70).",
      "tags": [
        "pressure",
        "rival_tavern_pressure",
        "rival",
        "market",
        "social",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "rival_tavern_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-153",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
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
        "pressure",
        "market_instability",
        "market",
        "expanded"
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
      "ageDays": 0,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "rival_tavern_pressure",
      "label": "Rival Tavern Pressure",
      "value": 42,
      "previousValue": 60,
      "delta": -18,
      "trend": "stable",
      "severity": 42,
      "urgency": 42,
      "volatility": 100,
      "causes": [
        {
          "id": "rival_arc_active",
          "readable": "1 rival arc(s) active (intensity 70).",
          "amount": 42,
          "weight": 42,
          "direction": "increase",
          "tags": [
            "rival",
            "arc"
          ],
          "relatedActors": [
            {
              "kind": "local_event",
              "id": "rival_tavern_arc"
            }
          ],
          "relatedSystems": [
            "localArcs"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "rival_tavern_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "tags": [
        "rival",
        "market",
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
      "id": "regular_customer_loss",
      "label": "Regular Customer Loss",
      "value": 0,
      "previousValue": 0,
      "delta": 0,
      "trend": "stable",
      "severity": 0,
      "urgency": 0,
      "volatility": 0,
      "causes": [],
      "relatedActors": [],
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
      "id": "rival_stake",
      "target": "rival:tavern",
      "readable": "Rival may steal market",
      "direction": "risk",
      "tags": [
        "rival"
      ]
    },
    {
      "id": "regular_stake",
      "target": "regulars",
      "readable": "Regulars may leave",
      "direction": "loss",
      "tags": [
        "regular"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "rival_seed_rival_tavern_arc",
      "actors": [
        {
          "kind": "local_event",
          "id": "rival_tavern_arc"
        }
      ],
      "tags": [
        "rival",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "the rival tavern",
    "problemNoun": "rival pressure",
    "sensoryDetails": [
      "empty tables",
      "distant cheer"
    ],
    "actorOpinions": {
      "regulars": "mention the other place"
    },
    "recentContext": [
      "rival pressure 42"
    ],
    "stakesReadable": [
      "regulars may leave",
      "market may shift"
    ],
    "namedEntities": [
      {
        "role": "rival",
        "ref": {
          "kind": "local_event",
          "id": "rival_tavern_arc"
        },
        "displayName": "Rival tavern expands"
      }
    ],
    "marketContext": [
      "pressure 42"
    ],
    "arcContext": [
      "arc Rival tavern expands"
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

#### Slot: compete_on_price

```json
{
  "responseSlot": {
    "id": "compete_on_price",
    "labelHint": "Compete on price",
    "allowedVerbs": [
      "lower_price"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise patronage",
      "lose margin"
    ]
  },
  "consequenceProfile": {
    "id": "compete_on_price_profile",
    "responseSlotId": "compete_on_price",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.local_goblins.patronage",
        "amount": 8,
        "readable": "Locals return for cheap drink",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "customers.miners.patronage",
        "amount": 10,
        "readable": "Miners drift back",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -12,
        "readable": "Margin erodes",
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
        "target": "pressure:rival_tavern_pressure",
        "amount": -8,
        "readable": "Rival pressure eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      }
    ],
    "memories": [
      {
        "id": "rival_priced_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "compete",
          "price"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 38
  }
}
```

#### Slot: host_counter_event

```json
{
  "responseSlot": {
    "id": "host_counter_event",
    "labelHint": "Host counter-event",
    "allowedVerbs": [
      "invite"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "local_event",
        "id": "rival_tavern_arc"
      }
    ],
    "expectedEffects": [
      "raise patronage",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "host_counter_event_profile",
    "responseSlotId": "host_counter_event",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": 12,
        "readable": "Merchants drawn in",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "customers.adventurers.patronage",
        "amount": 10,
        "readable": "Adventurers come for the show",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Event cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -12,
        "readable": "Rival upstaged",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.cozy",
        "amount": 8,
        "readable": "Tavern feels lively",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cozy",
        "meterLabel": "cozy"
      }
    ],
    "memories": [
      {
        "id": "rival_counter_event_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "event",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 58
  }
}
```

#### Slot: improve_quality

```json
{
  "responseSlot": {
    "id": "improve_quality",
    "labelHint": "Improve quality",
    "allowedVerbs": [
      "upgrade"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise reputation",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "improve_quality_profile",
    "responseSlotId": "improve_quality",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.tasty",
        "amount": 12,
        "readable": "Quality improves reputation",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "tasty",
        "meterLabel": "tasty"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 8,
        "readable": "Standards rise",
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
        "target": "coin",
        "amount": -15,
        "readable": "Investment cost",
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
        "target": "pressure:rival_tavern_pressure",
        "amount": -10,
        "readable": "Rival pressure recedes",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      }
    ],
    "memories": [
      {
        "id": "rival_quality_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "quality",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 44
  }
}
```

#### Slot: spread_counter_rumour

```json
{
  "responseSlot": {
    "id": "spread_counter_rumour",
    "labelHint": "Spread counter-rumour",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "local_event",
        "id": "rival_tavern_arc"
      }
    ],
    "expectedEffects": [
      "hurt rival",
      "risk discovery"
    ]
  },
  "consequenceProfile": {
    "id": "spread_counter_rumour_profile",
    "responseSlotId": "spread_counter_rumour",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -10,
        "readable": "Rumour weakens rival",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 10,
        "readable": "Town gossip stirs",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "rival_rumour_exposed_rival_tavern_arc",
        "amount": 0,
        "readable": "Counter-rumour may be exposed",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "rival_rumour_exposed_rival_tavern_arc"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 6,
        "readable": "Reputation darkens",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      }
    ],
    "memories": [
      {
        "id": "rival_counter_rumour_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "deception",
          "rumour"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rival_rumour_exposed_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "risk"
        ]
      }
    ],
    "impactScore": 28
  }
}
```

#### Slot: negotiate_with_rival

```json
{
  "responseSlot": {
    "id": "negotiate_with_rival",
    "labelHint": "Negotiate with the rival",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "local_event",
        "id": "rival_tavern_arc"
      }
    ],
    "expectedEffects": [
      "share market",
      "lose autonomy"
    ]
  },
  "consequenceProfile": {
    "id": "negotiate_with_rival_profile",
    "responseSlotId": "negotiate_with_rival",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -12,
        "readable": "Truce eases rival pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 4,
        "readable": "Civility noted",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": -6,
        "readable": "Shared market splits",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "patronage",
        "meterLabel": "patronage"
      }
    ],
    "memories": [
      {
        "id": "rival_negotiated_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "compromise"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 21
  }
}
```

#### Slot: ignore_rival

```json
{
  "responseSlot": {
    "id": "ignore_rival",
    "labelHint": "Ignore the rival",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "rival grows"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_rival_profile",
    "responseSlotId": "ignore_rival",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": 12,
        "readable": "Rival grows unchecked",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": -8,
        "readable": "Merchants drift away",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 6,
        "readable": "Regulars hear of the other place",
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
        "id": "rival_ignored_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
          "ignored"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rival_dominance_rival_tavern_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "rival_tavern_arc"
          }
        ],
        "tags": [
          "rival",
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
    "slotId": "compete_on_price",
    "label": "Match the rival on price",
    "verb": "lower_price",
    "targetId": "ale",
    "shape": "risky_profitable",
    "previewEffects": [
      "patronage would swell a marked rise at the regular tables (Local Goblins)",
      "patronage would swell a marked rise at the regular tables (Miners)",
      "a notch of silver would slip from the purse"
    ],
    "mechanicalEffects": [
      "Local Goblins Patronage +8",
      "Miners Patronage +10",
      "Coin -12"
    ]
  },
  {
    "slotId": "host_counter_event",
    "label": "Throw a counter-event",
    "verb": "invite",
    "targetId": "rival_tavern_arc",
    "shape": "long_term_investment",
    "previewEffects": [
      "patronage would climb a real step among the regulars (Merchants)",
      "patronage would climb a real step among the regulars (Adventurers)",
      "a clear drop of silver would leave the till"
    ],
    "mechanicalEffects": [
      "Merchants Patronage +12",
      "Adventurers Patronage +10",
      "Coin -20"
    ]
  },
  {
    "slotId": "improve_quality",
    "label": "Outshine the named house",
    "verb": "upgrade",
    "targetId": "ale",
    "shape": "long_term_investment",
    "previewEffects": [
      "the tasty name would spread a marked rise in word",
      "respectable standing would gain a step in talk",
      "the till would lighten by a step"
    ],
    "mechanicalEffects": [
      "Reputation Tasty +12",
      "Reputation Respectable +8",
      "Coin -15"
    ]
  },
  {
    "slotId": "spread_counter_rumour",
    "label": "Plant a counter-rumour",
    "verb": "rebrand",
    "targetId": "rival_tavern_arc",
    "shape": "deception",
    "previewEffects": [
      "the rival's pressure would fall a real slip back",
      "rumour pressure would mount a clear lift overnight",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure -10",
      "Rumour Pressure +10",
      "later: Counter-rumour may be exposed"
    ]
  },
  {
    "slotId": "negotiate_with_rival",
    "label": "Settle a truce with them",
    "verb": "negotiate",
    "targetId": "rival_tavern_arc",
    "shape": "compromise",
    "previewEffects": [
      "a marked fall would settle the meter for now",
      "a hair of repute would settle on the name"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure -12",
      "Reputation Respectable +4"
    ]
  },
  {
    "slotId": "ignore_rival",
    "label": "Let them have the night",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "the rival's pressure would mount a clear lift overnight",
      "patronage would fall a clear drop among the patrons (Merchants)",
      "pressure would keep climbing a step unchecked"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure +12",
      "Merchants Patronage -8",
      "Regular Customer Loss +6"
    ]
  }
]
```

## rival_tavern_system

- **Scenario:** rival_tavern_system
- **Card id:** rival_tavern.social_conflict
- **Seed:** `seed-rival_tavern-rival-d0`
- **Family/type/timing:** rival_tavern / social_conflict / closing
- **Severity/urgency/novelty/cardWorthiness:** 35 / 35 / 100 / 62
- **Domain:** rival, market, customers, rival.system

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "pressure-rival_tavern_pressure-0-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": 5,
      "direction": "increase",
      "weight": 5,
      "readable": "Reputation drift (38) makes the rival look attractive.",
      "tags": [
        "reputation",
        "web"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-rival_tavern_pressure-1-0",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": 30,
      "direction": "increase",
      "weight": 30,
      "readable": "Rumours crediting the rival (strength 365).",
      "tags": [
        "rumour",
        "rival"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-0-83",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": 35,
      "direction": "increase",
      "weight": 35,
      "readable": "Rumours crediting the rival (strength 365).",
      "tags": [
        "pressure",
        "rival_tavern_pressure",
        "rival",
        "market",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-84",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.rival_tavern_pressure",
      "sourceType": "pressure",
      "target": "pressure:rival_tavern_pressure",
      "targetType": "pressure",
      "amount": 35,
      "direction": "increase",
      "weight": 35,
      "readable": "Rumours crediting the rival (strength 365).",
      "tags": [
        "pressure",
        "rival_tavern_pressure",
        "rival",
        "market",
        "social",
        "expanded"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "ageDays": 0,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-85",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
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
        "pressure",
        "market_instability",
        "market",
        "expanded"
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
      "ageDays": 0,
      "expiresAfterDays": 7
    }
  ],
  "pressures": [
    {
      "id": "rival_tavern_pressure",
      "label": "Rival Tavern Pressure",
      "value": 35,
      "previousValue": 0,
      "delta": 35,
      "trend": "stable",
      "severity": 35,
      "urgency": 35,
      "volatility": 100,
      "causes": [
        {
          "id": "reputation_drift_bleed",
          "readable": "Reputation drift (38) makes the rival look attractive.",
          "amount": 5,
          "weight": 5,
          "direction": "increase",
          "tags": [
            "reputation",
            "web"
          ],
          "relatedSystems": [
            "reputation",
            "pressures"
          ]
        },
        {
          "id": "rival_rumours",
          "readable": "Rumours crediting the rival (strength 365).",
          "amount": 30,
          "weight": 30,
          "direction": "increase",
          "tags": [
            "rumour",
            "rival"
          ],
          "relatedSystems": [
            "rumours"
          ]
        }
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "reputation",
        "regulars",
        "rumours",
        "tavernIdentity"
      ],
      "tags": [
        "rival",
        "market",
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
      "id": "regular_customer_loss",
      "label": "Regular Customer Loss",
      "value": 0,
      "previousValue": 0,
      "delta": 0,
      "trend": "stable",
      "severity": 0,
      "urgency": 0,
      "volatility": 0,
      "causes": [],
      "relatedActors": [],
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
      "id": "rival_stake",
      "target": "rival:tavern",
      "readable": "Rival may steal market",
      "direction": "risk",
      "tags": [
        "rival"
      ]
    },
    {
      "id": "regular_stake",
      "target": "regulars",
      "readable": "Regulars may leave",
      "direction": "loss",
      "tags": [
        "regular"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "rival_seed_rival_tavern",
      "actors": [
        {
          "kind": "system",
          "id": "rival_tavern"
        }
      ],
      "tags": [
        "rival",
        "warning"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "the rival tavern",
    "problemNoun": "rival pressure",
    "sensoryDetails": [
      "empty tables",
      "distant cheer"
    ],
    "actorOpinions": {
      "regulars": "mention the other place"
    },
    "recentContext": [
      "rival pressure 35"
    ],
    "stakesReadable": [
      "regulars may leave",
      "market may shift"
    ],
    "namedEntities": [
      {
        "role": "rival",
        "ref": {
          "kind": "system",
          "id": "rival_tavern"
        },
        "displayName": "rival_tavern"
      }
    ],
    "marketContext": [
      "pressure 35"
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

#### Slot: compete_on_price

```json
{
  "responseSlot": {
    "id": "compete_on_price",
    "labelHint": "Compete on price",
    "allowedVerbs": [
      "lower_price"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise patronage",
      "lose margin"
    ]
  },
  "consequenceProfile": {
    "id": "compete_on_price_profile",
    "responseSlotId": "compete_on_price",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.local_goblins.patronage",
        "amount": 8,
        "readable": "Locals return for cheap drink",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "customers.miners.patronage",
        "amount": 10,
        "readable": "Miners drift back",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -12,
        "readable": "Margin erodes",
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
        "target": "pressure:rival_tavern_pressure",
        "amount": -8,
        "readable": "Rival pressure eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      }
    ],
    "memories": [
      {
        "id": "rival_priced_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "compete",
          "price"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 38
  }
}
```

#### Slot: host_counter_event

```json
{
  "responseSlot": {
    "id": "host_counter_event",
    "labelHint": "Host counter-event",
    "allowedVerbs": [
      "invite"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "system",
        "id": "rival_tavern"
      }
    ],
    "expectedEffects": [
      "raise patronage",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "host_counter_event_profile",
    "responseSlotId": "host_counter_event",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": 12,
        "readable": "Merchants drawn in",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "customers.adventurers.patronage",
        "amount": 10,
        "readable": "Adventurers come for the show",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Event cost",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -12,
        "readable": "Rival upstaged",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.cozy",
        "amount": 8,
        "readable": "Tavern feels lively",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cozy",
        "meterLabel": "cozy"
      }
    ],
    "memories": [
      {
        "id": "rival_counter_event_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "event",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 58
  }
}
```

#### Slot: improve_quality

```json
{
  "responseSlot": {
    "id": "improve_quality",
    "labelHint": "Improve quality",
    "allowedVerbs": [
      "upgrade"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "stock",
        "id": "ale"
      }
    ],
    "expectedEffects": [
      "raise reputation",
      "time cost"
    ]
  },
  "consequenceProfile": {
    "id": "improve_quality_profile",
    "responseSlotId": "improve_quality",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "reputation.tasty",
        "amount": 12,
        "readable": "Quality improves reputation",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "tasty",
        "meterLabel": "tasty"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 8,
        "readable": "Standards rise",
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
        "target": "coin",
        "amount": -15,
        "readable": "Investment cost",
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
        "target": "pressure:rival_tavern_pressure",
        "amount": -10,
        "readable": "Rival pressure recedes",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      }
    ],
    "memories": [
      {
        "id": "rival_quality_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "quality",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 44
  }
}
```

#### Slot: spread_counter_rumour

```json
{
  "responseSlot": {
    "id": "spread_counter_rumour",
    "labelHint": "Spread counter-rumour",
    "allowedVerbs": [
      "rebrand"
    ],
    "shape": "deception",
    "targetOptions": [
      {
        "kind": "system",
        "id": "rival_tavern"
      }
    ],
    "expectedEffects": [
      "hurt rival",
      "risk discovery"
    ]
  },
  "consequenceProfile": {
    "id": "spread_counter_rumour_profile",
    "responseSlotId": "spread_counter_rumour",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -10,
        "readable": "Rumour weakens rival",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 10,
        "readable": "Town gossip stirs",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "rival_rumour_exposed_rival_tavern",
        "amount": 0,
        "readable": "Counter-rumour may be exposed",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "neutral",
        "meterId": "rival_rumour_exposed_rival_tavern"
      },
      {
        "kind": "state_change",
        "target": "reputation.dangerous",
        "amount": 6,
        "readable": "Reputation darkens",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "dangerous",
        "meterLabel": "dangerous"
      }
    ],
    "memories": [
      {
        "id": "rival_counter_rumour_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "deception",
          "rumour"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rival_rumour_exposed_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "risk"
        ]
      }
    ],
    "impactScore": 28
  }
}
```

#### Slot: negotiate_with_rival

```json
{
  "responseSlot": {
    "id": "negotiate_with_rival",
    "labelHint": "Negotiate with the rival",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "system",
        "id": "rival_tavern"
      }
    ],
    "expectedEffects": [
      "share market",
      "lose autonomy"
    ]
  },
  "consequenceProfile": {
    "id": "negotiate_with_rival_profile",
    "responseSlotId": "negotiate_with_rival",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -12,
        "readable": "Truce eases rival pressure",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 4,
        "readable": "Civility noted",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "tiny",
        "meterId": "respectable",
        "meterLabel": "respectable"
      }
    ],
    "delayedEffects": [
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": -6,
        "readable": "Shared market splits",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "patronage",
        "meterLabel": "patronage"
      }
    ],
    "memories": [
      {
        "id": "rival_negotiated_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "compromise"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 21
  }
}
```

#### Slot: ignore_rival

```json
{
  "responseSlot": {
    "id": "ignore_rival",
    "labelHint": "Ignore the rival",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "rival grows"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_rival_profile",
    "responseSlotId": "ignore_rival",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": 12,
        "readable": "Rival grows unchecked",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      },
      {
        "kind": "state_change",
        "target": "customers.merchants.patronage",
        "amount": -8,
        "readable": "Merchants drift away",
        "tags": [
          "customer"
        ],
        "targetKind": "customer",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "patronage",
        "meterLabel": "patronage"
      },
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 6,
        "readable": "Regulars hear of the other place",
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
        "id": "rival_ignored_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
          "ignored"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rival_dominance_rival_tavern",
        "actors": [
          {
            "kind": "system",
            "id": "rival_tavern"
          }
        ],
        "tags": [
          "rival",
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
    "slotId": "compete_on_price",
    "label": "Match the rival on price",
    "verb": "lower_price",
    "targetId": "ale",
    "shape": "risky_profitable",
    "previewEffects": [
      "patronage would deepen a clear lift among the patrons (Local Goblins)",
      "patronage would deepen a clear lift among the patrons (Miners)",
      "the till would lighten by a step"
    ],
    "mechanicalEffects": [
      "Local Goblins Patronage +8",
      "Miners Patronage +10",
      "Coin -12"
    ]
  },
  {
    "slotId": "host_counter_event",
    "label": "Throw a counter-event",
    "verb": "invite",
    "targetId": "rival_tavern",
    "shape": "long_term_investment",
    "previewEffects": [
      "patronage would climb a real step among the regulars (Merchants)",
      "patronage would climb a real step among the regulars (Adventurers)",
      "a marked fall of silver would empty the till"
    ],
    "mechanicalEffects": [
      "Merchants Patronage +12",
      "Adventurers Patronage +10",
      "Coin -20"
    ]
  },
  {
    "slotId": "improve_quality",
    "label": "Invest in the kitchen",
    "verb": "upgrade",
    "targetId": "ale",
    "shape": "long_term_investment",
    "previewEffects": [
      "the tasty name would spread a marked rise in word",
      "respectable standing would gain a step in talk",
      "a notch of silver would slip from the purse"
    ],
    "mechanicalEffects": [
      "Reputation Tasty +12",
      "Reputation Respectable +8",
      "Coin -15"
    ]
  },
  {
    "slotId": "spread_counter_rumour",
    "label": "Plant a counter-rumour",
    "verb": "rebrand",
    "targetId": "rival_tavern",
    "shape": "deception",
    "previewEffects": [
      "the rival's pressure would fall a real slip back",
      "rumour pressure would mount a clear lift overnight",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure -10",
      "Rumour Pressure +10",
      "later: Counter-rumour may be exposed"
    ]
  },
  {
    "slotId": "negotiate_with_rival",
    "label": "Settle a truce with them",
    "verb": "negotiate",
    "targetId": "rival_tavern",
    "shape": "compromise",
    "previewEffects": [
      "a marked fall would settle the meter for now",
      "a hair of repute would settle on the name"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure -12",
      "Reputation Respectable +4"
    ]
  },
  {
    "slotId": "ignore_rival",
    "label": "Let them have the night",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "the rival's pressure would mount a clear lift overnight",
      "patronage would fall a clear drop among the patrons (Merchants)",
      "the meter would mount a notch with every hour"
    ],
    "mechanicalEffects": [
      "Rival Tavern Pressure +12",
      "Merchants Patronage -8",
      "Regular Customer Loss +6"
    ]
  }
]
```

## monthly_review

- **Scenario:** monthly_review
- **Card id:** monthly_review.monthly_review
- **Seed:** `seed-monthly_review-Y1-M1-d28`
- **Family/type/timing:** monthly_review / monthly_review / end_month
- **Severity/urgency/novelty/cardWorthiness:** 40 / 30 / 100 / 60
- **Domain:** monthly, economy, reputation

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "c-27-160",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 4,
        "day": 28,
        "absoluteDay": 27
      },
      "source": "monthly.rent",
      "sourceType": "monthly",
      "target": "coin",
      "targetType": "coin",
      "amount": -120,
      "direction": "decrease",
      "weight": 120,
      "readable": "monthly.rent",
      "tags": [
        "coin",
        "rent",
        "monthly"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-27-162",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 4,
        "day": 28,
        "absoluteDay": 27
      },
      "source": "monthly.reputation",
      "sourceType": "monthly",
      "target": "reputation.cheap",
      "targetType": "reputation",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "monthly_reputation_shift",
      "tags": [
        "reputation",
        "cheap"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-27-163",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 4,
        "day": 28,
        "absoluteDay": 27
      },
      "source": "monthly.reputation",
      "sourceType": "monthly",
      "target": "reputation.tasty",
      "targetType": "reputation",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "monthly_reputation_shift",
      "tags": [
        "reputation",
        "tasty"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-27-164",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 4,
        "day": 28,
        "absoluteDay": 27
      },
      "source": "monthly.reputation",
      "sourceType": "monthly",
      "target": "reputation.filthy",
      "targetType": "reputation",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "monthly_reputation_shift",
      "tags": [
        "reputation",
        "filthy"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "c-27-165",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 4,
        "day": 28,
        "absoluteDay": 27
      },
      "source": "monthly.reputation",
      "sourceType": "monthly",
      "target": "reputation.dangerous",
      "targetType": "reputation",
      "amount": 12,
      "direction": "increase",
      "weight": 12,
      "readable": "monthly_reputation_shift",
      "tags": [
        "reputation",
        "dangerous"
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
      "id": "rent_stake",
      "target": "pressure:landlord",
      "readable": "Rent may slip",
      "direction": "risk",
      "tags": [
        "rent",
        "landlord"
      ]
    },
    {
      "id": "coin_stake",
      "target": "coin",
      "readable": "Coin reserves at stake",
      "direction": "loss",
      "tags": [
        "coin"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "monthly_review_Y1-M1",
      "actors": [
        {
          "kind": "other",
          "id": "month:Y1-M1"
        }
      ],
      "tags": [
        "monthly",
        "review"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "month Y1-M1",
    "problemNoun": "month review",
    "sensoryDetails": [
      "ledger closed",
      "lamps trimmed"
    ],
    "actorOpinions": {},
    "recentContext": [
      "net coin change 3479"
    ],
    "stakesReadable": [
      "rent may slip",
      "coin reserves at stake"
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

#### Slot: pay_landlord_on_time

```json
{
  "responseSlot": {
    "id": "pay_landlord_on_time",
    "labelHint": "Pay the landlord on time",
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
      "lower landlord pressure",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "pay_landlord_on_time_profile",
    "responseSlotId": "pay_landlord_on_time",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 0,
        "readable": "Rent already paid this month",
        "tags": [
          "coin",
          "rent"
        ],
        "targetKind": "coin",
        "direction": "neutral",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:landlord",
        "amount": -25,
        "readable": "Landlord eased",
        "tags": [
          "pressure",
          "landlord"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "landlord",
        "meterLabel": "Landlord"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:debt",
        "amount": 6,
        "readable": "Reserves thinner after rent",
        "tags": [
          "pressure",
          "debt",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "debt",
        "meterLabel": "Debt"
      },
      {
        "kind": "future_hook",
        "target": "landlord_goodwill_window",
        "amount": 30,
        "readable": "Landlord may offer a window of goodwill",
        "tags": [
          "future_hook",
          "landlord"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "large",
        "meterId": "landlord_goodwill_window"
      }
    ],
    "memories": [
      {
        "id": "rent_paid_Y1-M1",
        "actors": [
          {
            "kind": "system",
            "id": "landlord"
          }
        ],
        "tags": [
          "rent",
          "paid",
          "monthly"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "landlord_goodwill_window",
        "actors": [
          {
            "kind": "system",
            "id": "landlord"
          }
        ],
        "tags": [
          "landlord",
          "opportunity"
        ]
      }
    ],
    "impactScore": 42
  }
}
```

#### Slot: invest_in_cellar

```json
{
  "responseSlot": {
    "id": "invest_in_cellar",
    "labelHint": "Invest in the cellar",
    "allowedVerbs": [
      "upgrade"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "area",
        "id": "cellar"
      }
    ],
    "expectedEffects": [
      "improve cellar",
      "risk rent slip"
    ]
  },
  "consequenceProfile": {
    "id": "invest_in_cellar_profile",
    "responseSlotId": "invest_in_cellar",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Cellar investment",
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
        "target": "areas.cellar.condition",
        "amount": 12,
        "readable": "Cellar improves",
        "tags": [
          "area",
          "cellar"
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
        "kind": "pressure",
        "target": "pressure:landlord",
        "amount": 12,
        "readable": "Rent slip — landlord notices",
        "tags": [
          "pressure",
          "landlord",
          "delay:3"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "landlord",
        "meterLabel": "Landlord"
      },
      {
        "kind": "future_hook",
        "target": "cellar_capacity_unlocked_Y1-M1",
        "amount": 14,
        "readable": "Cellar capacity may unlock next month",
        "tags": [
          "future_hook",
          "cellar"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "cellar_capacity_unlocked_Y1-M1"
      }
    ],
    "memories": [
      {
        "id": "cellar_invested_Y1-M1",
        "actors": [
          {
            "kind": "area",
            "id": "cellar"
          }
        ],
        "tags": [
          "cellar",
          "investment",
          "monthly"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "cellar_capacity_unlocked_Y1-M1",
        "actors": [
          {
            "kind": "area",
            "id": "cellar"
          }
        ],
        "tags": [
          "cellar",
          "opportunity"
        ]
      }
    ],
    "impactScore": 52
  }
}
```

#### Slot: hold_reserves

```json
{
  "responseSlot": {
    "id": "hold_reserves",
    "labelHint": "Hold reserves through next month",
    "allowedVerbs": [
      "delay"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "system",
        "id": "reserves"
      }
    ],
    "expectedEffects": [
      "lower debt",
      "staff feel the squeeze"
    ]
  },
  "consequenceProfile": {
    "id": "hold_reserves_profile",
    "responseSlotId": "hold_reserves",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:debt",
        "amount": -4,
        "readable": "Reserves held",
        "tags": [
          "pressure",
          "debt"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "tiny",
        "meterId": "debt",
        "meterLabel": "Debt"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:staff_loyalty_risk",
        "amount": 6,
        "readable": "Staff sense the penny-pinching",
        "tags": [
          "pressure",
          "staff",
          "delay:7"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "staff_loyalty_risk",
        "meterLabel": "Staff Loyalty Risk"
      },
      {
        "kind": "future_hook",
        "target": "reserves_intact_Y1-M1",
        "amount": 28,
        "readable": "Reserves intact through next month",
        "tags": [
          "future_hook",
          "reserves"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "reserves_intact_Y1-M1"
      }
    ],
    "memories": [
      {
        "id": "reserves_held_Y1-M1",
        "tags": [
          "reserves",
          "monthly"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "reserves_intact_Y1-M1",
        "tags": [
          "reserves",
          "opportunity"
        ]
      }
    ],
    "impactScore": 25
  }
}
```

#### Slot: settle_with_rival

```json
{
  "responseSlot": {
    "id": "settle_with_rival",
    "labelHint": "Settle with the rival tavern",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "rival_taverns"
      }
    ],
    "expectedEffects": [
      "lower rival pressure",
      "fuel gossip"
    ]
  },
  "consequenceProfile": {
    "id": "settle_with_rival_profile",
    "responseSlotId": "settle_with_rival",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -15,
        "readable": "Settlement payment",
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
        "target": "faction:rival_taverns",
        "amount": 12,
        "readable": "Rival eases up",
        "tags": [
          "faction",
          "rival",
          "settle"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rival_taverns"
      },
      {
        "kind": "pressure",
        "target": "pressure:rival_tavern_pressure",
        "amount": -12,
        "readable": "Rival pressure cools",
        "tags": [
          "pressure",
          "rival"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "rival_tavern_pressure",
        "meterLabel": "Rival Tavern Pressure"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 6,
        "readable": "Visible accommodation feeds gossip",
        "tags": [
          "pressure",
          "rumour",
          "delay:5"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "rumour_pressure",
        "meterLabel": "Rumour Pressure"
      },
      {
        "kind": "future_hook",
        "target": "rival_settlement_pact_Y1-M1",
        "amount": 21,
        "readable": "Rival pact may reopen later",
        "tags": [
          "future_hook",
          "rival"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "rival_settlement_pact_Y1-M1"
      }
    ],
    "memories": [
      {
        "id": "rival_settled_Y1-M1",
        "actors": [
          {
            "kind": "faction",
            "id": "rival_taverns"
          }
        ],
        "tags": [
          "rival",
          "settle",
          "monthly"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "rival_settlement_pact_Y1-M1",
        "actors": [
          {
            "kind": "faction",
            "id": "rival_taverns"
          }
        ],
        "tags": [
          "rival",
          "opportunity"
        ]
      }
    ],
    "impactScore": 51
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "pay_landlord_on_time",
    "label": "Pay the landlord on the line",
    "verb": "pay",
    "targetId": "landlord",
    "shape": "safe_costly",
    "previewEffects": [
      "Coin would leave the till for the landlord",
      "the landlord's pressure would fall away, a sharp drop",
      "later: A thread would loop back round in time"
    ],
    "mechanicalEffects": [
      "Coin 0",
      "Landlord -25",
      "later: Landlord may offer a window of goodwill"
    ]
  },
  {
    "slotId": "invest_in_cellar",
    "label": "Invest in the cellar",
    "verb": "upgrade",
    "targetId": "cellar",
    "shape": "long_term_investment",
    "previewEffects": [
      "a real slip of coin would leave the purse",
      "a measure of new timber would brace the room",
      "later: The cellar would gain ground on the books"
    ],
    "mechanicalEffects": [
      "Coin -20",
      "Cellar Condition +12",
      "later: Cellar capacity may unlock next month"
    ]
  },
  {
    "slotId": "hold_reserves",
    "label": "Hold the reserves another month",
    "verb": "delay",
    "targetId": "reserves",
    "shape": "compromise",
    "previewEffects": [
      "a hair of pressure would lift off the meter",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Debt -4",
      "later: Reserves intact through next month"
    ]
  },
  {
    "slotId": "settle_with_rival",
    "label": "Settle quietly with the rival",
    "verb": "negotiate",
    "targetId": "rival_taverns",
    "shape": "compromise",
    "previewEffects": [
      "the till would lighten by a step",
      "the order would warm a marked rise on terms (Rival Taverns)",
      "the rival's pressure would fall a real slip back",
      "later: A consequence would surface next month"
    ],
    "mechanicalEffects": [
      "Coin -15",
      "Rival Taverns +12",
      "Rival Tavern Pressure -12",
      "later: Rival pact may reopen later"
    ]
  }
]
```

## seasonal_arc

- **Scenario:** seasonal_arc
- **Card id:** seasonal_arc.arc_milestone
- **Seed:** `seed-seasonal_arc-mushroom_festival_arc-d1`
- **Family/type/timing:** seasonal_arc / festival_preparation / morning_prep
- **Severity/urgency/novelty/cardWorthiness:** 70 / 41 / 100 / 80
- **Domain:** arcs, calendar

### Authored simulation data

```json
{
  "causes": [
    {
      "id": "c-0-141",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.arc_escalation",
      "sourceType": "pressure",
      "target": "pressure:arc_escalation",
      "targetType": "pressure",
      "amount": -19,
      "direction": "decrease",
      "weight": 19,
      "readable": "Active arc intensity 70.",
      "tags": [
        "pressure",
        "arc_escalation",
        "arc",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "memories",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-142",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.arc_escalation",
      "sourceType": "pressure",
      "target": "pressure:arc_escalation",
      "targetType": "pressure",
      "amount": -19,
      "direction": "decrease",
      "weight": 19,
      "readable": "Active arc intensity 70.",
      "tags": [
        "pressure",
        "arc_escalation",
        "arc",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "memories",
        "pressures"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "c-0-135",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 1,
        "absoluteDay": 0
      },
      "source": "pressures.festival_readiness",
      "sourceType": "pressure",
      "target": "pressure:festival_readiness",
      "targetType": "pressure",
      "amount": 7,
      "direction": "increase",
      "weight": 7,
      "readable": "1 festival arc(s) active (intensity 70).",
      "tags": [
        "pressure",
        "festival_readiness",
        "festival",
        "arc",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        },
        {
          "kind": "area",
          "id": "kitchen"
        },
        {
          "kind": "area",
          "id": "cellar"
        },
        {
          "kind": "area",
          "id": "privy"
        }
      ],
      "relatedSystems": [
        "stock",
        "staff",
        "areas",
        "suppliers",
        "localArcs"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
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
      "source": "pressures.festival_readiness",
      "sourceType": "pressure",
      "target": "pressure:festival_readiness",
      "targetType": "pressure",
      "amount": 7,
      "direction": "increase",
      "weight": 7,
      "readable": "1 festival arc(s) active (intensity 70).",
      "tags": [
        "pressure",
        "festival_readiness",
        "festival",
        "arc",
        "expanded"
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        },
        {
          "kind": "area",
          "id": "kitchen"
        },
        {
          "kind": "area",
          "id": "cellar"
        },
        {
          "kind": "area",
          "id": "privy"
        }
      ],
      "relatedSystems": [
        "stock",
        "staff",
        "areas",
        "suppliers",
        "localArcs"
      ],
      "ageDays": 1,
      "expiresAfterDays": 7
    },
    {
      "id": "pressure-arc_escalation-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.arc_escalation",
      "sourceType": "pressure",
      "target": "pressure:arc_escalation",
      "targetType": "pressure",
      "amount": 35,
      "direction": "increase",
      "weight": 35,
      "readable": "Active arc intensity 70.",
      "tags": [
        "arc",
        "active"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-arc_escalation-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.arc_escalation",
      "sourceType": "pressure",
      "target": "pressure:arc_escalation",
      "targetType": "pressure",
      "amount": 6,
      "direction": "increase",
      "weight": 6,
      "readable": "Festival Readiness (62) feeds arc escalation.",
      "tags": [
        "arc",
        "web"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-festival_readiness-0-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.festival_readiness",
      "sourceType": "pressure",
      "target": "pressure:festival_readiness",
      "targetType": "pressure",
      "amount": 42,
      "direction": "increase",
      "weight": 42,
      "readable": "1 festival arc(s) active (intensity 70).",
      "tags": [
        "festival",
        "arc"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    },
    {
      "id": "pressure-festival_readiness-1-1",
      "timestamp": {
        "year": 1,
        "month": 1,
        "week": 1,
        "day": 2,
        "absoluteDay": 1
      },
      "source": "pressures.festival_readiness",
      "sourceType": "pressure",
      "target": "pressure:festival_readiness",
      "targetType": "pressure",
      "amount": 20,
      "direction": "increase",
      "weight": 20,
      "readable": "4 area(s) dirty or damaged.",
      "tags": [
        "areas",
        "festival"
      ],
      "relatedActors": [],
      "relatedLocations": [],
      "relatedSystems": [],
      "ageDays": 0
    }
  ],
  "pressures": [
    {
      "id": "arc_escalation",
      "label": "Arc Escalation",
      "value": 41,
      "previousValue": 60,
      "delta": -19,
      "trend": "stable",
      "severity": 41,
      "urgency": 41,
      "volatility": 100,
      "causes": [
        {
          "id": "active_arcs",
          "readable": "Active arc intensity 70.",
          "amount": 35,
          "weight": 35,
          "direction": "increase",
          "tags": [
            "arc",
            "active"
          ],
          "relatedActors": [
            {
              "kind": "local_event",
              "id": "mushroom_festival_arc"
            }
          ],
          "relatedSystems": [
            "localArcs"
          ]
        },
        {
          "id": "bleed_festival_readiness",
          "readable": "Festival Readiness (62) feeds arc escalation.",
          "amount": 6,
          "weight": 6,
          "direction": "increase",
          "tags": [
            "arc",
            "web"
          ],
          "relatedSystems": [
            "pressures",
            "localArcs"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [],
      "relatedSystems": [
        "localArcs",
        "memories",
        "pressures"
      ],
      "tags": [
        "arc",
        "expanded"
      ],
      "consequences": [
        "Arc-specific issue seeds become more likely.",
        "Seasonal crises may escalate.",
        "Local event consequences may follow.",
        "Rival/supplier/faction pressures may jump."
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
      "id": "festival_readiness",
      "label": "Festival Readiness",
      "value": 62,
      "previousValue": 55,
      "delta": 7,
      "trend": "stable",
      "severity": 62,
      "urgency": 67,
      "volatility": 56,
      "causes": [
        {
          "id": "festival_arc_active",
          "readable": "1 festival arc(s) active (intensity 70).",
          "amount": 42,
          "weight": 42,
          "direction": "increase",
          "tags": [
            "festival",
            "arc"
          ],
          "relatedActors": [
            {
              "kind": "local_event",
              "id": "mushroom_festival_arc"
            }
          ],
          "relatedSystems": [
            "localArcs"
          ]
        },
        {
          "id": "dirty_areas",
          "readable": "4 area(s) dirty or damaged.",
          "amount": 20,
          "weight": 20,
          "direction": "increase",
          "tags": [
            "areas",
            "festival"
          ],
          "relatedSystems": [
            "areas"
          ]
        }
      ],
      "relatedActors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "relatedLocations": [
        {
          "kind": "area",
          "id": "main_room"
        },
        {
          "kind": "area",
          "id": "kitchen"
        },
        {
          "kind": "area",
          "id": "cellar"
        },
        {
          "kind": "area",
          "id": "privy"
        }
      ],
      "relatedSystems": [
        "stock",
        "staff",
        "areas",
        "suppliers",
        "localArcs"
      ],
      "tags": [
        "festival",
        "arc",
        "expanded"
      ],
      "consequences": [
        "Festival preparation issue seeds become more likely.",
        "A failed festival creates lasting memories.",
        "A successful festival creates lasting memories."
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
      "id": "arc_stake",
      "target": "arc:mushroom_festival_arc",
      "readable": "Arc may fail",
      "direction": "loss",
      "tags": [
        "arc"
      ]
    },
    {
      "id": "readiness_stake",
      "target": "pressure:festival_readiness",
      "readable": "Readiness may drop",
      "direction": "risk",
      "tags": [
        "arc"
      ]
    }
  ],
  "memoriesCreated": [
    {
      "id": "arc_seed_mushroom_festival_arc",
      "actors": [
        {
          "kind": "local_event",
          "id": "mushroom_festival_arc"
        }
      ],
      "tags": [
        "arc",
        "warning",
        "active"
      ]
    }
  ],
  "futureHooks": [],
  "textIngredients": {
    "subject": "Mushroom Festival",
    "problemNoun": "arc milestone",
    "sensoryDetails": [
      "flags rising",
      "crowds gathering"
    ],
    "actorOpinions": {
      "regulars": "whisper about it"
    },
    "recentContext": [
      "intensity 70"
    ],
    "stakesReadable": [
      "arc may fail",
      "readiness may drop"
    ],
    "namedEntities": [
      {
        "role": "arc",
        "ref": {
          "kind": "faction",
          "id": "local_shrine"
        },
        "displayName": "Local Shrine"
      }
    ],
    "pressureContext": [
      "arc escalation 41"
    ],
    "calendarContext": [
      "tags: quiet_day, season_mudwake, road_danger_risk"
    ],
    "arcContext": [
      "stage active",
      "escalation 41"
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

#### Slot: prepare_for_arc

```json
{
  "responseSlot": {
    "id": "prepare_for_arc",
    "labelHint": "Prepare for the festival",
    "allowedVerbs": [
      "upgrade",
      "buy"
    ],
    "shape": "long_term_investment",
    "targetOptions": [
      {
        "kind": "local_event",
        "id": "mushroom_festival_arc"
      }
    ],
    "expectedEffects": [
      "raise readiness",
      "spend coin"
    ]
  },
  "consequenceProfile": {
    "id": "prepare_for_arc_profile",
    "responseSlotId": "prepare_for_arc",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:festival_readiness",
        "amount": -15,
        "readable": "Readiness climbs",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "festival_readiness",
        "meterLabel": "Festival Readiness"
      },
      {
        "kind": "state_change",
        "target": "coin",
        "amount": -20,
        "readable": "Preparation cost",
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
        "target": "pressure:arc_escalation",
        "amount": -8,
        "readable": "Arc pressure eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "arc_escalation",
        "meterLabel": "Arc Escalation"
      },
      {
        "kind": "state_change",
        "target": "reputation.reliable",
        "amount": 8,
        "readable": "Tavern prepared for the moment",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "reliable",
        "meterLabel": "reliable"
      },
      {
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": 8,
        "readable": "Shrine notices the prep",
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
    "delayedEffects": [],
    "memories": [
      {
        "id": "arc_prepared_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "preparation",
          "investment",
          "attribution"
        ]
      },
      {
        "id": "tavern_festival_prep_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "tavern_identity",
            "id": "self"
          }
        ],
        "tags": [
          "tavern_identity",
          "memory",
          "investment"
        ]
      }
    ],
    "futureHooks": [],
    "impactScore": 58
  }
}
```

#### Slot: host_festival_event

```json
{
  "responseSlot": {
    "id": "host_festival_event",
    "labelHint": "Host a festival event",
    "allowedVerbs": [
      "invite",
      "rebrand"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "local_shrine"
      }
    ],
    "expectedEffects": [
      "big payday",
      "big obligation"
    ]
  },
  "consequenceProfile": {
    "id": "host_festival_event_profile",
    "responseSlotId": "host_festival_event",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 30,
        "readable": "Festival night earnings",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "pressure",
        "target": "pressure:festival_readiness",
        "amount": -20,
        "readable": "Festival becomes ours",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "large",
        "meterId": "festival_readiness",
        "meterLabel": "Festival Readiness"
      },
      {
        "kind": "state_change",
        "target": "reputation.respectable",
        "amount": 8,
        "readable": "Hospitable reputation grows",
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
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": 12,
        "readable": "Shrine elevated as patron",
        "tags": [
          "faction",
          "hosted_event",
          "honoured_discount",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "local_shrine"
      },
      {
        "kind": "state_change",
        "target": "staff.cook.fatigue",
        "amount": 8,
        "readable": "Long night for the crew",
        "tags": [
          "staff"
        ],
        "targetKind": "staff",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "fatigue",
        "meterLabel": "fatigue"
      }
    ],
    "delayedEffects": [
      {
        "kind": "future_hook",
        "target": "festival_obligations_mushroom_festival_arc",
        "amount": 12,
        "readable": "Festival sets a yearly expectation",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "festival_obligations_mushroom_festival_arc"
      }
    ],
    "memories": [
      {
        "id": "arc_festival_hosted_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "faction",
          "hosted_event",
          "attribution"
        ]
      },
      {
        "id": "tavern_hosted_festival_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
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
      },
      {
        "id": "arc_festival_culture_goblin_local",
        "actors": [
          {
            "kind": "culture",
            "id": "goblin_local"
          }
        ],
        "tags": [
          "culture",
          "memory"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "festival_obligations_mushroom_festival_arc",
        "actors": [
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "faction"
        ]
      }
    ],
    "impactScore": 88
  }
}
```

#### Slot: exploit_arc

```json
{
  "responseSlot": {
    "id": "exploit_arc",
    "labelHint": "Exploit the moment",
    "allowedVerbs": [
      "raise_price",
      "rebrand"
    ],
    "shape": "risky_profitable",
    "targetOptions": [
      {
        "kind": "local_event",
        "id": "mushroom_festival_arc"
      }
    ],
    "expectedEffects": [
      "raise margin",
      "shrine disapproves"
    ]
  },
  "consequenceProfile": {
    "id": "exploit_arc_profile",
    "responseSlotId": "exploit_arc",
    "immediateEffects": [
      {
        "kind": "state_change",
        "target": "coin",
        "amount": 20,
        "readable": "Premium prices",
        "tags": [
          "coin"
        ],
        "targetKind": "coin",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "coin",
        "meterLabel": "coin"
      },
      {
        "kind": "state_change",
        "target": "reputation.cheap",
        "amount": -10,
        "readable": "No longer feels affordable",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "cheap",
        "meterLabel": "cheap"
      },
      {
        "kind": "pressure",
        "target": "pressure:rumour_pressure",
        "amount": 6,
        "readable": "Shrine gossip travels",
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
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": -8,
        "readable": "Shrine disapproves",
        "tags": [
          "faction",
          "grudge",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "local_shrine"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:regular_customer_loss",
        "amount": 10,
        "readable": "Regulars feel gouged",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "regular_customer_loss",
        "meterLabel": "Regular Customer Loss"
      },
      {
        "kind": "future_hook",
        "target": "arc_exploit_backlash_mushroom_festival_arc",
        "amount": 12,
        "readable": "Reputation backlash possible",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "arc_exploit_backlash_mushroom_festival_arc"
      }
    ],
    "memories": [
      {
        "id": "arc_exploited_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "exploit",
          "risky",
          "grudge",
          "attribution"
        ]
      },
      {
        "id": "tavern_exploited_festival_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
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
        "id": "arc_exploit_backlash_mushroom_festival_arc",
        "actors": [
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "risk"
        ]
      }
    ],
    "impactScore": 61
  }
}
```

#### Slot: ask_supplier_help

```json
{
  "responseSlot": {
    "id": "ask_supplier_help",
    "labelHint": "Ask a supplier for help",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "compromise",
    "targetOptions": [
      {
        "kind": "supplier",
        "id": "old_keg_brewers"
      }
    ],
    "expectedEffects": [
      "secure stock",
      "owe favour"
    ]
  },
  "consequenceProfile": {
    "id": "ask_supplier_help_profile",
    "responseSlotId": "ask_supplier_help",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:festival_readiness",
        "amount": -12,
        "readable": "Stock secured for arc",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "festival_readiness",
        "meterLabel": "Festival Readiness"
      },
      {
        "kind": "pressure",
        "target": "pressure:stock_shortage",
        "amount": -8,
        "readable": "Stock pressure eases",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "stock_shortage",
        "meterLabel": "Stock Shortage"
      },
      {
        "kind": "cause",
        "target": "supplier:old_keg_brewers",
        "amount": 10,
        "readable": "Supplier earns the festival order",
        "tags": [
          "supplier",
          "fair_deal",
          "paid_on_time",
          "attribution"
        ],
        "targetKind": "supplier",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "old_keg_brewers"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:supplier_distrust",
        "amount": 5,
        "readable": "Owed favour shifts balance",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "supplier_distrust",
        "meterLabel": "Supplier Distrust"
      },
      {
        "kind": "future_hook",
        "target": "arc_supplier_favour_owed_mushroom_festival_arc",
        "amount": 10,
        "readable": "Favour will be called in",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "arc_supplier_favour_owed_mushroom_festival_arc"
      }
    ],
    "memories": [
      {
        "id": "arc_supplier_helped_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "supplier",
            "id": "old_keg_brewers"
          }
        ],
        "tags": [
          "arc",
          "supplier",
          "fair_deal",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "arc_supplier_favour_owed_mushroom_festival_arc",
        "actors": [
          {
            "kind": "supplier",
            "id": "old_keg_brewers"
          }
        ],
        "tags": [
          "arc",
          "supplier",
          "debt"
        ]
      }
    ],
    "impactScore": 37
  }
}
```

#### Slot: ask_faction_help

```json
{
  "responseSlot": {
    "id": "ask_faction_help",
    "labelHint": "Ask a faction for help",
    "allowedVerbs": [
      "negotiate"
    ],
    "shape": "relationship_sacrifice",
    "targetOptions": [
      {
        "kind": "faction",
        "id": "local_shrine"
      }
    ],
    "expectedEffects": [
      "secure help",
      "owe debt"
    ]
  },
  "consequenceProfile": {
    "id": "ask_faction_help_profile",
    "responseSlotId": "ask_faction_help",
    "immediateEffects": [
      {
        "kind": "pressure",
        "target": "pressure:festival_readiness",
        "amount": -15,
        "readable": "Faction backing secures arc",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "festival_readiness",
        "meterLabel": "Festival Readiness"
      },
      {
        "kind": "pressure",
        "target": "pressure:arc_escalation",
        "amount": -6,
        "readable": "Arc steadies",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "arc_escalation",
        "meterLabel": "Arc Escalation"
      },
      {
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": 10,
        "readable": "Faction lends face",
        "tags": [
          "faction",
          "hosted_event",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "local_shrine"
      }
    ],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:faction_anger",
        "amount": 8,
        "readable": "Debt to faction simmers",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "faction_anger",
        "meterLabel": "Faction Anger"
      },
      {
        "kind": "future_hook",
        "target": "arc_faction_debt_mushroom_festival_arc",
        "amount": 12,
        "readable": "Faction will demand repayment",
        "tags": [
          "future_hook"
        ],
        "targetKind": "other",
        "direction": "positive",
        "magnitudeBand": "small",
        "meterId": "arc_faction_debt_mushroom_festival_arc"
      }
    ],
    "memories": [
      {
        "id": "arc_faction_helped_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "faction",
          "hosted_event",
          "debt",
          "attribution"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "arc_faction_debt_mushroom_festival_arc",
        "actors": [
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "faction",
          "debt"
        ]
      }
    ],
    "impactScore": 40
  }
}
```

#### Slot: ignore_warning

```json
{
  "responseSlot": {
    "id": "ignore_warning",
    "labelHint": "Ignore the festival",
    "allowedVerbs": [
      "ignore"
    ],
    "shape": "ignore",
    "targetOptions": [],
    "expectedEffects": [
      "no cost",
      "festival passes us by"
    ]
  },
  "consequenceProfile": {
    "id": "ignore_warning_profile",
    "responseSlotId": "ignore_warning",
    "immediateEffects": [],
    "delayedEffects": [
      {
        "kind": "pressure",
        "target": "pressure:festival_readiness",
        "amount": 15,
        "readable": "Readiness collapses",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "festival_readiness",
        "meterLabel": "Festival Readiness"
      },
      {
        "kind": "pressure",
        "target": "pressure:arc_escalation",
        "amount": 12,
        "readable": "Arc spirals",
        "tags": [
          "pressure"
        ],
        "targetKind": "pressure",
        "direction": "positive",
        "magnitudeBand": "medium",
        "meterId": "arc_escalation",
        "meterLabel": "Arc Escalation"
      },
      {
        "kind": "state_change",
        "target": "reputation.reliable",
        "amount": -10,
        "readable": "Reputation suffers",
        "tags": [
          "reputation"
        ],
        "targetKind": "reputation",
        "direction": "negative",
        "magnitudeBand": "medium",
        "meterId": "reliable",
        "meterLabel": "reliable"
      },
      {
        "kind": "cause",
        "target": "faction:local_shrine",
        "amount": -8,
        "readable": "Shrine remembers the snub",
        "tags": [
          "faction",
          "grudge",
          "attribution"
        ],
        "targetKind": "faction",
        "direction": "negative",
        "magnitudeBand": "small",
        "meterId": "local_shrine"
      }
    ],
    "memories": [
      {
        "id": "arc_ignored_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          },
          {
            "kind": "faction",
            "id": "local_shrine"
          }
        ],
        "tags": [
          "arc",
          "ignored",
          "grudge"
        ]
      }
    ],
    "futureHooks": [
      {
        "id": "arc_failure_mushroom_festival_arc",
        "actors": [
          {
            "kind": "local_event",
            "id": "mushroom_festival_arc"
          }
        ],
        "tags": [
          "arc",
          "risk",
          "failure"
        ]
      }
    ],
    "impactScore": 34
  }
}
```

### Rendered card choices

These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.

```json
[
  {
    "slotId": "prepare_for_arc",
    "label": "Stock up before the crowd arrives",
    "verb": "upgrade",
    "targetId": "mushroom_festival_arc",
    "shape": "long_term_investment",
    "previewEffects": [
      "the reading would quiet by a real slip",
      "a marked fall of silver would empty the till",
      "the meter would settle a step lower"
    ],
    "mechanicalEffects": [
      "Festival Readiness -15",
      "Coin -20",
      "Arc Escalation -8"
    ]
  },
  {
    "slotId": "host_festival_event",
    "label": "Lean into the moment publicly",
    "verb": "invite",
    "targetId": "local_shrine",
    "shape": "risky_profitable",
    "previewEffects": [
      "a marked rise of coin would settle into the purse",
      "a heavy fall would lift the worst pressure off",
      "respectable standing would gain a step in talk",
      "later: The arc would carry the choice forward"
    ],
    "mechanicalEffects": [
      "Coin +30",
      "Festival Readiness -20",
      "Reputation Respectable +8",
      "later: Festival sets a yearly expectation"
    ]
  },
  {
    "slotId": "exploit_arc",
    "label": "Set prices to match the rush",
    "verb": "raise_price",
    "targetId": "mushroom_festival_arc",
    "shape": "risky_profitable",
    "previewEffects": [
      "a real step of silver would land in the till",
      "the cheap name would sink a clear drop in talk",
      "the rumour pressure would spread a step through the room",
      "later: A thread would loop back round in time"
    ],
    "mechanicalEffects": [
      "Coin +20",
      "Reputation Cheap -10",
      "Rumour Pressure +6",
      "later: Reputation backlash possible"
    ]
  },
  {
    "slotId": "ask_supplier_help",
    "label": "Lean on a supplier for help",
    "verb": "negotiate",
    "targetId": "old_keg_brewers",
    "shape": "compromise",
    "previewEffects": [
      "a marked fall would settle the meter for now",
      "the shortage risk would settle a notch in the cellar",
      "a marked rise would steady the merchant route (Old Keg Brewers)",
      "later: A reminder would sit on the slate for later"
    ],
    "mechanicalEffects": [
      "Festival Readiness -12",
      "Stock Shortage -8",
      "Old Keg Brewers +10",
      "later: Favour will be called in"
    ]
  },
  {
    "slotId": "ask_faction_help",
    "label": "Call in a faction's favour",
    "verb": "negotiate",
    "targetId": "local_shrine",
    "shape": "relationship_sacrifice",
    "previewEffects": [
      "pressure would fall back a clear drop",
      "a notch of pressure would ease off the reading",
      "the house would warm by a real step (Local Shrine)",
      "later: A consequence would surface later in the arc"
    ],
    "mechanicalEffects": [
      "Festival Readiness -15",
      "Arc Escalation -6",
      "Local Shrine +10",
      "later: Faction will demand repayment"
    ]
  },
  {
    "slotId": "ignore_warning",
    "label": "Let the moment pass quietly",
    "verb": "ignore",
    "shape": "ignore",
    "previewEffects": [
      "pressure would mount unchecked by a clear lift",
      "Arc spirals",
      "the reliable name would waver a clear drop in word"
    ],
    "mechanicalEffects": [
      "Festival Readiness +15",
      "Arc Escalation +12",
      "Reputation Reliable -10"
    ]
  }
]
```
