import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PlaceholderComponent } from '../../shared/components/placeholder/placeholder.component';
import { authGuard } from '../auth/guards';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
     children: [
      {
        path: 'home',
        component: MainDashboardComponent,
      },
      {
        path: 'users',
        loadChildren: () =>
          import('./pages/users/users.module').then((m) => m.UsersModule),
      },
      {
        path: 'patients',
        loadChildren: () =>
          import('./pages/patients/patients.module').then((m) => m.PatientsModule),
      },
      // Rutas médicas
      {
        path: 'medical-records',
        loadChildren: () =>
          import('./pages/medical-records/medical-records.module').then((m) => m.MedicalRecordsModule),
      },
      {
        path: 'appointments',
        component: PlaceholderComponent,
      },
      {
        path: 'prescriptions',
        component: PlaceholderComponent,
      },
      {
        path: 'billing',
        component: PlaceholderComponent,
      },
      // Rutas de farmacia
      {
        path: 'pharmacy',
        loadChildren: () =>
          import('./pages/pharmacy/pharmacy.module').then((m) => m.PharmacyModule),
      },
      // Rutas legacy de farmacia (redirect a nuevas rutas)
      {
        path: 'pharmacy-inventory',
        redirectTo: 'pharmacy/inventory',
        pathMatch: 'full'
      },
      {
        path: 'pharmacy-orders',
        redirectTo: 'pharmacy/order-generation',
        pathMatch: 'full'
      },
      {
        path: 'pharmacy-sales',
        redirectTo: 'pharmacy/sales-dispensing',
        pathMatch: 'full'
      },
      {
        path: 'pharmacy-billing',
        redirectTo: 'pharmacy/invoicing',
        pathMatch: 'full'
      },
      // Rutas de reportes
      {
        path: 'reports',
        loadChildren: () =>
          import('./pages/reports/reports.module').then((m) => m.ReportsModule),
      },
      // Rutas legacy de reportes (redirect a nuevas rutas)
      {
        path: 'medical-reports',
        redirectTo: 'reports/medical-reports',
        pathMatch: 'full'
      },
      {
        path: 'financial-reports',
        redirectTo: 'reports/financial-reports',
        pathMatch: 'full'
      },
      {
        path: 'stock-control',
        redirectTo: 'reports/stock-control',
        pathMatch: 'full'
      },
      // Rutas de activos
      {
        path: 'assets-control',
        loadChildren: () =>
          import('./pages/assets-control/assets-control.module').then((m) => m.AssetsControlModule),
      },
      // Rutas legacy de activos (redirect a nuevas rutas)
      {
        path: 'asset-registry',
        redirectTo: 'assets-control/registration',
        pathMatch: 'full'
      },
      {
        path: 'asset-maintenance',
        redirectTo: 'assets-control/maintenance',
        pathMatch: 'full'
      },
      {
        path: 'asset-inventory',
        redirectTo: 'assets-control/inventory',
        pathMatch: 'full'
      },
      {
        path: 'asset-reports',
        redirectTo: 'assets-control/reports',
        pathMatch: 'full'
      },
      // Rutas para funcionalidades administrativas
      {
        path: 'config',
        component: PlaceholderComponent,
      },
      {
        path: 'audit',
        component: PlaceholderComponent,
      },
      {
        path: 'backup',
        component: PlaceholderComponent,
      },
      {
        path: 'clinics',
        loadChildren: () =>
          import('./pages/clinics/clinics.module').then((m) => m.ClinicsModule),
      },
      {
        path: 'system-params',
        component: PlaceholderComponent,
      },
      {
        path: 'notifications-config',
        component: PlaceholderComponent,
      },
      {
        path: 'document-templates',
        component: PlaceholderComponent,
      },
      {
        path: 'api-integration',
        component: PlaceholderComponent,
      },
      {
        path: 'roles',
        component: PlaceholderComponent,
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
