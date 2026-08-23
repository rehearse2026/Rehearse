/**
 * simulations/page.tsx — student
 * Ongoing + completed simulation attempts.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  StudentAttemptHistory,
  type StudentAttemptRow,
} from "@/components/StudentAttemptHistory";
import {
  StudentOngoingSimulations,
  type StudentOngoingRow,
} from "@/components/StudentOngoingSimulations";
import { ATTEMPT_STATUS, DEFAULT_CLASS_ID } from "@/lib/constants";
import { attemptHasStartedProgress } from "@/lib/attempt-progress";
import { isTempoDefaultSimulation } from "@/lib/tempo-simulation";
import { getStudentSession } from "@/lib/student-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { SimulationStage } from "@/types";

export const metadata: Metadata = {
  title: "Simulations — Rehearse",
};

type AttemptSimJoin = {
  id: string;
  title: string;
  persona_name: string;
  persona_role?: string;
  product_context?: string;
} | null;

type AttemptClassJoin = {
  id: string;
  name: string;
} | null;

/**
 * Student simulations tab — ongoing runs and completed history.
 */
export default async function StudentSimulationsPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const supabase = createServiceClient();

  const [{ data: ongoingRows }, { data: completedAttempts }] = await Promise.all([
    supabase
      .from("attempts")
      .select(
        "id, class_id, current_stage, stage_data, simulation_id, started_at, simulations ( id, title, persona_name, persona_role, product_context ), classes ( id, name )"
      )
      .eq("student_id", session.studentId)
      .eq("status", ATTEMPT_STATUS.IN_PROGRESS)
      .order("started_at", { ascending: false }),
    supabase
      .from("attempts")
      .select("id, total_score, completed_at, simulations ( id, title, persona_name )")
      .eq("student_id", session.studentId)
      .eq("status", ATTEMPT_STATUS.COMPLETED)
      .order("completed_at", { ascending: false })
      .limit(20),
  ]);

  const startedOngoing = (ongoingRows ?? []).filter((row) =>
    attemptHasStartedProgress({
      currentStage: row.current_stage as SimulationStage | null,
      stageData: (row as { stage_data?: unknown }).stage_data,
    })
  );

  const attemptIds = startedOngoing.map((row) => row.id as string);
  const stageCountByAttempt = new Map<string, number>();
  if (attemptIds.length > 0) {
    const { data: stageRows } = await supabase
      .from("stage_scores")
      .select("attempt_id")
      .in("attempt_id", attemptIds);

    for (const row of stageRows ?? []) {
      const id = row.attempt_id as string;
      stageCountByAttempt.set(id, (stageCountByAttempt.get(id) ?? 0) + 1);
    }
  }

  const ongoing: StudentOngoingRow[] = startedOngoing.map((row) => {
    const simRaw = row.simulations;
    const sim = (Array.isArray(simRaw) ? simRaw[0] ?? null : simRaw) as AttemptSimJoin;
    const classRaw = row.classes;
    const cls = (Array.isArray(classRaw) ? classRaw[0] ?? null : classRaw) as AttemptClassJoin;
    const classId = (row.class_id as string) ?? "";
    const simulationId = (row.simulation_id as string) ?? sim?.id ?? "";
    const title = sim?.title ?? "Simulation";
    const isTempo =
      classId === DEFAULT_CLASS_ID && isTempoDefaultSimulation(simulationId, title);

    const continueHref = isTempo
      ? `/student/simulation/${simulationId}/entry?classId=${classId}`
      : `/student/simulation/${simulationId}?classId=${classId}&attempt=${row.id as string}`;

    return {
      attemptId: row.id as string,
      simulationId,
      title,
      personaName: sim?.persona_name ?? null,
      personaRole: sim?.persona_role ?? null,
      className: cls?.name ?? null,
      stagesCompleted: stageCountByAttempt.get(row.id as string) ?? 0,
      continueHref,
    };
  });

  const history: StudentAttemptRow[] = (completedAttempts ?? []).map((row) => {
    const sim = row.simulations;
    const simulation = Array.isArray(sim) ? sim[0] ?? null : sim;
    return {
      id: row.id as string,
      total_score: row.total_score as number,
      completed_at: row.completed_at as string | null,
      simulations: simulation as StudentAttemptRow["simulations"],
    };
  });

  return (
    <div className="animate-fade-in-up">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-10">
        <header>
          <h1 className="font-display text-display text-on-surface">My Simulations</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Pick up where you left off, or review scores from completed runs.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <h2 className="font-headline-md text-headline-md text-primary">Ongoing</h2>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {ongoing.length === 0
                ? "None"
                : `${ongoing.length} in progress`}
            </span>
          </div>
          <StudentOngoingSimulations attempts={ongoing} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <h2 className="font-headline-md text-headline-md text-primary">Completed</h2>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {history.length === 0
                ? "None"
                : `${history.length} shown`}
            </span>
          </div>
          <StudentAttemptHistory attempts={history} />
        </section>
      </div>
    </div>
  );
}
