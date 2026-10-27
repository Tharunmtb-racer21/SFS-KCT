import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { WeeklyReport } from '../types';
import { 
  CalendarCheck, 
  Plus, 
  Save, 
  Send, 
  CheckCircle, 
  Filter,
  AlertCircle,
  Loader2,
  UploadCloud,
  FileCheck,
  Paperclip,
  X,
  Clock,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { validateAttachmentFile } from '../utils/imageUtils';

export const WeeklyReportsPage: React.FC = () => {
  const { currentUser, activeClass, refreshData, activeMode } = useApp();

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<number | 'all'>('all');
  const [mentorFilterStatus, setMentorFilterStatus] = useState<'all' | 'pending' | 'approved' | 'needs_revision'>('all');

  // Student Weekly Report Form State
  const [weekNumber, setWeekNumber] = useState<number>(8);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [achievements, setAchievements] = useState('');
  const [activitiesCompleted, setActivitiesCompleted] = useState('');
  const [skillsLearned, setSkillsLearned] = useState('');
  const [goalsAchieved, setGoalsAchieved] = useState('');
  const [difficultiesFaced, setDifficultiesFaced] = useState('');
  const [hoursSpent, setHoursSpent] = useState<number | string>(12);
  const [nextWeekGoals, setNextWeekGoals] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mentor Review feedback input state & decisions
  const [reviewInputs, setReviewInputs] = useState<{ [reportId: string]: string }>({});
  const [reviewStatusDecisions, setReviewStatusDecisions] = useState<{ [reportId: string]: 'approved' | 'needs_revision' }>({});

  const loadReports = async () => {
    if (!activeClass || !currentUser) {
      setReports([]);
      return;
    }
    setIsLoading(true);
    setReportError(null);
    try {
      if (activeMode === 'production') {
        const liveReports = currentUser.role === 'mentor'
          ? await supabaseService.getWeeklyReportsForClass(activeClass.id)
          : await supabaseService.getWeeklyReportsForStudent(currentUser.id, activeClass.id);
        setReports(liveReports);
      } else {
        const demoReports = currentUser.role === 'mentor'
          ? appStore.getWeeklyReportsForClass(activeClass.id)
          : appStore.getWeeklyReportsForStudent(currentUser.id, activeClass.id);
        setReports(demoReports);
      }
    } catch (err: any) {
      console.error('Failed to load weekly reports:', err);
      setReportError(err.message || 'Failed to load weekly reports from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [activeClass?.id, currentUser?.id, activeMode]);

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Please sign in to view weekly reports.</div>;
  }

  if (!activeClass) {
    return (
      <div className="p-8 text-center text-slate-500">
        Please select or join a class to access weekly reports.
      </div>
    );
  }

  const isMentor = currentUser.role === 'mentor';
  const isStudent = currentUser.role === 'student';

  // For mentors: show only submitted reports in the review queue (drafts stay private to students)
  const baseReports = isMentor ? reports.filter(r => r.status === 'submitted') : reports;

  const filteredReports = baseReports.filter(r => {
    if (selectedWeekFilter !== 'all' && r.week_number !== selectedWeekFilter) {
      return false;
    }
    if (isMentor && mentorFilterStatus !== 'all') {
      const currentReviewStatus = r.review_status || (r.mentor_reviewed ? 'approved' : 'pending');
      if (mentorFilterStatus === 'pending' && currentReviewStatus !== 'pending') return false;
      if (mentorFilterStatus === 'approved' && currentReviewStatus !== 'approved') return false;
      if (mentorFilterStatus === 'needs_revision' && currentReviewStatus !== 'needs_revision') return false;
    }
    return true;
  });

  // Available week numbers for filter dropdown
  const availableWeeks = Array.from(new Set(baseReports.map(r => r.week_number))).sort((a, b) => b - a);

  const resetFormState = () => {
    setEditingReportId(null);
    setAchievements('');
    setActivitiesCompleted('');
    setSkillsLearned('');
    setGoalsAchieved('');
    setDifficultiesFaced('');
    setHoursSpent(12);
    setNextWeekGoals('');
    setSelectedFileObj(null);
    setAttachedFile(null);
    setUploadProgress(null);
    setFormError('');
  };

  const handleEditDraft = (report: WeeklyReport) => {
    setEditingReportId(report.id);
    setWeekNumber(report.week_number);
    setStartDate(report.start_date);
    setEndDate(report.end_date);
    setAchievements(report.achievements);
    setActivitiesCompleted(report.activities_completed);
    setSkillsLearned(report.skills_learned || '');
    setGoalsAchieved(report.goals_achieved || '');
    setDifficultiesFaced(report.difficulties_faced || '');
    setHoursSpent(report.hours_spent !== undefined ? report.hours_spent : 12);
    setNextWeekGoals(report.next_week_goals);
    if (report.attachment_name) {
      setAttachedFile({ name: report.attachment_name, size: 0 });
    } else {
      setAttachedFile(null);
    }
    setSelectedFileObj(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveReport = async (status: 'draft' | 'submitted') => {
    if (!achievements.trim() || !activitiesCompleted.trim() || !nextWeekGoals.trim()) {
      setFormError('Please complete required fields: achievements, activities completed, and next week goals.');
      return;
    }

    if (!hoursSpent || Number(hoursSpent) <= 0) {
      setFormError('Please enter valid hours spent on coursework/milestones this week.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      let uploadedUrl: string | undefined = undefined;
      let uploadedName: string | undefined = undefined;

      if (selectedFileObj) {
        setUploadProgress(40);
        if (activeMode === 'production') {
          const uploadRes = await supabaseService.uploadAttachment(currentUser.id, selectedFileObj, 'reports');
          uploadedUrl = uploadRes.url;
          uploadedName = selectedFileObj.name;
        } else {
          uploadedUrl = 'https://storage.mentorpulse.local/' + selectedFileObj.name;
          uploadedName = selectedFileObj.name;
        }
        setUploadProgress(100);
      }

      const payload: any = {
        class_id: activeClass.id,
        student_id: currentUser.id,
        week_number: Number(weekNumber),
        start_date: startDate,
        end_date: endDate,
        achievements: achievements.trim(),
        activities_completed: activitiesCompleted.trim(),
        skills_learned: skillsLearned.trim() || undefined,
        goals_achieved: goalsAchieved.trim() || undefined,
        difficulties_faced: difficultiesFaced.trim() || undefined,
        hours_spent: Number(hoursSpent),
        next_week_goals: nextWeekGoals.trim(),
        status,
        submitted_at: new Date().toISOString(),
      };

      if (editingReportId) {
        payload.id = editingReportId;
      }

      if (uploadedUrl) {
        payload.attachment_url = uploadedUrl;
        payload.attachment_name = uploadedName;
      }

      if (activeMode === 'production') {
        await supabaseService.saveWeeklyReport(payload);
      } else {
        appStore.saveWeeklyReport(payload);
      }

      setShowForm(false);
      resetFormState();
      setSuccessMessage(
        status === 'submitted'
          ? 'Weekly report successfully submitted to your mentor for review.'
          : 'Weekly report draft saved. You can continue editing before final submission.'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadReports();
    } catch (err: any) {
      setFormError(`Failed to save report: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReportFeedback = async (reportId: string) => {
    const content = reviewInputs[reportId];
    if (!content || !content.trim() || !isMentor) return;

    const decision = reviewStatusDecisions[reportId] || 'approved';

    try {
      if (activeMode === 'production') {
        await supabaseService.addWeeklyReportFeedback(reportId, currentUser.id, content.trim(), decision);
      } else {
        appStore.addWeeklyReportFeedback(reportId, currentUser.id, content.trim(), decision);
      }
      setReviewInputs({ ...reviewInputs, [reportId]: '' });
      setSuccessMessage(`Assessment feedback saved as ${decision === 'approved' ? 'Approved' : 'Needs Revision'}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadReports();
    } catch (err: any) {
      alert(`Feedback submission failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
              {activeClass.name}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950 mt-1">
            {isMentor ? 'Weekly Reports Review & Grading' : 'My Weekly Summary Reports'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Week Filter */}
          {availableWeeks.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Week:</span>
              <select
                value={selectedWeekFilter}
                onChange={(e) => setSelectedWeekFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent font-medium text-slate-900 focus:outline-none"
              >
                <option value="all">All Weeks</option>
                {availableWeeks.map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
          )}

          {isStudent && (
            <button
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  resetFormState();
                } else {
                  resetFormState();
                  setShowForm(true);
                }
              }}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              {showForm ? 'Cancel Report' : 'Draft / Submit Weekly Report'}
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-medium animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {reportError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{reportError}</span>
          </div>
          <button onClick={loadReports} className="text-xs font-bold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Mentor Review Queue Status Filters */}
      {isMentor && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Queue Filter:</span>
          {(['all', 'pending', 'approved', 'needs_revision'] as const).map((status) => {
            const count = status === 'all'
              ? baseReports.length
              : baseReports.filter(r => (r.review_status || (r.mentor_reviewed ? 'approved' : 'pending')) === status).length;

            const labels = {
              all: 'All Submitted',
              pending: 'Pending Review',
              approved: 'Approved',
              needs_revision: 'Needs Revision',
            };

            const isActive = mentorFilterStatus === status;

            return (
              <button
                key={status}
                onClick={() => setMentorFilterStatus(status)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{labels[status]}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Student Weekly Report Composer Form */}
      {showForm && isStudent && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-md p-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-600" />
                {editingReportId ? 'Revise & Edit Weekly Summary Report' : 'Draft / Submit Weekly Academic Summary'}
              </h2>
              <p className="text-xs text-slate-500">
                Formal weekly milestone evaluation: document achievements, difficulties, hours, and goals.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
              Week {weekNumber}
            </span>
          </div>

          {formError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Week Number *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Week Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Week End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Key Achievements This Week *
              </label>
              <textarea
                rows={2}
                required
                placeholder="What tangible milestones or breakthroughs did you accomplish?"
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Activities & Tasks Completed *
              </label>
              <textarea
                rows={2}
                required
                placeholder="List completed lab sessions, circuit designs, coding exercises, or experiments..."
                value={activitiesCompleted}
                onChange={(e) => setActivitiesCompleted(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills Learned & Consolidated
                </label>
                <input
                  type="text"
                  placeholder="e.g. ARM assembly, Signal filtering"
                  value={skillsLearned}
                  onChange={(e) => setSkillsLearned(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Goals Achieved
                </label>
                <input
                  type="text"
                  placeholder="e.g. Target latency reduced under 50ms"
                  value={goalsAchieved}
                  onChange={(e) => setGoalsAchieved(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hours Spent This Week *
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  placeholder="e.g. 15"
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulties or Bottlenecks Faced (Challenges)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Component shipping delay, timing violation"
                  value={difficultiesFaced}
                  onChange={(e) => setDifficultiesFaced(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Week Actionable Goals *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct thermal testing and present demo"
                  value={nextWeekGoals}
                  onChange={(e) => setNextWeekGoals(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Document / Report Proof Attachment */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Attach Weekly Proof / PDF Report Sheet
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Max 2 MB • JPG, PNG, WebP, PDF</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-100 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
                  {attachedFile ? 'Change File' : 'Choose File'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const val = validateAttachmentFile(file);
                      if (!val.valid) {
                        setFormError(val.error || 'Invalid attachment.');
                        return;
                      }
                      setFormError('');
                      setSelectedFileObj(file);
                      setAttachedFile({ name: file.name, size: file.size });
                    }}
                    className="hidden"
                  />
                </label>

                {uploadProgress !== null && (
                  <span className="text-xs text-teal-700 font-medium">Uploading {uploadProgress}%...</span>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-xs font-medium">
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                    {attachedFile.size > 0 && (
                      <span className="text-[10px] text-emerald-600">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedFileObj(null); setAttachedFile(null); }}
                      className="ml-1 text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetFormState(); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveReport('draft')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveReport('submitted')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-teal-400" />
                    Submit to Mentor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium">Loading weekly reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold text-slate-700">No weekly reports found</p>
          <p className="text-xs text-slate-400 mt-1">
            {isStudent ? 'Draft your first report above.' : 'No weekly submissions match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((report) => {
            const author = report.student;
            const isDraft = report.status === 'draft';
            const reviewStatus = report.review_status || (report.mentor_reviewed ? 'approved' : 'pending');

            return (
              <div 
                key={report.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {isMentor && author?.avatar_url ? (
                      <img 
                        src={author.avatar_url} 
                        alt={author.full_name} 
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {isMentor && author ? author.full_name.charAt(0) : `W${report.week_number}`}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {isMentor ? author?.full_name : `Week ${report.week_number} Progress Report`}
                        </span>
                        {isMentor && author?.student_reg_no && (
                          <span className="font-mono text-xs text-teal-700">
                            {author.student_reg_no}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Period: {report.start_date} &rarr; {report.end_date}</span>
                        {report.hours_spent !== undefined && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Clock className="w-3 h-3 text-teal-600" />
                              {report.hours_spent} Hours Logged
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Badge */}
                    {isDraft ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 flex items-center gap-1">
                        <Edit3 className="w-3 h-3" />
                        Draft (Private)
                      </span>
                    ) : (
                      <>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Submitted
                        </span>
                        {reviewStatus === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {reviewStatus === 'needs_revision' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Needs Revision
                          </span>
                        )}
                        {reviewStatus === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Review
                          </span>
                        )}
                      </>
                    )}

                    {/* Student Edit Draft / Resubmit button */}
                    {isStudent && isDraft && (
                      <button
                        onClick={() => handleEditDraft(report)}
                        className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-teal-600" />
                        Edit Draft
                      </button>
                    )}

                    {isStudent && reviewStatus === 'needs_revision' && (
                      <button
                        onClick={() => handleEditDraft(report)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Revise & Resubmit
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Sections */}
                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
                      Key Achievements
                    </h4>
                    <p className="text-slate-700 leading-relaxed">{report.achievements}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
                      Activities & Experiments Completed
                    </h4>
                    <p className="text-slate-700 leading-relaxed">{report.activities_completed}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {report.skills_learned && (
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700 block mb-0.5">Skills Learned:</span>
                        <span className="text-slate-600">{report.skills_learned}</span>
                      </div>
                    )}
                    {report.goals_achieved && (
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700 block mb-0.5">Goals Achieved:</span>
                        <span className="text-slate-600">{report.goals_achieved}</span>
                      </div>
                    )}
                  </div>

                  {report.difficulties_faced && (
                    <div>
                      <h4 className="font-bold text-rose-800 text-[11px] uppercase tracking-wider mb-0.5">
                        Difficulties & Bottlenecks Faced
                      </h4>
                      <p className="text-slate-700">{report.difficulties_faced}</p>
                    </div>
                  )}

                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-teal-900 text-[11px] uppercase tracking-wider mb-0.5">
                        Next Week Target Goals
                      </h4>
                      <p className="text-slate-800">{report.next_week_goals}</p>
                    </div>
                    {report.hours_spent !== undefined && (
                      <div className="sm:text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-teal-800 block">Effort Logged</span>
                        <span className="font-bold text-teal-950 text-sm">{report.hours_spent} Hours</span>
                      </div>
                    )}
                  </div>

                  {report.attachment_url && (
                    <div className="pt-1">
                      <a
                        href={report.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-teal-800 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-teal-600" />
                        Attached Report Evidence {report.attachment_name ? `(${report.attachment_name})` : ''}
                      </a>
                    </div>
                  )}
                </div>

                {/* Feedback Thread */}
                {report.feedback && report.feedback.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                      Faculty Mentor Feedback & Evaluation:
                    </h4>
                    {report.feedback.map((fb) => (
                      <div key={fb.id} className="p-3 bg-navy-50 rounded-xl border border-navy-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-navy-900 mb-0.5">
                          <div className="flex items-center gap-2">
                            <span>{fb.mentor?.full_name || 'Faculty Mentor'}</span>
                            {fb.status_decision && (
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                fb.status_decision === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {fb.status_decision === 'approved' ? 'Approved' : 'Revision Required'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(fb.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mentor Review & Evaluation Box */}
                {isMentor && (
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-800">Mentor Evaluation & Decision:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReviewStatusDecisions({
                            ...reviewStatusDecisions,
                            [report.id]: 'approved'
                          })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            (reviewStatusDecisions[report.id] || 'approved') === 'approved'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Approve Report
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewStatusDecisions({
                            ...reviewStatusDecisions,
                            [report.id]: 'needs_revision'
                          })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            reviewStatusDecisions[report.id] === 'needs_revision'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Request Revision
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Leave formal grading remarks, strengths, and recommended improvements..."
                        value={reviewInputs[report.id] || ''}
                        onChange={(e) => setReviewInputs({ ...reviewInputs, [report.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendReportFeedback(report.id);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        onClick={() => handleSendReportFeedback(report.id)}
                        disabled={!reviewInputs[report.id]?.trim()}
                        className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                        Submit Evaluation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
