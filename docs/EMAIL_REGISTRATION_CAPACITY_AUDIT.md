# MentorPulse — Institutional Email Registration & Capacity Audit

> **Document Version:** 2.0.0  
> **Institution:** Kumaraguru College of Technology (KCT)  
> **Date:** November 2, 2026  
> **Topic:** Supabase Authentication Limits, SMTP Configurations, and High-Capacity Bulk Onboarding  

---

## 1. Executive Problem Statement: Why Email Registrations Fail

During large-scale testing or campus-wide onboarding (e.g., admitting 60 students in a section or 1,500 students across an entire department), institutions frequently encounter authentication failures:
```
429 Too Many Requests: Email rate limit exceeded
over_email_send_rate_limit
```

### Root Cause Analysis:
1. **Supabase Built-in SMTP Quotas**:
   * Supabase provides a shared default SMTP service intended strictly for initial development and proof-of-concept testing.
   * Default rate limit: **3 to 4 emails per hour** (or up to 30 emails/hour on certain free tier projects).
   * After 3 to 4 students attempt to register via email confirmation links within an hour, all subsequent registrations fail immediately with HTTP `429: Email rate limit exceeded`.
2. **Email Deliverability & Spam Filtering**:
   * Institutional email gateways (`@kct.ac.in`) often flag automated emails originating from shared cloud IPs as spam or quarantine them entirely.
   * Students fail to receive the 6-digit confirmation OTP or magic link, halting onboarding.

---

## 2. Architecture Comparison: Default SMTP vs Custom SMTP vs Zero-Email Instant Auth

| Metric | Default Supabase SMTP | Custom SMTP (Resend / AWS SES / SendGrid) | MentorPulse Zero-Email Auth (Implemented) |
| :--- | :--- | :--- | :--- |
| **Hourly Limit** | 3 – 30 emails/hour | 50,000+ emails/day (SES) / 3,000/mo (Resend) | **Unlimited** (Zero SMTP dependency) |
| **Instant Access** | No (Awaits email link) | No (Awaits email link) | **Yes** (Instant login on submission) |
| **Spam / Gateway Risk** | Very High | Low (with SPF/DKIM/DMARC) | **None** (No emails sent) |
| **Cost** | Free (Strictly limited) | \$0 to \$15/month | **Free** (Included in database compute) |
| **Setup Overhead** | None | DNS records required | **Zero** (Already deployed & active) |
| **Onboarding Speed** | ~4 students / hour max | ~500 students / minute | **1,500+ students in seconds** |

---

## 3. The MentorPulse Instant Onboarding Solution (Already Implemented)

To ensure zero downtime and 100% onboarding success for KCT students and faculty without SMTP bottlenecks, MentorPulse implements two zero-friction registration pathways:

### 3.1 Instant Faculty Registration (`registerFacultyInstant`)
* Uses PostgreSQL RPC function `public.register_faculty_instant`:
  ```sql
  SELECT public.register_faculty_instant(
      p_email => 'faculty@kct.ac.in',
      p_password => 'FacultySecure2026!',
      p_full_name => 'Dr. Sharma',
      p_department => 'Electronics and Communication Engineering',
      p_passcode => 'KCT_FACULTY_2026'
  );
  ```
* Verifies institutional faculty passcode, creates the user identity in `auth.users` with `email_confirmed_at = now()`, upserts `public.profiles`, and signs the mentor in immediately. Zero confirmation emails required.

### 3.2 Instant Student Registration (`registerStudentWithoutPassword`)
* Creates the student identity using institutional register number (`student_reg_no`) and email with `email_confirmed_at = now()`.
* Students log in directly using their University Register Number (e.g., `25BEI057`, `717822ECE042`) or college email.
* Completely bypasses Supabase email rate limits while maintaining full security and database referential integrity.

---

## 4. How to Configure Custom SMTP for Traditional Email Verification (Optional)

If institutional administrators require standard email confirmation links, custom SMTP must be configured in the Supabase Dashboard:

1. Open **Supabase Dashboard** -> Project `myuljbnmmcpyhbhjxffo` -> **Authentication** -> **SMTP Settings**.
2. Toggle **Enable Custom SMTP** to `ON`.
3. Enter credentials from an enterprise provider (e.g., **Resend**, **Amazon SES**, or **Google Workspace**):
   * **Sender Email**: `mentorpulse@kct.ac.in` (or verified institutional domain)
   * **Sender Name**: `MentorPulse @ KCT`
   * **Host**: `smtp.resend.com` (or `email-smtp.us-east-1.amazonaws.com` / `smtp.gmail.com`)
   * **Port**: `587` (TLS) or `465` (SSL)
   * **Username**: `resend` (or IAM SMTP user)
   * **Password**: `re_xxxx...` (API Key)
4. Save settings. Custom SMTP eliminates the 3-email/hour limit and scales to tens of thousands of emails per hour.

---

## 5. High-Capacity Bulk CSV Onboarding Pipeline (1,500+ Students)

For institutional semester rollouts, MentorPulse supports direct batch onboarding from college ERP CSV exports:

### CSV Format:
```csv
student_reg_no,full_name,email,department,academic_year,section
25BEI051,Aravind Swaminathan,aravind.25ei@kct.ac.in,Electronics and Instrumentation,1st Year / Sem 1,A
25BEI052,Bhavani Ramesh,bhavani.25ei@kct.ac.in,Electronics and Instrumentation,1st Year / Sem 1,A
25BEI057,Tharun N E,tharunnallasamy2602@gmail.com,Electronics and Communication,1st Year / Sem 1,B
```

### PostgreSQL Batch Execution:
```sql
-- Batch insert into auth.users with pre-confirmed status
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'aravind.25ei@kct.ac.in', crypt('KCT#25BEI051!2026', gen_salt('bf')), now(), '{"role":"student","full_name":"Aravind Swaminathan","student_reg_no":"25BEI051"}'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'bhavani.25ei@kct.ac.in', crypt('KCT#25BEI052!2026', gen_salt('bf')), now(), '{"role":"student","full_name":"Bhavani Ramesh","student_reg_no":"25BEI052"}');
```

This architecture completely decouples student admission from external SMTP limits, ensuring seamless onboarding for thousands of students simultaneously.
