import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { permissionsGuard } from '@core/guards/permissions.guard'
import { roleGuard } from '@core/guards/role.guard'
import { InventoryComponent } from './inventory/inventory.component'
import { MedicationFormComponent } from './inventory/medication-form/medication-form.component'
import { StockFormComponent } from './inventory/stock-form/stock-form.component'
import { TransferStockComponent } from './inventory/transfer-stock/transfer-stock.component'
import { InvoicingComponent } from './invoicing/invoicing.component'
import { MedicationsComponent } from './medications/medications.component'
import { PurchaseOrderDetailComponent } from './purchase-orders/purchase-order-detail/purchase-order-detail.component'
import { PurchaseOrderFormComponent } from './purchase-orders/purchase-order-form/purchase-order-form.component'
import { PurchaseOrderReceiveComponent } from './purchase-orders/purchase-order-receive/purchase-order-receive.component'
import { PurchaseOrdersComponent } from './purchase-orders/purchase-orders.component'
import { NewSaleComponent } from './sales-dispensing/new-sale/new-sale.component'
import { SaleDetailsComponent } from './sales-dispensing/sale-details/sale-details.component'
import { SalesDispensingComponent } from './sales-dispensing/sales-dispensing.component'
import { SupplierFormComponent } from './suppliers/supplier-form/supplier-form.component'
import { SuppliersComponent } from './suppliers/suppliers.component'

const routes: Routes = [
  {
    path: '',
    redirectTo: 'inventory',
    pathMatch: 'full',
  },
  {
    path: 'medications',
    component: MedicationsComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'medications/new',
    component: MedicationFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'medications/edit/:id',
    component: MedicationFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory',
    component: InventoryComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [
        UserRoles.PHARMACIST,
        UserRoles.DOCTOR,
        UserRoles.ADMIN,
        UserRoles.SUPER_ADMIN,
      ],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory/medication/new',
    component: MedicationFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory/medication/edit/:id',
    component: MedicationFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory/stock/new',
    component: StockFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory/transfer',
    component: TransferStockComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'inventory/stock/edit/:id',
    component: StockFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'order-generation',
    redirectTo: 'purchase-orders',
    pathMatch: 'full',
  },
  {
    path: 'purchase-orders/new',
    component: PurchaseOrderFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'purchase-orders/receive/:id',
    component: PurchaseOrderReceiveComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'purchase-orders/edit/:id',
    component: PurchaseOrderFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'purchase-orders/:id',
    component: PurchaseOrderDetailComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'purchase-orders',
    component: PurchaseOrdersComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'suppliers',
    component: SuppliersComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'suppliers/new',
    component: SupplierFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'suppliers/edit/:id',
    component: SupplierFormComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyInventoryManage],
    },
  },
  {
    path: 'sales-dispensing',
    component: SalesDispensingComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [
        UserRoles.PHARMACIST,
        UserRoles.DOCTOR,
        UserRoles.ADMIN,
        UserRoles.SUPER_ADMIN,
      ],
      requiredPermissions: [Permission.PharmacyDispense],
    },
  },
  {
    path: 'sales-dispensing/new',
    component: NewSaleComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [
        UserRoles.PHARMACIST,
        UserRoles.DOCTOR,
        UserRoles.ADMIN,
        UserRoles.SUPER_ADMIN,
      ],
      requiredPermissions: [Permission.PharmacyDispense],
    },
  },
  {
    path: 'sales-dispensing/:id',
    component: SaleDetailsComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [
        UserRoles.PHARMACIST,
        UserRoles.DOCTOR,
        UserRoles.ADMIN,
        UserRoles.SUPER_ADMIN,
      ],
      requiredPermissions: [Permission.PharmacyDispense],
    },
  },
  {
    path: 'invoicing',
    component: InvoicingComponent,
    canActivate: [permissionsGuard, roleGuard],
    data: {
      allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      requiredPermissions: [Permission.PharmacyBilling],
    },
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PharmacyRoutingModule {}
