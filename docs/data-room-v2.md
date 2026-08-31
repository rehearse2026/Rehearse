# Tempo Data Room v2 — generation report

Generated: 2026-08-31 (anti-correlation guardrail + universal 4–7 fact floor)  
Simulation ID: `00000000-0000-0000-0000-000000000002` (Sell Tempo to Summit Dental Group)

## What changed

- Added visible/hidden layer columns via `supabase/data-room-v2-migration.sql` (additive only).
- Canonical ICP lives in `scripts/config/tempo-icp.ts`.
- Directory seed + generator rewritten for **64 companies** with an answer key.
- All companies are flagged `in_data_room = true` (full room; no 10-company subset).
- Generator wipes **only** `crm_prospect_directory` + `crm_prospect_contacts` rows for the Tempo simulation.
- **2026-08-31 (earlier):** Vertical-specific fact/signal pools; target trigger signature reserved for Summit; unique trap disqualifiers per trap; pass names paired to verticals.
- **2026-08-31 (this run):** Universal `research_facts` range **4–7** for every class (no trap-specific floor). Generic `validateNoStructuralClassCorrelation` runs before insert. Each trap receives a **unique** disqualifier sentence from `trapDisqualifierVariantsBySubtype`.

## Anti-correlation guardrail (generic, reusable)

`validateNoStructuralClassCorrelation(records, config)` in `scripts/generate-prospect-directory.ts` is **simulation-agnostic**. Property definitions and `getClass` live in seed config (`structuralCorrelation`); the core validator references no Tempo-specific field names.

For each configured property it groups records by answer-key class and **throws** on:

1. **Exclusive value** — a property value appears in only one class (e.g. only traps have 4 facts).
2. **Excluded value** — a class never takes a value that other classes do take (e.g. traps never have 3 facts while others do).

Tempo checks (via `TEMPO_STRUCTURAL_CORRELATION` in `tempo-directory-seed.ts`):

| Property | `getValue` source |
|----------|-------------------|
| `research_facts length` | `researchFacts.length` |
| `public_signals length` | `publicSignals.length` |
| `contact count` | 3 for all companies (designed contact set or pass filler) |
| `blurb length bucket` | `short` / `medium` / `long` from blurb character count |
| `size_note presence` | `has` / `none` |

`exemptPropertyNames` is empty for Tempo (no property is allowed to correlate with class).

### Validator proof (forced leak tests)

| Forced condition | Error thrown |
|------------------|--------------|
| Trap fact counts shifted to 5–7 only (others keep 4–7) | `Structural leak: class 'trap' never takes research_facts length value 4, which other classes take` |
| Pass `public_signals` forced to length 2 (others 3) | `Structural leak: public_signals length value 2 occurs only in class 'pass'` |
| `contact count` | Uniformly 3 for all classes — no correlation, validator passes (by design) |

## Before running the generator

1. Paste and run `supabase/data-room-v2-migration.sql` in Supabase → SQL Editor.
2. Run: `npx tsx scripts/generate-prospect-directory.ts`

`crm_prospect_documents` is intentionally left untouched.

## Class distribution (plan)

| Class | Count |
|-------|------:|
| `strong_fit` | 9 |
| `near_miss` | 16 |
| `trap` | 7 |
| `pass` | 32 |
| **Total** | **64** |

## research_facts distribution (2026-08-31 anti-correlation run)

Universal range **4–7** with spread across all four values in every class.

| class | facts=4 | facts=5 | facts=6 | facts=7 |
|-------|--------:|--------:|--------:|--------:|
| `strong_fit` | 3 | 2 | 2 | 2 |
| `near_miss` | 4 | 4 | 4 | 4 |
| `trap` | 2 | 2 | 2 | 1 |
| `pass` | 8 | 8 | 8 | 8 |

```sql
SELECT class, jsonb_array_length(research_facts) AS facts, COUNT(*)
FROM crm_prospect_directory
WHERE simulation_id = '00000000-0000-0000-0000-000000000002'
GROUP BY 1, 2 ORDER BY 1, 2;
```

No row has fewer than 4 facts. Traps share the same 4–7 spread as other classes — fact count is not a trap indicator.

## Trap disqualifier audit (unique wording per trap)

Each trap has exactly one disqualifier-themed fact, never at index 0. **No two traps share the same disqualifier sentence.**

| Company | Subtype | Disqualifier |
|---------|---------|--------------|
| Northview Family Dentistry | `already_solved` | Operations team standardized on SlotEasy eighteen months ago with a multi-year agreement. |
| Norwood Family Dentistry | `already_solved` | Operations standardized on an incumbent scheduling platform after a competitive review two years ago. |
| Rainier Vision Group | `already_solved` | Practice-wide vendor selection for appointment software finished last quarter with a locked-in term. |
| Golden State Dental Alliance | `contracting` | Internal memo leaked to a trade blog cites a freeze on discretionary vendor projects through next fiscal year. |
| Larkspur Dental Group | `contracting` | CFO memo suspended evaluation of new SaaS vendors through the next budget cycle. |
| Maple Chiropractic Center | `franchise_power` | Franchise agreement requires all clinics to purchase scheduling tools from an approved corporate catalog. |
| Fairview Rehab Partners | `phantom_fit` | Expansion headline was a rebranding of an existing location, not a new site opening. |

## Fact and signal reuse

| Metric | Result |
|--------|--------|
| Facts appearing in >2 companies | **0** |
| Public signals appearing in >2 companies | **0** |
| Dual target trigger signature (non-target) | **0** |

## Answer-key rules enforced (hard failures)

| Rule | Enforcement |
|------|-------------|
| **R1** | Exactly one `strong_fit` with `fit_rank = 1` (Summit) |
| **R2** | No other `strong_fit` matches Summit on all four ICP axes with a `strong` trigger |
| **R3** | Every `pass` fails at least one visible ICP axis |
| **R4** | Every `near_miss` fails ≥1 ICP axis or has `weak`/`none` trigger |
| **R5** | Every `trap` passes ≥3 ICP axes, has `strong`/`weak` trigger, 4–7 `research_facts`, one disqualifier |
| **R6** | Name registry rules (unique, no parentheses, substring pairs, Summit ×2) |
| **R7** | Every company has 4–7 `research_facts`; spread across 4–6–7 within each class |
| **R8** | `validateNoStructuralClassCorrelation` — no structural property may predict class |

## Verification results (2026-08-31 run)

| Check | Result |
|-------|--------|
| All classes spread 4–7 facts | Pass |
| No row &lt; 4 facts | Pass |
| Anti-correlation validator (production roster) | Pass |
| Forced leak test (trap min 5) | Throws as documented |
| Forced leak test (pass signals = 2) | Throws as documented |
| Unique trap disqualifiers (7/7) | Pass |
| `fit_rank = 1` | Summit Dental Group only |
| Class distribution | 9 / 16 / 7 / 32 |
| Contacts per company | 3 each, 1 `is_correct_contact` |
| `crm_prospect_documents` | 0 rows |
| `app/api/student/data-room-chat/route.ts` | Unchanged |
| `npm run build` | Pass |

Guardrail warnings emitted: none.

## Rules that could not be satisfied

None in local roster validation.
