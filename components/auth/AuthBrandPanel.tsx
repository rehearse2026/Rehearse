/**
 * AuthBrandPanel.tsx
 * Shared left navy brand panel for login and signup pages.
 * Real logo mark + large faded logo watermark — same treatment on every auth screen.
 */

type AuthBrandPanelProps = {
  headline: string;
  subtext: string;
};

/**
 * Left panel: logo, headline/subtext, copyright; watermark uses the same logo asset.
 */
export function AuthBrandPanel({
  headline,
  subtext,
}: AuthBrandPanelProps): React.ReactElement {
  return (
    <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary-container relative overflow-hidden p-8 xl:p-10">
      <img
        src="/pitchlab-logo-new.png"
        alt=""
        aria-hidden
        className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90%,520px)] max-w-none opacity-[0.06] rotate-[-12deg]"
      />

      <div className="relative z-10">
        <img
          src="/pitchlab-logo-new.png"
          alt="Rehearse"
          className="h-8 w-auto brightness-0 invert"
        />
      </div>

      <div className="relative z-10 mb-24">
        <h2 className="text-on-primary font-semibold text-2xl leading-8 tracking-[-0.01em] mb-2">
          {headline}
        </h2>
        <p className="text-primary-fixed-dim text-base leading-6">{subtext}</p>
      </div>

      <div className="relative z-10">
        <p className="text-on-primary-container text-xs leading-4 tracking-[0.02em]">
          © 2026 Rehearse
        </p>
      </div>
    </div>
  );
}
