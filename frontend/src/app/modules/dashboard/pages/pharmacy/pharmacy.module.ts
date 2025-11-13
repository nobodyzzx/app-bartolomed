import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'

import { MaterialModule } from '../../../../material/material.module'
import { UiModalComponent } from './components/ui-modal/ui-modal.component'
import { InventoryComponent } from './inventory/inventory.component'
import { MedicationFormComponent } from './inventory/medication-form/medication-form.component'
import { StockFormComponent } from './inventory/stock-form/stock-form.component'
import { TransferStockComponent } from './inventory/transfer-stock/transfer-stock.component'
import { InvoicingComponent } from './invoicing/invoicing.component'
import { MedicationsComponent } from './medications/medications.component'
import { OrderGenerationComponent } from './order-generation/order-generation.component'
import { PharmacyRoutingModule } from './pharmacy-routing.module'
import { PurchaseOrderDetailComponent } from './purchase-orders/purchase-order-detail/purchase-order-detail.component'
import { PurchaseOrderFormComponent } from './purchase-orders/purchase-order-form/purchase-order-form.component'
import { PurchaseOrderReceiveComponent } from './purchase-orders/purchase-order-receive/purchase-order-receive.component'
import { PurchaseOrdersComponent } from './purchase-orders/purchase-orders.component'
import { NewSaleComponent } from './sales-dispensing/new-sale/new-sale.component'
import { SaleDetailsComponent } from './sales-dispensing/sale-details/sale-details.component'
import { SalesDispensingComponent } from './sales-dispensing/sales-dispensing.component'
import { SupplierFormComponent } from './suppliers/supplier-form/supplier-form.component'
import { SuppliersComponent } from './suppliers/suppliers.component'

@NgModule({
  declarations: [
    InventoryComponent,
    MedicationFormComponent,
    StockFormComponent,
    MedicationsComponent,
    OrderGenerationComponent,
    PurchaseOrdersComponent,
    PurchaseOrderDetailComponent,
    PurchaseOrderFormComponent,
    PurchaseOrderReceiveComponent,
    SalesDispensingComponent,
    NewSaleComponent,
    SaleDetailsComponent,
    InvoicingComponent,
    SuppliersComponent,
    SupplierFormComponent,
    UiModalComponent,
    TransferStockComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    MaterialModule,
    PharmacyRoutingModule,
    DecimalPipe,
    CurrencyPipe,
  ],
  exports: [
    InventoryComponent,
    MedicationFormComponent,
    StockFormComponent,
    MedicationsComponent,
    PurchaseOrdersComponent,
    SalesDispensingComponent,
    InvoicingComponent,
    SuppliersComponent,
    SupplierFormComponent,
    UiModalComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PharmacyModule {}
