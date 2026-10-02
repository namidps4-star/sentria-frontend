// What GET /plans answers (backend pipeline/entitlements.py catalogue(), plus
// the department groups): the shape the app reads, with the real capability
// list. Suites that open the pricing page serve it so they see what a signed-in
// account sees. A copy, kept by hand: if the backend list changes, change it
// here (only tests read this).
module.exports = {
  PLANS_ANSWER: {
    "order": [
      "decouverte",
      "pro",
      "business",
      "entreprise"
    ],
    "entitlements": {
      "decouverte": {
        "sectors": 1,
        "departments": "one",
        "sites": 1,
        "users": 1,
        "ask_per_month": 20,
        "history_days": 30,
        "sms": false,
        "tracking": false,
        "ml": false
      },
      "pro": {
        "sectors": 1,
        "departments": "one",
        "sites": 1,
        "users": 3,
        "ask_per_month": null,
        "history_days": 365,
        "sms": true,
        "tracking": true,
        "ml": false
      },
      "business": {
        "sectors": 1,
        "departments": "linked",
        "sites": 3,
        "users": 10,
        "ask_per_month": null,
        "history_days": 730,
        "sms": true,
        "tracking": true,
        "ml": true
      },
      "entreprise": {
        "sectors": null,
        "departments": "any",
        "sites": null,
        "users": null,
        "ask_per_month": null,
        "history_days": null,
        "sms": true,
        "tracking": true,
        "ml": true
      }
    },
    "tiers": [
      {
        "key": "detection",
        "label": {
          "fr": "Détecter",
          "en": "Detect"
        },
        "summary": {
          "fr": "Savoir ce qui dépasse un seuil.",
          "en": "Know what crosses a threshold."
        }
      },
      {
        "key": "estimation",
        "label": {
          "fr": "Anticiper et chiffrer",
          "en": "Anticipate and estimate"
        },
        "summary": {
          "fr": "Savoir ce que ça coûte et ce qui arrive.",
          "en": "Know what it costs and what is coming."
        }
      },
      {
        "key": "coordination",
        "label": {
          "fr": "Coordonner",
          "en": "Coordinate"
        },
        "summary": {
          "fr": "Piloter plusieurs équipes, sites et secteurs.",
          "en": "Run several teams, sites and sectors."
        }
      }
    ],
    "capabilities": [
      {
        "key": "threshold_alerts",
        "tier": "detection",
        "plan": "decouverte",
        "live": true,
        "label": {
          "fr": "Alertes sur seuils : stocks, machines, flotte, énergie",
          "en": "Threshold alerts on stock, machines, fleet and energy"
        }
      },
      {
        "key": "upload_help",
        "tier": "detection",
        "plan": "decouverte",
        "live": true,
        "label": {
          "fr": "Un fichier refusé est expliqué en clair",
          "en": "A refused file is explained in plain language"
        }
      },
      {
        "key": "weekly_report",
        "tier": "detection",
        "plan": "decouverte",
        "live": true,
        "label": {
          "fr": "Résumé hebdomadaire",
          "en": "Weekly summary"
        }
      },
      {
        "key": "sms_alerts",
        "tier": "estimation",
        "plan": "pro",
        "live": true,
        "label": {
          "fr": "Alertes par SMS",
          "en": "SMS alerts"
        }
      },
      {
        "key": "tracking",
        "tier": "estimation",
        "plan": "pro",
        "live": true,
        "label": {
          "fr": "Suivi, calendrier, sous-traitants, rapports",
          "en": "Tracking, calendar, contractors, reports"
        }
      },
      {
        "key": "value_at_risk",
        "tier": "estimation",
        "plan": "pro",
        "live": true,
        "label": {
          "fr": "Valeur à risque sur chaque alerte",
          "en": "Value at risk on every alert"
        }
      },
      {
        "key": "confidence",
        "tier": "estimation",
        "plan": "pro",
        "live": true,
        "label": {
          "fr": "Preuve et score de confiance pour chaque priorité",
          "en": "Evidence and a confidence score for every priority"
        }
      },
      {
        "key": "alert_fatigue",
        "tier": "estimation",
        "plan": "pro",
        "live": true,
        "label": {
          "fr": "Les alertes toujours ignorées sont abaissées, jamais cachées",
          "en": "Alerts you keep dismissing are lowered, never hidden"
        }
      },
      {
        "key": "ml",
        "tier": "estimation",
        "plan": "business",
        "live": true,
        "label": {
          "fr": "Délais fournisseurs appris sur votre historique",
          "en": "Supplier lead times learned from your history"
        }
      },
      {
        "key": "seasonal_advice",
        "tier": "estimation",
        "plan": "business",
        "live": false,
        "label": {
          "fr": "Conseils de stock saisonniers (paludisme en saison des pluies, grippe à l'harmattan…)",
          "en": "Seasonal stock advice (malaria in the rainy season, flu in the harmattan…)"
        }
      },
      {
        "key": "demand_forecast",
        "tier": "estimation",
        "plan": "business",
        "live": false,
        "label": {
          "fr": "Prévision de la demande : quand chaque article sera épuisé",
          "en": "Demand forecast: when each item will run out"
        }
      },
      {
        "key": "anomaly_detection",
        "tier": "estimation",
        "plan": "business",
        "live": false,
        "label": {
          "fr": "Détection d'anomalies sur stocks et machines",
          "en": "Anomaly detection on stock and machines"
        }
      },
      {
        "key": "score",
        "tier": "coordination",
        "plan": "entreprise",
        "live": false,
        "label": {
          "fr": "SentrIA Score : la fiabilité opérationnelle en une note",
          "en": "SentrIA Score: operational reliability as one rating"
        }
      },
      {
        "key": "company_thresholds",
        "tier": "coordination",
        "plan": "entreprise",
        "live": false,
        "label": {
          "fr": "Vos propres seuils d'alerte, réglés depuis l'administration",
          "en": "Your own alert thresholds, set from the admin panel"
        }
      },
      {
        "key": "benchmark",
        "tier": "coordination",
        "plan": "entreprise",
        "live": false,
        "label": {
          "fr": "Comparaison anonyme avec des clients similaires",
          "en": "Anonymous comparison with similar clients"
        }
      }
    ],
    "department_groups": {
      "health": [
        [
          "clinique-hopital",
          "pharmacie",
          "laboratoire"
        ]
      ],
      "agriculture": [
        [
          "cooperative-agricole",
          "silo-stockage"
        ],
        [
          "exploitation-agricole",
          "silo-stockage"
        ]
      ],
      "energy": [
        [
          "centrale-production",
          "distribution-energetique"
        ]
      ],
      "retail": [
        [
          "grossiste-distributeur",
          "chaine-magasins",
          "supermarche-hypermarche"
        ]
      ],
      "transportation": [
        [
          "transporteur-routier",
          "location-vehicules"
        ]
      ],
      "logistics": [
        [
          "port-conteneurs",
          "entrepot-manutention",
          "transport-distribution",
          "preparation-expedition",
          "chaine-froid",
          "plusieurs-activites"
        ]
      ]
    },
    "your_plan": "decouverte"
  },
};
