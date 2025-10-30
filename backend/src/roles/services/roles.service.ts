import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleDto, UpdateRoleDto } from '../dto';
import { Role } from '../entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    try {
      const role = this.roleRepository.create(createRoleDto);
      return await this.roleRepository.save(role);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(isActive?: boolean): Promise<Role[]> {
    const whereConditions: any = {};
    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }
    return await this.roleRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    try {
      Object.assign(role, updateRoleDto);
      return await this.roleRepository.save(role);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    role.isActive = false;
    await this.roleRepository.save(role);
  }

  async activate(id: string): Promise<Role> {
    const role = await this.findOne(id);
    role.isActive = true;
    return await this.roleRepository.save(role);
  }

  async findByName(name: string): Promise<Role | null> {
    return await this.roleRepository.findOne({ where: { name } });
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail.replace('Key ', ''));
    }
    console.error(error);
    throw new BadRequestException('Please check server logs');
  }
}
