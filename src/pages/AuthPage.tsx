import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { UserRole, Profile } from '../types';
import { 
  GraduationCap, 
  Sparkles, 
  Mail, 
  Lock, 
  ArrowRight, 
  Database,
  Info,
  CheckCircle2,
  CalendarCheck,
  ShieldCheck,
  AlertCircle,
  Clock,
  KeyRound,
  RefreshCw,
  Loader2,
  Building2,
  ChevronLeft
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { 
  parseAuthError, 
  ParsedAuthError, 
  validateInstitutionalEmail, 
  validateFacultyAccessCode, 
  validateStudentRegNo 
} from '../utils/authErrors';

export const AuthPage: React.FC = () => {
  const { login, switchUser, activeMode, isConfigured } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Screen Mode: 'signin' | 'signup' | 'forgot_password' | 'awaiting_confirmation' | 'update_password'
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password' | 'awaiting_confirmation' | 'update_password'>(
    searchParams.get('mode') === 'recovery' ? 'update_password' : 'signin'
  );

  // Sign In Form State
  const [signInRole, setSignInRole] = useState<'mentor' | 'student'>('mentor');
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up Form State
  const [role, setRole] = useState<'mentor' | 'student'>('mentor');
  const [fullName, setFullName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [department, setDepartment] = useState('Electronics and Communication Engineering');
  const [facultyAccessCode, setFacultyAccessCode] = useState('KCT-FACULTY-2026');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password Recovery / Update State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Awaiting Confirmation State
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');

  // Submission & Feedback State
  const [parsedError, setParsedError] = useState<ParsedAuthError | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Safe Email Cooldown Timers (Prevents Spamming Supabase Email Rate Limits)
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Check if hash has access_token & type=recovery
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('type=signup'))) {
      if (hash.includes('type=recovery')) {
        setMode('update_password');
      }
    }
  }, []);

  const clearMessages = () => {
    setParsedError(null);
    setSuccessMsg('');
  };

  // --- 1. Sign In Handler ---
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    clearMessages();

    try {
      if (signInRole === 'student') {
        const cleanId = studentIdentifier.trim();
        if (!cleanId) {
          setParsedError({
            title: 'Required Field',
            message: 'Please enter your Student Register Number (e.g. 25BEI057) or College Email.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }

        const success = await login(cleanId);
        if (success) {
          navigate('/student/classes');
        }
      } else {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
          setParsedError({
            title: 'Email Required',
            message: 'Please enter your faculty institutional email address.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }

        const emailValidation = validateInstitutionalEmail(cleanEmail, false);
        if (!emailValidation.valid) {
          setParsedError({
            title: 'Invalid Email Format',
            message: emailValidation.error || 'Please enter a valid email.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }

        if (activeMode === 'production' && !password.trim()) {
          setParsedError({
            title: 'Password Required',
            message: 'Password is required for faculty authentication.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }

        const success = await login(cleanEmail, password.trim());
        if (success) {
          navigate('/mentor/dashboard');
        }
      }
    } catch (err: any) {
      const parsed = parseAuthError(err);
      setParsedError(parsed);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // --- 2. Registration Handler ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    clearMessages();

    try {
      const cleanName = fullName.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanReg = regNo.trim().toUpperCase();
      const cleanDept = department.trim();

      if (!cleanName) {
        setParsedError({
          title: 'Full Name Required',
          message: 'Please enter your full official name.',
          isRateLimit: false,
          isRecoverable: true,
        });
        return;
      }

      // College Institutional Email Policy Validation
      const emailCheck = validateInstitutionalEmail(cleanEmail, role === 'mentor');
      if (!emailCheck.valid) {
        setParsedError({
          title: 'Institutional Email Notice',
          message: emailCheck.error || 'Invalid email address.',
          isRateLimit: false,
          isRecoverable: true,
        });
        return;
      }

      if (role === 'student') {
        const regCheck = validateStudentRegNo(cleanReg);
        if (!regCheck.valid) {
          setParsedError({
            title: 'Invalid Register Number',
            message: regCheck.error || 'Register number is required.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }
      }

      if (role === 'mentor') {
        if (activeMode === 'production' && password.length < 6) {
          setParsedError({
            title: 'Password Too Short',
            message: 'Faculty password must be at least 6 characters in length.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }

        // College Faculty Access Policy check
        const accessCheck = validateFacultyAccessCode(facultyAccessCode);
        if (!accessCheck.valid) {
          setParsedError({
            title: 'Unauthorized Faculty Registration',
            message: accessCheck.error || 'Valid faculty onboarding passcode required.',
            isRateLimit: false,
            isRecoverable: true,
          });
          return;
        }
      }

      if (activeMode === 'production') {
        if (role === 'student') {
          const profile = await supabaseService.registerStudentWithoutPassword({
            full_name: cleanName,
            email: cleanEmail,
            student_reg_no: cleanReg,
            department: cleanDept,
          });
          localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(profile));
          switchUser(profile.id);

          if (avatarFile) {
            try {
              await supabaseService.uploadAvatar(profile.id, avatarFile);
            } catch (pErr: any) {
              console.warn('Profile photo upload warning:', pErr);
            }
          }

          navigate('/student/classes');
        } else {
          // Faculty Mentor Registration - Zero-Email Instant Activation
          const mentorProfile = await supabaseService.registerFacultyInstant(
            cleanEmail,
            password,
            cleanName,
            cleanDept,
            facultyAccessCode
          );

          localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(mentorProfile));
          switchUser(mentorProfile.id);
          navigate('/mentor/dashboard');
        }
      } else {
        // Demo Mode Registration
        const newProfile = appStore.registerUser({
          id: (role === 'mentor' ? 'mentor-' : 'student-') + Date.now(),
          role,
          full_name: cleanName,
          email: cleanEmail,
          student_reg_no: role === 'student' ? cleanReg : undefined,
          department: cleanDept,
          skills: [],
          avatar_url: avatarPreview || undefined,
        });

        if (newProfile.role === 'mentor') {
          navigate('/mentor/dashboard');
        } else {
          navigate('/student/classes');
        }
      }
    } catch (err: any) {
      const parsed = parseAuthError(err);
      setParsedError(parsed);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // --- 3. Password Reset Request Handler ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || resendCooldown > 0) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    clearMessages();

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setParsedError({
        title: 'Email Required',
        message: 'Please enter your institutional email to receive a password reset link.',
        isRateLimit: false,
        isRecoverable: true,
      });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      if (activeMode === 'production') {
        await supabaseService.resetPasswordForEmail(cleanEmail);
        setResendCooldown(60);
        setSuccessMsg(`Password reset instructions have been dispatched to ${cleanEmail}. Please check your inbox.`);
      } else {
        setSuccessMsg(`[Demo Mode] Password reset link sent to ${cleanEmail}. In production, this delivers via Custom SMTP.`);
      }
    } catch (err: any) {
      const parsed = parseAuthError(err);
      setParsedError(parsed);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // --- 4. Resend Confirmation Email Handler (Subject to Safe Throttling) ---
  const handleResendConfirmation = async (emailToResend?: string) => {
    const target = (emailToResend || pendingConfirmationEmail || email).trim().toLowerCase();
    if (!target) {
      setParsedError({
        title: 'Email Required',
        message: 'Please specify the email address to receive the confirmation link.',
        isRateLimit: false,
        isRecoverable: true,
      });
      return;
    }

    if (resendCooldown > 0) {
      setParsedError({
        title: 'Throttled Request',
        message: `Please wait ${resendCooldown} seconds before requesting another email to prevent hitting rate limits.`,
        isRateLimit: false,
        isRecoverable: true,
      });
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    clearMessages();

    try {
      if (activeMode === 'production') {
        await supabaseService.resendConfirmationEmail(target);
        setResendCooldown(60);
        setSuccessMsg(`A fresh verification email was sent to ${target}. Please check your inbox and spam folder.`);
      } else {
        setResendCooldown(30);
        setSuccessMsg(`[Demo Mode] Verification email dispatched to ${target}.`);
      }
    } catch (err: any) {
      const parsed = parseAuthError(err);
      setParsedError(parsed);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // --- 5. Password Update Handler (When clicking recovery link) ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    clearMessages();

    if (newPassword.length < 6) {
      setParsedError({
        title: 'Password Requirements',
        message: 'Your new password must be at least 6 characters long.',
        isRateLimit: false,
        isRecoverable: true,
      });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setParsedError({
        title: 'Password Mismatch',
        message: 'The new password and confirmation password do not match.',
        isRateLimit: false,
        isRecoverable: true,
      });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      if (activeMode === 'production') {
        await supabaseService.updateUserPassword(newPassword);
        setSuccessMsg('Your password was updated successfully. You can now sign in.');
        setTimeout(() => setMode('signin'), 2000);
      } else {
        setSuccessMsg('Password updated successfully. Returning to sign in.');
        setTimeout(() => setMode('signin'), 1500);
      }
    } catch (err: any) {
      const parsed = parseAuthError(err);
      setParsedError(parsed);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-8 sm:py-12">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden">
        {/* Left Branding & Authentic KCT Campus Architecture Panel */}
        <div className="relative bg-navy-950 text-white p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-navy-800 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-top pointer-events-none opacity-20 mix-blend-luminosity scale-105"
            style={{ backgroundImage: `url('/assets/kct-campus.png')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/80 via-navy-950/90 to-navy-950 pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {/* Institution Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[11px] font-semibold tracking-wide backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span>SFS @ Kumaraguru College of Technology</span>
            </div>

            {/* Logo & Creator */}
            <div className="flex items-center gap-3.5 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-950/60 border border-teal-400/30 shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-2xl tracking-tight text-white leading-none">
                  MentorPulse
                </h1>
                <p className="text-xs text-teal-300 font-medium mt-1">
                  Developed by <span className="text-white font-bold tracking-wide">THARUN N E</span>
                </p>
              </div>
            </div>

            {/* Iconic KCT Campus Temple Dome Visual Card */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-lg relative group">
              <img 
                src="/assets/kct-campus.png" 
                alt="Kumaraguru College of Technology" 
                className="w-full h-32 object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent flex items-end p-2.5">
                <span className="text-[10px] font-bold text-teal-300 tracking-wider uppercase">
                  Kumaraguru College of Technology
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight leading-snug">
                Academic mentoring & student progress tracking platform.
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Enforcing independent department cohorts, unguessable registration tokens, and verifiable progress evaluation records.
              </p>
            </div>

            {/* Academic Platform Pillars */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Daily Progress Stream</h3>
                  <p className="text-[11px] text-slate-300">Continuous check-ins, peer reactions, and blocker guidance.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheck className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Weekly Formal Milestones</h3>
                  <p className="text-[11px] text-slate-300">Structured report evaluations, hour auditing, and mentor grading.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Department Isolation</h3>
                  <p className="text-[11px] text-slate-300">PostgreSQL RLS enforcing private faculty-student boundaries.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-navy-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <img src="/assets/tharun.jpg" alt="THARUN N E" className="w-6 h-6 rounded-full object-cover border border-teal-400/60 shadow-xs" />
              <span className="text-slate-300 font-medium">
                Developed by <strong className="text-teal-300 font-semibold tracking-wide">THARUN N E</strong>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">SFS &bull; KCT</span>
          </div>
        </div>

        {/* Right Auth Forms Panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Top Navigation Tabs (Hidden in Sub-Modes) */}
            {mode !== 'awaiting_confirmation' && mode !== 'forgot_password' && mode !== 'update_password' && (
              <div className="flex items-center gap-4 border-b border-slate-200 pb-3 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    clearMessages();
                  }}
                  className={`text-sm font-bold pb-1 transition-colors ${
                    mode === 'signin'
                      ? 'text-navy-950 border-b-2 border-teal-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    clearMessages();
                  }}
                  className={`text-sm font-bold pb-1 transition-colors ${
                    mode === 'signup'
                      ? 'text-navy-950 border-b-2 border-teal-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Success Feedback Alert */}
            {successMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{successMsg}</div>
              </div>
            )}

            {/* Error Feedback Display: Specialized Handling for Rate Limits and Unconfirmed Emails */}
            {parsedError && (
              <div
                className={`p-3.5 mb-4 rounded-xl border text-xs leading-relaxed shadow-xs ${
                  parsedError.isRateLimit
                    ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {parsedError.isRateLimit ? (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-bold">{parsedError.title}</p>
                    <p className="text-[11.5px] opacity-90">{parsedError.message}</p>

                    {/* Resend confirmation button if email is unconfirmed */}
                    {parsedError.code === 'email_not_confirmed' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleResendConfirmation(email)}
                          disabled={resendCooldown > 0 || isSubmitting}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                          {resendCooldown > 0 ? `Resend Available in ${resendCooldown}s` : 'Resend Verification Email'}
                        </button>
                      </div>
                    )}

                    {/* Rate Limit Safe Guidance */}
                    {parsedError.isRateLimit && (
                      <div className="mt-2 pt-2 border-t border-amber-200/80 text-[10.5px] text-amber-950 font-medium space-y-1">
                        <p className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-700 inline" />
                          <span><strong>Production Guidance:</strong> Configure Custom SMTP (Resend / Brevo) in Supabase Auth Settings to lift the 3-email/hr limit.</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                MODE A: SIGN IN
            ========================================================================== */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Role Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSignInRole('mentor');
                      clearMessages();
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      signInRole === 'mentor'
                        ? 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Faculty Mentor Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignInRole('student');
                      clearMessages();
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      signInRole === 'student'
                        ? 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Student Login (Fast)
                  </button>
                </div>

                {signInRole === 'student' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Student Register Number or College Email *
                      </label>
                      <div className="relative">
                        <GraduationCap className="w-4 h-4 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. 25BEI057 or tharun.25ei@kct.ac.in"
                          value={studentIdentifier}
                          onChange={(e) => setStudentIdentifier(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 leading-relaxed flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Instant Academic Login:</strong> Authenticate directly with your official college roll number or registered student email.
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 text-center">
                      New student joining a cohort? Use the unique classroom invite link provided by your faculty mentor to register.
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Accessing Workspace...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter Student Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Faculty Institutional Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          placeholder="e.g. ramanathan.a.ece@kct.ac.in"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Faculty Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(email);
                            setMode('forgot_password');
                            clearMessages();
                          }}
                          className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In as Faculty Mentor</span>
                          <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* =========================================================================
                MODE B: CREATE ACCOUNT
            ========================================================================== */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    I am registering as:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRole('mentor');
                        clearMessages();
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        role === 'mentor'
                          ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Faculty Mentor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRole('student');
                        clearMessages();
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        role === 'student'
                          ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Student
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. A. Ramanathan or Tharun N E"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {role === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Register / Roll Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 25BEI057"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Institutional Email * {role === 'mentor' && <span className="text-teal-700 font-normal">(@kct.ac.in)</span>}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={role === 'mentor' ? "sathiyapriya.sp.sci@kct.ac.in" : "user@college.ac.in"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {role === 'mentor' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password * {activeMode === 'production' && <span className="text-slate-400 font-normal">(Min 6 chars)</span>}
                    </label>
                    <input
                      type="password"
                      required={activeMode === 'production'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>No Password Needed:</strong> Your student account is authenticated by your Register Number (<strong>{regNo || '25BEI...'}</strong>).
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="Electronics and Communication Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* College Faculty Access Passcode (Section E: Access Control) */}
                {role === 'mentor' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Faculty Access Passcode *
                      </label>
                      <span className="text-[10px] text-slate-400">Approved college authorization</span>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="KCT-FACULTY-2026"
                        value={facultyAccessCode}
                        onChange={(e) => setFacultyAccessCode(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-1">
                      Enforcing college access control. Approved default passcode: <code className="text-teal-700 font-bold">KCT-FACULTY-2026</code>.
                    </p>
                  </div>
                )}

                {role === 'student' && (
                  <ProfilePhotoPicker
                    currentPhotoUrl={avatarPreview || undefined}
                    fallbackInitials={fullName || 'ST'}
                    onPhotoSelected={(file, preview) => {
                      setAvatarFile(file);
                      setAvatarPreview(preview);
                    }}
                    onError={(msg) => setParsedError({
                      title: 'Photo Upload Error',
                      message: msg,
                      isRateLimit: false,
                      isRecoverable: true
                    })}
                  />
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create {role === 'mentor' ? 'Faculty Mentor' : 'Student'} Account</span>
                      <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* =========================================================================
                MODE C: AWAITING EMAIL CONFIRMATION
            ========================================================================== */}
            {mode === 'awaiting_confirmation' && (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-sm">
                  <Mail className="w-7 h-7 animate-pulse text-teal-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-navy-950">Verify Your Institutional Email</h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    We have dispatched a verification link to{' '}
                    <strong className="text-navy-900 font-semibold">{pendingConfirmationEmail}</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11.5px] text-slate-600 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>Open your Kumaraguru College Outlook or Webmail inbox.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>Click the <strong>Confirm Your Email</strong> link to activate your faculty account.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>Once verified, sign in with your email and password.</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleResendConfirmation(pendingConfirmationEmail)}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Resend Available in {resendCooldown}s</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend Confirmation Email</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      clearMessages();
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================================
                MODE D: FORGOT PASSWORD REQUEST
            ========================================================================== */}
            {mode === 'forgot_password' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      clearMessages();
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-navy-950">Reset Faculty Password</h3>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your official institutional email address. We will send you a secure link to reset your password.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faculty Institutional Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="sathiyapriya.sp.sci@kct.ac.in"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || resendCooldown > 0}
                  className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Reset available in {resendCooldown}s</span>
                    </>
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    clearMessages();
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )}

            {/* =========================================================================
                MODE E: UPDATE PASSWORD (RECOVERY CALLBACK)
            ========================================================================== */}
            {mode === 'update_password' && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1 mb-2">
                  <h3 className="text-sm font-bold text-navy-950">Set New Password</h3>
                  <p className="text-xs text-slate-500">
                    Enter your new secure password for your MentorPulse faculty account.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password * (Min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Save New Password & Sign In</span>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="pt-4 text-center text-[11px] text-slate-400 border-t border-slate-100 mt-4">
            Protected by Row Level Security (RLS) & Verified Class Isolation
          </div>
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
