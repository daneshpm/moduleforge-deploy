import {
  doc,
  collection,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  Unsubscribe,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from '../../firebase';
import {
  Meeting,
  MeetingParticipant,
  MeetingMessage,
  WebRTCSignal,
  IceCandidatePayload,
  ParticipantPresenceStatus,
} from '../../types/meeting';

export type SignalCallback = (signal: WebRTCSignal) => void;
export type CandidateCallback = (payload: IceCandidatePayload) => void;
export type ParticipantsCallback = (participants: Record<string, MeetingParticipant>) => void;
export type MeetingStateCallback = (meeting: Meeting) => void;
export type MessagesCallback = (messages: MeetingMessage[]) => void;

export class FirestoreSignaling {
  private meetingId: string;
  private currentUserId: string;
  private unsubs: Unsubscribe[] = [];

  constructor(meetingId: string, currentUserId: string) {
    this.meetingId = meetingId;
    this.currentUserId = currentUserId;
  }

  /**
   * Register local participant in Firestore meeting
   */
  public async registerParticipant(participant: MeetingParticipant): Promise<void> {
    if (!firestore) return;

    try {
      const participantRef = doc(firestore, 'meetings', this.meetingId, 'participants', this.currentUserId);
      await setDoc(participantRef, {
        ...participant,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        status: 'joined',
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore registerParticipant warning:', err);
    }
  }

  /**
   * Update participant status (mute, video, presence, hand raise, screen share)
   */
  public async updateParticipant(updates: Partial<MeetingParticipant>): Promise<void> {
    if (!firestore) return;

    try {
      const participantRef = doc(firestore, 'meetings', this.meetingId, 'participants', this.currentUserId);
      await updateDoc(participantRef, {
        ...updates,
        lastActive: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore updateParticipant warning:', err);
    }
  }

  /**
   * Update remote participant (for host moderation actions like mute/kick)
   */
  public async updateRemoteParticipant(targetUserId: string, updates: Partial<MeetingParticipant>): Promise<void> {
    if (!firestore) return;

    try {
      const participantRef = doc(firestore, 'meetings', this.meetingId, 'participants', targetUserId);
      await updateDoc(participantRef, {
        ...updates,
        lastActive: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore updateRemoteParticipant warning:', err);
    }
  }

  /**
   * Listen to meeting document state updates (e.g. status: 'ended', activeSpeakerId, screenShareUserId)
   */
  public subscribeMeetingState(onMeetingUpdate: MeetingStateCallback): () => void {
    if (!firestore) return () => {};

    const meetingRef = doc(firestore, 'meetings', this.meetingId);
    const unsub = onSnapshot(meetingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onMeetingUpdate({
          id: docSnap.id,
          meetingId: docSnap.id,
          teamId: data.teamId || '',
          teamName: data.teamName || '',
          title: data.title || 'Team Meeting',
          createdBy: data.createdBy || '',
          creatorName: data.creatorName || '',
          creatorEmail: data.creatorEmail || '',
          creatorAvatar: data.creatorAvatar,
          status: data.status || 'active',
          createdAt: data.createdAt || Date.now(),
          startedAt: data.startedAt || Date.now(),
          endedAt: data.endedAt || null,
          participants: data.participants || {},
          activeSpeakerId: data.activeSpeakerId || null,
          screenShareUserId: data.screenShareUserId || null,
        });
      }
    }, (err) => {
      console.warn('Meeting state subscription error:', err);
    });

    this.unsubs.push(unsub);
    return unsub;
  }

  /**
   * Listen to participants collection updates
   */
  public subscribeParticipants(onParticipantsUpdate: ParticipantsCallback): () => void {
    if (!firestore) return () => {};

    const participantsCol = collection(firestore, 'meetings', this.meetingId, 'participants');
    const unsub = onSnapshot(participantsCol, (snapshot) => {
      const participants: Record<string, MeetingParticipant> = {};
      snapshot.forEach((docSnap) => {
        participants[docSnap.id] = docSnap.data() as MeetingParticipant;
      });
      onParticipantsUpdate(participants);
    }, (err) => {
      console.warn('Participants subscription error:', err);
    });

    this.unsubs.push(unsub);
    return unsub;
  }

  /**
   * Send WebRTC SDP signal (offer or answer) to a specific peer
   */
  public async sendSignal(receiverId: string, type: 'offer' | 'answer', sdp: string): Promise<void> {
    if (!firestore) return;

    try {
      const signalsCol = collection(firestore, 'meetings', this.meetingId, 'signals');
      await addDoc(signalsCol, {
        senderId: this.currentUserId,
        receiverId,
        type,
        sdp,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore sendSignal error:', err);
    }
  }

  /**
   * Listen for incoming WebRTC signals intended for the current user
   */
  public subscribeSignals(onSignal: SignalCallback): () => void {
    if (!firestore) return () => {};

    const signalsCol = collection(firestore, 'meetings', this.meetingId, 'signals');
    const q = query(
      signalsCol,
      where('receiverId', '==', this.currentUserId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          onSignal({
            id: change.doc.id,
            senderId: data.senderId,
            receiverId: data.receiverId,
            type: data.type,
            sdp: data.sdp,
            timestamp: data.timestamp,
          });

          // Delete signal after processing to keep collection lightweight
          deleteDoc(change.doc.ref).catch(() => {});
        }
      });
    }, (err) => {
      console.warn('Signals subscription error:', err);
    });

    this.unsubs.push(unsub);
    return unsub;
  }

  /**
   * Send ICE candidate to a specific peer
   */
  public async sendIceCandidate(receiverId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (!firestore) return;

    try {
      const candidatesCol = collection(firestore, 'meetings', this.meetingId, 'candidates');
      await addDoc(candidatesCol, {
        senderId: this.currentUserId,
        receiverId,
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore sendIceCandidate error:', err);
    }
  }

  /**
   * Listen for incoming ICE candidates intended for the current user
   */
  public subscribeIceCandidates(onCandidate: CandidateCallback): () => void {
    if (!firestore) return () => {};

    const candidatesCol = collection(firestore, 'meetings', this.meetingId, 'candidates');
    const q = query(
      candidatesCol,
      where('receiverId', '==', this.currentUserId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          onCandidate({
            id: change.doc.id,
            senderId: data.senderId,
            receiverId: data.receiverId,
            candidate: data.candidate,
            timestamp: data.timestamp,
          });

          // Clean up candidate document once handled
          deleteDoc(change.doc.ref).catch(() => {});
        }
      });
    }, (err) => {
      console.warn('ICE candidates subscription error:', err);
    });

    this.unsubs.push(unsub);
    return unsub;
  }

  /**
   * Send in-meeting chat message
   */
  public async sendMessage(senderName: string, text: string, senderAvatar?: string): Promise<void> {
    if (!firestore) return;

    try {
      const messagesCol = collection(firestore, 'meetings', this.meetingId, 'messages');
      await addDoc(messagesCol, {
        meetingId: this.meetingId,
        senderId: this.currentUserId,
        senderName,
        senderAvatar: senderAvatar || '',
        text,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore sendMessage error:', err);
    }
  }

  /**
   * Listen for in-meeting chat messages
   */
  public subscribeMessages(onMessages: MessagesCallback): () => void {
    if (!firestore) return () => {};

    const messagesCol = collection(firestore, 'meetings', this.meetingId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const messages: MeetingMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        messages.push({
          id: docSnap.id,
          meetingId: this.meetingId,
          senderId: d.senderId,
          senderName: d.senderName,
          senderAvatar: d.senderAvatar,
          text: d.text,
          createdAt: d.createdAt,
        });
      });
      onMessages(messages);
    }, (err) => {
      console.warn('Messages subscription error:', err);
    });

    this.unsubs.push(unsub);
    return unsub;
  }

  /**
   * Leave meeting & mark status as left
   */
  public async leaveMeeting(): Promise<void> {
    if (firestore) {
      try {
        const participantRef = doc(firestore, 'meetings', this.meetingId, 'participants', this.currentUserId);
        await updateDoc(participantRef, {
          status: 'left',
          leftAt: Date.now(),
          isScreenSharing: false,
        });
      } catch (err) {
        console.warn('Firestore leaveMeeting update error:', err);
      }
    }

    this.cleanup();
  }

  /**
   * End meeting for all participants (host action)
   */
  public async endMeetingForAll(): Promise<void> {
    if (!firestore) return;

    try {
      const meetingRef = doc(firestore, 'meetings', this.meetingId);
      await updateDoc(meetingRef, {
        status: 'ended',
        endedAt: Date.now(),
        screenShareUserId: null,
      });
    } catch (err) {
      console.warn('Firestore endMeetingForAll error:', err);
    }
  }

  /**
   * Set active screen share user in meeting document
   */
  public async setScreenShareUser(userId: string | null): Promise<void> {
    if (!firestore) return;

    try {
      const meetingRef = doc(firestore, 'meetings', this.meetingId);
      await updateDoc(meetingRef, {
        screenShareUserId: userId,
      });
    } catch (err) {
      console.warn('Firestore setScreenShareUser error:', err);
    }
  }

  /**
   * Unsubscribe all listeners
   */
  public cleanup() {
    this.unsubs.forEach((unsub) => {
      try { unsub(); } catch (_) {}
    });
    this.unsubs = [];
  }
}
