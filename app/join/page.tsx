/**
 * join/page.tsx
 * Redirect shim — generic join landing → unified student signup.
 */

import { redirect } from "next/navigation";

/**
 * Forwards to /signup with student role (class code entered on the form).
 */
export default function JoinPage(): never {
  redirect("/signup?role=student");
}
