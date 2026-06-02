const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const DAOEngine = require('../engines/DAOEngine');

const prisma = new PrismaClient();

// Simulated Proposal Store
let proposals = [
    {
        proposalId: 'DAO-PROP-01',
        title: 'Expansión a Región Este (Punta Cana Expansion)',
        description: 'Incrementar la flota local en un 15% para satisfacer demanda turística.',
        status: 'ACTIVE_SYNCHRONIZATION',
        votes: { yes: 120, no: 15, power: 0.75 }
    }
];

/**
 * GET /api/dao/proposals
 * Retrieves all active governance hilos.
 */
router.get('/proposals', auth, async (req, res) => {
    res.json(proposals);
});

/**
 * POST /api/dao/vote
 * Casts a weighted vote based on User DNA.
 */
router.post('/vote', auth, async (req, res) => {
    const { proposalId, choice } = req.body;
    try {
        // In a real system, we would calculate this from the DB (User shares + TrustScore)
        const votingPower = DAOEngine.calculateVotingPower({ trustScore: req.user.trustScore || 88 }, 50);

        // Log vote to WORM Ledger
        await prisma.auditLog.create({
            data: {
                action: 'DAO_VOTE_CAST',
                context: JSON.stringify({ proposalId, choice, power: votingPower.power, userId: req.user.id }),
                userId: req.user.id
            }
        });

        res.json({
            message: 'Voto Sincronizado: Influencia Neural Registrada',
            weight: votingPower.power,
            tier: votingPower.tier
        });
    } catch (err) {
        res.status(500).json({ error: 'Governance Pulse Failure' });
    }
});

module.exports = router;
