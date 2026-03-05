-- Create creative_posts table to track publishing history
CREATE TABLE IF NOT EXISTS public.creative_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES public.creative_tracks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
    post_id TEXT NOT NULL,
    post_url TEXT,
    media_url TEXT,
    caption TEXT,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creative_posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own creative posts"
    ON public.creative_posts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own creative posts"
    ON public.creative_posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own creative posts"
    ON public.creative_posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own creative posts"
    ON public.creative_posts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creative_posts_track_id ON public.creative_posts(track_id);
CREATE INDEX IF NOT EXISTS idx_creative_posts_user_id ON public.creative_posts(user_id);
