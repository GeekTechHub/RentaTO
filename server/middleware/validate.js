/**
 * Zod validation middleware.
 * Usage: router.post('/x', validate(schema), handler)
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const issues = result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message
        }));
        return res.status(400).json({
            error: 'Validation failed',
            issues
        });
    }
    req.body = result.data;
    next();
};

module.exports = validate;
