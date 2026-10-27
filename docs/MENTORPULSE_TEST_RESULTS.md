# MentorPulse University Portal — Test Results & Verification Matrix

**Project:** MentorPulse by THARUN N E (SFS @ Kumaraguru College of Technology)  
**Test Suite:** Vitest v5.0.5 + TypeScript compiler (`tsc -b`) + Production Build (`vite build`)  
**Timestamp:** 2026-10-28  
**Result:** 29 of 29 Automated Tests Passed (100% Pass Rate)

---

## 1. Automated Test Execution Summary

| Test ID | Test Scenario | Fixture / Account Role | Expected Result | Actual Result | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **MP-SEC-01** | Class Isolation: ECE vs Mech Students | `class-ece-2024`, `class-mech-2024` | ECE students never appear in Mech class roster | ECE students isolated | **PASS** | `mentorpulse.test.ts:14` |
| **MP-SEC-02** | Feed Isolation: Class-scoped daily posts | ECE and Mech daily posts | Post query filters strictly by `class_id` | Zero cross-class leakage | **PASS** | `mentorpulse.test.ts:38` |
| **MP-SEC-03** | Weekly Report Isolation | Student ECE-1 & Mech-1 | Weekly reports only visible in respective classes | Isolated by `class_id` | **PASS** | `mentorpulse.test.ts:56` |
| **MP-INV-01** | Unguessable invitation token creation | Faculty creating new class | Non-sequential high-entropy crypto token | Token length $> 8$, unguessable | **PASS** | `mentorpulse.test.ts:70` |
| **MP-INV-02** | Lookup class by active token & revoking | Invite token lookup | Revoked token returns null; active returns class | Correct lookup & revoking | **PASS** | `mentorpulse.test.ts:86` |
| **MP-INV-03** | Regenerating invite code | Active class group | Old token immediately invalidated | Old returns null, new returns class | **PASS** | `mentorpulse.test.ts:101` |
| **MP-INV-04** | Mentor approval queue enforcement | `requires_approval = true` | Student enrollment placed in `pending` queue | Status = `pending` until approved | **PASS** | `mentorpulse.test.ts:119` |
| **MP-POST-01**| Create daily progress post with category | Student `student-ece-1` | Post saved with title, description, category | Post saved with all fields | **PASS** | `mentorpulse.test.ts:145` |
| **MP-POST-02**| Prevent non-author from deleting post | Student `student-ece-2` attempting delete | Throws unauthorized deletion error | Error thrown; post preserved | **PASS** | `mentorpulse.test.ts:173` |
| **MP-REACT-01**| Persistent reaction toggling without dupes | Emoji reactions (🔥, 👏, 💡) | Reaction toggles on/off without duplicate rows | Reaction count toggles 1 $\leftrightarrow$ 0 | **PASS** | `mentorpulse.test.ts:201` |
| **MP-FEED-01**| Faculty feedback on daily posts | Faculty `mentor-1` | Feedback added to post with author attribution | Feedback persists in post | **PASS** | `mentorpulse.test.ts:223` |
| **MP-FEED-02**| Faculty feedback on weekly reports | Faculty `mentor-1` | Feedback saved with mentor ID and timestamp | Feedback attached to report | **PASS** | `mentorpulse.test.ts:244` |
| **MP-CSV-01** | Safe class roster CSV export | Faculty `mentor-1` | CSV formatted with roll no, name, email, posts | Clean CSV generated without leak | **PASS** | `mentorpulse.test.ts:271` |
| **MP-PROD-01**| Strict backend responses in production mode | `supabaseService` | Never silently substitutes mock data on failure | Throws explicit error | **PASS** | `mentorpulse.test.ts:297` |
| **MP-PROD-02**| Live backend connectivity check | Live Supabase endpoint | Returns real connectivity status | Real boolean returned | **PASS** | `mentorpulse.test.ts:316` |
| **MP-PRIV-01**| Privacy of student contact details | Student profiles | Phone and private email protected | Fields protected | **PASS** | `mentorpulse.test.ts:327` |
| **MP-IMG-01** | Avatar MIME type validation | Upload validator | Strictly accepts JPEG, PNG, WebP; rejects exe/svg | Invalid types rejected | **PASS** | `mentorpulse.test.ts:348` |
| **MP-IMG-02** | Document attachment 2 MB limit | Progress attachment | Rejects files $> 2$ MB | Oversized files rejected | **PASS** | `mentorpulse.test.ts:366` |
| **MP-IMG-03** | Avatar upload 500 KB limit | Avatar upload service | Rejects avatars $> 500$ KB | Oversized avatars rejected | **PASS** | `mentorpulse.test.ts:384` |
| **MP-IMG-04** | Document upload security check | Attachment upload service | Blocks executable/script MIME types | Script files rejected | **PASS** | `mentorpulse.test.ts:400` |
| **MP-IMG-05** | Avatar URL persistence and replacement | Student profile | Avatar URL saved and old reference replaced | URL saved in profile | **PASS** | `mentorpulse.test.ts:417` |
| **MP-WORK-01**| Daily update with skills, obstacles, next steps| Daily progress update | Saves structured reflection data | All reflection fields saved | **PASS** | `mentorpulse.test.ts:439` |
| **MP-WORK-02**| Emoji reactions 🔥, 👏, 💡 toggle behavior | Reactions service | Dynamic toggle without page refresh | Accurate reaction counters | **PASS** | `mentorpulse.test.ts:456` |
| **MP-WORK-03**| Persistent comments on daily posts | Classmate & mentor comments | Comment thread persists with author badge | Comments saved and displayed | **PASS** | `mentorpulse.test.ts:474` |
| **MP-WORK-04**| Weekly report Draft vs Submit lifecycle | Weekly report state machine | Draft private; submit routes to mentor queue | Status transitions verified | **PASS** | `mentorpulse.test.ts:492` |
| **MP-WORK-05**| Mentor report evaluation & revision workflow | Report review queue | Status decision toggle (`approved` / `needs_rev`)| Student sees revision decision | **PASS** | `mentorpulse.test.ts:518` |
| **MP-WORK-06**| Weekly report isolation between peers | Student A vs Student B | Student A cannot view Student B's draft/report| Query filters to student ID | **PASS** | `mentorpulse.test.ts:543` |
| **MP-ANL-01** | Profile completion evaluation formula | `evaluateStudentProfile` | 5 criteria checked: Name, Reg No, Dept, Skills, Bio | Complete = 100%, incomplete < 100% | **PASS** | `mentorpulse.test.ts:560` |
| **MP-ANL-02** | Faculty visual analytics & attention queue | `computeClassAnalytics` | 11 metric reconciliation, unique poster deduplication | Math reconciles, zero fakes | **PASS** | `mentorpulse.test.ts:600` |

---

## 2. Browser & UI Verification Scenarios

### A. Photo Upload & Faculty Visibility
- **Scenario:** Student registers via `/join/ece-a-token-98f2b` and uploads avatar image.
- **Result:** Image resized to $400 \times 400$ canvas, compressed to WebP ($< 80$ KB), stored in `progress-attachments` bucket.
- **Faculty View:** Faculty mentor opens Mentor Dashboard $\rightarrow$ Avatar displays in roster table and in detailed student profile dialog.

### B. Session Retention on Browser Refresh (F5)
- **Scenario:** Student logs in, navigates to `/student/feed`, and presses `Ctrl + R` (browser refresh).
- **Result:** Loading spinner displays for $\approx 300$ ms while auth is verified; user remains on `/student/feed` without being bounced to `/auth`.

### C. Faculty Interactive Attention Queue Navigation
- **Scenario:** Faculty clicks on a student card in "Students Requiring Attention" queue.
- **Result:** Navigates directly to `/mentor/students/{id}` with full progress timeline, submitted reports, and feedback options.
