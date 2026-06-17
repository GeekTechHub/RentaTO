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

// ============================================
// POST /api/reviews  — renter leaves a review after a COMPLETED booking
// ============================================
router.post('/', auth, asyncHandler(async (req, res) => {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { bookingId, rating, comment } = parsed.data;

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            car: { select: { id: true, ownerId: true } },
            review: true
        }
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (booking.renterId !== req.user.id) {
        return res.status(403).json({ error: 'Solo el rentador puede dejar reseña.' });
    }
    if (booking.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Solo se pueden reseñar reservas completadas.' });
    }
    if (booking.review) {
        return res.status(409).json({ error: 'Esta reserva ya tiene reseña.' });
    }

    // Create review + recompute car aggregate in a transaction
    const review = await prisma.$transaction(async (tx) => {
        const r = await tx.review.create({
            data: {
                bookingId,
                rating,
                comment: comment || null,
                authorId: req.user.id,
                targetUserId: booking.car.ownerId,
                carId: booking.car.id
            }
        });

        const agg = await tx.review.aggregate({
            where: { carId: booking.car.id },
            _avg: { rating: true },
            _count: true
        });

        await tx.car.update({
            where: { id: booking.car.id },
            data: {
                rating: agg._avg.rating || 0,
                reviewCount: agg._count
            }
        });

        return r;
    });

    res.status(201).json({ message: '¡Gracias por tu reseña!', review });
}));

// ============================================
// GET /api/reviews/car/:carId  — public list for a car
// ============================================
router.get('/car/:carId', asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
        where: { carId: req.params.carId },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(reviews);
}));

// ============================================
// GET /api/reviews/booking/:bookingId  — used by UI to know if review exists
// ============================================
router.get('/booking/:bookingId', auth, asyncHandler(async (req, res) => {
    const review = await prisma.review.findUnique({
        where: { bookingId: req.params.bookingId }
    });
    res.json(review);
}));

module.exports = router;
