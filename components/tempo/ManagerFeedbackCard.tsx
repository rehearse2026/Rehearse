/**
 * ManagerFeedbackCard.tsx
 * Affirmed / corrected coaching card for manager notes (ICP and reusable).
 * Matches HandoffModal / ConvertFailureModal visual language.
 */

"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type ManagerFeedbackVariant = "affirmed" | "corrected";

type ManagerFeedbackCardProps = {
  variant: ManagerFeedbackVariant;
  text: string;
  onContinue: () => void;
  continueLabel?: string;
};

/**
 * Centered manager-note card with always-enabled Continue.
 */
export function ManagerFeedbackCard({
  variant,
  text,
  onContinue,
  continueLabel = "Continue",
}: ManagerFeedbackCardProps): React.ReactElement {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  const isAffirmed = variant === "affirmed";

  return (
    <div
      className={`bg-surface-container-lowest w-full max-w-[560px] rounded-xl shadow-xl overflow-hidden border border-outline-variant transition-all duration-300 ${
        entered ? "animate-modal-in" : "opacity-0 scale-95 translate-y-2"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manager-feedback-title"
    >
      <div className="px-4 py-2 flex justify-between items-center bg-primary-container">
        <span className="font-code-md text-[10px] tracking-widest text-on-primary uppercase">
          MESSAGE FROM YOUR MANAGER
        </span>
        <span className="font-code-md text-[10px] tracking-widest text-on-primary uppercase">
          {isAffirmed ? "Affirmed" : "Coaching"}
        </span>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-headline-md bg-secondary-fixed text-on-secondary-fixed">
            AT
          </div>
          <div>
            <h2 id="manager-feedback-title" className="font-headline-md text-on-surface">
              Alex Torres
            </h2>
            <p className="font-label-sm text-on-surface-variant">Senior Sales Manager</p>
          </div>
        </div>

        <div className="bg-surface-container-low p-4 rounded-r-lg border-l-4 border-tertiary-container">
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon
              name={isAffirmed ? "check_circle" : "lightbulb"}
              className={`text-[18px] ${
                isAffirmed ? "text-green-700" : "text-secondary"
              }`}
            />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6c3a00]">
              {isAffirmed ? "Nice work" : "A note from your manager"}
            </p>
          </div>
          <p className="font-body-lg text-on-surface leading-relaxed italic">{text}</p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full h-12 rounded-lg font-headline-md flex items-center justify-center gap-2 bg-primary-container text-white font-bold hover:bg-primary transition-all active:scale-[0.98]"
        >
          {continueLabel}
          <MaterialIcon name="arrow_forward" />
        </button>
      </div>

      <div className="h-1 bg-gradient-to-r from-tertiary-container via-secondary-fixed to-secondary-container opacity-50" />
    </div>
  );
}
