import React from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, ArrowRight } from 'lucide-react';

export const IncomingMessageToast: React.FC = () => {
  const { incomingToastMessage, dismissIncomingToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  if (!incomingToastMessage) return null;

  // Don't show toast if user is already on the messages page
  if (location.pathname === '/messages') return null;

  const sender = incomingToastMessage.sender;
  const senderName = sender?.full_name || 'Faculty Mentor';
  const preview = incomingToastMessage.content.length > 70
    ? `${incomingToastMessage.content.slice(0, 70)}...`
    : incomingToastMessage.content;

  const handleOpenMessage = () => {
    dismissIncomingToast();
    navigate(`/messages?conversationId=${incomingToastMessage.conversation_id}`);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-navy-950 text-white border border-teal-500/40 rounded-2xl shadow-2xl p-4 flex items-start gap-3 backdrop-blur-md">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-md">
          {sender?.avatar_url ? (
            <img
              src={sender.avatar_url}
              alt=""
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <MessageSquare className="w-5 h-5 text-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="font-bold text-xs text-white truncate">
              {senderName}
            </p>
            <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/20 px-1.5 py-0.5 rounded">
              New Message
            </span>
          </div>

          <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            "{preview}"
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={handleOpenMessage}
              className="text-xs font-bold text-teal-300 hover:text-teal-200 flex items-center gap-1 transition-colors"
            >
              View Message <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={dismissIncomingToast}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={dismissIncomingToast}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

