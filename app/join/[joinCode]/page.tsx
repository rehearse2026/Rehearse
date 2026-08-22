/**
 * join/[joinCode]/page.tsx
 * Redirect shim — class-specific invite URL → unified signup with code prefilled.
 */

import { redirect } from "next/navigation";

type PageProps = { params: { joinCode: string } };

/**
 * Forwards to /signup?role=student&code={joinCode}.
 */
export default function JoinClassPage({ params }: PageProps): never {
  const joinCode = params.joinCode.trim().toUpperCase();
  redirect(`/signup?role=student&code=${encodeURIComponent(joinCode)}`);
}
