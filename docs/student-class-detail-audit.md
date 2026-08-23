# Student Class Detail Audit

Read-only audit of `/student/classes/[classId]` (student class detail — simulations inside one enrolled class).  
Date of investigation: 2026-08-22.  
Scope: code as present in the workspace; no behavior was changed for this document.

**Sections:** [1. Locate the Real Page](#1-locate-the-real-page) · [2. Data Sources](#2-data-sources) · [3. Simulation Card / List Structure](#3-simulation-card--list-structure) · [4. Layout Structure](#4-layout-structure) · [5. Interactive Elements](#5-interactive-elements) · [6. State Variations](#6-state-variations) · [7. Styling / Design Tokens](#7-styling--design-tokens-currently-used) · [8. Connection to the Dashboard Audit](#8-connection-to-the-dashboard-audit) · [Notes / Gaps](#notes--gaps)

---

## 1. Locate the Real Page

### Plain-language findings

The route `/student/classes/[classId]` is rendered by **`app/student/classes/[classId]/page.tsx`**. Like other `/student/*` routes, it is wrapped by **`app/student/layout.tsx`** → **`StudentPortalShell`** (shared top header + left sidebar + scrollable main). The class-detail page itself does **not** define its own portal chrome.

**Confirmed as rendering on this page:**

| Piece | Role on class detail |
|-------|----------------------|
| `app/student/classes/[classId]/page.tsx` | Page: back link, class banner/header, description, sim grid or empty |
| `app/student/layout.tsx` | Auth gate + shell; loads enrolled class count for header |
| `components/student/StudentPortalShell.tsx` | Header + sidebar + main (sidebar **shown** on this path) |
| `components/student/StudentDashboardHeader.tsx` | Shared top bar (logo, name, test shortcuts, logout) |
| `components/student/StudentSidebar.tsx` | Shared nav: Home / Classes / Simulations |
| `components/StudentClassHeader.tsx` | Non–system-default class banner (name + image/gradient) |
| `components/SimulationCard.tsx` | One card per published simulation |
| `components/SimulationStartLink.tsx` | Start/Continue CTA + brief full-screen loader |
| `components/EmptyState.tsx` | Empty sim list for **non**-default classes only |

**Inline (not a separate component) on this page:**

- System-default (“Rehearse Essentials”) banner markup when `classId === DEFAULT_CLASS_ID`
- System-default empty copy when that class has zero published sims

**Confirmed NOT rendered on this page:**

- `StudentClassCard` (dashboard/classes index cards)
- `StudentAttemptHistory` / completed-score table
- Leaderboard components
- `TempoSimulationEntryView` / Tempo stage runner UI (those live under `/student/simulation/...`)
- Join Class button / modal

### Evidence

Page module:

```tsx
// app/student/classes/[classId]/page.tsx
export default async function StudentClassPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const session = await getStudentSession();
  // ...
  const classDetail = await loadStudentClassDetail(session.studentId, params.classId);
```

Shell still shows chrome on `/student/classes/...` (hide only for live runner path `/student/simulation/[id]` with no extra segment):

```tsx
// components/student/StudentPortalShell.tsx
function shouldHideSidebar(pathname: string): boolean {
  return /^\/student\/simulation\/[^/]+$/.test(pathname);
}
```

---

## 2. Data Sources

### Plain-language findings

| UI content | Source |
|------------|--------|
| Auth / redirect if logged out | `getStudentSession()` JWT |
| Enrollment gate + class metadata (name, description, card image/scheme, accent) | `loadStudentClassDetail(studentId, classId)` |
| Published simulations list | Same helper: `class_simulations` → nested `simulations`, filtered `is_published` |
| In-progress attempt per simulation | Page-local query: `attempts` where `status = in_progress` for this student + class |
| Stage progress count on card | `stage_scores` rows for those in-progress attempt IDs (count per `attempt_id`) |
| System-default display name / description / banner | Constants (`DEFAULT_CLASS_*`), not live DB overrides for name/description/banner |
| Completed attempt scores / leaderboard | **Not loaded on this page** |

If the student is not enrolled (or class missing), `loadStudentClassDetail` returns `null` and the page redirects to `/student/dashboard` (not `/student/classes`).

### Evidence

**Class + simulations loader** — `lib/student-class-data.ts` (`loadStudentClassDetail`):

```ts
  let enrollment = (
    await supabase
      .from("student_classes")
      .select("class_id, classes (*)")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .maybeSingle()
  ).data;

  // fallback select if needed:
  // classes ( id, name, description, join_code )

  const { data: classSimRows } = await supabase
    .from("class_simulations")
    .select(
      `
      simulation_id,
      simulations (
        id, title, description,
        persona_name, persona_role,
        product_context, is_published,
        persona_system_prompt, simli_face_id, teacher_id, created_at
      )
    `
    )
    .eq("class_id", classId);

  // only published sims pushed into `simulations` array
```

Mapped to UI: `className`, `description`, `cardImageUrl`, `cardColorScheme`, `accentColor`, `simulations[]`.

**In-progress attempts + stage counts** — `app/student/classes/[classId]/page.tsx`:

```tsx
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", session.studentId)
    .eq("class_id", params.classId)
    .eq("status", ATTEMPT_STATUS.IN_PROGRESS);

  // then, if any attempt ids:
  const { data: stageRows } = await supabase
    .from("stage_scores")
    .select("attempt_id")
    .in("attempt_id", attemptIds);
```

`ATTEMPT_STATUS.IN_PROGRESS` is `"in_progress"` (`lib/constants.ts`).

**Session:** same page calls `getStudentSession()` before data loads.

---

## 3. Simulation Card / List Structure

### Plain-language findings

Each published simulation is a **`SimulationCard`**. Displayed fields:

| Shown? | Field |
|--------|--------|
| Yes | Simulation **title** (`simulation.title`) |
| Yes | **Persona** line: `persona_name · persona_role` |
| Yes | **Product context** (`product_context`, `line-clamp-2`) — not the simulation `description` field |
| Yes | Class name as small uppercase label (the enrolled **class** name, via `className` prop) |
| Yes | Left accent border color from class `accentColor` |
| Conditional | **Progress** bar only when `stagesCompleted > 0`: `{n}/{TOTAL_STAGES_COUNT}` stages (`TOTAL_STAGES_COUNT` = **6**) |
| Yes | CTA label: **“Continue”** if an in-progress attempt exists for that sim, else **“Start Simulation”** |
| No | Estimated time |
| No | Explicit “not started / completed” badge beyond CTA text |
| No | Completed score / grade / results preview on the card |
| No | Stage count as a static property of the simulation (only live progress from `stage_scores`) |

**Tempo / Rehearse Essentials special-casing (confirmed):**

1. **Class-level:** When `classId === DEFAULT_CLASS_ID`, the page does **not** use `StudentClassHeader`. It renders an inline Essentials banner (`DEFAULT_CLASS_BANNER_URL`, `DEFAULT_CLASS_NAME`, “Available to all students” badge) and uses `DEFAULT_CLASS_DESCRIPTION` for body copy. Empty state copy is also Essentials-specific (“No Rehearse Essentials yet.”).
2. **Simulation-level:** If the class is the default class **and** `isTempoDefaultSimulation(sim.id, sim.title)` is true, the card’s `href` goes to the **Tempo entry** route  
   `/student/simulation/{id}/entry?classId=...`  
   instead of the generic runner  
   `/student/simulation/{id}?classId=...&attempt=...`.  
   Card **visual** treatment is otherwise the same `SimulationCard` (no separate Tempo card component).

`isTempoDefaultSimulation`: true if `simulationId === TEMPO_SIMULATION_ID`, or title contains `"tempo"` (case-insensitive).

### Evidence

Card contents — `components/SimulationCard.tsx`:

```tsx
      <h3 className="font-semibold text-text-primary">{simulation.title}</h3>
      <p className="text-sm text-text-secondary">
        {simulation.persona_name} · {simulation.persona_role}
      </p>
      <p className="text-sm text-text-secondary line-clamp-2">{simulation.product_context}</p>
      // progress only if stagesCompleted > 0
      <SimulationStartLink href={href} label={actionLabel} ... />
```

Tempo href branch — page:

```tsx
            const isTempoInDefaultClass =
              params.classId === DEFAULT_CLASS_ID &&
              isTempoDefaultSimulation(sim.id, sim.title);

            const href = isTempoInDefaultClass
              ? `/student/simulation/${sim.id}/entry?classId=${params.classId}`
              : `/student/simulation/${sim.id}?${query.toString()}`;
```

---

## 4. Layout Structure

### Plain-language findings

**Chrome (layout shell — same as Home/Classes/Simulations tabs):**

1. `StudentDashboardHeader` — logo, display name / class count, compact Test Shortcuts, logout  
2. `StudentSidebar` — Home / Classes / Simulations (Classes tab active for this path)  
3. `main` — page children

**Main content order (page only):**

1. **“← All classes”** link → `/student/classes`  
2. **Class header**
   - Default class: inline Essentials banner  
   - Other classes: `StudentClassHeader`  
3. **Description** paragraph (if any)  
4. **Either** empty state **or** responsive grid (`md:grid-cols-2 lg:grid-cols-3`) of `SimulationCard`s  

**No** leaderboard section, **no** stats strip, **no** page footer beyond the shell sidebar’s “Student Portal” label.

### Evidence

Structure outline from `app/student/classes/[classId]/page.tsx` return: Link → banner/header → description → empty OR `SimulationCard` grid.

---

## 5. Interactive Elements

### Plain-language findings

| Control | Location | Behavior |
|---------|----------|----------|
| Logo / Rehearse | Shell header | Link → `/student/dashboard` |
| Home / Classes / Simulations | Shell sidebar | Links to those student routes |
| Sidebar collapse | Shell sidebar | Toggle + `localStorage` persistence |
| Test Shortcuts | Shell header | Unchanged Tempo test jumps (not page-specific) |
| Logout | Shell header | `POST /api/student/logout` → `/student-login` |
| **← All classes** | Page | `Link` → `/student/classes` |
| **Start Simulation / Continue** | Each `SimulationCard` via `SimulationStartLink` | Client: shows full-screen navy “Rehearse” loader for `SIMULATION_ENTRY_LOADER_MS`, then `router.push(href)` — Tempo default → entry URL; others → simulation URL with `classId` and optional `attempt` |

No other buttons on the page body. Cards are not whole-card links; only the CTA button navigates.

### Evidence

```tsx
// components/SimulationStartLink.tsx
  const handleClick = (): void => {
    setIsLoading(true);
    window.setTimeout(() => {
      router.push(href);
    }, SIMULATION_ENTRY_LOADER_MS);
  };
```

Back link:

```tsx
      <Link href="/student/classes" ...>
        ← All classes
      </Link>
```

---

## 6. State Variations

### Plain-language findings

| State | Handling |
|-------|----------|
| **Unauthenticated** | Redirect `/student-login` |
| **Not enrolled / missing class** | Redirect `/student/dashboard` |
| **Loading** | No `loading.tsx` under `app/student/classes/[classId]/`; server component awaits queries (no dedicated skeleton UI) |
| **Zero published simulations** | Default class: centered Material `rocket_launch` + “No Rehearse Essentials yet.” / “Check back soon.” Non-default: `EmptyState` emoji 🎯 + professor-not-assigned copy |
| **Simulation not started** | No in-progress attempt → CTA **“Start Simulation”**; no progress bar |
| **Simulation in progress** | Matching `attempts` row → CTA **“Continue”**; `attempt` query param set for non-Tempo href; progress bar only if `stage_scores` count &gt; 0 |
| **Simulation completed** | **Not specially represented on this page** — completed attempts are not queried here; a completed sim looks like “not started” unless a new in-progress attempt exists |
| **Entry loader** | After clicking Start/Continue, full-viewport loader until navigation |

### Evidence

Empty branches and CTA mapping are in `app/student/classes/[classId]/page.tsx` (lines ~115–160). Progress gate in `SimulationCard`: `hasProgress = stagesCompleted > 0`.

---

## 7. Styling / Design Tokens Currently Used

### Plain-language findings

This page still uses several **legacy / alias tokens** (same family flagged on the older dashboard audit), mixed with some semantic tokens on the back link and shell.

**Legacy / inconsistent on this surface:**

- `text-text-secondary` — description, Essentials empty, card persona/context/progress  
- `text-text-primary` — card title  
- `card-surface` — card container  
- `border-border` — progress track border  
- `btn-primary` — Start/Continue button  

**Semantic / newer:**

- Back link: `text-on-surface-variant`  
- Shell: `bg-background`, `bg-surface`, outline-variant borders (header/sidebar)  

**Other:**

- Essentials banner: inline gradient + `DEFAULT_CLASS_BANNER_URL`; badge `bg-white/10 text-white`  
- `StudentClassHeader`: image overlay or `scheme.gradientFrom` / `gradientTo`  
- Grid: `gap-4`, `md:grid-cols-2`, `lg:grid-cols-3`  
- Card accent: inline `borderLeftColor: accentColor` (default prop fallback `#c9a227` if accent omitted)  
- Loader: `bg-primary text-white`, `z-[80]`

### Evidence

```tsx
// SimulationCard
className="card-surface border-l-4 p-5 ..."
<h3 className="font-semibold text-text-primary">
<p className="text-sm text-text-secondary">
<div className="h-2 ... border border-border ...">
```

```tsx
// page description
<p className="text-sm text-text-secondary mb-6 -mt-2">
```

---

## 8. Connection to the Dashboard Audit

### Plain-language findings

`docs/student-dashboard-audit.md` stated that **simulation cards / Tempo stage UI are not on the dashboard** and instead live under **`/student/classes/[classId]`** (and simulation routes).

**Confirmed accurate for this page:**

- This route is where **`SimulationCard`** lists the class’s published simulations and starts/continues them.  
- Tempo is special-cased only for **navigation** (entry URL) and for **default-class chrome/empty copy** — not a separate Tempo stage UI on this page.  
- Actual Tempo stage runner / `TempoSimulationEntryView` still live under `/student/simulation/[id]/...`, not here.

**Nuance since the dashboard audit was written:** the student shell sidebar is now Home / Classes / Simulations (not a per-class list). Class detail is still reached by clicking a class card from Home or `/student/classes`, landing on `/student/classes/[classId]`.

---

## Notes / Gaps

- Completed-attempt / score display is intentionally absent here; students see completed runs on Home and `/student/simulations`, not on class detail cards.  
- `simulation.description` is selected from Supabase but **not shown** on `SimulationCard` (card uses `product_context`).  
- Unenrolled redirect targets `/student/dashboard` while the in-page back link goes to `/student/classes` — slightly inconsistent destinations.  
- Browser visual QA of the Essentials banner image and card progress bar was not performed for this audit — findings are from code only.

---

*End of audit — sections 1–8 complete.*
