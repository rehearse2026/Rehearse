# HeyGen API Findings — Tempo Onboarding v2 Render

Recorded: August 29, 2026  
Sources consulted (read-only, no renders):

- [Create Video](https://developers.heygen.com/reference/create-video.md) — `POST /v3/videos`
- [Get Video](https://developers.heygen.com/reference/get-video.md) — `GET /v3/videos/{video_id}`
- [List Avatar Looks](https://developers.heygen.com/reference/list-avatar-looks.md) — `GET /v3/avatars/looks`
- [Avatar III](https://developers.heygen.com/avatar-iii.md)
- [HeyGen llms.txt index](https://docs.heygen.com/llms.txt)

---

## a. Single-avatar render endpoint and body

**Endpoint:** `POST https://api.heygen.com/v3/videos`  
**Auth:** `x-api-key: <HEYGEN_API_KEY>` (or Bearer OAuth)

**Request body (avatar mode):**

```json
{
  "type": "avatar",
  "avatar_id": "<look_id>",
  "voice_id": "<voice_id>",
  "script": "<full narration text>",
  "title": "Tempo Onboarding Presenter v2",
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "engine": { "type": "avatar_iii" },
  "caption": { "file_format": "srt" }
}
```

Relevant schema: `CreateVideoFromAvatar` in the OpenAPI spec behind Create Video.

- `type` must be `"avatar"` for HeyGen avatar / photo avatar looks.
- `script` + `voice_id` drive TTS lip-sync (mutually exclusive with `audio_url` / `audio_asset_id`).
- `engine.type` selects Avatar III (`avatar_iii`), IV (`avatar_iv`), or V (`avatar_v`). Default when omitted is Avatar IV per docs.
- `aspect_ratio` supports `16:9`, `9:16`, `4:5`, `5:4`, `1:1`, `auto` (default `16:9`).
- `resolution` supports `720p`, `1080p`, etc.

---

## b. Captions / subtitles

**Request:** include top-level `caption` object:

```json
"caption": { "file_format": "srt" }
```

Per `CaptionSetting` schema ([Create Video](https://developers.heygen.com/reference/create-video.md)):

- A **sidecar subtitle file is always generated** and returned via `subtitle_url`.
- `file_format` enum currently supports **`srt` only** (not `vtt`).
- Optional `caption.style` (e.g. `"default"`) **burns captions into the rendered video**; sidecar is still delivered. Omit `style` for sidecar-only.

**Retrieval:** poll `GET /v3/videos/{video_id}` until `status === "completed"`, then read:

| Field | Purpose |
|-------|---------|
| `video_url` | Presigned MP4 download |
| `subtitle_url` | Presigned SRT download |
| `captioned_video_url` | MP4 with burned-in captions (if `caption.style` was set) |
| `duration` | Reported duration in seconds (verify with ffprobe locally) |

---

## c. Caption text source — input script vs transcription

**Documented behavior (input script):** The Create Video schema states that when `brand_glossary_id` / pronunciation is applied, *"caption and subtitle text still show the original script wording"* ([Create Video](https://developers.heygen.com/reference/create-video.md), `brand_glossary_id` field description).

The docs do **not** explicitly state whether default SRT cues are timed to the **submitted script** or an **ASR transcription** of generated audio when no glossary is used. We treat SRT cues as **script-aligned** for boundary detection but validate timings empirically after the single render.

---

## d. Script length limits

The Tempo onboarding concatenated script is **~1,046 characters** (five segments, space-joined).

OpenAPI `CreateVideoFromAvatar.script` specifies `minLength: 1` with **no documented `maxLength`** on the avatar script field. Cinematic `prompt` allows up to 10,000 characters. **~1,000 characters is within documented limits.**

---

## e. Polling and asset retrieval

1. `POST /v3/videos` → response `data.video_id`
2. Poll `GET /v3/videos/{video_id}` every ~5s until `status` is `completed` or `failed`
3. On `completed`: download `video_url` and `subtitle_url` (presigned URLs, time-limited)
4. Run **ffprobe locally** for authoritative `totalDuration` — do not rely solely on `duration` in the API response

Statuses: `pending`, `processing`, `completed`, `failed` ([Get Video](https://developers.heygen.com/reference/get-video.md))

---

## f. Avatar and voice validity (read-only checks)

| ID | Role | Verified via |
|----|------|--------------|
| `abb82a33ff074a4781f78ae54275f78c` | Khady Professional Office look | `GET /v3/avatars/looks` — `photo_avatar`, `supported_api_engines` includes `avatar_iii` |
| `6990bd1c1293466aaf025743758623ed` | Default voice for look | Same look record `default_voice_id` |

Captions are a **global** `caption` field on the create request, not avatar-specific. No doc exclusion found for photo avatars + Avatar III + `caption.file_format: "srt"`.

---

## Contradictions / notes vs earlier pipeline

| Earlier assumption | Current docs |
|--------------------|--------------|
| `caption.file_format: "vtt"` | **Invalid** — only `"srt"` supported |
| `background.type: "image"` composites slides | Accepted by API but **did not appear** in Avatar III photo output (see `docs/tempo-onboarding-video-generation.md`) |
| Studio stitch of segment URLs | Unreliable for length; local ffmpeg concat used instead |

---

## v2 render plan (this task)

- **One** `POST /v3/videos` with full concatenated script (~72–90s target)
- `engine: { type: "avatar_iii" }`, no `background` (presenter-only footage for 50/50 composite)
- `caption: { file_format: "srt" }` — sidecar only, no burn-in
- Save to `build/onboarding-pip-work/presenter-heygen-v2.mp4` and `presenter-heygen-v2.srt`
- **Do not** overwrite `presenter-heygen.mp4` or live `tempo-welcome.mp4`
