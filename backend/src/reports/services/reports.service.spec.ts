import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment, AppointmentStatus } from '../../appointments/entities/appointment.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { Invoice, InvoiceStatus, Payment, PaymentStatus } from '../../billing/entities/billing.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';

const CLINIC_ID = 'clinic-1';

describe('ReportsService', () => {
  let service: ReportsService;
  let patientRepo: MockRepository<Patient>;
  let appointmentRepo: MockRepository<Appointment>;
  let medicalRecordRepo: MockRepository<MedicalRecord>;
  let invoiceRepo: MockRepository<Invoice>;
  let paymentRepo: MockRepository<Payment>;
  let stockRepo: MockRepository<MedicationStock>;

  beforeEach(async () => {
    patientRepo = createMockRepository<Patient>();
    appointmentRepo = createMockRepository<Appointment>();
    medicalRecordRepo = createMockRepository<MedicalRecord>();
    invoiceRepo = createMockRepository<Invoice>();
    paymentRepo = createMockRepository<Payment>();
    stockRepo = createMockRepository<MedicationStock>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: medicalRecordRepo },
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(MedicationStock), useValue: stockRepo },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('requireClinicId (compartido por todos los reportes)', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.getPatientDemographicsReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getAppointmentStatisticsReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getDoctorPerformanceReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getMedicalRecordsReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getFinancialSummaryReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getPaymentMethodReport({})).rejects.toThrow(BadRequestException);
      await expect(service.getStockReport({})).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPatientDemographicsReport', () => {
    it('agrega filtro por patientId y por rango de fechas cuando vienen informados', async () => {
      const qb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(10),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([{ gender: 'F', count: '6' }])
          .mockResolvedValueOnce([{ ageGroup: '18-30', count: '4' }])
          .mockResolvedValueOnce([{ bloodType: 'O+', count: '3' }]),
      });
      (patientRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getPatientDemographicsReport({
        clinicId: CLINIC_ID,
        patientId: 'patient-1',
        dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });

      expect(qb.andWhere).toHaveBeenCalledWith('patient.id = :patientId', { patientId: 'patient-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('patient.createdAt BETWEEN :patientsStart AND :patientsEnd', {
        patientsStart: '2026-01-01',
        patientsEnd: '2026-01-31',
      });
      expect(result).toEqual({
        totalPatients: 10,
        genderDistribution: [{ gender: 'F', count: '6' }],
        ageDistribution: [{ ageGroup: '18-30', count: '4' }],
        bloodTypeDistribution: [{ bloodType: 'O+', count: '3' }],
      });
    });

    it('no agrega filtro de patientId ni de fechas si no vienen en los filtros', async () => {
      const qb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      (patientRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getPatientDemographicsReport({ clinicId: CLINIC_ID });

      expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('patient.id ='), expect.anything());
      expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('BETWEEN'), expect.anything());
    });
  });

  describe('getAppointmentStatisticsReport', () => {
    const buildQb = (total: number, cancelled: number) =>
      createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValueOnce(total).mockResolvedValueOnce(cancelled),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([{ status: 'confirmed', count: '5' }])
          .mockResolvedValueOnce([{ type: 'consulta', count: '5' }])
          .mockResolvedValueOnce([{ month: '2026-01', count: '5' }]),
      });

    it('calcula cancellationRate cuando hay citas', async () => {
      const qb = buildQb(10, 2);
      (appointmentRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getAppointmentStatisticsReport({
        clinicId: CLINIC_ID,
        doctorId: 'doc-1',
        patientId: 'pat-1',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('doctor.id = :doctorId', { doctorId: 'doc-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('patient.id = :patientId', { patientId: 'pat-1' });
      expect(result.cancellationRate).toBe(20);
    });

    it('cancellationRate es 0 si no hay citas (evita división por cero)', async () => {
      const qb = buildQb(0, 0);
      (appointmentRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getAppointmentStatisticsReport({ clinicId: CLINIC_ID });

      expect(result.cancellationRate).toBe(0);
    });
  });

  describe('getDoctorPerformanceReport', () => {
    it('agrupa por doctor y filtra por doctorId si viene informado', async () => {
      const qb = createMockQueryBuilder({
        setParameter: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ doctorId: 'doc-1', doctorName: 'Ana Pérez', totalAppointments: '12' }]),
      });
      (appointmentRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getDoctorPerformanceReport({ clinicId: CLINIC_ID, doctorId: 'doc-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('doctor.id = :doctorId', { doctorId: 'doc-1' });
      expect(qb.setParameter).toHaveBeenCalledWith('completedStatus', AppointmentStatus.COMPLETED);
      expect(qb.setParameter).toHaveBeenCalledWith('cancelledStatus', AppointmentStatus.CANCELLED);
      expect(result).toEqual([{ doctorId: 'doc-1', doctorName: 'Ana Pérez', totalAppointments: '12' }]);
    });
  });

  describe('getMedicalRecordsReport', () => {
    it('filtra por doctorId y patientId y devuelve las distribuciones', async () => {
      const qb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(7),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([{ type: 'consultation', count: '4' }])
          .mockResolvedValueOnce([{ status: 'final', count: '7' }]),
      });
      (medicalRecordRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getMedicalRecordsReport({
        clinicId: CLINIC_ID,
        doctorId: 'doc-1',
        patientId: 'pat-1',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('doctor.id = :doctorId', { doctorId: 'doc-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('patient.id = :patientId', { patientId: 'pat-1' });
      expect(result.totalRecords).toBe(7);
    });
  });

  describe('getFinancialSummaryReport', () => {
    it('calcula collectionRate cuando hay facturación', async () => {
      const qb = createMockQueryBuilder({
        setParameter: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        getRawOne: jest.fn().mockResolvedValue({ totalBilled: 1000, totalPaid: 750, totalOutstanding: 250 }),
        getRawMany: jest.fn().mockResolvedValue([{ month: '2026-01', totalBilled: '1000', totalPaid: '750' }]),
      });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getFinancialSummaryReport({ clinicId: CLINIC_ID });

      expect(qb.setParameter).toHaveBeenCalledWith('paidStatus', InvoiceStatus.PAID);
      expect(qb.setParameter).toHaveBeenCalledWith('overdueStatus', InvoiceStatus.OVERDUE);
      expect(result.summary.collectionRate).toBe(75);
    });

    it('collectionRate es 0 si totalBilled es 0', async () => {
      const qb = createMockQueryBuilder({
        setParameter: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue({ totalBilled: 0, totalPaid: 0 }),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getFinancialSummaryReport({ clinicId: CLINIC_ID });

      expect(result.summary.collectionRate).toBe(0);
    });
  });

  describe('getPaymentMethodReport', () => {
    it('filtra solo pagos completados y agrupa por método', async () => {
      const qb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([{ method: 'QR', count: '3', totalAmount: '450' }]),
      });
      (paymentRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getPaymentMethodReport({ clinicId: CLINIC_ID });

      expect(qb.andWhere).toHaveBeenCalledWith('payment.status = :status', { status: PaymentStatus.COMPLETED });
      expect(result).toEqual([{ method: 'QR', count: '3', totalAmount: '450' }]);
    });
  });

  describe('getStockReport', () => {
    it('ejecuta las 3 consultas en paralelo y calcula stockValue', async () => {
      const lowStock = [{ id: 'stock-1' }];
      const expiring = [{ id: 'stock-2' }];
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValueOnce(lowStock).mockResolvedValueOnce(expiring),
        getRawOne: jest.fn().mockResolvedValue({ stockValue: '2500.50' }),
      });
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getStockReport({ clinicId: CLINIC_ID });

      expect(result).toEqual({
        lowStockMedications: lowStock,
        expiringMedications: expiring,
        stockValue: 2500.5,
      });
    });

    it('stockValue es 0 si la consulta devuelve null', async () => {
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ stockValue: null }),
      });
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getStockReport({ clinicId: CLINIC_ID });

      expect(result.stockValue).toBe(0);
    });
  });

  describe('getDashboardReport', () => {
    it('combina paciente, citas y financiero en un solo resumen', async () => {
      const patientQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(20),
        getRawMany: jest.fn().mockResolvedValue([{ gender: 'F', count: '12' }]),
      });
      const appointmentQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValueOnce(50).mockResolvedValueOnce(5),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      const invoiceQb = createMockQueryBuilder({
        setParameter: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(30),
        getRawOne: jest.fn().mockResolvedValue({ totalBilled: 5000, totalPaid: 4000 }),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      (patientRepo.createQueryBuilder as jest.Mock).mockReturnValue(patientQb);
      (appointmentRepo.createQueryBuilder as jest.Mock).mockReturnValue(appointmentQb);
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(invoiceQb);

      const result = await service.getDashboardReport({ clinicId: CLINIC_ID });

      expect(result).toEqual({
        patients: { total: 20, genderDistribution: [{ gender: 'F', count: '12' }] },
        appointments: { total: 50, statusDistribution: [], cancellationRate: 10 },
        financial: { totalBilled: 5000, totalPaid: 4000, collectionRate: 80 },
      });
    });
  });
});
