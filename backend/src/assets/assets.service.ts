import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetMaintenance, MaintenanceStatus } from './entities/asset-maintenance.entity';
import { AssetReport, ReportStatus } from './entities/asset-report.entity';
import { Asset, AssetStatus } from './entities/asset.entity';

@Injectable()
export class AssetsService {
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

  async findAll(filters?: FilterAssetsDto, clinicId?: string): Promise<Asset[]> {
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.clinic', 'clinic')
      .leftJoinAndSelect('asset.createdBy', 'createdBy')
      .where('asset.isActive = :isActive', { isActive: true });

    // Filtro por clínica si se proporciona
    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

    // Aplicar filtros
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
          queryBuilder.andWhere('asset.purchaseDate >= :from', {
            from: filters.purchaseDateFrom,
          });
        } else if (filters.purchaseDateTo) {
          queryBuilder.andWhere('asset.purchaseDate <= :to', {
            to: filters.purchaseDateTo,
          });
        }
      }

      if (filters.search) {
        queryBuilder.andWhere(
          '(asset.name ILIKE :search OR asset.description ILIKE :search OR asset.serialNumber ILIKE :search OR asset.assetTag ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }
    }

    queryBuilder.orderBy('asset.createdAt', 'DESC');

    return await queryBuilder.getMany();
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
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoin('asset.clinic', 'clinic')
      .where('asset.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

    const assets = await queryBuilder.getMany();

    const stats = {
      total: assets.length,
      active: assets.filter(a => a.status === AssetStatus.ACTIVE).length,
      inactive: assets.filter(a => a.status === AssetStatus.INACTIVE).length,
      maintenance: assets.filter(a => a.status === AssetStatus.MAINTENANCE).length,
      retired: assets.filter(a => a.status === AssetStatus.RETIRED).length,
      totalValue: assets.reduce((sum, asset) => sum + Number(asset.purchasePrice), 0),
      currentValue: assets.reduce((sum, asset) => sum + Number(asset.currentValue), 0),
      totalDepreciation: assets.reduce((sum, asset) => sum + Number(asset.accumulatedDepreciation), 0),
      underWarranty: assets.filter(a => a.isUnderWarranty()).length,
      maintenanceDue: assets.filter(a => a.isMaintenanceDue()).length,
      byType: this.groupByType(assets),
      byCondition: this.groupByCondition(assets),
    };

    return stats;
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

  private groupByType(assets: Asset[]): Record<string, number> {
    return assets.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByCondition(assets: Asset[]): Record<string, number> {
    return assets.reduce((acc, asset) => {
      acc[asset.condition] = (acc[asset.condition] || 0) + 1;
      return acc;
    }, {});
  }

  // ==================== MAINTENANCE METHODS ====================
  async findAllMaintenance(filters?: any, clinicId?: string): Promise<AssetMaintenance[]> {
    const qb = this.maintenanceRepository
      .createQueryBuilder('maintenance')
      .leftJoinAndSelect('maintenance.asset', 'asset')
      .leftJoin('asset.clinic', 'clinic')
      .leftJoinAndSelect('maintenance.scheduledBy', 'scheduledBy')
      .leftJoinAndSelect('maintenance.completedBy', 'completedBy')
      .orderBy('maintenance.scheduledDate', 'DESC');

    if (clinicId) {
      qb.andWhere('clinic.id = :clinicId', { clinicId });
    }

    if (filters?.status) {
      qb.andWhere('maintenance.status = :status', { status: filters.status });
    }

    return qb.getMany();
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
    const records = await this.findAllMaintenance(undefined, clinicId);
    const total = records.length;

    return {
      total,
      scheduled: records.filter(r => r.status === 'Programado').length,
      completed: records.filter(r => r.status === 'Completado').length,
      inProgress: records.filter(r => r.status === 'En Progreso').length,
      cancelled: records.filter(r => r.status === 'Cancelado').length,
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
