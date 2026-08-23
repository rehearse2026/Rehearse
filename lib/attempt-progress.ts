/**
 * attempt-progress.ts
 * Shared helpers for detecting whether a student has meaningfully started an attempt.
 */

import type { SimulationStage } from "@/types";

/**
 * True when an in_progress attempt has real student progress — not a blank lead_gen shell.
 * Matches Tempo entry mid-sim rules: ICP / wizard draft in stage_data, or past lead_gen,
 * or any completed stage_scores rows.
 */
export function attemptHasStartedProgress(options: {
  currentStage: SimulationStage | string | null | undefined;
  stageData: unknown;
  stagesCompleted?: number;
}): boolean {
  if ((options.stagesCompleted ?? 0) > 0) {
    return true;
  }

  const stage = options.currentStage ?? null;
  if (!stage) {
    return false;
  }

  // Anything past the Stage-1 shell means the student is mid-simulation.
  if (stage !== "lead_gen") {
    return true;
  }

  return stageDataHasMeaningfulProgress(options.stageData);
}

/**
 * True when stage_data contains ICP / prospecting wizard progress (not null/empty).
 */
export function stageDataHasMeaningfulProgress(stageData: unknown): boolean {
  if (stageData == null || typeof stageData !== "object") {
    return false;
  }

  const data = stageData as Record<string, unknown>;
  if (Object.keys(data).length === 0) {
    return false;
  }

  if (data.icp != null) {
    return true;
  }
  if (data.icpGateComplete === true) {
    return true;
  }
  if (typeof data.currentStep === "number" && data.currentStep > 0) {
    return true;
  }
  if (typeof data.selectedLeadId === "string" && data.selectedLeadId.trim()) {
    return true;
  }
  if (typeof data.openingMessage === "string" && data.openingMessage.trim()) {
    return true;
  }
  if (data.companyChats && typeof data.companyChats === "object") {
    const chats = data.companyChats as Record<string, unknown>;
    if (Object.keys(chats).length > 0) {
      return true;
    }
  }

  // Any other persisted keys (directory cache, handoff flags, etc.) count as started.
  return Object.keys(data).length > 0;
}
