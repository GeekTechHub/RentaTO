/**
 * Centralized error handler.
 * Catches any error thrown in async route handlers (when wrapped with asyncHandler)
 * or passed via next(err).
 */
const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Prisma known errors → friendlier messages
    if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Resource already exists', field: err.meta?.target });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Resource not found' });
    }

    // Don't leak stack in prod
    const payload = { error: message };
    if (process.env.NODE_ENV !== 'production') {
        payload.stack = err.stack;
    }

    if (status >= 500) {
        console.error('[ERROR]', err);
    }

    res.status(status).json(payload);
};

/**
 * Wraps an async route handler so thrown errors reach errorHandler.
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
