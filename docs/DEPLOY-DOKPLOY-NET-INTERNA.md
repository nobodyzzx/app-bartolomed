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
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `GOD_MODE_TOKEN`

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

---

Con esto, el frontend y backend funcionan por una sola URL y toda la comunicación entre contenedores es interna. Si deseas, puedo convertir estas instrucciones en un checklist de despliegue en Dokploy y un script de verificación rápida.
