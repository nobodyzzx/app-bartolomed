import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment, AppointmentStatus } from '../../appointments/entities/appointment.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { Invoice, InvoiceStatus } from '../../billing/entities/billing.entity';

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
  ) {}

  // REPORTES MÉDICOS
  async getPatientDemographicsReport(filters: ReportFilters) {
    const queryBuilder = this.patientRepository.createQueryBuilder('patient');

    if (filters.clinicId) {
      queryBuilder.andWhere('patient.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('patient.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    const totalPatients = await queryBuilder.getCount();

    // Distribución por género
    const genderDistribution = await queryBuilder
      .select('patient.gender', 'gender')
      .addSelect('COUNT(*)', 'count')
      .groupBy('patient.gender')
      .getRawMany();

    // Distribución por grupos de edad
    const ageDistribution = await queryBuilder
      .select(
        `CASE 
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(patient.birthDate)) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END`,
        'ageGroup',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('ageGroup')
      .getRawMany();

    // Distribución por tipo de sangre
    const bloodTypeDistribution = await queryBuilder
      .select('patient.bloodType', 'bloodType')
      .addSelect('COUNT(*)', 'count')
      .where('patient.bloodType IS NOT NULL')
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
    const queryBuilder = this.appointmentRepository.createQueryBuilder('appointment');

    if (filters.clinicId) {
      queryBuilder.andWhere('appointment.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.doctorId) {
      queryBuilder.andWhere('appointment.doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('appointment.appointmentDate BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    const totalAppointments = await queryBuilder.getCount();

    // Distribución por estado
    const statusDistribution = await queryBuilder
      .select('appointment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.status')
      .getRawMany();

    // Distribución por tipo
    const typeDistribution = await queryBuilder
      .select('appointment.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.type')
      .getRawMany();

    // Distribución por mes
    const monthlyDistribution = await queryBuilder
      .select("TO_CHAR(appointment.appointmentDate, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Tasa de cancelación
    const cancelledAppointments = await queryBuilder
      .where('appointment.status = :status', { status: AppointmentStatus.CANCELLED })
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
    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.doctor', 'doctor');

    if (filters.clinicId) {
      queryBuilder.andWhere('appointment.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.doctorId) {
      queryBuilder.andWhere('appointment.doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('appointment.appointmentDate BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    // Estadísticas por doctor
    const doctorStats = await queryBuilder
      .select('doctor.id', 'doctorId')
      .addSelect("CONCAT(doctor.personalInfo.firstName, ' ', doctor.personalInfo.lastName)", 'doctorName')
      .addSelect('COUNT(*)', 'totalAppointments')
      .addSelect('SUM(CASE WHEN appointment.status = :completedStatus THEN 1 ELSE 0 END)', 'completedAppointments')
      .addSelect('SUM(CASE WHEN appointment.status = :cancelledStatus THEN 1 ELSE 0 END)', 'cancelledAppointments')
      .addSelect('AVG(appointment.duration)', 'avgDuration')
      .setParameter('completedStatus', AppointmentStatus.COMPLETED)
      .setParameter('cancelledStatus', AppointmentStatus.CANCELLED)
      .groupBy('doctor.id')
      .addGroupBy('doctorName')
      .getRawMany();

    return doctorStats;
  }

  async getMedicalRecordsReport(filters: ReportFilters) {
    const queryBuilder = this.medicalRecordRepository.createQueryBuilder('record');

    if (filters.clinicId) {
      queryBuilder
        .leftJoin('record.patient', 'patient')
        .andWhere('patient.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.doctorId) {
      queryBuilder.andWhere('record.doctor.id = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('record.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    const totalRecords = await queryBuilder.getCount();

    // Distribución por tipo
    const typeDistribution = await queryBuilder
      .select('record.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('record.type')
      .getRawMany();

    // Distribución por estado
    const statusDistribution = await queryBuilder
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
    const queryBuilder = this.invoiceRepository.createQueryBuilder('invoice');

    if (filters.clinicId) {
      queryBuilder.andWhere('invoice.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('invoice.issueDate BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    const totalInvoices = await queryBuilder.getCount();

    const summary = await queryBuilder
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
    const queryBuilder = this.invoiceRepository.createQueryBuilder('invoice').leftJoin('invoice.payments', 'payment');

    if (filters.clinicId) {
      queryBuilder.andWhere('invoice.clinic.id = :clinicId', { clinicId: filters.clinicId });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('payment.paymentDate BETWEEN :startDate AND :endDate', {
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });
    }

    const paymentMethods = await queryBuilder
      .select('payment.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amount)', 'totalAmount')
      .where('payment.status = :status', { status: 'completed' })
      .groupBy('payment.method')
      .getRawMany();

    return paymentMethods;
  }

  // REPORTES DE INVENTARIO
  async getStockReport(filters: ReportFilters) {
    // Este reporte se implementaría cuando tengamos el repositorio de MedicationStock
    // Por ahora retornamos un placeholder
    // TODO: Implementar con filtros cuando esté disponible el repositorio de MedicationStock
    console.log('Stock report filters:', filters);
    return {
      lowStockMedications: [],
      expiringMedications: [],
      stockValue: 0,
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
