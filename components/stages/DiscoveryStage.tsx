/**
 * DiscoveryStage.tsx
 * Anam video-call stage — uses shared AvatarCallStage orchestrator.
 */

"use client";

import { AvatarCallStage } from "@/components/call/AvatarCallStage";
import type { Simulation, SimulationStage } from "@/types";

type DiscoveryStageProps = {
  simulation: Simulation;
  attemptId: string;
  runningTotalScore: number;
  onComplete: (nextStage: SimulationStage) => void;
};

/**
 * Discovery — video call with persona; scored after End Call.
 */
export function DiscoveryStage({
  simulation,
  attemptId,
  runningTotalScore,
  onComplete,
}: DiscoveryStageProps): React.ReactElement {
  return (
    <AvatarCallStage
      simulation={simulation}
      attemptId={attemptId}
      stage="discovery"
      stageHint="DISCOVERY STAGE: Answer the student's questions in character. Do not agree to buy yet."
      openingGreeting={`Yeah? I'm ${simulation.persona_name} — what do you want to know?`}
      scoreStage="discovery"
      runningTotalScore={runningTotalScore}
      advanceLabel="Next Stage"
      onAdvance={() => onComplete("presentation")}
    />
  );
}
