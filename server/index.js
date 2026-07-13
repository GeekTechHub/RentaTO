const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// --- CORS whitelist ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,https://renta-to.vercel.app')
    .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, mobile apps, same-origin)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // Permitir subdominios de vercel.app durante previews
        if (/^https:\/\/renta-to-.*\.vercel\.app$/.test(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true
};

// --- Security & parsing middleware ---
app.use(helmet({
    contentSecurityPolicy: false // Disabled because frontend serves inline scripts
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// --- Rate limiters ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: NODE_ENV === 'production' ? 20 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, try again in 15 minutes' }
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 min
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// --- Static (only useful in monolith mode) ---
app.use(express.static(path.join(__dirname, '..')));

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cars', require('./routes/cars'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'rentato-api',
        env: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// --- 404 handler for /api routes ---
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// --- Centralized error handler (MUST be last) ---
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`[rentato] API listening on port ${PORT} (${NODE_ENV})`);
    console.log(`[rentato] CORS whitelist: ${ALLOWED_ORIGINS.join(', ')}`);
});

// --- Graceful shutdown ---
process.on('SIGTERM', async () => {
    console.log('[rentato] SIGTERM received, closing gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
