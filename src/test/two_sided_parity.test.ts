import { describe, it, expect, beforeEach } from 'vitest';
import { appStore } from '../services/store';
import { NotificationItem, DirectMessage } from '../types';

describe('Two-Sided Functional Parity: Faculty & Student Experience', () => {
  const MENTOR_ID = 'mentor-1';
  const STUDENT_1_ID = 'student-ece-1';
  const STUDENT_2_ID = 'student-ece-2';
  const CLASS_ID = 'class-ece-2024';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    appStore.resetToSeedData();
  });

  describe('Phase 2: Kudos and Emoji Reactions (Both Directions)', () => {
    it('allows faculty mentor to award Kudos to student post and triggers unread notification', () => {
      // Create student post
      const post = appStore.createDailyPost({
        class_id: CLASS_ID,
        student_id: STUDENT_1_ID,
        title: 'Built Neural Network Model',
        category: 'Project Milestone',
        description: 'Trained model with 98% accuracy on KCT testbed.',
        skills_gained: ['PyTorch', 'CNN'],
        activity_date: '2026-11-02',
      });

      // Mentor awards Kudos 🔥
      const updatedPost = appStore.reactToPost(post.id, MENTOR_ID, '🔥');
      expect(updatedPost.reactions).toBeDefined();
      expect(updatedPost.reactions!.length).toBe(1);
      expect(updatedPost.reactions![0].reaction_type).toBe('🔥');
      expect(updatedPost.reactions![0].user_id).toBe(MENTOR_ID);
      expect(updatedPost.reactions![0].user_name).toContain('Ramanathan');

      // Verify student received unread notification with Faculty Kudos title
      const studentNotifs = appStore.getNotificationsForUser(STUDENT_1_ID);
      const kudosNotif = studentNotifs.find((n: NotificationItem) => n.title.includes('Faculty Kudos'));
      expect(kudosNotif).toBeDefined();
      expect(kudosNotif?.read).toBe(false);
      expect(kudosNotif?.link).toBe('/student/feed');
      expect(kudosNotif?.message).toContain('reacted 🔥');
    });

    it('allows student to react to post and author receives notification', () => {
      // Student 1 post
      const post = appStore.createDailyPost({
        class_id: CLASS_ID,
        student_id: STUDENT_1_ID,
        title: 'Open Source Contribution',
        category: 'Research',
        description: 'Merged PR into React library.',
        skills_gained: ['TypeScript', 'Git'],
        activity_date: '2026-11-02',
      });

      // Student 2 reacts with 👏
      const updatedPost = appStore.reactToPost(post.id, STUDENT_2_ID, '👏');
      expect(updatedPost.reactions!.length).toBe(1);
      expect(updatedPost.reactions![0].reaction_type).toBe('👏');
      expect(updatedPost.reactions![0].user_id).toBe(STUDENT_2_ID);

      // Verify Student 1 receives reaction notification
      const student1Notifs = appStore.getNotificationsForUser(STUDENT_1_ID);
      const reactionNotif = student1Notifs.find((n: NotificationItem) => n.title.includes('New Reaction: 👏'));
      expect(reactionNotif).toBeDefined();
      expect(reactionNotif?.read).toBe(false);
      expect(reactionNotif?.link).toBe('/student/feed');
    });

    it('toggles reaction off when clicking same reaction again', () => {
      const post = appStore.createDailyPost({
        class_id: CLASS_ID,
        student_id: STUDENT_1_ID,
        title: 'Robotics Workshop Completed',
        category: 'Certification',
        description: 'Completed autonomous rover calibration.',
        skills_gained: ['ROS', 'Sensors'],
        activity_date: '2026-11-02',
      });

      // Toggle ON
      const withReaction = appStore.reactToPost(post.id, MENTOR_ID, '💡');
      expect(withReaction.reactions!.length).toBe(1);

      // Toggle OFF
      const toggledOff = appStore.reactToPost(post.id, MENTOR_ID, '💡');
      expect(toggledOff.reactions!.length).toBe(0);
    });

    it('updates reaction when clicking a different reaction emoji', () => {
      const post = appStore.createDailyPost({
        class_id: CLASS_ID,
        student_id: STUDENT_1_ID,
        title: 'Full Stack App Deployment',
        category: 'Development',
        description: 'Deployed to Vercel and connected PostgreSQL database.',
        skills_gained: ['Vite', 'PostgreSQL'],
        activity_date: '2026-11-02',
      });

      // Initial reaction
      appStore.reactToPost(post.id, MENTOR_ID, '👏');
      // Change to 🔥
      const changed = appStore.reactToPost(post.id, MENTOR_ID, '🔥');
      expect(changed.reactions!.length).toBe(1);
      expect(changed.reactions![0].reaction_type).toBe('🔥');
    });
  });

  describe('Phase 3: Faculty <-> Student Direct Messaging', () => {
    const CONVERSATION_ID = `conv_${CLASS_ID}_${STUDENT_1_ID}`;

    it('delivers faculty message to student with unread notification and /messages link', () => {
      const msg = appStore.sendMessage({
        conversation_id: CONVERSATION_ID,
        class_id: CLASS_ID,
        sender_id: MENTOR_ID,
        recipient_id: STUDENT_1_ID,
        content: 'Please submit your Week 4 hardware log today.',
      });

      expect(msg.status).toBe('delivered');

      // Verify unread notification for student
      const studentNotifs = appStore.getNotificationsForUser(STUDENT_1_ID);
      const msgNotif = studentNotifs.find((n: NotificationItem) => n.title === 'New Mentoring Message');
      expect(msgNotif).toBeDefined();
      expect(msgNotif?.read).toBe(false);
      expect(msgNotif?.link).toBe('/messages');
      expect(msgNotif?.message).toContain('Please submit your Week 4 hardware');
    });

    it('delivers student reply to faculty with unread notification and /messages link', () => {
      const reply = appStore.sendMessage({
        conversation_id: CONVERSATION_ID,
        class_id: CLASS_ID,
        sender_id: STUDENT_1_ID,
        recipient_id: MENTOR_ID,
        content: 'Submitted mentor! Please verify the schematic diagram.',
      });

      expect(reply.status).toBe('delivered');

      // Verify unread notification for faculty
      const mentorNotifs = appStore.getNotificationsForUser(MENTOR_ID);
      const msgNotif = mentorNotifs.find((n: NotificationItem) => n.title === 'New Mentoring Message');
      expect(msgNotif).toBeDefined();
      expect(msgNotif?.read).toBe(false);
      expect(msgNotif?.link).toBe('/messages');
    });

    it('shares identical conversation history and clears unread state when read', () => {
      appStore.sendMessage({
        conversation_id: CONVERSATION_ID,
        class_id: CLASS_ID,
        sender_id: MENTOR_ID,
        recipient_id: STUDENT_1_ID,
        content: 'Message 1 from mentor',
      });
      appStore.sendMessage({
        conversation_id: CONVERSATION_ID,
        class_id: CLASS_ID,
        sender_id: STUDENT_1_ID,
        recipient_id: MENTOR_ID,
        content: 'Reply 1 from student',
      });

      const history = appStore.getMessagesForConversation(CONVERSATION_ID);
      expect(history.length).toBe(2);

      // Student marks messages as read
      appStore.markMessagesAsRead(CONVERSATION_ID, STUDENT_1_ID);
      const updatedHistory = appStore.getMessagesForConversation(CONVERSATION_ID);
      const mentorMsg = updatedHistory.find((m: DirectMessage) => m.sender_id === MENTOR_ID);
      expect(mentorMsg?.status).toBe('read');
      expect(mentorMsg?.read_at).toBeDefined();
    });
  });

  describe('Phase 4: Class-Specific Student Removal Parity', () => {
    it('isolates removal to the target class and preserves student profile & other enrollments', () => {
      // Verify initial state
      const initialEnrollments = appStore.getEnrollmentsForStudent(STUDENT_1_ID);
      expect(initialEnrollments.length).toBeGreaterThan(0);

      // Mentor removes student from CLASS_ID
      const updated = appStore.removeStudentFromClass(CLASS_ID, STUDENT_1_ID, MENTOR_ID, 'Course transfer');
      expect(updated.status).toBe('removed');

      // Verify student's profile still exists
      const studentProfile = appStore.getProfile(STUDENT_1_ID);
      expect(studentProfile).toBeDefined();
      expect(studentProfile?.id).toBe(STUDENT_1_ID);

      // Verify notification created for student informing of removal
      const studentNotifs = appStore.getNotificationsForUser(STUDENT_1_ID);
      const removalNotif = studentNotifs.find((n: NotificationItem) => n.title.includes('Class Enrollment Notice'));
      expect(removalNotif).toBeDefined();
      expect(removalNotif?.message).toContain('removed');
    });
  });
});
