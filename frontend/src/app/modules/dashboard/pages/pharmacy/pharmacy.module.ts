import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../../../material/material.module';
import { InventoryComponent } from './inventory/inventory.component';
import { InvoicingComponent } from './invoicing/invoicing.component';
import { OrderGenerationComponent } from './order-generation/order-generation.component';
import { PharmacyRoutingModule } from './pharmacy-routing.module';
import { SalesDispensingComponent } from './sales-dispensing/sales-dispensing.component';

@NgModule({
  declarations: [
    InventoryComponent,
    OrderGenerationComponent,
    SalesDispensingComponent,
    InvoicingComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    MaterialModule,
    PharmacyRoutingModule
  ],
  exports: [
    InventoryComponent,
    OrderGenerationComponent,
    SalesDispensingComponent,
    InvoicingComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PharmacyModule { }
