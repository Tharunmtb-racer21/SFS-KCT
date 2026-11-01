# MentorPulse — Security Audit & Capacity Review: Zero-Email Authentication & Identity Assurance

**Date**: November 2, 2026  
**Institution**: Kumaraguru College of Technology (KCT)  
**Product**: MentorPulse Student-Faculty Mentoring ERP  
**Target Repository**: `https://github.com/Tharunmtb-racer21/SFS-KCT.git` (Branch: `main`)  
**Database**: Supabase PostgreSQL (`myuljbnmmcpyhbhjxffo.supabase.co`)  
**Audit Standard**: OWASP Application Security Verification Standard (ASVS) Level 2 & University ERP Security Standards

---

## Executive Summary

Following claims that MentorPulse could support "unlimited accounts via zero-email authentication and directly pre-confirmed identities," a comprehensive architectural and security audit was performed across frontend components, Supabase service layers, PostgreSQL database functions, and Row-Level Security (RLS) policies.

The audit revealed that while client-side authentication bypasses and database-level pre-confirmation eliminated SMTP rate-limit errors (`over_email_send_rate_limit`), they introduced **severe critical security vulnerabilities**:
1. **Student Account Impersonation via Roll Number** (Critical): Any user could log in as any student simply by entering their public register number without entering a password.
2. **Arbitrary Password Overwriting** (Critical): Migration `008_instant_zero_email_auth.sql` allowed anyone to overwrite another student's encrypted password in `auth.users`.
3. **Plaintext Faculty Passcode Exposure** (High): `AuthPage.tsx` exposed the faculty authorization passcode in plaintext (`KCT-FACULTY-2026`) in UI helpers and placeholders.
4. **Row-Level Security Neutralization** (High): Migration `008` applied `USING (true)` to `messages` and `post_reactions`, and migration `006` applied `USING (true)` to `profiles`, bypassing tenant and user isolation.
5. **Role Escalation Vulnerability** (High): Users could update the `role` field on `profiles` to elevate their account from student to mentor or admin.

### Summary of Remediation
- **Eliminated Student Impersonation**: All student sign-ins now require authenticating with their private password via `signIn(cleanId, password)`. Passwordless login functions (`signInStudentFast`) have been deprecated and hardened to enforce passwords.
- **Eliminated Password Overwriting in Database**: Migration `010_reinstate_strict_auth_and_rls.sql` updates `register_student_instant` to strictly reject duplicate institutional emails or roll numbers with an exception instead of updating passwords.
- **Removed Plaintext Passcodes**: Removed hardcoded default passcodes and plaintext code suggestions from the frontend UI.
- **Reinstated Strict RLS**: Dropped all `USING (true)` policies. Re-established user-ownership constraints on `profiles`, `messages` (sender, recipient, mentor class scope), and `post_reactions` (author only).
- **Prevented Role Escalation**: Added database trigger `trg_prevent_role_escalation` on `public.profiles` to reject any role mutation unless executed by `service_role` or an approved administrator.
- **Capacity Reality Documented**: Verified actual provider bottlenecks (Supabase Free built-in SMTP: 3–30 emails/hr, WebSocket connections: 200–500 concurrent, DB Pool: 15–60 connections). Documented the exact production path to support 1,500+ students safely.

---

## 1. Concrete Code Paths & Vulnerability Findings

### Finding 1: Student Account Impersonation via Public Register Number
* **Severity**: Critical (CVSS 9.8)
* **Affected Files**: `src/services/supabaseService.ts`, `src/context/AppContext.tsx`, `src/pages/AuthPage.tsx`
* **Vulnerable Code Flow**:
  1. `AuthPage.tsx` allowed students to input only `studentIdentifier` (e.g. `25BEI057`) with "Instant Academic Login: Authenticate directly with your official college roll number".
  2. `AppContext.tsx` (`login(cleanId)`) detected no password was supplied, calling `supabaseService.signInStudentFast(cleanId)`.
  3. `supabaseService.signInStudentFast` queried `profiles` by `student_reg_no`, computed a static internal password (`KCT#${regNo}!2026`), and signed in or returned the profile directly.
* **Impact**: Register numbers are public campus knowledge (visible on class rosters, ID cards, exam halls). Any student could log in as any classmate, read their private mentor feedback, post fake progress updates, or tamper with reports.
* **Remediation**:
  - `AuthPage.tsx` updated to require student password on sign-in and sign-up.
  - `AppContext.tsx` updated to reject passwordless login in production mode.
  - `supabaseService.ts` updated to resolve register numbers to emails and verify passwords using Supabase Auth `signInWithPassword`.
  - Added unit test: `rejects passwordless student login via signIn` and `rejects passwordless student login via signInStudentFast`.

### Finding 2: Unauthenticated Password Overwrite in Database RPC
* **Severity**: Critical (CVSS 9.1)
* **Affected File**: `supabase/migrations/008_instant_zero_email_auth.sql`
* **Vulnerable Code Flow**:
  ```sql
  -- VULNERABLE LOGIC IN MIGRATION 008:
  SELECT id INTO v_user_id FROM public.profiles WHERE student_reg_no = v_clean_reg LIMIT 1;
  IF v_user_id IS NOT NULL THEN
      UPDATE auth.users 
      SET encrypted_password = v_encrypted_pw, updated_at = NOW()
      WHERE id = v_user_id;
      RETURN json_build_object('success', true, 'user_id', v_user_id, ...);
  END IF;
  ```
* **Impact**: An attacker calling `register_student_instant` with an existing student's register number and a chosen password would overwrite the victim's password in `auth.users`, effectively locking them out and taking over their account.
* **Remediation**:
  - Replaced password overwrite in Migration `010_reinstate_strict_auth_and_rls.sql` with strict duplicate rejection:
    ```sql
    SELECT id INTO v_user_id FROM public.profiles WHERE student_reg_no = v_clean_reg LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'An account with this Student Register Number already exists. Please sign in with your password.';
    END IF;
    ```
  - Added client-side duplicate verification in `SupabaseService.registerStudentWithoutPassword`.

### Finding 3: Plaintext Faculty Passcode Exposure
* **Severity**: Medium/High (CVSS 6.5)
* **Affected Files**: `src/pages/AuthPage.tsx`
* **Vulnerable Code Flow**:
  - `facultyAccessCode` default state was initialized to `'KCT-FACULTY-2026'`.
  - The UI helper rendered: `Approved default passcode: <code className="text-teal-700 font-bold">KCT-FACULTY-2026</code>`.
* **Impact**: Any unauthenticated user visiting the website could register an account with role `mentor`, access faculty dashboards, view all enrolled students, and remove students from classes.
* **Remediation**:
  - Default state cleared (`useState('')`).
  - Plaintext code removed from JSX helper text.
  - Input field masked as `type="password"`.
  - Enforced that passcodes must be privately communicated by college administration.

### Finding 4: Row-Level Security (RLS) Neutralization
* **Severity**: High (CVSS 7.5)
* **Affected Files**: `supabase/migrations/006_complete_system_parity.sql`, `supabase/migrations/008_instant_zero_email_auth.sql`
* **Vulnerable Policies**:
  - `CREATE POLICY "Allow public profiles update" ON public.profiles FOR UPDATE USING (true);`
  - `CREATE POLICY "Allow public messages" ON public.messages FOR ALL USING (true);`
  - `CREATE POLICY "Allow public reactions" ON public.post_reactions FOR ALL USING (true);`
* **Impact**: Any authenticated or unauthenticated client could read all private direct messages across all students and mentors, delete other users' messages, or alter another user's profile.
* **Remediation**:
  - Reinstated strict RLS in Migration `010_reinstate_strict_auth_and_rls.sql`:
    * Messages: restricted to `auth.uid() = sender_id OR auth.uid() = recipient_id OR class_mentor`.
    * Reactions: restricted to `auth.uid() = user_id`.
    * Profiles: restricted to `auth.uid() = id`.

### Finding 5: User Role Escalation
* **Severity**: High (CVSS 8.5)
* **Impact**: If a student sent an update request altering their own profile's `role` column to `'mentor'` or `'admin'`, the database accepted it, unlocking faculty capabilities.
* **Remediation**:
  - Added PostgreSQL trigger `trg_prevent_role_escalation` on `public.profiles`:
    ```sql
    CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
    RETURNS TRIGGER AS $$
    BEGIN
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            IF auth.role() <> 'service_role' AND NOT EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
            ) THEN
                RAISE EXCEPTION 'Security Violation: Users cannot alter their assigned institutional role.';
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```

---

## 2. Capacity Ceilings & Provider Limits Reality

| Dimension | Default Built-In Supabase (Free Tier) | Upgraded Custom SMTP (SES / Resend) | MentorPulse Architecture |
| :--- | :--- | :--- | :--- |
| **Email Sending Limit** | **3 to 30 emails / hour** (Strict hard cap) | **50,000+ emails / day** | Admin-issued invites / Zero-email onboarding |
| **Account Creation Rate** | 30 / hr if emails are dispatched | 100+ requests / sec | Direct authenticated onboarding |
| **Max Concurrent WebSockets** | 200 concurrent connections | 500 – 10,000 (Pro tier) | Debounced realtime channels + cross-tab broadcast |
| **Database Connection Pool** | 15 – 60 connections (Direct / Supavisor) | 200 – 1,000 (Supavisor pooled) | Singleton client + connection reuse |
| **Active Class Enrollees** | ~50 per section | 1,500+ across department | Paginated feeds, lazy loaded profiles |

### How 1,500 Students Can Be Safely Onboarded:
1. **Never use Supabase default SMTP for bulk onboarding**: The 30 email/hour limit will fail after 30 registrations.
2. **Production Setup**:
   - In Supabase Dashboard -> **Authentication** -> **SMTP Settings**: Connect institutional Amazon SES or Resend account.
   - Or run the pre-confirmed CSV roster onboarding migration: An institutional administrator runs an automated script using the `service_role` key to create student auth users with pre-confirmed email addresses and initial secure temporary passwords.
   - Students receive their activation credentials through official college channels and sign in securely.

---

## 3. Verification & Test Suite Results

All security guarantees are verified by automated tests in `src/test/auth_security_audit.test.ts` and the complete test suite:

```
 RUN  v5.0.5 C:/Users/Keerthana N/OneDrive - Kumaraguru College of Technology/research/NEW

 ✓ src/test/ux_realtime_fixes.test.ts (10 tests)
 ✓ src/test/messaging_and_enrollment.test.ts (15 tests)
 ✓ src/test/practical_e2e.test.ts (26 tests)
 ✓ src/test/auth.test.ts (11 tests)
 ✓ src/test/two_sided_parity.test.ts (8 tests)
 ✓ src/test/auth_security_audit.test.ts (11 tests)
   ✓ 1. Student Authentication & Password Enforcement (3)
   ✓ 2. Account Takeover & Duplicate Registration Prevention (1)
   ✓ 3. Faculty Onboarding Authorization & Passcode Verification (4)
   ✓ 4. Role Escalation & RLS Policy Security Logic (3)
 ✓ src/test/mentorpulse.test.ts (29 tests)

 Test Files  7 passed (7)
      Tests  110 passed (110)
```

**Production Build Status**:
```
✓ built in 2.44s
dist/index.html                   1.14 kB
dist/assets/index-s-5Gb7Ut.css   44.37 kB
dist/assets/index-CMjVKsZT.js   858.39 kB
```

---

## 4. Deployment Instructions for Supabase

1. Open Supabase SQL Editor for project `myuljbnmmcpyhbhjxffo`.
2. Execute Migration `supabase/migrations/010_reinstate_strict_auth_and_rls.sql`.
3. Verify that `trg_prevent_role_escalation` is active on `public.profiles`.
4. Ensure no service-role keys are placed in `.env` or client code.
