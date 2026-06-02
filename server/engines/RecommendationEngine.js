/**
 * RENTARD Neural Recommendation Engine
 * AI-Driven Asset Discovery
 */
const { PrismaClient } = require('@prisma/client');
const OracleEngine = require('./OracleEngine');

const prisma = new PrismaClient();

const RecommendationEngine = {
    /**
     * Recommends cars for a user based on their Trust Score and Region Demand.
     */
    recommend: async (userId) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { trustScore: true }
        });

        const trustFactor = user ? user.trustScore / 100 : 0.5;

        // Fetch all cars
        const allCars = await prisma.car.findMany({
            include: { owner: { select: { trustScore: true } } }
        });

        // Score cars based on Trust Sync and Oracle Multipliers
        const scoredCars = allCars.map(car => {
            const oracleMultiplier = OracleEngine.predictMultiplier(car.location, car.type);
            const ownerTrust = car.owner ? car.owner.trustScore / 100 : 0.8;

            // Recommendation Score logic
            const score = (ownerTrust * 0.4) + (oracleMultiplier * 0.4) + (trustFactor * 0.2);

            return { ...car, recommendationScore: score };
        });

        // Return top 3 recommendations
        return scoredCars
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, 3);
    }
};

module.exports = RecommendationEngine;
