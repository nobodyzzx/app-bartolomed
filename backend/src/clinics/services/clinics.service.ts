import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../entities/clinic.entity';
import { CreateClinicDto, UpdateClinicDto } from '../dto';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createClinicDto: CreateClinicDto) {
    try {
      const clinic = this.clinicRepository.create(createClinicDto);
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll() {
    return await this.clinicRepository.find({
      relations: ['users'],
    });
  }

  async findOne(id: string) {
    const clinic = await this.clinicRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!clinic) throw new NotFoundException(`Clinic with id ${id} not found`);

    return clinic;
  }

  async update(id: string, updateClinicDto: UpdateClinicDto) {
    const clinic = await this.findOne(id);

    try {
      Object.assign(clinic, updateClinicDto);
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(id: string) {
    const clinic = await this.findOne(id);
    await this.clinicRepository.remove(clinic);
    return { message: 'Clinic deleted successfully' };
  }

  async addUserToClinic(userId: string, clinicId: string) {
    const clinic = await this.findOne(clinicId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException(`User with id ${userId} not found`);

    clinic.users.push(user);
    return await this.clinicRepository.save(clinic);
  }

  async removeUserFromClinic(userId: string, clinicId: string) {
    const clinic = await this.findOne(clinicId);
    clinic.users = clinic.users.filter(u => u.id !== userId);
    return await this.clinicRepository.save(clinic);
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    throw new BadRequestException('Please check server logs');
  }
}
