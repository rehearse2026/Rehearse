/**
 * login/page.tsx
 * Unified Student / Professor sign-in — AuthBrandPanel + role-toggle form.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { getStudentSession } from "@/lib/student-session";
import { createClient } from "@/lib/supabase/server";
import { LoginForm, type LoginRole } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In — Rehearse",
};

type PageProps = {
  searchParams: { role?: string; redirect?: string };
};

/**
 * Resolves initial toggle role from ?role= (defaults to student).
 */
function resolveInitialRole(roleParam: string | undefined): LoginRole {
  const normalized = roleParam?.trim().toLowerCase() ?? "";
  return normalized === "professor" ? "professor" : "student";
}

/**
 * Login page — redirects already-authenticated users; otherwise shows unified form.
 */
export default async function LoginPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const studentSession = await getStudentSession();
  if (studentSession) {
    redirect("/student/dashboard");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === "teacher") {
        redirect("/teacher/dashboard");
      }
    }
  }

  const initialRole = resolveInitialRole(searchParams.role);

  return (
    <div className="bg-surface h-screen w-full flex m-0 p-0 overflow-hidden text-on-surface">
      <AuthBrandPanel headline="Welcome back" subtext="Sign in to continue" />

      <div className="w-full lg:w-1/2 bg-surface-container-lowest flex items-center justify-center p-4 lg:p-8 relative">
        <div className="lg:hidden absolute top-0 left-0 w-full p-4 flex justify-center items-center gap-2 border-b border-outline-variant bg-surface-container-lowest z-10">
          <img src="/pitchlab-logo-new.png" alt="" className="h-7 w-auto" />
          <span className="text-secondary font-semibold text-xl tracking-tight">Rehearse</span>
        </div>

        <div className="w-full max-w-[400px] mt-16 lg:mt-0">
          <div className="text-center mb-8 lg:hidden">
            <h2 className="text-on-surface font-semibold text-2xl leading-8 mb-1">
              Welcome back
            </h2>
            <p className="text-on-surface-variant text-sm">Sign in to continue</p>
          </div>

          <Suspense fallback={<p className="text-sm text-on-surface-variant">Loading…</p>}>
            <LoginForm initialRole={initialRole} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
