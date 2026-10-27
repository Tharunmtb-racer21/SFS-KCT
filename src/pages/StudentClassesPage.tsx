import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { 
  FolderOpen, 
  Plus, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Users, 
  Calendar, 
  AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const StudentClassesPage: React.FC = () => {
  const { currentUser, setActiveClassId, refreshData } = useApp();
  const navigate = useNavigate();

  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Please sign in to view your classes.</div>;
  }

  const enrollments = appStore.getEnrollmentsForStudent(currentUser.id);

  const handleJoinClassByToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;

    // Support either full URL (e.g. http://localhost:5173/invite/xyz) or just the token 'xyz'
    let token = inviteTokenInput.trim();
    if (token.includes('/invite/')) {
      token = token.split('/invite/')[1].split('?')[0];
    }

    const targetClass = appStore.getClassByInviteCode(token);
    if (!targetClass) {
      setErrorMsg('Invalid or expired invitation token. Please check the link or ask your mentor.');
      return;
    }

    try {
      const enrollment = appStore.requestEnrollment(targetClass.id, currentUser.id);
      refreshData();
      setErrorMsg('');
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
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
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
          <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Submit Application
          </button>
        </form>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {enrollments.map((e) => {
          const c = e.class;
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
    </div>
  );
};
