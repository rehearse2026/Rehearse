# Tempo Data Room v2 — generation report

Generated: 2026-08-31 (content-quality fix: diversified facts, trap cover, trigger signature)  
Simulation ID: `00000000-0000-0000-0000-000000000002` (Sell Tempo to Summit Dental Group)

## What changed

- Added visible/hidden layer columns via `supabase/data-room-v2-migration.sql` (additive only).
- Canonical ICP lives in `scripts/config/tempo-icp.ts`.
- Directory seed + generator rewritten for **64 companies** with an answer key.
- All companies are flagged `in_data_room = true` (full room; no 10-company subset).
- Generator wipes **only** `crm_prospect_directory` + `crm_prospect_contacts` rows for the Tempo simulation.
- **2026-08-30 fix:** `research_facts` count is class-independent (2–5 per company, spread within each class). Company names use an expanded pool with `CompanyNameRegistry` (no parenthetical qualifiers, max two per first word, substring rejection). Summit skim-test pair preserved.
- **2026-08-31 fix:** Vertical-specific fact/signal pools with max-two reuse across companies; traps require 4–5 facts with exactly one disqualifier at a non-first index; target trigger signature (front-desk hiring + phone complaints) reserved for Summit only; pass names paired to verticals; regionally incongruous pass prefixes removed (e.g. Badger, Lone Star).

## Before running the generator

1. Paste and run `supabase/data-room-v2-migration.sql` in Supabase → SQL Editor.
2. Run: `npx tsx scripts/generate-prospect-directory.ts`

`crm_prospect_documents` is intentionally left untouched (legacy rows may orphan after directory wipe).

## Class distribution (plan)

| Class | Count |
|-------|------:|
| `strong_fit` | 9 |
| `near_miss` | 16 |
| `trap` | 7 |
| `pass` | 32 |
| **Total** | **64** |

Procedural slots subtract authored entries per class. Current authored count:

| Class | Authored | Procedural |
|-------|---------:|-----------:|
| `strong_fit` | 1 (Summit) | 8 |
| `near_miss` | 1 (BrightSmile) | 15 |
| `trap` | 2 (Northview, Golden State) | 5 |
| `pass` | 0 | 32 |

Subtype mix from the 2026-08-31 run:

| Subtype | Count |
|---------|------:|
| `too_small` | 3 |
| `no_strain` | 3 |
| `adjacent_vertical` | 3 |
| `too_big` | 3 |
| `out_of_territory` | 4 |
| `already_solved` | 3 |
| `contracting` | 2 |
| `franchise_power` | 1 |
| `phantom_fit` | 1 |

## Carried-forward decoy classifications

| Company | New class | Subtype | Reasoning |
|---------|-----------|---------|-----------|
| **BrightSmile Dental Partners** | `near_miss` | `no_strain` | Firmographics look credible, but the designed flaw is a **stale expansion trigger** with no live operational strain — teaches students not to chase old news. |
| **Northview Family Dentistry** | `trap` | `already_solved` | Card still looks attractive (dental, in-range size, in territory). Disqualifier (**SlotEasy incumbent**) lives only in `research_facts`, not on the visible card. |
| **Golden State Dental Alliance** | `trap` | `contracting` | Passes ICP axes and carries an urgent headline, but hidden research shows **software spend freeze / contracting posture** — classic attractive trap. |

## Summit Dental Group (rank 1)

- `class`: `strong_fit`
- `fit_rank`: `1` (only company allowed to hold rank 1)
- `vertical`: dental, `locations`: 8, `metro`: Front Range CO, `in_territory`: true
- `online_booking`: false
- `trigger_quality`: strong
- `keyed_trigger`: "8th location + front-desk hiring"
- `best_contact`: Dana Reyes
- **Only company** allowed to carry **both** target trigger signature themes in `public_signals` (front-desk hiring + phone/hold complaints).

## Content-quality rules (2026-08-31)

| Rule | Enforcement |
|------|-------------|
| **Target trigger signature** | Config-driven `targetTriggerSignatureThemes`; no non-target may match more than one theme across `public_signals` (throws) |
| **Trap cover** | Traps: min 4 `research_facts`, exactly one disqualifier-themed fact, disqualifier not at index 0 |
| **Fact diversity** | Vertical-specific pools; no sentence in more than 2 companies; no duplicate themes within one company |
| **Signal diversity** | Same max-two reuse rule for procedural `public_signals` |
| **Vertical consistency** | Facts drawn only from the company's vertical pool (no `_default` retail filler on property companies) |
| **Pass naming** | `passSuffixByVertical` pairs suffix to vertical; Mountain West–plausible prefixes only |

## Answer-key rules enforced (hard failures)

| Rule | Enforcement |
|------|-------------|
| **R1** | Exactly one `strong_fit` with `fit_rank = 1` (Summit) |
| **R2** | No other `strong_fit` may match Summit on all four ICP axes **and** carry a `strong` trigger |
| **R3** | Every `pass` fails at least one **visible** axis (vertical, 3–12 locations, or territory) |
| **R4** | Every `near_miss` fails ≥1 ICP axis **or** has `weak`/`none` trigger |
| **R5** | Every `trap` passes ≥3 ICP axes, has `strong`/`weak` trigger, and ≥4 non-empty `research_facts` with one disqualifier |
| **R6** | Company names unique under case-insensitive normalized comparison; no parenthetical qualifiers; no normalized substring pairs; no first word more than twice; exactly two names begin with `Summit` |
| **R7** | Every company has 2–5 `research_facts` (traps: 4–5 only); each class shows a spread across allowed counts |

## research_facts distribution (2026-08-31 run)

Traps use 4–5 only; other classes use 2–5.

| class | facts=2 | facts=3 | facts=4 | facts=5 |
|-------|--------:|--------:|--------:|--------:|
| `strong_fit` | 3 | 2 | 2 | 2 |
| `near_miss` | 4 | 4 | 4 | 4 |
| `trap` | 0 | 0 | 4 | 3 |
| `pass` | 8 | 8 | 8 | 8 |

```sql
SELECT class, jsonb_array_length(research_facts) AS facts, COUNT(*)
FROM crm_prospect_directory
WHERE simulation_id = '00000000-0000-0000-0000-000000000002'
GROUP BY 1, 2 ORDER BY 1, 2;
```

## Trap disqualifier audit (2026-08-31 run)

Each trap has exactly one disqualifier-themed fact (not first).

| Company | Subtype | Disqualifier fact |
|---------|---------|-------------------|
| Northview Family Dentistry | `already_solved` | Operations team standardized on SlotEasy eighteen months ago with a multi-year agreement. |
| Golden State Dental Alliance | `contracting` | Internal memo leaked to a trade blog cites a freeze on discretionary vendor projects through next fiscal year. |
| Meadowbrook Chiropractic Center | `already_solved` | Signed a multi-year agreement with a scheduling vendor last year. |
| Ember Rehab Partners | `franchise_power` | Corporate franchise office mandates approved vendor lists for all locations. |
| Peregrine Aesthetics | `contracting` | Finance memo cites a freeze on discretionary software spend. |
| Indigo Chiropractic Center | `phantom_fit` | Expansion headline was a rebranding of an existing location, not a new site opening. |
| Hawthorne Rehab Partners | `already_solved` | Signed a multi-year agreement with a scheduling vendor last year. |

## Fact and signal reuse (2026-08-31 run)

| Metric | Result |
|--------|--------|
| Most-reused research fact | "Instagram story featured staff volunteering at a health fair." — **2 companies** |
| Facts appearing in >2 companies | **0** |
| Public signals appearing in >2 companies | **0** (enforced at generation) |

Prior run had heavy reuse (e.g. "Local business journal ran a short profile on community involvement." in 4+ companies); expanded vertical pools eliminated that pattern.

## franchise_power trap public_signals (2026-08-31 run)

Company: **Ember Rehab Partners** (replaces prior Cedar Grove Vision Group collision in this seed draw).

```json
[
  "Press coverage of a new flagship location opening",
  "Google review theme: consistent care quality across locations",
  "Chamber feature on multi-market expansion"
]
```

No front-desk hiring + phone-hold pairing. Disqualifier remains corporate vendor control in `research_facts`.

## Target trigger signature check

```text
Dual trigger signature violations (non-target with both themes): 0
```

Only Summit Dental Group matches both `front_desk_hiring` and `phone_hold_complaints` themes in `public_signals`.

## Company name rules

- `CompanyNameRegistry` rejects parenthetical qualifiers.
- No first word appears more than twice; `Summit` appears exactly twice (`Summit Dental Group`, `Summit Outdoor Gear`).
- Pass prefixes reviewed for Mountain West plausibility (removed Badger, Lone Star, Kodiak, Yosemite, etc.).
- `passSuffixByVertical` pairs suffix to pass vertical (e.g. Properties + property management).

## Contact names

Procedural contacts use `randomUniquePerson()` with a per-generation registry (authored contacts registered first). **0 duplicate full names** across 192 contacts in the post-fix run.

## Warn-level checks (non-fatal)

- Trap contacts that do not measurably beat the correct contact on a configured axis.
- Declared `strongerAxis` text that may not reference the measured winning axis keyword.

## Verification queries (post-generate)

```sql
-- Row count
select count(*) from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002';

-- Class distribution
select class, count(*) from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002'
group by class order by class;

-- R1: exactly one fit_rank 1 and it is Summit
select company_name, class, fit_rank from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002'
  and fit_rank = 1;

-- R3: no pass inside visible ICP
select company_name, vertical, locations, in_territory, class
from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002'
  and class = 'pass'
  and vertical in ('dental','veterinary','physical therapy','optometry','med spa','chiropractic')
  and locations between 3 and 12
  and in_territory is true;

-- Trap fact counts (expect all >= 4)
select company_name, jsonb_array_length(research_facts)
from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002'
  and class = 'trap';

-- Fact reuse (>2 companies per sentence — expect 0 rows)
-- (run in app after unnesting research_facts)

-- Contacts: 3 per company
select d.company_name, count(c.id) as contacts
from crm_prospect_directory d
left join crm_prospect_contacts c on c.company_id = d.id
where d.simulation_id = '00000000-0000-0000-0000-000000000002'
group by d.company_name
having count(c.id) <> 3;

-- Documents untouched
select count(*) from crm_prospect_documents;
```

## Public payload guard

`lib/tempo-prospect-directory.ts` exposes only visible-layer fields via `toPublicProspectCompany()`.  
Run: `npx tsx lib/tempo-prospect-directory.test.ts`

## Skim-test pass

`Summit Outdoor Gear` (retail, 6 locations) is authored procedurally as the first `pass` row — wrong vertical by design.

## Verification results (2026-08-31 run)

| Check | Result |
|-------|--------|
| Non-target dual trigger signature | **0 violations** |
| Trap fact count ≥ 4 | **Pass** (4 traps at 4 facts, 3 at 5) |
| One disqualifier per trap | **Pass** (manual audit above) |
| Fact sentence reuse >2 | **0** |
| Fact spread within every class | Pass |
| No row with &lt; 2 facts (traps ≥ 4) | Pass |
| First words &gt; 2 | 0 rows |
| `Summit` count | 2 |
| Names containing `(` | 0 |
| Substring name pairs | 0 |
| `fit_rank = 1` | Summit Dental Group only |
| Passes satisfying vertical + 3–12 loc + in_territory | 0 |
| Class distribution | 9 / 16 / 7 / 32 |
| Contacts per company | 3 each, 1 `is_correct_contact` |
| `crm_prospect_documents` | 0 rows (untouched) |
| `app/api/student/data-room-chat/route.ts` | Unchanged |
| `npm run build` | Pass |

Guardrail warnings emitted: none (informational: Summit fit_rank 1 with 4/4 ICP axes and strong trigger).

## Rules that could not be satisfied

None in local roster validation.
