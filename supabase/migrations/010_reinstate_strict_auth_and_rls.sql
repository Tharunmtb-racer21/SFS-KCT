-- =============================================================================
-- MentorPulse - Migration 010: Security Hardening & Strict RLS Reinforcement
-- Kumaraguru College of Technology (KCT)
-- =============================================================================

-- 1. FIX PROFILES RLS & PREVENT ROLE ESCALATION
-- Ensure that users can only update their own profile and CANNOT modify their role.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger to prevent unauthorized role escalation
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Only service_role or users who already possess 'admin' role may alter user roles
        IF auth.role() <> 'service_role' AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Users cannot alter their assigned institutional role.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();

-- 2. HARDEN DIRECT MESSAGING RLS
-- Drop overly permissive USING (true) policies and restrict access strictly to conversation participants
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

DROP POLICY IF EXISTS "Senders insert own messages" ON public.messages;
CREATE POLICY "Senders insert own messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
    );

DROP POLICY IF EXISTS "Recipients update message read status" ON public.messages;
CREATE POLICY "Recipients update message read status" ON public.messages
    FOR UPDATE 
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- 3. HARDEN POST REACTIONS RLS
-- Ensure reactions can only be modified or deleted by the user who authored them
DROP POLICY IF EXISTS "Allow public reactions delete" ON public.post_reactions;
DROP POLICY IF EXISTS "Allow public reactions update" ON public.post_reactions;
DROP POLICY IF EXISTS "Allow public reactions insert" ON public.post_reactions;

CREATE POLICY "Allow user insert own reaction" ON public.post_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow user update own reaction" ON public.post_reactions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow user delete own reaction" ON public.post_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- 4. HARDEN INSTANT REGISTRATION: NO PASSWORD OVERWRITING & REQUIRE SECURE PASSWORDS
CREATE OR REPLACE FUNCTION public.register_student_instant(
    p_full_name TEXT,
    p_email TEXT,
    p_student_reg_no TEXT,
    p_department TEXT,
    p_password TEXT DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_clean_email TEXT := LOWER(TRIM(p_email));
    v_clean_name TEXT := TRIM(p_full_name);
    v_clean_reg TEXT := UPPER(TRIM(p_student_reg_no));
    v_clean_dept TEXT := TRIM(p_department);
    v_password TEXT := p_password;
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Check if student already exists in auth.users or profiles - STRICT REJECTION (NO OVERWRITING)
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'An account with this institutional email already exists. Please sign in with your password.';
    END IF;

    SELECT id INTO v_user_id FROM public.profiles WHERE student_reg_no = v_clean_reg LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'An account with this Student Register Number already exists. Please sign in with your password.';
    END IF;

    -- 2. Validate password requirements
    IF v_password IS NULL OR LENGTH(v_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters.';
    END IF;

    -- 3. Generate user ID and cryptographically salted hash
    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(v_password, extensions.gen_salt('bf'));

    -- 4. Insert into auth.users (Pre-confirmed for authorized onboarding)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        json_build_object('full_name', v_clean_name, 'role', 'student', 'student_reg_no', v_clean_reg, 'department', v_clean_dept)::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    -- 5. Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_user_id,
        json_build_object('sub', v_user_id::text, 'email', v_clean_email)::jsonb,
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    -- 6. Upsert into public.profiles
    INSERT INTO public.profiles (
        id,
        role,
        full_name,
        email,
        student_reg_no,
        department,
        skills,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        'student',
        v_clean_name,
        v_clean_email,
        v_clean_reg,
        v_clean_dept,
        '{}'::text[],
        NOW(),
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'role', 'student',
        'message', 'Student registered securely.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_student_instant TO anon, authenticated;
