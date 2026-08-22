/**
 * complete-stage/route.ts
 * POST /api/student/complete-stage — saves stage score and advances attempt.
 * Uses service role because students do not have Supabase auth sessions.
 */

import { NextResponse } from "next/server";
import { requireStudentApi } from "@/lib/api-auth";
import { getNextStage } from "@/lib/stages";
import { createServiceClient } from "@/lib/supabase/server";
import { detectTempoBadges } from "@/lib/tempo-badges";
import { parseDiscoveryPreCallPrepFromTranscript } from "@/lib/tempo-discovery";
import { convertLead } from "@/lib/tempo-lead-conversion";
import type { SimulationStage } from "@/types";

type CompleteStageBody = {
  attemptId?: string;
  stage?: SimulationStage;
  score?: number;
  feedback?: string;
  transcript?: string;
};

/**
 * Upserts a stage score and updates attempt progress for the logged-in student.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireStudentApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as CompleteStageBody;
    const { attemptId, stage, score, feedback, transcript } = body;

    if (!attemptId || !stage || score === undefined || !feedback || transcript === undefined) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: attempt } = await supabase
      .from("attempts")
      .select("id, student_id, stage_data")
      .eq("id", attemptId)
      .eq("student_id", auth.session.studentId)
      .single();

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    // PART 4: ensure prospecting transcript carries the active ICP from stage_data
    // (coaching gate) even if the client omittted it.
    let transcriptToStore = transcript;
    if (stage === "prospecting") {
      try {
        const parsed =
          typeof transcript === "string" && transcript.trim()
            ? (JSON.parse(transcript) as Record<string, unknown>)
            : {};
        const stageData = (attempt.stage_data ?? {}) as Record<string, unknown>;
        const icpRaw = stageData.icp;
        if (icpRaw && typeof icpRaw === "object" && !Array.isArray(icpRaw)) {
          const icpObj = icpRaw as Record<string, unknown>;
          if (!parsed.icp) {
            parsed.icp = {
              originalText: typeof icpObj.originalText === "string" ? icpObj.originalText : "",
              result: icpObj.result === "corrected" ? "corrected" : "affirmed",
              activeIcpText:
                typeof icpObj.activeIcpText === "string" ? icpObj.activeIcpText : "",
            };
            transcriptToStore = JSON.stringify(parsed);
          }
        }
      } catch {
        /* keep original transcript */
      }
    }

    if (stage === "prospecting") {
      const { data: selectedLead, error: selectedError } = await supabase
        .from("crm_leads")
        .select("id")
        .eq("attempt_id", attemptId)
        .eq("status", "selected")
        .maybeSingle();

      if (selectedError) {
        console.error(
          "[complete-stage] could not load selected lead for auto-convert:",
          selectedError
        );
      } else if (!selectedLead) {
        console.error(
          "[complete-stage] prospecting completed with no selected crm_leads row — Discovery gate will block until a Lead is converted"
        );
      } else {
        try {
          const convertResult = await convertLead(supabase, attemptId, selectedLead.id as string);
          if (!convertResult.success) {
            console.error(
              "[complete-stage] auto-convert failed after wizard selection:",
              convertResult.reason,
              convertResult.managerNote
            );
          }
        } catch (err) {
          console.error("[complete-stage] auto-convert threw:", err);
        }
      }
    }

    let badgesEarned: string[] = [];
    if (
      stage === "discovery" ||
      stage === "objections" ||
      stage === "prospecting" ||
      stage === "presentation" ||
      stage === "close"
    ) {
      let crmFields: Record<string, string> | null = null;

      if (stage === "prospecting") {
        const { data: convertedLead } = await supabase
          .from("crm_leads")
          .select("trigger_event, why_fit")
          .eq("attempt_id", attemptId)
          .eq("status", "converted")
          .maybeSingle();

        if (convertedLead) {
          crmFields = {
            trigger: String(convertedLead.trigger_event ?? ""),
            whyFit: String(convertedLead.why_fit ?? ""),
          };
        }
      } else if (stage === "discovery" || stage === "objections") {
        const { data: crmLog } = await supabase
          .from("crm_log_entries")
          .select("fields")
          .eq("attempt_id", attemptId)
          .eq("stage", stage)
          .maybeSingle();

        const rawFields = crmLog?.fields;
        if (rawFields && typeof rawFields === "object" && !Array.isArray(rawFields)) {
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(rawFields as Record<string, unknown>)) {
            if (typeof value === "string") {
              normalized[key] = value;
            } else if (value != null) {
              normalized[key] = String(value);
            }
          }
          crmFields = normalized;
        }
      }

      const discoveryPrepPayload =
        stage === "discovery"
          ? (() => {
              const prep = parseDiscoveryPreCallPrepFromTranscript(transcriptToStore);
              if (!prep) {
                return null;
              }
              return {
                openQuestions: prep.openQuestions.filter((q) => q.trim().length > 0),
                anticipatedProbe: prep.anticipatedProbe,
                anticipatedConfirm: prep.anticipatedConfirm,
              };
            })()
          : null;

      badgesEarned = await detectTempoBadges(
        stage,
        transcriptToStore,
        crmFields,
        discoveryPrepPayload
      );
    }

    await supabase.from("stage_scores").upsert(
      {
        attempt_id: attemptId,
        stage,
        score,
        feedback,
        transcript: transcriptToStore,
        badges_earned: badgesEarned,
      },
      { onConflict: "attempt_id,stage" }
    );

    const { data: scores } = await supabase
      .from("stage_scores")
      .select("score")
      .eq("attempt_id", attemptId);

    const totalScore = (scores ?? []).reduce((sum, row) => sum + row.score, 0);
    const next = getNextStage(stage);

    if (next === "results" || next === null) {
      await supabase
        .from("attempts")
        .update({
          current_stage: "results",
          status: "completed",
          total_score: totalScore,
          completed_at: new Date().toISOString(),
        })
        .eq("id", attemptId);

      return NextResponse.json({ nextStage: "results", totalScore });
    }

    await supabase
      .from("attempts")
      .update({ current_stage: next, total_score: totalScore })
      .eq("id", attemptId);

    return NextResponse.json({ nextStage: next, totalScore });
  } catch {
    return NextResponse.json({ error: "Could not save stage progress." }, { status: 500 });
  }
}
