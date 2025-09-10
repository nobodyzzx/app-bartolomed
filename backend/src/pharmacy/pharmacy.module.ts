import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PharmacyInvoice } from './entities/pharmacy-invoice.entity';
import { PharmacySale, PharmacySaleItem } from './entities/pharmacy-sale.entity';
import { PurchaseOrder, PurchaseOrderItem, Supplier } from './entities/purchase-order.entity';

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
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      PharmacySale,
      PharmacySaleItem,
      PharmacyInvoice,
    ]),
  ],
  controllers: [SuppliersController, PurchaseOrdersController, PharmacySalesController, PharmacyInvoicesController],
  providers: [SuppliersService, PurchaseOrdersService, PharmacySalesService, PharmacyInvoicesService],
  exports: [TypeOrmModule, SuppliersService, PurchaseOrdersService, PharmacySalesService, PharmacyInvoicesService],
})
export class PharmacyModule {}
