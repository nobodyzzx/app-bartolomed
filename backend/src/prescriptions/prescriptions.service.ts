import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Prescription, PrescriptionItem, PrescriptionStatus } from './entities/prescription.entity';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private readonly prescriptionItemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createDto: CreatePrescriptionDto, createdBy?: User, scopedClinicId?: string, validatedPatient?: Patient): Promise<Prescription> {
    if (!scopedClinicId) throw new BadRequestException('clinicId is required');
    if (createDto.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }

    const prescriptionDate = new Date(createDto.prescriptionDate);
    const expiryDate = new Date(createDto.expiryDate);
    if (expiryDate < prescriptionDate) {
      throw new BadRequestException('Expiry date cannot be before prescription date');
    }
    // Patient: use pre-validated entity from pipe, or fall back to DB lookup
    const patient = validatedPatient ?? await this.patientRepository.findOne({
      where: { id: createDto.patientId, clinic: { id: scopedClinicId }, isActive: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.userRepository.findOne({ where: { id: createDto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const clinic = await this.clinicRepository.findOne({ where: { id: createDto.clinicId, isActive: true } });
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
      status: createDto.status ?? PrescriptionStatus.ACTIVE,
    });

    if (createdBy) entity.createdBy = createdBy;

    return await this.prescriptionRepository.save(entity);
  }

  async findAll(page = 1, pageSize = 20, filter: any = {}, clinicId?: string) {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const skip = (page - 1) * pageSize;
    const qb = this.prescriptionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.clinic', 'clinic')
      .leftJoinAndSelect('p.items', 'items')
      .where('clinic.id = :clinicId', { clinicId })
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (filter.patientId) qb.andWhere('patient.id = :patientId', { patientId: filter.patientId });
    if (filter.doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId: filter.doctorId });
    if (filter.status) qb.andWhere('p.status = :status', { status: filter.status });
    if (filter.search) {
      qb.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR p.prescriptionNumber ILIKE :search OR p.diagnosis ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string): Promise<Prescription> {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const pres = await this.prescriptionRepository.findOne({
      where: { id, clinic: { id: clinicId } },
      relations: ['patient', 'doctor', 'clinic', 'items'],
    });
    if (!pres) throw new NotFoundException('Prescription not found');
    return pres;
  }

  async update(id: string, updateDto: UpdatePrescriptionDto, clinicId?: string): Promise<Prescription> {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    return await this.prescriptionRepository.manager.transaction(async manager => {
      const presRepo = manager.getRepository(Prescription);
      const itemRepo = manager.getRepository(PrescriptionItem);

      const pres = await presRepo.findOne({
        where: { id, clinic: { id: clinicId } },
        relations: ['patient', 'doctor', 'clinic', 'items'],
      });
      if (!pres) throw new NotFoundException('Prescription not found');
      if (updateDto.status && updateDto.status !== pres.status) {
        throw new BadRequestException('Use sign/status endpoint to change prescription status');
      }

      // Update relations if ids provided
      if ((updateDto as any).patientId) {
        const patient = await this.patientRepository.findOne({
          where: { id: (updateDto as any).patientId, clinic: { id: clinicId }, isActive: true },
        });
        if (!patient) throw new NotFoundException('Patient not found');
        pres.patient = patient;
      }
      if ((updateDto as any).doctorId) {
        const doctor = await this.userRepository.findOne({ where: { id: (updateDto as any).doctorId } });
        if (!doctor) throw new NotFoundException('Doctor not found');
        pres.doctor = doctor;
      }
      if ((updateDto as any).clinicId) {
        if ((updateDto as any).clinicId !== clinicId) {
          throw new BadRequestException('Changing clinic is not allowed');
        }
      }

      // Primitive fields
      if (updateDto.prescriptionNumber !== undefined) pres.prescriptionNumber = updateDto.prescriptionNumber;
      if (updateDto.prescriptionDate !== undefined) pres.prescriptionDate = new Date(updateDto.prescriptionDate as any);
      if (updateDto.expiryDate !== undefined) pres.expiryDate = new Date(updateDto.expiryDate as any);
      if (updateDto.diagnosis !== undefined) (pres as any).diagnosis = updateDto.diagnosis as any;
      if ((updateDto as any).patientInstructions !== undefined) {
        (pres as any).patientInstructions = (updateDto as any).patientInstructions;
      }
      if ((updateDto as any).pharmacyInstructions !== undefined) {
        (pres as any).pharmacyInstructions = (updateDto as any).pharmacyInstructions;
      }
      if (updateDto.notes !== undefined) pres.notes = updateDto.notes as any;
      if ((updateDto as any).isElectronic !== undefined) (pres as any).isElectronic = (updateDto as any).isElectronic;
      if ((updateDto as any).isControlledSubstance !== undefined) {
        (pres as any).isControlledSubstance = (updateDto as any).isControlledSubstance;
      }
      if ((updateDto as any).refillsAllowed !== undefined) {
        (pres as any).refillsAllowed = (updateDto as any).refillsAllowed as any;
      }
      if ((updateDto as any).status !== undefined) (pres as any).status = (updateDto as any).status;
      if ((updateDto as any).refillsUsed !== undefined) {
        (pres as any).refillsUsed = (updateDto as any).refillsUsed as any;
      }

      // Business validation: date order
      if (pres.expiryDate < pres.prescriptionDate) {
        throw new BadRequestException('Expiry date cannot be before prescription date');
      }

      // Replace items atomically if provided
      if (Array.isArray((updateDto as any).items)) {
        // Delete existing items
        await itemRepo.createQueryBuilder().delete().where('prescription_id = :id', { id }).execute();

        pres.items = ((updateDto as any).items || []).map((d: any) =>
          itemRepo.create({
            medicationName: d.medicationName,
            strength: d.strength,
            dosageForm: d.dosageForm,
            quantity: d.quantity,
            dosage: d.dosage,
            frequency: d.frequency,
            route: d.route,
            duration: d.duration,
            instructions: d.instructions,
            isActive: true,
          }),
        );
      }

      await presRepo.save(pres);
      const updated = await presRepo.findOne({ where: { id, clinic: { id: clinicId } }, relations: ['patient', 'doctor', 'clinic', 'items'] });
      if (!updated) throw new NotFoundException('Prescripción no encontrada tras actualización');
      return updated;
    });
  }

  async setStatus(id: string, status: PrescriptionStatus, clinicId?: string, actor?: User): Promise<Prescription> {
    const pres = await this.findOne(id, clinicId);
    this.validateStatusTransition(pres, status, actor);
    pres.status = status;
    return await this.prescriptionRepository.save(pres);
  }

  async sign(id: string, clinicId?: string, actor?: User): Promise<Prescription> {
    return this.setStatus(id, PrescriptionStatus.ACTIVE, clinicId, actor);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const pres = await this.findOne(id, clinicId);
    if (pres.status === PrescriptionStatus.DISPENSED || pres.status === PrescriptionStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a dispensed or completed prescription');
    }
    await this.prescriptionRepository.softDelete(id);
  }

  async refill(id: string, clinicId?: string): Promise<Prescription> {
    const pres = await this.findOne(id, clinicId);
    const today = new Date();
    if (today > new Date(pres.expiryDate)) {
      throw new BadRequestException('Prescription is expired');
    }
    const remaining = Math.max(0, (pres as any).refillsAllowed - (pres as any).refillsUsed);
    if (remaining <= 0) {
      throw new BadRequestException('No refills remaining');
    }
    (pres as any).refillsUsed = ((pres as any).refillsUsed || 0) + 1;
    pres.status = PrescriptionStatus.DISPENSED;
    return await this.prescriptionRepository.save(pres);
  }

  private validateStatusTransition(prescription: Prescription, next: PrescriptionStatus, actor?: User): void {
    const current = prescription.status;
    if (current === next) return;

    const allowed: Record<PrescriptionStatus, PrescriptionStatus[]> = {
      [PrescriptionStatus.DRAFT]: [PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
      [PrescriptionStatus.ACTIVE]: [
        PrescriptionStatus.DISPENSED,
        PrescriptionStatus.COMPLETED,
        PrescriptionStatus.CANCELLED,
        PrescriptionStatus.EXPIRED,
      ],
      [PrescriptionStatus.DISPENSED]: [PrescriptionStatus.COMPLETED],
      [PrescriptionStatus.COMPLETED]: [],
      [PrescriptionStatus.CANCELLED]: [],
      [PrescriptionStatus.EXPIRED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }

    if (next === PrescriptionStatus.ACTIVE) {
      if (!actor) {
        throw new BadRequestException('Missing signing actor');
      }
      if (!prescription.items || prescription.items.length === 0) {
        throw new BadRequestException('Cannot sign a prescription without items');
      }
      if (new Date(prescription.expiryDate) < new Date()) {
        throw new BadRequestException('Cannot sign an expired prescription');
      }
      const roles = Array.isArray(actor.roles) ? actor.roles : [];
      const canAdminSign = roles.includes('admin') || roles.includes('super_admin');
      if (actor.id !== prescription.doctor.id && !canAdminSign) {
        throw new BadRequestException('Only prescribing doctor or admin can sign this prescription');
      }
    }
  }
}
