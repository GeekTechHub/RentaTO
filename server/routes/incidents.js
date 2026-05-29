const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const IncidentEngine = require('../engines/IncidentEngine');
const IoTEngine = require('../engines/IoTEngine');

const prisma = new PrismaClient();

/**
 * GET /api/incidents/predict/:carId
 * Retrieves the predictive risk pulse for an asset.
 */
router.get('/predict/:carId', auth, async (req, res) => {
    try {
        const telemetry = IoTEngine.getTelemetryPulse(req.params.carId);
        const prediction = IncidentEngine.predictRisk(telemetry);
        res.json({ telemetry, prediction });
    } catch (err) {
        res.status(500).json({ error: 'Predictive Sync Failed' });
    }
});

/**
 * POST /api/incidents/claim
 * Forges an automated insurance claim for a booking.
 */
router.post('/claim', auth, async (req, res) => {
    const { bookingId } = req.body;
    try {
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        const telemetry = IoTEngine.getTelemetryPulse(booking.carId);
        const claim = IncidentEngine.forgeClaim(booking, telemetry, req.user.id);

        // Log claim to WORM Ledger
        await prisma.auditLog.create({
            data: {
                action: 'INSURANCE_CLAIM_FORGED',
                context: JSON.stringify({ claimId: claim.claimId, bookingId, timestamp: new Date() }),
                userId: req.user.id
            }
        });

        res.json(claim);
    } catch (err) {
        res.status(500).json({ error: 'Claim Forging Entropy High' });
    }
});

module.exports = router;
