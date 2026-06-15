const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// --- Schemas ---
const registerSchema = z.object({
    email: z.string().email('Email inválido').toLowerCase().trim(),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    name: z.string().min(2, 'Nombre muy corto').max(80).trim(),
    role: z.enum(['RENTER', 'OWNER']).optional()
});

const loginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1, 'Contraseña requerida')
});

// --- POST /api/auth/register ---
router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, role: role || 'RENTER' }
    });
    res.status(201).json({
        message: 'Usuario creado exitosamente',
        userId: user.id
    });
}));

// --- POST /api/auth/login ---
router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Same message as bad password to avoid user enumeration
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            kyc: user.kycStatus
        }
    });
}));

module.exports = router;
