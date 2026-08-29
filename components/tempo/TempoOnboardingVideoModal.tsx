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
 * Custom onboarding player — center play/pause overlay plus volume and captions controls.
 */
function OnboardingVideoPlayer({
  autoPlay = false,
  className,
}: OnboardingVideoPlayerProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideOverlayTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  const clearHideTimer = useCallback((): void => {
    if (hideOverlayTimerRef.current !== null) {
      window.clearTimeout(hideOverlayTimerRef.current);
      hideOverlayTimerRef.current = null;
    }
  }, []);

  const scheduleHideChrome = useCallback((): void => {
    clearHideTimer();
    hideOverlayTimerRef.current = window.setTimeout(() => {
      setShowChrome(false);
    }, CENTER_CONTROL_HIDE_MS);
  }, [clearHideTimer]);

  const revealChrome = useCallback((): void => {
    clearHideTimer();
    setShowChrome(true);
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

  const toggleMute = useCallback((): void => {
    setIsMuted((muted) => !muted);
  }, []);

  const handleVolumeChange = useCallback((nextVolume: number): void => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  }, []);

  const toggleCaptions = useCallback((): void => {
    setCaptionsOn((on) => !on);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = captionsOn ? "showing" : "hidden";
    }
  }, [captionsOn]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onPlay = (): void => {
      setIsPlaying(true);
      scheduleHideChrome();
    };
    const onPause = (): void => {
      setIsPlaying(false);
      clearHideTimer();
      setShowChrome(true);
    };
    const onEnded = (): void => {
      setIsPlaying(false);
      clearHideTimer();
      setShowChrome(true);
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
  }, [clearHideTimer, scheduleHideChrome]);

  useEffect(() => {
    if (!autoPlay || !videoRef.current) {
      return;
    }
    void videoRef.current.play().catch(() => {
      setShowChrome(true);
    });
  }, [autoPlay]);

  const displayVolume = isMuted ? 0 : volume;

  return (
    <div
      className={`relative h-full w-full group ${className ?? ""}`}
      onMouseEnter={revealChrome}
      onMouseLeave={() => {
        if (isPlaying) {
          scheduleHideChrome();
        }
      }}
      onMouseMove={revealChrome}
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
        <track kind="captions" srcLang="en" label="English" default={false} />
      </video>

      <button
        type="button"
        aria-label={isPlaying ? "Pause video" : "Play video"}
        onClick={(event) => {
          event.stopPropagation();
          void togglePlay();
        }}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ${
          showChrome ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/55 backdrop-blur-sm shadow-lg">
          <MaterialIcon
            name={isPlaying ? "pause" : "play_arrow"}
            className="text-[36px] text-white"
          />
        </span>
      </button>

      <div
        className={`absolute inset-x-0 bottom-0 z-20 px-4 pb-3 pt-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent transition-opacity duration-300 ${
          showChrome ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
            className="text-white/90 hover:text-white transition-colors"
          >
            <MaterialIcon
              name={isMuted || volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}
              className="text-[22px]"
            />
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={displayVolume}
            onChange={(event) => handleVolumeChange(Number(event.target.value))}
            aria-label="Video volume"
            className="h-1 w-24 sm:w-32 cursor-pointer accent-white"
          />

          <button
            type="button"
            onClick={toggleCaptions}
            aria-label={captionsOn ? "Hide captions" : "Show captions"}
            aria-pressed={captionsOn}
            className={`ml-auto transition-colors ${
              captionsOn ? "text-white" : "text-white/60 hover:text-white/90"
            }`}
          >
            <MaterialIcon name="closed_caption" className="text-[22px]" />
          </button>
        </div>
      </div>
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
