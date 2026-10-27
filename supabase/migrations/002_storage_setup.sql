-- =============================================================================
-- MentorPulse - Student Progress Hub
-- Migration 002: Storage Buckets & Policies for Safe Attachments (Idempotent)
-- =============================================================================

-- Create private bucket for student progress attachments (certificates, proofs, photos, reports)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress-attachments',
    'progress-attachments',
    false, -- Private bucket: access requires signed URLs or authenticated RLS
    26214400, -- 25MB max size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400;

-- Drop existing policies if they already exist to allow safe re-runs
DROP POLICY IF EXISTS "Students upload own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Students read own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Mentors read class student attachments" ON storage.objects;
DROP POLICY IF EXISTS "Students delete own attachments" ON storage.objects;

-- STORAGE POLICIES:
-- 1. Students can upload files into folder named after their student ID: "{student_id}/*"
CREATE POLICY "Students upload own attachments" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'progress-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- 2. Students can view/read their own uploaded files
CREATE POLICY "Students read own attachments" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'progress-attachments'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- 3. Mentors can read attachments belonging to students enrolled in their classes
CREATE POLICY "Mentors read class student attachments" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'progress-attachments'
        AND EXISTS (
            SELECT 1 FROM public.class_enrollments ce
            JOIN public.classes c ON c.id = ce.class_id
            WHERE ce.student_id::text = (storage.foldername(name))[1]
              AND c.mentor_id = auth.uid()
        )
    );

-- 4. Students can delete their own attachments
CREATE POLICY "Students delete own attachments" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'progress-attachments'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
