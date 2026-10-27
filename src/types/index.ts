export type UserRole = 'mentor' | 'student' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url?: string;
  phone?: string; // Private by default
  student_reg_no?: string; // e.g., 717821ECE045
  department?: string; // e.g., Electronics & Communication Engineering
  academic_year?: string; // e.g., 3rd Year / Semester 5
  bio?: string;
  skills: string[];
  career_goals?: string;
  hobbies?: string;
  created_at: string;
  updated_at: string;
}

export interface ClassGroup {
  id: string;
  mentor_id: string;
  name: string; // e.g., "ECE-A 2023-2027"
  department: string; // e.g., "ECE"
  academic_year: string; // e.g., "2024-2025"
  semester: string; // e.g., "Semester 5"
  description?: string;
  invite_code: string; // Unguessable token
  invite_active: boolean;
  invite_expires_at?: string;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
  // Computed / aggregated
  student_count?: number;
  pending_count?: number;
}

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  status: EnrollmentStatus;
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  student?: Profile;
  class?: ClassGroup;
}

export type ReactionType = 'WOW' | 'Great' | 'Excellent' | 'Appreciate';

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
  user_name?: string;
}

export interface PostFeedback {
  id: string;
  post_id: string;
  mentor_id: string;
  content: string;
  created_at: string;
  mentor?: Profile;
}

export interface DailyPost {
  id: string;
  class_id: string;
  student_id: string;
  category: string; // e.g., "Lab Experiment", "Project", "Coursework", "Certification", "Workshop"
  title: string;
  description: string;
  skills_gained: string[];
  challenges?: string;
  next_steps?: string;
  activity_date: string; // YYYY-MM-DD
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: 'image' | 'pdf' | 'video' | 'doc';
  attachment_size?: number;
  location_name?: string; // e.g., "Campus Lab 304"
  location_coords?: { lat: number; lng: number }; // Consented opt-in only
  created_at: string;
  updated_at: string;
  student?: Profile;
  reactions?: PostReaction[];
  feedback?: PostFeedback[];
}

export interface WeeklyReportFeedback {
  id: string;
  report_id: string;
  mentor_id: string;
  content: string;
  created_at: string;
  mentor?: Profile;
}

export interface WeeklyReport {
  id: string;
  class_id: string;
  student_id: string;
  week_number: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  achievements: string;
  activities_completed: string;
  skills_learned?: string;
  goals_achieved?: string;
  difficulties_faced?: string;
  next_week_goals: string;
  attachment_url?: string;
  attachment_name?: string;
  status: 'draft' | 'submitted';
  submitted_at: string;
  mentor_reviewed: boolean;
  created_at: string;
  updated_at: string;
  student?: Profile;
  feedback?: WeeklyReportFeedback[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}
