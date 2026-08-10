import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component'
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
  // El mantenimiento de activos se retiró: cero registros desde que existe, y el
  // inventario se lleva para contar existencias por ambiente.
  {
    path: 'maintenance',
    redirectTo: 'inventory',
    pathMatch: 'full',
  },
  // Los informes de activos viven en /dashboard/reports, junto al resto de la
  // clínica. La página propia generaba y archivaba reportes en `asset_reports`
  // (Depreciación y Financiero incluidos, que imprimían Bs 0,00 en cada fila
  // porque el inventario se cargó sin precios) — se retiró en favor de las
  // cinco plantillas de papel que el dato real sí sostiene.
  {
    path: 'reports',
    redirectTo: '/dashboard/reports',
    pathMatch: 'full',
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssetsControlRoutingModule {}
