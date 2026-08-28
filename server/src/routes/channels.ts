import { Router } from 'express';
import { prisma } from '../prisma';

export const channelsRouter = Router();

// GET /api/channels - List channels for a team or project
channelsRouter.get('/', async (req, res) => {
  try {
    const { teamId, projectId } = req.query;

    if (!teamId && !projectId) {
      return res.status(400).json({ error: 'teamId or projectId is required' });
    }

    const channels = await (prisma as any).channel.findMany({
      where: {
        ...(teamId ? { teamId: String(teamId) } : {}),
        ...(projectId ? { projectId: String(projectId) } : {}),
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // If no channels exist for this team/project, automatically create a default "general" text channel
    if (channels.length === 0) {
      const defaultChannel = await (prisma as any).channel.create({
        data: {
          name: 'general',
          description: 'General discussion and team collaboration',
          type: 'text',
          teamId: teamId ? String(teamId) : null,
          projectId: projectId ? String(projectId) : null,
        },
        include: {
          creator: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      });
      return res.json({ channels: [defaultChannel] });
    }

    res.json({ channels });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch channels' });
  }
});

// POST /api/channels - Create a channel
channelsRouter.post('/', async (req, res) => {
  try {
    const { name, description, type = 'text', teamId, projectId, createdById, isPrivate = false } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    if (!teamId && !projectId) {
      return res.status(400).json({ error: 'teamId or projectId is required' });
    }

    // Sanitize channel name (lowercase, kebab-case style like Discord/Slack)
    const cleanName = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-');

    const channel = await (prisma as any).channel.create({
      data: {
        name: cleanName,
        description: description || null,
        type, // "text" | "voice" | "video"
        isPrivate: Boolean(isPrivate),
        teamId: teamId || null,
        projectId: projectId || null,
        createdById: createdById || null,
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({ channel });
  } catch (error: any) {
    console.error('Error creating channel:', error);
    res.status(500).json({ error: error.message || 'Failed to create channel' });
  }
});

// GET /api/channels/:channelId/messages - Get channel messages
channelsRouter.get('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await (prisma as any).channelMessage.findMany({
      where: {
        channelId,
        ...(before ? { createdAt: { lt: new Date(String(before)) } } : {}),
      },
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Return in chronological order
    res.json({ messages: messages.reverse() });
  } catch (error: any) {
    console.error('Error fetching channel messages:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
});

// POST /api/channels/:channelId/messages - Send a channel message
channelsRouter.post('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { senderId, text, attachments = [] } = req.body;

    if (!senderId || (!text && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ error: 'senderId and message text or attachments are required' });
    }

    const message = await (prisma as any).channelMessage.create({
      data: {
        channelId,
        senderId,
        text: text || '',
        attachments: typeof attachments === 'string' ? attachments : JSON.stringify(attachments),
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error('Error sending channel message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// POST /api/channels/:channelId/upload - Upload attachment for channel
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const attachmentStorageDir = isVercel
  ? path.join('/tmp', 'uploads', 'attachments')
  : path.join(__dirname, '..', '..', 'uploads', 'attachments');
try {
  fs.mkdirSync(attachmentStorageDir, { recursive: true });
} catch (_) {}

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, attachmentStorageDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

channelsRouter.post('/:channelId/upload', attachmentUpload.single('file'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/attachments/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
      ? 'video'
      : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'document';

    res.json({
      attachment: {
        name: req.file.originalname,
        url: fileUrl,
        type: fileType,
        size: req.file.size,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// DELETE /api/channels/:channelId/messages/:messageId - Delete a channel message
channelsRouter.delete('/:channelId/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    await (prisma as any).channelMessage.delete({
      where: { id: messageId },
    });
    res.json({ success: true, messageId });
  } catch (error: any) {
    console.error('Error deleting channel message:', error);
    res.status(500).json({ error: error.message || 'Failed to delete message' });
  }
});
