import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { 
  GraduationCap, 
  Layers, 
  Calendar, 
  UserCheck, 
  Clock, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const InviteRegistrationPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { currentUser, refreshData, setActiveClassId } = useApp();
  const navigate = useNavigate();

  // Registration Form state for unauthenticated student
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [regNo, setRegNo] = useState('');
  const [phone, setPhone] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [formError, setFormError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ status: string; className: string } | null>(null);

  if (!inviteCode) {
    return <div className="p-8 text-center text-slate-500">Invalid invitation link.</div>;
  }

  const targetClass = appStore.getClassByInviteCode(inviteCode);
  if (!targetClass) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-navy-950">Invitation Invalid or Expired</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This invitation token is not active or has been revoked by the faculty mentor. Please contact your department mentor for a new link.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="mt-4 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold"
          >
            Go to MentorPulse Sign In
          </button>
        </div>
      </div>
    );
  }

  const mentor = appStore.getProfile(targetClass.mentor_id);

  // If already logged in as a student
  const handleEnrollExisting = () => {
    if (!currentUser) return;
    try {
      const enrollment = appStore.requestEnrollment(targetClass.id, currentUser.id);
      refreshData();
      setActiveClassId(targetClass.id);
      setSuccessInfo({
        status: enrollment.status,
        className: targetClass.name,
      });
    } catch (err: any) {
      setFormError(err.message || 'Enrollment request failed.');
    }
  };

  // If new student registering through invite link
  const handleRegisterAndEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setFormError('Please enter full name and institutional email.');
      return;
    }

    try {
      const newStudent = appStore.registerUser({
        id: 'student-' + Date.now(),
        role: 'student',
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        student_reg_no: regNo.trim() || undefined,
        department: targetClass.department,
        academic_year: targetClass.academic_year,
        phone: phone.trim() || undefined,
        skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
        career_goals: careerGoals.trim() || undefined,
      });

      const enrollment = appStore.requestEnrollment(targetClass.id, newStudent.id);
      refreshData();
      setActiveClassId(targetClass.id);
      setSuccessInfo({
        status: enrollment.status,
        className: targetClass.name,
      });
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white p-6 sm:p-8 border-b border-navy-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 bg-teal-900/60 px-2.5 py-0.5 rounded-full border border-teal-500/30">
              Official Class Invitation
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-300 font-medium">{targetClass.department}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">{targetClass.name}</h1>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{targetClass.description}</p>

          <div className="mt-4 pt-4 border-t border-navy-800/80 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>{targetClass.academic_year} &bull; {targetClass.semester}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-teal-400" />
              <span>Faculty Mentor: <strong>{mentor?.full_name || 'Assigned Mentor'}</strong></span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {successInfo ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-navy-950">
                {successInfo.status === 'approved' ? 'Successfully Enrolled!' : 'Registration Submitted!'}
              </h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                {successInfo.status === 'approved'
                  ? `You are now a member of ${successInfo.className}. You can immediately begin posting daily progress updates.`
                  : `Your enrollment for ${successInfo.className} has been queued for mentor approval. Once ${mentor?.full_name || 'your mentor'} reviews and approves your registration, the class feed will unlock.`}
              </p>
              <button
                onClick={() => navigate(successInfo.status === 'approved' ? '/student/feed' : '/student/classes')}
                className="mt-4 px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                Go to Student Workspace <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : currentUser ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-navy-900">Signed In As:</div>
                <div className="font-bold">{currentUser.full_name} ({currentUser.email})</div>
                <div className="text-slate-500 font-mono">Reg. No: {currentUser.student_reg_no || 'Not registered'}</div>
              </div>

              {targetClass.requires_approval && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    This class requires mentor review. Your registration will be approved by {mentor?.full_name || 'the faculty mentor'}.
                  </span>
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <button
                onClick={handleEnrollExisting}
                className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                Confirm Registration in {targetClass.name}
                <ArrowRight className="w-4 h-4 text-teal-400" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterAndEnroll} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold text-navy-950">Student Registration Form</h2>
                <span className="text-[11px] text-teal-700 font-medium">New Student Sign Up</span>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kavitha Sundaram"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Register No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 717822ECE042"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="student.22dept@college.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number (Private)</label>
                <input
                  type="text"
                  placeholder="+91 98421 XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Skills / Technical Interests</label>
                <input
                  type="text"
                  placeholder="e.g. Python, Verilog, IoT, Embedded Systems"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Career Goal</label>
                <input
                  type="text"
                  placeholder="e.g. Core Hardware Engineer or Researcher"
                  value={careerGoals}
                  onChange={(e) => setCareerGoals(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                By registering, your profile will be linked to <strong>{targetClass.name}</strong>. {targetClass.requires_approval ? 'Your registration will be reviewed by the faculty mentor before full access is granted.' : 'Access is granted automatically.'}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                Complete Registration & Join Class
                <ArrowRight className="w-4 h-4 text-teal-400" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
