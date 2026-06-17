const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const urlOpt = z.string().url('URL inválida').optional().or(z.literal(''));

const submitSchema = z.object({
    cedulaFrontUrl: urlOpt,
    cedulaBackUrl: urlOpt,
    selfieUrl: urlOpt
}).refine(d => d.cedulaFrontUrl || d.cedulaBackUrl || d.selfieUrl, {
    message: 'Sube al menos una foto de tu cédula o selfie.'
});

// ============================================
// GET /api/kyc/me  — current user's KYC status
// ============================================
router.get('/me', auth, asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            kycStatus: true,
            kycCedulaFrontUrl: true,
            kycCedulaBackUrl: true,
            kycSelfieUrl: true,
            kycSubmittedAt: true,
            kycReviewedAt: true,
            kycRejectReason: true
        }
    });
    res.json(u);
}));

// ============================================
// POST /api/kyc/submit  — user submits documents
// ============================================
router.post('/submit', auth, asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
    }
    const { cedulaFrontUrl, cedulaBackUrl, selfieUrl } = parsed.data;

    const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
            kycCedulaFrontUrl: cedulaFrontUrl || null,
            kycCedulaBackUrl: cedulaBackUrl || null,
            kycSelfieUrl: selfieUrl || null,
            kycStatus: 'IN_REVIEW',
            kycSubmittedAt: new Date(),
            kycRejectReason: null
        },
        select: { id: true, kycStatus: true, kycSubmittedAt: true }
    });

    await prisma.auditLog.create({
        data: { action: 'KYC_SUBMITTED', userId: req.user.id }
    });

    res.json({
        message: 'Documentos enviados. Un administrador los revisará pronto.',
        user: updated
    });
}));

// ============================================
// GET /api/kyc/pending  (admin) — list submissions in review
// ============================================
router.get('/pending', auth, requireAdmin, asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
        where: { kycStatus: 'IN_REVIEW' },
        select: {
            id: true, name: true, email: true, role: true,
            kycCedulaFrontUrl: true, kycCedulaBackUrl: true, kycSelfieUrl: true,
            kycSubmittedAt: true
        },
        orderBy: { kycSubmittedAt: 'asc' }
    });
    res.json(users);
}));

// ============================================
// POST /api/kyc/:userId/approve  (admin)
// ============================================
router.post('/:userId/approve', auth, requireAdmin, asyncHandler(async (req, res) => {
    const u = await prisma.user.update({
        where: { id: req.params.userId },
        data: {
            kycStatus: 'VERIFIED',
            kycReviewedAt: new Date(),
            kycRejectReason: null
        },
        select: { id: true, kycStatus: true }
    });
    await prisma.auditLog.create({
        data: {
            action: 'KYC_APPROVED',
            context: JSON.stringify({ targetUserId: u.id, by: req.user.id }),
            userId: req.user.id
        }
    });
    res.json({ message: 'Identidad verificada.', user: u });
}));

// ============================================
// POST /api/kyc/:userId/reject  (admin)
// ============================================
router.post('/:userId/reject', auth, requireAdmin, asyncHandler(async (req, res) => {
    const reason = (req.body?.reason || '').toString().slice(0, 500);
    const u = await prisma.user.update({
        where: { id: req.params.userId },
        data: {
            kycStatus: 'REJECTED',
            kycReviewedAt: new Date(),
            kycRejectReason: reason || 'Sin motivo especificado'
        },
        select: { id: true, kycStatus: true, kycRejectReason: true }
    });
    await prisma.auditLog.create({
        data: {
            action: 'KYC_REJECTED',
            context: JSON.stringify({ targetUserId: u.id, by: req.user.id, reason }),
            userId: req.user.id
        }
    });
    res.json({ message: 'Verificación rechazada.', user: u });
}));

module.exports = router;
