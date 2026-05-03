CREATE TABLE public.memory_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('me','meiso')),
  text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_comments_memory_id ON public.memory_comments(memory_id, created_at);

ALTER TABLE public.memory_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Realtime read comments"
ON public.memory_comments
FOR SELECT
TO anon, authenticated
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_comments;