/**
 * composite-onboarding-pip.ts
 * Local ffmpeg compositor: slide deck (left 50%) + HeyGen presenter video (right 50%).
 * No HeyGen API calls. Supabase upload is handled separately after local preview review.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { renderOnboardingSlides } from "./lib/render-onboarding-slides";

// ── Constants ─────────────────────────────────────────────────────────────────

const SLIDE_FILE_NAMES = [
  "slide-01-welcome.png",
  "slide-02-product.png",
  "slide-03-assignment.png",
  "slide-04-stages.png",
  "slide-05-ready.png",
] as const;

const SEGMENT_FILE_NAMES = [
  "segment-01.mp4",
  "segment-02.mp4",
  "segment-03.mp4",
  "segment-04.mp4",
  "segment-05.mp4",
] as const;

const DOCUMENTED_SEGMENT_DURATIONS = [13.2, 17.8, 12.2, 16.8, 12.4];

const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const HALF_WIDTH = FRAME_WIDTH / 2;

const WORK_DIR = join(process.cwd(), "build", "onboarding-pip-work");
const PRESENTER_NAME = "presenter-heygen.mp4";
const SLIDES_TRACK_NAME = "slides-track.mp4";
const OUTPUT_NAME = "onboarding-pip-preview.mp4";

const DURATION_TOLERANCE_SEC = 0.5;

type SegmentTiming = {
  index: number;
  slideFileName: string;
  startSec: number;
  durationSec: number;
  source: "measured" | "documented";
};

const ffmpegCommands: string[] = [];

/**
 * Returns the ffmpeg binary path or throws if unavailable.
 */
function getFfmpegPath(): string {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary is unavailable.");
  }
  return ffmpegPath;
}

/**
 * Runs ffprobe (via ffmpeg-static) and returns container duration in seconds.
 */
function probeDurationSeconds(filePath: string): number {
  const ff = getFfmpegPath();
  const probe = spawnSync(ff, ["-hide_banner", "-i", filePath], { encoding: "utf8" });
  const stderr = `${probe.stderr ?? ""}${probe.stdout ?? ""}`;
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`Could not read duration from ${filePath}.`);
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseFloat(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Executes ffmpeg with logged command line.
 */
function runFfmpeg(args: string[]): void {
  const ff = getFfmpegPath();
  const command = `${ff} ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ")}`;
  ffmpegCommands.push(command);
  execFileSync(ff, args, { stdio: "inherit" });
}

/**
 * Searches candidate directories for a presenter-only HeyGen MP4 (not the composited upload).
 */
function findPresenterVideo(): string | null {
  const candidates = [
    join(WORK_DIR, PRESENTER_NAME),
    join(WORK_DIR, "tempo-welcome.mp4"),
    "/tmp/tempo-welcome.mp4",
    join(process.cwd(), "build", "presenter-heygen.mp4"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Builds segment durations from local segment MP4s or documented fallback values.
 */
function resolveSegmentDurations(): {
  durations: number[];
  source: "measured" | "documented";
} {
  const measured: number[] = [];

  for (const segmentName of SEGMENT_FILE_NAMES) {
    const local = findLocalFile(segmentName, ["segments", ""]);
    if (!local) {
      measured.length = 0;
      break;
    }
    measured.push(probeDurationSeconds(local));
  }

  if (measured.length === SEGMENT_FILE_NAMES.length) {
    return { durations: measured, source: "measured" };
  }

  console.warn("");
  console.warn("=".repeat(72));
  console.warn("WARNING: Per-segment MP4s not found locally.");
  console.warn("Using documented fallback durations:");
  console.warn(`  ${DOCUMENTED_SEGMENT_DURATIONS.join(", ")}`);
  console.warn("Slide boundaries are NOT measured — verify alignment by eye in the preview.");
  console.warn("=".repeat(72));
  console.warn("");

  return { durations: [...DOCUMENTED_SEGMENT_DURATIONS], source: "documented" };
}

/**
 * Searches candidate directories for a file; returns first hit or null.
 */
function findLocalFile(fileName: string, subdirs: string[] = [""]): string | null {
  const roots = [WORK_DIR, join(process.cwd(), "build"), join(process.cwd(), "tmp"), "/tmp"];

  for (const root of roots) {
    for (const subdir of subdirs) {
      const candidate = subdir ? join(root, subdir, fileName) : join(root, fileName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Renders slide PNGs from config into the work directory.
 */
async function renderSlidesToWorkDir(): Promise<string[]> {
  const rendered = await renderOnboardingSlides();
  const paths: string[] = [];

  for (const slide of rendered) {
    const dest = join(WORK_DIR, slide.fileName);
    writeFileSync(dest, slide.pngBuffer);
    paths.push(dest);
    console.log(`  rendered ${slide.fileName}`);
  }

  return paths;
}

/**
 * Renders one still slide to a short MP4 clip with an exact duration (left-half size).
 */
function renderSlideClip(slidePath: string, durationSec: number, outputPath: string): void {
  runFfmpeg([
    "-y",
    "-loop",
    "1",
    "-framerate",
    "30",
    "-t",
    durationSec.toFixed(3),
    "-i",
    slidePath,
    "-vf",
    `scale=${HALF_WIDTH}:${FRAME_HEIGHT},setsar=1`,
    "-r",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    outputPath,
  ]);
}

/**
 * Builds slides-track.mp4 by rendering each slide to a timed clip, then concat-copying.
 */
function buildSlidesTrack(slidePaths: string[], durations: number[]): string {
  const clipPaths: string[] = [];

  slidePaths.forEach((slidePath, index) => {
    const clipPath = join(WORK_DIR, `slide-clip-${String(index + 1).padStart(2, "0")}.mp4`);
    renderSlideClip(slidePath, durations[index], clipPath);
    clipPaths.push(clipPath);
  });

  const clipListPath = join(WORK_DIR, "slide-clips-concat.txt");
  const listContent = clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n");
  writeFileSync(clipListPath, `${listContent}\n`, "utf8");

  const slidesTrackPath = join(WORK_DIR, SLIDES_TRACK_NAME);
  runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", clipListPath, "-c", "copy", slidesTrackPath]);

  return slidesTrackPath;
}

/**
 * Builds cumulative slide timing table for reporting.
 */
function buildSegmentTimings(durations: number[], source: "measured" | "documented"): SegmentTiming[] {
  let startSec = 0;
  return durations.map((durationSec, index) => {
    const timing: SegmentTiming = {
      index: index + 1,
      slideFileName: SLIDE_FILE_NAMES[index],
      startSec,
      durationSec,
      source,
    };
    startSec += durationSec;
    return timing;
  });
}

/**
 * Main entry: render slides, build track, composite 50/50 split, print report.
 */
async function main(): Promise<void> {
  mkdirSync(WORK_DIR, { recursive: true });

  const presenterSource = findPresenterVideo();
  if (!presenterSource) {
    throw new Error(
      `Missing presenter-only HeyGen MP4. Place it at ${join(WORK_DIR, PRESENTER_NAME)} ` +
        "or /tmp/tempo-welcome.mp4 (original talking-head file, not the composited upload)."
    );
  }

  const presenterDest = join(WORK_DIR, PRESENTER_NAME);
  if (presenterSource !== presenterDest) {
    copyFileSync(presenterSource, presenterDest);
  }

  console.log(`presenter video: local → ${presenterSource}`);

  console.log("Rendering slide PNGs from config ...");
  const slidesInWork = await renderSlidesToWorkDir();

  const { durations, source: durationSource } = resolveSegmentDurations();
  const segmentTimings = buildSegmentTimings(durations, durationSource);

  console.log("");
  console.log(`Segment durations (${durationSource}):`);
  segmentTimings.forEach((timing) => {
    console.log(
      `  Slide ${timing.index} (${timing.slideFileName}): start=${timing.startSec.toFixed(3)}s, duration=${timing.durationSec.toFixed(3)}s`
    );
  });

  const presenterDuration = probeDurationSeconds(presenterDest);
  const slidesSum = durations.reduce((sum, value) => sum + value, 0);
  const delta = Math.abs(presenterDuration - slidesSum);

  console.log("");
  console.log(`presenter duration:         ${presenterDuration.toFixed(3)}s`);
  console.log(`Sum of segment durations:   ${slidesSum.toFixed(3)}s`);
  console.log(`Delta:                      ${delta.toFixed(3)}s`);

  if (delta > DURATION_TOLERANCE_SEC) {
    throw new Error(
      `Duration mismatch (${delta.toFixed(3)}s > ${DURATION_TOLERANCE_SEC}s tolerance). ` +
        "Aborting to avoid misaligned slide switches."
    );
  }

  console.log("");
  console.log("Building slides-track.mp4 (left half) ...");
  const slidesTrackPath = buildSlidesTrack(slidesInWork, durations);

  const slidesTrackDuration = probeDurationSeconds(slidesTrackPath);
  const slidesTrackDelta = Math.abs(slidesTrackDuration - presenterDuration);
  console.log(`slides-track.mp4 duration: ${slidesTrackDuration.toFixed(3)}s`);
  console.log(`presenter duration:        ${presenterDuration.toFixed(3)}s`);
  console.log(`slides-track delta:        ${slidesTrackDelta.toFixed(3)}s`);

  if (slidesTrackDelta > DURATION_TOLERANCE_SEC) {
    throw new Error(
      `slides-track.mp4 duration mismatch (${slidesTrackDelta.toFixed(3)}s > ${DURATION_TOLERANCE_SEC}s).`
    );
  }

  const outputPath = join(WORK_DIR, OUTPUT_NAME);

  console.log("");
  console.log("Compositing 50/50 split (slides left, presenter right) ...");

  const filterComplex =
    `[0:v]scale=${HALF_WIDTH}:${FRAME_HEIGHT},setsar=1[left];` +
    `[1:v]scale=${HALF_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${HALF_WIDTH}:${FRAME_HEIGHT}:(iw-${HALF_WIDTH})/2:(ih-${FRAME_HEIGHT})/2,setsar=1[right];` +
    `[left][right]hstack=inputs=2[out]`;

  try {
    runFfmpeg([
      "-y",
      "-i",
      slidesTrackPath,
      "-i",
      presenterDest,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "1:a?",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      outputPath,
    ]);
  } catch {
    console.warn("Audio copy failed — re-encoding audio as AAC 192k 48kHz.");
    runFfmpeg([
      "-y",
      "-i",
      slidesTrackPath,
      "-i",
      presenterDest,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "1:a?",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      outputPath,
    ]);
  }

  const outputDuration = probeDurationSeconds(outputPath);

  console.log("");
  console.log("=".repeat(72));
  console.log("COMPOSITE PREVIEW SUMMARY");
  console.log("=".repeat(72));
  console.log(`Layout: slides left ${HALF_WIDTH}px, presenter right ${HALF_WIDTH}px (${FRAME_WIDTH}x${FRAME_HEIGHT})`);
  console.log(`Presenter source: ${presenterSource}`);
  console.log(`Durations: ${durationSource === "measured" ? "measured via ffprobe on local segments" : "DOCUMENTED FALLBACK — verify by eye"}`);
  segmentTimings.forEach((timing) => {
    console.log(
      `  Slide ${timing.index}: start ${timing.startSec.toFixed(3)}s, duration ${timing.durationSec.toFixed(3)}s (${timing.slideFileName})`
    );
  });
  console.log(`Output: ${outputPath}`);
  console.log(`Output duration: ${outputDuration.toFixed(3)}s`);
  console.log("");
  console.log("FFmpeg commands executed:");
  ffmpegCommands.forEach((command, index) => {
    console.log(`  ${index + 1}. ${command}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
