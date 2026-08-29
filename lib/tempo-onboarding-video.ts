/**
 * tempo-onboarding-video.ts
 * Public Supabase Storage URLs for the Tempo simulation onboarding welcome video.
 * Updated by scripts/generate-heygen-video.ts after a successful HeyGen render + upload.
 */

/** MP4 served from the onboarding-videos bucket — slide deck (left) + presenter (right) composite. */
export const TEMPO_ONBOARDING_VIDEO_URL =
  "https://visuvrjmcoanndndimfw.supabase.co/storage/v1/object/public/onboarding-videos/tempo-welcome-v2.mp4";

/** WebVTT captions for the onboarding video, when generated. */
export const TEMPO_ONBOARDING_CAPTIONS_URL: string | null =
  "https://visuvrjmcoanndndimfw.supabase.co/storage/v1/object/public/onboarding-videos/tempo-welcome-v2.vtt";
