/**
 * register/page.tsx
 * Professor signup — AuthBrandPanel + RegisterForm (teacher-only Supabase Auth).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Professor Signup — Rehearse",
};

/**
 * Professor registration page — redirects authenticated teachers to dashboard.
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

  return (
    <div className="bg-background min-h-screen flex text-on-surface antialiased">
      <AuthBrandPanel
        headline="Set up your class"
        subtext="Create a professor account to get started."
      />

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 lg:p-8 bg-surface-container-lowest">
        <div className="lg:hidden w-full max-w-sm mb-8 text-center">
          <img
            src="/pitchlab-logo-new.png"
            alt="Rehearse"
            className="h-7 w-auto mx-auto mb-3"
          />
          <p className="text-sm text-on-surface-variant">Set up your class</p>
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
