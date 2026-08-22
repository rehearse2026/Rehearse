/**
 * LoginForm.tsx
 * Client login form (separated for useSearchParams).
 */

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Email/password login for professors — validates Supabase session on load.
 */
export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const supabase = createClient();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
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
      setError("This page is for professors. Students should use Student Login.");
      setIsLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirect") ?? "/teacher/dashboard";
    router.push(redirectTo);
    router.refresh();
  };

  if (isCheckingSession) {
    return <p className="mt-8 text-sm text-text-secondary">Loading…</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4" autoComplete="off">
      <label className="block text-sm font-medium text-text-primary">
        Email
        <input
          type="email"
          required
          autoComplete="off"
          className="input-field mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-sm font-medium text-text-primary">
        Password
        <input
          type="password"
          required
          autoComplete="new-password"
          className="input-field mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={isLoading} className="w-full btn-primary">
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-text-secondary text-center">
        No account?{" "}
        <Link href="/signup?role=professor" className="text-accent font-medium hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
