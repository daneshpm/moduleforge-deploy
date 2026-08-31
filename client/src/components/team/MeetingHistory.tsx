import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Clock,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Team } from '../../types';
import { Meeting } from '../../types/meeting';
import { meetingService } from '../../services/meeting/meetingService';
import { MeetingInvite } from './MeetingInvite';

interface MeetingHistoryProps {
  team: Team;
}

export const MeetingHistory: React.FC<MeetingHistoryProps> = ({ team }) => {
  const navigate = useNavigate();
  const [activeMeetings, setActiveMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const loadMeetings = async () => {
    setIsLoading(true);
    try {
      const { activeMeetings: active, pastMeetings: past } =
        await meetingService.fetchTeamMeetings(team.id);
      setActiveMeetings(active);
      setPastMeetings(past);
    } catch (err) {
      console.warn('Failed to load team meetings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (team?.id) {
      loadMeetings();
    }
  }, [team?.id]);

  const formatDate = (timestamp: string | number) => {
    try {
      const date = new Date(Number(timestamp));
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatTime = (timestamp: string | number) => {
    try {
      const date = new Date(Number(timestamp));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Action */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#1F5E4B] to-[#174739] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-[#1F5E4B]/15">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
              HD WebRTC Video
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight">Team Video Meetings</h2>
          <p className="text-xs text-white/80 max-w-lg">
            Host instant multi-person video meetings with screen sharing, participant controls, and real-time chat.
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-white hover:bg-[#EAF3EF] text-[#1F5E4B] text-xs font-bold shadow-md flex items-center gap-2 shrink-0 transition transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Start Team Meeting</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#1F5E4B] animate-spin mx-auto" />
          <p className="text-xs text-[#6B7471] font-mono">Loading team meetings...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Meetings Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-[#202524] uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1F5E4B] animate-ping" />
              <span>Active Meetings ({activeMeetings.length})</span>
            </h3>

            {activeMeetings.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-[#E2E6E4] text-center space-y-2">
                <Video className="w-8 h-8 text-[#6B7471] opacity-40 mx-auto" />
                <p className="text-xs font-bold text-[#202524]">No meetings currently active</p>
                <p className="text-[11px] text-[#6B7471]">
                  Click "Start Team Meeting" above to start a video call with your team.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-5 rounded-3xl bg-white border-2 border-[#1F5E4B]/30 hover:border-[#1F5E4B] shadow-card space-y-4 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 text-[10px] font-mono font-bold">
                          ● IN PROGRESS
                        </span>
                        <h4 className="text-base font-black text-[#202524]">{meeting.title}</h4>
                        <p className="text-xs text-[#6B7471]">
                          Started by <strong className="text-[#202524]">{meeting.creatorName || 'Host'}</strong> at{' '}
                          {formatTime(meeting.startedAt || meeting.createdAt)}
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/meet/${meeting.id}`)}
                        className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5 transition transform active:scale-95 shrink-0"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-[#E2E6E4] flex items-center justify-between text-xs text-[#6B7471] font-mono">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#1F5E4B]" />
                        <span>{Object.keys(meeting.participants || {}).length || 1} Participants</span>
                      </span>
                      <span>ID: {meeting.meetingId}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Meetings History */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-[#202524] uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#6B7471]" />
              <span>Past Meetings ({pastMeetings.length})</span>
            </h3>

            {pastMeetings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-[#E2E6E4] text-center text-xs text-[#6B7471]">
                No past meeting history recorded for this team yet.
              </div>
            ) : (
              <div className="bg-white border border-[#E2E6E4] rounded-3xl overflow-hidden shadow-xs divide-y divide-[#E2E6E4]">
                {pastMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F8F7]/60 transition text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-center text-[#6B7471] shrink-0">
                        <Video className="w-4 h-4 opacity-70" />
                      </div>

                      <div>
                        <h4 className="font-bold text-[#202524]">{meeting.title}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-[#6B7471] font-mono mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(meeting.startedAt || meeting.createdAt)}</span>
                          </span>
                          <span>•</span>
                          <span>Hosted by {meeting.creatorName || 'Host'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="px-2.5 py-1 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] text-[11px] font-mono text-[#6B7471] font-bold">
                        Ended
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Meeting Modal */}
      {isInviteModalOpen && (
        <MeetingInvite
          isOpen={isInviteModalOpen}
          onClose={() => {
            setIsInviteModalOpen(false);
            loadMeetings();
          }}
          team={team}
        />
      )}
    </div>
  );
};
