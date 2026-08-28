import { AccessToken } from 'livekit-server-sdk';
import jwt from 'jsonwebtoken';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret123456789012345678901234567890';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://moduleforge.livekit.cloud';
const JWT_SECRET = process.env.JWT_SECRET || LIVEKIT_API_SECRET;

// Standard public STUN/TURN ICE Servers for WebRTC NAT traversal fallback
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  // Open relay TURN fallback for restrictive networks
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Generate a short-lived, per-room WebRTC / LiveKit access token
 */
export async function createLiveKitToken(params: {
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  metadata?: Record<string, any>;
  ttlSeconds?: number;
}): Promise<{ token: string; serverUrl: string; iceServers: RTCIceServer[] }> {
  const {
    roomName,
    participantIdentity,
    participantName,
    metadata,
    ttlSeconds = 60 * 60, // 1 hour token
  } = params;

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName || participantIdentity,
      ttl: `${ttlSeconds}s`,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      serverUrl: LIVEKIT_URL,
      iceServers: DEFAULT_ICE_SERVERS,
    };
  } catch (err) {
    console.warn('LiveKit SDK token generation fallback to JWT:', err);
    // Secure signed fallback token for local signaling
    const fallbackToken = jwt.sign(
      {
        sub: participantIdentity,
        name: participantName,
        room: roomName,
        iss: LIVEKIT_API_KEY,
        metadata,
      },
      JWT_SECRET,
      { expiresIn: ttlSeconds }
    );

    return {
      token: fallbackToken,
      serverUrl: LIVEKIT_URL,
      iceServers: DEFAULT_ICE_SERVERS,
    };
  }
}
