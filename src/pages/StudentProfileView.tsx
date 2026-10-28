import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { Profile, DailyPost, WeeklyReport, ReactionType } from '../types';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Award, 
  Target, 
  Heart, 
  Calendar, 
  Rss, 
  Paperclip, 
  MapPin, 
  Clock, 
  Send,
  Loader2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { MentoringChatModal } from '../components/MentoringChatModal';

const REACTION_CONFIG: { type: ReactionType; emoji: string; label: string; aliases: string[] }[] = [
  { type: '🔥', emoji: '🔥', label: 'Inspiring', aliases: ['🔥', 'WOW'] },
  { type: '👏', emoji: '👏', label: 'Kudos', aliases: ['👏', 'Great', 'Appreciate'] },
  { type: '💡', emoji: '💡', label: 'Insight', aliases: ['💡', 'Excellent'] },
];

export const StudentProfileView: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { currentUser, activeClass, refreshData, activeMode } = useApp();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Profile | null>(null);
  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState<{ [postId: string]: string }>({});
  const [submittingPostId, setSubmittingPostId] = useState<string | null>(null);

  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    if (!currentUser || currentUser.role !== 'mentor') return;
    try {
      if (activeMode === 'production') {
        await supabaseService.reactToPost(postId, currentUser.id, reactionType);
      } else {
        appStore.reactToPost(postId, currentUser.id, reactionType);
      }
      await loadStudentData();
    } catch (err: any) {
      console.error('Reaction error:', err);
    }
  };

  const loadStudentData = async () => {
    if (!studentId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeMode === 'production') {
        const profile = await supabaseService.getProfile(studentId);
        setStudent(profile);
        const posts = await supabaseService.getDailyPostsForStudent(studentId, activeClass?.id);
        setDailyPosts(posts);
        const reports = await supabaseService.getWeeklyReportsForStudent(studentId, activeClass?.id);
        setWeeklyReports(reports);
      } else {
        const profile = appStore.getProfile(studentId);
        setStudent(profile);
        const posts = appStore.getDailyPostsForStudent(studentId, activeClass?.id);
        setDailyPosts(posts);
        const reports = appStore.getWeeklyReportsForStudent(studentId, activeClass?.id);
        setWeeklyReports(reports);
      }
    } catch (err: any) {
      console.error('Failed to load student journey:', err);
      setErrorMsg(err.message || 'Failed to load student data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [studentId, activeClass?.id, activeMode]);

  if (!studentId) {
    return <div className="p-8 text-center text-slate-500">Student ID is required.</div>;
  }

  const handleSendFeedback = async (postId: string) => {
    const text = feedbackText[postId];
    if (!text || !text.trim() || !currentUser) return;

    setSubmittingPostId(postId);
    try {
      if (activeMode === 'production') {
        await supabaseService.addPostFeedback(postId, currentUser.id, text.trim());
      } else {
        appStore.addPostFeedback(postId, currentUser.id, text.trim());
      }
      setFeedbackText({ ...feedbackText, [postId]: '' });
      await loadStudentData();
      await refreshData();
    } catch (err: any) {
      alert(`Feedback submission failed: ${err.message}`);
    } finally {
      setSubmittingPostId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-xs font-medium">Loading student journey...</p>
      </div>
    );
  }

  if (errorMsg || !student) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{errorMsg || 'Student Not Found'}</h2>
        <button
          onClick={() => navigate('/mentor/students')}
          className="text-xs text-teal-700 hover:underline font-semibold"
        >
          &larr; Return to directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/mentor/students')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-navy-950 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Student Directory
      </button>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {student.avatar_url ? (
              <img 
                src={student.avatar_url} 
                alt={student.full_name} 
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-md shrink-0" 
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                {student.full_name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-navy-950">{student.full_name}</h1>
                <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                  {student.student_reg_no || 'Reg. No Pending'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.department} &bull; {student.academic_year} &bull; <span className="text-teal-700 font-semibold">SFS @ Kumaraguru College of Technology</span>
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-600 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {student.email}
                </span>
                {student.phone && (
                  <span className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    {student.phone} (Private contact)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-2 text-right">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Verified Student
            </span>
            <span className="text-[11px] text-slate-400">
              {dailyPosts.length} posts &bull; {weeklyReports.length} reports
            </span>
            <button
              onClick={() => setIsChatOpen(true)}
              className="mt-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Direct Message Student
            </button>
          </div>
        </div>

        {/* Bio */}
        {student.bio && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
            {student.bio}
          </div>
        )}

        {/* Skills & Goals Badges */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-teal-600" /> Verified Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {student.skills && student.skills.length > 0 ? (
                student.skills.map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 text-[11px] font-medium border border-teal-200/50">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">None listed</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-blue-600" /> Career Goals
            </h3>
            <p className="text-xs text-slate-700">
              {student.career_goals || 'Not specified'}
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" /> Interests & Hobbies
            </h3>
            <p className="text-xs text-slate-700">
              {student.hobbies || 'Not specified'}
            </p>
          </div>
        </div>
      </div>

      {/* Chronological Progress Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-950 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            Individual Progress Journey Timeline
          </h2>
          <span className="text-xs text-slate-400">Chronological history</span>
        </div>

        {dailyPosts.length === 0 && weeklyReports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Rss className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-600">No submissions yet from this student.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Render daily posts */}
            {dailyPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-bold uppercase">
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-400">&bull;</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.activity_date}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-navy-950 mt-1">{post.title}</h3>
                  </div>

                  {post.location_name && (
                    <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-teal-600" />
                      {post.location_name}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {post.description}
                </p>

                {/* Sub details: Skills, Challenges, Next Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                  {post.skills_gained && post.skills_gained.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Skills Gained:</div>
                      <div className="flex flex-wrap gap-1">
                        {post.skills_gained.map((s, idx) => (
                          <span key={idx} className="px-1.5 py-0.2 rounded bg-white text-slate-700 text-[10px] border border-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {post.challenges && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Challenges Faced:</div>
                      <p className="text-slate-600 text-[11px]">{post.challenges}</p>
                    </div>
                  )}

                  {post.next_steps && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Next Immediate Step:</div>
                      <p className="text-slate-600 text-[11px]">{post.next_steps}</p>
                    </div>
                  )}
                </div>

                {/* Attachment */}
                {post.attachment_name && (
                  <div className="pt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> Attached Proof:
                    </span>
                    {post.attachment_url ? (
                      <a
                        href={post.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-teal-700 hover:underline bg-teal-50 px-2 py-0.5 rounded"
                      >
                        {post.attachment_name}
                      </a>
                    ) : (
                      <span className="font-medium bg-teal-50 px-2 py-0.5 rounded text-teal-800">
                        {post.attachment_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Faculty Mentor Reactions */}
                <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-semibold mr-1">Faculty Reaction:</span>
                  {REACTION_CONFIG.map((cfg) => {
                    const count = (post.reactions || []).filter(
                      (r) => r.reaction_type === cfg.type || cfg.aliases.includes(r.reaction_type)
                    ).length;
                    const hasReacted = (post.reactions || []).some(
                      (r) => r.user_id === currentUser?.id && (r.reaction_type === cfg.type || cfg.aliases.includes(r.reaction_type))
                    );

                    return (
                      <button
                        key={cfg.type}
                        type="button"
                        onClick={() => handleReaction(post.id, cfg.type)}
                        title={`Award ${cfg.label} (${cfg.type}) to ${student.full_name}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          hasReacted
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-sm leading-none">{cfg.emoji}</span>
                        <span className="text-[11px] font-medium">{cfg.label}</span>
                        {count > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/80 rounded-full text-amber-950">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Existing Mentor Feedback */}
                {post.feedback && post.feedback.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                      Mentor Feedback Given:
                    </div>
                    {post.feedback.map((fb) => (
                      <div key={fb.id} className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-xs text-slate-800">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-teal-900 mb-1">
                          <span>{fb.mentor?.full_name || 'Faculty Mentor'}</span>
                          <span className="text-slate-400 font-normal">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p>{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mentor Feedback Input Box */}
                {currentUser?.role === 'mentor' && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Write academic feedback or mentoring remarks on this post..."
                      value={feedbackText[post.id] || ''}
                      onChange={(e) => setFeedbackText({ ...feedbackText, [post.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendFeedback(post.id);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <button
                      onClick={() => handleSendFeedback(post.id)}
                      disabled={submittingPostId === post.id || !feedbackText[post.id]?.trim()}
                      className="px-3 py-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direct Mentoring Chat Modal */}
      {isChatOpen && student && activeClass && (
        <MentoringChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          targetStudentId={student.id}
          classId={activeClass.id}
          studentName={student.full_name}
        />
      )}
    </div>
  );
};
