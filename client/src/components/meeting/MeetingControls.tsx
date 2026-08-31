import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  Hand,
  MessageSquare,
  Users,
  PhoneOff,
  ChevronUp,
  Shield,
  LogOut,
  X,
  Volume2,
} from 'lucide-react';
import { MediaDeviceItem } from '../../types/meeting';

interface MeetingControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  unreadCount?: number;
  participantCount?: number;
  isHostOrAdmin?: boolean;
  activeDrawer: 'chat' | 'participants' | null;
  audioInputs: MediaDeviceItem[];
  videoInputs: MediaDeviceItem[];
  audioOutputs: MediaDeviceItem[];
  selectedAudioInput?: string;
  selectedVideoInput?: string;
  selectedAudioOutput?: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleDrawer: (drawer: 'chat' | 'participants') => void;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
  onLeaveMeeting: () => void;
  onEndMeetingForAll?: () => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isHandRaised,
  unreadCount = 0,
  participantCount = 1,
  isHostOrAdmin = false,
  activeDrawer,
  audioInputs,
  videoInputs,
  audioOutputs,
  selectedAudioInput,
  selectedVideoInput,
  selectedAudioOutput,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleDrawer,
  onSelectAudioInput,
  onSelectVideoInput,
  onSelectAudioOutput,
  onLeaveMeeting,
  onEndMeetingForAll,
}) => {
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);

  return (
    <footer className="h-20 border-t border-neutral-800/90 bg-[#181C1B]/95 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-30 select-none relative">
      {/* Left side: Meeting status/info placeholder */}
      <div className="hidden md:flex items-center gap-2 text-xs font-mono text-neutral-400">
        <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
        <span>HD WebRTC P2P</span>
      </div>

      {/* Center: Main Media Controls */}
      <div className="flex items-center gap-2 sm:gap-3 mx-auto md:mx-0">
        {/* Microphone Button with Device Selector Popover */}
        <div className="relative">
          <div className="flex items-center rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-700/80 shadow-md">
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-3.5 transition ${
                isMuted
                  ? 'bg-red-600/90 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAudioMenu(!showAudioMenu);
                setShowVideoMenu(false);
                setShowHostMenu(false);
              }}
              className="px-1.5 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border-l border-neutral-700/80 transition"
              title="Microphone settings"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {showAudioMenu && (
            <div className="absolute bottom-16 left-0 w-64 bg-[#181C1B] border border-neutral-700 rounded-2xl p-3 shadow-2xl z-40 text-xs space-y-3 animate-scale-in">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800 font-bold text-neutral-300">
                <span>Select Microphone</span>
                <button onClick={() => setShowAudioMenu(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {audioInputs.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => {
                      onSelectAudioInput(d.deviceId);
                      setShowAudioMenu(false);
                    }}
                    className={`w-full p-2 text-left rounded-xl truncate transition ${
                      selectedAudioInput === d.deviceId
                        ? 'bg-[#1F5E4B] text-white font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {audioOutputs.length > 0 && (
                <>
                  <div className="pt-2 border-t border-neutral-800 font-bold text-neutral-400 text-[10px] uppercase font-mono">
                    Speaker Output
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {audioOutputs.map((d) => (
                      <button
                        key={d.deviceId}
                        onClick={() => {
                          onSelectAudioOutput(d.deviceId);
                          setShowAudioMenu(false);
                        }}
                        className={`w-full p-2 text-left rounded-xl truncate transition ${
                          selectedAudioOutput === d.deviceId
                            ? 'bg-[#1F5E4B] text-white font-bold'
                            : 'text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Camera Button with Device Selector Popover */}
        <div className="relative">
          <div className="flex items-center rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-700/80 shadow-md">
            <button
              type="button"
              onClick={onToggleVideo}
              className={`p-3.5 transition ${
                isVideoOff
                  ? 'bg-red-600/90 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowVideoMenu(!showVideoMenu);
                setShowAudioMenu(false);
                setShowHostMenu(false);
              }}
              className="px-1.5 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border-l border-neutral-700/80 transition"
              title="Camera settings"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {showVideoMenu && (
            <div className="absolute bottom-16 left-0 w-64 bg-[#181C1B] border border-neutral-700 rounded-2xl p-3 shadow-2xl z-40 text-xs space-y-3 animate-scale-in">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800 font-bold text-neutral-300">
                <span>Select Camera</span>
                <button onClick={() => setShowVideoMenu(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {videoInputs.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => {
                      onSelectVideoInput(d.deviceId);
                      setShowVideoMenu(false);
                    }}
                    className={`w-full p-2 text-left rounded-xl truncate transition ${
                      selectedVideoInput === d.deviceId
                        ? 'bg-[#1F5E4B] text-white font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Screen Share Button */}
        <button
          type="button"
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-2xl transition border shadow-md ${
            isScreenSharing
              ? 'bg-[#1F5E4B] border-[#2E7D5B] text-white shadow-lg shadow-[#1F5E4B]/20'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/80'
          }`}
          title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Raise Hand Button */}
        <button
          type="button"
          onClick={onToggleHandRaise}
          className={`p-3.5 rounded-2xl transition border shadow-md ${
            isHandRaised
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-md shadow-amber-500/10'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/80'
          }`}
          title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-neutral-800 mx-1 hidden sm:block" />

        {/* In-Call Chat Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawer('chat')}
          className={`p-3.5 rounded-2xl transition border shadow-md relative ${
            activeDrawer === 'chat'
              ? 'bg-[#1F5E4B] border-[#2E7D5B] text-white shadow-lg shadow-[#1F5E4B]/20'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/80'
          }`}
          title="Meeting chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#1F5E4B] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Participants Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawer('participants')}
          className={`p-3.5 rounded-2xl transition border shadow-md relative ${
            activeDrawer === 'participants'
              ? 'bg-[#1F5E4B] border-[#2E7D5B] text-white shadow-lg shadow-[#1F5E4B]/20'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/80'
          }`}
          title="Participants list"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-neutral-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center font-mono">
            {participantCount}
          </span>
        </button>

        {/* Host Controls Menu */}
        {isHostOrAdmin && onEndMeetingForAll && (
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => {
                setShowHostMenu(!showHostMenu);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
              }}
              className="p-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 transition shadow-md"
              title="Host Controls"
            >
              <Shield className="w-5 h-5" />
            </button>

            {showHostMenu && (
              <div className="absolute bottom-16 right-0 w-48 bg-[#181C1B] border border-neutral-700 rounded-2xl p-2 shadow-2xl z-40 text-xs space-y-1 animate-scale-in">
                <button
                  onClick={() => {
                    setShowHostMenu(false);
                    onEndMeetingForAll();
                  }}
                  className="w-full p-2.5 rounded-xl text-left text-red-400 hover:bg-neutral-800 flex items-center gap-2 font-bold transition"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End for Everyone</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side: Leave Meeting Button */}
      <div>
        <button
          type="button"
          onClick={onLeaveMeeting}
          className="px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition transform active:scale-95"
          title="Leave meeting"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </footer>
  );
};
