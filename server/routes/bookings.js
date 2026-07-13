const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const mailer = require('../lib/mailer');

const prisma = new PrismaClient();

// --- Schemas ---
const createBookingSchema = z.object({
    carId: z.string().uuid('carId debe ser un UUID válido'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
}).refine(d => d.endDate > d.startDate, {
    message: 'La fecha final debe ser posterior a la inicial',
    path: ['endDate']
}).refine(d => {
    const startMidnight = new Date(d.startDate);
    startMidnight.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startMidnight >= today;
}, {
    message: 'No se pueden reservar fechas en el pasado',
    path: ['startDate']
});

// --- Helper: detect overlapping bookings on the same car ---
const hasConflict = async (carId, startDate, endDate, excludeBookingId = null) => {
    const conflicts = await prisma.booking.findMany({
        where: {
            carId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            AND: [
                { startDate: { lt: endDate } },
                { endDate: { gt: startDate } }
            ]
        }
    });
    return conflicts.length > 0;
};

// ============================================
// POST /api/bookings  (Renter creates a booking)
// ============================================
router.post('/', auth, validate(createBookingSchema), asyncHandler(async (req, res) => {
    const { carId, startDate, endDate } = req.body;

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });

    if (car.ownerId === req.user.id) {
        return res.status(403).json({ error: 'No puedes rentar tu propio vehículo' });
    }

    if (await hasConflict(carId, startDate, endDate)) {
        return res.status(409).json({
            error: 'El vehículo ya está reservado en esas fechas',
            code: 'BOOKING_CONFLICT'
        });
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil((endDate - startDate) / msPerDay);
    const totalPrice = parseFloat((car.price * days).toFixed(2));

    const booking = await prisma.booking.create({
        data: {
            carId, renterId: req.user.id, startDate, endDate,
            totalPrice, depositStatus: 'HELD', status: 'CONFIRMED'
        },
        include: {
            car: {
                select: {
                    brand: true, model: true, image: true, location: true,
                    owner: { select: { email: true } }
                }
            },
            renter: { select: { name: true } }
        }
    });

    await prisma.car.update({
        where: { id: carId },
        data: { trips: { increment: 1 } }
    });

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_CREATED',
            context: JSON.stringify({ carId, bookingId: booking.id, totalPrice, days }),
            userId: req.user.id
        }
    });

    // Notify the owner by email (fire-and-forget; never blocks the response)
    mailer.notifyNewBooking({
        ownerEmail: booking.car.owner?.email,
        renterName: booking.renter?.name || 'Un usuario',
        carName: `${booking.car.brand} ${booking.car.model}`,
        startDate: new Date(startDate).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }),
        endDate: new Date(endDate).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
    }).catch(() => {});

    let financialBreakdown = null;
    try {
        const CurrencyEngine = require('../engines/CurrencyEngine');
        if (CurrencyEngine.getBreakdown) {
            financialBreakdown = CurrencyEngine.getBreakdown(totalPrice);
        }
    } catch (_) { /* optional */ }

    res.status(201).json({
        message: 'Reserva confirmada. Coordina la entrega directamente con el dueño.',
        booking, days, totalPrice, financialBreakdown
    });
}));

// POST /api/bookings/:id/complete
router.post('/:id/complete', auth, asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
        where: { id: req.params.id }, include: { car: true }
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (booking.renterId !== req.user.id && booking.car.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Sin permisos sobre esta reserva' });
    }
    if (booking.status === 'COMPLETED') {
        return res.status(409).json({ error: 'La reserva ya está completada' });
    }

    const now = new Date();
    const end = new Date(booking.endDate);
    let penalty = 0;
    if (now > end) {
        const hoursLate = Math.ceil((now - end) / (1000 * 60 * 60));
        try {
            const ContractEngine = require('../engines/ContractEngine');
            if (ContractEngine.calculatePenalty) {
                penalty = ContractEngine.calculatePenalty(hoursLate);
            }
        } catch (_) { /* optional */ }
    }

    const depositStatus = penalty > 0 ? 'CLAIMED' : 'RELEASED';
    const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED', depositStatus }
    });

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_COMPLETED',
            context: JSON.stringify({ bookingId: booking.id, penalty, finalDepositStatus: depositStatus }),
            userId: req.user.id
        }
    });

    res.json({ message: `Reserva completada.`, penaltyApplied: penalty, booking: updated });
}));

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', auth, asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
        where: { id: req.params.id }, include: { car: true }
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (booking.renterId !== req.user.id && booking.car.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Sin permisos sobre esta reserva' });
    }
    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
        return res.status(409).json({ error: `No se puede cancelar una reserva ${booking.status}` });
    }

    const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED', depositStatus: 'RELEASED' }
    });

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_CANCELLED',
            context: JSON.stringify({ bookingId: booking.id, cancelledBy: req.user.id }),
            userId: req.user.id
        }
    });

    res.json({ message: 'Reserva cancelada.', booking: updated });
}));

// GET /api/bookings/me  (As renter)
router.get('/me', auth, asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
        where: { renterId: req.user.id },
        include: {
            car: {
                select: {
                    id: true, brand: true, model: true, year: true,
                    image: true, location: true, domain: true,
                    owner: { select: { name: true } }
                }
            },
            reviews: { select: { id: true, authorId: true, kind: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    const withFlags = bookings.map(b => ({
        ...b,
        iReviewed: b.reviews.some(r => r.authorId === req.user.id)
    }));
    res.json(withFlags);
}));

// GET /api/bookings/owner  (Bookings on cars I own)
router.get('/owner', auth, asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
        where: { car: { ownerId: req.user.id } },
        include: {
            car: { select: { id: true, brand: true, model: true, image: true } },
            renter: { select: { id: true, name: true, email: true, trustScore: true, kycStatus: true } },
            reviews: { select: { id: true, authorId: true, kind: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    const withFlags = bookings.map(b => ({
        ...b,
        iReviewed: b.reviews.some(r => r.authorId === req.user.id)
    }));
    res.json(withFlags);
}));

// GET /api/bookings/:id  (Details)
router.get('/:id', auth, asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
            car: { include: { owner: { select: { name: true, trustScore: true } } } },
            renter: { select: { id: true, name: true, trustScore: true } }
        }
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (booking.renterId !== req.user.id && booking.car.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Sin permisos sobre esta reserva' });
    }
    res.json(booking);
}));

module.exports = router;
