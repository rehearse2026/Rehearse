/**
 * SignupExperience.tsx
 * Unified Student / Professor signup shell — toggle switches forms in place
 * (no page navigation) so the control stays put and animates like /login.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthRoleToggle, type AuthRole } from "@/components/auth/AuthRoleToggle";
import {
  JOIN_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type SignupExperienceProps = {
  initialRole: AuthRole;
  initialJoinCode?: string;
};

const COPY: Record<
  AuthRole,
  { headline: string; subtext: string; backgroundSrc: string }
> = {
  student: {
    headline: "Join your class",
    subtext: "Create a student account to get started",
    backgroundSrc: "/auth/signup-student.jpg",
  },
  professor: {
    headline: "Set up your class",
    subtext: "Create a professor account to get started.",
    backgroundSrc: "/auth/signup-professor.jpg",
  },
};

/**
 * Syncs the address bar without remounting (avoids toggle jump).
 */
function syncSignupUrl(role: AuthRole, joinCode: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (role === "professor") {
    window.history.replaceState(null, "", "/register");
    return;
  }
  const code = joinCode.trim().toUpperCase();
  const href =
    code.length > 0
      ? `/student-register?code=${encodeURIComponent(code)}`
      : "/student-register";
  window.history.replaceState(null, "", href);
}

/**
 * Full-page signup experience with shared brand panel and in-place role toggle.
 */
export function SignupExperience({
  initialRole,
  initialJoinCode = "",
}: SignupExperienceProps): React.ReactElement {
  const router = useRouter();
  const [role, setRole] = useState<AuthRole>(initialRole);

  // Student fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode);

  // Professor fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [professorPassword, setProfessorPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const copy = COPY[role];

  const handleRoleChange = (next: AuthRole): void => {
    if (next === role) {
      return;
    }
    setRole(next);
    setError("");
    syncSignupUrl(next, joinCode);
  };

  const handleStudentSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    if (studentPassword.length < PASSWORD_MIN_LENGTH) {
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
        password: studentPassword,
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
    <div className="bg-surface text-on-surface h-screen w-full flex m-0 p-0 overflow-hidden">
      <AuthBrandPanel
        headline={copy.headline}
        subtext={copy.subtext}
        backgroundSrc={copy.backgroundSrc}
      />

      <div className="w-full lg:w-1/2 bg-surface-container-lowest flex flex-col relative overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-10 w-full p-4 flex justify-center items-center gap-2 border-b border-outline-variant bg-surface-container-lowest">
          <img src="/pitchlab-logo-new.png" alt="" className="h-7 w-auto" />
          <span className="text-primary font-semibold text-xl tracking-tight">Rehearse</span>
        </div>

        {/* Vertically centered; in-place toggle keeps Y stable when form height changes */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 lg:px-8 py-10">
          <div className="w-full max-w-[400px]">
            <div className="text-center mb-8 lg:hidden">
              <h2 className="text-on-surface font-semibold text-2xl leading-8 mb-1">
                {copy.headline}
              </h2>
              <p className="text-on-surface-variant text-sm">{copy.subtext}</p>
            </div>

            <AuthRoleToggle active={role} onChange={handleRoleChange} />

            {role === "student" ? (
              <form
                onSubmit={(e) => void handleStudentSubmit(e)}
                className="flex flex-col gap-5"
                autoComplete="off"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="fullName">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    minLength={USERNAME_MIN_LENGTH}
                    maxLength={USERNAME_MAX_LENGTH}
                    pattern="[a-zA-Z0-9_]+"
                    placeholder="Choose a username"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <span className="text-xs text-on-surface-variant">
                    3–20 characters, letters, numbers and underscores only
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="student-password">
                    Password
                  </label>
                  <input
                    id="student-password"
                    type="password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    placeholder="Create a strong password"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[13px] font-medium text-on-surface flex items-center gap-1"
                    htmlFor="classCode"
                  >
                    Class Code
                    <span className="text-on-surface-variant font-normal">(optional)</span>
                  </label>
                  <input
                    id="classCode"
                    type="text"
                    maxLength={JOIN_CODE_LENGTH}
                    placeholder="e.g. CS101A"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={joinCode}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setJoinCode(next);
                      if (role === "student") {
                        syncSignupUrl("student", next);
                      }
                    }}
                  />
                </div>

                {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 mt-1 bg-primary-container text-white rounded text-[13px] font-medium hover:bg-opacity-90 transition-colors disabled:opacity-60"
                >
                  {isLoading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => void handleProfessorSubmit(e)}
                className="flex flex-col gap-5"
                autoComplete="off"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="prof-fullName">
                    Full Name
                  </label>
                  <input
                    id="prof-fullName"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="prof-email">
                    Institutional Email
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    required
                    placeholder="jane.doe@university.edu"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-on-surface" htmlFor="prof-password">
                    Password
                  </label>
                  <input
                    id="prof-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-10 px-4 rounded border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
                    value={professorPassword}
                    onChange={(e) => setProfessorPassword(e.target.value)}
                  />
                </div>

                {error.length > 0 ? <p className="text-sm text-error">{error}</p> : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 mt-1 bg-primary-container text-white rounded text-[13px] font-medium hover:bg-opacity-90 transition-colors disabled:opacity-60"
                >
                  {isLoading ? "Creating…" : "Create Account"}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-on-surface-variant">
              Already have an account?{" "}
              <Link
                href={role === "professor" ? "/login?role=professor" : "/login?role=student"}
                className="font-medium text-secondary hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
