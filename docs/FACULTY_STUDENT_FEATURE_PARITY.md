# MentorPulse — Faculty ↔ Student Feature Parity & Security Matrix

> **Document Version:** 2.0.0  
> **Institution:** Kumaraguru College of Technology (KCT)  
> **Date:** November 2, 2026  
> **Scope:** Two-Sided Functional Parity, Security Boundaries, and RLS Policy Enforcement  

---

## 1. Feature Parity Matrix

| Domain | Feature | Faculty Mentor Portal | Student Portal | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Sign In | Password or Faculty Passcode (`mentor`) | Register No / Email passwordless or password (`student`) | **Full Parity** |
| | Registration | Instant Faculty creation via secure RPC (`KCT_FACULTY_2026`) | Instant student registration with pre-confirmed email | **Full Parity** |
| | Session Restore | Instant synchronous Frame-0 local cache | Instant synchronous Frame-0 local cache | **Full Parity** |
| **Class Management** | Class Creation | Create class groups, generate invite codes & tokens | View active enrolled classes | **Role-Appropriate** |
| | Enrollment Approval | 1-Click Approve / Decline from Student Directory | Request enrollment via invite link or token | **Full Parity** |
| | Student Removal | Dedicated confirmation modal with audit reason selection | Immediate restricted view & "Removed" notice; re-apply option | **Full Parity** |
| **Progress Stream** | Post Creation | N/A (Mentors review and guide) | Multi-category daily post composer with tags & attachments | **Role-Appropriate** |
| | Reactions / Kudos | Award 🔥 Inspiring, 👏 Kudos, 💡 Insight | Award 🔥, 👏, 💡 peer reactions; toggle on/off | **Full Parity** |
| | Mentor Feedback | Rich feedback text box under student posts | Read-only guidance card highlighting mentor's review | **Full Parity** |
| | Comments Thread | Add mentor reply / guidance | Add student reply / query | **Full Parity** |
| **Weekly Reports** | Submissions | Review queue filtered by All, Pending, Approved, Revision | Create, save draft, and submit weekly logs | **Full Parity** |
| | Review Decisions | Approve or Request Revision with mentor notes | Instant status badge change; "Edit Draft" unlocks on revision | **Full Parity** |
| **Direct Messaging** | Thread View | Split-view drawer of all student conversations in class | Split-view drawer of mentor conversations | **Full Parity** |
| | Real-Time Sync | Sends & receives messages with instant UI update | Sends & receives messages with instant UI update | **Full Parity** |
| | Unread Alerts | Top navigation badge, sidebar badge, floating toast | Top navigation badge, sidebar badge, floating toast | **Full Parity** |
| | Removed Students | Chat preserved in read-only audit mode | Chat preserved in read-only audit mode | **Full Parity** |
| **Notifications** | Activity Bell | Persistent drawer of approvals, feedback, messages | Persistent drawer of Kudos, feedback, messages | **Full Parity** |
| | Deep Linking | Links navigate to relevant student or message | Links navigate directly to `/messages`, `/student/feed`, etc. | **Full Parity** |

---

## 2. Row-Level Security (RLS) Policy & Access Matrix

All PostgreSQL tables enforce Row Level Security without disabling RLS in production:

| Table | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy |
| :--- | :--- | :--- | :--- | :--- |
| `public.profiles` | All authenticated users can view directory profiles | Triggered via Auth RPC / user self | User can update own profile only | Restricted |
| `public.classes` | Mentors view own classes; students view enrolled classes | Mentors and Admins only | Class mentor only | Class mentor only |
| `public.class_enrollments` | Mentor of class or enrolled student | Authenticated student (`requested`) | Class mentor (`approved`, `rejected`, `removed`) | Class mentor |
| `public.daily_posts` | Class mentor or approved enrolled students | Approved students in class only | Author of post only | Author or class mentor |
| `public.post_reactions` | Class mentor or approved enrolled students | Authenticated user (`user_id = auth.uid()`) | User can update own reaction | User can delete own reaction |
| `public.post_feedback` | Class mentor or student author | Class mentor only | Authoring mentor only | Authoring mentor only |
| `public.weekly_reports` | Class mentor or student author | Approved student author only | Student author (while draft/revision) | Student author |
| `public.weekly_report_feedback`| Class mentor or student author | Class mentor only | Class mentor only | Class mentor only |
| `public.messages` | Sender or recipient only (`sender_id` or `recipient_id`) | Sender only (`sender_id = auth.uid()`) | Recipient updates status to `read` | Restricted |
| `public.notifications` | Recipient only (`user_id = auth.uid()`) | System / Authenticated triggering user | Recipient updates `read = true` | Recipient only |
| `public.enrollment_audit_logs`| Class mentor or System Admin | Class mentor on status change | Immutable (No Updates Allowed) | Restricted |

---

## 3. Real-Time Publication & Notification Dispatch Flow

```
[Faculty Action: Kudos / Message / Review]
                  │
                  ▼
   Supabase Database Insert / Update
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
Realtime WebSocket    Notification Table
(`postgres_changes`)     (`public.notifications`)
        │                   │
        ▼                   ▼
Incoming Message Toast   Activity Bell Badge (+1)
+ Thread Auto-Scroll     + Deep Link to Destination Page
```

Every user action generates both an immediate Optimistic UI update on the local client and a verified remote database mutation that broadcasts through Supabase Realtime channels and Cross-Tab Broadcast Channels.
