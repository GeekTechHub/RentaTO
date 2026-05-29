const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- GET /api/admin/metrics (Protected) ---
router.get('/metrics', adminAuth, async (req, res) => {
    try {
        const userCount = await prisma.user.count();
        const carCount = await prisma.car.count();
        const bookingCount = await prisma.booking.count();
        const totalVolume = await prisma.booking.aggregate({
            _sum: { totalPrice: true }
        });

        res.json({
            users: userCount,
            cars: carCount,
            bookings: bookingCount,
            volume: totalVolume._sum.totalPrice || 0,
            entropyStatus: 'Stable'
        });
    } catch (err) {
        res.status(500).json({ error: 'Metrics Retrieval Failure' });
    }
});

// --- PATCH /api/admin/verify-kyc/:id (Protected) ---
router.patch('/verify-kyc/:id', adminAuth, async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { kycStatus: 'VERIFIED' }
        });

        // WORM Ledger Entry
        await prisma.auditLog.create({
            data: {
                action: 'KYC_VERIFIED',
                context: JSON.stringify({ targetUserId: user.id }),
                userId: req.user.id
            }
        });

        res.json({ message: 'Identity DNA Verified', userId: user.id });
    } catch (err) {
        res.status(400).json({ error: 'Verification Failure' });
    }
});

// --- GET /api/admin/audit-logs (Protected) ---
router.get('/audit-logs', adminAuth, async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Audit Retrieval Failure' });
    }
});

module.exports = router;
