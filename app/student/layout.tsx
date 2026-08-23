/**
 * layout.tsx — student section
 * JWT session auth with professor-style sidebar shell and dashboard header.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { loadStudentEnrolledClasses } from "@/lib/student-class-data";
import { getStudentSession } from "@/lib/student-session";

/**
 * Student layout wrapper — portal shell with sidebar navigation.
 */
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
    <StudentPortalShell displayName={session.displayName} classCount={enrolledClasses.length}>
      {children}
    </StudentPortalShell>
  );
}
