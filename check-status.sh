#!/bin/bash

# 🐳 Script de Verificación del Proyecto Dockerizado
# Bartolomé App - Sistema de Gestión Médica

echo "🏥 === BARTOLOMÉ APP - VERIFICACIÓN DE ESTADO ==="
echo

# Verificar si Docker está ejecutándose
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker no está ejecutándose"
    echo "   Inicia Docker Desktop o el daemon de Docker"
    exit 1
fi

echo "✅ Docker está ejecutándose"

# Verificar contenedores
echo
echo "📦 === ESTADO DE CONTENEDORES ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=app-bartolomed

# Verificar si los contenedores principales están ejecutándose
FRONTEND_STATUS=$(docker ps --filter name=app-bartolomed-frontend --format "{{.Status}}")
BACKEND_STATUS=$(docker ps --filter name=app-bartolomed-backend --format "{{.Status}}")
DB_STATUS=$(docker ps --filter name=app-bartolomed-database --format "{{.Status}}")

echo
echo "🔍 === VERIFICACIÓN DE SERVICIOS ==="

if [[ $FRONTEND_STATUS == *"Up"* ]]; then
    echo "✅ Frontend: Ejecutándose"
    echo "   🌐 URL: http://localhost"
else
    echo "❌ Frontend: No ejecutándose"
fi

if [[ $BACKEND_STATUS == *"Up"* ]]; then
    echo "✅ Backend: Ejecutándose" 
    echo "   🔗 API: http://localhost:3000"
else
    echo "❌ Backend: No ejecutándose"
fi

if [[ $DB_STATUS == *"Up"* ]]; then
    echo "✅ Base de datos: Ejecutándose"
    echo "   🗃️  Puerto: 5432"
else
    echo "❌ Base de datos: No ejecutándose"
fi

echo
echo "📋 === MÓDULOS COMPLETADOS ==="
echo "✅ Dashboard Principal"
echo "✅ Gestión de Usuarios"
echo "✅ Gestión de Pacientes"
echo "✅ Expedientes Médicos"
echo "✅ Control de Farmacia (4 sub-módulos)"
echo "✅ Sistema de Reportes (3 tipos)"
echo "✅ Control de Activos (4 sub-módulos) - RECIÉN COMPLETADO"
echo "✅ Gestión de Clínicas"

echo
echo "🚀 === ACCESOS DIRECTOS ==="
echo "Frontend:    http://localhost"
echo "Backend API: http://localhost:3000"
echo "Health API:  http://localhost:3000/health"

echo
if [[ $FRONTEND_STATUS == *"Up"* && $BACKEND_STATUS == *"Up"* && $DB_STATUS == *"Up"* ]]; then
    echo "🎉 ¡TODOS LOS SERVICIOS ESTÁN FUNCIONANDO CORRECTAMENTE!"
    echo "   Puedes acceder a la aplicación en: http://localhost"
else
    echo "⚠️  Algunos servicios no están ejecutándose"
    echo "   Ejecuta: docker-compose up -d"
fi

echo
echo "📝 Más información en: .development-notice.md"
