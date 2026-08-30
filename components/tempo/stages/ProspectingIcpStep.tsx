/**
 * ProspectingIcpStep.tsx
 * ICP step — separate fields for profile, qualification, and trigger (legacy layout).
 */

"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { ProspectingWizardState } from "@/lib/tempo-prospecting";

const FIELD_MAX_LENGTH = 500;

type ProspectingIcpStepProps = {
  attemptId: string;
  state: ProspectingWizardState;
  onFieldChange: <K extends keyof ProspectingWizardState>(
    key: K,
    value: ProspectingWizardState[K]
  ) => void;
};

/**
 * Multi-field ICP / qualification / trigger form persisted on the wizard draft.
 */
export function ProspectingIcpStep({
  attemptId: _attemptId,
  state,
  onFieldChange,
}: ProspectingIcpStepProps): React.ReactElement {
  return (
    <div className="bg-surface text-on-surface font-body-md min-h-full p-gutter">
      <main className="w-full max-w-4xl mx-auto space-y-xl pb-xl">
        <div className="space-y-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Ideal Customer Profile</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Defining your ICP is the foundation of every successful sales campaign. Be as specific
            as possible about the organizations and personas that derive the most value from your
            solution.
          </p>
        </div>

        <div className="bg-secondary-fixed text-on-secondary-fixed p-md rounded-lg flex gap-md items-start shadow-sm border border-secondary-container/20">
          <MaterialIcon name="lightbulb" className="text-secondary font-bold shrink-0" />
          <div className="space-y-xs">
            <h2 className="font-bold text-label-md">Rehearse Tip</h2>
            <p className="text-label-md leading-relaxed opacity-90">
              Focus on pain points rather than demographics. A customer&apos;s industry matters less
              than the specific problem they are trying to solve right now.
            </p>
          </div>
        </div>

        <section className="space-y-lg">
          <div className="space-y-sm">
            <div className="flex justify-between items-center">
              <label className="font-bold text-label-md text-on-surface" htmlFor="icp-field-1">
                Who is Tempo&apos;s ideal customer?
              </label>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {state.icpField1.length} / {FIELD_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="icp-field-1"
              rows={4}
              maxLength={FIELD_MAX_LENGTH}
              className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none font-body-md resize-y"
              placeholder="Example: Appointment-based businesses with 2-20 locations..."
              value={state.icpField1}
              onChange={(e) => onFieldChange("icpField1", e.target.value)}
            />
          </div>

          <div className="space-y-sm">
            <div className="flex justify-between items-center">
              <label className="font-bold text-label-md text-on-surface" htmlFor="icp-field-2">
                What signals tell you a prospect is worth pursuing?
              </label>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {state.icpField2.length} / {FIELD_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="icp-field-2"
              rows={4}
              maxLength={FIELD_MAX_LENGTH}
              className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none font-body-md resize-y"
              placeholder="Example: Recent expansion, job listings for front desk staff..."
              value={state.icpField2}
              onChange={(e) => onFieldChange("icpField2", e.target.value)}
            />
          </div>
        </section>

        {state.icpField1.trim() ? (
          <div
            className="p-lg rounded-lg border-l-4 border-l-secondary"
            style={{
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="flex items-center gap-md mb-md">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <MaterialIcon name="target" className="text-secondary" />
              </div>
              <div>
                <h2 className="font-label-md font-bold text-primary uppercase tracking-wider">
                  Your ICP summary
                </h2>
                <p className="font-label-sm text-on-surface-variant">
                  Recall your primary target criteria as you qualify accounts.
                </p>
              </div>
            </div>
            <p className="font-body-md text-on-surface-variant italic border-l-2 border-outline-variant pl-md">
              &ldquo;{state.icpField1.slice(0, 150)}
              {state.icpField1.length > 150 ? "..." : ""}&rdquo;
            </p>
          </div>
        ) : null}

        <section className="space-y-lg">
          <h2 className="font-headline-md text-headline-md text-primary">Account Qualification</h2>

          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
            <label className="block font-label-md font-bold text-primary mb-md" htmlFor="fit-justification">
              Why does your target account fit?
            </label>
            <textarea
              id="fit-justification"
              rows={4}
              maxLength={FIELD_MAX_LENGTH}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-secondary focus:border-transparent p-md resize-y"
              placeholder="Outline the specific signals that match your target to your ICP..."
              value={state.fitJustification}
              onChange={(e) => onFieldChange("fitJustification", e.target.value)}
            />
            <div className="mt-sm flex justify-between items-center">
              <p className="font-label-sm text-outline">Aim for 2-3 specific examples.</p>
              <p className="font-label-sm text-outline">{state.fitJustification.length} / {FIELD_MAX_LENGTH}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
            <h3 className="font-label-md font-bold text-primary mb-md">Decision Maker Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div>
                <label className="font-label-sm text-outline mb-1 block" htmlFor="dm-name">
                  Full Name
                </label>
                <input
                  id="dm-name"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary p-2"
                  placeholder="e.g. Dana Reyes"
                  value={state.dmName}
                  onChange={(e) => onFieldChange("dmName", e.target.value)}
                />
              </div>
              <div>
                <label className="font-label-sm text-outline mb-1 block" htmlFor="dm-role">
                  Role / Title
                </label>
                <input
                  id="dm-role"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary p-2"
                  placeholder="e.g. Director of Operations"
                  value={state.dmRole}
                  onChange={(e) => onFieldChange("dmRole", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
            <h3 className="font-label-md font-bold text-primary mb-lg">Qualification Scores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div>
                <label className="block font-label-sm text-outline uppercase mb-2" htmlFor="fit-rating">
                  Fit Rating
                </label>
                <select
                  id="fit-rating"
                  className="w-full appearance-none bg-surface-container-low border border-outline-variant rounded-lg py-2.5 px-3 font-body-md focus:ring-2 focus:ring-secondary"
                  value={state.fitRating}
                  onChange={(e) => onFieldChange("fitRating", e.target.value)}
                >
                  <option value="">Select rating...</option>
                  <option value="strong">Strong Fit</option>
                  <option value="moderate">Moderate Fit</option>
                  <option value="weak">Weak Fit</option>
                  <option value="no">Not a Fit</option>
                </select>
              </div>
              <div>
                <label className="block font-label-sm text-outline uppercase mb-2" htmlFor="confidence">
                  Confidence Level
                </label>
                <select
                  id="confidence"
                  className="w-full appearance-none bg-surface-container-low border border-outline-variant rounded-lg py-2.5 px-3 font-body-md focus:ring-2 focus:ring-secondary"
                  value={state.confidence}
                  onChange={(e) => onFieldChange("confidence", e.target.value)}
                >
                  <option value="">Select confidence...</option>
                  <option value="high">High — Solid Data</option>
                  <option value="medium">Medium — Educated Guess</option>
                  <option value="low">Low — Needs Verification</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-lg">
          <header>
            <span className="inline-flex items-center gap-xs text-secondary font-bold text-label-sm uppercase tracking-wider mb-sm">
              <MaterialIcon name="bolt" className="text-sm" />
              Contextual Intelligence
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
              Defining Your Trigger Event
            </h2>
            <p className="text-body-md text-on-surface-variant max-w-2xl">
              A trigger event is a specific, observable change in the prospect&apos;s world that
              creates an immediate opening for your solution.
            </p>
          </header>

          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
            <label className="block font-label-md font-bold text-on-surface mb-sm" htmlFor="trigger-event">
              Describe your primary trigger event
            </label>
            <textarea
              id="trigger-event"
              rows={4}
              maxLength={FIELD_MAX_LENGTH}
              className="w-full border border-outline-variant rounded-lg p-md font-body-md focus:ring-2 focus:ring-secondary-container focus:border-secondary resize-none"
              placeholder="Example: Summit Dental just opened their 8th location three months ago..."
              value={state.triggerEvent}
              onChange={(e) => onFieldChange("triggerEvent", e.target.value)}
            />
            <div className="flex justify-between items-center mt-sm">
              <p className="text-label-sm text-on-surface-variant italic">Focus on timing and relevance.</p>
              <span className="text-label-sm text-on-surface-variant">
                {state.triggerEvent.length} / {FIELD_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-md bg-surface-container-low border-b border-outline-variant">
              <h3 className="font-headline-md text-body-lg font-bold">Trigger Quality Benchmark</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-lg border-b md:border-b-0 md:border-r border-outline-variant bg-green-50/30">
                <div className="flex items-center gap-sm mb-md text-emerald-700">
                  <MaterialIcon name="check_circle" />
                  <span className="font-bold text-label-md uppercase">Strong Trigger</span>
                </div>
                <ul className="space-y-md text-body-md">
                  <li>
                    <strong>Specific Growth:</strong> Opening 8th practice — manual scheduling is
                    straining.
                  </li>
                  <li>
                    <strong>Hiring Signal:</strong> Job listing for front desk coordinator suggests
                    overload.
                  </li>
                </ul>
              </div>
              <div className="p-lg bg-red-50/30">
                <div className="flex items-center gap-sm mb-md text-error">
                  <MaterialIcon name="cancel" />
                  <span className="font-bold text-label-md uppercase">Weak Trigger</span>
                </div>
                <ul className="space-y-md text-body-md">
                  <li>
                    <strong>Generic Intent:</strong> They seem like they might want to grow soon.
                  </li>
                  <li>
                    <strong>No Trigger:</strong> I wanted to introduce myself and our product.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
