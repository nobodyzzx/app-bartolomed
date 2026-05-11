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
import { AssetMaintenance, MaintenanceStatus } from './entities/asset-maintenance.entity';
import { AssetReport, ReportStatus } from './entities/asset-report.entity';
import { Asset, AssetStatus } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(AssetMaintenance)
    private readonly maintenanceRepository: Repository<AssetMaintenance>,
    @InjectRepository(AssetReport)
    private readonly reportRepository: Repository<AssetReport>,
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

    // Validar serial number único si se proporciona
    if (createAssetDto.serialNumber) {
      const exists = await this.assetRepository.findOne({
        where: { serialNumber: createAssetDto.serialNumber },
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
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 25;

    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.clinic', 'clinic')
      .leftJoinAndSelect('asset.createdBy', 'createdBy')
      .where('asset.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

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
      if (filters.category) {
        queryBuilder.andWhere('asset.category ILIKE :category', {
          category: `%${filters.category}%`,
        });
      }
      if (filters.purchaseDateFrom || filters.purchaseDateTo) {
        if (filters.purchaseDateFrom && filters.purchaseDateTo) {
          queryBuilder.andWhere('asset.purchaseDate BETWEEN :from AND :to', {
            from: filters.purchaseDateFrom,
            to: filters.purchaseDateTo,
          });
        } else if (filters.purchaseDateFrom) {
          queryBuilder.andWhere('asset.purchaseDate >= :from', { from: filters.purchaseDateFrom });
        } else if (filters.purchaseDateTo) {
          queryBuilder.andWhere('asset.purchaseDate <= :to', { to: filters.purchaseDateTo });
        }
      }
      if (filters.search) {
        queryBuilder.andWhere(
          '(asset.name ILIKE :search OR asset.description ILIKE :search OR asset.serialNumber ILIKE :search OR asset.assetTag ILIKE :search)',
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
      relations: ['clinic', 'createdBy', 'assignedTo'],
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, clinicId?: string): Promise<Asset> {
    const asset = await this.findOne(id, clinicId);

    // Validar serial number único si se actualiza
    if (updateAssetDto.serialNumber && updateAssetDto.serialNumber !== asset.serialNumber) {
      const exists = await this.assetRepository.findOne({
        where: { serialNumber: updateAssetDto.serialNumber },
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

  async getStats(clinicId?: string): Promise<any> {
    // Agregaciones en SQL: cada COUNT/SUM ocurre en Postgres en lugar de
    // cargar todas las filas a Node. Tres queries en paralelo:
    //   1) Conteos por status + sumas monetarias
    //   2) Conteos por type
    //   3) Conteos por condition
    //
    // Los flags computados isUnderWarranty/isMaintenanceDue requieren la
    // entidad cargada; los mantenemos como queries acotadas usando los
    // mismos predicados que tienen los métodos de la entidad.
    const scoped = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>) => {
      qb.where('asset.isActive = :isActive', { isActive: true });
      if (clinicId) {
        qb.leftJoin('asset.clinic', 'clinic').andWhere('clinic.id = :clinicId', { clinicId });
      }
      return qb;
    };

    const summaryQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN asset.status = :active THEN 1 ELSE 0 END)`,
          'active',
        )
        .addSelect(
          `SUM(CASE WHEN asset.status = :inactive THEN 1 ELSE 0 END)`,
          'inactive',
        )
        .addSelect(
          `SUM(CASE WHEN asset.status = :maintenance THEN 1 ELSE 0 END)`,
          'maintenance',
        )
        .addSelect(
          `SUM(CASE WHEN asset.status = :retired THEN 1 ELSE 0 END)`,
          'retired',
        )
        .addSelect('COALESCE(SUM(asset.purchasePrice), 0)', 'totalValue')
        .addSelect('COALESCE(SUM(asset.currentValue), 0)', 'currentValue')
        .addSelect(
          'COALESCE(SUM(asset.accumulatedDepreciation), 0)',
          'totalDepreciation',
        )
        .setParameters({
          active: AssetStatus.ACTIVE,
          inactive: AssetStatus.INACTIVE,
          maintenance: AssetStatus.MAINTENANCE,
          retired: AssetStatus.RETIRED,
        }),
    );

    const typeQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('asset.type', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('asset.type'),
    );

    const conditionQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('asset.condition', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('asset.condition'),
    );

    const warrantyQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('COUNT(*)', 'count')
        .andWhere('asset.warrantyEndDate IS NOT NULL')
        .andWhere('asset.warrantyEndDate >= NOW()'),
    );

    const maintenanceDueQb = scoped(
      this.assetRepository
        .createQueryBuilder('asset')
        .select('COUNT(*)', 'count')
        .andWhere('asset.nextMaintenanceDate IS NOT NULL')
        .andWhere('asset.nextMaintenanceDate <= NOW()'),
    );

    const [summary, typeRows, conditionRows, warrantyRow, maintenanceDueRow] = await Promise.all([
      summaryQb.getRawOne<{
        total: string;
        active: string;
        inactive: string;
        maintenance: string;
        retired: string;
        totalValue: string;
        currentValue: string;
        totalDepreciation: string;
      }>(),
      typeQb.getRawMany<{ key: string; count: string }>(),
      conditionQb.getRawMany<{ key: string; count: string }>(),
      warrantyQb.getRawOne<{ count: string }>(),
      maintenanceDueQb.getRawOne<{ count: string }>(),
    ]);

    const toInt = (v: string | undefined) => Number(v ?? 0);
    const toNum = (v: string | undefined) => Number(v ?? 0);

    return {
      total: toInt(summary?.total),
      active: toInt(summary?.active),
      inactive: toInt(summary?.inactive),
      maintenance: toInt(summary?.maintenance),
      retired: toInt(summary?.retired),
      totalValue: toNum(summary?.totalValue),
      currentValue: toNum(summary?.currentValue),
      totalDepreciation: toNum(summary?.totalDepreciation),
      underWarranty: toInt(warrantyRow?.count),
      maintenanceDue: toInt(maintenanceDueRow?.count),
      byType: Object.fromEntries(typeRows.map(r => [r.key, toInt(r.count)])),
      byCondition: Object.fromEntries(conditionRows.map(r => [r.key, toInt(r.count)])),
    };
  }

  async getUniqueValues(
    field: 'type' | 'manufacturer' | 'location' | 'category',
    clinicId?: string,
  ): Promise<string[]> {
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoin('asset.clinic', 'clinic')
      .select(`DISTINCT asset.${field}`, 'value')
      .where('asset.isActive = :isActive', { isActive: true })
      .andWhere(`asset.${field} IS NOT NULL`);

    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

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
  async findAllMaintenance(filters?: any, clinicId?: string): Promise<AssetMaintenance[]> {
    const qb = this.maintenanceRepository
      .createQueryBuilder('maintenance')
      .leftJoinAndSelect('maintenance.asset', 'asset')
      .leftJoin('asset.clinic', 'clinic')
      .leftJoinAndSelect('maintenance.scheduledBy', 'scheduledBy')
      .leftJoinAndSelect('maintenance.completedBy', 'completedBy')
      .orderBy('maintenance.scheduledDate', 'DESC')
      // Cap defensivo mientras este endpoint no expone paginación al cliente.
      // Si se alcanza, queda registro en logs y conviene migrar el consumidor
      // a una variante paginada.
      .take(MAX_UNPAGINATED_ROWS);

    if (clinicId) {
      qb.andWhere('clinic.id = :clinicId', { clinicId });
    }

    if (filters?.status) {
      qb.andWhere('maintenance.status = :status', { status: filters.status });
    }

    const rows = await qb.getMany();
    if (rows.length >= MAX_UNPAGINATED_ROWS) {
      this.logger.warn(
        `findAllMaintenance alcanzó el cap (${MAX_UNPAGINATED_ROWS}) — agregar paginación al endpoint`,
      );
    }
    return rows;
  }

  async findOneMaintenance(id: string, clinicId?: string): Promise<AssetMaintenance> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id, asset: { clinic: { id: scopedClinicId } } },
      relations: ['asset', 'scheduledBy', 'completedBy'],
    });

    if (!maintenance) {
      throw new NotFoundException(`Maintenance record with ID ${id} not found`);
    }

    return maintenance;
  }

  async createMaintenance(data: any, userId: string, clinicId?: string): Promise<AssetMaintenance> {
    const scopedClinicId = this.requireClinicId(clinicId);
    if (!data?.assetId) {
      throw new BadRequestException('assetId is required');
    }
    const asset = await this.findOne(data.assetId, scopedClinicId);
    if ([AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST].includes(asset.status)) {
      throw new BadRequestException('Cannot schedule maintenance for retired/sold/lost assets');
    }
    const maintenance = this.maintenanceRepository.create({
      ...data,
      assetId: asset.id,
      scheduledById: userId,
    });

    const saved = await this.maintenanceRepository.save(maintenance);
    asset.status = AssetStatus.MAINTENANCE;
    await this.assetRepository.save(asset);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async updateMaintenance(id: string, data: any, clinicId?: string, userId?: string): Promise<AssetMaintenance> {
    const maintenance = await this.findOneMaintenance(id, clinicId);
    const asset = await this.findOne(maintenance.assetId, clinicId);

    Object.assign(maintenance, data);
    if (maintenance.status === MaintenanceStatus.COMPLETED) {
      maintenance.completedById = userId || maintenance.completedById;
      maintenance.completedDate = maintenance.completedDate || new Date();
      asset.lastMaintenanceDate = maintenance.completedDate;
      asset.nextMaintenanceDate = maintenance.nextMaintenanceDate || asset.nextMaintenanceDate;
      if (maintenance.actualCost) {
        asset.totalMaintenanceCost = Number(asset.totalMaintenanceCost || 0) + Number(maintenance.actualCost);
      }
      if (asset.isActive) {
        asset.status = AssetStatus.ACTIVE;
      }
    }
    if (maintenance.status === MaintenanceStatus.IN_PROGRESS && asset.isActive) {
      asset.status = AssetStatus.MAINTENANCE;
    }

    await this.maintenanceRepository.save(maintenance);
    await this.assetRepository.save(asset);
    return this.findOneMaintenance(id, clinicId);
  }

  async deleteMaintenance(id: string, clinicId?: string): Promise<void> {
    const maintenance = await this.findOneMaintenance(id, clinicId);
    const result = await this.maintenanceRepository.delete(maintenance.id);
    if (result.affected === 0) {
      throw new NotFoundException(`Maintenance record with ID ${id} not found`);
    }
  }

  async getMaintenanceStats(clinicId?: string): Promise<any> {
    // Agregado en SQL: una sola query con CASE/SUM, sin cargar entidades.
    const qb = this.maintenanceRepository
      .createQueryBuilder('maintenance')
      .select('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN maintenance.status = :scheduled THEN 1 ELSE 0 END)',
        'scheduled',
      )
      .addSelect(
        'SUM(CASE WHEN maintenance.status = :completed THEN 1 ELSE 0 END)',
        'completed',
      )
      .addSelect(
        'SUM(CASE WHEN maintenance.status = :inProgress THEN 1 ELSE 0 END)',
        'inProgress',
      )
      .addSelect(
        'SUM(CASE WHEN maintenance.status = :cancelled THEN 1 ELSE 0 END)',
        'cancelled',
      )
      .setParameters({
        scheduled: MaintenanceStatus.SCHEDULED,
        completed: MaintenanceStatus.COMPLETED,
        inProgress: MaintenanceStatus.IN_PROGRESS,
        cancelled: MaintenanceStatus.CANCELLED,
      });

    if (clinicId) {
      qb.leftJoin('maintenance.asset', 'asset')
        .leftJoin('asset.clinic', 'clinic')
        .andWhere('clinic.id = :clinicId', { clinicId });
    }

    const row = await qb.getRawOne<{
      total: string;
      scheduled: string;
      completed: string;
      inProgress: string;
      cancelled: string;
    }>();

    const toInt = (v: string | undefined) => Number(v ?? 0);
    return {
      total: toInt(row?.total),
      scheduled: toInt(row?.scheduled),
      completed: toInt(row?.completed),
      inProgress: toInt(row?.inProgress),
      cancelled: toInt(row?.cancelled),
    };
  }

  // ==================== REPORTS METHODS ====================
  async findAllReports(filters?: any, clinicId?: string): Promise<AssetReport[]> {
    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.generatedBy', 'generatedBy')
      .leftJoinAndSelect('report.clinic', 'clinic')
      .orderBy('report.createdAt', 'DESC');

    if (clinicId) {
      qb.andWhere('clinic.id = :clinicId', { clinicId });
    }

    if (filters?.status) {
      qb.andWhere('report.status = :status', { status: filters.status });
    }

    return qb.getMany();
  }

  async findOneReport(id: string, clinicId?: string): Promise<AssetReport> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const report = await this.reportRepository.findOne({
      where: { id, clinicId: scopedClinicId },
      relations: ['generatedBy', 'clinic'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async generateReport(data: any, userId: string, clinicId?: string): Promise<AssetReport> {
    const scopedClinicId = this.requireClinicId(clinicId);
    const report = this.reportRepository.create({
      ...data,
      status: ReportStatus.PENDING,
      generatedById: userId,
      clinicId: scopedClinicId,
    });

    const saved = await this.reportRepository.save(report);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async deleteReport(id: string, clinicId?: string): Promise<void> {
    const report = await this.findOneReport(id, clinicId);
    const result = await this.reportRepository.delete(report.id);
    if (result.affected === 0) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }
  }

  async getReportsStats(clinicId?: string): Promise<any> {
    const reports = await this.findAllReports(undefined, clinicId);
    const total = reports.length;

    return {
      total,
      pending: reports.filter(r => r.status === ReportStatus.PENDING).length,
      completed: reports.filter(r => r.status === ReportStatus.COMPLETED).length,
      failed: reports.filter(r => r.status === ReportStatus.FAILED).length,
    };
  }

  private assertAssetStatusTransition(current: AssetStatus, next: AssetStatus): void {
    if (current === next) return;
    const transitions: Record<AssetStatus, AssetStatus[]> = {
      [AssetStatus.ACTIVE]: [
        AssetStatus.MAINTENANCE,
        AssetStatus.INACTIVE,
        AssetStatus.RETIRED,
        AssetStatus.SOLD,
        AssetStatus.LOST,
        AssetStatus.DAMAGED,
      ],
      [AssetStatus.MAINTENANCE]: [AssetStatus.ACTIVE, AssetStatus.INACTIVE, AssetStatus.RETIRED, AssetStatus.DAMAGED],
      [AssetStatus.INACTIVE]: [AssetStatus.ACTIVE, AssetStatus.MAINTENANCE, AssetStatus.RETIRED, AssetStatus.SOLD],
      [AssetStatus.DAMAGED]: [AssetStatus.MAINTENANCE, AssetStatus.RETIRED, AssetStatus.SOLD],
      [AssetStatus.RETIRED]: [],
      [AssetStatus.SOLD]: [],
      [AssetStatus.LOST]: [],
    };
    if (!transitions[current].includes(next)) {
      throw new BadRequestException(`Invalid asset status transition from ${current} to ${next}`);
    }
  }
}
