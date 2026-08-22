/**
 * StudentRegisterForm.tsx
 * Student account creation — POST /api/student/register (optional class code).
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthRoleToggle } from "@/components/auth/AuthRoleToggle";
import {
  JOIN_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/constants";

type StudentRegisterFormProps = {
  initialJoinCode?: string;
};

/**
 * Full name, username, password, optional class code — JWT student signup.
 */
export function StudentRegisterForm({
  initialJoinCode = "",
}: StudentRegisterFormProps): React.ReactElement {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setIsLoading(true);
    const res = await fetch("/api/student/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        username,
        password,
        joinCode: joinCode.trim().toUpperCase(),
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

  const professorHref = "/register";
  const studentHref =
    joinCode.trim().length > 0
      ? `/student-register?code=${encodeURIComponent(joinCode.trim().toUpperCase())}`
      : "/student-register";

  return (
    <div className="w-full max-w-[440px] flex flex-col gap-8">
      <AuthRoleToggle
        active="student"
        hrefs={{ student: studentHref, professor: professorHref }}
      />

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-6"
        autoComplete="off"
      >
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-on-surface" htmlFor="fullName">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            placeholder="Enter your full name"
            className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow text-on-surface"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-on-surface" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            pattern="[a-zA-Z0-9_]+"
            placeholder="Choose a username"
            className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow text-on-surface"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <span className="text-xs text-on-surface-variant">
            3–20 characters, letters, numbers and underscores only
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-on-surface" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            placeholder="Create a strong password"
            className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow text-on-surface"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-medium text-on-surface flex items-center gap-1"
            htmlFor="classCode"
          >
            Class Code
            <span className="text-on-surface-variant font-normal">(optional)</span>
          </label>
          <input
            id="classCode"
            name="classCode"
            type="text"
            maxLength={JOIN_CODE_LENGTH}
            placeholder="e.g. CS101A"
            className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest font-mono text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow text-on-surface uppercase tracking-wider"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
        </div>

        {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="h-10 px-4 mt-2 bg-primary-container text-white rounded text-[13px] font-medium hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container disabled:opacity-60"
        >
          {isLoading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div className="text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link
          href="/login?role=student"
          className="font-medium text-secondary hover:underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
