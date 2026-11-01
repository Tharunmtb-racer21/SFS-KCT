import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { appStore } from '../services/store';
import { ConversationSummary, DirectMessage, Profile, ClassGroup } from '../types';
import { 
  MessageSquare, 
  Send, 
  Search, 
  ArrowLeft, 
  UserCircle, 
  Check, 
  CheckCheck, 
  Clock, 
  Loader2, 
  AlertCircle,
  Inbox,
  Sparkles
} from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { 
    currentUser, 
    activeMode, 
    activeClass, 
    classes, 
    refreshUnreadMessageCount 
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const conversationIdParam = searchParams.get('conversationId');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationIdParam);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // 1. Load Conversations List
  const loadConversations = async (isBackground = false) => {
    if (!currentUser) return;
    if (!isBackground) setIsLoadingConversations(true);

    try {
      let loaded: ConversationSummary[] = [];
      if (activeMode === 'production') {
        loaded = await supabaseService.getUserConversations(currentUser.id);
      } else {
        loaded = appStore.getUserConversations(currentUser.id);
      }

      // If user has active classes but no existing conversations yet, provide quick start
      if (loaded.length === 0 && classes.length > 0) {
        if (currentUser.role === 'student') {
          // Add default conversation entry for student with their mentor
          const enrolledClass = activeClass || classes[0];
          if (enrolledClass) {
            let mentorProfile: Profile | null = null;
            if (activeMode === 'production') {
              mentorProfile = await supabaseService.getProfile(enrolledClass.mentor_id);
            } else {
              mentorProfile = appStore.getProfiles().find(p => p.id === enrolledClass.mentor_id) || null;
            }

            if (mentorProfile) {
              const defaultConvId = `conv_${enrolledClass.id}_${currentUser.id}`;
              loaded = [{
                conversationId: defaultConvId,
                classId: enrolledClass.id,
                className: enrolledClass.name,
                otherUser: mentorProfile,
                lastMessage: {
                  id: 'init-prompt',
                  conversation_id: defaultConvId,
                  class_id: enrolledClass.id,
                  sender_id: mentorProfile.id,
                  recipient_id: currentUser.id,
                  content: `Welcome to ${enrolledClass.name}! Send your faculty mentor a message here anytime.`,
                  status: 'read',
                  created_at: enrolledClass.created_at || new Date().toISOString(),
                },
                unreadCount: 0,
              }];
            }
          }
        }
      }

      setConversations(loaded);

      // Auto-select first conversation if none selected on desktop
      if (!activeConversationId && loaded.length > 0 && window.innerWidth >= 768) {
        setActiveConversationId(loaded[0].conversationId);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (!isBackground) setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentUser?.id, activeMode, classes.length]);

  // Keep activeConversationId in sync with query parameter
  useEffect(() => {
    if (conversationIdParam) {
      setActiveConversationId(conversationIdParam);
    }
  }, [conversationIdParam]);

  // 2. Load Messages for Active Conversation
  const loadMessages = async (convId: string, isInitial = false) => {
    if (isInitial) setIsLoadingMessages(true);
    setSendError(null);

    try {
      let loaded: DirectMessage[] = [];
      if (activeMode === 'production') {
        loaded = await supabaseService.getMessages(convId);
      } else {
        loaded = appStore.getMessagesForConversation(convId);
      }
      setMessages(loaded);

      // Mark as read immediately when viewed by current recipient
      if (currentUser?.id) {
        if (activeMode === 'production') {
          await supabaseService.markMessagesAsRead(convId, currentUser.id);
        } else {
          appStore.markMessagesAsRead(convId, currentUser.id);
        }
        await refreshUnreadMessageCount();
        // Update local conversation unread badge
        setConversations(prev =>
          prev.map(c => c.conversationId === convId ? { ...c, unreadCount: 0 } : c)
        );
      }
    } catch (err: any) {
      console.error('Failed loading messages:', err);
      setSendError(err.message || 'Failed loading conversation history.');
    } finally {
      if (isInitial) setIsLoadingMessages(false);
      if (isInitial || isAtBottomRef.current) {
        scrollToBottom(false);
      }
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId, true);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, activeMode]);

  // 3. Realtime Listener for Active Conversation
  useEffect(() => {
    if (!activeConversationId || !currentUser?.id) return;

    // Realtime in Production Mode
    let unsubscribe: (() => void) | null = null;
    if (activeMode === 'production') {
      unsubscribe = supabaseService.subscribeToMessages(
        activeConversationId,
        async (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If incoming to current user, mark read immediately
          if (newMsg.recipient_id === currentUser.id) {
            await supabaseService.markMessagesAsRead(activeConversationId, currentUser.id);
            await refreshUnreadMessageCount();
          }

          if (isAtBottomRef.current) {
            scrollToBottom(true);
          }
        },
        (updatedMsg) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        }
      );
    }

    // Demo Mode listener
    const handleNewMessage = (e: any) => {
      const msg = e.detail as DirectMessage;
      if (msg && msg.conversation_id === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.recipient_id === currentUser.id) {
          appStore.markMessagesAsRead(activeConversationId, currentUser.id);
          refreshUnreadMessageCount();
        }
        if (isAtBottomRef.current) {
          scrollToBottom(true);
        }
      }
    };
    window.addEventListener('mentorpulse:new_message', handleNewMessage);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('mentorpulse:new_message', handleNewMessage);
    };
  }, [activeConversationId, activeMode, currentUser?.id]);

  // Scroll handling: check if user is at bottom
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // 4. Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConversationId || !currentUser || isSending) return;

    const content = inputText.trim();
    const activeConv = conversations.find(c => c.conversationId === activeConversationId);
    if (!activeConv) return;

    const recipientId = activeConv.otherUser.id;
    const classId = activeConv.classId || activeClass?.id;

    // Optimistic UI Message
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: DirectMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      class_id: classId,
      sender_id: currentUser.id,
      recipient_id: recipientId,
      content,
      status: 'sending',
      created_at: new Date().toISOString(),
      sender: currentUser,
      recipient: activeConv.otherUser,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setIsSending(true);
    setSendError(null);
    scrollToBottom(true);

    try {
      let sentMsg: DirectMessage;
      if (activeMode === 'production') {
        sentMsg = await supabaseService.sendMessage({
          conversation_id: activeConversationId,
          class_id: classId,
          sender_id: currentUser.id,
          recipient_id: recipientId,
          content,
        });
      } else {
        sentMsg = appStore.sendMessage({
          conversation_id: activeConversationId,
          class_id: classId,
          sender_id: currentUser.id,
          recipient_id: recipientId,
          content,
        });
      }

      // Replace optimistic message with confirmed database record
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? sentMsg : m))
      );

      // Refresh conversations list in background to show updated latest message
      loadConversations(true);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError(err.message || 'Failed to send message.');
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsSending(false);
      scrollToBottom(true);
    }
  };

  const activeConv = conversations.find(c => c.conversationId === activeConversationId);
  const filteredConversations = conversations.filter(c =>
    c.otherUser.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[calc(100vh-8.5rem)]">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-navy-950">
                    {currentUser?.role === 'mentor' ? 'Student Messages' : 'Mentor Messages'}
                  </h1>
                  <p className="text-[11px] text-slate-500">1-on-1 Academic Mentoring Hub</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-transparent rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingConversations ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                <p className="text-xs">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 mx-auto opacity-30 text-slate-500" />
                <p className="text-xs font-semibold text-slate-600">No conversations found</p>
                <p className="text-[11px] text-slate-400">
                  {searchQuery ? 'Try a different search query' : 'Incoming messages from faculty or students will appear here.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.conversationId === activeConversationId;
                const other = conv.otherUser;
                const hasUnread = conv.unreadCount > 0;

                return (
                  <button
                    key={conv.conversationId}
                    onClick={() => {
                      setActiveConversationId(conv.conversationId);
                      setSearchParams({ conversationId: conv.conversationId });
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 border-l-4 border-l-teal-600'
                        : hasUnread
                        ? 'bg-amber-50/40 hover:bg-slate-100 border-l-4 border-l-amber-500'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {/* Avatar */}
                    {other.avatar_url ? (
                      <img
                        src={other.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {other.full_name?.charAt(0) || 'U'}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${hasUnread ? 'font-bold text-navy-950' : 'font-semibold text-slate-800'}`}>
                          {other.full_name}
                        </p>
                        {hasUnread && (
                          <span className="px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[10px] font-bold shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-teal-700 bg-teal-100/60 px-1.5 py-0.2 rounded font-medium truncate max-w-[140px]">
                          {conv.className}
                        </span>
                        {other.student_reg_no && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {other.student_reg_no}
                          </span>
                        )}
                      </div>

                      <p className={`text-xs mt-1 truncate ${hasUnread ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                        {conv.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Conversation Chat */}
        <div className={`flex-1 flex flex-col bg-slate-50/30 ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveConversationId(null);
                      setSearchParams({});
                    }}
                    className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {activeConv.otherUser.avatar_url ? (
                    <img
                      src={activeConv.otherUser.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 text-white font-bold text-xs flex items-center justify-center">
                      {activeConv.otherUser.full_name?.charAt(0) || 'U'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-navy-950">
                        {activeConv.otherUser.full_name}
                      </h2>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-700">
                        {activeConv.otherUser.role === 'mentor' ? 'Faculty Mentor' : 'Student'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Class: <span className="font-semibold text-teal-800">{activeConv.className}</span>
                      {activeConv.otherUser.student_reg_no && ` • Reg: ${activeConv.otherUser.student_reg_no}`}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Direct Mentoring Channel
                  </span>
                </div>
              </div>

              {/* Chat Messages Scroll Window */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
              >
                {isLoadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    <p className="text-xs font-medium">Loading conversation messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 text-center p-4">
                    <Sparkles className="w-8 h-8 text-teal-500 opacity-60" />
                    <p className="text-sm font-bold text-slate-700">No Messages Yet</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Start your academic mentoring conversation by sending a direct note below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === currentUser?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs break-words ${
                            isMine
                              ? 'bg-navy-900 text-white rounded-br-xs'
                              : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && (
                            <span>
                              {msg.status === 'sending' ? (
                                <span title="Sending..."><Clock className="w-2.5 h-2.5 animate-spin text-slate-400" /></span>
                              ) : msg.status === 'read' ? (
                                <span title="Read"><CheckCheck className="w-3 h-3 text-teal-500" /></span>
                              ) : (
                                <span title="Delivered"><Check className="w-3 h-3 text-slate-400" /></span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200">
                {sendError && (
                  <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}

                {currentUser?.role === 'student' && activeConv?.classId && classes.length > 0 && !classes.some(c => c.id === activeConv.classId) ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>You are no longer enrolled in this class group. Direct messaging is preserved in read-only mode.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Message ${activeConv.otherUser.full_name} (Press Enter to send)...`}
                      rows={1}
                      className="flex-1 max-h-32 min-h-[42px] text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-none resize-none leading-relaxed transition-all"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() || isSending}
                      className="h-[42px] px-4 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Send</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-base font-bold text-navy-950">Select a Conversation</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose a conversation from the left to read messages and reply in real time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

