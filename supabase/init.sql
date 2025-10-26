-- supabase/init.sql
-- 一键：创建 comments/messages 表，添加必要列与 RLS 策略，RPC：increment likes

-- 注意：运行前请备份已有数据。如不想删除，请改用 ALTER TABLE 添加列。

DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.private_messages CASCADE;

CREATE TABLE public.comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_slug TEXT NOT NULL,
  chapter_path TEXT NOT NULL,
  parent_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  likes INT DEFAULT 0,
  approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_book_chapter ON public.comments (book_slug, chapter_path);
CREATE INDEX idx_comments_parent ON public.comments (parent_id);

CREATE TABLE public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room TEXT NOT NULL DEFAULT 'public',
  user_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.private_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC for safe increment likes (atomic)
CREATE OR REPLACE FUNCTION public.increment_comment_likes(cid BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.comments SET likes = likes + 1 WHERE id = cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_comment_likes(bigint) TO public;

-- Enable Row Level Security
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Policies: allow public read and insert for comments/messages (for testing)
CREATE POLICY comments_select_public ON public.comments FOR SELECT USING (approved = true);
CREATE POLICY comments_insert_public ON public.comments FOR INSERT WITH CHECK (true);

CREATE POLICY messages_select_public ON public.messages FOR SELECT USING (true);
CREATE POLICY messages_insert_public ON public.messages FOR INSERT WITH CHECK (true);

-- (Optional) allow private_messages insert; reading private_messages requires auth or admin
CREATE POLICY private_messages_insert ON public.private_messages FOR INSERT WITH CHECK (true);

