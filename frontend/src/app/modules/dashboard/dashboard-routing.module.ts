import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component';
import { authGuard } from '../auth/guards';
import { PlaceholderComponent } from '../../shared/components/placeholder/placeholder.component';

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
        path: 'pharmacy-inventory',
        component: PlaceholderComponent,
      },
      {
        path: 'pharmacy-orders',
        component: PlaceholderComponent,
      },
      {
        path: 'pharmacy-sales',
        component: PlaceholderComponent,
      },
      {
        path: 'pharmacy-billing',
        component: PlaceholderComponent,
      },
      // Rutas de reportes
      {
        path: 'medical-reports',
        component: PlaceholderComponent,
      },
      {
        path: 'financial-reports',
        component: PlaceholderComponent,
      },
      {
        path: 'stock-control',
        component: PlaceholderComponent,
      },
      // Rutas de activos
      {
        path: 'asset-registry',
        component: PlaceholderComponent,
      },
      {
        path: 'asset-maintenance',
        component: PlaceholderComponent,
      },
      {
        path: 'asset-inventory',
        component: PlaceholderComponent,
      },
      {
        path: 'asset-reports',
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
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
