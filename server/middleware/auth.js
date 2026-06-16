const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Sesión requerida', code: 'NO_TOKEN' });
    }

    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'Servidor mal configurado (JWT_SECRET ausente)' });
        }
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        // 401 (not 400) so the frontend knows to clear the stale session and re-login
        const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        return res.status(401).json({ error: 'Sesión inválida o expirada', code });
    }
};
