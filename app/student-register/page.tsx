/**
 * page.tsx — student-register
 * Redirect shim — legacy student register URL → unified /signup.
 * Preserves ?code= when present.
 */

import { redirect } from "next/navigation";

type PageProps = {
  searchParams: { code?: string };
};

/**
 * Forwards to /signup?role=student, passing through any join code.
 */
export default function StudentRegisterPage({ searchParams }: PageProps): never {
  const code = searchParams.code?.trim().toUpperCase() ?? "";
  if (code.length > 0) {
    redirect(`/signup?role=student&code=${encodeURIComponent(code)}`);
  }
  redirect("/signup?role=student");
}
