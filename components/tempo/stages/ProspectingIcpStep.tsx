/**
 * ProspectingIcpStep.tsx
 * ICP definition step — two separate fields (ideal customer + pursuit signals).
 */

"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";

const ICP_FIELD_MIN_LENGTH = 10;
const ICP_FIELD_MAX_LENGTH = 500;

import {
  OPENING_MESSAGE_TIPS,
  type ProspectingWizardState,
} from "@/lib/tempo-prospecting";

type ProspectingIcpStepProps = {
  attemptId: string;
  icpField1: string;
  icpField2: string;
  onFieldChange: <K extends keyof ProspectingWizardState>(
    key: K,
    value: ProspectingWizardState[K]
  ) => void;
};

/**
 * Two-field ICP form persisted on the wizard draft.
 */
export function ProspectingIcpStep({
  attemptId: _attemptId,
  icpField1,
  icpField2,
  onFieldChange,
}: ProspectingIcpStepProps): React.ReactElement {
  return (
    <div className="bg-surface text-on-surface font-body-md min-h-full p-gutter">
      <main className="w-full max-w-3xl mx-auto space-y-xl">
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

        <div className="space-y-lg">
          <div className="space-y-sm">
            <div className="flex justify-between items-center">
              <label className="font-bold text-label-md text-on-surface" htmlFor="icp-field-1">
                Who is Tempo&apos;s ideal customer?
              </label>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {icpField1.length} / {ICP_FIELD_MAX_LENGTH} characters
              </span>
            </div>
            <textarea
              id="icp-field-1"
              rows={5}
              maxLength={ICP_FIELD_MAX_LENGTH}
              className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none transition-all placeholder:text-outline-variant font-body-md resize-y min-h-[128px]"
              placeholder="Example: Appointment-based businesses with 2-20 locations..."
              value={icpField1}
              onChange={(e) => onFieldChange("icpField1", e.target.value)}
            />
            {icpField1.trim().length > 0 && icpField1.trim().length < ICP_FIELD_MIN_LENGTH ? (
              <p className="text-label-sm text-on-surface-variant">
                Add at least {ICP_FIELD_MIN_LENGTH} characters to continue.
              </p>
            ) : null}
          </div>

          <div className="space-y-sm">
            <div className="flex justify-between items-center">
              <label className="font-bold text-label-md text-on-surface" htmlFor="icp-field-2">
                What signals tell you a prospect is worth pursuing?
              </label>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {icpField2.length} / {ICP_FIELD_MAX_LENGTH} characters
              </span>
            </div>
            <textarea
              id="icp-field-2"
              rows={5}
              maxLength={ICP_FIELD_MAX_LENGTH}
              className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary-container focus:border-secondary focus:outline-none transition-all placeholder:text-outline-variant font-body-md resize-y min-h-[128px]"
              placeholder="Example: Recent expansion, job listings for front desk staff..."
              value={icpField2}
              onChange={(e) => onFieldChange("icpField2", e.target.value)}
            />
            {icpField2.trim().length > 0 && icpField2.trim().length < ICP_FIELD_MIN_LENGTH ? (
              <p className="text-label-sm text-on-surface-variant">
                Add at least {ICP_FIELD_MIN_LENGTH} characters to continue.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
