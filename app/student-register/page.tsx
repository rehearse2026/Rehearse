/**
 * page.tsx — student-register
 * Student signup — AuthBrandPanel + optional class code (prefill via ?code=).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { getStudentSession } from "@/lib/student-session";
import { StudentRegisterForm } from "./StudentRegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account — Rehearse",
};

type PageProps = {
  searchParams: { code?: string };
};

/**
 * Student registration page — redirects if a student session already exists.
 */
export default async function StudentRegisterPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const session = await getStudentSession();
  if (session) {
    redirect("/student/dashboard");
  }

  const initialJoinCode = searchParams.code?.trim().toUpperCase() ?? "";

  return (
    <div className="bg-surface text-on-surface min-h-screen w-full flex overflow-x-hidden">
      <AuthBrandPanel
        headline="Join your class"
        subtext="Create a student account to get started"
      />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 overflow-y-auto bg-surface-container-lowest">
        <div className="w-full max-w-[440px] flex flex-col gap-8">
          <div className="lg:hidden flex flex-col gap-2 mb-2">
            <img src="/pitchlab-logo-new.png" alt="Rehearse" className="h-7 w-auto mb-2" />
            <h1 className="text-2xl font-semibold text-on-surface">Join your class</h1>
            <p className="text-base text-on-surface-variant">
              Create a student account to get started
            </p>
          </div>

          <StudentRegisterForm initialJoinCode={initialJoinCode} />
        </div>
      </div>
    </div>
  );
}
