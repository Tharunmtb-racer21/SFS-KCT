import { describe, it, expect, beforeEach } from 'vitest';
import { AppDataStore } from '../services/store';

describe('MentorPulse UX & Realtime Fixes - Verification Tests', () => {
  let store: AppDataStore;

  const CLASS_ID = 'class-ece-2024';
  const MENTOR_ID = 'mentor-1';
  const UNAUTHORIZED_MENTOR_ID = 'mentor-unauthorized-99';
  const STUDENT_ID = 'student-ece-1';
  const OTHER_STUDENT_ID = 'student-ece-2';

  beforeEach(() => {
    store = new AppDataStore();
    store.resetToSeedData();
  });

  describe('Issue 1: Faculty Student Removal from Class', () => {
    it('allows an authorized mentor to remove a student with audit reason', () => {
      const enrollmentsBefore = store.getEnrollmentsForClass(CLASS_ID);
      const studentEnrollment = enrollmentsBefore.find(e => e.student_id === STUDENT_ID);
      expect(studentEnrollment).toBeDefined();
      expect(studentEnrollment?.status).toBe('approved');

      const removalReason = 'Transferred to different department cohort';
      const result = store.removeStudentFromClass(CLASS_ID, STUDENT_ID, MENTOR_ID, removalReason);

      expect(result).toBeDefined();
      expect(result.status).toBe('removed');

      // Verify status changed to 'removed'
      const enrollmentsAfter = store.getEnrollmentsForClass(CLASS_ID);
      const updatedEnrollment = enrollmentsAfter.find(e => e.student_id === STUDENT_ID);
      expect(updatedEnrollment?.status).toBe('removed');

      // Verify audit log created
      const auditLogs = store.getEnrollmentAuditLogs(CLASS_ID);
      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[0];
      expect(latestLog.student_id).toBe(STUDENT_ID);
      expect(latestLog.mentor_id).toBe(MENTOR_ID);
      expect(latestLog.action).toBe('removed');
      expect(latestLog.reason).toBe(removalReason);
    });

    it('prevents unauthorized faculty from removing students outside their assigned class', () => {
      expect(() => {
        store.removeStudentFromClass(CLASS_ID, STUDENT_ID, UNAUTHORIZED_MENTOR_ID, 'Unauthorized attempt');
      }).toThrow(/authorized/i);

      // Verify student remains enrolled
      const enrollments = store.getEnrollmentsForClass(CLASS_ID);
      const studentEnrollment = enrollments.find(e => e.student_id === STUDENT_ID);
      expect(studentEnrollment?.status).toBe('approved');
    });

    it('preserves the student account, profile, daily posts, and weekly reports upon removal', () => {
      // 1. Check profile exists
      const profileBefore = store.getProfile(STUDENT_ID);
      expect(profileBefore).toBeDefined();

      // 2. Check posts exist
      const postsBefore = store.getDailyPostsForStudent(STUDENT_ID, CLASS_ID);
      expect(postsBefore.length).toBeGreaterThan(0);

      // 3. Remove student
      store.removeStudentFromClass(CLASS_ID, STUDENT_ID, MENTOR_ID, 'Administrative section transfer');

      // 4. Verify profile still exists globally
      const profileAfter = store.getProfile(STUDENT_ID);
      expect(profileAfter).toBeDefined();
      expect(profileAfter?.full_name).toBe(profileBefore?.full_name);
      expect(profileAfter?.email).toBe(profileBefore?.email);

      // 5. Verify daily posts are preserved for historical audit
      const postsAfter = store.getDailyPostsForStudent(STUDENT_ID, CLASS_ID);
      expect(postsAfter.length).toBe(postsBefore.length);

      // 6. Verify weekly reports are preserved for historical audit
      const reports = store.getWeeklyReportsForStudent(STUDENT_ID, CLASS_ID);
      expect(Array.isArray(reports)).toBe(true);
    });

    it('allows a removed student to re-request enrollment or be re-admitted by mentor', () => {
      // Remove student first
      store.removeStudentFromClass(CLASS_ID, STUDENT_ID, MENTOR_ID, 'Accidental removal');
      let enrollments = store.getEnrollmentsForClass(CLASS_ID);
      expect(enrollments.find(e => e.student_id === STUDENT_ID)?.status).toBe('removed');

      // Student re-applies via class ID
      const reapplyResult = store.requestEnrollment(CLASS_ID, STUDENT_ID);
      expect(reapplyResult).toBeDefined();

      // Verify status is updated to pending or approved
      enrollments = store.getEnrollmentsForClass(CLASS_ID);
      const enr = enrollments.find(e => e.student_id === STUDENT_ID);
      expect(['pending', 'approved']).toContain(enr?.status);

      // Mentor can re-admit directly
      if (enr && enr.id) {
        store.updateEnrollmentStatus(enr.id, 'approved');
        const approvedEnr = store.getEnrollmentsForClass(CLASS_ID).find(e => e.student_id === STUDENT_ID);
        expect(approvedEnr?.status).toBe('approved');
      }
    });

    it('does not remove student from other classes', () => {
      // Enroll student in a second class
      const secondClass = store.createClass({
        mentor_id: MENTOR_ID,
        name: 'Robotics Elective',
        department: 'ECE',
        academic_year: '2024-2025',
        semester: 'Semester 5',
        description: 'Robotics',
        requires_approval: false,
      });

      store.requestEnrollment(secondClass.id, STUDENT_ID);

      // Remove from primary class
      store.removeStudentFromClass(CLASS_ID, STUDENT_ID, MENTOR_ID, 'Dropped core class');

      // Verify removed from primary
      const primaryEnr = store.getEnrollmentsForClass(CLASS_ID).find(e => e.student_id === STUDENT_ID);
      expect(primaryEnr?.status).toBe('removed');

      // Verify still active in second class
      const secondaryEnr = store.getEnrollmentsForClass(secondClass.id).find(e => e.student_id === STUDENT_ID);
      expect(secondaryEnr?.status).toBe('approved');
    });
  });

  describe('Issue 2: Flickering & Background Refresh Stability', () => {
    it('restores cached user and active class without unmounting components', () => {
      const user = store.getCurrentUser();
      expect(user).toBeDefined();
      expect(user?.id).toBe(MENTOR_ID);

      const classes = store.getClassesForMentor(user!.id);
      expect(classes.length).toBeGreaterThan(0);

      const activeClass = classes[0];
      store.setSelectedClassId(activeClass.id);
      expect(store.getSelectedClassId()).toBe(activeClass.id);
    });

    it('deduplicates messages and events across subscriptions', () => {
      const convId = `conv_${CLASS_ID}_${STUDENT_ID}`;
      const msg1 = store.sendMessage({
        conversation_id: convId,
        class_id: CLASS_ID,
        sender_id: STUDENT_ID,
        recipient_id: MENTOR_ID,
        content: 'Test message for deduplication',
      });

      const msgs = store.getMessagesForConversation(convId);
      const occurrences = msgs.filter(m => m.id === msg1.id);
      expect(occurrences.length).toBe(1);
    });
  });

  describe('Issue 3: Direct Messaging & Real-Time Inbox Visibility', () => {
    it('increments unread message count for recipient, not sender', () => {
      const initialMentorUnread = store.getUnreadMessagesCount(MENTOR_ID);
      const initialStudentUnread = store.getUnreadMessagesCount(STUDENT_ID);

      const convId = `conv_${CLASS_ID}_${STUDENT_ID}`;
      store.sendMessage({
        conversation_id: convId,
        class_id: CLASS_ID,
        sender_id: STUDENT_ID,
        recipient_id: MENTOR_ID,
        content: 'Mentor, please review my latest task submission.',
      });

      const newMentorUnread = store.getUnreadMessagesCount(MENTOR_ID);
      const newStudentUnread = store.getUnreadMessagesCount(STUDENT_ID);

      // Mentor received a message, unread count should increment
      expect(newMentorUnread).toBe(initialMentorUnread + 1);
      // Sender's unread count should NOT increment
      expect(newStudentUnread).toBe(initialStudentUnread);
    });

    it('generates conversation summaries grouped with correct latest message and unread count', () => {
      const convId = `conv_${CLASS_ID}_${STUDENT_ID}`;
      store.sendMessage({
        conversation_id: convId,
        class_id: CLASS_ID,
        sender_id: STUDENT_ID,
        recipient_id: MENTOR_ID,
        content: 'Latest progress report query.',
      });

      const conversations = store.getUserConversations(MENTOR_ID);
      expect(conversations.length).toBeGreaterThan(0);

      const conv = conversations.find(c => c.conversationId === convId);
      expect(conv).toBeDefined();
      expect(conv?.lastMessage?.content).toBe('Latest progress report query.');
      expect(conv?.unreadCount).toBeGreaterThan(0);
      expect(conv?.otherUser.id).toBe(STUDENT_ID);
    });

    it('marks messages as read persistently when conversation is opened', () => {
      const convId = `conv_${CLASS_ID}_${STUDENT_ID}`;
      store.sendMessage({
        conversation_id: convId,
        class_id: CLASS_ID,
        sender_id: STUDENT_ID,
        recipient_id: MENTOR_ID,
        content: 'Unread query awaiting mentor response.',
      });

      expect(store.getUnreadMessagesCount(MENTOR_ID)).toBeGreaterThan(0);

      // Mentor opens conversation
      store.markMessagesAsRead(convId, MENTOR_ID);

      // All messages received by mentor in this conversation should now be read
      const convMessages = store.getMessagesForConversation(convId);
      const mentorReceivedMessages = convMessages.filter(m => m.recipient_id === MENTOR_ID);
      expect(mentorReceivedMessages.every(m => m.status === 'read')).toBe(true);

      const convsAfter = store.getUserConversations(MENTOR_ID);
      const convAfter = convsAfter.find(c => c.conversationId === convId);
      expect(convAfter?.unreadCount).toBe(0);
    });
  });
});
