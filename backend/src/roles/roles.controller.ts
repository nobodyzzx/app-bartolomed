import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { Role } from './entities';
import { RolesService } from './services/roles.service';

@Controller('roles')
@Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() createRoleDto: CreateRoleDto): Promise<Role> {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  findAll(@Query('isActive') isActive?: string): Promise<Role[]> {
    const isActiveFilter = isActive !== undefined ? isActive === 'true' : undefined;
    return this.rolesService.findAll(isActiveFilter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Role> {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateRoleDto: UpdateRoleDto): Promise<Role> {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rolesService.remove(id);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<Role> {
    return this.rolesService.activate(id);
  }
}
