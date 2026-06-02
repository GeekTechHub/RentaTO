const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 01. Create Admin/Owner User
    const admin = await prisma.user.upsert({
        where: { email: 'gabrielabreulio@gmail.com' },
        update: {
            role: 'OWNER',
            kycStatus: 'VERIFIED',
            trustScore: 100
        },
        create: {
            email: 'gabrielabreulio@gmail.com',
            password: hashedPassword,
            name: 'Gabriel Abreu',
            role: 'OWNER',
            kycStatus: 'VERIFIED',
            trustScore: 100
        }
    });

    const owner = await prisma.user.upsert({
        where: { email: 'owner@rentard.do' },
        update: {},
        create: {
            email: 'owner@rentard.do',
            password: await bcrypt.hash('owner123', 10),
            name: 'Juan Pérez DNA',
            role: 'OWNER',
            kycStatus: 'VERIFIED',
            trustScore: 94
        }
    });

    const renter = await prisma.user.upsert({
        where: { email: 'renter@rentard.do' },
        update: {},
        create: {
            email: 'renter@rentard.do',
            password: await bcrypt.hash('renter123', 10),
            name: 'VVIP Citizen',
            role: 'RENTER',
            kycStatus: 'VERIFIED',
            trustScore: 88
        }
    });

    // Clean existing cars
    await prisma.car.deleteMany({});

    // 02. Seed Core Vehicles
    await prisma.car.createMany({
        data: [
            {
                brand: 'Toyota', model: 'Corolla', year: 2022, type: 'Sedan',
                location: 'Santo Domingo', price: 3500, deposit: 10000,
                note: 'Hibrido, máximo ahorro. DNA VERIFIED.',
                ownerId: admin.id, verified: true, dnaStatus: 'MAPPED',
                transmission: 'AUTOMATIC', licensePlate: 'A839211',
                chassisNumber: 'VIN8923KJNSDF901', fuelRange: 650,
                capacity: 5, requiresOperatorLevel: 'STANDARD_LICENSE',
                safetyProfile: 'land_standard'
            },
            {
                brand: 'Land Rover', model: 'Defender', year: 2023, type: 'Jeepeta / SUV',
                location: 'Punta Cana', price: 12000, deposit: 35000,
                note: 'Lujo extremo para terrenos difíciles.',
                ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
                transmission: 'AUTOMATIC', licensePlate: 'G849202',
                chassisNumber: 'VIN73928HHDJKSO18', fuelRange: 800,
                capacity: 7, requiresOperatorLevel: 'STANDARD_LICENSE',
                safetyProfile: 'land_standard'
            }
        ]
    });

    console.log('[RENTARD] Database Seeded with Juridical Density.');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
