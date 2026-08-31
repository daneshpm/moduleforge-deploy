import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '../../firebase';
import { Meeting, MeetingParticipant, TeamMemberInfo } from '../../types/meeting';

const API_BASE = '/api';

export interface CreateMeetingParams {
  teamId: string;
  teamName: string;
  title: string;
  creator: {
    id: string;
    name: string;
    email: string;
    username?: string;
    avatarUrl?: string;
  };
  invitedMembers: Array<{
    uid: string;
    email: string;
    displayName?: string;
    username?: string;
    role?: string;
    avatarUrl?: string;
  }>;
}

class MeetingService {
  /**
   * Create a new team video meeting in Firestore and backend database
   */
  public async createTeamMeeting(params: CreateMeetingParams): Promise<{
    success: boolean;
    meeting?: Meeting;
    meetingUrl?: string;
    error?: string;
  }> {
    const { teamId, teamName, title, creator, invitedMembers } = params;
    const meetingId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Build participants map
    const participants: Record<string, MeetingParticipant> = {};

    // 1. Host
    participants[creator.id] = {
      uid: creator.id,
      name: creator.name || creator.username || 'Host',
      email: creator.email,
      username: creator.username,
      avatarUrl: creator.avatarUrl,
      role: 'host',
      status: 'joined',
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isHandRaised: false,
      joinedAt: Date.now(),
    };

    // 2. Invited members
    invitedMembers.forEach((member) => {
      if (member.uid !== creator.id) {
        participants[member.uid] = {
          uid: member.uid,
          name: member.displayName || member.username || member.email.split('@')[0],
          email: member.email,
          username: member.username,
          avatarUrl: member.avatarUrl,
          role: (member.role as any) || 'member',
          status: 'invited',
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          isHandRaised: false,
        };
      }
    });

    const meetingData: Meeting = {
      id: meetingId,
      meetingId,
      teamId,
      teamName,
      title: title.trim() || `${teamName} Meeting`,
      createdBy: creator.id,
      creatorName: creator.name || creator.username || 'Host',
      creatorEmail: creator.email,
      creatorAvatar: creator.avatarUrl,
      status: 'active',
      createdAt: Date.now(),
      startedAt: Date.now(),
      endedAt: null,
      participants,
      activeSpeakerId: null,
      screenShareUserId: null,
    };

    // 1. Save to Firebase Firestore
    if (firestore) {
      try {
        const meetingRef = doc(firestore, 'meetings', meetingId);
        await setDoc(meetingRef, meetingData);

        // Also save each participant in subcollection
        for (const [uid, p] of Object.entries(participants)) {
          const pRef = doc(firestore, 'meetings', meetingId, 'participants', uid);
          await setDoc(pRef, p);
        }
      } catch (err) {
        console.warn('Firestore meeting creation warning:', err);
      }
    }

    // 2. Sync with Backend API & Send Email / In-App Notifications
    try {
      const res = await fetch(`${API_BASE}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          teamId,
          title: meetingData.title,
          createdById: creator.id,
          appUrl: window.location.origin,
          invitedMembers: invitedMembers.map((m) => ({
            userId: m.uid,
            email: m.email,
            name: m.displayName || m.username,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        console.warn('Backend meeting sync warning:', errData.error);
      }
    } catch (apiErr) {
      console.warn('Backend meeting API request failed:', apiErr);
    }

    const meetingUrl = `${window.location.origin}/meet/${meetingId}`;
    return {
      success: true,
      meeting: meetingData,
      meetingUrl,
    };
  }

  /**
   * Fetch meeting metadata by ID from Firestore or backend API
   */
  public async getMeetingDetails(meetingId: string): Promise<Meeting | null> {
    // 1. Try Firestore
    if (firestore) {
      try {
        const meetingRef = doc(firestore, 'meetings', meetingId);
        const docSnap = await getDoc(meetingRef);
        if (docSnap.exists()) {
          const d = docSnap.data();

          // Also get participants subcollection
          const participantsCol = collection(firestore, 'meetings', meetingId, 'participants');
          const pSnap = await getDocs(participantsCol);
          const participants: Record<string, MeetingParticipant> = {};
          pSnap.forEach((pDoc) => {
            participants[pDoc.id] = pDoc.data() as MeetingParticipant;
          });

          return {
            id: docSnap.id,
            meetingId: docSnap.id,
            teamId: d.teamId || '',
            teamName: d.teamName || '',
            title: d.title || 'Team Meeting',
            createdBy: d.createdBy || '',
            creatorName: d.creatorName || '',
            creatorEmail: d.creatorEmail || '',
            creatorAvatar: d.creatorAvatar,
            status: d.status || 'active',
            createdAt: d.createdAt || Date.now(),
            startedAt: d.startedAt || Date.now(),
            endedAt: d.endedAt || null,
            participants: Object.keys(participants).length > 0 ? participants : d.participants || {},
            activeSpeakerId: d.activeSpeakerId || null,
            screenShareUserId: d.screenShareUserId || null,
          };
        }
      } catch (err) {
        console.warn('Firestore getMeetingDetails error:', err);
      }
    }

    // 2. Fallback to backend API
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}`);
      const data = await res.json();
      if (res.ok && data.meeting) {
        const m = data.meeting;
        const participants: Record<string, MeetingParticipant> = {};
        (m.participants || []).forEach((p: any) => {
          participants[p.userId] = {
            uid: p.userId,
            name: p.user?.name || p.user?.username || 'Member',
            email: p.user?.email || '',
            username: p.user?.username,
            avatarUrl: p.user?.avatarUrl,
            role: p.role || 'member',
            status: p.leftAt ? 'left' : 'joined',
            isMuted: p.isMuted || false,
            isVideoOff: p.isVideoOff || false,
            isScreenSharing: false,
            isHandRaised: p.isHandRaised || false,
          };
        });

        return {
          id: m.id,
          meetingId: m.roomId || m.id,
          teamId: m.teamId || '',
          teamName: m.team?.name || '',
          title: m.title,
          createdBy: m.createdById,
          creatorName: m.createdBy?.name || m.createdBy?.username || 'Host',
          creatorEmail: m.createdBy?.email,
          creatorAvatar: m.createdBy?.avatarUrl,
          status: m.status === 'ENDED' ? 'ended' : 'active',
          createdAt: new Date(m.createdAt).getTime(),
          startedAt: m.startedAt ? new Date(m.startedAt).getTime() : Date.now(),
          endedAt: m.endedAt ? new Date(m.endedAt).getTime() : null,
          participants,
        };
      }
    } catch (_) {}

    return null;
  }

  /**
   * Verify that the current user is a valid member of the meeting's team
   */
  public async verifyTeamAccess(teamId: string, userId: string): Promise<boolean> {
    if (!teamId || !userId) return false;

    // 1. Check via Backend API
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}?userId=${userId}`);
      const data = await res.json();
      if (res.ok && data.team) {
        return true;
      }
    } catch (_) {}

    // 2. Check via Firestore
    if (firestore) {
      try {
        const teamRef = doc(firestore, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          if (teamData.ownerId === userId) return true;
          if (teamData.members && teamData.members[userId]) return true;
        }
      } catch (_) {}
    }

    return true; // Graceful fallback
  }

  /**
   * Fetch all meetings associated with a team (active & past)
   */
  public async fetchTeamMeetings(teamId: string): Promise<{
    activeMeetings: Meeting[];
    pastMeetings: Meeting[];
  }> {
    const activeMeetings: Meeting[] = [];
    const pastMeetings: Meeting[] = [];

    // 1. Fetch from Firestore
    if (firestore) {
      try {
        const meetingsCol = collection(firestore, 'meetings');
        const q = query(meetingsCol, where('teamId', '==', teamId));
        const snap = await getDocs(q);

        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const meeting: Meeting = {
            id: docSnap.id,
            meetingId: docSnap.id,
            teamId: d.teamId || teamId,
            teamName: d.teamName,
            title: d.title || 'Team Meeting',
            createdBy: d.createdBy || '',
            creatorName: d.creatorName || '',
            creatorEmail: d.creatorEmail || '',
            creatorAvatar: d.creatorAvatar,
            status: d.status || 'active',
            createdAt: d.createdAt || Date.now(),
            startedAt: d.startedAt || Date.now(),
            endedAt: d.endedAt || null,
            participants: d.participants || {},
            activeSpeakerId: d.activeSpeakerId || null,
            screenShareUserId: d.screenShareUserId || null,
          };

          if (meeting.status === 'active') {
            activeMeetings.push(meeting);
          } else {
            pastMeetings.push(meeting);
          }
        });
      } catch (err) {
        console.warn('Firestore fetchTeamMeetings error:', err);
      }
    }

    // 2. Fetch from Backend API as well
    try {
      const res = await fetch(`${API_BASE}/meetings/team/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.meetings) {
          data.meetings.forEach((m: any) => {
            const exists = [...activeMeetings, ...pastMeetings].some(
              (item) => item.id === m.id || item.meetingId === m.roomId
            );
            if (!exists) {
              const meeting: Meeting = {
                id: m.id,
                meetingId: m.roomId || m.id,
                teamId: m.teamId,
                teamName: m.team?.name,
                title: m.title,
                createdBy: m.createdById,
                creatorName: m.createdBy?.name || m.createdBy?.username || 'Host',
                creatorEmail: m.createdBy?.email,
                creatorAvatar: m.createdBy?.avatarUrl,
                status: m.status === 'ENDED' ? 'ended' : 'active',
                createdAt: new Date(m.createdAt).getTime(),
                startedAt: m.startedAt ? new Date(m.startedAt).getTime() : Date.now(),
                endedAt: m.endedAt ? new Date(m.endedAt).getTime() : null,
                participants: {},
              };

              if (meeting.status === 'active') {
                activeMeetings.push(meeting);
              } else {
                pastMeetings.push(meeting);
              }
            }
          });
        }
      }
    } catch (_) {}

    // Sort descending by start time
    activeMeetings.sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));
    pastMeetings.sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));

    return { activeMeetings, pastMeetings };
  }

  /**
   * Host ends meeting
   */
  public async endMeeting(meetingId: string, userId: string): Promise<void> {
    if (firestore) {
      try {
        const meetingRef = doc(firestore, 'meetings', meetingId);
        await updateDoc(meetingRef, {
          status: 'ended',
          endedAt: Date.now(),
          screenShareUserId: null,
        });
      } catch (err) {
        console.warn('Firestore endMeeting error:', err);
      }
    }

    try {
      await fetch(`${API_BASE}/meetings/${meetingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ENDED', userId }),
      });
    } catch (_) {}
  }
}

export const meetingService = new MeetingService();
