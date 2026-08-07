import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceStatusDto,
} from '../dto/pharmacy-invoice.dto';
import { InvoiceStatus, PharmacyInvoice } from '../entities/pharmacy-invoice.entity';
import { PharmacySale } from '../entities/pharmacy-sale.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PharmacyInvoicesService {
  constructor(
    @InjectRepository(PharmacyInvoice)
    private pharmacyInvoiceRepository: Repository<PharmacyInvoice>,
    @InjectRepository(PharmacySale)
    private pharmacySaleRepository: Repository<PharmacySale>,
  ) {}

  async create(
    createPharmacyInvoiceDto: CreatePharmacyInvoiceDto,
    createdById: string,
    clinicId: string,
  ): Promise<PharmacyInvoice> {
    // Verify sale exists and belongs to the current clinic
    const sale = await this.pharmacySaleRepository.findOne({
      where: { id: createPharmacyInvoiceDto.saleId },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${createPharmacyInvoiceDto.saleId} not found`);
    }

    if (sale.clinicId !== clinicId) {
      throw new ForbiddenException('Access denied to this sale');
    }

    // Check if invoice already exists for this sale
    const existingInvoice = await this.pharmacyInvoiceRepository.findOne({
      where: { saleId: createPharmacyInvoiceDto.saleId },
    });

    if (existingInvoice) {
      throw new BadRequestException(`Invoice already exists for sale ${createPharmacyInvoiceDto.saleId}`);
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    const pharmacyInvoice = this.pharmacyInvoiceRepository.create({
      invoiceNumber,
      saleId: createPharmacyInvoiceDto.saleId,
      patientName: createPharmacyInvoiceDto.patientName,
      patientAddress: createPharmacyInvoiceDto.patientAddress,
      patientPhone: createPharmacyInvoiceDto.patientPhone,
      patientEmail: createPharmacyInvoiceDto.patientEmail,
      taxId: createPharmacyInvoiceDto.taxId,
      invoiceDate: createPharmacyInvoiceDto.invoiceDate,
      dueDate: createPharmacyInvoiceDto.dueDate,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      balance: sale.total,
      notes: createPharmacyInvoiceDto.notes,
      createdById,
      status: InvoiceStatus.PENDING,
    });

    return await this.pharmacyInvoiceRepository.save(pharmacyInvoice);
  }

  async findAll(
    clinicId?: string,
    status?: InvoiceStatus,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<PharmacyInvoice>> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const qb = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .orderBy('invoice.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    qb.andWhere('sale.clinicId = :clinicId', { clinicId });

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, clinicId?: string): Promise<PharmacyInvoice> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    // PharmacySale mapea `clinic` (relación) y `clinicId` (columna escalar) a la
    // misma columna física `clinic_id`; leer `sale.clinicId` desde un objeto ya
    // hidratado por una relación anidada es ambiguo y puede llegar `undefined`.
    // Filtramos la clínica directamente en el SQL en vez de comparar post-fetch.
    const pharmacyInvoice = await this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .where('invoice.id = :id', { id })
      .andWhere('sale.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!pharmacyInvoice) {
      throw new NotFoundException(`Pharmacy invoice with ID ${id} not found`);
    }

    return pharmacyInvoice;
  }

  async findBySale(saleId: string, clinicId: string): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .where('invoice.saleId = :saleId', { saleId })
      .andWhere('sale.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!pharmacyInvoice) {
      throw new NotFoundException(`No existe una factura para la venta ${saleId}`);
    }

    return pharmacyInvoice;
  }

  async update(id: string, updatePharmacyInvoiceDto: UpdatePharmacyInvoiceDto, clinicId?: string): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.findOne(id, clinicId);

    if (pharmacyInvoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot update paid invoice');
    }

    Object.assign(pharmacyInvoice, updatePharmacyInvoiceDto);

    await this.pharmacyInvoiceRepository.save(pharmacyInvoice);
    return await this.findOne(id, clinicId);
  }

  async updateStatus(id: string, updateStatusDto: UpdatePharmacyInvoiceStatusDto, clinicId?: string): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.findOne(id, clinicId);

    pharmacyInvoice.status = updateStatusDto.status;

    if (updateStatusDto.amountPaid !== undefined) {
      pharmacyInvoice.amountPaid = updateStatusDto.amountPaid;
      pharmacyInvoice.balance = pharmacyInvoice.total - updateStatusDto.amountPaid;
    }

    if (updateStatusDto.paymentDate) {
      pharmacyInvoice.paymentDate = updateStatusDto.paymentDate;
    }

    if (updateStatusDto.paymentMethod) {
      pharmacyInvoice.paymentMethod = updateStatusDto.paymentMethod;
    }

    if (updateStatusDto.paymentReference) {
      pharmacyInvoice.paymentReference = updateStatusDto.paymentReference;
    }

    if (updateStatusDto.notes) {
      pharmacyInvoice.notes = updateStatusDto.notes;
    }

    if (updateStatusDto.status === InvoiceStatus.PAID && !pharmacyInvoice.paymentDate) {
      pharmacyInvoice.paymentDate = new Date();
    }

    await this.pharmacyInvoiceRepository.save(pharmacyInvoice);
    return await this.findOne(id, clinicId);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const pharmacyInvoice = await this.findOne(id, clinicId);

    if (pharmacyInvoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot delete paid invoice');
    }

    await this.pharmacyInvoiceRepository.remove(pharmacyInvoice);
  }

  async getOverdueInvoices(clinicId?: string): Promise<PharmacyInvoice[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const today = new Date();

    const qb = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .where('invoice.dueDate < :today', { today })
      .andWhere('invoice.status != :paidStatus', { paidStatus: InvoiceStatus.PAID })
      .andWhere('invoice.status != :cancelledStatus', { cancelledStatus: InvoiceStatus.CANCELLED })
      .orderBy('invoice.dueDate', 'ASC');

    qb.andWhere('sale.clinicId = :clinicId', { clinicId });

    return await qb.getMany();
  }

  async getTotalRevenue(startDate?: Date, endDate?: Date, clinicId?: string): Promise<number> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    let query = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.sale', 'sale')
      .select('SUM(invoice.amountPaid)', 'total')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID });

    query = query.andWhere('sale.clinicId = :clinicId', { clinicId });

    if (startDate && endDate) {
      query = query
        .andWhere('invoice.paymentDate >= :startDate', { startDate })
        .andWhere('invoice.paymentDate <= :endDate', { endDate });
    }

    const result = await query.getRawOne();
    return parseFloat(result.total) || 0;
  }

  async getPendingAmount(clinicId?: string): Promise<number> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const query = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.sale', 'sale')
      .select('SUM(invoice.balance)', 'total')
      .where('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
      });

    query.andWhere('sale.clinicId = :clinicId', { clinicId });

    const result = await query.getRawOne();

    return parseFloat(result.total) || 0;
  }

  async markOverdueInvoices(clinicId?: string): Promise<void> {
    const today = new Date();

    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const invoices = await this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.sale', 'sale')
      .select('invoice.id', 'id')
      .where('invoice.dueDate < :today', { today })
      .andWhere('invoice.status = :pendingStatus', { pendingStatus: InvoiceStatus.PENDING })
      .andWhere('sale.clinicId = :clinicId', { clinicId })
      .getRawMany();

    const ids = invoices.map(row => row.id);
    if (ids.length === 0) {
      return;
    }

    await this.pharmacyInvoiceRepository
      .createQueryBuilder()
      .update(PharmacyInvoice)
      .set({ status: InvoiceStatus.OVERDUE })
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');

    const count = await this.pharmacyInvoiceRepository.count();
    const invoiceNumber = (count + 1).toString().padStart(4, '0');

    return `INV-${year}${month}-${invoiceNumber}`;
  }
}
