const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sendSchema = z.object({
    bookingId: z.string().uuid('bookingId debe ser un UUID válido'),
    content: z.string().min(1, 'Mensaje vacío').max(1500, 'Mensaje muy largo').trim()
});

// Both the renter and the car owner participate in a booking's chat.
// Returns { booking, otherId } or null if the user is not a participant.
const resolveParticipants = async (bookingId, userId) => {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { car: { select: { ownerId: true } } }
    });
    if (!booking) return null;
    const ownerId = booking.car.ownerId;
    const renterId = booking.renterId;
    if (userId !== ownerId && userId !== renterId) return null;
    const otherId = userId === ownerId ? renterId : ownerId;
    return { booking, ownerId, renterId, otherId };
};

// --- POST /api/chat/send ---
router.post('/send', auth, asyncHandler(async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { bookingId, content } = parsed.data;

    const parts = await resolveParticipants(bookingId, req.user.id);
    if (!parts) return res.status(403).json({ error: 'No puedes participar en este chat.' });

    const message = await prisma.message.create({
        data: {
            content,
            senderId: req.user.id,
            receiverId: parts.otherId,
            bookingId
        },
        include: { sender: { select: { id: true, name: true } } }
    });

    res.status(201).json(message);
}));

// --- GET /api/chat/:bookingId ---
router.get('/:bookingId', auth, asyncHandler(async (req, res) => {
    const parts = await resolveParticipants(req.params.bookingId, req.user.id);
    if (!parts) return res.status(403).json({ error: 'No puedes ver este chat.' });

    const messages = await prisma.message.findMany({
        where: { bookingId: req.params.bookingId },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true } } }
    });

    res.json({
        messages,
        me: req.user.id,
        otherId: parts.otherId
    });
}));

module.exports = router;
