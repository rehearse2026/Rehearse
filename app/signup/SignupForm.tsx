/**
 * SignupForm.tsx
 * Unified Student / Professor signup form for /signup.
 * Student path → POST /api/student/register (JWT students table).
 * Professor path → Supabase Auth signUp with role teacher only.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  JOIN_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export type SignupRole = "student" | "professor";

type SignupFormProps = {
  /** Initial role from ?role= or inferred from ?code=. */
  initialRole: SignupRole | null;
  /** Pre-filled class code from ?code=. */
  initialJoinCode?: string;
};

/**
 * Role toggle + role-specific fields; submits via the matching existing auth path.
 */
export function SignupForm({
  initialRole,
  initialJoinCode = "",
}: SignupFormProps): React.ReactElement {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole | null>(initialRole);

  // ── Student fields ──
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode);

  // ── Professor fields ──
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [professorPassword, setProfessorPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    if (studentPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setIsLoading(true);
    const trimmedCode = joinCode.trim().toUpperCase();
    const res = await fetch("/api/student/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        username,
        password: studentPassword,
        joinCode: trimmedCode,
      }),
    });

    const body = (await res.json()) as { error?: string };
    setIsLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Registration failed.");
      return;
    }

    router.push("/student/dashboard");
    router.refresh();
  };

  const handleProfessorSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: professorPassword,
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
    <div className="mt-8 space-y-6">
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">I am a</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: "student" as const, label: "Student" },
              { id: "professor" as const, label: "Professor" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setRole(option.id);
                setError("");
              }}
              className={`p-4 border-2 rounded-lg text-sm font-semibold transition-all ${
                role === option.id
                  ? "border-accent bg-accent text-white shadow-md"
                  : "border-border text-text-secondary bg-surface hover:border-accent/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {role === null ? (
        <p className="text-sm text-text-secondary text-center">
          Select Student or Professor to continue.
        </p>
      ) : null}

      {role === "student" ? (
        <form
          onSubmit={(e) => void handleStudentSubmit(e)}
          className="space-y-4"
          autoComplete="off"
        >
          <label className="block text-sm font-medium text-text-primary">
            Display Name
            <input
              type="text"
              required
              className="input-field mt-1"
              placeholder="Name shown on leaderboard"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-text-primary">
            Username
            <input
              type="text"
              required
              minLength={USERNAME_MIN_LENGTH}
              maxLength={USERNAME_MAX_LENGTH}
              pattern="[a-zA-Z0-9_]+"
              className="input-field mt-1"
              placeholder="letters, numbers, underscores"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <span className="mt-1 block text-xs text-text-secondary">
              3–20 characters, letters, numbers and underscores only
            </span>
          </label>

          <label className="block text-sm font-medium text-text-primary">
            Password
            <input
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              className="input-field mt-1"
              value={studentPassword}
              onChange={(e) => setStudentPassword(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-text-primary">
            Class Code (optional)
            <input
              type="text"
              maxLength={JOIN_CODE_LENGTH}
              className="input-field mt-1 uppercase tracking-widest"
              placeholder="6-character code from your professor"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <span className="mt-1 block text-xs text-text-secondary">
              Leave blank to join Rehearse Essentials only — you can join a class later.
            </span>
          </label>

          {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

          <button type="submit" disabled={isLoading} className="w-full btn-primary">
            {isLoading ? "Creating account…" : "Create Account"}
          </button>

          <p className="text-sm text-text-secondary text-center">
            Already have an account?{" "}
            <Link href="/student-login" className="text-accent font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : null}

      {role === "professor" ? (
        <form
          onSubmit={(e) => void handleProfessorSubmit(e)}
          className="space-y-4"
          autoComplete="off"
        >
          <label className="block text-sm font-medium text-text-primary">
            Full name
            <input
              required
              autoComplete="off"
              className="input-field mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>

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
              minLength={6}
              autoComplete="new-password"
              className="input-field mt-1"
              value={professorPassword}
              onChange={(e) => setProfessorPassword(e.target.value)}
            />
          </label>

          {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

          <button type="submit" disabled={isLoading} className="w-full btn-primary">
            {isLoading ? "Creating…" : "Register"}
          </button>

          <p className="text-sm text-text-secondary text-center">
            Have an account?{" "}
            <Link href="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : null}
    </div>
  );
}
