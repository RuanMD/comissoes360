-- Create the bucket 'creative_media' for storing video and image creatives
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative_media', 'creative_media', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'creative_media' );

-- Allow authenticated users to upload files to their own folder (folder name = user_id)
CREATE POLICY "Users can upload their own creative media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'creative_media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own creative media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'creative_media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own creative media"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'creative_media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
