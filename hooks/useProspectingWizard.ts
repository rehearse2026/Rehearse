/**
 * useProspectingWizard.ts
 * State and persistence for the Tempo Stage 1 Prospecting wizard.
 * Research step uses company-directory scoped chats (per-company history).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { completeStage } from "@/lib/attempt-actions";
import type { ProspectDirectoryCompany } from "@/lib/tempo-prospect-directory";
import {
  parseProspectingIcpState,
  type ProspectingIcpState,
} from "@/lib/tempo-icp-criteria";
import {
  canAdvanceProspectingStep,
  canSubmitProspectingBrief,
  countWords,
  DEFAULT_PROSPECTING_WIZARD_STATE,
  loadProspectingWizardFromStorage,
  PROSPECTING_STEP_VERSION,
  saveProspectingWizardToStorage,
  sanitizeAiResearchReply,
  normalizeProspectingWizardState,
  type ProspectingWizardState,
} from "@/lib/tempo-prospecting";
import type { ChatMessage } from "@/types";

type UseProspectingWizardOptions = {
  attemptId: string;
};

type UseProspectingWizardResult = {
  state: ProspectingWizardState;
  /** Persisted ICP pre-gate payload (null until submitted). */
  icpState: ProspectingIcpState | null;
  isLoading: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  isAILoading: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  setCurrentStep: (step: number) => void;
  updateField: <K extends keyof ProspectingWizardState>(
    key: K,
    value: ProspectingWizardState[K]
  ) => void;
  selectDirectoryCompany: (companyId: string) => void;
  setDirectoryCompanies: (companies: ProspectDirectoryCompany[]) => void;
  /** Syncs Data Room shortlist company ids for step-advance gating. */
  setShortlistedCompanyIds: (companyIds: string[]) => void;
  toggleSelfCheck: (id: string, checked: boolean) => void;
  canProceed: boolean;
  canSubmit: boolean;
  wordCount: number;
  handleSaveDraft: () => Promise<void>;
  handleStepAdvance: (nextStep: number) => Promise<void>;
  /** Marks a CRM lead as selected and advances to Opening Message. */
  completeLeadSelection: (leadId: string) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  dismissProspectingHandoff: () => void;
  /** Called when ICP feedback Continue unlocks the wizard steps. */
  completeIcpGate: (icp: ProspectingIcpState) => void;
  /** Called when the onboarding briefing video ends. */
  completeOnboarding: () => void;
};

/**
 * Manages prospecting wizard state, scoped research chat, save, and submit flows.
 */
export function useProspectingWizard({
  attemptId,
}: UseProspectingWizardOptions): UseProspectingWizardResult {
  const [state, setState] = useState<ProspectingWizardState>(DEFAULT_PROSPECTING_WIZARD_STATE);
  const [icpState, setIcpState] = useState<ProspectingIcpState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const directoryRef = useRef<ProspectDirectoryCompany[]>([]);

  const persistState = useCallback(
    async (next: ProspectingWizardState): Promise<void> => {
      saveProspectingWizardToStorage(attemptId, next);
      setIsSaving(true);
      try {
        await fetch("/api/student/prospecting-wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, state: next }),
        });
      } catch {
        /* localStorage fallback remains */
      } finally {
        setIsSaving(false);
      }
    },
    [attemptId]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      const local = loadProspectingWizardFromStorage(attemptId);
      try {
        const [wizardRes, icpRes] = await Promise.all([
          fetch(`/api/student/prospecting-wizard?attemptId=${encodeURIComponent(attemptId)}`),
          fetch(`/api/student/icp-check?attemptId=${encodeURIComponent(attemptId)}`),
        ]);

        let nextState = local ? normalizeProspectingWizardState(local) : DEFAULT_PROSPECTING_WIZARD_STATE;
        if (wizardRes.ok) {
          const body = (await wizardRes.json()) as { state: ProspectingWizardState };
          nextState = normalizeProspectingWizardState(body.state);
          saveProspectingWizardToStorage(attemptId, nextState);
        }

        let nextIcp: ProspectingIcpState | null = null;
        if (icpRes.ok) {
          const icpBody = (await icpRes.json()) as { icp: unknown };
          nextIcp = parseProspectingIcpState(icpBody.icp);
        }

        const icpDone = nextIcp?.feedbackSeen === true;
        nextState = {
          ...nextState,
          icpGateComplete: icpDone,
          currentStep: icpDone
            ? nextState.currentStep
            : nextState.onboardingComplete
              ? 1
              : 0,
          prospectingStepVersion: icpDone
            ? nextState.prospectingStepVersion ?? PROSPECTING_STEP_VERSION
            : undefined,
        };
        saveProspectingWizardToStorage(attemptId, nextState);

        if (!cancelled) {
          setState(nextState);
          setIcpState(nextIcp);
        }
      } catch {
        if (local && !cancelled) {
          setState(normalizeProspectingWizardState(local));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const updateField = useCallback(
    <K extends keyof ProspectingWizardState>(key: K, value: ProspectingWizardState[K]): void => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const completeOnboarding = useCallback((): void => {
    setState((prev) => {
      if (prev.onboardingComplete) {
        return prev;
      }
      const next = { ...prev, onboardingComplete: true };
      void persistState(next);
      return next;
    });
  }, [persistState]);

  const completeIcpGate = useCallback(
    (icp: ProspectingIcpState): void => {
      setIcpState(icp);
      setState((prev) => {
        const next = {
          ...prev,
          icpGateComplete: true,
          currentStep: Math.max(prev.currentStep, 2),
          prospectingStepVersion: PROSPECTING_STEP_VERSION,
        };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const setCurrentStep = useCallback(
    (step: number): void => {
      if (step > 0 && !state.onboardingComplete) {
        return;
      }
      if (step > 1 && !state.icpGateComplete) {
        return;
      }
      updateField("currentStep", step);
    },
    [state.icpGateComplete, state.onboardingComplete, updateField]
  );

  /**
   * Stores the public directory list locally and caches id order on the attempt draft.
   */
  const setDirectoryCompanies = useCallback(
    (companies: ProspectDirectoryCompany[]): void => {
      directoryRef.current = companies;
      const ids = companies.map((c) => c.id);
      setState((prev) => {
        if (
          prev.directoryCompanyIds.length === ids.length &&
          prev.directoryCompanyIds.every((id, i) => id === ids[i])
        ) {
          return prev;
        }
        const next = { ...prev, directoryCompanyIds: ids };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  /**
   * Syncs Data Room shortlist company ids used by canAdvanceProspectingStep.
   */
  const setShortlistedCompanyIds = useCallback(
    (companyIds: string[]): void => {
      setState((prev) => {
        if (
          prev.shortlistedCompanyIds.length === companyIds.length &&
          prev.shortlistedCompanyIds.every((id, i) => id === companyIds[i])
        ) {
          return prev;
        }
        const next = { ...prev, shortlistedCompanyIds: companyIds };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  /**
   * Selects a directory company for scoped chat. Does not clear other companies' histories.
   */
  const selectDirectoryCompany = useCallback(
    (companyId: string): void => {
      setChatInput("");
      setState((prev) => {
        const messages = prev.companyChats[companyId] ?? [];
        const next = {
          ...prev,
          selectedCompanyId: companyId,
          chatMessages: messages,
        };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const toggleSelfCheck = useCallback(
    (id: string, checked: boolean): void => {
      setState((prev) => {
        const next = {
          ...prev,
          selfCheck: { ...prev.selfCheck, [id]: checked },
        };
        if (id === "wordCount") {
          next.selfCheck.wordCount = countWords(prev.openingMessage) <= 120;
        }
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const handleSaveDraft = useCallback(async (): Promise<void> => {
    await persistState(state);
  }, [persistState, state]);

  const handleStepAdvance = useCallback(
    async (nextStep: number): Promise<void> => {
      const next = { ...state, currentStep: nextStep };
      setState(next);
      await persistState(next);
    },
    [persistState, state]
  );

  /**
   * Persists the validated target lead and advances to the Opening Message step.
   */
  const completeLeadSelection = useCallback(
    async (leadId: string): Promise<void> => {
      setState((prev) => {
        const next = {
          ...prev,
          selectedLeadId: leadId,
          currentStep: 5,
          prospectingStepVersion: PROSPECTING_STEP_VERSION,
        };
        void persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const handleSendMessage = useCallback(async (): Promise<void> => {
    const trimmed = chatInput.trim();
    const companyId = state.selectedCompanyId;
    if (!trimmed || isAILoading || !companyId) {
      return;
    }

    const company =
      directoryRef.current.find((c) => c.id === companyId) ?? null;
    if (!company) {
      return;
    }

    const prior = state.companyChats[companyId] ?? [];
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...prior, userMessage];
    setChatInput("");
    setState((prev) => ({
      ...prev,
      companyChats: { ...prev.companyChats, [companyId]: nextMessages },
      chatMessages: nextMessages,
    }));
    setIsAILoading(true);

    try {
      const res = await fetch("/api/student/prospect-research-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          companyId,
          messages: nextMessages.slice(0, -1),
          newMessage: trimmed,
        }),
      });

      if (!res.ok) {
        throw new Error("AI request failed");
      }

      const body = (await res.json()) as { reply: string };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: sanitizeAiResearchReply(body.reply),
      };
      setState((prev) => {
        const withReply = [...nextMessages, assistantMessage];
        const next = {
          ...prev,
          companyChats: { ...prev.companyChats, [companyId]: withReply },
          chatMessages: withReply,
        };
        void persistState(next);
        return next;
      });
    } catch {
      setState((prev) => {
        const withError: ChatMessage[] = [
          ...nextMessages,
          {
            role: "assistant",
            content: "Sorry, I couldn't respond right now. Try again in a moment.",
          },
        ];
        return {
          ...prev,
          companyChats: { ...prev.companyChats, [companyId]: withError },
          chatMessages: withError,
        };
      });
    } finally {
      setIsAILoading(false);
    }
  }, [
    attemptId,
    chatInput,
    isAILoading,
    persistState,
    state.companyChats,
    state.selectedCompanyId,
  ]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!canSubmitProspectingBrief(state)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const transcript = JSON.stringify({
        companyChats: state.companyChats,
        selectedCompanyId: state.selectedCompanyId,
        chatMessages: state.chatMessages,
        openingMessage: state.openingMessage,
        selfCheck: state.selfCheck,
        icp: icpState
          ? {
              originalText: icpState.originalText,
              result: icpState.result,
              activeIcpText: icpState.activeIcpText,
            }
          : null,
      });

      await completeStage(
        attemptId,
        "prospecting",
        0,
        "Submitted. Scoring coming soon",
        transcript
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, icpState, state]);

  const dismissProspectingHandoff = useCallback((): void => {
    setState((prev) => {
      const next = {
        ...prev,
        prospectingHandoffSeen: true,
        onboardingComplete: false,
        currentStep: 0,
        prospectingStepVersion: PROSPECTING_STEP_VERSION,
      };
      void persistState(next);
      return next;
    });
  }, [persistState]);

  const wordCount = countWords(state.openingMessage);
  const canProceed = canAdvanceProspectingStep(state.currentStep, state);
  const canSubmit = canSubmitProspectingBrief(state);

  return {
    state,
    icpState,
    isLoading,
    isSaving,
    isSubmitting,
    isAILoading,
    chatInput,
    setChatInput,
    setCurrentStep,
    updateField,
    selectDirectoryCompany,
    setDirectoryCompanies,
    setShortlistedCompanyIds,
    toggleSelfCheck,
    canProceed,
    canSubmit,
    wordCount,
    handleSaveDraft,
    handleStepAdvance,
    completeLeadSelection,
    handleSendMessage,
    handleSubmit,
    dismissProspectingHandoff,
    completeIcpGate,
    completeOnboarding,
  };
}
