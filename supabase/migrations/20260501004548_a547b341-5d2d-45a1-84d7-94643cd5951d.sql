-- Make text optional for media-only messages
ALTER TABLE public.messages ALTER COLUMN text DROP NOT NULL;

-- Add media columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;

-- Validate media_type via trigger (avoids check-constraint immutability concerns)
CREATE OR REPLACE FUNCTION public.validate_message_media()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.media_type IS NOT NULL
     AND NEW.media_type NOT IN ('image','video','audio') THEN
    RAISE EXCEPTION 'Invalid media_type: %', NEW.media_type;
  END IF;
  IF (NEW.text IS NULL OR length(NEW.text) = 0) AND NEW.media_url IS NULL THEN
    RAISE EXCEPTION 'Message must have text or media';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_message_media_trg ON public.messages;
CREATE TRIGGER validate_message_media_trg
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_message_media();

-- Create public chat-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for the bucket
CREATE POLICY "Public read chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');