/**
 * DiscoveryCallSession.tsx
 * Audio Simli voice call for Tempo Stage 2 Discovery.
 * Receives the microphone stream the student enabled in the lobby — it never
 * calls getUserMedia itself, so no device indicator turns on here. Bubbles
 * transcript, timer, and end-of-call data up to the parent DiscoveryStage.
 *
 * Avatar must stay mounted for the whole call (no remount on connect) — remounting
 * tears down the Simli WebRTC session and silences Dana.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  formatDiscoveryTime,
  parseDiscoveryTranscript,
  type DiscoveryTranscriptEntry,
} from "@/lib/tempo-discovery";
import {
  DANA_REYES_SYSTEM_PROMPT,
  TEMPO_DISCOVERY_OPENING_GREETING,
  TEMPO_DISCOVERY_STAGE_HINT,
} from "@/lib/constants";
import { resumePlaybackContext } from "@/lib/audio-playback";
import { useSimulationVoiceSession } from "@/hooks/useSimulationVoiceSession";
import type { AvatarRef } from "@/types";

type DiscoveryCallSessionProps = {
  attemptId: string;
  faceId: string;
  audioStream: MediaStream;
  onActive: () => void;
  onError: (message: string) => void;
  onTranscriptChange: (entries: DiscoveryTranscriptEntry[]) => void;
  onSecondsChange: (seconds: number) => void;
  onEnded: (
    transcriptText: string,
    seconds: number,
    entries: DiscoveryTranscriptEntry[]
  ) => void;
};

/**
 * Waits until Avatar imperative handle and media elements are ready.
 */
async function waitForAvatarReady(
  getRef: () => AvatarRef | null,
  maxMs = 8000
): Promise<AvatarRef | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const avatar = getRef();
    if (avatar) {
      const domReady = await avatar.waitForMediaElements(2000);
      if (domReady) {
        return avatar;
      }
    }
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  return getRef();
}

/**
 * Mounts the voice session on the lobby-supplied stream and renders call UI.
 */
export function DiscoveryCallSession({
  attemptId,
  faceId,
  audioStream,
  onActive,
  onError,
  onTranscriptChange,
  onSecondsChange,
  onEnded,
}: DiscoveryCallSessionProps): React.ReactElement {
  const [connected, setConnected] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const connectStartedRef = useRef(false);
  const isMutedRef = useRef(false);
  const secondsRef = useRef(0);
  const activeAudioStreamRef = useRef(audioStream);

  const voice = useSimulationVoiceSession({
    systemPrompt: DANA_REYES_SYSTEM_PROMPT,
    stageHint: TEMPO_DISCOVERY_STAGE_HINT,
    openingGreeting: TEMPO_DISCOVERY_OPENING_GREETING,
    isMutedRef,
    attemptId,
    anamStage: "discovery",
  });

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const callbacksRef = useRef({ onActive, onError });
  callbacksRef.current = { onActive, onError };

  // ── Connect once on mount (mic already granted in the lobby) ───
  useEffect(() => {
    if (connectStartedRef.current) {
      return;
    }
    connectStartedRef.current = true;

    const run = async (): Promise<void> => {
      await resumePlaybackContext();

      const avatar = await waitForAvatarReady(() => voiceRef.current.avatarRef.current);
      if (!avatar) {
        callbacksRef.current.onError("Could not connect to Dana Reyes. Reload and try again.");
        return;
      }

      if (audioStream.getAudioTracks().length === 0) {
        callbacksRef.current.onError("Microphone stream unavailable. Reload and try again.");
        return;
      }

      try {
        avatar.resumeAudioContext();
        await voiceRef.current.startCall(audioStream);
        await resumePlaybackContext();
        setConnected(true);
        callbacksRef.current.onActive();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not start voice session. Reload and try again.";
        callbacksRef.current.onError(message);
      }
    };

    void run();
  }, [audioStream]);

  // ── Call timer (local) ───
  useEffect(() => {
    if (!connected) {
      return;
    }
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      secondsRef.current = elapsed;
      setSeconds(elapsed);
    }, 1000);
    return () => window.clearInterval(id);
  }, [connected]);

  useEffect(() => {
    onSecondsChange(seconds);
  }, [seconds, onSecondsChange]);

  // ── Bubble live transcript up to parent ───
  useEffect(() => {
    if (!connected) {
      return;
    }
    const raw = voiceRef.current.getFullTranscript();
    onTranscriptChange(parseDiscoveryTranscript(raw, secondsRef.current));
  }, [voice.userTranscripts, voice.personaTranscripts, connected, onTranscriptChange]);

  const toggleMute = useCallback((): void => {
    if (micMuted) {
      void (async (): Promise<void> => {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const track = micStream.getAudioTracks()[0];
          if (!track) {
            micStream.getTracks().forEach((t) => t.stop());
            return;
          }
          const nextStream = new MediaStream([track]);
          activeAudioStreamRef.current = nextStream;
          isMutedRef.current = false;
          setMicMuted(false);
          voiceRef.current.resumeMic(nextStream);
        } catch {
          /* stay muted */
        }
      })();
      return;
    }

    isMutedRef.current = true;
    setMicMuted(true);
    activeAudioStreamRef.current.getAudioTracks().forEach((track) => track.stop());
    voiceRef.current.pauseMic();
  }, [micMuted]);

  const handleEndCall = useCallback((): void => {
    const finalSeconds = secondsRef.current;
    voiceRef.current.endCall();
    activeAudioStreamRef.current.getTracks().forEach((track) => track.stop());
    const raw = voiceRef.current.getFullTranscript();
    const entries = parseDiscoveryTranscript(raw, finalSeconds);
    onEnded(raw, finalSeconds, entries);
  }, [onEnded]);

  return (
    <section className="flex-1 bg-[#0a0a0a] relative flex flex-col items-center justify-center p-lg min-w-0 overflow-hidden">
      <div className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black">
        {/* Single Avatar mount for the whole call — do not remount when connected flips. */}
        <Avatar ref={voice.avatarRef} faceId={faceId} />

        {!connected && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
            <div className="w-10 h-10 border-2 border-white/20 border-t-tertiary-container rounded-full animate-spin" />
            <p className="mt-4 text-sm text-white/70">Connecting to Dana Reyes…</p>
            {voice.statusText.length > 0 && (
              <p className="mt-2 text-xs text-white/50 max-w-sm text-center px-4">
                {voice.statusText}
              </p>
            )}
          </div>
        )}

        {connected && (
          <>
            <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-black/45 backdrop-blur-md px-3 py-2">
              <p className="text-white font-headline-md text-sm">Dana Reyes</p>
              <p className="text-white/60 font-label-sm text-[11px]">
                Director of Operations · Summit Dental
              </p>
            </div>
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-full">
              <MaterialIcon name="timer" className="text-white/70 text-[16px]" />
              <span className="font-code-md text-white/85 text-sm">
                {formatDiscoveryTime(seconds)}
              </span>
            </div>
          </>
        )}
      </div>

      {connected && voice.statusText.length > 0 && (
        <p className="mt-4 text-white/55 text-sm text-center max-w-md">{voice.statusText}</p>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
        <nav className="rounded-full backdrop-blur-xl bg-black/20 border border-white/10 shadow-2xl flex items-center p-2 gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              micMuted ? "bg-error text-white" : "hover:bg-white/10 text-on-primary"
            }`}
          >
            <MaterialIcon name={micMuted ? "mic_off" : "mic"} />
          </button>
          <button
            type="button"
            onClick={handleEndCall}
            className="bg-error text-white rounded-full p-4 transition-all active:scale-90 shadow-lg"
          >
            <MaterialIcon name="call_end" filled />
          </button>
        </nav>
      </div>

      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/30 text-[10px]">
        This call is being recorded for scoring purposes
      </p>
    </section>
  );
}
