import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AppointmentType } from '../appointments/entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import {
  ApplyMarginDto,
  CreateServicePriceDto,
  FilterServicePricesDto,
  UpdateServicePriceDto,
} from './dto';
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

  /**
   * Catálogo para elegir un servicio al pedirlo (p. ej. el estudio de una orden
   * de laboratorio): solo precios activos y solo los campos necesarios para
   * mostrarlos y referenciarlos. Sin paginar — un tarifario de clínica son
   * decenas de filas, y quien elige necesita verlas todas.
   */
  async findCatalog(filter: FilterServicePricesDto = {}, clinicId?: string) {
    const scopedClinicId = this.requireClinicId(clinicId);

    // `labCategory` y los días de entrega viajan también: con 110 estudios el
    // selector necesita agruparlos, y "¿cuándo estará?" es lo primero que
    // pregunta el paciente. `costPrice` NO se expone: es información interna
    // del convenio, no algo que deba ver quien pide un examen.
    const qb = this.repository
      .createQueryBuilder('sp')
      .select([
        'sp.id',
        'sp.code',
        'sp.name',
        'sp.category',
        'sp.price',
        'sp.labCategory',
        'sp.turnaroundMinDays',
        'sp.turnaroundMaxDays',
        'sp.turnaroundNote',
      ])
      .where('sp.clinic_id = :clinicId', { clinicId: scopedClinicId })
      .andWhere('sp.is_active = true')
      .orderBy('sp.category', 'ASC')
      .addOrderBy('sp.labCategory', 'ASC', 'NULLS FIRST')
      .addOrderBy('sp.name', 'ASC');

    if (filter.category) qb.andWhere('sp.category = :category', { category: filter.category });

    return qb.getMany();
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

  /**
   * Resuelve el precio de un examen por su nombre. Es el puente entre el
   * `testName` de texto libre de las órdenes y el catálogo — mientras el
   * frontend no obligue a elegir del tarifario, la coincidencia por nombre es
   * lo único disponible. Insensible a mayúsculas y espacios de sobra.
   */
  async findLaboratoryPriceByName(
    testName: string,
    clinicId?: string,
  ): Promise<ServicePrice | null> {
    const scopedClinicId = this.requireClinicId(clinicId);
    if (!testName?.trim()) return null;

    return this.repository
      .createQueryBuilder('sp')
      .where('sp.clinic_id = :clinicId', { clinicId: scopedClinicId })
      .andWhere('sp.category = :category', { category: ServiceCategory.LABORATORY })
      .andWhere('sp.is_active = true')
      .andWhere('LOWER(TRIM(sp.name)) = LOWER(TRIM(:testName))', { testName })
      .getOne();
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
   * Aplica un margen sobre el costo de convenio a un grupo de estudios.
   *
   * Con `dryRun` devuelve los cambios sin guardarlos: cambiar de golpe el
   * precio de decenas de exámenes no debería confirmarse a ciegas.
   *
   * Solo alcanza a los que tienen `costPrice`; sin costo no hay margen que
   * aplicar, y ponerles precio con esta herramienta sería inventárselo.
   */
  async applyMargin(dto: ApplyMarginDto, user: User, clinicId?: string) {
    const scopedClinicId = this.requireClinicId(clinicId);
    const roundTo = dto.roundTo ?? 5;

    const qb = this.repository
      .createQueryBuilder('sp')
      .where('sp.clinic_id = :clinicId', { clinicId: scopedClinicId })
      .andWhere('sp.category = :category', { category: ServiceCategory.LABORATORY })
      .andWhere('sp.is_active = true')
      .andWhere('sp.cost_price IS NOT NULL')
      .andWhere('sp.cost_price > 0')
      .orderBy('sp.name', 'ASC');

    if (dto.labCategory) qb.andWhere('sp.lab_category = :labCategory', { labCategory: dto.labCategory });

    const objetivo = await qb.getMany();

    const cambios = objetivo
      .map(sp => {
        const costo = Number(sp.costPrice);
        const bruto = costo * (1 + dto.marginPct / 100);
        const nuevo = Math.max(0, Math.ceil(bruto / roundTo) * roundTo);
        return {
          id: sp.id,
          code: sp.code,
          name: sp.name,
          labCategory: sp.labCategory,
          costPrice: costo,
          priceFrom: Number(sp.price),
          priceTo: nuevo,
          // El margen que queda de verdad tras redondear, que es el que se
          // cobra: mostrar el pedido sería engañoso.
          effectiveMarginPct: Math.round(((nuevo - costo) / costo) * 1000) / 10,
        };
      })
      .filter(c => c.priceTo !== c.priceFrom);

    if (dto.dryRun) {
      return { applied: false, affected: cambios.length, scanned: objetivo.length, changes: cambios };
    }

    if (cambios.length > 0) {
      await this.repository.manager.transaction(async manager => {
        for (const cambio of cambios) {
          await manager.update(ServicePrice, { id: cambio.id }, { price: cambio.priceTo });
        }
      });

      // Un solo asiento con el detalle: son decenas de precios cambiados en un
      // acto administrativo, y separarlos en decenas de registros haría
      // ilegible la auditoría sin aportar nada.
      await this.auditService.log({
        action: 'BULK_MARGIN_APPLIED',
        resource: 'Tarifario',
        userId: user?.id,
        userEmail: user?.email,
        clinicId: scopedClinicId,
        method: 'POST',
        path: '/api/service-prices/apply-margin',
        statusCode: 200,
        status: 'success',
        details: {
          labCategory: dto.labCategory ?? 'TODAS',
          marginPct: dto.marginPct,
          roundTo,
          affected: cambios.length,
          changes: cambios.map(c => ({ code: c.code, from: c.priceFrom, to: c.priceTo })),
        },
      });
    }

    return { applied: true, affected: cambios.length, scanned: objetivo.length, changes: cambios };
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
