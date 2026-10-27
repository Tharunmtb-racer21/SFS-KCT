import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, 
  Layers, 
  ChevronDown, 
  Bell, 
  UserCircle, 
  LogOut, 
  Database, 
  RotateCcw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';
import { useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { 
    currentUser, 
    activeClass, 
    classes, 
    setActiveClassId, 
    switchUser, 
    logout, 
    unreadNotificationCount,
    isSupabaseMode,
    resetDemoData
  } = useApp();

  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();

  const isMentor = currentUser?.role === 'mentor';

  return (
    <>
      <header className="bg-navy-950 text-white sticky top-0 z-40 border-b border-navy-800 shadow-sm">
        {/* Top Environment / Mode Banner */}
        <div className="bg-navy-900 border-b border-navy-800/80 px-4 py-1 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isSupabaseMode 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              <Database className="w-3 h-3" />
              {isSupabaseMode ? 'Supabase Connected' : 'Interactive Demo Mode (Isolated Local Storage)'}
            </span>
            <span className="hidden sm:inline text-slate-400">
              {isSupabaseMode ? 'Live production RLS backend' : 'Realistic institutional mock database with live class isolation'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetDemoData}
              className="text-[11px] text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
              title="Reset data back to initial seed state"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Seed Data
            </button>
          </div>
        </div>

        {/* Main Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => navigate(isMentor ? '/mentor/dashboard' : '/student/feed')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-md shadow-teal-900/40 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight flex items-center gap-1.5">
                  MentorPulse
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Hub
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-normal">Student Progress & Mentoring</p>
              </div>
            </div>

            {/* Class Switcher (Critical Feature for Mentor managing multiple departments) */}
            {isMentor && classes.length > 0 && (
              <div className="relative ml-4">
                <button
                  onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs text-slate-200 transition-colors"
                  title="Switch between different departments and classes"
                >
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span className="font-medium max-w-[140px] sm:max-w-[190px] truncate">
                    {activeClass ? activeClass.name : 'Select Class'}
                  </span>
                  {activeClass?.pending_count ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]" title={`${activeClass.pending_count} pending approval`}>
                      {activeClass.pending_count}
                    </span>
                  ) : null}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isClassDropdownOpen && (
                  <div 
                    className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-900 animate-in fade-in slide-in-from-top-1"
                    onMouseLeave={() => setIsClassDropdownOpen(false)}
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 uppercase font-semibold">
                      <span>Assigned Classes</span>
                      <span className="text-teal-600 font-medium">1-Click Switch</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {classes.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveClassId(c.id);
                            setIsClassDropdownOpen(false);
                            navigate('/mentor/dashboard');
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 transition-colors ${
                            activeClass?.id === c.id ? 'bg-teal-50/70 text-teal-900 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-900">{c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.department} &bull; {c.semester}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {c.pending_count ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                {c.pending_count} pending
                              </span>
                            ) : null}
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {c.student_count || 0} students
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="px-3 pt-2 pb-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsClassDropdownOpen(false);
                          navigate('/mentor/classes?action=new');
                        }}
                        className="w-full text-center py-1.5 px-2 rounded-lg bg-navy-50 hover:bg-navy-100 text-navy-800 font-medium text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        + Create New Class
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Quick Persona Switcher for Project Evaluation & Pairing */}
            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs text-slate-200 transition-colors"
                title="Switch persona to test mentor vs approved student vs pending student views"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden md:inline text-slate-400">Viewing as:</span>
                <span className="font-semibold text-teal-300 max-w-[130px] truncate">
                  {currentUser?.full_name || 'Sign In'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isUserDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-900 animate-in fade-in"
                  onMouseLeave={() => setIsUserDropdownOpen(false)}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                    Test Persona Switcher
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        switchUser('mentor-1');
                        setIsUserDropdownOpen(false);
                        navigate('/mentor/dashboard');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Dr. A. Ramanathan</div>
                        <div className="text-[11px] text-slate-500">ECE Faculty Mentor (Manages ECE & Mech)</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Mentor</span>
                    </button>

                    <button
                      onClick={() => {
                        switchUser('student-ece-1');
                        setIsUserDropdownOpen(false);
                        navigate('/student/feed');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Kavitha Sundaram</div>
                        <div className="text-[11px] text-slate-500">ECE Student (Active enrolled)</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Student</span>
                    </button>

                    <button
                      onClick={() => {
                        switchUser('student-ece-2');
                        setIsUserDropdownOpen(false);
                        navigate('/student/feed');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Rahul Varma</div>
                        <div className="text-[11px] text-slate-500">ECE Student (Active enrolled)</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Student</span>
                    </button>

                    <button
                      onClick={() => {
                        switchUser('student-ece-3');
                        setIsUserDropdownOpen(false);
                        navigate('/student/dashboard');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Deepak Krishnan</div>
                        <div className="text-[11px] text-slate-500">ECE Student (Pending Approval)</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Pending</span>
                    </button>

                    <button
                      onClick={() => {
                        switchUser('student-mech-1');
                        setIsUserDropdownOpen(false);
                        navigate('/student/feed');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Sanjay Karthik</div>
                        <div className="text-[11px] text-slate-500">Mech Student (Mech-B cohort)</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">Mech</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="p-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-200 relative transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-teal-500 text-slate-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* User Profile / Logout */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(isMentor ? '/mentor/dashboard' : '/student/profile')}
                  className="hidden sm:flex items-center gap-2 text-xs text-slate-300 hover:text-white"
                >
                  <UserCircle className="w-6 h-6 text-teal-400" />
                  <span className="font-medium">{currentUser.full_name.split(' ')[0]}</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    navigate('/auth');
                  }}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-navy-900 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Drawer */}
      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};
