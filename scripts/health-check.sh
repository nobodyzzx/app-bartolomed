#!/bin/bash

# Script para verificar el estado de la aplicación
echo "=== Verificando estado de los servicios ==="

# Verificar si el backend responde
echo "Verificando backend..."
curl -f -s http://localhost:3000/api/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend está respondiendo"
    curl -s http://localhost:3000/api/health | jq .
else
    echo "❌ Backend no está respondiendo"
fi

echo ""

# Verificar si el frontend responde
echo "Verificando frontend..."
curl -f -s http://localhost:4200/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Frontend está respondiendo"
else
    echo "❌ Frontend no está respondiendo"
fi

echo ""

# Verificar conectividad de base de datos
echo "Verificando conectividad de base de datos..."
curl -f -s http://localhost:3000/api/health/db > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Base de datos conectada"
    curl -s http://localhost:3000/api/health/db | jq .
else
    echo "❌ Base de datos no conectada"
fi
