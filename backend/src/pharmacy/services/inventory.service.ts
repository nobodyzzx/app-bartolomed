import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Like, Repository } from 'typeorm';
import {
  CreateMedicationDto,
  CreateMedicationStockDto,
  UpdateMedicationDto,
  UpdateMedicationStockDto,
} from '../dto/medication.dto';
import { Medication, MedicationStock } from '../entities/pharmacy.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Medication)
    private medicationRepository: Repository<Medication>,
    @InjectRepository(MedicationStock)
    private stockRepository: Repository<MedicationStock>,
  ) {}

  // Medication CRUD
  async createMedication(createMedicationDto: CreateMedicationDto): Promise<Medication> {
    const existingMedication = await this.medicationRepository.findOne({
      where: { code: createMedicationDto.code },
    });

    if (existingMedication) {
      throw new BadRequestException('Medication with this code already exists');
    }

    const medication = this.medicationRepository.create(createMedicationDto);
    return await this.medicationRepository.save(medication);
  }

  async findAllMedications(): Promise<Medication[]> {
    return await this.medicationRepository.find({
      where: { isActive: true },
      relations: ['stock'],
    });
  }

  async findMedicationById(id: string): Promise<Medication> {
    const medication = await this.medicationRepository.findOne({
      where: { id, isActive: true },
      relations: ['stock'],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    return medication;
  }

  async updateMedication(id: string, updateMedicationDto: UpdateMedicationDto): Promise<Medication> {
    const medication = await this.findMedicationById(id);

    Object.assign(medication, updateMedicationDto);
    return await this.medicationRepository.save(medication);
  }

  async deleteMedication(id: string): Promise<void> {
    const medication = await this.findMedicationById(id);
    medication.isActive = false;
    await this.medicationRepository.save(medication);
  }

  async searchMedications(searchTerm: string): Promise<Medication[]> {
    return await this.medicationRepository.find({
      where: [
        { name: Like(`%${searchTerm}%`), isActive: true },
        { genericName: Like(`%${searchTerm}%`), isActive: true },
        { brandName: Like(`%${searchTerm}%`), isActive: true },
        { code: Like(`%${searchTerm}%`), isActive: true },
      ],
      relations: ['stock'],
    });
  }

  // Stock Management
  async addStock(createStockDto: CreateMedicationStockDto): Promise<MedicationStock> {
    const medication = await this.findMedicationById(createStockDto.medicationId);

    const existingStock = await this.stockRepository.findOne({
      where: { batchNumber: createStockDto.batchNumber },
    });

    if (existingStock) {
      throw new BadRequestException('Stock with this batch number already exists');
    }

    const stock = this.stockRepository.create({
      ...createStockDto,
      medication,
      availableQuantity: createStockDto.quantity,
    });

    return await this.stockRepository.save(stock);
  }

  async findAllStock(clinicId: string): Promise<MedicationStock[]> {
    return await this.stockRepository.find({
      where: { clinic: { id: clinicId }, isActive: true },
      relations: ['medication', 'clinic'],
    });
  }

  async findStockById(id: string): Promise<MedicationStock> {
    const stock = await this.stockRepository.findOne({
      where: { id, isActive: true },
      relations: ['medication', 'clinic'],
    });

    if (!stock) {
      throw new NotFoundException('Stock not found');
    }

    return stock;
  }

  async updateStock(id: string, updateStockDto: UpdateMedicationStockDto): Promise<MedicationStock> {
    const stock = await this.findStockById(id);

    Object.assign(stock, updateStockDto);

    if (updateStockDto.quantity !== undefined) {
      stock.availableQuantity = updateStockDto.quantity - stock.reservedQuantity;
    }

    return await this.stockRepository.save(stock);
  }

  async getLowStockItems(clinicId: string): Promise<MedicationStock[]> {
    return await this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.medication', 'medication')
      .where('stock.clinic_id = :clinicId', { clinicId })
      .andWhere('stock.availableQuantity <= stock.minimumStock')
      .andWhere('stock.isActive = true')
      .getMany();
  }

  async getExpiringItems(clinicId: string, days: number = 30): Promise<MedicationStock[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.stockRepository.find({
      where: {
        clinic: { id: clinicId },
        expiryDate: LessThanOrEqual(futureDate),
        isActive: true,
      },
      relations: ['medication'],
    });
  }

  async reserveStock(stockId: string, quantity: number): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId);

    if (stock.availableQuantity < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    stock.reservedQuantity += quantity;
    stock.availableQuantity -= quantity;

    return await this.stockRepository.save(stock);
  }

  async releaseStock(stockId: string, quantity: number): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId);

    if (stock.reservedQuantity < quantity) {
      throw new BadRequestException('Cannot release more than reserved quantity');
    }

    stock.reservedQuantity -= quantity;
    stock.availableQuantity += quantity;

    return await this.stockRepository.save(stock);
  }

  async consumeStock(stockId: string, quantity: number): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId);

    if (stock.reservedQuantity < quantity) {
      throw new BadRequestException('Cannot consume more than reserved quantity');
    }

    stock.reservedQuantity -= quantity;
    stock.quantity -= quantity;

    return await this.stockRepository.save(stock);
  }
}
