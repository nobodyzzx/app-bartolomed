import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, clinicId, ...userData } = createUserDto;

      // Si se proporciona clinicId, verificar que la clínica existe
      let clinic: Clinic | undefined;
      if (clinicId) {
        clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
        if (!clinic) {
          throw new BadRequestException(`Clinic with id ${clinicId} not found`);
        }
      }

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
        clinic: clinic,
      });

      await this.userRepository.save(user);
      delete user.password;

      return user;
    } catch (error) {
      if (error.code === '23505') {
        // Código de error de PostgreSQL para clave duplicada
        throw new BadRequestException('El correo ya está registrado');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear usuario');
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;

    return await this.userRepository.find({
      take: limit,
      skip: offset,
      relations: ['clinic'],
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['clinic'],
    });

    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    return user;
  }

  async update(id: string, updateUserDto: Partial<CreateUserDto>) {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = bcrypt.hashSync(updateUserDto.password, 10);
    }

    // Manejar la actualización de clínica si se proporciona clinicId
    if (updateUserDto.clinicId) {
      const clinic = await this.clinicRepository.findOne({ where: { id: updateUserDto.clinicId } });
      if (!clinic) {
        throw new BadRequestException(`Clinic with id ${updateUserDto.clinicId} not found`);
      }
      user.clinic = clinic;
      delete updateUserDto.clinicId; // Eliminar del objeto para evitar conflicto
    }

    try {
      Object.assign(user, updateUserDto);
      await this.userRepository.save(user);
      delete user.password;

      return user;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    throw new BadRequestException('Please check server logs');
  }
}
