import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { 
  Save, 
  Mail, 
  Phone, 
  Check, 
  ShieldAlert,
  Loader2
} from 'lucide-react';

export const StudentProfileEdit: React.FC = () => {
  const { currentUser, refreshData, activeMode } = useApp();

  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [regNo, setRegNo] = useState(currentUser?.student_reg_no || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [academicYear, setAcademicYear] = useState(currentUser?.academic_year || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [skillsStr, setSkillsStr] = useState((currentUser?.skills || []).join(', '));
  const [careerGoals, setCareerGoals] = useState(currentUser?.career_goals || '');
  const [hobbies, setHobbies] = useState(currentUser?.hobbies || '');

  // Photo state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser?.avatar_url || null);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Please sign in to edit your profile.</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }

    const skills = skillsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSaving(true);
    setErrorMsg('');

    try {
      let finalAvatarUrl: string | undefined = currentUser.avatar_url;

      // 1. Handle Photo Upload / Replacement / Removal
      if (avatarFile) {
        if (activeMode === 'production') {
          const res = await supabaseService.uploadAvatar(currentUser.id, avatarFile, currentUser.avatar_url);
          finalAvatarUrl = res.url;
        } else {
          finalAvatarUrl = avatarPreview || undefined;
        }
      } else if (isAvatarRemoved) {
        if (activeMode === 'production' && currentUser.avatar_url) {
          await supabaseService.deleteAvatar(currentUser.id, currentUser.avatar_url);
        }
        finalAvatarUrl = undefined;
      }

      const payload = {
        full_name: fullName.trim(),
        student_reg_no: regNo.trim(),
        department: department.trim(),
        academic_year: academicYear.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        skills,
        career_goals: careerGoals.trim(),
        hobbies: hobbies.trim(),
        avatar_url: finalAvatarUrl,
      };

      if (activeMode === 'production') {
        await supabaseService.updateProfile(currentUser.id, payload);
      } else {
        appStore.updateProfile(currentUser.id, payload);
      }

      await refreshData();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Student Profile & Mentoring Portfolio</h1>
        <p className="text-xs text-slate-500 mt-1">
          Keep your academic record, competencies, and career objectives up-to-date for your mentor.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <form onSubmit={handleSave} className="space-y-5">
          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600" />
              Profile updated successfully! Changes are visible to your mentor.
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Student Profile Photo Picker */}
          <ProfilePhotoPicker
            currentPhotoUrl={avatarPreview || undefined}
            fallbackInitials={fullName || currentUser.full_name}
            onPhotoSelected={(file, preview) => {
              setAvatarFile(file);
              setAvatarPreview(preview);
              setIsAvatarRemoved(file === null && preview === null);
            }}
            onError={(msg) => setErrorMsg(msg)}
          />

          {/* Institutional Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Register / Roll Number
              </label>
              <input
                type="text"
                placeholder="e.g. 717822ECE042"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                placeholder="Electronics and Communication Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year / Semester
              </label>
              <input
                type="text"
                placeholder="3rd Year / Semester 5"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Contact Details with Privacy Notice */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldAlert className="w-4 h-4 text-teal-600" />
              Contact Information & Privacy Policy
            </div>
            <p className="text-[11px] text-slate-500">
              Your institutional email is used for platform notifications. Your phone number is strictly private by default and visible only to your authorized faculty mentor for academic guidance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <div className="px-3 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {currentUser.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number (Private)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="+91 98421 XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bio & Skills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Short Bio & Research Focus
            </label>
            <textarea
              rows={2}
              placeholder="Outline your academic passions, club affiliations, and ongoing project pursuits..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Technical Skills & Tools (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Verilog, Python, Edge AI, PCB Design, MATLAB"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Career Goals & Aspirations
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Core hardware engineer at semiconductor enterprise or MS research..."
                value={careerGoals}
                onChange={(e) => setCareerGoals(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hobbies & Extracurricular Activities
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Robotics competitions, badminton, open-source firmware..."
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-teal-400" />
                  Save Profile Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
