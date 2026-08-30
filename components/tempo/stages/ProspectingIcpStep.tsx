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
    <div className="w-full h-full min-h-full space-y-xl p-4 lg:p-xl pb-xl">
      <h1 className="font-headline-lg text-headline-lg text-primary">Ideal Customer Profile</h1>

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
          placeholder="Example: Recent location openings, front desk hiring spikes, manual scheduling bottlenecks across sites..."
          value={state.icpOperationalSignals}
          onChange={(e) => onFieldChange("icpOperationalSignals", e.target.value)}
        />
        <p className="font-label-sm text-on-surface-variant">
          List observable signals you can verify during research, not generic intent.
        </p>
      </section>

      <section className="space-y-md">
        <div>
          <h2 className="font-bold text-label-md text-on-surface">Disqualifiers</h2>
          <p className="font-label-sm text-on-surface-variant mt-xs">
            Name 2-3 hard rules that mean you walk away, even if the account looks interesting.
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
        <section className="space-y-sm">
          <div className="flex items-center gap-md">
            <MaterialIcon name="target" className="text-secondary" />
            <h2 className="font-label-md font-bold text-primary uppercase tracking-wider">
              Your ICP summary
            </h2>
          </div>
          <p className="font-body-md text-on-surface-variant italic">
            &ldquo;{state.icpTargetVerticals.slice(0, 150)}
            {state.icpTargetVerticals.length > 150 ? "..." : ""}&rdquo;
          </p>
          {minLoc !== null && maxLoc !== null && maxLoc >= minLoc ? (
            <p className="font-label-sm text-on-surface-variant">
              Size: {minLoc}-{maxLoc} locations
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
