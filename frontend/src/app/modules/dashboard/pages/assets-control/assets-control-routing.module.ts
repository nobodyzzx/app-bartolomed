import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component'
import { AssetMaintenanceComponent } from './asset-maintenance/asset-maintenance.component'
import { AssetReportsComponent } from './asset-reports/asset-reports.component'
import { AssetTransfersComponent } from './asset-transfers/asset-transfers.component'
import { AssetsFormComponent } from './assets-form/assets-form.component'

const routes: Routes = [
  {
    path: '',
    redirectTo: 'inventory',
    pathMatch: 'full',
  },
  {
    path: 'inventory',
    component: AssetInventoryControlComponent,
  },
  {
    path: 'inventory/new',
    component: AssetsFormComponent,
  },
  {
    path: 'inventory/edit/:id',
    component: AssetsFormComponent,
  },
  {
    path: 'inventory/view/:id',
    component: AssetsFormComponent,
    data: { viewMode: true },
  },
  {
    path: 'transfers',
    component: AssetTransfersComponent,
  },
  {
    path: 'maintenance',
    component: AssetMaintenanceComponent,
  },
  {
    path: 'reports',
    component: AssetReportsComponent,
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssetsControlRoutingModule {}
