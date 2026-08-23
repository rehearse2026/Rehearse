/**
 * JoinClassButton.tsx
 * Modal for logged-in students to enroll in an additional class.
 * Trigger visuals mirror professor add-class patterns (primary / tile / empty CTA).
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useToast } from "@/hooks/useToast";

export type JoinClassButtonVariant = "primary" | "tile" | "empty";

type JoinClassButtonProps = {
  /** Visual treatment for the trigger — modal/API logic is shared */
  variant?: JoinClassButtonVariant;
  className?: string;
};

/**
 * Opens a modal to join a class by code — POST /api/student/join-class.
 */
export function JoinClassButton({
  variant = "primary",
  className = "",
}: JoinClassButtonProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = (): void => {
    setOpen(false);
    setJoinCode("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const res = await fetch("/api/student/join-class", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
    });

    const body = (await res.json()) as { error?: string; className?: string };
    setIsLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not join class.");
      return;
    }

    showToast(`Joined ${body.className ?? "class"}!`, "success");
    handleClose();
    router.refresh();
  };

  const trigger =
    variant === "tile" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`bg-surface-container-low border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-xl text-center hover:bg-surface-container-high transition-colors duration-150 cursor-pointer group h-full min-h-[220px] ${className}`}
      >
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-md group-hover:scale-110 transition-transform duration-200">
          <MaterialIcon name="add_box" className="text-[32px] text-primary" />
        </div>
        <p className="font-headline-md text-headline-md text-primary">Join a Class</p>
        <p className="text-on-surface-variant text-body-md max-w-[200px]">
          Enter your professor&apos;s class code to enroll and start practicing.
        </p>
      </button>
    ) : variant === "empty" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`bg-primary-container text-white font-bold rounded-lg px-6 h-10 flex items-center gap-2 hover:opacity-90 transition-opacity duration-150 ${className}`}
      >
        <MaterialIcon name="add_circle" className="text-[20px]" />
        Join Class
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-md py-2.5 bg-primary-container text-white rounded-lg hover:opacity-90 font-label-md active:scale-95 ${className}`}
      >
        <MaterialIcon name="add" />
        Join a Class
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay animate-overlay-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          role="presentation"
        >
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl max-w-[440px] w-full p-8 animate-modal-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-headline-md text-primary">Join a Class</h2>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block font-label-md font-bold text-on-surface mb-2">
                  Class Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  className="w-full h-10 px-4 border border-outline-variant rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary font-code-md uppercase tracking-widest transition-all duration-150"
                  placeholder="e.g. MKTG202"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
                <p className="text-label-sm text-on-surface-variant mt-1">
                  Ask your professor for the class code
                </p>
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-10 border border-outline-variant text-on-surface font-bold rounded-lg hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || joinCode.length < 4}
                  className="flex-1 h-10 bg-primary-container text-white font-bold rounded-lg hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Class"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
