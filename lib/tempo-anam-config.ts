/**
 * tempo-anam-config.ts
 * Per-stage Anam avatar ID resolution for Tempo Discovery and Objection Handling.
 * Used by the server-side anam-session route; client receives only session tokens.
 */

/** Fallback avatar IDs from env when simulation.anam_avatar_ids has no entry. */
export const TEMPO_ANAM_AVATAR_IDS: Record<string, string> = {
  discovery: process.env.ANAM_AVATAR_ID_DANA ?? "",
  objections: process.env.ANAM_AVATAR_ID_KIM ?? "",
};

const ANAM_STAGES = ["discovery", "objections"] as const;

export type AnamSessionStage = (typeof ANAM_STAGES)[number];

/**
 * Returns true when the stage string is a supported Anam call stage.
 */
export function isAnamSessionStage(stage: string): stage is AnamSessionStage {
  return (ANAM_STAGES as readonly string[]).includes(stage);
}

/**
 * Normalizes a jsonb map from simulations.anam_avatar_ids into string values.
 */
export function normalizeAnamAvatarIds(
  value: unknown
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed) {
      out[key] = trimmed;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Resolves the Anam avatar ID for a stage:
 * 1. simulation.anam_avatar_ids[stage] when non-empty
 * 2. TEMPO_ANAM_AVATAR_IDS[stage] env fallback
 * 3. '' when neither is configured (caller treats as error)
 */
export function getAnamAvatarId(
  stage: string,
  simulationAnamAvatarIds: Record<string, string> | null
): string {
  const fromSimulation = simulationAnamAvatarIds?.[stage]?.trim();
  if (fromSimulation) {
    return fromSimulation;
  }

  const fromEnv = TEMPO_ANAM_AVATAR_IDS[stage]?.trim();
  return fromEnv ?? "";
}
