# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Healthcare management system (clínica/hospital) — **Bartolomé**. Multi-tenant (multi-clínica), multi-rol. Stack: NestJS backend + Angular 18 frontend + PostgreSQL 13.

## Development Commands

All services run via Docker. Use `podman compose` (not `docker compose`).

```bash
# Start full stack
podman compose up

# Start individual service
podman compose up backend
podman compose up frontend
podman compose up db
```

### Backend (NestJS) — port 3000

```bash
# Run in watch mode (inside container or with local Node)
npm run start:dev

# Lint & format
npm run lint
npm run format

# Tests
npm run test                  # unit tests (Jest)
npm run test:watch            # watch mode
npm run test:cov              # coverage
npm run test:e2e              # e2e tests

# Run a single test file
npx jest src/auth/auth.service.spec.ts

# Database seeding
npm run seed:all
npm run seed:clinics
npm run seed:users

# Migrations (synchronize:false — migrations required)
npm run migration:generate -- --name MigrationName
npm run migration:run
npm run migration:revert
npm run migration:show
```

### Frontend (Angular 18) — port 4200

```bash
npm start                     # ng serve
npm run build                 # production build
npm test                      # Karma/Jasmine tests
```

### API Docs

Swagger available at `http://localhost:3000/api/docs` (dev mode only).

## Architecture

### Backend Structure

```
backend/src/
├── app.module.ts          # Root module, TypeORM config
├── main.ts                # Global pipes, CORS, /api prefix
├── auth/                  # JWT strategy + guards + decorators
│   ├── guards/            # JwtAuthGuard, UserRoleGuard, ClinicScopeGuard, PermissionsGuard
│   └── decorators/        # @Auth(), @GetUser(), @Public()
├── common/                # Shared filters, DTOs, exceptions
├── users/                 # User + PersonalInfo + ProfessionalInfo entities
├── clinics/               # Clinic entity + management
├── patients/              # Patient records
├── appointments/          # Appointment scheduling
├── medical-records/       # Medical records + consent forms
├── prescriptions/         # Prescriptions + items
├── pharmacy/              # Medications, stock, sales, suppliers, invoices, purchase orders
├── billing/               # Invoices, payments, financial reports
├── assets/                # Asset inventory + maintenance records
├── reports/               # Report generation
├── roles/                 # Role entity
├── seed/                  # 5 seed files (00-clinics → 04-appointments)
└── migrations/            # TypeORM migrations (currently empty)
```

**Module pattern:** each module has `controllers/`, `services/`, `entities/`, `dto/`, and `[module].module.ts`.

### Frontend Structure

```
frontend/src/app/
├── app.routes.ts              # Lazy-loaded routes with guards & permissions metadata
├── core/
│   ├── enums/                 # UserRoles, Permission
│   ├── guards/                # role.guard, permissions.guard, roles-sync.guard
│   └── services/              # alert, loading, role-state, session
├── shared/                    # Reusable components & utilities
├── modules/
│   ├── auth/                  # REAL auth service, interceptors, guards, login/register pages
│   ├── clinics/               # ClinicContextInterceptor
│   └── dashboard/             # DashboardLayout
└── pages/                     # Feature pages (lazy-loaded): patients, medical-records,
                                # appointments, pharmacy, billing, assets-control,
                                # prescriptions, reports, admin/*
```

**Path aliases:** `@core/*` → `app/core/*`, `@shared/*` → `app/shared/*`

### Auth Flow

1. Login → Backend issues JWT access token (2h) + refresh token (15d)
2. `AuthInterceptor` injects `Authorization: Bearer {token}` on every request
3. 401 triggers refresh via the interceptor (`isRefreshing` flag prevents duplicate calls)
4. Token stored in `localStorage` (remember me) or `sessionStorage` (session only)
5. Angular auth state via signals: `_currentUser`, `_authStatus` in `modules/auth/services/auth.service.ts`

> **Note:** `core/services/auth.service.ts` is a dev-only role simulator — the real auth service is `modules/auth/services/auth.service.ts`.

### Multi-Clinic Isolation

- Every user belongs to a clinic (ManyToOne relation on `User`)
- Backend: `ClinicScopeGuard` enforces isolation
- Frontend: `ClinicContextInterceptor` injects `X-Clinic-Id` header on every request

### Authorization Layers

```typescript
// @Auth() composite decorator applies all three guards:
@Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
// → JwtAuthGuard (validates JWT)
// → UserRoleGuard (validates role)
// → ClinicScopeGuard (validates clinic membership)
```

Fine-grained permissions defined in `auth/permissions/` but not yet applied to all endpoints (role-only guards active on most routes — see tech debt below).

Frontend routes declare `allowedRoles` and `requiredPermissions` in route `data`.

### Database

- TypeORM 0.3.20, `synchronize: false` (migrations required for schema changes)
- 25+ entities with cascade relations
- Enum `ValidRoles`: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `PHARMACIST`, `USER`

### TypeScript Config

- **Backend:** `strictNullChecks: true`, `noImplicitAny: false`
- **Frontend:** full `strict: true` + `strictTemplates: true`

## Known Tech Debt (Priority Order)

1. **Migrations empty** — `synchronize:false` is set but no migrations exist yet; schema changes require manual migration files
2. **Duplicate auth services** — `core/services/auth.service.ts` (dev simulator) vs `modules/auth/services/auth.service.ts` (real); use the latter
3. **Permission guards not applied** — `PermissionsGuard` is defined but most endpoints only use role guards
4. **Incomplete TODOs in code** — stock reduction in `pharmacy-sales.service`, clinic context in `assets.controller`
5. **No type generation** — frontend interfaces are maintained manually vs backend DTOs

## Environment

Key env vars (see `.env.example`):

```
DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
JWT_SECRET, JWT_REFRESH_SECRET
GOD_MODE_TOKEN               # bypass auth in dev/test
ENABLE_PHARMACY_MODULE, ENABLE_REPORTS_MODULE, ENABLE_ASSETS_CONTROL_MODULE, ENABLE_MEDICAL_RECORDS_MODULE
```

## Docs

- `docs/` — domain-specific design guides (pharmacy API, medical records, billing, etc.)
- `REFACTOR_LOG.md` — recent tech-debt changes
- `TODO-MANANA.md` — pending features
- `GODMODE-SETUP.md` — god-mode token setup for dev/testing
