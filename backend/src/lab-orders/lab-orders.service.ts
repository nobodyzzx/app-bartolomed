import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addCalendarDays, todayInClinicTz } from '../common/utils/date-format.util';
import { ChargesService } from '../charges/charges.service';
import { ChargeOrigin } from '../charges/entities/charge.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { ServicePricesService } from '../service-prices/service-prices.service';
import { CreateLabOrderDto, CreateLabOrderItemDto } from './dto/create-lab-order.dto';
import { CreateExternalLabOrderDto } from './dto/create-external-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { LabOrder, LabOrderItem, LabOrderOrigin, LabOrderStatus, LabOrderType } from './entities/lab-order.entity';

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

  /** Orden nacida de una indicación médica de la casa: la firma un doctor real. */
  async create(
    createDto: CreateLabOrderDto,
    createdBy?: User,
    scopedClinicId?: string,
    validatedPatient?: Patient,
    orderType: LabOrderType = LabOrderType.LAB,
  ): Promise<LabOrder> {
    // Antes que nada: una orden dirigida a otra clínica se rechaza sin llegar
    // a consultar nada. Va aquí y no solo en persistOrder porque la búsqueda
    // del médico ocurre antes, y el error que se devuelve debe ser el del
    // contexto de clínica, no un "Doctor not found" que despista.
    this.assertClinicScope(createDto.clinicId, scopedClinicId);

    const doctor = await this.userRepository.findOne({ where: { id: createDto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    return this.persistOrder(
      createDto,
      { doctor, origin: LabOrderOrigin.INTERNAL, referringDoctorName: null, orderType },
      createdBy,
      scopedClinicId,
      validatedPatient,
    );
  }

  /**
   * Orden que llega de fuera: el paciente trae una orden en papel de otro
   * consultorio, o se paga el examen sin consulta previa. No hay médico de la
   * casa que la firme, así que `doctor` queda vacío y el solicitante se guarda
   * como texto — quien la registra (laboratorio o recepción) queda solo en
   * `createdBy`, nunca como quien indicó el examen.
   */
  async createExternal(
    createDto: CreateExternalLabOrderDto,
    createdBy?: User,
    scopedClinicId?: string,
    validatedPatient?: Patient,
    orderType: LabOrderType = LabOrderType.LAB,
  ): Promise<LabOrder> {
    return this.persistOrder(
      createDto,
      {
        doctor: null,
        origin: LabOrderOrigin.EXTERNAL,
        referringDoctorName: createDto.referringDoctorName.trim(),
        orderType,
      },
      createdBy,
      scopedClinicId,
      validatedPatient,
    );
  }

  private async persistOrder(
    createDto: Omit<CreateLabOrderDto, 'doctorId'>,
    requester: {
      doctor: User | null;
      origin: LabOrderOrigin;
      referringDoctorName: string | null;
      orderType: LabOrderType;
    },
    createdBy?: User,
    scopedClinicId?: string,
    validatedPatient?: Patient,
  ): Promise<LabOrder> {
    this.assertClinicScope(createDto.clinicId, scopedClinicId);

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
      doctor: requester.doctor,
      origin: requester.origin,
      orderType: requester.orderType,
      referringDoctorName: requester.referringDoctorName,
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

  private assertClinicScope(dtoClinicId: string, scopedClinicId?: string): asserts scopedClinicId is string {
    if (!scopedClinicId) throw new BadRequestException('clinicId is required');
    if (dtoClinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }
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
        providerName: string | null;
        labCategory: string | null;
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
          // Copiado, no referenciado: si mañana cambia el convenio, el informe
          // debe seguir diciendo a qué laboratorio se mandó esta orden.
          providerName: tariff?.providerName ?? null,
          // Igual con la categoría clínica: es la del tarifario en el momento
          // de pedir el estudio, no la que tenga el catálogo dentro de un año.
          labCategory: tariff?.labCategory ?? null,
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

  /**
   * Filtra siempre por módulo. El valor por defecto es `LAB` porque es lo que
   * había antes de existir los estudios especiales, pero cada endpoint pasa el
   * suyo explícito: sin ese filtro, el módulo de estudios especiales mostraría
   * los análisis clínicos del paciente, y al revés.
   */
  async findAll(
    page = 1,
    pageSize = 20,
    filter: any = {},
    clinicId?: string,
    orderType: LabOrderType = LabOrderType.LAB,
  ) {
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
      .andWhere('o.order_type = :orderType', { orderType })
      .orderBy('o.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (filter.patientId) qb.andWhere('patient.id = :patientId', { patientId: filter.patientId });
    if (filter.doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId: filter.doctorId });
    if (filter.status) qb.andWhere('o.status = :status', { status: filter.status });
    // Para el aviso al médico solicitante: órdenes con algún resultado cargado
    // desde una fecha. Sin marca de "visto", acotar por fecha es lo que hace
    // que el contador signifique algo — si no, arrastraría todo el histórico.
    // Ojo: al filtrar sobre el join, la orden solo trae los ítems que cumplen
    // la condición, así que este filtro es para contar, no para listar detalle.
    if (filter.resultedSince) {
      qb.andWhere('items.resultedAt >= :resultedSince', { resultedSince: filter.resultedSince });
    }
    if (filter.search) {
      qb.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR o.orderNumber ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string, orderType?: LabOrderType): Promise<LabOrder> {
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
        // Mismo motivo que `doctor.personalInfo`: sin esto el informe de
        // resultados firma con el email de quien lo cargó en vez de su nombre.
        'items.enteredBy.personalInfo',
        'items.validatedBy',
      ],
    });
    if (!order) throw new NotFoundException('Lab order not found');
    // Pedida desde el módulo equivocado: se responde 404 y no 403, para no
    // confirmar siquiera que la orden existe en el otro módulo.
    if (orderType && order.orderType !== orderType) {
      throw new NotFoundException('Lab order not found');
    }
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

    // Una orden "completada" sin ningún resultado es un dato falso: dice que el
    // trabajo está hecho cuando no hay nada que entregar, y ensucia cualquier
    // recuento de productividad. La orden ya se completa sola al cargar el
    // último resultado, así que llegar aquí sin ninguno es siempre un error.
    if (status === LabOrderStatus.COMPLETED) {
      const conResultado = (order.items ?? []).filter((i: LabOrderItem) => !!i.resultedAt).length;
      if (conResultado === 0) {
        throw new BadRequestException(
          'No se puede completar la orden sin ningún resultado cargado. ' +
            'Carga al menos un resultado; la orden se completa sola cuando estén todos.',
        );
      }
    }

    // Al enviar al proveedor se sella la fecha y se calcula cuándo debería
    // estar el resultado: es lo que se le dice al paciente y lo que después
    // permite ver qué órdenes se pasaron de plazo.
    if (status === LabOrderStatus.SENT_TO_PROVIDER && !order.sentToProviderAt) {
      order.sentToProviderAt = new Date();
      order.expectedResultDate = await this.estimateResultDate(order, clinicId);
    }

    order.status = status;
    return await this.labOrderRepository.save(order);
  }

  /**
   * Fecha estimada de entrega: la del estudio **más lento** de la orden, porque
   * el informe se entrega completo. Si ningún estudio declara plazo, se deja en
   * blanco antes que inventar una fecha que nadie podría cumplir.
   */
  private async estimateResultDate(
    order: LabOrder,
    clinicId?: string,
  ): Promise<string | null> {
    const ids = (order.items ?? [])
      .map((i: LabOrderItem) => i.servicePriceId)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return null;

    const precios = await Promise.all(
      ids.map(id => this.servicePricesService.findOne(id, clinicId).catch(() => null)),
    );

    const dias = precios
      .map(p => p?.turnaroundMaxDays ?? p?.turnaroundMinDays)
      .filter((d): d is number => typeof d === 'number');
    if (dias.length === 0) return null;

    // Desde el día de la clínica, no del servidor: el backend corre en UTC y a
    // partir de las 20:00 de Bolivia ya sería mañana, corriendo la estimación.
    return addCalendarDays(todayInClinicTz(), Math.max(...dias));
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

    // Un estudio especial no tiene muestra que recoger: la ecografía se le hace
    // al paciente. Exigirle pasar por `SAMPLE_COLLECTED` obligaría a marcar un
    // paso que nunca ocurre, así que arranca directo hacia el trabajo.
    const desdeSolicitada =
      order.orderType === LabOrderType.SPECIAL
        ? [LabOrderStatus.SENT_TO_PROVIDER, LabOrderStatus.IN_PROGRESS, LabOrderStatus.CANCELLED]
        : [LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.CANCELLED];

    // `SENT_TO_PROVIDER` es opcional: se usa cuando el estudio se deriva, y se
    // salta cuando la clínica lo procesa. Por eso `SAMPLE_COLLECTED` sigue
    // pudiendo ir directo a `IN_PROGRESS`.
    const allowed: Record<LabOrderStatus, LabOrderStatus[]> = {
      [LabOrderStatus.REQUESTED]: desdeSolicitada,
      [LabOrderStatus.SAMPLE_COLLECTED]: [
        LabOrderStatus.SENT_TO_PROVIDER,
        LabOrderStatus.IN_PROGRESS,
        LabOrderStatus.CANCELLED,
      ],
      [LabOrderStatus.SENT_TO_PROVIDER]: [LabOrderStatus.IN_PROGRESS, LabOrderStatus.CANCELLED],
      [LabOrderStatus.IN_PROGRESS]: [LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED],
      [LabOrderStatus.COMPLETED]: [],
      [LabOrderStatus.CANCELLED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
