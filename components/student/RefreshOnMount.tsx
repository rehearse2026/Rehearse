/**
 * RefreshOnMount.tsx
 * Forces a server re-fetch when landing on a page so Start/Continue
 * reflects the latest attempt progress after soft navigations.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Triggers router.refresh() once on mount.
 */
export function RefreshOnMount(): null {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
