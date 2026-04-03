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
npm run lint                # ESLint
npm run build               # Production build
```

### Run a single backend test file
```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

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

All entities must also be registered in `app.module.ts` entities array (even with `autoLoadEntities: true`).

### Auth Decorators (from `auth/decorators/`)
```typescript
@Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)   // JWT + role guard + clinic scope
@GetUser() user: User                         // extract current user
@Public()                                     // bypass JWT auth
```

Valid roles: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `NURSE`, `PHARMACIST`, `RECEPTIONIST`

Guard execution order: `JwtAuthGuard` → `UserRoleGuard` → `PermissionsGuard` → `ClinicScopeGuard`

### Multi-Tenancy
- Clinic context flows via `X-Clinic-Id` request header (auto-injected by frontend interceptor)
- Backend `ClinicScopeGuard` validates membership; all queries must filter by `clinic_id`
- **Never return cross-clinic data** — always scope queries to the authenticated clinic

### Database Migrations
`synchronize: false` is enforced. Schema changes require a migration:
1. Modify entity → generate migration → review SQL → `migration:run` → commit file
2. Migration files live in `backend/src/migrations/`
3. Data source config: `backend/src/config/data-source.ts`

## Frontend Architecture (Angular 18)

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

Active routing module: `app-routing.module.ts` (not `app.routes.ts` which is a skeleton for future migration).

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

### Two Auth Services (known tech debt)
- `modules/auth/services/auth.service.ts` — **real** auth service (use this)
- `core/services/auth.service.ts` — dev-only role simulator (pending deletion)

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

## Default Dev Credentials

Created by seeds: `doctor@example.com` / `Abc123` (roles: SUPER_ADMIN, ADMIN, USER)

## Additional Docs

- `docs/GUIA-DISENO-UI.md` — UI design system details
- `docs/DEPLOY-DOKPLOY-NET-INTERNA.md` — production deployment (Traefik, Dokploy)
- `GODMODE-SETUP.md` — initial SUPER_ADMIN bootstrap for production
- `frontend/FORMULARIOS-README.md` — reactive forms patterns
