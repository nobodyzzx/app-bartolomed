import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { Charge, ChargeStatus, DiscountDisplay } from '../../charges/entities/charge.entity';
import { User } from '../../users/entities/user.entity';
import { CheckoutDto } from '../dto/checkout.dto';
import { Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentStatus } from '../entities/billing.entity';
import { prorateDiscount, round2 } from '../utils/discount-proration.util';
import { ReceiptPdfService } from './receipt-pdf.service';

/** Último instante del día actual, para que una factura no nazca vencida. */
function endOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Punto de cobro: convierte un conjunto de cargos pendientes en una factura.
 *
 * El paciente puede pagar solo una parte de lo que debe, así que se cobra el
 * subconjunto de cargos que elija y el resto sigue pendiente en su cuenta.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Charge)
    private readonly chargeRepository: Repository<Charge>,
    private readonly auditService: AuditService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  async checkout(dto: CheckoutDto, user: User, clinicId?: string): Promise<Invoice> {
    if (!clinicId) throw new BadRequestException('clinicId is required');

    return this.invoiceRepository.manager.transaction(async manager => {
      const chargeRepo = manager.getRepository(Charge);
      const invoiceRepo = manager.getRepository(Invoice);
      const itemRepo = manager.getRepository(InvoiceItem);
      const paymentRepo = manager.getRepository(Payment);

      const charges = await chargeRepo.find({
        where: { id: In(dto.chargeIds), clinicId },
        relations: ['patient'],
        order: { createdAt: 'ASC' },
      });

      this.assertChargesAreCollectable(charges, dto.chargeIds);
      const patientId = this.assertSinglePatient(charges);

      const discounts = this.resolveDiscounts(charges, dto);
      const subtotal = round2(charges.reduce((sum, c) => sum + c.quantity * c.listPrice, 0));
      const discountTotal = round2(discounts.reduce((sum, d) => sum + d.amount, 0));
      const totalAmount = round2(subtotal - discountTotal);

      const paidAmount = dto.payment ? round2(Math.min(dto.payment.amount, totalAmount)) : 0;
      const invoice = new Invoice();
      Object.assign(invoice, {
        invoiceNumber: await this.nextInvoiceNumber(manager.getRepository(Invoice)),
        status: this.resolveStatus(totalAmount, paidAmount),
        issueDate: new Date(),
        // Fin del día de emisión, no "ahora": el hook de la entidad marca la
        // factura OVERDUE en cuanto `now > dueDate`, así que un cobro parcial
        // nacía vencido milisegundos después de emitirse.
        dueDate: endOfToday(),
        subtotal,
        discountAmount: discountTotal,
        totalAmount,
        paidAmount,
        remainingAmount: round2(totalAmount - paidAmount),
        notes: dto.notes ?? null,
        clinic: { id: clinicId } as any,
        ...(patientId ? { patient: { id: patientId } as any } : {}),
        createdBy: user ? ({ id: user.id } as any) : null,
      });
      const savedInvoice = await invoiceRepo.save(invoice);

      // Una línea de factura por cargo, con el descuento ya aplicado. El
      // `unitPrice` guardado es el neto: así el documento cuadra en los dos
      // modos de presentación, y `absorbed` solo omite la mención al descuento.
      for (const charge of charges) {
        const discount = discounts.find(d => d.chargeId === charge.id);
        const lineDiscount = discount?.amount ?? 0;
        const gross = round2(charge.quantity * charge.listPrice);
        const net = round2(gross - lineDiscount);

        const invoiceItem = new InvoiceItem();
        Object.assign(invoiceItem, {
          description: charge.description,
          quantity: charge.quantity,
          unitPrice: charge.quantity ? round2(net / charge.quantity) : net,
          totalPrice: net,
          category: charge.origin,
          invoice: { id: savedInvoice.id } as any,
        });
        await itemRepo.save(invoiceItem);

        charge.status = ChargeStatus.INVOICED;
        charge.invoiceId = savedInvoice.id;
        charge.discountAmount = lineDiscount;
        charge.discountDisplay = dto.discountDisplay ?? DiscountDisplay.ITEMIZED;
        if (discount) {
          charge.discountReason = discount.reason;
          charge.discountAuthorizedById = user?.id ?? null;
        }
        await chargeRepo.save(charge);
      }

      if (dto.payment && paidAmount > 0) {
        const payment = new Payment();
        Object.assign(payment, {
          paymentNumber: await this.nextPaymentNumber(paymentRepo),
          amount: paidAmount,
          method: dto.payment.method,
          status: PaymentStatus.COMPLETED,
          paymentDate: new Date(),
          reference: dto.payment.reference ?? null,
          invoice: { id: savedInvoice.id } as any,
          processedBy: user ? ({ id: user.id } as any) : null,
        });
        await paymentRepo.save(payment);
      }

      await this.auditDiscount(savedInvoice, discountTotal, dto, user, clinicId);

      return invoiceRepo.findOneOrFail({
        where: { id: savedInvoice.id },
        relations: ['items', 'payments', 'patient', 'clinic'],
      });
    });
  }

  /**
   * Recibo de una factura ya emitida. El `display` pedido puede sobreescribir
   * el guardado — es solo presentación, no altera ningún importe, así que
   * reimprimir en el otro modo es legítimo.
   */
  async buildReceipt(
    invoiceId: string,
    display: string | undefined,
    clinicId?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    if (!clinicId) throw new BadRequestException('clinicId is required');

    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, clinic: { id: clinicId } },
      relations: ['patient', 'clinic'],
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const charges = await this.chargeRepository.find({
      where: { invoiceId, clinicId },
      order: { createdAt: 'ASC' },
    });

    const requested =
      display === DiscountDisplay.ABSORBED || display === DiscountDisplay.ITEMIZED
        ? (display as DiscountDisplay)
        : (charges[0]?.discountDisplay ?? DiscountDisplay.ITEMIZED);

    const buffer = await this.receiptPdfService.generate(invoice, charges, requested);
    return { buffer, fileName: `${invoice.invoiceNumber}.pdf` };
  }

  // ─── validaciones ─────────────────────────────────────────────────────────

  private assertChargesAreCollectable(charges: Charge[], requestedIds: string[]): void {
    if (charges.length !== requestedIds.length) {
      throw new NotFoundException('Alguno de los cargos no existe o es de otra clínica');
    }
    const notPending = charges.filter(c => c.status !== ChargeStatus.PENDING);
    if (notPending.length > 0) {
      throw new BadRequestException(`Ya no está pendiente de cobro: ${notPending.map(c => c.description).join(', ')}`);
    }
  }

  /**
   * Una factura es de un paciente. Mezclar cargos de personas distintas
   * produciría un documento que no se le puede entregar a nadie.
   */
  private assertSinglePatient(charges: Charge[]): string | null {
    const patientIds = new Set(charges.map(c => c.patientId ?? null));
    if (patientIds.size > 1) {
      throw new BadRequestException('Los cargos seleccionados son de pacientes distintos');
    }
    return charges[0]?.patientId ?? null;
  }

  // ─── descuentos ───────────────────────────────────────────────────────────

  /**
   * Combina los descuentos por línea con el descuento sobre el total. El
   * global se prorratea sobre lo que queda tras los de línea, para que nunca
   * se descuente más de lo que vale cada línea.
   */
  private resolveDiscounts(
    charges: Charge[],
    dto: CheckoutDto,
  ): Array<{ chargeId: string; amount: number; reason: string }> {
    const byCharge = new Map<string, { amount: number; reason: string }>();

    for (const line of dto.lineDiscounts ?? []) {
      const charge = charges.find(c => c.id === line.chargeId);
      if (!charge) {
        throw new BadRequestException('Se indicó un descuento para un cargo que no se está cobrando');
      }
      const gross = round2(charge.quantity * charge.listPrice);
      if (line.amount > gross) {
        throw new BadRequestException(`El descuento de "${charge.description}" supera su importe (Bs ${gross})`);
      }
      byCharge.set(charge.id, { amount: round2(line.amount), reason: line.reason });
    }

    if (dto.globalDiscount && dto.globalDiscount.amount > 0) {
      const remaining = charges.map(c => ({
        gross: round2(c.quantity * c.listPrice - (byCharge.get(c.id)?.amount ?? 0)),
      }));
      const shares = prorateDiscount(remaining, dto.globalDiscount.amount);

      charges.forEach((charge, i) => {
        if (shares[i] <= 0) return;
        const existing = byCharge.get(charge.id);
        byCharge.set(charge.id, {
          amount: round2((existing?.amount ?? 0) + shares[i]),
          reason: existing ? `${existing.reason} / ${dto.globalDiscount!.reason}` : dto.globalDiscount!.reason,
        });
      });
    }

    return Array.from(byCharge.entries()).map(([chargeId, d]) => ({ chargeId, ...d }));
  }

  private async auditDiscount(
    invoice: Invoice,
    discountTotal: number,
    dto: CheckoutDto,
    user: User,
    clinicId: string,
  ): Promise<void> {
    if (discountTotal <= 0) return;

    // Con autorización sin tope, este registro es la única defensa que queda:
    // no hay prevención, solo trazabilidad posterior. Se guarda aparte del
    // AuditInterceptor porque este necesita el detalle del descuento.
    await this.auditService.log({
      action: 'DISCOUNT_APPLIED',
      resource: 'Facturación',
      resourceId: invoice.id,
      userId: user?.id,
      userEmail: user?.email,
      clinicId,
      method: 'POST',
      path: '/api/billing/checkout',
      statusCode: 201,
      status: 'success',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        subtotal: invoice.subtotal,
        discountTotal,
        totalCharged: invoice.totalAmount,
        // Se registra cómo se imprimió, pero el importe es el mismo en ambos
        // modos: `absorbed` no oculta nada de lo que queda guardado.
        display: dto.discountDisplay ?? DiscountDisplay.ITEMIZED,
        globalReason: dto.globalDiscount?.reason,
        lineReasons: (dto.lineDiscounts ?? []).map(d => d.reason),
      },
    });
  }

  // ─── numeración ───────────────────────────────────────────────────────────

  private resolveStatus(totalAmount: number, paidAmount: number): InvoiceStatus {
    if (paidAmount <= 0) return InvoiceStatus.PENDING;
    return paidAmount >= totalAmount ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
  }

  private async nextInvoiceNumber(repo: Repository<Invoice>): Promise<string> {
    const count = await repo.count();
    return `FAC-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextPaymentNumber(repo: Repository<Payment>): Promise<string> {
    const count = await repo.count();
    return `PAG-${String(count + 1).padStart(6, '0')}`;
  }
}
