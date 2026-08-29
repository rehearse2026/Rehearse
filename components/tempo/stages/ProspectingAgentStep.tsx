/**
 * ProspectingAgentStep.tsx
 * Placeholder for the "Build Your Agent" wizard step (index 2).
 * Non-blocking — students pass through via wizard Next chrome only.
 */

"use client";

type ProspectingAgentStepProps = {
  attemptId: string;
};

/**
 * Minimal placeholder until the agent builder is implemented.
 */
export function ProspectingAgentStep({
  attemptId: _attemptId,
}: ProspectingAgentStepProps): React.ReactElement {
  return (
    <div className="bg-surface text-on-surface font-body-md min-h-full flex items-center justify-center p-gutter">
      <main className="w-full max-w-[800px] mx-auto">
        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm overflow-hidden flex flex-col">
          <header className="px-gutter pt-gutter pb-md border-b border-outline-variant/30 flex flex-col gap-sm">
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Build Your Prospecting Agent
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-prose">
              You just researched accounts and shortlisted targets by hand. In this step you will
              design an AI system that can do that prospecting work for you — with the guardrails
              and judgment you built along the way.
            </p>
          </header>

          <section className="p-gutter flex-1">
            <p className="font-body-md text-body-md text-on-surface-variant">
              This step is coming soon. Use <span className="font-medium text-on-surface">Next</span>{" "}
              to continue to lead selection.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
