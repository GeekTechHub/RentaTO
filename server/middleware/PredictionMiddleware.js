/**
 * RENTARD Prediction Middleware v1.0
 * Intercepts flows to prevent "Entropy" or "Legal Failure"
 * Status: JURIDICAL-DENSITY:MAX
 */

const SingularityEngine = require('../engines/SingularityEngine');

const PredictionMiddleware = {
    intercept: (req, res, next) => {
        // Run a quick 2-step simulation for immediate request safety
        const prediction = SingularityEngine.simulate(2);

        if (prediction.matrix[2].stability < 0.90) {
            console.warn(`[SENTINEL] Request Blocked: Entropy threshold exceeded (${prediction.currentEntropy})`);
            return res.status(403).json({
                error: "PREDICTIVE_BLOCK",
                reason: "Potential Legal Failure detected in 2-step simulation",
                hash: prediction.predictionHash
            });
        }

        // Add prediction data to the request for logging
        req.prediction = prediction;
        next();
    }
};

module.exports = PredictionMiddleware;
