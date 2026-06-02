const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- POST /api/chat/send (Protected) ---
router.post('/send', auth, async (req, res) => {
    const { bookingId, receiverId, content } = req.body;
    try {
        const message = await prisma.message.create({
            data: {
                content,
                senderId: req.user.id,
                receiverId,
                bookingId
            }
        });

        // WORM Ledger Entry for neural sync
        await prisma.auditLog.create({
            data: {
                action: 'CHAT_MESSAGE_SENT',
                context: JSON.stringify({ bookingId, messageId: message.id }),
                userId: req.user.id
            }
        });

        res.json(message);
    } catch (err) {
        res.status(400).json({ error: 'Neural Sync Failure: Message not dropped' });
    }
});

// --- GET /api/chat/:bookingId (Protected) ---
router.get('/:bookingId', auth, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { bookingId: req.params.bookingId },
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { name: true } } }
        });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Retrieval Error' });
    }
});

module.exports = router;
