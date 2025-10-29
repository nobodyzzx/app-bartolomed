import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePharmacySaleDto, UpdatePharmacySaleDto, UpdatePharmacySaleStatusDto } from '../dto/pharmacy-sale.dto';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../entities/pharmacy-sale.entity';

@Injectable()
export class PharmacySalesService {
  constructor(
    @InjectRepository(PharmacySale)
    private pharmacySaleRepository: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem)
    private pharmacySaleItemRepository: Repository<PharmacySaleItem>,
  ) {}

  async create(createPharmacySaleDto: CreatePharmacySaleDto, soldById: string): Promise<PharmacySale> {
    const saleNumber = await this.generateSaleNumber();

    // Calculate totals
    let subtotal = 0;
    const items = createPharmacySaleDto.items.map(item => {
      const itemDiscount = item.discount || 0;
      const itemSubtotal = item.quantity * item.unitPrice - itemDiscount;
      subtotal += itemSubtotal;
      return {
        ...item,
        discount: itemDiscount,
        subtotal: itemSubtotal,
      };
    });

    const discount = createPharmacySaleDto.discount || 0;
    const tax = (subtotal - discount) * 0.13; // 13% tax
    const total = subtotal - discount + tax;

    const change = createPharmacySaleDto.amountPaid ? Math.max(0, createPharmacySaleDto.amountPaid - total) : 0;

    const pharmacySale = this.pharmacySaleRepository.create({
      saleNumber,
      patientName: createPharmacySaleDto.patientName,
      patientId: createPharmacySaleDto.patientId,
      prescriptionNumber: createPharmacySaleDto.prescriptionNumber,
      doctorName: createPharmacySaleDto.doctorName,
      saleDate: new Date(),
      paymentMethod: createPharmacySaleDto.paymentMethod,
      subtotal,
      discount,
      tax,
      total,
      amountPaid: createPharmacySaleDto.amountPaid,
      change,
      notes: createPharmacySaleDto.notes,
      soldById,
      status: SaleStatus.PENDING,
    });

    const savedSale = await this.pharmacySaleRepository.save(pharmacySale);

    // Create sale items
    for (const itemDto of items) {
      const item = this.pharmacySaleItemRepository.create({
        ...itemDto,
        saleId: savedSale.id,
      });
      await this.pharmacySaleItemRepository.save(item);
    }

    return await this.findOne(savedSale.id);
  }

  async findAll(): Promise<PharmacySale[]> {
    return await this.pharmacySaleRepository.find({
      relations: ['items', 'soldBy'],
      order: { createdAt: 'DESC' },
    });
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
        const itemDiscount = itemDto.discount || 0;
        const itemSubtotal = itemDto.quantity * itemDto.unitPrice - itemDiscount;
        subtotal += itemSubtotal;

        const item = this.pharmacySaleItemRepository.create({
          ...itemDto,
          discount: itemDiscount,
          subtotal: itemSubtotal,
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

    pharmacySale.status = updateStatusDto.status;

    if (updateStatusDto.amountPaid !== undefined) {
      pharmacySale.amountPaid = updateStatusDto.amountPaid;
      pharmacySale.change = Math.max(0, updateStatusDto.amountPaid - pharmacySale.total);
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

  async getDailySalesTotal(date: Date): Promise<number> {
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
      .getRawOne();

    return parseFloat(result.total) || 0;
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
}
