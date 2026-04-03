# FAZA 6: Kolejność Implementacji diri-router

## Overview

Ten dokument definiuje optymalną kolejność implementacji zadań DC-DR, uwzględniając zależności między issue.

---

## FAZA A: Fundament (Bez zależności)

Te zadania można wykonywać równolegle lub w dowolnej kolejności:

| Issue         | Tytuł                               | Dlaczego fundament                                       |
| ------------- | ----------------------------------- | -------------------------------------------------------- |
| **DC-DR-006** | Reconcile resolvers + context tiers | Definiuje architekturę resolverów i progi context window |
| **DC-DR-001** | Model name mapping layer            | Tworzy mapping z abstract → real model IDs               |

### Kolejność A1 → A2:

```
DC-DR-006 (resolver reconcile)
    ↓
    Definiuje: TIER_MODEL_MAP, CONTEXT_TIER_THRESHOLDS
    ↓
DC-DR-001 (model mapping)
    ↓
    Używa: DC-DR-006 thresholds do filtrowania modeli
```

---

## FAZA B: Integracja Picker → Router

| Issue         | Tytuł                            | Dlaczego po fundamencie                |
| ------------- | -------------------------------- | -------------------------------------- |
| **DC-DR-002** | Integrate Picker → Router        | Potrzebuje DC-DR-006 (resolver gotowy) |
| **DC-DR-011** | Update context window thresholds | Potrzebuje DC-DR-006 (definiuje progi) |

### Kolejność B1 → B2:

```
FAZA A (DC-DR-006, DC-DR-001)
    ↓
DC-DR-006 (resolver reconcile) ✓
    ↓
DC-DR-011 (context thresholds) ← może równolegle z DC-DR-002
    ↓
DC-DR-002 (picker → router integration)
    ↓
    Łączy: CascadeModelResolver + ProviderRouter
```

---

## FAZA C: Dispatcher Integration

| Issue         | Tytuł                      | Dlaczego po FAZIE B                                              |
| ------------- | -------------------------- | ---------------------------------------------------------------- |
| **DC-DR-003** | Dispatcher → diri-router   | Potrzebuje DC-DR-001 (model mapping) i DC-DR-002 (picker→router) |
| **DC-DR-004** | chatId + FeedbackCollector | Może równolegle z DC-DR-003                                      |
| **DC-DR-005** | CLI → Router verification  | Potrzebuje DC-DR-003 (dispatcher integration)                    |

### Kolejność C1 → C2:

```
FAZA B (DC-DR-002) ✓
    ↓
DC-DR-001 (model mapping) ✓
    ↓
DC-DR-003 (dispatcher integration)
    ↓
DC-DR-004 (chatId + feedback) ← może równolegle
    ↓
DC-DR-005 (CLI verification)
    ↓
    Weryfikuje: CLI → Server → Dispatcher → diri-router → Provider
```

---

## FAZA D: Package Refactoring (MVP-2)

| Issue         | Tytuł                           | Wymaga             |
| ------------- | ------------------------------- | ------------------ |
| **DC-DR-007** | Move Picker from core           | FAZY A-C zrobione  |
| **DC-DR-008** | Absorb picker-contracts         | FAZA D1            |
| **DC-DR-009** | Rename to @diricode/diri-router | FAZY D1 + D2       |
| **DC-DR-010** | Wire A/B ExperimentManager      | FAZA B (DC-DR-002) |

### Kolejność D1 → D4:

```
FAZY A-C (POC integration) ✓
    ↓
DC-DR-007 (move picker)
    ↓
DC-DR-008 (absorb contracts)
    ↓
DC-DR-009 (rename package)
    ↓
DC-DR-010 (A/B wiring) ← może po DC-DR-002
```

---

## Optymalna Ścieżka Krytyczna

```
TYDZIEŃ 1-2 (POC):

Tydzień 1:
  DC-DR-006 (resolver reconcile) ─┐
  DC-DR-001 (model mapping)      │ równolegle
                                  │
Tydzień 2:                       │
  DC-DR-011 (context thresholds) ─┤ może równolegle z 2
  DC-DR-002 (picker→router)     │
  DC-DR-003 (dispatcher)         │
  DC-DR-004 (chatId + feedback) │
                                  │
TYDZEŃ 3-4 (MVP-2):            │
  DC-DR-007 (move picker)       ─┘ po FAZIE C
  DC-DR-008 (absorb contracts)
  DC-DR-009 (rename package)
  DC-DR-010 (A/B wiring)
```

---

## Równoległe Możliwości

| Pracownik A | Pracownik B |
| ----------- | ----------- |
| DC-DR-006   | DC-DR-001   |
| DC-DR-011   | DC-DR-004   |
| DC-DR-007   | DC-DR-010   |

---

## Zależności - Pełna Mapa

```
                    ┌─────────────────┐
                    │   DC-DR-006     │
                    │ (resolver rec.) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ DC-DR-001 │  │ DC-DR-011│  │ DC-DR-002│
       │(model map)│  │(thresholds)│ │(picker→r)│
       └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
             │              │              │
             │              │              │
             ▼              ▼              ▼
       ┌─────────────────────────────────────┐
       │           DC-DR-003                  │
       │    (dispatcher integration)          │
       └─────────────────┬───────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │ DC-DR-005 │ │ DC-DR-004│ │ DC-DR-007│
    │(CLI verif)│ │(chatId)  │ │(move pick)│
    └───────────┘ └─────┬─────┘ └─────┬─────┘
                         │              │
                         │              ▼
                         │      ┌───────────┐
                         │      │ DC-DR-008│
                         │      │(contracts)│
                         │      └─────┬─────┘
                         │            │
                         ▼            ▼
                   ┌─────────────────────┐
                   │    DC-DR-009       │
                   │ (rename package)  │
                   └───────────────────┘
```

---

## sprint: POC (2 tygodnie)

| Issue     | Estymata | Sprint Week |
| --------- | -------- | ----------- |
| DC-DR-006 | 2 dni    | Week 1      |
| DC-DR-001 | 2 dni    | Week 1      |
| DC-DR-011 | 1 dzień  | Week 2      |
| DC-DR-002 | 2 dni    | Week 2      |
| DC-DR-003 | 2 dni    | Week 2      |
| DC-DR-004 | 1 dzień  | Week 2      |
| DC-DR-005 | 1 dzień  | Week 2      |

**Cel POC: CLI → Dispatcher → diri-router → Provider działa**

---

## Sprint: MVP-2 (2 tygodnie)

| Issue     | Estymata | Sprint Week |
| --------- | -------- | ----------- |
| DC-DR-007 | 2 dni    | Week 3      |
| DC-DR-008 | 1 dzień  | Week 3      |
| DC-DR-009 | 2 dni    | Week 4      |
| DC-DR-010 | 2 dni    | Week 4      |

---

## Kryteria Sukcesu POC

- [ ] `diricode ask "refactor auth"` działa end-to-end
- [ ] Model wybierany przez Picker (nie hardcoded)
- [ ] chatId logowane dla każdego requestu
- [ ] FeedbackCollector interface istnieje (nawet jeśli no-op)
- [ ] CLI widzi odpowiedź od LLM
