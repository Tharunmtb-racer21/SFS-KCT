-- ==============================================================================
-- 005_STORAGE_AND_POST_POLICIES.SQL
-- Enhances Supabase Storage and Daily Posts RLS policies to allow smooth
-- passwordless student progress submissions, profile photo uploads, and feed updates.
-- ==============================================================================

-- 1. Ensure storage bucket 'progress-attachments' exists and is publicly readable
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress-attachments',
    'progress-attachments',
    true, -- Allow public access for fast photo loading
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880;

-- 2. Storage Objects Policies
DROP POLICY IF EXISTS "Allow student photo uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public photo reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow student photo deletes" ON storage.objects;
DROP POLICY IF EXISTS "Students upload own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Students read own attachments" ON storage.objects;

-- Allow uploads into progress-attachments
CREATE POLICY "Allow student photo uploads" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'progress-attachments'
    );

-- Allow reading files from progress-attachments
CREATE POLICY "Allow public photo reads" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'progress-attachments'
    );

-- Allow deletes
CREATE POLICY "Allow student photo deletes" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'progress-attachments'
    );

-- 3. Profiles Update Policy
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
CREATE POLICY "Allow profile updates" ON public.profiles
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- 4. Daily Posts Insert & Select Policies
DROP POLICY IF EXISTS "Allow student daily posts insert" ON public.daily_posts;
DROP POLICY IF EXISTS "Students insert own posts" ON public.daily_posts;

CREATE POLICY "Allow student daily posts insert" ON public.daily_posts
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow student daily posts view" ON public.daily_posts;
CREATE POLICY "Allow student daily posts view" ON public.daily_posts
    FOR SELECT USING (true);
