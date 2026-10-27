import { describe, it, expect, beforeEach } from 'vitest';
import { AppDataStore } from '../services/store';

describe('MentorPulse - Core Domain & Security Tests', () => {
  let store: AppDataStore;

  beforeEach(() => {
    // Fresh store with reset seed data
    store = new AppDataStore();
    store.resetToSeedData();
  });

  describe('1. Class Isolation & Multi-Department Management', () => {
    it('isolates students between ECE and Mechanical classes', () => {
      const eceClass = store.getClassById('class-ece-2024');
      const mechClass = store.getClassById('class-mech-2024');

      expect(eceClass).toBeDefined();
      expect(mechClass).toBeDefined();
      expect(eceClass?.department).toBe('Electronics and Communication Engineering');
      expect(mechClass?.department).toBe('Mechanical Engineering');

      const eceEnrollments = store.getEnrollmentsForClass('class-ece-2024');
      const mechEnrollments = store.getEnrollmentsForClass('class-mech-2024');

      const eceStudentIds = eceEnrollments.map((e) => e.student_id);
      const mechStudentIds = mechEnrollments.map((e) => e.student_id);

      // Verify mutual exclusivity: Kavitha & Rahul (ECE) are not in Mech class
      expect(eceStudentIds).toContain('student-ece-1');
      expect(mechStudentIds).not.toContain('student-ece-1');

      // Verify Sanjay (Mech) is not in ECE class
      expect(mechStudentIds).toContain('student-mech-1');
      expect(eceStudentIds).not.toContain('student-mech-1');
    });

    it('isolates daily progress feeds between classes', () => {
      const ecePosts = store.getDailyPostsForClass('class-ece-2024');
      const mechPosts = store.getDailyPostsForClass('class-mech-2024');

      expect(ecePosts.length).toBeGreaterThan(0);
      expect(mechPosts.length).toBeGreaterThan(0);

      // ECE posts must only have class_id = 'class-ece-2024'
      ecePosts.forEach((post) => {
        expect(post.class_id).toBe('class-ece-2024');
      });

      // Mech posts must only have class_id = 'class-mech-2024'
      mechPosts.forEach((post) => {
        expect(post.class_id).toBe('class-mech-2024');
      });
    });

    it('isolates weekly summary reports between classes', () => {
      const eceReports = store.getWeeklyReportsForClass('class-ece-2024');
      const mechReports = store.getWeeklyReportsForClass('class-mech-2024');

      eceReports.forEach((report) => {
        expect(report.class_id).toBe('class-ece-2024');
      });
      mechReports.forEach((report) => {
        expect(report.class_id).toBe('class-mech-2024');
      });
    });
  });

  describe('2. Unguessable Invitation Tokens & Enrollment Lifecycle', () => {
    it('generates unguessable, non-sequential invitation tokens', () => {
      const newClass = store.createClass({
        mentor_id: 'mentor-1',
        name: 'CSE-A 2024',
        department: 'Computer Science and Engineering',
        academic_year: '2024-2025',
        semester: 'Semester 5',
        requires_approval: true,
      });

      expect(newClass.invite_code).toBeDefined();
      expect(newClass.invite_code.length).toBeGreaterThan(8);
      // Ensure invite code does not expose the database ID
      expect(newClass.invite_code).not.toContain(newClass.id);
    });

    it('successfully lookups class by active token and fails if token is invalid or inactive', () => {
      const found = store.getClassByInviteCode('ece-a-token-98f2b');
      expect(found).toBeDefined();
      expect(found?.id).toBe('class-ece-2024');

      // Invalid token returns null
      const notFound = store.getClassByInviteCode('invalid-token-12345');
      expect(notFound).toBeNull();

      // Revoking token disables access
      store.toggleInviteActive('class-ece-2024', false);
      const afterRevoke = store.getClassByInviteCode('ece-a-token-98f2b');
      expect(afterRevoke).toBeNull();
    });

    it('regenerating token invalidates old token immediately', () => {
      const oldCode = 'ece-a-token-98f2b';
      const newCode = store.regenerateInviteCode('class-ece-2024');

      expect(newCode).not.toBe(oldCode);
      expect(store.getClassByInviteCode(oldCode)).toBeNull();
      expect(store.getClassByInviteCode(newCode)?.id).toBe('class-ece-2024');
    });

    it('enforces mentor approval queue when requires_approval is enabled', () => {
      // Create a test student
      const testStudent = store.registerUser({
        id: 'test-student-unique-1',
        role: 'student',
        full_name: 'Ananya Sharma',
        email: 'ananya.test@kct.ac.in',
        student_reg_no: '717822ECE999',
        skills: ['Python', 'VLSI'],
      });

      // Request enrollment in ECE class (which requires approval)
      const enrollment = store.requestEnrollment('class-ece-2024', testStudent.id);
      expect(enrollment.status).toBe('pending');

      // Mentor reviews and approves
      const approvedEnrollment = store.reviewEnrollment(enrollment.id, 'approved', 'mentor-1');
      expect(approvedEnrollment.status).toBe('approved');
      expect(approvedEnrollment.reviewed_by).toBe('mentor-1');
    });
  });

  describe('3. Student Daily Progress Posts & Authorization', () => {
    it('allows student to create daily progress entry with category and metadata', () => {
      const post = store.createDailyPost({
        class_id: 'class-ece-2024',
        student_id: 'student-ece-1',
        category: 'Lab Experiment',
        title: 'Tested SPI DMA High Speed Transfer',
        description: 'Transferred 64KB audio buffers with DMA burst mode at 20MHz clock frequency.',
        skills_gained: ['SPI', 'DMA', 'C++'],
        activity_date: '2026-10-27',
      });

      expect(post.id).toBeDefined();
      expect(post.title).toBe('Tested SPI DMA High Speed Transfer');

      const classPosts = store.getDailyPostsForClass('class-ece-2024');
      const found = classPosts.find((p) => p.id === post.id);
      expect(found).toBeDefined();
    });

    it('prevents non-author from deleting someone elses post', () => {
      const posts = store.getDailyPostsForClass('class-ece-2024');
      const kavithaPost = posts.find((p) => p.student_id === 'student-ece-1')!;

      // Attempt deletion by another student (Rahul)
      expect(() => {
        store.deleteDailyPost(kavithaPost.id, 'student-ece-2');
      }).toThrowError('Unauthorized');

      // Author herself can delete it
      store.deleteDailyPost(kavithaPost.id, 'student-ece-1');
      const updatedPosts = store.getDailyPostsForClass('class-ece-2024');
      expect(updatedPosts.find((p) => p.id === kavithaPost.id)).toBeUndefined();
    });
  });

  describe('4. Persistent Reactions & Mentor Feedback', () => {
    it('records persistent reactions without duplicates', () => {
      const posts = store.getDailyPostsForClass('class-ece-2024');
      const targetPost = posts[0];

      // Add WOW reaction from student-ece-3 (new reaction)
      store.reactToPost(targetPost.id, 'student-ece-3', 'WOW');
      let updated = store.getDailyPostsForClass('class-ece-2024').find((p) => p.id === targetPost.id)!;
      let userReaction = updated.reactions?.find((r) => r.user_id === 'student-ece-3');
      expect(userReaction?.reaction_type).toBe('WOW');

      // Changing to 'Excellent' updates the reaction rather than duplicating
      store.reactToPost(targetPost.id, 'student-ece-3', 'Excellent');
      updated = store.getDailyPostsForClass('class-ece-2024').find((p) => p.id === targetPost.id)!;
      const allUserReactions = updated.reactions?.filter((r) => r.user_id === 'student-ece-3');
      expect(allUserReactions?.length).toBe(1);
      expect(allUserReactions?.[0].reaction_type).toBe('Excellent');
    });

    it('allows faculty mentor to provide feedback on daily posts', () => {
      const posts = store.getDailyPostsForClass('class-ece-2024');
      const targetPost = posts[0];

      const updated = store.addPostFeedback(
        targetPost.id,
        'mentor-1',
        'Verify jitter timing with hardware scope before the next milestone.'
      );

      const latestFeedback = updated.feedback?.[updated.feedback.length - 1];
      expect(latestFeedback?.content).toBe(
        'Verify jitter timing with hardware scope before the next milestone.'
      );
      expect(latestFeedback?.mentor_id).toBe('mentor-1');
    });

    it('allows faculty mentor to provide feedback on weekly reports', () => {
      const reports = store.getWeeklyReportsForClass('class-ece-2024');
      const targetReport = reports[0];

      const updated = store.addWeeklyReportFeedback(
        targetReport.id,
        'mentor-1',
        'Exceptional weekly milestone delivery. Approved.'
      );

      expect(updated.mentor_reviewed).toBe(true);
      expect(updated.feedback?.length).toBeGreaterThan(0);
    });
  });

  describe('5. Roster CSV Export', () => {
    it('generates safe, structured CSV for authorized class mentor', () => {
      const csv = store.exportClassRosterCSV('class-ece-2024');

      expect(csv).toContain('Register Number');
      expect(csv).toContain('Student Name');
      expect(csv).toContain('Institutional Email');
      expect(csv).toContain('Kavitha Sundaram');
      expect(csv).toContain('717822ECE042');
      expect(csv).toContain('Rahul Varma');
    });
  });
});
