const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ContractEngine = require('../engines/ContractEngine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- GET /api/contracts/:bookingId (Protected) ---
router.get('/:bookingId', auth, async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            include: {
                renter: { select: { name: true } },
                car: { include: { owner: { select: { name: true } } } }
            }
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // Check if contract already exists
        let contract = await prisma.contract.findUnique({
            where: { bookingId: req.params.bookingId }
        });

        if (!contract) {
            const contractText = ContractEngine.forge({
                id: booking.id,
                renterName: booking.renter.name,
                ownerName: booking.car.owner.name,
                domain: booking.car.domain,
                category: booking.car.category,
                carDetails: `${booking.car.brand} ${booking.car.model} (${booking.car.year})`,
                startDate: booking.startDate.toDateString(),
                endDate: booking.endDate.toDateString(),
                totalPrice: booking.totalPrice,
                deposit: booking.car.deposit
            });

            // Policy Snapshot (Simulated)
            const policySnapshot = JSON.stringify({
                penaltyPerHour: 250,
                cancellationFee: 1000,
                disputeResolution: 'Arbritraje RD'
            });

            contract = await prisma.contract.create({
                data: {
                    bookingId: booking.id,
                    content: contractText,
                    // We'll use the signatureHash fields or content for now as metadata storage
                    // for the sake of this simulation, but ideally they'd have their own fields.
                }
            });

            // To satisfy the "no hidden data" requirement, we'll append the policy to the content
            const updatedContent = contractText + `\n\n--- POLICY SNAPSHOT ---\n${policySnapshot}`;
            contract = await prisma.contract.update({
                where: { id: contract.id },
                data: { content: updatedContent }
            });
        }

        res.json({
            contractText: contract.content,
            signedAt: contract.signedAt,
            id: contract.id
        });
    } catch (err) {
        res.status(500).json({ error: 'Contract Forging Failure' });
    }
});

// --- POST /api/contracts/sign (Protected) ---
router.post('/sign', auth, async (req, res) => {
    const { bookingId } = req.body;
    try {
        const BiometricEngine = require('../engines/BiometricEngine');
        const biometricTrace = BiometricEngine.generateTrace(req.user.id);
        const signatureHash = JSON.stringify(biometricTrace);

        // Update Contract in DB
        await prisma.contract.update({
            where: { bookingId },
            data: {
                signedAt: new Date(),
                signatureHash
            }
        });

        // WORM Ledger Entry for Signature
        await prisma.auditLog.create({
            data: {
                action: 'CONTRACT_SIGNED_BIOMETRIC',
                context: JSON.stringify({ bookingId, signatureTrace: biometricTrace, timestamp: new Date() }),
                userId: req.user.id
            }
        });

        res.json({
            message: 'Sincronización Jurídica Completada: Firma Biométrica Exitosa.',
            trace: biometricTrace
        });
    } catch (err) {
        res.status(400).json({ error: 'Biometric Rejection: Neural sync failed' });
    }
});

module.exports = router;
