/**
 * tempo-onboarding-script.ts
 * ~90-second onboarding narration for the Tempo simulation welcome video (Avatar III + slide deck).
 * Consumed by scripts/generate-heygen-video.ts — do not alter without re-running the generator.
 */

export type OnboardingScriptSegment = {
  slideId: string;
  script: string;
};

/** One segment per slide — avatar speaks over the matching deck background. */
export const TEMPO_ONBOARDING_SEGMENTS: OnboardingScriptSegment[] = [
  {
    slideId: "welcome",
    script:
      "Welcome to Tempo. You've joined as an Account Executive. In this simulation, you'll run one real deal from first research to signed contract — the same scope of work you'd face in your first month on the job.",
  },
  {
    slideId: "product",
    script:
      "Tempo is scheduling automation for appointment-based businesses — dental practices, clinics, salons, and similar teams. They lose revenue to no-shows, manual front-desk work, and demand they miss after hours. Your product fixes those problems.",
  },
  {
    slideId: "assignment",
    script:
      "Your territory includes dozens of candidate accounts. Your job is to qualify the market, select the account with the strongest fit, and identify the decision maker who actually owns this purchase.",
  },
  {
    slideId: "stages",
    script:
      "You'll advance through five stages: prospecting, a live discovery call, a written presentation, objection handling, and negotiation to close. Each stage tests whether you can find signal, build trust, and move the deal forward.",
  },
  {
    slideId: "ready",
    script:
      "Nothing here is handed to you. Some paths will be dead ends — that's intentional. Rewatch this briefing anytime from your dashboard. When you're ready, start Stage One and go find your first customer.",
  },
];

/** Full narration concatenated — useful for logging and duration estimates. */
export const TEMPO_ONBOARDING_SCRIPT = TEMPO_ONBOARDING_SEGMENTS.map((segment) => segment.script).join(
  " "
);
