/**
 * signup/page.tsx
 * Unified Student / Professor account creation — replaces /register and
 * /student-register. Optional ?role= and ?code= query params.
 */

import type { Metadata } from "next";
import { AuthSplitLayout } from "@/components/ui/AuthSplitLayout";
import { SignupForm, type SignupRole } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account — Rehearse",
};

type PageProps = {
  searchParams: { role?: string; code?: string };
};

/**
 * Resolves initial role from query: code presence biases to student;
 * explicit ?role= wins when valid.
 */
function resolveInitialRole(searchParams: PageProps["searchParams"]): SignupRole | null {
  const code = searchParams.code?.trim() ?? "";
  const roleParam = searchParams.role?.trim().toLowerCase() ?? "";

  if (roleParam === "student" || roleParam === "professor") {
    return roleParam;
  }
  if (code.length > 0) {
    return "student";
  }
  return null;
}

/**
 * Signup page shell — AuthSplitLayout + SignupForm.
 */
export default function SignupPage({ searchParams }: PageProps): React.ReactElement {
  const initialJoinCode = searchParams.code?.trim().toUpperCase() ?? "";
  const initialRole = resolveInitialRole(searchParams);

  return (
    <AuthSplitLayout accent="gold" subtitle="Create your account and start practicing.">
      <h2 className="text-2xl font-bold text-primary">Create account</h2>
      <p className="text-sm text-text-secondary mt-1">
        Sign up as a student or professor
      </p>
      <SignupForm initialRole={initialRole} initialJoinCode={initialJoinCode} />
    </AuthSplitLayout>
  );
}
