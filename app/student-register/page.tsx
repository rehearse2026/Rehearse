/**
 * page.tsx — student-register
 * Student signup entry — renders unified SignupExperience (student default + ?code=).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupExperience } from "@/components/auth/SignupExperience";
import { getStudentSession } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account — Rehearse",
};

type PageProps = {
  searchParams: { code?: string };
};

/**
 * Student registration URL — redirects if a student session already exists.
 */
export default async function StudentRegisterPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (session) {
    redirect("/student/dashboard");
  }

  const initialJoinCode = searchParams.code?.trim().toUpperCase() ?? "";

  return <SignupExperience initialRole="student" initialJoinCode={initialJoinCode} />;
}
