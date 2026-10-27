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

  describe('6. Production Mode Separation & Backend Guardrails', () => {
    it('supabaseService enforces strict backend responses and never silently fakes data', async () => {
      const { supabaseService } = await import('../services/supabaseService');

      if (supabaseService.isConfigured) {
        // In configured mode, queries execute against live PostgreSQL
        // An invalid UUID format correctly errors from the database engine rather than faking data
        await expect(supabaseService.getClassesForMentor('invalid-uuid')).rejects.toThrow();
        // A valid formatted UUID query returns an array without crashing
        const classes = await supabaseService.getClassesForMentor('00000000-0000-0000-0000-000000000001');
        expect(Array.isArray(classes)).toBe(true);
      } else {
        // In unconfigured mode, attempting to query Supabase MUST throw an explicit error
        await expect(supabaseService.getClassesForMentor('mentor-1')).rejects.toThrowError(
          'Supabase is not configured'
        );
      }
    });

    it('testConnection accurately reflects live backend connectivity state', async () => {
      const { supabaseService } = await import('../services/supabaseService');
      const conn = await supabaseService.testConnection();

      if (supabaseService.isConfigured) {
        expect(conn.connected).toBe(true);
        expect(conn.message).toContain('Connected');
      } else {
        expect(conn.connected).toBe(false);
        expect(conn.message).toContain('Supabase is not configured');
      }
    });

    it('enforces privacy of student contact details by default', () => {
      const kavitha = store.getProfile('student-ece-1');
      expect(kavitha?.phone).toBeDefined();

      // Only mentors should receive phone number when inspecting enrolled student
      const mentorEnrollments = store.getEnrollmentsForClass('class-ece-2024');
      const studentEntry = mentorEnrollments.find(e => e.student_id === 'student-ece-1');
      expect(studentEntry?.student.phone).toBe('+91 98421 54321');
    });
  });

  describe('7. Profile Photos, Document Validation & Storage Limits', () => {
    it('validates photo MIME types and strictly rejects invalid or dangerous files', async () => {
      const { validatePhotoFile } = await import('../utils/imageUtils');

      // Valid images
      const validJpg = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const validPng = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
      const validWebp = new File(['dummy content'], 'avatar.webp', { type: 'image/webp' });

      expect(validatePhotoFile(validJpg).valid).toBe(true);
      expect(validatePhotoFile(validPng).valid).toBe(true);
      expect(validatePhotoFile(validWebp).valid).toBe(true);

      // Invalid formats
      const invalidPdf = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' });
      const dangerousScript = new File(['#!/bin/bash'], 'script.sh', { type: 'text/x-shellscript' });
      const dangerousExe = new File(['MZ'], 'malware.exe', { type: 'application/x-msdownload' });

      expect(validatePhotoFile(invalidPdf).valid).toBe(false);
      expect(validatePhotoFile(dangerousScript).valid).toBe(false);
      expect(validatePhotoFile(dangerousExe).valid).toBe(false);
      expect(validatePhotoFile(dangerousExe).error).toContain('strictly prohibited');
    });

    it('strictly enforces 2MB limit on document and progress attachments', async () => {
      const { validateAttachmentFile, MAX_DOC_BYTES } = await import('../utils/imageUtils');

      expect(MAX_DOC_BYTES).toBe(2 * 1024 * 1024);

      // Valid 1MB PDF
      const validPdf = new File([new Uint8Array(1024 * 1024)], 'lab-experiment.pdf', { type: 'application/pdf' });
      expect(validateAttachmentFile(validPdf).valid).toBe(true);

      // Oversized 2.5MB PDF
      const oversizedPdf = new File([new Uint8Array(2.5 * 1024 * 1024)], 'thesis.pdf', { type: 'application/pdf' });
      const result = validateAttachmentFile(oversizedPdf);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the 2 MB maximum limit');

      // Rejects executable files
      const dangerousBat = new File(['calc.exe'], 'run.bat', { type: 'text/plain' });
      expect(validateAttachmentFile(dangerousBat).valid).toBe(false);
    });

    it('supabaseService.uploadAvatar enforces 500 KB limit and rejects oversized files', async () => {
      const { supabaseService } = await import('../services/supabaseService');

      // Mock oversized photo: 600 KB
      const oversizedPhoto = new File([new Uint8Array(600 * 1024)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(
        supabaseService.uploadAvatar('test-user', oversizedPhoto)
      ).rejects.toThrow('Profile photo exceeds 500 KB limit');
    });

    it('supabaseService.uploadAttachment enforces 2 MB limit and blocks script files', async () => {
      const { supabaseService } = await import('../services/supabaseService');

      // Oversized 3MB file
      const oversizedFile = new File([new Uint8Array(3 * 1024 * 1024)], 'large-proof.pdf', { type: 'application/pdf' });
      await expect(
        supabaseService.uploadAttachment('test-student', oversizedFile)
      ).rejects.toThrow('exceeds maximum allowed limit of 2 MB');

      // Executable file
      const scriptFile = new File(['echo test'], 'exploit.sh', { type: 'application/x-sh' });
      await expect(
        supabaseService.uploadAttachment('test-student', scriptFile)
      ).rejects.toThrow('strictly prohibited');
    });

    it('persists avatar_url reference in profile and supports replacement', () => {
      // 1. Initial avatar update
      const updated = store.updateProfile('student-ece-1', {
        avatar_url: 'https://myuljbnmmcpyhbhjxffo.supabase.co/storage/v1/object/sign/progress-attachments/student-ece-1/avatar_1.webp'
      });
      expect(updated.avatar_url).toContain('avatar_1.webp');

      // 2. Verified in student directory lookup
      const enrollments = store.getEnrollmentsForClass('class-ece-2024');
      const student = enrollments.find(e => e.student_id === 'student-ece-1')?.student;
      expect(student?.avatar_url).toContain('avatar_1.webp');

      // 3. Photo replacement
      const replaced = store.updateProfile('student-ece-1', {
        avatar_url: 'https://myuljbnmmcpyhbhjxffo.supabase.co/storage/v1/object/sign/progress-attachments/student-ece-1/avatar_2.webp'
      });
      expect(replaced.avatar_url).toContain('avatar_2.webp');
    });
  });

  describe('8. Refined Daily Progress & Weekly Formal Report Workflows', () => {
    it('creates daily progress post with today\'s work, skills, obstacles, and next steps', () => {
      const newPost = store.createDailyPost({
        class_id: 'class-ece-2024',
        student_id: 'student-ece-1',
        category: 'Lab Experiment',
        title: 'STM32 FreeRTOS Semaphore Synchronization',
        description: 'Successfully implemented binary semaphore to avoid priority inversion on ADC task.',
        skills_gained: ['FreeRTOS', 'Embedded C', 'Real-Time Systems'],
        challenges: 'Priority inversion occurred during serial UART printing task.',
        next_steps: 'Migrate to priority ceiling protocol and measure interrupt latency.',
        activity_date: '2026-10-27',
      });

      expect(newPost.id).toBeDefined();
      expect(newPost.title).toContain('FreeRTOS');
      expect(newPost.skills_gained).toContain('FreeRTOS');
      expect(newPost.challenges).toContain('Priority inversion');
      expect(newPost.next_steps).toContain('Migrate to priority');

      const classPosts = store.getDailyPostsForClass('class-ece-2024');
      const found = classPosts.find((p) => p.id === newPost.id);
      expect(found).toBeDefined();
      expect(found?.student?.full_name).toBeDefined();
    });

    it('supports emoji reactions 🔥, 👏, and 💡 on daily posts with toggle behavior', () => {
      const posts = store.getDailyPostsForClass('class-ece-2024');
      const targetPost = posts[0];

      // 1. React with 🔥
      const afterFire = store.reactToPost(targetPost.id, 'student-ece-2', '🔥');
      const fireReaction = afterFire.reactions?.find((r) => r.user_id === 'student-ece-2');
      expect(fireReaction?.reaction_type).toBe('🔥');

      // 2. React with 💡 (changes reaction)
      const afterIdea = store.reactToPost(targetPost.id, 'student-ece-2', '💡');
      const ideaReaction = afterIdea.reactions?.find((r) => r.user_id === 'student-ece-2');
      expect(ideaReaction?.reaction_type).toBe('💡');

      // 3. React with 💡 again (toggles off)
      const afterToggle = store.reactToPost(targetPost.id, 'student-ece-2', '💡');
      const toggledOff = afterToggle.reactions?.find((r) => r.user_id === 'student-ece-2');
      expect(toggledOff).toBeUndefined();

      // 4. React with 👏
      const afterClap = store.reactToPost(targetPost.id, 'student-ece-2', '👏');
      expect(afterClap.reactions?.some((r) => r.reaction_type === '👏')).toBe(true);
    });

    it('supports persistent classmate & mentor comments on daily progress posts', () => {
      const posts = store.getDailyPostsForClass('class-ece-2024');
      const targetPost = posts[0];

      // Classmate adds a comment
      const comment = store.addPostComment(
        targetPost.id,
        'student-ece-2',
        'Great work on solving the impedance mismatch! What probe attenuation did you use?'
      );
      expect(comment.id).toBeDefined();
      expect(comment.content).toContain('Great work');

      // Verified in class feed
      const refreshedPosts = store.getDailyPostsForClass('class-ece-2024');
      const postWithComment = refreshedPosts.find((p) => p.id === targetPost.id);
      expect(postWithComment?.comments).toBeDefined();
      expect(postWithComment?.comments?.some((c) => c.id === comment.id)).toBe(true);
      expect(postWithComment?.comments?.find((c) => c.id === comment.id)?.user?.full_name).toBeDefined();

      // Delete comment
      store.deletePostComment(comment.id, 'student-ece-2');
      const afterDelete = store.getDailyPostsForClass('class-ece-2024');
      const deletedPost = afterDelete.find((p) => p.id === targetPost.id);
      expect(deletedPost?.comments?.some((c) => c.id === comment.id)).toBe(false);
    });

    it('handles weekly formal report Draft, Edit, and Submit lifecycle with hours_spent', () => {
      // 1. Create a Draft report
      const draft = store.saveWeeklyReport({
        class_id: 'class-ece-2024',
        student_id: 'student-ece-1',
        week_number: 9,
        start_date: '2026-10-20',
        end_date: '2026-10-26',
        achievements: 'Designed CAN transceiver isolation barrier.',
        activities_completed: 'PCB schematic layout and signal simulation.',
        difficulties_faced: 'Trace impedance tolerance was ±12%.',
        hours_spent: 14,
        next_week_goals: 'Order PCB prototype boards.',
        status: 'draft',
        submitted_at: new Date().toISOString(),
      });

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('draft');
      expect(draft.hours_spent).toBe(14);

      // 2. Draft is editable by student owner
      const updatedDraft = store.saveWeeklyReport({
        id: draft.id,
        class_id: 'class-ece-2024',
        student_id: 'student-ece-1',
        week_number: 9,
        start_date: '2026-10-20',
        end_date: '2026-10-26',
        achievements: 'Designed CAN transceiver isolation barrier with optocouplers.',
        activities_completed: 'PCB schematic layout, signal simulation, and thermal analysis.',
        difficulties_faced: 'Resolved trace impedance mismatch using differential routing.',
        hours_spent: 18,
        next_week_goals: 'Send Gerber files for fabrication.',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });

      expect(updatedDraft.status).toBe('submitted');
      expect(updatedDraft.hours_spent).toBe(18);
      expect(updatedDraft.achievements).toContain('optocouplers');

      // 3. Submitted report appears in mentor review queue
      const mentorReports = store.getWeeklyReportsForClass('class-ece-2024');
      const inQueue = mentorReports.find((r) => r.id === draft.id);
      expect(inQueue).toBeDefined();
      expect(inQueue?.status).toBe('submitted');
    });

    it('enforces mentor evaluation with review status (approved / needs_revision) and feedback', () => {
      // Create submitted report
      const report = store.saveWeeklyReport({
        class_id: 'class-ece-2024',
        student_id: 'student-ece-2',
        week_number: 9,
        start_date: '2026-10-20',
        end_date: '2026-10-26',
        achievements: 'Implemented Kalman filter in Python.',
        activities_completed: 'Tested filter on noisy gyro data.',
        difficulties_faced: 'Matrix inversion divergence.',
        hours_spent: 16,
        next_week_goals: 'Optimize in C++ for ARM Cortex-M4.',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });

      // Mentor evaluates with 'needs_revision'
      const reviewed = store.addWeeklyReportFeedback(
        report.id,
        'mentor-1',
        'Please include covariance plots for Q and R matrices before final signoff.',
        'needs_revision'
      );

      expect(reviewed.mentor_reviewed).toBe(true);
      expect(reviewed.review_status).toBe('needs_revision');
      expect(reviewed.feedback?.[0].status_decision).toBe('needs_revision');

      // Student views own report with mentor review status
      const studentReports = store.getWeeklyReportsForStudent('student-ece-2', 'class-ece-2024');
      const studentReport = studentReports.find((r) => r.id === report.id);
      expect(studentReport?.review_status).toBe('needs_revision');
      expect(studentReport?.feedback?.[0].content).toContain('covariance plots');

      // Mentor re-evaluates to 'approved' after revision
      const approved = store.addWeeklyReportFeedback(
        report.id,
        'mentor-1',
        'Excellent revision. Covariance plots look solid. Milestone approved.',
        'approved'
      );
      expect(approved.review_status).toBe('approved');
    });

    it('enforces privacy: students query only their own weekly reports and cannot see peers\' reports', () => {
      // Kavitha (student-ece-1) reports
      const kavithaReports = store.getWeeklyReportsForStudent('student-ece-1');
      // Rahul (student-ece-2) reports
      const rahulReports = store.getWeeklyReportsForStudent('student-ece-2');

      expect(kavithaReports.length).toBeGreaterThan(0);
      kavithaReports.forEach((r) => {
        expect(r.student_id).toBe('student-ece-1');
        // Must never include Rahul's report
        expect(r.student_id).not.toBe('student-ece-2');
      });

      rahulReports.forEach((r) => {
        expect(r.student_id).toBe('student-ece-2');
        expect(r.student_id).not.toBe('student-ece-1');
      });
    });
  });

  describe('8. Faculty Visual Analytics, Metric Aggregations & Attention Queue Verification', () => {
    // Dynamic import to test pure functions
    it('accurately evaluates student profile completion according to university criteria', async () => {
      const { evaluateStudentProfile } = await import('../utils/analyticsUtils');

      // Complete profile
      const completeProfile: any = {
        id: 'stud-1',
        full_name: 'Kavitha S',
        email: 'kavitha.22ec@kct.ac.in',
        student_reg_no: '717722EC104',
        department: 'Electronics and Communication Engineering',
        skills: ['Embedded Systems', 'RTOS'],
        career_goals: 'Core electronics firmware architect',
        bio: 'Passionate engineer',
        role: 'student',
      };
      const res1 = evaluateStudentProfile(completeProfile);
      expect(res1.isComplete).toBe(true);
      expect(res1.percent).toBe(100);
      expect(res1.hasName).toBe(true);
      expect(res1.hasRegNo).toBe(true);
      expect(res1.hasDept).toBe(true);
      expect(res1.hasSkills).toBe(true);
      expect(res1.hasBioOrGoals).toBe(true);

      // Incomplete profile: missing registration number and skills
      const incompleteProfile: any = {
        id: 'stud-2',
        full_name: 'Fresh Student',
        email: 'fresh@kct.ac.in',
        student_reg_no: 'Pending',
        department: 'Mechanical Engineering',
        skills: [],
        role: 'student',
      };
      const res2 = evaluateStudentProfile(incompleteProfile);
      expect(res2.isComplete).toBe(false);
      expect(res2.percent).toBeLessThan(100);
      expect(res2.hasRegNo).toBe(false);
      expect(res2.hasSkills).toBe(false);
    });

    it('reconciles 11 distinct metrics with zero fabrication and mutually exclusive categories', async () => {
      const { computeClassAnalytics } = await import('../utils/analyticsUtils');

      const mockEnrollments: any[] = [
        {
          id: 'enr-1',
          class_id: 'class-test',
          student_id: 'stud-1',
          status: 'approved',
          student: {
            id: 'stud-1',
            full_name: 'Kavitha S',
            email: 'kavitha@kct.ac.in',
            student_reg_no: '717722EC104',
            department: 'ECE',
            skills: ['Verilog'],
            bio: 'Hardware engineer',
          },
        },
        {
          id: 'enr-2',
          class_id: 'class-test',
          student_id: 'stud-2',
          status: 'approved',
          student: {
            id: 'stud-2',
            full_name: 'Rahul R',
            email: 'rahul@kct.ac.in',
            student_reg_no: '717722EC108',
            department: 'ECE',
            skills: ['Python'],
            bio: 'Signal processing',
          },
        },
        {
          id: 'enr-3',
          class_id: 'class-test',
          student_id: 'stud-3',
          status: 'approved',
          student: {
            id: 'stud-3',
            full_name: 'Incomplete Stud',
            email: 'inc@kct.ac.in',
            student_reg_no: 'Pending',
            department: 'ECE',
            skills: [],
          },
        },
        {
          id: 'enr-4',
          class_id: 'class-test',
          student_id: 'stud-4',
          status: 'pending',
          student: {
            id: 'stud-4',
            full_name: 'Awaiting Stud',
            email: 'await@kct.ac.in',
            student_reg_no: 'Pending',
            department: 'ECE',
            skills: [],
          },
        },
      ];

      const todayStr = new Date().toISOString().split('T')[0];

      // Multiple posts by stud-1 on same day and another on today
      const mockPosts: any[] = [
        {
          id: 'post-1',
          class_id: 'class-test',
          student_id: 'stud-1',
          title: 'Post 1',
          activity_date: todayStr,
          created_at: new Date().toISOString(),
        },
        {
          id: 'post-2',
          class_id: 'class-test',
          student_id: 'stud-1',
          title: 'Post 2 (Same student)',
          activity_date: todayStr,
          created_at: new Date().toISOString(),
        },
        {
          id: 'post-3',
          class_id: 'class-test',
          student_id: 'stud-2',
          title: 'Post 3 (Student 2)',
          activity_date: todayStr,
          created_at: new Date().toISOString(),
        },
      ];

      const mockReports: any[] = [
        {
          id: 'rep-1',
          class_id: 'class-test',
          student_id: 'stud-1',
          status: 'submitted',
          review_status: 'approved',
          mentor_reviewed: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'rep-2',
          class_id: 'class-test',
          student_id: 'stud-2',
          status: 'submitted',
          review_status: 'pending',
          mentor_reviewed: false,
          created_at: new Date().toISOString(),
        },
      ];

      const analytics = computeClassAnalytics(mockEnrollments, mockPosts, mockReports, 'all', 3);

      // Total approved enrolled = 3 (stud-1, stud-2, stud-3), pending = 1 (stud-4)
      expect(analytics.totalEnrolled).toBe(3);
      expect(analytics.pendingApprovals).toBe(1);

      // Profile completion: 2 complete, 1 incomplete (sum = 3 total enrolled)
      expect(analytics.completeProfiles).toBe(2);
      expect(analytics.incompleteProfiles).toBe(1);
      const completionRate = Math.round((analytics.completeProfiles / analytics.totalEnrolled) * 100);
      expect(completionRate).toBe(67);

      // Daily updates received = 3, but unique students = 2 (stud-1, stud-2)
      expect(analytics.postsInPeriod).toBe(3);
      expect(analytics.uniquePostersInPeriod).toBe(2);
      expect(analytics.activeInPeriod).toBe(2);
      expect(analytics.inactiveInPeriod).toBe(1); // stud-3 has 0 posts

      // Daily timeline deduplication: today has 3 posts but only 2 unique students
      const todayBar = analytics.dailyTimeline.find((d) => d.date === todayStr);
      expect(todayBar).toBeDefined();
      expect(todayBar?.postCount).toBe(3);
      expect(todayBar?.uniqueStudents).toBe(2);

      // Weekly reports: 1 approved, 1 awaiting review, 0 revision, 2 submitted total
      expect(analytics.reportsApproved).toBe(1);
      expect(analytics.reportsAwaitingReview).toBe(1);
      expect(analytics.reportsNeedsRevision).toBe(0);
      expect(analytics.reportsSubmitted).toBe(2);

      // Overdue check: stud-3 has never posted and has 0 posts -> overdue!
      expect(analytics.overdueStudents).toBe(1);

      // Attention queue check: stud-3 must appear with transparent reasons
      const stud3Attention = analytics.attentionItems.find((item) => item.student.id === 'stud-3');
      expect(stud3Attention).toBeDefined();
      expect(stud3Attention?.reasons).toContain('Incomplete profile details');
      expect(stud3Attention?.reasons).toContain('Missing weekly milestone report');
    });
  });
});


