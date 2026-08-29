/**
 * generate-onboarding-video.ts
 * Orchestrates one continuous HeyGen presenter render, caption-derived slide timings,
 * 50/50 composite, and v2 Supabase upload. ONE HeyGen render per invocation.
 */

import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { TEMPO_ONBOARDING_SEGMENTS } from "./config/tempo-onboarding-script";
import {
  alignSegmentsToCaptions,
  parseSrtCaptions,
  type ScriptSegmentInput,
} from "./lib/align-script-to-captions";
import { srtToVtt } from "./lib/srt-to-vtt";

const HEYGEN_API_BASE = "https://api.heygen.com";
const POLL_INTERVAL_MS = 5_000;
const GENERATION_TIMEOUT_MS = 25 * 60 * 1_000;

const AVATAR_ID = "abb82a33ff074a4781f78ae54275f78c";
const VOICE_ID = "6990bd1c1293466aaf025743758623ed";

const WORK_DIR = join(process.cwd(), "build", "onboarding-pip-work");
const PROTECTED_PRESENTER = join(WORK_DIR, "presenter-heygen.mp4");
const V2_VIDEO = join(WORK_DIR, "presenter-heygen-v2.mp4");
const V2_SRT = join(WORK_DIR, "presenter-heygen-v2.srt");
const V2_VTT_LOCAL = join(WORK_DIR, "tempo-welcome-v2.vtt");
const TIMINGS_PATH = join(process.cwd(), "scripts/config/onboarding-segment-timings.json");
const COMPOSITE_OUTPUT = join(WORK_DIR, "onboarding-pip-preview.mp4");

const DOCUMENTED_DURATIONS = [13.2, 17.8, 12.2, 16.8, 12.4];
const SEGMENT_KEYS = ["welcome", "product", "assignment", "stages", "ready"] as const;
const MIN_SEGMENT_SEC = 3;
const DURATION_TOLERANCE_SEC = 0.5;

const BUCKET = "onboarding-videos";
const SUPABASE_VIDEO_PATH = "tempo-welcome-v2.mp4";
const SUPABASE_VTT_PATH = "tempo-welcome-v2.vtt";

type TimingsFile = {
  measuredAt: string;
  source: string;
  totalDurationSec: number;
  segments: Array<{
    key: string;
    startsAt: number;
    duration: number;
    confidence: string;
  }>;
};

/**
 * Loads environment variables from .env.local when unset.
 */
function loadEnvLocalIfNeeded(): void {
  if (process.env.HEYGEN_API_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function getHeygenApiKey(): string {
  const key = process.env.HEYGEN_API_KEY?.trim();
  if (!key) throw new Error("Missing HEYGEN_API_KEY.");
  return key;
}

async function heygenFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getHeygenApiKey(),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`HeyGen ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body as T;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function probeDurationSeconds(filePath: string): number {
  if (!ffmpegPath) throw new Error("ffmpeg-static unavailable.");
  const probe = spawnSync(ffmpegPath, ["-hide_banner", "-i", filePath], { encoding: "utf8" });
  const stderr = `${probe.stderr ?? ""}${probe.stdout ?? ""}`;
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not probe duration: ${filePath}`);
  return (
    Number.parseInt(match[1], 10) * 3600 +
    Number.parseInt(match[2], 10) * 60 +
    Number.parseFloat(match[3])
  );
}

async function downloadUrl(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${url}: HTTP ${response.status}`);
  if (!response.body) throw new Error(`Download failed ${url}: empty body`);
  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
}

function buildContinuousScript(): string {
  return TEMPO_ONBOARDING_SEGMENTS.map((segment) => segment.script).join(" ");
}

function segmentInputs(): ScriptSegmentInput[] {
  return TEMPO_ONBOARDING_SEGMENTS.map((segment) => ({
    key: segment.slideId,
    script: segment.script,
  }));
}

/**
 * ONE HeyGen render — do not call twice.
 */
async function renderPresenterV2(fullScript: string): Promise<{ videoId: string }> {
  console.log(`Submitting ONE continuous HeyGen render (${fullScript.length} chars)...`);
  const response = await heygenFetch<{ data: { video_id: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: AVATAR_ID,
      voice_id: VOICE_ID,
      script: fullScript,
      title: "Tempo Onboarding Presenter v2",
      aspect_ratio: "16:9",
      resolution: "1080p",
      engine: { type: "avatar_iii" },
      caption: { file_format: "srt" },
    }),
  });

  const videoId = response.data?.video_id;
  if (!videoId) throw new Error("HeyGen did not return video_id.");
  console.log(`HeyGen job submitted: ${videoId}`);
  return { videoId };
}

async function pollAndDownload(videoId: string): Promise<void> {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await heygenFetch<{
      data: {
        status: string;
        video_url?: string | null;
        subtitle_url?: string | null;
        failure_message?: string | null;
      };
    }>(`/v3/videos/${videoId}`);

    const { status, video_url: videoUrl, subtitle_url: subtitleUrl, failure_message: failureMessage } =
      response.data;

    if (status === "completed") {
      if (!videoUrl || !subtitleUrl) {
        throw new Error("HeyGen completed but video_url or subtitle_url missing.");
      }
      console.log("Downloading presenter-heygen-v2.mp4 and .srt ...");
      await downloadUrl(videoUrl, V2_VIDEO);
      await downloadUrl(subtitleUrl, V2_SRT);
      return;
    }

    if (status === "failed") {
      throw new Error(failureMessage ?? "HeyGen render failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`HeyGen job ${videoId} timed out.`);
}

function finalizeTimings(
  aligned: ReturnType<typeof alignSegmentsToCaptions>,
  totalDuration: number
): { segments: TimingsFile["segments"]; source: string; warnings: string[] } {
  const warnings: string[] = [];
  const documentedSum = DOCUMENTED_DURATIONS.reduce((sum, value) => sum + value, 0);
  const hasFailure = aligned.some((segment, index) => index > 0 && segment.confidence === "failed");

  if (hasFailure) {
    warnings.push("One or more caption boundaries failed — using scaled fallback for failed segments.");
    let startAt = 0;
    const segments = SEGMENT_KEYS.map((key, index) => {
      const scaled =
        index === SEGMENT_KEYS.length - 1
          ? totalDuration - startAt
          : (DOCUMENTED_DURATIONS[index] / documentedSum) * totalDuration;
      const segment = {
        key,
        startsAt: Number(startAt.toFixed(3)),
        duration: Number(Math.max(MIN_SEGMENT_SEC, scaled).toFixed(3)),
        confidence: "fallback",
      };
      startAt += segment.duration;
      return segment;
    });
    segments[segments.length - 1].duration = Number(
      Math.max(MIN_SEGMENT_SEC, totalDuration - segments[segments.length - 1].startsAt).toFixed(3)
    );
    return { segments, source: "mixed", warnings };
  }

  const segments: TimingsFile["segments"] = [];
  for (let index = 0; index < aligned.length; index += 1) {
    const startsAt = index === 0 ? 0 : aligned[index].startsAt;
    const nextStart = index < aligned.length - 1 ? aligned[index + 1].startsAt : totalDuration;
    let duration = nextStart - startsAt;

    if (duration < MIN_SEGMENT_SEC || startsAt + duration > totalDuration + DURATION_TOLERANCE_SEC) {
      duration = (DOCUMENTED_DURATIONS[index] / documentedSum) * totalDuration;
      warnings.push(`Segment "${aligned[index].key}" failed sanity check — used scaled fallback duration.`);
      segments.push({
        key: aligned[index].key,
        startsAt: Number(startsAt.toFixed(3)),
        duration: Number(Math.max(MIN_SEGMENT_SEC, duration).toFixed(3)),
        confidence: "fallback",
      });
      continue;
    }

    segments.push({
      key: aligned[index].key,
      startsAt: Number(startsAt.toFixed(3)),
      duration: Number(duration.toFixed(3)),
      confidence: aligned[index].confidence,
    });
  }

  segments[0].startsAt = 0;
  for (let index = 0; index < segments.length - 1; index += 1) {
    segments[index].duration = Number((segments[index + 1].startsAt - segments[index].startsAt).toFixed(3));
  }
  segments[segments.length - 1].duration = Number(
    (totalDuration - segments[segments.length - 1].startsAt).toFixed(3)
  );

  const usedFallback = segments.some((segment) => segment.confidence === "fallback");
  const source = usedFallback ? "mixed" : "caption-alignment";
  return { segments, source, warnings };
}

function writeTimingsFile(totalDuration: number, segments: TimingsFile["segments"], source: string): void {
  const payload: TimingsFile = {
    measuredAt: new Date().toISOString().slice(0, 10),
    source,
    totalDurationSec: Number(totalDuration.toFixed(3)),
    segments,
  };
  writeFileSync(TIMINGS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function runComposite(): Promise<void> {
  console.log("\nRunning 50/50 composite (npm run composite:onboarding-pip) ...");
  const { execFileSync } = await import("child_process");
  execFileSync("npm", ["run", "composite:onboarding-pip"], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: {
      ...process.env,
      ONBOARDING_PRESENTER_VIDEO: V2_VIDEO,
    },
  });
}

async function uploadV2Assets(): Promise<{ videoUrl: string; vttUrl: string }> {
  loadEnvLocalIfNeeded();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const srtContent = readFileSync(V2_SRT, "utf8");
  const vttContent = srtToVtt(srtContent);
  writeFileSync(V2_VTT_LOCAL, vttContent, "utf8");

  const videoBytes = readFileSync(COMPOSITE_OUTPUT);
  const { error: videoError } = await supabase.storage
    .from(BUCKET)
    .upload(SUPABASE_VIDEO_PATH, videoBytes, { contentType: "video/mp4", upsert: true });
  if (videoError) throw new Error(`Video upload failed: ${videoError.message}`);

  const { error: vttError } = await supabase.storage
    .from(BUCKET)
    .upload(SUPABASE_VTT_PATH, Buffer.from(vttContent, "utf8"), {
      contentType: "text/vtt",
      upsert: true,
    });
  if (vttError) throw new Error(`VTT upload failed: ${vttError.message}`);

  const { data: videoPublic } = supabase.storage.from(BUCKET).getPublicUrl(SUPABASE_VIDEO_PATH);
  const { data: vttPublic } = supabase.storage.from(BUCKET).getPublicUrl(SUPABASE_VTT_PATH);

  return { videoUrl: videoPublic.publicUrl, vttUrl: vttPublic.publicUrl };
}

async function main(): Promise<void> {
  loadEnvLocalIfNeeded();
  mkdirSync(WORK_DIR, { recursive: true });

  const protectedHashBefore = existsSync(PROTECTED_PRESENTER) ? sha256File(PROTECTED_PRESENTER) : null;

  const fullScript = buildContinuousScript();
  console.log(`Continuous script length: ${fullScript.length} characters`);

  const { videoId } = await renderPresenterV2(fullScript);
  await pollAndDownload(videoId);

  const totalDuration = probeDurationSeconds(V2_VIDEO);
  console.log(`ffprobe total duration: ${totalDuration.toFixed(3)}s`);

  const srtContent = readFileSync(V2_SRT, "utf8");
  const captions = parseSrtCaptions(srtContent);
  const aligned = alignSegmentsToCaptions(segmentInputs(), captions, totalDuration);
  const { segments, source, warnings } = finalizeTimings(aligned, totalDuration);

  if (warnings.length > 0) {
    console.warn("\n" + "=".repeat(72));
    warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));
    console.warn("=".repeat(72) + "\n");
  }

  console.log("Slide boundaries:");
  segments.forEach((segment) => {
    console.log(
      `  ${segment.key}: start=${segment.startsAt.toFixed(3)}s duration=${segment.duration.toFixed(3)}s confidence=${segment.confidence}`
    );
  });

  const durationSum = segments.reduce((sum, segment) => sum + segment.duration, 0);
  console.log(`Sum of segment durations: ${durationSum.toFixed(3)}s (delta ${Math.abs(durationSum - totalDuration).toFixed(3)}s)`);

  writeTimingsFile(totalDuration, segments, source);

  await runComposite();
  const uploadUrls = await uploadV2Assets();

  if (protectedHashBefore && existsSync(PROTECTED_PRESENTER)) {
    const protectedHashAfter = sha256File(PROTECTED_PRESENTER);
    if (protectedHashAfter !== protectedHashBefore) {
      throw new Error("PROTECTED presenter-heygen.mp4 was modified — aborting.");
    }
    console.log("Verified: presenter-heygen.mp4 unchanged.");
  }

  console.log("\n" + "=".repeat(72));
  console.log("V2 ONBOARDING VIDEO COMPLETE");
  console.log("=".repeat(72));
  console.log(`Local composite: ${COMPOSITE_OUTPUT}`);
  console.log(`Local presenter: ${V2_VIDEO}`);
  console.log(`Local captions:  ${V2_SRT}`);
  console.log(`Timings file:    ${TIMINGS_PATH}`);
  console.log(`Supabase video:  ${uploadUrls.videoUrl}`);
  console.log(`Supabase VTT:    ${uploadUrls.vttUrl}`);
  console.log(`HeyGen renders:  1 (job ${videoId})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
