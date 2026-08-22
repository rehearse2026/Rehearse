/**
 * register/page.tsx
 * Professor signup entry — renders unified SignupExperience (professor default).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupExperience } from "@/components/auth/SignupExperience";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account — Rehearse",
};

/**
 * Professor registration URL — authenticated teachers go to the dashboard.
 */
export default async function RegisterPage(): Promise<React.ReactElement> {
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

  return <SignupExperience initialRole="professor" />;
}
