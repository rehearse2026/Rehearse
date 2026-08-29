/**
 * align-script-to-captions.ts
 * Deterministic caption-to-segment boundary alignment for multi-part narration scripts.
 * Simulation-agnostic — no provider calls, no LLM.
 */

import { similarity } from "../../lib/string-similarity";

export type ParsedCaption = {
  startsAt: number;
  endsAt: number;
  text: string;
};

export type ScriptSegmentInput = {
  key: string;
  script: string;
};

export type AlignedSegment = {
  key: string;
  startsAt: number;
  duration: number;
  confidence: "exact" | "fuzzy" | "failed";
};

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

const FUZZY_THRESHOLD = 0.72;
const OPENING_WORD_COUNT = 6;

/**
 * Parses an SRT timestamp (HH:MM:SS,mmm) into seconds.
 */
export function parseSrtTimestamp(timestamp: string): number {
  const cleaned = timestamp.trim().replace(",", ".");
  const match = cleaned.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid SRT timestamp: "${timestamp}"`);
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseFloat(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses raw SRT content into caption entries.
 */
export function parseSrtCaptions(srtContent: string): ParsedCaption[] {
  const normalized = srtContent.replace(/\r\n/g, "\n").trim();
  const blocks = normalized.split(/\n\n+/);
  const captions: ParsedCaption[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex === -1) {
      continue;
    }

    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
    const text = lines.slice(timeLineIndex + 1).join(" ").trim();
    if (!text) {
      continue;
    }

    captions.push({
      startsAt: parseSrtTimestamp(startRaw),
      endsAt: parseSrtTimestamp(endRaw),
      text,
    });
  }

  return captions;
}

/**
 * Normalizes text for caption-to-script comparison.
 */
export function normalizeAlignmentText(value: string): string {
  let normalized = value.toLowerCase();
  normalized = normalized.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => {
    return NUMBER_WORDS[word] ?? word;
  });
  normalized = normalized.replace(/\b(\d+)\b/g, (digits) => digits);
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

/**
 * Returns the first N words from normalized text.
 */
function openingPhrase(text: string, wordCount: number): string {
  const words = normalizeAlignmentText(text).split(" ").filter(Boolean);
  return words.slice(0, wordCount).join(" ");
}

/**
 * Finds the caption index whose text best matches a segment opening phrase.
 */
function findBoundaryIndex(
  captions: ParsedCaption[],
  segmentScript: string,
  searchFromIndex: number
): { index: number; confidence: "exact" | "fuzzy" | "failed" } {
  const target = openingPhrase(segmentScript, OPENING_WORD_COUNT);
  if (!target) {
    return { index: searchFromIndex, confidence: "failed" };
  }

  let bestIndex = -1;
  let bestScore = 0;

  for (let index = searchFromIndex; index < captions.length; index += 1) {
    const captionPhrase = openingPhrase(captions[index].text, OPENING_WORD_COUNT);
    if (captionPhrase === target) {
      return { index, confidence: "exact" };
    }

    const score = similarity(captionPhrase, target);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex >= 0 && bestScore >= FUZZY_THRESHOLD) {
    return { index: bestIndex, confidence: "fuzzy" };
  }

  return { index: searchFromIndex, confidence: "failed" };
}

/**
 * Aligns ordered script segments to caption timings for slide boundary detection.
 */
export function alignSegmentsToCaptions(
  segments: ScriptSegmentInput[],
  captions: ParsedCaption[],
  totalDuration: number
): AlignedSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const boundaryIndices: number[] = [0];
  const boundaryConfidence: Array<"exact" | "fuzzy" | "failed"> = ["exact"];
  let searchFrom = 0;

  for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
    const match = findBoundaryIndex(captions, segments[segmentIndex].script, searchFrom);
    boundaryIndices.push(match.index);
    boundaryConfidence.push(match.confidence);
    searchFrom = Math.max(searchFrom, match.index);
  }

  const aligned: AlignedSegment[] = [];

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const key = segments[segmentIndex].key;
    const captionIndex = boundaryIndices[segmentIndex];
    const startsAt =
      segmentIndex === 0 ? 0 : captions[captionIndex]?.startsAt ?? totalDuration;

    let duration: number;
    if (segmentIndex < segments.length - 1) {
      const nextIndex = boundaryIndices[segmentIndex + 1];
      const nextStart = captions[nextIndex]?.startsAt ?? totalDuration;
      duration = Math.max(0, nextStart - startsAt);
    } else {
      duration = Math.max(0, totalDuration - startsAt);
    }

    aligned.push({
      key,
      startsAt,
      duration,
      confidence: boundaryConfidence[segmentIndex],
    });
  }

  return aligned;
}
