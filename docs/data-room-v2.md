# Tempo Data Room v2 — generation report

Generated: 2026-08-30 (regenerated after research_facts / name-collision fix)  
Simulation ID: `00000000-0000-0000-0000-000000000002` (Sell Tempo to Summit Dental Group)

## What changed

- Added visible/hidden layer columns via `supabase/data-room-v2-migration.sql` (additive only).
- Canonical ICP lives in `scripts/config/tempo-icp.ts`.
- Directory seed + generator rewritten for **64 companies** with an answer key.
- All companies are flagged `in_data_room = true` (full room; no 10-company subset).
- Generator wipes **only** `crm_prospect_directory` + `crm_prospect_contacts` rows for the Tempo simulation.
- **2026-08-30 fix:** `research_facts` count is class-independent (2–5 per company, spread within each class). Company names use an expanded pool with `CompanyNameRegistry` (no parenthetical qualifiers, max two per first word, substring rejection). Summit skim-test pair preserved.

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

Subtype mix is procedural and validated each run. A representative local run produced:

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

## Answer-key rules enforced (hard failures)

| Rule | Enforcement |
|------|-------------|
| **R1** | Exactly one `strong_fit` with `fit_rank = 1` (Summit) |
| **R2** | No other `strong_fit` may match Summit on all four ICP axes **and** carry a `strong` trigger |
| **R3** | Every `pass` fails at least one **visible** axis (vertical, 3–12 locations, or territory) |
| **R4** | Every `near_miss` fails ≥1 ICP axis **or** has `weak`/`none` trigger |
| **R5** | Every `trap` passes ≥3 ICP axes, has `strong`/`weak` trigger, and non-empty `research_facts` |
| **R6** | Company names unique under case-insensitive normalized comparison; no parenthetical qualifiers; no normalized substring pairs; no first word more than twice; exactly two names begin with `Summit` |
| **R7** | Every company has 2–5 `research_facts`; each class shows a spread across counts 2–5 (not a single value) |

## research_facts distribution (post-fix, 2026-08-30 run)

Count is drawn from the same 2–5 spread for every class. Trap disqualifiers are one fact among several, at a random index.

| class | facts=2 | facts=3 | facts=4 | facts=5 |
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

## Company name rules (post-fix)

- `CompanyNameRegistry` rejects parenthetical qualifiers — pool expansion replaces the old `(West)` fallback (which now throws).
- No first word appears more than twice; `Summit` appears exactly twice (`Summit Dental Group`, `Summit Outdoor Gear`).
- No normalized name is a substring of another (protects fuzzy lead matching).

```sql
-- First words with count > 2 (expect 0 rows)
SELECT split_part(company_name,' ',1), COUNT(*)
FROM crm_prospect_directory
WHERE simulation_id = '00000000-0000-0000-0000-000000000002'
GROUP BY 1 HAVING COUNT(*) > 2;
```

First-word collision groups with count = 2 in the 2026-08-30 run: **Summit only** (deliberate skim-test). All other first words appear once.

## Contact names

Procedural contacts use `randomUniquePerson()` with a per-generation registry (authored contacts registered first). The 40×40 person-name pool is sufficient when uniqueness is enforced at generation time — **0 duplicate full names** across 192 contacts in the post-fix run. Pool expansion was not required.

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

-- R5: traps must have research_facts
select company_name from crm_prospect_directory
where simulation_id = '00000000-0000-0000-0000-000000000002'
  and class = 'trap'
  and (research_facts is null or jsonb_array_length(research_facts) = 0);

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

## Verification results (2026-08-30 post-fix run)

| Check | Result |
|-------|--------|
| Fact spread within every class | Pass |
| No row with &lt; 2 facts | Pass |
| First words &gt; 2 | 0 rows |
| `Summit` count | 2 |
| Names containing `(` | 0 |
| Substring name pairs | 0 |
| `fit_rank = 1` | Summit Dental Group only |
| Passes satisfying vertical + 3–12 loc + in_territory | 0 |
| Class distribution | 9 / 16 / 7 / 32 |
| Contacts per company | 3 each, 1 `is_correct_contact` |
| `crm_prospect_documents` | 0 rows (untouched) |
| `npm run build` | Pass |

Guardrail warnings emitted: none (one informational validation line: Summit fit_rank 1 with 4/4 ICP axes and strong trigger).

## Rules that could not be satisfied

None in local roster validation. Remote generator run requires the v2 migration to be applied first (schema preflight checks for `vertical` column).
