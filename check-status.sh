#!/usr/bin/env bash
set -euo pipefail

echo "🏥 === BARTOLOMED APP - ESTADO OPERATIVO ==="
echo

if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
  COMPOSE_CMD="podman compose"
  RUNTIME="Podman"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  RUNTIME="Docker"
else
  echo "❌ No se encontró Docker/Podman Compose disponible."
  exit 1
fi

echo "✅ Runtime detectado: ${RUNTIME}"
echo

echo "📦 === SERVICIOS ==="
$COMPOSE_CMD ps

echo
echo "🔍 === HEALTH CHECKS ==="
if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "✅ Backend health: OK (http://localhost:3000/api/health)"
else
  echo "❌ Backend health: FAIL (http://localhost:3000/api/health)"
fi

if curl -fsS http://localhost:4200 >/dev/null 2>&1; then
  echo "✅ Frontend endpoint: OK (http://localhost:4200)"
else
  echo "❌ Frontend endpoint: FAIL (http://localhost:4200)"
fi

echo
echo "📉 === ALERTAS RÁPIDAS (últimas líneas con error) ==="
for svc in backend frontend db; do
  echo "--- ${svc} ---"
  $COMPOSE_CMD logs --tail 80 "$svc" 2>/dev/null | grep -Ei "error|exception|fatal|panic" | tail -n 10 || echo "sin errores críticos recientes"
done

echo
echo "💾 === ROLLBACK RÁPIDO (referencia) ==="
echo "1) Ver imágenes actuales:   $COMPOSE_CMD images"
echo "2) Descargar tags objetivo: $COMPOSE_CMD pull"
echo "3) Aplicar rollback:        $COMPOSE_CMD up -d"
echo
echo "✅ Verificación completada."
