import { Body, Controller, Delete, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { AuthClinic } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
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
  create(@Body() createSupplierDto: CreateSupplierDto, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.create(createSupplierDto, clinicId);
  }

  @Get()
  findAll(@Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.findAll(clinicId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.findOne(id, clinicId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.update(id, updateSupplierDto, clinicId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.remove(id, clinicId);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.suppliersService.restore(id, clinicId);
  }
}
