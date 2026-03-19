import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  CreateConsentFormDto,
  CreateMedicalRecordDto,
  UpdateConsentFormDto,
  UpdateMedicalRecordDto,
  UploadConsentDocumentDto,
} from './dto';
import { ConsentForm, ConsentStatus, MedicalRecord, RecordStatus } from './entities';

export interface MedicalRecordFilters {
  search?: string;
  type?: string;
  status?: string;
  patientId?: string;
  doctorId?: string;
  clinicId?: string;
  startDate?: string;
  endDate?: string;
  isEmergency?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface MedicalRecordStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  emergencies: number;
  thisMonth: number;
}

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(ConsentForm)
    private consentFormRepository: Repository<ConsentForm>,
  ) {}

  // Medical Records Methods
  async create(createMedicalRecordDto: CreateMedicalRecordDto, user: User): Promise<MedicalRecord> {
    const medicalRecord = this.medicalRecordRepository.create(createMedicalRecordDto);

    // CRÍTICO: Asignar manualmente las relaciones patient y doctor
    // TypeORM no mapea automáticamente patientId/doctorId a las relaciones
    if (createMedicalRecordDto.patientId) {
      medicalRecord.patient = { id: createMedicalRecordDto.patientId } as any;
    }

    if (createMedicalRecordDto.doctorId) {
      medicalRecord.doctor = { id: createMedicalRecordDto.doctorId } as any;
    }
    medicalRecord.createdBy = user;

    // Si hay un relatedRecordId, establecer la relación
    if (createMedicalRecordDto.relatedRecordId) {
      const relatedRecord = await this.medicalRecordRepository.findOne({
        where: { id: createMedicalRecordDto.relatedRecordId },
      });

      if (!relatedRecord) {
        throw new NotFoundException(
          `Registro médico relacionado con ID ${createMedicalRecordDto.relatedRecordId} no encontrado`,
        );
      }

      medicalRecord.relatedRecord = relatedRecord;
    }

    // Los seguimientos se marcan automáticamente como completados
    if (medicalRecord.type === 'follow_up') {
      medicalRecord.status = RecordStatus.COMPLETED;
    }

    // Calcular BMI si se proporcionan peso y altura
    if (medicalRecord.weight && medicalRecord.height) {
      medicalRecord.bmi = medicalRecord.calculateBMI()!;
    }

    const savedRecord = await this.medicalRecordRepository.save(medicalRecord);

    // Recargar con relaciones para devolver datos completos
    const reloaded = await this.medicalRecordRepository.findOne({
      where: { id: savedRecord.id },
      relations: [
        'patient',
        'doctor',
        'doctor.personalInfo',
        'doctor.professionalInfo',
        'relatedRecord',
        'createdBy',
        'updatedBy',
      ],
    });
    if (!reloaded) throw new NotFoundException('Expediente no encontrado tras creación');
    return reloaded;
  }

  async findAll(
    filters: MedicalRecordFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<{ data: MedicalRecord[]; total: number }> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoinAndSelect('medicalRecord.patient', 'patient')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      .leftJoinAndSelect('medicalRecord.createdBy', 'createdBy')
      .leftJoinAndSelect('medicalRecord.updatedBy', 'updatedBy')
      .leftJoinAndSelect('doctor.personalInfo', 'doctorPersonalInfo')
      .leftJoinAndSelect('doctor.professionalInfo', 'doctorProfessionalInfo')
      .where('medicalRecord.isActive = :isActive', { isActive: true });

    // Aplicar filtros
    if (filters.search) {
      queryBuilder.andWhere(
        '(medicalRecord.chiefComplaint ILIKE :search OR medicalRecord.diagnosis ILIKE :search OR patient.firstName ILIKE :search OR patient.lastName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.type) {
      queryBuilder.andWhere('medicalRecord.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('medicalRecord.status = :status', { status: filters.status });
    }

    if (filters.patientId) {
      queryBuilder.andWhere('medicalRecord.patient.id = :patientId', { patientId: filters.patientId });
    }

    if (filters.doctorId) {
      queryBuilder.andWhere('medicalRecord.doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.clinicId) {
      queryBuilder.andWhere('patient.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.isEmergency !== undefined) {
      queryBuilder.andWhere('medicalRecord.isEmergency = :isEmergency', { isEmergency: filters.isEmergency });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('medicalRecord.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    queryBuilder.orderBy('medicalRecord.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<MedicalRecord> {
    const medicalRecord = await this.medicalRecordRepository.findOne({
      where: { id, isActive: true },
      relations: ['patient', 'doctor', 'createdBy', 'updatedBy'],
    });

    if (!medicalRecord) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    return medicalRecord;
  }

  async getMedicalRecordsByPatient(patientId: string, clinicId?: string): Promise<MedicalRecord[]> {
    const qb = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoinAndSelect('medicalRecord.patient', 'patient')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      .leftJoinAndSelect('medicalRecord.createdBy', 'createdBy')
      .leftJoinAndSelect('medicalRecord.updatedBy', 'updatedBy')
      .where('medicalRecord.isActive = :isActive', { isActive: true })
      .andWhere('patient.id = :patientId', { patientId })
      .orderBy('medicalRecord.createdAt', 'DESC');

    if (clinicId) {
      qb.andWhere('patient.clinic.id = :clinicId', { clinicId });
    }

    return await qb.getMany();
  }

  async getMedicalRecordsByDoctor(doctorId: string, clinicId?: string): Promise<MedicalRecord[]> {
    const qb = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoinAndSelect('medicalRecord.patient', 'patient')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      .leftJoinAndSelect('medicalRecord.createdBy', 'createdBy')
      .leftJoinAndSelect('medicalRecord.updatedBy', 'updatedBy')
      .where('medicalRecord.isActive = :isActive', { isActive: true })
      .andWhere('doctor.id = :doctorId', { doctorId })
      .orderBy('medicalRecord.createdAt', 'DESC');

    if (clinicId) {
      qb.andWhere('patient.clinic.id = :clinicId', { clinicId });
    }

    return await qb.getMany();
  }

  async update(id: string, updateMedicalRecordDto: UpdateMedicalRecordDto, user: User): Promise<MedicalRecord> {
    const medicalRecord = await this.findOne(id);

    Object.assign(medicalRecord, updateMedicalRecordDto);
    medicalRecord.updatedBy = user;

    // Recalcular BMI si se actualizaron peso o altura
    if (updateMedicalRecordDto.weight || updateMedicalRecordDto.height) {
      if (medicalRecord.weight && medicalRecord.height) {
        medicalRecord.bmi = medicalRecord.calculateBMI()!;
      }
    }

    return await this.medicalRecordRepository.save(medicalRecord);
  }

  async remove(id: string): Promise<void> {
    const medicalRecord = await this.findOne(id);
    medicalRecord.isActive = false;
    await this.medicalRecordRepository.save(medicalRecord);
  }

  async getStats(clinicId?: string): Promise<MedicalRecordStats> {
    const baseQb = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoin('medicalRecord.patient', 'patient')
      .where('medicalRecord.isActive = true');

    if (clinicId) {
      baseQb.andWhere('patient.clinic.id = :clinicId', { clinicId });
    }

    const total = await baseQb.getCount();

    const emergenciesQb = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoin('medicalRecord.patient', 'patient')
      .where('medicalRecord.isActive = true')
      .andWhere('medicalRecord.isEmergency = true');
    if (clinicId) {
      emergenciesQb.andWhere('patient.clinic.id = :clinicId', { clinicId });
    }
    const emergencies = await emergenciesQb.getCount();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthQb = this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoin('medicalRecord.patient', 'patient')
      .where('medicalRecord.isActive = true')
      .andWhere('medicalRecord.createdAt BETWEEN :startDate AND :endDate', {
        startDate: startOfMonth,
        endDate: new Date(),
      });
    if (clinicId) {
      thisMonthQb.andWhere('patient.clinic.id = :clinicId', { clinicId });
    }
    const thisMonth = await thisMonthQb.getCount();

    // Stats por tipo
    const typeStats = await this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoin('medicalRecord.patient', 'patient')
      .select('medicalRecord.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('medicalRecord.isActive = true')
      .andWhere(clinicId ? 'patient.clinic.id = :clinicId' : '1=1', clinicId ? { clinicId } : {})
      .groupBy('medicalRecord.type')
      .getRawMany();

    const byType = typeStats.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});

    // Stats por status
    const statusStats = await this.medicalRecordRepository
      .createQueryBuilder('medicalRecord')
      .leftJoin('medicalRecord.patient', 'patient')
      .select('medicalRecord.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('medicalRecord.isActive = true')
      .andWhere(clinicId ? 'patient.clinic.id = :clinicId' : '1=1', clinicId ? { clinicId } : {})
      .groupBy('medicalRecord.status')
      .getRawMany();

    const byStatus = statusStats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count);
      return acc;
    }, {});

    return {
      total,
      byType,
      byStatus,
      emergencies,
      thisMonth,
    };
  }

  // Consent Forms Methods
  async createConsentForm(createConsentFormDto: CreateConsentFormDto): Promise<ConsentForm> {
    const consentForm = this.consentFormRepository.create(createConsentFormDto);
    return await this.consentFormRepository.save(consentForm);
  }

  async findAllConsentForms(
    filters: { patientId?: string; medicalRecordId?: string; status?: ConsentStatus } = {},
  ): Promise<ConsentForm[]> {
    const where: any = { isActive: true };

    if (filters.patientId) {
      where['patient'] = { id: filters.patientId };
    }

    if (filters.medicalRecordId) {
      where['medicalRecord'] = { id: filters.medicalRecordId };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return await this.consentFormRepository.find({
      where,
      relations: ['patient', 'doctor', 'medicalRecord', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneConsentForm(id: string): Promise<ConsentForm> {
    const consentForm = await this.consentFormRepository.findOne({
      where: { id, isActive: true },
      relations: ['patient', 'doctor', 'medicalRecord', 'createdBy'],
    });

    if (!consentForm) {
      throw new NotFoundException(`Consent form with ID ${id} not found`);
    }

    return consentForm;
  }

  async updateConsentForm(id: string, updateConsentFormDto: UpdateConsentFormDto): Promise<ConsentForm> {
    const consentForm = await this.findOneConsentForm(id);
    Object.assign(consentForm, updateConsentFormDto);
    return await this.consentFormRepository.save(consentForm);
  }

  async uploadConsentDocument(id: string, file: any, uploadData: UploadConsentDocumentDto): Promise<ConsentForm> {
    const consentForm = await this.findOneConsentForm(id);

    if (consentForm.status === ConsentStatus.SIGNED) {
      throw new BadRequestException('Consent form is already signed');
    }

    // Guardar información del archivo
    consentForm.signedDocumentPath = file.path;
    consentForm.signedDocumentName = file.originalname;
    consentForm.signedDocumentMimeType = file.mimetype;
    consentForm.signedDocumentSize = file.size;
    consentForm.signedAt = new Date();
    consentForm.status = ConsentStatus.SIGNED;

    // Actualizar datos adicionales
    if (uploadData.witnessName) {
      consentForm.witnessName = uploadData.witnessName;
    }
    if (uploadData.witnessRelationship) {
      consentForm.witnessRelationship = uploadData.witnessRelationship;
    }
    if (uploadData.notes) {
      consentForm.notes = uploadData.notes;
    }

    return await this.consentFormRepository.save(consentForm);
  }

  async removeConsentForm(id: string): Promise<void> {
    const consentForm = await this.findOneConsentForm(id);
    consentForm.isActive = false;
    await this.consentFormRepository.save(consentForm);
  }

  async getConsentFormsByMedicalRecord(medicalRecordId: string): Promise<ConsentForm[]> {
    return await this.findAllConsentForms({ medicalRecordId });
  }
}
