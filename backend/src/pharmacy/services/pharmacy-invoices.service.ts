import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceStatusDto,
} from '../dto/pharmacy-invoice.dto';
import { InvoiceStatus, PharmacyInvoice } from '../entities/pharmacy-invoice.entity';
import { PharmacySale } from '../entities/pharmacy-sale.entity';

@Injectable()
export class PharmacyInvoicesService {
  constructor(
    @InjectRepository(PharmacyInvoice)
    private pharmacyInvoiceRepository: Repository<PharmacyInvoice>,
    @InjectRepository(PharmacySale)
    private pharmacySaleRepository: Repository<PharmacySale>,
  ) {}

  async create(createPharmacyInvoiceDto: CreatePharmacyInvoiceDto, createdById: string): Promise<PharmacyInvoice> {
    // Verify sale exists
    const sale = await this.pharmacySaleRepository.findOne({
      where: { id: createPharmacyInvoiceDto.saleId },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${createPharmacyInvoiceDto.saleId} not found`);
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

  async findAll(clinicId?: string): Promise<PharmacyInvoice[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const qb = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .leftJoin('createdBy.clinic', 'clinic')
      .orderBy('invoice.createdAt', 'DESC');

    qb.andWhere('clinic.id = :clinicId', { clinicId });

    return await qb.getMany();
  }

  async findOne(id: string): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.pharmacyInvoiceRepository.findOne({
      where: { id },
      relations: ['sale', 'sale.items', 'createdBy'],
    });

    if (!pharmacyInvoice) {
      throw new NotFoundException(`Pharmacy invoice with ID ${id} not found`);
    }

    return pharmacyInvoice;
  }

  async update(id: string, updatePharmacyInvoiceDto: UpdatePharmacyInvoiceDto): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.findOne(id);

    if (pharmacyInvoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot update paid invoice');
    }

    Object.assign(pharmacyInvoice, updatePharmacyInvoiceDto);

    await this.pharmacyInvoiceRepository.save(pharmacyInvoice);
    return await this.findOne(id);
  }

  async updateStatus(id: string, updateStatusDto: UpdatePharmacyInvoiceStatusDto): Promise<PharmacyInvoice> {
    const pharmacyInvoice = await this.findOne(id);

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
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const pharmacyInvoice = await this.findOne(id);

    if (pharmacyInvoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot delete paid invoice');
    }

    await this.pharmacyInvoiceRepository.remove(pharmacyInvoice);
  }

  async getInvoicesByStatus(status: InvoiceStatus, clinicId?: string): Promise<PharmacyInvoice[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const qb = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .leftJoin('createdBy.clinic', 'clinic')
      .where('invoice.status = :status', { status })
      .orderBy('invoice.createdAt', 'DESC');

    qb.andWhere('clinic.id = :clinicId', { clinicId });

    return await qb.getMany();
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
      .leftJoin('createdBy.clinic', 'clinic')
      .where('invoice.dueDate < :today', { today })
      .andWhere('invoice.status != :paidStatus', { paidStatus: InvoiceStatus.PAID })
      .andWhere('invoice.status != :cancelledStatus', { cancelledStatus: InvoiceStatus.CANCELLED })
      .orderBy('invoice.dueDate', 'ASC');

    qb.andWhere('clinic.id = :clinicId', { clinicId });

    return await qb.getMany();
  }

  async getTotalRevenue(startDate?: Date, endDate?: Date, clinicId?: string): Promise<number> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    let query = this.pharmacyInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.createdBy', 'createdBy')
      .leftJoin('createdBy.clinic', 'clinic')
      .select('SUM(invoice.amountPaid)', 'total')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID });

    query = query.andWhere('clinic.id = :clinicId', { clinicId });

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
      .leftJoin('invoice.createdBy', 'createdBy')
      .leftJoin('createdBy.clinic', 'clinic')
      .select('SUM(invoice.balance)', 'total')
      .where('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
      });

    query.andWhere('clinic.id = :clinicId', { clinicId });

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
      .leftJoin('invoice.createdBy', 'createdBy')
      .leftJoin('createdBy.clinic', 'clinic')
      .select('invoice.id', 'id')
      .where('invoice.dueDate < :today', { today })
      .andWhere('invoice.status = :pendingStatus', { pendingStatus: InvoiceStatus.PENDING })
      .andWhere('clinic.id = :clinicId', { clinicId })
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
