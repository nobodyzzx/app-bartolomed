import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { SPECIAL_STUDY_ROLES } from '@core/constants/role-groups'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { permissionsGuard } from '@core/guards/permissions.guard'
import { roleGuard } from '@core/guards/role.guard'
import { rolesSyncGuard } from '@core/guards/roles-sync.guard'

import { authGuard } from '../auth/guards'
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component'
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component'

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
          // Todos los roles entran al mismo dashboard; lo que cambia es qué
          // secciones ve cada uno. Dejar fuera a LABORATORY hacía que el
          // roleGuard lo rechazara aquí y, al no haber a dónde mandarlo,
          // cerrara su sesión: podía autenticarse pero no usar el sistema.
          allowedRoles: [
            UserRoles.RECEPTIONIST,
            UserRoles.PHARMACIST,
            UserRoles.NURSE,
            UserRoles.DOCTOR,
            UserRoles.LABORATORY,
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
        path: 'laboratory',
        loadChildren: () =>
          import('./pages/laboratory/laboratory.module').then(m => m.LaboratoryModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          // RECEPTIONIST entra por `LabOrderExternal`: el particular que se paga un
          // examen sin consulta previa se registra y se cobra en ventanilla, y el
          // backend nombra al rol explícitamente en `POST /lab-orders/external`.
          // Faltaba acá y en el menú, así que el permiso no habilitaba nada: el
          // roleGuard lo rechazaba antes de llegar al permissionsGuard. La pantalla
          // ya distingue qué puede hacer cada rol (`canOrderExternal()`), de modo
          // que recepción ve las órdenes y solo puede registrar la externa.
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.NURSE,
            UserRoles.LABORATORY,
            UserRoles.RECEPTIONIST,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ],
          requiredPermissions: [Permission.LabRead],
        },
      },
      {
        // Módulo aparte del laboratorio, con su propio rol y sus propios
        // permisos: quien realiza una ecografía no tiene por qué ver los
        // análisis clínicos del paciente.
        path: 'special-studies',
        loadChildren: () =>
          import('./pages/special-studies/special-studies.module').then(m => m.SpecialStudiesModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: SPECIAL_STUDY_ROLES,
          requiredPermissions: [Permission.SpecialRead],
        },
      },
      {
        path: 'checkout',
        loadChildren: () => import('./pages/checkout/checkout.module').then(m => m.CheckoutModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.BillingManage],
        },
      },
      {
        // Recepción entra para consultar precios al cobrar; solo ADMIN puede
        // modificarlos (el backend exige SettingsManage para escribir).
        path: 'service-prices',
        loadChildren: () =>
          import('./pages/service-prices/service-prices.module').then(m => m.ServicePricesModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
          requiredPermissions: [Permission.BillingRead],
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
          // Sin DOCTOR: no tiene `PharmacyInventoryManage`, así que el roleGuard lo
          // dejaba pasar y el permissionsGuard lo rebotaba a home con el banner de
          // permiso insuficiente. Ninguna ruta hija de farmacia lo lista, ni el menú
          // tampoco — era el único sitio que lo mencionaba, y no abría nada.
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
        redirectTo: 'pharmacy/purchase-orders',
        pathMatch: 'full',
      },
      {
        path: 'pharmacy-sales',
        redirectTo: 'pharmacy/sales-dispensing',
        pathMatch: 'full',
      },
      {
        path: 'pharmacy-billing',
        redirectTo: 'pharmacy/sales-dispensing',
        pathMatch: 'full',
      },
      // Rutas de reportes
      {
        path: 'reports',
        loadChildren: () => import('./pages/reports/reports.module').then(m => m.ReportsModule),
        canActivate: [permissionsGuard, roleGuard],
        data: {
          // NURSE tiene Permission.ReportsMedical (ve solo la sección médica —
          // reports.component.ts gatea cada sección por permiso) pero faltaba
          // aquí — el permiso backend no habilitaba nada real porque roleGuard
          // bloqueaba antes de llegar a permissionsGuard (bug real, auditoría
          // de interrelación de módulos, 2026-08-04).
          allowedRoles: [
            UserRoles.DOCTOR,
            UserRoles.NURSE,
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
      // Rutas legacy de reportes (redirect a la página unificada de Reportes —
      // medical-reports/financial-reports/stock-control eran componentes
      // huérfanos con datos mock, nunca declarados en ningún módulo; sus
      // rutas hijas nunca existieron, 404 real).
      {
        path: 'medical-reports',
        redirectTo: 'reports',
        pathMatch: 'full',
      },
      {
        path: 'financial-reports',
        redirectTo: 'reports',
        pathMatch: 'full',
      },
      {
        path: 'stock-control',
        redirectTo: 'reports',
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
        redirectTo: 'assets-control/inventory',
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
        redirectTo: 'reports',
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
        path: 'profile',
        loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfileModule),
        canActivate: [authGuard],
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
