import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient, Gender } from '../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  private ensureBirthDateNotFuture(birthDate: string | Date) {
    const parsed = new Date(birthDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('birthDate is invalid');
    }
    if (parsed > new Date()) {
      throw new BadRequestException('birthDate cannot be in the future');
    }
  }

  async create(createPatientDto: CreatePatientDto, user: User): Promise<Patient> {
    try {
      this.ensureBirthDateNotFuture(createPatientDto.birthDate);

      // Verificar que la clínica existe
      const clinic = await this.clinicRepository.findOne({
        where: { id: createPatientDto.clinicId },
      });

      if (!clinic) {
        throw new NotFoundException('Clinic not found');
      }

      // Verificar que no existe un paciente activo con el mismo número de documento
      const existingPatient = await this.patientRepository.findOne({
        where: { documentNumber: createPatientDto.documentNumber, isActive: true },
      });

      if (existingPatient) {
        throw new ConflictException('Patient with this document number already exists');
      }

      const patient = this.patientRepository.create({
        ...createPatientDto,
        clinic,
        createdBy: user,
      });

      return await this.patientRepository.save(patient);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error creating patient');
    }
  }

  async findAll(
    clinicId: string,
    page = 1,
    limit = 25,
    gender?: Gender,
  ): Promise<PaginatedResult<Patient>> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const where: any = { isActive: true, clinic: { id: clinicId } };
    if (gender) where.gender = gender;

    const [data, total] = await this.patientRepository.findAndCount({
      where,
      relations: ['clinic', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, clinicId?: string): Promise<Patient> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const patient = await this.patientRepository.findOne({
      where: { id, isActive: true, clinic: { id: clinicId } },
      relations: ['clinic', 'createdBy'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async findByDocumentNumber(documentNumber: string, clinicId?: string): Promise<Patient> {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const normalizedDocument = documentNumber.trim().toUpperCase();
    const where: any = { documentNumber: normalizedDocument, isActive: true, clinic: { id: clinicId } };
    const patient = await this.patientRepository.findOne({
      where,
      relations: ['clinic', 'createdBy'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, clinicId?: string): Promise<Patient> {
    const patient = await this.findOne(id, clinicId);

    if (updatePatientDto.birthDate) {
      this.ensureBirthDateNotFuture(updatePatientDto.birthDate);
    }

    // Si se está actualizando el número de documento, verificar que no exista en pacientes activos
    if (updatePatientDto.documentNumber && updatePatientDto.documentNumber !== patient.documentNumber) {
      const existingPatient = await this.patientRepository.findOne({
        where: { documentNumber: updatePatientDto.documentNumber, isActive: true },
      });

      if (existingPatient) {
        throw new ConflictException('Patient with this document number already exists');
      }
    }

    // Si se está actualizando la clínica, verificar que existe
    if (updatePatientDto.clinicId) {
      const clinic = await this.clinicRepository.findOne({
        where: { id: updatePatientDto.clinicId },
      });

      if (!clinic) {
        throw new NotFoundException('Clinic not found');
      }

      Object.assign(patient, { ...updatePatientDto, clinic });
    } else {
      Object.assign(patient, updatePatientDto);
    }

    return await this.patientRepository.save(patient);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const patient = await this.findOne(id, clinicId);
    patient.isActive = false;
    // Liberar el documentNumber para que el mismo CI pueda registrarse de nuevo
    patient.documentNumber = `DEL_${Date.now()}_${patient.documentNumber}`;
    await this.patientRepository.save(patient);
  }

  async searchPatients(searchTerm: string, clinicId?: string, limit = 10): Promise<Patient[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.clinic', 'clinic')
      .leftJoinAndSelect('patient.createdBy', 'createdBy')
      .where('patient.isActive = :isActive', { isActive: true })
      .andWhere(
        '(patient.firstName ILIKE :searchTerm OR patient.lastName ILIKE :searchTerm OR patient.documentNumber ILIKE :searchTerm OR patient.email ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` },
      )
      .andWhere('clinic.id = :clinicId', { clinicId })
      .take(limit);

    return await queryBuilder.getMany();
  }

  async getPatientStatistics(clinicId?: string): Promise<any> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    let whereConditions = 'patient.isActive = true';
    const parameters: any = {};
    whereConditions += ' AND clinic.id = :clinicId';
    parameters.clinicId = clinicId;

    const totalPatients = await this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .where(whereConditions, parameters)
      .getCount();

    const genderStats = await this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .select('patient.gender', 'gender')
      .addSelect('COUNT(*)', 'count')
      .where(whereConditions, parameters)
      .groupBy('patient.gender')
      .getRawMany();

    const ageRangeExpr = `CASE
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) < 18 THEN 'Menor de 18'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Mayor de 70'
        END`;
    const ageRanges = await this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .select(ageRangeExpr, 'ageRange')
      .addSelect('COUNT(*)', 'count')
      .where(whereConditions, parameters)
      .groupBy(ageRangeExpr)
      .getRawMany();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonth = await this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .where(whereConditions, parameters)
      .andWhere('patient.createdAt >= :startOfMonth', { startOfMonth })
      .getCount();

    return {
      totalPatients,
      genderStats,
      ageRanges,
      newThisMonth,
    };
  }
}
