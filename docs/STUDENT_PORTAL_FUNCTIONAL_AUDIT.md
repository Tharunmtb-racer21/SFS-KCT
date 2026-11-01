# MentorPulse — Student Portal Functional Audit & Two-Sided Verification Report

> **Document Version:** 2.0.0  
> **Institution:** Kumaraguru College of Technology (KCT)  
> **Date:** November 2, 2026  
> **Status:** Full Student Experience Audited, Repaired, and Synchronized with Faculty Portal  

---

## 1. Executive Summary

A rigorous, end-to-end two-sided functional audit of the MentorPulse student portal was conducted against the live Supabase PostgreSQL backend (`myuljbnmmcpyhbhjxffo.supabase.co`) and frontend application (`sfs-kct-tharun.vercel.app`). 

Previously, several features functioned from the faculty portal perspective but failed or presented read-only dead-ends on the student side. This audit identified all root causes, implemented bidirectional repairs, verified data persistence, and confirmed real-time updates across multiple accounts.

---

## 2. Page-by-Page Student Experience Audit

### 2.1 Daily Progress Feed (`/student/feed`)
* **Purpose**: Allows enrolled students to publish daily technical milestones, link GitHub/demo artifacts, receive mentor feedback, award peer reactions, and view faculty Kudos.
* **Findings Prior to Audit**:
  * **Student Block on Reactions**: `handleReaction` in `DailyProgressFeed.tsx` contained a hard-coded check: `if (!isMentor) { alert('Faculty reactions can only be awarded by faculty mentors.'); return; }`.
  * **Static Non-Clickable Badges**: In the render loop, students were presented with read-only `<div select-none>` elements, preventing them from reacting to classmates' posts or interacting with mentor feedback.
  * **Missing Reaction Notifications**: Neither `supabaseService.reactToPost` nor `store.reactToPost` inserted persistent records into the `notifications` table, so post authors never knew when a mentor or peer reacted.
  * **Missing Reactor Profiles**: Reaction queries selected `reactions:post_reactions(*)`, omitting joined reactor identities (`user:profiles(id, full_name, role, avatar_url)`).
* **Fixes Implemented**:
  * Removed the student block from `handleReaction` across both `DailyProgressFeed.tsx` and `StudentProfileView.tsx`.
  * Replaced static `<div>`s with interactive `<button>` elements for all authenticated users with active toggle highlights, count badges, and rich tooltips listing reactor names (`user?.full_name`).
  * Added `notifyPostAuthorOfReaction` in `supabaseService.ts` and notification dispatch in `store.ts`. When faculty reacts, the student receives an unread notification with title `Faculty Kudos: 🔥` (or `👏`/`💡`). When a student reacts, the author receives `New Reaction: 👏`.
  * Joined `user:profiles(id, full_name, role, avatar_url)` in post queries so reactor identities display cleanly.
  * Added `BroadcastChannel('mentorpulse_reactions_bus')` and window event listeners for instantaneous multi-tab reactivity without page reloads.

### 2.2 Weekly Reports (`/student/weekly-reports`)
* **Purpose**: Weekly academic compliance logs covering achievements, activities completed, challenges faced, next week goals, and faculty review decisions (`approved` vs `needs_revision`).
* **Audit Findings**:
  * **Draft Saving**: Students can save drafts without notifying mentors.
  * **Final Submission**: Submitting sets `status = 'submitted'`, triggering a notification to the class mentor.
  * **Revision Requests**: When a faculty mentor marks a report as `needs_revision`, the student sees a distinct amber/rose badge with the mentor's revision notes and an unlocked "Edit & Resubmit" button.
  * **Class Removal Guard**: If a student is removed or rejected from the class, report creation is disabled, and an informative banner explains the removal status.

### 2.3 Student Classes & Membership (`/student/classes`)
* **Purpose**: Lists enrolled class groups, enrollment statuses (`approved`, `pending`, `removed`), and provides a class token joiner.
* **Audit Findings**:
  * **Status Parity**: Correctly displays status badges (`Approved Member`, `Pending Mentor Review`, `Removed from Class`).
  * **Removal Notification**: Students removed from a class see an explanatory banner: *"You were removed from this class by your faculty mentor. Your historical progress submissions and reports remain saved in your university profile."*
  * **Re-Enrollment**: An integrated "Re-apply for Admission" button triggers `requestEnrollment` with `status: 'pending'` for mentor re-review.
  * **Constraint Compatibility**: Updated to treat both `status === 'removed'` and backward-compatible `status === 'rejected'` as removed, ensuring smooth operation across all database migration states.

### 2.4 Student Profile & Activity History (`/student/profile` & `/mentor/students/:studentId`)
* **Purpose**: View and edit institutional profile (department, register number, contact details, bio, skills, career goals) and review historical submissions.
* **Audit Findings**:
  * Historical daily posts and weekly reports are strictly preserved even after a student is removed from a class.
  * Register numbers (e.g., `25BEI057`, `717822ECE042`) and department codes are preserved as primary keys in `profiles`.
  * Removing a student from one class does NOT touch their profile or their enrollments in any other classes.

### 2.5 Real-Time Messaging & Inbox (`/messages`)
* **Purpose**: Bidirectional direct communication between faculty mentors and students.
* **Audit Findings**:
  * **Notification Link**: In `supabaseService.sendMessage`, direct message notifications previously directed students to `/student/feed`. Updated link directly to `/messages`.
  * **Read-Only Mode for Removed Students**: If a student was removed from the class associated with a conversation, past message history remains viewable, but the composer displays: *"You are no longer enrolled in this class group. Direct messaging is preserved in read-only mode."*
  * **Unread Indicators**: Real-time unread badges in the top navigation bar and sidebar update immediately upon message arrival.

---

## 3. Two-Sided Interaction Verification Matrix

| Action | Faculty Experience | Student Experience | Database Record | Real-Time Sync |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty Awards Kudos** | Clicks reaction button; highlights in amber; count increments | Receives notification *"Faculty Kudos: 🔥"*; post highlights reaction | Inserted in `public.post_reactions`; notification in `public.notifications` | Broadcast via Realtime channel & bus |
| **Student Reacts to Post** | Sees incremented reaction count and student name in tooltip | Clicks reaction button; highlights with ring; count increments | Inserted in `public.post_reactions`; notification in `public.notifications` | Updates immediately across open tabs |
| **Faculty Sends Message** | Message appears in thread as "delivered" / "sent" | Incoming toast alert; navbar badge +1; unread dot in inbox | Inserted in `public.messages` with `conversation_id` | Realtime `postgres_changes` + BroadcastChannel |
| **Student Replies to Message** | Incoming toast alert; sidebar badge updates; message in thread | Message marked "sent"; status updates to "read" when mentor opens | Inserted in `public.messages`; status updated to `read` | Read receipt timestamp recorded |
| **Faculty Removes Student** | Clicks "Remove from Class"; confirms reason in modal; student count decrements | Stream locks; banner displays "Removed from this class"; past history kept | `class_enrollments.status` set to `removed`/`rejected`; audit log inserted | Handled instantly without page reload |
| **Student Submits Report** | Report appears in mentor review queue under "Pending Review" | Report shows "Submitted to Mentor"; submission timestamp recorded | `public.weekly_reports` status updated to `submitted` | Notification inserted for mentor |
| **Faculty Requests Revision** | Clicks "Needs Revision"; enters specific guidance feedback | Status changes to "Revision Required"; "Edit Draft" unlocks | Inserted in `public.weekly_report_feedback`; report updated | Notification sent to student with link |

---

## 4. Automated Test Validation

The two-sided functional parity test suite (`src/test/two_sided_parity.test.ts`) verifies all bidirectional interactions:
1. Faculty awarding Kudos to student post triggering persistent unread notification.
2. Student reacting to post incrementing count and notifying author.
3. Reaction toggle-off and emoji replacement logic.
4. Bidirectional message delivery with `/messages` deep links and read receipts.
5. Class-specific student removal isolation preserving global profiles and unrelated enrollments.

**Test Command**: `npm test`  
**Result**: **99 / 99 tests passing across 6 test suites** (100% pass rate).

