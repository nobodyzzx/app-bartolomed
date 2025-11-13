import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Clinic } from '../clinics/entities/clinic.entity';
import { PharmacyInvoice } from './entities/pharmacy-invoice.entity';
import { PharmacySale, PharmacySaleItem } from './entities/pharmacy-sale.entity';
import { Medication, MedicationStock, StockMovement } from './entities/pharmacy.entity';
import { PurchaseOrder, PurchaseOrderItem } from './entities/purchase-order.entity';
import { Supplier } from './entities/supplier.entity';

// Inventory controller/service (ya existen en /controllers y /services)
import { InventoryController } from './controllers/inventory.controller';
import { InventoryService } from './services/inventory.service';

// Controllers
import { PharmacyInvoicesController } from './controllers/pharmacy-invoices.controller';
import { PharmacySalesController } from './controllers/pharmacy-sales.controller';
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';
import { SuppliersController } from './controllers/suppliers.controller';

// Services
import { PharmacyInvoicesService } from './services/pharmacy-invoices.service';
import { PharmacySalesService } from './services/pharmacy-sales.service';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { SuppliersService } from './services/suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      PharmacySale,
      PharmacySaleItem,
      PharmacyInvoice,
      Medication,
      MedicationStock,
      StockMovement,
    ]),
  ],
  controllers: [
    SuppliersController,
    PurchaseOrdersController,
    PharmacySalesController,
    PharmacyInvoicesController,
    InventoryController,
  ],
  providers: [SuppliersService, PurchaseOrdersService, PharmacySalesService, PharmacyInvoicesService, InventoryService],
  exports: [
    TypeOrmModule,
    SuppliersService,
    PurchaseOrdersService,
    PharmacySalesService,
    PharmacyInvoicesService,
    InventoryService,
  ],
})
export class PharmacyModule {}
