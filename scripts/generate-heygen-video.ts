/**
 * generate-heygen-video.ts
 * HeyGen v3 studio generator — Avatar III presenter over Tempo slide deck, upload to Supabase.
 * Runnable via: npx tsx scripts/generate-heygen-video.ts
 */

import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEMPO_ONBOARDING_SEGMENTS } from "./config/tempo-onboarding-script";
import { renderOnboardingSlides } from "./lib/render-onboarding-slides";

// ── HeyGen API (v3) ───────────────────────────────────────────────────────────

const HEYGEN_API_BASE = "https://api.heygen.com";
const POLL_INTERVAL_MS = 5_000;
const GENERATION_TIMEOUT_MS = 20 * 60 * 1_000;

const PROFESSIONAL_TAG_KEYWORDS = ["business", "professional", "corporate", "formal", "office"];
const STYLIZED_TAG_KEYWORDS = ["cartoon", "anime", "stylized", "fantasy", "mascot", "3d", "illustration"];
const AVATAR_III_TYPES = new Set(["photo_avatar", "digital_twin", "studio_avatar"]);

export interface HeygenVideoConfig {
  avatarId: string;
  voiceId: string;
  slideUrlsById: Record<string, string>;
  outputStorageBucket: string;
  outputStoragePath: string;
  captionsStoragePath?: string;
}

type HeygenAvatarLook = {
  id: string;
  name: string;
  tags?: string[];
  default_voice_id?: string | null;
  preview_image_url?: string | null;
  avatar_type?: string;
  supported_api_engines?: string[];
};

type HeygenVoice = {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
};

export type SelectedAvatarVoice = {
  avatarId: string;
  voiceId: string;
  avatarName: string;
  avatarType: string;
  previewImageUrl: string | null;
  selectionReason: string;
};

/**
 * Loads HEYGEN_API_KEY and Supabase keys from .env.local when unset.
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

function getHeygenApiKey(): string {
  const key = process.env.HEYGEN_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing HEYGEN_API_KEY. Add it to .env.local.");
  }
  return key;
}

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

async function listAllAvatarLooks(): Promise<HeygenAvatarLook[]> {
  const looks: HeygenAvatarLook[] = [];
  let token: string | null = null;

  do {
    const query = new URLSearchParams({ ownership: "public", limit: "50" });
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

function isStylizedLook(look: HeygenAvatarLook): boolean {
  const haystack = [
    look.name.toLowerCase(),
    ...(look.tags ?? []).map((tag) => tag.toLowerCase()),
  ].join(" ");
  return STYLIZED_TAG_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function supportsAvatarIii(look: HeygenAvatarLook): boolean {
  return (look.supported_api_engines ?? []).includes("avatar_iii");
}

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
  if (look.avatar_type === "digital_twin") {
    score += 8;
  } else if (look.avatar_type === "photo_avatar") {
    score += 6;
  } else if (look.avatar_type === "studio_avatar") {
    score += 4;
  }
  return score;
}

/**
 * Picks a public Avatar III–compatible photo/digital-twin look and paired voice.
 */
export async function selectAvatarAndVoice(): Promise<SelectedAvatarVoice> {
  const looks = await listAllAvatarLooks();
  const candidates = looks.filter(
    (look) =>
      !isStylizedLook(look) &&
      supportsAvatarIii(look) &&
      look.avatar_type &&
      AVATAR_III_TYPES.has(look.avatar_type)
  );

  if (candidates.length === 0) {
    throw new Error(
      "No public Avatar III photo/digital-twin looks found. Check GET /v3/avatars/looks supported_api_engines."
    );
  }

  const ranked = [...candidates].sort((a, b) => scoreProfessionalLook(b) - scoreProfessionalLook(a));
  const best = ranked[0];

  let voiceId = best.default_voice_id?.trim() ?? "";
  let selectionReason = `Avatar III ${best.avatar_type} — highest professional score among compatible public looks.`;

  if (!voiceId) {
    const voicesPage = await heygenFetch<{ data: HeygenVoice[] }>(
      "/v3/voices?type=public&language=English&limit=20"
    );
    const englishVoice = voicesPage.data?.find((voice) =>
      voice.language.toLowerCase().includes("english")
    );
    if (!englishVoice) {
      throw new Error(`Avatar "${best.name}" has no default_voice_id and no English voice was found.`);
    }
    voiceId = englishVoice.voice_id;
    selectionReason = `Avatar III ${best.avatar_type} with fallback English voice from GET /v3/voices.`;
  } else {
    selectionReason = `Avatar III ${best.avatar_type} with default_voice_id (HeyGen lip-sync recommendation).`;
  }

  return {
    avatarId: best.id,
    voiceId,
    avatarName: best.name,
    avatarType: best.avatar_type ?? "unknown",
    previewImageUrl: best.preview_image_url ?? null,
    selectionReason,
  };
}

async function createAvatarSegmentVideoJob(options: {
  avatarId: string;
  voiceId: string;
  script: string;
  slideUrl: string;
  segmentIndex: number;
}): Promise<string> {
  const response = await heygenFetch<{ data: { video_id: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: options.avatarId,
      voice_id: options.voiceId,
      script: options.script,
      title: `Tempo Onboarding Segment ${options.segmentIndex + 1}`,
      aspect_ratio: "16:9",
      resolution: "1080p",
      fit: "contain",
      engine: { type: "avatar_iii" },
      background: {
        type: "image",
        url: options.slideUrl,
      },
    }),
  });

  const videoId = response.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen did not return a video_id for segment ${options.segmentIndex + 1}.`);
  }
  return videoId;
}


/**
 * Concatenates segment MP4 buffers locally with ffmpeg-static (reliable full-length output).
 */
function concatSegmentBuffers(segmentBuffers: Buffer[]): Buffer {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary is unavailable.");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "tempo-onboarding-"));
  const segmentPaths: string[] = [];
  const listPath = join(tempDir, "concat-list.txt");
  const outputPath = join(tempDir, "tempo-welcome.mp4");

  try {
    segmentBuffers.forEach((buffer, index) => {
      const segmentPath = join(tempDir, `segment-${index + 1}.mp4`);
      writeFileSync(segmentPath, buffer);
      segmentPaths.push(segmentPath);
    });

    const listContent = segmentPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
    writeFileSync(listPath, listContent, "utf8");

    execFileSync(
      ffmpegPath,
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath],
      { stdio: "pipe" }
    );

    return readFileSync(outputPath);
  } finally {
    for (const path of [...segmentPaths, listPath, outputPath]) {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  }
}

async function generateSegmentVideos(
  config: HeygenVideoConfig,
  supabase: SupabaseClient
): Promise<Buffer[]> {
  const segmentBuffers: Buffer[] = [];

  for (let index = 0; index < TEMPO_ONBOARDING_SEGMENTS.length; index += 1) {
    const segment = TEMPO_ONBOARDING_SEGMENTS[index];
    const slideUrl = config.slideUrlsById[segment.slideId];
    if (!slideUrl) {
      throw new Error(`Missing slide URL for slideId "${segment.slideId}".`);
    }

    const videoId = await createAvatarSegmentVideoJob({
      avatarId: config.avatarId,
      voiceId: config.voiceId,
      script: segment.script,
      slideUrl,
      segmentIndex: index,
    });
    console.log(`Segment ${index + 1} job submitted: ${videoId}. Polling...`);

    const pollResult = await pollHeygenVideo(videoId);
    if (pollResult.status === "failed" || !pollResult.videoUrl) {
      throw new Error(
        pollResult.failureMessage ?? `HeyGen segment ${index + 1} generation failed.`
      );
    }

    if (pollResult.duration) {
      console.log(`  Segment ${index + 1} duration: ${pollResult.duration.toFixed(1)}s`);
    }

    const downloadResponse = await fetch(pollResult.videoUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download segment ${index + 1}: ${downloadResponse.status}`);
    }

    const segmentBytes = Buffer.from(await downloadResponse.arrayBuffer());
    const segmentPath = `segments/segment-${String(index + 1).padStart(2, "0")}.mp4`;
    const { error: segmentUploadError } = await supabase.storage
      .from(config.outputStorageBucket)
      .upload(segmentPath, segmentBytes, { contentType: "video/mp4", upsert: true });

    if (segmentUploadError) {
      throw new Error(`Segment upload failed (${segmentPath}): ${segmentUploadError.message}`);
    }

    const { data: segmentPublic } = supabase.storage
      .from(config.outputStorageBucket)
      .getPublicUrl(segmentPath);
    segmentBuffers.push(segmentBytes);
    console.log(`  Segment ${index + 1} uploaded: ${segmentPublic.publicUrl}`);
  }

  return segmentBuffers;
}

async function renderOnboardingVideoBytes(
  config: HeygenVideoConfig,
  supabase: SupabaseClient
): Promise<Buffer> {
  const segmentBuffers = await generateSegmentVideos(config, supabase);
  console.log(`Concatenating ${segmentBuffers.length} segments locally with ffmpeg...`);
  return concatSegmentBuffers(segmentBuffers);
}

type VideoPollResult = {
  status: string;
  videoUrl: string | null;
  subtitleUrl: string | null;
  duration: number | null;
  failureMessage: string | null;
};

async function pollHeygenVideo(videoId: string): Promise<VideoPollResult> {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await heygenFetch<{
      data: {
        status: string;
        video_url?: string | null;
        subtitle_url?: string | null;
        duration?: number | null;
        failure_message?: string | null;
      };
    }>(`/v3/videos/${videoId}`);

    const {
      status,
      video_url: videoUrl,
      subtitle_url: subtitleUrl,
      duration,
      failure_message: failureMessage,
    } = response.data;

    if (status === "completed") {
      if (!videoUrl) {
        throw new Error(`Video ${videoId} completed but video_url is missing.`);
      }
      return { status, videoUrl, subtitleUrl: subtitleUrl ?? null, duration: duration ?? null, failureMessage: null };
    }

    if (status === "failed") {
      return {
        status,
        videoUrl: null,
        subtitleUrl: null,
        duration: null,
        failureMessage: failureMessage ?? "HeyGen video generation failed.",
      };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`HeyGen video ${videoId} timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`);
}

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
 * Renders slide PNGs and uploads them to Supabase — returns slideId → public URL map.
 */
export async function uploadOnboardingSlides(
  supabase: SupabaseClient,
  bucketName: string
): Promise<Record<string, string>> {
  const rendered = await renderOnboardingSlides();
  const slideUrlsById: Record<string, string> = {};

  for (const slide of rendered) {
    const storagePath = `slides/${slide.fileName}`;
    const { error } = await supabase.storage.from(bucketName).upload(storagePath, slide.pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) {
      throw new Error(`Slide upload failed (${slide.fileName}): ${error.message}`);
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    slideUrlsById[slide.slideId] = data.publicUrl;
  }

  return slideUrlsById;
}

/**
 * Generates Avatar III segment videos over slides, concatenates locally, uploads to Supabase.
 */
export async function generateHeygenVideo(
  config: HeygenVideoConfig
): Promise<{ storageUrl: string; captionsUrl: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  await ensurePublicBucket(supabase, config.outputStorageBucket);

  const slideUrlsById =
    Object.keys(config.slideUrlsById).length > 0
      ? config.slideUrlsById
      : await uploadOnboardingSlides(supabase, config.outputStorageBucket);

  const videoBytes = await renderOnboardingVideoBytes(
    { ...config, slideUrlsById },
    supabase
  );

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

  return { storageUrl: publicUrlData.publicUrl, captionsUrl: null };
}

function updateOnboardingVideoUrl(storageUrl: string, captionsUrl: string | null): void {
  const libPath = join(process.cwd(), "lib/tempo-onboarding-video.ts");
  const captionsLine = captionsUrl
    ? `export const TEMPO_ONBOARDING_CAPTIONS_URL =\n  "${captionsUrl}";`
    : "export const TEMPO_ONBOARDING_CAPTIONS_URL: string | null = null;";

  const content = `/**
 * tempo-onboarding-video.ts
 * Public Supabase Storage URLs for the Tempo simulation onboarding welcome video.
 * Updated by scripts/generate-heygen-video.ts after a successful HeyGen render + upload.
 */

/** MP4 served from the onboarding-videos bucket (tempo-welcome.mp4). */
export const TEMPO_ONBOARDING_VIDEO_URL =
  "${storageUrl}";

/** WebVTT captions for the onboarding video, when generated. */
${captionsLine}
`;
  writeFileSync(libPath, content, "utf8");
}

async function stitchExistingSegmentsFromSupabase(
  supabase: SupabaseClient,
  config: HeygenVideoConfig
): Promise<{ storageUrl: string; captionsUrl: string | null }> {
  const segmentBuffers: Buffer[] = [];

  for (let index = 0; index < TEMPO_ONBOARDING_SEGMENTS.length; index += 1) {
    const segmentPath = `segments/segment-${String(index + 1).padStart(2, "0")}.mp4`;
    const { data, error } = await supabase.storage
      .from(config.outputStorageBucket)
      .download(segmentPath);

    if (error || !data) {
      throw new Error(`Missing segment ${segmentPath}: ${error?.message ?? "not found"}`);
    }

    segmentBuffers.push(Buffer.from(await data.arrayBuffer()));
    console.log(`  Loaded ${segmentPath} (${(segmentBuffers.at(-1)!.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log(`Concatenating ${segmentBuffers.length} segments locally with ffmpeg...`);
  const videoBytes = concatSegmentBuffers(segmentBuffers);

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

  return { storageUrl: publicUrlData.publicUrl, captionsUrl: null };
}

async function runCli(): Promise<void> {
  loadEnvLocalIfNeeded();

  const stitchOnly = process.argv.includes("--stitch-only");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const bucket = "onboarding-videos";

  if (stitchOnly) {
    console.log("Stitch-only mode: downloading existing segments from Supabase...");
    const result = await stitchExistingSegmentsFromSupabase(supabase, {
      avatarId: "",
      voiceId: "",
      slideUrlsById: {},
      outputStorageBucket: bucket,
      outputStoragePath: "tempo-welcome.mp4",
    });
    console.log(`\nOnboarding video uploaded: ${result.storageUrl}`);
    updateOnboardingVideoUrl(result.storageUrl, result.captionsUrl);
    console.log("Updated lib/tempo-onboarding-video.ts.");
    return;
  }

  console.log("Rendering and uploading slide deck...");
  const slideUrlsById = await uploadOnboardingSlides(supabase, bucket);
  for (const [slideId, url] of Object.entries(slideUrlsById)) {
    console.log(`  slide ${slideId}: ${url}`);
  }

  const selection = await selectAvatarAndVoice();
  console.log("Selected avatar/voice:");
  console.log(`  avatar_id: ${selection.avatarId}`);
  console.log(`  avatar_name: ${selection.avatarName}`);
  console.log(`  avatar_type: ${selection.avatarType}`);
  console.log(`  engine: avatar_iii`);
  console.log(`  voice_id: ${selection.voiceId}`);
  console.log(`  preview_image: ${selection.previewImageUrl ?? "(none)"}`);
  console.log(`  reason: ${selection.selectionReason}`);

  const result = await generateHeygenVideo({
    avatarId: selection.avatarId,
    voiceId: selection.voiceId,
    slideUrlsById,
    outputStorageBucket: bucket,
    outputStoragePath: "tempo-welcome.mp4",
    captionsStoragePath: "tempo-welcome.srt",
  });

  console.log(`\nOnboarding video uploaded: ${result.storageUrl}`);
  if (result.captionsUrl) {
    console.log(`Captions uploaded: ${result.captionsUrl}`);
  }
  updateOnboardingVideoUrl(result.storageUrl, result.captionsUrl);
  console.log("Updated lib/tempo-onboarding-video.ts.");
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
