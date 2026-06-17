#!/usr/bin/env bash
# apply2.sh — Etapa 2: reseñas bidireccionales (dueño↔rentador) + reseñas públicas en el catálogo.
#
# Uso:   bash apply2.sh
#   (NO necesita cloud name: Cloudinary ya quedó configurado en la etapa anterior.)
#
# Qué hace:
#   1. Sincroniza el schema de Prisma con Neon (db push, aditivo y seguro):
#        - Review pasa de 1-por-reserva a 2-por-reserva (una por cada parte)
#        - se agrega Review.kind y un índice único [bookingId, authorId]
#   2. Regenera el cliente de Prisma localmente
#   3. git add + commit + push
#
# IMPORTANTE sobre el cambio de schema:
#   Antes Review tenía `bookingId @unique`. Ahora ese unique se reemplaza por
#   `@@unique([bookingId, authorId])`. `prisma db push` maneja esto solo. Si ya
#   tenías reseñas de prueba creadas, NO se borran; siguen siendo válidas.

set -e

# Sanity: estamos en la raíz del repo
if [ ! -f index.html ] || [ ! -d server ]; then
    echo "❌ No veo index.html / server/ en este directorio."
    echo "   Ejecútalo desde la raíz del repo (ej. cd ~/RentaTO && bash apply2.sh)"
    exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Etapa 2 — Reseñas bidireccionales"
echo "═══════════════════════════════════════════════════════"
echo ""

cd server

if [ ! -f .env ] && [ -z "$DATABASE_URL" ]; then
    echo "❌ No veo server/.env y DATABASE_URL no está en el entorno."
    echo "   Crea server/.env con tu DATABASE_URL de Neon antes de seguir."
    cd ..
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "→ npm install en server/..."
    npm install --silent --no-audit --no-fund
fi

echo "→ [1/3] Sincronizando schema con Neon (db push)..."
npx prisma db push --skip-generate
echo "   ✓ Schema sincronizado."

echo ""
echo "→ [2/3] Regenerando Prisma Client..."
npx prisma generate
echo "   ✓ Cliente regenerado."

cd ..

echo ""
echo "→ [3/3] git add + commit + push..."
git add -A
if git diff --cached --quiet; then
    echo "   ⚠️  No hay cambios para commitear (¿ya lo aplicaste?)."
else
    git commit -m "Reviews bidireccionales (dueño<->rentador) + reseñas públicas en catálogo"
    git push
    echo "   ✓ Push completado."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  LISTO."
echo ""
echo "  • Vercel redespliega solo en ~30s."
echo "  • Render: si /api/reviews da error raro en 2-3 min,"
echo "    Render → rentato → Manual Deploy → Deploy latest commit."
echo "  • Limpia caché del navegador una vez:"
echo "    F12 → Console → localStorage.clear(); location.reload();"
echo "═══════════════════════════════════════════════════════"
