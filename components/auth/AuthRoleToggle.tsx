/**
 * AuthRoleToggle.tsx
 * Student / Professor segmented control for auth pages.
 */

"use client";

import { useRouter } from "next/navigation";

export type AuthRole = "student" | "professor";

type AuthRoleToggleProps = {
  /** Currently selected role. */
  active: AuthRole;
  /**
   * When set, switching roles navigates to these hrefs instead of calling onChange.
   * Used on separate signup pages so each route owns its form.
   */
  hrefs?: { student: string; professor: string };
  /** Local role change (used on unified /login). */
  onChange?: (role: AuthRole) => void;
};

/**
 * Segmented Student/Professor toggle matching the login Stitch control.
 */
export function AuthRoleToggle({
  active,
  hrefs,
  onChange,
}: AuthRoleToggleProps): React.ReactElement {
  const router = useRouter();

  const select = (role: AuthRole): void => {
    if (role === active) {
      return;
    }
    if (hrefs) {
      router.push(hrefs[role]);
      return;
    }
    onChange?.(role);
  };

  return (
    <div className="mb-6">
      <div className="relative flex bg-surface-container-low rounded-lg p-1">
        <span
          aria-hidden
          className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            active === "professor" ? "translate-x-full" : "translate-x-0"
          }`}
        />
        <button
          type="button"
          onClick={() => select("student")}
          className={`relative z-10 flex-1 py-2 text-center text-sm rounded-md transition-colors ${
            active === "student"
              ? "font-semibold text-primary-container"
              : "font-medium text-on-surface-variant"
          }`}
        >
          Student
        </button>
        <button
          type="button"
          onClick={() => select("professor")}
          className={`relative z-10 flex-1 py-2 text-center text-sm rounded-md transition-colors ${
            active === "professor"
              ? "font-semibold text-primary-container"
              : "font-medium text-on-surface-variant"
          }`}
        >
          Professor
        </button>
      </div>
    </div>
  );
}
