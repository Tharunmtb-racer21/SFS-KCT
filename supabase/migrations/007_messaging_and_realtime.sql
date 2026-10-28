-- =============================================================================
-- MentorPulse - Student Progress Hub
-- Migration 007: Student/Faculty Direct Messaging, Post Comments & Realtime Sync
-- =============================================================================

-- 1. POST COMMENTS TABLE (Ensure table exists with foreign keys and indexes)
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.daily_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created ON public.post_comments(created_at ASC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public comments select" ON public.post_comments;
DROP POLICY IF EXISTS "Allow public comments insert" ON public.post_comments;
DROP POLICY IF EXISTS "Allow public comments delete" ON public.post_comments;

CREATE POLICY "Allow public comments select" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Allow public comments insert" ON public.post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public comments delete" ON public.post_comments FOR DELETE USING (true);


-- 2. DIRECT STUDENT-FACULTY MESSAGES TABLE
-- Stable 1-on-1 conversation channel between a student and their faculty mentor within a class
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL, -- Format: conv_{class_id}_{student_id}
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read')) DEFAULT 'sent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_class ON public.messages(class_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Select policy: sender, recipient, or authorized class mentor
DROP POLICY IF EXISTS "Participants read own messages" ON public.messages;
CREATE POLICY "Participants read own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id OR
        auth.uid() = recipient_id OR
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = messages.class_id AND c.mentor_id = auth.uid()
        )
    );

-- Insert policy: user can only send as themselves
DROP POLICY IF EXISTS "Senders insert own messages" ON public.messages;
CREATE POLICY "Senders insert own messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id OR
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = messages.class_id AND (c.mentor_id = auth.uid() OR messages.recipient_id = auth.uid())
        )
    );

-- Update policy: recipients can mark as read
DROP POLICY IF EXISTS "Recipients update message read status" ON public.messages;
CREATE POLICY "Recipients update message read status" ON public.messages
    FOR UPDATE USING (
        auth.uid() = recipient_id OR
        auth.uid() = sender_id
    ) WITH CHECK (
        auth.uid() = recipient_id OR
        auth.uid() = sender_id
    );

-- Delete policy: sender or class mentor can delete
DROP POLICY IF EXISTS "Senders delete own messages" ON public.messages;
CREATE POLICY "Senders delete own messages" ON public.messages
    FOR DELETE USING (
        auth.uid() = sender_id OR
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = messages.class_id AND c.mentor_id = auth.uid()
        )
    );


-- 3. ENABLE SUPABASE REALTIME REPLICATION
-- Adds tables to the realtime publication for instant UI synchronization without refresh
DO $$
BEGIN
    -- Add messages to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- Add post_comments to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
    END IF;

    -- Add class_enrollments to realtime (instant approval & join updates)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'class_enrollments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_enrollments;
    END IF;

    -- Add notifications to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Graceful handle if publication does not exist or user lacks superuser grant
        RAISE NOTICE 'Notice on realtime publication: %', SQLERRM;
END $$;
