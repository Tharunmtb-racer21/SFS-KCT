import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Profile, 
  ClassGroup, 
  ClassEnrollment, 
  DailyPost, 
  WeeklyReport, 
  NotificationItem, 
  EnrollmentStatus, 
  ReactionType 
} from '../types';

export class SupabaseService {
  private ensureClient() {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.'
      );
    }
    return supabase;
  }

  // --- Connectivity Test ---
  public async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const client = this.ensureClient();
      const { error } = await client.from('classes').select('id', { count: 'exact', head: true });
      if (error) {
        return { connected: false, message: error.message };
      }
      return { connected: true, message: 'Connected to live Supabase PostgreSQL backend.' };
    } catch (err: any) {
      return { connected: false, message: err.message || 'Unable to connect to Supabase.' };
    }
  }

  // --- Auth & Profile ---
  public async signUp(
    email: string, 
    password: string, 
    profileData: {
      role: 'mentor' | 'student';
      full_name: string;
      student_reg_no?: string;
      department?: string;
      academic_year?: string;
      phone?: string;
      skills?: string[];
      career_goals?: string;
    }
  ): Promise<Profile> {
    const client = this.ensureClient();
    const { data: authData, error: authError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: profileData,
      },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('User registration failed.');

    // Upsert into public.profiles
    const newProfile: Profile = {
      id: authData.user.id,
      role: profileData.role,
      full_name: profileData.full_name,
      email,
      phone: profileData.phone,
      student_reg_no: profileData.student_reg_no,
      department: profileData.department,
      academic_year: profileData.academic_year,
      skills: profileData.skills || [],
      career_goals: profileData.career_goals,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await client.from('profiles').upsert(newProfile);
    if (profileError) {
      console.warn('Profile upsert warning:', profileError);
    }

    return newProfile;
  }

  public async signIn(email: string, password: string): Promise<Profile> {
    const client = this.ensureClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign in failed: no user returned.');

    const profile = await this.getProfile(data.user.id);
    if (!profile) {
      throw new Error('Profile not found in database for this authenticated user.');
    }
    return profile;
  }

  public async signOut(): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  public async getCurrentSessionUser(): Promise<Profile | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    return this.getProfile(session.user.id);
  }

  public async getProfile(userId: string): Promise<Profile | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  public async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // --- Classes CRUD ---
  public async getClassesForMentor(mentorId: string): Promise<ClassGroup[]> {
    const client = this.ensureClient();
    const { data: classesData, error } = await client
      .from('classes')
      .select(`
        *,
        class_enrollments(id, status)
      `)
      .eq('mentor_id', mentorId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (classesData || []).map((c: any) => {
      const enrollments = c.class_enrollments || [];
      const approvedCount = enrollments.filter((e: any) => e.status === 'approved').length;
      const pendingCount = enrollments.filter((e: any) => e.status === 'pending').length;
      return {
        ...c,
        student_count: approvedCount,
        pending_count: pendingCount,
      };
    });
  }

  public async getClassesForStudent(studentId: string): Promise<ClassGroup[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('class_enrollments')
      .select('class:classes(*)')
      .eq('student_id', studentId);

    if (error) throw new Error(error.message);
    return (data || []).map((item: any) => item.class).filter(Boolean);
  }

  public async getClassById(classId: string): Promise<ClassGroup | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('classes')
      .select(`
        *,
        class_enrollments(id, status)
      `)
      .eq('id', classId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const enrollments = data.class_enrollments || [];
    return {
      ...data,
      student_count: enrollments.filter((e: any) => e.status === 'approved').length,
      pending_count: enrollments.filter((e: any) => e.status === 'pending').length,
    };
  }

  public async getClassByInviteCode(inviteCode: string): Promise<ClassGroup | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('classes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('invite_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    // Check expiration if set
    if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
      return null;
    }
    return data;
  }

  public async createClass(data: {
    mentor_id: string;
    name: string;
    department: string;
    academic_year: string;
    semester: string;
    description?: string;
    requires_approval?: boolean;
    expiresInDays?: number;
  }): Promise<ClassGroup> {
    const client = this.ensureClient();
    const randomHex = Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
      : null;

    const payload = {
      mentor_id: data.mentor_id,
      name: data.name,
      department: data.department,
      academic_year: data.academic_year,
      semester: data.semester,
      description: data.description || null,
      invite_code: randomHex,
      invite_active: true,
      invite_expires_at: expiresAt,
      requires_approval: data.requires_approval ?? true,
    };

    const { data: created, error } = await client
      .from('classes')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...created, student_count: 0, pending_count: 0 };
  }

  public async updateClass(classId: string, updates: Partial<ClassGroup>): Promise<ClassGroup> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('classes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', classId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  public async regenerateInviteCode(classId: string): Promise<string> {
    const newCode = Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    await this.updateClass(classId, { invite_code: newCode, invite_active: true });
    return newCode;
  }

  public async toggleInviteActive(classId: string, active: boolean): Promise<void> {
    await this.updateClass(classId, { invite_active: active });
  }

  // --- Enrollments ---
  public async getEnrollmentsForClass(classId: string): Promise<(ClassEnrollment & { student: Profile })[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('class_enrollments')
      .select(`
        *,
        student:profiles(*)
      `)
      .eq('class_id', classId)
      .order('requested_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).filter((item: any) => Boolean(item.student));
  }

  public async getEnrollmentsForStudent(studentId: string): Promise<(ClassEnrollment & { class: ClassGroup })[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('class_enrollments')
      .select(`
        *,
        class:classes(*)
      `)
      .eq('student_id', studentId);

    if (error) throw new Error(error.message);
    return (data || []).filter((item: any) => Boolean(item.class));
  }

  public async requestEnrollment(classId: string, studentId: string): Promise<ClassEnrollment> {
    const client = this.ensureClient();
    const targetClass = await this.getClassById(classId);
    if (!targetClass) throw new Error('Class does not exist.');

    const initialStatus = targetClass.requires_approval ? 'pending' : 'approved';

    const { data, error } = await client
      .from('class_enrollments')
      .upsert({
        class_id: classId,
        student_id: studentId,
        status: initialStatus,
        requested_at: new Date().toISOString(),
        reviewed_at: targetClass.requires_approval ? null : new Date().toISOString(),
      }, { onConflict: 'class_id,student_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Notify mentor if pending
    if (initialStatus === 'pending') {
      const student = await this.getProfile(studentId);
      await client.from('notifications').insert({
        user_id: targetClass.mentor_id,
        title: 'New Student Registration Pending',
        message: `${student?.full_name || 'A student'} requested to join ${targetClass.name}.`,
        link: `/mentor/students?tab=pending`,
      });
    }

    return data;
  }

  public async reviewEnrollment(enrollmentId: string, status: EnrollmentStatus, mentorId: string): Promise<ClassEnrollment> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('class_enrollments')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: mentorId,
      })
      .eq('id', enrollmentId)
      .select('*, class:classes(*)')
      .single();

    if (error) throw new Error(error.message);

    // Notify student
    await client.from('notifications').insert({
      user_id: data.student_id,
      title: status === 'approved' ? 'Enrollment Approved!' : 'Enrollment Application Update',
      message: status === 'approved'
        ? `Your enrollment for ${data.class?.name || 'the class'} was approved by your mentor.`
        : `Your enrollment application for ${data.class?.name || 'the class'} was declined.`,
      link: status === 'approved' ? '/student/feed' : '/student/classes',
    });

    return data;
  }

  // --- Daily Posts ---
  public async getDailyPostsForClass(classId: string): Promise<DailyPost[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('daily_posts')
      .select(`
        *,
        student:profiles(*),
        reactions:post_reactions(*),
        feedback:post_feedback(*, mentor:profiles(*))
      `)
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  public async getDailyPostsForStudent(studentId: string, classId?: string): Promise<DailyPost[]> {
    const client = this.ensureClient();
    let query = client
      .from('daily_posts')
      .select(`
        *,
        student:profiles(*),
        reactions:post_reactions(*),
        feedback:post_feedback(*, mentor:profiles(*))
      `)
      .eq('student_id', studentId);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  public async createDailyPost(postData: Omit<DailyPost, 'id' | 'created_at' | 'updated_at' | 'reactions' | 'feedback'>): Promise<DailyPost> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('daily_posts')
      .insert({
        class_id: postData.class_id,
        student_id: postData.student_id,
        category: postData.category,
        title: postData.title,
        description: postData.description,
        skills_gained: postData.skills_gained || [],
        challenges: postData.challenges || null,
        next_steps: postData.next_steps || null,
        activity_date: postData.activity_date,
        attachment_url: postData.attachment_url || null,
        attachment_name: postData.attachment_name || null,
        attachment_type: postData.attachment_type || null,
        attachment_size: postData.attachment_size || null,
        location_name: postData.location_name || null,
        location_coords: postData.location_coords || null,
      })
      .select(`
        *,
        student:profiles(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return { ...data, reactions: [], feedback: [] };
  }

  public async deleteDailyPost(postId: string, userId: string): Promise<void> {
    const client = this.ensureClient();
    // Database RLS enforces student_id = auth.uid() or mentor_id of class
    const { error } = await client.from('daily_posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
  }

  public async reactToPost(postId: string, userId: string, reactionType: ReactionType): Promise<void> {
    const client = this.ensureClient();
    // Check existing
    const { data: existing } = await client
      .from('post_reactions')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Toggle off
        await client.from('post_reactions').delete().eq('id', existing.id);
      } else {
        // Change reaction
        await client.from('post_reactions').update({ reaction_type: reactionType }).eq('id', existing.id);
      }
    } else {
      // Insert
      const { error } = await client.from('post_reactions').insert({
        post_id: postId,
        user_id: userId,
        reaction_type: reactionType,
      });
      if (error) throw new Error(error.message);
    }
  }

  public async addPostFeedback(postId: string, mentorId: string, content: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from('post_feedback').insert({
      post_id: postId,
      mentor_id: mentorId,
      content,
    });
    if (error) throw new Error(error.message);

    // Notify student
    const { data: post } = await client.from('daily_posts').select('student_id, title').eq('id', postId).single();
    if (post) {
      const mentor = await this.getProfile(mentorId);
      await client.from('notifications').insert({
        user_id: post.student_id,
        title: 'Mentor Feedback Received',
        message: `${mentor?.full_name || 'Your mentor'} reviewed your post "${post.title.substring(0, 30)}..."`,
        link: '/student/feed',
      });
    }
  }

  // --- Weekly Reports ---
  public async getWeeklyReportsForClass(classId: string): Promise<WeeklyReport[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('weekly_reports')
      .select(`
        *,
        student:profiles(*),
        feedback:weekly_report_feedback(*, mentor:profiles(*))
      `)
      .eq('class_id', classId)
      .order('start_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  public async getWeeklyReportsForStudent(studentId: string, classId?: string): Promise<WeeklyReport[]> {
    const client = this.ensureClient();
    let query = client
      .from('weekly_reports')
      .select(`
        *,
        student:profiles(*),
        feedback:weekly_report_feedback(*, mentor:profiles(*))
      `)
      .eq('student_id', studentId);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  public async saveWeeklyReport(reportData: Omit<WeeklyReport, 'id' | 'created_at' | 'updated_at' | 'feedback' | 'mentor_reviewed'> & { id?: string }): Promise<WeeklyReport> {
    const client = this.ensureClient();
    const payload = {
      class_id: reportData.class_id,
      student_id: reportData.student_id,
      week_number: reportData.week_number,
      start_date: reportData.start_date,
      end_date: reportData.end_date,
      achievements: reportData.achievements,
      activities_completed: reportData.activities_completed,
      skills_learned: reportData.skills_learned || null,
      goals_achieved: reportData.goals_achieved || null,
      difficulties_faced: reportData.difficulties_faced || null,
      next_week_goals: reportData.next_week_goals,
      status: reportData.status,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let resultData;
    if (reportData.id) {
      const { data, error } = await client
        .from('weekly_reports')
        .update(payload)
        .eq('id', reportData.id)
        .select('*, student:profiles(*)')
        .single();
      if (error) throw new Error(error.message);
      resultData = data;
    } else {
      const { data, error } = await client
        .from('weekly_reports')
        .insert(payload)
        .select('*, student:profiles(*)')
        .single();
      if (error) throw new Error(error.message);
      resultData = data;
    }

    // Notify mentor if submitted
    if (reportData.status === 'submitted') {
      const targetClass = await this.getClassById(reportData.class_id);
      const student = await this.getProfile(reportData.student_id);
      if (targetClass) {
        await client.from('notifications').insert({
          user_id: targetClass.mentor_id,
          title: 'Weekly Report Submitted',
          message: `${student?.full_name || 'A student'} submitted Week ${reportData.week_number} report for ${targetClass.name}.`,
          link: `/mentor/weekly-reports`,
        });
      }
    }

    return resultData;
  }

  public async addWeeklyReportFeedback(reportId: string, mentorId: string, content: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from('weekly_report_feedback').insert({
      report_id: reportId,
      mentor_id: mentorId,
      content,
    });
    if (error) throw new Error(error.message);

    await client.from('weekly_reports').update({ mentor_reviewed: true }).eq('id', reportId);

    // Notify student
    const { data: report } = await client.from('weekly_reports').select('student_id, week_number').eq('id', reportId).single();
    if (report) {
      const mentor = await this.getProfile(mentorId);
      await client.from('notifications').insert({
        user_id: report.student_id,
        title: 'Weekly Report Feedback',
        message: `${mentor?.full_name || 'Your mentor'} reviewed your Week ${report.week_number} progress report.`,
        link: '/student/weekly-reports',
      });
    }
  }

  // --- Attachments & Storage ---
  public async uploadAttachment(studentId: string, file: File): Promise<{ url: string; name: string; size: number; type: string }> {
    const client = this.ensureClient();
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('File exceeds maximum size limit of 25MB.');
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${studentId}/${Date.now()}-${cleanFileName}`;

    const { error: uploadError } = await client.storage
      .from('progress-attachments')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // Generate signed URL (valid for 7 days)
    const { data: signedData, error: signError } = await client.storage
      .from('progress-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signError || !signedData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signError?.message || 'Unknown storage error'}`);
    }

    return {
      url: signedData.signedUrl,
      name: file.name,
      size: file.size,
      type: file.type.startsWith('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc',
    };
  }

  // --- Notifications ---
  public async getNotifications(userId: string): Promise<NotificationItem[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  public async markNotificationRead(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  public async markAllNotificationsRead(userId: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from('notifications').update({ read: true }).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

export const supabaseService = new SupabaseService();
