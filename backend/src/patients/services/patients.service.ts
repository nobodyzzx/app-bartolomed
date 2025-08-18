import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createPatientDto: CreatePatientDto, user: User): Promise<Patient> {
    try {
      // Verificar que la clínica existe
      const clinic = await this.clinicRepository.findOne({
        where: { id: createPatientDto.clinicId },
      });

      if (!clinic) {
        throw new NotFoundException('Clinic not found');
      }

      // Verificar que no existe un paciente con el mismo número de documento
      const existingPatient = await this.patientRepository.findOne({
        where: { documentNumber: createPatientDto.documentNumber },
      });

      if (existingPatient) {
        throw new ConflictException('Patient with this document number already exists');
      }

      const { clinicId, ...patientData } = createPatientDto;

      const patient = this.patientRepository.create({
        ...patientData,
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

  async findAll(clinicId?: string): Promise<Patient[]> {
    const whereConditions: any = { isActive: true };
    
    if (clinicId) {
      whereConditions.clinic = { id: clinicId };
    }

    return await this.patientRepository.find({
      where: whereConditions,
      relations: ['clinic', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id, isActive: true },
      relations: ['clinic', 'createdBy'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async findByDocumentNumber(documentNumber: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { documentNumber, isActive: true },
      relations: ['clinic', 'createdBy'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOne(id);

    // Si se está actualizando el número de documento, verificar que no exista
    if (updatePatientDto.documentNumber && updatePatientDto.documentNumber !== patient.documentNumber) {
      const existingPatient = await this.patientRepository.findOne({
        where: { documentNumber: updatePatientDto.documentNumber },
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

      const { clinicId, ...patientData } = updatePatientDto;
      Object.assign(patient, { ...patientData, clinic });
    } else {
      Object.assign(patient, updatePatientDto);
    }

    return await this.patientRepository.save(patient);
  }

  async remove(id: string): Promise<void> {
    const patient = await this.findOne(id);
    patient.isActive = false;
    await this.patientRepository.save(patient);
  }

  async searchPatients(searchTerm: string, clinicId?: string): Promise<Patient[]> {
    const queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.clinic', 'clinic')
      .leftJoinAndSelect('patient.createdBy', 'createdBy')
      .where('patient.isActive = :isActive', { isActive: true })
      .andWhere(
        '(patient.firstName ILIKE :searchTerm OR patient.lastName ILIKE :searchTerm OR patient.documentNumber ILIKE :searchTerm OR patient.email ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` }
      );

    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

    return await queryBuilder.getMany();
  }

  async getPatientStatistics(clinicId?: string): Promise<any> {
    let whereConditions = 'patient.isActive = true';
    const parameters: any = {};

    if (clinicId) {
      whereConditions += ' AND clinic.id = :clinicId';
      parameters.clinicId = clinicId;
    }

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

    const ageRanges = await this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .select(
        `CASE 
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END`,
        'ageRange'
      )
      .addSelect('COUNT(*)', 'count')
      .where(whereConditions, parameters)
      .groupBy('ageRange')
      .getRawMany();

    return {
      totalPatients,
      genderStats,
      ageRanges,
    };
  }
}
