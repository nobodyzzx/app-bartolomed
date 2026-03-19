import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthClinic } from '../../auth/decorators';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { SuppliersService } from '../services/suppliers.service';

@Controller('pharmacy/suppliers')
@AuthClinic({ roles: [ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.PharmacyInventoryManage)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.suppliersService.restore(id);
  }
}
