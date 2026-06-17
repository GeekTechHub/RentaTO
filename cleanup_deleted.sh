#!/usr/bin/env bash
# cleanup_deleted.sh — borra los archivos decorativos eliminados en la etapa 3.
# tar -xzf solo agrega/sobreescribe; los borrados hay que hacerlos aparte.
# Ejecútalo desde la raíz del repo (~/RentaTO) DESPUÉS de extraer el tar.
set -e
echo "→ Borrando engines decorativos..."
rm -f server/engines/BiometricEngine.js server/engines/DAOEngine.js \
      server/engines/FractalSeed.js server/engines/IncidentEngine.js \
      server/engines/IoTEngine.js server/engines/LegalEngine.js \
      server/engines/LogisticsEngine.js server/engines/OracleEngine.js \
      server/engines/RiskEngine.js server/engines/SingularityEngine.js \
      server/engines/TokenEngine.js
echo "→ Borrando rutas muertas..."
rm -f server/routes/assets.js server/routes/contracts.js server/routes/dao.js \
      server/routes/disputes.js server/routes/incidents.js server/routes/iot.js \
      server/routes/logistics.js server/routes/oracle.js server/routes/risk.js \
      server/routes/singularity.js
echo "→ Borrando middleware y archivos legacy..."
rm -f server/middleware/PredictionMiddleware.js server/test-ecosystem.js \
      dashboard.html admin.html
echo "✓ Limpieza completa. Verifica con: git status"
