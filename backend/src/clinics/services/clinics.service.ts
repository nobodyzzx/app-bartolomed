import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserClinic } from '../../users/entities/user-clinic.entity';
import { User } from '../../users/entities/user.entity';
import { CreateClinicDto, UpdateClinicDto } from '../dto';
import { AddClinicMemberDto } from '../dto/add-clinic-member.dto';
import { UpdateClinicMemberDto } from '../dto/update-clinic-member.dto';
import { Clinic } from '../entities/clinic.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserClinic)
    private readonly userClinicRepo: Repository<UserClinic>,
    private readonly dataSource: DataSource,
  ) {}

  // Bug real: sin transacción, si linkSuperAdminsToClinic() fallaba después
  // de guardar la clínica, esta quedaba persistida sin rollback (clínica
  // huérfana, sin ningún SUPER_ADMIN vinculado).
  async create(createClinicDto: CreateClinicDto, user: User): Promise<Clinic> {
    try {
      return await this.dataSource.transaction(async (em: EntityManager) => {
        const clinic = em.create(Clinic, {
          ...createClinicDto,
          createdBy: user,
        });
        const saved = await em.save(Clinic, clinic);
        await this.linkSuperAdminsToClinic(em, saved);
        return saved;
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * Vincula todos los SUPER_ADMIN existentes a la clínica recién creada.
   * Garantiza que cualquier super admin tenga acceso a todas las clínicas.
   */
  private async linkSuperAdminsToClinic(em: EntityManager, clinic: Clinic): Promise<void> {
    const superAdmins = await em
      .createQueryBuilder(User, 'u')
      .where(':role = ANY(u.roles)', { role: 'super-admin' })
      .getMany();

    if (superAdmins.length === 0) return;

    const memberships = superAdmins.map(sa =>
      em.create(UserClinic, {
        user: sa,
        clinic,
        roles: ['admin', 'super-admin'],
      }),
    );
    await em.save(UserClinic, memberships);
  }

  // Bug real (fuga de datos): findAll/findOne/searchClinics cargaban
  // relations: ['users', 'createdBy'] — cualquier usuario autenticado
  // (GET /clinics no tiene guard de rol, es de uso general: selector de
  // clínica en el navbar, traslados de activos, formularios) recibía el
  // roster completo de staff (email, roles) de TODAS las clínicas del
  // sistema, no solo la propia. Ningún consumidor real del frontend lee
  // esas relaciones — se quitan; quien necesite el roster de una clínica
  // usa GET /clinics/:clinicId/members (ya scoped por clínica).
  async findAll(isActive?: boolean): Promise<Clinic[]> {
    const whereConditions: any = {};

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    return await this.clinicRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({
      where: { id, isActive: true },
    });

    if (!clinic) {
      throw new NotFoundException(`Clínica con id ${id} no encontrada`);
    }

    return clinic;
  }

  /** A diferencia de findOne(), no filtra por isActive — para editar/reactivar una clínica desactivada. */
  private async findAnyStatus(id: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException(`Clínica con id ${id} no encontrada`);
    }
    return clinic;
  }

  // Bug real: usaba findOne() (filtra isActive:true) — una vez desactivada
  // una clínica, PATCH /clinics/:id daba 404 y no había forma de corregir
  // sus datos antes de reactivarla "a ciegas".
  async update(id: string, updateClinicDto: UpdateClinicDto): Promise<Clinic> {
    const clinic = await this.findAnyStatus(id);

    try {
      Object.assign(clinic, updateClinicDto);
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(id: string): Promise<void> {
    const clinic = await this.findOne(id);
    clinic.isActive = false;
    await this.clinicRepository.save(clinic);
  }

  async activate(id: string): Promise<Clinic> {
    const clinic = await this.findAnyStatus(id);
    clinic.isActive = true;
    return await this.clinicRepository.save(clinic);
  }

  async deactivate(id: string): Promise<Clinic> {
    const clinic = await this.findOne(id);
    clinic.isActive = false;
    return await this.clinicRepository.save(clinic);
  }

  async searchClinics(searchTerm: string): Promise<Clinic[]> {
    return await this.clinicRepository
      .createQueryBuilder('clinic')
      .where('clinic.isActive = :isActive', { isActive: true })
      .andWhere(
        '(clinic.name ILIKE :searchTerm OR clinic.address ILIKE :searchTerm OR clinic.departamento ILIKE :searchTerm OR clinic.provincia ILIKE :searchTerm OR clinic.localidad ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` },
      )
      .getMany();
  }

  async getClinicStatistics(): Promise<any> {
    const totalClinics = await this.clinicRepository.count();

    const activeClinics = await this.clinicRepository.count({
      where: { isActive: true },
    });

    const inactiveClinics = await this.clinicRepository.count({
      where: { isActive: false },
    });

    const clinicsWithUsers = await this.clinicRepository
      .createQueryBuilder('clinic')
      .leftJoin('clinic.users', 'users')
      .select('clinic.id', 'clinicId')
      .addSelect('clinic.name', 'clinicName')
      .addSelect('COUNT(users.id)', 'userCount')
      .where('clinic.isActive = :isActive', { isActive: true })
      .groupBy('clinic.id')
      .addGroupBy('clinic.name')
      .getRawMany();

    const clinicsWithPatients = await this.clinicRepository
      .createQueryBuilder('clinic')
      .leftJoin('clinic.patients', 'patients')
      .select('clinic.id', 'clinicId')
      .addSelect('clinic.name', 'clinicName')
      .addSelect('COUNT(patients.id)', 'patientCount')
      .where('clinic.isActive = :isActive', { isActive: true })
      .groupBy('clinic.id')
      .addGroupBy('clinic.name')
      .getRawMany();

    return {
      totalClinics,
      activeClinics,
      inactiveClinics,
      clinicsWithUsers,
      clinicsWithPatients,
    };
  }

  async removeUserFromClinic(userId: string, clinicId: string): Promise<Clinic> {
    const clinic = await this.findOne(clinicId);
    const membership = await this.userClinicRepo.findOne({
      where: { user: { id: userId }, clinic: { id: clinicId } },
      relations: ['user', 'clinic'],
    });
    if (!membership) return clinic;
    await this.userClinicRepo.remove(membership);
    return clinic;
  }

  // Nuevo: agregar miembro con roles
  async addMemberWithRoles(clinicId: string, dto: AddClinicMemberDto): Promise<Clinic> {
    const clinic = await this.findOne(clinicId);
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`Usuario con id ${dto.userId} no encontrado`);
    const existing = await this.userClinicRepo.findOne({ where: { user: { id: user.id }, clinic: { id: clinic.id } } });
    if (existing) throw new BadRequestException('El usuario ya está asignado a esta clínica');
    const uc = this.userClinicRepo.create({ user, clinic, roles: dto.roles ?? [] });
    await this.userClinicRepo.save(uc);
    return clinic;
  }

  async updateMemberRoles(clinicId: string, userId: string, dto: UpdateClinicMemberDto): Promise<Clinic> {
    const clinic = await this.findOne(clinicId);
    const membership = await this.userClinicRepo.findOne({ where: { user: { id: userId }, clinic: { id: clinicId } } });
    if (!membership) throw new NotFoundException('Membresía no encontrada');
    membership.roles = dto.roles ?? [];
    await this.userClinicRepo.save(membership);
    return clinic;
  }

  async getClinicMembers(clinicId: string) {
    const memberships = await this.userClinicRepo.find({
      where: { clinic: { id: clinicId } },
      relations: ['user', 'user.personalInfo', 'clinic'],
      select: {
        id: true,
        roles: true,
        user: {
          id: true,
          email: true,
          roles: true,
          isActive: true,
          personalInfo: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
    return memberships.map(m => ({
      userId: m.user.id,
      email: m.user.email,
      globalRoles: m.user.roles,
      clinicRoles: m.roles,
      isActive: m.user.isActive,
      personalInfo: m.user.personalInfo,
    }));
  }

  private readonly logger = new Logger(ClinicsService.name);

  private handleDBErrors(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail.replace('Key ', ''));
    }
    this.logger.error(error.message, error.stack);
    throw new BadRequestException('Ocurrió un error inesperado, revise los logs del servidor');
  }
}
