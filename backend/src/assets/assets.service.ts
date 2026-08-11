import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

// Cap defensivo para listados sin paginación explícita: evita que un cliente
// (o una llamada interna mal escrita) materialice cientos de miles de filas.
const MAX_UNPAGINATED_ROWS = 1000;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetTransferItem, AssetTransferStatus } from './entities/asset-transfer.entity';
import { Asset, AssetStatus } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(AssetTransferItem)
    private readonly transferItemRepository: Repository<AssetTransferItem>,
  ) {}

  private requireClinicId(clinicId?: string): string {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    return clinicId;
  }

  async create(createAssetDto: CreateAssetDto, userId: string, clinicId?: string): Promise<Asset> {
    const scopedClinicId = this.requireClinicId(clinicId);
    // Generar asset tag único
    const assetTag = await this.generateAssetTag(createAssetDto.type);

    // Validar serial number único dentro de la clínica
    if (createAssetDto.serialNumber) {
      const exists = await this.assetRepository.findOne({
        where: { serialNumber: createAssetDto.serialNumber, clinic: { id: scopedClinicId } },
      });
      if (exists) {
        throw new BadRequestException('El número de serie ya existe');
      }
    }

    const asset = this.assetRepository.create({
      ...createAssetDto,
      assetTag,
      createdBy: { id: userId } as any,
      clinic: { id: scopedClinicId } as any,
    });

    return await this.assetRepository.save(asset);
  }

  async findAll(filters?: FilterAssetsDto, clinicId?: string): Promise<PaginatedResult<Asset>> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 25;

    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.clinic', 'clinic')
      .leftJoinAndSelect('asset.createdBy', 'createdBy')
      .where('asset.isActive = :isActive', { isActive: true })
      .andWhere('clinic.id = :scopedClinicId', { scopedClinicId });

    if (filters) {
      if (filters.status) {
        queryBuilder.andWhere('asset.status = :status', { status: filters.status });
      }
      if (filters.type) {
        queryBuilder.andWhere('asset.type = :type', { type: filters.type });
      }
      if (filters.condition) {
        queryBuilder.andWhere('asset.condition = :condition', { condition: filters.condition });
      }
      if (filters.manufacturer) {
        queryBuilder.andWhere('asset.manufacturer ILIKE :manufacturer', {
          manufacturer: `%${filters.manufacturer}%`,
        });
      }
      if (filters.location) {
        queryBuilder.andWhere('asset.location ILIKE :location', {
          location: `%${filters.location}%`,
        });
      }
      if (filters.search) {
        queryBuilder.andWhere(
          '(asset.name ILIKE :search OR asset.serialNumber ILIKE :search OR asset.assetTag ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }
    }

    queryBuilder.orderBy('asset.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, clinicId?: string): Promise<Asset> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const asset = await this.assetRepository.findOne({
      where: { id, isActive: true, clinic: { id: scopedClinicId } },
      // `assignedTo` se retiró con el adelgazamiento de la ficha: pedirla acá
      // hacía que TypeORM tirara EntityPropertyNotFoundError y devolvía 500 al
      // abrir o editar cualquier activo.
      relations: ['clinic', 'createdBy'],
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, clinicId?: string): Promise<Asset> {
    const asset = await this.findOne(id, clinicId);

    // Validar serial number único dentro de la clínica
    if (updateAssetDto.serialNumber && updateAssetDto.serialNumber !== asset.serialNumber) {
      const exists = await this.assetRepository.findOne({
        where: { serialNumber: updateAssetDto.serialNumber, clinic: { id: asset.clinic.id } },
      });
      if (exists) {
        throw new BadRequestException('El número de serie ya existe');
      }
    }

    if (updateAssetDto.status) {
      this.assertAssetStatusTransition(asset.status, updateAssetDto.status);
    }

    Object.assign(asset, updateAssetDto);
    return await this.assetRepository.save(asset);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const asset = await this.findOne(id, clinicId);

    // Antes se forzaba RETIRED sin pasar por assertAssetStatusTransition() (que
    // bloquea, por ejemplo, SOLD → *) y sin chequear traslados activos — se
    // podía dar de baja un activo en medio de un traslado en curso, y luego
    // dispatch()/confirmReceipt() lo "revivían" igual (ver assertAssetAvailableForTransfer).
    this.assertAssetStatusTransition(asset.status, AssetStatus.RETIRED);

    const activeTransfer = await this.transferItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.transfer', 'transfer')
      .where('item.asset_id = :assetId', { assetId: id })
      .andWhere('transfer.status IN (:...statuses)', {
        statuses: [AssetTransferStatus.REQUESTED, AssetTransferStatus.IN_TRANSIT],
      })
      .getOne();

    if (activeTransfer) {
      throw new BadRequestException('No se puede dar de baja un activo con un traslado en curso');
    }

    asset.status = AssetStatus.RETIRED;
    asset.isActive = false;
    await this.assetRepository.save(asset);
  }

  async validateSerialNumber(serialNumber: string, excludeId?: string, clinicId?: string): Promise<boolean> {
    const query: any = clinicId ? { serialNumber, clinic: { id: clinicId } } : { serialNumber };

    if (excludeId) {
      const asset = await this.assetRepository.findOne({ where: query });
      return !asset || asset.id === excludeId;
    }

    const exists = await this.assetRepository.findOne({ where: query });
    return !exists;
  }

  /**
   * Resumen del inventario: cuántos ítems, cuántas unidades y en qué estado.
   *
   * Antes devolvía además valor total, valor actual, depreciación acumulada,
   * activos en garantía y mantenimientos vencidos — cinco cifras que salían de
   * columnas sin un solo dato y que la pantalla mostraba como "Bs 0,00".
   * `unidades` es lo que sí importa acá: 235 ítems son 778 unidades.
   */
  async getStats(clinicId?: string): Promise<any> {
    const scopedClinicId = this.requireClinicId(clinicId);

    const scoped = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>) =>
      qb
        .where('asset.isActive = :isActive', { isActive: true })
        .leftJoin('asset.clinic', 'clinic')
        .andWhere('clinic.id = :scopedClinicId', { scopedClinicId });

    const summaryQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('COUNT(*)', 'total')
        .addSelect('COALESCE(SUM(asset.quantity), 0)', 'units')
        .addSelect(`SUM(CASE WHEN asset.status = :active THEN 1 ELSE 0 END)`, 'active')
        .addSelect(`SUM(CASE WHEN asset.status = :inactive THEN 1 ELSE 0 END)`, 'inactive')
        .addSelect(`SUM(CASE WHEN asset.status = :maintenance THEN 1 ELSE 0 END)`, 'maintenance')
        .addSelect(`SUM(CASE WHEN asset.status = :retired THEN 1 ELSE 0 END)`, 'retired')
        .addSelect(`SUM(CASE WHEN asset.status = :damaged THEN 1 ELSE 0 END)`, 'damaged')
        .setParameters({
          active: AssetStatus.ACTIVE,
          inactive: AssetStatus.INACTIVE,
          maintenance: AssetStatus.MAINTENANCE,
          retired: AssetStatus.RETIRED,
          damaged: AssetStatus.DAMAGED,
        }),
    );

    const byQb = (campo: 'type' | 'condition' | 'location') =>
      scoped(
        this.assetRepository
          .createQueryBuilder('asset')
          .select(`asset.${campo}`, 'key')
          .addSelect('COUNT(*)', 'count')
          .addSelect('COALESCE(SUM(asset.quantity), 0)', 'units')
          .groupBy(`asset.${campo}`),
      );

    const [summary, typeRows, conditionRows, locationRows] = await Promise.all([
      summaryQb.getRawOne<Record<string, string>>(),
      byQb('type').getRawMany<{ key: string; count: string; units: string }>(),
      byQb('condition').getRawMany<{ key: string; count: string; units: string }>(),
      byQb('location').getRawMany<{ key: string; count: string; units: string }>(),
    ]);

    const toInt = (v: string | undefined) => Number(v ?? 0);

    return {
      total: toInt(summary?.total),
      units: toInt(summary?.units),
      active: toInt(summary?.active),
      inactive: toInt(summary?.inactive),
      maintenance: toInt(summary?.maintenance),
      retired: toInt(summary?.retired),
      damaged: toInt(summary?.damaged),
      byType: Object.fromEntries(typeRows.map(r => [r.key, toInt(r.count)])),
      byCondition: Object.fromEntries(conditionRows.map(r => [r.key, toInt(r.count)])),
      byLocation: Object.fromEntries(
        locationRows.map(r => [r.key ?? 'Sin ubicación', { items: toInt(r.count), units: toInt(r.units) }]),
      ),
    };
  }

  async getUniqueValues(
    field: 'type' | 'manufacturer' | 'location' | 'category',
    clinicId?: string,
  ): Promise<string[]> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoin('asset.clinic', 'clinic')
      .select(`DISTINCT asset.${field}`, 'value')
      .where('asset.isActive = :isActive', { isActive: true })
      .andWhere(`asset.${field} IS NOT NULL`)
      .andWhere('clinic.id = :scopedClinicId', { scopedClinicId });

    const results = await queryBuilder.getRawMany();
    return results.map(r => r.value).filter(Boolean);
  }

  private async generateAssetTag(type: string): Promise<string> {
    const prefix = type.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  // ==================== MAINTENANCE METHODS ====================
  /**
   * Estados desde los que el ítem ya no puede volver a circulación: se vendió o
   * se perdió, y en ambos casos no está y no va a estar.
   *
   * `RETIRED` **no** está entre ellos, a diferencia de antes. El inventario se
   * lleva contando existencias por ambiente y quien lo marca es la persona que
   * recorre la clínica con la hoja en la mano: marcar "dado de baja" por error y
   * que el sistema no deje corregirlo obliga a crear una ficha nueva y perder el
   * código. Lo mismo con `DAMAGED`, que antes no podía volver a `ACTIVE` —
   * reparar algo exigía pasar por un mantenimiento que esta clínica no registra.
   */
  private readonly ESTADOS_TERMINALES = [AssetStatus.SOLD, AssetStatus.LOST];

  private assertAssetStatusTransition(current: AssetStatus, next: AssetStatus): void {
    if (current === next) return;
    if (this.ESTADOS_TERMINALES.includes(current)) {
      throw new BadRequestException(`Invalid asset status transition from ${current} to ${next}`);
    }
  }
}
