# Bartolomed — Sistema de Gestión Clínica

![Estado](https://img.shields.io/badge/estado-producción-22c55e?style=flat-square)
![Licencia](https://img.shields.io/badge/licencia-privada-64748b?style=flat-square)
![Angular](https://img.shields.io/badge/Angular-19-dd0031?style=flat-square&logo=angular)
![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?style=flat-square&logo=nestjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)
![TypeORM](https://img.shields.io/badge/TypeORM-0.3-fe0902?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker)

Sistema web multi-clínica y multi-rol para la gestión integral de centros de salud. Cubre el ciclo completo: pacientes, citas, historial clínico, farmacia, facturación, activos e inventario.

---

## Módulos

| Módulo | Descripción | Roles con acceso |
|--------|-------------|------------------|
| **Pacientes** | Registro, búsqueda y ficha clínica completa | Doctor, Nurse, Receptionist, Admin |
| **Citas** | Agenda diaria, estados y seguimiento | Doctor, Nurse, Receptionist, Admin |
| **Historial Médico** | Consultas, diagnósticos, evoluciones | Doctor, Nurse |
| **Prescripciones** | Recetas digitales vinculadas a consulta | Doctor |
| **Farmacia** | Inventario, ventas, vencimientos, stock | Pharmacist, Admin |
| **Facturación** | Facturas, pagos, reportes financieros | Admin, Receptionist |
| **Activos** | Control de equipos y bienes clínicos | Admin |
| **Traslados** | Transferencia de activos entre clínicas | Admin |
| **Reportes** | PDFs, Excel, gráficos de rentabilidad | Admin, Doctor, Pharmacist |
| **Auditoría** | Log de acciones, estadísticas de uso | Admin, Super Admin |
| **Usuarios** | Registro, roles y permisos granulares | Admin, Super Admin |
| **Parámetros** | Config SMTP, integraciones del sistema | Super Admin |

---

## Stack Tecnológico

### Backend
![NestJS](https://img.shields.io/badge/-NestJS_11-e0234e?style=flat-square&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![TypeORM](https://img.shields.io/badge/-TypeORM_0.3-fe0902?style=flat-square)
![JWT](https://img.shields.io/badge/-JWT_Auth-000000?style=flat-square&logo=jsonwebtokens)
![Swagger](https://img.shields.io/badge/-Swagger_UI-85ea2d?style=flat-square&logo=swagger&logoColor=black)
![Nodemailer](https://img.shields.io/badge/-Nodemailer-22b8cf?style=flat-square)

### Frontend
![Angular](https://img.shields.io/badge/-Angular_19-dd0031?style=flat-square&logo=angular&logoColor=white)
![Angular Material](https://img.shields.io/badge/-Angular_Material-757575?style=flat-square&logo=material-design)
![TailwindCSS](https://img.shields.io/badge/-Tailwind_CSS-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)
![Chart.js](https://img.shields.io/badge/-Chart.js-ff6384?style=flat-square&logo=chartdotjs&logoColor=white)
![RxJS](https://img.shields.io/badge/-RxJS_7-b7178c?style=flat-square&logo=reactivex&logoColor=white)

### Base de datos e infraestructura
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL_16-336791?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker_Compose-2496ed?style=flat-square&logo=docker&logoColor=white)
![Traefik](https://img.shields.io/badge/-Traefik-24a1c1?style=flat-square&logo=traefikproxy&logoColor=white)

---

## Arquitectura

```
app-bartolomed/
├── backend/          # API REST — NestJS + TypeORM
│   ├── src/
│   │   ├── auth/         # JWT, guards, decoradores
│   │   ├── users/        # Gestión de usuarios y roles
│   │   ├── patients/     # Módulo de pacientes
│   │   ├── appointments/ # Citas y agenda
│   │   ├── pharmacy/     # Farmacia e inventario
│   │   ├── billing/      # Facturación
│   │   ├── reports/      # PDFs y Excel
│   │   ├── audit/        # Auditoría de acciones
│   │   ├── mail/         # SMTP configurable
│   │   └── migrations/   # Migraciones TypeORM
├── frontend/         # SPA — Angular 19
│   └── src/app/
│       ├── modules/dashboard/pages/  # Páginas por módulo
│       ├── core/                     # Guards, interceptores
│       └── shared/                   # Componentes reutilizables
├── docs/             # Documentación técnica y de cliente
└── docker-compose.yml
```

**Multi-tenancy:** cada clínica es un tenant aislado. El header `X-Clinic-Id` fluye automáticamente desde el frontend y el guard `ClinicScopeGuard` valida membresía en cada petición.

**Autenticación:** JWT de acceso (2h) + refresh token (15d). Guardia de orden: `JwtAuthGuard → UserRoleGuard → PermissionsGuard → ClinicScopeGuard`.

---

## Roles

| Rol | Descripción |
|-----|-------------|
| `SUPER_ADMIN` | Acceso total al sistema, gestión de clínicas |
| `ADMIN` | Administración de clínica: usuarios, reportes, config |
| `DOCTOR` | Pacientes, citas, historial, prescripciones |
| `NURSE` | Pacientes, citas, historial (lectura/escritura limitada) |
| `RECEPTIONIST` | Agenda, registro de pacientes, facturación |
| `PHARMACIST` | Farmacia, ventas, inventario, reportes de farmacia |

---

## Inicio rápido (desarrollo)

Los servicios corren en contenedores y se recargan automáticamente al editar código.

```bash
# Levantar todo
podman compose up -d

# Aplicar migraciones
podman compose exec backend npm run migration:run

# Poblar datos demo
podman compose exec backend npm run seed:all
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:4200 |
| API REST | http://localhost:3000/api |
| Swagger | http://localhost:3000/api/docs |
| Health   | http://localhost:3000/api/health |

**Credenciales demo:** `doctor@example.com` / `Abc123`

---

## Variables de entorno (backend)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Conexión PostgreSQL | Sí |
| `JWT_SECRET` | Clave JWT access token | Sí |
| `JWT_REFRESH_SECRET` | Clave JWT refresh token | Sí |
| `GOD_MODE_TOKEN` | Token para bootstrap de Super Admin | Sí (inicial) |
| `FRONTEND_URL` | URL del frontend (links en emails) | Sí |
| `NODE_ENV` | `development` / `production` | Sí |

La configuración SMTP se gestiona desde la interfaz en **Sistema → Parámetros**, no requiere reinicio.

---

## Producción

Desplegado en [bartolomed.tecnocondor.dev](https://bartolomed.tecnocondor.dev) via **Dokploy + Traefik** con SSL automático.

Ver guías detalladas:
- [`docs/DEPLOY-DOKPLOY-NET-INTERNA.md`](docs/DEPLOY-DOKPLOY-NET-INTERNA.md) — despliegue con Traefik
- [`GODMODE-SETUP.md`](GODMODE-SETUP.md) — bootstrap inicial de Super Admin
- [`CREAR-SUPERADMIN.txt`](CREAR-SUPERADMIN.txt) — instrucciones para Windows

---

## Scripts de utilidad

```bash
# Crear Super Admin (Linux)
bash create-superadmin.sh

# Crear Super Admin (Windows — PowerShell)
.\create-superadmin.ps1

# Ver logs en tiempo real
podman compose logs -f backend
podman compose logs -f frontend
```

---

## Comandos frecuentes

```bash
# Backend
cd backend
npm test                    # Tests unitarios
npm run test:e2e            # Tests E2E
npm run lint                # Lint con fix
npm run build               # Compilar TypeScript

# Frontend
cd frontend
npm test                    # Karma/Jasmine
npm run lint
npm run build               # Build producción

# Migraciones (dentro del contenedor)
podman compose exec backend npm run migration:generate -- -n NombreMigracion
podman compose exec backend npm run migration:run
podman compose exec backend npm run migration:revert
```

---

<div align="center">
  <sub>Desarrollado para <strong>Bartolomed</strong> · Sistema privado — todos los derechos reservados</sub>
</div>
