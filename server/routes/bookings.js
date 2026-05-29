const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- POST /api/bookings (Protected) ---
router.post('/', auth, async (req, res) => {
    const { carId, startDate, endDate, totalPrice } = req.body;
    try {
        const booking = await prisma.booking.create({
            data: {
                carId,
                renterId: req.user.id,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                totalPrice: parseFloat(totalPrice),
                depositStatus: 'HELD',
                status: 'CONFIRMED'
            }
        });

        // Update car trips count
        await prisma.car.update({
            where: { id: carId },
            data: { trips: { increment: 1 } }
        });

        // --- WORM Ledger Entry ---
        await prisma.auditLog.create({
            data: {
                action: 'BOOKING_CREATED',
                context: JSON.stringify({ carId, bookingId: booking.id, totalPrice }),
                userId: req.user.id
            }
        });

        // --- Currency Synthesis ---
        const CurrencyEngine = require('../engines/CurrencyEngine');
        const breakdown = CurrencyEngine.getBreakdown(parseFloat(totalPrice));

        res.json({
            message: 'Protocolo de Escrow Global Iniciado: Garantía HELD',
            bookingId: booking.id,
            juridicalStatus: 'Maximum Density Achieved',
            financialBreakdown: breakdown
        });
    } catch (err) {
        res.status(400).json({ error: 'Escrow Failure: Invalid Mapping' });
    }
});

// --- POST /api/bookings/:id/complete (Protected) ---
router.post('/:id/complete', auth, async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { car: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking missing' });

        const now = new Date();
        const end = new Date(booking.endDate);
        let penalty = 0;

        if (now > end) {
            const hoursLate = Math.ceil((now - end) / (1000 * 60 * 60));
            const ContractEngine = require('../engines/ContractEngine');
            penalty = ContractEngine.calculatePenalty(hoursLate);
        }

        const depositStatus = penalty > 0 ? 'CLAIMED' : 'RELEASED';

        const updated = await prisma.booking.update({
            where: { id: req.params.id },
            data: {
                status: 'COMPLETED',
                depositStatus
            }
        });

        // WORM Ledger Hardening
        await prisma.auditLog.create({
            data: {
                action: 'BOOKING_COMPLETED',
                context: JSON.stringify({
                    bookingId: booking.id,
                    penalty,
                    finalDepositStatus: depositStatus,
                    systemTime: now
                }),
                userId: req.user.id
            }
        });

        res.json({
            message: `Checkout Procesado: Depósito ${depositStatus}.`,
            penaltyApplied: penalty,
            ledgerId: updated.id
        });
    } catch (err) {
        res.status(500).json({ error: 'Finalization Failure' });
    }
});

// --- GET /api/bookings (Protected - My Bookings) ---
router.get('/me', auth, async (req, res) => {
    try {
        const bookings = await prisma.booking.findMany({
            where: { renterId: req.user.id },
            include: { car: true }
        });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Retrieval Error' });
    }
});

module.exports = router;
