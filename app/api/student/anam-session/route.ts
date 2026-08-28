/**
 * anam-session/route.ts
 * POST — mints a short-lived Anam session token for audio-passthrough avatar video.
 * Server-only ANAM_API_KEY; client receives sessionToken + avatarId only.
 */

import { NextResponse } from "next/server";
import { requireStudentApi } from "@/lib/api-auth";
import {
  getAnamAvatarId,
  isAnamSessionStage,
  normalizeAnamAvatarIds,
} from "@/lib/tempo-anam-config";
import { createServiceClient } from "@/lib/supabase/server";

const ANAM_SESSION_TOKEN_URL = "https://api.anam.ai/v1/auth/session-token";

type AnamSessionBody = {
  attemptId?: unknown;
  stage?: unknown;
};

type AnamSessionTokenResponse = {
  sessionToken?: string;
};

/**
 * POST /api/student/anam-session
 * Body: { attemptId, stage: 'discovery' | 'objections' }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireStudentApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as AnamSessionBody;
    const attemptId =
      typeof body.attemptId === "string" ? body.attemptId.trim() : "";
    const stage = typeof body.stage === "string" ? body.stage.trim() : "";

    if (!attemptId || !stage) {
      return NextResponse.json(
        { error: "attemptId and stage are required." },
        { status: 400 }
      );
    }

    if (!isAnamSessionStage(stage)) {
      return NextResponse.json(
        { error: "stage must be 'discovery' or 'objections'." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANAM_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANAM_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, simulation_id")
      .eq("id", attemptId)
      .eq("student_id", auth.session.studentId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const { data: simulation, error: simulationError } = await supabase
      .from("simulations")
      .select("anam_avatar_ids")
      .eq("id", attempt.simulation_id)
      .maybeSingle();

    if (simulationError || !simulation) {
      return NextResponse.json({ error: "Simulation not found." }, { status: 404 });
    }

    const avatarId = getAnamAvatarId(
      stage,
      normalizeAnamAvatarIds(simulation.anam_avatar_ids)
    );

    if (!avatarId) {
      return NextResponse.json(
        {
          error: `No Anam avatar ID configured for stage '${stage}'. Set simulations.anam_avatar_ids or ANAM_AVATAR_ID_${stage === "discovery" ? "DANA" : "KIM"}.`,
        },
        { status: 400 }
      );
    }

    const anamResponse = await fetch(ANAM_SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personaConfig: {
          avatarId,
          enableAudioPassthrough: true,
        },
      }),
    });

    const responseText = await anamResponse.text();
    let responseJson: AnamSessionTokenResponse & { error?: string; message?: string } =
      {};
    if (responseText) {
      try {
        responseJson = JSON.parse(responseText) as typeof responseJson;
      } catch {
        responseJson = {};
      }
    }

    if (!anamResponse.ok) {
      const detail =
        responseJson.message ??
        responseJson.error ??
        responseText.slice(0, 500) ??
        `Anam API error (${anamResponse.status})`;
      console.error("[anam-session] Anam token failure:", anamResponse.status, detail);
      return NextResponse.json(
        { error: `Could not create Anam session token: ${detail}` },
        { status: 502 }
      );
    }

    const sessionToken = responseJson.sessionToken?.trim();
    if (!sessionToken) {
      console.error("[anam-session] Missing sessionToken in Anam response:", responseText);
      return NextResponse.json(
        { error: "Anam returned no session token." },
        { status: 502 }
      );
    }

    return NextResponse.json({ sessionToken, avatarId });
  } catch (error) {
    console.error("[anam-session] unexpected:", error);
    return NextResponse.json(
      { error: "Could not create Anam session." },
      { status: 500 }
    );
  }
}
