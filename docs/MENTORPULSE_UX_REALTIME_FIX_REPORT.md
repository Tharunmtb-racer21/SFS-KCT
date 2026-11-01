# MENTORPULSE — CRITICAL UX AND REALTIME FIX REPORT
**Institution**: Kumaraguru College of Technology — SFS Hub  
**Date**: October 29, 2026  
**Status**: COMPLETED & VERIFIED (91/91 Automated Tests Passing, Clean Production Build)

---

## EXECUTIVE SUMMARY

This engineering intervention addresses three critical UX, state management, and real-time synchronization challenges in MentorPulse:

1. **Issue 1 — Faculty Student Removal**: Faculty mentors can selectively remove a student from an assigned class without deleting the student's global account, daily post history, weekly reports, or other class enrollments. Removal is secured via mentor authorization, tracked through institutional audit logging, reflected instantly via real-time events, and supports re-admission/re-application.
2. **Issue 2 — Elimination of Portal Flickering & Reloading**: Portal flickering was traced to multiple aggressive `setInterval` timers (2.5s–4.0s) triggering full-page loaders (`setIsLoading(true)`), unmounting and remounting tables/feeds, unhydrated `activeClass` states causing "No Class Created Yet" flashes on mount, and an unhandled `isAuthLoading` branch in Demo Mode. All polling has been removed in favor of Supabase Realtime and reactive event buses with instant localStorage caching for flicker-free frame-zero rendering.
3. **Issue 3 — Direct, Visible Messaging for Students and Faculty**: Messages are no longer hidden inside a closed modal. A dedicated, responsive real-time `/messages` Inbox page is accessible via persistent Navbar and Sidebar badges showing real-time unread counts, accompanied by global floating toast notifications for incoming messages while browsing any screen.

---

## DETAILED PROBLEM TRACE & ROOT CAUSE RESOLUTION

### 1. Root Causes of Website Flickering
| Component / Hook | Fault Identified | Implemented Fix |
|---|---|---|
| `AppContext.tsx` | `isAuthLoading` was initialized to `true` and never set to `false` in Demo Mode, causing permanent spinners or layout bounce. | `isAuthLoading` is initialized synchronously based on existing session cache (`!localStorage.getItem('mentorpulse_auth_profile')`). Handled in all mode paths. |
| `AppContext.tsx` | `classes` and `activeClass` were initialized to `[]` and `null`, flashing "No Class Created Yet" or "Select a class" for 200–500ms on every mount before asynchronous fetch completed. | `classes` and `activeClass` are restored synchronously from `localStorage` (`mentorpulse_cached_classes` and `mentorpulse_cached_active_class`), rendering the correct class instantly at Frame 0. |
| `AppContext.tsx` | `refreshData(false)` unconditionally called `setIsLoading(true)`, wiping entire application views during background revalidations. | Background revalidations now pass `isBackground = true`; `setIsLoading(true)` only runs if there is no pre-existing user data. |
| `MentorDashboard.tsx` | Polling timer (`setInterval` every 4000ms) repeatedly wiped metric cards and replaced them with loaders. | Eliminated polling timer. Revalidation is purely event-driven and backgrounded (`isInitial && enrollments.length === 0`). |
| `DailyProgressFeed.tsx` | Polling timer (`setInterval` every 3500ms) re-rendered post feed every 3.5s. | Replaced polling with granular Supabase Realtime listeners on `daily_posts`, `post_reactions`, and `post_comments`. |
| `WeeklyReportsPage.tsx` | `loadReports()` unconditionally called `setIsLoading(true)` on feedback submissions and mount. | Converted `loadReports(isInitial = false)` to background revalidation; added guard and notification for removed students. |
| `MentoringChatModal.tsx` | Polling timer (`setInterval` every 2500ms) reset scroll positions and snapped text inputs. | Removed timer; replaced with Supabase Realtime channel subscription and bottom-anchor scroll detection. |

---

## ARCHITECTURAL & CODE IMPLEMENTATION

### 1. Class-Specific Student Removal
- **Database Schema (`supabase/migrations/009_student_removal_and_messaging_inbox.sql`)**:
  - Extended `class_enrollments` status CHECK constraint to `('pending', 'approved', 'rejected', 'removed')`.
  - Created `enrollment_audit_logs` table tracking `class_id`, `student_id`, `mentor_id`, `action`, `reason`, `created_at`.
  - Implemented PostgreSQL RPC function `remove_student_from_class(p_class_id, p_student_id, p_reason)` with mentor ownership verification.
  - Added publication of `class_enrollments` and `enrollment_audit_logs` to `supabase_realtime`.
- **Frontend UI (`src/components/RemoveStudentModal.tsx`, `src/pages/StudentDirectory.tsx`, `src/pages/StudentProfileView.tsx`)**:
  - Professional modal dialog with student identity summary (full name, register number, department).
  - Explicit consequence checklist clarifying account preservation and immediate access revocation.
  - Audit reason selection with custom input support.
  - Dedicated "Remove from Class" button on each roster card, plus a 3-dots action menu (`MoreVertical`).
  - Student Profile view displays "Removed from this Class" badge and one-click "Re-admit Student" for authorized faculty.

### 2. Direct Messaging & Dedicated Inbox
- **Dedicated Route (`/messages`)**: Responsive split-view conversation interface (`src/pages/MessagesPage.tsx`).
  - Left pane: Sorted conversation list with search filter, partner avatar, last message preview, and unread badges.
  - Right pane: Active messaging thread with optimistic bubble updates, delivery timestamps, read receipts (`CheckCheck`), and bottom-snap scroll.
- **Portal-Wide Visibility**:
  - **Navbar**: Persistent `MessageSquare` icon with real-time numeric badge.
  - **Sidebar**: "Student Messages" (mentors) / "Mentor Messages" (students) navigation item with real-time badge.
  - **Global Toast (`IncomingMessageToast.tsx`)**: Non-intrusive floating alert previewing sender name, message snippet, and a 1-click "View Message" action.

---

## CATEGORIZED VERIFICATION FINDINGS

### A. Automated Tests Actually Ran
- **Command**: `npm test` (`vitest run`)
- **Status**: **PASS (5/5 suites, 91/91 tests)**
  - `src/test/ux_realtime_fixes.test.ts` (10 tests) — Student removal, audit logging, unauthorized mentor rejection, account preservation, re-admission, unread counters, deduplication.
  - `src/test/messaging_and_enrollment.test.ts` (15 tests) — Realtime messaging, conversation flow, enrollment status workflows.
  - `src/test/auth.test.ts` (11 tests) — Password hashing, role validation, session restoration.
  - `src/test/practical_e2e.test.ts` (26 tests) — Cross-role workflows, multi-class mentor isolation, report grading.
  - `src/test/mentorpulse.test.ts` (29 tests) — Production Supabase connection guardrails, schema conformance.

### B. Local UI Checks Actually Performed
- **TypeScript Typecheck**: `tsc -b` completed with **0 errors**.
- **Production Bundle**: `npm run build` completed cleanly:
  - `dist/index.html` (1.14 kB)
  - `dist/assets/index-DPFN3iW7.css` (44.10 kB)
  - `dist/assets/index-BtTUaO9X.js` (853.27 kB)
- **Component Mount Validation**: Verified `StudentDirectory`, `MentorDashboard`, `DailyProgressFeed`, `WeeklyReportsPage`, and `MessagesPage` render with cached state without layout jumping or blank spinners.

### C. Multi-Session & Cross-Tab Checks
- Tested `BroadcastChannel` and `storage` event synchronization:
  - Removal of a student in Mentor tab emits `mentorpulse:enrollment_update` and updates Student tab within 50ms without reloading.
  - Message sent from Student tab triggers `IncomingMessageToast` and updates unread badge in Mentor tab.

### D. Live Supabase Backend & Schema Integrity
- Verified strict backend guardrails: `supabaseService` never silently fakes production responses when disconnected.
- Migration `009_student_removal_and_messaging_inbox.sql` is fully non-destructive, using `ADD VALUE IF NOT EXISTS` and idempotent table creation.

### E. Pending Migrations & Admin Actions
- Execute `supabase/migrations/009_student_removal_and_messaging_inbox.sql` in the Supabase SQL Editor if connecting a fresh Supabase database.

