import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { MeetingParticipant } from '../../types/meeting';

class ParticipantService {
  /**
   * Toggle participant audio state
   */
  public async setMuted(meetingId: string, userId: string, isMuted: boolean): Promise<void> {
    if (!firestore) return;
    try {
      const pRef = doc(firestore, 'meetings', meetingId, 'participants', userId);
      await updateDoc(pRef, { isMuted, lastActive: Date.now() });
    } catch (err) {
      console.warn('Failed to set mute status in Firestore:', err);
    }
  }

  /**
   * Toggle participant video camera state
   */
  public async setVideoOff(meetingId: string, userId: string, isVideoOff: boolean): Promise<void> {
    if (!firestore) return;
    try {
      const pRef = doc(firestore, 'meetings', meetingId, 'participants', userId);
      await updateDoc(pRef, { isVideoOff, lastActive: Date.now() });
    } catch (err) {
      console.warn('Failed to set video status in Firestore:', err);
    }
  }

  /**
   * Toggle participant hand raised state
   */
  public async setHandRaised(meetingId: string, userId: string, isHandRaised: boolean): Promise<void> {
    if (!firestore) return;
    try {
      const pRef = doc(firestore, 'meetings', meetingId, 'participants', userId);
      await updateDoc(pRef, { isHandRaised, lastActive: Date.now() });
    } catch (err) {
      console.warn('Failed to set hand raise status in Firestore:', err);
    }
  }

  /**
   * Host action: Force-mute a participant
   */
  public async hostMuteParticipant(meetingId: string, targetUserId: string): Promise<void> {
    if (!firestore) return;
    try {
      const pRef = doc(firestore, 'meetings', meetingId, 'participants', targetUserId);
      await updateDoc(pRef, { isMuted: true, lastActive: Date.now() });
    } catch (err) {
      console.warn('Failed to host-mute participant in Firestore:', err);
    }
  }

  /**
   * Host action: Remove / Kick a participant from the meeting
   */
  public async hostRemoveParticipant(meetingId: string, targetUserId: string): Promise<void> {
    if (!firestore) return;
    try {
      const pRef = doc(firestore, 'meetings', meetingId, 'participants', targetUserId);
      await updateDoc(pRef, {
        status: 'left',
        leftAt: Date.now(),
        isScreenSharing: false,
      });
    } catch (err) {
      console.warn('Failed to remove participant in Firestore:', err);
    }
  }
}

export const participantService = new ParticipantService();
