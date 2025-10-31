# 🔐 Guía de Configuración Inicial con Godmode en Producción (Dokploy)

Esta guía explica cómo usar el endpoint **Godmode** para crear el primer usuario `SUPER_ADMIN` en el sistema desplegado en **Dokploy**.

## 📋 ¿Qué es Godmode?

Godmode es un endpoint especial de bootstrapping que permite crear o promover usuarios con el rol `SUPER_ADMIN` sin necesidad de autenticación previa. Está protegido por un token de entorno (`GOD_MODE_TOKEN`) que debe mantenerse en secreto.

**🎯 Caso de uso principal:** Configuración inicial del primer super administrador en producción cuando no existe ningún usuario en el sistema.

## 🔧 Configuración en Dokploy

### 1. Configurar el GOD_MODE_TOKEN en Dokploy

1. **Accede al panel de Dokploy** en tu servidor
2. **Selecciona tu aplicación** (app-bartolomed)
3. **Ve a la sección de Variables de Entorno** (Environment Variables)
4. **Agrega la variable:**
   ```
   GOD_MODE_TOKEN=tu-token-super-secreto-largo-y-aleatorio-123456789
   ```
5. **Guarda los cambios** y espera a que el contenedor se reinicie

**⚠️ IMPORTANTE:**

- Usa un token largo y aleatorio (mínimo 32 caracteres)
- Nunca lo compartas públicamente
- Anótalo en un lugar seguro (lo necesitarás solo una vez)
- **ELIMINA esta variable después de crear el super admin**

### 2. Verificar que tu Aplicación esté Corriendo

```sh
# El dominio configurado en docker-compose es bartolomed.tecnocondor.dev
# El backend está en /api del mismo dominio
curl https://bartolomed.tecnocondor.dev/api/health
```

**Respuesta esperada:**

```json
{ "status": "ok", "info": { "database": { "status": "up" } } }
```

## 🚀 Crear Super Admin en Producción

### Opción 1: Usando cURL (Recomendado para Producción)

```sh
# URL: El backend está en /api del dominio principal (bartolomed.tecnocondor.dev)
# Token: Usa el GOD_MODE_TOKEN que configuraste en Dokploy
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
  -H "Content-Type: application/json" \
  -H "x-god-token: tu-token-super-secreto-largo-y-aleatorio-123456789" \
  -d '{
    "email": "admin@bartolomed.com",
    "password": "TuPasswordSuperSegura2024!",
    "firstName": "Administrador",
    "lastName": "Sistema"
  }'
```

**💡 Nota:** Si cambiaste el dominio en Dokploy (variable `FRONTEND_DOMAIN`), usa ese dominio en lugar de `bartolomed.tecnocondor.dev`

### Opción 2: Usando Bruno (API Client)

1. Abre Bruno y navega a: `app-bartolomed/Autenticación y Seguridad/Godmode Create Super Admin.bru`

2. **Actualiza la URL** en Bruno:

   - Cambia `http://localhost:3000` por `https://bartolomed.tecnocondor.dev`
   - La ruta completa debe ser: `https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin`

3. Configura las variables de entorno en Bruno:

   - Click en el ambiente (environment)
   - Añade: `baseUrl: https://bartolomed.tecnocondor.dev`
   - Añade: `godModeToken: tu-token-super-secreto-largo-y-aleatorio-123456789`

4. **Actualiza los datos** del payload con tus credenciales reales

5. Ejecuta la petición

### Opción 3: Usando Node.js (fetch API)

```sh
node -e "
fetch('https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-god-token': 'tu-token-super-secreto-largo-y-aleatorio-123456789'
  },
  body: JSON.stringify({
    email: 'admin@bartolomed.com',
    password: 'TuPasswordSuperSegura2024!',
    firstName: 'Administrador',
    lastName: 'Sistema'
  })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error('Error:', err));
"
```

### Opción 4: Desde el Contenedor de Dokploy (SSH)

Si tienes acceso SSH al servidor donde corre Dokploy:

```sh
# 1. Conecta por SSH a tu servidor
ssh usuario@tu-servidor.com

# 2. Lista los contenedores para encontrar el backend
docker ps | grep backend

# 3. Accede al contenedor del backend (reemplaza el ID/nombre)
docker exec -it app-bartolomed-backend-1 sh

# 4. Ejecuta curl desde dentro del contenedor (usa localhost:3000)
curl -X POST http://localhost:3000/api/auth/godmode/super-admin \
  -H "Content-Type: application/json" \
  -H "x-god-token: $GOD_MODE_TOKEN" \
  -d '{
    "email": "admin@bartolomed.com",
    "password": "TuPasswordSuperSegura2024!",
    "firstName": "Administrador",
    "lastName": "Sistema"
  }'
```

**💡 Ventaja:** Dentro del contenedor puedes usar la variable de entorno directamente con `$GOD_MODE_TOKEN`

## 📦 Estructura del Payload

```typescript
{
  "email": string,        // Email del super admin (requerido)
  "password": string,     // Contraseña segura min 6 caracteres (requerido)
  "firstName": string,    // Nombre (opcional)
  "lastName": string,     // Apellido (opcional)
  "mode": "create"        // "create" o "promote" (opcional, default: create)
}
```

### Modos de Operación

- **`create`** (default): Crea un nuevo usuario con rol SUPER_ADMIN
- **`promote`**: Promueve un usuario existente a SUPER_ADMIN

## ✅ Respuesta Exitosa

```json
{
  "user": {
    "id": "uuid-generado",
    "email": "admin@tuempresa.com",
    "personalInfo": {
      "firstName": "Admin",
      "lastName": "Principal"
    },
    "roles": ["SUPER_ADMIN"],
    "isActive": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**🎉 ¡Éxito!** Tu super administrador ha sido creado. Guarda el token JWT que se devuelve, aunque puedes obtener uno nuevo haciendo login.

## 🔑 Guarda tus Credenciales

**⚠️ IMPORTANTE:** Anota estas credenciales en un lugar seguro (gestor de contraseñas):

- **Email:** El email que usaste en el comando
- **Password:** La contraseña que definiste
- **Rol:** `SUPER_ADMIN`
- **URL de acceso:** `https://tu-dominio.com`

## 🔒 Login Normal en Producción

Una vez creado el super admin, usa el endpoint normal de login:

```sh
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bartolomed.com",
    "password": "TuPasswordSuperSegura2024!"
  }'
```

**Respuesta esperada:**

```json
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

O accede desde el navegador a tu aplicación Angular:

```
https://bartolomed.tecnocondor.dev/auth/login
```

## 🛡️ Seguridad Post-Configuración (CRÍTICO)

### ✅ Pasos OBLIGATORIOS después de crear el super admin:

1. **ELIMINA la variable GOD_MODE_TOKEN de Dokploy:**

2. **Verifica que el endpoint godmode ya no funcione:**

   ````sh
   # Esto debe devolver error 403 o 401
   curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
     -H "Content-Type: application/json" \
     -H "x-god-token: cualquier-token" \
     -d '{"email":"test@test.com","password":"test"}'
   ```l -X POST https://tu-dominio.com/api/auth/godmode/super-admin \
     -H "Content-Type: application/json" \
     -H "x-god-token: cualquier-token" \
     -d '{"email":"test@test.com","password":"test"}'
   ````

3. **Usa el super admin solo para:**

   - Crear usuarios admin regulares
   - Configuración inicial del sistema
   - Emergencias críticas

4. **Crea un usuario admin regular** para operaciones diarias:

   - Login con el super admin
   - Crea un usuario con rol `ADMIN`
   - Usa ese usuario para gestión diaria

5. **Habilita autenticación de dos factores** (2FA) cuando esté disponible

### ❌ NO Hacer:

1. **NO dejes el GOD_MODE_TOKEN activo** en producción
2. **NO compartas las credenciales del super admin**
3. **NO uses el super admin para operaciones rutinarias**
4. **NO guardes el GOD_MODE_TOKEN en código fuente**
5. **NO expongas este endpoint sin el token eliminado**

## 🐛 Solución de Problemas en Producción

### Error: "Invalid or missing god-mode token"

**Causa:** El token no coincide o no está configurado en Dokploy

**Solución:**

1. Verifica en Dokploy que `GOD_MODE_TOKEN` esté configurado
2. Copia el token exacto sin espacios extra
3. Verifica que el contenedor se haya reiniciado después de agregar la variable
4. Revisa los logs del contenedor en Dokploy

### Error: "User with email already exists"

**Causa:** Ya existe un usuario con ese email

**Soluciones:**

1. **Intenta hacer login** con ese email (quizás ya fue creado)
2. **Usa un email diferente**
3. **Promueve el usuario existente:**
   ```sh
   curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
     -H "Content-Type: application/json" \
     -H "x-god-token: tu-token" \
     -d '{
       "email": "admin@bartolomed.com",
       "mode": "promote"
     }'
   ```

### Error: Connection refused / Timeout

**Causa:** La aplicación no está corriendo o hay problemas de red

**Solución:**

1. Verifica en Dokploy que el contenedor esté corriendo (debe mostrar "healthy")
2. Revisa los logs del contenedor backend en Dokploy
3. Verifica que el health check funcione:
   ```sh
   curl https://bartolomed.tecnocondor.dev/api/health
   ```
4. Verifica que Traefik esté enrutando correctamente al servicio backend
5. Revisa que las redes Docker estén configuradas (`bartolomed_network` y `dokploy-network`)

### Error: SSL/TLS certificate errors

**Causa:** Problemas con el certificado HTTPS

**Solución:**

1. Verifica que Dokploy haya configurado correctamente el certificado SSL
2. Si es un dominio nuevo, espera a que el certificado se propague (puede tomar minutos)
3. Temporalmente, puedes usar `-k` en curl para ignorar certificados (solo para testing):
   ```sh
   curl -k -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin ...
   ```

### Error: Cannot find service 'backend-svc'

**Causa:** Traefik no encuentra el servicio backend

**Solución:**

1. Verifica los labels de Traefik en el docker-compose:
   ```sh
   docker inspect app-bartolomed-backend-1 | grep traefik
   ```
2. Verifica que el contenedor esté en la red `dokploy-network`:
   ```sh
   docker network inspect dokploy-network
   ```
3. Reinicia el stack completo desde Dokploy

## 📚 Archivos de Referencia

- **Endpoint:** `backend/src/auth/auth.controller.ts` (línea ~114)
- **DTO:** `backend/src/auth/dto/god-bootstrap.dto.ts`
- **Service:** `backend/src/auth/auth.service.ts` (método `bootstrapSuperAdmin`)
- **Tests:** `backend/test/auth-godmode.e2e-spec.ts`
- **Bruno Collection:** `bruno/app-bartolomed/Autenticación y Seguridad/`

## 🔄 Flujo Completo de Configuración Inicial en Dokploy

### Paso 1: Configurar GOD_MODE_TOKEN en Dokploy

1. Accede a tu panel de Dokploy
2. Selecciona tu aplicación `app-bartolomed`
3. Ve a **Environment Variables**
4. Agrega: `GOD_MODE_TOKEN=tu-token-largo-y-aleatorio-min-32-caracteres`
5. Guarda y espera que el contenedor se reinicie

### Paso 2: Verificar que la aplicación esté corriendo

```sh
curl https://bartolomed.tecnocondor.dev/api/health
```

**Respuesta esperada:**

```json
{ "status": "ok", "info": { "database": { "status": "up" } } }
```

Si el health check falla, revisa los logs en Dokploy antes de continuar.

### Paso 3: Crear el super admin

```sh
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
  -H "Content-Type: application/json" \
  -H "x-god-token: tu-token-largo-y-aleatorio-min-32-caracteres" \
  -d '{
    "email": "admin@bartolomed.com",
    "password": "TuPasswordSuperSegura2024!",
    "firstName": "Administrador",
    "lastName": "Sistema"
  }'
```

**Respuesta esperada:**

```json
{
  "user": {
    "id": "...",
    "email": "admin@bartolomed.com",
    "roles": ["SUPER_ADMIN"],
    "isActive": true
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Paso 4: Probar login normal

```sh
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bartolomed.com",
    "password": "TuPasswordSuperSegura2024!"
  }'
```

**Respuesta esperada:**

```json
{
  "user": { "id": "...", "email": "admin@bartolomed.com", ... },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Paso 5: ELIMINAR GOD_MODE_TOKEN de Dokploy

1. Vuelve a Dokploy → Environment Variables
2. **ELIMINA** la variable `GOD_MODE_TOKEN`
3. Guarda y reinicia el contenedor

### Paso 6: Verificar que godmode esté deshabilitado

```sh
# Esto debe fallar con 403 o 401
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
  -H "Content-Type: application/json" \
  -H "x-god-token: cualquier-cosa" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Respuesta esperada:**

```json
{ "statusCode": 403, "message": "Invalid or missing god-mode token" }
```

### Paso 7: Acceder a tu aplicación

1. Abre `https://bartolomed.tecnocondor.dev` en el navegador
2. Haz login con tus credenciales de super admin:
   - Email: `admin@bartolomed.com`
   - Password: La que definiste en el paso 3
3. Crea usuarios adicionales según sea necesario

## 🔧 Información Técnica de la Configuración

### Arquitectura del Despliegue

Según el `docker-compose.dokploy.yml`:

- **Frontend (Angular):** Puerto 4200 interno, expuesto vía Traefik
- **Backend (NestJS):** Puerto 3000 interno, expuesto en `/api` del dominio principal
- **Database (PostgreSQL):** Puerto 5432 interno, NO expuesto públicamente
- **Traefik:** Maneja el enrutamiento y SSL automático

### Variables de Entorno Clave

```env
# Dominio principal (cambia si usas otro dominio)
FRONTEND_DOMAIN=bartolomed.tecnocondor.dev

# Base de datos
DB_HOST=database
DB_PORT=5432
DB_USER=bartolomed_user
DB_PASS=bartolomed_pass
DB_NAME=bartolomed_db

# JWT (ya configurados en producción)
JWT_SECRET=tu-jwt-secret-production
JWT_REFRESH_SECRET=tu-refresh-secret-production

# Godmode (ELIMINAR después de primer uso)
GOD_MODE_TOKEN=tu-token-super-secreto
```

### Redes Docker

- **bartolomed_network:** Red interna entre frontend, backend y database
- **dokploy-network (traefik):** Red externa para Traefik y acceso público

## 📋 Checklist de Seguridad

- [ ] Super admin creado exitosamente
- [ ] Login funciona correctamente
- [ ] `GOD_MODE_TOKEN` eliminado de Dokploy
- [ ] Verificado que godmode ya no funciona
- [ ] Credenciales guardadas en gestor de contraseñas
- [ ] Usuario admin regular creado para uso diario
- [ ] Logs revisados sin errores

## 📞 Soporte y Referencias

### Revisar Logs en Dokploy

1. Ve a tu aplicación en Dokploy
2. Click en **Logs** o **Terminal**
3. Busca errores relacionados con autenticación

### Archivos de Referencia en el Código

- **Endpoint:** `backend/src/auth/auth.controller.ts` (línea ~114)
- **DTO:** `backend/src/auth/dto/god-bootstrap.dto.ts`
- **Service:** `backend/src/auth/auth.service.ts` (método `bootstrapSuperAdmin`)
- **Tests:** `backend/test/auth-godmode.e2e-spec.ts`

### Contacto

Si encuentras problemas críticos:

1. Revisa los logs en Dokploy
2. Verifica la configuración de variables de entorno
3. Consulta la documentación de NestJS sobre guards y decoradores

---

## 🎯 Resumen Rápido (Copy-Paste)

```sh
# 1. Agregar GOD_MODE_TOKEN en Dokploy (Environment Variables)

# 2. Verificar health check
curl https://bartolomed.tecnocondor.dev/api/health

# 3. Crear super admin
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin \
  -H "Content-Type: application/json" \
  -H "x-god-token: TU_TOKEN_AQUI" \
  -d '{"email":"admin@bartolomed.com","password":"TuPasswordSegura2024!","firstName":"Administrador","lastName":"Sistema"}'

# 4. Probar login
curl -X POST https://bartolomed.tecnocondor.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bartolomed.com","password":"TuPasswordSegura2024!"}'

# 5. ELIMINAR GOD_MODE_TOKEN de Dokploy
# 6. ¡Listo! Accede desde el navegador a https://bartolomed.tecnocondor.dev
```

---

**Última actualización:** 30 de octubre de 2025  
**Versión:** 2.0.0 - Producción con Dokploy  
**Entorno:** Producción / Dokploy
