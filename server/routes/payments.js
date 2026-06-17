const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── PayPal config ──
// Set these env vars in Render:
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV ('sandbox' | 'live')
const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE = PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
const FEE_AMOUNT = '1.00';
const FEE_CURRENCY = 'USD';

const paypalConfigured = () =>
    !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);

// Get an OAuth token from PayPal
const getAccessToken = async () => {
    const creds = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64');
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`PayPal auth falló: ${res.status} ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.access_token;
};

// ============================================
// GET /api/payments/config  — frontend needs the public client id + env
// ============================================
router.get('/config', (req, res) => {
    res.json({
        enabled: paypalConfigured(),
        env: PAYPAL_ENV,
        clientId: process.env.PAYPAL_CLIENT_ID || null,
        amount: FEE_AMOUNT,
        currency: FEE_CURRENCY
    });
});

// ============================================
// GET /api/payments/unlock-status/:carId  — has the current user unlocked this car?
// ============================================
router.get('/unlock-status/:carId', auth, asyncHandler(async (req, res) => {
    const unlock = await prisma.connectionUnlock.findUnique({
        where: { renterId_carId: { renterId: req.user.id, carId: req.params.carId } }
    });

    const paid = unlock && unlock.status === 'PAID';
    let contactPhone = null;
    if (paid) {
        const car = await prisma.car.findUnique({
            where: { id: req.params.carId },
            select: { contactPhone: true }
        });
        contactPhone = car?.contactPhone || null;
    }
    res.json({ unlocked: !!paid, contactPhone });
}));

// ============================================
// POST /api/payments/create-order  — create a $1 PayPal order for a car connection
// body: { carId }
// ============================================
const createOrderSchema = z.object({ carId: z.string().uuid('carId inválido') });

router.post('/create-order', auth, asyncHandler(async (req, res) => {
    if (!paypalConfigured()) {
        return res.status(503).json({ error: 'Pagos no configurados todavía.', code: 'PAYMENTS_OFF' });
    }
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { carId } = parsed.data;

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (car.ownerId === req.user.id) {
        return res.status(400).json({ error: 'Es tu propio vehículo; no necesitas desbloquearlo.' });
    }

    // Already unlocked?
    const existing = await prisma.connectionUnlock.findUnique({
        where: { renterId_carId: { renterId: req.user.id, carId } }
    });
    if (existing && existing.status === 'PAID') {
        return res.status(409).json({ error: 'Ya desbloqueaste el contacto de este dueño.', code: 'ALREADY_UNLOCKED' });
    }

    const token = await getAccessToken();
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: FEE_CURRENCY, value: FEE_AMOUNT },
                description: `RentaTO — conexión con dueño de ${car.brand} ${car.model}`
            }]
        })
    });
    if (!orderRes.ok) {
        const t = await orderRes.text();
        return res.status(502).json({ error: 'No se pudo crear la orden en PayPal', detail: t.slice(0, 200) });
    }
    const order = await orderRes.json();

    // Upsert a PENDING unlock row
    await prisma.connectionUnlock.upsert({
        where: { renterId_carId: { renterId: req.user.id, carId } },
        update: { providerOrderId: order.id, status: 'PENDING' },
        create: {
            renterId: req.user.id,
            carId,
            amount: 1,
            currency: FEE_CURRENCY,
            provider: 'paypal',
            providerOrderId: order.id,
            status: 'PENDING'
        }
    });

    res.json({ orderId: order.id });
}));

// ============================================
// POST /api/payments/capture-order  — capture after buyer approves
// body: { orderId, carId }
// ============================================
const captureSchema = z.object({
    orderId: z.string().min(1),
    carId: z.string().uuid('carId inválido')
});

router.post('/capture-order', auth, asyncHandler(async (req, res) => {
    if (!paypalConfigured()) {
        return res.status(503).json({ error: 'Pagos no configurados todavía.', code: 'PAYMENTS_OFF' });
    }
    const parsed = captureSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { orderId, carId } = parsed.data;

    const token = await getAccessToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    const capData = await capRes.json().catch(() => ({}));

    const completed = capRes.ok && capData.status === 'COMPLETED';
    if (!completed) {
        await prisma.connectionUnlock.updateMany({
            where: { renterId: req.user.id, carId, providerOrderId: orderId },
            data: { status: 'FAILED' }
        });
        return res.status(402).json({ error: 'El pago no se completó.', detail: capData.status || 'UNKNOWN' });
    }

    await prisma.connectionUnlock.updateMany({
        where: { renterId: req.user.id, carId, providerOrderId: orderId },
        data: { status: 'PAID' }
    });

    await prisma.auditLog.create({
        data: {
            action: 'CONNECTION_UNLOCKED',
            context: JSON.stringify({ carId, orderId, by: req.user.id }),
            userId: req.user.id
        }
    });

    const car = await prisma.car.findUnique({
        where: { id: carId },
        select: { contactPhone: true, brand: true, model: true }
    });

    res.json({
        message: '¡Pago confirmado! Aquí tienes el contacto del dueño.',
        contactPhone: car?.contactPhone || null
    });
}));

module.exports = router;
