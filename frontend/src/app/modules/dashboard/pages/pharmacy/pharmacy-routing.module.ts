import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './inventory/inventory.component';
import { InvoicingComponent } from './invoicing/invoicing.component';
import { OrderGenerationComponent } from './order-generation/order-generation.component';
import { SalesDispensingComponent } from './sales-dispensing/sales-dispensing.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'inventory',
    pathMatch: 'full'
  },
  {
    path: 'inventory',
    component: InventoryComponent
  },
  {
    path: 'order-generation',
    component: OrderGenerationComponent
  },
  {
    path: 'sales-dispensing',
    component: SalesDispensingComponent
  },
  {
    path: 'invoicing',
    component: InvoicingComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PharmacyRoutingModule { }
