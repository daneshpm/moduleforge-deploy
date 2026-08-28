import { Router } from 'express';
import { prisma } from '../prisma';

export const directChatsRouter = Router();

// GET /api/chats - List direct chats for a user
directChatsRouter.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find all chats where user is a participant
    const participations = await (prisma as any).directChatParticipant.findMany({
      where: { userId: String(userId) },
      select: { chatId: true, lastReadAt: true },
    });

    const chatIds = participations.map((p: any) => p.chatId);

    const chats = await (prisma as any).directChat.findMany({
      where: { id: { in: chatIds } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                presence: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Format chat response with otherParticipant details
    const formattedChats = chats.map((chat: any) => {
      const otherParticipant = chat.participants.find((p: any) => p.userId !== String(userId))?.user || null;
      const lastMessage = chat.messages[0] || null;
      return {
        id: chat.id,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        otherParticipant,
        lastMessage,
      };
    });

    res.json({ chats: formattedChats });
  } catch (error: any) {
    console.error('Error fetching direct chats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch chats' });
  }
});

// POST /api/chats - Create or retrieve existing direct chat between two users
directChatsRouter.post('/', async (req, res) => {
  try {
    const { userId, recipientId } = req.body;

    if (!userId || !recipientId) {
      return res.status(400).json({ error: 'userId and recipientId are required' });
    }

    if (userId === recipientId) {
      return res.status(400).json({ error: 'Cannot create a direct chat with yourself' });
    }

    // Check if a direct chat between these two users already exists
    const existingChat = await (prisma as any).directChat.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true, presence: true },
            },
          },
        },
      },
    });

    if (existingChat) {
      const otherParticipant = existingChat.participants.find((p: any) => p.userId !== userId)?.user;
      return res.json({ chat: { ...existingChat, otherParticipant } });
    }

    // Create a new direct chat with both participants
    const newChat = await (prisma as any).directChat.create({
      data: {
        participants: {
          create: [
            { userId },
            { userId: recipientId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true, presence: true },
            },
          },
        },
      },
    });

    const otherParticipant = newChat.participants.find((p: any) => p.userId !== userId)?.user;
    res.status(201).json({ chat: { ...newChat, otherParticipant } });
  } catch (error: any) {
    console.error('Error creating direct chat:', error);
    res.status(500).json({ error: error.message || 'Failed to create chat' });
  }
});

// GET /api/chats/:chatId/messages - Get messages in a direct chat
directChatsRouter.get('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await (prisma as any).directMessage.findMany({
      where: {
        chatId,
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

    res.json({ messages: messages.reverse() });
  } catch (error: any) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
});

// POST /api/chats/:chatId/messages - Send a direct message
directChatsRouter.post('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, text, attachments = [] } = req.body;

    if (!senderId || (!text && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ error: 'senderId and text/attachments are required' });
    }

    const message = await (prisma as any).directMessage.create({
      data: {
        chatId,
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

    // Touch the chat's updatedAt timestamp
    await (prisma as any).directChat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error('Error sending direct message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// POST /api/chats/:chatId/upload - Upload attachment for direct chat
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

const chatAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, attachmentStorageDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

directChatsRouter.post('/:chatId/upload', chatAttachmentUpload.single('file'), (req: any, res) => {
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

