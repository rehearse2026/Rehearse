/**
 * classes/page.tsx — student
 * Enrolled classes list with join-class CTAs (professor My Classes pattern).
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
  title: "Classes — Rehearse",
};

/**
 * Student classes index — browse enrolled classes or join another.
 */
export default async function StudentClassesPage(): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (!session) {
    redirect("/student-login");
  }

  const enrolledClasses = await loadStudentEnrolledClasses(session.studentId);

  return (
    <div className="animate-fade-in-up">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-6">
        <section>
          <h1 className="font-display text-display text-on-surface">My Classes</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Open a class to practice simulations, or join another with a class code.
          </p>
        </section>

        <div className="flex justify-end">
          <JoinClassButton variant="primary" />
        </div>

        {enrolledClasses.length === 0 ? (
          <StudentEmptyState
            icon="school"
            heading="No classes yet"
            description="You haven't joined any classes yet. Enter your professor's class code to get started."
            action={<JoinClassButton variant="empty" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>
    </div>
  );
}
