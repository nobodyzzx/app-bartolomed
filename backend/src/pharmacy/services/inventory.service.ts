import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Like, Repository } from 'typeorm';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
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
    // Si no viene código, se genera aquí. Lo hacía el navegador, y no con una
    // secuencia sino con fecha y cuatro caracteres al azar (`MED-260809-K3F2`):
    // sin ver el catálogo no puede haber secuencia, así que el azar era la
    // única salida — y produce códigos ilegibles que además pueden chocar.
    const code = createMedicationDto.code?.trim()
      ? createMedicationDto.code.trim().toUpperCase()
      : await this.generateMedicationCode();

    const existingMedication = await this.medicationRepository.findOne({ where: { code } });

    if (existingMedication) {
      throw new BadRequestException('Medication with this code already exists');
    }

    const medication = this.medicationRepository.create({ ...createMedicationDto, code });
    return await this.medicationRepository.save(medication);
  }

  /**
   * Siguiente número de lote libre: `LOTE-0001`, `LOTE-0002`…
   *
   * Global y no por clínica, porque el índice único de `batchNumber` lo es: dos
   * clínicas no pueden compartir número aunque sean lotes distintos.
   *
   * Numera desde el mayor existente y no desde el total, para que dar de baja
   * un lote no haga que el siguiente choque con otro.
   */
  private async generateBatchNumber(): Promise<string> {
    const existentes = await this.stockRepository.find({ select: ['batchNumber'] });

    const patron = /^LOTE-(\d+)$/i;
    const mayor = existentes.reduce((max, { batchNumber }) => {
      const m = patron.exec(batchNumber ?? '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    return `LOTE-${String(mayor + 1).padStart(4, '0')}`;
  }

  /**
   * Siguiente código libre del catálogo: `MED-0001`, `MED-0002`…
   *
   * Cuatro dígitos porque el catálogo ya ronda los 470 productos. Sin prefijo
   * de clínica a propósito: `medications` es un catálogo **global**, y un
   * prefijo como `SB-` mentiría en cuanto una segunda clínica cargue el suyo.
   *
   * Numera desde el mayor existente y no desde el total, para que dar de baja
   * un producto no haga que el siguiente choque con otro.
   */
  private async generateMedicationCode(): Promise<string> {
    const existentes = await this.medicationRepository.find({ select: ['code'] });

    const patron = /^MED-(\d+)$/i;
    const mayor = existentes.reduce((max, { code }) => {
      const m = patron.exec(code ?? '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    return `MED-${String(mayor + 1).padStart(4, '0')}`;
  }

  async findAllMedications(page = 1, limit = 100): Promise<PaginatedResult<Medication>> {
    // Catálogo maestro global: no está aislado por clínica por diseño.
    const [data, total] = await this.medicationRepository.findAndCount({
      where: { isActive: true },
      relations: ['stock'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
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
    // Catálogo maestro global: búsqueda compartida para todas las clínicas.
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
  async addStock(createStockDto: CreateMedicationStockDto, scopedClinicId?: string): Promise<MedicationStock> {
    if (!scopedClinicId) {
      throw new BadRequestException('clinicId is required');
    }
    if (createStockDto.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }
    const medication = await this.findMedicationById(createStockDto.medicationId);

    // Verificar que la clínica existe
    const clinic = await this.clinicRepository.findOne({
      where: { id: createStockDto.clinicId, isActive: true },
    });

    if (!clinic) {
      throw new BadRequestException(`Clinic with id ${createStockDto.clinicId} not found`);
    }

    const batchNumber = createStockDto.batchNumber?.trim()
      ? createStockDto.batchNumber.trim().toUpperCase()
      : await this.generateBatchNumber();

    // Se busca **sin acotar por clínica**: el índice único de `batchNumber` es
    // global, así que un lote repetido en otra clínica también revienta, y
    // hacerlo aquí da un mensaje claro en vez de un 500 de Postgres.
    const existingStock = await this.stockRepository.findOne({ where: { batchNumber } });

    if (existingStock) {
      throw new BadRequestException(`Ya existe un lote con el número "${batchNumber}"`);
    }

    const stockData = {
      batchNumber,
      quantity: Number(createStockDto.quantity),
      unitCost: Number(createStockDto.unitCost),
      sellingPrice: Number(createStockDto.sellingPrice),
      // Sin fecha se guarda `null` ("sin registrar"), no `new Date(undefined)`,
      // que sería `Invalid Date` y revienta al persistir.
      expiryDate: createStockDto.expiryDate ? new Date(createStockDto.expiryDate) : null,
      receivedDate: new Date(createStockDto.receivedDate),
      location: createStockDto.location || undefined,
      minimumStock: createStockDto.minimumStock !== undefined ? Number(createStockDto.minimumStock) : 10,
      supplierBatch: createStockDto.supplierBatch || undefined,
      isMedicalSample: createStockDto.isMedicalSample ?? false,
      medication,
      clinic,
      availableQuantity: Number(createStockDto.quantity),
      reservedQuantity: 0,
    };

    const stock = this.stockRepository.create(stockData);
    const savedStock = await this.stockRepository.save(stock);
    await this.recordMovement(savedStock, MovementType.PURCHASE, Number(createStockDto.quantity), 'stock_entry');
    return savedStock;
  }

  async findAllStock(clinicId: string, page = 1, limit = 100): Promise<PaginatedResult<MedicationStock>> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    const [data, total] = await this.stockRepository.findAndCount({
      where: { clinic: { id: clinicId }, isActive: true },
      relations: ['medication', 'clinic'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findStockById(id: string, clinicId?: string): Promise<MedicationStock> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    const stock = await this.stockRepository.findOne({
      where: { id, isActive: true, clinic: { id: clinicId } },
      relations: ['medication', 'clinic'],
    });

    if (!stock) {
      throw new NotFoundException('Stock not found');
    }

    return stock;
  }

  async updateStock(id: string, updateStockDto: UpdateMedicationStockDto, clinicId?: string): Promise<MedicationStock> {
    const stock = await this.findStockById(id, clinicId);

    Object.assign(stock, updateStockDto);

    if (updateStockDto.expiryDate) {
      stock.expiryDate = new Date(updateStockDto.expiryDate);
    }

    if (updateStockDto.quantity !== undefined) {
      if (updateStockDto.quantity < stock.reservedQuantity) {
        throw new BadRequestException('Quantity cannot be lower than reserved quantity');
      }
      stock.availableQuantity = updateStockDto.quantity - stock.reservedQuantity;
    }

    return await this.stockRepository.save(stock);
  }

  async getLowStockItems(clinicId: string): Promise<MedicationStock[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    return await this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.medication', 'medication')
      .where('stock.clinic_id = :clinicId', { clinicId })
      .andWhere('stock.availableQuantity <= stock.minimumStock')
      .andWhere('stock.isActive = true')
      .getMany();
  }

  async getExpiringItems(clinicId: string, days: number = 30): Promise<MedicationStock[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
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

  async reserveStock(stockId: string, quantity: number, clinicId?: string): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId, clinicId);
    this.assertPositiveQuantity(quantity);

    if (stock.availableQuantity < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    stock.reservedQuantity += quantity;
    stock.availableQuantity -= quantity;

    return await this.stockRepository.save(stock);
  }

  async releaseStock(stockId: string, quantity: number, clinicId?: string): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId, clinicId);
    this.assertPositiveQuantity(quantity);

    if (stock.reservedQuantity < quantity) {
      throw new BadRequestException('Cannot release more than reserved quantity');
    }

    stock.reservedQuantity -= quantity;
    stock.availableQuantity += quantity;

    return await this.stockRepository.save(stock);
  }

  async consumeStock(stockId: string, quantity: number, clinicId?: string): Promise<MedicationStock> {
    const stock = await this.findStockById(stockId, clinicId);
    this.assertPositiveQuantity(quantity);

    if (stock.reservedQuantity < quantity) {
      throw new BadRequestException('Cannot consume more than reserved quantity');
    }

    stock.reservedQuantity -= quantity;
    stock.quantity -= quantity;
    const savedStock = await this.stockRepository.save(stock);
    await this.recordMovement(savedStock, MovementType.SALE, quantity, 'stock_consume');
    return savedStock;
  }

  // Transfer stock between clinics
  async transferStock(dto: TransferStockDto, clinicId?: string) {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    const source = await this.findStockById(dto.sourceStockId, clinicId);

    if (!source.isActive) {
      throw new BadRequestException('Source stock is inactive');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (source.availableQuantity < dto.quantity) {
      throw new BadRequestException('Insufficient available quantity to transfer');
    }
    if (dto.toClinicId === source.clinic.id) {
      throw new BadRequestException('Destination clinic must be different from source clinic');
    }

    const toClinic = await this.clinicRepository.findOne({ where: { id: dto.toClinicId, isActive: true } });
    if (!toClinic) {
      throw new BadRequestException(`Destination clinic with id ${dto.toClinicId} not found`);
    }

    const sourceClinicId = source.clinic.id;

    const { savedSource, savedDest } = await this.stockRepository.manager.transaction(async manager => {
      const stockRepo = manager.getRepository(MedicationStock);
      const movementRepo = manager.getRepository(StockMovement);

      // Decrease from source stock
      source.quantity -= dto.quantity;
      source.availableQuantity -= dto.quantity;
      const savedSource = await stockRepo.save(source);

      // Create destination stock (clone basic attributes)
      const newBatchSuffix = `-T${Date.now()}`;
      const destStock = stockRepo.create({
        batchNumber: `${source.batchNumber}${newBatchSuffix}`,
        quantity: dto.quantity,
        reservedQuantity: 0,
        availableQuantity: dto.quantity,
        unitCost: Number(source.unitCost),
        sellingPrice: Number(source.sellingPrice),
        // El lote trasladado hereda el vencimiento del origen, incluido el
        // "sin registrar": es el mismo producto físico cambiando de estante.
        expiryDate: source.expiryDate ? new Date(source.expiryDate) : null,
        receivedDate: new Date(),
        supplierBatch: source.supplierBatch,
        location: dto.location ?? undefined,
        minimumStock: source.minimumStock,
        medication: source.medication,
        clinic: toClinic,
        // También se hereda: trasladar una muestra no la convierte en comprada.
        isMedicalSample: source.isMedicalSample,
        isActive: true,
      });
      const savedDest = await stockRepo.save(destStock);

      // Record movements for audit trail
      const now = new Date();
      const outMovement = movementRepo.create({
        type: MovementType.TRANSFER,
        quantity: dto.quantity,
        unitPrice: Number(source.unitCost),
        reference: `to:${toClinic.id}`,
        reason: 'transfer_out',
        notes: dto.note ?? undefined,
        movementDate: now,
        stock: savedSource,
        isActive: true,
      });
      const inMovement = movementRepo.create({
        type: MovementType.TRANSFER,
        quantity: dto.quantity,
        unitPrice: Number(source.unitCost),
        reference: `from:${sourceClinicId}`,
        reason: 'transfer_in',
        notes: dto.note ?? undefined,
        movementDate: now,
        stock: savedDest,
        isActive: true,
      });
      await movementRepo.save([outMovement, inMovement]);

      return { savedSource, savedDest };
    });

    return {
      source: savedSource,
      destination: savedDest,
      transferred: dto.quantity,
    };
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
  }

  private async recordMovement(
    stock: MedicationStock,
    type: MovementType,
    quantity: number,
    reason: string,
  ): Promise<void> {
    const movement = this.movementRepository.create({
      type,
      quantity,
      unitPrice: Number(stock.unitCost),
      reason,
      movementDate: new Date(),
      stock,
      isActive: true,
    });
    await this.movementRepository.save(movement);
  }
}
