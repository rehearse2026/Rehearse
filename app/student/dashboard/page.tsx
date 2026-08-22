/**
 * dashboard/page.tsx — student
 * Lists enrolled classes as professor-styled cards; simulations live inside each class.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { StudentClassCard } from "@/components/StudentClassCard";
import {
  StudentAttemptHistory,
  type StudentAttemptRow,
} from "@/components/StudentAttemptHistory";
import { DEFAULT_CLASS_ID } from "@/lib/constants";
import { loadStudentEnrolledClasses } from "@/lib/student-class-data";
import { getStudentSession } from "@/lib/student-session";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Simulations — Rehearse",
};

/**
 * Student home — pick a class, then choose a simulation inside it.
 */
export default async function StudentDashboardPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const enrolledClasses = await loadStudentEnrolledClasses(session.studentId);

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
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        <header>
          <h1 className="font-display text-display text-on-surface">
            Welcome back, {session.displayName}
          </h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {enrolledClasses.length === 0
              ? "Join a class to get started."
              : enrolledClasses.length === 1
                ? "Open your class to start a simulation."
                : `${enrolledClasses.length} classes — open one to view simulations.`}
          </p>
        </header>

        <section>
          {enrolledClasses.length === 0 ? (
            <EmptyState
              icon="🎓"
              title="No classes yet."
              description="Use Join a Class in the header with your professor's class code to get started."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {enrolledClasses.map((cls) => (
                <StudentClassCard
                  key={cls.classId}
                  classId={cls.classId}
                  className={cls.className}
                  description={cls.description}
                  cardImageUrl={cls.cardImageUrl}
                  cardColorScheme={cls.cardColorScheme}
                  simulationCount={cls.simulationCount}
                  isSystemDefault={cls.classId === DEFAULT_CLASS_ID}
                />
              ))}
            </div>
          )}
        </section>

        <StudentAttemptHistory attempts={history} />
      </div>
    </div>
  );
}
