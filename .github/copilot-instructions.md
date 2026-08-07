# GitHub Copilot Instructions - Bartolomed Medical System

This file was refined from existing project guidance in `README.md` and `CLAUDE.md`, plus current source code.

## Build, test, and lint commands

Services run in containers with auto-reload. Do not start app servers manually (`npm start`, `ng serve`, `docker compose up`) for normal coding changes.

### Backend (`cd backend`)

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:cov
```

Run a single backend unit test file:

```bash
npx jest src/auth/auth.service.spec.ts
```

Run a single backend e2e test file:

```bash
npx jest test/auth.e2e-spec.ts --config ./test/jest-e2e.json
```

### Frontend (`cd frontend`)

```bash
npm run build
npm test -- --watch=false
```

Run a single frontend spec file:

```bash
npm test -- --include="src/app/modules/dashboard/pages/patients/patients.component.spec.ts" --watch=false
```

### Useful container troubleshooting

```bash
podman compose logs -f backend
podman compose logs -f frontend
podman compose restart backend
curl http://localhost:3000/api/health
```

Docker equivalents (`docker compose ...`) are interchangeable.

## High-level architecture

- Monorepo with Angular frontend (`frontend/`) and NestJS API (`backend/`), orchestrated via `docker-compose.yml` with PostgreSQL.
- Frontend and backend are both mounted as volumes in containers, so code edits hot-reload without restarting services.
- Frontend root wiring is in `frontend/src/app/app.module.ts`: HTTP interceptors are global (`AuthInterceptor`, `ClinicContextInterceptor`), and routing starts in `app-routing.module.ts` then lazy-loads the dashboard.
- Feature access is mainly controlled in `frontend/src/app/modules/dashboard/dashboard-routing.module.ts` through `canActivate` plus `data.allowedRoles` and `data.requiredPermissions`.
- Backend root wiring is in `backend/src/app.module.ts`: all domain modules are imported there, and entities are explicitly listed in `TypeOrmModule.forRoot(...)`.
- Multi-tenant clinic scope spans both apps: frontend sends `X-Clinic-Id` (clinic interceptor), backend enforces clinic membership in guards (notably `ClinicScopeGuard` when using `@AuthClinic`).
- DB schema is migration-driven (`synchronize: false` in both app config and migration data source). TypeORM migrations live in `backend/src/migrations/`.
- API contract flow is backend Swagger/OpenAPI -> frontend generated types (`frontend/src/generated/api-types.ts`) via `frontend` scripts `generate-types` / `generate-types:fetch`.

## Key conventions for this codebase

- Keep entity registration explicit: when adding/modifying entities, update both:
  1. `backend/src/app.module.ts` entities list (runtime)
  2. `backend/src/config/data-source.ts` entities list (migrations/CLI)
- Backend schema changes must be done with migrations; do not rely on TypeORM sync.
- Prefer `@Auth(...)` / `@AuthClinic(...)` decorators for controller protection instead of ad-hoc `@UseGuards(...)`.
- Dashboard routes should define both role and permission metadata (`allowedRoles`, `requiredPermissions`) alongside guards.
- Use `MaterialModule` as the centralized Angular Material import point in feature modules.
- Icon convention: use Material Symbols (`<span class="material-symbols-outlined">`) for standalone icons; reserve `<mat-icon>` for Material component contexts.
- In frontend auth-related work, use `modules/auth/services/auth.service.ts` (the active auth service path in this repo).

## Related docs to consult when changing behavior

- `README.md`
- `CLAUDE.md`
- `docs/GUIA-DISENO-UI.md`
- `docs/DEPLOY-DOKPLOY-NET-INTERNA.md`
- `GODMODE-SETUP.md`
