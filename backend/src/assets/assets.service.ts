import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Asset, AssetStatus } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  async create(createAssetDto: CreateAssetDto, userId: string, clinicId?: string): Promise<Asset> {
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
      ...(clinicId && { clinic: { id: clinicId } as any }),
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
      queryBuilder.andWhere('asset.clinic.id = :clinicId', { clinicId });
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

  async findOne(id: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id, isActive: true },
      relations: ['clinic', 'createdBy', 'assignedTo'],
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.findOne(id);

    // Validar serial number único si se actualiza
    if (updateAssetDto.serialNumber && updateAssetDto.serialNumber !== asset.serialNumber) {
      const exists = await this.assetRepository.findOne({
        where: { serialNumber: updateAssetDto.serialNumber },
      });
      if (exists) {
        throw new BadRequestException('El número de serie ya existe');
      }
    }

    Object.assign(asset, updateAssetDto);
    return await this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<void> {
    const asset = await this.findOne(id);
    asset.isActive = false;
    await this.assetRepository.save(asset);
  }

  async validateSerialNumber(serialNumber: string, excludeId?: string): Promise<boolean> {
    const query: any = { serialNumber };

    if (excludeId) {
      const asset = await this.assetRepository.findOne({
        where: { serialNumber },
      });
      return !asset || asset.id === excludeId;
    }

    const exists = await this.assetRepository.findOne({ where: query });
    return !exists;
  }

  async getStats(clinicId?: string): Promise<any> {
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('asset.clinic.id = :clinicId', { clinicId });
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
      .select(`DISTINCT asset.${field}`, 'value')
      .where('asset.isActive = :isActive', { isActive: true })
      .andWhere(`asset.${field} IS NOT NULL`);

    if (clinicId) {
      queryBuilder.andWhere('asset.clinic.id = :clinicId', { clinicId });
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
}
