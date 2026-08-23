/**
 * classes/[classId]/page.tsx — student
 * Simulations assigned to one enrolled class.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { SimulationCard } from "@/components/SimulationCard";
import { StudentClassHeader } from "@/components/StudentClassHeader";
import {
  ATTEMPT_STATUS,
  DEFAULT_CLASS_ID,
  DEFAULT_CLASS_BANNER_URL,
  DEFAULT_CLASS_DESCRIPTION,
  DEFAULT_CLASS_NAME,
} from "@/lib/constants";
import { loadStudentClassDetail } from "@/lib/student-class-data";
import { isTempoDefaultSimulation } from "@/lib/tempo-simulation";
import { getStudentSession } from "@/lib/student-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Attempt } from "@/types";

type PageProps = { params: { classId: string } };

/**
 * Class detail — student picks a simulation inside one class.
 */
export default async function StudentClassPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const classDetail = await loadStudentClassDetail(session.studentId, params.classId);
  if (!classDetail) {
    redirect("/student/dashboard");
  }

  const supabase = createServiceClient();
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", session.studentId)
    .eq("class_id", params.classId)
    .eq("status", ATTEMPT_STATUS.IN_PROGRESS);

  const inProgressList = (attempts ?? []) as Attempt[];
  const attemptIds = inProgressList.map((a) => a.id);

  const stageCountByAttempt = new Map<string, number>();
  if (attemptIds.length > 0) {
    const { data: stageRows } = await supabase
      .from("stage_scores")
      .select("attempt_id")
      .in("attempt_id", attemptIds);

    (stageRows ?? []).forEach((row: { attempt_id: string }) => {
      const id = row.attempt_id;
      stageCountByAttempt.set(id, (stageCountByAttempt.get(id) ?? 0) + 1);
    });
  }

  const attemptBySim = new Map<string, Attempt>();
  for (const attempt of inProgressList) {
    attemptBySim.set(attempt.simulation_id, attempt);
  }

  const isDefaultClass = params.classId === DEFAULT_CLASS_ID;
  const displayDescription = isDefaultClass
    ? DEFAULT_CLASS_DESCRIPTION
    : classDetail.description;

  return (
    <div className="px-4 sm:px-6">
      <Link
        href="/student/classes"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:underline mb-6 transition-colors"
      >
        <span aria-hidden>←</span>
        All classes
      </Link>

      {isDefaultClass ? (
        <div
          className="rounded-xl overflow-hidden mb-4 min-h-[140px] flex flex-col justify-end px-5 py-5 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.2)), url(${DEFAULT_CLASS_BANNER_URL})`,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="material-symbols-outlined text-white/80 text-[20px]" aria-hidden>
              auto_awesome
            </span>
            <h2 className="text-2xl font-bold text-white">{DEFAULT_CLASS_NAME}</h2>
            <span className="px-2 py-0.5 bg-white/10 text-white font-bold text-[10px] uppercase rounded">
              Available to all students
            </span>
          </div>
        </div>
      ) : (
        <StudentClassHeader
          className={classDetail.className}
          cardImageUrl={classDetail.cardImageUrl}
          cardColorScheme={classDetail.cardColorScheme}
        />
      )}

      {displayDescription && (
        <p className="text-sm text-text-secondary mb-6 -mt-2">{displayDescription}</p>
      )}

      {classDetail.simulations.length === 0 ? (
        isDefaultClass ? (
          <div className="text-center py-12 text-text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 block opacity-30" aria-hidden>
              rocket_launch
            </span>
            <p className="text-base">No Rehearse Essentials yet.</p>
            <p className="text-sm mt-1">Check back soon.</p>
          </div>
        ) : (
          <EmptyState
            icon="🎯"
            title="No simulations yet."
            description="Your professor hasn't assigned any published simulations to this class yet. Check back later."
          />
        )
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classDetail.simulations.map((sim) => {
            const existing = attemptBySim.get(sim.id);
            const stagesCompleted = existing
              ? stageCountByAttempt.get(existing.id) ?? 0
              : 0;
            const query = new URLSearchParams({ classId: params.classId });
            if (existing) {
              query.set("attempt", existing.id);
            }

            const isTempoInDefaultClass =
              params.classId === DEFAULT_CLASS_ID &&
              isTempoDefaultSimulation(sim.id, sim.title);

            const href = isTempoInDefaultClass
              ? `/student/simulation/${sim.id}/entry?classId=${params.classId}`
              : `/student/simulation/${sim.id}?${query.toString()}`;

            return (
              <SimulationCard
                key={sim.id}
                simulation={sim}
                className={classDetail.className}
                accentColor={classDetail.accentColor}
                actionLabel={existing ? "Continue" : "Start Simulation"}
                href={href}
                stagesCompleted={stagesCompleted}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
