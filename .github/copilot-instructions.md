# GitHub Copilot Instructions - Bartolomed Medical System

## Project Overview

Full-stack medical management system with Angular 18 (frontend), NestJS 10 (backend), PostgreSQL database. Runs continuously in containers during development—**no need to start/stop services manually**.

## Container Runtime

**Supports both Docker and Podman**:

- **Podman** (rootless, typically on Fedora/RHEL): Use `podman-compose` or `podman compose`
- **Docker** (Windows/Mac/Linux): Use `docker compose`
- Commands are interchangeable: replace `docker` with `podman` as needed
- Both use the same `docker-compose.yml` and `.env` configuration

## Critical Development Patterns

### 🔄 Development Workflow

- **Project runs in containers**: After code changes, just refresh browser—services auto-reload
- **Never run**: `npm start`, `docker-compose up`, or similar start commands (containers are already running)
- **To verify**: Check browser results or container logs:
  - Docker: `docker compose logs -f backend`
  - Podman: `podman-compose logs -f backend` or `podman compose logs -f backend`
- **Environment**: `.env` file at project root provides all config variables

### 🏗️ Backend Architecture (NestJS + TypeORM)

**Module Structure Pattern**:

```typescript
// Feature modules follow this structure:
@Module({
  imports: [
    TypeOrmModule.forFeature([EntityA, EntityB, RelatedEntity]),
    AuthModule, // Required for @Auth() decorator
    OtherFeatureModule // Import related features
  ],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [TypeOrmModule, FeatureService]
})
```

**Authentication & Authorization**:

- Use `@Auth(...roles)` decorator from `auth/decorators` (combines JWT guard + role guard)
- Valid roles: `ValidRoles.SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `NURSE`, `PHARMACIST`, `RECEPTIONIST`
- Extract current user: `@GetUser() user: User` decorator
- Example:
  ```typescript
  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  create(@Body() dto: CreateDto, @GetUser() user: User) {
    return this.service.create(dto, user);
  }
  ```

**Entity Registration**:

- Add ALL entities to `app.module.ts` entities array (even with `autoLoadEntities: true`)
- Always export TypeOrmModule from feature modules for entity reuse

**Database Seeds**:

- Default user created in `main.ts`: `doctor@example.com` / `Abc123` (super_user, admin, user roles)
- Use for local testing and development

### 🎨 Frontend Architecture (Angular 18)

**Module Pattern - Lazy Loading**:

```typescript
// Dashboard routes use lazy loading:
{
  path: 'feature-name',
  loadChildren: () => import('./pages/feature/feature.module').then(m => m.FeatureModule),
  canActivate: [permissionsGuard, roleGuard],
  data: {
    allowedRoles: [UserRoles.DOCTOR, UserRoles.ADMIN],
    requiredPermissions: [Permission.FeatureRead]
  }
}
```

**Feature Module Structure**:

```typescript
// Standard feature module setup:
@NgModule({
  declarations: [PageComponent, ListComponent, FormComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule, // Centralized Material imports
    HttpClientModule,
    RouterModule.forChild(routes)
  ]
})
```

**HTTP Service Pattern**:

```typescript
// Services use centralized error handling:
constructor(
  private http: HttpClient,
  private errorService: ErrorService,
  private alertService: AlertService
) {}

create(payload: CreateDto): Observable<Entity> {
  return this.http.post<Entity>(`${environment.baseUrl}/endpoint`, payload)
    .pipe(
      tap(() => this.alertService.success('Éxito', 'Registro creado')),
      catchError(this.errorService.handleError)
    );
}
```

**HTTP Interceptors** (registered in `app.module.ts`):

- `AuthInterceptor`: Auto-injects JWT token, handles 401 with silent refresh
- `ClinicContextInterceptor`: Adds `X-Clinic-Id` header from clinic context service

### 🎨 UI Design System (See `docs/GUIA-DISENO-UI.md`)

**Iconography**:

- **Prefer**: Material Symbols Outlined with ligatures: `<span class="material-symbols-outlined">icon_name</span>`
- **Keep `<mat-icon>`**: Only inside Material components (`mat-form-field`, `mat-chip`, `mat-icon-button`)

**Alert Service (SweetAlert2)**:

```typescript
// Centralized alerts with custom Tailwind styling:
const result = await this.alert.fire({
  icon: 'question',
  title: '¿Confirmar acción?',
  text: 'Descripción detallada',
  showCancelButton: true,
  confirmButtonText: 'Confirmar',
  cancelButtonText: 'Cancelar',
});
if (result.isConfirmed) {
  /* action */
}
```

**Page Layout Pattern**:

```html
<!-- Standard page structure -->
<div class="min-h-screen bg-slate-50">
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header: back button + title -->
    <header class="mb-6 flex items-center gap-4">
      <button
        (click)="goBack()"
        class="w-9 h-9 rounded-full hover:bg-slate-100"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 class="text-3xl font-bold text-slate-900">Page Title</h1>
    </header>

    <!-- Content: cards, tables, forms -->
    <div class="grid gap-6">...</div>
  </div>
</div>
```

**Material Module Import**:

- Use `MaterialModule` from `app/material/material.module.ts` (centralized Material imports)
- Avoid importing individual Material modules in feature modules

### 🔐 Security & Authentication

**Godmode Bootstrap** (Production Setup):

- Special endpoint: `POST /api/auth/godmode/super-admin` with `x-god-token` header
- Creates/promotes SUPER_ADMIN without authentication
- **Security**: Delete `GOD_MODE_TOKEN` env var after initial setup
- Details: See `GODMODE-SETUP.md`

**Role-Based Access**:

- Frontend guards: `roleGuard`, `permissionsGuard` in routing `data`
- Backend decorators: `@Auth(...roles)` on controller methods
- Clinic context: Multi-tenant via `X-Clinic-Id` header (auto-injected by interceptor)

### 🧪 Testing Conventions

**Backend Tests**:

- Unit tests: `*.spec.ts` files in same directory as source
- E2E tests: `test/*.e2e-spec.ts` with supertest
- Run: `npm test` (unit) or `npm run test:e2e` (integration)

**Frontend Tests**:

- Basic module specs: `*.spec.ts` with TestBed
- Minimal smoke tests ensure modules compile
- Run: `npm test` in frontend directory

### 🚀 Deployment Notes

**Container Orchestration**:

- `docker-compose.yml` / `podman-compose`: Local development (ports exposed)
- `docker-compose.dokploy.yml`: Production with Traefik (internal network, no exposed ports)
- Environment file: `.env` (dev) or `.env.production`
- Works identically with Docker or Podman

**Production Architecture**:

- Frontend served by Node `serve` on internal port 4200
- Backend on internal port 3000, API prefix `/api`
- Traefik routes same domain: frontend on `/`, backend on `/api/*`
- CORS: Backend allows same origin, credentials enabled
- Details: `docs/DEPLOY-DOKPLOY-NET-INTERNA.md`

### 📂 Key Directory Patterns

**Backend** (`backend/src/`):

- `{feature}/{feature}.module.ts` - Feature module
- `{feature}/{feature}.controller.ts` - REST endpoints
- `{feature}/{feature}.service.ts` - Business logic
- `{feature}/entities/*.entity.ts` - TypeORM entities
- `{feature}/dto/*.dto.ts` - Data transfer objects
- `auth/decorators/` - Custom decorators (`@Auth`, `@GetUser`)

**Frontend** (`frontend/src/app/`):

- `modules/dashboard/pages/{feature}/` - Lazy-loaded feature modules
- `core/services/` - Singleton services (auth, alert, error handling)
- `shared/` - Reusable components/directives
- `material/material.module.ts` - Centralized Material Design imports
- `environments/` - Environment configs (`baseUrl = 'http://localhost:3000/api'` for dev)

### ⚡ Quick Reference Commands

**Never needed during development** (containers auto-run):

- ❌ `npm start`, `ng serve`, `nest start`
- ❌ `docker-compose up` / `podman-compose up`

**Useful when troubleshooting**:

```bash
# View backend logs (Docker)
docker compose logs -f backend

# View backend logs (Podman)
podman-compose logs -f backend
# or
podman compose logs -f backend

# View frontend logs
docker compose logs -f frontend    # Docker
podman-compose logs -f frontend    # Podman

# Restart specific service if needed
docker compose restart backend     # Docker
podman-compose restart backend     # Podman

# Run backend tests (outside containers)
cd backend && npm test

# Check database health
curl http://localhost:3000/api/health
```

### 🔍 Common Gotchas

1. **Entity not found**: Ensure entity is registered in `app.module.ts` entities array
2. **Circular dependency**: Don't import full modules in entities/DTOs; use `forwardRef()` or extract interfaces
3. **Material icon not found**: Check if component needs `<mat-icon>` (Material context) vs `<span class="material-symbols-outlined">` (standalone)
4. **401 on API calls**: Verify `AuthInterceptor` is registered and token exists in localStorage/sessionStorage
5. **CORS errors**: Backend CORS configured for `localhost:4200` (dev) and same-origin (prod via Traefik)
6. **Clinic context missing**: Some endpoints require `X-Clinic-Id` header (auto-added by `ClinicContextInterceptor`)

### 📚 Additional Documentation

- UI Design Guidelines: `docs/GUIA-DISENO-UI.md`
- User Registration with Clinics: `docs/REGISTRO-USUARIOS-CON-CLINICA.md`
- Production Deployment: `docs/DEPLOY-DOKPLOY-NET-INTERNA.md`
- Godmode Setup: `GODMODE-SETUP.md`
- Forms Guide: `frontend/FORMULARIOS-README.md`

---

**Philosophy**: Consistency over personal preference. Follow established patterns for module structure, authentication, UI components, and error handling. The project is designed to run continuously—focus on code changes and browser verification, not service lifecycle management.
