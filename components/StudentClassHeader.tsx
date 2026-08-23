/**
 * StudentClassHeader.tsx
 * Class banner for non-default student class detail pages.
 */

import { resolveClassColorScheme } from "@/lib/class-appearance";
import type { ClassColorSchemeId } from "@/types";

type StudentClassHeaderProps = {
  className: string;
  cardImageUrl?: string | null;
  cardColorScheme?: ClassColorSchemeId | null;
  /** Optional body copy shown on the banner (from class description) */
  description?: string | null;
};

/**
 * Gradient or image header reflecting professor-configured class appearance.
 */
export function StudentClassHeader({
  className,
  cardImageUrl,
  cardColorScheme,
  description,
}: StudentClassHeaderProps): React.ReactElement {
  const scheme = resolveClassColorScheme(cardColorScheme);
  const image = cardImageUrl?.trim() || null;
  const subtitle = description?.trim() || null;

  return (
    <div className="relative rounded-xl overflow-hidden min-h-[240px] flex flex-col justify-end p-6 lg:p-8 border border-outline-variant shadow-sm">
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            background: image
              ? `url(${image}) center/cover`
              : `linear-gradient(135deg, ${scheme.gradientFrom}, ${scheme.gradientTo})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/30 mix-blend-multiply" />
      </div>
      <div className="relative z-10 flex flex-col gap-2 max-w-3xl">
        <h2 className="font-display text-display text-on-primary">{className}</h2>
        {subtitle && (
          <p className="font-body-lg text-body-lg text-on-primary/80">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
