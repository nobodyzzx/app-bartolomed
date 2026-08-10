import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { FilterMovementsDto, MoveAssetDto } from '../dto/asset-movement.dto';
import { AssetMovement } from '../entities/asset-movement.entity';
import { Asset, AssetStatus } from '../entities/asset.entity';
import { User } from '../../users/entities/user.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Estados en los que el ítem ya no está en el piso y no tiene sentido moverlo. */
const FUERA_DE_PISO: AssetStatus[] = [AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST];

@Injectable()
export class AssetMovementsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetMovement)
    private readonly movementRepo: Repository<AssetMovement>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Traspasa unidades de un ítem a otro ambiente de la misma clínica.
   *
   * Total (o si no se indica cantidad): el ítem cambia de ambiente y conserva su
   * código, que es lo que espera quien lo tiene rotulado.
   *
   * Parcial: se restan del origen y se suman al ítem equivalente del destino —
   * mismo nombre y mismo ambiente—, o se crea uno nuevo si no existía. Sin esa
   * fusión, mover 2 sillas dos veces dejaría dos filas de 2 en vez de una de 4,
   * que es justo lo que un inventario por existencias no debe permitir.
   */
  async move(assetId: string, dto: MoveAssetDto, userId: string, clinicId: string): Promise<AssetMovement> {
    const destino = dto.toLocation.trim();
    if (!destino) {
      throw new BadRequestException('El ambiente de destino es obligatorio');
    }

    return await this.dataSource.transaction(async (em: EntityManager) => {
      const asset = await em.findOne(Asset, {
        where: { id: assetId, isActive: true, clinic: { id: clinicId } },
        relations: ['clinic'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) throw new NotFoundException('Activo no encontrado');

      if (FUERA_DE_PISO.includes(asset.status)) {
        throw new BadRequestException(
          `"${asset.name}" está dado de baja (${asset.status}) y no se puede mover`,
        );
      }

      const origen = asset.location?.trim() ?? null;
      if (origen === destino) {
        throw new BadRequestException(`"${asset.name}" ya está en ${destino}`);
      }

      const disponibles = asset.quantity ?? 1;
      const mueve = dto.quantity ?? disponibles;
      if (mueve > disponibles) {
        throw new BadRequestException(
          `No se pueden mover ${mueve} unidades de "${asset.name}": hay ${disponibles}`,
        );
      }

      let targetAssetId: string | null = null;

      if (mueve === disponibles) {
        asset.location = destino;
        await em.save(Asset, asset);
        targetAssetId = asset.id;
      } else {
        asset.quantity = disponibles - mueve;
        await em.save(Asset, asset);
        targetAssetId = (await this.sumarEnDestino(em, asset, mueve, destino, clinicId, userId)).id;
      }

      const movimiento = em.create(AssetMovement, {
        assetId: asset.id,
        assetName: asset.name,
        fromLocation: origen ?? undefined,
        toLocation: destino,
        quantity: mueve,
        targetAssetId: targetAssetId ?? undefined,
        notes: dto.notes,
        movedBy: { id: userId } as User,
        clinic: { id: clinicId } as Clinic,
      });
      return await em.save(AssetMovement, movimiento);
    });
  }

  private async sumarEnDestino(
    em: EntityManager,
    origen: Asset,
    unidades: number,
    destino: string,
    clinicId: string,
    userId: string,
  ): Promise<Asset> {
    const existente = await em.findOne(Asset, {
      where: {
        name: origen.name,
        location: destino,
        isActive: true,
        status: AssetStatus.ACTIVE,
        clinic: { id: clinicId },
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (existente) {
      existente.quantity = (existente.quantity ?? 0) + unidades;
      return await em.save(Asset, existente);
    }

    const nuevo = em.create(Asset, {
      assetTag: await this.generarCodigo(em),
      name: origen.name,
      quantity: unidades,
      type: origen.type,
      status: AssetStatus.ACTIVE,
      condition: origen.condition,
      manufacturer: origen.manufacturer,
      model: origen.model,
      location: destino,
      notes: origen.notes,
      isActive: true,
      clinic: { id: clinicId } as Clinic,
      createdBy: { id: userId } as User,
    });
    return await em.save(Asset, nuevo);
  }

  /**
   * Código para el ítem que nace de un traspaso parcial. Sigue la numeración
   * `AF-0001` del inventario, contando desde el mayor existente para no chocar
   * con los códigos de los que ya se dieron de baja.
   */
  private async generarCodigo(em: EntityManager): Promise<string> {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['asset_tag']);
    const row = await em.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace("assetTag", '^AF-', ''), '')::int), 0) AS max
         FROM "assets" WHERE "assetTag" ~ '^AF-[0-9]+$'`,
    );
    return `AF-${String(Number(row?.[0]?.max ?? 0) + 1).padStart(4, '0')}`;
  }

  async findAll(clinicId: string, filters?: FilterMovementsDto): Promise<PaginatedResult<AssetMovement>> {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 50, 200);

    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.movedBy', 'movedBy')
      .leftJoin('m.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters?.location) {
      qb.andWhere('(m.fromLocation = :loc OR m.toLocation = :loc)', { loc: filters.location });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** Historial de un ítem: por dónde pasó desde que se dio de alta. */
  async findByAsset(assetId: string, clinicId: string): Promise<AssetMovement[]> {
    return this.movementRepo.find({
      where: { assetId, clinic: { id: clinicId } },
      relations: ['movedBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
