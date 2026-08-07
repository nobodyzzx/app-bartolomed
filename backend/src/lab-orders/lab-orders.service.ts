import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargesService } from '../charges/charges.service';
import { ChargeOrigin } from '../charges/entities/charge.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { ServicePricesService } from '../service-prices/service-prices.service';
import { CreateLabOrderDto, CreateLabOrderItemDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { LabOrder, LabOrderItem, LabOrderStatus } from './entities/lab-order.entity';

@Injectable()
export class LabOrdersService {
  private readonly logger = new Logger(LabOrdersService.name);

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
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    private readonly servicePricesService: ServicePricesService,
    private readonly chargesService: ChargesService,
  ) {}

  async create(createDto: CreateLabOrderDto, createdBy?: User, scopedClinicId?: string, validatedPatient?: Patient): Promise<LabOrder> {
    if (!scopedClinicId) throw new BadRequestException('clinicId is required');
    if (createDto.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }

    // El paciente puede no existir como ficha: el laboratorio recibe derivados
    // de otro consultorio. El DTO ya garantiza que venga `patientId` o
    // `patientName`.
    let patient: Patient | null = null;
    if (createDto.patientId) {
      patient =
        validatedPatient ??
        (await this.patientRepository.findOne({
          where: { id: createDto.patientId, clinic: { id: scopedClinicId }, isActive: true },
        }));
      if (!patient) throw new NotFoundException('Patient not found');
    }

    const doctor = await this.userRepository.findOne({ where: { id: createDto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const clinic = await this.clinicRepository.findOne({ where: { id: createDto.clinicId, isActive: true } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    // Bug real (auditoría de interrelación de módulos, 2026-08-04):
    // medicalRecordId se enlazaba sin validar que exista, ni que pertenezca
    // al mismo paciente/clínica de la orden — a diferencia de patient/doctor/
    // clinic, que sí se validan arriba. Permitía vincular una orden de
    // laboratorio a un expediente médico de otro paciente o de otra clínica.
    let medicalRecord: MedicalRecord | undefined;
    if (createDto.medicalRecordId) {
      if (!patient) {
        throw new BadRequestException(
          'No se puede vincular un expediente a una orden sin paciente registrado',
        );
      }
      medicalRecord = (await this.medicalRecordRepository.findOne({
        where: { id: createDto.medicalRecordId, patient: { id: patient.id }, clinic: { id: scopedClinicId } },
      })) ?? undefined;
      if (!medicalRecord) throw new NotFoundException('Medical record not found');
    }

    // Precio de cada examen resuelto contra el tarifario antes de guardar, para
    // que el ítem conserve con qué precio se pidió.
    const pricedItems = await this.resolveItemPrices(createDto.items ?? [], scopedClinicId);

    const entity = this.labOrderRepository.create({
      orderNumber: createDto.orderNumber,
      orderDate: new Date(createDto.orderDate),
      clinicalNotes: createDto.clinicalNotes,
      isUrgent: !!createDto.isUrgent,
      patient,
      patientName: patient ? null : (createDto.patientName ?? null),
      doctor,
      clinic,
      items: pricedItems as any,
      status: LabOrderStatus.REQUESTED,
      ...(medicalRecord ? { medicalRecord } : {}),
    });

    if (createdBy) entity.createdBy = createdBy;

    const saved = await this.labOrderRepository.save(entity);

    await this.createChargesForOrder(saved, scopedClinicId, createdBy?.id);

    return saved;
  }

  /**
   * Adjunta a cada examen su precio del tarifario. Si no se encuentra, el
   * examen queda sin precio y no genera cargo — pedir un análisis no puede
   * fallar porque el catálogo esté incompleto.
   */
  private async resolveItemPrices(
    items: CreateLabOrderItemDto[],
    clinicId: string,
  ): Promise<
    Array<
      Omit<CreateLabOrderItemDto, 'servicePriceId'> & {
        unitPrice: number | null;
        servicePriceId: string | null;
      }
    >
  > {
    return Promise.all(
      items.map(async item => {
        const tariff = item.servicePriceId
          ? await this.servicePricesService
              .findOne(item.servicePriceId, clinicId)
              .catch(() => null)
          : await this.servicePricesService.findLaboratoryPriceByName(item.testName, clinicId);

        return {
          ...item,
          unitPrice: tariff ? tariff.price : null,
          servicePriceId: tariff ? tariff.id : null,
        };
      }),
    );
  }

  /** Un cargo por examen con precio conocido. */
  private async createChargesForOrder(
    order: LabOrder,
    clinicId: string,
    createdById?: string,
  ): Promise<void> {
    for (const item of order.items ?? []) {
      if (item.unitPrice === null || item.unitPrice === undefined) {
        this.logger.warn(
          `Examen "${item.testName}" de la orden ${order.orderNumber} sin precio en el tarifario: no genera cargo`,
        );
        continue;
      }

      try {
        await this.chargesService.create({
          clinicId,
          patientId: order.patient?.id ?? null,
          patientName: order.patientName,
          origin: ChargeOrigin.LABORATORY,
          originId: item.id,
          servicePriceId: item.servicePriceId,
          description: item.testName,
          listPrice: item.unitPrice,
          createdById,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `No se pudo generar el cargo del examen "${item.testName}" (orden ${order.orderNumber}): ${message}`,
        );
      }
    }
  }

  async findAll(page = 1, pageSize = 20, filter: any = {}, clinicId?: string) {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    const skip = (page - 1) * pageSize;
    const qb = this.labOrderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('o.doctor', 'doctor')
      .leftJoinAndSelect('doctor.personalInfo', 'doctorPersonalInfo')
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
      // Sin `doctor.personalInfo` el detalle no tenía nombre que mostrar y caía
      // al email del médico.
      relations: [
        'patient',
        'doctor',
        'doctor.personalInfo',
        'clinic',
        'items',
        'items.enteredBy',
        'items.validatedBy',
      ],
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
