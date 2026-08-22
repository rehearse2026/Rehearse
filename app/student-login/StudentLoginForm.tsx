/**
 * StudentLoginForm.tsx
 * Client form for returning student login with username and password.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Login form — POST /api/student/login then redirect to dashboard.
 */
export function StudentLoginForm(): React.ReactElement {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const body = (await res.json()) as { error?: string };
    setIsLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Login failed.");
      return;
    }

    router.push("/student/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4" autoComplete="off">
      <label className="block text-sm font-medium text-text-primary">
        Username
        <input
          type="text"
          required
          className="input-field mt-1"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium text-text-primary">
        Password
        <input
          type="password"
          required
          className="input-field mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button type="submit" disabled={isLoading} className="w-full btn-primary">
        {isLoading ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-sm text-text-secondary text-center">
        New student?{" "}
        <Link href="/signup?role=student" className="text-accent font-medium hover:underline">
          Create an account
        </Link>
      </p>
      <p className="text-sm text-text-secondary text-center">
        Forgot your username? Contact your professor.
      </p>
    </form>
  );
}
