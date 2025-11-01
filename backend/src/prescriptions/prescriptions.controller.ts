import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller('prescriptions')
@Auth()
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  create(@Body() createDto: CreatePrescriptionDto, @GetUser() user: User) {
    return this.prescriptionsService.create(createDto, user);
  }

  @Get()
  findAll(@Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.prescriptionsService.findAll(p, ps, filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdatePrescriptionDto) {
    return this.prescriptionsService.update(id, updateDto);
  }
}
