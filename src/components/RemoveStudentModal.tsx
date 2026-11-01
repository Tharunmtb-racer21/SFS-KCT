import React, { useState } from 'react';
import { UserX, AlertTriangle, ShieldCheck, Loader2, X, Check } from 'lucide-react';
import { Profile, ClassGroup } from '../types';

interface RemoveStudentModalProps {
  isOpen: boolean;
  student: Profile | null;
  classGroup: ClassGroup | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export const RemoveStudentModal: React.FC<RemoveStudentModalProps> = ({
  isOpen,
  student,
  classGroup,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('Course transfer / enrollment revised by faculty mentor');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !student || !classGroup) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const finalReason = reason === 'other' ? customReason.trim() : reason;
    if (reason === 'other' && !customReason.trim()) {
      setErrorMsg('Please specify a removal reason for the institutional audit trail.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(finalReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove student from class. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-modal-title"
      >
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 id="remove-modal-title" className="text-base font-bold text-navy-950">
                Remove Student from Class
              </h3>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                Class Scope: <span className="font-bold">{classGroup.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Student Profile Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-navy-950 text-sm">{student.full_name}</p>
              <p className="text-slate-500 font-mono mt-0.5">
                Reg No: {student.student_reg_no || 'Pending Registration'}
              </p>
              <p className="text-[11px] text-slate-500">{student.email}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {classGroup.department}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">{classGroup.academic_year}</p>
            </div>
          </div>

          {/* Explanatory Consequences Checklist */}
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-slate-800">Consequences of Removal:</p>
            <ul className="space-y-1.5 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">&bull;</span>
                <span>The student immediately loses access to this class's daily feed, weekly reports, and mentor messaging.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>The student's global login account, profile, historical daily posts, and weekly reports are safely preserved for institutional audit records.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>The student remains enrolled in any other classes they have joined.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 font-bold">&bull;</span>
                <span>The student can re-request admission at any time via the official class invite link.</span>
              </li>
            </ul>
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Institutional Removal Reason (Logged to Audit Trail)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              disabled={isSubmitting}
            >
              <option value="Course transfer / enrollment revised by faculty mentor">
                Course transfer / enrollment revised by faculty mentor
              </option>
              <option value="Student assigned to wrong department / semester section">
                Student assigned to wrong department / semester section
              </option>
              <option value="Duplicate enrollment application">
                Duplicate enrollment application
              </option>
              <option value="Academic leave / withdrawal">
                Academic leave / withdrawal
              </option>
              <option value="other">Other reason (specify below)...</option>
            </select>

            {reason === 'other' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter specific audit reason..."
                rows={2}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none mt-2"
                disabled={isSubmitting}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Removing Student...
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  Confirm Removal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

