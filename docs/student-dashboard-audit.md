# Student Dashboard Audit

Read-only audit of `/student/dashboard` (student home).  
Date of investigation: 2026-08-22.  
Scope: code as present in the workspace; no behavior was changed for this document.

---

## 1. Locate the Real Page

### Plain-language findings

The route `/student/dashboard` is rendered by **`app/student/dashboard/page.tsx`**. That page is wrapped by **`app/student/layout.tsx`**, which wraps all `/student/*` routes in **`StudentPortalShell`**. On the dashboard path specifically, the shell shows the header and sidebar (sidebar is only hidden on the live simulation runner path `/student/simulation/[id]`).

**Confirmed as rendering on this page (via layout + page composition):**

| Piece | Role on dashboard |
|-------|-------------------|
| `app/student/dashboard/page.tsx` | Main content: welcome, class cards, attempt history |
| `app/student/layout.tsx` | Auth gate + loads enrolled classes for shell |
| `components/student/StudentPortalShell.tsx` | Fixed chrome: header + sidebar + scrollable main |
| `components/student/StudentDashboardHeader.tsx` | Top bar (logo, Join Class, Test shortcuts, name, logout) |
| `components/student/StudentSidebar.tsx` | Left nav (“My Classes” + enrolled list) |
| `components/student/StudentShellProvider.tsx` | Sidebar collapse state (context) |
| `components/StudentClassCard.tsx` | One card per enrolled class |
| `components/StudentAttemptHistory.tsx` | Completed attempts table / empty message |
| `components/EmptyState.tsx` | Empty classes state |
| `app/student/dashboard/JoinClassButton.tsx` | Header “Join a Class” + modal |
| `app/student/dashboard/TestShortcutsDropdown.tsx` | Header Tempo test `<select>` |

**Confirmed NOT rendered on `/student/dashboard`:**

- `components/student/TempoSimulationEntryView.tsx` — used by the Tempo **entry** route (`app/student/simulation/[id]/entry/page.tsx`), not the dashboard.
- Simulation cards / Tempo stage UI — those live under `/student/classes/[classId]` and simulation routes, not the home page.

### Evidence

Page entry:

```26:32:app/student/dashboard/page.tsx
export default async function StudentDashboardPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const enrolledClasses = await loadStudentEnrolledClasses(session.studentId);
```

Layout wraps children in shell:

```16:38:app/student/layout.tsx
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const enrolledClasses = await loadStudentEnrolledClasses(session.studentId);

  return (
    <StudentPortalShell
      displayName={session.displayName}
      classCount={enrolledClasses.length}
      enrolledClasses={enrolledClasses.map((cls) => ({
        classId: cls.classId,
        className: cls.className,
      }))}
    >
      {children}
    </StudentPortalShell>
  );
}
```

Shell shows header + sidebar on dashboard (not hidden):

```24:48:components/student/StudentPortalShell.tsx
function shouldHideSidebar(pathname: string): boolean {
  return /^\/student\/simulation\/[^/]+$/.test(pathname);
}
...
        {!hideSidebar && (
          <StudentDashboardHeader displayName={displayName} classCount={classCount} />
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {!hideSidebar && <StudentSidebar enrolledClasses={enrolledClasses} />}
          <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface">{children}</main>
```

---

## 2. Data Sources

### Plain-language findings

| UI content | Source |
|------------|--------|
| Student display name / welcome | JWT student session (`getStudentSession()` → `session.displayName`), not a fresh DB read on the page |
| Enrolled class list (cards + sidebar) | `loadStudentEnrolledClasses(studentId)` → `student_classes` + nested `classes`, plus `class_simulations` for published sim counts |
| Simulation **count** on cards | Count of published sims linked via `class_simulations` (not full sim list on this page) |
| Completed attempt history | Direct Supabase query on `attempts` joined to `simulations`, filtered `status = completed`, limit 20 |
| Header “N classes enrolled” | `enrolledClasses.length` from layout’s same loader |
| No leaderboard preview | Confirmed: no leaderboard query or component on this page |

There is **no client-side fetch** on the dashboard page itself for the main content — it is a server component that awaits session + helpers/queries before render.

### Evidence

**Session (name):**

```27:30:app/student/dashboard/page.tsx
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }
```

Welcome uses `session.displayName` (lines 59–60).

**Enrolled classes loader** (`lib/student-class-data.ts`):

```42:75:lib/student-class-data.ts
  let studentClasses = (
    await supabase
      .from("student_classes")
      .select("class_id, classes (*)")
      .eq("student_id", studentId)
  ).data;

  if (!studentClasses?.length) {
    const fallback = await supabase
      .from("student_classes")
      .select("class_id, classes ( id, name, description, join_code )")
      .eq("student_id", studentId);
    studentClasses = fallback.data ?? [];
  }
  ...
  const { data: classSimRows } = await supabase
    .from("class_simulations")
    .select("class_id, simulations ( is_published )")
    .in("class_id", classIds);

  for (const row of classSimRows ?? []) {
    const simRaw = row.simulations;
    const sim = Array.isArray(simRaw) ? simRaw[0] : simRaw;
    if (!sim?.is_published) continue;
    const classId = row.class_id as string;
    simCountByClass.set(classId, (simCountByClass.get(classId) ?? 0) + 1);
  }
```

Mapped fields returned to the UI: `classId`, `className` (`classes.name`), `description`, `cardImageUrl` (`card_image_url`), `cardColorScheme`, `simulationCount`. Default class is sorted first (`DEFAULT_CLASS_ID`).

**Completed attempts** (page-local query):

```34:41:app/student/dashboard/page.tsx
  const supabase = createServiceClient();
  const { data: completedAttempts } = await supabase
    .from("attempts")
    .select("id, total_score, completed_at, simulations ( id, title, persona_name )")
    .eq("student_id", session.studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);
```

**Join Class modal** (header, not page body): `POST /api/student/join-class` with `{ joinCode }` — see section 5.

---

## 3. Layout Structure

### Plain-language findings

**Chrome (layout shell, always on dashboard):**

1. **Header** (`StudentDashboardHeader`) — sticky top bar height `h-16`
   - Left: logo image + “Rehearse” wordmark → `/student/dashboard`
   - Right: Join a Class, Test shortcuts dropdown, display name + class-count subtitle + avatar initial (md+), Logout
2. **Sidebar** (`StudentSidebar`, `hidden md:flex`) — left column, collapsible 64 ↔ 72px
   - Collapse chevron
   - Primary nav: “My Classes” → `/student/dashboard`
   - “Enrolled” list of class links → `/student/classes/[classId]` (icons: `auto_awesome` for system default, `folder` otherwise)
   - Footer label “Student Portal”
3. **Main** — scrollable `children` = dashboard page content

**Main content order (`page.tsx`):**

1. Welcome heading: “Welcome back, {displayName}” + subtitle about class count / join prompt  
2. Either **EmptyState** (no classes) or **grid of `StudentClassCard`** (2 cols sm, 3 cols lg)  
3. **`StudentAttemptHistory`** — heading + table of completed sims, or empty copy in a card

**No page footer** beyond the sidebar’s “Student Portal” label.

Hardcoded vs dynamic:

- Hardcoded: section titles (“My completed simulations”), empty-state copy, nav labels, Test dropdown labels, Rehearse Essentials display name/description/banner when `isSystemDefault`
- Dynamic: display name, class list/appearance/counts, attempt rows/scores

### Evidence

Main structure:

```54:96:app/student/dashboard/page.tsx
  return (
    <div className="animate-fade-in-up">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Welcome back, {session.displayName}
            </h1>
            ...
          </div>
        </div>
        {enrolledClasses.length === 0 ? (
          <EmptyState ... />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledClasses.map((cls) => (
              <StudentClassCard ... />
            ))}
          </div>
        )}
        <StudentAttemptHistory attempts={history} />
```

---

## 4. Tempo-Specific vs. Generic Content

### Plain-language findings

**Generic (works for any enrolled class):**

- Class cards driven by `student_classes` / `classes` / published `class_simulations` counts  
- Attempt history for any completed attempt’s linked simulation  
- Join Class by code  
- Sidebar enrolled list  

**Special-cased to the system default class (“Rehearse Essentials”), not named “Tempo” in the card UI:**

- When `classId === DEFAULT_CLASS_ID`, the card uses fixed banner `DEFAULT_CLASS_BANNER_URL`, name `DEFAULT_CLASS_NAME`, description `DEFAULT_CLASS_DESCRIPTION`, black accent, and badge “Available to all students”  
- Sidebar forces label `DEFAULT_CLASS_NAME` and `auto_awesome` icon for that id  
- Default class is sorted first in `loadStudentEnrolledClasses`  

**Explicitly Tempo / Tempo-simulation hardcoded on this page’s chrome:**

- `TestShortcutsDropdown` is always wired with `TEMPO_SIMULATION_ID` and `DEFAULT_CLASS_ID` — stages/results are Tempo stage names; navigation targets the Tempo simulation under the default class only  

```57:61:components/student/StudentDashboardHeader.tsx
          <JoinClassButton />
          <TestShortcutsDropdown
            simulationId={TEMPO_SIMULATION_ID}
            classId={DEFAULT_CLASS_ID}
          />
```

**Not on this page:** `TempoSimulationEntryView` (Tempo entry briefing) — irrelevant to dashboard rendering.

**Implication for non-Tempo simulations:** Class listing and history are generic; the always-visible Test shortcuts menu and Rehearse Essentials card styling are product/system-default special cases. Future non-Tempo sims would appear via class enrollment + history like any other sim, but Test shortcuts would still only jump into Tempo unless changed.

### Evidence

System-default card branch:

```33:72:components/StudentClassCard.tsx
  const displayName = isSystemDefault ? DEFAULT_CLASS_NAME : className;
  ...
          isSystemDefault
            ? {
                background: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.2)), url(${DEFAULT_CLASS_BANNER_URL}) center/cover`,
              }
            : { ... }
  ...
        {isSystemDefault && (
          ...
            <span className="px-2 py-0.5 bg-accent/10 text-accent font-bold text-[10px] uppercase rounded">
              Available to all students
            </span>
```

Test dropdown Tempo stages:

```18:24:app/student/dashboard/TestShortcutsDropdown.tsx
const TEST_STAGES = [
  { id: "prospecting", label: "Stage 1 — Prospecting" },
  { id: "discovery", label: "Stage 2 — Discovery" },
  ...
] as const;
```

---

## 5. Interactive Elements

### Plain-language findings

| Control | Location | Behavior |
|---------|----------|----------|
| Logo / “Rehearse” | Header | `Link` → `/student/dashboard` |
| **Join a Class** | Header | Opens modal; submit → `POST /api/student/join-class` with `{ joinCode }`; on success toast + `router.refresh()` |
| Modal Cancel / close / backdrop | Join modal | Closes modal, clears code/error |
| **Test…** `<select>` | Header | Tempo-only: stages → full navigation to `/student/simulation/{TEMPO_ID}?classId={DEFAULT}&teststage=…` (clears prospecting/discovery localStorage for those stages); results/badges → `router.push` complete URL with `testresults` / `testbadges` |
| Display name / avatar | Header | Display only (not clickable) |
| **Logout** | Header | `POST /api/student/logout` then `router.push("/student-login")` + refresh |
| Sidebar collapse | Sidebar | Toggles width; persists `localStorage` key `rehearse-student-sidebar-collapsed` |
| **My Classes** | Sidebar | `Link` → `/student/dashboard` |
| Enrolled class row | Sidebar | `Link` → `/student/classes/{classId}` |
| **StudentClassCard** | Main | `Link` → `/student/classes/{classId}` |
| **View results** | History table | `Link` → `/student/simulation/{sim.id}/complete?attempt={row.id}` |

No other buttons on the main dashboard body.

### Evidence

Join Class API:

```34:51:app/student/dashboard/JoinClassButton.tsx
    const res = await fetch("/api/student/join-class", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
    });
    ...
    showToast(`Joined ${body.className ?? "class"}!`, "success");
    handleClose();
    router.refresh();
```

Logout:

```28:31:components/student/StudentDashboardHeader.tsx
  const handleLogout = async (): Promise<void> => {
    await fetch("/api/student/logout", { method: "POST" });
    router.push("/student-login");
    router.refresh();
  };
```

Test stage navigation:

```60:62:app/student/dashboard/TestShortcutsDropdown.tsx
          window.location.assign(
            `/student/simulation/${simulationId}?classId=${classId}&teststage=${stage}`
          );
```

---

## 6. Responsive / State Variations

### Plain-language findings

| State | How handled |
|-------|-------------|
| **Unauthenticated** | Layout and page both `redirect("/student-login")` if `getStudentSession()` is null |
| **Loading** | No dedicated loading UI on the dashboard page — Next.js server render blocks until session + queries resolve. No `loading.tsx` was found under `app/student/dashboard/` during this audit. |
| **Empty classes** | `EmptyState` with emoji 🎓, title “No classes yet.”, copy pointing to header Join a Class |
| **Populated classes** | Responsive grid `sm:grid-cols-2 lg:grid-cols-3` of cards |
| **Empty history** | Paragraph in `card-surface`: “No completed simulations yet…” |
| **Populated history** | Table (full width); not specially stacked for mobile in code — may scroll horizontally on narrow screens (not confirmed in browser) |
| **Sidebar** | Hidden below `md`; collapsible on desktop |
| **Header user block** | Name/avatar `hidden md:flex`; logo text `hidden sm:inline` |

Join modal has its own loading (“Joining…”) and error states.

### Evidence

Empty classes:

```72:77:app/student/dashboard/page.tsx
        {enrolledClasses.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="No classes yet."
            description="Use Join a Class in the header with your professor's class code to get started."
          />
```

Empty history:

```29:34:components/StudentAttemptHistory.tsx
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-text-secondary card-surface py-8 text-center mt-8">
        No completed simulations yet. Finish a scenario to see your scores here.
      </p>
```

---

## 7. Styling / Design Tokens Currently Used

### Plain-language findings

The page mixes **semantic design tokens** (likely from the app Tailwind theme / Stitch tokens) and a few **legacy token names** (`text-text-primary`, `border-border`, `bg-page`, `card-surface`, `text-accent`).

**Recurring tokens / classes:**

- Surfaces: `bg-surface`, `bg-surface-container-lowest`, `bg-surface-container-low`, `bg-surface-container`, `bg-surface-container-high`, `bg-surface-container-highest`, `card-surface`, `bg-page`
- Text: `text-primary`, `text-on-surface`, `text-on-surface-variant`, `text-text-primary`, `text-text-secondary`, `text-accent`, `text-error`, `text-white`, `text-secondary`, `text-on-primary-container`, `text-on-secondary-container`
- Borders: `border-outline-variant`, `border-border`
- Accents / chips: `bg-primary-container`, `bg-secondary-container`, `bg-secondary-fixed`, `bg-accent/10`, `text-accent`
- Typography utilities: `font-headline-lg`, `text-headline-lg`, `font-headline-md`, `text-headline-md`, `font-body-md`, `font-label-md`, `text-label-md`, `font-label-sm`, `text-label-sm`, `font-code-md`
- Layout: `max-w-[1280px]`, `px-4 sm:px-6`, `py-8`, `gap-4`, `grid sm:grid-cols-2 lg:grid-cols-3`, `h-16`, sidebar `w-64` / `w-[72px]`
- Motion: `animate-fade-in-up`, `animate-overlay-in`, `animate-modal-in`, `transition-shadow`, `active:scale-95`
- Cards: `rounded-xl`, `shadow-sm`, `hover:shadow-md`, `border-l-4` with inline `borderLeftColor` / gradient styles for class appearance
- Modal: `modal-overlay`, `z-50`, `rounded-xl shadow-xl`

System-default Essentials card uses hardcoded `#000000` for left border/score color and banner URL `/rehearse-essentials.png` via constants.

### Evidence (representative)

Shell / main:

```42:48:components/student/StudentPortalShell.tsx
      <div className="fixed inset-0 z-40 flex flex-col bg-surface overflow-hidden font-body-md text-body-md text-on-surface">
...
          <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface">{children}</main>
```

Header button tokens:

```73:77:components/student/StudentDashboardHeader.tsx
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="px-4 h-10 border border-outline-variant text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95"
```

History / legacy tokens:

```38:44:components/StudentAttemptHistory.tsx
    <div className="mt-10">
      <h2 className="text-lg font-bold text-text-primary">My completed simulations</h2>
      <p className="text-sm text-text-secondary mt-1">Review scores and feedback from past runs.</p>

      <div className="mt-4 card-surface overflow-hidden">
```

---

## Notes / Gaps

- Browser responsive behavior of the history **table** on small screens was not verified in a live browser for this audit — only CSS was inspected.
- Score denominator `/600` in history is hardcoded in the table cell (`StudentAttemptHistory.tsx` line 67); origin of the 600 scale is outside this page’s queries.
- Unauthenticated redirects still target `/student-login` (shim to unified `/login?role=student`); that is layout/page behavior, not dashboard UI content.
