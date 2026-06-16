// Legacy: kept for backward compatibility. Prefer chaining `auth` + `requireAdmin`.
// This standalone middleware verifies the token AND checks for ADMIN role in one step.
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Sesión requerida', code: 'NO_TOKEN' });
    }
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Solo administradores pueden hacer esto.',
                code: 'NOT_ADMIN'
            });
        }
        req.user = verified;
        next();
    } catch (err) {
        const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        return res.status(401).json({ error: 'Sesión inválida o expirada', code });
    }
};
