import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  create(@Body() createAssetDto: CreateAssetDto, @GetUser() user: User) {
    // TODO: Obtener clinicId del contexto o del usuario
    return this.assetsService.create(createAssetDto, user.id);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAll(@Query() filters: FilterAssetsDto) {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.findAll(filters);
  }

  @Get('stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getStats() {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.getStats();
  }

  @Get('validate-serial/:serialNumber')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  validateSerialNumber(@Param('serialNumber') serialNumber: string, @Query('excludeId') excludeId?: string) {
    return this.assetsService.validateSerialNumber(serialNumber, excludeId);
  }

  @Get('unique/:field')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getUniqueValues(@Param('field') field: 'type' | 'manufacturer' | 'location' | 'category') {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.getUniqueValues(field);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.remove(id);
  }
}
