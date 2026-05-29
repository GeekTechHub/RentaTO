const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RiskEngine = require('../engines/RiskEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- POST /api/risk-check (Protected) ---
router.post('/', auth, async (req, res) => {
    const { carId } = req.body;
    try {
        const car = await prisma.car.findUnique({
            where: { id: carId },
            include: { owner: true }
        });

        if (!car) return res.status(404).json({ error: 'Asset not found' });

        const score = RiskEngine.calculateScore(car, car.owner);
        const recommendation = RiskEngine.getRecommendation(score);

        res.json({ score, recommendation });
    } catch (err) {
        res.status(500).json({ error: 'Risk Calculation Error' });
    }
});

module.exports = router;
