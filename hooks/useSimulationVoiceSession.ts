/**
 * useSimulationVoiceSession.ts
 * Simli voice stages: Deepgram + GPT + ElevenLabs through AvatarRef.
 * Does not acquire media — caller supplies the lobby MediaStream on join.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { base64ToArrayBuffer, pickMediaRecorderMimeType } from "@/lib/audio";
import { playBase64Speech, resumePlaybackContext } from "@/lib/audio-playback";
import { buildDefaultOpeningGreeting } from "@/lib/persona";
import {
  SIMULATION_POST_SPEAK_COOLDOWN_MS,
  SIMULATION_VOICE_DEBOUNCE_MS,
  SIMULATION_VOICE_ENDPOINTING_MS,
  SIMULATION_VOICE_RECORDER_TIMESLICE_MS,
  SIMULATION_VOICE_UTTERANCE_END_MS,
} from "@/lib/constants";
import { createDeepgramConnection } from "@/lib/deepgram";
import { buildVoiceSystemPrompt } from "@/lib/persona-voice";
import { createUtteranceBuffer } from "@/lib/voice-utterance-buffer";
import type { AvatarRef, ChatMessage, TtsResponseBody } from "@/types";

export type SimulationVoiceConfig = {
  systemPrompt: string;
  openingGreeting?: string;
  stageHint?: string;
  isMutedRef?: React.MutableRefObject<boolean>;
};

export type SimulationVoiceReturn = {
  avatarRef: React.RefObject<AvatarRef>;
  isActive: boolean;
  statusText: string;
  userTranscripts: string;
  personaTranscripts: string;
  getFullTranscript: () => string;
  /** Starts Deepgram using an audio-only MediaStream (not the PiP video stream). */
  startCall: (audioStream: MediaStream) => Promise<void>;
  stopListening: () => void;
  endCall: () => void;
  /** Swap MediaRecorder to a new mic stream after unmute. */
  replaceAudioStream: (audioStream: MediaStream) => void;
  /** Stops sending mic audio to Deepgram without ending the call. */
  pauseMic: () => void;
  /** Resumes Deepgram capture on a (usually fresh) mic stream. */
  resumeMic: (audioStream: MediaStream) => void;
};

/**
 * Voice hook with Simli playback and turn-taking for discovery / objections / close.
 */
export function useSimulationVoiceSession(
  config: SimulationVoiceConfig
): SimulationVoiceReturn {
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [userTranscripts, setUserTranscripts] = useState("");
  const [personaTranscripts, setPersonaTranscripts] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const avatarRef = useRef<AvatarRef>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramConnectionRef = useRef<ReturnType<typeof createDeepgramConnection> | null>(null);
  const utteranceBufferRef = useRef<ReturnType<typeof createUtteranceBuffer> | null>(null);
  const isSpeakingRef = useRef(false);
  const isProcessingUserRef = useRef(false);
  const canListenAfterRef = useRef(0);
  const playbackEpochRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const transcriptLinesRef = useRef<string[]>([]);
  const isActiveRef = useRef(false);
  const configRef = useRef(config);
  const pendingUtteranceRef = useRef("");

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const appendTranscript = useCallback((speaker: string, text: string): void => {
    transcriptLinesRef.current.push(`${speaker}: ${text}`);
  }, []);

  const isMicMuted = (): boolean => Boolean(configRef.current.isMutedRef?.current);

  /** Deepgram may ingest while GPT runs; block only during persona playback (echo). */
  const canIngestStudentSpeech = useCallback((): boolean => {
    return (
      !isMicMuted() &&
      !isSpeakingRef.current &&
      Date.now() >= canListenAfterRef.current
    );
  }, []);

  const canProcessStudentSpeech = useCallback((): boolean => {
    return canIngestStudentSpeech() && !isProcessingUserRef.current;
  }, [canIngestStudentSpeech]);

  const queuePendingUtterance = (text: string): void => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const existing = pendingUtteranceRef.current.trim();
    pendingUtteranceRef.current = existing ? `${existing} ${trimmed}` : trimmed;
  };

  const flushPendingUtterance = useCallback((): void => {
    const pending = pendingUtteranceRef.current.trim();
    if (!pending || !canProcessStudentSpeech()) {
      return;
    }
    pendingUtteranceRef.current = "";
    void handleUserSentenceRef.current(pending);
  }, [canProcessStudentSpeech]);

  const scheduleFlushPending = useCallback((): void => {
    flushPendingUtterance();
    window.setTimeout(() => flushPendingUtterance(), 150);
    window.setTimeout(() => flushPendingUtterance(), 600);
  }, [flushPendingUtterance]);

  const handleUserSentenceRef = useRef<(text: string) => Promise<void>>(async () => {
    /* assigned after handleUserSentence is defined */
  });

  const speakFromApi = useCallback(
    async (text: string): Promise<void> => {
      setPersonaTranscripts(text);
      appendTranscript("Persona", text);
      isSpeakingRef.current = true;
      const epoch = playbackEpochRef.current;
      let playbackFailed = false;

      try {
        const avatar = avatarRef.current;
        if (avatar && !avatar.isReady()) {
          const ready = await avatar.waitUntilReady();
          if (!ready || epoch !== playbackEpochRef.current) {
            setStatusText("Avatar not ready — check Simli keys and reload.");
            playbackFailed = true;
            return;
          }
        }

        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (epoch !== playbackEpochRef.current) return;

        if (!ttsRes.ok) {
          const errBody = (await ttsRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error ?? `TTS failed (${ttsRes.status})`);
        }

        const data = (await ttsRes.json()) as TtsResponseBody;
        if (!data.audioBase64 || epoch !== playbackEpochRef.current) {
          throw new Error("TTS returned no audio — check ElevenLabs credits and ELEVENLABS_* env vars.");
        }

        const buffer = base64ToArrayBuffer(data.audioBase64);
        let playbackMs = 2500;
        try {
          const decodeCtx = new AudioContext();
          const decoded = await decodeCtx.decodeAudioData(buffer.slice(0));
          playbackMs = Math.max(900, Math.ceil(decoded.duration * 1000));
          void decodeCtx.close();
        } catch {
          /* fall back to default estimate */
        }

        // Hear TTS locally (reliable). Simli still gets PCM for lip-sync; its
        // remote <audio> is muted in Avatar to avoid double playback.
        await resumePlaybackContext();
        const hearPromise = playBase64Speech(data.audioBase64);

        if (avatarRef.current && epoch === playbackEpochRef.current) {
          try {
            await avatarRef.current.speakAudio({ audio: buffer });
          } catch (simliErr) {
            console.error("[voice] Simli lip-sync failed:", simliErr);
          }
          canListenAfterRef.current =
            Date.now() + playbackMs + SIMULATION_POST_SPEAK_COOLDOWN_MS;
        }

        await hearPromise;
      } catch (err) {
        console.error(err);
        setStatusText(err instanceof Error ? err.message : "Voice playback failed.");
        playbackFailed = true;
      } finally {
        if (epoch === playbackEpochRef.current) {
          isSpeakingRef.current = false;
          if (isActiveRef.current && !playbackFailed) {
            setStatusText("Your turn — speak when ready.");
          }
          scheduleFlushPending();
        }
      }
    },
    [appendTranscript, scheduleFlushPending]
  );

  const handleUserSentence = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      if (!canProcessStudentSpeech()) {
        queuePendingUtterance(trimmed);
        return;
      }

      isProcessingUserRef.current = true;
      setUserTranscripts(trimmed);
      appendTranscript("Student", trimmed);
      setStatusText("Thinking...");

      const prior = messagesRef.current;
      try {
        const systemPrompt = buildVoiceSystemPrompt(
          configRef.current.systemPrompt,
          configRef.current.stageHint
        );
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: prior,
            newMessage: trimmed,
            systemPrompt,
          }),
        });

        if (!chatRes.ok) {
          const errBody = (await chatRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error ?? `Chat failed (${chatRes.status})`);
        }

        const { reply } = (await chatRes.json()) as { reply: string };
        const next: ChatMessage[] = [
          ...prior,
          { role: "user", content: trimmed },
          { role: "assistant", content: reply },
        ];
        setMessages(next);
        messagesRef.current = next;
        await speakFromApi(reply);
      } catch (err) {
        console.error(err);
        setStatusText(err instanceof Error ? err.message : "Could not get reply.");
      } finally {
        isProcessingUserRef.current = false;
        scheduleFlushPending();
      }
    },
    [speakFromApi, appendTranscript, scheduleFlushPending, canProcessStudentSpeech]
  );

  handleUserSentenceRef.current = handleUserSentence;

  const stopListening = useCallback((): void => {
    utteranceBufferRef.current?.cancel();
    pendingUtteranceRef.current = "";
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    deepgramConnectionRef.current?.close();
    deepgramConnectionRef.current = null;
    setIsActive(false);
  }, []);

  const startCall = useCallback(
    async (audioStream: MediaStream): Promise<void> => {
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No microphone audio track available.");
      }

      try {
        avatarRef.current?.resumeAudioContext();
        setIsActive(true);
        setMessages([]);
        messagesRef.current = [];
        transcriptLinesRef.current = [];
        setUserTranscripts("");
        setPersonaTranscripts("");
        pendingUtteranceRef.current = "";
        canListenAfterRef.current = Date.now() + SIMULATION_POST_SPEAK_COOLDOWN_MS;

        utteranceBufferRef.current = createUtteranceBuffer(
          {
            onLivePreview: (preview) => setUserTranscripts(preview),
            onCommit: (full) => {
              const trimmed = full.trim();
              if (!trimmed) {
                return;
              }
              if (!canProcessStudentSpeech()) {
                queuePendingUtterance(trimmed);
                return;
              }
              void handleUserSentence(trimmed);
            },
          },
          SIMULATION_VOICE_DEBOUNCE_MS
        );

        const connection = createDeepgramConnection({
          endpointing: SIMULATION_VOICE_ENDPOINTING_MS,
          utterance_end_ms: SIMULATION_VOICE_UTTERANCE_END_MS,
        });
        deepgramConnectionRef.current = connection;

        const mimeType = pickMediaRecorderMimeType();
        const mediaRecorder = mimeType
          ? new MediaRecorder(audioStream, { mimeType })
          : new MediaRecorder(audioStream);

        mediaRecorder.ondataavailable = (event: BlobEvent): void => {
          if (configRef.current.isMutedRef?.current) return;
          if (event.data.size > 0) connection.send(event.data);
        };
        mediaRecorderRef.current = mediaRecorder;

        const greeting =
          configRef.current.openingGreeting ?? buildDefaultOpeningGreeting();

        connection.onTranscript((sentence: string, meta): void => {
          if (!canIngestStudentSpeech()) {
            return;
          }

          if (!meta.isFinal && !meta.isSpeechFinal) {
            setUserTranscripts(sentence);
            return;
          }

          if (meta.isFinal || meta.isSpeechFinal) {
            utteranceBufferRef.current?.pushFragment(sentence, meta.isSpeechFinal);
          }
        });

        connection.onError(() => {
          setStatusText("Speech service error — check Deepgram API key.");
        });

        connection.onOpen(() => {
          if (mediaRecorder.state === "inactive") {
            mediaRecorder.start(SIMULATION_VOICE_RECORDER_TIMESLICE_MS);
          }
          setStatusText("Live — wait for persona to finish, then speak.");
          void speakFromApi(greeting);
        });
      } catch (err) {
        console.error(err);
        setStatusText(
          err instanceof Error ? err.message : "Could not start voice session."
        );
        setIsActive(false);
        throw err;
      }
    },
    [handleUserSentence, speakFromApi, canIngestStudentSpeech, canProcessStudentSpeech]
  );

  const endCall = useCallback((): void => {
    playbackEpochRef.current += 1;
    isSpeakingRef.current = false;
    isProcessingUserRef.current = false;
    avatarRef.current?.stopSpeaking();
    stopListening();
  }, [stopListening]);

  const replaceAudioStream = useCallback((audioStream: MediaStream): void => {
    if (audioStream.getAudioTracks().length === 0) {
      return;
    }

    const connection = deepgramConnectionRef.current;
    const prev = mediaRecorderRef.current;
    if (prev && prev.state !== "inactive") {
      prev.stop();
    }

    const mimeType = pickMediaRecorderMimeType();
    const mediaRecorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);

    mediaRecorder.ondataavailable = (event: BlobEvent): void => {
      if (configRef.current.isMutedRef?.current) {
        return;
      }
      if (event.data.size > 0) {
        connection?.send(event.data);
      }
    };
    mediaRecorderRef.current = mediaRecorder;

    if (connection && mediaRecorder.state === "inactive") {
      mediaRecorder.start(SIMULATION_VOICE_RECORDER_TIMESLICE_MS);
    }
  }, []);

  const pauseMic = useCallback((): void => {
    if (configRef.current.isMutedRef) {
      configRef.current.isMutedRef.current = true;
    }
    utteranceBufferRef.current?.cancel();

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }
    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stop();
    }
  }, []);

  const resumeMic = useCallback(
    (audioStream: MediaStream): void => {
      if (configRef.current.isMutedRef) {
        configRef.current.isMutedRef.current = false;
      }
      replaceAudioStream(audioStream);
    },
    [replaceAudioStream]
  );

  return {
    avatarRef,
    isActive,
    statusText,
    userTranscripts,
    personaTranscripts,
    getFullTranscript: () => transcriptLinesRef.current.join("\n"),
    startCall,
    stopListening,
    endCall,
    replaceAudioStream,
    pauseMic,
    resumeMic,
  };
}
