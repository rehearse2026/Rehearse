/**
 * EmptyState.tsx
 * Centered empty list placeholder — Stitch surface treatment.
 */

type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/**
 * Renders emoji/icon, title, optional description and CTA.
 */
export function EmptyState({
  icon = "📋",
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm py-16 px-6 text-center">
      {icon ? (
        <p className="text-4xl mb-4" aria-hidden>
          {icon}
        </p>
      ) : null}
      <p className="font-headline-md text-headline-md text-on-surface">{title}</p>
      {description && (
        <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
