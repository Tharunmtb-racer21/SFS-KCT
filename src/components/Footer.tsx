import React from 'react';
import { GraduationCap, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-navy-950 border-t border-navy-800 text-slate-300 py-6 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-xs">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5 flex-wrap">
              <span>MentorPulse</span>
              <span className="text-teal-400 font-medium">by THARUN N E</span>
            </div>
            <div className="text-[11px] text-teal-300 font-medium tracking-tight">
              SFS @ Kumaraguru College of Technology
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end text-center sm:text-right gap-1">
          <div className="text-white font-semibold flex items-center gap-1.5 justify-center sm:justify-end">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Developed by</span>
            <span className="text-teal-300 font-bold tracking-wide">THARUN N E</span>
          </div>
          <div className="text-[11px] text-slate-400">
            SFS @ Kumaraguru College of Technology &bull; Academic Mentoring & Progress Platform
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
