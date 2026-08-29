/**
 * parse-vtt.ts
 * Lightweight WebVTT parser for client-side caption display.
 */

export type VttCue = {
  start: number;
  end: number;
  text: string;
};

/**
 * Converts a WebVTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to seconds.
 */
function vttTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.trim().split(":");
  if (parts.length === 3) {
    return (
      Number.parseFloat(parts[0]) * 3600 +
      Number.parseFloat(parts[1]) * 60 +
      Number.parseFloat(parts[2])
    );
  }
  if (parts.length === 2) {
    return Number.parseFloat(parts[0]) * 60 + Number.parseFloat(parts[1]);
  }
  return Number.parseFloat(parts[0]);
}

/**
 * Parses WebVTT content into timed caption cues.
 */
export function parseVtt(content: string): VttCue[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const blocks = normalized.split(/\n\n+/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    if (!block.includes("-->")) {
      continue;
    }

    const lines = block.split("\n");
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex === -1) {
      continue;
    }

    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
    const text = lines
      .slice(timeLineIndex + 1)
      .join("\n")
      .trim();
    if (!text) {
      continue;
    }

    cues.push({
      start: vttTimestampToSeconds(startRaw),
      end: vttTimestampToSeconds(endRaw),
      text,
    });
  }

  return cues;
}
