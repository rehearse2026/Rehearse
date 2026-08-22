/**
 * AuthBrandPanel.tsx
 * Shared left navy brand panel for login and signup pages.
 * Optional full-bleed background photo under a navy scrim; logo + white wordmark.
 */

type AuthBrandPanelProps = {
  headline: string;
  subtext: string;
  /** Free stock photo shown behind the navy scrim (different per auth screen). */
  backgroundSrc?: string;
};

/**
 * Left panel: optional photo, logo + Rehearse wordmark, headline/subtext, copyright.
 */
export function AuthBrandPanel({
  headline,
  subtext,
  backgroundSrc,
}: AuthBrandPanelProps): React.ReactElement {
  return (
    <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary-container relative overflow-hidden p-8 xl:p-10">
      {backgroundSrc ? (
        <>
          <img
            src={backgroundSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover brightness-[0.65] saturate-[0.85]"
          />
          <div
            className="absolute inset-0 bg-primary-container/85"
            aria-hidden
          />
        </>
      ) : (
        <img
          src="/pitchlab-logo-new.png"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90%,520px)] max-w-none opacity-[0.06] rotate-[-12deg]"
        />
      )}

      <div className="relative z-10 flex items-center gap-3">
        <img
          src="/pitchlab-logo-new.png"
          alt=""
          className="h-9 w-auto brightness-0 invert"
        />
        <span className="text-white font-semibold text-3xl leading-9 tracking-tight">
          Rehearse
        </span>
      </div>

      <div className="relative z-10 mb-24">
        <h2 className="text-white font-semibold text-3xl leading-10 tracking-[-0.02em] mb-3">
          {headline}
        </h2>
        <p className="text-white/85 text-lg leading-7">{subtext}</p>
      </div>

      <div className="relative z-10">
        <p className="text-on-primary-container text-xs leading-4 tracking-[0.02em]">
          © 2026 Rehearse
        </p>
      </div>
    </div>
  );
}
