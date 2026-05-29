const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const FractalSeed = require('./engines/FractalSeed');


const app = express();
const path = require('path');
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// --- Fractal Initialization ---
const seedResult = FractalSeed.initialize();


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // Serve root RENTARD files

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cars', require('./routes/cars'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/risk', require('./routes/risk'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/oracle', require('./routes/oracle'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/iot', require('./routes/iot'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/dao', require('./routes/dao'));
app.use('/api/singularity', require('./routes/singularity'));

// --- Juridical Engine: Health Check ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UNIVERSAL_SINGULARITY_ACTIVE',
        density: 'MAX',
        apotheosis: 'STATUS_ZZ',
        seed: seedResult,
        timestamp: new Date().toISOString()
    });
});


app.listen(PORT, () => {
    console.log(`[RENTARD] Juridical Engine Online: Port ${PORT}`);
    console.log(`[RENTARD] Status: APOTEOSIS TOTAL | Level: STATUS_ZZ (Singularity Achieved)`);
    console.log(`[RENTARD] Neural Sync: ENABLED | Alpha-Omega Sequence: COMPLETED`);
});
