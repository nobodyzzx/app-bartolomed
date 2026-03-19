# Despliegue en Dokploy con red interna y Traefik

Este documento resume los cambios aplicados y el flujo final que quedó funcionando para servir el frontend y el backend únicamente por la red interna de Docker, usando Traefik de Dokploy como reverse proxy en una sola URL pública (dominio del frontend).

## Resumen de lo realizado

- Frontend y backend expuestos solo a la red interna (sin puertos publicados), Traefik hace el enrutamiento.
- Las llamadas desde el frontend van a la misma URL mediante `PathPrefix(/api)`.
- Ajustes de Traefik en `docker-compose.dokploy.yml` con labels en formato mapa (`key: "value"`).
- Conexión explícita de servicios a la red de Traefik (externa) para evitar 504 (upstream unreachable).
- `frontend` usa `serve` (Node) y `baseUrl = '/api'`.
- `backend` con CORS dinámico permitiendo mismo origen y credenciales.
- Healthcheck corregido a `/api/health`.
- `database/init.sql` corregido (sin `${...}` ni `CREATE DATABASE`; se ejecuta dentro de la BD ya creada por el entrypoint).

## Archivos modificados (principales)

- `docker-compose.dokploy.yml`

  - Frontend:
    - Labels Traefik (host del frontend, service y puerto 4200) como mapa:
      - `traefik.enable: "true"`
      - `traefik.http.routers.frontend.rule: "Host(\`${FRONTEND_DOMAIN:-bartolomed.tecnocondor.dev}\`)"`
      - `traefik.http.routers.frontend.service: "frontend-svc"`
      - `traefik.http.services.frontend-svc.loadbalancer.server.port: "4200"`
      - `traefik.docker.network: "${TRAEFIK_NETWORK:-dokploy-network}"`
    - Redes: `bartolomed_network` (interna) y `traefik` (externa, `external: true`).
  - Backend:
    - Labels Traefik para `/api` en el MISMO dominio del frontend:
      - `traefik.enable: "true"`
      - `traefik.http.routers.backend-path.rule: "Host(\`${FRONTEND_DOMAIN:-bartolomed.tecnocondor.dev}\`) && PathPrefix(`/api`)"`
      - `traefik.http.routers.backend-path.service: "backend-svc"`
      - `traefik.http.services.backend-svc.loadbalancer.server.port: "3000"`
      - `traefik.docker.network: "${TRAEFIK_NETWORK:-dokploy-network}"`
    - Healthcheck: `http://localhost:3000/api/health`.
    - Redes: `bartolomed_network` y `traefik`.
  - Database: sin puertos publicados; `healthcheck` con `pg_isready`.
  - Redes:
    - `bartolomed_network` (bridge) y `traefik` (external, `name: ${TRAEFIK_NETWORK:-dokploy-network}`).

- `frontend/src/app/environments/environment.prod.ts`

  - `baseUrl = '/api'` (mismo origen, Traefik forwardea al backend).

- `docker/frontend.Dockerfile`

  - Producción usando `serve` (Node) en puerto 4200 (sin Nginx dentro del contenedor).

- `backend/src/main.ts`

  - CORS dinámico, permite mismo origen, `credentials: true`, y cabeceras necesarias.
  - Prefijo global `api` (por eso el healthcheck es `/api/health`).

- `database/init.sql`
  - Eliminado `CREATE DATABASE ${POSTGRES_DB}` y `\c ...`. Añadido comentario y `SELECT 1;` para no-op seguro.

## Flujo de red

1. El usuario navega a `https://FRONTEND_DOMAIN` (p.ej. `bartolomed.tecnocondor.dev`).
2. La SPA hace peticiones a `/api/...` en el mismo dominio.
3. Traefik enruta `PathPrefix(/api)` al servicio `backend:3000` en la red interna.
4. Cookies httpOnly (refresh) se setean con `Secure` (requiere HTTPS activo en Dokploy).

## Variables de entorno relevantes

- En Dokploy o `.env.production` (según tu flujo):
  - `FRONTEND_DOMAIN=bartolomed.tecnocondor.dev`
  - `TRAEFIK_NETWORK=dokploy-network` (ajústalo si tu instalación usa otro nombre)
  - `TRAEFIK_CERT_RESOLVER=letsencrypt` (o el nombre real configurado en tu Traefik de Dokploy)
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `GOD_MODE_TOKEN`
- En `docker-compose.dokploy.yml` los secretos críticos ya no tienen fallback; si faltan, el despliegue debe considerarse inválido.
- Los routers `frontend` y `backend-path` están configurados con `entrypoints=websecure`, `tls=true` y `tls.certresolver`.

## Verificaciones rápidas

- Salud del backend (desde tu equipo):
  - `GET https://FRONTEND_DOMAIN/api/health` → 200
- Login en la SPA:
  - `POST /api/auth/login` → 200 y cabecera `Set-Cookie: rt=...; HttpOnly; Secure; Path=/` (necesita HTTPS)
  - `GET /api/auth/check-status` con `Authorization: Bearer <token>` → 200

## Bootstrap de SUPER_ADMIN (3 opciones)

1. Dentro del contenedor `backend` (terminal `sh`, no depende de DNS/Traefik):

- Crear SUPER_ADMIN nuevo (con Node 20 y `fetch`):

```sh
node -e 'fetch("http://localhost:3000/api/auth/godmode/super-admin",{method:"POST",headers:{"content-type":"application/json","x-god-token":process.env.GOD_MODE_TOKEN},body:JSON.stringify({email:"superadmin@bartolomed.dev",password:"Admin123!",firstName:"Super",lastName:"Admin",mode:"create"})}).then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})'
```

- Promover usuario existente:

```sh
node -e 'fetch("http://localhost:3000/api/auth/godmode/super-admin",{method:"POST",headers:{"content-type":"application/json","x-god-token":process.env.GOD_MODE_TOKEN},body:JSON.stringify({email:"doctor@example.com",password:"ignoreMe123",mode:"promote"})}).then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})'
```

- Alternativa con `wget`:

```sh
wget -qO- \
  --header="content-type: application/json" \
  --header="x-god-token: $GOD_MODE_TOKEN" \
  --post-data='{"email":"superadmin@bartolomed.dev","password":"Admin123!","firstName":"Super","lastName":"Admin","mode":"create"}' \
  http://localhost:3000/api/auth/godmode/super-admin
```

2. Vía Traefik (si el dominio ya responde):

```sh
curl -sS -X POST "https://bartolomed.tecnocondor.dev/api/auth/godmode/super-admin" \
  -H 'content-type: application/json' \
  -H 'x-god-token: TU_GOD_MODE_TOKEN' \
  --data '{"email":"superadmin@bartolomed.dev","password":"Admin123!","firstName":"Super","lastName":"Admin","mode":"create"}'
```

3. SQL directo en Postgres (promover usuario sembrado `doctor@example.com`):

```sql
update users
set roles = (
  select array_agg(distinct r)
  from unnest(roles || ARRAY['super-admin','admin']::text[]) as r
),
    "isActive" = true
where lower(email) = 'doctor@example.com';
```

## Problemas comunes y solución

- 504 en `/api/*`:

  - Agregar `traefik.docker.network` y conectar servicios a la red externa de Traefik.
  - Confirmar nombre real de la red en Dokploy (`TRAEFIK_NETWORK`).

- Cookie `rt` (refresh) no se setea:

  - Asegurar HTTPS en el dominio (la cookie es `Secure`).

- CORS bloquea:

  - El backend permite mismo origen; verifica que entras por el dominio del frontend y no por IP/puerto.

- Error en `init.sql` con `${POSTGRES_DB}`:
  - Ya removido; no se deben usar variables ni `CREATE DATABASE` en ese script.

- Certificado self-signed (`TRAEFIK DEFAULT CERT`):

  - Verificar que `TRAEFIK_CERT_RESOLVER` coincida con el resolver real de Dokploy/Traefik.
  - Re-desplegar el stack para que Traefik reprovisione certificados.
  - Confirmar emisión con:

```sh
echo | openssl s_client -servername <FRONTEND_DOMAIN> -connect <FRONTEND_DOMAIN>:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates
```

---

Con esto, el frontend y backend funcionan por una sola URL y toda la comunicación entre contenedores es interna.

## Checklist de preproducción (go-live)

### 1) Secretos y acceso

- [ ] Cambiar valores por defecto en entorno productivo:
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `GOD_MODE_TOKEN`
  - `POSTGRES_PASSWORD`
- [ ] Verificar que ningún secreto esté hardcodeado en `docker-compose*.yml` o repositorio.
- [ ] Confirmar HTTPS activo en el dominio final (requerido para cookie `rt` con `Secure`).
- [ ] Ejecutar bootstrap de `SUPER_ADMIN` y **eliminar `GOD_MODE_TOKEN`** del entorno al terminar.

### 2) Base de datos y backups

- [ ] Confirmar estado saludable de DB (`pg_isready`) y conectividad desde backend.
- [ ] Ejecutar backup inicial antes de go-live:

```sh
pg_dump -h <db-host> -U <db-user> -d <db-name> -Fc -f backup-preprod.dump
```

- [ ] Verificar restauración en entorno de prueba:

```sh
pg_restore -h <db-host-test> -U <db-user> -d <db-name-test> --clean --if-exists backup-preprod.dump
```

- [ ] Definir ventana/frecuencia de backup y retención.

### 3) Salud operativa y monitoreo

- [ ] Ejecutar verificación operativa rápida del entorno:

```sh
bash ./check-status.sh
```

- [ ] Health endpoint responde por dominio público:

```sh
curl -fSs https://<FRONTEND_DOMAIN>/api/health
```

- [ ] Revisar logs de `frontend`, `backend` y `db` sin errores críticos al iniciar.
- [ ] Confirmar alertas mínimas (caída de backend, DB no saludable, 5xx sostenidos).
- [ ] Validar uso de CPU/memoria en picos básicos de carga.

### 4) Seguridad funcional (auth + permisos + clínica)

- [ ] Login/logout y refresh token funcionan por HTTPS.
- [ ] Rutas admin (`system-params`, `notifications-config`, `document-templates`, `api-integration`) respetan rol/permisos esperados.
- [ ] Verificar aislamiento por clínica (`X-Clinic-Id`) en operaciones críticas.
- [ ] Confirmar que usuarios sin permisos reciben 401/403 correctamente.

### 5) Calidad y pruebas mínimas

- [ ] Backend core tests y hardening completados.
- [ ] Frontend smoke tests en contenedor:

```sh
podman compose exec -T frontend sh -lc "CHROME_BIN=/usr/bin/chromium npm test -- --watch=false"
```

- [ ] Build frontend/backend en verde en pipeline/entorno final.

### 6) Rollback operativo

- [ ] Definir versión/tag anterior estable para rollback inmediato.
- [ ] Confirmar procedimiento de rollback de app y DB (si aplica migración).
- [ ] Guardar comandos de recuperación rápida (con runtime disponible):

```sh
podman compose pull
podman compose up -d
```

- [ ] Ensayar rollback en staging al menos una vez.

### 7) Cierre previo a go-live

- [ ] Ejecutar smoke funcional final (login, pacientes, citas, receta, facturación, reportes).
- [ ] Confirmar responsables on-call y canal de incidentes.
- [ ] Registrar evidencia de checklist (comandos/salidas) en bitácora interna.
