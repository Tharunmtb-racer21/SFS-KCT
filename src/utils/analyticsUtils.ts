import { Profile, DailyPost, WeeklyReport, ClassEnrollment } from '../types';

export interface ProfileCompletionCriteria {
  hasName: boolean;
  hasRegNo: boolean;
  hasDept: boolean;
  hasSkills: boolean;
  hasBioOrGoals: boolean;
  hasAvatar: boolean;
  percent: number;
  isComplete: boolean;
}

/**
 * Transparent, deterministic profile evaluation.
 * A student profile is complete when:
 * 1. Full name is present
 * 2. Institutional register number is present & verified
 * 3. Department is present
 * 4. At least one skill is listed
 * 5. Career goals or academic bio is specified
 */
export function evaluateStudentProfile(student: Profile | undefined): ProfileCompletionCriteria {
  if (!student) {
    return {
      hasName: false,
      hasRegNo: false,
      hasDept: false,
      hasSkills: false,
      hasBioOrGoals: false,
      hasAvatar: false,
      percent: 0,
      isComplete: false,
    };
  }

  const hasName = Boolean(student.full_name && student.full_name.trim().length > 0);
  const hasRegNo = Boolean(
    student.student_reg_no && 
    student.student_reg_no.trim().length > 0 && 
    !student.student_reg_no.toLowerCase().includes('pending')
  );
  const hasDept = Boolean(student.department && student.department.trim().length > 0);
  const hasSkills = Boolean(student.skills && student.skills.length > 0);
  const hasBioOrGoals = Boolean(
    (student.career_goals && student.career_goals.trim().length > 0) ||
    (student.bio && student.bio.trim().length > 0)
  );
  const hasAvatar = Boolean(student.avatar_url && student.avatar_url.trim().length > 0);

  const criteriaArray = [hasName, hasRegNo, hasDept, hasSkills, hasBioOrGoals];
  const passedCount = criteriaArray.filter(Boolean).length;
  const percent = Math.round((passedCount / criteriaArray.length) * 100);
  const isComplete = passedCount === criteriaArray.length;

  return {
    hasName,
    hasRegNo,
    hasDept,
    hasSkills,
    hasBioOrGoals,
    hasAvatar,
    percent,
    isComplete,
  };
}

export type TimeRangeOption = '7d' | '14d' | '30d' | 'all';

export function getCutoffDateStr(option: TimeRangeOption, now: Date = new Date()): string {
  if (option === 'all') return '1970-01-01';
  const target = new Date(now.getTime());
  const days = option === '7d' ? 7 : option === '14d' ? 14 : 30;
  target.setDate(target.getDate() - days);
  return target.toISOString().split('T')[0];
}

export interface StudentAttentionItem {
  enrollmentId: string;
  student: Profile;
  reasons: string[];
  lastPostDate: string | null;
  totalPosts: number;
  hasSubmittedReport: boolean;
  reportStatus: 'approved' | 'needs_revision' | 'pending' | 'none';
  isOverdue: boolean;
}

export interface ClassAnalyticsSummary {
  totalEnrolled: number;
  pendingApprovals: number;
  completeProfiles: number;
  incompleteProfiles: number;
  neverPosted: number;
  activeInPeriod: number;
  inactiveInPeriod: number;
  postsInPeriod: number;
  uniquePostersInPeriod: number;
  reportsSubmitted: number;
  reportsAwaitingReview: number;
  reportsApproved: number;
  reportsNeedsRevision: number;
  overdueStudents: number;
  attentionItems: StudentAttentionItem[];
  dailyTimeline: { date: string; postCount: number; uniqueStudents: number }[];
}

export function computeClassAnalytics(
  enrollments: (ClassEnrollment & { student: Profile })[],
  posts: DailyPost[],
  weeklyReports: WeeklyReport[],
  timeRange: TimeRangeOption = '7d',
  overdueDays: number = 7,
  now: Date = new Date()
): ClassAnalyticsSummary {
  const approvedEnrollments = enrollments.filter(e => e.status === 'approved' && e.student);
  const pendingApprovals = enrollments.filter(e => e.status === 'pending').length;
  const totalEnrolled = approvedEnrollments.length;

  // 1. Profile Completion
  let completeProfiles = 0;
  let incompleteProfiles = 0;
  approvedEnrollments.forEach(e => {
    const evalResult = evaluateStudentProfile(e.student);
    if (evalResult.isComplete) {
      completeProfiles++;
    } else {
      incompleteProfiles++;
    }
  });

  // 2. Activity in Period
  const cutoffDateStr = getCutoffDateStr(timeRange, now);
  const postsInPeriod = posts.filter(p => p.activity_date >= cutoffDateStr);
  const postersInPeriodSet = new Set(postsInPeriod.map(p => p.student_id));
  const activeInPeriod = approvedEnrollments.filter(e => postersInPeriodSet.has(e.student_id)).length;
  const inactiveInPeriod = totalEnrolled - activeInPeriod;

  // Never posted at all
  const allTimePostersSet = new Set(posts.map(p => p.student_id));
  const neverPosted = approvedEnrollments.filter(e => !allTimePostersSet.has(e.student_id)).length;

  // 3. Weekly Reports Reconciliation (Mutually Exclusive)
  const submittedReports = weeklyReports.filter(r => r.status === 'submitted');
  const reportsSubmitted = submittedReports.length;

  let reportsApproved = 0;
  let reportsNeedsRevision = 0;
  let reportsAwaitingReview = 0;

  submittedReports.forEach(r => {
    if (r.review_status === 'approved') {
      reportsApproved++;
    } else if (r.review_status === 'needs_revision') {
      reportsNeedsRevision++;
    } else {
      // Pending review
      reportsAwaitingReview++;
    }
  });

  // 4. Overdue Threshold
  const overdueCutoff = new Date(now.getTime());
  overdueCutoff.setDate(overdueCutoff.getDate() - overdueDays);
  const overdueCutoffStr = overdueCutoff.toISOString().split('T')[0];

  // 5. Build Attention Queue with Transparent Criteria
  const attentionItems: StudentAttentionItem[] = [];
  let overdueStudents = 0;

  approvedEnrollments.forEach(e => {
    const s = e.student;
    const sPosts = posts.filter(p => p.student_id === s.id);
    const sReports = weeklyReports.filter(r => r.student_id === s.id);

    const latestPost = sPosts.reduce((latest, p) => (!latest || p.activity_date > latest ? p.activity_date : latest), '' as string);
    const isOverdue = sPosts.length === 0 || latestPost < overdueCutoffStr;

    if (isOverdue) overdueStudents++;

    const reasons: string[] = [];

    const evalResult = evaluateStudentProfile(s);
    if (!evalResult.isComplete) {
      reasons.push('Incomplete profile details');
    }

    if (sPosts.length === 0) {
      reasons.push('Never posted daily progress');
    } else if (latestPost < overdueCutoffStr) {
      reasons.push(`No daily progress logged in >${overdueDays} days`);
    }

    const latestSubmittedReport = sReports
      .filter(r => r.status === 'submitted')
      .sort((a, b) => (b.submitted_at || b.created_at).localeCompare(a.submitted_at || a.created_at))[0];

    let reportStatus: 'approved' | 'needs_revision' | 'pending' | 'none' = 'none';
    if (!latestSubmittedReport) {
      reasons.push('Missing weekly milestone report');
    } else {
      reportStatus = latestSubmittedReport.review_status || (latestSubmittedReport.mentor_reviewed ? 'approved' : 'pending');
      if (reportStatus === 'needs_revision') {
        reasons.push('Weekly report requires revision');
      }
    }

    if (reasons.length > 0) {
      attentionItems.push({
        enrollmentId: e.id,
        student: s,
        reasons,
        lastPostDate: latestPost || null,
        totalPosts: sPosts.length,
        hasSubmittedReport: Boolean(latestSubmittedReport),
        reportStatus,
        isOverdue,
      });
    }
  });

  // 6. Build Daily Timeline for Bar/Line Chart
  const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : 14;
  const timelineMap: { [dateStr: string]: { posts: number; students: Set<string> } } = {};

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    timelineMap[dStr] = { posts: 0, students: new Set() };
  }

  postsInPeriod.forEach(p => {
    if (timelineMap[p.activity_date]) {
      timelineMap[p.activity_date].posts++;
      timelineMap[p.activity_date].students.add(p.student_id);
    }
  });

  const dailyTimeline = Object.keys(timelineMap)
    .sort()
    .map(date => ({
      date,
      postCount: timelineMap[date].posts,
      uniqueStudents: timelineMap[date].students.size,
    }));

  return {
    totalEnrolled,
    pendingApprovals,
    completeProfiles,
    incompleteProfiles,
    neverPosted,
    activeInPeriod,
    inactiveInPeriod,
    postsInPeriod: postsInPeriod.length,
    uniquePostersInPeriod: postersInPeriodSet.size,
    reportsSubmitted,
    reportsAwaitingReview,
    reportsApproved,
    reportsNeedsRevision,
    overdueStudents,
    attentionItems,
    dailyTimeline,
  };
}
