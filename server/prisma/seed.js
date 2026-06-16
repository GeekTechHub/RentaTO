const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('[rentato] Seeding database...');

    // ============================================
    // 01. Users
    // ============================================
    const admin = await prisma.user.upsert({
        where: { email: 'gabrielabreulio@gmail.com' },
        update: { role: 'ADMIN', kycStatus: 'VERIFIED', trustScore: 100 },
        create: {
            email: 'gabrielabreulio@gmail.com',
            password: await bcrypt.hash('admin123', 12),
            name: 'Gabriel Abreu',
            role: 'ADMIN',
            kycStatus: 'VERIFIED',
            trustScore: 100
        }
    });

    const owner = await prisma.user.upsert({
        where: { email: 'owner@rentard.do' },
        update: {},
        create: {
            email: 'owner@rentard.do',
            password: await bcrypt.hash('owner123', 12),
            name: 'Juan Pérez',
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
            password: await bcrypt.hash('renter123', 12),
            name: 'María Rodríguez',
            role: 'RENTER',
            kycStatus: 'VERIFIED',
            trustScore: 88
        }
    });

    console.log('[rentato] Users created: admin, owner, renter');

    // ============================================
    // 02. Cars / Vehicles (diverse domains)
    // ============================================
    // Identificar carros del seed por placas conocidas para no tocar los de usuarios reales
    const seedPlates = [
        'A839211', 'G849202', 'H559301', 'E001234',
        'M889123', 'W-JS001', 'W-BT200', 'AIR-HR44'
    ];
    const seedCars = await prisma.car.findMany({
        where: { licensePlate: { in: seedPlates } },
        select: { id: true }
    });
    const seedCarIds = seedCars.map(c => c.id);

    if (seedCarIds.length > 0) {
        // Borrar reservas que apuntan a los carros del seed (evita violación de FK)
        await prisma.booking.deleteMany({ where: { carId: { in: seedCarIds } } });
        // Ahora sí, borrar los carros del seed
        await prisma.car.deleteMany({ where: { id: { in: seedCarIds } } });
    }

    const cars = [
        // --- LAND ---
        {
            brand: 'Toyota', model: 'Corolla', year: 2022, type: 'Sedan',
            location: 'Santo Domingo', price: 3500, deposit: 10000,
            note: 'Híbrido, máximo ahorro de combustible. Ideal para ciudad.',
            ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'A839211',
            chassisNumber: 'VIN8923KJNSDF901', fuelRange: 650,
            capacity: 5, requiresOperatorLevel: 'STANDARD_LICENSE',
            safetyProfile: 'land_standard',
            domain: 'LAND', category: 'SEDAN', energyType: 'HYBRID',
            image: 'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=800&q=80'
        },
        {
            brand: 'Land Rover', model: 'Defender', year: 2023, type: 'Jeepeta / SUV',
            location: 'Punta Cana', price: 12000, deposit: 35000,
            note: 'Lujo extremo para terrenos difíciles. Perfecto para excursiones.',
            ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'G849202',
            chassisNumber: 'VIN73928HHDJKSO18', fuelRange: 800,
            capacity: 7, requiresOperatorLevel: 'STANDARD_LICENSE',
            safetyProfile: 'land_standard',
            domain: 'LAND', category: 'SUV', energyType: 'DIESEL',
            image: 'https://loremflickr.com/800/600/land,rover,defender,suv/all?lock=2'
        },
        {
            brand: 'Honda', model: 'Civic', year: 2021, type: 'Sedan',
            location: 'Santiago', price: 2800, deposit: 8000,
            note: 'Económico, perfecto para viajes largos.',
            ownerId: owner.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'H559301',
            chassisNumber: 'VIN3092JKLM2310', fuelRange: 600,
            capacity: 5, requiresOperatorLevel: 'STANDARD_LICENSE',
            safetyProfile: 'land_standard',
            domain: 'LAND', category: 'SEDAN', energyType: 'GASOLINE',
            image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&q=80'
        },
        {
            brand: 'Tesla', model: 'Model 3', year: 2024, type: 'Eléctrico',
            location: 'Santo Domingo', price: 5500, deposit: 15000,
            note: '100% eléctrico, autopiloto activado. Cero emisiones.',
            ownerId: owner.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'E001234',
            chassisNumber: 'VINELECTRIC55512', fuelRange: 500,
            capacity: 5, requiresOperatorLevel: 'STANDARD_LICENSE',
            safetyProfile: 'land_standard',
            domain: 'LAND', category: 'SEDAN', energyType: 'ELECTRIC',
            image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80'
        },
        {
            brand: 'Yamaha', model: 'MT-07', year: 2023, type: 'Motocicleta',
            location: 'La Romana', price: 1500, deposit: 5000,
            note: 'Moto deportiva. Solo conductores con licencia para motos.',
            ownerId: owner.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'MANUAL', licensePlate: 'M889123',
            chassisNumber: 'VINMOTOR123456', fuelRange: 280,
            capacity: 2, requiresOperatorLevel: 'MOTORCYCLE_LICENSE',
            safetyProfile: 'land_standard',
            domain: 'LAND', category: 'MOTORCYCLE', energyType: 'GASOLINE',
            image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80'
        },
        // --- WATER ---
        {
            brand: 'Sea-Doo', model: 'GTI 130', year: 2023, type: 'Jet Ski',
            location: 'Bávaro', price: 4500, deposit: 12000,
            note: 'Jet ski para 2 personas. Chaleco salvavidas incluido.',
            ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'W-JS001',
            chassisNumber: 'VINJETSKI99001', fuelRange: 120,
            capacity: 2, requiresOperatorLevel: 'WATER_LICENSE',
            safetyProfile: 'water_recreational',
            domain: 'WATER', category: 'JETSKI', energyType: 'GASOLINE',
            image: 'https://loremflickr.com/800/600/jetski,seadoo,watercraft/all?lock=6'
        },
        {
            brand: 'Yamaha', model: '242X', year: 2022, type: 'Lancha',
            location: 'Boca Chica', price: 18000, deposit: 50000,
            note: 'Lancha deportiva 24 pies. Hasta 10 personas. Capitán opcional.',
            ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'AUTOMATIC', licensePlate: 'W-BT200',
            chassisNumber: 'VINBOAT2024XYZ', fuelRange: 250,
            capacity: 10, requiresOperatorLevel: 'BOAT_CAPTAIN_LICENSE',
            safetyProfile: 'water_recreational',
            domain: 'WATER', category: 'BOAT', energyType: 'GASOLINE',
            image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80'
        },
        // --- AIR ---
        {
            brand: 'Robinson', model: 'R44', year: 2021, type: 'Helicóptero',
            location: 'Las Américas', price: 85000, deposit: 200000,
            note: 'Helicóptero privado, 4 pasajeros. Tours y traslados VIP. Piloto incluido.',
            ownerId: admin.id, verified: true, dnaStatus: 'VERIFIED',
            transmission: 'MANUAL', licensePlate: 'AIR-HR44',
            chassisNumber: 'VINHELI4400099', fuelRange: 600,
            capacity: 4, requiresOperatorLevel: 'COMMERCIAL_PILOT',
            safetyProfile: 'air_certified',
            domain: 'AIR', category: 'HELICOPTER', energyType: 'AVGAS',
            image: 'https://loremflickr.com/800/600/helicopter,aircraft/all?lock=8'
        }
    ];

    await prisma.car.createMany({ data: cars });

    console.log(`[rentato] ${cars.length} vehículos creados (${cars.filter(c=>c.domain==='LAND').length} terrestres, ${cars.filter(c=>c.domain==='WATER').length} acuáticos, ${cars.filter(c=>c.domain==='AIR').length} aéreos)`);
    console.log('[rentato] Seed completado.');
}

main()
    .catch((e) => { console.error('[SEED ERROR]', e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
