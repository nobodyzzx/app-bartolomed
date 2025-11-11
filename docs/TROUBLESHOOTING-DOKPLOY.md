# 🔧 Troubleshooting - Despliegue en Dokploy

Esta guía documenta problemas comunes al desplegar la aplicación en Dokploy y sus soluciones.

## Error: "Cannot find module '/app/dist/main'"

### Síntoma

```
Error: Cannot find module '/app/dist/main'
at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
at Module._load (node:internal/modules/cjs/loader:1038:27)
```

### Causa

El backend no se compiló correctamente durante la construcción de la imagen Docker. Esto puede ocurrir por:

1. **Dependencias de desarrollo no instaladas**: NestJS necesita TypeScript y otras dependencias dev para compilar
2. **Caché de Docker corrupto**: Construcciones previas fallidas pueden dejar caché inválido
3. **Contexto de construcción incorrecto**: El Dockerfile no encuentra los archivos fuente

### Solución

#### 1. Limpiar caché de Docker en Dokploy

En Dokploy, fuerza una reconstrucción completa:

1. Ve a tu aplicación en Dokploy
2. Click en **Settings** → **Advanced**
3. Activa **"Force rebuild"** o **"Build without cache"**
4. Redeploy la aplicación

#### 2. Verificar Dockerfile del Backend

El archivo `/docker/backend.Dockerfile` debe tener esta estructura en la etapa de construcción:

```dockerfile
# Etapa de construcción
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./

# ✅ IMPORTANTE: Instalar TODAS las dependencias (incluyendo devDependencies)
RUN npm ci && npm cache clean --force

RUN npm install -g @nestjs/cli
COPY . .

# ✅ Esto debe generar la carpeta dist/
RUN npm run build
```

**NO hacer:**

```dockerfile
# ❌ INCORRECTO - No instala devDependencies necesarias para construir
RUN npm ci --only=production
```

#### 3. Verificar logs de construcción en Dokploy

En Dokploy, revisa los logs de construcción:

1. Ve a **Logs** → **Build Logs**
2. Busca errores durante `npm run build`
3. Verifica que se muestre: `Successfully compiled`
4. Confirma que existe la carpeta `dist/` después del build

#### 4. Verificar que el contexto de construcción sea correcto

En `docker-compose.dokploy.yml`:

```yaml
backend:
  build:
    context: ./backend # ✅ Correcto: apunta a la carpeta del backend
    dockerfile: ../docker/backend.Dockerfile
    target: production
```

#### 5. Probar construcción localmente (opcional)

Si tienes acceso al servidor, prueba construir manualmente:

```bash
# SSH al servidor de Dokploy
ssh usuario@servidor

# Navega al directorio del proyecto
cd /ruta/del/proyecto

# Construye la imagen manualmente
docker build -f docker/backend.Dockerfile -t test-backend:latest backend

# Verifica que dist/ existe
docker run --rm test-backend:latest ls -la /app/dist/
```

#### 6. Rebuild completo en Dokploy

Como último recurso, reconstruye todo desde cero:

1. En Dokploy, **detén** la aplicación
2. **Elimina** los volúmenes e imágenes antiguas si es posible
3. **Redeploy** con "Force rebuild" activado

### Prevención

Para evitar este problema en el futuro:

- ✅ Siempre usa `npm ci` (no `npm install`) para instalaciones reproducibles
- ✅ Instala todas las dependencias en la etapa de construcción (`npm ci` sin flags)
- ✅ Verifica que `nest build` se ejecute correctamente en los logs
- ✅ Mantén el `.dockerignore` para evitar copiar `node_modules` o `dist` existentes

---

## Error: "Connection refused" al acceder al backend

### Síntoma

El frontend no puede conectarse al backend, o curl falla:

```
curl: (7) Failed to connect to bartolomed.tecnocondor.dev port 443: Connection refused
```

### Causa

1. El backend no está corriendo o falló el health check
2. Traefik no está enrutando correctamente
3. El contenedor no está en la red correcta

### Solución

#### 1. Verificar estado del backend en Dokploy

1. Ve a **Containers** en Dokploy
2. Verifica que el contenedor `backend` tenga estado **"healthy"** o **"running"**
3. Si está en estado **"unhealthy"**, revisa los logs

#### 2. Revisar logs del backend

En Dokploy → **Logs** → **Application Logs**:

```
# Busca errores como:
- Database connection failed
- Port 3000 already in use
- Module not found errors
```

#### 3. Verificar configuración de Traefik

Verifica los labels en `docker-compose.dokploy.yml`:

```yaml
labels:
  traefik.enable: 'true'
  # ✅ El backend debe estar en el MISMO dominio con /api
  traefik.http.routers.backend-path.rule: 'Host(`${FRONTEND_DOMAIN}`) && PathPrefix(`/api`)'
  traefik.http.routers.backend-path.service: 'backend-svc'
  traefik.http.services.backend-svc.loadbalancer.server.port: '3000'
  # ✅ IMPORTANTE: Debe estar en la red de Traefik
  traefik.docker.network: 'dokploy-network'
```

#### 4. Verificar redes Docker

El backend debe estar en DOS redes:

```yaml
networks:
  - bartolomed_network # Para comunicarse con database
  - traefik # Para que Traefik pueda enrutarlo
```

#### 5. Probar health check manualmente

SSH al servidor y ejecuta:

```bash
# Encuentra el contenedor del backend
docker ps | grep backend

# Ejecuta el health check manualmente
docker exec -it <container-id> wget -O- http://localhost:3000/api/health

# Debe responder: {"status":"ok","info":{"database":{"status":"up"}}}
```

---

## Error: Database connection failed

### Síntoma

En los logs del backend:

```
Error: connect ECONNREFUSED database:5432
Could not connect to database
```

### Solución

#### 1. Verificar variables de entorno en Dokploy

Asegúrate de que estas variables estén configuradas:

```
DB_HOST=database
DB_PORT=5432
DB_USER=bartolomed_user
DB_PASS=bartolomed_pass
DB_NAME=bartolomed_db
```

#### 2. Verificar que el servicio database esté corriendo

En Dokploy, verifica que el contenedor `database` esté en estado **healthy**.

#### 3. Verificar depends_on en docker-compose

```yaml
backend:
  depends_on:
    database:
      condition: service_healthy # ✅ Espera a que la DB esté lista
```

#### 4. Verificar red interna

El backend y la database deben estar en la misma red:

```yaml
networks:
  - bartolomed_network
```

---

## Error: CORS al hacer peticiones desde el frontend

### Síntoma

En la consola del navegador:

```
Access to XMLHttpRequest at 'https://bartolomed.tecnocondor.dev/api/...'
has been blocked by CORS policy
```

### Solución

**✅ Configuración correcta:** El backend debe estar en `/api` del MISMO dominio:

```yaml
# Frontend: https://bartolomed.tecnocondor.dev/
# Backend:  https://bartolomed.tecnocondor.dev/api
```

Verifica en `docker-compose.dokploy.yml`:

```yaml
backend:
  labels:
    # ✅ PathPrefix `/api` en el MISMO host
    traefik.http.routers.backend-path.rule: 'Host(`${FRONTEND_DOMAIN}`) && PathPrefix(`/api`)'
```

Y en el frontend (`environment.ts`):

```typescript
export const environment = {
  production: true,
  baseUrl: '/api', // ✅ Ruta relativa - mismo dominio
};
```

---

## Error: SSL/TLS certificate errors

### Síntoma

```
SSL certificate problem: unable to get local issuer certificate
```

### Solución

Dokploy usa Traefik con Let's Encrypt automático. Si hay problemas:

1. **Verifica el dominio**: Debe apuntar correctamente a tu servidor
2. **Espera unos minutos**: El certificado puede tardar en generarse
3. **Revisa logs de Traefik** en Dokploy
4. **Verifica que el puerto 443 esté abierto** en el firewall

---

## Checklist de Despliegue Exitoso

Antes de abrir un ticket, verifica:

- [ ] Construcción sin errores en Build Logs
- [ ] Todos los contenedores en estado "healthy"
- [ ] Variables de entorno configuradas correctamente
- [ ] Dominio apuntando al servidor de Dokploy
- [ ] Health check del backend responde: `/api/health`
- [ ] Frontend accesible en el navegador
- [ ] Backend accesible en `/api` del mismo dominio
- [ ] Sin errores CORS en la consola del navegador

---

## Comandos Útiles para Debugging

### Ver logs en tiempo real

```bash
# Backend
docker logs -f <backend-container-id>

# Frontend
docker logs -f <frontend-container-id>

# Database
docker logs -f <database-container-id>
```

### Inspeccionar contenedor

```bash
# Ver variables de entorno
docker exec <container-id> env

# Ver archivos en /app/dist
docker exec <container-id> ls -la /app/dist/

# Probar health check
docker exec <container-id> wget -O- http://localhost:3000/api/health
```

### Verificar redes

```bash
# Listar redes
docker network ls

# Inspeccionar red de Dokploy
docker network inspect dokploy-network

# Ver qué contenedores están en la red
docker network inspect bartolomed_network
```

---

**Última actualización:** 11 de noviembre de 2025  
**Versión:** 1.0.0
