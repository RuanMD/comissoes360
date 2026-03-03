-- Migration: Secure tables with Row Level Security (RLS)
-- Description: Enables RLS and adds basic policies for sensitive tables.

-- 1. Table: creative_tracks
ALTER TABLE public.creative_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own tracks" ON public.creative_tracks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own tracks" ON public.creative_tracks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tracks" ON public.creative_tracks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tracks" ON public.creative_tracks
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Table: creative_track_entries
ALTER TABLE public.creative_track_entries ENABLE ROW LEVEL SECURITY;

-- Note: We assume creative_track_entries should only be accessible if the user owns the track.
-- If the table has a user_id, use that directly. If not, we might need a join or subquery.
-- Let's check schema via metadata if possible. For now, adding a common pattern:
CREATE POLICY "Users can only see entries of their own tracks" ON public.creative_track_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.creative_tracks
            WHERE public.creative_tracks.id = public.creative_track_entries.track_id
            AND public.creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only insert entries for their own tracks" ON public.creative_track_entries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.creative_tracks
            WHERE public.creative_tracks.id = public.creative_track_entries.track_id
            AND public.creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only update entries of their own tracks" ON public.creative_track_entries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.creative_tracks
            WHERE public.creative_tracks.id = public.creative_track_entries.track_id
            AND public.creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only delete entries of their own tracks" ON public.creative_track_entries
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.creative_tracks
            WHERE public.creative_tracks.id = public.creative_track_entries.track_id
            AND public.creative_tracks.user_id = auth.uid()
        )
    );

-- 3. Table: shopee_conversions
ALTER TABLE public.shopee_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own shopee_conversions" ON public.shopee_conversions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own shopee_conversions" ON public.shopee_conversions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own shopee_conversions" ON public.shopee_conversions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own shopee_conversions" ON public.shopee_conversions
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Table: users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can only update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);
