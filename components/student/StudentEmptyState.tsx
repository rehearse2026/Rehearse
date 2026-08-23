/**
 * StudentEmptyState.tsx
 * Centered empty state matching professor empty-state visual language.
 */

import { FadeIn } from "@/components/professor/FadeIn";

type StudentEmptyStateProps = {
  icon: string;
  heading: string;
  description: string;
  action?: React.ReactNode;
};

/**
 * Material icon + heading + description + optional CTA.
 */
export function StudentEmptyState({
  icon,
  heading,
  description,
  action,
}: StudentEmptyStateProps): React.ReactElement {
  return (
    <FadeIn className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-4" aria-hidden>
        {icon}
      </span>
      <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{heading}</h3>
      <p className="text-on-surface-variant font-body-md max-w-xs mb-6">{description}</p>
      {action}
    </FadeIn>
  );
}
