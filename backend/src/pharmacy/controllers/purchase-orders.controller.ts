import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from '../dto/purchase-order.dto';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { PurchaseOrdersService } from '../services/purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto, @Request() req: any) {
    const createdById = req.user?.sub || 'system';
    return this.purchaseOrdersService.create(createPurchaseOrderDto, createdById);
  }

  @Get()
  findAll(@Query('status') status?: PurchaseOrderStatus, @Query('supplierId') supplierId?: string) {
    if (status) {
      return this.purchaseOrdersService.getOrdersByStatus(status);
    }
    if (supplierId) {
      return this.purchaseOrdersService.getOrdersBySupplier(supplierId);
    }
    return this.purchaseOrdersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdatePurchaseOrderStatusDto, @Request() req: any) {
    const approvedById = req.user?.sub;
    return this.purchaseOrdersService.updateStatus(id, updateStatusDto, approvedById);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }
}
