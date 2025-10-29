import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CreateClinicDto, UpdateClinicDto } from '../dto';
import { Clinic } from '../entities/clinic.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
        '(clinic.name ILIKE :searchTerm OR clinic.address ILIKE :searchTerm OR clinic.city ILIKE :searchTerm)',
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
    const clinic = await this.findOne(clinicId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    // Verificar si el usuario ya está asignado a la clínica
    const isUserAlreadyAssigned = clinic.users.some(u => u.id === userId);
    if (isUserAlreadyAssigned) {
      throw new BadRequestException('User is already assigned to this clinic');
    }

    clinic.users.push(user);
    return await this.clinicRepository.save(clinic);
  }

  async removeUserFromClinic(userId: string, clinicId: string): Promise<Clinic> {
    const clinic = await this.findOne(clinicId);
    clinic.users = clinic.users.filter(u => u.id !== userId);
    return await this.clinicRepository.save(clinic);
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail.replace('Key ', ''));
    }

    console.error(error);
    throw new BadRequestException('Please check server logs');
  }
}
