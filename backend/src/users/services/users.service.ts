import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ValidRoles } from '../../auth/interfaces';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserClinic } from '../entities/user-clinic.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(UserClinic)
    private readonly userClinicRepository: Repository<UserClinic>,
  ) {}

  private isSuperAdmin(actor: User): boolean {
    return actor.roles?.includes(ValidRoles.SUPER_ADMIN) ?? false;
  }

  // Bug real (escalación de privilegios): un ADMIN podía crear/editar un
  // usuario con roles: ['super-admin'] — nada validaba que solo un
  // SUPER_ADMIN pueda otorgar (o quitar) ese rol. Tampoco había jerarquía:
  // un ADMIN podía editar/desactivar/eliminar directamente una cuenta
  // SUPER_ADMIN existente.
  private assertCanAssignRoles(actor: User, roles?: string[]): void {
    if (!roles?.length) return;
    if (roles.includes(ValidRoles.SUPER_ADMIN) && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Solo un SUPER_ADMIN puede asignar el rol SUPER_ADMIN');
    }
  }

  private assertCanMutateTarget(actor: User, target: User): void {
    if (target.roles?.includes(ValidRoles.SUPER_ADMIN) && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Solo un SUPER_ADMIN puede modificar a otro SUPER_ADMIN');
    }
  }

  // Bug real (reasignación de clínica sin restricción): un ADMIN podía crear
  // o mover usuarios hacia CUALQUIER clínica pasando un clinicId arbitrario
  // en el body. Un SUPER_ADMIN sí puede elegir cualquier clínica (gestiona
  // todo el sistema); un ADMIN solo puede operar dentro de su propia clínica
  // activa.
  private assertCanAssignClinic(actor: User, targetClinicId: string | undefined, activeClinicId: string): void {
    if (this.isSuperAdmin(actor)) return;
    if (targetClinicId && targetClinicId !== activeClinicId) {
      throw new ForbiddenException('No puede asignar usuarios a una clínica distinta de la suya');
    }
  }

  async create(createUserDto: CreateUserDto, actor: User, activeClinicId: string) {
    this.assertCanAssignRoles(actor, createUserDto.roles);
    const clinicId = createUserDto.clinicId ?? activeClinicId;
    this.assertCanAssignClinic(actor, clinicId, activeClinicId);

    try {
      const { password, clinicId: _ignored, ...userData } = createUserDto;

      const clinic = (await this.clinicRepository.findOne({ where: { id: clinicId } })) ?? undefined;
      if (!clinic) {
        throw new BadRequestException(`Clínica con id ${clinicId} no encontrada`);
      }

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
        clinic,
      });

      await this.userRepository.save(user);
      delete (user as any).password;

      // Sincronizar: crear registro en user_clinics para que ClinicScopeGuard funcione
      const membership = this.userClinicRepository.create({
        user,
        clinic,
        roles: user.roles ?? [],
      });
      await this.userClinicRepository.save(membership);

      return user;
    } catch (error) {
      if (error.code === '23505') {
        // Código de error de PostgreSQL para clave duplicada
        throw new BadRequestException('El correo ya está registrado');
      }
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear usuario');
    }
  }

  // SUPER_ADMIN ve todos los usuarios del sistema (gestión global); un ADMIN
  // solo ve los de su propia clínica activa — antes no había ninguna
  // distinción y cualquier ADMIN veía usuarios de todas las clínicas.
  async findAll(paginationDto: PaginationDto, actor: User, activeClinicId: string) {
    const { limit = 25, offset = 0 } = paginationDto;

    const [data, total] = await this.userRepository.findAndCount({
      take: limit,
      skip: offset,
      where: this.isSuperAdmin(actor) ? {} : { clinic: { id: activeClinicId } },
      relations: ['clinic', 'personalInfo', 'professionalInfo'],
    });

    return { data, total, limit, offset };
  }

  async findOne(id: string, actor: User, activeClinicId: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['clinic', 'personalInfo', 'professionalInfo'],
    });

    if (!user) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    this.assertSameClinicOrSuperAdmin(actor, user, activeClinicId);

    return user;
  }

  private assertSameClinicOrSuperAdmin(actor: User, target: User, activeClinicId: string): void {
    if (this.isSuperAdmin(actor)) return;
    if (target.clinic?.id !== activeClinicId) {
      // 404 en vez de 403: no confirmar la existencia de un usuario de otra clínica
      throw new NotFoundException(`Usuario no encontrado`);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto, actor: User, activeClinicId: string) {
    const user = await this.findOne(id, actor, activeClinicId);
    this.assertCanMutateTarget(actor, user);
    this.assertCanAssignRoles(actor, updateUserDto.roles);

    if (updateUserDto.password) {
      updateUserDto.password = bcrypt.hashSync(updateUserDto.password, 10);
    }

    // Manejar la actualización de clínica si se proporciona clinicId
    if (updateUserDto.clinicId) {
      this.assertCanAssignClinic(actor, updateUserDto.clinicId, activeClinicId);
      const clinic = await this.clinicRepository.findOne({ where: { id: updateUserDto.clinicId } });
      if (!clinic) {
        throw new BadRequestException(`Clínica con id ${updateUserDto.clinicId} no encontrada`);
      }
      user.clinic = clinic;
      delete (updateUserDto as any).clinicId;

      // Sincronizar: upsert en user_clinics
      const existing = await this.userClinicRepository.findOne({
        where: { user: { id: user.id }, clinic: { id: clinic.id } },
      });
      if (!existing) {
        const membership = this.userClinicRepository.create({ user, clinic, roles: user.roles ?? [] });
        await this.userClinicRepository.save(membership);
      }
    }

    try {
      Object.assign(user, updateUserDto);
      await this.userRepository.save(user);
      delete (user as any).password;

      return user;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getClinicStatistics(clinicId: string): Promise<{
    totalDoctors: number;
    totalNurses: number;
    totalReceptionists: number;
    totalPharmacists: number;
  }> {
    const countByRole = (role: ValidRoles) =>
      this.userClinicRepository
        .createQueryBuilder('uc')
        .innerJoin('uc.user', 'user')
        .where('uc.clinic_id = :clinicId', { clinicId })
        .andWhere('user.isActive = true')
        .andWhere(':role = ANY(uc.roles)', { role })
        .getCount();

    const [totalDoctors, totalNurses, totalReceptionists, totalPharmacists] = await Promise.all([
      countByRole(ValidRoles.DOCTOR),
      countByRole(ValidRoles.NURSE),
      countByRole(ValidRoles.RECEPTIONIST),
      countByRole(ValidRoles.PHARMACIST),
    ]);

    return { totalDoctors, totalNurses, totalReceptionists, totalPharmacists };
  }

  async updateStatus(id: string, isActive: boolean, actor: User, activeClinicId: string) {
    const user = await this.findOne(id, actor, activeClinicId);
    this.assertCanMutateTarget(actor, user);
    user.isActive = isActive;
    await this.userRepository.save(user);
  }

  async remove(id: string, actor: User, activeClinicId: string) {
    const user = await this.findOne(id, actor, activeClinicId);
    this.assertCanMutateTarget(actor, user);
    try {
      await this.userRepository.remove(user);
    } catch (error) {
      // Bug real: hard-delete sin manejo de errores — eliminar un usuario con
      // historial (citas, recetas, ventas, etc.) violaba una FK y tiraba un
      // 500 crudo de Postgres en vez de un mensaje claro.
      if (error.code === '23503') {
        throw new BadRequestException(
          'No se puede eliminar: el usuario tiene registros asociados (citas, recetas, ventas, etc.). Desactívelo en su lugar.',
        );
      }
      throw error;
    }
    return { message: 'Usuario eliminado correctamente' };
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    throw new BadRequestException('Ocurrió un error inesperado, revise los logs del servidor');
  }
}
