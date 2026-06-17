const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createReviewSchema = z.object({
    bookingId: z.string().uuid('bookingId debe ser un UUID válido'),
    rating: z.coerce.number().int().min(1, 'Mínimo 1 estrella').max(5, 'Máximo 5 estrellas'),
    comment: z.string().max(1000, 'Comentario muy largo').optional().or(z.literal(''))
});

// Recompute a user's trustScore from all reviews they've received.
// Blend: base 50, plus average-rating contribution (up to +50). New users keep ~50.
const recomputeUserTrust = async (tx, userId) => {
    const agg = await tx.review.aggregate({
        where: { targetUserId: userId },
        _avg: { rating: true },
        _count: true
    });
    if (!agg._count) return;
    const avg = agg._avg.rating || 0;          // 0..5
    const score = Math.round(50 + (avg / 5) * 50); // 50..100
    await tx.user.update({ where: { id: userId }, data: { trustScore: score } });
};

// ============================================
// POST /api/reviews  — either party reviews the other after a COMPLETED booking
// ============================================
router.post('/', auth, asyncHandler(async (req, res) => {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { bookingId, rating, comment } = parsed.data;

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { car: { select: { id: true, ownerId: true } } }
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const isRenter = booking.renterId === req.user.id;
    const isOwner = booking.car.ownerId === req.user.id;
    if (!isRenter && !isOwner) {
        return res.status(403).json({ error: 'No participaste en esta reserva.' });
    }
    if (booking.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Solo se pueden reseñar reservas completadas.' });
    }

    // Already reviewed by this author?
    const existing = await prisma.review.findUnique({
        where: { bookingId_authorId: { bookingId, authorId: req.user.id } }
    });
    if (existing) {
        return res.status(409).json({ error: 'Ya dejaste tu reseña para esta reserva.' });
    }

    const kind = isRenter ? 'RENTER_TO_OWNER' : 'OWNER_TO_RENTER';
    const targetUserId = isRenter ? booking.car.ownerId : booking.renterId;

    const review = await prisma.$transaction(async (tx) => {
        const r = await tx.review.create({
            data: {
                bookingId,
                kind,
                rating,
                comment: comment || null,
                authorId: req.user.id,
                targetUserId,
                carId: booking.car.id
            }
        });

        // Renter→Owner reviews update the car's public rating
        if (kind === 'RENTER_TO_OWNER') {
            const agg = await tx.review.aggregate({
                where: { carId: booking.car.id, kind: 'RENTER_TO_OWNER' },
                _avg: { rating: true },
                _count: true
            });
            await tx.car.update({
                where: { id: booking.car.id },
                data: { rating: agg._avg.rating || 0, reviewCount: agg._count }
            });
        }

        // Both directions update the target user's trust score
        await recomputeUserTrust(tx, targetUserId);

        return r;
    });

    res.status(201).json({ message: '¡Gracias por tu reseña!', review });
}));

// ============================================
// GET /api/reviews/car/:carId  — public list (renter→owner only)
// ============================================
router.get('/car/:carId', asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
        where: { carId: req.params.carId, kind: 'RENTER_TO_OWNER' },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(reviews);
}));

// ============================================
// GET /api/reviews/user/:userId  — reviews a user has received (both kinds)
// ============================================
router.get('/user/:userId', asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
        where: { targetUserId: req.params.userId },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(reviews);
}));

// ============================================
// GET /api/reviews/booking/:bookingId  — has the current user already reviewed?
// Returns { mine: Review|null, theirs: Review|null }
// ============================================
router.get('/booking/:bookingId', auth, asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
        where: { bookingId: req.params.bookingId },
        include: { author: { select: { name: true } } }
    });
    const mine = reviews.find(r => r.authorId === req.user.id) || null;
    const theirs = reviews.find(r => r.authorId !== req.user.id) || null;
    res.json({ mine, theirs });
}));

module.exports = router;
