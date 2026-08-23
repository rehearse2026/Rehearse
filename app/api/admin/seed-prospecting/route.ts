/**
 * seed-prospecting/route.ts
 * One-shot admin endpoint: seeds prospect directory + Data Room on Vercel
 * (Sensitive env vars are only available at runtime, not via vercel env pull).
 * Protected by SEED_TOKEN. Remove after seeding.
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { generateProspectDirectory } from "@/scripts/generate-prospect-directory";
import { tempoDirectorySeed } from "@/scripts/config/tempo-directory-seed";
import { generateDataRoom } from "@/scripts/generate-data-room";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/seed-prospecting
 * Authorization: Bearer <SEED_TOKEN>
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.SEED_TOKEN?.trim() ?? "";
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase env on Vercel." }, { status: 500 });
  }
  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY on Vercel." }, { status: 500 });
  }

  try {
    const supabase = createClient(url, key);
    const openai = new OpenAI({ apiKey: openaiKey });

    const directory = await generateProspectDirectory(supabase, tempoDirectorySeed);
    const dataRoom = await generateDataRoom(supabase, openai, tempoDirectorySeed.simulationId);

    return NextResponse.json({
      ok: true,
      directory,
      dataRoom: {
        rosterSelected: dataRoom.rosterSelected,
        rosterCompanies: dataRoom.rosterCompanies,
        documentsCreated: dataRoom.documentsCreated,
        documentsSkipped: dataRoom.documentsSkipped,
        missingDocuments: dataRoom.missingDocuments,
        failures: dataRoom.failures,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[seed-prospecting]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
