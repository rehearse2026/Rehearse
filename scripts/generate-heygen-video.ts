/**
 * generate-heygen-video.ts
 * Reusable HeyGen v3 avatar video generator — submits, polls, downloads, and uploads to Supabase Storage.
 * Runnable via: npx tsx scripts/generate-heygen-video.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── HeyGen API (v3) ───────────────────────────────────────────────────────────

const HEYGEN_API_BASE = "https://api.heygen.com";
const POLL_INTERVAL_MS = 5_000;
const GENERATION_TIMEOUT_MS = 5 * 60 * 1_000;

const PROFESSIONAL_TAG_KEYWORDS = ["business", "professional", "corporate", "formal", "office"];
const STYLIZED_TAG_KEYWORDS = ["cartoon", "anime", "stylized", "fantasy", "mascot", "3d", "illustration"];

export interface HeygenVideoConfig {
  script: string;
  avatarId: string;
  voiceId: string;
  outputStorageBucket: string;
  outputStoragePath: string;
}

type HeygenAvatarLook = {
  id: string;
  name: string;
  tags?: string[];
  default_voice_id?: string | null;
  preview_image_url?: string | null;
  avatar_type?: string;
};

type HeygenVoice = {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
};

type SelectedAvatarVoice = {
  avatarId: string;
  voiceId: string;
  avatarName: string;
  previewImageUrl: string | null;
  selectionReason: string;
};

/**
 * Loads HEYGEN_API_KEY, Supabase keys, and OPENAI from .env.local when unset.
 */
function loadEnvLocalIfNeeded(): void {
  const required = [
    "HEYGEN_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  if (required.every((key) => process.env[key])) {
    return;
  }
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* optional */
  }
}

/**
 * Returns the HeyGen API key or throws.
 */
function getHeygenApiKey(): string {
  const key = process.env.HEYGEN_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing HEYGEN_API_KEY. Add it to .env.local.");
  }
  return key;
}

/**
 * Authenticated fetch against api.heygen.com (v3 uses x-api-key header).
 */
async function heygenFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getHeygenApiKey();
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(options.headers ?? {}),
    },
  });

  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message =
      typeof body.error?.message === "string"
        ? body.error.message
        : `HeyGen API ${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return body;
}

/**
 * Fetches all public avatar looks with cursor pagination.
 */
async function listAllAvatarLooks(): Promise<HeygenAvatarLook[]> {
  const looks: HeygenAvatarLook[] = [];
  let token: string | null = null;

  do {
    const query = new URLSearchParams({
      ownership: "public",
      limit: "50",
    });
    if (token) {
      query.set("token", token);
    }

    const page = await heygenFetch<{
      data: HeygenAvatarLook[];
      has_more: boolean;
      next_token: string | null;
    }>(`/v3/avatars/looks?${query.toString()}`);

    looks.push(...(page.data ?? []));
    token = page.has_more ? page.next_token : null;
  } while (token);

  return looks;
}

/**
 * Returns true when tags or name suggest a stylized / non-workplace avatar.
 */
function isStylizedLook(look: HeygenAvatarLook): boolean {
  const haystack = [
    look.name.toLowerCase(),
    ...(look.tags ?? []).map((tag) => tag.toLowerCase()),
  ].join(" ");
  return STYLIZED_TAG_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Scores a look for professional workplace suitability.
 */
function scoreProfessionalLook(look: HeygenAvatarLook): number {
  const haystack = [
    look.name.toLowerCase(),
    ...(look.tags ?? []).map((tag) => tag.toLowerCase()),
  ].join(" ");

  let score = 0;
  for (const keyword of PROFESSIONAL_TAG_KEYWORDS) {
    if (haystack.includes(keyword)) {
      score += 10;
    }
  }
  if (look.default_voice_id) {
    score += 5;
  }
  if (look.avatar_type === "studio_avatar" || look.avatar_type === "digital_twin") {
    score += 2;
  }
  return score;
}

/**
 * Picks the best public avatar look and paired voice per selection criteria.
 */
export async function selectAvatarAndVoice(): Promise<SelectedAvatarVoice> {
  const looks = await listAllAvatarLooks();
  const candidates = looks.filter((look) => !isStylizedLook(look));

  if (candidates.length === 0) {
    throw new Error("No suitable public avatar looks found after filtering stylized options.");
  }

  const ranked = [...candidates].sort((a, b) => scoreProfessionalLook(b) - scoreProfessionalLook(a));
  const best = ranked[0];

  let voiceId = best.default_voice_id?.trim() ?? "";
  let selectionReason = "Highest professional-tag score among public looks.";

  if (!voiceId) {
    const voicesPage = await heygenFetch<{ data: HeygenVoice[] }>(
      "/v3/voices?type=public&language=English&limit=20"
    );
    const englishVoice = voicesPage.data?.find(
      (voice) => voice.language.toLowerCase().includes("english")
    );
    if (!englishVoice) {
      throw new Error(`Avatar "${best.name}" has no default_voice_id and no English voice was found.`);
    }
    voiceId = englishVoice.voice_id;
    selectionReason =
      "No default_voice_id on look; fell back to first English public voice from GET /v3/voices.";
  } else {
    selectionReason = "Matched avatar default_voice_id (HeyGen lip-sync recommendation).";
  }

  return {
    avatarId: best.id,
    voiceId,
    avatarName: best.name,
    previewImageUrl: best.preview_image_url ?? null,
    selectionReason,
  };
}

/**
 * Submits POST /v3/videos and returns the new video_id.
 */
async function createHeygenVideoJob(config: HeygenVideoConfig): Promise<string> {
  const response = await heygenFetch<{ data: { video_id: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: config.avatarId,
      voice_id: config.voiceId,
      script: config.script,
      title: "Tempo Onboarding Welcome",
      aspect_ratio: "16:9",
      resolution: "1080p",
    }),
  });

  const videoId = response.data?.video_id;
  if (!videoId) {
    throw new Error("HeyGen did not return a video_id.");
  }
  return videoId;
}

type VideoPollResult = {
  status: string;
  videoUrl: string | null;
  failureMessage: string | null;
};

/**
 * Polls GET /v3/videos/{video_id} until completed, failed, or timeout.
 */
async function pollHeygenVideo(videoId: string): Promise<VideoPollResult> {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await heygenFetch<{
      data: {
        status: string;
        video_url?: string | null;
        failure_message?: string | null;
      };
    }>(`/v3/videos/${videoId}`);

    const { status, video_url: videoUrl, failure_message: failureMessage } = response.data;

    if (status === "completed") {
      if (!videoUrl) {
        throw new Error(`Video ${videoId} completed but video_url is missing.`);
      }
      return { status, videoUrl, failureMessage: null };
    }

    if (status === "failed") {
      return {
        status,
        videoUrl: null,
        failureMessage: failureMessage ?? "HeyGen video generation failed.",
      };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`HeyGen video ${videoId} timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`);
}

/**
 * Ensures a public Supabase Storage bucket exists (idempotent).
 */
async function ensurePublicBucket(supabase: SupabaseClient, bucketName: string): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Could not list storage buckets: ${listError.message}`);
  }

  if (buckets?.some((bucket) => bucket.name === bucketName)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
  });
  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Could not create bucket "${bucketName}": ${createError.message}`);
  }
}

/**
 * Downloads the rendered MP4 and uploads it to Supabase Storage.
 */
export async function generateHeygenVideo(
  config: HeygenVideoConfig
): Promise<{ storageUrl: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const videoId = await createHeygenVideoJob(config);
  console.log(`HeyGen job submitted: ${videoId}. Polling for completion...`);

  const pollResult = await pollHeygenVideo(videoId);
  if (pollResult.status === "failed" || !pollResult.videoUrl) {
    throw new Error(pollResult.failureMessage ?? "HeyGen video generation failed.");
  }

  const downloadResponse = await fetch(pollResult.videoUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download HeyGen video: ${downloadResponse.status}`);
  }

  const videoBytes = Buffer.from(await downloadResponse.arrayBuffer());
  const supabase = createClient(supabaseUrl, supabaseKey);

  await ensurePublicBucket(supabase, config.outputStorageBucket);

  const { error: uploadError } = await supabase.storage
    .from(config.outputStorageBucket)
    .upload(config.outputStoragePath, videoBytes, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(config.outputStorageBucket)
    .getPublicUrl(config.outputStoragePath);

  return { storageUrl: publicUrlData.publicUrl };
}

/**
 * CLI entry — selects avatar/voice, generates Tempo onboarding video, prints the Storage URL.
 */
async function runCli(): Promise<void> {
  loadEnvLocalIfNeeded();

  const { TEMPO_ONBOARDING_SCRIPT } = await import("./config/tempo-onboarding-script");
  const selection = await selectAvatarAndVoice();

  console.log("Selected avatar/voice:");
  console.log(`  avatar_id: ${selection.avatarId}`);
  console.log(`  avatar_name: ${selection.avatarName}`);
  console.log(`  voice_id: ${selection.voiceId}`);
  console.log(`  preview_image: ${selection.previewImageUrl ?? "(none)"}`);
  console.log(`  reason: ${selection.selectionReason}`);

  const result = await generateHeygenVideo({
    script: TEMPO_ONBOARDING_SCRIPT,
    avatarId: selection.avatarId,
    voiceId: selection.voiceId,
    outputStorageBucket: "onboarding-videos",
    outputStoragePath: "tempo-welcome.mp4",
  });

  console.log(`\nOnboarding video uploaded: ${result.storageUrl}`);
  updateOnboardingVideoUrl(result.storageUrl);
  console.log("Updated lib/tempo-onboarding-video.ts with the public Storage URL.");
}

/**
 * Writes the generated public URL into lib/tempo-onboarding-video.ts for the app to consume.
 */
function updateOnboardingVideoUrl(storageUrl: string): void {
  const libPath = join(process.cwd(), "lib/tempo-onboarding-video.ts");
  const content = `/**
 * tempo-onboarding-video.ts
 * Public Supabase Storage URL for the Tempo simulation onboarding welcome video.
 * Updated by scripts/generate-heygen-video.ts after a successful HeyGen render + upload.
 */

/** MP4 served from the onboarding-videos bucket (tempo-welcome.mp4). */
export const TEMPO_ONBOARDING_VIDEO_URL =
  "${storageUrl}";
`;
  writeFileSync(libPath, content, "utf8");
}

const isMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isMain) {
  runCli().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
