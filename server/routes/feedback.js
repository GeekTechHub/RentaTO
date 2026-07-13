const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const feedbackSchema = z.object({
    name: z.string().max(120).optional().or(z.literal('')),
    email: z.string().email('Correo inválido').optional().or(z.literal('')),
    message: z.string().min(3, 'Mensaje muy corto').max(2000, 'Mensaje muy largo').trim()
});

// ============================================
// POST /api/feedback  — público, cualquiera puede enviar una recomendación
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { name, email, message } = parsed.data;

    const fb = await prisma.feedback.create({
        data: {
            name: name || null,
            email: email || null,
            message
        }
    });

    res.status(201).json({ message: 'Gracias por tu recomendación.', id: fb.id });
}));

// ============================================
// GET /api/feedback  (admin) — lista de recomendaciones
// ============================================
router.get('/', auth, requireAdmin, asyncHandler(async (req, res) => {
    const items = await prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    res.json(items);
}));

module.exports = router;
