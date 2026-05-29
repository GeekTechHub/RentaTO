const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const OracleEngine = require('../engines/OracleEngine');

// --- GET /api/oracle/trends (Protected - Admin) ---
router.get('/trends', auth, (req, res) => {
    // In a real app, check if user is ADMIN
    res.json(OracleEngine.getMarketTrends());
});

// --- GET /api/oracle/predict (Protected) ---
router.get('/predict', auth, (req, res) => {
    const { region, type } = req.query;
    const multiplier = OracleEngine.predictMultiplier(region, type);
    res.json({ multiplier, status: 'Oracle Sincronizado' });
});

module.exports = router;
