/**
 * SimulationStartLink.tsx
 * Start/Continue CTA with brief entry loading screen before navigation.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIMULATION_ENTRY_LOADER_MS } from "@/lib/constants";

type SimulationStartLinkProps = {
  href: string;
  label: string;
  simulationTitle: string;
  /** Visual variant — continue (filled) vs start (outline) */
  variant?: "continue" | "start";
};

/**
 * Shows navy loader overlay then navigates to the simulation page.
 */
export function SimulationStartLink({
  href,
  label,
  simulationTitle,
  variant = "start",
}: SimulationStartLinkProps): React.ReactElement {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = (): void => {
    setIsLoading(true);
    window.setTimeout(() => {
      router.push(href);
    }, SIMULATION_ENTRY_LOADER_MS);
  };

  const buttonClass =
    variant === "continue"
      ? "h-10 px-6 bg-primary-container text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary transition-colors flex items-center gap-2"
      : "h-10 px-6 bg-surface text-primary border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors flex items-center gap-2";

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-primary text-white">
          <p className="text-2xl font-bold tracking-tight">Rehearse</p>
          <p className="text-sm text-white/70 mt-3 max-w-xs text-center px-6">
            {simulationTitle}
          </p>
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mt-8" />
        </div>
      )}
      <button type="button" onClick={handleClick} className={buttonClass}>
        {label}
        {variant === "continue" && (
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            arrow_forward
          </span>
        )}
      </button>
    </>
  );
}
