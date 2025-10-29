import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from '../dto/purchase-order.dto';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier } from '../entities/purchase-order.entity';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, createdById: string): Promise<PurchaseOrder> {
    // Verify supplier exists
    const supplier = await this.supplierRepository.findOne({
      where: { id: createPurchaseOrderDto.supplierId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${createPurchaseOrderDto.supplierId} not found`);
    }

    const orderNumber = await this.generateOrderNumber();

    // Calculate totals
    let subtotal = 0;
    const items = createPurchaseOrderDto.items.map(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;
      return {
        ...item,
        subtotal: itemSubtotal,
      };
    });

    const tax = subtotal * 0.13; // 13% tax
    const total = subtotal + tax;

    const purchaseOrder = this.purchaseOrderRepository.create({
      orderNumber,
      supplierId: createPurchaseOrderDto.supplierId,
      orderDate: createPurchaseOrderDto.orderDate,
      expectedDeliveryDate: createPurchaseOrderDto.expectedDeliveryDate,
      notes: createPurchaseOrderDto.notes,
      subtotal,
      tax,
      total,
      createdById,
      status: PurchaseOrderStatus.PENDING,
    });

    const savedOrder = await this.purchaseOrderRepository.save(purchaseOrder);

    // Create order items
    for (const itemDto of items) {
      const item = this.purchaseOrderItemRepository.create({
        ...itemDto,
        orderId: savedOrder.id,
      });
      await this.purchaseOrderItemRepository.save(item);
    }

    return await this.findOne(savedOrder.id);
  }

  async findAll(): Promise<PurchaseOrder[]> {
    return await this.purchaseOrderRepository.find({
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['supplier', 'items', 'createdBy', 'approvedBy'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return purchaseOrder;
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status === PurchaseOrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot update delivered purchase order');
    }

    if (updatePurchaseOrderDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: updatePurchaseOrderDto.supplierId, isActive: true },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${updatePurchaseOrderDto.supplierId} not found`);
      }
    }

    // Update basic fields
    Object.assign(purchaseOrder, {
      supplierId: updatePurchaseOrderDto.supplierId || purchaseOrder.supplierId,
      orderDate: updatePurchaseOrderDto.orderDate || purchaseOrder.orderDate,
      expectedDeliveryDate: updatePurchaseOrderDto.expectedDeliveryDate || purchaseOrder.expectedDeliveryDate,
      actualDeliveryDate: updatePurchaseOrderDto.actualDeliveryDate || purchaseOrder.actualDeliveryDate,
      status: updatePurchaseOrderDto.status || purchaseOrder.status,
      notes: updatePurchaseOrderDto.notes || purchaseOrder.notes,
    });

    // Update items if provided
    if (updatePurchaseOrderDto.items) {
      // Remove existing items
      await this.purchaseOrderItemRepository.delete({ orderId: id });

      // Calculate new totals
      let subtotal = 0;
      for (const itemDto of updatePurchaseOrderDto.items) {
        const itemSubtotal = itemDto.quantity * itemDto.unitPrice;
        subtotal += itemSubtotal;

        const item = this.purchaseOrderItemRepository.create({
          ...itemDto,
          subtotal: itemSubtotal,
          orderId: id,
        });
        await this.purchaseOrderItemRepository.save(item);
      }

      const tax = subtotal * 0.13;
      const total = subtotal + tax;

      purchaseOrder.subtotal = subtotal;
      purchaseOrder.tax = tax;
      purchaseOrder.total = total;
    }

    await this.purchaseOrderRepository.save(purchaseOrder);
    return await this.findOne(id);
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdatePurchaseOrderStatusDto,
    approvedById?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);

    purchaseOrder.status = updateStatusDto.status;

    if (updateStatusDto.actualDeliveryDate) {
      purchaseOrder.actualDeliveryDate = updateStatusDto.actualDeliveryDate;
    }

    if (updateStatusDto.notes) {
      purchaseOrder.notes = updateStatusDto.notes;
    }

    if (updateStatusDto.status === PurchaseOrderStatus.APPROVED && approvedById) {
      purchaseOrder.approvedById = approvedById;
      purchaseOrder.approvedAt = new Date();
    }

    if (updateStatusDto.status === PurchaseOrderStatus.DELIVERED && !purchaseOrder.actualDeliveryDate) {
      purchaseOrder.actualDeliveryDate = new Date();
    }

    await this.purchaseOrderRepository.save(purchaseOrder);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status === PurchaseOrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot delete delivered purchase order');
    }

    await this.purchaseOrderRepository.remove(purchaseOrder);
  }

  async getOrdersByStatus(status: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
    return await this.purchaseOrderRepository.find({
      where: { status },
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrdersBySupplier(supplierId: string): Promise<PurchaseOrder[]> {
    return await this.purchaseOrderRepository.find({
      where: { supplierId },
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');

    const count = await this.purchaseOrderRepository.count();
    const orderNumber = (count + 1).toString().padStart(4, '0');

    return `PO-${year}${month}-${orderNumber}`;
  }
}
