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
  X
} from 'lucide-react';
import { validateAttachmentFile } from '../utils/imageUtils';

export const WeeklyReportsPage: React.FC = () => {
  const { currentUser, activeClass, refreshData, activeMode } = useApp();

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<number | 'all'>('all');

  // Student Weekly Report Form State
  const [weekNumber, setWeekNumber] = useState<number>(8);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [achievements, setAchievements] = useState('');
  const [activitiesCompleted, setActivitiesCompleted] = useState('');
  const [skillsLearned, setSkillsLearned] = useState('');
  const [goalsAchieved, setGoalsAchieved] = useState('');
  const [difficultiesFaced, setDifficultiesFaced] = useState('');
  const [nextWeekGoals, setNextWeekGoals] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mentor Review feedback input state
  const [reviewInputs, setReviewInputs] = useState<{ [reportId: string]: string }>({});

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

  const filteredReports = selectedWeekFilter === 'all'
    ? reports
    : reports.filter(r => r.week_number === selectedWeekFilter);

  // Available week numbers for filter dropdown
  const availableWeeks = Array.from(new Set(reports.map(r => r.week_number))).sort((a, b) => b - a);

  const handleSaveReport = async (status: 'draft' | 'submitted') => {
    if (!achievements.trim() || !activitiesCompleted.trim() || !nextWeekGoals.trim()) {
      setFormError('Please complete achievements, activities completed, and next week goals.');
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

      const payload = {
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
        next_week_goals: nextWeekGoals.trim(),
        attachment_url: uploadedUrl,
        attachment_name: uploadedName,
        status,
        submitted_at: new Date().toISOString(),
      };

      if (activeMode === 'production') {
        await supabaseService.saveWeeklyReport(payload);
      } else {
        appStore.saveWeeklyReport(payload);
      }

      setShowForm(false);
      setAchievements('');
      setActivitiesCompleted('');
      setSkillsLearned('');
      setGoalsAchieved('');
      setDifficultiesFaced('');
      setNextWeekGoals('');
      setSelectedFileObj(null);
      setAttachedFile(null);
      setUploadProgress(null);
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

    try {
      if (activeMode === 'production') {
        await supabaseService.addWeeklyReportFeedback(reportId, currentUser.id, content.trim());
      } else {
        appStore.addWeeklyReportFeedback(reportId, currentUser.id, content.trim());
      }
      setReviewInputs({ ...reviewInputs, [reportId]: '' });
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
              {activeClass.name}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Weekly Reflections</span>
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
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              {showForm ? 'Cancel Report' : 'Draft / Submit Weekly Report'}
            </button>
          )}
        </div>
      </div>

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

      {/* Student Weekly Report Composer Form */}
      {showForm && isStudent && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-md p-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-navy-950">Draft Weekly Academic Summary</h2>
              <p className="text-xs text-slate-500">Reflect on achievements, acquired competencies, and next week plan</p>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
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
                placeholder="List completed lab sessions, circuit designs, coding exercises, or experiments..."
                value={activitiesCompleted}
                onChange={(e) => setActivitiesCompleted(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills Learned & Consolidated
                </label>
                <input
                  type="text"
                  placeholder="e.g. ARM assembly, Signal filtering, Cadence Allegro"
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulties or Bottlenecks Faced
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
                    <span className="text-[10px] text-emerald-600">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
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
                disabled={isSubmitting}
                onClick={() => handleSaveReport('draft')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Draft
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
            {isStudent ? 'Draft your first report above.' : 'No weekly submissions for the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((report) => {
            const author = report.student;
            const isDraft = report.status === 'draft';

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
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <span>Period: {report.start_date} &rarr; {report.end_date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      isDraft 
                        ? 'bg-slate-100 text-slate-600' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {isDraft ? 'Draft' : 'Submitted'}
                    </span>
                    {report.mentor_reviewed && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                        Mentor Reviewed
                      </span>
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
                        Difficulties Faced
                      </h4>
                      <p className="text-slate-700">{report.difficulties_faced}</p>
                    </div>
                  )}

                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                    <h4 className="font-bold text-teal-900 text-[11px] uppercase tracking-wider mb-0.5">
                      Next Week Target Goals
                    </h4>
                    <p className="text-slate-800">{report.next_week_goals}</p>
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
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                      Faculty Mentor Feedback & Assessment:
                    </h4>
                    {report.feedback.map((fb) => (
                      <div key={fb.id} className="p-3 bg-navy-50 rounded-xl border border-navy-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-navy-900 mb-0.5">
                          <span>{fb.mentor?.full_name || 'Faculty Mentor'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(fb.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-slate-700">{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mentor Feedback Composer */}
                {isMentor && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Leave academic feedback and review remarks on this weekly report..."
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
                      className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                      Review & Feedback
                    </button>
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
