import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment, AppointmentStatus } from '../../appointments/entities/appointment.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { Invoice, InvoiceStatus, Payment, PaymentStatus } from '../../billing/entities/billing.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ReportFilters {
  clinicId?: string;
  doctorId?: string;
  patientId?: string;
  dateRange?: DateRange;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(MedicationStock)
    private readonly medicationStockRepository: Repository<MedicationStock>,
  ) {}

  private requireClinicId(filters: ReportFilters): string {
    if (!filters.clinicId) {
      throw new BadRequestException('clinicId is required');
    }
    return filters.clinicId;
  }

  private applyDateRange(
    queryBuilder: any,
    field: string,
    dateRange?: DateRange,
    parameterPrefix: string = 'date',
  ): void {
    if (!dateRange) return;
    queryBuilder.andWhere(`${field} BETWEEN :${parameterPrefix}Start AND :${parameterPrefix}End`, {
      [`${parameterPrefix}Start`]: dateRange.startDate,
      [`${parameterPrefix}End`]: dateRange.endDate,
    });
  }

  // REPORTES MÉDICOS
  async getPatientDemographicsReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('patient.isActive = true');

    if (filters.patientId) {
      queryBuilder.andWhere('patient.id = :patientId', { patientId: filters.patientId });
    }
    this.applyDateRange(queryBuilder, 'patient.createdAt', filters.dateRange, 'patients');

    const totalPatients = await queryBuilder.clone().getCount();

    // Distribución por género
    const genderDistribution = await queryBuilder
      .clone()
      .select('patient.gender', 'gender')
      .addSelect('COUNT(*)', 'count')
      .groupBy('patient.gender')
      .getRawMany();

    // Distribución por grupos de edad
    const ageExpr = `CASE
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(patient."birthDate")) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END`;
    const ageDistribution = await queryBuilder
      .clone()
      .select(ageExpr, 'ageGroup')
      .addSelect('COUNT(*)', 'count')
      .groupBy(ageExpr)
      .getRawMany();

    // Distribución por tipo de sangre
    const bloodTypeDistribution = await queryBuilder
      .clone()
      .select('patient.bloodType', 'bloodType')
      .addSelect('COUNT(*)', 'count')
      .andWhere('patient.bloodType IS NOT NULL')
      .groupBy('patient.bloodType')
      .getRawMany();

    return {
      totalPatients,
      genderDistribution,
      ageDistribution,
      bloodTypeDistribution,
    };
  }

  async getAppointmentStatisticsReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.clinic', 'clinic')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('appointment.patient', 'patient')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('appointment.isActive = true');

    if (filters.doctorId) {
      queryBuilder.andWhere('doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.patientId) {
      queryBuilder.andWhere('patient.id = :patientId', { patientId: filters.patientId });
    }

    this.applyDateRange(queryBuilder, 'appointment.appointmentDate', filters.dateRange, 'appointments');

    const totalAppointments = await queryBuilder.clone().getCount();

    // Distribución por estado
    const statusDistribution = await queryBuilder
      .clone()
      .select('appointment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.status')
      .getRawMany();

    // Distribución por tipo
    const typeDistribution = await queryBuilder
      .clone()
      .select('appointment.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.type')
      .getRawMany();

    // Distribución por mes
    const monthlyDistribution = await queryBuilder
      .clone()
      .select("TO_CHAR(appointment.appointmentDate, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Tasa de cancelación
    const cancelledAppointments = await queryBuilder
      .clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.CANCELLED })
      .getCount();

    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;

    return {
      totalAppointments,
      statusDistribution,
      typeDistribution,
      monthlyDistribution,
      cancellationRate,
    };
  }

  async getDoctorPerformanceReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('doctor.personalInfo', 'personalInfo')
      .leftJoin('appointment.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('appointment.isActive = true');

    if (filters.doctorId) {
      queryBuilder.andWhere('doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    this.applyDateRange(queryBuilder, 'appointment.appointmentDate', filters.dateRange, 'doctorPerf');

    // Estadísticas por doctor
    const doctorStats = await queryBuilder
      .select('doctor.id', 'doctorId')
      .addSelect("CONCAT(personalInfo.firstName, ' ', personalInfo.lastName)", 'doctorName')
      .addSelect('COUNT(*)', 'totalAppointments')
      .addSelect('SUM(CASE WHEN appointment.status = :completedStatus THEN 1 ELSE 0 END)', 'completedAppointments')
      .addSelect('SUM(CASE WHEN appointment.status = :cancelledStatus THEN 1 ELSE 0 END)', 'cancelledAppointments')
      .addSelect('AVG(appointment.duration)', 'avgDuration')
      .setParameter('completedStatus', AppointmentStatus.COMPLETED)
      .setParameter('cancelledStatus', AppointmentStatus.CANCELLED)
      .groupBy('doctor.id')
      .addGroupBy('personalInfo.firstName')
      .addGroupBy('personalInfo.lastName')
      .getRawMany();

    return doctorStats;
  }

  async getMedicalRecordsReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.medicalRecordRepository
      .createQueryBuilder('record')
      .leftJoin('record.patient', 'patient')
      .leftJoin('patient.clinic', 'clinic')
      .leftJoin('record.doctor', 'doctor')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('record.isActive = true');

    if (filters.doctorId) {
      queryBuilder.andWhere('doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.patientId) {
      queryBuilder.andWhere('patient.id = :patientId', { patientId: filters.patientId });
    }

    this.applyDateRange(queryBuilder, 'record.createdAt', filters.dateRange, 'records');

    const totalRecords = await queryBuilder.clone().getCount();

    // Distribución por tipo
    const typeDistribution = await queryBuilder
      .clone()
      .select('record.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('record.type')
      .getRawMany();

    // Distribución por estado
    const statusDistribution = await queryBuilder
      .clone()
      .select('record.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('record.status')
      .getRawMany();

    return {
      totalRecords,
      typeDistribution,
      statusDistribution,
    };
  }

  // REPORTES FINANCIEROS
  async getFinancialSummaryReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('invoice.isActive = true');

    this.applyDateRange(queryBuilder, 'invoice.issueDate', filters.dateRange, 'financial');

    const totalInvoices = await queryBuilder.clone().getCount();

    const summary = await queryBuilder
      .clone()
      .select('SUM(invoice.totalAmount)', 'totalBilled')
      .addSelect('SUM(invoice.paidAmount)', 'totalPaid')
      .addSelect('SUM(invoice.remainingAmount)', 'totalOutstanding')
      .addSelect('COUNT(CASE WHEN invoice.status = :paidStatus THEN 1 END)', 'paidInvoices')
      .addSelect('COUNT(CASE WHEN invoice.status = :overdueStatus THEN 1 END)', 'overdueInvoices')
      .setParameter('paidStatus', InvoiceStatus.PAID)
      .setParameter('overdueStatus', InvoiceStatus.OVERDUE)
      .getRawOne();

    // Ingresos por mes
    const monthlyRevenue = await queryBuilder
      .clone()
      .select("TO_CHAR(invoice.issueDate, 'YYYY-MM')", 'month')
      .addSelect('SUM(invoice.totalAmount)', 'totalBilled')
      .addSelect('SUM(invoice.paidAmount)', 'totalPaid')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return {
      totalInvoices,
      summary: {
        ...summary,
        collectionRate: summary.totalBilled > 0 ? (summary.totalPaid / summary.totalBilled) * 100 : 0,
      },
      monthlyRevenue,
    };
  }

  async getPaymentMethodReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.invoice', 'invoice')
      .leftJoin('invoice.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('payment.isActive = true')
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED });

    this.applyDateRange(queryBuilder, 'payment.paymentDate', filters.dateRange, 'paymentMethods');

    const paymentMethods = await queryBuilder
      .select('payment.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amount)', 'totalAmount')
      .groupBy('payment.method')
      .getRawMany();

    return paymentMethods;
  }

  // REPORTES DE INVENTARIO
  async getStockReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const queryBuilder = this.medicationStockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.medication', 'medication')
      .leftJoin('stock.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('stock.isActive = true');

    this.applyDateRange(queryBuilder, 'stock.receivedDate', filters.dateRange, 'stock');

    const [lowStockMedications, expiringMedications, stockValueRaw] = await Promise.all([
      queryBuilder.clone().andWhere('stock.availableQuantity <= stock.minimumStock').getMany(),
      queryBuilder.clone().andWhere('stock.expiryDate <= :expiringDate', {
        expiringDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).getMany(),
      queryBuilder
        .clone()
        .select('SUM(stock.availableQuantity * stock.unitCost)', 'stockValue')
        .getRawOne(),
    ]);

    return {
      lowStockMedications,
      expiringMedications,
      stockValue: Number(stockValueRaw?.stockValue || 0),
    };
  }

  // REPORTE GENERAL DEL DASHBOARD
  async getDashboardReport(filters: ReportFilters) {
    const [patientStats, appointmentStats, financialStats] = await Promise.all([
      this.getPatientDemographicsReport(filters),
      this.getAppointmentStatisticsReport(filters),
      this.getFinancialSummaryReport(filters),
    ]);

    return {
      patients: {
        total: patientStats.totalPatients,
        genderDistribution: patientStats.genderDistribution,
      },
      appointments: {
        total: appointmentStats.totalAppointments,
        statusDistribution: appointmentStats.statusDistribution,
        cancellationRate: appointmentStats.cancellationRate,
      },
      financial: {
        totalBilled: financialStats.summary.totalBilled,
        totalPaid: financialStats.summary.totalPaid,
        collectionRate: financialStats.summary.collectionRate,
      },
    };
  }
}
