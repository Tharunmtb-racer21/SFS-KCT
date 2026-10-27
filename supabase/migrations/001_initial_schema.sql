-- =============================================================================
-- MentorPulse - Student Progress Hub
-- Migration 001: Initial Schema and Row Level Security (RLS)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Extends Supabase auth.users with institutional & mentor/student role data
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student', 'admin')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT, -- Private by default; accessible only to self and authorized mentor
    student_reg_no TEXT, -- Roll/Register number (e.g. 717821ECE045)
    department TEXT, -- e.g. "Electronics & Communication Engineering"
    academic_year TEXT, -- e.g. "3rd Year / Semester 5"
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    career_goals TEXT,
    hobbies TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for searching profiles by reg no and role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_reg_no ON public.profiles(student_reg_no);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);

-- 2. CLASSES TABLE
-- Each class group belongs to a faculty mentor and has an unguessable invite token
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "ECE-A 2023-2027"
    department TEXT NOT NULL, -- e.g. "ECE"
    academic_year TEXT NOT NULL, -- e.g. "2024-2025"
    semester TEXT NOT NULL, -- e.g. "Semester 5"
    description TEXT,
    invite_code TEXT UNIQUE NOT NULL, -- Secure unguessable random token
    invite_active BOOLEAN NOT NULL DEFAULT true,
    invite_expires_at TIMESTAMPTZ,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_mentor ON public.classes(mentor_id);
CREATE INDEX IF NOT EXISTS idx_classes_invite_code ON public.classes(invite_code);

-- 3. CLASS ENROLLMENTS TABLE
-- Tracks students enrolled or pending approval in a class
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id),
    UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_class ON public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.class_enrollments(status);

-- 4. DAILY POSTS TABLE
-- Chronological daily progress feed for students in a class
CREATE TABLE IF NOT EXISTS public.daily_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g. "Lab Experiment", "Project", "Coursework", "Certification", "Workshop"
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    skills_gained TEXT[] DEFAULT '{}',
    challenges TEXT,
    next_steps TEXT,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT, -- 'image' | 'pdf' | 'video' | 'doc'
    attachment_size BIGINT,
    location_name TEXT, -- User-entered event/location context
    location_coords JSONB, -- Explicit opt-in coordinates only { lat, lng }
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_posts_class ON public.daily_posts(class_id);
CREATE INDEX IF NOT EXISTS idx_daily_posts_student ON public.daily_posts(student_id);
CREATE INDEX IF NOT EXISTS idx_daily_posts_activity_date ON public.daily_posts(activity_date DESC);

-- 5. WEEKLY REPORTS TABLE
-- Weekly structured summary reports
CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    achievements TEXT NOT NULL,
    activities_completed TEXT NOT NULL,
    skills_learned TEXT,
    goals_achieved TEXT,
    difficulties_faced TEXT,
    next_week_goals TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')) DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    mentor_reviewed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, student_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_class ON public.weekly_reports(class_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_student ON public.weekly_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_dates ON public.weekly_reports(start_date DESC);

-- 6. POST REACTIONS TABLE
-- Persistent reactions from mentors & classmates: 'WOW', 'Great', 'Excellent', 'Appreciate'
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.daily_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('WOW', 'Great', 'Excellent', 'Appreciate')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

-- 7. POST FEEDBACK TABLE
-- Mentor feedback on daily posts
CREATE TABLE IF NOT EXISTS public.post_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.daily_posts(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_feedback_post ON public.post_feedback(post_id);

-- 8. WEEKLY REPORT FEEDBACK TABLE
-- Mentor feedback on weekly reports
CREATE TABLE IF NOT EXISTS public.weekly_report_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.weekly_reports(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_feedback_report ON public.weekly_report_feedback(report_id);

-- 9. NOTIFICATIONS TABLE
-- Real saved in-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user mentor of class
CREATE OR REPLACE FUNCTION public.is_mentor_of_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.classes
        WHERE id = target_class_id AND mentor_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Is current user approved student in class
CREATE OR REPLACE FUNCTION public.is_approved_student_in_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_enrollments
        WHERE class_id = target_class_id 
          AND student_id = auth.uid() 
          AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES:
-- 1. Users can view their own profile
-- 2. Mentors can view profiles of students enrolled in their classes
-- 3. Students can view profile of fellow approved students and their mentors in the same class
CREATE POLICY "View own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Mentors can view enrolled students" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_enrollments ce
            JOIN public.classes c ON c.id = ce.class_id
            WHERE ce.student_id = profiles.id AND c.mentor_id = auth.uid()
        )
    );

CREATE POLICY "Classmates can view approved peer profile basics" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_enrollments ce1
            JOIN public.class_enrollments ce2 ON ce1.class_id = ce2.class_id
            WHERE ce1.student_id = auth.uid() AND ce1.status = 'approved'
              AND ce2.student_id = profiles.id AND ce2.status = 'approved'
        )
    );

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile upon signup" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- CLASSES POLICIES:
-- Mentors have full access to their own classes
CREATE POLICY "Mentors select own classes" ON public.classes
    FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "Mentors insert own classes" ON public.classes
    FOR INSERT WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "Mentors update own classes" ON public.classes
    FOR UPDATE USING (mentor_id = auth.uid());

CREATE POLICY "Mentors delete own classes" ON public.classes
    FOR DELETE USING (mentor_id = auth.uid());

-- Students can see classes they are enrolled in or approved for
CREATE POLICY "Students see enrolled classes" ON public.classes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_enrollments
            WHERE class_id = classes.id AND student_id = auth.uid()
        )
    );

-- Any authenticated user can view class summary by invite code for enrollment preview
CREATE POLICY "Public invite lookup" ON public.classes
    FOR SELECT USING (invite_active = true);

-- CLASS ENROLLMENTS POLICIES:
-- Mentors can view, approve, and reject enrollments for their classes
CREATE POLICY "Mentors manage class enrollments" ON public.class_enrollments
    FOR ALL USING (public.is_mentor_of_class(class_id));

-- Students can view their own enrollment status
CREATE POLICY "Students view own enrollments" ON public.class_enrollments
    FOR SELECT USING (student_id = auth.uid());

-- Students can request enrollment
CREATE POLICY "Students insert own enrollment" ON public.class_enrollments
    FOR INSERT WITH CHECK (student_id = auth.uid());

-- DAILY POSTS POLICIES:
-- Mentors can view all posts in their classes
CREATE POLICY "Mentors view class daily posts" ON public.daily_posts
    FOR SELECT USING (public.is_mentor_of_class(class_id));

-- Approved students can view posts in their classes
CREATE POLICY "Approved students view class daily posts" ON public.daily_posts
    FOR SELECT USING (public.is_approved_student_in_class(class_id));

-- Approved students can insert posts for their class
CREATE POLICY "Students insert own posts" ON public.daily_posts
    FOR INSERT WITH CHECK (
        student_id = auth.uid() AND public.is_approved_student_in_class(class_id)
    );

-- Students can update/delete their own posts
CREATE POLICY "Students update own posts" ON public.daily_posts
    FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Students delete own posts" ON public.daily_posts
    FOR DELETE USING (student_id = auth.uid());

-- WEEKLY REPORTS POLICIES:
-- Mentors view weekly reports for their classes
CREATE POLICY "Mentors view class weekly reports" ON public.weekly_reports
    FOR SELECT USING (public.is_mentor_of_class(class_id));

-- Students view their own weekly reports
CREATE POLICY "Students view own weekly reports" ON public.weekly_reports
    FOR SELECT USING (student_id = auth.uid());

-- Students insert and update their own weekly reports
CREATE POLICY "Students insert own weekly reports" ON public.weekly_reports
    FOR INSERT WITH CHECK (
        student_id = auth.uid() AND public.is_approved_student_in_class(class_id)
    );

CREATE POLICY "Students update own weekly reports" ON public.weekly_reports
    FOR UPDATE USING (student_id = auth.uid());

-- POST REACTIONS POLICIES:
-- Mentors and enrolled students can view reactions
CREATE POLICY "View reactions in class posts" ON public.post_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_posts p
            WHERE p.id = post_reactions.post_id
              AND (public.is_mentor_of_class(p.class_id) OR public.is_approved_student_in_class(p.class_id))
        )
    );

-- Users can insert and update their own reactions
CREATE POLICY "Manage own reaction" ON public.post_reactions
    FOR ALL USING (user_id = auth.uid());

-- FEEDBACK POLICIES:
-- Mentors can insert and update feedback on daily posts & weekly reports
CREATE POLICY "Mentors manage daily post feedback" ON public.post_feedback
    FOR ALL USING (mentor_id = auth.uid());

CREATE POLICY "Students view feedback on their posts" ON public.post_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_posts p
            WHERE p.id = post_feedback.post_id AND p.student_id = auth.uid()
        )
    );

CREATE POLICY "Mentors manage weekly report feedback" ON public.weekly_report_feedback
    FOR ALL USING (mentor_id = auth.uid());

CREATE POLICY "Students view feedback on their reports" ON public.weekly_report_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.weekly_reports r
            WHERE r.id = weekly_report_feedback.report_id AND r.student_id = auth.uid()
        )
    );

-- NOTIFICATIONS POLICIES:
CREATE POLICY "Users manage own notifications" ON public.notifications
    FOR ALL USING (user_id = auth.uid());
