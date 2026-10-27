import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Rss, 
  CalendarCheck, 
  FileCheck, 
  AlertTriangle,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Layers
} from 'lucide-react';
import { 
  ClassAnalyticsSummary, 
  TimeRangeOption, 
  StudentAttentionItem 
} from '../utils/analyticsUtils';
import { ClassGroup } from '../types';

interface FacultyAnalyticsProps {
  analytics: ClassAnalyticsSummary;
  timeRange: TimeRangeOption;
  onTimeRangeChange: (range: TimeRangeOption) => void;
  overdueDays: number;
  onOverdueDaysChange: (days: number) => void;
  onRefresh: () => void;
  lastRefreshedAt: Date | null;
  classes: ClassGroup[];
  activeClass: ClassGroup;
  onSelectClass: (classId: string) => void;
}

export const FacultyAnalytics: React.FC<FacultyAnalyticsProps> = ({
  analytics,
  timeRange,
  onTimeRangeChange,
  overdueDays,
  onOverdueDaysChange,
  onRefresh,
  lastRefreshedAt,
  classes,
  activeClass,
  onSelectClass,
}) => {
  const navigate = useNavigate();
  const [attentionSearch, setAttentionSearch] = useState('');
  const [activeAttentionFilter, setActiveAttentionFilter] = useState<'all' | 'profile' | 'inactivity' | 'report'>('all');

  const {
    totalEnrolled,
    pendingApprovals,
    completeProfiles,
    incompleteProfiles,
    neverPosted,
    activeInPeriod,
    inactiveInPeriod,
    postsInPeriod,
    uniquePostersInPeriod,
    reportsSubmitted,
    reportsAwaitingReview,
    reportsApproved,
    reportsNeedsRevision,
    overdueStudents,
    attentionItems,
    dailyTimeline,
  } = analytics;

  const profileCompletePercent = totalEnrolled > 0 ? Math.round((completeProfiles / totalEnrolled) * 100) : 0;
  const activePercent = totalEnrolled > 0 ? Math.round((activeInPeriod / totalEnrolled) * 100) : 0;

  // Filter Attention Queue
  const filteredAttention = attentionItems.filter((item) => {
    const s = item.student;
    const query = attentionSearch.toLowerCase();
    const matchesQuery = 
      s.full_name.toLowerCase().includes(query) ||
      (s.student_reg_no && s.student_reg_no.toLowerCase().includes(query));
    if (!matchesQuery) return false;

    if (activeAttentionFilter === 'profile') {
      return item.reasons.some(r => r.includes('profile'));
    }
    if (activeAttentionFilter === 'inactivity') {
      return item.isOverdue || item.reasons.some(r => r.includes('daily progress'));
    }
    if (activeAttentionFilter === 'report') {
      return item.reasons.some(r => r.includes('report') || r.includes('milestone'));
    }
    return true;
  });

  // SVG Donut Helper
  const renderDonutSlice = (startAngle: number, endAngle: number, color: string) => {
    if (startAngle === endAngle) return null;
    const radius = 40;
    const cx = 50;
    const cy = 50;
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return <path d={d} fill={color} />;
  };

  // Profile Donut Angles
  const profileTotal = totalEnrolled + pendingApprovals;
  const completeAngle = profileTotal > 0 ? (completeProfiles / profileTotal) * 360 : 0;
  const incompleteAngle = profileTotal > 0 ? (incompleteProfiles / profileTotal) * 360 : 0;
  const pendingAngle = profileTotal > 0 ? (pendingApprovals / profileTotal) * 360 : 0;

  // Reports Donut Angles
  const reportsTotal = reportsSubmitted || 1;
  const approvedAngle = (reportsApproved / reportsTotal) * 360;
  const revisionAngle = (reportsNeedsRevision / reportsTotal) * 360;
  const awaitingAngle = (reportsAwaitingReview / reportsTotal) * 360;

  // Max value in daily timeline for bar scaling
  const maxPostsInTimeline = Math.max(...dailyTimeline.map(d => d.postCount), 1);

  return (
    <div className="space-y-6">
      {/* Analytics Control Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <span>Reporting Window:</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(['7d', '14d', '30d', 'all'] as TimeRangeOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => onTimeRangeChange(opt)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  timeRange === opt
                    ? 'bg-white text-navy-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt === '7d' ? 'Last 7 Days' : opt === '14d' ? 'Last 14 Days' : opt === '30d' ? 'Last 30 Days' : 'All Semester'}
              </button>
            ))}
          </div>

          {/* Overdue Days Config */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-2 border-l border-slate-200">
            <span>Overdue Rule:</span>
            <select
              value={overdueDays}
              onChange={(e) => onOverdueDaysChange(Number(e.target.value))}
              aria-label="Overdue Days Rule"
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value={3}>&gt; 3 Days without post</option>
              <option value={5}>&gt; 5 Days without post</option>
              <option value={7}>&gt; 7 Days without post</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          {lastRefreshedAt && (
            <span className="hidden sm:inline text-slate-400">
              Refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh analytics with live data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Live Sync
          </button>
        </div>
      </div>

      {/* Primary 11 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Total Enrolled */}
        <div 
          onClick={() => navigate('/mentor/students?tab=approved')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Enrolled</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{totalEnrolled}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Approved Students</div>
        </div>

        {/* 2. Complete Profiles */}
        <div 
          onClick={() => navigate('/mentor/students?filter=complete')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Profiles Complete</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 flex items-center gap-1.5">
            {completeProfiles}
            <span className="text-xs font-normal text-emerald-600">({profileCompletePercent}%)</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Verified Details</div>
        </div>

        {/* 3. Incomplete Profiles */}
        <div 
          onClick={() => navigate('/mentor/students?filter=incomplete')}
          className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer ${
            incompleteProfiles > 0 ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Profiles Incomplete</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-800">{incompleteProfiles}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Missing Info/Skills</div>
        </div>

        {/* 4. Active Students */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active in Period</span>
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-teal-700 flex items-center gap-1.5">
            {activeInPeriod}
            <span className="text-xs font-normal text-teal-600">({activePercent}%)</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{inactiveInPeriod} Inactive</div>
        </div>

        {/* 5. Daily Updates in Period */}
        <div 
          onClick={() => navigate('/mentor/feed')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Daily Updates</span>
            <Rss className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{postsInPeriod}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{uniquePostersInPeriod} Unique Authors</div>
        </div>

        {/* 6. Overdue / Needs Attention */}
        <div 
          onClick={() => {
            const el = document.getElementById('attention-queue-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer ${
            overdueStudents > 0 ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-50' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Overdue Progress</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700">{overdueStudents}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">&gt;{overdueDays}d Without Post</div>
        </div>

        {/* 7. Weekly Reports Submitted */}
        <div 
          onClick={() => navigate('/mentor/weekly-reports')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Reports Filed</span>
            <CalendarCheck className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{reportsSubmitted}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Formal Milestones</div>
        </div>

        {/* 8. Reports Awaiting Review */}
        <div 
          onClick={() => navigate('/mentor/weekly-reports?filter=pending')}
          className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer ${
            reportsAwaitingReview > 0 ? 'bg-amber-50/50 border-amber-300 hover:bg-amber-50' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Awaiting Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-900">{reportsAwaitingReview}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Requires Decision</div>
        </div>

        {/* 9. Reports Approved */}
        <div 
          onClick={() => navigate('/mentor/weekly-reports?filter=approved')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Approved Reports</span>
            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700">{reportsApproved}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Passed Mentorship</div>
        </div>

        {/* 10. Reports Needs Revision */}
        <div 
          onClick={() => navigate('/mentor/weekly-reports?filter=needs_revision')}
          className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer ${
            reportsNeedsRevision > 0 ? 'bg-rose-50/30 border-rose-200 hover:bg-rose-50' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Needs Revision</span>
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-700">{reportsNeedsRevision}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Returned to Student</div>
        </div>

        {/* 11. Never Posted */}
        <div 
          onClick={() => {
            const el = document.getElementById('attention-queue-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Zero Activity</span>
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-700">{neverPosted}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Never Submitted Post</div>
        </div>

        {/* 12. Pending Registrations */}
        <div 
          onClick={() => navigate('/mentor/students?tab=pending')}
          className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer ${
            pendingApprovals > 0 ? 'bg-amber-100/60 border-amber-300 hover:bg-amber-100' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Pending Enroll</span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-xl font-bold text-amber-900">{pendingApprovals}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">1-Click Approve Ready</div>
        </div>
      </div>

      {/* Four Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Chart A: Profile Completion Donut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Profile Completion</h3>
              <span className="text-[11px] font-bold text-teal-700">{profileCompletePercent}%</span>
            </div>
            <p className="text-[11px] text-slate-400">Complete student records in {activeClass.name}</p>

            <div className="relative w-32 h-32 mx-auto my-4">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                {renderDonutSlice(0, completeAngle, '#10b981')}
                {renderDonutSlice(completeAngle, completeAngle + incompleteAngle, '#f59e0b')}
                {renderDonutSlice(completeAngle + incompleteAngle, completeAngle + incompleteAngle + pendingAngle, '#ef4444')}
                <circle cx="50" cy="50" r="28" fill="#ffffff" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-navy-950">{completeProfiles}/{totalEnrolled}</span>
                <span className="text-[9px] text-slate-400 font-medium">Students</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Complete Profiles
              </span>
              <span className="font-bold text-slate-800">{completeProfiles}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Incomplete Profiles
              </span>
              <span className="font-bold text-slate-800">{incompleteProfiles}</span>
            </div>
            {pendingApprovals > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Pending Approvals
                </span>
                <span className="font-bold text-slate-800">{pendingApprovals}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart B: Student Activity in Period */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Student Activity</h3>
              <span className="text-[11px] font-bold text-teal-700">{activePercent}% Active</span>
            </div>
            <p className="text-[11px] text-slate-400">Activity tracked over {timeRange === '7d' ? '7 days' : timeRange === '14d' ? '14 days' : '30 days'}</p>

            <div className="relative w-32 h-32 mx-auto my-4">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                {renderDonutSlice(0, (activeInPeriod / (totalEnrolled || 1)) * 360, '#0d9488')}
                {renderDonutSlice((activeInPeriod / (totalEnrolled || 1)) * 360, 360, '#e2e8f0')}
                <circle cx="50" cy="50" r="28" fill="#ffffff" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-navy-950">{activeInPeriod}</span>
                <span className="text-[9px] text-slate-400 font-medium">Active</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                Active in Window
              </span>
              <span className="font-bold text-slate-800">{activeInPeriod} ({activePercent}%)</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                Inactive in Window
              </span>
              <span className="font-bold text-slate-800">{inactiveInPeriod}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                Zero Posts (Lifetime)
              </span>
              <span className="font-bold text-slate-800">{neverPosted}</span>
            </div>
          </div>
        </div>

        {/* Chart C: Weekly Reports Assessment Donut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Weekly Milestones</h3>
              <span className="text-[11px] font-bold text-teal-700">{reportsSubmitted} Filed</span>
            </div>
            <p className="text-[11px] text-slate-400">Assessment decisions on formal reports</p>

            <div className="relative w-32 h-32 mx-auto my-4">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                {renderDonutSlice(0, approvedAngle, '#10b981')}
                {renderDonutSlice(approvedAngle, approvedAngle + revisionAngle, '#f43f5e')}
                {renderDonutSlice(approvedAngle + revisionAngle, approvedAngle + revisionAngle + awaitingAngle, '#f59e0b')}
                <circle cx="50" cy="50" r="28" fill="#ffffff" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-navy-950">{reportsApproved}</span>
                <span className="text-[9px] text-slate-400 font-medium">Approved</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Approved
              </span>
              <span className="font-bold text-slate-800">{reportsApproved}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Awaiting Decision
              </span>
              <span className="font-bold text-slate-800">{reportsAwaitingReview}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Needs Revision
              </span>
              <span className="font-bold text-slate-800">{reportsNeedsRevision}</span>
            </div>
          </div>
        </div>

        {/* Chart D: Daily Progress Timeline Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Daily Updates Trend</h3>
              <span className="text-[11px] font-bold text-indigo-700">{postsInPeriod} Posts</span>
            </div>
            <p className="text-[11px] text-slate-400">Total updates vs unique students posting</p>

            <div className="h-32 mt-4 flex items-end justify-between gap-1 pt-4 pb-2 border-b border-slate-100">
              {dailyTimeline.map((item) => {
                const heightPercent = maxPostsInTimeline > 0 ? (item.postCount / maxPostsInTimeline) * 100 : 0;
                const uniqueHeight = maxPostsInTimeline > 0 ? (item.uniqueStudents / maxPostsInTimeline) * 100 : 0;
                const dayLabel = item.date.slice(8);

                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-10 bg-navy-950 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      {item.date}: {item.postCount} posts ({item.uniqueStudents} students)
                    </div>

                    <div className="w-full flex items-end justify-center gap-0.5 h-full">
                      {/* Post Count Bar */}
                      <div 
                        style={{ height: `${Math.max(heightPercent, 4)}%` }} 
                        className="w-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-t-sm transition-all"
                      />
                      {/* Unique Students Bar */}
                      <div 
                        style={{ height: `${Math.max(uniqueHeight, 4)}%` }} 
                        className="w-1.5 bg-teal-400 hover:bg-teal-500 rounded-t-sm transition-all"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 font-mono">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" /> Total Updates
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-teal-400 rounded-sm" /> Unique Students
            </span>
          </div>
        </div>
      </div>

      {/* Chart E: Multi-Class Comparison Benchmarking (When Faculty has multiple classes) */}
      {classes.length > 1 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Faculty Class Benchmarking & Workload</h3>
              <p className="text-xs text-slate-500">Cross-class comparison of enrollment, profile completion, and mentor workload</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2 px-3">Class Group</th>
                  <th className="py-2 px-3">Department & Semester</th>
                  <th className="py-2 px-3">Approved Students</th>
                  <th className="py-2 px-3">Pending Registration</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => {
                  const isCurrent = c.id === activeClass.id;
                  return (
                    <tr key={c.id} className={isCurrent ? 'bg-teal-50/40 font-medium' : 'hover:bg-slate-50'}>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{c.name}</span>
                        {isCurrent && (
                          <span className="ml-2 text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                            Active Scope
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {c.department} &bull; {c.academic_year} ({c.semester})
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {c.student_count || 0}
                      </td>
                      <td className="py-2.5 px-3">
                        {c.pending_count && c.pending_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {c.pending_count} pending
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!isCurrent && (
                          <button
                            onClick={() => onSelectClass(c.id)}
                            className="px-2.5 py-1 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Switch Class
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section G: Students Requiring Attention Interactive Action Table */}
      <div id="attention-queue-section" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-navy-950">Students Requiring Faculty Follow-up</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                {attentionItems.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent academic indicators for {activeClass.name}: incomplete profile, inactivity &gt;{overdueDays}d, or revision requested
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveAttentionFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeAttentionFilter === 'all' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All ({attentionItems.length})
            </button>
            <button
              onClick={() => setActiveAttentionFilter('profile')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeAttentionFilter === 'profile' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Incomplete Profile
            </button>
            <button
              onClick={() => setActiveAttentionFilter('inactivity')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeAttentionFilter === 'inactivity' ? 'bg-white text-rose-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Overdue Activity
            </button>
            <button
              onClick={() => setActiveAttentionFilter('report')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeAttentionFilter === 'report' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Report Revision
            </button>
          </div>
        </div>

        {/* Search within Attention Queue */}
        <div className="relative mb-3.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student in attention queue by name or register number..."
            value={attentionSearch}
            onChange={(e) => setAttentionSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
          />
        </div>

        {filteredAttention.length === 0 ? (
          <div className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500 opacity-80" />
            <p className="text-xs font-semibold text-slate-700">All students are currently on track!</p>
            <p className="text-[11px] text-slate-400">No overdue submissions, missing reports, or incomplete profiles found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Register No</th>
                  <th className="py-2.5 px-3">Follow-up Reason(s)</th>
                  <th className="py-2.5 px-3">Last Daily Update</th>
                  <th className="py-2.5 px-3">Milestone Report</th>
                  <th className="py-2.5 px-3 text-right">Student Journey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttention.map((item) => {
                  const s = item.student;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-navy-100 text-navy-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {s.full_name.charAt(0)}
                            </div>
                          )}
                          <span className="font-semibold text-slate-900">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-teal-800 font-medium">
                        {s.student_reg_no || 'Reg. No Pending'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((r, i) => (
                            <span 
                              key={i} 
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                r.includes('Incomplete') 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : r.includes('revision')
                                  ? 'bg-rose-100 text-rose-800 font-bold'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.lastPostDate ? (
                          <span>{item.lastPostDate} ({item.totalPosts} total)</span>
                        ) : (
                          <span className="text-rose-600 font-medium">Never posted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.reportStatus === 'approved' ? (
                          <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">Approved</span>
                        ) : item.reportStatus === 'needs_revision' ? (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">Revision Requested</span>
                        ) : item.reportStatus === 'pending' ? (
                          <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded">Awaiting Review</span>
                        ) : (
                          <span className="text-slate-400 italic">Not Submitted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => navigate(`/mentor/students/${s.id}`)}
                          className="px-2.5 py-1 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition-colors"
                        >
                          View Profile
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
