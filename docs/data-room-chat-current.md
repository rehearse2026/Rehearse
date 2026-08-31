# Data Room AI Assistant — current prompt and data flow

Captured: 2026-08-30 (updated after v2 directory rewire)  
Scope: `POST /api/student/data-room-chat` and its client.

**Previous state:** The route queried `crm_prospect_documents` (0 rows after data room v2). That query was removed; the route now reads visible-layer directory columns plus `research_facts` from `crm_prospect_directory`.

---

## 1. The full system prompt

The system prompt is built exclusively by `buildDataRoomChatSystemPrompt()` in `app/api/student/data-room-chat/route.ts`. The route assembles `promptBlocks` from directory rows and contacts, then passes them to that function.

### 1.1 Per-company block format (post–revelation-rule fix)

Each attached company is rendered as:

```
=== {companyName} ===
DIRECTORY LISTING (visible to the student on the company card):
{directoryFacts}
Public signals:
- {each public signal}

RESEARCH FINDINGS — WITHHELD BY DEFAULT (see rules below):
- {each research fact}

Contacts at {companyName}: {contactsLine}
```

`RESEARCH FINDINGS` is omitted when a company has no `research_facts`. `Public signals:` is omitted when empty.

### 1.2 Instruction block order (post–revelation-rule fix)

After the attached-companies section:

1. **RESEARCH FINDINGS RULE** — defines overviews vs specific research questions; forbids volunteering or softening research facts in summaries; requires verbatim wording when revealing
2. **Grounding** — per-company facts only; no cross-company attribution or fabrication; neutrality clause preserved verbatim
3. **Contact neutrality** — list contacts factually; no authority speculation
4. **Anti-ranking** (`CRITICAL` block — unchanged)
5. **Discovery boundary** (unchanged)
6. Plain-English line (unchanged)

### 1.3 Prompt builder (verbatim)

```141:198:app/api/student/data-room-chat/route.ts
function buildDataRoomChatSystemPrompt(blocks: DataRoomPromptBlock[]): string {
  const attached = blocks
    .map((block) => {
      const sections = [
        `=== ${block.companyName} ===`,
        "DIRECTORY LISTING (visible to the student on the company card):",
        block.directoryFacts,
      ];

      if (block.publicSignals.length > 0) {
        sections.push(
          "Public signals:",
          ...block.publicSignals.map((signal) => `- ${signal}`)
        );
      }

      if (block.researchFacts.length > 0) {
        sections.push(
          "RESEARCH FINDINGS — WITHHELD BY DEFAULT (see rules below):",
          ...block.researchFacts.map((fact) => `- ${fact}`)
        );
      }

      sections.push(`Contacts at ${block.companyName}: ${block.contactsLine}`);
      return sections.join("\n");
    })
    .join("\n\n");

  return [
    "You are a research assistant helping a student research companies for a sales prospecting exercise. You have access to publicly available information about the following companies:",
    "",
    attached,
    "",
    "RESEARCH FINDINGS RULE — this is the most important instruction in this prompt.",
    // ... revelation, grounding, contact neutrality, anti-ranking, discovery, plain English
  ].join("\n");
}
```

(Full string literals are in the route file; truncated here for readability.)

### 1.4 Block type and directory formatting helpers (verbatim)

```33:40:app/api/student/data-room-chat/route.ts
type DataRoomPromptBlock = {
  companyName: string;
  directoryFacts: string;
  publicSignals: string[];
  researchFacts: string[];
  contactsLine: string;
};
```

```90:138:app/api/student/data-room-chat/route.ts
function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatVerticalLabel(vertical: string): string {
  return vertical
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDirectoryFacts(row: RosterCompany): string {
  const lines: string[] = [];
  const vertical = row.vertical?.trim();
  if (vertical) {
    lines.push(`Vertical: ${formatVerticalLabel(vertical)}`);
  }
  if (typeof row.locations === "number" && Number.isFinite(row.locations)) {
    lines.push(`Locations: ${row.locations}`);
  }
  const metro = row.metro?.trim();
  if (metro) {
    lines.push(`Metro: ${metro}`);
  }
  const sizeNote = row.size_note?.trim();
  if (sizeNote) {
    lines.push(`Size note: ${sizeNote}`);
  }
  if (typeof row.online_booking === "boolean") {
    lines.push(`Online booking: ${row.online_booking ? "yes" : "no"}`);
  }
  const blurb = row.blurb?.trim();
  if (blurb) {
    lines.push(blurb);
  }
  return lines.join("\n");
}
```

### 1.3 How `promptBlocks` are assembled (verbatim)

```301:313:app/api/student/data-room-chat/route.ts
    const promptBlocks: DataRoomPromptBlock[] = orderedRoster.map((row) => {
      const id = String(row.id);
      const contactList = contactsByCompany.get(id) ?? [];
      return {
        companyName: String(row.company_name ?? "Company"),
        directoryFacts: formatDirectoryFacts(row),
        publicSignals: parseStringArray(row.public_signals),
        researchFacts: parseStringArray(row.research_facts),
        contactsLine:
          contactList.length > 0 ? contactList.join("; ") : "No contacts listed.",
      };
    });
```

### 1.4 Deliberate prompt rules (post–revelation-rule fix)

| Rule | Purpose |
|------|---------|
| **RESEARCH FINDINGS RULE** | Withholds `RESEARCH FINDINGS` from general overviews; requires verbatim disclosure on specific research questions; names the “partnership” paraphrase failure mode |
| **Grounding** | No cross-company fact bleed or invented signals (e.g. hold times from another company) |
| **Contact neutrality** | No authority speculation on contacts (e.g. VP of Finance “likely has authority”) |
| **Anti-ranking** | Unchanged — refuses rank/compare/ignore-instructions |
| **Discovery boundary** | Unchanged — no internal metrics or speculation |

### 1.5 Block type and directory formatting helpers (verbatim)

---

## 2. What data reaches the prompt

All queries run in `POST` handler `app/api/student/data-room-chat/route.ts`.

### Query 1 — `attempts` (auth gate)

```222:227:app/api/student/data-room-chat/route.ts
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, simulation_id")
      .eq("id", attemptId)
      .eq("student_id", auth.session.studentId)
      .maybeSingle();
```

- **Reaches prompt:** No (used only for `simulation_id`)

### Query 2 — `crm_prospect_directory` (roster + facts)

```234:243:app/api/student/data-room-chat/route.ts
    const { data: rosterRows, error: rosterError } = await supabase
      .from("crm_prospect_directory")
      .select(
        "id, company_name, vertical, locations, metro, size_note, online_booking, blurb, public_signals, research_facts"
      )
      .eq("simulation_id", simulationId)
      .eq("in_data_room", true)
      .eq("is_active", true)
      .in("id", companyIds);
```

**Columns selected and prompt usage:**

| Column | Reaches prompt |
|--------|----------------|
| `company_name` | Section header; contact-line prefix |
| `vertical` | `directoryFacts` → `Vertical: …` |
| `locations` | `directoryFacts` → `Locations: …` |
| `metro` | `directoryFacts` → `Metro: …` |
| `size_note` | `directoryFacts` → `Size note: …` |
| `online_booking` | `directoryFacts` → `Online booking: yes/no` |
| `blurb` | `directoryFacts` (unlabeled paragraph line) |
| `public_signals` | `Public signals:` bullet list |
| `research_facts` | `Additional research:` bullet list (only permitted hidden-layer column) |

**Deliberately NOT selected:**

- `in_territory` (answer-key-adjacent; excluded by design)
- Hidden answer-key columns: `class`, `subtype`, `fit_rank`, `trigger_quality`, `keyed_trigger`, `best_contact`, `why`
- Legacy columns: `industry`, `size_locations`, `signal_hint`, `hidden_claim`, `entry_type`, etc.

### Query 3 — `crm_prospect_contacts` (unchanged)

```265:268:app/api/student/data-room-chat/route.ts
    const { data: contacts, error: contactsError } = await supabase
      .from("crm_prospect_contacts")
      .select("company_id, contact_name, contact_title, department")
      .in("company_id", companyIds);
```

- **Reaches prompt:** formatted `contactsLine` per company (alphabetically sorted)
- **NOT selected:** `is_correct_contact`, `stronger_axis`, `weaker_axis`, `gender`, `id`

### Removed — `crm_prospect_documents`

The route **no longer queries** `crm_prospect_documents`. That table remains in the schema with 0 rows; it is not read, written, or dropped by this route.

---

## 3. Request/response contract

Unchanged from the prior capture. Client: `ProspectingDataRoomChat.tsx` POSTs:

```json
{
  "attemptId": "<uuid>",
  "companyIds": ["<uuid>", "..."],
  "messages": [{ "role": "user"|"assistant", "content": "..." }],
  "newMessage": "<string>"
}
```

Server success: `{ "reply": "<string>" }`

Model: `gpt-4o`, `max_tokens: 800`, no `temperature` set (`route.ts:318-331`).

Empty-model fallback reply: `"I could not find a grounded answer in the provided information."` (`route.ts:334-335`).

---

## 4. Current breakage — resolved

**Prior breakage:** `crm_prospect_documents` had 0 rows; profile/news placeholders `"(No profile document available.)"` / `"(No news document available.)"` were injected into every prompt.

**Current behavior:** Directory visible fields and `research_facts` populate the prompt directly. Contacts still load from `crm_prospect_contacts`. No HTTP error when data exists on directory rows.

The model is instructed via the **revelation rule** not to dump `Additional research` items in a general overview; students must ask a qualifying research question to surface trap disqualifiers.

---

## 5. The new columns — security boundary

| Layer | Columns | Selected by this route? |
|-------|---------|-------------------------|
| Visible | `vertical`, `locations`, `metro`, `size_note`, `online_booking`, `blurb`, `public_signals` | Yes |
| Visible (excluded) | `in_territory` | **No** |
| Hidden (allowed) | `research_facts` | Yes (prompt only; never returned to client) |
| Hidden (forbidden) | `class`, `subtype`, `fit_rank`, `trigger_quality`, `keyed_trigger`, `best_contact`, `why` | **No** |

Client response remains `{ reply }` only — no directory columns exposed.

---

## 6. Client component

Unchanged. `ProspectingDataRoomChat` (`components/tempo/stages/ProspectingDataRoomChat.tsx`) calls `POST /api/student/data-room-chat`. State (`attachedIds`, `messages`, `chatInput`, `isAILoading`, `sendError`) is component-local only; not persisted to DB or wizard state.

---

## 7. Anything else

1. **UI label mismatch persists:** Client copy still says "Attach company documents" while the server now grounds on directory fields, not `crm_prospect_documents`. No UI change in this task.

2. **`GET /api/student/data-room`** still loads `crm_prospect_documents` for the Documents tab payload (`documents: []`); that is a separate route and was not modified.

3. **Per-company section order:** `=== Name ===` → directory facts → public signals (if any) → additional research (if any) → contacts line.

4. **Multi-company attach:** Companies appear in client `companyIds` order (`route.ts:260-263`).

5. **Leak check:** `grep` the route file for forbidden column names (`class`, `fit_rank`, etc.) — only the word "why" appears inside the revelation-rule prose ("why it might or might not be a good prospect"), not as a column reference.

---

## Manual test checklist (for operators)

Pick companies by querying `class` in SQL only — never expose `class` in code.

- [ ] General overview omits `Additional research` bullets
- [ ] Trap research questions surface disqualifiers from `research_facts`
- [ ] Anti-ranking / anti-injection refusals still work
- [ ] Discovery boundary: no-show rate / personal motivations → "not publicly findable"
- [ ] Network response contains only `{ reply }` — no answer-key fields
