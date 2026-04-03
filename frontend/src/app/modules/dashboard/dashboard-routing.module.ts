import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { permissionsGuard } from '@core/guards/permissions.guard'
import { roleGuard } from '@core/guards/role.guard'
import { rolesSyncGuard } from '@core/guards/roles-sync.guard'

import { authGuard } from '../auth/guards'
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component'
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component'
import { RolesManagementComponent } from './pages/admin/roles/roles-management/roles-management.component'

const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, rolesSyncGuard],
    children: [
      {
        path: 'home',
        component: MainDashboardComponent,
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.PHARMACIST,
            UserRoles.NURSE,
            UserRoles.DOCTOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [],
        },
      },
      {
        path: 'users',
        loadChildren: () => import('./pages/admin/users/users.module').then(m => m.UsersModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.UsersManage],
        },
      },
      {
        path: 'patients',
        loadChildren: () => import('./pages/patients/patients.module').then(m => m.PatientsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.NURSE,
            UserRoles.DOCTOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [Permission.PatientsRead],
        },
      },
      // Rutas médicas
      {
        path: 'medical-records',
        loadChildren: () =>
          import('./pages/medical-records/medical-records.module').then(
            m => m.MedicalRecordsModule,
          ),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.RecordsRead],
        },
      },
      {
        path: 'appointments',
        loadChildren: () =>
          import('./pages/appointments/appointments.module').then(m => m.AppointmentsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.DOCTOR,
            UserRoles.NURSE,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [Permission.AppointmentsRead],
        },
      },
      {
        path: 'prescriptions',
        loadChildren: () =>
          import('./pages/prescriptions/prescriptions.module').then(m => m.PrescriptionsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.PHARMACIST,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [Permission.PrescriptionsRead],
        },
      },
      {
        path: 'billing',
        loadChildren: () => import('./pages/billing/billing.module').then(m => m.BillingModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.BillingRead],
        },
      },
      // Rutas de farmacia
      {
        path: 'pharmacy',
        loadChildren: () => import('./pages/pharmacy/pharmacy.module').then(m => m.PharmacyModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.PHARMACIST,
            UserRoles.DOCTOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [Permission.PharmacyInventoryManage],
        },
      },
      // Rutas legacy de farmacia (redirect a nuevas rutas)
      {
        path: 'pharmacy-inventory',
        redirectTo: 'pharmacy/inventory',
        pathMatch: 'full',
      },
      {
        path: 'pharmacy-orders',
        redirectTo: 'pharmacy/order-generation',
        pathMatch: 'full',
      },
      {
        path: 'pharmacy-sales',
        redirectTo: 'pharmacy/sales-dispensing',
        pathMatch: 'full',
      },
      {
        path: 'pharmacy-billing',
        redirectTo: 'pharmacy/invoicing',
        pathMatch: 'full',
      },
      // Rutas de reportes
      {
        path: 'reports',
        loadChildren: () => import('./pages/reports/reports.module').then(m => m.ReportsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.PHARMACIST,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [
            Permission.ReportsMedical,
            Permission.ReportsFinancial,
            Permission.ReportsStock,
          ],
        },
      },
      // Rutas legacy de reportes (redirect a nuevas rutas)
      {
        path: 'medical-reports',
        redirectTo: 'reports/medical-reports',
        pathMatch: 'full',
      },
      {
        path: 'financial-reports',
        redirectTo: 'reports/financial-reports',
        pathMatch: 'full',
      },
      {
        path: 'stock-control',
        redirectTo: 'reports/stock-control',
        pathMatch: 'full',
      },
      // Rutas de activos
      {
        path: 'assets-control',
        loadChildren: () =>
          import('./pages/assets-control/assets-control.module').then(m => m.AssetsControlModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.AssetsManage],
        },
      },
      // Rutas legacy de activos (redirect a nuevas rutas)
      {
        path: 'asset-registry',
        redirectTo: 'assets-control/registration',
        pathMatch: 'full',
      },
      {
        path: 'asset-maintenance',
        redirectTo: 'assets-control/maintenance',
        pathMatch: 'full',
      },
      {
        path: 'asset-inventory',
        redirectTo: 'assets-control/inventory',
        pathMatch: 'full',
      },
      {
        path: 'asset-reports',
        redirectTo: 'assets-control/reports',
        pathMatch: 'full',
      },
      // Rutas para funcionalidades administrativas
      {
        path: 'config',
        loadChildren: () => import('./pages/admin/config/config.module').then(m => m.ConfigModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: 'audit',
        loadChildren: () => import('./pages/admin/audit/audit.module').then(m => m.AuditModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.AuditRead],
        },
      },
      {
        path: 'backup',
        loadChildren: () => import('./pages/admin/backup/backup.module').then(m => m.BackupModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.BackupManage],
        },
      },
      {
        path: 'clinics',
        loadChildren: () => import('./pages/admin/clinics/clinics.module').then(m => m.ClinicsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.ClinicsManage],
        },
      },
      {
        path: 'roles',
        component: RolesManagementComponent,
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.RolesManage],
        },
      },
      {
        path: 'system-params',
        loadChildren: () =>
          import('./pages/system-params/system-params.module').then(m => m.SystemParamsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: 'notifications-config',
        loadChildren: () =>
          import('./pages/notifications-config/notifications-config.module').then(
            m => m.NotificationsConfigModule,
          ),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: 'document-templates',
        loadChildren: () =>
          import('./pages/document-templates/document-templates.module').then(
            m => m.DocumentTemplatesModule,
          ),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: 'api-integration',
        loadChildren: () =>
          import('./pages/api-integration/api-integration.module').then(
            m => m.ApiIntegrationModule,
          ),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
