import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ClassEnrollment, Profile } from '../types';
import { 
  Users, 
  Search, 
  Check, 
  X, 
  Clock, 
  ExternalLink, 
  Phone, 
  Mail, 
  UserX,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const StudentDirectory: React.FC = () => {
  const { currentUser, activeClass, refreshData, activeMode } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<(ClassEnrollment & { student: Profile })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>(
    searchParams.get('tab') === 'pending' ? 'pending' : 'approved'
  );

  const loadEnrollments = async () => {
    if (!activeClass) {
      setEnrollments([]);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeMode === 'production') {
        const liveList = await supabaseService.getEnrollmentsForClass(activeClass.id);
        setEnrollments(liveList);
      } else {
        const demoList = appStore.getEnrollmentsForClass(activeClass.id);
        setEnrollments(demoList);
      }
    } catch (err: any) {
      console.error('Failed to load roster:', err);
      setErrorMsg(err.message || 'Failed to load class roster from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEnrollments();
  }, [activeClass?.id, activeMode]);

  if (!currentUser || currentUser.role !== 'mentor') {
    return <div className="p-8 text-center text-slate-600">Access restricted to mentors.</div>;
  }

  if (!activeClass) {
    return (
      <div className="p-8 text-center text-slate-500">
        Please select or create a class from the top menu first.
      </div>
    );
  }

  const approvedList = enrollments.filter(e => e.status === 'approved');
  const pendingList = enrollments.filter(e => e.status === 'pending');

  const handleApprove = async (enrollmentId: string) => {
    try {
      if (activeMode === 'production') {
        await supabaseService.reviewEnrollment(enrollmentId, 'approved', currentUser.id);
      } else {
        appStore.reviewEnrollment(enrollmentId, 'approved', currentUser.id);
      }
      await loadEnrollments();
      await refreshData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async (enrollmentId: string) => {
    if (!window.confirm('Are you sure you want to decline this registration?')) return;
    try {
      if (activeMode === 'production') {
        await supabaseService.reviewEnrollment(enrollmentId, 'rejected', currentUser.id);
      } else {
        appStore.reviewEnrollment(enrollmentId, 'rejected', currentUser.id);
      }
      await loadEnrollments();
      await refreshData();
    } catch (err: any) {
      alert(`Decline failed: ${err.message}`);
    }
  };

  const currentList = activeTab === 'approved' ? approvedList : pendingList;

  const filteredList = currentList.filter(e => {
    const s = e.student;
    if (!s) return false;
    const query = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(query) ||
      (s.student_reg_no && s.student_reg_no.toLowerCase().includes(query)) ||
      (s.skills && s.skills.some(skill => skill.toLowerCase().includes(query)))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
              {activeClass.name}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950 mt-1">Student Directory & Approvals</h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-white text-navy-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Enrolled Students ({approvedList.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending Approvals ({pendingList.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={loadEnrollments} className="text-xs font-bold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by student name, register number (e.g. 717822ECE...), or skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs"
        />
      </div>

      {/* Pending Banner Alert if any pending items */}
      {pendingList.length > 0 && activeTab === 'approved' && (
        <div 
          onClick={() => setActiveTab('pending')}
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{pendingList.length} student registration(s)</strong> are waiting for your approval before they can access this class feed.
            </span>
          </div>
          <span className="font-semibold text-amber-800 underline">Review Now &rarr;</span>
        </div>
      )}

      {/* Directory Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium">Loading roster from database...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <UserX className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold text-slate-700">
            {activeTab === 'approved' ? 'No enrolled students match your search' : 'No registrations pending review'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'approved' 
              ? 'Share the class invitation link to onboard students.' 
              : 'All registration requests for this class have been processed.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((enrollment) => {
            const student = enrollment.student;
            const isPending = enrollment.status === 'pending';

            return (
              <div
                key={enrollment.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all ${
                  isPending ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {student.avatar_url ? (
                        <img 
                          src={student.avatar_url} 
                          alt={student.full_name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {student.full_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h2 className="font-bold text-slate-900 text-sm">{student.full_name}</h2>
                        <div className="font-mono text-xs text-teal-700 font-medium">
                          {student.student_reg_no || 'Register No Pending'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isPending ? 'Pending' : 'Enrolled'}
                    </span>
                  </div>

                  {/* Bio / Dept */}
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {student.bio || `${student.department || activeClass.department} • ${student.academic_year || activeClass.academic_year}`}
                  </p>

                  {/* Contact details (mentor only authorization) */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{student.email}</span>
                    </div>
                    {student.phone && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{student.phone} (Private contact)</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags */}
                  {student.skills && student.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {student.skills.slice(0, 4).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {skill}
                        </span>
                      ))}
                      {student.skills.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-[10px]">
                          +{student.skills.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isPending ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleApprove(enrollment.id)}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(enrollment.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate(`/mentor/students/${student.id}`)}
                      className="w-full py-1.5 bg-navy-50 hover:bg-navy-100 text-navy-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      View Student Journey & Timeline
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
