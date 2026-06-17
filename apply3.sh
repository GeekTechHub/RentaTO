#!/usr/bin/env bash
# apply3.sh — Etapa 3:
#   • Limpieza del backend (engines/rutas decorativas borradas)
#   • Emails con Resend (nueva reserva + KYC aprobado/rechazado)
#   • Fee de US$1 con PayPal para desbloquear contacto del dueño
#   • Andamiaje de Capacitor (Android)
#
# Uso:   bash apply3.sh
#
# IMPORTANTE: este push de schema TAMBIÉN aplica los cambios de la Etapa 2
# (reseñas bidireccionales) que quedaron pendientes en Neon por el problema de DNS.
# O sea: un solo `prisma db push` sincroniza TODO lo acumulado.
#
# ⚠️ PRERREQUISITO — DNS de Crostini hacia Postgres (puerto 5432) por IPv4:
#   Si ves "P1001 Can't reach database server", corre primero:
#     sudo sed -i 's|^#precedence ::ffff:0:0/96.*100|precedence ::ffff:0:0/96  100|' /etc/gai.conf
#   Eso fuerza IPv4 (muchas redes bloquean Postgres por IPv6).

set -e

if [ ! -f index.html ] || [ ! -d server ]; then
    echo "❌ Ejecútalo desde la raíz del repo (cd ~/RentaTO && bash apply3.sh)"
    exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Etapa 3 — Cleanup + Emails + Pagos + Capacitor"
echo "═══════════════════════════════════════════════════════"
echo ""

cd server

if [ ! -f .env ] && [ -z "$DATABASE_URL" ]; then
    echo "❌ No veo server/.env con DATABASE_URL. Créalo antes de seguir."
    cd ..
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "→ npm install en server/..."
    npm install --silent --no-audit --no-fund
fi

echo "→ [1/3] Sincronizando schema con Neon (incluye reseñas bidir + ConnectionUnlock + contactPhone)..."
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
    git commit -m "Etapa 3: cleanup backend + emails Resend + fee US\$1 PayPal + Capacitor scaffold"
    git push
    echo "   ✓ Push completado."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  LISTO (código y DB)."
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  PENDIENTE — configurar variables en Render (rentato → Environment):"
echo ""
echo "  Para EMAILS (opcional, free 100/día en resend.com):"
echo "    RESEND_API_KEY = re_..."
echo "    MAIL_FROM      = RentaTO <onboarding@resend.dev>   (o tu dominio)"
echo "    APP_URL        = https://renta-to.vercel.app"
echo ""
echo "  Para el FEE de US\$1 (developer.paypal.com, empieza en Sandbox):"
echo "    PAYPAL_CLIENT_ID = ..."
echo "    PAYPAL_SECRET    = ..."
echo "    PAYPAL_ENV       = sandbox     (cámbialo a 'live' cuando estés listo)"
echo ""
echo "  Mientras NO pongas esas vars: los emails se omiten y el botón de"
echo "  PayPal no aparece — el resto de la app funciona normal."
echo ""
echo "  • Render: si los endpoints nuevos dan 404 en 2-3 min →"
echo "    Render → rentato → Manual Deploy → Deploy latest commit."
echo "  • Para empaquetar la app Android: lee CAPACITOR_GUIDE.md"
echo "═══════════════════════════════════════════════════════"
