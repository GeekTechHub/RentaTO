const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const SingularityEngine = require('../engines/SingularityEngine');

const prisma = new PrismaClient();

/**
 * GET /api/singularity/export
 * Standardized DNA Export for external systems.
 */
router.get('/export', auth, async (req, res) => {
    try {
        const bookings = await prisma.booking.findMany({ where: { userId: req.user.id } });
        // Simulated portfolio data
        const portfolio = [{ carId: 'TOKEN-99', shares: 50, dividendYield: 0.12 }];

        const dnaExport = SingularityEngine.exportDNA(req.user, bookings, portfolio);
        res.json(dnaExport);
    } catch (err) {
        res.status(500).json({ error: 'Singularity Export Failed' });
    }
});

/**
 * POST /api/singularity/heal
 * Manual trigger for Ledger self-healing.
 */
router.post('/heal', auth, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sentinel Access Required' });
    try {
        const status = await SingularityEngine.performReconciliation(prisma);
        res.json({ status, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: 'Self-Healing Protocol Failure' });
    }
});

module.exports = router;
