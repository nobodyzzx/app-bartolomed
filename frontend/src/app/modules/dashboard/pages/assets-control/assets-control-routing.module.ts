import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component';
import { AssetMaintenanceComponent } from './asset-maintenance/asset-maintenance.component';
import { AssetRegistrationComponent } from './asset-registration/asset-registration.component';
import { AssetReportsComponent } from './asset-reports/asset-reports.component';
import { AssetsControlComponent } from './assets-control.component';

const routes: Routes = [
  {
    path: '',
    component: AssetsControlComponent,
    children: [
      {
        path: '',
        redirectTo: 'registration',
        pathMatch: 'full'
      },
      {
        path: 'registration',
        component: AssetRegistrationComponent,
        data: { title: 'Registro de Activos' }
      },
      {
        path: 'maintenance',
        component: AssetMaintenanceComponent,
        data: { title: 'Mantenimiento de Activos' }
      },
      {
        path: 'inventory',
        component: AssetInventoryControlComponent,
        data: { title: 'Control de Inventario' }
      },
      {
        path: 'reports',
        component: AssetReportsComponent,
        data: { title: 'Reportes de Activos' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AssetsControlRoutingModule { }
