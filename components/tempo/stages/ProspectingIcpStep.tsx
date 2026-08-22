/**
 * ProspectingIcpStep.tsx
 * Pre-wizard "Define Your Ideal Customer" gate for Tempo Prospecting.
 * Form layout matches the Stitch HTML reference; feedback uses ManagerFeedbackCard.
 */

"use client";

import { useState } from "react";
import { ManagerFeedbackCard } from "@/components/tempo/ManagerFeedbackCard";
import type { IcpCheckResult, ProspectingIcpState } from "@/lib/tempo-icp-criteria";

type ProspectingIcpStepProps = {
  attemptId: string;
  /** Restored mid-feedback state after a prior submit (feedbackSeen still false). */
  initialIcp: ProspectingIcpState | null;
  onComplete: (icp: ProspectingIcpState) => void;
};

type FeedbackView = {
  result: IcpCheckResult;
  displayText: string;
  activeIcpText: string;
  originalText: string;
};

/**
 * ICP form + non-blocking manager feedback continue gate.
 */
export function ProspectingIcpStep({
  attemptId,
  initialIcp,
  onComplete,
}: ProspectingIcpStepProps): React.ReactElement {
  const [icpText, setIcpText] = useState(initialIcp?.originalText ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackView | null>(() => {
    if (initialIcp && !initialIcp.feedbackSeen) {
      return {
        result: initialIcp.result,
        displayText: initialIcp.displayText,
        activeIcpText: initialIcp.activeIcpText,
        originalText: initialIcp.originalText,
      };
    }
    return null;
  });

  const handleSubmit = async (): Promise<void> => {
    const trimmed = icpText.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/student/icp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, icpText: trimmed }),
      });

      if (!res.ok) {
        throw new Error("ICP check failed");
      }

      const body = (await res.json()) as {
        result: IcpCheckResult;
        displayText: string;
        activeIcpText: string;
      };

      setFeedback({
        result: body.result,
        displayText: body.displayText,
        activeIcpText: body.activeIcpText,
        originalText: trimmed,
      });
    } catch {
      setError("Could not check your ICP right now. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = async (): Promise<void> => {
    if (!feedback) {
      return;
    }

    const next: ProspectingIcpState = {
      originalText: feedback.originalText,
      result: feedback.result,
      displayText: feedback.displayText,
      activeIcpText: feedback.activeIcpText,
      feedbackSeen: true,
    };

    try {
      await fetch("/api/student/icp-check", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, feedbackSeen: true }),
      });
    } catch {
      /* local continue still unlocks the wizard */
    }

    onComplete(next);
  };

  if (feedback) {
    return (
      <div className="bg-surface text-on-surface font-body-md min-h-full flex items-center justify-center p-gutter">
        <ManagerFeedbackCard
          variant={feedback.result}
          text={feedback.displayText}
          onContinue={() => void handleContinue()}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-full flex items-center justify-center p-gutter">
      <main className="w-full max-w-[800px] mx-auto">
        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm overflow-hidden flex flex-col">
          <header className="px-gutter pt-gutter pb-md border-b border-outline-variant/30 flex flex-col gap-sm">
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Define Your Ideal Customer
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-prose">
              Before you go looking for accounts, decide what you&apos;re actually looking for. Who
              is Tempo&apos;s ideal customer, and why?
            </p>
          </header>

          <section className="p-gutter flex-1 flex flex-col gap-lg">
            <div className="flex flex-col gap-sm">
              <label
                className="font-label-md text-label-md text-on-surface flex items-center justify-between"
                htmlFor="icp-textarea"
              >
                Your ICP
                <span className="text-on-surface-variant font-normal">Required</span>
              </label>
              <textarea
                id="icp-textarea"
                rows={8}
                value={icpText}
                onChange={(e) => setIcpText(e.target.value)}
                placeholder="e.g., Multi-location appointment-based businesses that are still scheduling manually and showing signs of real operational strain as they grow..."
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded focus:ring-2 focus:ring-secondary focus:border-secondary transition-all font-body-md text-body-md text-on-surface placeholder:text-outline resize-y min-h-[160px]"
              />
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">
                Describe the kind of business Tempo should be targeting — industry, size, current
                situation, what makes them a strong fit right now.
              </p>
              {error ? (
                <p className="font-label-sm text-label-sm text-error mt-xs">{error}</p>
              ) : null}
            </div>
          </section>

          <footer className="px-gutter py-md border-t border-outline-variant/30 bg-surface-container-low/50 flex justify-end">
            <button
              type="button"
              disabled={!icpText.trim() || isSubmitting}
              onClick={() => void handleSubmit()}
              className={`h-[40px] px-lg font-label-md text-label-md rounded flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-colors ${
                icpText.trim() && !isSubmitting
                  ? "bg-primary-container text-on-primary hover:bg-primary cursor-pointer"
                  : "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Checking…" : "Submit ICP"}
            </button>
          </footer>
        </article>
      </main>
    </div>
  );
}
