/**
 * EmptyState.tsx
 * Centered empty list placeholder — Stitch / portal surface treatment.
 */

type EmptyStateProps = {
  /** Emoji (legacy) or leave empty when using materialIcon */
  icon?: string;
  /** Material Symbols name — preferred when set */
  materialIcon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/**
 * Renders icon, title, optional description and CTA.
 */
export function EmptyState({
  icon = "📋",
  materialIcon,
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm py-16 px-6 text-center">
      {materialIcon ? (
        <span
          className="material-symbols-outlined text-5xl text-outline-variant mb-4 inline-block"
          aria-hidden
        >
          {materialIcon}
        </span>
      ) : icon ? (
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
