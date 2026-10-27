import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ClassGroup, Profile } from '../types';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { Footer } from '../components/Footer';

export const InviteRegistrationPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { currentUser, refreshData, setActiveClassId, activeMode, setSessionUser } = useApp();
  const navigate = useNavigate();

  const [targetClass, setTargetClass] = useState<ClassGroup | null>(null);
  const [mentor, setMentor] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Registration Form state for unauthenticated student
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [regNo, setRegNo] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [section, setSection] = useState('A');
  const [phone, setPhone] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ status: string; className: string } | null>(null);

  useEffect(() => {
    const fetchClassInfo = async () => {
      if (!inviteCode) {
        setIsLoading(false);
        setLoadError('Invalid invitation link.');
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        if (activeMode === 'production') {
          const c = await supabaseService.getClassByInviteCode(inviteCode);
          if (!c) {
            setLoadError('Invitation link is invalid, expired, or has been revoked by the faculty mentor.');
          } else {
            setTargetClass(c);
            setDepartment(c.department || 'Electronics and Instrumentation Engineering');
            setAcademicYear(c.academic_year || 'Year II / Semester 3');
            const m = await supabaseService.getProfile(c.mentor_id);
            setMentor(m);
          }
        } else {
          const c = appStore.getClassByInviteCode(inviteCode);
          if (!c) {
            setLoadError('Invitation link is invalid, expired, or has been revoked by the faculty mentor.');
          } else {
            setTargetClass(c);
            setDepartment(c.department || 'Electronics and Instrumentation Engineering');
            setAcademicYear(c.academic_year || 'Year II / Semester 3');
            const m = appStore.getProfile(c.mentor_id);
            setMentor(m);
          }
        }
      } catch (err: any) {
        setLoadError(err.message || 'Failed to lookup invitation code.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassInfo();
  }, [inviteCode, activeMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p>Verifying invitation token...</p>
        </div>
      </div>
    );
  }

  if (loadError || !targetClass) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-navy-950">Invitation Invalid or Expired</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {loadError || 'This invitation token is not active or has been revoked by the faculty mentor. Please contact your department mentor for a new link.'}
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

  // If already logged in as a student
  const handleEnrollExisting = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setFormError('');

    try {
      if (activeMode === 'production') {
        await supabaseService.requestEnrollment(targetClass.id, currentUser.id);
        await refreshData();
        setActiveClassId(targetClass.id);
        navigate('/student/feed?compose=true');
      } else {
        appStore.requestEnrollment(targetClass.id, currentUser.id);
        refreshData();
        setActiveClassId(targetClass.id);
        navigate('/student/feed?compose=true');
      }
    } catch (err: any) {
      setFormError(err.message || 'Enrollment request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If new student registering through invite link (NO PASSWORD NEEDED)
  const handleRegisterAndEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !regNo.trim() || !email.trim()) {
      setFormError('Please enter Full Name, Student Register Number, and Institutional Email.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (activeMode === 'production') {
        const newStudent = await supabaseService.registerStudentWithoutPassword({
          full_name: fullName.trim(),
          student_reg_no: regNo.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          department: department.trim() || targetClass.department,
          academic_year: academicYear.trim() || targetClass.academic_year,
          section: section.trim() || undefined,
          phone: phone.trim() || undefined,
          skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
          career_goals: careerGoals.trim() || undefined,
          avatar_url: avatarPreview || undefined, // Immediate Base64 photo storage
        });

        // Also try storage upload in background to generate signed URL
        if (avatarFile) {
          try {
            await supabaseService.uploadAvatar(newStudent.id, avatarFile);
          } catch (photoErr: any) {
            console.warn('Profile photo storage notice:', photoErr);
          }
        }

        // Request enrollment into the target class
        await supabaseService.requestEnrollment(targetClass.id, newStudent.id);

        // Store active session in AppContext & localStorage
        setSessionUser(newStudent);
        setActiveClassId(targetClass.id);
        await refreshData();

        // Direct navigation straight to daily progress submission feed with composer open
        navigate('/student/feed?compose=true');
      } else {
        const newStudent = appStore.registerUser({
          id: 'student-' + Date.now(),
          role: 'student',
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          student_reg_no: regNo.trim().toUpperCase(),
          department: department.trim() || targetClass.department,
          academic_year: academicYear.trim() || targetClass.academic_year,
          section: section.trim() || undefined,
          phone: phone.trim() || undefined,
          skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
          career_goals: careerGoals.trim() || undefined,
          avatar_url: avatarPreview || undefined,
        });

        appStore.requestEnrollment(targetClass.id, newStudent.id);
        setSessionUser(newStudent);
        setActiveClassId(targetClass.id);
        refreshData();
        navigate('/student/feed?compose=true');
      }
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-8 sm:py-12">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Banner with KCT Campus Architecture */}
        <div className="relative bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white p-6 sm:p-8 border-b border-navy-800 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-top pointer-events-none opacity-20 mix-blend-luminosity"
            style={{ backgroundImage: `url('/assets/kct-campus.png')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/75 via-navy-950/85 to-navy-950 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 bg-teal-900/60 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                MentorPulse by THARUN N E
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-teal-200 font-medium">SFS @ Kumaraguru College of Technology</span>
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
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <button
                onClick={handleEnrollExisting}
                disabled={isSubmitting}
                className="w-full py-3 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    Confirm Registration in {targetClass.name}
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterAndEnroll} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold text-navy-950">Student Registration Form</h2>
                <span className="text-[11px] text-teal-700 font-medium">New Student Sign Up</span>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Profile Photo Picker */}
              <ProfilePhotoPicker
                currentPhotoUrl={avatarPreview || undefined}
                fallbackInitials={fullName || 'ST'}
                onPhotoSelected={(file, preview) => {
                  setAvatarFile(file);
                  setAvatarPreview(preview);
                }}
                onError={(msg) => setFormError(msg)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tharun N E"
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
                    placeholder="e.g. 25BEI057"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department / Branch *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electronics and Instrumentation Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section *</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="tharun.25ei@kct.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone (WhatsApp)</label>
                  <input
                    type="text"
                    placeholder="+91 98421 XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Skills / Technical Interests</label>
                <input
                  type="text"
                  placeholder="e.g. Battery Management, Embedded Systems, IoT, Robotics"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Career Goal / Placement Focus</label>
                <input
                  type="text"
                  placeholder="e.g. Core Embedded Engineer or Higher Studies"
                  value={careerGoals}
                  onChange={(e) => setCareerGoals(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>No Password Required:</strong> You will be identified by your Student Register Number (<strong>{regNo || '25BEI...'}</strong>) and verified directly by faculty mentor <strong>{mentor?.full_name || 'Assigned Mentor'}</strong>.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                By registering, your profile will be linked to <strong>{targetClass.name}</strong>. {targetClass.requires_approval ? 'Your registration will be reviewed by the faculty mentor before full access is granted.' : 'Access is granted automatically.'}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    Complete Registration & Join Class
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </button>
              <div className="pt-4 text-center text-[11px] text-slate-400 border-t border-slate-100">
                Protected by Row Level Security (RLS) & Verified Class Isolation
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Centered Professional Bottom Attribution */}
      <div className="mt-6 text-center text-xs text-slate-400 space-y-0.5">
        <p className="font-medium text-slate-600">
          MentorPulse &bull; SFS @ Kumaraguru College of Technology
        </p>
        <p className="text-[11px]">
          Designed & Developed by <strong className="text-teal-800 font-bold tracking-wide">THARUN N E</strong>
        </p>
      </div>
    </div>
  );
};
