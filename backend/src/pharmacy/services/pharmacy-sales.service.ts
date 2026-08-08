import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargesService } from '../../charges/charges.service';
import { ChargeOrigin, ChargeStatus } from '../../charges/entities/charge.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Prescription, PrescriptionStatus } from '../../prescriptions/entities/prescription.entity';

/**
 * Vocales acentuadas y su equivalente plano, para que la búsqueda ignore tildes.
 * El orden de los dos strings tiene que coincidir carácter a carácter: es lo que
 * espera `translate()` de Postgres.
 */
const ACCENTED = 'áéíóúüñÁÉÍÓÚÜÑ';
const UNACCENTED = 'aeiouunAEIOUUN';

function stripAccents(value: string): string {
  return value.replace(/[áéíóúüñ]/g, c => UNACCENTED[ACCENTED.indexOf(c)] ?? c);
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
import { AuditService } from '../../audit/audit.service';
import {
  AdjustPaymentDto,
  CreatePharmacySaleDto,
  UpdatePharmacySaleDto,
  UpdatePharmacySaleStatusDto,
} from '../dto/pharmacy-sale.dto';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../entities/pharmacy-sale.entity';
import { Medication, MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';
import { InventoryService } from './inventory.service';

@Injectable()
export class PharmacySalesService {
  constructor(
    @InjectRepository(PharmacySale)
    private pharmacySaleRepository: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem)
    private pharmacySaleItemRepository: Repository<PharmacySaleItem>,
    @InjectRepository(MedicationStock)
    private medicationStockRepository: Repository<MedicationStock>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    private inventoryService: InventoryService,
    private auditService: AuditService,
    private chargesService: ChargesService,
  ) {}

  /**
   * `'Cliente'` es el nombre de una venta de mostrador, sin paciente detrás.
   * Aplicarlo también cuando viene `patientId` guardaba ese literal para un
   * paciente registrado —y el cargo derivado lo heredaba—, así que se resuelve
   * contra la ficha. La UI manda el nombre y no llegaba a verse; por API sí.
   */
  private async resolvePatientName(dto: CreatePharmacySaleDto): Promise<string> {
    if (dto.patientName) return dto.patientName;
    if (!dto.patientId) return 'Cliente';

    const patient = await this.pharmacySaleRepository.manager
      .getRepository(Patient)
      .findOne({ where: { id: dto.patientId }, select: { id: true, firstName: true, lastName: true } });

    const name = `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim();
    return name || 'Cliente';
  }

  async create(
    createPharmacySaleDto: CreatePharmacySaleDto,
    soldById: string,
    clinicId: string,
  ): Promise<PharmacySale> {
    const saleNumber = await this.generateSaleNumber();

    // Validar receta si se proporciona (cross-clinic + estado ACTIVE)
    if (createPharmacySaleDto.prescriptionId) {
      const prescription = await this.prescriptionRepository.findOne({
        where: { id: createPharmacySaleDto.prescriptionId, clinic: { id: clinicId } },
      });
      if (!prescription) {
        throw new NotFoundException('Receta no encontrada o no pertenece a esta clínica');
      }
      if (prescription.status !== PrescriptionStatus.ACTIVE) {
        throw new BadRequestException(`La receta no está activa (estado actual: ${prescription.status})`);
      }
    }

    // Calculate totals
    let subtotal = 0;
    const items = createPharmacySaleDto.items.map(item => {
      const discountAmount = item.discountPercent ? (item.quantity * item.unitPrice * item.discountPercent) / 100 : 0;
      const itemSubtotal = item.quantity * item.unitPrice - discountAmount;
      subtotal += itemSubtotal;
      return {
        ...item,
        discountAmount,
        totalPrice: itemSubtotal,
      };
    });

    const discountAmount = createPharmacySaleDto.discountAmount || 0;
    const taxRate = createPharmacySaleDto.taxRate || 0.13; // Default 13% tax
    const taxAmount = (subtotal - discountAmount) * taxRate;
    const totalAmount = subtotal - discountAmount + taxAmount;

    const changeAmount = createPharmacySaleDto.amountPaid
      ? Math.max(0, createPharmacySaleDto.amountPaid - totalAmount)
      : 0;

    const pharmacySale = new PharmacySale();
    pharmacySale.saleNumber = saleNumber;
    pharmacySale.patientId = createPharmacySaleDto.patientId ?? undefined;
    pharmacySale.patientName = await this.resolvePatientName(createPharmacySaleDto);
    pharmacySale.prescriptionNumber = createPharmacySaleDto.prescriptionNumber ?? undefined;
    pharmacySale.saleDate = new Date();
    pharmacySale.paymentMethod = createPharmacySaleDto.paymentMethod;
    pharmacySale.subtotal = subtotal;
    pharmacySale.tax = taxAmount;
    pharmacySale.taxRate = taxRate;
    pharmacySale.discount = discountAmount;
    pharmacySale.total = totalAmount;
    pharmacySale.amountPaid = createPharmacySaleDto.amountPaid;
    pharmacySale.change = changeAmount;
    pharmacySale.notes = createPharmacySaleDto.notes ?? undefined;
    pharmacySale.soldById = soldById;
    pharmacySale.clinicId = clinicId;
    pharmacySale.prescriptionId = createPharmacySaleDto.prescriptionId;
    pharmacySale.status = SaleStatus.COMPLETED;

    // "A cuenta" solo tiene sentido si hay a quién cargárselo y una receta
    // detrás: una venta de mostrador se cobra en farmacia y punto.
    const chargeToAccount =
      !!createPharmacySaleDto.chargeToAccount && !!createPharmacySaleDto.prescriptionId && !!pharmacySale.patientId;

    if (createPharmacySaleDto.chargeToAccount && !chargeToAccount) {
      throw new BadRequestException('Solo se puede dejar a cuenta una venta con receta y paciente registrado');
    }

    pharmacySale.chargedToAccount = chargeToAccount;
    if (chargeToAccount) {
      // El dinero no entra por la caja de farmacia: lo cobra la caja general
      // al liquidar la cuenta del paciente.
      pharmacySale.amountPaid = 0;
      pharmacySale.change = 0;
    }

    const savedSale = await this.pharmacySaleRepository.manager.transaction(async manager => {
      const saleRepo = manager.getRepository(PharmacySale);
      const saleItemRepo = manager.getRepository(PharmacySaleItem);
      const stockRepo = manager.getRepository(MedicationStock);
      const movementRepo = manager.getRepository(StockMovement);
      const prescriptionRepo = manager.getRepository(Prescription);

      const sale = await saleRepo.save(pharmacySale);

      // Create sale items and reduce stock immediately.
      // El stock se relee CON LOCK dentro de la transacción (no se reutiliza el
      // valor cacheado antes de abrir la transacción) para evitar que dos ventas
      // concurrentes del mismo lote pasen ambas la validación con datos obsoletos
      // y dejen el stock en negativo.
      for (const itemDto of items) {
        // El lock se toma con QueryBuilder y SIN joins: Postgres rechaza
        // `FOR UPDATE` sobre el lado nullable de un outer join, y
        // `MedicationStock` tiene `medication` y `clinic` como relaciones
        // EAGER, así que un `findOne` siempre las une con LEFT JOIN. Eso hacía
        // fallar con 500 **toda** creación de venta desde que se agregó el
        // lock. El medicamento se carga después, sin lock, porque solo se usa
        // para el nombre del ítem.
        const stock = await stockRepo
          .createQueryBuilder('stock')
          .setLock('pessimistic_write')
          .where('stock.id = :id', { id: itemDto.medicationStockId })
          .getOne();

        if (!stock) {
          throw new NotFoundException(`Stock with ID ${itemDto.medicationStockId} not found`);
        }

        stock.medication =
          stock.medication ??
          ((await manager
            .getRepository(Medication)
            .createQueryBuilder('m')
            .innerJoin('medication_stock', 'ms', 'ms.medication_id = m.id')
            .where('ms.id = :stockId', { stockId: itemDto.medicationStockId })
            .getOne()) as Medication);

        const availableQty = (stock.quantity || 0) - (stock.reservedQuantity || 0);
        if (availableQty < itemDto.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${stock.medication?.name || 'product'}. Available: ${availableQty}, Requested: ${itemDto.quantity}`,
          );
        }

        const item = new PharmacySaleItem();
        item.sale = sale;
        item.saleId = sale.id;
        item.medicationStockId = itemDto.medicationStockId;
        item.productName = stock.medication?.name || 'Producto';
        item.batchNumber = itemDto.batchNumber || stock.batchNumber || '';
        item.quantity = itemDto.quantity;
        item.unitPrice = itemDto.unitPrice;
        item.discount = itemDto.discountAmount || 0;
        item.subtotal = itemDto.totalPrice;
        item.expiryDate = itemDto.expiryDate ? new Date(itemDto.expiryDate) : (stock.expiryDate ?? undefined);
        await saleItemRepo.save(item);

        // Reduce stock
        stock.quantity = stock.quantity - itemDto.quantity;
        await stockRepo.save(stock);

        const movement = new StockMovement();
        movement.stock = stock;
        movement.type = MovementType.SALE;
        movement.quantity = itemDto.quantity;
        movement.unitPrice = itemDto.unitPrice;
        movement.totalAmount = itemDto.totalPrice;
        movement.reference = saleNumber;
        movement.reason = `Venta ${saleNumber}`;
        movement.notes = createPharmacySaleDto.notes ?? undefined;
        movement.movementDate = new Date();
        await movementRepo.save(movement);
      }

      // Marcar la receta como DISPENSED tras la venta exitosa
      if (createPharmacySaleDto.prescriptionId) {
        await prescriptionRepo.update(createPharmacySaleDto.prescriptionId, {
          status: PrescriptionStatus.DISPENSED,
        });
      }

      // El cargo se crea DENTRO de la transacción: si la venta falla después
      // (por stock, por ejemplo) no puede quedar un cobro pendiente de un
      // medicamento que nunca se entregó.
      if (chargeToAccount) {
        await this.chargesService.create(
          {
            clinicId,
            patientId: sale.patientId,
            patientName: sale.patientName,
            origin: ChargeOrigin.PHARMACY,
            originId: sale.id,
            description: `Medicamentos — venta ${sale.saleNumber}`,
            listPrice: Number(sale.total),
            createdById: soldById,
          },
          manager,
        );
      }

      return sale;
    });

    return await this.findOne(savedSale.id);
  }

  async listWithFilters(options: {
    status?: SaleStatus;
    clinicId?: string;
    paymentMethod?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<PharmacySale>> {
    if (!options.clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 25;

    const qb = this.pharmacySaleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('sale.soldBy', 'soldBy')
      .orderBy('sale.createdAt', 'DESC');

    qb.andWhere('sale.clinicId = :clinicId', { clinicId: options.clinicId });

    if (options.status) {
      qb.andWhere('sale.status = :status', { status: options.status });
    }

    if (options.paymentMethod) {
      qb.andWhere('sale.paymentMethod = :pm', { pm: options.paymentMethod });
    }

    // Búsqueda por número de venta o nombre del paciente. Va en el backend
    // porque la pantalla filtraba con `MatTableDataSource.filter`, que solo mira
    // las filas de la página cargada: con 125 ventas, buscar algo de la página 3
    // devolvía "sin resultados" aunque existiera.
    if (options.search?.trim()) {
      // Insensible a mayúsculas Y a acentos: buscar "Noemi" tiene que encontrar a
      // "Noemí". Se usa `translate` en vez de la extensión `unaccent` para no
      // depender de que esté instalada en la base. Los mismos reemplazos se
      // aplican al término en JS, o el patrón nunca casaría.
      const term = `%${stripAccents(options.search.trim().toLowerCase())}%`;
      qb.andWhere(
        `(translate(LOWER(sale."saleNumber"), '${ACCENTED}', '${UNACCENTED}') LIKE :term
          OR translate(LOWER(sale."patientName"), '${ACCENTED}', '${UNACCENTED}') LIKE :term)`,
        { term },
      );
    }

    if (options.startDate) {
      const start = new Date(options.startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('sale.saleDate >= :start', { start });
    }
    if (options.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('sale.saleDate <= :end', { end });
    }

    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, clinicId?: string): Promise<PharmacySale> {
    const pharmacySale = await this.pharmacySaleRepository.findOne({
      where: { id },
      relations: ['items', 'soldBy'],
    });

    if (!pharmacySale) {
      throw new NotFoundException(`Pharmacy sale with ID ${id} not found`);
    }

    if (clinicId && pharmacySale.clinicId !== clinicId) {
      throw new ForbiddenException('Access denied to this sale');
    }

    return pharmacySale;
  }

  async update(id: string, updatePharmacySaleDto: UpdatePharmacySaleDto, clinicId: string): Promise<PharmacySale> {
    const pharmacySale = await this.findOne(id, clinicId);

    if (pharmacySale.status === SaleStatus.COMPLETED) {
      throw new BadRequestException('Cannot update completed sale');
    }

    // Update basic fields
    Object.assign(pharmacySale, {
      patientName: updatePharmacySaleDto.patientName || pharmacySale.patientName,
      patientId: updatePharmacySaleDto.patientId || pharmacySale.patientId,
      prescriptionNumber: updatePharmacySaleDto.prescriptionNumber || pharmacySale.prescriptionNumber,
      doctorName: updatePharmacySaleDto.doctorName || pharmacySale.doctorName,
      paymentMethod: updatePharmacySaleDto.paymentMethod || pharmacySale.paymentMethod,
      status: updatePharmacySaleDto.status || pharmacySale.status,
      amountPaid: updatePharmacySaleDto.amountPaid || pharmacySale.amountPaid,
      notes: updatePharmacySaleDto.notes || pharmacySale.notes,
    });

    // Update items if provided
    if (updatePharmacySaleDto.items) {
      // Remove existing items
      await this.pharmacySaleItemRepository.delete({ saleId: id });

      // Calculate new totals
      let subtotal = 0;
      for (const itemDto of updatePharmacySaleDto.items) {
        const itemDiscountAmount = itemDto.discountPercent
          ? (itemDto.quantity * itemDto.unitPrice * itemDto.discountPercent) / 100
          : 0;
        const itemSubtotal = itemDto.quantity * itemDto.unitPrice - itemDiscountAmount;
        subtotal += itemSubtotal;

        const item = this.pharmacySaleItemRepository.create({
          productName: 'Producto',
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice,
          discount: itemDiscountAmount,
          subtotal: itemSubtotal,
          batchNumber: itemDto.batchNumber,
          expiryDate: itemDto.expiryDate ? new Date(itemDto.expiryDate) : undefined,
          saleId: id,
        });
        await this.pharmacySaleItemRepository.save(item);
      }

      const discount = updatePharmacySaleDto.discount || 0;
      // Bug real (auditoría de interrelación de módulos, 2026-08-04): usaba
      // 0.13 hardcodeado en vez de la tasa con la que se creó la venta
      // (ej. una venta exenta con taxRate: 0 quedaba recalculada al 13% al
      // editar sus ítems). taxRate ahora se persiste en create().
      const tax = (subtotal - discount) * Number(pharmacySale.taxRate ?? 0.13);
      const total = subtotal - discount + tax;
      const change = pharmacySale.amountPaid ? Math.max(0, pharmacySale.amountPaid - total) : 0;

      pharmacySale.subtotal = subtotal;
      pharmacySale.discount = discount;
      pharmacySale.tax = tax;
      pharmacySale.total = total;
      pharmacySale.change = change;
    }

    await this.pharmacySaleRepository.save(pharmacySale);
    return await this.findOne(id);
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdatePharmacySaleStatusDto,
    clinicId: string,
  ): Promise<PharmacySale> {
    const pharmacySale = await this.findOne(id, clinicId);

    const previousStatus = pharmacySale.status;
    const newStatus = updateStatusDto.status;
    const cancelling = newStatus === SaleStatus.CANCELLED && previousStatus !== SaleStatus.CANCELLED;

    // El cargo se comprueba ANTES de tocar el stock: si ya está facturado hay que
    // rechazar la cancelación entera, y no dejar el inventario devuelto con una
    // venta que sigue en pie.
    const charge = cancelling && pharmacySale.chargedToAccount
      ? await this.chargesService.findByOrigin(ChargeOrigin.PHARMACY, pharmacySale.id, clinicId)
      : null;

    if (charge?.status === ChargeStatus.INVOICED) {
      throw new BadRequestException(
        `La venta ${pharmacySale.saleNumber} ya se facturó al paciente. Anula primero la factura que la incluye y vuelve a intentarlo.`,
      );
    }

    // If cancelling a sale, restore stock
    if (cancelling) {
      const saleWithItems = await this.pharmacySaleRepository.findOne({
        where: { id },
        relations: ['items'],
      });

      for (const item of saleWithItems?.items ?? []) {
        if (!item.medicationStockId) continue;

        const stock = await this.medicationStockRepository.findOne({
          where: { id: item.medicationStockId },
          relations: ['medication'],
        });

        if (!stock) continue;

        stock.quantity = stock.quantity + item.quantity;
        await this.medicationStockRepository.save(stock);

        const movement = new StockMovement();
        movement.stock = stock;
        movement.type = MovementType.ADJUSTMENT;
        movement.quantity = item.quantity;
        movement.unitPrice = item.unitPrice;
        movement.totalAmount = item.subtotal;
        movement.reference = pharmacySale.saleNumber;
        movement.reason = `Cancelación venta ${pharmacySale.saleNumber}`;
        movement.notes = updateStatusDto.notes ?? pharmacySale.notes ?? undefined;
        movement.movementDate = new Date();
        await this.stockMovementRepository.save(movement);
      }

      // El cargo a cuenta se anula con la venta: si no, el paciente arrastra el
      // cobro de un medicamento que devolvió. Antes solo se creaba el cargo y
      // nunca se deshacía.
      if (charge && charge.status !== ChargeStatus.CANCELLED) {
        await this.chargesService.cancel(
          charge.id,
          `Venta ${pharmacySale.saleNumber} cancelada`,
          clinicId,
        );
      }

      // Y la receta vuelve a estar disponible: la venta la había marcado
      // DISPENSED, así que sin esto quedaba consumida por una venta anulada y no
      // se podía volver a dispensar.
      if (pharmacySale.prescriptionId) {
        await this.prescriptionRepository.update(pharmacySale.prescriptionId, {
          status: PrescriptionStatus.ACTIVE,
        });
      }
    }

    // Update sale status
    pharmacySale.status = newStatus;

    if (updateStatusDto.amountPaid !== undefined) {
      // `total` y `change`, no `totalAmount`/`changeAmount`: esos dos no existen
      // en la entidad. Iban por `as any`, así que el compilador callaba y el
      // total leído era siempre 0 — el vuelto salía igual a lo recibido y se
      // escribía en una propiedad fantasma que ni se persistía.
      pharmacySale.amountPaid = updateStatusDto.amountPaid;
      pharmacySale.change = Math.max(0, updateStatusDto.amountPaid - Number(pharmacySale.total ?? 0));
    }

    if (updateStatusDto.notes) {
      pharmacySale.notes = updateStatusDto.notes;
    }

    await this.pharmacySaleRepository.save(pharmacySale);
    return await this.findOne(id);
  }

  async remove(id: string, clinicId: string): Promise<void> {
    const pharmacySale = await this.findOne(id, clinicId);

    if (pharmacySale.status === SaleStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete completed sale');
    }

    await this.pharmacySaleRepository.remove(pharmacySale);
  }

  async getSalesByStatus(status: SaleStatus): Promise<PharmacySale[]> {
    return await this.pharmacySaleRepository.find({
      where: { status },
      relations: ['items', 'soldBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<PharmacySale[]> {
    return await this.pharmacySaleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('sale.soldBy', 'soldBy')
      .where('sale.saleDate >= :startDate', { startDate })
      .andWhere('sale.saleDate <= :endDate', { endDate })
      .orderBy('sale.createdAt', 'DESC')
      .getMany();
  }

  async getDailySalesTotal(date: Date, clinicId?: string): Promise<number> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.pharmacySaleRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.total)', 'total')
      .where('sale.saleDate >= :startOfDay', { startOfDay })
      .andWhere('sale.saleDate <= :endOfDay', { endOfDay })
      .andWhere('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.clinicId = :clinicId', { clinicId })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  async getSalesSummary(
    startDate?: Date,
    endDate?: Date,
    clinicId?: string,
  ): Promise<{
    totalSales: number;
    completedSales: number;
    pendingSales: number;
    cancelledSales: number;
    totalRevenue: number;
    dateRange?: { startDate: Date; endDate: Date };
  }> {
    const qb = this.pharmacySaleRepository.createQueryBuilder('sale');

    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    qb.andWhere('sale.clinicId = :clinicId', { clinicId });

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('sale.saleDate >= :start', { start });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('sale.saleDate <= :end', { end });
    }

    const sales = await qb.select(['sale.id', 'sale.status', 'sale.total']).getRawMany();

    let totalSales = 0;
    let completedSales = 0;
    let pendingSales = 0;
    let cancelledSales = 0;
    let totalRevenue = 0;

    for (const row of sales) {
      totalSales++;
      const status: SaleStatus = row.sale_status;
      const total = parseFloat(row.sale_total) || 0;
      switch (status) {
        case SaleStatus.COMPLETED:
          completedSales++;
          totalRevenue += total;
          break;
        case SaleStatus.PENDING:
          pendingSales++;
          break;
        case SaleStatus.CANCELLED:
          cancelledSales++;
          break;
      }
    }

    const summary: any = { totalSales, completedSales, pendingSales, cancelledSales, totalRevenue };
    if (startDate && endDate) summary.dateRange = { startDate, endDate };
    return summary;
  }

  private async generateSaleNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');

    const count = await this.pharmacySaleRepository.count();
    const saleNumber = (count + 1).toString().padStart(4, '0');

    return `SAL-${year}${month}${day}-${saleNumber}`;
  }

  /**
   * Corrige el método de pago y/o monto de una venta completada.
   * Solo cambia datos de cobro — nunca modifica los ítems ni el total.
   * Registra un log de auditoría con los valores anteriores y nuevos.
   */
  async adjustPayment(
    id: string,
    dto: AdjustPaymentDto,
    actor: { id: string; email: string; name?: string; clinicId?: string; ip?: string },
  ): Promise<PharmacySale> {
    const sale = await this.findOne(id, actor.clinicId);

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('No se puede corregir el pago de una venta cancelada');
    }

    const before = {
      paymentMethod: sale.paymentMethod,
      amountPaid: Number(sale.amountPaid),
      change: Number(sale.change),
    };

    sale.paymentMethod = dto.paymentMethod as any;
    sale.amountPaid = dto.amountPaid;
    sale.change = Math.max(0, dto.amountPaid - Number(sale.total));
    if (!sale.notes) {
      sale.notes = dto.reason;
    } else {
      sale.notes = `${sale.notes} | Corrección: ${dto.reason}`;
    }

    await this.pharmacySaleRepository.save(sale);

    await this.auditService.log({
      action: 'PAYMENT_ADJUSTED',
      resource: 'Farmacia — Ventas',
      resourceId: id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      clinicId: actor.clinicId,
      ipAddress: actor.ip,
      method: 'PATCH',
      path: `/api/pharmacy-sales/${id}/adjust-payment`,
      statusCode: 200,
      status: 'success',
      details: {
        saleNumber: sale.saleNumber,
        before,
        after: {
          paymentMethod: sale.paymentMethod,
          amountPaid: Number(sale.amountPaid),
          change: Number(sale.change),
        },
        reason: dto.reason,
      },
    });

    return await this.findOne(id);
  }
}
