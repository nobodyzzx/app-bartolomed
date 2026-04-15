import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Or, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { User } from '../../users/entities/user.entity';
import {
  ConfirmReceiptDto,
  CreateStockTransferDto,
  DispatchTransferDto,
  RejectTransferDto,
  ReturnTransferDto,
} from '../dto';
import {
  StockTransfer,
  StockTransferItem,
  TransferAuditAction,
  TransferAuditLog,
  TransferStatus,
} from '../entities/stock-transfer.entity';

@Injectable()
export class StockTransfersService {
  constructor(
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem)
    private readonly itemRepo: Repository<StockTransferItem>,
    @InjectRepository(TransferAuditLog)
    private readonly auditRepo: Repository<TransferAuditLog>,
    @InjectRepository(MedicationStock)
    private readonly stockRepo: Repository<MedicationStock>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateTransferNumber(): string {
    const year = new Date().getFullYear();
    const suffix = Date.now().toString().slice(-7);
    return `TRF-${year}-${suffix}`;
  }

  private async saveAudit(
    em: EntityManager,
    transferId: string,
    action: TransferAuditAction,
    actorId: string,
    actorClinicId: string,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    await em.save(TransferAuditLog, {
      transferId,
      action,
      actorId,
      actorClinicId,
      snapshot,
    } as Partial<TransferAuditLog>);
  }

  // ─── Crear Solicitud de Traspaso (Clínica B solicita a Clínica A) ─────────

  async create(dto: CreateStockTransferDto, requestedBy: User, targetClinicId: string): Promise<StockTransfer> {
    if (dto.sourceClinicId === targetClinicId) {
      throw new BadRequestException('La clínica origen y destino no pueden ser la misma');
    }

    return this.dataSource.transaction(async (em) => {
      // Validar que ambas clínicas existan y estén activas
      const [sourceClinic, targetClinic] = await Promise.all([
        em.findOne(Clinic, { where: { id: dto.sourceClinicId, isActive: true } }),
        em.findOne(Clinic, { where: { id: targetClinicId, isActive: true } }),
      ]);
      if (!sourceClinic) throw new NotFoundException('Clínica origen no encontrada');
      if (!targetClinic) throw new NotFoundException('Clínica destino no encontrada');

      // Validar que los stocks solicitados pertenezcan a la clínica origen y tengan stock disponible
      const items: Partial<StockTransferItem>[] = [];
      for (const itemDto of dto.items) {
        const stock = await em.findOne(MedicationStock, {
          where: { id: itemDto.sourceStockId, clinic: { id: dto.sourceClinicId }, isActive: true },
        });
        if (!stock) {
          throw new NotFoundException(`Stock ${itemDto.sourceStockId} no encontrado en clínica origen`);
        }
        if (stock.availableQuantity < itemDto.requestedQuantity) {
          throw new ConflictException(
            `Stock insuficiente para lote ${stock.batchNumber}: disponible ${stock.availableQuantity}, solicitado ${itemDto.requestedQuantity}`,
          );
        }
        items.push({
          sourceStockId: itemDto.sourceStockId,
          requestedQuantity: itemDto.requestedQuantity,
        });
      }

      const transfer = em.create(StockTransfer, {
        transferNumber: this.generateTransferNumber(),
        sourceClinicId: dto.sourceClinicId,
        targetClinicId,
        status: TransferStatus.REQUESTED,
        notes: dto.notes,
        requestedById: requestedBy.id,
        items: items as StockTransferItem[],
      });

      const saved = await em.save(StockTransfer, transfer);

      await this.saveAudit(em, saved.id, TransferAuditAction.REQUESTED, requestedBy.id, targetClinicId, {
        sourceClinicId: dto.sourceClinicId,
        targetClinicId,
        itemCount: dto.items.length,
      });

      return saved;
    });
  }

  // ─── Despachar (Clínica A aprueba y despacha → reserva stock) ────────────

  async dispatch(
    transferId: string,
    dispatchedBy: User,
    dto: DispatchTransferDto,
    sourceClinicId: string,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (em) => {
      // SELECT FOR UPDATE en el traspaso — previene doble despacho simultáneo
      const transfer = await em.findOne(StockTransfer, {
        where: { id: transferId, status: TransferStatus.REQUESTED, sourceClinicId },
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado o ya procesado');

      for (const { itemId, dispatchedQuantity } of dto.items) {
        const item = transfer.items.find(i => i.id === itemId);
        if (!item) throw new BadRequestException(`Ítem ${itemId} no pertenece a este traspaso`);
        if (dispatchedQuantity > item.requestedQuantity) {
          throw new BadRequestException('La cantidad despachada no puede superar la solicitada');
        }

        // SELECT FOR UPDATE en la fila de inventario — evita stock fantasma
        const stock = await em.findOne(MedicationStock, {
          where: { id: item.sourceStockId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!stock) throw new NotFoundException(`Stock ${item.sourceStockId} no encontrado`);

        const available = stock.quantity - stock.reservedQuantity;
        if (dispatchedQuantity > available) {
          throw new ConflictException(
            `Stock insuficiente para lote ${stock.batchNumber}: disponible ${available}, a despachar ${dispatchedQuantity}`,
          );
        }

        // Reservar (bloquear): no se deduce aún, solo se marca como no disponible
        stock.reservedQuantity += dispatchedQuantity;
        stock.availableQuantity = stock.quantity - stock.reservedQuantity;
        item.dispatchedQuantity = dispatchedQuantity;

        await em.save(MedicationStock, stock);
        await em.save(StockTransferItem, item);
      }

      transfer.status = TransferStatus.IN_TRANSIT;
      transfer.dispatchedById = dispatchedBy.id;
      transfer.dispatchedAt = new Date();

      const saved = await em.save(StockTransfer, transfer);

      await this.saveAudit(em, saved.id, TransferAuditAction.DISPATCHED, dispatchedBy.id, sourceClinicId, {
        items: dto.items,
      });

      return saved;
    });
  }

  // ─── Confirmar Recepción (Clínica B recibe → deduce A, suma B) ────────────

  async confirmReceipt(
    transferId: string,
    receivedBy: User,
    dto: ConfirmReceiptDto,
    targetClinicId: string,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (em) => {
      // SELECT FOR UPDATE en el traspaso — previene doble confirmación
      const transfer = await em.findOne(StockTransfer, {
        where: { id: transferId, status: TransferStatus.IN_TRANSIT, targetClinicId },
        relations: ['items', 'items.sourceStock', 'items.sourceStock.medication'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado o no está en tránsito');

      for (const { itemId, receivedQuantity } of dto.items) {
        const item = transfer.items.find(i => i.id === itemId);
        if (!item) throw new BadRequestException(`Ítem ${itemId} no pertenece a este traspaso`);
        const dispatched = item.dispatchedQuantity ?? 0;
        if (receivedQuantity > dispatched) {
          throw new BadRequestException(
            `Cantidad recibida (${receivedQuantity}) no puede superar la despachada (${dispatched})`,
          );
        }

        // SELECT FOR UPDATE en stock origen
        const sourceStock = await em.findOne(MedicationStock, {
          where: { id: item.sourceStockId },
          relations: ['medication'],
          lock: { mode: 'pessimistic_write' },
        });
        if (!sourceStock) throw new NotFoundException(`Stock origen ${item.sourceStockId} no encontrado`);

        // Deducir definitivamente de A: libera reserva y resta del total
        sourceStock.quantity       -= receivedQuantity;
        sourceStock.reservedQuantity -= dispatched;           // libera toda la reserva
        sourceStock.availableQuantity = sourceStock.quantity - sourceStock.reservedQuantity;

        // Si hubo merma (dispatched > received), la diferencia ya no se reserva
        // pero tampoco se deduce de quantity → queda registrada en el audit snapshot

        await em.save(MedicationStock, sourceStock);

        // Buscar o crear stock en clínica B con el mismo lote
        let targetStock = await em.findOne(MedicationStock, {
          where: {
            batchNumber: sourceStock.batchNumber,
            clinic: { id: targetClinicId },
          },
        });

        if (!targetStock) {
          targetStock = em.create(MedicationStock, {
            medication: sourceStock.medication,
            clinic: { id: targetClinicId } as Clinic,
            batchNumber: sourceStock.batchNumber,
            expiryDate: sourceStock.expiryDate,
            receivedDate: new Date(),
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            unitCost: sourceStock.unitCost,
            sellingPrice: sourceStock.sellingPrice,
            minimumStock: sourceStock.minimumStock,
          });
        }

        targetStock.quantity          += receivedQuantity;
        targetStock.availableQuantity  = targetStock.quantity - targetStock.reservedQuantity;

        const savedTargetStock = await em.save(MedicationStock, targetStock);

        item.receivedQuantity = receivedQuantity;
        item.targetStockId    = savedTargetStock.id;
        await em.save(StockTransferItem, item);
      }

      transfer.status      = TransferStatus.COMPLETED;
      transfer.receivedById = receivedBy.id;
      transfer.receivedAt  = new Date();

      const saved = await em.save(StockTransfer, transfer);

      await this.saveAudit(em, saved.id, TransferAuditAction.COMPLETED, receivedBy.id, targetClinicId, {
        items: dto.items,
        mermaItems: dto.items
          .map(i => {
            const transferItem = transfer.items.find(ti => ti.id === i.itemId);
            const dispatched = transferItem?.dispatchedQuantity ?? 0;
            return dispatched > i.receivedQuantity
              ? { itemId: i.itemId, merma: dispatched - i.receivedQuantity }
              : null;
          })
          .filter(Boolean),
      });

      return saved;
    });
  }

  // ─── Rechazar (Clínica A rechaza la solicitud — sin movimiento de stock) ──

  async reject(
    transferId: string,
    rejectedBy: User,
    dto: RejectTransferDto,
    sourceClinicId: string,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (em) => {
      const transfer = await em.findOne(StockTransfer, {
        where: { id: transferId, status: TransferStatus.REQUESTED, sourceClinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado o no puede rechazarse');

      transfer.status          = TransferStatus.REJECTED;
      transfer.rejectionReason = dto.reason;

      const saved = await em.save(StockTransfer, transfer);

      await this.saveAudit(em, saved.id, TransferAuditAction.REJECTED, rejectedBy.id, sourceClinicId, {
        reason: dto.reason,
      });

      return saved;
    });
  }

  // ─── Devolver (Clínica B rechaza en destino → libera reserva en A) ────────

  async returnTransfer(
    transferId: string,
    returnedBy: User,
    dto: ReturnTransferDto,
    targetClinicId: string,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (em) => {
      const transfer = await em.findOne(StockTransfer, {
        where: { id: transferId, status: TransferStatus.IN_TRANSIT, targetClinicId },
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado o no está en tránsito');

      // Liberar todas las reservas en A — el stock nunca salió físicamente
      for (const item of transfer.items) {
        const stock = await em.findOne(MedicationStock, {
          where: { id: item.sourceStockId },
          lock: { mode: 'pessimistic_write' },
        });
        if (stock && item.dispatchedQuantity) {
          stock.reservedQuantity   -= item.dispatchedQuantity;
          stock.availableQuantity   = stock.quantity - stock.reservedQuantity;
          await em.save(MedicationStock, stock);
        }
      }

      transfer.status          = TransferStatus.RETURNED;
      transfer.rejectionReason = dto.reason;

      const saved = await em.save(StockTransfer, transfer);

      await this.saveAudit(em, saved.id, TransferAuditAction.RETURNED, returnedBy.id, targetClinicId, {
        reason: dto.reason,
      });

      return saved;
    });
  }

  // ─── Consultas ────────────────────────────────────────────────────────────

  async findAll(
    clinicId: string,
    status?: TransferStatus,
    page = 1,
    limit = 20,
  ): Promise<{ data: StockTransfer[]; total: number; page: number; limit: number }> {
    const qb = this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sourceClinic', 'sourceClinic')
      .leftJoinAndSelect('t.targetClinic', 'targetClinic')
      .leftJoinAndSelect('t.requestedBy', 'requestedBy')
      .leftJoinAndSelect('t.items', 'items')
      .where('(t.source_clinic_id = :clinicId OR t.target_clinic_id = :clinicId)', { clinicId })
      .orderBy('t.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (status) {
      qb.andWhere('t.status = :status', { status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, clinicId: string): Promise<StockTransfer> {
    const transfer = await this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sourceClinic', 'sourceClinic')
      .leftJoinAndSelect('t.targetClinic', 'targetClinic')
      .leftJoinAndSelect('t.requestedBy', 'requestedBy')
      .leftJoinAndSelect('t.dispatchedBy', 'dispatchedBy')
      .leftJoinAndSelect('t.receivedBy', 'receivedBy')
      .leftJoinAndSelect('t.items', 'items')
      .leftJoinAndSelect('items.sourceStock', 'sourceStock')
      .leftJoinAndSelect('sourceStock.medication', 'medication')
      .where('t.id = :id', { id })
      .andWhere('(t.source_clinic_id = :clinicId OR t.target_clinic_id = :clinicId)', { clinicId })
      .getOne();

    if (!transfer) throw new NotFoundException('Traspaso no encontrado');
    return transfer;
  }

  async getAuditLog(transferId: string, clinicId: string): Promise<TransferAuditLog[]> {
    // Verificar acceso al traspaso
    await this.findOne(transferId, clinicId);

    return this.auditRepo.find({
      where: { transferId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Conteo de traspasos pendientes de acción para el badge de notificaciones */
  async getPendingCount(clinicId: string): Promise<{ count: number }> {
    // Pendientes para la clínica A: solicitudes que debe aprobar o rechazar
    const toDispatch = await this.transferRepo.count({
      where: { sourceClinicId: clinicId, status: TransferStatus.REQUESTED },
    });

    // Pendientes para la clínica B: traspasos en tránsito que debe confirmar o devolver
    const toReceive = await this.transferRepo.count({
      where: { targetClinicId: clinicId, status: TransferStatus.IN_TRANSIT },
    });

    return { count: toDispatch + toReceive };
  }

  /** Guard reutilizable: verifica que el usuario actúa desde la clínica correcta */
  assertSourceClinic(transfer: StockTransfer, clinicId: string): void {
    if (transfer.sourceClinicId !== clinicId) {
      throw new ForbiddenException('Esta acción solo puede realizarla la clínica origen');
    }
  }

  assertTargetClinic(transfer: StockTransfer, clinicId: string): void {
    if (transfer.targetClinicId !== clinicId) {
      throw new ForbiddenException('Esta acción solo puede realizarla la clínica destino');
    }
  }
}
