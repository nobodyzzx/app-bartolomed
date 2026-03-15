import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth, GetUser } from '../../auth/decorators';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import { User } from '../../users/entities/user.entity';
import {
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from '../dto/purchase-order.dto';
import { Medication } from '../entities/pharmacy.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { PurchaseOrdersService } from '../services/purchase-orders.service';

@Controller('pharmacy/purchase-orders')
@RequirePermissions(Permission.PharmacyInventoryManage)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    @InjectRepository(Medication)
    private readonly medicationRepository: Repository<Medication>,
  ) {}

  @Post()
  @Auth(ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto, @GetUser() user: User) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, user.id);
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
  @Auth(ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto);
  }

  @Patch(':id/status')
  @Auth(ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdatePurchaseOrderStatusDto, @GetUser() user: User) {
    return this.purchaseOrdersService.updateStatus(id, updateStatusDto, user.id);
  }

  @Post(':id/receive')
  @Auth(ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  receive(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchaseOrdersService.receive(id, dto);
  }

  @Delete(':id')
  @Auth(ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }

  @Post('maintenance/backfill-medication-ids')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  async backfillMedicationIds() {
    const meds = await this.medicationRepository.find({
      select: ['id', 'name', 'brandName', 'code'],
      where: { isActive: true },
    });
    const result = await this.purchaseOrdersService.backfillMedicationIds(meds);
    return {
      message: 'Backfill ejecutado',
      ...result,
    };
  }
}
