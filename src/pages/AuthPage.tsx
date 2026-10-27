import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';

export const AuthPage: React.FC = () => {
  const { login, switchUser, activeMode, isConfigured } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Sign In Form State
  const [signInRole, setSignInRole] = useState<'student' | 'mentor'>('student');
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sign Up Form State
  const [role, setRole] = useState<'mentor' | 'student'>('mentor');
  const [fullName, setFullName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [department, setDepartment] = useState('Electronics and Communication Engineering');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (signInRole === 'student') {
        if (!studentIdentifier.trim()) {
          setErrorMsg('Please enter your Student Register Number (e.g. 25BEI057) or College Email.');
          setIsSubmitting(false);
          return;
        }

        const success = await login(studentIdentifier.trim());
        if (success) {
          navigate('/student/classes');
        } else {
          setErrorMsg(
            'No student record found with this Register Number or Email. Please make sure you have registered through your class invite link.'
          );
        }
      } else {
        if (!email.trim()) {
          setErrorMsg('Please enter your faculty institutional email.');
          setIsSubmitting(false);
          return;
        }

        if (activeMode === 'production' && !password.trim()) {
          setErrorMsg('Password is required for faculty authentication.');
          setIsSubmitting(false);
          return;
        }

        const success = await login(email.trim(), password.trim());
        if (success) {
          navigate('/mentor/dashboard');
        } else {
          setErrorMsg('Faculty sign in failed. Please verify your email and password.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Please enter your full name and email.');
      return;
    }

    if (role === 'student' && !regNo.trim()) {
      setErrorMsg('Student Register Number is required.');
      return;
    }

    if (role === 'mentor' && activeMode === 'production' && password.length < 6) {
      setErrorMsg('Faculty password must be at least 6 characters in Production Mode.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (activeMode === 'production') {
        let profile: Profile;
        if (role === 'student') {
          profile = await supabaseService.registerStudentWithoutPassword({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            student_reg_no: regNo.trim().toUpperCase(),
            department: department.trim(),
          });
          localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(profile));
        } else {
          profile = await supabaseService.signUp(email.trim().toLowerCase(), password, {
            role: 'mentor',
            full_name: fullName.trim(),
            department: department.trim(),
          });
        }

        // Upload profile photo if student selected one
        if (avatarFile && role === 'student') {
          try {
            await supabaseService.uploadAvatar(profile.id, avatarFile);
          } catch (pErr: any) {
            console.warn('Profile photo upload warning:', pErr);
          }
        }

        if (profile.role === 'mentor') {
          navigate('/mentor/dashboard');
        } else {
          navigate('/student/classes');
        }
      } else {
        const newProfile = appStore.registerUser({
          id: (role === 'mentor' ? 'mentor-' : 'student-') + Date.now(),
          role,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          student_reg_no: role === 'student' ? regNo.trim().toUpperCase() : undefined,
          department: department.trim(),
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
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-8 sm:py-12">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden">
        {/* Left Branding & Quick Persona Testing Panel with KCT Campus Architecture */}
        <div className="relative bg-navy-950 text-white p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-navy-800 overflow-hidden">
          {/* Authentic KCT Campus Dome Architecture Background Texture */}
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

        {/* Right Auth Form */}
        <div className="p-8 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-3 mb-6">
              <button
                onClick={() => {
                  setMode('signin');
                  setErrorMsg('');
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
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
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

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Role Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSignInRole('student');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      signInRole === 'student'
                        ? 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Student Login (Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignInRole('mentor');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      signInRole === 'mentor'
                        ? 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Faculty Mentor Sign In
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
                        <strong>No Password Needed:</strong> Instant academic login using your official college roll number or registered email.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? 'Accessing Workspace...' : 'Enter Student Workspace'}
                      <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Faculty Password *
                      </label>
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
                      {isSubmitting ? 'Authenticating...' : 'Sign In as Faculty Mentor'}
                      <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    I am registering as:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('mentor')}
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
                      onClick={() => setRole('student')}
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
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@college.ac.in"
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

                {role === 'student' && (
                  <ProfilePhotoPicker
                    currentPhotoUrl={avatarPreview || undefined}
                    fallbackInitials={fullName || 'ST'}
                    onPhotoSelected={(file, preview) => {
                      setAvatarFile(file);
                      setAvatarPreview(preview);
                    }}
                    onError={(msg) => setErrorMsg(msg)}
                  />
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Registering...' : `Create ${role === 'mentor' ? 'Faculty Mentor' : 'Student'} Account`}
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
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
