const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- POST /api/disputes (Protected) ---
router.post('/', auth, async (req, res) => {
    const { bookingId, reason } = req.body;
    try {
        const dispute = await prisma.dispute.create({
            data: { bookingId, reason }
        });

        // Logging for WORM
        await prisma.auditLog.create({
            data: {
                action: 'DISPUTE_OPENED',
                context: JSON.stringify({ bookingId, disputeId: dispute.id }),
                userId: req.user.id
            }
        });

        res.json({ message: 'Dispute Asset Mapped', disputeId: dispute.id });
    } catch (err) {
        res.status(400).json({ error: 'Dispute Mapping Failure' });
    }
});

module.exports = router;
