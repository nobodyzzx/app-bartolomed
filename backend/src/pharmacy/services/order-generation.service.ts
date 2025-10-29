import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from '../dto/purchase-order.dto';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { Supplier } from '../entities/supplier.entity';

@Injectable()
export class OrderGenerationService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
  ) {}

  // Supplier Management
  async createSupplier(createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      ...createSupplierDto,
      code: await this.generateSupplierCode(),
    });
    return await this.supplierRepository.save(supplier);
  }

  async findAllSuppliers(clinicId: string): Promise<Supplier[]> {
    return await this.supplierRepository.find({
      where: { clinic: { id: clinicId } },
      order: { name: 'ASC' },
    });
  }

  async findSupplierById(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
      relations: ['clinic'],
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async updateSupplier(id: string, updateSupplierDto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findSupplierById(id);
    Object.assign(supplier, updateSupplierDto);
    return await this.supplierRepository.save(supplier);
  }

  async deleteSupplier(id: string): Promise<void> {
    const result = await this.supplierRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Supplier not found');
    }
  }

  // Purchase Order Management
  async createPurchaseOrder(createOrderDto: CreatePurchaseOrderDto, userId: string): Promise<PurchaseOrder> {
    // Validate supplier exists
    await this.findSupplierById(createOrderDto.supplierId);

    const order = this.purchaseOrderRepository.create({
      orderNumber: await this.generateOrderNumber(),
      supplierId: createOrderDto.supplierId,
      clinicId: createOrderDto.clinicId,
      orderDate: new Date(),
      expectedDeliveryDate: createOrderDto.expectedDeliveryDate,
      taxRate: createOrderDto.taxRate || 0,
      discountAmount: createOrderDto.discountAmount || 0,
      shippingCost: createOrderDto.shippingCost || 0,
      notes: createOrderDto.notes,
      createdById: userId,
    });

    // Calculate totals
    let subtotal = 0;
    for (const item of createOrderDto.items) {
      subtotal += item.quantity * item.unitPrice;
    }

    order.subtotal = subtotal;
    order.taxAmount = (subtotal * (createOrderDto.taxRate || 0)) / 100;
    order.totalAmount =
      subtotal + order.taxAmount - (createOrderDto.discountAmount || 0) + (createOrderDto.shippingCost || 0);

    const savedOrder = await this.purchaseOrderRepository.save(order);

    // Create order items
    for (const itemDto of createOrderDto.items) {
      const item = this.purchaseOrderItemRepository.create({
        orderId: savedOrder.id,
        productName: itemDto.productName,
        productCode: itemDto.productCode,
        medicationId: itemDto.medicationId,
        medicationName: itemDto.medicationName,
        brand: itemDto.brand,
        quantity: itemDto.quantity,
        unitPrice: itemDto.unitPrice,
        totalPrice: itemDto.quantity * itemDto.unitPrice,
        subtotal: itemDto.quantity * itemDto.unitPrice,
        notes: itemDto.notes,
      });
      await this.purchaseOrderItemRepository.save(item);
    }

    return await this.findPurchaseOrderById(savedOrder.id);
  }

  async findAllPurchaseOrders(clinicId: string): Promise<PurchaseOrder[]> {
    return await this.purchaseOrderRepository.find({
      where: { clinicId },
      relations: ['supplier', 'items', 'createdBy'],
      order: { orderDate: 'DESC' },
    });
  }

  async findPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['supplier', 'items', 'createdBy', 'approvedBy'],
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    return order;
  }

  async updatePurchaseOrder(id: string, updateOrderDto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = await this.findPurchaseOrderById(id);

    if (order.status !== PurchaseOrderStatus.DRAFT && order.status !== PurchaseOrderStatus.PENDING) {
      throw new BadRequestException('Cannot modify order in current status');
    }

    Object.assign(order, updateOrderDto);
    return await this.purchaseOrderRepository.save(order);
  }

  async approvePurchaseOrder(id: string, userId: string): Promise<PurchaseOrder> {
    const order = await this.findPurchaseOrderById(id);

    if (order.status !== PurchaseOrderStatus.PENDING) {
      throw new BadRequestException('Order can only be approved from pending status');
    }

    order.status = PurchaseOrderStatus.APPROVED;
    order.approvedById = userId;
    order.approvedAt = new Date();

    return await this.purchaseOrderRepository.save(order);
  }

  async cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const order = await this.findPurchaseOrderById(id);

    if (order.status === PurchaseOrderStatus.RECEIVED || order.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot cancel order in current status');
    }

    order.status = PurchaseOrderStatus.CANCELLED;
    return await this.purchaseOrderRepository.save(order);
  }

  async receiveOrder(
    id: string,
    receivedItems: { itemId: string; receivedQuantity: number }[],
  ): Promise<PurchaseOrder> {
    const order = await this.findPurchaseOrderById(id);

    if (order.status !== PurchaseOrderStatus.APPROVED && order.status !== PurchaseOrderStatus.SENT) {
      throw new BadRequestException('Order must be approved or sent to receive items');
    }

    for (const receivedItem of receivedItems) {
      const item = order.items.find(i => i.id === receivedItem.itemId);
      if (item) {
        item.receivedQuantity += receivedItem.receivedQuantity;
        await this.purchaseOrderItemRepository.save(item);
      }
    }

    // Check if all items are fully received
    const allItemsReceived = order.items.every(item => item.receivedQuantity >= item.quantity);
    const someItemsReceived = order.items.some(item => item.receivedQuantity > 0);

    if (allItemsReceived) {
      order.status = PurchaseOrderStatus.RECEIVED;
      order.actualDeliveryDate = new Date();
    } else if (someItemsReceived) {
      order.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    return await this.purchaseOrderRepository.save(order);
  }

  private async generateSupplierCode(): Promise<string> {
    const count = await this.supplierRepository.count();
    return `SUP-${(count + 1).toString().padStart(4, '0')}`;
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.purchaseOrderRepository.count();
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    return `PO-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
  }
}
