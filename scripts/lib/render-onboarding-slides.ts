/**
 * render-onboarding-slides.ts
 * Renders Tempo onboarding deck slides as 960x1080 PNG buffers (left-half layout) via SVG + sharp.
 */

import sharp from "sharp";
import {
  TEMPO_ONBOARDING_SLIDES,
  type OnboardingSlide,
} from "../config/tempo-onboarding-slides";

/** Left-half slide canvas — composited beside presenter in composite-onboarding-pip.ts */
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 1080;

const COLORS = {
  background: "#1a1a2e",
  accent: "#c9a84c",
  accentSoft: "#ffe08f",
  text: "#ffffff",
  muted: "#94a3b8",
  panel: "#0f172a",
};

/**
 * Escapes text for safe inclusion in SVG.
 */
function escapeSvg(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds one professional slide as an SVG string sized for the left half of the frame.
 */
function slideToSvg(slide: OnboardingSlide, index: number): string {
  const bulletLines = slide.bullets
    .map(
      (bullet, bulletIndex) => `
        <text x="56" y="${400 + bulletIndex * 64}" fill="${COLORS.text}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">
          ${escapeSvg(bullet)}
        </text>`
    )
    .join("");

  const subtitle = slide.subtitle
    ? `<text x="56" y="228" fill="${COLORS.accentSoft}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">${escapeSvg(slide.subtitle)}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${COLORS.background}" />
  <rect x="0" y="0" width="100%" height="8" fill="${COLORS.accent}" />
  <rect x="32" y="96" width="896" height="880" rx="16" fill="${COLORS.panel}" opacity="0.55" />
  <text x="56" y="148" fill="${COLORS.accent}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="3">TEMPO ONBOARDING</text>
  <text x="56" y="300" fill="${COLORS.text}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">${escapeSvg(slide.title)}</text>
  ${subtitle}
  ${bulletLines}
  <text x="904" y="1020" text-anchor="end" fill="${COLORS.muted}" font-family="Arial, Helvetica, sans-serif" font-size="20">${index + 1} / ${TEMPO_ONBOARDING_SLIDES.length}</text>
</svg>`;
}

export type RenderedSlide = {
  slideId: string;
  fileName: string;
  pngBuffer: Buffer;
};

/**
 * Renders all onboarding slides to PNG buffers ready for Supabase upload.
 */
export async function renderOnboardingSlides(): Promise<RenderedSlide[]> {
  const rendered: RenderedSlide[] = [];

  for (let index = 0; index < TEMPO_ONBOARDING_SLIDES.length; index += 1) {
    const slide = TEMPO_ONBOARDING_SLIDES[index];
    const svg = slideToSvg(slide, index);
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    rendered.push({
      slideId: slide.id,
      fileName: `slide-${String(index + 1).padStart(2, "0")}-${slide.id}.png`,
      pngBuffer,
    });
  }

  return rendered;
}
