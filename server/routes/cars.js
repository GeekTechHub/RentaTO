const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- Schemas ---
const DOMAIN_ENERGY = {
    AIR: ['JET_FUEL', 'AVGAS', 'ELECTRIC'],
    WATER: ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HUMAN'],
    LAND: ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID', 'HUMAN']
};

const createCarSchema = z.object({
    brand: z.string().min(1, 'Marca requerida').max(50).trim(),
    model: z.string().min(1, 'Modelo requerido').max(60).trim(),
    year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
    type: z.string().min(1).max(40).trim(),
    location: z.string().min(2).max(80).trim(),
    price: z.coerce.number().positive('El precio debe ser mayor a 0'),
    deposit: z.coerce.number().nonnegative('Depósito no puede ser negativo'),
    note: z.string().max(500).optional(),
    image: z.string().url('image debe ser URL válida').optional().or(z.literal('')),
    domain: z.enum(['LAND', 'WATER', 'AIR']).default('LAND'),
    energyType: z.string().default('GASOLINE'),
    category: z.string().default('SEDAN'),
    capacity: z.coerce.number().int().positive().default(4),
    requiresOperatorLevel: z.string().default('STANDARD_LICENSE'),
    safetyProfile: z.string().optional(),
    transmission: z.enum(['AUTOMATIC', 'MANUAL']).default('AUTOMATIC'),
    licensePlate: z.string().max(20).optional(),
    chassisNumber: z.string().max(50).optional(),
    fuelRange: z.coerce.number().int().nonnegative().default(500)
}).refine(d => DOMAIN_ENERGY[d.domain].includes(d.energyType), {
    message: 'Tipo de energía no compatible con el dominio',
    path: ['energyType']
});

// ============================================
// GET /api/cars  (Public catalog with filters)
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const { q, loc, type, domain, energyType, category } = req.query;
    const cars = await prisma.car.findMany({
        where: {
            AND: [
                q ? { OR: [
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } }
                ] } : {},
                loc ? { location: { contains: loc, mode: 'insensitive' } } : {},
                type ? { type } : {},
                domain ? { domain } : {},
                energyType ? { energyType } : {},
                category ? { category } : {}
            ]
        },
        include: { owner: { select: { name: true, kycStatus: true, trustScore: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(cars);
}));

// ============================================
// GET /api/cars/mine  (Cars owned by current user) — MUST be before /:id
// ============================================
router.get('/mine', auth, asyncHandler(async (req, res) => {
    const cars = await prisma.car.findMany({
        where: { ownerId: req.user.id },
        include: {
            _count: { select: { bookings: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(cars);
}));

// ============================================
// GET /api/cars/recommendations  (Protected) — MUST be before /:id
// ============================================
router.get('/recommendations', auth, asyncHandler(async (req, res) => {
    let recommendations = [];
    try {
        const RecommendationEngine = require('../engines/RecommendationEngine');
        recommendations = await RecommendationEngine.recommend(req.user.id);
    } catch (err) {
        // Fallback: most recent verified cars
        recommendations = await prisma.car.findMany({
            where: { verified: true },
            include: { owner: { select: { name: true, trustScore: true } } },
            orderBy: { createdAt: 'desc' },
            take: 3
        });
    }
    res.json(recommendations);
}));

// ============================================
// GET /api/cars/:id  (Single car details)
// ============================================
router.get('/:id', asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({
        where: { id: req.params.id },
        include: {
            owner: { select: { id: true, name: true, kycStatus: true, trustScore: true } }
        }
    });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(car);
}));

// ============================================
// POST /api/cars  (Create a vehicle listing)
// ============================================
router.post('/', auth, validate(createCarSchema), asyncHandler(async (req, res) => {
    const data = req.body;
    data.safetyProfile = data.safetyProfile || `${data.domain.toLowerCase()}_standard`;

    const car = await prisma.car.create({
        data: {
            ...data,
            ownerId: req.user.id,
            image: data.image || null
        }
    });

    res.status(201).json({
        message: 'Vehículo publicado en el catálogo.',
        car
    });
}));

// ============================================
// PUT /api/cars/:id  (Update — owner only)
// ============================================
router.put('/:id', auth, validate(createCarSchema.partial()), asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (car.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Solo el dueño puede editar este vehículo' });
    }

    const updated = await prisma.car.update({
        where: { id: req.params.id },
        data: req.body
    });
    res.json({ message: 'Vehículo actualizado.', car: updated });
}));

// ============================================
// DELETE /api/cars/:id  (Delete — owner only)
// ============================================
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (car.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Solo el dueño puede eliminar este vehículo' });
    }

    // Block deletion if there are active bookings
    const activeBookings = await prisma.booking.count({
        where: { carId: req.params.id, status: { in: ['PENDING', 'CONFIRMED'] } }
    });
    if (activeBookings > 0) {
        return res.status(409).json({
            error: 'No se puede eliminar un vehículo con reservas activas',
            activeBookings
        });
    }

    await prisma.car.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehículo eliminado.' });
}));

module.exports = router;
