#!/usr/bin/env bash
# apply4.sh — Buzón de recomendaciones (tabla Feedback) + ajustes de formulario.
# Uso:   bash apply4.sh
#
# ⚠️ Si da "P1001 Can't reach database server", corre primero el fix de DNS:
#   sudo sed -i 's|^#precedence ::ffff:0:0/96.*100|precedence ::ffff:0:0/96  100|' /etc/gai.conf

set -e
if [ ! -f index.html ] || [ ! -d server ]; then
    echo "❌ Ejecútalo desde la raíz del repo (cd ~/RentaTO && bash apply4.sh)"
    exit 1
fi

cd server
[ ! -d node_modules ] && npm install --silent --no-audit --no-fund

echo "→ [1/3] Sincronizando schema con Neon (tabla Feedback)..."
npx prisma db push --skip-generate
echo "   ✓ Schema sincronizado."

echo "→ [2/3] Regenerando Prisma Client..."
npx prisma generate
echo "   ✓ Cliente regenerado."

cd ..
echo "→ [3/3] git add + commit + push..."
git add -A
if git diff --cached --quiet; then
    echo "   ⚠️  No hay cambios para commitear."
else
    git commit -m "Contacto + Centro de ayuda + Buzón recomendaciones; limpieza formulario publicar"
    git push
    echo "   ✓ Push completado."
fi

echo ""
echo "LISTO. Vercel redespliega solo. Si /api/feedback da 404 en 2-3 min:"
echo "  Render → rentato → Manual Deploy → Deploy latest commit."
