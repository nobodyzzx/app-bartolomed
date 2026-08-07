# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

Services run continuously in containers — **never run `npm start`, `ng serve`, or `docker compose up`**. Edit code and refresh browser; services auto-reload.

```bash
# Prefer podman on this machine (Fedora)
podman compose logs -f backend      # View backend logs
podman compose logs -f frontend     # View frontend logs
podman compose restart backend      # Restart if stuck
```

Health check: `curl http://localhost:3000/api/health`

## Key Commands

### Backend (`cd backend`)
```bash
npm test                    # Unit tests (Jest)
npm run test:e2e            # E2E tests (supertest)
npm run test:cov            # Coverage report
npm run lint                # ESLint --fix
npm run build               # Compile TypeScript

# Migrations (run inside container)
podman compose exec backend npm run migration:generate -- -n MigrationName
podman compose exec backend npm run migration:run
podman compose exec backend npm run migration:revert
podman compose exec backend npm run migration:show

# Seeds
podman compose exec backend npm run seed:all
```

### Frontend (`cd frontend`)
```bash
npm test                    # Karma/Jasmine tests
npm run build               # Production build
```
No hay script `lint` en `frontend/package.json` — el frontend no tiene ESLint configurado. Si necesitas linting, configura `ng lint` con `@angular-eslint` antes de invocarlo.

### Run a single test file
```bash
# Backend unit
cd backend && npx jest src/auth/auth.service.spec.ts

# Backend e2e
cd backend && npx jest test/auth.e2e-spec.ts --config ./test/jest-e2e.json

# Frontend spec
cd frontend && npm test -- --include="src/app/modules/dashboard/pages/patients/patients.component.spec.ts" --watch=false
```

### Type generation (backend DTOs → frontend types)
Frontend types in `frontend/src/generated/api-types.ts` are generated from the Swagger spec — do not edit by hand. Friendly re-exports live in `api-exports.ts` (`ApiPatient`, `ApiCreatePatientDto`, …).

CI enforces this: the `type-sync` job in `.github/workflows/ci.yml` regenerates both files and fails the pipeline if they drift from what's committed. Run one of these locally and commit the result whenever a DTO changes:
```bash
# With backend running (HTTP fetch):
cd frontend && npm run generate-types:fetch

# CI / no HTTP (DB available, runs in-process):
podman compose exec backend npm run openapi:generate
cd frontend && npm run generate-types
```
`openapi:generate` runs `nest build` first and imports the compiled `AppModule` from `dist/` — required because the `@nestjs/swagger` plugin (`nest-cli.json`) that infers DTO properties without explicit `@ApiProperty()` is an AST transform that only runs through `nest build`/`nest start`; importing straight from `src/` via bare `ts-node` skips it and produces empty (`Record<string, never>`) schemas for those DTOs. `docker-compose.yml` also mounts `./frontend/src/generated` into the backend container so this command actually writes to the host — without it the file only lands in the container's ephemeral filesystem.

## Backend Architecture (NestJS + TypeORM)

### Module Pattern
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([EntityA, EntityB]),
    AuthModule,          // required for @Auth() decorator
    OtherFeatureModule,
  ],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [TypeOrmModule, FeatureService],  // export TypeOrmModule for entity reuse
})
```

When adding/modifying entities, register in **both** places — runtime and migrations CLI use different sources:
1. `backend/src/app.module.ts` entities array (runtime, even with `autoLoadEntities: true`)
2. `backend/src/config/data-source.ts` entities list (TypeORM CLI / migrations)

### Auth Decorators (from `auth/decorators/`)
```typescript
@Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)   // JWT + role guard
@AuthClinic({ roles: [...], permissions: [...] })  // adds ClinicScopeGuard — use for clinic-scoped endpoints
@GetUser() user: User                         // extract current user
@Public()                                     // bypass JWT auth
```

Prefer `@Auth` / `@AuthClinic` over ad-hoc `@UseGuards(...)`.

Valid roles: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `NURSE`, `PHARMACIST`, `RECEPTIONIST`, `USER`

Guard execution order: `JwtAuthGuard` → `UserRoleGuard` → `PermissionsGuard` → `ClinicScopeGuard`

### Multi-Tenancy
- Clinic context flows via `X-Clinic-Id` request header (auto-injected by frontend interceptor)
- Backend `ClinicScopeGuard` validates membership; all queries must filter by `clinic_id`
- **Never return cross-clinic data** — always scope queries to the authenticated clinic
- **SUPER_ADMIN auto-vinculación**: al crear un usuario `SUPER_ADMIN` y en cada login se materializan automáticamente sus filas en `UserClinic` para todas las clínicas existentes (`auth.service.ts`). No hace falta seed manual ni endpoint admin para darle acceso a una clínica nueva — pero si añades una clínica con la app corriendo, la vinculación se completa en el siguiente login del SUPER_ADMIN.

### Database Migrations
`synchronize: false` is enforced. Schema changes require a migration:
1. Modify entity → generate migration → review SQL → `migration:run` → commit file
2. Migration files live in `backend/src/migrations/`
3. Data source config: `backend/src/config/data-source.ts`

## Frontend Architecture (Angular 19)

### Routing Pattern
Dashboard features are lazy-loaded from `modules/dashboard/pages/{feature}/`:
```typescript
{
  path: 'feature-name',
  loadChildren: () => import('./pages/feature/feature.module').then(m => m.FeatureModule),
  canActivate: [permissionsGuard, roleGuard],
  data: { allowedRoles: [UserRoles.DOCTOR], requiredPermissions: [Permission.FeatureRead] }
}
```

Active routing module: `app-routing.module.ts` → `modules/dashboard/dashboard-routing.module.ts`.

### HTTP Service Pattern
```typescript
create(payload: CreateDto): Observable<Entity> {
  return this.http.post<Entity>(`${environment.baseUrl}/endpoint`, payload).pipe(
    tap(() => this.alertService.success('Éxito', 'Registro creado')),
    catchError(this.errorService.handleError),
  );
}
```

### Interceptors (registered in `app.module.ts`)
- `AuthInterceptor`: injects Bearer token, handles 401 with silent refresh
- `ClinicContextInterceptor`: adds `X-Clinic-Id` header automatically

### Auth service
Use `modules/auth/services/auth.service.ts` (the real, signal-based auth service). The old `core/services/auth.service.ts` dev simulator was removed.

## UI Design System

Use `MaterialModule` from `app/material/material.module.ts` — never import individual Material modules.

**Icons:**
- Standalone: `<span class="material-symbols-outlined">icon_name</span>`
- Inside Material components only: `<mat-icon>`

**Page Layout:**
```html
<div class="min-h-screen bg-slate-50">
  <div class="max-w-7xl mx-auto p-6">
    <header class="mb-6 flex items-center gap-4">
      <button (click)="goBack()" class="w-9 h-9 rounded-full hover:bg-slate-100">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 class="text-3xl font-bold text-slate-900">Page Title</h1>
    </header>
    <!-- section cards with colored headers -->
  </div>
</div>
```

Full UI guidelines: `docs/GUIA-DISENO-UI.md`

**Alerts (SweetAlert2 via `AlertService`):**
```typescript
const result = await this.alert.fire({
  icon: 'question', title: '¿Confirmar?', showCancelButton: true,
  confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar',
});
if (result.isConfirmed) { /* action */ }
```

## Common Gotchas

- **Entity not found at runtime**: Register in `app.module.ts` entities array
- **Circular dependency**: Use `forwardRef()` or extract interfaces; never import full modules in entities/DTOs
- **401 on API calls**: Check that `AuthInterceptor` is registered and token is in localStorage/sessionStorage
- **Clinic context missing (403)**: Some endpoints require `X-Clinic-Id`; verify `ClinicContextInterceptor` is active
- **CORS errors**: Backend allows `localhost:4200` (dev) and same-origin (prod via Traefik)
- **Test fails con `Nest can't resolve dependencies of XService (?, AuditService)`**: agrega un provider mock en el `Test.createTestingModule` del spec:
  ```typescript
  { provide: AuditService, useValue: { log: jest.fn() } }
  ```
  Cualquier servicio que reciba `AuditService` por DI lo necesita en sus tests, aun si el spec original era anterior a la introducción del audit trail.

## Default Dev Credentials

- Seed user: `doctor@example.com` / `Abc123` (SUPER_ADMIN, ADMIN, USER)
- Demo DB clinic admin: `admin@bartolomed.com` / `Abc123`
- Reset demo data: `GET /api/seed/reset`

## Additional Docs

- `docs/GUIA-DISENO-UI.md` — UI design system details
- `docs/DEPLOY-DOKPLOY-NET-INTERNA.md` — production deployment (Traefik, Dokploy)
- `GODMODE-SETUP.md` — initial SUPER_ADMIN bootstrap for production
- `frontend/FORMULARIOS-README.md` — reactive forms patterns
