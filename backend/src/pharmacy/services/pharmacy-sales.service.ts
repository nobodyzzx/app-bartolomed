import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionStatus } from '../../prescriptions/entities/prescription.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
import { AuditService } from '../../audit/audit.service';
import { AdjustPaymentDto, CreatePharmacySaleDto, UpdatePharmacySaleDto, UpdatePharmacySaleStatusDto } from '../dto/pharmacy-sale.dto';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../entities/pharmacy-sale.entity';
import { MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';
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
  ) {}

  async create(createPharmacySaleDto: CreatePharmacySaleDto, soldById: string, clinicId: string): Promise<PharmacySale> {
    const saleNumber = await this.generateSaleNumber();

    // Validate stock availability for all items and cache results
    const stockCache = new Map<string, MedicationStock>();
    for (const itemDto of createPharmacySaleDto.items) {
      const stock = await this.medicationStockRepository.findOne({
        where: { id: itemDto.medicationStockId },
        relations: ['medication'],
      });

      if (!stock) {
        throw new NotFoundException(`Stock with ID ${itemDto.medicationStockId} not found`);
      }

      const availableQty = (stock.quantity || 0) - (stock.reservedQuantity || 0);
      if (availableQty < itemDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${stock.medication?.name || 'product'}. Available: ${availableQty}, Requested: ${itemDto.quantity}`,
        );
      }

      stockCache.set(itemDto.medicationStockId, stock);
    }

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
    pharmacySale.patientName = createPharmacySaleDto.patientName || 'Cliente';
    pharmacySale.prescriptionNumber = createPharmacySaleDto.prescriptionNumber ?? undefined;
    pharmacySale.saleDate = new Date();
    pharmacySale.paymentMethod = createPharmacySaleDto.paymentMethod;
    pharmacySale.subtotal = subtotal;
    pharmacySale.tax = taxAmount;
    pharmacySale.discount = discountAmount;
    pharmacySale.total = totalAmount;
    pharmacySale.amountPaid = createPharmacySaleDto.amountPaid;
    pharmacySale.change = changeAmount;
    pharmacySale.notes = createPharmacySaleDto.notes ?? undefined;
    pharmacySale.soldById = soldById;
    pharmacySale.clinicId = clinicId;
    pharmacySale.prescriptionId = createPharmacySaleDto.prescriptionId;
    pharmacySale.status = SaleStatus.COMPLETED;

    const savedSale = await this.pharmacySaleRepository.save(pharmacySale);

    // Create sale items and reduce stock immediately
    for (const itemDto of items) {
      const item = new PharmacySaleItem();
      const stock = stockCache.get(itemDto.medicationStockId)!;
      item.sale = pharmacySale;
      item.saleId = savedSale.id;
      item.medicationStockId = itemDto.medicationStockId;
      item.productName = stock.medication?.name || 'Producto';
      item.batchNumber = itemDto.batchNumber || stock.batchNumber || '';
      item.quantity = itemDto.quantity;
      item.unitPrice = itemDto.unitPrice;
      item.discount = itemDto.discountAmount || 0;
      item.subtotal = itemDto.totalPrice;
      item.expiryDate = itemDto.expiryDate ? new Date(itemDto.expiryDate) : (stock.expiryDate ?? undefined);
      await this.pharmacySaleItemRepository.save(item);

      // Reduce stock
      stock.quantity = stock.quantity - itemDto.quantity;
      await this.medicationStockRepository.save(stock);

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
      await this.stockMovementRepository.save(movement);
    }

    // Marcar la receta como DISPENSED tras la venta exitosa
    if (createPharmacySaleDto.prescriptionId) {
      await this.prescriptionRepository.update(
        createPharmacySaleDto.prescriptionId,
        { status: PrescriptionStatus.DISPENSED },
      );
    }

    return await this.findOne(savedSale.id);
  }

  async findAll(): Promise<PharmacySale[]> {
    // Sólo regresamos ventas completadas en modo de sólo visualización de facturación
    return await this.pharmacySaleRepository.find({
      where: { status: SaleStatus.COMPLETED },
      relations: ['items', 'soldBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async listWithFilters(options: {
    status?: SaleStatus;
    clinicId?: string;
    paymentMethod?: string;
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

  async findOne(id: string): Promise<PharmacySale> {
    const pharmacySale = await this.pharmacySaleRepository.findOne({
      where: { id },
      relations: ['items', 'soldBy'],
    });

    if (!pharmacySale) {
      throw new NotFoundException(`Pharmacy sale with ID ${id} not found`);
    }

    return pharmacySale;
  }

  async update(id: string, updatePharmacySaleDto: UpdatePharmacySaleDto): Promise<PharmacySale> {
    const pharmacySale = await this.findOne(id);

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
      const tax = (subtotal - discount) * 0.13;
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

  async updateStatus(id: string, updateStatusDto: UpdatePharmacySaleStatusDto): Promise<PharmacySale> {
    const pharmacySale = await this.findOne(id);

    const previousStatus = pharmacySale.status;
    const newStatus = updateStatusDto.status;

    // If cancelling a sale, restore stock
    if (newStatus === SaleStatus.CANCELLED && previousStatus !== SaleStatus.CANCELLED) {
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
    }

    // Update sale status
    pharmacySale.status = newStatus;

    if (updateStatusDto.amountPaid !== undefined) {
      pharmacySale.amountPaid = updateStatusDto.amountPaid;
      const total = (pharmacySale as any).totalAmount || 0;
      (pharmacySale as any).changeAmount = Math.max(0, updateStatusDto.amountPaid - total);
    }

    if (updateStatusDto.notes) {
      pharmacySale.notes = updateStatusDto.notes;
    }

    await this.pharmacySaleRepository.save(pharmacySale);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const pharmacySale = await this.findOne(id);

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
    const qb = this.pharmacySaleRepository
      .createQueryBuilder('sale');

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
    const sale = await this.findOne(id);

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('No se puede corregir el pago de una venta cancelada');
    }

    const before = {
      paymentMethod: sale.paymentMethod,
      amountPaid: Number(sale.amountPaid),
      change: Number(sale.change),
    };

    sale.paymentMethod = dto.paymentMethod as any;
    sale.amountPaid    = dto.amountPaid;
    sale.change        = Math.max(0, dto.amountPaid - Number(sale.total));
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
