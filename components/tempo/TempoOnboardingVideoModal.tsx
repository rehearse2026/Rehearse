/**
 * TempoOnboardingVideoModal.tsx
 * Modal player for the Tempo onboarding welcome video on the simulation entry page.
 * Exports TempoOnboardingVideoTrigger — a self-contained button + modal for TempoEntryFreshStart.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { TEMPO_ONBOARDING_VIDEO_URL } from "@/lib/tempo-onboarding-video";

type TempoOnboardingVideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Full-screen modal with HTML5 video, Skip, and Close controls.
 */
export function TempoOnboardingVideoModal({
  isOpen,
  onClose,
}: TempoOnboardingVideoModalProps): React.ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const requestClose = useCallback((): void => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, requestClose]);

  useEffect(() => {
    if (!isOpen || !videoRef.current) {
      return;
    }
    void videoRef.current.play().catch(() => {
      /* autoplay may be blocked until user interacts */
    });
  }, [isOpen]);

  if (!isMounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-8 ${
        isClosing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tempo-onboarding-video-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`w-full max-w-4xl rounded-xl bg-primary-container border border-white/10 shadow-2xl overflow-hidden ${
          isClosing ? "animate-modal-out" : "animate-modal-in"
        }`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
          <h2
            id="tempo-onboarding-video-title"
            className="font-display text-headline-md text-white"
          >
            Welcome to Tempo
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
            aria-label="Close onboarding video"
          >
            <MaterialIcon name="close" className="text-[20px]" />
            Close
          </button>
        </div>

        <div className="bg-black aspect-video">
          <video
            ref={videoRef}
            key={TEMPO_ONBOARDING_VIDEO_URL}
            src={TEMPO_ONBOARDING_VIDEO_URL}
            controls
            playsInline
            className="h-full w-full object-contain"
          >
            <track kind="captions" />
          </video>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={requestClose}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Entry-page trigger button that opens the onboarding video modal.
 */
export function TempoOnboardingVideoTrigger(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-body-lg text-white border border-white/30 hover:border-white/60 hover:bg-white/10 transition-all"
      >
        <MaterialIcon name="play_circle" className="text-[22px]" />
        Watch Onboarding Video
      </button>
      <TempoOnboardingVideoModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
