-- =============================================================================
-- MentorPulse - Student Progress Hub
-- Migration 002: Storage Buckets & Policies for Safe Attachments (Idempotent)
-- =============================================================================

-- Create or update private bucket for student progress attachments (photos, certificates, proofs, reports)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress-attachments',
    'progress-attachments',
    false, -- Private bucket: access requires signed URLs or authenticated RLS
    2097152, -- 2MB max size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

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
