// Simple recommendation engine: ranks verified cars by owner reputation,
// the car's own rating, and the viewer's trust. No external dependencies.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RecommendationEngine = {
    recommend: async (userId) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { trustScore: true }
        });
        const trustFactor = user ? user.trustScore / 100 : 0.5;

        const cars = await prisma.car.findMany({
            where: { verified: true },
            include: { owner: { select: { name: true, trustScore: true } } }
        });

        const scored = cars.map(car => {
            const ownerTrust = car.owner ? car.owner.trustScore / 100 : 0.8;
            const carRating = (car.rating || 0) / 5; // 0..1
            const score = (ownerTrust * 0.4) + (carRating * 0.4) + (trustFactor * 0.2);
            return { ...car, recommendationScore: score };
        });

        return scored
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, 3)
            .map(({ contactPhone, recommendationScore, ...rest }) => rest); // strip private + internal
    }
};

module.exports = RecommendationEngine;
