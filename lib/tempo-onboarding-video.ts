/**
 * tempo-onboarding-video.ts
 * Public Supabase Storage URLs for the Tempo simulation onboarding welcome video.
 * Updated by scripts/generate-heygen-video.ts after a successful HeyGen render + upload.
 */

/** MP4 served from the onboarding-videos bucket — slide deck + presenter PiP composite. */
export const TEMPO_ONBOARDING_VIDEO_URL =
  "https://visuvrjmcoanndndimfw.supabase.co/storage/v1/object/public/onboarding-videos/tempo-welcome.mp4?v=pip-20260829";

/** WebVTT captions for the onboarding video, when generated. */
export const TEMPO_ONBOARDING_CAPTIONS_URL: string | null = null;
