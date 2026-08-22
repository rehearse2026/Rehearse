/**
 * AuthRoleToggle.tsx
 * Student / Professor segmented control — same slider animation as /login.
 */

"use client";

export type AuthRole = "student" | "professor";

type AuthRoleToggleProps = {
  active: AuthRole;
  onChange: (role: AuthRole) => void;
};

/**
 * In-place segmented toggle; keeps the slider mounted so the slide animates smoothly.
 */
export function AuthRoleToggle({
  active,
  onChange,
}: AuthRoleToggleProps): React.ReactElement {
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
          onClick={() => onChange("student")}
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
          onClick={() => onChange("professor")}
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
