/**
 * register/page.tsx
 * Redirect shim — legacy professor register URL → unified /signup.
 */

import { redirect } from "next/navigation";

/**
 * Sends visitors to the unified signup page with professor role selected.
 */
export default function RegisterPage(): never {
  redirect("/signup?role=professor");
}
