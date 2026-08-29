/**
 * TempoOnboardingVideoModal.tsx
 * Onboarding welcome video for Tempo simulation entry — inline player (fresh start) and modal trigger (in progress).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { TEMPO_ONBOARDING_VIDEO_URL } from "@/lib/tempo-onboarding-video";

const CENTER_CONTROL_HIDE_MS = 900;

type OnboardingVideoPlayerProps = {
  autoPlay?: boolean;
  className?: string;
};

/**
 * Custom onboarding player — center play/pause overlay (auto-hides while playing), no native controls.
 */
function OnboardingVideoPlayer({
  autoPlay = false,
  className,
}: OnboardingVideoPlayerProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideOverlayTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCenterControl, setShowCenterControl] = useState(true);

  const clearHideTimer = useCallback((): void => {
    if (hideOverlayTimerRef.current !== null) {
      window.clearTimeout(hideOverlayTimerRef.current);
      hideOverlayTimerRef.current = null;
    }
  }, []);

  const scheduleHideCenterControl = useCallback((): void => {
    clearHideTimer();
    hideOverlayTimerRef.current = window.setTimeout(() => {
      setShowCenterControl(false);
    }, CENTER_CONTROL_HIDE_MS);
  }, [clearHideTimer]);

  const togglePlay = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onPlay = (): void => {
      setIsPlaying(true);
      scheduleHideCenterControl();
    };
    const onPause = (): void => {
      setIsPlaying(false);
      clearHideTimer();
      setShowCenterControl(true);
    };
    const onEnded = (): void => {
      setIsPlaying(false);
      clearHideTimer();
      setShowCenterControl(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      clearHideTimer();
    };
  }, [clearHideTimer, scheduleHideCenterControl]);

  useEffect(() => {
    if (!autoPlay || !videoRef.current) {
      return;
    }
    void videoRef.current.play().catch(() => {
      setShowCenterControl(true);
    });
  }, [autoPlay]);

  return (
    <div
      className={`relative h-full w-full ${className ?? ""}`}
      onMouseEnter={() => {
        if (isPlaying) {
          setShowCenterControl(true);
        }
      }}
      onMouseLeave={() => {
        if (isPlaying) {
          scheduleHideCenterControl();
        }
      }}
    >
      <video
        ref={videoRef}
        src={TEMPO_ONBOARDING_VIDEO_URL}
        playsInline
        preload="metadata"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        className="h-full w-full object-contain cursor-pointer bg-black"
        onClick={() => {
          void togglePlay();
        }}
      >
        <track kind="captions" />
      </video>

      <button
        type="button"
        aria-label={isPlaying ? "Pause video" : "Play video"}
        onClick={(event) => {
          event.stopPropagation();
          void togglePlay();
        }}
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          showCenterControl ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm shadow-lg">
          <MaterialIcon
            name={isPlaying ? "pause" : "play_arrow"}
            className="text-[36px] text-white"
          />
        </span>
      </button>
    </div>
  );
}

type TempoOnboardingVideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Full-screen modal with custom video player, Skip, and Close controls.
 */
export function TempoOnboardingVideoModal({
  isOpen,
  onClose,
}: TempoOnboardingVideoModalProps): React.ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

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

        <div className="aspect-video bg-black">
          <OnboardingVideoPlayer autoPlay />
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
 * Inline hero player — embedded below the fresh-start briefing, no modal.
 */
export function TempoOnboardingVideoInline(): React.ReactElement {
  return (
    <div className="w-full">
      <div className="text-white/50 text-[12px] font-bold tracking-widest uppercase mb-3">
        Onboarding Briefing
      </div>
      <div className="rounded-xl border border-white/10 overflow-hidden bg-black shadow-2xl aspect-video">
        <OnboardingVideoPlayer />
      </div>
    </div>
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
