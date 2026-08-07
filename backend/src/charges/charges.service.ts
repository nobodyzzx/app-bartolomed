import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppointmentType } from '../appointments/entities/appointment.entity';
import { ServicePricesService } from '../service-prices/service-prices.service';
import { Charge, ChargeOrigin, ChargeStatus } from './entities/charge.entity';

export interface CreateChargeInput {
  clinicId: string;
  patientId?: string | null;
  patientName?: string | null;
  origin: ChargeOrigin;
  originId?: string | null;
  servicePriceId?: string | null;
  description: string;
  quantity?: number;
  listPrice: number;
  createdById?: string | null;
}

@Injectable()
export class ChargesService {
  private readonly logger = new Logger(ChargesService.name);

  constructor(
    @InjectRepository(Charge)
    private readonly chargeRepository: Repository<Charge>,
    private readonly servicePricesService: ServicePricesService,
  ) {}

  private requireClinicId(clinicId?: string): string {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    return clinicId;
  }

  /**
   * `manager` permite crear el cargo dentro de la transacción del módulo que
   * lo origina, para que no quede un cargo huérfano si esa operación falla.
   */
  async create(input: CreateChargeInput, manager?: EntityManager): Promise<Charge> {
    const repo = manager ? manager.getRepository(Charge) : this.chargeRepository;
    const charge = repo.create({
      ...input,
      quantity: input.quantity ?? 1,
      patientId: input.patientId ?? null,
      patientName: input.patientName ?? null,
      originId: input.originId ?? null,
      servicePriceId: input.servicePriceId ?? null,
      createdById: input.createdById ?? null,
      unitPrice: input.listPrice,
      discountAmount: 0,
      status: ChargeStatus.PENDING,
    });
    return repo.save(charge);
  }

  /**
   * Genera el cargo de una consulta terminada.
   *
   * No lanza si algo falla: cerrar una cita es una acción clínica y no puede
   * quedar bloqueada porque el tarifario esté incompleto. Si no hay tarifa
   * configurada para ese tipo de cita, simplemente no se cobra y queda
   * registrado en el log.
   */
  async createForCompletedAppointment(params: {
    appointmentId: string;
    appointmentType: AppointmentType;
    clinicId: string;
    patientId: string;
    createdById?: string;
    manager?: EntityManager;
  }): Promise<Charge | null> {
    try {
      if (await this.existsForOrigin(ChargeOrigin.CONSULTATION, params.appointmentId, params.manager)) {
        return null; // Ya se cobró: completar dos veces no debe duplicar el cargo.
      }

      const tariff = await this.servicePricesService.findConsultationPrice(params.appointmentType, params.clinicId);
      if (!tariff) {
        this.logger.warn(
          `Cita ${params.appointmentId} completada sin tarifa configurada para "${params.appointmentType}": no se generó cargo`,
        );
        return null;
      }

      return await this.create(
        {
          clinicId: params.clinicId,
          patientId: params.patientId,
          origin: ChargeOrigin.CONSULTATION,
          originId: params.appointmentId,
          servicePriceId: tariff.id,
          description: tariff.name,
          listPrice: tariff.price,
          createdById: params.createdById,
        },
        params.manager,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo generar el cargo de la cita ${params.appointmentId}: ${message}`);
      return null;
    }
  }

  /** Cargos pendientes de un paciente: es su "cuenta abierta". */
  async findPendingByPatient(patientId: string, clinicId?: string) {
    const scopedClinicId = this.requireClinicId(clinicId);
    const items = await this.chargeRepository.find({
      where: { patientId, clinicId: scopedClinicId, status: ChargeStatus.PENDING },
      order: { createdAt: 'ASC' },
    });

    return {
      items,
      total: items.length,
      amount: Number(items.reduce((sum, c) => sum + Number(c.total), 0).toFixed(2)),
    };
  }

  async findAll(
    filter: { patientId?: string; status?: ChargeStatus; origin?: ChargeOrigin; page?: number; pageSize?: number },
    clinicId?: string,
  ) {
    const scopedClinicId = this.requireClinicId(clinicId);
    const page = Number(filter.page) > 0 ? Number(filter.page) : 1;
    const pageSize = Number(filter.pageSize) > 0 ? Number(filter.pageSize) : 50;

    const qb = this.chargeRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .where('c.clinic_id = :clinicId', { clinicId: scopedClinicId })
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filter.patientId) qb.andWhere('c.patient_id = :patientId', { patientId: filter.patientId });
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (filter.origin) qb.andWhere('c.origin = :origin', { origin: filter.origin });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string): Promise<Charge> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const charge = await this.chargeRepository.findOne({
      where: { id, clinicId: scopedClinicId },
      relations: ['patient'],
    });
    if (!charge) throw new NotFoundException(`No existe el cargo con ID ${id}`);
    return charge;
  }

  /**
   * Anula un cargo pendiente. Un cargo ya facturado no se toca: la corrección
   * pasa por la factura, no por el cargo, o los totales dejarían de cuadrar.
   */
  async cancel(id: string, reason: string, clinicId?: string): Promise<Charge> {
    const charge = await this.findOne(id, clinicId);

    if (charge.status === ChargeStatus.INVOICED) {
      throw new BadRequestException('El cargo ya está facturado; anúlelo desde la factura que lo incluye');
    }
    if (charge.status === ChargeStatus.CANCELLED) {
      throw new BadRequestException('El cargo ya está anulado');
    }

    charge.status = ChargeStatus.CANCELLED;
    charge.discountReason = reason;
    return this.chargeRepository.save(charge);
  }

  /** Evita cobrar dos veces el mismo hecho clínico. */
  private async existsForOrigin(origin: ChargeOrigin, originId: string, manager?: EntityManager): Promise<boolean> {
    const repo = manager ? manager.getRepository(Charge) : this.chargeRepository;
    const count = await repo.count({ where: { origin, originId } });
    return count > 0;
  }
}
