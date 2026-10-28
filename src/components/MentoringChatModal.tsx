import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { DirectMessage, Profile } from '../types';
import { 
  X, 
  Send, 
  Loader2, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  MessageSquare,
  ShieldAlert,
  Clock
} from 'lucide-react';

interface MentoringChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudentId: string;
  classId: string;
  studentName?: string;
  mentorName?: string;
}

export const MentoringChatModal: React.FC<MentoringChatModalProps> = ({
  isOpen,
  onClose,
  targetStudentId,
  classId,
  studentName,
  mentorName,
}) => {
  const { currentUser, activeMode, activeClass } = useApp();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Compute deterministic conversation ID: conv_{classId}_{studentId}
  const conversationId = `conv_${classId}_${targetStudentId}`;

  // Determine the recipient ID based on who is currently logged in
  const recipientId =
    currentUser?.id === targetStudentId
      ? activeClass?.mentor_id || ''
      : targetStudentId;

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Load conversation messages
  const loadMessages = async () => {
    if (!isOpen || !conversationId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let loaded: DirectMessage[] = [];
      if (activeMode === 'production') {
        loaded = await supabaseService.getMessages(conversationId);
      } else {
        loaded = appStore.getMessagesForConversation(conversationId);
      }
      setMessages(loaded);

      // Mark messages as read
      if (currentUser?.id) {
        if (activeMode === 'production') {
          await supabaseService.markMessagesAsRead(conversationId, currentUser.id);
        } else {
          appStore.markMessagesAsRead(conversationId, currentUser.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setErrorMsg(err.message || 'Failed to load conversation history.');
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      inputRef.current?.focus();

      // Mobile live sync interval to guarantee instant delivery even if WebSocket sleeps
      const pollInterval = setInterval(() => {
        loadMessages();
      }, 2500);

      return () => clearInterval(pollInterval);
    }
  }, [isOpen, conversationId, activeMode]);

  // Set up realtime updates
  useEffect(() => {
    if (!isOpen || !conversationId) return;

    // 1. Supabase Realtime Subscription (Production)
    let unsubscribeRealtime: (() => void) | null = null;
    if (activeMode === 'production') {
      unsubscribeRealtime = supabaseService.subscribeToMessages(
        conversationId,
        (newMsg) => {
          setMessages((prev) => {
            // Deduplicate incoming messages
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom(true);
          // Mark as read if sent to current user
          if (currentUser && newMsg.recipient_id === currentUser.id) {
            supabaseService.markMessagesAsRead(conversationId, currentUser.id);
          }
        },
        (updatedMsg) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      );
    }

    // 2. Custom Event Listener (Demo mode & cross-component sync)
    const handleLocalMessage = (event: any) => {
      const msg = event.detail?.message || event.detail;
      if (msg && msg.conversation_id === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom(true);
      }
    };
    window.addEventListener('mentorpulse:message_update', handleLocalMessage);

    return () => {
      if (unsubscribeRealtime) unsubscribeRealtime();
      window.removeEventListener('mentorpulse:message_update', handleLocalMessage);
    };
  }, [isOpen, conversationId, activeMode, currentUser?.id]);

  // Scroll on message updates
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !currentUser) return;

    if (!recipientId) {
      setErrorMsg('Cannot determine conversation recipient. Please ensure class mentor is assigned.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    const payload = {
      conversation_id: conversationId,
      class_id: classId,
      sender_id: currentUser.id,
      recipient_id: recipientId,
      content: trimmed,
    };

    try {
      let created: DirectMessage;
      if (activeMode === 'production') {
        created = await supabaseService.sendMessage(payload);
      } else {
        created = appStore.sendMessage(payload);
      }

      // Add to local state (deduplicated)
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });

      // Clear input only after successful insert
      setInputText('');
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err: any) {
      console.error('Send message failed:', err);
      // Keep unsent text in input for retry
      setErrorMsg(err.message || 'Failed to send message. Please check your connection and retry.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (!isOpen) return null;

  const headerTitle =
    currentUser?.role === 'mentor'
      ? `Mentoring Chat with ${studentName || 'Student'}`
      : `Mentoring Guidance with ${mentorName || 'Faculty Mentor'}`;

  const otherPersonRole = currentUser?.role === 'mentor' ? 'Student' : 'Faculty Mentor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[620px] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-navy-900 via-navy-950 to-slate-900 text-white flex items-center justify-between border-b border-navy-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
                {headerTitle}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {otherPersonRole}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {activeClass?.name || 'Class Cohort'} &bull; <span className="text-teal-400">SFS @ Kumaraguru College of Technology</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close message window"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / Privacy Banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>End-to-end authorized channel. Only assigned faculty and student can view this thread.</span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
            {activeMode === 'production' ? 'Supabase Realtime' : 'Demo LocalSync'}
          </span>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold text-rose-700 hover:text-rose-950 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <p className="text-xs font-medium">Loading conversation messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center mb-3 text-slate-300">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1">No messages yet</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Start the mentoring discussion! Messages sent here persist reliably and arrive instantly without refreshing.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUser?.id;
              const senderDisplayName =
                msg.sender?.full_name || (isMine ? 'You' : msg.sender_id === targetStudentId ? studentName || 'Student' : mentorName || 'Faculty Mentor');
              
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600">{senderDisplayName}</span>
                    <span>&bull;</span>
                    <span>{formattedTime}</span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-2xs text-xs leading-relaxed whitespace-pre-wrap break-words ${
                      isMine
                        ? 'bg-gradient-to-r from-teal-700 to-teal-800 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Delivery Status Indicator for sender */}
                  {isMine && (
                    <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400">
                      {msg.status === 'read' ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-teal-700 font-medium">Read</span>
                        </>
                      ) : msg.status === 'delivered' ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Delivered</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-slate-400" />
                          <span>Sent</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={2}
              placeholder={`Write a mentoring message to ${otherPersonRole.toLowerCase()}... (Press Enter to send, Shift+Enter for new line)`}
              className="w-full resize-none p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer h-[42px]"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
