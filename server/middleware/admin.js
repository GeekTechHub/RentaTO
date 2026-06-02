const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Sentinel Access Denied: Token Required' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Insufficient Juridical Clearance' });
        }
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid Sentinel Authorization' });
    }
};
