const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const TokenEngine = require('../engines/TokenEngine');

const prisma = new PrismaClient();

/**
 * GET /api/assets/market
 * List all cars available for fractional investment.
 */
router.get('/market', auth, async (req, res) => {
    try {
        const cars = await prisma.car.findMany({
            where: { verified: true },
            take: 10
        });

        const marketAssets = cars.map(car => ({
            ...car,
            fractional: TokenEngine.fractionate(car)
        }));

        res.json(marketAssets);
    } catch (err) {
        res.status(500).json({ error: 'Market Neural Sync Failed' });
    }
});

/**
 * POST /api/assets/buy
 * Simulated share purchase.
 */
router.post('/buy', auth, async (req, res) => {
    const { carId, shares } = req.body;
    try {
        const car = await prisma.car.findUnique({ where: { id: carId } });
        if (!car) return res.status(404).json({ error: 'Asset not found' });

        // Logic for share acquisition would involve a new model TokenShare
        // For simulation, we log the investment in the WORM Ledger
        await prisma.auditLog.create({
            data: {
                action: 'ASSET_SHARES_PURCHASED',
                context: JSON.stringify({ carId, shares, buyerId: req.user.id, timestamp: new Date() }),
                userId: req.user.id
            }
        });

        res.json({
            message: `Sincronización de Activo Completa: ${shares} acciones adquiridas.`,
            nftMetadata: TokenEngine.generateNFTMetadata(car)
        });
    } catch (err) {
        res.status(500).json({ error: 'Investment Sync Failed' });
    }
});

module.exports = router;
