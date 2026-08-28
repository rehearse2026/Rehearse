/**
 * CallLayout.tsx
 * Active Anam video-call overlay — Stitch immersive in-call design.
 * Also exports shared call-stage layout class names used by Avatar and stages.
 */

"use client";

import { useState } from "react";
import { PhoneEndIcon } from "@/components/ui/CallIcons";
import { CALL_OVERLAY_INSET_PX } from "@/lib/constants";

/** Minimum height for phone and video call containers (pipeline stays visible above). */
export const CALL_STAGE_MIN_HEIGHT_CLASS = "call-stage-min-h";

/** Viewport height fraction for call containers — must stay below 100vh. */
export const CALL_STAGE_MIN_HEIGHT_VH = 92;

/** Full-bleed persona video — overlays sit on top. */
export const CALL_VIDEO_BOTTOM_DOCK_PX = 0;

/** Persona video frame — full bleed inside the call box. */
export const CALL_PERSONA_VIDEO_FRAME_CLASS = "call-persona-video-frame";

/** Persona WebRTC video — cover fill with gradient overlay. */
export const CALL_PERSONA_VIDEO_CLASS = "call-persona-video";

/** Gradient vignette on the persona video. */
export const CALL_PERSONA_VIDEO_GRADIENT_CLASS = "call-persona-video-gradient";

type CallLayoutProps = {
  stageLabel: string;
  formattedTimer: string;
  personaName: string;
  statusText?: string;
  studentVideoRef: React.RefCallback<HTMLVideoElement | null>;
  showStudentPip: boolean;
  cameraUnavailable: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  userTranscripts: string;
  personaTranscripts: string;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
};

const END_CALL_ICON_CLASS = "block h-[18px] w-[18px] shrink-0";

const callStyle = {
  "--call-inset": `${CALL_OVERLAY_INSET_PX}px`,
  "--call-video-dock-h": `${CALL_VIDEO_BOTTOM_DOCK_PX}px`,
} as React.CSSProperties;

function MicIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function MicMutedIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 10.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 2.5V8l-4 2.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SubtitlesIcon({ filled = false }: { filled?: boolean }): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10h6M7 14h10" strokeLinecap="round" />
    </svg>
  );
}

function TimerIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

/**
 * Stitch immersive in-call overlay inside the call box.
 */
export function CallLayout({
  stageLabel,
  formattedTimer,
  personaName,
  statusText = "",
  studentVideoRef,
  showStudentPip,
  cameraUnavailable,
  isMuted,
  isCameraOff,
  userTranscripts,
  personaTranscripts,
  onToggleMute,
  onToggleCamera,
  onEndCall,
}: CallLayoutProps): React.ReactElement {
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const stageBadge = stageLabel.toUpperCase();
  const hasPersonaText = personaTranscripts.length > 0;
  const hasUserText = userTranscripts.length > 0;

  const pipShell =
    "pointer-events-auto absolute right-6 top-24 z-40 aspect-[3/4] w-36 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-white"
      style={callStyle}
    >
      {/* Top header */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-start justify-between px-6 pt-6">
        <div className="flex max-w-[min(100%,480px)] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/90">
              {stageBadge}
            </span>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#2036bd]/20 px-2 py-0.5 backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#bbc3ff]" />
              <span className="font-mono text-[10px] uppercase text-white/80">Live</span>
            </div>
          </div>
          {statusText.length > 0 && (
            <p className="text-sm text-white/70">{statusText}</p>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-md">
          <TimerIcon />
          <span className="font-mono text-xs tabular-nums text-white">{formattedTimer}</span>
        </div>
      </header>

      {/* PiP */}
      {showStudentPip && (
        <div className={pipShell}>
          <video
            ref={studentVideoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full scale-x-[-1] object-cover opacity-90 ${isCameraOff ? "opacity-0" : ""}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white/50">
              Camera off
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur-md">
            <PersonIcon />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest">You</span>
          </div>
        </div>
      )}

      {cameraUnavailable && !showStudentPip && (
        <div className={`${pipShell} flex items-center justify-center text-xs text-white/50`}>
          Camera unavailable
        </div>
      )}

      {/* Bottom bar — transcript + controls side by side */}
      <footer
        className={`pointer-events-none absolute bottom-4 left-4 right-4 z-50 flex items-end gap-3 ${transcriptVisible ? "" : "justify-end"}`}
      >
        {transcriptVisible && (
          <div className="pointer-events-auto min-w-0 max-h-[72px] flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#bbc3ff]">
                {personaName}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            {hasUserText && hasPersonaText && (
              <p className="mb-1 line-clamp-1 text-xs leading-snug text-white/60">
                <span className="font-mono uppercase tracking-wider text-white/40">You · </span>
                {userTranscripts}
              </p>
            )}
            {hasPersonaText ? (
              <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                &ldquo;{personaTranscripts}&rdquo;
              </p>
            ) : hasUserText ? (
              <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                {userTranscripts}
              </p>
            ) : (
              <p className="text-xs italic text-white/50">Live transcript will appear here…</p>
            )}
          </div>
        )}

        <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 p-2 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            className={`rounded-full p-3 text-white transition-all hover:bg-white/10 active:scale-90 ${isMuted ? "bg-white/10 text-red-300" : ""}`}
          >
            {isMuted ? <MicMutedIcon /> : <MicIcon />}
          </button>

          <button
            type="button"
            onClick={onToggleCamera}
            disabled={cameraUnavailable}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
            className={`rounded-full p-3 text-white transition-all hover:bg-white/10 active:scale-90 disabled:opacity-40 ${isCameraOff ? "bg-white/10 text-red-300" : ""}`}
          >
            <CameraIcon />
          </button>

          <button
            type="button"
            onClick={() => setTranscriptVisible((v) => !v)}
            aria-label={transcriptVisible ? "Hide transcript" : "Show transcript"}
            className={`rounded-full p-3 text-white transition-all active:scale-90 ${transcriptVisible ? "bg-[#91112b] hover:bg-[#91112b]/80" : "hover:bg-white/10"}`}
          >
            <SubtitlesIcon filled={transcriptVisible} />
          </button>

          <div className="mx-1 h-8 w-px bg-white/10" />

          <button
            type="button"
            onClick={onEndCall}
            aria-label="End call"
            className="flex items-center gap-2 rounded-full bg-[#ba1a1a] py-3 pl-3 pr-5 text-white transition-all hover:opacity-90 active:scale-90"
          >
            <PhoneEndIcon className={END_CALL_ICON_CLASS} />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">End</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
