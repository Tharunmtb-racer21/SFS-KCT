import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { 
  Plus, 
  Share2, 
  Copy, 
  Check, 
  RefreshCw, 
  Power, 
  ShieldCheck, 
  Layers, 
  Calendar, 
  Users, 
  Loader2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getInviteUrl } from '../utils/url';

export const ClassManagement: React.FC = () => {
  const { currentUser, classes, refreshData, setActiveClassId, activeMode } = useApp();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('action') === 'new');
  
  // New Class Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Electronics and Communication Engineering');
  const [academicYear, setAcademicYear] = useState('2024-2025');
  const [semester, setSemester] = useState('Semester 5');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copy feedback state
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);

  if (!currentUser || currentUser.role !== 'mentor') {
    return <div className="p-8 text-center text-slate-600">Access restricted to mentors.</div>;
  }

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim()) {
      setFormError('Please enter a class name and department.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        mentor_id: currentUser.id,
        name: name.trim(),
        department: department.trim(),
        academic_year: academicYear.trim(),
        semester: semester.trim(),
        description: description.trim(),
        requires_approval: requiresApproval,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      };

      let createdId: string;
      if (activeMode === 'production') {
        const created = await supabaseService.createClass(payload);
        createdId = created.id;
      } else {
        const created = appStore.createClass(payload);
        createdId = created.id;
      }

      await refreshData();
      setActiveClassId(createdId);
      setShowCreateModal(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (classItem: any) => {
    const url = getInviteUrl(classItem.invite_code);
    navigator.clipboard.writeText(url);
    setCopiedClassId(classItem.id);
    setTimeout(() => setCopiedClassId(null), 2500);
  };

  const handleWhatsAppShare = (classItem: any) => {
    const url = getInviteUrl(classItem.invite_code);
    const text = encodeURIComponent(
      `Hello students! Please register for our class group "${classItem.name}" (${classItem.department}) on MentorPulse by THARUN N E (SFS @ Kumaraguru College of Technology): ${url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleTeamsShare = (classItem: any) => {
    const url = getInviteUrl(classItem.invite_code);
    const text = encodeURIComponent(
      `Hello students! Please register for our class group "${classItem.name}" (${classItem.department}) on MentorPulse by THARUN N E (SFS @ Kumaraguru College of Technology).`
    );
    window.open(`https://teams.microsoft.com/share?href=${encodeURIComponent(url)}&msgText=${text}`, '_blank');
  };

  const handleRegenerateToken = async (classId: string) => {
    if (!window.confirm('Regenerating will invalidate the previous invitation link immediately. Continue?')) return;
    try {
      if (activeMode === 'production') {
        await supabaseService.regenerateInviteCode(classId);
      } else {
        appStore.regenerateInviteCode(classId);
      }
      await refreshData();
    } catch (err: any) {
      alert(`Token regeneration failed: ${err.message}`);
    }
  };

  const handleToggleActive = async (classId: string, currentActive: boolean) => {
    try {
      if (activeMode === 'production') {
        await supabaseService.toggleInviteActive(classId, !currentActive);
      } else {
        appStore.toggleInviteActive(classId, !currentActive);
      }
      await refreshData();
    } catch (err: any) {
      alert(`Toggle invite status failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950">Classes & Invitations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your independent departmental cohorts, unguessable registration tokens, and approval settings.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create New Class
        </button>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {classes.map((c) => {
          const inviteUrl = getInviteUrl(c.invite_code);
          const isCopied = copiedClassId === c.id;

          return (
            <div 
              key={c.id} 
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {c.department}
                    </span>
                    <h2 className="text-lg font-bold text-navy-950 mt-1">{c.name}</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      c.invite_active 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {c.invite_active ? 'Invite Active' : 'Invite Paused'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {c.description || 'No description provided.'}
                </p>

                {/* Metadata Pills */}
                <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.academic_year} &bull; {c.semester}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">{c.student_count || 0}</span> students
                  </div>
                  {c.pending_count ? (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold">
                      {c.pending_count} pending approval
                    </span>
                  ) : null}
                </div>

                {/* Secure Invite Box */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      Class-Specific Invitation Link
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {c.requires_approval ? 'Approval: Required' : 'Approval: Auto'}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 truncate select-all">
                    {c.invite_active ? inviteUrl : 'Invitation link currently revoked/disabled'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(c)}
                        disabled={!c.invite_active}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-teal-600" /> : <Copy className="w-3 h-3" />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>

                      <button
                        onClick={() => handleWhatsAppShare(c)}
                        disabled={!c.invite_active}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-3 h-3" />
                        WhatsApp
                      </button>

                      <button
                        onClick={() => handleTeamsShare(c)}
                        disabled={!c.invite_active}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Share on Microsoft Teams"
                      >
                        <Users className="w-3 h-3" />
                        Teams
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleActive(c.id, c.invite_active)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          c.invite_active 
                            ? 'text-slate-500 hover:text-rose-600 border-slate-200 hover:bg-rose-50' 
                            : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                        title={c.invite_active ? 'Revoke/Pause Invite Link' : 'Reactivate Invite Link'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRegenerateToken(c.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors"
                        title="Regenerate unguessable token (invalidates old link)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-navy-50 text-navy-800 rounded-lg">
                  <Layers className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-navy-950">Create New Class Cohort</h2>
                  <p className="text-xs text-slate-500">Each class maintains completely isolated students and progress feed</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class / Section Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECE-C 2024-2028 or MECH-A 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ECE, MECH, CSE, EEE"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2024-2025"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Semester *
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Mentoring Objectives
                </label>
                <textarea
                  rows={2}
                  placeholder="Outline purpose, expectations, or lab assignments..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Require Mentor Review & Approval Before Granting Access
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6">
                  Recommended: Prevents unauthorized registrations from accessing the class feed until you approve their profile.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Class & Generate Token'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
