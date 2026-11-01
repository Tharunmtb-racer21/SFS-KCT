import {
  Profile,
  ClassGroup,
  ClassEnrollment,
  DailyPost,
  WeeklyReport,
  NotificationItem,
  EnrollmentStatus,
  ReactionType,
  DirectMessage,
  ConversationSummary,
  EnrollmentAuditLog
} from '../types';
import {
  INITIAL_PROFILES,
  INITIAL_CLASSES,
  INITIAL_ENROLLMENTS,
  INITIAL_DAILY_POSTS,
  INITIAL_WEEKLY_REPORTS,
  INITIAL_NOTIFICATIONS
} from './mockData';

const STORAGE_KEYS = {
  PROFILES: 'mentorpulse_profiles_v1',
  CLASSES: 'mentorpulse_classes_v1',
  ENROLLMENTS: 'mentorpulse_enrollments_v1',
  DAILY_POSTS: 'mentorpulse_daily_posts_v1',
  WEEKLY_REPORTS: 'mentorpulse_weekly_reports_v1',
  NOTIFICATIONS: 'mentorpulse_notifications_v1',
  POST_COMMENTS: 'mentorpulse_post_comments_v1',
  MESSAGES: 'mentorpulse_messages_v1',
  CURRENT_USER_ID: 'mentorpulse_current_user_id_v1',
  CURRENT_CLASS_ID: 'mentorpulse_current_class_id_v1',
};

// Safe localStorage load helper
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed reading ${key} from localStorage, using fallback:`, err);
    return fallback;
  }
}

// Safe localStorage save helper
function saveToStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error(`Failed saving ${key} to localStorage:`, err);
  }
}

export class AppDataStore {
  private profiles: Profile[];
  private classes: ClassGroup[];
  private enrollments: ClassEnrollment[];
  private dailyPosts: DailyPost[];
  private weeklyReports: WeeklyReport[];
  private notifications: NotificationItem[];
  private postComments: any[];
  private messages: DirectMessage[];
  private auditLogs: EnrollmentAuditLog[];
  private currentUserId: string;
  private currentClassId: string | null;

  constructor() {
    this.profiles = loadFromStorage(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    this.classes = loadFromStorage(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
    this.enrollments = loadFromStorage(STORAGE_KEYS.ENROLLMENTS, INITIAL_ENROLLMENTS);
    this.dailyPosts = loadFromStorage(STORAGE_KEYS.DAILY_POSTS, INITIAL_DAILY_POSTS);
    this.weeklyReports = loadFromStorage(STORAGE_KEYS.WEEKLY_REPORTS, INITIAL_WEEKLY_REPORTS);
    this.notifications = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    this.postComments = loadFromStorage(STORAGE_KEYS.POST_COMMENTS, []);
    this.messages = loadFromStorage(STORAGE_KEYS.MESSAGES, []);
    this.auditLogs = loadFromStorage('mentorpulse_audit_logs', []);
    this.currentUserId = loadFromStorage(STORAGE_KEYS.CURRENT_USER_ID, 'mentor-1');
    this.currentClassId = loadFromStorage(STORAGE_KEYS.CURRENT_CLASS_ID, 'class-ece-2024');
  }

  // --- Reset to seed data ---
  public resetToSeedData() {
    this.profiles = [...INITIAL_PROFILES];
    this.classes = [...INITIAL_CLASSES];
    this.enrollments = [...INITIAL_ENROLLMENTS];
    this.dailyPosts = [...INITIAL_DAILY_POSTS];
    this.weeklyReports = [...INITIAL_WEEKLY_REPORTS];
    this.notifications = [...INITIAL_NOTIFICATIONS];
    this.postComments = [];
    this.messages = [];
    this.auditLogs = [];
    this.currentUserId = 'mentor-1';
    this.currentClassId = 'class-ece-2024';

    saveToStorage(STORAGE_KEYS.PROFILES, this.profiles);
    saveToStorage(STORAGE_KEYS.CLASSES, this.classes);
    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);
    saveToStorage(STORAGE_KEYS.WEEKLY_REPORTS, this.weeklyReports);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    saveToStorage(STORAGE_KEYS.POST_COMMENTS, this.postComments);
    saveToStorage(STORAGE_KEYS.MESSAGES, this.messages);
    saveToStorage('mentorpulse_audit_logs', this.auditLogs);
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
    saveToStorage(STORAGE_KEYS.CURRENT_CLASS_ID, this.currentClassId);
  }

  // --- Auth & Session ---
  public getCurrentUser(): Profile | null {
    return this.profiles.find((p) => p.id === this.currentUserId) || null;
  }

  public setCurrentUser(userId: string): Profile | null {
    const user = this.profiles.find((p) => p.id === userId);
    if (user) {
      this.currentUserId = user.id;
      saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
      return user;
    }
    return null;
  }

  public registerUser(profileData: Omit<Profile, 'created_at' | 'updated_at'>): Profile {
    const existing = this.profiles.find(p => p.email.toLowerCase() === profileData.email.toLowerCase());
    if (existing) {
      throw new Error('A user with this institutional email already exists.');
    }
    const newProfile: Profile = {
      ...profileData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.profiles.push(newProfile);
    saveToStorage(STORAGE_KEYS.PROFILES, this.profiles);
    this.currentUserId = newProfile.id;
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
    return newProfile;
  }

  public getProfiles(): Profile[] {
    return [...this.profiles];
  }

  public loginUser(emailOrReg: string): Profile | null {
    const clean = emailOrReg.trim().toLowerCase();
    const user = this.profiles.find(
      p => p.email.toLowerCase() === clean || p.student_reg_no?.toLowerCase() === clean
    );
    if (user) {
      this.currentUserId = user.id;
      saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
      return user;
    }
    return null;
  }

  // --- Active Class Navigation ---
  public getSelectedClassId(): string | null {
    return this.currentClassId;
  }

  public setSelectedClassId(classId: string | null): void {
    this.currentClassId = classId;
    saveToStorage(STORAGE_KEYS.CURRENT_CLASS_ID, this.currentClassId);
  }

  // --- Classes CRUD ---
  public getClassesForMentor(mentorId: string): ClassGroup[] {
    return this.classes
      .filter((c) => c.mentor_id === mentorId)
      .map((c) => {
        const approvedCount = this.enrollments.filter(
          (e) => e.class_id === c.id && e.status === 'approved'
        ).length;
        const pendingCount = this.enrollments.filter(
          (e) => e.class_id === c.id && e.status === 'pending'
        ).length;
        return {
          ...c,
          student_count: approvedCount,
          pending_count: pendingCount,
        };
      });
  }

  public getClassById(classId: string): ClassGroup | null {
    const c = this.classes.find((item) => item.id === classId);
    if (!c) return null;
    const approvedCount = this.enrollments.filter(
      (e) => e.class_id === c.id && e.status === 'approved'
    ).length;
    const pendingCount = this.enrollments.filter(
      (e) => e.class_id === c.id && e.status === 'pending'
    ).length;
    return {
      ...c,
      student_count: approvedCount,
      pending_count: pendingCount,
    };
  }

  public getClassByInviteCode(inviteCode: string): ClassGroup | null {
    const c = this.classes.find(
      (item) => item.invite_code === inviteCode && item.invite_active
    );
    if (!c) return null;
    // Check expiration if set
    if (c.invite_expires_at && new Date(c.invite_expires_at) < new Date()) {
      return null;
    }
    return c;
  }

  public createClass(data: {
    mentor_id: string;
    name: string;
    department: string;
    academic_year: string;
    semester: string;
    description?: string;
    requires_approval?: boolean;
    expiresInDays?: number;
  }): ClassGroup {
    const randomHex = Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
      : undefined;

    const newClass: ClassGroup = {
      id: 'class-' + Date.now(),
      mentor_id: data.mentor_id,
      name: data.name,
      department: data.department,
      academic_year: data.academic_year,
      semester: data.semester,
      description: data.description,
      invite_code: randomHex,
      invite_active: true,
      invite_expires_at: expiresAt,
      requires_approval: data.requires_approval ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      student_count: 0,
      pending_count: 0,
    };

    this.classes.push(newClass);
    saveToStorage(STORAGE_KEYS.CLASSES, this.classes);
    this.currentClassId = newClass.id;
    saveToStorage(STORAGE_KEYS.CURRENT_CLASS_ID, this.currentClassId);
    return newClass;
  }

  public updateClass(classId: string, updates: Partial<ClassGroup>): ClassGroup {
    const index = this.classes.findIndex((c) => c.id === classId);
    if (index === -1) throw new Error('Class not found');
    this.classes[index] = {
      ...this.classes[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.CLASSES, this.classes);
    return this.classes[index];
  }

  public regenerateInviteCode(classId: string): string {
    const newCode = Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    this.updateClass(classId, { invite_code: newCode, invite_active: true });
    return newCode;
  }

  public toggleInviteActive(classId: string, active: boolean): void {
    this.updateClass(classId, { invite_active: active });
  }

  public deleteClass(classId: string): void {
    this.classes = this.classes.filter((c) => c.id !== classId);
    this.enrollments = this.enrollments.filter((e) => e.class_id !== classId);
    this.dailyPosts = this.dailyPosts.filter((p) => p.class_id !== classId);
    this.weeklyReports = this.weeklyReports.filter((r) => r.class_id !== classId);
    saveToStorage(STORAGE_KEYS.CLASSES, this.classes);
    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);
    saveToStorage(STORAGE_KEYS.WEEKLY_REPORTS, this.weeklyReports);
    if (this.currentClassId === classId) {
      this.currentClassId = this.classes[0]?.id || null;
      saveToStorage(STORAGE_KEYS.CURRENT_CLASS_ID, this.currentClassId);
    }
  }

  // --- Enrollments ---
  public getEnrollmentsForClass(classId: string): (ClassEnrollment & { student: Profile })[] {
    return this.enrollments
      .filter((e) => e.class_id === classId)
      .map((e) => {
        const student = this.profiles.find((p) => p.id === e.student_id)!;
        return { ...e, student };
      })
      .filter((e) => Boolean(e.student));
  }

  public getEnrollmentsForStudent(studentId: string): (ClassEnrollment & { class: ClassGroup })[] {
    return this.enrollments
      .filter((e) => e.student_id === studentId)
      .map((e) => {
        const c = this.classes.find((cl) => cl.id === e.class_id)!;
        return { ...e, class: c };
      })
      .filter((e) => Boolean(e.class));
  }

  public requestEnrollment(classId: string, studentId: string): ClassEnrollment {
    const targetClass = this.getClassById(classId);
    if (!targetClass) throw new Error('Class does not exist');

    const existing = this.enrollments.find(
      (e) => e.class_id === classId && e.student_id === studentId
    );
    if (existing) {
      if (existing.status === 'approved') return existing;
      if (existing.status === 'pending') return existing;
    }

    const newEnrollment: ClassEnrollment = {
      id: 'enroll-' + Date.now(),
      class_id: classId,
      student_id: studentId,
      status: targetClass.requires_approval ? 'pending' : 'approved',
      requested_at: new Date().toISOString(),
      reviewed_at: targetClass.requires_approval ? undefined : new Date().toISOString(),
    };

    if (existing) {
      const idx = this.enrollments.findIndex(e => e.id === existing.id);
      this.enrollments[idx] = newEnrollment;
    } else {
      this.enrollments.push(newEnrollment);
    }
    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);

    // Notify mentor if pending
    if (newEnrollment.status === 'pending') {
      const student = this.profiles.find(p => p.id === studentId);
      this.notifications.push({
        id: 'notif-' + Date.now(),
        user_id: targetClass.mentor_id,
        title: 'New Enrollment Pending',
        message: `${student?.full_name || 'A student'} requested to join ${targetClass.name}.`,
        link: `/mentor/classes/${classId}?tab=students`,
        read: false,
        created_at: new Date().toISOString(),
      });
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mentorpulse:enrollment_update', { detail: newEnrollment }));
    }

    return newEnrollment;
  }

  public reviewEnrollment(enrollmentId: string, status: EnrollmentStatus, mentorId: string): ClassEnrollment {
    const index = this.enrollments.findIndex((e) => e.id === enrollmentId);
    if (index === -1) throw new Error('Enrollment not found');

    this.enrollments[index] = {
      ...this.enrollments[index],
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: mentorId,
    };
    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);

    // Notify student
    const enrolled = this.enrollments[index];
    const targetClass = this.classes.find(c => c.id === enrolled.class_id);
    this.notifications.push({
      id: 'notif-' + Date.now(),
      user_id: enrolled.student_id,
      title: status === 'approved' ? 'Enrollment Approved!' : 'Enrollment Application Update',
      message: status === 'approved' 
        ? `Your request to join ${targetClass?.name || 'the class'} has been approved by your mentor.`
        : `Your enrollment application for ${targetClass?.name || 'the class'} was declined.`,
      link: status === 'approved' ? '/student/feed' : '/student/classes',
      read: false,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mentorpulse:enrollment_update', { detail: this.enrollments[index] }));
    }

    return this.enrollments[index];
  }

  public removeStudentFromClass(
    classId: string, 
    studentId: string, 
    mentorId: string, 
    reason: string = 'Removed by faculty mentor'
  ): ClassEnrollment {
    const targetClass = this.getClassById(classId);
    if (!targetClass) throw new Error('Class does not exist');

    // Authorization: only authorized mentor of this class or admin can remove
    if (targetClass.mentor_id !== mentorId) {
      const mentorProfile = this.profiles.find((p) => p.id === mentorId);
      if (mentorProfile?.role !== 'admin') {
        throw new Error('Unauthorized: You are not authorized to manage enrollments for this class.');
      }
    }

    const index = this.enrollments.findIndex(
      (e) => e.class_id === classId && e.student_id === studentId
    );
    if (index === -1) throw new Error('Enrollment not found for this student and class.');

    const now = new Date().toISOString();
    this.enrollments[index] = {
      ...this.enrollments[index],
      status: 'removed',
      reviewed_by: mentorId,
      reviewed_at: now,
    };
    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);

    // Notify student about removal
    this.notifications.push({
      id: 'notif-' + Date.now(),
      user_id: studentId,
      title: 'Class Enrollment Notice',
      message: `You have been removed from ${targetClass.name} by your faculty mentor.`,
      link: '/student/classes',
      read: false,
      created_at: now,
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    // Log audit trail
    const auditEntry: EnrollmentAuditLog = {
      id: 'audit-' + Date.now(),
      class_id: classId,
      student_id: studentId,
      mentor_id: mentorId,
      action: 'removed',
      reason,
      created_at: now,
    };
    this.auditLogs.unshift(auditEntry);
    saveToStorage('mentorpulse_audit_logs', this.auditLogs);

    // Immediate cross-window & reactive update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mentorpulse:enrollment_update', {
          detail: { ...this.enrollments[index], action: 'removed' },
        })
      );
      try {
        localStorage.setItem('mentorpulse_cross_tab_enrollment', Date.now().toString());
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('mentorpulse_enrollment_bus');
          bc.postMessage({ type: 'ENROLLMENT_UPDATE', action: 'removed', time: Date.now() });
          bc.close();
        }
      } catch {}
    }

    return this.enrollments[index];
  }

  public getEnrollmentAuditLogs(classId?: string): EnrollmentAuditLog[] {
    if (classId) return this.auditLogs.filter((a) => a.class_id === classId);
    return [...this.auditLogs];
  }

  public updateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus, mentorId: string = 'mentor-1'): ClassEnrollment {
    return this.reviewEnrollment(enrollmentId, status, mentorId);
  }

  public approveAllPendingEnrollments(classId: string, mentorId: string): number {
    const pending = this.enrollments.filter((e) => e.class_id === classId && e.status === 'pending');
    if (pending.length === 0) return 0;
    const now = new Date().toISOString();
    const targetClass = this.classes.find((c) => c.id === classId);

    pending.forEach((e) => {
      e.status = 'approved';
      e.reviewed_at = now;
      e.reviewed_by = mentorId;
      this.notifications.push({
        id: 'notif-' + Math.random().toString(36).slice(2, 9),
        user_id: e.student_id,
        title: 'Enrollment Approved!',
        message: `Your request to join ${targetClass?.name || 'the class'} has been approved by your mentor.`,
        link: '/student/feed',
        read: false,
        created_at: now,
      });
    });

    saveToStorage(STORAGE_KEYS.ENROLLMENTS, this.enrollments);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mentorpulse:enrollment_update', { detail: { classId, count: pending.length } }));
    }

    return pending.length;
  }

  // --- Profiles & Students ---
  public getProfile(userId: string): Profile | null {
    return this.profiles.find((p) => p.id === userId) || null;
  }

  public updateProfile(userId: string, updates: Partial<Profile>): Profile {
    const index = this.profiles.findIndex((p) => p.id === userId);
    if (index === -1) throw new Error('User not found');
    this.profiles[index] = {
      ...this.profiles[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.PROFILES, this.profiles);
    return this.profiles[index];
  }

  // --- Daily Posts Feed ---
  public getDailyPostsForClass(classId: string): DailyPost[] {
    return this.dailyPosts
      .filter((p) => p.class_id === classId)
      .map((p) => ({
        ...p,
        student: this.profiles.find((s) => s.id === p.student_id),
        comments: this.postComments
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            ...c,
            user: this.profiles.find((u) => u.id === c.user_id),
          }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getDailyPostsForStudent(studentId: string, classId?: string): DailyPost[] {
    return this.dailyPosts
      .filter((p) => p.student_id === studentId && (!classId || p.class_id === classId))
      .map((p) => ({
        ...p,
        student: this.profiles.find((s) => s.id === p.student_id),
        comments: this.postComments
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            ...c,
            user: this.profiles.find((u) => u.id === c.user_id),
          }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public createDailyPost(post: Omit<DailyPost, 'id' | 'created_at' | 'updated_at' | 'reactions' | 'feedback' | 'comments'>): DailyPost {
    const newPost: DailyPost = {
      ...post,
      id: 'post-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reactions: [],
      feedback: [],
      comments: [],
    };
    this.dailyPosts.unshift(newPost);
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);
    return newPost;
  }

  public deleteDailyPost(postId: string, userId: string): void {
    const post = this.dailyPosts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');
    if (post.student_id !== userId) throw new Error('Unauthorized to delete this post');
    this.dailyPosts = this.dailyPosts.filter(p => p.id !== postId);
    this.postComments = this.postComments.filter(c => c.post_id !== postId);
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);
    saveToStorage(STORAGE_KEYS.POST_COMMENTS, this.postComments);
  }

  public reactToPost(postId: string, userId: string, reactionType: ReactionType): DailyPost {
    const postIndex = this.dailyPosts.findIndex((p) => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');

    const post = this.dailyPosts[postIndex];
    const reactions = post.reactions || [];
    const user = this.profiles.find((u) => u.id === userId);

    const existingIdx = reactions.findIndex((r) => r.user_id === userId);
    let shouldNotify = false;
    if (existingIdx !== -1) {
      if (reactions[existingIdx].reaction_type === reactionType) {
        // Toggle off
        reactions.splice(existingIdx, 1);
      } else {
        // Change reaction
        reactions[existingIdx].reaction_type = reactionType;
        reactions[existingIdx].user = user || undefined;
        reactions[existingIdx].user_name = user?.full_name;
        shouldNotify = true;
      }
    } else {
      reactions.push({
        id: 'reaction-' + Date.now(),
        post_id: postId,
        user_id: userId,
        reaction_type: reactionType,
        created_at: new Date().toISOString(),
        user_name: user?.full_name,
        user: user || undefined,
      });
      shouldNotify = true;
    }

    // Notify post author if reaction is added/changed by another user
    if (shouldNotify && post.student_id !== userId) {
      const isFaculty = user?.role === 'mentor' || user?.role === 'admin';
      const notifTitle = isFaculty ? `Faculty Kudos: ${reactionType}` : `New Reaction: ${reactionType}`;
      this.notifications.push({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        user_id: post.student_id,
        title: notifTitle,
        message: `${user?.full_name || 'Someone'} reacted ${reactionType} to "${post.title.substring(0, 30)}..."`,
        link: `/student/feed`,
        read: false,
        created_at: new Date().toISOString(),
      });
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }

    this.dailyPosts[postIndex] = { ...post, reactions };
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);

    // Reactive window and cross-tab delivery
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mentorpulse:reaction_update', {
          detail: { postId, userId, reactionType }
        })
      );
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('mentorpulse_reactions_bus');
          bc.postMessage({ type: 'REACTION_UPDATE', postId, userId, reactionType });
          bc.close();
        }
      } catch {}
    }

    return this.dailyPosts[postIndex];
  }

  public addPostFeedback(postId: string, mentorId: string, content: string): DailyPost {
    const postIndex = this.dailyPosts.findIndex((p) => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');

    const post = this.dailyPosts[postIndex];
    const feedbackList = post.feedback || [];
    const mentor = this.profiles.find((p) => p.id === mentorId);

    feedbackList.push({
      id: 'fb-' + Date.now(),
      post_id: postId,
      mentor_id: mentorId,
      content,
      created_at: new Date().toISOString(),
      mentor,
    });

    this.dailyPosts[postIndex] = { ...post, feedback: feedbackList };
    saveToStorage(STORAGE_KEYS.DAILY_POSTS, this.dailyPosts);

    // Notify student of mentor feedback
    this.notifications.push({
      id: 'notif-' + Date.now(),
      user_id: post.student_id,
      title: 'Mentor Feedback Received',
      message: `${mentor?.full_name || 'Your mentor'} reviewed your post "${post.title.substring(0, 30)}..."`,
      link: `/student/feed`,
      read: false,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    return this.dailyPosts[postIndex];
  }

  public addPostComment(postId: string, userId: string, content: string) {
    const post = this.dailyPosts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');

    const user = this.profiles.find((u) => u.id === userId);
    const newComment = {
      id: 'comm-' + Date.now(),
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      user,
    };

    this.postComments.push(newComment);
    saveToStorage(STORAGE_KEYS.POST_COMMENTS, this.postComments);

    // Notify post author if comment is from another user
    if (post.student_id !== userId) {
      this.notifications.push({
        id: 'notif-' + Date.now(),
        user_id: post.student_id,
        title: 'New Comment on Progress Post',
        message: `${user?.full_name || 'A classmate'} commented on "${post.title.substring(0, 30)}..."`,
        link: `/student/feed`,
        read: false,
        created_at: new Date().toISOString(),
      });
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }

    return newComment;
  }

  public deletePostComment(commentId: string, userId: string): void {
    const comment = this.postComments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found');
    const user = this.profiles.find((u) => u.id === userId);
    if (comment.user_id !== userId && user?.role !== 'mentor') {
      throw new Error('Unauthorized to delete comment');
    }
    this.postComments = this.postComments.filter((c) => c.id !== commentId);
    saveToStorage(STORAGE_KEYS.POST_COMMENTS, this.postComments);
  }

  // --- Weekly Reports ---
  public getWeeklyReportsForClass(classId: string): WeeklyReport[] {
    return this.weeklyReports
      .filter((r) => r.class_id === classId)
      .map((r) => ({
        ...r,
        student: this.profiles.find((s) => s.id === r.student_id),
      }))
      .sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
  }

  public getWeeklyReportsForStudent(studentId: string, classId?: string): WeeklyReport[] {
    return this.weeklyReports
      .filter((r) => r.student_id === studentId && (!classId || r.class_id === classId))
      .map((r) => ({
        ...r,
        student: this.profiles.find((s) => s.id === r.student_id),
      }))
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }

  public saveWeeklyReport(report: Omit<WeeklyReport, 'id' | 'created_at' | 'updated_at' | 'feedback' | 'mentor_reviewed'> & { id?: string }): WeeklyReport {
    const reviewStatus = report.review_status || (report.status === 'submitted' ? 'pending' : undefined);

    if (report.id) {
      const idx = this.weeklyReports.findIndex(r => r.id === report.id);
      if (idx !== -1) {
        this.weeklyReports[idx] = {
          ...this.weeklyReports[idx],
          ...report,
          review_status: reviewStatus || this.weeklyReports[idx].review_status,
          updated_at: new Date().toISOString(),
        };
        saveToStorage(STORAGE_KEYS.WEEKLY_REPORTS, this.weeklyReports);
        return this.weeklyReports[idx];
      }
    }

    const newReport: WeeklyReport = {
      ...report,
      id: 'wrep-' + Date.now(),
      mentor_reviewed: false,
      review_status: reviewStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      feedback: [],
    };
    this.weeklyReports.unshift(newReport);
    saveToStorage(STORAGE_KEYS.WEEKLY_REPORTS, this.weeklyReports);

    // Notify mentor if submitted
    if (newReport.status === 'submitted') {
      const targetClass = this.classes.find(c => c.id === newReport.class_id);
      const student = this.profiles.find(p => p.id === newReport.student_id);
      if (targetClass) {
        this.notifications.push({
          id: 'notif-' + Date.now(),
          user_id: targetClass.mentor_id,
          title: 'Weekly Report Submitted',
          message: `${student?.full_name || 'A student'} submitted Week ${newReport.week_number} report for ${targetClass.name}.`,
          link: `/mentor/classes/${targetClass.id}?tab=weekly-reports`,
          read: false,
          created_at: new Date().toISOString(),
        });
        saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
      }
    }

    return newReport;
  }

  public addWeeklyReportFeedback(
    reportId: string, 
    mentorId: string, 
    content: string, 
    statusDecision?: 'approved' | 'needs_revision'
  ): WeeklyReport {
    const idx = this.weeklyReports.findIndex((r) => r.id === reportId);
    if (idx === -1) throw new Error('Weekly report not found');

    const report = this.weeklyReports[idx];
    const feedbackList = report.feedback || [];
    const mentor = this.profiles.find((p) => p.id === mentorId);

    feedbackList.push({
      id: 'wfb-' + Date.now(),
      report_id: reportId,
      mentor_id: mentorId,
      content,
      status_decision: statusDecision,
      created_at: new Date().toISOString(),
      mentor,
    });

    this.weeklyReports[idx] = {
      ...report,
      mentor_reviewed: true,
      review_status: statusDecision || report.review_status || 'approved',
      feedback: feedbackList,
      updated_at: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.WEEKLY_REPORTS, this.weeklyReports);

    // Notify student
    this.notifications.push({
      id: 'notif-' + Date.now(),
      user_id: report.student_id,
      title: 'Weekly Report Feedback',
      message: `${mentor?.full_name || 'Your mentor'} reviewed your Week ${report.week_number} report (${statusDecision === 'approved' ? 'Approved' : 'Needs Revision'}).`,
      link: `/student/weekly-reports`,
      read: false,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    return this.weeklyReports[idx];
  }

  // --- Notifications ---
  public getNotificationsForUser(userId: string): NotificationItem[] {
    return this.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationAsRead(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (item) {
      item.read = true;
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }
  }

  public markAllNotificationsAsRead(userId: string): void {
    this.notifications.forEach((n) => {
      if (n.user_id === userId) n.read = true;
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
  }

  // --- Direct Mentoring Messages ---
  public getMessagesForConversation(conversationId: string): DirectMessage[] {
    return this.messages
      .filter((m) => m.conversation_id === conversationId)
      .map((m) => ({
        ...m,
        sender: this.profiles.find((p) => p.id === m.sender_id),
        recipient: this.profiles.find((p) => p.id === m.recipient_id),
      }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  public sendMessage(payload: {
    conversation_id: string;
    class_id?: string;
    sender_id: string;
    recipient_id: string;
    content: string;
  }): DirectMessage {
    if (!payload.content || !payload.content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const newMessage: DirectMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      conversation_id: payload.conversation_id,
      class_id: payload.class_id,
      sender_id: payload.sender_id,
      recipient_id: payload.recipient_id,
      content: payload.content.trim(),
      status: 'delivered',
      created_at: new Date().toISOString(),
      read_at: null,
      sender: this.profiles.find((p) => p.id === payload.sender_id),
      recipient: this.profiles.find((p) => p.id === payload.recipient_id),
    };

    this.messages.push(newMessage);
    saveToStorage(STORAGE_KEYS.MESSAGES, this.messages);

    // Create notification for recipient
    const sender = newMessage.sender;
    this.notifications.push({
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user_id: payload.recipient_id,
      title: 'New Mentoring Message',
      message: `${sender?.full_name || 'Sender'}: "${payload.content.slice(0, 35)}${payload.content.length > 35 ? '...' : ''}"`,
      link: '/messages',
      read: false,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, this.notifications);

    // Reactive window and cross-tab delivery
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mentorpulse:new_message', { detail: newMessage })
      );
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('mentorpulse_messages_bus');
          bc.postMessage({ type: 'NEW_MESSAGE', message: newMessage });
          bc.close();
        }
      } catch {}
    }

    return newMessage;
  }

  public markMessagesAsRead(conversationId: string, currentUserId: string): void {
    let changed = false;
    const now = new Date().toISOString();
    this.messages.forEach((m) => {
      if (m.conversation_id === conversationId && m.recipient_id === currentUserId && m.status !== 'read') {
        m.status = 'read';
        m.read_at = now;
        changed = true;
      }
    });
    if (changed) {
      saveToStorage(STORAGE_KEYS.MESSAGES, this.messages);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('mentorpulse:messages_read', { detail: { conversationId, currentUserId } })
        );
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('mentorpulse_messages_bus');
            bc.postMessage({ type: 'MESSAGES_READ', conversationId, currentUserId });
            bc.close();
          }
        } catch {}
      }
    }
  }

  public getUnreadMessagesCount(userId: string): number {
    return this.messages.filter((m) => m.recipient_id === userId && m.status !== 'read').length;
  }

  public getUserConversations(userId: string): ConversationSummary[] {
    const userMessages = this.messages.filter(
      (m) => m.sender_id === userId || m.recipient_id === userId
    );

    const grouped = new Map<string, DirectMessage[]>();
    for (const msg of userMessages) {
      if (!grouped.has(msg.conversation_id)) {
        grouped.set(msg.conversation_id, []);
      }
      grouped.get(msg.conversation_id)!.push(msg);
    }

    const summaries: ConversationSummary[] = [];

    for (const [convId, convMsgs] of grouped.entries()) {
      const sorted = [...convMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sorted[0];
      const otherUserId = lastMessage.sender_id === userId ? lastMessage.recipient_id : lastMessage.sender_id;
      const otherProfile = this.profiles.find((p) => p.id === otherUserId) || {
        id: otherUserId,
        full_name: 'Member',
        email: '',
        role: 'student' as const,
        skills: [],
        created_at: '',
        updated_at: '',
      };

      const classGroup = this.classes.find((c) => c.id === lastMessage.class_id);
      const unreadCount = convMsgs.filter(
        (m) => m.recipient_id === userId && m.status !== 'read'
      ).length;

      summaries.push({
        conversationId: convId,
        classId: lastMessage.class_id || classGroup?.id || '',
        className: classGroup?.name || 'Class Mentoring',
        otherUser: otherProfile,
        lastMessage: {
          ...lastMessage,
          sender: this.profiles.find((p) => p.id === lastMessage.sender_id),
          recipient: this.profiles.find((p) => p.id === lastMessage.recipient_id),
        },
        unreadCount,
      });
    }

    return summaries.sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }

  // --- Safe CSV Export for Mentor ---
  public exportClassRosterCSV(classId: string): string {
    const targetClass = this.getClassById(classId);
    if (!targetClass) throw new Error('Class not found');

    const enrollments = this.getEnrollmentsForClass(classId);
    const headers = [
      'Register Number',
      'Student Name',
      'Institutional Email',
      'Department',
      'Academic Year',
      'Enrollment Status',
      'Total Daily Posts',
      'Weekly Reports Submitted',
      'Top Skills'
    ];

    const rows = enrollments.map((e) => {
      const student = e.student;
      const postCount = this.dailyPosts.filter(
        (p) => p.class_id === classId && p.student_id === student.id
      ).length;
      const reportCount = this.weeklyReports.filter(
        (r) => r.class_id === classId && r.student_id === student.id && r.status === 'submitted'
      ).length;

      return [
        `"${student.student_reg_no || 'N/A'}"`,
        `"${student.full_name}"`,
        `"${student.email}"`,
        `"${student.department || targetClass.department}"`,
        `"${student.academic_year || targetClass.academic_year}"`,
        `"${e.status}"`,
        postCount,
        reportCount,
        `"${(student.skills || []).join('; ')}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

// Global singleton instance
export const appStore = new AppDataStore();
