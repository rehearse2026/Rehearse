/**
 * composite-onboarding-pip.ts
 * One-off local ffmpeg compositor: slide PNG deck + existing tempo-welcome.mp4 PiP preview.
 * No HeyGen API calls, no Supabase writes — output stays under build/onboarding-pip-work/.
 */

import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import ffmpegPath from "ffmpeg-static";

// ── Constants (from docs/tempo-onboarding-video-generation.md) ────────────────

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

const WELCOME_VIDEO_URL =
  "https://visuvrjmcoanndndimfw.supabase.co/storage/v1/object/public/onboarding-videos/tempo-welcome.mp4";

const SLIDES_BASE_URL =
  "https://visuvrjmcoanndndimfw.supabase.co/storage/v1/object/public/onboarding-videos/slides/";

const WORK_DIR = join(process.cwd(), "build", "onboarding-pip-work");
const WELCOME_VIDEO_NAME = "tempo-welcome.mp4";
const SLIDES_TRACK_NAME = "slides-track.mp4";
const OUTPUT_NAME = "onboarding-pip-preview.mp4";

const DURATION_TOLERANCE_SEC = 0.5;
const PIP_HEIGHT_PX = 440;
const PIP_MARGIN_PX = 64;
const PIP_BORDER_PX = 4;

type InputSource = "local" | "downloaded";

type ResolvedInput = {
  path: string;
  source: InputSource;
};

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
 * Reads deck gold accent hex from render-onboarding-slides.ts without importing it.
 */
function readDeckAccentColor(): { hex: string; flaggedFallback: boolean } {
  const sourcePath = join(process.cwd(), "scripts/lib/render-onboarding-slides.ts");
  if (!existsSync(sourcePath)) {
    console.warn("WARNING: Could not read scripts/lib/render-onboarding-slides.ts — using #FFFFFF border.");
    return { hex: "#FFFFFF", flaggedFallback: true };
  }

  const source = readFileSync(sourcePath, "utf8");
  const match = source.match(/accent:\s*"([^"]+)"/);
  if (!match) {
    console.warn("WARNING: accent color not found in render-onboarding-slides.ts — using #FFFFFF border.");
    return { hex: "#FFFFFF", flaggedFallback: true };
  }

  return { hex: match[1], flaggedFallback: false };
}

/**
 * Converts #RRGGBB to ffmpeg pad color (no hash).
 */
function ffmpegColor(hex: string): string {
  return hex.replace(/^#/, "");
}

/**
 * Searches candidate directories for a file; returns first hit or null.
 */
function findLocalFile(fileName: string, subdirs: string[] = [""]): string | null {
  const roots = [
    WORK_DIR,
    join(process.cwd(), "build"),
    join(process.cwd(), "tmp"),
    join(process.cwd(), "output"),
    "/tmp",
  ];

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
 * Downloads a public URL once into the work directory.
 */
async function downloadToWorkDir(fileName: string, url: string): Promise<string> {
  const dest = join(WORK_DIR, fileName);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error(`Download failed for ${url}: empty response body.`);
  }

  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
  return dest;
}

/**
 * Resolves an input file from local search paths or a one-time public download.
 */
async function resolveInput(
  fileName: string,
  downloadUrl: string | null,
  localSubdirs: string[] = [""]
): Promise<ResolvedInput> {
  const local = findLocalFile(fileName, localSubdirs);
  if (local) {
    return { path: local, source: "local" };
  }

  if (!downloadUrl) {
    throw new Error(`Missing required input "${fileName}" — not found locally and no download URL provided.`);
  }

  mkdirSync(WORK_DIR, { recursive: true });
  const downloaded = await downloadToWorkDir(fileName, downloadUrl);
  return { path: downloaded, source: "downloaded" };
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
  console.warn("Using documented fallback durations from tempo-onboarding-video-generation.md:");
  console.warn(`  ${DOCUMENTED_SEGMENT_DURATIONS.join(", ")}`);
  console.warn("Slide boundaries are NOT measured — verify alignment by eye in the preview.");
  console.warn("=".repeat(72));
  console.warn("");

  return { durations: [...DOCUMENTED_SEGMENT_DURATIONS], source: "documented" };
}

/**
 * Renders one still slide to a short MP4 clip with an exact duration.
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
    "scale=1920:1080,setsar=1",
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
 * Reports whether bottom-right PiP likely overlaps slide bullet text.
 */
function reportPipOverlapRisk(): void {
  console.log("");
  console.log("PiP overlap assessment (from scripts/lib/render-onboarding-slides.ts layout):");
  console.log("  - Bullets are left-aligned at x=120, starting y=420 (+72px per line).");
  console.log("  - Slide page counter sits bottom-right at x=1780, y=1020.");
  console.log(
    `  - PiP box: ~${PIP_HEIGHT_PX}px tall, ${PIP_MARGIN_PX}px margin from bottom-right (16:9 width ~782px).`
  );
  console.log("  - Bullet text stays on the left; PiP occupies the bottom-right quadrant.");
  console.log("  - Slide 4 (five bullets) extends vertically to ~y=708 — overlaps PiP vertically,");
  console.log("    but bullets remain left-aligned and are unlikely to sit under the presenter.");
  console.log("  - The bottom-right page counter (e.g. \"5 / 5\") WILL likely be covered by the PiP box.");
  console.log("  - Repositioning the PiP is a human review decision — this script does not change layout.");
}

/**
 * Main entry: verify inputs, build slides track, composite PiP, print report.
 */
async function main(): Promise<void> {
  mkdirSync(WORK_DIR, { recursive: true });

  const welcomeResolved = await resolveInput(WELCOME_VIDEO_NAME, WELCOME_VIDEO_URL);
  console.log(`tempo-welcome.mp4: ${welcomeResolved.source} → ${welcomeResolved.path}`);

  const slideResolutions: ResolvedInput[] = [];
  for (const slideName of SLIDE_FILE_NAMES) {
    const resolved = await resolveInput(slideName, `${SLIDES_BASE_URL}${slideName}`, ["slides"]);
    slideResolutions.push(resolved);
    console.log(`${slideName}: ${resolved.source} → ${resolved.path}`);
  }

  const welcomeDest = join(WORK_DIR, WELCOME_VIDEO_NAME);
  if (welcomeResolved.path !== welcomeDest) {
    copyFileSync(welcomeResolved.path, welcomeDest);
  }
  const welcomeInWork = welcomeDest;

  const slidesInWork = slideResolutions.map((resolution, index) => {
    const dest = join(WORK_DIR, SLIDE_FILE_NAMES[index]);
    if (resolution.path !== dest) {
      copyFileSync(resolution.path, dest);
    }
    return dest;
  });

  const { durations, source: durationSource } = resolveSegmentDurations();
  const segmentTimings = buildSegmentTimings(durations, durationSource);

  console.log("");
  console.log(`Segment durations (${durationSource}):`);
  segmentTimings.forEach((timing) => {
    console.log(
      `  Slide ${timing.index} (${timing.slideFileName}): start=${timing.startSec.toFixed(3)}s, duration=${timing.durationSec.toFixed(3)}s`
    );
  });

  const welcomeDuration = probeDurationSeconds(welcomeInWork);
  const slidesSum = durations.reduce((sum, value) => sum + value, 0);
  const delta = Math.abs(welcomeDuration - slidesSum);

  console.log("");
  console.log(`tempo-welcome.mp4 duration: ${welcomeDuration.toFixed(3)}s`);
  console.log(`Sum of segment durations:   ${slidesSum.toFixed(3)}s`);
  console.log(`Delta:                      ${delta.toFixed(3)}s`);

  if (delta > DURATION_TOLERANCE_SEC) {
    throw new Error(
      `Duration mismatch (${delta.toFixed(3)}s > ${DURATION_TOLERANCE_SEC}s tolerance). ` +
        "Aborting to avoid misaligned slide switches."
    );
  }

  console.log("");
  console.log("PART 2: Building slides-track.mp4 ...");
  const slidesTrackPath = buildSlidesTrack(slidesInWork, durations);

  const slidesTrackDuration = probeDurationSeconds(slidesTrackPath);
  const slidesTrackDelta = Math.abs(slidesTrackDuration - welcomeDuration);
  console.log(`slides-track.mp4 duration: ${slidesTrackDuration.toFixed(3)}s`);
  console.log(`tempo-welcome.mp4 duration: ${welcomeDuration.toFixed(3)}s`);
  console.log(`slides-track delta:        ${slidesTrackDelta.toFixed(3)}s`);

  if (slidesTrackDelta > DURATION_TOLERANCE_SEC) {
    throw new Error(
      `slides-track.mp4 duration mismatch (${slidesTrackDelta.toFixed(3)}s > ${DURATION_TOLERANCE_SEC}s).`
    );
  }

  const { hex: accentHex, flaggedFallback } = readDeckAccentColor();
  const borderColor = ffmpegColor(accentHex);
  if (flaggedFallback) {
    console.warn("Border color fallback in use — verify visually.");
  } else {
    console.log(`PiP border color (deck accent): ${accentHex}`);
  }

  const outputPath = join(WORK_DIR, OUTPUT_NAME);
  const padTotal = PIP_BORDER_PX * 2;

  console.log("");
  console.log("PART 3: Compositing picture-in-picture preview ...");

  const filterComplex =
    `[1:v]scale=-2:${PIP_HEIGHT_PX}[pip];` +
    `[pip]pad=iw+${padTotal}:ih+${padTotal}:${PIP_BORDER_PX}:${PIP_BORDER_PX}:color=${borderColor}[pipborder];` +
    `[0:v][pipborder]overlay=W-w-${PIP_MARGIN_PX}:H-h-${PIP_MARGIN_PX}[out]`;

  try {
    runFfmpeg([
      "-y",
      "-i",
      slidesTrackPath,
      "-i",
      welcomeInWork,
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
      welcomeInWork,
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
  console.log(`tempo-welcome.mp4: ${welcomeResolved.source}`);
  SLIDE_FILE_NAMES.forEach((name, index) => {
    console.log(`${name}: ${slideResolutions[index].source}`);
  });
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

  reportPipOverlapRisk();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
