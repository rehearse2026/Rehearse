/**
 * page.tsx — student-login
 * Redirect shim — legacy student login URL → unified /login?role=student.
 */

import { redirect } from "next/navigation";

/**
 * Forwards returning students to the unified login with student role selected.
 */
export default function StudentLoginPage(): never {
  redirect("/login?role=student");
}
