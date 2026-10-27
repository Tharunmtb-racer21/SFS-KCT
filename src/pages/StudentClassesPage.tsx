import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ClassEnrollment, ClassGroup } from '../types';
import { 
  FolderOpen, 
  Plus, 
  Clock, 
  ExternalLink, 
  Calendar, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const StudentClassesPage: React.FC = () => {
  const { currentUser, setActiveClassId, refreshData, activeMode } = useApp();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<(ClassEnrollment & { class: ClassGroup })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStudentClasses = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      if (activeMode === 'production') {
        const liveEnrollments = await supabaseService.getEnrollmentsForStudent(currentUser.id);
        setEnrollments(liveEnrollments);
      } else {
        const demoEnrollments = appStore.getEnrollmentsForStudent(currentUser.id);
        setEnrollments(demoEnrollments);
      }
    } catch (err: any) {
      console.error('Failed to load classes:', err);
      setLoadError(err.message || 'Failed to load enrolled classes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentClasses();
  }, [currentUser?.id, activeMode]);

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Please sign in to view your classes.</div>;
  }

  const handleJoinClassByToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;

    let token = inviteTokenInput.trim();
    if (token.includes('/invite/')) {
      token = token.split('/invite/')[1].split('?')[0];
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let targetClass: ClassGroup | null = null;
      if (activeMode === 'production') {
        targetClass = await supabaseService.getClassByInviteCode(token);
      } else {
        targetClass = appStore.getClassByInviteCode(token);
      }

      if (!targetClass) {
        setErrorMsg('Invalid or expired invitation token. Please check the link or ask your mentor.');
        setIsSubmitting(false);
        return;
      }

      let enrollment: ClassEnrollment;
      if (activeMode === 'production') {
        enrollment = await supabaseService.requestEnrollment(targetClass.id, currentUser.id);
      } else {
        enrollment = appStore.requestEnrollment(targetClass.id, currentUser.id);
      }

      await loadStudentClasses();
      await refreshData();
      setInviteTokenInput('');

      if (enrollment.status === 'approved') {
        setSuccessMsg(`Enrolled in ${targetClass.name}!`);
        setActiveClassId(targetClass.id);
        navigate('/student/feed');
      } else {
        setSuccessMsg(`Registration submitted for ${targetClass.name}! Awaiting mentor approval.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enroll in class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
        </div>
        <h1 className="text-2xl font-bold text-navy-950">My Enrolled Classes & Cohorts</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review the classes you belong to, check mentor approval status, or enroll in another class group.
        </p>
      </div>

      {/* Join Another Class Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <h2 className="text-sm font-bold text-navy-950 mb-1 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-teal-600" />
          Join Another Class via Invitation Token
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Paste the invitation link or token provided by your faculty mentor.
        </p>

        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleJoinClassByToken} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Paste invite link or code (e.g. ece-a-token-98f2b)"
            value={inviteTokenInput}
            onChange={(e) => setInviteTokenInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Application'}
          </button>
        </form>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button onClick={loadStudentClasses} className="text-xs font-bold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Classes Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium">Loading classes...</p>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold text-slate-700">You are not enrolled in any classes yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Paste an invite token above to join your class group.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enrollments.map((e) => {
            const c = e.class;
            if (!c) return null;
            const isApproved = e.status === 'approved';
            const isPending = e.status === 'pending';

            return (
              <div
                key={e.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between ${
                  isPending ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {c.department}
                      </span>
                      <h3 className="text-base font-bold text-navy-950 mt-1">{c.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isApproved ? 'Approved Member' : 'Pending Mentor Review'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {c.description}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.academic_year} &bull; {c.semester}</span>
                    </div>
                  </div>

                  {isPending && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                      Your enrollment is currently pending faculty mentor review. Once approved, the class feed and weekly reports will unlock.
                    </div>
                  )}
                </div>

                {isApproved && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setActiveClassId(c.id);
                        navigate('/student/feed');
                      }}
                      className="w-full py-1.5 bg-navy-50 hover:bg-navy-100 text-navy-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Open Class Progress Stream
                      <ExternalLink className="w-3.5 h-3.5" />
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
