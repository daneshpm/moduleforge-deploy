import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, X, Users, Sparkles, CheckCheck, Loader2, ArrowRight, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isPanelOpen,
    togglePanel,
    setPanelOpen,
    markAsRead,
    markAllAsRead,
    respondToInvitation,
    startListening,
  } = useNotificationStore();

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      const cleanup = startListening();
      return cleanup;
    }
  }, [user?.id, startListening]);

  // Click outside to close panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, setPanelOpen]);

  const handleRespond = async (notifId: string, action: 'accept' | 'decline') => {
    setRespondingId(notifId);
    const res = await respondToInvitation(notifId, action);
    setRespondingId(null);

    if (res.success && action === 'accept' && res.teamId) {
      setPanelOpen(false);
      navigate(`/teams/${res.teamId}`);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        className={`relative p-2 rounded-xl border transition flex items-center justify-center ${
          isPanelOpen
            ? 'bg-[#EAF3EF] border-[#1F5E4B]/40 text-[#1F5E4B]'
            : 'bg-white hover:bg-[#F7F8F7] border-[#E2E6E4] text-[#202524]'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#1F5E4B] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isPanelOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E6E4] rounded-2xl shadow-xl z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#202524] uppercase tracking-wider font-mono">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#1F5E4B]/10 text-[#1F5E4B] text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E2E6E4]">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-center mx-auto text-[#6B7471]">
                  <Bell className="w-4 h-4 opacity-50" />
                </div>
                <p className="text-xs font-semibold text-[#202524]">No notifications yet</p>
                <p className="text-[11px] text-[#6B7471]">
                  Team invitations and collaboration alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isInvitation = notif.type === 'team_invitation' && notif.relatedInvitation?.status === 'pending';
                const isResponding = respondingId === notif.id;

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 transition text-xs space-y-2.5 ${
                      notif.read ? 'bg-white hover:bg-[#F7F8F7]/50' : 'bg-[#EAF3EF]/30 hover:bg-[#EAF3EF]/50'
                    }`}
                    onClick={() => {
                      if (!notif.read) markAsRead(notif.id);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar / Icon */}
                      <div className="w-8 h-8 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center shrink-0">
                        {notif.type === 'team_meeting' ? (
                          <Video className="w-4 h-4 text-[#1F5E4B]" />
                        ) : notif.type === 'team_invitation' ? (
                          <Users className="w-4 h-4" />
                        ) : notif.type === 'invitation_accepted' ? (
                          <Check className="w-4 h-4 text-[#2E7D5B]" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#202524] truncate">{notif.title}</span>
                          <span className="text-[10px] text-[#6B7471] shrink-0 font-mono">
                            {formatTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[#6B7471] text-xs mt-0.5 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    {/* Action button for Team Video Meeting notifications */}
                    {notif.type === 'team_meeting' && (
                      <div className="pl-11 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPanelOpen(false);
                            const meetingId =
                              (notif as any).relatedMeetingId ||
                              (notif as any).relatedMeeting?.roomId ||
                              (notif as any).relatedMeeting?.id ||
                              (notif as any).relatedInvitationId;
                            if (meetingId) {
                              navigate(`/meet/${meetingId}`);
                            } else if (notif.relatedTeamId) {
                              navigate(`/teams/${notif.relatedTeamId}`);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Meeting</span>
                          <ArrowRight className="w-3 h-3 ml-0.5" />
                        </button>
                      </div>
                    )}

                    {/* Action buttons for pending team invitations */}
                    {isInvitation && (
                      <div className="flex items-center gap-2 pl-11 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRespond(notif.id, 'accept');
                          }}
                          disabled={isResponding}
                          className="px-3 py-1.5 rounded-lg bg-[#1F5E4B] hover:bg-[#174739] text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          {isResponding ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Accept</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRespond(notif.id, 'decline');
                          }}
                          disabled={isResponding}
                          className="px-3 py-1.5 rounded-lg bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}

                    {/* If invitation was accepted */}
                    {notif.relatedTeamId && notif.type === 'invitation_accepted' && (
                      <div className="pl-11 pt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPanelOpen(false);
                            navigate(`/teams/${notif.relatedTeamId}`);
                          }}
                          className="text-[11px] font-bold text-[#1F5E4B] hover:underline flex items-center gap-1"
                        >
                          <span>Go to Team</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
