/**
 * ProspectingIcpStep.tsx
 * ICP step — target verticals, size range, operational signals, and disqualifiers.
 */

"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  parseIcpLocationCount,
  type ProspectingWizardState,
} from "@/lib/tempo-prospecting";

const FIELD_MAX_LENGTH = 500;
const DISQUALIFIER_MAX_LENGTH = 120;

type ProspectingIcpStepProps = {
  attemptId: string;
  state: ProspectingWizardState;
  onFieldChange: <K extends keyof ProspectingWizardState>(
    key: K,
    value: ProspectingWizardState[K]
  ) => void;
};

/**
 * Four-group ICP form persisted on the wizard draft.
 */
export function ProspectingIcpStep({
  attemptId: _attemptId,
  state,
  onFieldChange,
}: ProspectingIcpStepProps): React.ReactElement {
  const minLoc = parseIcpLocationCount(state.icpSizeMinLocations);
  const maxLoc = parseIcpLocationCount(state.icpSizeMaxLocations);
  const sizeRangeInvalid =
    state.icpSizeMinLocations.trim() !== "" &&
    state.icpSizeMaxLocations.trim() !== "" &&
    (minLoc === null || maxLoc === null || maxLoc < minLoc);

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-full p-gutter">
      <main className="w-full max-w-4xl mx-auto space-y-xl pb-xl">
        <div className="space-y-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Ideal Customer Profile</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Define who you are hunting for before you open the data room. Be specific about
            verticals, size, fit signals, and what rules a prospect out.
          </p>
        </div>

        <div className="bg-secondary-fixed text-on-secondary-fixed p-md rounded-lg flex gap-md items-start shadow-sm border border-secondary-container/20">
          <MaterialIcon name="lightbulb" className="text-secondary font-bold shrink-0" />
          <div className="space-y-xs">
            <h2 className="font-bold text-label-md">Rehearse Tip</h2>
            <p className="text-label-md leading-relaxed opacity-90">
              Strong ICPs combine firmographic filters (vertical + size) with operational signals
              you can verify in research — not just demographics.
            </p>
          </div>
        </div>

        <section className="space-y-sm">
          <div className="flex justify-between items-center">
            <label className="font-bold text-label-md text-on-surface" htmlFor="icp-target-verticals">
              Target verticals
            </label>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {state.icpTargetVerticals.length} / {FIELD_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="icp-target-verticals"
            rows={3}
            maxLength={FIELD_MAX_LENGTH}
            className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none font-body-md resize-y"
            placeholder="Example: Multi-location dental groups, specialty clinics expanding regionally..."
            value={state.icpTargetVerticals}
            onChange={(e) => onFieldChange("icpTargetVerticals", e.target.value)}
          />
        </section>

        <section className="space-y-sm">
          <h2 className="font-bold text-label-md text-on-surface">Size range</h2>
          <p className="font-label-sm text-on-surface-variant">
            How many locations should your ideal account operate?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div>
              <label className="font-label-sm text-outline mb-1 block" htmlFor="icp-size-min">
                Min locations
              </label>
              <input
                id="icp-size-min"
                type="number"
                min={1}
                inputMode="numeric"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary p-md font-body-md"
                placeholder="e.g. 2"
                value={state.icpSizeMinLocations}
                onChange={(e) => onFieldChange("icpSizeMinLocations", e.target.value)}
              />
            </div>
            <div>
              <label className="font-label-sm text-outline mb-1 block" htmlFor="icp-size-max">
                Max locations
              </label>
              <input
                id="icp-size-max"
                type="number"
                min={1}
                inputMode="numeric"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary p-md font-body-md"
                placeholder="e.g. 20"
                value={state.icpSizeMaxLocations}
                onChange={(e) => onFieldChange("icpSizeMaxLocations", e.target.value)}
              />
            </div>
          </div>
          {sizeRangeInvalid ? (
            <p className="font-label-sm text-error">
              Enter valid location counts with max greater than or equal to min.
            </p>
          ) : null}
        </section>

        <section className="space-y-sm">
          <div className="flex justify-between items-center">
            <label
              className="font-bold text-label-md text-on-surface"
              htmlFor="icp-operational-signals"
            >
              Operational signals that predict fit
            </label>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {state.icpOperationalSignals.length} / {FIELD_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="icp-operational-signals"
            rows={5}
            maxLength={FIELD_MAX_LENGTH}
            className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none font-body-md resize-y"
            placeholder="Example: Recent location openings, front-desk hiring spikes, manual scheduling bottlenecks across sites..."
            value={state.icpOperationalSignals}
            onChange={(e) => onFieldChange("icpOperationalSignals", e.target.value)}
          />
          <p className="font-label-sm text-on-surface-variant">
            List observable signals you can verify during research — not generic intent.
          </p>
        </section>

        <section className="space-y-md">
          <div>
            <h2 className="font-bold text-label-md text-on-surface">Disqualifiers</h2>
            <p className="font-label-sm text-on-surface-variant mt-xs">
              Name 2–3 hard rules that mean you walk away, even if the account looks interesting.
            </p>
          </div>
          <div className="space-y-md">
            {(
              [
                {
                  id: "icp-disqualifier-1",
                  key: "icpDisqualifier1" as const,
                  label: "Disqualifier 1",
                  required: true,
                },
                {
                  id: "icp-disqualifier-2",
                  key: "icpDisqualifier2" as const,
                  label: "Disqualifier 2",
                  required: true,
                },
                {
                  id: "icp-disqualifier-3",
                  key: "icpDisqualifier3" as const,
                  label: "Disqualifier 3",
                  required: false,
                },
              ] as const
            ).map((field) => (
              <div key={field.id} className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-outline" htmlFor={field.id}>
                    {field.label}
                    {!field.required ? " (optional)" : ""}
                  </label>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {state[field.key].length} / {DISQUALIFIER_MAX_LENGTH}
                  </span>
                </div>
                <input
                  id={field.id}
                  type="text"
                  maxLength={DISQUALIFIER_MAX_LENGTH}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary p-md font-body-md"
                  placeholder={
                    field.key === "icpDisqualifier1"
                      ? "e.g. Single-location solo practice"
                      : field.key === "icpDisqualifier2"
                        ? "e.g. No appointment-based scheduling workflow"
                        : "e.g. Already locked into a multi-year competitor contract"
                  }
                  value={state[field.key]}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {state.icpTargetVerticals.trim() ? (
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
              &ldquo;{state.icpTargetVerticals.slice(0, 150)}
              {state.icpTargetVerticals.length > 150 ? "..." : ""}&rdquo;
            </p>
            {minLoc !== null && maxLoc !== null && maxLoc >= minLoc ? (
              <p className="font-label-sm text-on-surface-variant mt-sm pl-md">
                Size: {minLoc}–{maxLoc} locations
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
