import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCheck, X, Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-all duration-300 ease-in-out border-l border-slate-200"
        role="dialog"
        aria-label="Notifications panel"
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-navy-50 text-navy-700 rounded-lg">
              <Bell className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Activity Notifications</h2>
              <p className="text-xs text-slate-500">Live verified platform events</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {notifications.some(n => !n.read) && (
              <button
                onClick={markAllNotificationsRead}
                title="Mark all as read"
                className="text-xs text-teal-700 hover:text-teal-800 font-medium px-2 py-1 hover:bg-teal-50 rounded flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Read all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-slate-600">No notifications yet</p>
              <p className="text-xs text-slate-400">New feedback, approvals, and reactions will appear here.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  markNotificationRead(n.id);
                  if (n.link) {
                    navigate(n.link);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  n.read
                    ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    : 'bg-teal-50/50 border-teal-200 hover:bg-teal-50 text-slate-900 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs text-navy-800">{n.title}</div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-xs mt-1 text-slate-700 leading-relaxed">{n.message}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {n.link && (
                    <span className="text-teal-700 flex items-center gap-0.5 font-medium hover:underline">
                      View <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
