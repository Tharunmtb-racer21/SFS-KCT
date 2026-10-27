import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Rss, 
  Layers, 
  UserCheck, 
  CalendarCheck,
  FolderOpen,
  Award,
  Link as LinkIcon
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentUser, activeClass } = useApp();
  const isMentor = currentUser?.role === 'mentor';

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Current Active Class context banner */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {isMentor ? 'Active Class Scope' : 'Enrolled Class'}
        </div>
        {activeClass ? (
          <div>
            <div className="font-semibold text-sm text-navy-900 truncate" title={activeClass.name}>
              {activeClass.name}
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between mt-0.5">
              <span>{activeClass.department}</span>
              <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                {activeClass.semester}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">No class selected</div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="p-3 space-y-1 flex-1">
        {isMentor ? (
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Mentor Management
            </div>
            <NavLink
              to="/mentor/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              Class Dashboard
            </NavLink>

            <NavLink
              to="/mentor/classes"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Layers className="w-4 h-4" />
              Classes & Invitations
            </NavLink>

            <NavLink
              to="/mentor/students"
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                Student Directory
              </div>
              {activeClass?.pending_count ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  {activeClass.pending_count}
                </span>
              ) : null}
            </NavLink>

            <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Progress Tracking
            </div>

            <NavLink
              to="/mentor/feed"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Rss className="w-4 h-4" />
              Daily Progress Feed
            </NavLink>

            <NavLink
              to="/mentor/weekly-reports"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <CalendarCheck className="w-4 h-4" />
              Weekly Reports Review
            </NavLink>
          </>
        ) : (
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Student Workspace
            </div>

            <NavLink
              to="/student/feed"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Rss className="w-4 h-4" />
              Daily Progress Feed
            </NavLink>

            <NavLink
              to="/student/weekly-reports"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <FileText className="w-4 h-4" />
              Weekly Summary Reports
            </NavLink>

            <NavLink
              to="/student/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <UserCheck className="w-4 h-4" />
              Profile & Portfolio
            </NavLink>

            <NavLink
              to="/student/classes"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <FolderOpen className="w-4 h-4" />
              My Enrolled Classes
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
        <p className="font-bold text-slate-800">MentorPulse <span className="text-teal-700 font-semibold">by THARUN N E</span></p>
        <p className="text-teal-800 font-medium text-[10px]">SFS @ Kumaraguru College of Technology</p>
        <div className="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>Academic Hub</span>
          <span className="font-semibold text-teal-700">Dev by THARUN N E</span>
        </div>
      </div>
    </aside>
  );
};
