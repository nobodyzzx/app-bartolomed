import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { CreateInvoiceDto, CreatePaymentDto, UpdateInvoiceDto } from './dto';
import { Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentStatus } from './entities/billing.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createDto: CreateInvoiceDto, user: User, scopedClinicId?: string): Promise<Invoice> {
    if (!scopedClinicId) throw new BadRequestException('clinicId is required');
    if (createDto.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId no coincide con el contexto de clínica');
    }
    this.assertCreatableInvoiceStatus(createDto.status);

    return await this.invoiceRepository.manager.transaction(async manager => {
      const invoiceRepo = manager.getRepository(Invoice);
      const itemRepo = manager.getRepository(InvoiceItem);

      // Verificar que el paciente existe
      const patient = await this.patientRepository.findOne({
        where: { id: createDto.patientId, clinic: { id: scopedClinicId }, isActive: true },
      });
      if (!patient) throw new NotFoundException('Patient not found');

      // Verificar que la clínica existe
      const clinic = await this.clinicRepository.findOne({
        where: { id: createDto.clinicId },
      });
      if (!clinic) throw new NotFoundException('Clinic not found');

      // Verificar appointment si se proporciona
      let appointment = null;
      if (createDto.appointmentId) {
        appointment = await this.appointmentRepository.findOne({
          where: { id: createDto.appointmentId, clinic: { id: scopedClinicId }, patient: { id: patient.id } },
        });
        if (!appointment) throw new NotFoundException('Appointment not found');
      }

      // Calcular subtotal desde los items
      const subtotal = createDto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      // Crear factura
      const invoice = invoiceRepo.create({
        invoiceNumber: createDto.invoiceNumber,
        status: createDto.status || InvoiceStatus.DRAFT,
        issueDate: createDto.issueDate,
        dueDate: createDto.dueDate,
        subtotal,
        taxRate: createDto.taxRate || 0,
        taxAmount: 0,
        discountRate: createDto.discountRate || 0,
        discountAmount: createDto.discountAmount || 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        notes: createDto.notes,
        terms: createDto.terms,
        isInsuranceClaim: createDto.isInsuranceClaim || false,
        insuranceProvider: createDto.insuranceProvider,
        insuranceClaimNumber: createDto.insuranceClaimNumber,
        insuranceCoverage: createDto.insuranceCoverage,
        patient,
        clinic,
        appointment,
        createdBy: user,
      });

      const savedInvoice = await invoiceRepo.save(invoice);

      // Crear items
      const items = createDto.items.map(itemDto => {
        return itemRepo.create({
          description: itemDto.description,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice,
          totalPrice: itemDto.quantity * itemDto.unitPrice,
          serviceCode: itemDto.serviceCode,
          category: itemDto.category,
          invoice: savedInvoice,
        });
      });

      await itemRepo.save(items);

      // Recargar con relaciones
      return await invoiceRepo.findOne({
        where: { id: savedInvoice.id },
        relations: ['patient', 'clinic', 'appointment', 'items', 'payments', 'createdBy'],
      });
    });
  }

  async findAll(page = 1, pageSize = 20, filter: any = {}) {
    const skip = (page - 1) * pageSize;
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('invoice.clinic', 'clinic')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (filter.patientId) {
      qb.andWhere('patient.id = :patientId', { patientId: filter.patientId });
    }
    if (filter.clinicId) {
      qb.andWhere('clinic.id = :clinicId', { clinicId: filter.clinicId });
    }
    if (filter.status) {
      qb.andWhere('invoice.status = :status', { status: filter.status });
    }
    if (filter.search) {
      qb.andWhere(
        '(invoice.invoiceNumber ILIKE :search OR patient.firstName ILIKE :search OR patient.lastName ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }
    if (filter.startDate) {
      qb.andWhere('invoice.issueDate >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      qb.andWhere('invoice.issueDate <= :endDate', { endDate: filter.endDate });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: string, clinicId?: string): Promise<Invoice> {
    const where = clinicId ? ({ id, clinic: { id: clinicId } } as any) : ({ id } as any);
    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['patient', 'clinic', 'appointment', 'items', 'payments', 'createdBy'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(id: string, updateDto: UpdateInvoiceDto, clinicId?: string): Promise<Invoice> {
    return await this.invoiceRepository.manager.transaction(async manager => {
      const invoiceRepo = manager.getRepository(Invoice);
      const itemRepo = manager.getRepository(InvoiceItem);

      const where = clinicId ? ({ id, clinic: { id: clinicId } } as any) : ({ id } as any);
      const invoice = await invoiceRepo.findOne({
        where,
        relations: ['items'],
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      this.assertInvoiceUpdatable(invoice);
      if (updateDto.status && updateDto.status !== invoice.status) {
        throw new BadRequestException('Use status endpoint to change invoice status');
      }

      // Actualizar relaciones si se proporcionan
      if (updateDto.patientId) {
        const patient = await this.patientRepository.findOne({
          where: { id: updateDto.patientId, clinic: { id: clinicId || invoice.clinic.id }, isActive: true },
        });
        if (!patient) throw new NotFoundException('Patient not found');
        invoice.patient = patient;
      }

      if (updateDto.clinicId) {
        if (clinicId && updateDto.clinicId !== clinicId) {
          throw new BadRequestException('Cannot change invoice clinic');
        }
      }

      if (updateDto.appointmentId) {
        const appointment = await this.appointmentRepository.findOne({
          where: {
            id: updateDto.appointmentId,
            clinic: { id: clinicId || invoice.clinic.id },
            patient: { id: invoice.patient.id },
          },
        });
        if (!appointment) throw new NotFoundException('Appointment not found');
        invoice.appointment = appointment;
      }

      // Actualizar campos primitivos
      if (updateDto.invoiceNumber !== undefined) invoice.invoiceNumber = updateDto.invoiceNumber;
      if (updateDto.issueDate !== undefined) invoice.issueDate = updateDto.issueDate;
      if (updateDto.dueDate !== undefined) invoice.dueDate = updateDto.dueDate;
      if (updateDto.taxRate !== undefined) invoice.taxRate = updateDto.taxRate;
      if (updateDto.discountRate !== undefined) invoice.discountRate = updateDto.discountRate;
      if (updateDto.discountAmount !== undefined) invoice.discountAmount = updateDto.discountAmount;
      if (updateDto.notes !== undefined) invoice.notes = updateDto.notes;
      if (updateDto.terms !== undefined) invoice.terms = updateDto.terms;
      if (updateDto.isInsuranceClaim !== undefined) invoice.isInsuranceClaim = updateDto.isInsuranceClaim;
      if (updateDto.insuranceProvider !== undefined) invoice.insuranceProvider = updateDto.insuranceProvider;
      if (updateDto.insuranceClaimNumber !== undefined) invoice.insuranceClaimNumber = updateDto.insuranceClaimNumber;
      if (updateDto.insuranceCoverage !== undefined) invoice.insuranceCoverage = updateDto.insuranceCoverage;

      // Actualizar items si se proporcionan
      if (updateDto.items) {
        // Eliminar items anteriores
        await itemRepo.delete({ invoice: { id } });

        // Calcular nuevo subtotal
        const subtotal = updateDto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        invoice.subtotal = subtotal;

        // Crear nuevos items
        const items = updateDto.items.map(itemDto => {
          return itemRepo.create({
            description: itemDto.description,
            quantity: itemDto.quantity,
            unitPrice: itemDto.unitPrice,
            totalPrice: itemDto.quantity * itemDto.unitPrice,
            serviceCode: itemDto.serviceCode,
            category: itemDto.category,
            invoice,
          });
        });

        await itemRepo.save(items);
      }

      await invoiceRepo.save(invoice);

      return await invoiceRepo.findOne({
        where,
        relations: ['patient', 'clinic', 'appointment', 'items', 'payments', 'createdBy'],
      });
    });
  }

  async setStatus(id: string, status: InvoiceStatus, clinicId?: string): Promise<Invoice> {
    const invoice = await this.findOne(id, clinicId);
    this.assertInvoiceStatusTransition(invoice.status, status);
    invoice.status = status;
    await this.invoiceRepository.save(invoice);
    return this.findOne(id, clinicId);
  }

  async delete(id: string, clinicId?: string): Promise<void> {
    const invoice = await this.findOne(id, clinicId);
    invoice.isActive = false;
    await this.invoiceRepository.save(invoice);
  }

  // Métodos para pagos
  async addPayment(createDto: CreatePaymentDto, user: User, clinicId?: string): Promise<Payment> {
    const invoice = await this.findOne(createDto.invoiceId, clinicId);
    const requestedStatus = createDto.status || PaymentStatus.PENDING;
    if (![PaymentStatus.PENDING, PaymentStatus.COMPLETED].includes(requestedStatus)) {
      throw new BadRequestException('New payments can only be pending or completed');
    }
    if ([InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED].includes(invoice.status)) {
      throw new BadRequestException('Cannot register payments for cancelled/refunded invoice');
    }
    if (createDto.amount > Number(invoice.remainingAmount)) {
      throw new BadRequestException('Payment amount exceeds invoice remaining amount');
    }

    const payment = this.paymentRepository.create({
      paymentNumber: createDto.paymentNumber,
      amount: createDto.amount,
      method: createDto.method,
      status: requestedStatus,
      paymentDate: createDto.paymentDate,
      reference: createDto.reference,
      transactionId: createDto.transactionId,
      notes: createDto.notes,
      invoice,
      processedBy: user,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Actualizar monto pagado de la factura
    if (savedPayment.status === PaymentStatus.COMPLETED) {
      invoice.paidAmount = Number(invoice.paidAmount) + Number(savedPayment.amount);
      if (Number(invoice.paidAmount) > Number(invoice.totalAmount)) {
        throw new BadRequestException('Payment exceeds invoice total amount');
      }
      await this.invoiceRepository.save(invoice);
    }

    return savedPayment;
  }

  async getPaymentsByInvoice(invoiceId: string, clinicId?: string): Promise<Payment[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.processedBy', 'processedBy')
      .leftJoin('payment.invoice', 'invoice')
      .leftJoin('invoice.clinic', 'clinic')
      .where('invoice.id = :invoiceId', { invoiceId })
      .orderBy('payment.createdAt', 'DESC');

    if (clinicId) {
      qb.andWhere('clinic.id = :clinicId', { clinicId });
    }

    return qb.getMany();
  }

  async confirmPayment(paymentId: string, clinicId?: string): Promise<Payment> {
    const paymentQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoin('invoice.clinic', 'clinic')
      .where('payment.id = :paymentId', { paymentId });
    if (clinicId) {
      paymentQb.andWhere('clinic.id = :clinicId', { clinicId });
    }
    const payment = await paymentQb.getOne();
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment already confirmed');
    }
    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Cannot confirm a cancelled payment');
    }

    const previousStatus = payment.status;
    payment.status = PaymentStatus.COMPLETED;
    await this.paymentRepository.save(payment);

    // Actualizar factura solo si el pago estaba pendiente
    if (previousStatus === PaymentStatus.PENDING) {
      const invoice = await this.findOne(payment.invoice.id, clinicId);
      invoice.paidAmount = Number(invoice.paidAmount) + Number(payment.amount);
      if (Number(invoice.paidAmount) > Number(invoice.totalAmount)) {
        throw new BadRequestException('Payment exceeds invoice total amount');
      }
      await this.invoiceRepository.save(invoice);
    }

    return payment;
  }

  async cancelPayment(paymentId: string, clinicId?: string): Promise<Payment> {
    const paymentQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoin('invoice.clinic', 'clinic')
      .where('payment.id = :paymentId', { paymentId });
    if (clinicId) {
      paymentQb.andWhere('clinic.id = :clinicId', { clinicId });
    }
    const payment = await paymentQb.getOne();
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Payment already cancelled');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      // Restar el monto del pago de la factura
      const invoice = await this.findOne(payment.invoice.id, clinicId);
      invoice.paidAmount = Number(invoice.paidAmount) - Number(payment.amount);
      if (Number(invoice.paidAmount) < 0) {
        throw new BadRequestException('Invalid payment cancellation state');
      }
      await this.invoiceRepository.save(invoice);
    }

    payment.status = PaymentStatus.CANCELLED;
    return await this.paymentRepository.save(payment);
  }

  // Estadísticas y reportes
  async getStatistics(clinicId?: string): Promise<any> {
    const qb = this.invoiceRepository.createQueryBuilder('invoice');

    if (clinicId) {
      qb.where('invoice.clinic_id = :clinicId', { clinicId });
    }

    const [allInvoices, totalInvoices] = await qb.getManyAndCount();

    const paid = allInvoices.filter(i => i.status === InvoiceStatus.PAID).length;
    const pending = allInvoices.filter(
      i => i.status === InvoiceStatus.PENDING || i.status === InvoiceStatus.DRAFT,
    ).length;
    const overdue = allInvoices.filter(i => i.status === InvoiceStatus.OVERDUE).length;

    const totalRevenue = allInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const pendingRevenue = allInvoices.reduce((sum, invoice) => sum + Number(invoice.remainingAmount), 0);

    return {
      totalInvoices,
      paid,
      pending,
      overdue,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      pendingRevenue: Number(pendingRevenue.toFixed(2)),
    };
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoiceRepository.count();
    const nextNumber = count + 1;
    return `INV-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  async generatePaymentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.paymentRepository.count();
    const nextNumber = count + 1;
    return `PAY-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  private assertCreatableInvoiceStatus(status?: InvoiceStatus): void {
    if (!status) return;
    if (![InvoiceStatus.DRAFT, InvoiceStatus.PENDING].includes(status)) {
      throw new BadRequestException('New invoices can only start as draft or pending');
    }
  }

  private assertInvoiceUpdatable(invoice: Invoice): void {
    if ([InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED].includes(invoice.status)) {
      throw new BadRequestException('Cannot update cancelled/refunded invoice');
    }
  }

  private assertInvoiceStatusTransition(current: InvoiceStatus, next: InvoiceStatus): void {
    if (current === next) return;
    const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PENDING]: [
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
        InvoiceStatus.CANCELLED,
      ],
      [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
      [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PAID]: [InvoiceStatus.REFUNDED],
      [InvoiceStatus.CANCELLED]: [],
      [InvoiceStatus.REFUNDED]: [],
    };
    if (!transitions[current].includes(next)) {
      throw new BadRequestException(`Invalid invoice status transition from ${current} to ${next}`);
    }
  }
}
