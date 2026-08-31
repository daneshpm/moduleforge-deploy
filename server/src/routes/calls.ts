import { Router } from 'express';
import { prisma } from '../prisma';
import { createLiveKitToken, DEFAULT_ICE_SERVERS } from '../services/livekit';
import { realtimeEventManager } from '../services/realtimeEvents';

export const callsRouter = Router();

// POST /api/calls/initiate - Start a 1:1 call
callsRouter.post('/initiate', async (req, res) => {
  try {
    const { callerId, receiverId, type = 'voice', chatId } = req.body;

    if (!callerId || !receiverId) {
      return res.status(400).json({ error: 'callerId and receiverId are required' });
    }

    // Generate a unique room ID
    const roomId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create call session in DB
    const call = await (prisma as any).callSession.create({
      data: {
        callerId,
        receiverId,
        type, // "voice" | "video"
        chatId: chatId || null,
        roomId,
        status: 'CALLING',
      },
      include: {
        caller: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Generate caller's LiveKit / WebRTC token
    const tokenData = await createLiveKitToken({
      roomName: roomId,
      participantIdentity: callerId,
      participantName: call.caller.name || call.caller.username,
      metadata: { callId: call.id, role: 'caller', type },
    });

    // Realtime notify receiver of incoming call
    try {
      realtimeEventManager.sendToUser(receiverId, 'incoming_call', { call });
    } catch (_) {}

    res.status(201).json({
      call,
      token: tokenData.token,
      serverUrl: tokenData.serverUrl,
      iceServers: tokenData.iceServers,
    });
  } catch (error: any) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate call' });
  }
});

// GET /api/calls/active - Check for active incoming or ongoing calls for a user
callsRouter.get('/active', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const activeCall = await (prisma as any).callSession.findFirst({
      where: {
        OR: [
          { receiverId: String(userId), status: { in: ['CALLING', 'RINGING'] } },
          { callerId: String(userId), status: { in: ['CALLING', 'RINGING', 'CONNECTED'] } },
          { receiverId: String(userId), status: 'CONNECTED' },
        ],
      },
      include: {
        caller: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ activeCall });
  } catch (error: any) {
    console.error('Error checking active calls:', error);
    res.status(500).json({ error: error.message || 'Failed to check active calls' });
  }
});

// GET /api/calls/history - Get call logs for a user (Must be before /:callId)
callsRouter.get('/history', async (req, res) => {
  try {
    const { userId, limit = 30 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const history = await (prisma as any).callSession.findMany({
      where: {
        OR: [
          { callerId: String(userId) },
          { receiverId: String(userId) },
        ],
      },
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        caller: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json({ history });
  } catch (error: any) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
});

// GET /api/calls/:callId - Get call session state
callsRouter.get('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await (prisma as any).callSession.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call session not found' });
    }

    res.json({ call });
  } catch (error: any) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch call' });
  }
});

// POST /api/calls/:callId/token - Get WebRTC / LiveKit token to join the call
callsRouter.post('/:callId/token', async (req, res) => {
  try {
    const { callId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const call = await (prisma as any).callSession.findUnique({
      where: { id: callId },
      include: {
        caller: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (call.callerId !== userId && call.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to join this call' });
    }

    const userName = call.callerId === userId
      ? (call.caller.name || call.caller.username)
      : (call.receiver?.name || call.receiver?.username);

    const tokenData = await createLiveKitToken({
      roomName: call.roomId,
      participantIdentity: userId,
      participantName: userName,
      metadata: { callId: call.id, type: call.type },
    });

    res.json(tokenData);
  } catch (error: any) {
    console.error('Error generating call token:', error);
    res.status(500).json({ error: error.message || 'Failed to generate token' });
  }
});

// PATCH /api/calls/:callId/status - Update call state (RINGING, CONNECTED, DECLINED, MISSED, ENDED)
callsRouter.patch('/:callId/status', async (req, res) => {
  try {
    const { callId } = req.params;
    const { status, duration } = req.body;

    const validStatuses = ['RINGING', 'CONNECTED', 'DECLINED', 'MISSED', 'ENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updateData: any = { status };

    if (status === 'CONNECTED') {
      updateData.startedAt = new Date();
    } else if (['ENDED', 'DECLINED', 'MISSED'].includes(status)) {
      updateData.endedAt = new Date();
      if (typeof duration === 'number') {
        updateData.duration = duration;
      }
    }

    const updatedCall = await (prisma as any).callSession.update({
      where: { id: callId },
      data: updateData,
      include: {
        caller: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Realtime broadcast call status to both participants
    try {
      if (updatedCall.callerId) {
        realtimeEventManager.sendToUser(updatedCall.callerId, 'call_status_updated', { call: updatedCall });
      }
      if (updatedCall.receiverId) {
        realtimeEventManager.sendToUser(updatedCall.receiverId, 'call_status_updated', { call: updatedCall });
      }
    } catch (_) {}

    res.json({ call: updatedCall });
  } catch (error: any) {
    console.error('Error updating call status:', error);
    res.status(500).json({ error: error.message || 'Failed to update call status' });
  }
});
