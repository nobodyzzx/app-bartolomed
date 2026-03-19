import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { Supplier, SupplierStatus } from '../entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    const code = await this.generateSupplierCode();

    // Mapear nuevos campos a formato antiguo
    const supplierData = {
      code,
      name: createSupplierDto.nombreComercial || createSupplierDto.name || '',
      tradeName: createSupplierDto.razonSocial,
      taxId: createSupplierDto.idTributario || createSupplierDto.taxId,
      contactPerson: createSupplierDto.contactPerson,
      email: createSupplierDto.email,
      phone: createSupplierDto.phone,
      address: createSupplierDto.address,
      city: createSupplierDto.city,
      state: createSupplierDto.state,
      country: createSupplierDto.country,
      zipCode: createSupplierDto.postalCode,
      notes: createSupplierDto.notes,
      // Guardar tipo de proveedor en notes si existe (temporal)
      ...(createSupplierDto.tipoProveedor && {
        notes: `Tipo: ${createSupplierDto.tipoProveedor}${createSupplierDto.notes ? '. ' + createSupplierDto.notes : ''}`,
      }),
    };

    const supplier = this.supplierRepository.create(supplierData);

    return await this.supplierRepository.save(supplier);
  }

  async findAll(): Promise<Supplier[]> {
    // Proveedores se manejan como dato maestro global (compartido entre clínicas).
    return await this.supplierRepository.find({
      where: { status: SupplierStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
      relations: ['purchaseOrders'],
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);

    Object.assign(supplier, updateSupplierDto);

    return await this.supplierRepository.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);

    // Soft delete: marcar como INACTIVE
    supplier.status = SupplierStatus.INACTIVE;
    await this.supplierRepository.save(supplier);
  }

  async restore(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    supplier.status = SupplierStatus.ACTIVE;
    return await this.supplierRepository.save(supplier);
  }

  private async generateSupplierCode(): Promise<string> {
    const count = await this.supplierRepository.count();
    return `SUP-${(count + 1).toString().padStart(4, '0')}`;
  }
}
