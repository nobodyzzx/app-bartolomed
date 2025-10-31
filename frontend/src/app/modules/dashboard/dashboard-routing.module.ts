import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { permissionsGuard } from '@core/guards/permissions.guard'
import { roleGuard } from '@core/guards/role.guard'
import { rolesSyncGuard } from '@core/guards/roles-sync.guard'

import { PlaceholderComponent } from '../../shared/components/placeholder/placeholder.component'
import { authGuard } from '../auth/guards'
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component'
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component'
import { RolesManagementComponent } from './pages/roles/roles-management/roles-management.component'

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
        loadChildren: () => import('./pages/users/users.module').then(m => m.UsersModule),
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
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
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
          allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
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
        component: PlaceholderComponent,
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.SettingsManage],
        },
      },
      {
        path: 'audit',
        component: PlaceholderComponent,
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.AuditRead],
        },
      },
      {
        path: 'backup',
        component: PlaceholderComponent,
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.BackupManage],
        },
      },
      {
        path: 'clinics',
        loadChildren: () => import('./pages/clinics/clinics.module').then(m => m.ClinicsModule),
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
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN] },
      },
      {
        path: 'notifications-config',
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN] },
      },
      {
        path: 'document-templates',
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN] },
      },
      {
        path: 'api-integration',
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN] },
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
