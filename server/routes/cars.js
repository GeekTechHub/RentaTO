const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- GET /api/cars ---
router.get('/', async (req, res) => {
    const { q, loc, type, domain, energyType, category } = req.query;
    try {
        const cars = await prisma.car.findMany({
            where: {
                AND: [
                    q ? { OR: [{ brand: { contains: q } }, { model: { contains: q } }] } : {},
                    loc ? { location: { contains: loc } } : {},
                    type ? { type: type } : {},
                    domain ? { domain: domain } : {},
                    energyType ? { energyType: energyType } : {},
                    category ? { category: category } : {}
                ]
            },
            include: { owner: { select: { name: true, kycStatus: true } } }
        });
        res.json(cars);
    } catch (err) {
        res.status(500).json({ error: 'Search Engine Retrieval Error' });
    }
});

// --- POST /api/cars (Protected) ---
router.post('/', auth, async (req, res) => {
    const {
        brand, model, year, type, location, price, deposit, note, image,
        domain, energyType, category, capacity, requiresOperatorLevel, safetyProfile,
        transmission, licensePlate, chassisNumber, fuelRange
    } = req.body;

    try {
        // Validation Logic: Status ZZ Universal Rules
        if (domain === 'AIR' && !['JET_FUEL', 'AVGAS', 'ELECTRIC'].includes(energyType)) {
            return res.status(400).json({ error: 'DNA Mismatch: Invalid Propulsion for AIR domain' });
        }

        if (domain === 'WATER' && !['GASOLINE', 'DIESEL', 'ELECTRIC', 'HUMAN'].includes(energyType)) {
            return res.status(400).json({ error: 'DNA Mismatch: Invalid Propulsion for WATER domain' });
        }

        const car = await prisma.car.create({
            data: {
                brand, model, year: parseInt(year), type, location,
                price: parseFloat(price), deposit: parseFloat(deposit),
                note, image, ownerId: req.user.id,
                domain: domain || 'LAND',
                energyType: energyType || 'GASOLINE',
                category: category || 'SEDAN',
                capacity: parseInt(capacity) || 4,
                requiresOperatorLevel,
                safetyProfile: safetyProfile || `${(domain || 'LAND').toLowerCase()}_standard`,
                transmission: transmission || 'AUTOMATIC',
                licensePlate,
                chassisNumber,
                fuelRange: fuelRange ? parseInt(fuelRange) : 500
            }
        });
        res.json({ message: 'Universal Asset Mapped to DNA', carId: car.id });
    } catch (err) {
        res.status(400).json({ error: 'Mapping Error: Invalid Data Synthesis' });
    }
});

// --- GET /api/cars/recommendations (Protected) ---
router.get('/recommendations', auth, async (req, res) => {
    try {
        const RecommendationEngine = require('../engines/RecommendationEngine');
        const recommendations = await RecommendationEngine.recommend(req.user.id);
        res.json(recommendations);
    } catch (err) {
        res.status(500).json({ error: 'Recommendation Neural Sync Failed' });
    }
});

module.exports = router;
