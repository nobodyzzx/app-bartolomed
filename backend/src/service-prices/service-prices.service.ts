import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AppointmentType } from '../appointments/entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import { CreateServicePriceDto, FilterServicePricesDto, UpdateServicePriceDto } from './dto';
import { ServiceCategory, ServicePrice } from './entities/service-price.entity';

@Injectable()
export class ServicePricesService {
  constructor(
    @InjectRepository(ServicePrice)
    private readonly repository: Repository<ServicePrice>,
    private readonly auditService: AuditService,
  ) {}

  private requireClinicId(clinicId?: string): string {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    return clinicId;
  }

  async create(dto: CreateServicePriceDto, user: User, clinicId?: string): Promise<ServicePrice> {
    const scopedClinicId = this.requireClinicId(clinicId);
    await this.assertCodeIsFree(dto.code, scopedClinicId);

    // El alta no se audita a mano: `AuditInterceptor` ya registra toda
    // mutación (POST/PATCH/PUT/DELETE) de forma global. Solo el cambio de
    // precio necesita log propio, porque requiere el valor anterior.
    const entity = this.repository.create({
      ...dto,
      appointmentType: this.normalizeAppointmentType(dto.category, dto.appointmentType),
      clinicId: scopedClinicId,
    });
    return this.repository.save(entity);
  }

  async findAll(filter: FilterServicePricesDto = {}, clinicId?: string) {
    const scopedClinicId = this.requireClinicId(clinicId);
    const page = Number(filter.page) > 0 ? Number(filter.page) : 1;
    const pageSize = Number(filter.pageSize) > 0 ? Number(filter.pageSize) : 50;

    const qb = this.repository
      .createQueryBuilder('sp')
      .where('sp.clinic_id = :clinicId', { clinicId: scopedClinicId })
      .orderBy('sp.category', 'ASC')
      .addOrderBy('sp.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filter.category) qb.andWhere('sp.category = :category', { category: filter.category });
    if (filter.appointmentType) {
      qb.andWhere('sp.appointment_type = :appointmentType', {
        appointmentType: filter.appointmentType,
      });
    }
    if (filter.isActive !== undefined) {
      qb.andWhere('sp.is_active = :isActive', { isActive: filter.isActive === 'true' });
    }
    if (filter.search) {
      qb.andWhere('(sp.code ILIKE :search OR sp.name ILIKE :search)', {
        search: `%${filter.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string): Promise<ServicePrice> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const found = await this.repository.findOne({ where: { id, clinicId: scopedClinicId } });
    if (!found) throw new NotFoundException(`No existe el precio con ID ${id}`);
    return found;
  }

  /**
   * Resuelve la tarifa vigente de un tipo de cita. Lo consumirá la Fase 2 al
   * generar el cargo de una consulta completada; devuelve `null` en vez de
   * lanzar para que una cita sin tarifa configurada no bloquee su cierre.
   */
  async findConsultationPrice(appointmentType: AppointmentType, clinicId?: string): Promise<ServicePrice | null> {
    const scopedClinicId = this.requireClinicId(clinicId);
    return this.repository.findOne({
      where: {
        clinicId: scopedClinicId,
        category: ServiceCategory.CONSULTATION,
        appointmentType,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateServicePriceDto, user: User, clinicId?: string): Promise<ServicePrice> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const existing = await this.findOne(id, scopedClinicId);

    if (dto.code && dto.code !== existing.code) {
      await this.assertCodeIsFree(dto.code, scopedClinicId, id);
    }

    const previousPrice = existing.price;
    const category = dto.category ?? existing.category;
    Object.assign(existing, dto, {
      appointmentType: this.normalizeAppointmentType(
        category,
        dto.appointmentType ?? existing.appointmentType ?? undefined,
      ),
    });
    const saved = await this.repository.save(existing);

    // Único log manual del módulo: `AuditInterceptor` registra el PATCH pero
    // no puede saber el precio anterior, y sin ese dato no se puede
    // reconstruir con qué tarifa se cobró en cada momento.
    if (previousPrice !== saved.price) {
      await this.auditService.log({
        action: 'PRICE_CHANGED',
        resource: 'Tarifario',
        resourceId: saved.id,
        userId: user?.id,
        userEmail: user?.email,
        clinicId: scopedClinicId,
        method: 'PATCH',
        path: `/api/service-prices/${saved.id}`,
        statusCode: 200,
        status: 'success',
        details: { code: saved.code, name: saved.name, priceFrom: previousPrice, priceTo: saved.price },
      });
    }

    return saved;
  }

  /**
   * Baja lógica. Nunca borrado físico: los cargos ya generados guardan su
   * propio precio, pero el histórico del tarifario debe seguir consultable.
   */
  async remove(id: string, clinicId?: string): Promise<void> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const existing = await this.findOne(id, scopedClinicId);
    await this.repository.softRemove(existing);
  }

  private async assertCodeIsFree(code: string, clinicId: string, exceptId?: string): Promise<void> {
    const duplicate = await this.repository.findOne({
      where: exceptId ? { code, clinicId, id: Not(exceptId) } : { code, clinicId },
      withDeleted: true,
    });
    if (duplicate) {
      throw new ConflictException(`Ya existe un servicio con el código "${code}" en esta clínica`);
    }
  }

  /** `appointmentType` solo tiene sentido en consultas; en el resto se anula. */
  private normalizeAppointmentType(
    category: ServiceCategory,
    appointmentType?: AppointmentType,
  ): AppointmentType | null {
    return category === ServiceCategory.CONSULTATION ? (appointmentType ?? null) : null;
  }
}
