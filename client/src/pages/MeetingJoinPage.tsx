import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PreJoinScreen } from '../components/meeting/PreJoinScreen';
import { MeetingRoom } from '../components/meeting/MeetingRoom';

export const MeetingJoinPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [hasJoined, setHasJoined] = useState(false);
  const [joinedMedia, setJoinedMedia] = useState<{
    stream: MediaStream | null;
    isMicMuted: boolean;
    isVideoMuted: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    audioOutputId?: string;
  } | null>(null);

  if (!roomId) {
    navigate('/teams');
    return null;
  }

  const handleJoin = (options: {
    stream: MediaStream | null;
    isMicMuted: boolean;
    isVideoMuted: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    audioOutputId?: string;
  }) => {
    setJoinedMedia(options);
    setHasJoined(true);
  };

  const handleLeave = () => {
    setHasJoined(false);
    navigate(-1);
  };

  if (hasJoined) {
    return (
      <MeetingRoom
        meetingId={roomId}
        initialMedia={joinedMedia || undefined}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <PreJoinScreen
      meetingId={roomId}
      onJoin={handleJoin}
    />
  );
};

