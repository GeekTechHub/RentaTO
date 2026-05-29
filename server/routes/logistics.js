const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LogisticsEngine = require('../engines/LogisticsEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- GET /api/logistics/estimate ---
router.get('/estimate', auth, async (req, res) => {
    const { from, to, priority } = req.query;
    try {
        const estimate = LogisticsEngine.calculateDelivery(from, to, priority);
        res.json(estimate);
    } catch (err) {
        res.status(500).json({ error: 'Logistics Sync Failed' });
    }
});

// --- POST /api/logistics/assign ---
router.post('/assign', auth, async (req, res) => {
    const { bookingId, from, to, priority } = req.body;
    try {
        const estimate = LogisticsEngine.calculateDelivery(from, to, priority);

        // Log to WORM Ledger
        await prisma.auditLog.create({
            data: {
                action: 'LOGISTICS_ASSIGNED',
                context: JSON.stringify({ bookingId, estimate }),
                userId: req.user.id
            }
        });

        res.json({ message: 'Logistics DNA Assigned', estimate });
    } catch (err) {
        res.status(400).json({ error: 'Logistics Assignment Refused' });
    }
});

module.exports = router;
