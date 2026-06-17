#!/usr/bin/env bash
# apply.sh — KYC + reseñas + Cloudinary, todo en un comando.
#
# Uso:   bash apply.sh TU_CLOUD_NAME
#   (Cloud name está en console.cloudinary.com → Dashboard → "Product Environment Credentials")
#
# Qué hace:
#   1. Inyecta window.CLOUDINARY_CONFIG en index.html (cloud + preset 'cloudRE')
#   2. Sincroniza el schema de Prisma con Neon (db push, aditivo, seguro)
#   3. Regenera el cliente de Prisma localmente
#   4. git add + commit + push
#
# Después de esto: Vercel redespliega solo. Render PROBABLEMENTE redespliega solo,
#   pero si en 2-3 min ves "Endpoint not found" en /api/kyc/me, fuérzalo manual
#   desde el dashboard de Render → rentato → Manual Deploy → Deploy latest commit.

set -e

CLOUD_NAME="${1:-}"
PRESET="cloudRE"

if [ -z "$CLOUD_NAME" ]; then
    echo "❌ Falta tu Cloud Name de Cloudinary."
    echo "   Uso: bash apply.sh TU_CLOUD_NAME"
    echo "   Encuéntralo en: console.cloudinary.com  →  Dashboard  →  'Product Environment Credentials'  →  Cloud name"
    exit 1
fi

# Sanity: estamos en la raíz del repo
if [ ! -f index.html ] || [ ! -d server ]; then
    echo "❌ No veo index.html / server/ en este directorio."
    echo "   Ejecuta este script desde la raíz del repo RentaTO (ej. cd ~/RentaTO && bash apply.sh ...)"
    exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Cloud Name : $CLOUD_NAME"
echo "  Preset     : $PRESET"
echo "═══════════════════════════════════════════════════════"
echo ""

# ────────────────────────────────────────────────────────────
# 1) Inyectar CLOUDINARY_CONFIG en index.html (idempotente)
# ────────────────────────────────────────────────────────────
echo "→ [1/4] Inyectando configuración de Cloudinary en index.html..."

if grep -q "CLOUDINARY_CONFIG" index.html; then
    # Reemplazar valores existentes
    # Soportamos comillas simples o dobles
    sed -i.bak -E "s|(cloud[[:space:]]*:[[:space:]]*['\"])[^'\"]*(['\"])|\1${CLOUD_NAME}\2|" index.html
    sed -i.bak -E "s|(preset[[:space:]]*:[[:space:]]*['\"])[^'\"]*(['\"])|\1${PRESET}\2|" index.html
    rm -f index.html.bak
    echo "   ✓ Config existente actualizada."
else
    # Insertar nueva línea antes de <script src="/main.js">
    SNIPPET="  <script>window.CLOUDINARY_CONFIG = { cloud: '${CLOUD_NAME}', preset: '${PRESET}' };</script>"
    # Usar awk para preservar exactamente la línea original
    awk -v snip="$SNIPPET" '
        /<script src="\/main\.js"><\/script>/ && !done { print snip; done=1 }
        { print }
    ' index.html > index.html.new && mv index.html.new index.html
    echo "   ✓ Config inyectada antes de /main.js."
fi

# ────────────────────────────────────────────────────────────
# 2) Sincronizar schema con Neon (additive: sin pérdida de datos)
# ────────────────────────────────────────────────────────────
echo ""
echo "→ [2/4] Sincronizando schema de Prisma con Neon..."
echo "   (esto agrega columnas KYC al User y crea la tabla Review)"
cd server

if [ ! -f .env ] && [ -z "$DATABASE_URL" ]; then
    echo "   ⚠️  No veo server/.env y DATABASE_URL no está en el entorno."
    echo "      Asegúrate de tener server/.env con DATABASE_URL apuntando a Neon antes de seguir."
    cd ..
    exit 1
fi

# Instalar deps si faltan (idempotente)
if [ ! -d node_modules ]; then
    echo "   → npm install en server/..."
    npm install --silent --no-audit --no-fund
fi

npx prisma db push --skip-generate
echo "   ✓ Schema sincronizado en Neon."

# ────────────────────────────────────────────────────────────
# 3) Regenerar Prisma Client localmente
# ────────────────────────────────────────────────────────────
echo ""
echo "→ [3/4] Regenerando Prisma Client..."
npx prisma generate
echo "   ✓ Cliente regenerado."

cd ..

# ────────────────────────────────────────────────────────────
# 4) Commit + push
# ────────────────────────────────────────────────────────────
echo ""
echo "→ [4/4] git add + commit + push..."
git add -A
if git diff --cached --quiet; then
    echo "   ⚠️  No hay cambios para commitear (¿ya lo aplicaste antes?)."
else
    git commit -m "Phase B continued: KYC submission + reviews + Cloudinary wired"
    git push
    echo "   ✓ Push completado."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  LISTO."
echo ""
echo "  • Vercel redespliega solo en ~30s."
echo "  • Render usualmente redespliega solo. Si después de 2-3"
echo "    min los nuevos endpoints (/api/kyc, /api/reviews) dan"
echo "    'Endpoint not found', fuérzalo:"
echo "    Render → rentato → Manual Deploy → Deploy latest commit."
echo "  • Si hay caché vieja en el navegador:"
echo "    F12 → Console → localStorage.clear(); location.reload();"
echo "═══════════════════════════════════════════════════════"
