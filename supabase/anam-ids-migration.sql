-- Anam avatar/voice IDs per stage (Discovery + Objection Handling)
-- Run in Supabase → SQL Editor after deploying the Anam client migration.
-- Safe to re-run (IF NOT EXISTS / idempotent updates).

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS anam_avatar_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS anam_voice_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.simulations.anam_avatar_ids IS
  'Per-stage Anam avatar UUIDs, e.g. {"discovery":"…","objections":"…"}';

COMMENT ON COLUMN public.simulations.anam_voice_ids IS
  'Per-stage Anam voice UUIDs, e.g. {"discovery":"…","objections":"…"}';

-- Tempo / Summit Dental simulation — replace placeholder UUIDs with your Anam dashboard IDs.
UPDATE public.simulations
SET
  anam_avatar_ids = COALESCE(anam_avatar_ids, '{}'::jsonb) || jsonb_build_object(
    'discovery', COALESCE(anam_avatar_ids->>'discovery', ''),
    'objections', COALESCE(anam_avatar_ids->>'objections', '')
  ),
  anam_voice_ids = COALESCE(anam_voice_ids, '{}'::jsonb) || jsonb_build_object(
    'discovery', COALESCE(anam_voice_ids->>'discovery', ''),
    'objections', COALESCE(anam_voice_ids->>'objections', '')
  )
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Example (uncomment and fill after copying IDs from https://lab.anam.ai):
-- UPDATE public.simulations
-- SET
--   anam_avatar_ids = '{"discovery":"<dana-avatar-uuid>","objections":"<kim-avatar-uuid>"}'::jsonb,
--   anam_voice_ids  = '{"discovery":"<dana-voice-uuid>","objections":"<kim-voice-uuid>"}'::jsonb
-- WHERE id = '00000000-0000-0000-0000-000000000002';
