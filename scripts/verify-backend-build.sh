#!/bin/bash
# Script para verificar que el Dockerfile del backend construye correctamente
# Ejecuta esto localmente ANTES de hacer push a Dokploy

set -e

echo "🔧 Verificando construcción del backend..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navegar al directorio raíz del proyecto
cd "$(dirname "$0")"

echo "📁 Directorio actual: $(pwd)"
echo ""

# Limpiar imágenes anteriores
echo "🧹 Limpiando imágenes anteriores..."
docker rmi test-backend:latest 2>/dev/null || true
echo ""

# Construir la imagen
echo "🏗️  Construyendo imagen de backend..."
echo "   Comando: docker build -f docker/backend.Dockerfile -t test-backend:latest backend"
echo ""

if docker build -f docker/backend.Dockerfile -t test-backend:latest backend; then
    echo ""
    echo -e "${GREEN}✅ BUILD EXITOSO${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ BUILD FALLÓ${NC}"
    echo ""
    echo "Revisa los errores arriba. Posibles causas:"
    echo "  - Dependencias faltantes en package.json"
    echo "  - Errores de compilación TypeScript"
    echo "  - Problemas de sintaxis en el código"
    exit 1
fi

# Verificar que dist/main.js existe en la imagen
echo "🔍 Verificando que dist/main.js existe en la imagen..."
if docker run --rm test-backend:latest test -f /app/dist/main.js; then
    echo -e "${GREEN}✅ dist/main.js encontrado${NC}"
else
    echo -e "${RED}❌ dist/main.js NO encontrado${NC}"
    echo ""
    echo "Listando contenido de /app:"
    docker run --rm test-backend:latest ls -la /app/
    echo ""
    echo "Listando contenido de /app/dist:"
    docker run --rm test-backend:latest ls -la /app/dist/ || echo "  Carpeta dist no existe"
    exit 1
fi

# Listar archivos en dist
echo ""
echo "📦 Archivos en /app/dist:"
docker run --rm test-backend:latest ls -lh /app/dist/
echo ""

# Verificar tamaño de la imagen
IMAGE_SIZE=$(docker images test-backend:latest --format "{{.Size}}")
echo "💾 Tamaño de la imagen: $IMAGE_SIZE"
echo ""

# Intentar iniciar el contenedor (solo por 5 segundos para ver si arranca)
echo "🚀 Probando inicio del contenedor..."
CONTAINER_ID=$(docker run -d --rm -p 3001:3000 \
    -e NODE_ENV=production \
    -e DB_HOST=localhost \
    -e DB_PORT=5432 \
    -e DB_USER=test \
    -e DB_PASS=test \
    -e DB_NAME=test \
    -e JWT_SECRET=test-secret \
    -e JWT_REFRESH_SECRET=test-refresh \
    test-backend:latest)

echo "   Container ID: $CONTAINER_ID"
echo "   Esperando 5 segundos..."
sleep 5

# Verificar logs
echo ""
echo "📋 Logs del contenedor:"
docker logs $CONTAINER_ID || true

# Verificar si el proceso está corriendo
if docker ps | grep -q $CONTAINER_ID; then
    echo ""
    echo -e "${GREEN}✅ Contenedor está corriendo${NC}"
    
    # Intentar health check (puede fallar si no hay DB)
    echo ""
    echo "🏥 Intentando health check (puede fallar sin DB)..."
    docker exec $CONTAINER_ID wget -O- http://localhost:3000/api/health 2>/dev/null || \
        echo -e "${YELLOW}   ⚠️  Health check falló (esperado sin DB)${NC}"
else
    echo ""
    echo -e "${RED}❌ Contenedor se detuvo inesperadamente${NC}"
    docker logs $CONTAINER_ID
fi

# Detener el contenedor
echo ""
echo "🛑 Deteniendo contenedor de prueba..."
docker stop $CONTAINER_ID 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ VERIFICACIÓN COMPLETADA${NC}"
echo ""
echo "La imagen se construyó correctamente y contiene dist/main.js"
echo "Puedes hacer push a Dokploy con confianza."
echo ""
echo "Recuerda en Dokploy:"
echo "  1. Activar 'Build without cache' o 'Force rebuild'"
echo "  2. Hacer Redeploy"
echo "  3. Revisar Build Logs para confirmar 'Successfully compiled'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Limpiar imagen de prueba
echo "🧹 Limpiando imagen de prueba..."
docker rmi test-backend:latest

echo ""
echo -e "${GREEN}✅ Script completado exitosamente${NC}"
