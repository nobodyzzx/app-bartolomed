import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { LabOrder, LabOrderItem, LabOrderStatus } from './entities/lab-order.entity';

@Injectable()
export class LabOrdersService {
  constructor(
    @InjectRepository(LabOrder)
    private readonly labOrderRepository: Repository<LabOrder>,
    @InjectRepository(LabOrderItem)
    private readonly labOrderItemRepository: Repository<LabOrderItem>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createDto: CreateLabOrderDto, createdBy?: User, scopedClinicId?: string, validatedPatient?: Patient): Promise<LabOrder> {
    if (!scopedClinicId) throw new BadRequestException('clinicId is required');
    if (createDto.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }

    const patient = validatedPatient ?? await this.patientRepository.findOne({
      where: { id: createDto.patientId, clinic: { id: scopedClinicId }, isActive: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.userRepository.findOne({ where: { id: createDto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const clinic = await this.clinicRepository.findOne({ where: { id: createDto.clinicId, isActive: true } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const entity = this.labOrderRepository.create({
      orderNumber: createDto.orderNumber,
      orderDate: new Date(createDto.orderDate),
      clinicalNotes: createDto.clinicalNotes,
      isUrgent: !!createDto.isUrgent,
      patient,
      doctor,
      clinic,
      items: (createDto.items || []) as any,
      status: LabOrderStatus.REQUESTED,
      ...(createDto.medicalRecordId ? { medicalRecord: { id: createDto.medicalRecordId } as any } : {}),
    });

    if (createdBy) entity.createdBy = createdBy;

    return await this.labOrderRepository.save(entity);
  }

  async findAll(page = 1, pageSize = 20, filter: any = {}, clinicId?: string) {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const skip = (page - 1) * pageSize;
    const qb = this.labOrderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('o.doctor', 'doctor')
      .leftJoinAndSelect('o.clinic', 'clinic')
      .leftJoinAndSelect('o.items', 'items')
      .where('clinic.id = :clinicId', { clinicId })
      .orderBy('o.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (filter.patientId) qb.andWhere('patient.id = :patientId', { patientId: filter.patientId });
    if (filter.doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId: filter.doctorId });
    if (filter.status) qb.andWhere('o.status = :status', { status: filter.status });
    if (filter.search) {
      qb.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR o.orderNumber ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string): Promise<LabOrder> {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const order = await this.labOrderRepository.findOne({
      where: { id, clinic: { id: clinicId } },
      relations: ['patient', 'doctor', 'clinic', 'items', 'items.enteredBy', 'items.validatedBy'],
    });
    if (!order) throw new NotFoundException('Lab order not found');
    return order;
  }

  async update(id: string, updateDto: UpdateLabOrderDto, clinicId?: string): Promise<LabOrder> {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const order = await this.findOne(id, clinicId);
    if (updateDto.status && updateDto.status !== order.status) {
      throw new BadRequestException('Use the status endpoint to change the order status');
    }
    if (order.status === LabOrderStatus.COMPLETED || order.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a completed or cancelled order');
    }

    if (updateDto.clinicalNotes !== undefined) order.clinicalNotes = updateDto.clinicalNotes;
    if (updateDto.isUrgent !== undefined) order.isUrgent = updateDto.isUrgent;
    if (updateDto.orderDate !== undefined) order.orderDate = new Date(updateDto.orderDate);

    return await this.labOrderRepository.save(order);
  }

  async setStatus(id: string, status: LabOrderStatus, clinicId?: string): Promise<LabOrder> {
    const order = await this.findOne(id, clinicId);
    this.validateStatusTransition(order, status);
    order.status = status;
    return await this.labOrderRepository.save(order);
  }

  async enterResult(id: string, itemId: string, dto: EnterLabResultDto, actor: User, clinicId?: string): Promise<LabOrder> {
    const order = await this.findOne(id, clinicId);
    if (order.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot enter results on a cancelled order');
    }
    const item = order.items.find((i: LabOrderItem) => i.id === itemId);
    if (!item) throw new NotFoundException('Lab order item not found');

    if (dto.resultValue !== undefined) item.resultValue = dto.resultValue;
    if (dto.resultUnit !== undefined) item.resultUnit = dto.resultUnit;
    if (dto.referenceRange !== undefined) item.referenceRange = dto.referenceRange;
    if (dto.isAbnormal !== undefined) item.isAbnormal = dto.isAbnormal;
    if (dto.resultNotes !== undefined) item.resultNotes = dto.resultNotes;
    if (dto.resultFileUrl !== undefined) item.resultFileUrl = dto.resultFileUrl;
    item.resultedAt = new Date();
    item.enteredBy = actor;

    await this.labOrderItemRepository.save(item);

    // Si todos los ítems ya tienen resultado, la orden pasa a completada automáticamente.
    const refreshed = await this.findOne(id, clinicId);
    const allResulted = refreshed.items.every((i: LabOrderItem) => !!i.resultedAt);
    if (allResulted && refreshed.status !== LabOrderStatus.COMPLETED) {
      refreshed.status = LabOrderStatus.COMPLETED;
      await this.labOrderRepository.save(refreshed);
    }

    return this.findOne(id, clinicId);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const order = await this.findOne(id, clinicId);
    if (order.status === LabOrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a completed order');
    }
    await this.labOrderRepository.softDelete(id);
  }

  private validateStatusTransition(order: LabOrder, next: LabOrderStatus): void {
    const current = order.status;
    if (current === next) return;

    const allowed: Record<LabOrderStatus, LabOrderStatus[]> = {
      [LabOrderStatus.REQUESTED]: [LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.CANCELLED],
      [LabOrderStatus.SAMPLE_COLLECTED]: [LabOrderStatus.IN_PROGRESS, LabOrderStatus.CANCELLED],
      [LabOrderStatus.IN_PROGRESS]: [LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED],
      [LabOrderStatus.COMPLETED]: [],
      [LabOrderStatus.CANCELLED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
