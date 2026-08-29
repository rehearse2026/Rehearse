# Onboarding Video Cleanup Report

Generated: August 29, 2026

This report inventories onboarding-video artifacts after the 50/50 split composite shipped to production. **No Supabase objects were deleted.** **No local media was deleted** (see Part 1 blocker below).

---

## Part 1 — Segment timing freeze (status: BLOCKED)

### Requirement

Record ffprobe-measured durations from `segment-01.mp4` through `segment-05.mp4` in the local working directory (`build/onboarding-pip-work/`).

### Result

**`scripts/config/onboarding-segment-timings.json` was NOT created.**

The five per-segment HeyGen files were **not found** in the working directory (or anywhere in the repo) under the required names:

```
segment-01.mp4
segment-02.mp4
segment-03.mp4
segment-04.mp4
segment-05.mp4
```

### What was found instead

| Path | Duration (ffprobe) | Notes |
|------|------------------|-------|
| `/tmp/seg01.mp4` | 13.22s | Likely a manual copy of segment 1; **wrong filename**, segments 2–5 absent |
| `build/onboarding-pip-work/presenter-heygen.mp4` | 72.49s | Full stitched HeyGen talking-head source used for compositing |
| `build/onboarding-pip-work/onboarding-pip-preview.mp4` | 72.50s | Latest local 50/50 composite |
| `build/onboarding-pip-work/slides-track.mp4` | 72.40s | ffmpeg intermediate (built from documented fallback timings) |

### Historical reference (NOT written to JSON — not ffprobe of segment files)

From the successful HeyGen generation run (documented in `docs/tempo-onboarding-video-generation.md`):

| Key | Documented duration | Cumulative start |
|-----|---------------------|------------------|
| welcome | 13.2s | 0.0s |
| product | 17.8s | 13.2s |
| assignment | 12.2s | 31.0s |
| stages | 16.8s | 43.2s |
| ready | 12.4s | 60.0s |
| **Total** | **72.4s** | |

Sum is within 0.5s of `presenter-heygen.mp4` (72.49s) and the shipped composite (72.50s).

### Next step to unblock Part 1

If per-segment MP4s are recovered (from backup or a new HeyGen run), place them in `build/onboarding-pip-work/segments/` with the exact names above, re-run ffprobe, write `onboarding-segment-timings.json`, then proceed with Part 3 local cleanup.

---

## Section A — Local files

Working directory: `build/onboarding-pip-work/` (gitignored via `/build` in `.gitignore`)

| File | Size | What it is | Disposition |
|------|------|------------|-------------|
| `onboarding-pip-preview.mp4` | 28.0 MB | Final 50/50 composite output (slides left, presenter right) | **KEEP** — final local preview; do not delete |
| `presenter-heygen.mp4` | 30.9 MB | Stitched HeyGen talking-head source (no slides) | **KEEP** — only local copy of irreplaceable presenter footage without re-calling HeyGen (~$5/run) |
| `tempo-welcome.mp4` | 30.9 MB | Duplicate of presenter source (copied during earlier compositor runs) | **SAFE TO DELETE** — redundant with `presenter-heygen.mp4`; canonical composite is in Supabase |
| `slides-track.mp4` | 452 KB | ffmpeg concat of timed slide clips (left-half track) | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clip-01.mp4` | 68 KB | Timed clip for slide 1 | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clip-02.mp4` | 120 KB | Timed clip for slide 2 | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clip-03.mp4` | 75 KB | Timed clip for slide 3 | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clip-04.mp4` | 110 KB | Timed clip for slide 4 | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clip-05.mp4` | 83 KB | Timed clip for slide 5 | **SAFE TO DELETE** — regenerable intermediate |
| `slide-clips-concat.txt` | 455 B | ffmpeg concat demuxer list for slide clips | **SAFE TO DELETE** — regenerable intermediate |
| `slides-concat.txt` | 632 B | Obsolete concat list from earlier PiP attempt | **SAFE TO DELETE** — superseded intermediate |
| `slide-01-welcome.png` | 52 KB | Rendered slide 1 (960×1080 left-half layout) | **SAFE TO DELETE** — regenerable via `render-onboarding-slides.ts` |
| `slide-02-product.png` | 63 KB | Rendered slide 2 | **SAFE TO DELETE** — regenerable |
| `slide-03-assignment.png` | 61 KB | Rendered slide 3 | **SAFE TO DELETE** — regenerable |
| `slide-04-stages.png` | 68 KB | Rendered slide 4 | **SAFE TO DELETE** — regenerable |
| `slide-05-ready.png` | 67 KB | Rendered slide 5 | **SAFE TO DELETE** — regenerable |

**Outside working directory (not deleted — outside Part 3 scope):**

| File | Size | Notes |
|------|------|-------|
| `/tmp/tempo-welcome.mp4` | 30.9 MB | Older copy of presenter source |
| `/tmp/seg01.mp4` | 5.7 MB | Possible segment-1 remnant; wrong filename |

**Part 3 local cleanup:** Skipped because Part 1 could not write the timings file.

---

## Section B — Supabase Storage objects (read-only inventory)

Bucket: `onboarding-videos`  
Project: `visuvrjmcoanndndimfw`

Listed August 29, 2026. **Nothing was deleted.**

| Path | Size | Referenced in codebase? | Notes |
|------|------|-------------------------|-------|
| `tempo-welcome.mp4` | 29.4 MB | **Yes** — `lib/tempo-onboarding-video.ts` → `TempoOnboardingVideoModal` | **LIVE** — 50/50 split composite served to the app (`?v=split-20260829` cache buster) |
| `slides/slide-01-welcome.png` | 53 KB | **Indirect** — `scripts/generate-heygen-video.ts` upload path; `scripts/composite-onboarding-pip.ts` no longer downloads (renders locally) | Not loaded by app at runtime; useful for manual review / future pipelines |
| `slides/slide-02-product.png` | 65 KB | Same as above | Same |
| `slides/slide-03-assignment.png` | 63 KB | Same as above | Same |
| `slides/slide-04-stages.png` | 70 KB | Same as above | Same |
| `slides/slide-05-ready.png` | 68 KB | Same as above | Same |

### Previously removed (confirmed absent from bucket)

These were deleted in an earlier session and are **not** present now:

- `segments/segment-01.mp4` … `segment-05.mp4`
- `tempo-welcome.srt`

### Orphan / cleanup candidates for human review (DO NOT auto-delete)

| Object | Recommendation |
|--------|----------------|
| `slides/*.png` | **Candidate for removal** if you only ever composite from local `render-onboarding-slides.ts` and never use HeyGen image-background mode again. **Keep** if you want a public CDN copy of deck assets or may re-run `generate-heygen-video.ts`. App does not fetch them. |
| *(none other)* | Bucket contains only the live video + slide PNGs |

---

## Section C — Source files

| File | Still needed? | Role |
|------|---------------|------|
| `scripts/config/tempo-onboarding-slides.ts` | **KEEP** | Slide copy source of truth; edit when briefing text changes |
| `scripts/config/tempo-onboarding-script.ts` | **KEEP** | Narration per slide; required for HeyGen re-generation |
| `scripts/lib/render-onboarding-slides.ts` | **KEEP** | Renders 960×1080 left-half PNGs from slide config |
| `scripts/composite-onboarding-pip.ts` | **KEEP** | ffmpeg 50/50 compositor (no HeyGen, no Supabase writes) |
| `scripts/generate-heygen-video.ts` | **KEEP** | Paid HeyGen pipeline if presenter footage must be re-rendered |
| `lib/tempo-onboarding-video.ts` | **KEEP** | Public URL consumed by the app |
| `components/tempo/TempoOnboardingVideoModal.tsx` | **KEEP** | In-app player |
| `package.json` → `composite:onboarding-pip` | **KEEP** | npm entry point for compositor |

**Dead / superseded behavior (files kept intentionally):**

- HeyGen `background: image` path in `generate-heygen-video.ts` never produced visible slides in output; compositor replaced that approach.
- `generate-heygen-video.ts` studio-stitch path was removed/bypassed in favor of ffmpeg concat.

**Gap:** `scripts/composite-onboarding-pip.ts` still falls back to hardcoded `DOCUMENTED_SEGMENT_DURATIONS` when segment files are missing. Once `onboarding-segment-timings.json` exists, a follow-up change (out of scope for this task) should read measured values from that file.

---

## Section D — Unanticipated findings

1. **Segment MP4s are gone everywhere.** Supabase segments were deleted after the first composite upload. Local `segment-0X.mp4` files were never retained in the working directory. Timing freeze requires recovery or a new HeyGen run.

2. **`presenter-heygen.mp4` is the critical local asset.** It is the only full-length HeyGen-only video without baked-in slides. `tempo-welcome.mp4` in the work dir is a duplicate. Protect `presenter-heygen.mp4` until timings are frozen and you are comfortable re-downloading from a future backup.

3. **`/tmp/seg01.mp4` (13.22s)** may be segment 1 but cannot satisfy Part 1 without segments 2–5 and correct naming.

4. **`.gitignore` already covers `/build`** — no change needed; local media will not be committed.

5. **Slide PNGs on Supabase are 960×1080** (left-half layout) after the split-layout upload; older docs describing 1920×1080 full-frame slides are stale.

6. **Checklist note:** Re-running `npm run composite:onboarding-pip` still works today using hardcoded fallback durations `[13.2, 17.8, 12.2, 16.8, 12.4]` and locally rendered slides + `presenter-heygen.mp4`. It does **not** yet read a timings JSON file.
