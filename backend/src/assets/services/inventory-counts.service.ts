import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import {
  CloseInventoryCountDto,
  SaveCountedItemsDto,
  StartInventoryCountDto,
} from '../dto/inventory-count.dto';
import { Asset, AssetStatus } from '../entities/asset.entity';
import {
  InventoryCount,
  InventoryCountItem,
  InventoryCountStatus,
} from '../entities/inventory-count.entity';

/** Estados que sacan el ítem del piso: no se cuentan porque ya no están. */
const FUERA_DE_PISO: AssetStatus[] = [AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST];

export interface CountSummary {
  items: number;
  contados: number;
  sinContar: number;
  coinciden: number;
  faltantes: number;
  sobrantes: number;
  unidadesEsperadas: number;
  unidadesContadas: number;
}

@Injectable()
export class InventoryCountsService {
  constructor(
    @InjectRepository(InventoryCount)
    private readonly countRepo: Repository<InventoryCount>,
    @InjectRepository(InventoryCountItem)
    private readonly itemRepo: Repository<InventoryCountItem>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Abre un conteo y **congela** lo esperado de cada ítem del ambiente.
   *
   * Congelarlo importa: si alguien edita una cantidad mientras se recorre la
   * clínica, la diferencia se sigue midiendo contra lo que había al empezar y no
   * contra un blanco móvil.
   */
  async start(dto: StartInventoryCountDto, userId: string, clinicId: string): Promise<InventoryCount> {
    const location = dto.location?.trim() || null;

    const abierto = await this.countRepo.findOne({
      where: {
        clinic: { id: clinicId },
        status: InventoryCountStatus.OPEN,
        ...(location ? { location } : {}),
      },
    });
    if (abierto) {
      throw new BadRequestException(
        location
          ? `Ya hay un conteo abierto para ${location} (${abierto.countNumber})`
          : `Ya hay un conteo abierto (${abierto.countNumber})`,
      );
    }

    const assets = await this.assetRepo.find({
      where: {
        clinic: { id: clinicId },
        isActive: true,
        status: Not(In(FUERA_DE_PISO)),
        ...(location ? { location } : {}),
      },
      order: { location: 'ASC', assetTag: 'ASC' },
    });

    if (assets.length === 0) {
      throw new BadRequestException(
        location ? `No hay ítems para contar en ${location}` : 'No hay ítems para contar',
      );
    }

    return await this.dataSource.transaction(async (em: EntityManager) => {
      const count = em.create(InventoryCount, {
        countNumber: await this.generarNumero(em),
        location: location ?? undefined,
        status: InventoryCountStatus.OPEN,
        notes: dto.notes,
        startedBy: { id: userId } as User,
        clinic: { id: clinicId } as Clinic,
      });
      const saved = await em.save(InventoryCount, count);

      const items = assets.map(a =>
        em.create(InventoryCountItem, {
          countId: saved.id,
          assetId: a.id,
          assetName: a.name,
          assetTag: a.assetTag,
          expectedQuantity: a.quantity ?? 1,
          countedQuantity: null as unknown as number,
        }),
      );
      await em.save(InventoryCountItem, items);

      // Se recarga con el EntityManager de la transacción, no con el repositorio:
      // `findOne()` consulta fuera de ella y no vería el conteo hasta el commit
      // — devolvía "Conteo no encontrado" justo después de crearlo.
      return (await em.findOne(InventoryCount, {
        where: { id: saved.id },
        relations: ['items', 'startedBy', 'clinic'],
      }))!;
    });
  }

  private async generarNumero(em: EntityManager): Promise<string> {
    // Advisory lock por transacción: dos conteos abiertos a la vez calcularían
    // el mismo correlativo y el segundo moriría contra el índice único.
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['inventory_count_number']);
    const year = new Date().getFullYear();
    const row = await em.query(
      `SELECT COUNT(*)::int AS n FROM "inventory_counts" WHERE "countNumber" LIKE $1`,
      [`CONT-${year}-%`],
    );
    return `CONT-${year}-${String(Number(row?.[0]?.n ?? 0) + 1).padStart(4, '0')}`;
  }

  async findAll(clinicId: string): Promise<InventoryCount[]> {
    return this.countRepo.find({
      where: { clinic: { id: clinicId } },
      relations: ['startedBy', 'closedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, clinicId: string): Promise<InventoryCount> {
    const count = await this.countRepo.findOne({
      where: { id, clinic: { id: clinicId } },
      relations: ['items', 'startedBy', 'closedBy', 'clinic'],
    });
    if (!count) throw new NotFoundException('Conteo no encontrado');
    count.items?.sort((a, b) => (a.assetTag ?? '').localeCompare(b.assetTag ?? ''));
    return count;
  }

  /** Carga las unidades halladas. Se puede guardar en varias tandas. */
  async saveCounted(id: string, dto: SaveCountedItemsDto, clinicId: string): Promise<InventoryCount> {
    const count = await this.findOne(id, clinicId);
    if (count.status !== InventoryCountStatus.OPEN) {
      throw new BadRequestException('El conteo ya está cerrado');
    }

    const porId = new Map(count.items.map(i => [i.id, i]));
    for (const entrada of dto.items) {
      const item = porId.get(entrada.itemId);
      if (!item) {
        throw new BadRequestException(`La línea ${entrada.itemId} no pertenece a este conteo`);
      }
      item.countedQuantity = entrada.countedQuantity;
      if (entrada.notes !== undefined) item.notes = entrada.notes;
    }

    await this.itemRepo.save(dto.items.map(e => porId.get(e.itemId)!));
    return this.findOne(id, clinicId);
  }

  /**
   * Cierra el conteo y, si se pide, ajusta el inventario a lo contado.
   *
   * Un ítem contado en 0 no se borra: pasa a `LOST`, que es lo que de verdad
   * pasó —no apareció— y deja el código y el historial en pie. Las líneas sin
   * contar no tocan nada: no contar no es lo mismo que no encontrar.
   */
  async close(
    id: string,
    dto: CloseInventoryCountDto,
    userId: string,
    clinicId: string,
  ): Promise<InventoryCount> {
    return await this.dataSource.transaction(async (em: EntityManager) => {
      const count = await em.findOne(InventoryCount, {
        where: { id, clinic: { id: clinicId } },
        relations: ['items'],
      });
      if (!count) throw new NotFoundException('Conteo no encontrado');
      if (count.status !== InventoryCountStatus.OPEN) {
        throw new BadRequestException('El conteo ya está cerrado');
      }

      if (dto.adjustInventory !== false) {
        for (const item of count.items) {
          if (item.countedQuantity === null || item.countedQuantity === undefined) continue;
          if (item.countedQuantity === item.expectedQuantity) continue;

          const asset = await em.findOne(Asset, {
            where: { id: item.assetId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!asset) continue;

          if (item.countedQuantity === 0) {
            asset.status = AssetStatus.LOST;
            asset.notes = [asset.notes, `No apareció en el conteo ${count.countNumber}.`]
              .filter(Boolean)
              .join(' ');
          } else {
            asset.quantity = item.countedQuantity;
          }
          await em.save(Asset, asset);
        }
      }

      count.status = InventoryCountStatus.CLOSED;
      count.closedBy = { id: userId } as User;
      count.closedAt = new Date();
      if (dto.notes) count.notes = dto.notes;
      await em.save(InventoryCount, count);

      return (await em.findOne(InventoryCount, {
        where: { id },
        relations: ['items', 'startedBy', 'closedBy', 'clinic'],
      }))!;
    });
  }

  async cancel(id: string, clinicId: string): Promise<InventoryCount> {
    const count = await this.findOne(id, clinicId);
    if (count.status !== InventoryCountStatus.OPEN) {
      throw new BadRequestException('Solo se pueden cancelar conteos abiertos');
    }
    count.status = InventoryCountStatus.CANCELLED;
    await this.countRepo.save(count);
    return this.findOne(id, clinicId);
  }

  /** Cifras del conteo, que son las que se miran antes de cerrarlo. */
  summarize(count: InventoryCount): CountSummary {
    const items = count.items ?? [];
    const contados = items.filter(i => i.countedQuantity !== null && i.countedQuantity !== undefined);
    return {
      items: items.length,
      contados: contados.length,
      sinContar: items.length - contados.length,
      coinciden: contados.filter(i => i.countedQuantity === i.expectedQuantity).length,
      faltantes: contados.filter(i => (i.countedQuantity ?? 0) < i.expectedQuantity).length,
      sobrantes: contados.filter(i => (i.countedQuantity ?? 0) > i.expectedQuantity).length,
      unidadesEsperadas: items.reduce((n, i) => n + i.expectedQuantity, 0),
      unidadesContadas: contados.reduce((n, i) => n + (i.countedQuantity ?? 0), 0),
    };
  }
}
