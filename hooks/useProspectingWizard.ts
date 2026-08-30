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
  canAdvanceProspectingStep,
  canSubmitProspectingBrief,
  countWords,
  DEFAULT_PROSPECTING_WIZARD_STATE,
  isIcpDefinitionComplete,
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
        const wizardRes = await fetch(
          `/api/student/prospecting-wizard?attemptId=${encodeURIComponent(attemptId)}`
        );

        let nextState = local ? normalizeProspectingWizardState(local) : DEFAULT_PROSPECTING_WIZARD_STATE;
        if (wizardRes.ok) {
          const body = (await wizardRes.json()) as { state: ProspectingWizardState };
          nextState = normalizeProspectingWizardState(body.state);
          saveProspectingWizardToStorage(attemptId, nextState);
        }

        const icpFieldsDone = isIcpDefinitionComplete(nextState);
        nextState = {
          ...nextState,
          icpGateComplete: icpFieldsDone,
          currentStep: !nextState.onboardingComplete
            ? 0
            : !icpFieldsDone && nextState.currentStep > 1
              ? 1
              : nextState.currentStep,
          prospectingStepVersion: nextState.prospectingStepVersion ?? PROSPECTING_STEP_VERSION,
        };
        saveProspectingWizardToStorage(attemptId, nextState);

        if (!cancelled) {
          setState(nextState);
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
        if (
          key === "icpField1" ||
          key === "icpField2" ||
          key === "fitJustification" ||
          key === "dmName" ||
          key === "dmRole" ||
          key === "fitRating" ||
          key === "confidence" ||
          key === "triggerEvent"
        ) {
          next.icpGateComplete = isIcpDefinitionComplete(next);
        }
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

  const setCurrentStep = useCallback(
    (step: number): void => {
      if (step > 0 && !state.onboardingComplete) {
        return;
      }
      if (step > 1 && !isIcpDefinitionComplete(state)) {
        return;
      }
      updateField("currentStep", step);
    },
    [state, updateField]
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
        icpField1: state.icpField1,
        icpField2: state.icpField2,
        fitJustification: state.fitJustification,
        dmName: state.dmName,
        dmRole: state.dmRole,
        fitRating: state.fitRating,
        confidence: state.confidence,
        triggerEvent: state.triggerEvent,
        companyChats: state.companyChats,
        selectedCompanyId: state.selectedCompanyId,
        chatMessages: state.chatMessages,
        openingMessage: state.openingMessage,
        selfCheck: state.selfCheck,
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
  }, [attemptId, state]);

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
    completeOnboarding,
  };
}
