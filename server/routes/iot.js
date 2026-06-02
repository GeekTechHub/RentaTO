const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const IoTEngine = require('../engines/IoTEngine');

const prisma = new PrismaClient();

/**
 * GET /api/iot/telemetry/:carId
 * Retrieves deep context telemetry for a mapped asset.
 */
router.get('/telemetry/:carId', auth, async (req, res) => {
    try {
        const pulse = IoTEngine.getTelemetryPulse(req.params.carId);
        res.json(pulse);
    } catch (err) {
        res.status(500).json({ error: 'Telemetry Sync Entropy High' });
    }
});

/**
 * POST /api/iot/neural-key
 * Generates a sovereign access key for a confirmed booking.
 */
router.post('/neural-key', auth, async (req, res) => {
    const { bookingId } = req.body;
    try {
        const key = IoTEngine.generateNeuralKey(bookingId, req.user.id);

        // Log key generation to the WORM Ledger
        await prisma.auditLog.create({
            data: {
                action: 'NEURAL_KEY_GENERATED',
                context: JSON.stringify({ bookingId, userId: req.user.id, timestamp: new Date() }),
                userId: req.user.id
            }
        });

        res.json({
            status: 'CONVERGENCE_LOCKED',
            neuralKey: key,
            expiresAt: new Date(Date.now() + 3600000).toISOString() // 1h expiry
        });
    } catch (err) {
        res.status(500).json({ error: 'Legislative Synthesis Failure' });
    }
});

module.exports = router;
