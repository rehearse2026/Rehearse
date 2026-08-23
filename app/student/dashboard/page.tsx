/**
 * dashboard/page.tsx — student Home
 * Welcome + enrolled class cards with join-class tile (professor add-class pattern).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinClassButton } from "@/app/student/dashboard/JoinClassButton";
import { StudentClassCard } from "@/components/StudentClassCard";
import { StudentEmptyState } from "@/components/student/StudentEmptyState";
import { DEFAULT_CLASS_ID } from "@/lib/constants";
import { loadStudentEnrolledClasses } from "@/lib/student-class-data";
import { getStudentSession } from "@/lib/student-session";

export const metadata: Metadata = {
  title: "Home — Rehearse",
};

/**
 * Student home — welcome and class cards; completed sims live under Simulations.
 */
export default async function StudentDashboardPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const enrolledClasses = await loadStudentEnrolledClasses(session.studentId);

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
            <StudentEmptyState
              icon="school"
              heading="No classes yet"
              description="You haven't joined any classes yet. Enter your professor's class code to get started."
              action={<JoinClassButton variant="empty" />}
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
              <JoinClassButton variant="tile" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
