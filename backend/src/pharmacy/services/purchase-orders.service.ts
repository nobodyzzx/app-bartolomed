import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from '../dto/purchase-order.dto';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { Supplier, SupplierStatus } from '../entities/supplier.entity';
import { InventoryService } from './inventory.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, createdById: string): Promise<PurchaseOrder> {
    // Verify supplier exists
    const supplier = await this.supplierRepository.findOne({
      where: { id: createPurchaseOrderDto.supplierId, status: SupplierStatus.ACTIVE },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${createPurchaseOrderDto.supplierId} not found`);
    }

    const orderNumber = await this.generateOrderNumber();

    // Calculate totals
    let subtotal = 0;
    const items = createPurchaseOrderDto.items.map(item => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const itemSubtotal = quantity * unitPrice;
      subtotal += itemSubtotal;
      return {
        ...item,
        quantity,
        unitPrice,
        totalPrice: itemSubtotal,
        subtotal: itemSubtotal,
      };
    });

    const taxRate = Number(createPurchaseOrderDto.taxRate) || 0;
    const taxAmount = subtotal * taxRate;
    const discountAmount = Number(createPurchaseOrderDto.discountAmount) || 0;
    const shippingCost = Number(createPurchaseOrderDto.shippingCost) || 0;
    const totalAmount = subtotal + taxAmount - discountAmount + shippingCost;

    const purchaseOrder = this.purchaseOrderRepository.create({
      orderNumber,
      supplierId: createPurchaseOrderDto.supplierId,
      clinicId: createPurchaseOrderDto.clinicId,
      orderDate: new Date(createPurchaseOrderDto.orderDate),
      expectedDeliveryDate: createPurchaseOrderDto.expectedDeliveryDate
        ? new Date(createPurchaseOrderDto.expectedDeliveryDate)
        : null,
      notes: createPurchaseOrderDto.notes,
      subtotal: Number(subtotal),
      taxRate: Number(taxRate),
      taxAmount: Number(taxAmount),
      discountAmount: Number(discountAmount),
      shippingCost: Number(shippingCost),
      totalAmount: Number(totalAmount),
      tax: Number(taxAmount), // Legacy field
      total: Number(totalAmount), // Legacy field
      createdById,
      status: PurchaseOrderStatus.DRAFT,
    });

    const savedOrder = await this.purchaseOrderRepository.save(purchaseOrder);

    // Items creation

    // Create order items
    for (const itemDto of items) {
      const item = this.purchaseOrderItemRepository.create({
        ...itemDto,
        purchaseOrder: savedOrder,
      });
      await this.purchaseOrderItemRepository.save(item);
    }

    return await this.findOne(savedOrder.id);
  }

  async findAll(clinicId?: string): Promise<PurchaseOrder[]> {
    const where = clinicId ? ({ clinicId } as any) : {};
    return await this.purchaseOrderRepository.find({
      where,
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, clinicId?: string): Promise<PurchaseOrder> {
    const where = clinicId ? ({ id, clinicId } as any) : ({ id } as any);
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where,
      relations: ['supplier', 'items', 'createdBy', 'approvedBy'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return purchaseOrder;
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto, clinicId?: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, clinicId);

    if (purchaseOrder.status === PurchaseOrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot update delivered purchase order');
    }

    if (updatePurchaseOrderDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: updatePurchaseOrderDto.supplierId, status: SupplierStatus.ACTIVE },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${updatePurchaseOrderDto.supplierId} not found`);
      }
    }

    // Update basic fields
    Object.assign(purchaseOrder, {
      supplierId: updatePurchaseOrderDto.supplierId || purchaseOrder.supplierId,
      orderDate: updatePurchaseOrderDto.orderDate
        ? new Date(updatePurchaseOrderDto.orderDate)
        : purchaseOrder.orderDate,
      expectedDeliveryDate: updatePurchaseOrderDto.expectedDeliveryDate
        ? new Date(updatePurchaseOrderDto.expectedDeliveryDate)
        : purchaseOrder.expectedDeliveryDate,
      actualDeliveryDate: updatePurchaseOrderDto.actualDeliveryDate
        ? new Date(updatePurchaseOrderDto.actualDeliveryDate)
        : purchaseOrder.actualDeliveryDate,
      status: updatePurchaseOrderDto.status || purchaseOrder.status,
      notes: updatePurchaseOrderDto.notes || purchaseOrder.notes,
    });

    // Update items if provided
    if (updatePurchaseOrderDto.items) {
      // Remove existing items
      await this.purchaseOrderItemRepository.delete({ purchaseOrder: { id } });

      // Calculate new totals
      let subtotal = 0;
      for (const itemDto of updatePurchaseOrderDto.items) {
        const quantity = Number(itemDto.quantity);
        const unitPrice = Number(itemDto.unitPrice);
        const itemSubtotal = quantity * unitPrice;
        subtotal += itemSubtotal;

        const item = this.purchaseOrderItemRepository.create({
          ...itemDto,
          quantity,
          unitPrice,
          totalPrice: itemSubtotal,
          subtotal: itemSubtotal,
          purchaseOrder: purchaseOrder,
        });
        await this.purchaseOrderItemRepository.save(item);
      }

      const taxRate = purchaseOrder.taxRate || 0;
      const taxAmount = subtotal * taxRate;
      const discountAmount = purchaseOrder.discountAmount || 0;
      const shippingCost = purchaseOrder.shippingCost || 0;
      const totalAmount = subtotal + taxAmount - discountAmount + shippingCost;

      purchaseOrder.subtotal = Number(subtotal);
      purchaseOrder.taxAmount = Number(taxAmount);
      purchaseOrder.totalAmount = Number(totalAmount);
      purchaseOrder.tax = Number(taxAmount); // Legacy
      purchaseOrder.total = Number(totalAmount); // Legacy
    }

    await this.purchaseOrderRepository.save(purchaseOrder);
    return await this.findOne(id, clinicId);
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdatePurchaseOrderStatusDto,
    approvedById?: string,
    clinicId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, clinicId);

    purchaseOrder.status = updateStatusDto.status;

    if (updateStatusDto.actualDeliveryDate) {
      purchaseOrder.actualDeliveryDate = new Date(updateStatusDto.actualDeliveryDate);
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
    return await this.findOne(id, clinicId);
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const purchaseOrder = await this.findOne(id, clinicId);

    if (purchaseOrder.status === PurchaseOrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot delete delivered purchase order');
    }

    await this.purchaseOrderRepository.remove(purchaseOrder);
  }

  async getOrdersByStatus(status: PurchaseOrderStatus, clinicId?: string): Promise<PurchaseOrder[]> {
    const where = clinicId ? ({ status, clinicId } as any) : ({ status } as any);
    return await this.purchaseOrderRepository.find({
      where,
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrdersBySupplier(supplierId: string, clinicId?: string): Promise<PurchaseOrder[]> {
    const where = clinicId ? ({ supplierId, clinicId } as any) : ({ supplierId } as any);
    return await this.purchaseOrderRepository.find({
      where,
      relations: ['supplier', 'items', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async receive(
    id: string,
    dto: {
      items: {
        itemId: string;
        receivingQuantity: number;
        notes?: string;
        batchNumber?: string;
        expiryDate?: string;
      }[];
      notes?: string;
    },
    clinicId?: string,
  ): Promise<PurchaseOrder> {
    const where = clinicId ? ({ id, clinicId } as any) : ({ id } as any);
    const order = await this.purchaseOrderRepository.findOne({
      where,
      relations: ['items'],
    });

    if (!order) throw new NotFoundException(`Purchase order with ID ${id} not found`);

    if (!order.clinicId) {
      throw new BadRequestException('Cannot receive order without assigned clinic. Please assign a clinic first.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('No se enviaron productos a recibir');
    }

    const itemMap = new Map(order.items.map(i => [i.id, i]));

    // Procesar cada ítem recibido y crear stock
    for (const it of dto.items) {
      const item = itemMap.get(it.itemId);
      if (!item) throw new BadRequestException(`Ítem no pertenece a la orden: ${it.itemId}`);
      const prev = Number(item.receivedQuantity || 0);
      const ordered = Number(item.quantity);
      const remaining = Math.max(ordered - prev, 0);
      const qty = Number(it.receivingQuantity || 0);
      if (qty < 0) throw new BadRequestException('Cantidad a recibir inválida');
      if (qty > remaining) throw new BadRequestException(`Cantidad excede lo pendiente (${remaining})`);

      // Actualizar cantidad recibida
      item.receivedQuantity = prev + qty;
      await this.purchaseOrderItemRepository.save(item);

      // Crear entrada de stock sólo por la cantidad recién recibida (delta) si hay medicationId
      if (qty > 0 && item.medicationId) {
        try {
          const expiry = it.expiryDate
            ? new Date(it.expiryDate)
            : new Date(order.expectedDeliveryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

          await this.inventoryService.addStock(
            {
            medicationId: item.medicationId,
            batchNumber: it.batchNumber || `${order.orderNumber}-${item.id}-${Date.now()}`,
            quantity: qty,
            unitCost: Number(item.unitPrice),
            sellingPrice: Number(item.unitPrice), // Ajustar lógica de pricing si aplica
            expiryDate: expiry.toISOString().substring(0, 10),
            receivedDate: new Date().toISOString().substring(0, 10),
            supplierBatch: undefined,
            location: 'receiving',
            minimumStock: 10,
            clinicId: order.clinicId,
            },
            order.clinicId,
          );
        } catch {
          // No bloquear la recepción completa por un error puntual de stock
        }
      }
    }

    // Determinar estado final
    const allReceived = order.items.every(i => Number(i.receivedQuantity || 0) >= Number(i.quantity));
    order.status = allReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
    if (order.status === PurchaseOrderStatus.RECEIVED && !order.actualDeliveryDate) {
      order.actualDeliveryDate = new Date();
    }
    if (dto.notes) {
      order.notes = dto.notes;
    }

    await this.purchaseOrderRepository.save(order);
    return this.findOne(id, clinicId);
  }

  /**
   * Backfill legacy purchase order items that are missing medicationId but have medicationName or productName.
   * Attempts exact match by (name OR brandName OR code) against medications table.
   * Returns number of updated items and affected orders.
   */
  async backfillMedicationIds(medications: { id: string; name: string; brandName?: string; code: string }[]) {
    const orders = await this.purchaseOrderRepository.find({
      relations: ['items'],
    });

    let updatedItems = 0;
    let affectedOrders = 0;

    for (const order of orders) {
      let orderChanged = false;
      for (const item of order.items) {
        if (!item.medicationId) {
          const referenceName = (item.medicationName || item.productName || '').trim().toLowerCase();
          if (!referenceName) continue;
          const found = medications.find(m => {
            return (
              m.name.trim().toLowerCase() === referenceName ||
              (m.brandName && m.brandName.trim().toLowerCase() === referenceName) ||
              m.code.trim().toLowerCase() === referenceName
            );
          });
          if (found) {
            item.medicationId = found.id;
            item.medicationName = found.name;
            orderChanged = true;
            updatedItems++;
            await this.purchaseOrderItemRepository.save(item);
          }
        }
      }
      if (orderChanged) affectedOrders++;
    }

    return { updatedItems, affectedOrders };
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
