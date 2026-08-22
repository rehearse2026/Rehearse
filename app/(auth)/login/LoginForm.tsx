/**
 * LoginForm.tsx
 * Unified Student / Professor sign-in with segmented role toggle.
 * Student → POST /api/student/login; Professor → Supabase signInWithPassword.
 */

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LoginRole = "student" | "professor";

type LoginFormProps = {
  initialRole?: LoginRole;
};

/**
 * Role toggle + credential form; submits via the matching existing auth path.
 */
export function LoginForm({ initialRole = "student" }: LoginFormProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<LoginRole>(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async (): Promise<void> => {
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
          const redirectTo = searchParams.get("redirect") ?? "/teacher/dashboard";
          router.replace(redirectTo);
          return;
        }
      }

      setIsCheckingSession(false);
    };

    void checkSession();
  }, [router, searchParams]);

  const handleStudentSubmit = async (): Promise<void> => {
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier.trim(), password }),
    });

    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Login failed.");
      setIsLoading(false);
      return;
    }

    router.push("/student/dashboard");
    router.refresh();
  };

  const handleProfessorSubmit = async (): Promise<void> => {
    const supabase = createClient();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user?.id ?? "")
      .single();

    if (profile?.role !== "teacher") {
      await supabase.auth.signOut();
      setError("This account is not a professor account. Switch to Student to sign in.");
      setIsLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirect") ?? "/teacher/dashboard";
    router.push(redirectTo);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (role === "student") {
      await handleStudentSubmit();
      return;
    }

    await handleProfessorSubmit();
  };

  if (isCheckingSession) {
    return <p className="mt-8 text-sm text-on-surface-variant">Loading…</p>;
  }

  const signupHref = role === "professor" ? "/register" : "/student-register";

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="relative flex bg-surface-container-low rounded-lg p-1">
          <span
            aria-hidden
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              role === "professor" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setRole("student");
              setError("");
              setIdentifier("");
              setPassword("");
            }}
            className={`relative z-10 flex-1 py-2 text-center text-sm rounded-md transition-colors ${
              role === "student"
                ? "font-semibold text-primary-container"
                : "font-medium text-on-surface-variant"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => {
              setRole("professor");
              setError("");
              setIdentifier("");
              setPassword("");
            }}
            className={`relative z-10 flex-1 py-2 text-center text-sm rounded-md transition-colors ${
              role === "professor"
                ? "font-semibold text-primary-container"
                : "font-medium text-on-surface-variant"
            }`}
          >
            Professor
          </button>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" autoComplete="off">
        <div>
          <label
            className="block text-[13px] font-medium leading-[18px] text-on-surface mb-1"
            htmlFor="login-identifier"
          >
            {role === "student" ? "Username" : "Email address"}
          </label>
          <input
            id="login-identifier"
            type={role === "student" ? "text" : "email"}
            required
            autoComplete="off"
            placeholder={role === "professor" ? "professor@university.edu" : undefined}
            className="w-full h-10 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow shadow-sm"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div>
          <label
            className="block text-[13px] font-medium leading-[18px] text-on-surface mb-1"
            htmlFor="login-password"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full h-10 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow shadow-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 flex justify-center items-center bg-primary-container text-on-primary text-[13px] font-medium rounded shadow-sm hover:bg-inverse-surface transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container disabled:opacity-60"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link
          href={signupHref}
          className="font-medium text-secondary hover:text-on-secondary-container transition-colors"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
