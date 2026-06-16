// Chain AFTER the `auth` middleware. Validates that the verified user
// has the ADMIN role; otherwise returns 403.
module.exports = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Sesión requerida', code: 'NO_USER' });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            error: 'Solo administradores pueden hacer esto.',
            code: 'NOT_ADMIN'
        });
    }
    next();
};
