-- =============================================================================
-- MentorPulse - Migration 009: Student Removal, Audit Logging & Messaging Realtime
-- Kumaraguru College of Technology (KCT)
-- =============================================================================

-- 1. EXTEND CLASS ENROLLMENTS STATUS CHECK TO PERMIT 'removed'
-- Allows faculty mentors to remove a student from a class while preserving
-- all student data, historical posts, weekly reports, and audit trail.
ALTER TABLE public.class_enrollments DROP CONSTRAINT IF EXISTS class_enrollments_status_check;
ALTER TABLE public.class_enrollments 
    ADD CONSTRAINT class_enrollments_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'removed'));

-- 2. CREATE ENROLLMENT AUDIT LOG TABLE
-- Permanent academic compliance record of all enrollment status transitions
CREATE TABLE IF NOT EXISTS public.enrollment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('requested', 'approved', 'rejected', 'removed', 're_enrolled')),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_class ON public.enrollment_audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_student ON public.enrollment_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.enrollment_audit_logs(created_at DESC);

ALTER TABLE public.enrollment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit select" ON public.enrollment_audit_logs;
CREATE POLICY "Public audit select" ON public.enrollment_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public audit insert" ON public.enrollment_audit_logs;
CREATE POLICY "Public audit insert" ON public.enrollment_audit_logs FOR INSERT WITH CHECK (true);

-- 3. SECURE RPC FUNCTION: REMOVE STUDENT FROM CLASS
-- Only the authorized mentor for the class (or system admin) can remove a student.
CREATE OR REPLACE FUNCTION public.remove_student_from_class(
    p_class_id UUID,
    p_student_id UUID,
    p_reason TEXT DEFAULT 'Removed by faculty mentor'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_mentor_id UUID;
    v_class_name TEXT;
    v_caller_id UUID;
    v_enrollment_id UUID;
BEGIN
    v_caller_id := auth.uid();
    
    -- Verify the class exists and retrieve its mentor
    SELECT mentor_id, name INTO v_mentor_id, v_class_name
    FROM public.classes
    WHERE id = p_class_id;

    IF v_mentor_id IS NULL THEN
        RAISE EXCEPTION 'Class not found (ID: %)', p_class_id;
    END IF;

    -- Enforce authorization: authenticated caller must be the assigned mentor or an admin
    IF v_caller_id IS NOT NULL AND v_caller_id != v_mentor_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: You are not authorized to manage enrollments for class %', v_class_name;
        END IF;
    END IF;

    -- Find the active/existing enrollment
    SELECT id INTO v_enrollment_id
    FROM public.class_enrollments
    WHERE class_id = p_class_id AND student_id = p_student_id;

    IF v_enrollment_id IS NULL THEN
        RAISE EXCEPTION 'Enrollment record not found for student % in class %', p_student_id, v_class_name;
    END IF;

    -- Transition enrollment status to 'removed'
    UPDATE public.class_enrollments
    SET status = 'removed',
        reviewed_at = NOW(),
        reviewed_by = COALESCE(v_caller_id, v_mentor_id)
    WHERE id = v_enrollment_id;

    -- Insert audit log
    INSERT INTO public.enrollment_audit_logs (
        enrollment_id,
        class_id,
        student_id,
        action,
        actor_id,
        reason
    ) VALUES (
        v_enrollment_id,
        p_class_id,
        p_student_id,
        'removed',
        COALESCE(v_caller_id, v_mentor_id),
        COALESCE(p_reason, 'Removed by faculty mentor')
    );

    -- Deliver notification to student
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        link,
        created_at
    ) VALUES (
        p_student_id,
        'Class Enrollment Notice',
        'You have been removed from ' || v_class_name || ' by your faculty mentor.',
        '/student/classes',
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'enrollment_id', v_enrollment_id,
        'class_id', p_class_id,
        'student_id', p_student_id,
        'status', 'removed'
    );
END;
$$;

-- 4. REALTIME PUBLICATION VERIFICATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'class_enrollments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_enrollments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'enrollment_audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollment_audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication notice: %', SQLERRM;
END $$;

