const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
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

const carBaseSchema = z.object({
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
    contactPhone: z.string().max(30).optional().or(z.literal('')),
    fuelRange: z.coerce.number().int().nonnegative().default(500)
});

const energyMatchesDomain = (d) =>
    !d.domain || !d.energyType || (DOMAIN_ENERGY[d.domain] || []).includes(d.energyType);

const createCarSchema = carBaseSchema.refine(energyMatchesDomain, {
    message: 'Tipo de energía no compatible con el dominio',
    path: ['energyType']
});

// For PUT: partial() on the base (no refinement), then re-apply the check
const updateCarSchema = carBaseSchema.partial().refine(energyMatchesDomain, {
    message: 'Tipo de energía no compatible con el dominio',
    path: ['energyType']
});

// ============================================
// GET /api/cars  (Public catalog with filters)
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const { q, loc, type, domain, energyType, category, minPrice, maxPrice, minCapacity } = req.query;
    const priceFilter = {};
    if (minPrice) priceFilter.gte = parseFloat(minPrice);
    if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
    const cars = await prisma.car.findMany({
        where: {
            verified: true, // Only approved cars are public
            AND: [
                q ? { OR: [
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } }
                ] } : {},
                loc ? { location: { contains: loc, mode: 'insensitive' } } : {},
                type ? { type } : {},
                domain ? { domain } : {},
                energyType ? { energyType } : {},
                category ? { category } : {},
                Object.keys(priceFilter).length ? { price: priceFilter } : {},
                minCapacity ? { capacity: { gte: parseInt(minCapacity, 10) } } : {}
            ]
        },
        include: { owner: { select: { name: true, kycStatus: true, trustScore: true } } },
        orderBy: { createdAt: 'desc' }
    });
    // contactPhone is private — only revealed via the paid connection unlock
    res.json(cars.map(({ contactPhone, ...rest }) => rest));
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
    res.json((recommendations || []).map(({ contactPhone, ...rest }) => rest));
}));

// ============================================
// GET /api/cars/admin/pending  (Admin — cars awaiting approval) — before /:id
// ============================================
router.get('/admin/pending', auth, requireAdmin, asyncHandler(async (req, res) => {
    const cars = await prisma.car.findMany({
        where: { verified: false },
        include: { owner: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'asc' }
    });
    res.json(cars);
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
    // contactPhone is private — only revealed via the paid connection unlock
    const { contactPhone, ...publicCar } = car;
    res.json(publicCar);
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
            image: data.image || null,
            verified: false,        // Pending admin approval
            dnaStatus: 'PENDING'
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'CAR_SUBMITTED',
            context: JSON.stringify({ carId: car.id, brand: car.brand, model: car.model }),
            userId: req.user.id
        }
    });

    res.status(201).json({
        message: 'Tu vehículo fue enviado a revisión. Aparecerá en el catálogo cuando nuestro equipo lo apruebe.',
        car
    });
}));

// ============================================
// POST /api/cars/:id/approve  (Admin)
// ============================================
router.post('/:id/approve', auth, requireAdmin, asyncHandler(async (req, res) => {
    const car = await prisma.car.update({
        where: { id: req.params.id },
        data: { verified: true, dnaStatus: 'VERIFIED' }
    });
    await prisma.auditLog.create({
        data: {
            action: 'CAR_APPROVED',
            context: JSON.stringify({ carId: car.id, approvedBy: req.user.id }),
            userId: req.user.id
        }
    });
    res.json({ message: 'Vehículo aprobado y publicado.', car });
}));

// ============================================
// POST /api/cars/:id/reject  (Admin)
// ============================================
router.post('/:id/reject', auth, requireAdmin, asyncHandler(async (req, res) => {
    const car = await prisma.car.update({
        where: { id: req.params.id },
        data: { verified: false, dnaStatus: 'REJECTED' }
    });
    await prisma.auditLog.create({
        data: {
            action: 'CAR_REJECTED',
            context: JSON.stringify({ carId: car.id, rejectedBy: req.user.id, reason: req.body?.reason || null }),
            userId: req.user.id
        }
    });
    res.json({ message: 'Vehículo rechazado.', car });
}));

// ============================================
// PUT /api/cars/:id  (Update — owner only)
// ============================================
router.put('/:id', auth, validate(updateCarSchema), asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (car.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el dueño puede editar este vehículo' });
    }

    // If meaningful fields change, the vehicle goes back to the moderation queue.
    // (Admins editing their own car can stay verified.)
    const MEANINGFUL = ['brand', 'model', 'year', 'price', 'deposit', 'location',
        'note', 'image', 'domain', 'category', 'capacity', 'licensePlate', 'chassisNumber'];
    const changed = MEANINGFUL.some(k => k in req.body && req.body[k] !== car[k]);
    const data = { ...req.body };
    if (changed && req.user.role !== 'ADMIN') {
        data.verified = false;
        data.dnaStatus = 'PENDING';
    }

    const updated = await prisma.car.update({
        where: { id: req.params.id },
        data
    });

    await prisma.auditLog.create({
        data: {
            action: 'CAR_UPDATED',
            context: JSON.stringify({ carId: car.id, changed, requeued: changed && req.user.role !== 'ADMIN' }),
            userId: req.user.id
        }
    });

    res.json({
        message: changed && req.user.role !== 'ADMIN'
            ? 'Vehículo actualizado. Volverá al catálogo público cuando un administrador lo apruebe.'
            : 'Vehículo actualizado.',
        car: updated
    });
}));

// ============================================
// DELETE /api/cars/:id  (Delete — owner only)
// ============================================
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (car.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
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
