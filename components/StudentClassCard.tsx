/**
 * StudentClassCard.tsx
 * Clickable class card on the student dashboard — Stitch visual treatment.
 */

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  DEFAULT_CLASS_BANNER_URL,
  DEFAULT_CLASS_DESCRIPTION,
  DEFAULT_CLASS_NAME,
} from "@/lib/constants";
import { resolveClassColorScheme } from "@/lib/class-appearance";
import type { ClassColorSchemeId } from "@/types";

type StudentClassCardProps = {
  classId: string;
  className: string;
  description?: string | null;
  cardImageUrl?: string | null;
  cardColorScheme?: ClassColorSchemeId | null;
  simulationCount: number;
  isSystemDefault?: boolean;
};

/**
 * Student-facing class card; links to the class simulations page.
 */
export function StudentClassCard({
  classId,
  className,
  description,
  cardImageUrl,
  cardColorScheme,
  simulationCount,
  isSystemDefault = false,
}: StudentClassCardProps): React.ReactElement {
  const scheme = resolveClassColorScheme(cardColorScheme);
  const image = cardImageUrl?.trim() || null;
  const displayName = isSystemDefault ? DEFAULT_CLASS_NAME : className;
  const subtitle = isSystemDefault ? DEFAULT_CLASS_DESCRIPTION : description?.trim() || null;
  const simLabel =
    simulationCount === 0
      ? "No simulations yet"
      : `${simulationCount} simulation${simulationCount === 1 ? "" : "s"}`;

  const bannerStyle: CSSProperties = isSystemDefault
    ? {
        backgroundImage: `url(${DEFAULT_CLASS_BANNER_URL})`,
      }
    : image
      ? {
          backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${image})`,
        }
      : {
          backgroundImage: `linear-gradient(135deg, ${scheme.gradientFrom}, ${scheme.gradientTo})`,
        };

  return (
    <Link
      href={`/student/classes/${classId}`}
      className={`bg-surface-container-lowest rounded-xl border-l-4 border border-outline-variant shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:shadow-md hover:border-r-outline hover:border-y-outline transition-all ${
        isSystemDefault ? "border-l-primary" : ""
      }`}
      style={isSystemDefault ? undefined : { borderLeftColor: scheme.accent }}
    >
      <div className="relative h-24 w-full bg-cover bg-center" style={bannerStyle}>
        {isSystemDefault && (
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container/80 to-transparent" />
        )}
        {isSystemDefault && (
          <span className="absolute bottom-2 left-2 bg-surface/20 text-on-primary font-label-sm text-label-sm px-2 py-1 rounded-xl backdrop-blur-sm">
            Available to all students
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-headline-md text-headline-md text-on-surface">{displayName}</h3>
        {subtitle && (
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-end justify-between gap-2">
          <span className="inline-flex items-center font-label-sm text-label-sm px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant">
            {simLabel}
          </span>
          <span
            className={`material-symbols-outlined text-[20px] opacity-0 group-hover:opacity-100 transition-opacity ${
              isSystemDefault ? "text-primary" : ""
            }`}
            style={isSystemDefault ? undefined : { color: scheme.accent }}
            aria-hidden
          >
            arrow_forward
          </span>
        </div>
      </div>
    </Link>
  );
}
