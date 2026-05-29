const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- POST /api/auth/register ---
router.post('/register', async (req, res) => {
    const { email, password, name, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name, role: role || 'RENTER' }
        });
        res.json({ message: 'User Authored DNA Created', userId: user.id });
    } catch (err) {
        res.status(400).json({ error: 'Email already exists or invalid data' });
    }
});

// --- POST /api/auth/login ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'Identity not found' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'DNA Mismatch: Invalid Credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, kyc: user.kycStatus } });
    } catch (err) {
        res.status(500).json({ error: 'Internal Engine Error' });
    }
});

module.exports = router;
