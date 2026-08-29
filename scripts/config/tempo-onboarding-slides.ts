/**
 * tempo-onboarding-slides.ts
 * Slide copy for the Tempo onboarding deck — rendered to PNG by render-onboarding-slides.ts.
 */

export type OnboardingSlide = {
  id: string;
  title: string;
  subtitle?: string;
  bullets: string[];
};

export const TEMPO_ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    title: "Welcome to Tempo",
    subtitle: "Your First Deal Simulation",
    bullets: [
      "Account Executive onboarding",
      "One territory · One target account · One full sales cycle",
    ],
  },
  {
    id: "product",
    title: "What Is Tempo?",
    subtitle: "Scheduling automation for appointment-based businesses",
    bullets: [
      "Reduce costly no-shows with smart reminders",
      "Free the front desk from manual scheduling",
      "Capture after-hours demand automatically",
    ],
  },
  {
    id: "assignment",
    title: "Your Assignment",
    subtitle: "Find the right account — then win it",
    bullets: [
      "Research a real prospect directory in your territory",
      "Qualify accounts and identify the true decision maker",
      "Build outreach that earns a conversation",
    ],
  },
  {
    id: "stages",
    title: "The Five Stages",
    subtitle: "Prospecting → Close",
    bullets: [
      "1. Prospecting — qualify and reach out",
      "2. Discovery — live call to uncover pain",
      "3. Presentation — tailored value pitch",
      "4. Objections — handle pushback on a call",
      "5. Negotiation — close the annual contract",
    ],
  },
  {
    id: "ready",
    title: "How to Succeed",
    subtitle: "This is real practice — not a scripted walkthrough",
    bullets: [
      "Follow signal, not assumptions — dead ends are part of the job",
      "Substance and communication are both scored",
      "Rewatch this briefing anytime · Begin when you're ready",
    ],
  },
];
