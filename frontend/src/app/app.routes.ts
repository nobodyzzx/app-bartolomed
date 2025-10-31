// @ts-nocheck
import { Routes } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum' // Importar
import { authGuard } from '@core/guards/auth.guard'
import { roleGuard } from '@core/guards/role.guard' // Importar

export const routes: Routes = [
  // Rutas de autenticación
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  // Rutas del Dashboard (Protegidas por autenticación)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/dashboard-layout/dashboard-layout.component').then(
        m => m.DashboardLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.PHARMACIST,
            UserRoles.NURSE,
            UserRoles.DOCTOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
        },
      },
      // --- Gestión del Consultorio ---
      {
        path: 'patients',
        loadComponent: () =>
          import('./pages/patients/patients.component').then(m => m.PatientsComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.NURSE,
            UserRoles.DOCTOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
        },
      },
      {
        path: 'medical-records',
        loadComponent: () =>
          import('./pages/medical-records/medical-records.component').then(
            m => m.MedicalRecordsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./pages/appointments/appointments.component').then(m => m.AppointmentsComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.DOCTOR,
            UserRoles.NURSE,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
        },
      },
      {
        path: 'prescriptions',
        loadComponent: () =>
          import('./pages/prescriptions/prescriptions.component').then(
            m => m.PrescriptionsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.PHARMACIST,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
        },
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./pages/billing/billing.component').then(m => m.BillingComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },

      // --- Control de Farmacia ---
      {
        path: 'pharmacy',
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
        loadChildren: () => import('./pages/pharmacy/pharmacy.routes').then(m => m.PHARMACY_ROUTES),
      },

      // --- Reportes ---
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: {
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.PHARMACIST,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
        },
        loadChildren: () => import('./pages/reports/reports.routes').then(m => m.REPORTS_ROUTES),
      },

      // --- Control de Activos ---
      {
        path: 'assets-control',
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
        loadChildren: () =>
          import('./pages/assets-control/assets-control.routes').then(m => m.ASSETS_CONTROL_ROUTES),
      },

      // --- Tareas Administrativas ---
      {
        path: 'users',
        loadChildren: () => import('./pages/admin/users/users.routes').then(m => m.USERS_ROUTES),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./pages/admin/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./pages/admin/config/config.component').then(m => m.ConfigComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./pages/admin/audit/audit.component').then(m => m.AuditComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'backup',
        loadComponent: () =>
          import('./pages/admin/backup/backup.component').then(m => m.BackupComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'clinics',
        loadChildren: () =>
          import('./pages/admin/clinics/clinics.routes').then(m => m.CLINICS_ROUTES),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.SUPER_ADMIN],
        },
      },

      // --- Configuración Avanzada ---
      {
        path: 'system-params',
        loadComponent: () =>
          import('./pages/advanced-config/system-params/system-params.component').then(
            m => m.SystemParamsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'notifications-config',
        loadComponent: () =>
          import(
            './pages/advanced-config/notifications-config/notifications-config.component'
          ).then(m => m.NotificationsConfigComponent),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'document-templates',
        loadComponent: () =>
          import('./pages/advanced-config/document-templates/document-templates.component').then(
            m => m.DocumentTemplatesComponent,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
      {
        path: 'api-integration',
        loadComponent: () =>
          import('./pages/advanced-config/api-integration/api-integration.component').then(
            m => m.ApiIntegrationComponent,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        },
      },
    ],
  },
  // Redirección por defecto
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }, // Manejo de rutas no encontradas
]
