/**
 * Sidebar.tsx
 * Professor portal shell — sidebar navigation, headers, and layout wrappers.
 * Used by teacher dashboard, class management, and simulation results pages.
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FadeIn } from "@/components/professor/FadeIn";
import { ProfessorEmptyState } from "@/components/professor/ProfessorEmptyState";
import { ProfessorButtonContent } from "@/components/professor/ProfessorSpinner";
import { ClassCardAppearanceEditor } from "@/components/professor/ClassCardAppearanceEditor";
import { CreateClassModalPanel } from "@/components/professor/CreateClassModalPanel";
import { ProfessorClassCard } from "@/components/professor/ProfessorClassCard";
import { ClassCardSkeleton } from "@/components/professor/skeletons/ClassCardSkeleton";
import type { ClassAppearanceStatus, ClassColorSchemeId } from "@/lib/class-appearance";
import { useToast } from "@/hooks/useToast";
import { SCORED_STAGES, STAGE_LABELS, STUDENT_JOIN_PATH } from "@/lib/constants";
import { downloadLeaderboardCsv, type CsvExportRow } from "@/lib/export-leaderboard-csv";
import { scoreToGrade } from "@/lib/grades";
import { formatRankDisplay } from "@/lib/leaderboard";
import { CHAT_SYSTEM_PROMPT } from "@/lib/persona";
import { stageScoreTone, toneTextClass } from "@/lib/score-display";
import { createClient } from "@/lib/supabase/client";
import type { Class, EnrolledStudent, LeaderboardEntry, Simulation, StageScore } from "@/types";

// ── Material Symbols ───────────────────────────────────────────────────────────

type MaterialIconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

/**
 * Renders a Google Material Symbols Outlined icon.
 */
export function MaterialIcon({
  name,
  className = "",
  filled = false,
}: MaterialIconProps): React.ReactElement {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}

// ── Sidebar collapse state ─────────────────────────────────────────────────────

const SIDEBAR_COLLAPSED_KEY = "pitchlab-professor-sidebar-collapsed";

type ProfessorShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const ProfessorShellContext = createContext<ProfessorShellContextValue | null>(null);

/**
 * Shares professor sidebar collapsed state across header and sidebar.
 */
export function ProfessorShellProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const toggleSidebar = useCallback((): void => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  return (
    <ProfessorShellContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
      {children}
    </ProfessorShellContext.Provider>
  );
}

function useProfessorShell(): ProfessorShellContextValue {
  const ctx = useContext(ProfessorShellContext);
  if (!ctx) {
    throw new Error("useProfessorShell must be used within ProfessorShellProvider");
  }
  return ctx;
}

// ── Navigation ─────────────────────────────────────────────────────────────────

export type ProfessorNavKey = "dashboard" | "classes" | "library" | "analytics";

type NavItem = {
  key: ProfessorNavKey;
  label: string;
  icon: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", href: "/teacher/dashboard" },
  { key: "classes", label: "My Classes", icon: "school", href: "/teacher/classes" },
  { key: "library", label: "Simulations", icon: "model_training", href: "/teacher/library" },
  { key: "analytics", label: "Analytics", icon: "analytics", href: "/teacher/analytics" },
];

const FOOTER_NAV = [
  { key: "settings", label: "Settings", icon: "settings", href: "/teacher/settings" },
  { key: "support", label: "Support", icon: "help", href: "/teacher/support" },
] as const;

/**
 * Maps the current pathname to the active professor nav item.
 */
export function resolveProfessorNav(pathname: string): ProfessorNavKey {
  if (pathname.startsWith("/teacher/classes")) return "classes";
  if (pathname.startsWith("/teacher/library") || pathname.startsWith("/teacher/simulation")) {
    return "library";
  }
  if (pathname.startsWith("/teacher/analytics")) return "analytics";
  return "dashboard";
}

type ProfessorSidebarProps = {
  activeNav?: ProfessorNavKey;
};

/**
 * Fixed left sidebar for the professor portal (256px).
 */
export function ProfessorSidebar({
  activeNav,
}: ProfessorSidebarProps): React.ReactElement {
  const pathname = usePathname();
  const resolvedNav = activeNav ?? resolveProfessorNav(pathname);
  const { sidebarCollapsed, toggleSidebar } = useProfessorShell();

  return (
    <aside
      className={`hidden md:flex flex-col h-full bg-surface-container-low border-r border-outline-variant shrink-0 transition-all duration-300 ease-in-out gap-2 ${
        sidebarCollapsed ? "w-[72px] p-2" : "w-64 p-4"
      }`}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all duration-200 h-8 ${
          sidebarCollapsed ? "justify-center w-full" : "justify-end px-1 w-full"
        }`}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <MaterialIcon name={sidebarCollapsed ? "chevron_right" : "chevron_left"} className="text-[20px]" />
      </button>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === resolvedNav;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center py-2 rounded-lg transition-all duration-200 ${
                sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[20px] shrink-0" />
              {!sidebarCollapsed && (
                <span className="font-label-sm text-label-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-outline-variant flex flex-col gap-1">
        {FOOTER_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center py-2 rounded-lg transition-all duration-200 ${
                sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[20px] shrink-0" />
              {!sidebarCollapsed && (
                <span className="font-label-sm text-label-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

// ── Logout ─────────────────────────────────────────────────────────────────────

/**
 * Signs the professor out and redirects to login.
 */
export function ProfessorLogoutButton({
  className = "",
}: {
  className?: string;
}): React.ReactElement {
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={className}
    >
      Logout
    </button>
  );
}

// ── Dashboard header ───────────────────────────────────────────────────────────

type ProfessorDashboardHeaderProps = {
  userName: string;
};

/**
 * Top app bar for the professor dashboard (Stitch layout).
 */
export function ProfessorDashboardHeader({
  userName,
}: ProfessorDashboardHeaderProps): React.ReactElement {
  return (
    <header className="bg-surface border-b border-outline-variant sticky top-0 z-50">
      <div className="flex justify-between items-center w-full pl-4 pr-4 sm:pl-6 sm:pr-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/teacher/dashboard" className="flex items-center gap-2 font-headline-lg text-headline-lg font-bold text-primary">
            <img src="/pitchlab-logo-new.png" alt="Rehearse logo" className="h-[1.5em] w-auto shrink-0" />
            Rehearse
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 pr-4 border-r border-outline-variant">
            <div className="text-right">
              <p className="font-label-md text-label-md font-bold text-primary">{userName}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Professor</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
          <ProfessorLogoutButton className="px-4 py-2 border border-outline text-primary font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95" />
        </div>
      </div>
    </header>
  );
}

// ── Portal layout ──────────────────────────────────────────────────────────────

type ProfessorPortalLayoutProps = {
  userName: string;
  activeNav?: ProfessorNavKey;
  children: React.ReactNode;
  showSidebar?: boolean;
};

/**
 * Full-viewport professor shell with optional sidebar and dashboard header.
 */
export function ProfessorPortalLayout({
  userName,
  activeNav,
  children,
  showSidebar = true,
}: ProfessorPortalLayoutProps): React.ReactElement {
  const pathname = usePathname();
  const resolvedNav = activeNav ?? resolveProfessorNav(pathname);

  return (
    <ProfessorShellProvider>
      <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden font-body-md text-body-md text-on-surface">
        <ProfessorDashboardHeader userName={userName} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {showSidebar && <ProfessorSidebar activeNav={resolvedNav} />}
          <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface-bright">
            {children}
          </main>
        </div>
      </div>
    </ProfessorShellProvider>
  );
}

// ── Dashboard view ─────────────────────────────────────────────────────────────

type ClassWithCounts = Class & {
  student_count: number;
  simulation_count: number;
};

type SimulationStats = {
  attempted: number;
  completed: number;
  avgPercent: number | null;
};

type ProfessorDashboardViewProps = {
  userName: string;
  initialSimulations: Simulation[];
  simulationStats: Record<string, SimulationStats>;
};

/**
 * Interactive professor dashboard — classes, simulations, and create-class modal.
 */
export function ProfessorDashboardView({
  userName,
  initialSimulations,
  simulationStats,
}: ProfessorDashboardViewProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<ClassWithCounts[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [simulations, setSimulations] = useState(initialSimulations);
  const [deleteTarget, setDeleteTarget] = useState<Simulation | null>(null);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadClasses = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/professor/classes");
    if (!res.ok) {
      setIsLoadingClasses(false);
      return;
    }
    const body = (await res.json()) as { classes: ClassWithCounts[] };
    setClasses(body.classes ?? []);
    setIsLoadingClasses(false);
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const joinUrl = (): string => {
    if (typeof window === "undefined") return STUDENT_JOIN_PATH;
    return `${window.location.origin}${STUDENT_JOIN_PATH}`;
  };

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`, "success");
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  };

  const handleCreateClass = async (
    e: React.FormEvent,
    colorScheme: ClassColorSchemeId
  ): Promise<void> => {
    e.preventDefault();
    setIsCreating(true);
    const res = await fetch("/api/professor/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, cardColorScheme: colorScheme }),
    });
    setIsCreating(false);

    if (!res.ok) {
      showToast("Could not create class", "error");
      return;
    }

    setShowModal(false);
    setName("");
    setDescription("");
    showToast("Class created successfully", "success");
    await loadClasses();
    router.refresh();
  };

  const handleTogglePublish = async (sim: Simulation): Promise<void> => {
    setIsBusy(sim.id);
    const supabase = createClient();
    const nextPublished = !sim.is_published;
    const { error } = await supabase
      .from("simulations")
      .update({ is_published: nextPublished })
      .eq("id", sim.id);

    setIsBusy(null);
    if (error) {
      showToast("Something went wrong. Please try again.", "error");
      return;
    }

    setSimulations((prev) =>
      prev.map((s) => (s.id === sim.id ? { ...s, is_published: nextPublished } : s))
    );
    showToast(
      nextPublished
        ? "Simulation published — students can now see it"
        : "Simulation unpublished",
      "success"
    );
    router.refresh();
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;

    if (deleteTarget.is_published) {
      showToast("Unpublish this simulation before deleting it", "error");
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    setIsBusy(deleteTarget.id);
    const supabase = createClient();
    const { error } = await supabase.from("simulations").delete().eq("id", deleteTarget.id);
    setIsBusy(null);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (error) {
      showToast("Something went wrong. Please try again.", "error");
      return;
    }

    setSimulations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    showToast("Simulation deleted", "success");
    router.refresh();
  };

  const openCreateModal = (): void => setShowModal(true);

  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg space-y-xl">
        {/* ── Welcome ─── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display text-primary">Professor Dashboard</h1>
            <p className="text-on-surface-variant mt-1">
              Manage your curriculum and monitor student progress across your active classes.
            </p>
          </div>
        </section>

        {/* ── My Classes ─── */}
        <section className="space-y-lg">
          <div className="flex items-center justify-between border-b border-outline-variant pb-md">
            <Link href="/teacher/classes" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <MaterialIcon name="school" className="text-primary" />
              <h2 className="font-headline-md text-headline-md text-primary">My Classes</h2>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/classes"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 h-10 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container-high hover:border-outline transition-all duration-150 active:scale-95"
              >
                View all
                <MaterialIcon name="arrow_forward" className="text-[16px]" />
              </Link>
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 px-md py-2.5 bg-primary-container text-white rounded-lg hover:opacity-90 transition-all font-label-md active:scale-95"
              >
                <MaterialIcon name="add" />
                Create New Class
              </button>
            </div>
          </div>

          {isLoadingClasses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              <ClassCardSkeleton delay={1} />
              <ClassCardSkeleton delay={2} />
              <ClassCardSkeleton delay={3} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {classes.map((classRow, index) => (
                <FadeIn
                  key={classRow.id}
                  delay={(Math.min(index, 3) as 0 | 1 | 2 | 3)}
                  className="h-full"
                >
                  <ProfessorClassCard
                    classId={classRow.id}
                    className={classRow.name}
                    description={classRow.description}
                    joinCode={classRow.join_code}
                    cardImageUrl={classRow.card_image_url}
                    cardColorScheme={classRow.card_color_scheme}
                    simulationCount={classRow.simulation_count}
                    onCopyJoinCode={() => void copyToClipboard(classRow.join_code, "Join code")}
                    onCopyJoinLink={() => void copyToClipboard(joinUrl(), "Join link")}
                  />
                </FadeIn>
              ))}

              <button
                type="button"
                onClick={openCreateModal}
                className="bg-surface-container-low border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-xl text-center hover:bg-surface-container-high transition-colors duration-150 cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-md group-hover:scale-110 transition-transform duration-200">
                  <MaterialIcon name="add_box" className="text-[32px] text-primary" />
                </div>
                <p className="font-headline-md text-headline-md text-primary">Add a Class</p>
                <p className="text-on-surface-variant text-body-md max-w-[200px]">
                  Create a new class to start tracking simulation performance.
                </p>
              </button>
            </div>
          )}
        </section>

        {/* ── My Simulations ─── */}
        <section className="space-y-lg">
          <div className="flex items-center justify-between border-b border-outline-variant pb-md">
            <Link href="/teacher/library" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <MaterialIcon name="model_training" className="text-primary" />
              <h2 className="font-headline-md text-headline-md text-primary">My Simulations</h2>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/library"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 h-10 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container-high hover:border-outline transition-all duration-150 active:scale-95"
              >
                View all
                <MaterialIcon name="arrow_forward" className="text-[16px]" />
              </Link>
              <Link
                href="/teacher/simulation/new"
                className="flex items-center gap-2 px-md py-2.5 border-2 border-primary text-primary rounded-lg hover:bg-primary-container hover:text-white transition-all font-label-md active:scale-95"
              >
                <MaterialIcon name="rocket_launch" />
                Create New Simulation
              </Link>
            </div>
          </div>

          {simulations.length === 0 ? (
            <ProfessorEmptyState
              icon="model_training"
              heading="My Simulations"
              description="No simulations yet. Design your first pitch scenario."
              action={
                <Link
                  href="/teacher/simulation/new"
                  className="bg-primary-container text-white font-bold rounded-lg px-6 h-10 flex items-center gap-2 hover:opacity-90 transition-opacity duration-150"
                >
                  <MaterialIcon name="bolt" className="text-[20px]" />
                  Create Simulation
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Persona
                    </th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Students Attempted
                    </th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Avg Score
                    </th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {simulations.map((sim) => {
                    const stats = simulationStats[sim.id];
                    const avgPct = stats?.avgPercent;
                    return (
                      <tr key={sim.id} className="hover:bg-secondary-fixed/10 transition-colors duration-150">
                        <td className="px-lg py-md">
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">{sim.title}</span>
                            {sim.description && (
                              <span className="text-label-sm text-on-surface-variant line-clamp-1">
                                {sim.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-lg py-md text-body-md">{sim.persona_name}</td>
                        <td className="px-lg py-md">
                          <span
                            className={`px-2 py-0.5 font-bold text-[10px] uppercase rounded ${
                              sim.is_published
                                ? "bg-tertiary-fixed text-on-tertiary-fixed"
                                : "bg-surface-container-highest text-on-surface-variant"
                            }`}
                          >
                            {sim.is_published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="px-lg py-md text-body-md">
                          {stats ? `${stats.completed} / ${stats.attempted}` : "0 / 0"}
                        </td>
                        <td className="px-lg py-md">
                          {avgPct != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-secondary"
                                  style={{ width: `${avgPct}%` }}
                                />
                              </div>
                              <span className="font-code-md text-code-md">{avgPct}%</span>
                            </div>
                          ) : (
                            <span className="text-on-surface-variant">--</span>
                          )}
                        </td>
                        <td className="px-lg py-md text-right">
                          <div className="flex items-center justify-end gap-2 text-on-surface-variant">
                            <Link
                              href={`/teacher/simulation/${sim.id}/edit`}
                              className="p-2 hover:bg-surface-container hover:text-primary rounded"
                              title="Edit"
                            >
                              <MaterialIcon name="edit" className="text-[20px]" />
                            </Link>
                            <Link
                              href={`/teacher/simulation/${sim.id}/results`}
                              className="p-2 hover:bg-surface-container hover:text-primary rounded"
                              title="Results"
                            >
                              <MaterialIcon name="bar_chart" className="text-[20px]" />
                            </Link>
                            <button
                              type="button"
                              disabled={isBusy === sim.id}
                              onClick={() => void handleTogglePublish(sim)}
                              className="p-2 hover:bg-surface-container hover:text-primary rounded disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                              title={sim.is_published ? "Unpublish" : "Publish"}
                            >
                              {isBusy === sim.id ? (
                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <MaterialIcon
                                  name={sim.is_published ? "toggle_on" : "toggle_off"}
                                  className="text-[20px]"
                                />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy === sim.id}
                              onClick={() => setDeleteTarget(sim)}
                              className="p-2 hover:bg-error-container hover:text-error rounded"
                              title="Delete"
                            >
                              <MaterialIcon name="delete" className="text-[20px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </FadeIn>

      {deleteTarget && (
        <ConfirmModal
          title="Delete simulation?"
          message="Are you sure you want to delete this simulation? This cannot be undone."
          confirmLabel="Delete"
          isDestructive
          isConfirming={isDeleting}
          confirmingLabel="Deleting..."
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <CreateClassModalPanel
        open={showModal}
        name={name}
        description={description}
        isCreating={isCreating}
        onClose={() => setShowModal(false)}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSubmit={(e, colorScheme) => void handleCreateClass(e, colorScheme)}
      />
    </ProfessorPortalLayout>
  );
}

// ── Class management view ──────────────────────────────────────────────────────

type AssignedSimulation = {
  id: string;
  simulation_id: string;
  added_at: string;
  simulations: Simulation | Simulation[] | null;
};

type ProfessorClassManagementViewProps = {
  userName: string;
  className: string;
  classDescription: string | null;
  classId: string;
  joinCode: string;
  cardImageUrl: string | null;
  cardColorScheme: ClassColorSchemeId;
  appearanceStatus: ClassAppearanceStatus;
  initialStudents: EnrolledStudent[];
  initialAssignments: AssignedSimulation[];
  professorSimulations: Simulation[];
  simulationStats: Record<string, SimulationStats>;
};

/**
 * Manage class page — share links, students table, assigned simulations.
 */
export function ProfessorClassManagementView({
  userName,
  className,
  classDescription,
  classId,
  joinCode,
  cardImageUrl,
  cardColorScheme,
  appearanceStatus,
  initialStudents,
  initialAssignments,
  professorSimulations,
  simulationStats,
}: ProfessorClassManagementViewProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [students, setStudents] = useState(initialStudents);
  const [selectedSimId, setSelectedSimId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingSimId, setRemovingSimId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<EnrolledStudent | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.simulation_id));
  const availableSims = professorSimulations.filter((s) => !assignedIds.has(s.id));

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${STUDENT_JOIN_PATH}`
      : STUDENT_JOIN_PATH;

  const copyText = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`, "success");
    } catch {
      showToast("Could not copy", "error");
    }
  };

  const resolveSim = (row: AssignedSimulation): Simulation | null => {
    const sim = row.simulations;
    return Array.isArray(sim) ? sim[0] ?? null : sim;
  };

  const handleAdd = async (): Promise<void> => {
    if (!selectedSimId) return;
    if (assignedIds.has(selectedSimId)) {
      showToast("Simulation already assigned to this class", "error");
      setSelectedSimId("");
      return;
    }

    const sim = professorSimulations.find((s) => s.id === selectedSimId);
    if (!sim) return;

    setIsAdding(true);
    const res = await fetch(`/api/professor/classes/${classId}/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId: selectedSimId }),
    });
    setIsAdding(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(
        res.status === 409
          ? "Simulation already assigned to this class"
          : body.error ?? "Could not assign simulation",
        "error"
      );
      return;
    }

    const body = (await res.json()) as {
      classSimulation: { id: string; simulation_id: string; added_at: string };
    };
    setAssignments((prev) => [
      {
        id: body.classSimulation.id,
        simulation_id: selectedSimId,
        added_at: body.classSimulation.added_at,
        simulations: sim,
      },
      ...prev,
    ]);
    showToast("Simulation added to class", "success");
    setSelectedSimId("");
    router.refresh();
  };

  const handleConfirmRemoveStudent = async (): Promise<void> => {
    if (!removeStudentTarget) return;
    const studentId = removeStudentTarget.id;
    setRemovingStudentId(studentId);
    const res = await fetch(`/api/professor/classes/${classId}/students`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setRemovingStudentId(null);
    setRemoveStudentTarget(null);

    if (!res.ok) {
      showToast("Could not remove student", "error");
      return;
    }

    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    showToast("Student removed from class", "success");
    router.refresh();
  };

  const handleRemove = async (simulationId: string): Promise<void> => {
    setRemovingSimId(simulationId);
    const res = await fetch(`/api/professor/classes/${classId}/simulations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
    setRemovingSimId(null);

    if (!res.ok) {
      showToast("Could not remove simulation", "error");
      return;
    }

    setAssignments((prev) => prev.filter((a) => a.simulation_id !== simulationId));
    showToast("Simulation removed from class", "success");
    router.refresh();
  };

  const displayedStudents = showAllStudents ? students : students.slice(0, 4);

  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-8">
        <div className="mb-6">
          <BackButton
            label="Back"
            useHistory
            fallbackHref="/teacher/classes"
            materialIcon
            className="group inline-flex items-center gap-2 text-secondary font-label-sm hover:underline mb-0 transition-colors"
          />
        </div>

        <div className="mb-10">
          <h1 className="font-headline-lg text-headline-lg text-primary-container mb-1">{className}</h1>
          {classDescription && (
            <p className="font-body-md text-on-surface-variant">{classDescription}</p>
          )}
        </div>

        <div className="flex flex-col gap-8">
            <section className="bg-secondary-fixed/30 border border-secondary-fixed rounded-xl p-lg">
              <div className="flex items-center gap-2 mb-6 text-on-secondary-fixed-variant">
                <MaterialIcon name="share" />
                <h2 className="font-headline-md text-headline-md">Share with Students</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-label-sm text-on-surface-variant block mb-2">Join Link</label>
                  <div className="flex gap-2">
                    <div className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 font-code-md flex items-center overflow-hidden">
                      <span className="truncate">{joinUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(joinUrl, "Join link")}
                      className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
                    >
                      <MaterialIcon name="content_copy" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-label-sm text-on-surface-variant block mb-2">Class Code</label>
                  <div className="flex gap-2">
                    <div className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 font-code-lg flex items-center justify-center tracking-[0.2em] uppercase">
                      {joinCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(joinCode, "Class code")}
                      className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
                    >
                      <MaterialIcon name="content_copy" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <ClassCardAppearanceEditor
              classId={classId}
              className={className}
              classDescription={classDescription}
              initialImageUrl={cardImageUrl}
              initialColorScheme={cardColorScheme}
              appearanceStatus={appearanceStatus}
              simulationCount={assignments.length}
            />

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-white">
                <h2 className="font-headline-md text-headline-md text-primary-container">
                  Enrolled Students ({students.length})
                </h2>
                <MaterialIcon name="download" className="text-on-surface-variant" />
              </div>
              {students.length === 0 ? (
                <ProfessorEmptyState
                  icon="group_off"
                  heading="No students have joined yet"
                  description="Share your class code with students to start tracking progress."
                  action={
                    <button
                      type="button"
                      onClick={() => void copyText(joinCode, "Join code")}
                      className="bg-primary-container text-white font-bold rounded-lg px-6 h-10 flex items-center gap-2 hover:opacity-90 transition-opacity duration-150"
                    >
                      <MaterialIcon name="content_copy" className="text-[18px]" />
                      Copy Join Code
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container-low border-b border-outline-variant">
                        <tr>
                          <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase tracking-wider">
                            Username
                          </th>
                          <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase tracking-wider">
                            Display Name
                          </th>
                          <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase tracking-wider">
                            Joined Date
                          </th>
                          <th className="px-lg py-3 font-label-sm text-on-surface-variant text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {displayedStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-secondary-fixed/10 transition-colors duration-150">
                            <td className="px-lg py-4 font-body-md text-on-surface font-medium">
                              {student.username}
                            </td>
                            <td className="px-lg py-4 font-body-md text-on-surface-variant">
                              {student.displayName}
                            </td>
                            <td className="px-lg py-4 font-body-md text-on-surface-variant">
                              {new Date(student.joinedAt).toLocaleDateString()}
                            </td>
                            <td className="px-lg py-4 text-right">
                              <button
                                type="button"
                                disabled={removingStudentId !== null}
                                onClick={() => setRemoveStudentTarget(student)}
                                className="inline-flex items-center gap-1 text-error font-label-sm font-semibold hover:bg-error-container/20 px-2 py-1 rounded transition-colors duration-150 disabled:opacity-50"
                              >
                                <MaterialIcon name="person_remove" className="text-[16px]" />
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {students.length > 4 && (
                    <div className="p-4 text-center border-t border-outline-variant">
                      <button
                        type="button"
                        onClick={() => setShowAllStudents(!showAllStudents)}
                        className="font-label-md text-secondary hover:underline"
                      >
                        {showAllStudents
                          ? "Show fewer"
                          : `View All ${students.length} Students`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-headline-md text-headline-md text-primary-container shrink-0">
                  Assigned Simulations
                </h2>
                <div className="flex gap-2 items-center w-full sm:w-auto sm:min-w-[280px]">
                  <select
                    className="flex-1 sm:min-w-[180px] bg-white border border-outline-variant rounded-lg px-3 h-10 font-body-md focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-150"
                    value={selectedSimId}
                    onChange={(e) => setSelectedSimId(e.target.value)}
                    disabled={isAdding || removingSimId !== null || availableSims.length === 0}
                    aria-label="Select simulation to add"
                  >
                    <option value="">Add simulation...</option>
                    {availableSims.map((sim) => (
                      <option key={sim.id} value={sim.id}>
                        {sim.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSimId || isAdding || removingSimId !== null}
                    onClick={() => void handleAdd()}
                    className={`bg-primary-container text-white px-4 h-10 rounded-lg font-label-md hover:opacity-90 active:scale-95 transition-all duration-150 min-w-[88px] shrink-0 ${
                      isAdding || removingSimId !== null ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    <ProfessorButtonContent isLoading={isAdding} loadingText="Adding...">
                      Add
                    </ProfessorButtonContent>
                  </button>
                </div>
              </div>
              {assignments.length === 0 ? (
                <p className="p-lg text-on-surface-variant font-body-md">No simulations assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          Persona
                        </th>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          Students Attempted
                        </th>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          Avg Score
                        </th>
                        <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {assignments.map((row) => {
                        const sim = resolveSim(row);
                        if (!sim) return null;
                        const stats = simulationStats[sim.id];
                        const avgPct = stats?.avgPercent;
                        const isRemoving = removingSimId === row.simulation_id;
                        const actionsDisabled = isAdding || removingSimId !== null;
                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-secondary-fixed/10 transition-colors duration-150"
                          >
                            <td className="px-lg py-md">
                              <div className="flex flex-col">
                                <span className="font-bold text-primary">{sim.title}</span>
                                {sim.description && (
                                  <span className="text-label-sm text-on-surface-variant line-clamp-1">
                                    {sim.description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-lg py-md text-body-md">{sim.persona_name}</td>
                            <td className="px-lg py-md">
                              <span
                                className={`px-2 py-0.5 font-bold text-[10px] uppercase rounded ${
                                  sim.is_published
                                    ? "bg-tertiary-fixed text-on-tertiary-fixed"
                                    : "bg-surface-container-highest text-on-surface-variant"
                                }`}
                              >
                                {sim.is_published ? "Published" : "Draft"}
                              </span>
                            </td>
                            <td className="px-lg py-md text-body-md">
                              {stats ? `${stats.completed} / ${stats.attempted}` : "0 / 0"}
                            </td>
                            <td className="px-lg py-md">
                              {avgPct != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-secondary"
                                      style={{ width: `${avgPct}%` }}
                                    />
                                  </div>
                                  <span className="font-code-md text-code-md">{avgPct}%</span>
                                </div>
                              ) : (
                                <span className="text-on-surface-variant">--</span>
                              )}
                            </td>
                            <td className="px-lg py-md text-right">
                              <div className="flex items-center justify-end gap-2 text-on-surface-variant">
                                <Link
                                  href={`/teacher/simulation/${sim.id}/edit`}
                                  className="p-2 hover:bg-surface-container hover:text-primary rounded"
                                  title="Edit"
                                >
                                  <MaterialIcon name="edit" className="text-[20px]" />
                                </Link>
                                <Link
                                  href={`/teacher/simulation/${sim.id}/results`}
                                  className="p-2 hover:bg-surface-container hover:text-primary rounded"
                                  title="Results"
                                >
                                  <MaterialIcon name="bar_chart" className="text-[20px]" />
                                </Link>
                                <button
                                  type="button"
                                  disabled={actionsDisabled}
                                  onClick={() => void handleRemove(row.simulation_id)}
                                  className="p-2 text-error hover:bg-error-container/20 rounded disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  {isRemoving ? (
                                    <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <MaterialIcon name="close" className="text-[20px]" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
        </div>

        {removeStudentTarget && (
          <ConfirmModal
            title="Remove student from class?"
            message={`Remove ${removeStudentTarget.displayName} (@${removeStudentTarget.username}) from this class? They can re-join with the class code.`}
            confirmLabel="Remove"
            isDestructive
            isConfirming={removingStudentId === removeStudentTarget.id}
            confirmingLabel="Removing..."
            onConfirm={() => void handleConfirmRemoveStudent()}
            onCancel={() => setRemoveStudentTarget(null)}
          />
        )}
      </FadeIn>
    </ProfessorPortalLayout>
  );
}

// ── Simulation form view ─────────────────────────────────────────────────────

type ProfessorSimulationFormViewProps = {
  userName: string;
  teacherId: string;
  initial?: Simulation;
  pageTitle: string;
};

/**
 * Create / edit simulation form with live student preview (Stitch layout).
 */
export function ProfessorSimulationFormView({
  userName,
  teacherId,
  initial,
  pageTitle,
}: ProfessorSimulationFormViewProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [personaName, setPersonaName] = useState(initial?.persona_name ?? "");
  const [personaRole, setPersonaRole] = useState(initial?.persona_role ?? "");
  const [personaPrompt, setPersonaPrompt] = useState(
    initial?.persona_system_prompt ?? CHAT_SYSTEM_PROMPT
  );
  const [productContext, setProductContext] = useState(initial?.product_context ?? "");
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saveMode, setSaveMode] = useState<"draft" | "publish" | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = (): void => setIsDirty(true);

  const handleSave = async (mode: "draft" | "publish"): Promise<void> => {
    setSaveMode(mode);
    setIsLoading(true);
    setError("");

    if (!title || !personaName || !personaRole || !personaPrompt || !productContext) {
      setError("Please fill in all required fields.");
      setIsLoading(false);
      setSaveMode(null);
      return;
    }

    const payload = {
      teacher_id: teacherId,
      title,
      description: description || null,
      persona_name: personaName,
      persona_role: personaRole,
      persona_system_prompt: personaPrompt,
      product_context: productContext,
      is_published: initial?.is_published ?? false,
    };

    const supabase = createClient();

    if (initial) {
      const { error: updateError } = await supabase
        .from("simulations")
        .update(payload)
        .eq("id", initial.id);
      if (updateError) {
        setError(updateError.message);
        showToast("Something went wrong. Please try again.", "error");
        setIsLoading(false);
        setSaveMode(null);
        return;
      }
      showToast("Simulation saved", "success");
      router.push(`/teacher/simulation/${initial.id}/edit`);
    } else {
      const { data, error: insertError } = await supabase
        .from("simulations")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        showToast("Something went wrong. Please try again.", "error");
        setIsLoading(false);
        setSaveMode(null);
        return;
      }
      showToast("Simulation saved", "success");
      router.push(`/teacher/simulation/${data.id}/edit`);
    }
    setIsDirty(false);
    router.refresh();
    setIsLoading(false);
    setSaveMode(null);
  };

  const inputClass =
    "w-full h-10 px-4 border border-outline-variant rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-150 font-body-md text-body-md";
  const textareaClass =
    "w-full p-4 border border-outline-variant rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-150 font-body-md resize-none";

  return (
    <ProfessorPortalLayout userName={userName} activeNav="library">
      <div className="flex min-h-full flex-col">
        <FadeIn className="max-w-container-max mx-auto flex-1 px-margin-desktop py-lg pb-28 w-full">
        <div className="mb-6">
          <BackButton
            label="Back"
            useHistory
            fallbackHref="/teacher/library"
            materialIcon
            className="group inline-flex items-center gap-2 text-secondary font-label-sm hover:underline mb-4 transition-colors"
          />
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">{pageTitle}</h1>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-gutter items-start">
            <div className="lg:col-span-6 flex flex-col gap-lg">
              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-sm">
                <div className="flex items-center gap-2 mb-md">
                  <MaterialIcon name="info" className="text-primary-container" />
                  <h2 className="font-headline-md text-headline-md text-primary">Basic Info</h2>
                </div>
                <div className="flex flex-col gap-md">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-on-surface-variant">Simulation Title</label>
                    <input
                      className={inputClass}
                      placeholder="e.g., Enterprise SaaS Series A Pitch"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-on-surface-variant">Description</label>
                    <textarea
                      className={textareaClass}
                      rows={3}
                      placeholder="Describe the learning objectives and the context for the students."
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-sm">
                <div className="flex items-center gap-2 mb-md">
                  <MaterialIcon name="person_apron" className="text-primary-container" />
                  <h2 className="font-headline-md text-headline-md text-primary">Persona</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-md">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-on-surface-variant">Persona Name</label>
                    <input
                      className={inputClass}
                      value={personaName}
                      onChange={(e) => {
                        setPersonaName(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-on-surface-variant">Role</label>
                    <input
                      className={inputClass}
                      value={personaRole}
                      onChange={(e) => {
                        setPersonaRole(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-xs mb-md">
                  <label className="font-label-md text-on-surface-variant">System Prompt</label>
                  <textarea
                    className={`${textareaClass} bg-surface-container-low font-code-md`}
                    rows={6}
                    value={personaPrompt}
                    onChange={(e) => {
                      setPersonaPrompt(e.target.value);
                      markDirty();
                    }}
                  />
                  <span className="text-xs text-on-surface-variant text-right">
                    {personaPrompt.length} characters
                  </span>
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-sm">
                <div className="flex items-center gap-2 mb-md">
                  <MaterialIcon name="lightbulb" className="text-primary-container" />
                  <h2 className="font-headline-md text-headline-md text-primary">Scenario</h2>
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-on-surface-variant">Product Context</label>
                  <textarea
                    className={textareaClass}
                    rows={4}
                    placeholder="What the student is selling and session constraints"
                    value={productContext}
                    onChange={(e) => {
                      setProductContext(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h2 className="font-headline-md text-headline-md text-primary">Publishing</h2>
                    <p className="font-body-md text-on-surface-variant">
                      Make this simulation available to students immediately.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isPublished}
                      onChange={(e) => {
                        setIsPublished(e.target.checked);
                        markDirty();
                      }}
                    />
                    <div className="relative w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-secondary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </label>
                </div>
              </section>

              {error && (
                <p className="text-sm text-error border border-error/30 bg-error-container rounded-md p-3">
                  {error}
                </p>
              )}
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="flex flex-col gap-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider">
                    Student Preview
                  </h3>
                  <span
                    className={`flex items-center gap-1 font-label-sm ${
                      isPublished ? "text-secondary" : "text-on-surface-variant"
                    }`}
                  >
                    <MaterialIcon
                      name={isPublished ? "visibility" : "visibility_off"}
                      className="text-[14px]"
                    />
                    {isPublished ? "Live" : "Draft"}
                  </span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-md">
                  <div className="h-48 bg-primary-container relative flex items-end p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center font-bold text-primary">
                        {personaName.charAt(0) || "?"}
                      </div>
                      <div className="text-white">
                        <p className="font-bold text-headline-md">{personaName || "Persona Name"}</p>
                        <p className="font-label-sm opacity-80">{personaRole || "Role"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-lg flex flex-col gap-md">
                    <div>
                      <h4 className="font-headline-md text-primary">{title || "Untitled Simulation"}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <MaterialIcon name="business_center" className="text-secondary text-[16px]" />
                        <span className="font-label-sm text-on-surface-variant line-clamp-1">
                          {productContext.slice(0, 40) || "Product context"}
                        </span>
                      </div>
                    </div>
                    <p className="text-body-md text-on-surface-variant line-clamp-3">
                      {description || "Simulation description will appear here."}
                    </p>
                    <button
                      type="button"
                      className="w-full h-12 bg-primary-container text-white rounded-lg font-bold flex items-center justify-center gap-2"
                    >
                      Start Simulation
                      <MaterialIcon name="play_arrow" />
                    </button>
                  </div>
                </div>
                <div className="bg-secondary-container/10 border border-secondary-container/20 rounded-lg p-md">
                  <div className="flex items-start gap-3">
                    <MaterialIcon name="tips_and_updates" className="text-secondary" />
                    <div>
                      <h5 className="font-label-md text-secondary font-bold">Pro-Tip</h5>
                      <p className="text-body-md text-on-secondary-container">
                        Use specific System Prompts to trigger different student behaviors.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        </FadeIn>

      <footer className="sticky bottom-0 bg-surface border-t border-outline-variant z-10">
        <div className="max-w-container-max mx-auto px-margin-desktop py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDirty && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-error-container text-on-error-container rounded-full animate-pulse">
                <MaterialIcon name="warning" className="text-[14px]" />
                <span className="font-label-sm">Unsaved changes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-base">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleSave("draft")}
              className={`px-lg h-10 border border-outline-variant text-primary font-bold rounded-lg hover:bg-surface-container-high transition-all duration-150 active:scale-95 ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <ProfessorButtonContent
                isLoading={isLoading && saveMode === "draft"}
                loadingText="Saving..."
              >
                Save Draft
              </ProfessorButtonContent>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleSave("publish")}
              className={`px-lg h-10 bg-primary-container text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all duration-150 ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <ProfessorButtonContent
                isLoading={isLoading && saveMode === "publish"}
                loadingText="Publishing..."
              >
                Save & Publish
              </ProfessorButtonContent>
            </button>
          </div>
        </div>
      </footer>
      </div>
    </ProfessorPortalLayout>
  );
}

// ── Simulation results view ────────────────────────────────────────────────────

type AttemptRow = {
  id: string;
  student_id: string;
  total_score: number;
  status: string;
  started_at: string;
  profiles?: { full_name: string } | null;
  students?: { display_name: string } | { display_name: string }[] | null;
  stage_scores: StageScore[];
};

type ProfessorResultsViewProps = {
  userName: string;
  simulationTitle: string;
  simulationSubtitle: string;
  attempts: AttemptRow[];
  leaderboard: LeaderboardEntry[];
  stageScoresByAttempt: Record<string, StageScore[]>;
};

function resolveStudentName(row: AttemptRow): string {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  if (student?.display_name?.trim()) return student.display_name.trim();
  return row.profiles?.full_name ?? "—";
}

function studentInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function gradeCircleClass(grade: string): string {
  if (grade === "A") return "bg-tertiary-fixed text-on-tertiary-fixed";
  if (grade === "B") return "bg-secondary-fixed text-on-secondary-fixed";
  return "bg-surface-container text-on-surface-variant";
}

/**
 * Simulation results — student attempts table and leaderboard (Stitch layout).
 */
export function ProfessorResultsView({
  userName,
  simulationTitle,
  simulationSubtitle,
  attempts,
  leaderboard,
  stageScoresByAttempt,
}: ProfessorResultsViewProps): React.ReactElement {
  const [tab, setTab] = useState<"attempts" | "leaderboard">("attempts");
  const [expanded, setExpanded] = useState<string | null>(null);

  const csvRows: CsvExportRow[] = leaderboard.map((e) => ({
    ...e,
    stage_scores: stageScoresByAttempt[e.attempt_id] ?? [],
  }));

  const handleExport = (): void => {
    downloadLeaderboardCsv(csvRows);
  };

  const toggleDetails = (rowId: string): void => {
    setExpanded(expanded === rowId ? null : rowId);
  };

  return (
    <ProfessorPortalLayout userName={userName} activeNav="library">
        <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-lg">
            <div className="flex items-start gap-4">
              <BackButton
                label="Back"
                useHistory
                fallbackHref="/teacher/library"
                materialIcon
                iconOnly
                className="mt-1"
              />
              <div>
                <h1 className="font-headline-lg text-headline-lg text-primary">{simulationTitle}</h1>
                <p className="font-body-md text-on-surface-variant">{simulationSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-surface border border-outline rounded-lg hover:bg-surface-container-high flex items-center gap-2 font-label-md shrink-0"
            >
              <MaterialIcon name="download" className="text-[18px]" />
              Export CSV
            </button>
          </div>
          <div className="flex items-center border-b border-outline-variant mb-lg">
            <button
              type="button"
              onClick={() => setTab("attempts")}
              className={`px-6 py-3 font-label-md transition-all ${
                tab === "attempts"
                  ? "text-primary font-bold border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              Student Attempts
            </button>
            <button
              type="button"
              onClick={() => setTab("leaderboard")}
              className={`px-6 py-3 font-label-md transition-all ${
                tab === "leaderboard"
                  ? "text-primary font-bold border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              Leaderboard
            </button>
          </div>

          {tab === "attempts" ? (
            attempts.length === 0 ? (
              <ProfessorEmptyState
                icon="bar_chart_off"
                heading="No attempts yet"
                description="Results will populate here once students complete this simulation and AI scoring finishes."
              />
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                        Date Submitted
                      </th>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {attempts.map((row) => {
                      const name = resolveStudentName(row);
                      const grade = row.status === "completed" ? scoreToGrade(row.total_score) : "-";
                      const isExpanded = expanded === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className="hover:bg-secondary-fixed/10 transition-colors duration-150 cursor-pointer"
                            onClick={() => toggleDetails(row.id)}
                          >
                            <td className="px-md py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-xs">
                                  {studentInitials(name)}
                                </div>
                                <span className="font-body-md">{name}</span>
                              </div>
                            </td>
                            <td className="px-md py-4 font-body-md text-on-surface-variant">
                              {new Date(row.started_at).toLocaleString()}
                            </td>
                            <td className="px-md py-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-md font-label-sm ${
                                  row.status === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {row.status === "completed" ? "Completed" : "In Progress"}
                              </span>
                            </td>
                            <td className="px-md py-4 font-code-md">
                              {row.status === "completed" ? `${row.total_score}/600` : "--"}
                            </td>
                            <td className="px-md py-4">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${gradeCircleClass(grade)}`}
                              >
                                {grade}
                              </span>
                            </td>
                            <td className="px-md py-4 text-right">
                              <button
                                type="button"
                                className="text-secondary font-label-md hover:underline flex items-center gap-1 ml-auto"
                              >
                                View Details
                                <MaterialIcon
                                  name={isExpanded ? "expand_less" : "expand_more"}
                                  className="text-[18px]"
                                />
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div
                                className={`expanding-row-content bg-surface-container-low/30 ${isExpanded ? "active" : ""}`}
                              >
                                <div className="px-xl py-lg">
                                  {row.status !== "completed" ? (
                                    <p className="text-center font-body-md text-on-surface-variant italic">
                                      Student is still interacting with the simulation.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                                      <div className="space-y-md">
                                        <h4 className="font-label-md text-on-surface-variant uppercase">
                                          Per-Stage Scoring
                                        </h4>
                                        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
                                          <table className="w-full">
                                            <tbody>
                                              {SCORED_STAGES.map((stage) => {
                                                const sc = row.stage_scores.find((s) => s.stage === stage);
                                                const tone = sc ? stageScoreTone(sc.score) : null;
                                                return (
                                                  <tr
                                                    key={stage}
                                                    className="border-b border-outline-variant last:border-0"
                                                  >
                                                    <td className="p-3 font-body-md">{STAGE_LABELS[stage]}</td>
                                                    <td
                                                      className={`p-3 font-code-md text-right ${sc ? toneTextClass(tone!) : ""}`}
                                                    >
                                                      {sc ? `${sc.score}/100` : "—"}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                      <div className="space-y-md">
                                        <h4 className="font-label-md text-on-surface-variant uppercase">
                                          Interactive Transcript
                                        </h4>
                                        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 h-48 overflow-y-auto custom-scrollbar space-y-3">
                                          {row.stage_scores
                                            .filter((s) => s.transcript)
                                            .slice(0, 2)
                                            .map((sc) => (
                                              <p key={sc.id} className="font-body-md text-on-surface italic">
                                                {sc.transcript}
                                              </p>
                                            ))}
                                          {row.stage_scores.every((s) => !s.transcript) && (
                                            <p className="text-on-surface-variant italic text-sm">
                                              No transcript available.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : leaderboard.length === 0 ? (
            <p className="text-on-surface-variant text-center py-12">
              No students have completed this simulation yet.
            </p>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-md py-4 font-label-sm text-on-surface-variant uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {leaderboard.map((row) => {
                    const medalClass =
                      row.rank === 1
                        ? "text-tertiary-fixed"
                        : row.rank === 2
                          ? "text-outline"
                          : row.rank === 3
                            ? "text-tertiary-container"
                            : "";
                    return (
                      <tr
                        key={row.attempt_id}
                        className={row.rank === 1 ? "border-l-4 border-tertiary-fixed bg-tertiary-fixed/5" : ""}
                      >
                        <td className="px-md py-4">
                          <div className="flex items-center gap-2">
                            {row.rank <= 3 && (
                              <MaterialIcon
                                name="workspace_premium"
                                className={`text-[24px] ${medalClass}`}
                                filled
                              />
                            )}
                            <span className="font-code-lg text-primary">{formatRankDisplay(row.rank)}</span>
                          </div>
                        </td>
                        <td
                          className={`px-md py-4 ${row.rank === 1 ? "font-headline-md text-primary" : "font-body-lg"}`}
                        >
                          {row.student_name}
                        </td>
                        <td className="px-md py-4 font-code-lg">{row.total_score}/600</td>
                        <td className="px-md py-4">
                          <span
                            className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg shadow-sm ${gradeCircleClass(row.grade)}`}
                          >
                            {row.grade}
                          </span>
                        </td>
                        <td className="px-md py-4 font-body-md text-on-surface-variant">
                          {row.completed_at
                            ? new Date(row.completed_at).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </FadeIn>
    </ProfessorPortalLayout>
  );
}

// ── My Classes page ──────────────────────────────────────────────────────────────

type ProfessorClassesViewProps = {
  userName: string;
};

/**
 * Dedicated My Classes page — all classes with create-class flow.
 */
export function ProfessorClassesView({ userName }: ProfessorClassesViewProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<ClassWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadClasses = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/professor/classes");
    if (!res.ok) {
      setIsLoading(false);
      return;
    }
    const body = (await res.json()) as { classes: ClassWithCounts[] };
    setClasses(body.classes ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const joinUrl = (): string => {
    if (typeof window === "undefined") return STUDENT_JOIN_PATH;
    return `${window.location.origin}${STUDENT_JOIN_PATH}`;
  };

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`, "success");
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  };

  const handleCreateClass = async (
    e: React.FormEvent,
    colorScheme: ClassColorSchemeId
  ): Promise<void> => {
    e.preventDefault();
    setIsCreating(true);
    const res = await fetch("/api/professor/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, cardColorScheme: colorScheme }),
    });
    setIsCreating(false);

    if (!res.ok) {
      showToast("Could not create class", "error");
      return;
    }

    setShowModal(false);
    setName("");
    setDescription("");
    showToast("Class created successfully", "success");
    await loadClasses();
    router.refresh();
  };

  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg space-y-lg">
        <section>
          <h1 className="font-display text-display text-primary">My Classes</h1>
          <p className="text-on-surface-variant mt-1">
            Organize teaching classes, share join codes, and assign simulations.
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-md py-2.5 bg-primary-container text-white rounded-lg hover:opacity-90 font-label-md active:scale-95"
          >
            <MaterialIcon name="add" />
            Create New Class
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            <ClassCardSkeleton delay={1} />
            <ClassCardSkeleton delay={2} />
            <ClassCardSkeleton delay={3} />
          </div>
        ) : classes.length === 0 ? (
          <ProfessorEmptyState
            icon="school"
            heading="No classes yet"
            description="You haven't created any classes yet. Create your first class to get a join code for students."
            action={
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="bg-primary-container text-white font-bold rounded-lg px-6 h-10 flex items-center gap-2 hover:opacity-90 transition-opacity duration-150"
              >
                <MaterialIcon name="add_circle" className="text-[20px]" />
                Create Class
              </button>
            }
          />
        ) : (
          <FadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {classes.map((classRow, index) => (
              <FadeIn
                key={classRow.id}
                delay={(Math.min(index, 3) as 0 | 1 | 2 | 3)}
                className="h-full"
              >
                <ProfessorClassCard
                  classId={classRow.id}
                  className={classRow.name}
                  description={classRow.description}
                  joinCode={classRow.join_code}
                  cardImageUrl={classRow.card_image_url}
                  cardColorScheme={classRow.card_color_scheme}
                  simulationCount={classRow.simulation_count}
                  onCopyJoinCode={() => void copyToClipboard(classRow.join_code, "Join code")}
                  onCopyJoinLink={() => void copyToClipboard(joinUrl(), "Join link")}
                />
              </FadeIn>
            ))}
          </FadeIn>
        )}
      </FadeIn>

      <CreateClassModalPanel
        open={showModal}
        name={name}
        description={description}
        isCreating={isCreating}
        onClose={() => setShowModal(false)}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSubmit={(e, colorScheme) => void handleCreateClass(e, colorScheme)}
      />
    </ProfessorPortalLayout>
  );
}

// ── Simulations page ─────────────────────────────────────────────────────────────

type ProfessorLibraryViewProps = {
  userName: string;
  initialSimulations: Simulation[];
  simulationStats: Record<string, SimulationStats>;
};

/**
 * Simulations — manage all professor scenarios.
 */
export function ProfessorLibraryView({
  userName,
  initialSimulations,
  simulationStats,
}: ProfessorLibraryViewProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [simulations, setSimulations] = useState(initialSimulations);
  const [deleteTarget, setDeleteTarget] = useState<Simulation | null>(null);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTogglePublish = async (sim: Simulation): Promise<void> => {
    setIsBusy(sim.id);
    const supabase = createClient();
    const nextPublished = !sim.is_published;
    const { error } = await supabase
      .from("simulations")
      .update({ is_published: nextPublished })
      .eq("id", sim.id);
    setIsBusy(null);
    if (error) {
      showToast("Something went wrong. Please try again.", "error");
      return;
    }
    setSimulations((prev) =>
      prev.map((s) => (s.id === sim.id ? { ...s, is_published: nextPublished } : s))
    );
    showToast(
      nextPublished
        ? "Simulation published — students can now see it"
        : "Simulation unpublished",
      "success"
    );
    router.refresh();
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    if (deleteTarget.is_published) {
      showToast("Unpublish this simulation before deleting it", "error");
      setDeleteTarget(null);
      return;
    }
    setIsDeleting(true);
    setIsBusy(deleteTarget.id);
    const supabase = createClient();
    const { error } = await supabase.from("simulations").delete().eq("id", deleteTarget.id);
    setIsBusy(null);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (error) {
      showToast("Something went wrong. Please try again.", "error");
      return;
    }
    setSimulations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    showToast("Simulation deleted", "success");
    router.refresh();
  };

  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg space-y-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display text-primary">Simulations</h1>
            <p className="text-on-surface-variant mt-1">
              Create, publish, and manage pitch training scenarios for your students.
            </p>
          </div>
          <Link
            href="/teacher/simulation/new"
            className="flex items-center gap-2 px-md py-2.5 border-2 border-primary text-primary rounded-lg hover:bg-primary-container hover:text-white font-label-md"
          >
            <MaterialIcon name="rocket_launch" />
            Create New Simulation
          </Link>
        </div>

        {simulations.length === 0 ? (
          <ProfessorEmptyState
            icon="model_training"
            heading="No simulations yet"
            description="Design your first pitch scenario to assign it to your classes."
            action={
              <Link
                href="/teacher/simulation/new"
                className="bg-primary-container text-white font-bold rounded-lg px-6 h-10 flex items-center gap-2 hover:opacity-90 transition-opacity duration-150"
              >
                <MaterialIcon name="bolt" className="text-[20px]" />
                Create Simulation
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider">Title</th>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider">Persona</th>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider">Attempts</th>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider">Avg Score</th>
                  <th className="px-lg py-md font-label-sm text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {simulations.map((sim) => {
                  const stats = simulationStats[sim.id];
                  const avgPct = stats?.avgPercent;
                  return (
                    <tr key={sim.id} className="hover:bg-secondary-fixed/10 transition-colors duration-150">
                      <td className="px-lg py-md font-bold text-primary">{sim.title}</td>
                      <td className="px-lg py-md">{sim.persona_name}</td>
                      <td className="px-lg py-md">
                        <span
                          className={`px-2 py-0.5 font-bold text-[10px] uppercase rounded ${
                            sim.is_published
                              ? "bg-tertiary-fixed text-on-tertiary-fixed"
                              : "bg-surface-container-highest text-on-surface-variant"
                          }`}
                        >
                          {sim.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-lg py-md">
                        {stats ? `${stats.completed} / ${stats.attempted}` : "0 / 0"}
                      </td>
                      <td className="px-lg py-md">
                        {avgPct != null ? (
                          <span className="font-code-md">{avgPct}%</span>
                        ) : (
                          <span className="text-on-surface-variant">--</span>
                        )}
                      </td>
                      <td className="px-lg py-md text-right">
                        <div className="flex items-center justify-end gap-2 text-on-surface-variant">
                          <Link href={`/teacher/simulation/${sim.id}/edit`} className="p-2 hover:bg-surface-container hover:text-primary rounded" title="Edit">
                            <MaterialIcon name="edit" className="text-[20px]" />
                          </Link>
                          <Link href={`/teacher/simulation/${sim.id}/results`} className="p-2 hover:bg-surface-container hover:text-primary rounded" title="Results">
                            <MaterialIcon name="bar_chart" className="text-[20px]" />
                          </Link>
                          <button
                            type="button"
                            disabled={isBusy === sim.id}
                            onClick={() => void handleTogglePublish(sim)}
                            className="p-2 hover:bg-surface-container hover:text-primary rounded disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title={sim.is_published ? "Unpublish" : "Publish"}
                          >
                            {isBusy === sim.id ? (
                              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <MaterialIcon
                                name={sim.is_published ? "toggle_on" : "toggle_off"}
                                className="text-[20px]"
                              />
                            )}
                          </button>
                          <button type="button" disabled={isBusy === sim.id} onClick={() => setDeleteTarget(sim)} className="p-2 hover:bg-error-container hover:text-error rounded" title="Delete">
                            <MaterialIcon name="delete" className="text-[20px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FadeIn>

      {deleteTarget && (
        <ConfirmModal
          title="Delete simulation?"
          message="Are you sure you want to delete this simulation? This cannot be undone."
          confirmLabel="Delete"
          isDestructive
          isConfirming={isDeleting}
          confirmingLabel="Deleting..."
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </ProfessorPortalLayout>
  );
}

// ── Settings page ────────────────────────────────────────────────────────────────

type ProfessorSettingsViewProps = {
  userName: string;
  email: string;
};

/**
 * Professor account settings page.
 */
export function ProfessorSettingsView({
  userName,
  email,
}: ProfessorSettingsViewProps): React.ReactElement {
  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg space-y-lg">
        <section>
          <h1 className="font-display text-display text-primary">Settings</h1>
          <p className="text-on-surface-variant mt-1">Manage your professor account preferences.</p>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm max-w-xl space-y-md">
          <h2 className="font-headline-md text-primary">Profile</h2>
          <div>
            <label className="font-label-md text-on-surface-variant">Display Name</label>
            <input
              readOnly
              value={userName}
              className="mt-1 w-full h-10 px-4 border border-outline-variant rounded-lg bg-surface-container-low font-body-md focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-150"
            />
          </div>
          <div>
            <label className="font-label-md text-on-surface-variant">Email</label>
            <input
              readOnly
              value={email}
              className="mt-1 w-full h-10 px-4 border border-outline-variant rounded-lg bg-surface-container-low font-body-md focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all duration-150"
            />
          </div>
          <p className="font-label-sm text-on-surface-variant">
            Contact your administrator to update profile details.
          </p>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm max-w-xl">
          <h2 className="font-headline-md text-primary mb-md">Session</h2>
          <ProfessorLogoutButton className="px-lg h-10 border border-outline text-primary font-label-md rounded-lg hover:bg-surface-container-high" />
        </section>
      </FadeIn>
    </ProfessorPortalLayout>
  );
}

// ── Support page ─────────────────────────────────────────────────────────────────

/**
 * Professor support and help resources.
 */
export function ProfessorSupportView({ userName }: { userName: string }): React.ReactElement {
  const faqs = [
    {
      q: "How do students join my class?",
      a: "Share the join link and class code separately. Students register at the student portal and enter the code to enroll.",
    },
    {
      q: "How do I assign a simulation?",
      a: "Open Manage Class on any class, then use the Add simulation dropdown to assign scenarios from Simulations.",
    },
    {
      q: "When do results appear?",
      a: "Results populate after students complete a simulation. AI scoring typically finishes within a few minutes.",
    },
  ];

  return (
    <ProfessorPortalLayout userName={userName}>
      <FadeIn className="max-w-container-max mx-auto px-margin-desktop py-lg space-y-lg">
        <section>
          <h1 className="font-display text-display text-primary">Support</h1>
          <p className="text-on-surface-variant mt-1">Quick answers and resources for the professor portal.</p>
        </section>

        <section className="bg-secondary-fixed/30 border border-secondary-fixed rounded-xl p-lg max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon name="mail" />
            <h2 className="font-headline-md text-primary">Need help?</h2>
          </div>
          <p className="font-body-md text-on-surface-variant">
            Email{" "}
            <a href="mailto:support@rehearse.app" className="text-secondary font-medium hover:underline">
              support@rehearse.app
            </a>{" "}
            and include your class name or simulation title.
          </p>
        </section>

        <section className="space-y-md max-w-2xl">
          <h2 className="font-headline-md text-primary">Frequently Asked Questions</h2>
          {faqs.map((item) => (
            <div
              key={item.q}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg"
            >
              <h3 className="font-label-md text-primary font-bold">{item.q}</h3>
              <p className="font-body-md text-on-surface-variant mt-2">{item.a}</p>
            </div>
          ))}
        </section>

        <BackButton
          label="Back"
          useHistory
          fallbackHref="/teacher/dashboard"
          materialIcon
          className="inline-flex items-center gap-2 text-secondary font-label-md hover:underline mb-0 transition-colors"
        />
      </FadeIn>
    </ProfessorPortalLayout>
  );
}
