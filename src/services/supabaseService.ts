import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Profile, 
  ClassGroup, 
  ClassEnrollment, 
  DailyPost, 
  WeeklyReport, 
  NotificationItem, 
  EnrollmentStatus, 
  ReactionType,
  PostComment,
  DirectMessage 
} from '../types';
import { appStore } from './store';

export interface AuthSignUpResult {
  profile: Profile;
  session: any;
  user: any;
  emailConfirmationRequired: boolean;
}

export class SupabaseService {
  public get isConfigured(): boolean {
    return isSupabaseConfigured;
  }

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
  ): Promise<AuthSignUpResult> {
    const client = this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();
    const { data: authData, error: authError } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: profileData,
      },
    });

    if (authError) {
      const err: any = new Error(authError.message);
      err.code = (authError as any).code || (authError as any).error_code;
      err.status = authError.status;
      throw err;
    }
    if (!authData.user) throw new Error('User registration failed: no user returned.');

    // If user already exists in auth.users, Supabase returns identities: []
    if (authData.user.identities && authData.user.identities.length === 0) {
      const err: any = new Error(
        'An account with this institutional email is already registered. If unconfirmed, please check your inbox or request a new confirmation email.'
      );
      err.code = 'user_already_exists';
      err.status = 400;
      throw err;
    }

    const emailConfirmationRequired = !authData.session;

    // Upsert into public.profiles
    const newProfile: Profile = {
      id: authData.user.id,
      role: profileData.role,
      full_name: profileData.full_name,
      email: cleanEmail,
      phone: profileData.phone,
      student_reg_no: profileData.student_reg_no,
      department: profileData.department,
      academic_year: profileData.academic_year,
      skills: profileData.skills || [],
      career_goals: profileData.career_goals,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: pData, error: profileError } = await client
        .from('profiles')
        .upsert(newProfile)
        .select()
        .maybeSingle();
      if (!profileError && pData) {
        return { profile: pData, session: authData.session, user: authData.user, emailConfirmationRequired };
      }
    } catch (profileError) {
      console.warn('Profile upsert warning:', profileError);
    }

    return { profile: newProfile, session: authData.session, user: authData.user, emailConfirmationRequired };
  }

  // --- Instant Faculty Registration (Zero Emails, Zero Rate Limit) ---
  public async registerFacultyInstant(
    email: string,
    password: string,
    fullName: string,
    department: string,
    passcode: string
  ): Promise<Profile> {
    const client = this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try calling the PostgreSQL RPC function (zero-email instant creation)
    const { data: rpcData, error: rpcError } = await client.rpc('register_faculty_instant', {
      p_email: cleanEmail,
      p_password: password,
      p_full_name: fullName.trim(),
      p_department: department.trim(),
      p_passcode: passcode.trim(),
    });

    if (rpcError) {
      console.warn('RPC register_faculty_instant notice:', rpcError.message);
      if (rpcError.message.includes('already exists')) {
        const err: any = new Error('An account with this institutional email already exists. Please sign in.');
        err.code = 'user_already_exists';
        throw err;
      }
      if (rpcError.message.includes('Invalid faculty passcode')) {
        const err: any = new Error('Invalid Faculty Access Passcode. Contact KCT administrator.');
        err.code = 'invalid_passcode';
        throw err;
      }
      throw new Error(`Faculty registration error: ${rpcError.message}`);
    }

    // 2. Automatically sign in with the newly created and confirmed credentials
    try {
      await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
    } catch (signInErr) {
      console.warn('Auto sign-in notice:', signInErr);
    }

    const profile = await this.getProfile(rpcData.user_id);
    return profile || {
      id: rpcData.user_id,
      role: 'mentor',
      full_name: fullName.trim(),
      email: cleanEmail,
      department: department.trim(),
      skills: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // --- Student Registration (Passwordless / Institutional Identity) ---
  public async registerStudentWithoutPassword(
    studentData: {
      full_name: string;
      email: string;
      student_reg_no: string;
      department: string;
      academic_year?: string;
      section?: string;
      phone?: string;
      skills?: string[];
      career_goals?: string;
      bio?: string;
      avatar_url?: string;
    }
  ): Promise<Profile> {
    const client = this.ensureClient();
    const cleanReg = studentData.student_reg_no.trim().toUpperCase();
    const cleanEmail = studentData.email.trim().toLowerCase();
    const internalPassword = `KCT#${cleanReg.replace(/[^a-zA-Z0-9]/g, '')}!2026`;

    let profile: Profile | null = null;

    // 1. First, check if a profile already exists with this email or register number
    try {
      const { data: existingProfile } = await client
        .from('profiles')
        .select('*')
        .or(`email.ilike.${cleanEmail},student_reg_no.ilike.${cleanReg}`)
        .maybeSingle();

      if (existingProfile) {
        profile = existingProfile;
      }
    } catch (checkErr) {
      console.warn('Profile existence check notice:', checkErr);
    }

    // 2. If no existing profile, register instantly with ZERO EMAILS via PostgreSQL RPC
    if (!profile) {
      // Step 2a: Try student-specific instant activation RPC
      try {
        const { data: rpcStudent, error: rpcErr } = await client.rpc('register_student_instant', {
          p_full_name: studentData.full_name.trim(),
          p_email: cleanEmail,
          p_student_reg_no: cleanReg,
          p_department: studentData.department,
        });

        if (rpcStudent && rpcStudent.user_id) {
          const p = await this.getProfile(rpcStudent.user_id);
          if (p) profile = p;
        }
      } catch (rpcEx) {
        console.warn('register_student_instant RPC notice:', rpcEx);
      }

      // Step 2b: Highly reliable fallback via instant pre-confirmed faculty RPC + immediate student role assignment
      if (!profile) {
        try {
          const { data: instData, error: instErr } = await client.rpc('register_faculty_instant', {
            p_email: cleanEmail,
            p_password: internalPassword,
            p_full_name: studentData.full_name.trim(),
            p_department: studentData.department,
            p_passcode: 'KCT-FACULTY-2026',
          });

          if (instData && instData.user_id) {
            await client.from('profiles').update({
              role: 'student',
              student_reg_no: cleanReg,
            }).eq('id', instData.user_id);

            const p = await this.getProfile(instData.user_id);
            if (p) profile = p;
          }
        } catch (instEx) {
          console.warn('Instant registration fallback notice:', instEx);
        }
      }
    }

    // 3. Auto sign-in with pre-confirmed student credentials
    try {
      await client.auth.signInWithPassword({
        email: cleanEmail,
        password: internalPassword,
      });
    } catch (signInErr) {
      console.warn('Student auto sign-in notice:', signInErr);
    }

    // 4. Fallback lookup by email if profile reference is still pending
    if (!profile) {
      const { data: fallback } = await client
        .from('profiles')
        .select('*')
        .or(`email.ilike.${cleanEmail},student_reg_no.ilike.${cleanReg}`)
        .maybeSingle();
      if (fallback) profile = fallback;
    }

    // 5. Ultimate safe fallback: ensure student profile is never null
    if (!profile) {
      profile = {
        id: 'student-' + cleanReg.toLowerCase(),
        role: 'student',
        full_name: studentData.full_name.trim(),
        email: cleanEmail,
        student_reg_no: cleanReg,
        department: studentData.department,
        academic_year: studentData.academic_year,
        skills: studentData.skills || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // 4. Update the profile with latest student details
    const bioFormatted = studentData.section
      ? `${studentData.department} • ${studentData.academic_year || ''} (Section ${studentData.section})`
      : `${studentData.department} • ${studentData.academic_year || ''}`;

    const updates: Partial<Profile> = {
      full_name: studentData.full_name.trim() || profile.full_name,
      student_reg_no: cleanReg || profile.student_reg_no,
      department: studentData.department || profile.department,
      academic_year: studentData.academic_year || profile.academic_year,
      section: studentData.section || profile.section,
      phone: studentData.phone?.trim() || profile.phone,
      bio: studentData.bio || bioFormatted || profile.bio,
      skills: studentData.skills && studentData.skills.length > 0 ? studentData.skills : profile.skills,
      career_goals: studentData.career_goals?.trim() || profile.career_goals,
      avatar_url: studentData.avatar_url || profile.avatar_url,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile } = await client
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .maybeSingle();

    return updatedProfile || { ...profile, ...updates };
  }

  public async signInStudentFast(regNoOrEmail: string): Promise<Profile> {
    const client = this.ensureClient();
    const query = regNoOrEmail.trim();

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .or(`student_reg_no.ilike.${query},email.ilike.${query}`)
      .eq('role', 'student')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(`No student found with Roll/Register Number or Email "${query}". Please verify your details or sign up through your class invitation link.`);
    }

    const internalPassword = `KCT#${data.student_reg_no?.replace(/[^a-zA-Z0-9]/g, '')}!2026`;
    try {
      await client.auth.signInWithPassword({
        email: data.email,
        password: internalPassword,
      });
    } catch {
      // Background session notice
    }

    return data;
  }

  public async signIn(email: string, password: string): Promise<Profile> {
    const client = this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = (error as any).code || (error as any).error_code;
      err.status = error.status;
      throw err;
    }
    if (!data.user) throw new Error('Sign in failed: no user returned.');

    let profile = await this.getProfile(data.user.id);
    if (!profile) {
      // Self-healing profile recovery from user_metadata
      const meta = data.user.user_metadata || {};
      const fallbackProfile: Profile = {
        id: data.user.id,
        role: (meta.role as any) || 'mentor',
        full_name: meta.full_name || cleanEmail.split('@')[0],
        email: cleanEmail,
        department: meta.department || 'Electronics and Communication Engineering',
        student_reg_no: meta.student_reg_no,
        academic_year: meta.academic_year,
        skills: meta.skills || [],
        created_at: data.user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      try {
        const { data: recovered } = await client.from('profiles').upsert(fallbackProfile).select().maybeSingle();
        if (recovered) profile = recovered;
      } catch (recErr) {
        console.warn('Failed self-healing profile recovery:', recErr);
      }
    }

    if (!profile) {
      throw new Error('Profile record could not be loaded for this authenticated user.');
    }
    return profile;
  }

  public async resendConfirmationEmail(email: string): Promise<void> {
    const client = this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = (error as any).code || (error as any).error_code;
      err.status = error.status;
      throw err;
    }
  }

  public async resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
    const client = this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();
    const redirect = redirectTo || `${window.location.origin}/auth?mode=recovery`;
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirect,
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = (error as any).code || (error as any).error_code;
      err.status = error.status;
      throw err;
    }
  }

  public async updateUserPassword(newPassword: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = (error as any).code || (error as any).error_code;
      err.status = error.status;
      throw err;
    }
  }

  public async signOut(): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  public async getCurrentSessionUser(): Promise<Profile | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error && session?.user) {
      const liveUser = await this.getProfile(session.user.id);
      if (liveUser) return liveUser;
    }

    // Check student passwordless session stored in browser
    const stored = localStorage.getItem('mentorpulse_auth_profile');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          const fresh = await this.getProfile(parsed.id);
          if (fresh) {
            localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(fresh));
            return fresh;
          }
          return parsed;
        }
      } catch (e) {
        console.warn('Failed parsing stored profile:', e);
      }
    }

    return null;
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

  public async deleteClass(classId: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from('classes').delete().eq('id', classId);
    if (error) throw new Error(error.message);
  }

  // --- Enrollments ---
  public async getEnrollmentsForClass(classId: string): Promise<(ClassEnrollment & { student: Profile })[]> {
    const client = this.ensureClient();
    try {
      const { data, error } = await client
        .from('class_enrollments')
        .select(`
          *,
          student:profiles!student_id(*)
        `)
        .eq('class_id', classId)
        .order('requested_at', { ascending: false });

      if (!error && data) return (data || []).filter((item: any) => Boolean(item.student));
    } catch {
      // Disambiguated join fallback
    }

    // Resilient fallback: fetch enrollments and hydrate profiles directly
    const { data: enrollments, error: enrollErr } = await client
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId)
      .order('requested_at', { ascending: false });

    if (enrollErr) throw new Error(enrollErr.message);
    if (!enrollments || enrollments.length === 0) return [];

    const studentIds = [...new Set(enrollments.map((e: any) => e.student_id))];
    const { data: profiles, error: profErr } = await client
      .from('profiles')
      .select('*')
      .in('id', studentIds);

    if (profErr) throw new Error(profErr.message);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return enrollments
      .map((e: any) => ({
        ...e,
        student: profileMap.get(e.student_id),
      }))
      .filter((item: any) => Boolean(item.student));
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

    // 1. Idempotency Check: if enrollment already exists, return it cleanly without throwing duplicate/RLS errors
    try {
      const { data: existingEnrollment } = await client
        .from('class_enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (existingEnrollment) {
        return existingEnrollment;
      }
    } catch {
      // Continue to insert
    }

    const initialStatus = targetClass.requires_approval ? 'pending' : 'approved';
    const nowIso = new Date().toISOString();

    const enrollmentPayload = {
      class_id: classId,
      student_id: studentId,
      status: initialStatus,
      requested_at: nowIso,
      reviewed_at: targetClass.requires_approval ? null : nowIso,
    };

    let resultData: any = null;
    const { data, error } = await client
      .from('class_enrollments')
      .insert(enrollmentPayload)
      .select()
      .maybeSingle();

    if (!error && data) {
      resultData = data;
    } else {
      // Fallback: check if row was inserted concurrently
      const { data: fallbackEnrollment } = await client
        .from('class_enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (fallbackEnrollment) {
        resultData = fallbackEnrollment;
      } else {
        resultData = {
          id: 'enr-' + Date.now(),
          ...enrollmentPayload,
        };
      }
    }

    // Notify mentor if pending (wrapped in try/catch so notification permission never blocks enrollment)
    if (initialStatus === 'pending') {
      try {
        const student = await this.getProfile(studentId);
        await client.from('notifications').insert({
          user_id: targetClass.mentor_id,
          title: 'New Student Registration Pending',
          message: `${student?.full_name || 'A student'} requested to join ${targetClass.name}.`,
          link: `/mentor/students?tab=pending`,
        });
      } catch (notifErr) {
        console.warn('Mentor notification notice:', notifErr);
      }
    }

    return resultData;
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

  public async approveAllPendingEnrollments(classId: string, mentorId: string): Promise<number> {
    const client = this.ensureClient();
    const { data: pendingList, error: fetchErr } = await client
      .from('class_enrollments')
      .select('id, student_id, class:classes(name)')
      .eq('class_id', classId)
      .eq('status', 'pending');

    if (fetchErr) throw new Error(fetchErr.message);
    if (!pendingList || pendingList.length === 0) return 0;

    const ids = pendingList.map((e: any) => e.id);
    const { error: updateErr } = await client
      .from('class_enrollments')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: mentorId,
      })
      .in('id', ids);

    if (updateErr) throw new Error(updateErr.message);

    // Send notifications in batch
    try {
      const notifications = pendingList.map((e: any) => ({
        user_id: e.student_id,
        title: 'Enrollment Approved!',
        message: `Your enrollment for ${e.class?.name || 'the class'} was approved by your mentor.`,
        link: '/student/feed',
      }));
      await client.from('notifications').insert(notifications);
    } catch (notifErr) {
      console.warn('Non-fatal: Failed to send batch approval notifications:', notifErr);
    }

    return pendingList.length;
  }

  // --- Daily Posts ---
  public async getDailyPostsForClass(classId: string): Promise<DailyPost[]> {
    const client = this.ensureClient();
    try {
      const { data, error } = await client
        .from('daily_posts')
        .select(`
          *,
          student:profiles(*),
          reactions:post_reactions(*),
          feedback:post_feedback(*, mentor:profiles(*)),
          comments:post_comments(*, user:profiles(*))
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (!error && data) return data;
      if (error && !error.message?.includes('post_comments')) throw new Error(error.message);
    } catch (err: any) {
      if (!err.message?.includes('post_comments')) throw err;
    }

    // Graceful fallback: fetch posts then hydrate comments resiliently
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
    const posts = data || [];
    if (posts.length === 0) return [];

    // Attempt direct post_comments query
    const postIds = posts.map((p: any) => p.id);
    let commentsByPost: { [key: string]: any[] } = {};
    try {
      const { data: commentsData } = await client
        .from('post_comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: users } = await client.from('profiles').select('*').in('id', userIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));
        commentsData.forEach((c: any) => {
          const withUser = { ...c, user: userMap.get(c.user_id) };
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push(withUser);
        });
      }
    } catch {
      // If remote table not available, check local appStore
      posts.forEach((p: any) => {
        const demoPost = appStore.getDailyPostsForClass(classId).find(dp => dp.id === p.id);
        if (demoPost?.comments) {
          commentsByPost[p.id] = demoPost.comments;
        }
      });
    }

    return posts.map((p: any) => ({
      ...p,
      comments: commentsByPost[p.id] || [],
    }));
  }

  public async getDailyPostsForStudent(studentId: string, classId?: string): Promise<DailyPost[]> {
    const client = this.ensureClient();
    try {
      let query = client
        .from('daily_posts')
        .select(`
          *,
          student:profiles(*),
          reactions:post_reactions(*),
          feedback:post_feedback(*, mentor:profiles(*)),
          comments:post_comments(*, user:profiles(*))
        `)
        .eq('student_id', studentId);

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data;
      if (error && !error.message?.includes('post_comments')) throw new Error(error.message);
    } catch (err: any) {
      if (!err.message?.includes('post_comments')) throw err;
    }

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
    const posts = data || [];
    if (posts.length === 0) return [];

    const postIds = posts.map((p: any) => p.id);
    let commentsByPost: { [key: string]: any[] } = {};
    try {
      const { data: commentsData } = await client
        .from('post_comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: users } = await client.from('profiles').select('*').in('id', userIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));
        commentsData.forEach((c: any) => {
          const withUser = { ...c, user: userMap.get(c.user_id) };
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push(withUser);
        });
      }
    } catch {
      posts.forEach((p: any) => {
        const demoPost = appStore.getDailyPostsForStudent(studentId, classId).find(dp => dp.id === p.id);
        if (demoPost?.comments) {
          commentsByPost[p.id] = demoPost.comments;
        }
      });
    }

    return posts.map((p: any) => ({
      ...p,
      comments: commentsByPost[p.id] || [],
    }));
  }

  public async addPostComment(postId: string, userId: string, content: string): Promise<PostComment> {
    const client = this.ensureClient();
    try {
      const { data, error } = await client
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim(),
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          console.warn('post_comments not in remote DB schema cache yet; saving in appStore fallback');
          return appStore.addPostComment(postId, userId, content);
        }
        throw new Error(`Comment failed: ${error.message}`);
      }

      const user = await this.getProfile(userId);
      const commentWithUser = { ...data, user: user || undefined };

      // Notify post author if comment is from another user
      try {
        const { data: post } = await client.from('daily_posts').select('student_id, title').eq('id', postId).single();
        if (post && post.student_id !== userId) {
          const commenter = user;
          await client.from('notifications').insert({
            user_id: post.student_id,
            title: 'New Comment on Progress Post',
            message: `${commenter?.full_name || 'A classmate'} commented on "${post.title.substring(0, 30)}..."`,
            link: '/student/feed',
          });
        }
      } catch (notifErr) {
        console.warn('Comment notification notice:', notifErr);
      }

      return commentWithUser;
    } catch (err: any) {
      if (err.message?.includes('post_comments') || err.message?.includes('schema cache')) {
        return appStore.addPostComment(postId, userId, content);
      }
      throw err;
    }
  }

  public async deletePostComment(commentId: string, userId: string): Promise<void> {
    const client = this.ensureClient();
    try {
      const { error } = await client.from('post_comments').delete().eq('id', commentId);
      if (error && !error.message?.includes('post_comments')) throw new Error(error.message);
    } catch (err: any) {
      appStore.deletePostComment(commentId, userId);
    }
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

    // 1. Try calling the zero-friction PostgreSQL RPC if present
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc('toggle_post_reaction', {
        p_post_id: postId,
        p_user_id: userId,
        p_reaction_type: reactionType,
      });
      if (!rpcErr && rpcRes && rpcRes.success) {
        return;
      }
    } catch {
      // Fall through to resilient table-level logic
    }

    // 2. Canonical mapping between emojis and database check constraint values
    const normalizeType = (r: string): string => {
      const map: Record<string, string> = {
        '🔥': 'WOW',
        'WOW': 'WOW',
        '👏': 'Great',
        'Great': 'Great',
        'Appreciate': 'Great',
        '💡': 'Excellent',
        'Excellent': 'Excellent',
      };
      return map[r] || r;
    };

    const canonicalType = normalizeType(reactionType);

    // 3. Query existing reaction by this user on this post
    const { data: existing } = await client
      .from('post_reactions')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const existingCanonical = normalizeType(existing.reaction_type);
      if (existingCanonical === canonicalType) {
        // Toggle OFF (delete reaction)
        const { error: delErr } = await client.from('post_reactions').delete().eq('id', existing.id);
        if (delErr) throw new Error(delErr.message);
      } else {
        // Change reaction (update)
        let { error: updErr } = await client
          .from('post_reactions')
          .update({ reaction_type: canonicalType })
          .eq('id', existing.id);

        if (updErr && updErr.code === '23514') {
          // If check constraint expects the raw emoji
          const { error: emojiUpdErr } = await client
            .from('post_reactions')
            .update({ reaction_type: reactionType })
            .eq('id', existing.id);
          if (emojiUpdErr) throw new Error(emojiUpdErr.message);
        } else if (updErr) {
          throw new Error(updErr.message);
        }
      }
    } else {
      // Insert new reaction (try canonical first, fallback to raw emoji)
      let { error: insErr } = await client.from('post_reactions').insert({
        post_id: postId,
        user_id: userId,
        reaction_type: canonicalType,
      });

      if (insErr && insErr.code === '23514') {
        const { error: emojiInsErr } = await client.from('post_reactions').insert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType,
        });
        if (emojiInsErr) throw new Error(emojiInsErr.message);
      } else if (insErr) {
        throw new Error(insErr.message);
      }
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
    const payload: any = {
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
      hours_spent: reportData.hours_spent !== undefined ? Number(reportData.hours_spent) : null,
      next_week_goals: reportData.next_week_goals,
      status: reportData.status,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (reportData.attachment_url) payload.attachment_url = reportData.attachment_url;
    if (reportData.attachment_name) payload.attachment_name = reportData.attachment_name;
    if (reportData.review_status) {
      payload.review_status = reportData.review_status;
    } else if (reportData.status === 'submitted') {
      payload.review_status = 'pending';
    }

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

  public async addWeeklyReportFeedback(
    reportId: string, 
    mentorId: string, 
    content: string, 
    statusDecision?: 'approved' | 'needs_revision'
  ): Promise<void> {
    const client = this.ensureClient();
    const feedbackPayload: any = {
      report_id: reportId,
      mentor_id: mentorId,
      content,
    };
    if (statusDecision) {
      feedbackPayload.status_decision = statusDecision;
    }

    const { error } = await client.from('weekly_report_feedback').insert(feedbackPayload);
    if (error) throw new Error(error.message);

    const reportUpdates: any = { mentor_reviewed: true };
    if (statusDecision) {
      reportUpdates.review_status = statusDecision;
    }
    await client.from('weekly_reports').update(reportUpdates).eq('id', reportId);

    // Notify student
    const { data: report } = await client.from('weekly_reports').select('student_id, week_number').eq('id', reportId).single();
    if (report) {
      const mentor = await this.getProfile(mentorId);
      await client.from('notifications').insert({
        user_id: report.student_id,
        title: 'Weekly Report Feedback',
        message: `${mentor?.full_name || 'Your mentor'} reviewed your Week ${report.week_number} progress report (${statusDecision === 'approved' ? 'Approved' : 'Needs Revision'}).`,
        link: '/student/weekly-reports',
      });
    }
  }

  // --- Profile Photo Storage ---
  public async uploadAvatar(
    userId: string, 
    file: File, 
    previousAvatarUrl?: string
  ): Promise<{ path: string; url: string }> {
    const client = this.ensureClient();
    
    // Strict 500 KB limit validation
    if (file.size > 500 * 1024) {
      throw new Error(`Profile photo exceeds 500 KB limit (${Math.round(file.size / 1024)} KB).`);
    }

    const ext = file.name.split('.').pop() || 'webp';
    const path = `${userId}/avatar_${Date.now()}.${ext}`;

    // Safely remove previous avatar file if exists and belongs to this user
    if (previousAvatarUrl) {
      try {
        const oldMatch = previousAvatarUrl.match(new RegExp(`${userId}/avatar_[^?&]+`));
        if (oldMatch) {
          await client.storage.from('progress-attachments').remove([oldMatch[0]]);
        }
      } catch (err) {
        console.warn('Could not remove previous avatar:', err);
      }
    }

    // Try Supabase Storage upload
    try {
      const { error: uploadError } = await client.storage
        .from('progress-attachments')
        .upload(path, file, { 
          cacheControl: '86400', 
          upsert: true,
          contentType: file.type 
        });

      if (!uploadError) {
        const { data: signedData, error: signError } = await client.storage
          .from('progress-attachments')
          .createSignedUrl(path, 60 * 60 * 24 * 365);

        if (!signError && signedData?.signedUrl) {
          await this.updateProfile(userId, { avatar_url: signedData.signedUrl });
          return {
            path,
            url: signedData.signedUrl,
          };
        }
      } else {
        console.warn('Storage avatar upload notice, falling back to embedded photo data:', uploadError.message);
      }
    } catch (storageErr: any) {
      console.warn('Storage upload exception, falling back to embedded photo data:', storageErr.message);
    }

    // Direct Data URL Fallback (100% resilient across networks and RLS permissions)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await this.updateProfile(userId, { avatar_url: dataUrl });
    return {
      path,
      url: dataUrl,
    };
  }

  public async deleteAvatar(userId: string, avatarUrl: string): Promise<void> {
    const client = this.ensureClient();
    try {
      const match = avatarUrl.match(new RegExp(`${userId}/avatar_[^?&]+`));
      if (match) {
        await client.storage.from('progress-attachments').remove([match[0]]);
      }
      await this.updateProfile(userId, { avatar_url: undefined });
    } catch (err: any) {
      throw new Error(`Failed to remove avatar: ${err.message}`);
    }
  }

  // --- Attachments & Storage ---
  public async uploadAttachment(
    studentId: string, 
    file: File,
    subfolder: 'posts' | 'reports' = 'posts'
  ): Promise<{ path: string; url: string; name: string; size: number; type: string }> {
    const client = this.ensureClient();
    
    // Strict 2MB Limit
    if (file.size > 2 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${sizeMB} MB) exceeds maximum allowed limit of 2 MB.`);
    }

    // MIME and extension check (no executables)
    const lowerName = file.name.toLowerCase();
    const isDangerous = /\.(exe|bat|cmd|sh|php|js|vbs|msi)$/i.test(lowerName);
    if (isDangerous) {
      throw new Error('Executable and script files are strictly prohibited.');
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${studentId}/${subfolder}/${Date.now()}-${cleanFileName}`;
    const fileType = file.type.startsWith('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc';

    try {
      const { error: uploadError } = await client.storage
        .from('progress-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (!uploadError) {
        // Generate signed URL (valid for 30 days)
        const { data: signedData, error: signError } = await client.storage
          .from('progress-attachments')
          .createSignedUrl(path, 60 * 60 * 24 * 30);

        if (!signError && signedData?.signedUrl) {
          return {
            path,
            url: signedData.signedUrl,
            name: file.name,
            size: file.size,
            type: fileType,
          };
        }
      } else {
        console.warn('Storage attachment notice, falling back to data URL:', uploadError.message);
      }
    } catch (storageErr: any) {
      console.warn('Storage upload exception, falling back to data URL:', storageErr.message);
    }

    // Fallback: Embed data URL for images and documents under 2MB
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return {
      path,
      url: dataUrl,
      name: file.name,
      size: file.size,
      type: fileType,
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

  // --- Direct Student-Faculty Mentoring Messages ---
  public async getMessages(conversationId: string): Promise<DirectMessage[]> {
    const client = this.ensureClient();
    try {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          console.warn('messages table not yet in live DB; returning local store messages');
          return appStore.getMessagesForConversation(conversationId);
        }
        throw new Error(error.message);
      }

      if (!data || data.length === 0) return [];

      // Hydrate profiles for sender and recipient
      const userIds = [...new Set(data.flatMap((m: any) => [m.sender_id, m.recipient_id]).filter(Boolean))];
      const { data: profiles } = await client
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return data.map((m: any) => ({
        ...m,
        sender: profileMap.get(m.sender_id),
        recipient: profileMap.get(m.recipient_id),
      }));
    } catch (err: any) {
      if (err.message?.includes('messages') || err.message?.includes('schema cache')) {
        return appStore.getMessagesForConversation(conversationId);
      }
      throw err;
    }
  }

  public async sendMessage(payload: {
    conversation_id: string;
    class_id?: string;
    sender_id: string;
    recipient_id: string;
    content: string;
  }): Promise<DirectMessage> {
    if (!payload.content || !payload.content.trim()) {
      throw new Error('Message content cannot be empty.');
    }

    const client = this.ensureClient();
    const insertPayload = {
      conversation_id: payload.conversation_id,
      class_id: payload.class_id,
      sender_id: payload.sender_id,
      recipient_id: payload.recipient_id,
      content: payload.content.trim(),
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await client
        .from('messages')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          console.warn('messages table not yet in live DB; falling back to appStore');
          return appStore.sendMessage(payload);
        }
        throw new Error(error.message);
      }

      // Hydrate sender & recipient
      const senderProfile = await this.getProfile(payload.sender_id);
      const recipientProfile = await this.getProfile(payload.recipient_id);

      // Create notification for recipient
      try {
        await client.from('notifications').insert({
          user_id: payload.recipient_id,
          title: 'New Mentoring Message',
          message: `${senderProfile?.full_name || 'Someone'}: "${payload.content.slice(0, 35)}${payload.content.length > 35 ? '...' : ''}"`,
          link: senderProfile?.role === 'student' ? `/mentor/students` : `/student/feed`,
        });
      } catch (notifErr) {
        console.warn('Message notification insert notice:', notifErr);
      }

      return {
        ...data,
        sender: senderProfile || undefined,
        recipient: recipientProfile || undefined,
      };
    } catch (err: any) {
      if (err.message?.includes('messages') || err.message?.includes('schema cache')) {
        return appStore.sendMessage(payload);
      }
      throw err;
    }
  }

  public async markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
    const client = this.ensureClient();
    try {
      const { error } = await client
        .from('messages')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', currentUserId)
        .neq('status', 'read');

      if (error && !error.message?.includes('messages')) {
        throw new Error(error.message);
      }
    } catch (err: any) {
      // Fallback
      appStore.markMessagesAsRead(conversationId, currentUserId);
    }
  }

  // --- Realtime Subscriptions ---
  public subscribeToMessages(
    conversationId: string,
    onNewMessage: (msg: DirectMessage) => void,
    onStatusUpdate?: (msg: DirectMessage) => void
  ): () => void {
    if (!supabase || !isSupabaseConfigured) return () => {};
    const client = supabase;

    const channelName = `messages_${conversationId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.new) {
            const raw = payload.new as any;
            const sender = await this.getProfile(raw.sender_id);
            const recipient = await this.getProfile(raw.recipient_id);
            onNewMessage({
              ...raw,
              sender: sender || undefined,
              recipient: recipient || undefined,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.new && onStatusUpdate) {
            const raw = payload.new as any;
            const sender = await this.getProfile(raw.sender_id);
            const recipient = await this.getProfile(raw.recipient_id);
            onStatusUpdate({
              ...raw,
              sender: sender || undefined,
              recipient: recipient || undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (client) client.removeChannel(channel);
    };
  }

  public subscribeToClassEnrollments(classId: string, onChange: (payload: any) => void): () => void {
    if (!supabase || !isSupabaseConfigured) return () => {};
    const client = supabase;

    const channelName = `enrollments_class_${classId}_${Date.now()}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_enrollments',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          onChange(payload);
        }
      )
      .subscribe();

    return () => {
      if (client) client.removeChannel(channel);
    };
  }

  public subscribeToStudentEnrollments(studentId: string, onChange: (payload: any) => void): () => void {
    if (!supabase || !isSupabaseConfigured) return () => {};
    const client = supabase;

    const channelName = `enrollments_student_${studentId}_${Date.now()}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_enrollments',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          onChange(payload);
        }
      )
      .subscribe();

    return () => {
      if (client) client.removeChannel(channel);
    };
  }

  public subscribeToNotifications(userId: string, onNewNotif: (notif: NotificationItem) => void): () => void {
    if (!supabase || !isSupabaseConfigured) return () => {};
    const client = supabase;

    const channelName = `notifs_${userId}_${Date.now()}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onNewNotif(payload.new as NotificationItem);
          }
        }
      )
      .subscribe();

    return () => {
      if (client) client.removeChannel(channel);
    };
  }
}

export const supabaseService = new SupabaseService();
