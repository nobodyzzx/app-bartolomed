import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(createClinicDto: CreateClinicDto, user: User): Promise<Clinic> {
    try {
      const clinic = this.clinicRepository.create({
        ...createClinicDto,
        createdBy: user,
      });
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(isActive?: boolean): Promise<Clinic[]> {
    const whereConditions: any = {};

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    return await this.clinicRepository.find({
      where: whereConditions,
      relations: ['users', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({
      where: { id, isActive: true },
      relations: ['users', 'createdBy'],
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    return clinic;
  }

  async update(id: string, updateClinicDto: UpdateClinicDto): Promise<Clinic> {
    const clinic = await this.findOne(id);

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
    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

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
      .leftJoinAndSelect('clinic.createdBy', 'createdBy')
      .leftJoinAndSelect('clinic.users', 'users')
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

  async addUserToClinic(userId: string, clinicId: string): Promise<Clinic> {
    // Mantener compatibilidad: delegar a nuevo método con roles vacíos
    return this.addMemberWithRoles(clinicId, { userId, roles: [] });
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
    if (!user) throw new NotFoundException(`User with id ${dto.userId} not found`);
    const existing = await this.userClinicRepo.findOne({ where: { user: { id: user.id }, clinic: { id: clinic.id } } });
    if (existing) throw new BadRequestException('User is already assigned to this clinic');
    const uc = this.userClinicRepo.create({ user, clinic, roles: dto.roles ?? [] });
    await this.userClinicRepo.save(uc);
    return clinic;
  }

  async updateMemberRoles(clinicId: string, userId: string, dto: UpdateClinicMemberDto): Promise<Clinic> {
    const clinic = await this.findOne(clinicId);
    const membership = await this.userClinicRepo.findOne({ where: { user: { id: userId }, clinic: { id: clinicId } } });
    if (!membership) throw new NotFoundException('Membership not found');
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

  private handleDBErrors(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail.replace('Key ', ''));
    }

    console.error(error);
    throw new BadRequestException('Please check server logs');
  }
}
