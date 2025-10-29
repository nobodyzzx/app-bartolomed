# Configuración de Despliegue en Dokploy

## 📋 Arquitectura de Subdominios

Este proyecto usa **subdominios separados** para frontend y backend:

- **Frontend**: `bartolomed.tecnocondor.dev`
- **Backend/API**: `api.bartolomed.tecnocondor.dev`
- **Base de datos**: PostgreSQL (interna, no expuesta)

## 🚀 Configuración en Dokploy

### 1. Variables de Entorno

Configurar estas variables en Dokploy (usar `.env.production` como referencia):

````bash
# Database
POSTGRES_DB=bartolomed_prod
POSTGRES_USER=bartolomed_user
POSTGRES_PASSWORD=BartolomedSecure2024!

# Backend
NODE_ENV=production
JWT_SECRET=m+8USdiEpXiBolgQ0CyMtk+lzT11/eTu3oP9SQCVC9aAQ9e1fQgcHz2j5TJNXpL1s72YZG2DtbcxUgmOTrbnqA
JWT_REFRESH_SECRET=please-change-me-strong-refresh-secret
GOD_MODE_TOKEN=please-change-me-very-strong
PORT=3000

# Domain

### 2. Configuración de Servicios

- **Servicio**: `frontend`
- **Puerto del contenedor**: `4200`
- **Dominio**: `bartolomed.tecnocondor.dev`
- **Health Check**: `GET /` cada 30s


- **Docker Compose**: `docker-compose.dokploy.yml`
- **Dominio**: `api.bartolomed.tecnocondor.dev`
- **Health Check**: `GET /health` cada 30s
- **API Prefix**: `/api`

#### Database

- **Imagen**: `postgres:16-alpine`
- **Puerto interno**: `5432` (no exponer públicamente)
- **Volumen**: `bartolomed_db_data`
- **Init Script**: `./database/init.sql`

### 3. Configuración de Red

Todos los servicios están en la red `bartolomed_network` para comunicación interna.

### 4. Volúmenes Persistentes

```yaml
bartolomed_db_data: Datos de PostgreSQL
bartolomed_uploads: Archivos subidos (formularios de consentimiento)
````

## 🔧 URLs de la Aplicación

### Desarrollo

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000/api`

### Producción

- Frontend: `https://bartolomed.tecnocondor.dev`
- Backend: `https://api.bartolomed.tecnocondor.dev/api`

## 📝 Endpoints Principales

### Backend/API

- Health Check: `GET /health`
- Autenticación: `POST /api/auth/login`
- Usuarios: `GET /api/users`
- Pacientes: `GET /api/patients`

## 🔐 Seguridad

### CORS

El backend está configurado para aceptar peticiones solo de:

- `https://bartolomed.tecnocondor.dev` (Frontend)
- `https://api.bartolomed.tecnocondor.dev` (API)

### Usuarios sin privilegios

- Frontend: usuario `angular` (UID 1001)
- Backend: usuario `nestjs` (UID 1001)

### Variables secretas

⚠️ **IMPORTANTE**: Cambiar estos valores en producción:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_PASSWORD`

## 🚦 Verificación de Despliegue

Después del despliegue, verificar:

1. ✅ Frontend accesible en `https://bartolomed.tecnocondor.dev`
2. ✅ Backend health check: `https://api.bartolomed.tecnocondor.dev/health`
3. ✅ Login funcional desde el frontend
4. ✅ Base de datos inicializada con usuario por defecto

### Usuario por defecto

```
Email: doctor@example.com
Password: Abc123
Roles: super_user, admin, user
```

## 📦 Proceso de Despliegue

1. Hacer push de cambios a `main`
2. Dokploy detecta cambios automáticamente
3. Rebuild de servicios modificados
4. Aplicación de health checks
5. Actualización con zero-downtime

## 🐛 Troubleshooting

### Frontend no carga

- Verificar que el build de Angular fue exitoso
- Revisar logs: `docker logs <frontend-container>`
- Verificar que existe `index.html` en el contenedor

### Backend no responde

- Verificar variables de entorno
- Revisar conexión a base de datos
- Verificar logs: `docker logs <backend-container>`

### Error de CORS

- Verificar que el dominio del frontend está en la lista de CORS del backend
- Verificar que `NODE_ENV=production` está configurado

### Error de permisos en uploads

- Verificar que el volumen `bartolomed_uploads` está montado
- Verificar permisos del usuario `nestjs` en `/app/uploads`
