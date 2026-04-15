import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import {
  ConfirmReceiptDto,
  CreateAssetTransferDto,
  DispatchTransferDto,
  FilterAssetTransfersDto,
  RejectTransferDto,
} from '../dto/asset-transfer.dto';
import {
  AssetTransfer,
  AssetTransferAuditAction,
  AssetTransferAuditLog,
  AssetTransferItem,
  AssetTransferStatus,
} from '../entities/asset-transfer.entity';
import { Asset, AssetStatus } from '../entities/asset.entity';

// Estados terminales: no se puede crear traslado para activos en estos estados
const BLOCKED_STATUSES: AssetStatus[] = [
  AssetStatus.RETIRED,
  AssetStatus.SOLD,
  AssetStatus.LOST,
  AssetStatus.DAMAGED,
  AssetStatus.INACTIVE,
];

// Traslados activos (un activo no puede estar en dos traslados activos)
const ACTIVE_TRANSFER_STATUSES: AssetTransferStatus[] = [
  AssetTransferStatus.REQUESTED,
  AssetTransferStatus.IN_TRANSIT,
];

@Injectable()
export class AssetTransfersService {
  constructor(
    @InjectRepository(AssetTransfer)
    private readonly transferRepo: Repository<AssetTransfer>,
    @InjectRepository(AssetTransferItem)
    private readonly itemRepo: Repository<AssetTransferItem>,
    @InjectRepository(AssetTransferAuditLog)
    private readonly auditRepo: Repository<AssetTransferAuditLog>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Creación ─────────────────────────────────────────────────────────────

  async create(dto: CreateAssetTransferDto, userId: string, sourceClinicId: string): Promise<AssetTransfer> {
    if (dto.targetClinicId === sourceClinicId) {
      throw new BadRequestException('La clínica de destino debe ser diferente a la de origen');
    }

    const targetClinic = await this.clinicRepo.findOne({ where: { id: dto.targetClinicId, isActive: true } });
    if (!targetClinic) {
      throw new NotFoundException('Clínica de destino no encontrada o inactiva');
    }

    // Validar activos
    const assetIds = dto.items.map(i => i.assetId);
    const assets = await this.assetRepo.find({
      where: { id: In(assetIds), isActive: true, clinic: { id: sourceClinicId } },
      relations: ['clinic'],
    });

    if (assets.length !== assetIds.length) {
      throw new BadRequestException('Uno o más activos no existen o no pertenecen a esta clínica');
    }

    for (const asset of assets) {
      if (BLOCKED_STATUSES.includes(asset.status)) {
        throw new BadRequestException(
          `El activo "${asset.name}" (${asset.assetTag}) no está disponible para traslado (estado: ${asset.status})`,
        );
      }
    }

    // Verificar que ningún activo esté en un traslado activo
    const inTransfer = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.transfer', 'transfer')
      .where('item.asset_id IN (:...assetIds)', { assetIds })
      .andWhere('transfer.status IN (:...statuses)', { statuses: ACTIVE_TRANSFER_STATUSES })
      .getMany();

    if (inTransfer.length > 0) {
      throw new BadRequestException('Uno o más activos ya tienen un traslado activo pendiente');
    }

    return await this.dataSource.transaction(async (em: EntityManager) => {
      const transferNumber = await this.generateTransferNumber(em);

      const transfer = em.create(AssetTransfer, {
        transferNumber,
        sourceClinicId,
        targetClinicId: dto.targetClinicId,
        notes: dto.notes,
        requestedById: userId,
        status: AssetTransferStatus.REQUESTED,
      });

      const saved = await em.save(AssetTransfer, transfer);

      const items = dto.items.map(i =>
        em.create(AssetTransferItem, {
          transferId: saved.id,
          assetId: i.assetId,
          notes: i.notes,
        }),
      );
      await em.save(AssetTransferItem, items);

      await this.saveAudit(em, saved.id, AssetTransferAuditAction.REQUESTED, userId, sourceClinicId, {
        targetClinicId: dto.targetClinicId,
        assetCount: items.length,
        assetTags: assets.map(a => a.assetTag),
      });

      return (await this.loadTransfer(em, saved.id))!;
    });
  }

  // ─── Listado ──────────────────────────────────────────────────────────────

  async findAll(clinicId: string, filters?: FilterAssetTransfersDto): Promise<AssetTransfer[]> {
    const qb = this.transferRepo
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.sourceClinic', 'sourceClinic')
      .leftJoinAndSelect('transfer.targetClinic', 'targetClinic')
      .leftJoinAndSelect('transfer.requestedBy', 'requestedBy')
      .leftJoinAndSelect('transfer.items', 'items')
      .leftJoinAndSelect('items.asset', 'asset')
      .where('(transfer.source_clinic_id = :clinicId OR transfer.target_clinic_id = :clinicId)', {
        clinicId,
      })
      .orderBy('transfer.createdAt', 'DESC');

    if (filters?.status) {
      qb.andWhere('transfer.status = :status', { status: filters.status });
    }

    return qb.getMany();
  }

  async findOne(id: string, clinicId: string): Promise<AssetTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: [
        'sourceClinic',
        'targetClinic',
        'requestedBy',
        'dispatchedBy',
        'receivedBy',
        'items',
        'items.asset',
      ],
    });

    if (!transfer) {
      throw new NotFoundException(`Traslado ${id} no encontrado`);
    }

    this.assertClinicAccess(transfer, clinicId);
    return transfer;
  }

  async getPendingCount(clinicId: string): Promise<{ count: number }> {
    const [awaitingDispatch, awaitingReceipt] = await Promise.all([
      // Traslados que esta clínica debe despachar
      this.transferRepo.count({
        where: { sourceClinicId: clinicId, status: AssetTransferStatus.REQUESTED },
      }),
      // Traslados que esta clínica debe confirmar recepción
      this.transferRepo.count({
        where: { targetClinicId: clinicId, status: AssetTransferStatus.IN_TRANSIT },
      }),
    ]);

    return { count: awaitingDispatch + awaitingReceipt };
  }

  async getAuditLog(id: string, clinicId: string): Promise<AssetTransferAuditLog[]> {
    await this.findOne(id, clinicId); // verifica acceso
    return this.auditRepo.find({
      where: { transferId: id },
      relations: ['actor', 'actorClinic'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── Despacho (clínica origen confirma envío) ─────────────────────────────

  async dispatch(id: string, dto: DispatchTransferDto, userId: string, clinicId: string): Promise<AssetTransfer> {
    return await this.dataSource.transaction(async (em: EntityManager) => {
      const transfer = await this.loadTransferForUpdate(em, id);

      if (transfer.status !== AssetTransferStatus.REQUESTED) {
        throw new BadRequestException('Solo se pueden despachar traslados en estado SOLICITADO');
      }
      this.assertSourceClinic(transfer, clinicId);

      // Marcar todos los activos como INACTIVE (en tránsito)
      for (const item of transfer.items) {
        const asset = await em.findOne(Asset, {
          where: { id: item.assetId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!asset) throw new NotFoundException(`Activo ${item.assetId} no encontrado`);
        asset.status = AssetStatus.INACTIVE;
        await em.save(Asset, asset);
      }

      transfer.status = AssetTransferStatus.IN_TRANSIT;
      transfer.dispatchedById = userId;
      transfer.dispatchedAt = new Date();
      if (dto.notes) transfer.notes = dto.notes;
      await em.save(AssetTransfer, transfer);

      await this.saveAudit(em, id, AssetTransferAuditAction.DISPATCHED, userId, clinicId, {
        assetCount: transfer.items.length,
        assetTags: transfer.items.map(i => i.asset?.assetTag),
      });

      return (await this.loadTransfer(em, id))!;
    });
  }

  // ─── Confirmación de recepción (clínica destino) ──────────────────────────

  async confirmReceipt(id: string, dto: ConfirmReceiptDto, userId: string, clinicId: string): Promise<AssetTransfer> {
    return await this.dataSource.transaction(async (em: EntityManager) => {
      const transfer = await this.loadTransferForUpdate(em, id);

      if (transfer.status !== AssetTransferStatus.IN_TRANSIT) {
        throw new BadRequestException('Solo se puede confirmar recepción de traslados EN TRÁNSITO');
      }
      this.assertTargetClinic(transfer, clinicId);

      // Transferir activos a la clínica destino
      for (const item of transfer.items) {
        const asset = await em.findOne(Asset, {
          where: { id: item.assetId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!asset) throw new NotFoundException(`Activo ${item.assetId} no encontrado`);
        asset.clinic = { id: transfer.targetClinicId } as Clinic;
        asset.status = AssetStatus.ACTIVE;
        await em.save(Asset, asset);
      }

      transfer.status = AssetTransferStatus.COMPLETED;
      transfer.receivedById = userId;
      transfer.receivedAt = new Date();
      if (dto.notes) transfer.notes = dto.notes;
      await em.save(AssetTransfer, transfer);

      await this.saveAudit(em, id, AssetTransferAuditAction.COMPLETED, userId, clinicId, {
        assetCount: transfer.items.length,
        targetClinicId: transfer.targetClinicId,
      });

      return (await this.loadTransfer(em, id))!;
    });
  }

  // ─── Rechazo (clínica origen rechaza la solicitud) ────────────────────────

  async reject(id: string, dto: RejectTransferDto, userId: string, clinicId: string): Promise<AssetTransfer> {
    const transfer = await this.findOne(id, clinicId);

    if (transfer.status !== AssetTransferStatus.REQUESTED) {
      throw new BadRequestException('Solo se pueden rechazar traslados en estado SOLICITADO');
    }
    this.assertSourceClinic(transfer, clinicId);

    transfer.status = AssetTransferStatus.REJECTED;
    transfer.rejectionReason = dto.reason;
    await this.transferRepo.save(transfer);

    await this.auditRepo.save(
      this.auditRepo.create({
        transferId: id,
        action: AssetTransferAuditAction.REJECTED,
        actorId: userId,
        actorClinicId: clinicId,
        snapshot: { reason: dto.reason },
      }),
    );

    return this.findOne(id, clinicId);
  }

  // ─── Devolución (clínica destino devuelve en tránsito) ────────────────────

  async returnTransfer(id: string, dto: RejectTransferDto, userId: string, clinicId: string): Promise<AssetTransfer> {
    return await this.dataSource.transaction(async (em: EntityManager) => {
      const transfer = await this.loadTransferForUpdate(em, id);

      if (transfer.status !== AssetTransferStatus.IN_TRANSIT) {
        throw new BadRequestException('Solo se pueden devolver traslados EN TRÁNSITO');
      }
      this.assertTargetClinic(transfer, clinicId);

      // Restaurar activos a ACTIVE en la clínica origen (no cambia su clinic)
      for (const item of transfer.items) {
        const asset = await em.findOne(Asset, {
          where: { id: item.assetId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!asset) throw new NotFoundException(`Activo ${item.assetId} no encontrado`);
        asset.status = AssetStatus.ACTIVE;
        await em.save(Asset, asset);
      }

      transfer.status = AssetTransferStatus.RETURNED;
      transfer.rejectionReason = dto.reason;
      await em.save(AssetTransfer, transfer);

      await this.saveAudit(em, id, AssetTransferAuditAction.RETURNED, userId, clinicId, {
        reason: dto.reason,
        assetCount: transfer.items.length,
      });

      return (await this.loadTransfer(em, id))!;
    });
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async generateTransferNumber(em: EntityManager): Promise<string> {
    const year = new Date().getFullYear();
    const count = await em.count(AssetTransfer);
    const seq = String(count + 1).padStart(6, '0');
    return `TRA-${year}-${seq}`;
  }

  private async loadTransfer(em: EntityManager, id: string): Promise<AssetTransfer | null> {
    return em.findOne(AssetTransfer, {
      where: { id },
      relations: ['sourceClinic', 'targetClinic', 'requestedBy', 'dispatchedBy', 'receivedBy', 'items', 'items.asset'],
    });
  }

  private async loadTransferForUpdate(em: EntityManager, id: string): Promise<AssetTransfer> {
    const transfer = await em.findOne(AssetTransfer, {
      where: { id },
      relations: ['items', 'items.asset'],
      lock: { mode: 'pessimistic_write' },
    });
    if (!transfer) {
      throw new NotFoundException(`Traslado ${id} no encontrado`);
    }
    return transfer;
  }

  private assertClinicAccess(transfer: AssetTransfer, clinicId: string): void {
    if (transfer.sourceClinicId !== clinicId && transfer.targetClinicId !== clinicId) {
      throw new NotFoundException(`Traslado ${transfer.id} no encontrado`);
    }
  }

  private assertSourceClinic(transfer: AssetTransfer, clinicId: string): void {
    if (transfer.sourceClinicId !== clinicId) {
      throw new BadRequestException('Solo la clínica de origen puede ejecutar esta acción');
    }
  }

  private assertTargetClinic(transfer: AssetTransfer, clinicId: string): void {
    if (transfer.targetClinicId !== clinicId) {
      throw new BadRequestException('Solo la clínica de destino puede ejecutar esta acción');
    }
  }

  private async saveAudit(
    em: EntityManager,
    transferId: string,
    action: AssetTransferAuditAction,
    actorId: string,
    actorClinicId: string,
    snapshot: Record<string, any>,
  ): Promise<void> {
    await em.save(
      AssetTransferAuditLog,
      em.create(AssetTransferAuditLog, { transferId, action, actorId, actorClinicId, snapshot }),
    );
  }
}
