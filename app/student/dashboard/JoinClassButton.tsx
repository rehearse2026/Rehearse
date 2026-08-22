/**
 * JoinClassButton.tsx
 * Modal for logged-in students to enroll in an additional class.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

/**
 * Opens a modal to join a class by code — POST /api/student/join-class.
 */
export function JoinClassButton(): React.ReactElement {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary-container text-on-primary px-4 h-10 rounded-xl font-label-md text-label-md hover:bg-primary-container/90 transition-all duration-300 shadow-sm hover:shadow-md whitespace-nowrap"
      >
        Join a Class
      </button>

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
