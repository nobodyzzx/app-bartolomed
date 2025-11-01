import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Prescription } from './entities/prescription.entity';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createDto: CreatePrescriptionDto, createdBy?: User): Promise<Prescription> {
    // Basic validations: ensure patient, doctor, clinic exist
    const patient = await this.patientRepository.findOne({ where: { id: createDto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.userRepository.findOne({ where: { id: createDto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const clinic = await this.clinicRepository.findOne({ where: { id: createDto.clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const entity = this.prescriptionRepository.create({
      prescriptionNumber: createDto.prescriptionNumber,
      prescriptionDate: new Date(createDto.prescriptionDate),
      expiryDate: new Date(createDto.expiryDate),
      diagnosis: createDto.diagnosis,
      patient,
      doctor,
      clinic,
      items: createDto.items || [],
      notes: createDto.notes,
      isElectronic: !!createDto.isElectronic,
      isControlledSubstance: !!createDto.isControlledSubstance,
      refillsAllowed: createDto.refillsAllowed ?? 0,
    });

    if (createdBy) entity.createdBy = createdBy;

    try {
      return await this.prescriptionRepository.save(entity);
    } catch {
      throw new BadRequestException('Could not create prescription');
    }
  }

  async findAll(page = 1, pageSize = 20, filter: any = {}) {
    const skip = (page - 1) * pageSize;
    const qb = this.prescriptionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.clinic', 'clinic')
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (filter.patientId) qb.andWhere('patient.id = :patientId', { patientId: filter.patientId });
    if (filter.doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId: filter.doctorId });
    if (filter.status) qb.andWhere('p.status = :status', { status: filter.status });

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<Prescription> {
    const pres = await this.prescriptionRepository.findOne({ where: { id } });
    if (!pres) throw new NotFoundException('Prescription not found');
    return pres;
  }

  async update(id: string, updateDto: UpdatePrescriptionDto): Promise<Prescription> {
    const pres = await this.findOne(id);
    Object.assign(pres, updateDto);
    return await this.prescriptionRepository.save(pres);
  }
}
