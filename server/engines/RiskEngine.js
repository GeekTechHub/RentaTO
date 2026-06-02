/**
 * RENTARD Predictive Risk Engine
 * ----------------------------
 * Calculates a "Juridical Risk Score" (0-100) based on car entropy,
 * owner DNA verification, and historical trip density.
 */

const RiskEngine = {
    calculateScore: (car, user) => {
        let score = 100;
        const currentYear = new Date().getFullYear();
        const age = currentYear - car.year;

        // 1. Entropy Weighting (Vehicle Age)
        if (age > 15) score -= 30;
        else if (age > 10) score -= 15;
        else if (age > 5) score -= 5;

        // 2. Identity DNA (KYC Status)
        if (user.kycStatus === 'PENDING') score -= 40;
        else if (user.kycStatus === 'REJECTED') score -= 100;

        // 3. Verification Mapping
        if (!car.verified) score -= 20;

        // 4. Trip Density Bonus
        if (car.trips > 50) score += 10;
        if (car.rating > 4.5) score += 10;

        return Math.max(0, Math.min(100, score));
    },

    getRecommendation: (score) => {
        if (score >= 80) return { category: 'SUPREME', action: 'ALLOW', warning: null };
        if (score >= 50) return { category: 'STANDARD', action: 'ALLOW', warning: 'Protocolo Review Requerido' };
        return { category: 'HIGH_ENTROPY', action: 'BLOCK', warning: 'Fallo en Validación DNA' };
    }
};

module.exports = RiskEngine;
