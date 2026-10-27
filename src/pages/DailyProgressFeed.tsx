import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { ReactionType, DailyPost } from '../types';
import { 
  Rss, 
  Plus, 
  Send, 
  Paperclip, 
  MapPin, 
  Trash2, 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  UploadCloud,
  FileCheck,
  Loader2,
  X,
  MessageSquare,
  CalendarCheck,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { validateAttachmentFile } from '../utils/imageUtils';

interface ReactionOption {
  type: ReactionType;
  emoji: string;
  label: string;
  aliases: string[];
}

const REACTION_CONFIG: ReactionOption[] = [
  { type: '🔥', emoji: '🔥', label: 'Inspiring', aliases: ['🔥', 'WOW'] },
  { type: '👏', emoji: '👏', label: 'Kudos', aliases: ['👏', 'Great', 'Appreciate'] },
  { type: '💡', emoji: '💡', label: 'Insight', aliases: ['💡', 'Excellent'] },
];

export const DailyProgressFeed: React.FC = () => {
  const { currentUser, activeClass, refreshData, activeMode } = useApp();

  const [posts, setPosts] = useState<DailyPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showComposer, setShowComposer] = useState(false);

  // Composer Form Fields
  const [category, setCategory] = useState('Lab Experiment');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationName, setLocationName] = useState('');
  
  // Explicit Location Sharing Consent
  const [shareLocationCoords, setShareLocationCoords] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);

  // File Attachment simulation & real storage
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; size: number } | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mentor Feedback input state
  const [feedbackInputs, setFeedbackInputs] = useState<{ [postId: string]: string }>({});

  // Classmate / Peer Comments State
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});
  const [submittingComment, setSubmittingComment] = useState<{ [postId: string]: boolean }>({});

  const loadPosts = async () => {
    if (!activeClass) {
      setPosts([]);
      return;
    }
    setIsLoading(true);
    setFeedError(null);
    try {
      if (activeMode === 'production') {
        const livePosts = await supabaseService.getDailyPostsForClass(activeClass.id);
        setPosts(livePosts);
      } else {
        const demoPosts = appStore.getDailyPostsForClass(activeClass.id);
        setPosts(demoPosts);
      }
    } catch (err: any) {
      console.error('Failed to load feed:', err);
      setFeedError(err.message || 'Failed to load class daily posts from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [activeClass?.id, activeMode]);

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Please sign in to view the progress feed.</div>;
  }

  if (!activeClass) {
    return (
      <div className="p-8 text-center text-slate-500">
        Please select or join a class to view its daily feed.
      </div>
    );
  }

  const isMentor = currentUser.role === 'mentor';
  const isStudent = currentUser.role === 'student';

  // Handle Precise Geolocation Request with Explicit Consent
  const handleRequestLocationConsent = () => {
    if (shareLocationCoords) {
      setShareLocationCoords(false);
      setCoords(undefined);
      return;
    }
    setLocationPromptOpen(true);
  };

  const confirmLocationSharing = () => {
    setLocationPromptOpen(false);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
          });
          setShareLocationCoords(true);
        },
        (err) => {
          console.warn('Geolocation denied or unavailable:', err);
          setShareLocationCoords(false);
          alert('Location access was not granted by your browser.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Handle Attachment Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid attachment.');
      return;
    }

    setFormError('');
    setSelectedFileObj(file);
    setAttachedFile({
      name: file.name,
      type: file.type.startsWith('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc',
      size: file.size,
    });
  };

  const handleRemoveAttachment = () => {
    setSelectedFileObj(null);
    setAttachedFile(null);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('Please enter a title and description.');
      return;
    }

    // Verify student is authorized/approved for this class
    if (currentUser.role === 'student') {
      if (activeMode === 'production') {
        try {
          const enrollments = await supabaseService.getEnrollmentsForStudent(currentUser.id);
          const isApproved = enrollments.some(
            (e) => e.class_id === activeClass.id && e.status === 'approved'
          );
          if (!isApproved) {
            setFormError('Authorization required: You must be an approved student of this class to publish updates.');
            return;
          }
        } catch (err: any) {
          console.warn('Membership check warning:', err);
        }
      }
    }

    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    setFormError('');

    try {
      if (activeMode === 'production') {
        let uploadedUrl: string | undefined = undefined;
        if (selectedFileObj) {
          setUploadProgress(40);
          const uploadRes = await supabaseService.uploadAttachment(currentUser.id, selectedFileObj, 'posts');
          uploadedUrl = uploadRes.url;
          setUploadProgress(100);
        }

        await supabaseService.createDailyPost({
          class_id: activeClass.id,
          student_id: currentUser.id,
          category,
          title: title.trim(),
          description: description.trim(),
          skills_gained: skills,
          challenges: challenges.trim() || undefined,
          next_steps: nextSteps.trim() || undefined,
          activity_date: activityDate,
          attachment_name: attachedFile?.name,
          attachment_type: (attachedFile?.type as any) || undefined,
          attachment_size: attachedFile?.size,
          attachment_url: uploadedUrl,
          location_name: locationName.trim() || undefined,
          location_coords: shareLocationCoords && coords ? coords : undefined,
        });
      } else {
        // Demo Mode
        appStore.createDailyPost({
          class_id: activeClass.id,
          student_id: currentUser.id,
          category,
          title: title.trim(),
          description: description.trim(),
          skills_gained: skills,
          challenges: challenges.trim() || undefined,
          next_steps: nextSteps.trim() || undefined,
          activity_date: activityDate,
          attachment_name: attachedFile?.name,
          attachment_type: (attachedFile?.type as any) || undefined,
          attachment_size: attachedFile?.size,
          attachment_url: attachedFile ? `https://storage.mentorpulse.local/${attachedFile.name}` : undefined,
          location_name: locationName.trim() || undefined,
          location_coords: shareLocationCoords && coords ? coords : undefined,
        });
      }

      // Reset Form
      setTitle('');
      setDescription('');
      setSkillsInput('');
      setChallenges('');
      setNextSteps('');
      setLocationName('');
      setShareLocationCoords(false);
      setCoords(undefined);
      setAttachedFile(null);
      setSelectedFileObj(null);
      setUploadProgress(null);
      setShowComposer(false);
      setSuccessMessage('Progress update published successfully to the class stream.');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadPosts();
    } catch (err: any) {
      setFormError(`Failed to publish: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this progress post?')) return;

    try {
      if (activeMode === 'production') {
        await supabaseService.deleteDailyPost(postId, currentUser.id);
      } else {
        appStore.deleteDailyPost(postId, currentUser.id);
      }
      await loadPosts();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    try {
      if (activeMode === 'production') {
        await supabaseService.reactToPost(postId, currentUser.id, reactionType);
      } else {
        appStore.reactToPost(postId, currentUser.id, reactionType);
      }
      await loadPosts();
    } catch (err: any) {
      console.error('Reaction error:', err);
    }
  };

  const handleSendFeedback = async (postId: string) => {
    const content = feedbackInputs[postId];
    if (!content || !content.trim() || !isMentor) return;

    try {
      if (activeMode === 'production') {
        await supabaseService.addPostFeedback(postId, currentUser.id, content.trim());
      } else {
        appStore.addPostFeedback(postId, currentUser.id, content.trim());
      }
      setFeedbackInputs({ ...feedbackInputs, [postId]: '' });
      setSuccessMessage('Mentor guidance shared with the student.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadPosts();
    } catch (err: any) {
      alert(`Feedback submission failed: ${err.message}`);
    }
  };

  const handleSendComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content || !content.trim()) return;

    setSubmittingComment({ ...submittingComment, [postId]: true });
    try {
      if (activeMode === 'production') {
        await supabaseService.addPostComment(postId, currentUser.id, content.trim());
      } else {
        appStore.addPostComment(postId, currentUser.id, content.trim());
      }
      setCommentInputs({ ...commentInputs, [postId]: '' });
      await loadPosts();
    } catch (err: any) {
      alert(`Comment submission failed: ${err.message}`);
    } finally {
      setSubmittingComment({ ...submittingComment, [postId]: false });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      if (activeMode === 'production') {
        await supabaseService.deletePostComment(commentId, currentUser.id);
      } else {
        appStore.deletePostComment(commentId, currentUser.id);
      }
      await loadPosts();
    } catch (err: any) {
      alert(`Failed to delete comment: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
              {activeClass.name}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-800">MentorPulse <span className="text-teal-700">by THARUN N E</span></span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-teal-800 font-medium">SFS @ Kumaraguru College of Technology</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950 mt-1">Class Progress Stream</h1>
        </div>

        {isStudent && (
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            {showComposer ? 'Close Composer' : 'Share Daily Progress'}
          </button>
        )}
      </div>

      {/* Student Quick Checkpoints Banner */}
      {isStudent && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-950 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              <Sparkles className="w-3.5 h-3.5" />
              Student Academic Workstation &bull; SFS @ Kumaraguru College of Technology
            </div>
            <h2 className="text-base font-bold mt-0.5">Stay Accountable & Showcase Progress</h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              MentorPulse by THARUN N E &bull; Log your daily check-in with peers or submit your weekly formal milestone report for mentor grading.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setShowComposer(true)}
              className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Today's Progress
            </button>
            <Link
              to="/student/weekly-reports"
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-white/15"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-teal-400" />
              Submit Weekly Report
            </Link>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-medium animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {feedError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{feedError}</span>
          </div>
          <button onClick={loadPosts} className="text-xs font-bold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Student Post Composer Card */}
      {showComposer && isStudent && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-md p-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              New Daily Progress Entry
            </h2>
            <span className="text-xs text-slate-400">Class: {activeClass.name}</span>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Lab Experiment">Lab Experiment</option>
                  <option value="Project Milestone">Project Milestone</option>
                  <option value="Coursework & Theory">Coursework & Theory</option>
                  <option value="Workshop & Seminar">Workshop & Seminar</option>
                  <option value="Certification Study">Certification Study</option>
                  <option value="Industrial Internship">Industrial Internship</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Post Title / Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Configured CAN transceiver loop and resolved termination impedance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description of What You Did & Learned *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Detail the technical tasks executed, experiments completed, and results achieved today..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills Gained / Tools Used (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Python, STM32, CAN Bus, Oscilloscope"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Date *
                </label>
                <input
                  type="date"
                  required
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Obstacles / Challenges Faced
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bus-off error due to ground loop"
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Immediate Step
                </label>
                <input
                  type="text"
                  placeholder="e.g. Test frame transmission at 1Mbps"
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Optional Location Context & Precise Opt-in Location */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Event Context (Optional Text)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus Embedded Lab 304 or Attending Workshop at Anna Auditorium"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Opt-in Geolocation Toggle with clear Consent Warning */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    Share Precise Geolocation Coordinates
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Opt-in only. Background location is never tracked.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestLocationConsent}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    shareLocationCoords
                      ? 'bg-teal-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {shareLocationCoords ? 'Location Attached' : 'Enable Opt-In'}
                </button>
              </div>

              {coords && (
                <div className="text-[11px] text-teal-800 bg-teal-50 p-2 rounded-lg font-mono">
                  Captured Coordinates: {coords.lat}&deg; N, {coords.lng}&deg; E
                </div>
              )}
            </div>

            {/* Attachment Upload (Strict 2MB limit, PDF/Images only) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Attach Proof / Evidence
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Max 2 MB • JPG, PNG, WebP, PDF</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-100 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
                  {attachedFile ? 'Change File' : 'Choose File'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {uploadProgress !== null && (
                  <span className="text-xs text-teal-700 font-medium">
                    Uploading {uploadProgress}%...
                  </span>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-xs font-medium">
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                    <span className="text-[10px] text-emerald-600">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="ml-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-teal-400" />
                    Publish Progress Update
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geolocation Consent Modal Prompt */}
      {locationPromptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="p-2.5 rounded-full bg-amber-50 text-amber-700 w-fit">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-navy-950">Confirm Location Sharing Consent</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              MentorPulse respects your privacy. Geolocation coordinates are optional and only shared for this specific progress post upon your explicit consent. MentorPulse never tracks your background location.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setLocationPromptOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmLocationSharing}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold"
              >
                I Consent & Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Posts Feed Stream */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium">Loading class progress stream...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Rss className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold text-slate-700">No progress updates in this class yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {isStudent ? 'Click "Share Daily Progress" above to log your first update.' : 'Assigned students have not posted updates yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => {
            const author = post.student;
            const isAuthor = currentUser.id === post.student_id;
            const userReaction = post.reactions?.find((r) => r.user_id === currentUser.id);

            return (
              <article 
                key={post.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all p-5 space-y-3"
              >
                {/* Author row & options */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {author?.avatar_url ? (
                      <img 
                        src={author.avatar_url} 
                        alt={author.full_name} 
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {author?.full_name?.charAt(0) || 'S'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{author?.full_name}</span>
                        {author?.student_reg_no && (
                          <span className="font-mono text-[11px] text-teal-700 font-medium">
                            {author.student_reg_no}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        Activity Date: {post.activity_date} &bull; Posted {new Date(post.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-50 text-teal-800 border border-teal-200/50">
                      {post.category}
                    </span>
                    {(isAuthor || isMentor) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title={isAuthor ? "Delete your post" : "Moderate/Delete post"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-navy-950">{post.title}</h3>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                    {post.description}
                  </p>
                </div>

                {/* Sub details: Skills, Challenges, Next Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                  {post.skills_gained && post.skills_gained.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Skills Gained:</div>
                      <div className="flex flex-wrap gap-1">
                        {post.skills_gained.map((skill, idx) => (
                          <span key={idx} className="px-1.5 py-0.2 rounded bg-white text-slate-700 text-[10px] border border-slate-200">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {post.challenges && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Obstacles Faced:</div>
                      <p className="text-slate-600 text-[11px]">{post.challenges}</p>
                    </div>
                  )}

                  {post.next_steps && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="font-semibold text-slate-700 text-[11px] mb-1">Next Step Planned:</div>
                      <p className="text-slate-600 text-[11px]">{post.next_steps}</p>
                    </div>
                  )}
                </div>

                {/* Location / Evidence Attachment */}
                <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                  {post.location_name ? (
                    <div className="flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3 h-3 text-teal-600" />
                      <span>{post.location_name}</span>
                      {post.location_coords && (
                        <span className="text-[10px] text-teal-700 font-mono">
                          ({post.location_coords.lat}, {post.location_coords.lng})
                        </span>
                      )}
                    </div>
                  ) : <div />}

                  {post.attachment_name && (
                    <div className="flex items-center gap-1.5 text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                      <Paperclip className="w-3.5 h-3.5" />
                      {post.attachment_url ? (
                        <a 
                          href={post.attachment_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="font-medium hover:underline"
                        >
                          {post.attachment_name}
                        </a>
                      ) : (
                        <span className="font-medium">{post.attachment_name}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Reactions & Comments Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Emoji Reactions: 🔥, 👏, 💡 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 mr-1 font-medium">Reactions:</span>
                    {REACTION_CONFIG.map((cfg) => {
                      const count = (post.reactions || []).filter(
                        (r) => r.reaction_type === cfg.type || cfg.aliases.includes(r.reaction_type)
                      ).length;
                      const hasReacted = userReaction && (
                        userReaction.reaction_type === cfg.type || cfg.aliases.includes(userReaction.reaction_type)
                      );

                      return (
                        <button
                          key={cfg.type}
                          type="button"
                          onClick={() => handleReaction(post.id, cfg.type)}
                          title={`${cfg.label} (${cfg.type})`}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            hasReacted
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="text-sm leading-none">{cfg.emoji}</span>
                          <span className="text-[11px] font-medium">{cfg.label}</span>
                          {count > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/70 rounded-full">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Comments Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setOpenComments({ ...openComments, [post.id]: !openComments[post.id] })}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-navy-950 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                    <span>Comments</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                      {post.comments?.length || 0}
                    </span>
                  </button>
                </div>

                {/* Classmate & Mentor Comments Thread */}
                {openComments[post.id] && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 bg-slate-50/60 p-3.5 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                        Discussion & Classmate Encouragement
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {post.comments?.length || 0} comment{post.comments?.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {post.comments && post.comments.length > 0 ? (
                      <div className="space-y-2">
                        {post.comments.map((comm) => {
                          const isCommentAuthor = comm.user_id === currentUser.id;
                          return (
                            <div key={comm.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {comm.user?.avatar_url ? (
                                    <img 
                                      src={comm.user.avatar_url} 
                                      alt={comm.user.full_name} 
                                      className="w-5 h-5 rounded-full object-cover shrink-0" 
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                      {comm.user?.full_name?.charAt(0) || 'U'}
                                    </div>
                                  )}
                                  <span className="font-semibold text-slate-900 text-xs">{comm.user?.full_name || 'Classmate'}</span>
                                  {comm.user?.role === 'mentor' && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 bg-teal-50 text-teal-800 rounded">
                                      Mentor
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(comm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {(isCommentAuthor || isMentor) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(comm.id)}
                                      className="text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Delete comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-700 pl-7 leading-relaxed">{comm.content}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No comments yet. Be the first classmate or mentor to share encouragement!</p>
                    )}

                    {/* Comment Composer */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Write a comment or question for your classmate..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendComment(post.id);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(post.id)}
                        disabled={!commentInputs[post.id]?.trim() || submittingComment[post.id]}
                        className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        {submittingComment[post.id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3 text-teal-400" />
                        )}
                        Comment
                      </button>
                    </div>
                  </div>
                )}

                {/* Mentor Guidance Thread */}
                {post.feedback && post.feedback.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900">
                      Official Faculty Mentor Guidance:
                    </span>
                    {post.feedback.map((fb) => (
                      <div key={fb.id} className="p-3 bg-teal-50/70 rounded-xl border border-teal-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-teal-950 mb-0.5">
                          <span>{fb.mentor?.full_name || 'Faculty Mentor'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(fb.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed">{fb.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mentor Feedback Composer */}
                {isMentor && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Leave official faculty mentoring guidance..."
                      value={feedbackInputs[post.id] || ''}
                      onChange={(e) => setFeedbackInputs({ ...feedbackInputs, [post.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendFeedback(post.id);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={() => handleSendFeedback(post.id)}
                      disabled={!feedbackInputs[post.id]?.trim()}
                      className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3 h-3 text-teal-400" />
                      Mentor Feedback
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
