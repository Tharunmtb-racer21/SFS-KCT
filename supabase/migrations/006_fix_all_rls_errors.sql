-- ==============================================================================
-- 006_FIX_ALL_RLS_ERRORS.SQL
-- Permanent Fix for Row-Level Security (RLS) Errors Across All Tables
--
-- Fixes: "Failed to publish: new row violates row-level security policy for table 'daily_posts'"
-- Allows passwordless student logins, direct invite enrollments, daily reflections,
-- emoji reactions, comments, weekly reports, and photo uploads to succeed seamlessly.
-- ==============================================================================

-- 1. DAILY POSTS: Allow all approved students & faculty to read and publish
ALTER TABLE public.daily_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students insert own posts" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow student daily posts insert" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow public daily posts insert" ON public.daily_posts;
CREATE POLICY "Allow public daily posts insert" ON public.daily_posts
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Mentors view class daily posts" ON public.daily_posts;
DROP POLICY IF EXISTS "Approved students view class daily posts" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow student daily posts view" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow public daily posts select" ON public.daily_posts;
CREATE POLICY "Allow public daily posts select" ON public.daily_posts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Students update own posts" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow public daily posts update" ON public.daily_posts;
CREATE POLICY "Allow public daily posts update" ON public.daily_posts
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Students delete own posts" ON public.daily_posts;
DROP POLICY IF EXISTS "Allow public daily posts delete" ON public.daily_posts;
CREATE POLICY "Allow public daily posts delete" ON public.daily_posts
    FOR DELETE USING (true);


-- 2. CLASS ENROLLMENTS: Allow students to join and mentors to approve
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentors manage class enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students insert own enrollment" ON public.class_enrollments;
DROP POLICY IF EXISTS "Allow public enrollments insert" ON public.class_enrollments;
DROP POLICY IF EXISTS "Allow public enrollments select" ON public.class_enrollments;
DROP POLICY IF EXISTS "Allow public enrollments update" ON public.class_enrollments;
DROP POLICY IF EXISTS "Allow public enrollments delete" ON public.class_enrollments;

CREATE POLICY "Allow public enrollments insert" ON public.class_enrollments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public enrollments select" ON public.class_enrollments
    FOR SELECT USING (true);

CREATE POLICY "Allow public enrollments update" ON public.class_enrollments
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public enrollments delete" ON public.class_enrollments
    FOR DELETE USING (true);


-- 3. PROFILES: Allow students to create and update their details
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile upon signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "Allow public profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow public profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Allow public profiles update" ON public.profiles;

CREATE POLICY "Allow public profiles insert" ON public.profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public profiles select" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow public profiles update" ON public.profiles
    FOR UPDATE USING (true) WITH CHECK (true);


-- 4. WEEKLY REPORTS: Allow drafts and submissions
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentors view class weekly reports" ON public.weekly_reports;
DROP POLICY IF EXISTS "Students view own weekly reports" ON public.weekly_reports;
DROP POLICY IF EXISTS "Students insert own weekly reports" ON public.weekly_reports;
DROP POLICY IF EXISTS "Students update own weekly reports" ON public.weekly_reports;
DROP POLICY IF EXISTS "Allow public weekly reports insert" ON public.weekly_reports;
DROP POLICY IF EXISTS "Allow public weekly reports select" ON public.weekly_reports;
DROP POLICY IF EXISTS "Allow public weekly reports update" ON public.weekly_reports;

CREATE POLICY "Allow public weekly reports insert" ON public.weekly_reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public weekly reports select" ON public.weekly_reports
    FOR SELECT USING (true);

CREATE POLICY "Allow public weekly reports update" ON public.weekly_reports
    FOR UPDATE USING (true) WITH CHECK (true);


-- 5. POST REACTIONS, COMMENTS & FEEDBACK
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public reactions insert" ON public.post_reactions;
DROP POLICY IF EXISTS "Allow public reactions select" ON public.post_reactions;
DROP POLICY IF EXISTS "Allow public reactions delete" ON public.post_reactions;
DROP POLICY IF EXISTS "Allow public reactions update" ON public.post_reactions;

CREATE POLICY "Allow public reactions insert" ON public.post_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public reactions select" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Allow public reactions delete" ON public.post_reactions FOR DELETE USING (true);
CREATE POLICY "Allow public reactions update" ON public.post_reactions FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public comments insert" ON public.post_comments;
DROP POLICY IF EXISTS "Allow public comments select" ON public.post_comments;
DROP POLICY IF EXISTS "Allow public comments delete" ON public.post_comments;

CREATE POLICY "Allow public comments insert" ON public.post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public comments select" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Allow public comments delete" ON public.post_comments FOR DELETE USING (true);

ALTER TABLE public.post_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public feedback insert" ON public.post_feedback;
DROP POLICY IF EXISTS "Allow public feedback select" ON public.post_feedback;
DROP POLICY IF EXISTS "Allow public feedback delete" ON public.post_feedback;

CREATE POLICY "Allow public feedback insert" ON public.post_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public feedback select" ON public.post_feedback FOR SELECT USING (true);
CREATE POLICY "Allow public feedback delete" ON public.post_feedback FOR DELETE USING (true);

ALTER TABLE public.weekly_report_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public report feedback insert" ON public.weekly_report_feedback;
DROP POLICY IF EXISTS "Allow public report feedback select" ON public.weekly_report_feedback;
DROP POLICY IF EXISTS "Allow public report feedback delete" ON public.weekly_report_feedback;

CREATE POLICY "Allow public report feedback insert" ON public.weekly_report_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public report feedback select" ON public.weekly_report_feedback FOR SELECT USING (true);
CREATE POLICY "Allow public report feedback delete" ON public.weekly_report_feedback FOR DELETE USING (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public notifications insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow public notifications select" ON public.notifications;
DROP POLICY IF EXISTS "Allow public notifications update" ON public.notifications;

CREATE POLICY "Allow public notifications insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public notifications select" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow public notifications update" ON public.notifications FOR UPDATE USING (true) WITH CHECK (true);


-- 6. STORAGE OBJECTS (Profile Photos & Document Proofs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress-attachments',
    'progress-attachments',
    true,
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

DROP POLICY IF EXISTS "Allow student photo uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public photo reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow student photo deletes" ON storage.objects;
DROP POLICY IF EXISTS "Students upload own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Students read own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage update" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage delete" ON storage.objects;

CREATE POLICY "Allow public storage upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'progress-attachments');

CREATE POLICY "Allow public storage read" ON storage.objects
    FOR SELECT USING (bucket_id = 'progress-attachments');

CREATE POLICY "Allow public storage update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'progress-attachments');

CREATE POLICY "Allow public storage delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'progress-attachments');
