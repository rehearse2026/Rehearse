/**
 * simulations/page.tsx — student
 * Completed simulation attempt history.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  StudentAttemptHistory,
  type StudentAttemptRow,
} from "@/components/StudentAttemptHistory";
import { getStudentSession } from "@/lib/student-session";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Simulations — Rehearse",
};

/**
 * Student simulations tab — past completed runs and scores.
 */
export default async function StudentSimulationsPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const supabase = createServiceClient();
  const { data: completedAttempts } = await supabase
    .from("attempts")
    .select("id, total_score, completed_at, simulations ( id, title, persona_name )")
    .eq("student_id", session.studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);

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
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-6">
        <header>
          <h1 className="font-display text-display text-on-surface">My Simulations</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Review scores and feedback from completed runs.
          </p>
        </header>

        <StudentAttemptHistory attempts={history} />
      </div>
    </div>
  );
}
