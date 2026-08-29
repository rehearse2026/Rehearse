/**
 * srt-to-vtt.ts
 * Converts SubRip (SRT) caption files to WebVTT for HTML video tracks.
 */

/**
 * Converts SRT timestamp commas to VTT periods (00:00:01,500 → 00:00:01.500).
 */
function srtTimestampToVtt(timestamp: string): string {
  return timestamp.trim().replace(/,/g, ".");
}

/**
 * Converts raw SRT content to WebVTT format.
 */
export function srtToVtt(srtContent: string): string {
  const normalized = srtContent.replace(/\r\n/g, "\n").trim();
  const blocks = normalized.split(/\n\n+/);
  const cues: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    if (lines.length < 2) {
      continue;
    }

    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex === -1) {
      continue;
    }

    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
    const text = lines.slice(timeLineIndex + 1).join("\n").trim();
    if (!text) {
      continue;
    }

    cues.push(`${srtTimestampToVtt(startRaw)} --> ${srtTimestampToVtt(endRaw)}\n${text}`);
  }

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
