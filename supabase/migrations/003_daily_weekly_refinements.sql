-- =============================================================================
-- MentorPulse - Student Progress Hub
-- Migration 003: Daily Updates & Weekly Reports Workflow Refinements
-- =============================================================================

-- 1. Support emojis 🔥, 👏, and 💡 in post_reactions
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_reaction_type_check;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_reaction_type_check
    CHECK (reaction_type IN ('🔥', '👏', '💡', 'WOW', 'Great', 'Excellent', 'Appreciate'));

-- 2. Add hours_spent and review_status to weekly_reports
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS hours_spent NUMERIC;
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('pending', 'approved', 'needs_revision')) DEFAULT 'pending';

-- 3. Add status_decision to weekly_report_feedback
ALTER TABLE public.weekly_report_feedback ADD COLUMN IF NOT EXISTS status_decision TEXT CHECK (status_decision IN ('approved', 'needs_revision'));

-- 4. Persistent comments table for daily progress posts
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.daily_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON public.post_comments(user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class members view post comments" ON public.post_comments;
CREATE POLICY "Class members view post comments" ON public.post_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_posts p
            WHERE p.id = post_comments.post_id
              AND (public.is_mentor_of_class(p.class_id) OR public.is_approved_student_in_class(p.class_id))
        )
    );

DROP POLICY IF EXISTS "Class members insert post comments" ON public.post_comments;
CREATE POLICY "Class members insert post comments" ON public.post_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.daily_posts p
            WHERE p.id = post_comments.post_id
              AND (public.is_mentor_of_class(p.class_id) OR public.is_approved_student_in_class(p.class_id))
        )
    );

DROP POLICY IF EXISTS "Users delete own comments or mentors moderate" ON public.post_comments;
CREATE POLICY "Users delete own comments or mentors moderate" ON public.post_comments
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.daily_posts p
            WHERE p.id = post_comments.post_id
              AND public.is_mentor_of_class(p.class_id)
        )
    );
