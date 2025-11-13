import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Like, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import {
  CreateMedicationDto,
  CreateMedicationStockDto,
  TransferStockDto,
  UpdateMedicationDto,
  UpdateMedicationStockDto,
} from '../dto/medication.dto';
import { Medication, MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Medication)
    private medicationRepository: Repository<Medication>,
    @InjectRepository(MedicationStock)
    private stockRepository: Repository<MedicationStock>,
    @InjectRepository(StockMovement)
    private movementRepository: Repository<StockMovement>,
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
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
    console.log('[BACKEND] DTO recibido:', JSON.stringify(createStockDto, null, 2));
    console.log('[BACKEND] Tipos:', {
      quantity: typeof createStockDto.quantity,
      unitCost: typeof createStockDto.unitCost,
      sellingPrice: typeof createStockDto.sellingPrice,
      minimumStock: typeof createStockDto.minimumStock,
    });

    const medication = await this.findMedicationById(createStockDto.medicationId);

    // Verificar que la clínica existe
    const clinic = await this.clinicRepository.findOne({
      where: { id: createStockDto.clinicId },
    });

    if (!clinic) {
      throw new BadRequestException(`Clinic with id ${createStockDto.clinicId} not found`);
    }

    const existingStock = await this.stockRepository.findOne({
      where: { batchNumber: createStockDto.batchNumber },
    });

    if (existingStock) {
      throw new BadRequestException('Stock with this batch number already exists');
    }

    const stockData = {
      batchNumber: createStockDto.batchNumber,
      quantity: Number(createStockDto.quantity),
      unitCost: Number(createStockDto.unitCost),
      sellingPrice: Number(createStockDto.sellingPrice),
      expiryDate: new Date(createStockDto.expiryDate),
      receivedDate: new Date(createStockDto.receivedDate),
      location: createStockDto.location || null,
      minimumStock: createStockDto.minimumStock !== undefined ? Number(createStockDto.minimumStock) : 10,
      supplierBatch: createStockDto.supplierBatch || null,
      medication,
      clinic,
      availableQuantity: Number(createStockDto.quantity),
      reservedQuantity: 0,
    };

    console.log(
      '[BACKEND] Stock data antes de crear:',
      JSON.stringify(
        {
          ...stockData,
          medication: { id: medication.id },
          clinic: { id: clinic.id },
        },
        null,
        2,
      ),
    );

    const stock = this.stockRepository.create(stockData);

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

    if (updateStockDto.expiryDate) {
      stock.expiryDate = new Date(updateStockDto.expiryDate);
    }

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

  // Transfer stock between clinics
  async transferStock(dto: TransferStockDto) {
    const source = await this.findStockById(dto.sourceStockId);

    if (!source.isActive) {
      throw new BadRequestException('Source stock is inactive');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (source.availableQuantity < dto.quantity) {
      throw new BadRequestException('Insufficient available quantity to transfer');
    }

    const toClinic = await this.clinicRepository.findOne({ where: { id: dto.toClinicId } });
    if (!toClinic) {
      throw new BadRequestException(`Destination clinic with id ${dto.toClinicId} not found`);
    }

    // Decrease from source stock
    source.quantity -= dto.quantity;
    source.availableQuantity -= dto.quantity;
    await this.stockRepository.save(source);

    // Create destination stock (clone basic attributes)
    const newBatchSuffix = `-T${Date.now()}`;
    const destStock = this.stockRepository.create({
      batchNumber: `${source.batchNumber}${newBatchSuffix}`,
      quantity: dto.quantity,
      reservedQuantity: 0,
      availableQuantity: dto.quantity,
      unitCost: Number(source.unitCost),
      sellingPrice: Number(source.sellingPrice),
      expiryDate: new Date(source.expiryDate),
      receivedDate: new Date(),
      supplierBatch: source.supplierBatch,
      location: dto.location ?? null,
      minimumStock: source.minimumStock,
      medication: source.medication,
      clinic: toClinic,
      isActive: true,
    });
    const savedDest = await this.stockRepository.save(destStock);

    // Record movements for audit trail
    const now = new Date();
    const outMovement = this.movementRepository.create({
      type: MovementType.TRANSFER,
      quantity: dto.quantity,
      unitPrice: Number(source.unitCost),
      reference: `to:${toClinic.id}`,
      reason: 'transfer_out',
      notes: dto.note ?? null,
      movementDate: now,
      stock: source,
      isActive: true,
    });
    const inMovement = this.movementRepository.create({
      type: MovementType.TRANSFER,
      quantity: dto.quantity,
      unitPrice: Number(source.unitCost),
      reference: `from:${source.clinic.id}`,
      reason: 'transfer_in',
      notes: dto.note ?? null,
      movementDate: now,
      stock: savedDest,
      isActive: true,
    });
    await this.movementRepository.save([outMovement, inMovement]);

    return {
      source,
      destination: savedDest,
      transferred: dto.quantity,
    };
  }
}
