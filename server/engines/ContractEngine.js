const crypto = require('crypto');

const ContractEngine = {
    // SHA-256 hash for delivery/return evidence (used when storing photo proofs).
    generateHash: (content) => crypto.createHash('sha256').update(content).digest('hex'),

    // Late-return penalty: RD$1000 per hour late.
    calculatePenalty: (hoursLate) => {
        const RATE_PER_HOUR = 1000;
        return hoursLate > 0 ? hoursLate * RATE_PER_HOUR : 0;
    }
};

module.exports = ContractEngine;
