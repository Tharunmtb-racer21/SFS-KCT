import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ClassEnrollment, DailyPost, WeeklyReport, Profile } from '../types';
import { 
  Users, 
  Clock, 
  Rss, 
  CalendarCheck, 
  AlertCircle, 
  Share2, 
  Copy, 
  Check, 
  Download, 
  ChevronRight, 
  Layers, 
  GraduationCap,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MentorDashboard: React.FC = () => {
  const { currentUser, activeClass, classes, setActiveClassId, activeMode } = useApp();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<(ClassEnrollment & { student: Profile })[]>([]);
  const [classPosts, setClassPosts] = useState<DailyPost[]>([]);
  const [classWeeklyReports, setClassWeeklyReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  const loadDashboardData = async () => {
    if (!activeClass) {
      setEnrollments([]);
      setClassPosts([]);
      setClassWeeklyReports([]);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeMode === 'production') {
        const [liveEnrollments, livePosts, liveReports] = await Promise.all([
          supabaseService.getEnrollmentsForClass(activeClass.id),
          supabaseService.getDailyPostsForClass(activeClass.id),
          supabaseService.getWeeklyReportsForClass(activeClass.id),
        ]);
        setEnrollments(liveEnrollments);
        setClassPosts(livePosts);
        setClassWeeklyReports(liveReports);
      } else {
        const demoEnrollments = appStore.getEnrollmentsForClass(activeClass.id);
        const demoPosts = appStore.getDailyPostsForClass(activeClass.id);
        const demoReports = appStore.getWeeklyReportsForClass(activeClass.id);
        setEnrollments(demoEnrollments);
        setClassPosts(demoPosts);
        setClassWeeklyReports(demoReports);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setErrorMsg(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeClass?.id, activeMode]);

  if (!currentUser || currentUser.role !== 'mentor') {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Access restricted to faculty mentors.</p>
      </div>
    );
  }

  if (!activeClass) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <GraduationCap className="w-12 h-12 text-teal-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-navy-900">No Class Created Yet</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Create your first mentoring class group to generate invitation links and track student progress.
        </p>
        <button
          onClick={() => navigate('/mentor/classes?action=new')}
          className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-medium hover:bg-navy-800 transition-colors"
        >
          Create First Class
        </button>
      </div>
    );
  }

  const approvedStudents = enrollments.filter(e => e.status === 'approved');
  const pendingStudents = enrollments.filter(e => e.status === 'pending');

  // Identify students needing attention (no posts in last 7 days or missing weekly report)
  const studentsNeedingAttention = approvedStudents.filter(e => {
    const studentPosts = classPosts.filter(p => p.student_id === e.student_id);
    const hasWeeklyReport = classWeeklyReports.some(r => r.student_id === e.student_id && r.status === 'submitted');
    return studentPosts.length === 0 || !hasWeeklyReport;
  });

  const inviteUrl = `${window.location.origin}/invite/${activeClass.invite_code}`;

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello! Please register on MentorPulse by THARUN N E (SFS @ Kumaraguru College of Technology) for our class group "${activeClass.name}" (${activeClass.department}): ${inviteUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleTeamsShare = () => {
    const text = encodeURIComponent(
      `Hello! Please register on MentorPulse by THARUN N E (SFS @ Kumaraguru College of Technology) for our class group "${activeClass.name}" (${activeClass.department}).`
    );
    window.open(`https://teams.microsoft.com/share?href=${encodeURIComponent(inviteUrl)}&msgText=${text}`, '_blank');
  };

  const handleExportCSV = () => {
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
      const postCount = classPosts.filter(
        (p) => p.student_id === student.id
      ).length;
      const reportCount = classWeeklyReports.filter(
        (r) => r.student_id === student.id && r.status === 'submitted'
      ).length;

      return [
        `"${student.student_reg_no || 'N/A'}"`,
        `"${student.full_name}"`,
        `"${student.email}"`,
        `"${student.department || activeClass.department}"`,
        `"${student.academic_year || activeClass.academic_year}"`,
        `"${e.status}"`,
        postCount,
        reportCount,
        `"${(student.skills || []).join('; ')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeClass.name.replace(/\s+/g, '_')}_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Class Switcher Tabs Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
              {activeClass.department}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">{activeClass.academic_year} &bull; {activeClass.semester}</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950 mt-1">{activeClass.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{activeClass.description}</p>
        </div>

        {/* 1-Click Class Pill Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Class:
          </span>
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveClassId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                c.id === activeClass.id
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{c.name}</span>
              {c.pending_count ? (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {c.pending_count}
                </span>
              ) : null}
            </button>
          ))}
          <button
            onClick={() => navigate('/mentor/classes?action=new')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-teal-700 hover:bg-teal-50 border border-dashed border-teal-300 transition-colors"
          >
            + Add Class
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={loadDashboardData} className="text-xs font-bold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Quick Invite & Action Ribbon */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 text-white p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-navy-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-300 bg-teal-900/60 px-2 py-0.5 rounded">
              Secure Registration Link
            </span>
            {activeClass.requires_approval ? (
              <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                Mentor Approval Required
              </span>
            ) : (
              <span className="text-[11px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded">
                Auto-Enrollment
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-slate-300 break-all select-all">
            {inviteUrl}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyInviteLink}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-navy-800 hover:bg-navy-700 text-slate-100 flex items-center gap-1.5 transition-colors border border-navy-700"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? 'Copied Link!' : 'Copy Link'}
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
            title="Share on WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp Share
          </button>

          <button
            onClick={handleTeamsShare}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
            title="Share on Microsoft Teams"
          >
            <Users className="w-3.5 h-3.5" />
            Teams Share
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
            title="Download CSV roster of approved students & activity"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{approvedStudents.length}</div>
            <div className="text-xs text-slate-500">Enrolled Students</div>
          </div>
        </div>

        <div 
          onClick={() => navigate('/mentor/students?tab=pending')}
          className={`bg-white p-4 rounded-2xl border shadow-xs flex items-center gap-3 cursor-pointer transition-colors ${
            pendingStudents.length > 0 ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {pendingStudents.length}
              {pendingStudents.length > 0 && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                  Review
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">Pending Approvals</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
            <Rss className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{classPosts.length}</div>
            <div className="text-xs text-slate-500">Daily Updates Logged</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{classWeeklyReports.length}</div>
            <div className="text-xs text-slate-500">Weekly Reports Filed</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${studentsNeedingAttention.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{studentsNeedingAttention.length}</div>
            <div className="text-xs text-slate-500">Needs Attention</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Students Attention Queue & Latest Feed Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Students Quick Review */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-navy-950">Class Roster & Submissions</h2>
                <p className="text-xs text-slate-500">Verified progress tracking for {activeClass.name}</p>
              </div>
              <button
                onClick={() => navigate('/mentor/students')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                View Directory <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                <p className="text-xs">Loading roster...</p>
              </div>
            ) : approvedStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium text-slate-600">No approved students yet</p>
                <p className="text-xs text-slate-400">Share the invite link above to enroll your class.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Student Name & Register No</th>
                      <th className="py-2.5 px-3">Daily Posts</th>
                      <th className="py-2.5 px-3">Weekly Report</th>
                      <th className="py-2.5 px-3">Attention Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvedStudents.map((enrollment) => {
                      const student = enrollment.student;
                      if (!student) return null;
                      const postCount = classPosts.filter(p => p.student_id === student.id).length;
                      const hasReport = classWeeklyReports.some(r => r.student_id === student.id && r.status === 'submitted');

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {student.avatar_url ? (
                                <img 
                                  src={student.avatar_url} 
                                  alt="" 
                                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" 
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-navy-100 text-navy-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {student.full_name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-slate-900">{student.full_name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{student.student_reg_no || 'Reg. No Pending'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">{postCount}</span> posts
                          </td>
                          <td className="py-3 px-3">
                            {hasReport ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                                <Check className="w-3 h-3" /> Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {postCount === 0 || !hasReport ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-medium">
                                <AlertCircle className="w-3 h-3" /> Inactivity Alert
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium">
                                On Track
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => navigate(`/mentor/students/${student.id}`)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              Timeline & Profile
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

        {/* Right Col: Feed Activity Highlights */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-navy-950">Recent Class Activity</h2>
              <button
                onClick={() => navigate('/mentor/feed')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                All Posts
              </button>
            </div>

            {classPosts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No posts submitted in this class yet.</p>
            ) : (
              <div className="space-y-3">
                {classPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-900">{post.student?.full_name}</span>
                      <span className="text-slate-400">{post.activity_date}</span>
                    </div>
                    <p className="font-medium text-xs text-navy-900 line-clamp-1">{post.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{post.description}</p>
                    
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-medium">
                        {post.category}
                      </span>
                      <button
                        onClick={() => navigate('/mentor/feed')}
                        className="text-teal-700 hover:underline font-medium"
                      >
                        Feedback & Reactions ({post.feedback?.length || 0})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
