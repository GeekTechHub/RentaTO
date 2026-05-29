const LegalEngine = require('./LegalEngine');
const crypto = require('crypto');

const ContractEngine = {
    /**
     * Forges a high-fidelity digital contract.
     */
    forge: (data) => {
        // Simulated evidences (In a real scenario, these come from photo uploads)
        const evidences = [
            { label: 'Check-in Exterior Front', hash: ContractEngine.generateHash(data.id + 'front'), timestamp: new Date().toISOString() },
            { label: 'Check-in Interior Dashboard', hash: ContractEngine.generateHash(data.id + 'dash'), timestamp: new Date().toISOString() }
        ];

        return LegalEngine.forgeJuridicalText({
            bookingId: data.id,
            renterName: data.renterName,
            ownerName: data.ownerName,
            domain: data.domain,
            evidences
        });
    },

    /**
     * Generates a SHA-256 hash for digital evidence.
     */
    generateHash: (content) => {
        return crypto.createHash('sha256').update(content).digest('hex');
    },

    /**
     * Calculates financial penalities for late returns.
     */
    calculatePenalty: (hoursLate) => {
        const RATE_PER_HOUR = 1000;
        return hoursLate > 0 ? hoursLate * RATE_PER_HOUR : 0;
    }
};

module.exports = ContractEngine;
