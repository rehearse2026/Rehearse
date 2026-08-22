/**
 * signup/page.tsx
 * Redirect shim — legacy /signup URLs forward to the correct dedicated signup page.
 */

import { redirect } from "next/navigation";

type PageProps = {
  searchParams: { role?: string; code?: string };
};

/**
 * ?role=student → /student-register (preserves ?code=); otherwise → /register.
 */
export default function SignupPage({ searchParams }: PageProps): never {
  const role = searchParams.role?.trim().toLowerCase() ?? "";
  const code = searchParams.code?.trim().toUpperCase() ?? "";

  if (role === "student") {
    if (code.length > 0) {
      redirect(`/student-register?code=${encodeURIComponent(code)}`);
    }
    redirect("/student-register");
  }

  redirect("/register");
}
