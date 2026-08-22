/**
 * RegisterForm.tsx
 * Professor-only account creation via Supabase Auth (role teacher).
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Full name, institutional email, password — creates a teacher profile.
 */
export function RegisterForm(): React.ReactElement {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: "teacher" } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    router.push("/teacher/dashboard");
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" autoComplete="off">
        <div className="space-y-1">
          <label
            className="block text-[13px] font-medium leading-[18px] text-on-surface"
            htmlFor="fullName"
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            placeholder="Jane Doe"
            className="w-full h-10 px-4 rounded bg-surface-container-lowest border border-surface-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label
            className="block text-[13px] font-medium leading-[18px] text-on-surface"
            htmlFor="email"
          >
            Institutional Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="jane.doe@university.edu"
            className="w-full h-10 px-4 rounded bg-surface-container-lowest border border-surface-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label
            className="block text-[13px] font-medium leading-[18px] text-on-surface"
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full h-10 px-4 rounded bg-surface-container-lowest border border-surface-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 bg-primary-container text-on-primary rounded text-[13px] font-medium hover:bg-on-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-colors disabled:opacity-60"
        >
          {isLoading ? "Creating…" : "Create Account"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login?role=professor"
          className="text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
