import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AdvancedReportsService } from './advanced-reports.service';
import { PharmacySale, PharmacySaleItem } from '../../pharmacy/entities/pharmacy-sale.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { Prescription, PrescriptionItem } from '../../prescriptions/entities/prescription.entity';
import { StockTransfer } from '../../transfers/entities/stock-transfer.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';

const CLINIC_ID = 'clinic-1';

describe('AdvancedReportsService', () => {
  let service: AdvancedReportsService;
  let dataSource: { query: jest.Mock; createQueryBuilder: jest.Mock };
  let stockRepo: MockRepository<MedicationStock>;
  let saleItemRepo: MockRepository<PharmacySaleItem>;
  let prescriptionItemRepo: MockRepository<PrescriptionItem>;

  beforeEach(async () => {
    dataSource = { query: jest.fn(), createQueryBuilder: jest.fn() };
    stockRepo = createMockRepository<MedicationStock>();
    saleItemRepo = createMockRepository<PharmacySaleItem>();
    prescriptionItemRepo = createMockRepository<PrescriptionItem>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedReportsService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(MedicationStock), useValue: stockRepo },
        { provide: getRepositoryToken(PharmacySale), useValue: createMockRepository() },
        { provide: getRepositoryToken(PharmacySaleItem), useValue: saleItemRepo },
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
        { provide: getRepositoryToken(PrescriptionItem), useValue: prescriptionItemRepo },
        { provide: getRepositoryToken(StockTransfer), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<AdvancedReportsService>(AdvancedReportsService);
  });

  describe('guard de clinicId compartido', () => {
    it('lanza BadRequestException en todos los reportes que lo requieren', async () => {
      const methodsRequiringClinicId: Array<[string, (...args: any[]) => Promise<any>]> = [
        ['getPharmacyConsumptionReport', f => service.getPharmacyConsumptionReport(f)],
        ['getTransferEfficiencyReport', f => service.getTransferEfficiencyReport(f)],
        ['getCriticalStockReport', f => service.getCriticalStockReport(f)],
        ['getRotationReport', f => service.getRotationReport(f)],
        ['getTopSellingMedications', f => service.getTopSellingMedications(f)],
        ['getProductMarginReport', f => service.getProductMarginReport(f)],
        ['getDailySalesSummary', f => service.getDailySalesSummary(f)],
        ['getExpiryBucketReport', f => service.getExpiryBucketReport(f)],
        ['getPurchaseVsConsumption', f => service.getPurchaseVsConsumption(f)],
        ['getSalesByCategory', f => service.getSalesByCategory(f)],
        ['getStockMovementsReport', f => service.getStockMovementsReport(f)],
        ['getSupplierAnalysis', f => service.getSupplierAnalysis(f)],
        ['getPrescriptionDispensingSummary', f => service.getPrescriptionDispensingSummary(f)],
        ['getCreditSales', f => service.getCreditSales(f)],
        ['getSalesByPaymentMethod', f => service.getSalesByPaymentMethod(f)],
        ['getMonthlyProfitability', f => service.getMonthlyProfitability(f)],
        ['getPrescriptionDispensationAudit', f => service.getPrescriptionDispensationAudit(f)],
        ['getSalesByPharmacist', f => service.getSalesByPharmacist(f)],
        ['getSalesByPharmacistMedicationDay', f => service.getSalesByPharmacistMedicationDay(f)],
        ['getValorizedInventory', f => service.getValorizedInventory(f)],
        ['getInventoryByCategory', f => service.getInventoryByCategory(f)],
        ['getMedicationsWithoutMovement', f => service.getMedicationsWithoutMovement(f)],
        ['getSalesByMedicationDetail', f => service.getSalesByMedicationDetail(f)],
        ['getPrescriptionVsFreeSales', f => service.getPrescriptionVsFreeSales(f)],
        ['getSalesByPaymentDetailed', f => service.getSalesByPaymentDetailed(f)],
        ['getMonthlySalesComparison', f => service.getMonthlySalesComparison(f)],
      ];

      for (const [, call] of methodsRequiringClinicId) {
        await expect(call({})).rejects.toThrow(BadRequestException);
      }
    });

    it('getPatientTimeline exige patientId', async () => {
      await expect(service.getPatientTimeline('', CLINIC_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPharmacyConsumptionReport (R-09)', () => {
    it('combina dispensed, received y stockSummary con defaults numéricos', async () => {
      const dispatchQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([{ medicationId: 'm1', totalDispensed: '10' }]),
      });
      (saleItemRepo.createQueryBuilder as jest.Mock).mockReturnValue(dispatchQb);

      const receivedQb = createMockQueryBuilder({
        from: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ medicationId: 'm1', totalReceived: '3' }]),
      });
      dataSource.createQueryBuilder.mockReturnValue(receivedQb);

      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        createMockQueryBuilder({
          getRawOne: jest.fn().mockResolvedValue({ totalStockValue: '999.5', totalUnits: '40' }),
        }),
      );

      const result = await service.getPharmacyConsumptionReport({ clinicId: CLINIC_ID });

      expect(result.dispensed).toEqual([{ medicationId: 'm1', totalDispensed: '10' }]);
      expect(result.received).toEqual([{ medicationId: 'm1', totalReceived: '3' }]);
      expect(result.stockSummary).toEqual({ totalStockValue: 999.5, totalUnits: 40 });
    });

    it('agrega filtro de dateRange en ambas consultas si viene informado', async () => {
      const dispatchQb = createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) });
      (saleItemRepo.createQueryBuilder as jest.Mock).mockReturnValue(dispatchQb);
      const receivedQb = createMockQueryBuilder({
        from: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      dataSource.createQueryBuilder.mockReturnValue(receivedQb);
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue(null) }),
      );

      await service.getPharmacyConsumptionReport({
        clinicId: CLINIC_ID,
        dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });

      expect(dispatchQb.andWhere).toHaveBeenCalledWith('ps."saleDate" >= :startDate', { startDate: '2026-01-01' });
      expect(dispatchQb.andWhere).toHaveBeenCalledWith('ps."saleDate" <= :endDate', { endDate: '2026-01-31' });
      expect(receivedQb.andWhere).toHaveBeenCalledWith('st."receivedAt" >= :startDate', { startDate: '2026-01-01' });
      expect(receivedQb.andWhere).toHaveBeenCalledWith('st."receivedAt" <= :endDate', { endDate: '2026-01-31' });
    });

    it('stockSummary usa 0 si la query de stock devuelve null', async () => {
      (saleItemRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }),
      );
      dataSource.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder({ from: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue([]) }),
      );
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue(null) }),
      );

      const result = await service.getPharmacyConsumptionReport({ clinicId: CLINIC_ID });

      expect(result.stockSummary).toEqual({ totalStockValue: 0, totalUnits: 0 });
    });
  });

  describe('getPatientTimeline (R-10)', () => {
    it('devuelve totalEvents, clinicsInvolved únicos y el timeline crudo', async () => {
      dataSource.query.mockResolvedValue([
        { event_type: 'appointment', clinic_id: CLINIC_ID, clinic_name: 'Clínica Norte' },
        { event_type: 'prescription', clinic_id: CLINIC_ID, clinic_name: 'Clínica Norte' },
        { event_type: 'medical_record', clinic_id: 'other-clinic', clinic_name: 'Clínica Sur' },
      ]);

      const result = await service.getPatientTimeline('patient-1', CLINIC_ID);

      expect(result.patientId).toBe('patient-1');
      expect(result.totalEvents).toBe(3);
      expect(result.clinicsInvolved).toEqual(['Clínica Norte', 'Clínica Sur']);
      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), ['patient-1']);
    });

    it('filtra clinic_name falsy del set de clínicas involucradas', async () => {
      dataSource.query.mockResolvedValue([{ event_type: 'appointment', clinic_id: CLINIC_ID, clinic_name: null }]);

      const result = await service.getPatientTimeline('patient-1', CLINIC_ID);

      expect(result.clinicsInvolved).toEqual([]);
    });
  });

  describe('getTransferEfficiencyReport (R-11)', () => {
    it('combina kpiByRoute y stalledTransfers, exponiendo stalledCount', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ source_clinic_id: 'a', target_clinic_id: 'b', total_completed: 5 }])
        .mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]);

      const result = await service.getTransferEfficiencyReport({ clinicId: CLINIC_ID });

      expect(result.kpiByRoute).toHaveLength(1);
      expect(result.stalledTransfers).toHaveLength(2);
      expect(result.stalledCount).toBe(2);
    });
  });

  describe('getCriticalStockReport (R-12)', () => {
    it('ejecuta las 3 consultas en paralelo y calcula totalAtRiskValue redondeado', async () => {
      const qb = createMockQueryBuilder({
        getMany: jest
          .fn()
          .mockResolvedValueOnce([{ availableQuantity: 2, unitCost: '10.555' }])
          .mockResolvedValueOnce([{ availableQuantity: 1, unitCost: '5' }])
          .mockResolvedValueOnce([]),
      });
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getCriticalStockReport({ clinicId: CLINIC_ID });

      expect(result.summary.belowMinimumCount).toBe(1);
      expect(result.summary.expiringSoonCount).toBe(1);
      expect(result.summary.expiredCount).toBe(0);
      // 2*10.555 + 1*5 = 26.11
      expect(result.summary.totalAtRiskValue).toBe(26.11);
    });

    it('acepta expiryDays custom', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      (stockRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getCriticalStockReport({ clinicId: CLINIC_ID }, 90);

      expect(qb.andWhere).toHaveBeenCalledWith('ms.expiryDate <= :expiryThreshold', {
        expiryThreshold: expect.any(Date),
      });
    });
  });

  describe('getRotationReport (F1-R1)', () => {
    it('asigna alertLevel según los umbrales de daysRemaining', async () => {
      dataSource.query.mockResolvedValue([
        { medicationName: 'Crítico', daysRemaining: 6 },
        { medicationName: 'Límite crítico', daysRemaining: 7 },
        { medicationName: 'Warning', daysRemaining: 29 },
        { medicationName: 'Límite warning', daysRemaining: 30 },
        { medicationName: 'OK', daysRemaining: 9999 },
      ]);

      const result = await service.getRotationReport({ clinicId: CLINIC_ID });

      expect(result.map((r: any) => r.alertLevel)).toEqual(['critical', 'warning', 'warning', 'ok', 'ok']);
    });

    it('usa startDate/endDate por defecto (últimos 30 días) si no vienen en el filtro', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.getRotationReport({ clinicId: CLINIC_ID });

      const [, params] = dataSource.query.mock.calls[0];
      expect(params[0]).toBe(CLINIC_ID);
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(params[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('reportes de pass-through simple (guard + delega en dataSource.query)', () => {
    it('getTopSellingMedications aplica el filtro de fechas embebido en el SQL', async () => {
      dataSource.query.mockResolvedValue([{ medicationName: 'A' }]);
      const result = await service.getTopSellingMedications({
        clinicId: CLINIC_ID,
        dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });
      expect(result).toEqual([{ medicationName: 'A' }]);
      expect(dataSource.query.mock.calls[0][0]).toContain(`ps."saleDate" >= '2026-01-01'`);
      expect(dataSource.query.mock.calls[0][0]).toContain(`ps."saleDate" <= '2026-01-31'`);
    });

    it('getProductMarginReport devuelve el resultado de la query', async () => {
      dataSource.query.mockResolvedValue([{ medicationName: 'A', marginPct: '10' }]);
      const result = await service.getProductMarginReport({ clinicId: CLINIC_ID });
      expect(result).toEqual([{ medicationName: 'A', marginPct: '10' }]);
    });

    it('getSalesByCategory devuelve el resultado de la query', async () => {
      dataSource.query.mockResolvedValue([{ category: 'Analgésicos' }]);
      const result = await service.getSalesByCategory({ clinicId: CLINIC_ID });
      expect(result).toEqual([{ category: 'Analgésicos' }]);
    });

    it('getStockMovementsReport agrega el filtro de medicationId si viene informado', async () => {
      dataSource.query.mockResolvedValue([]);
      await service.getStockMovementsReport({ clinicId: CLINIC_ID, medicationId: 'med-9' });
      expect(dataSource.query.mock.calls[0][0]).toContain("ms.medication_id = 'med-9'");
    });

    it('getStockMovementsReport no agrega filtro de medicationId si no viene', async () => {
      dataSource.query.mockResolvedValue([]);
      await service.getStockMovementsReport({ clinicId: CLINIC_ID });
      expect(dataSource.query.mock.calls[0][0]).not.toContain('ms.medication_id =');
    });

    it('getSupplierAnalysis devuelve el resultado de la query', async () => {
      dataSource.query.mockResolvedValue([{ supplier: 'Distribuidora SA' }]);
      const result = await service.getSupplierAnalysis({ clinicId: CLINIC_ID });
      expect(result).toEqual([{ supplier: 'Distribuidora SA' }]);
    });

    it('getInventoryByCategory devuelve el resultado de la query', async () => {
      dataSource.query.mockResolvedValue([{ category: 'X' }]);
      const result = await service.getInventoryByCategory({ clinicId: CLINIC_ID });
      expect(result).toEqual([{ category: 'X' }]);
    });

    it('getSalesByMedicationDetail devuelve el resultado de la query', async () => {
      dataSource.query.mockResolvedValue([{ medicationName: 'A' }]);
      const result = await service.getSalesByMedicationDetail({ clinicId: CLINIC_ID });
      expect(result).toEqual([{ medicationName: 'A' }]);
    });
  });

  describe('getDailySalesSummary (F1-R4)', () => {
    it('combina dailySales y paymentBreakdown en paralelo', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ date: '2026-01-01', totalRevenue: '100' }])
        .mockResolvedValueOnce([{ method: 'cash', total: '100' }]);

      const result = await service.getDailySalesSummary({ clinicId: CLINIC_ID });

      expect(result.dailySales).toEqual([{ date: '2026-01-01', totalRevenue: '100' }]);
      expect(result.paymentBreakdown).toEqual([{ method: 'cash', total: '100' }]);
    });
  });

  describe('getExpiryBucketReport (F1-R5)', () => {
    it('agrupa por bucket y calcula counts/values redondeados', async () => {
      dataSource.query.mockResolvedValue([
        { bucket: 'already_expired', stockValue: '10.505' },
        { bucket: 'expires_lt30', stockValue: '5' },
        { bucket: 'expires_lt30', stockValue: '5' },
        { bucket: 'expires_60_90', stockValue: '20' },
      ]);

      const result = await service.getExpiryBucketReport({ clinicId: CLINIC_ID });

      expect(result.summary).toEqual({
        alreadyExpiredCount: 1,
        lt30Count: 2,
        bt30_60Count: 0,
        bt60_90Count: 1,
        alreadyExpiredValue: 10.51,
        lt30Value: 10,
        bt30_60Value: 0,
        bt60_90Value: 20,
      });
    });

    it('ignora buckets desconocidos que no estén en el mapa', async () => {
      dataSource.query.mockResolvedValue([{ bucket: 'ok', stockValue: '5' }]);
      const result = await service.getExpiryBucketReport({ clinicId: CLINIC_ID });
      expect(
        result.summary.alreadyExpiredCount +
          result.summary.lt30Count +
          result.summary.bt30_60Count +
          result.summary.bt60_90Count,
      ).toBe(0);
    });
  });

  describe('getPurchaseVsConsumption (F2-R6)', () => {
    it('fusiona compras y ventas por mes+medicamento y calcula balance', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ month: '2026-01', medicationName: 'A', qtyPurchased: '50' }])
        .mockResolvedValueOnce([{ month: '2026-01', medicationName: 'A', qtySold: '20' }]);

      const result = await service.getPurchaseVsConsumption({ clinicId: CLINIC_ID });

      expect(result).toEqual([{ month: '2026-01', medicationName: 'A', qtyPurchased: 50, qtySold: 20, balance: 30 }]);
    });

    it('incluye medicamentos vendidos que no tuvieron compra en el período', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ month: '2026-01', medicationName: 'B', qtySold: '15' }]);

      const result = await service.getPurchaseVsConsumption({ clinicId: CLINIC_ID });

      expect(result).toEqual([{ month: '2026-01', medicationName: 'B', qtyPurchased: 0, qtySold: 15, balance: -15 }]);
    });

    it('ordena por mes y luego por nombre de medicamento', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { month: '2026-02', medicationName: 'Z', qtyPurchased: '1' },
          { month: '2026-01', medicationName: 'B', qtyPurchased: '1' },
        ])
        .mockResolvedValueOnce([{ month: '2026-01', medicationName: 'A', qtySold: '1' }]);

      const result = await service.getPurchaseVsConsumption({ clinicId: CLINIC_ID });

      expect(result.map((r: any) => `${r.month}-${r.medicationName}`)).toEqual(['2026-01-A', '2026-01-B', '2026-02-Z']);
    });
  });

  describe('getPrescriptionDispensingSummary (F2-R10)', () => {
    it('calcula dispensingRate como porcentaje redondeado', async () => {
      dataSource.query.mockResolvedValue([{ totalActive: '2', totalDispensed: '8', totalExpiredUndispensed: '1' }]);

      const result = await service.getPrescriptionDispensingSummary({ clinicId: CLINIC_ID });

      expect(result).toEqual({
        totalActive: 2,
        totalDispensed: 8,
        totalExpiredUndispensed: 1,
        dispensingRate: 80,
      });
    });

    it('dispensingRate es 0 si no hay recetas', async () => {
      dataSource.query.mockResolvedValue([{ totalActive: '0', totalDispensed: '0', totalExpiredUndispensed: '0' }]);
      const result = await service.getPrescriptionDispensingSummary({ clinicId: CLINIC_ID });
      expect(result.dispensingRate).toBe(0);
    });
  });

  describe('getCreditSales (F3-R11)', () => {
    it('agrupa en buckets de antigüedad y suma pendingAmount por bucket', async () => {
      dataSource.query.mockResolvedValue([
        { bucket: '0-7d', pendingAmount: '100' },
        { bucket: '7-30d', pendingAmount: '50.555' },
        { bucket: '+30d', pendingAmount: '20' },
        { bucket: '+30d', pendingAmount: '10' },
      ]);

      const result = await service.getCreditSales({ clinicId: CLINIC_ID });

      expect(result).toEqual([
        { bucket: '0-7d', count: 1, totalPending: 100, sales: expect.any(Array) },
        { bucket: '7-30d', count: 1, totalPending: 50.56, sales: expect.any(Array) },
        { bucket: '+30d', count: 2, totalPending: 30, sales: expect.any(Array) },
      ]);
    });
  });

  describe('getSalesByPaymentMethod (F3-R12)', () => {
    it('calcula pct sobre el grandTotal de byMethod', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { method: 'cash', total: '750' },
          { method: 'qr', total: '250' },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getSalesByPaymentMethod({ clinicId: CLINIC_ID });

      expect(result.byMethod).toEqual([
        { method: 'cash', total: '750', pct: 75 },
        { method: 'qr', total: '250', pct: 25 },
      ]);
    });

    it('pct es 0 si grandTotal es 0', async () => {
      dataSource.query.mockResolvedValueOnce([{ method: 'cash', total: '0' }]).mockResolvedValueOnce([]);
      const result = await service.getSalesByPaymentMethod({ clinicId: CLINIC_ID });
      expect(result.byMethod[0].pct).toBe(0);
    });
  });

  describe('getMonthlyProfitability (F3-R13)', () => {
    it('calcula grossMarginPct redondeado a 1 decimal', async () => {
      dataSource.query.mockResolvedValue([{ month: '2026-01', revenue: '1000', cogs: '600', grossMargin: '400' }]);

      const result = await service.getMonthlyProfitability({ clinicId: CLINIC_ID });

      expect(result).toEqual([{ month: '2026-01', revenue: 1000, cogs: 600, grossMargin: 400, grossMarginPct: 40 }]);
    });

    it('grossMarginPct es 0 si revenue es 0', async () => {
      dataSource.query.mockResolvedValue([{ month: '2026-01', revenue: '0', cogs: '0', grossMargin: '0' }]);
      const result = await service.getMonthlyProfitability({ clinicId: CLINIC_ID });
      expect(result[0].grossMarginPct).toBe(0);
    });
  });

  describe('getPrescriptionDispensationAudit (R-13)', () => {
    it('particiona en fullyDispensed / withDiscrepancy / neverDispensed', async () => {
      const qb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { prescriptionId: 'p1', prescriptionStatus: 'dispensed', dispensedQty: '5' },
          { prescriptionId: 'p2', prescriptionStatus: 'dispensed', dispensedQty: '0' },
          { prescriptionId: 'p3', prescriptionStatus: 'active', dispensedQty: '0' },
        ]),
      });
      (prescriptionItemRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getPrescriptionDispensationAudit({ clinicId: CLINIC_ID });

      expect(result.summary).toEqual({ total: 3, fullyDispensed: 1, withDiscrepancy: 1, neverDispensed: 1 });
    });

    it('filtra por doctorId y rango de fechas si vienen informados', async () => {
      const qb = createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) });
      (prescriptionItemRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getPrescriptionDispensationAudit({
        clinicId: CLINIC_ID,
        doctorId: 'doc-1',
        dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });

      expect(qb.andWhere).toHaveBeenCalledWith('doctor.id = :doctorId', { doctorId: 'doc-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('p.prescription_date >= :startDate', { startDate: '2026-01-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('p.prescription_date <= :endDate', { endDate: '2026-01-31' });
    });
  });

  describe('getSalesByPharmacist (A1)', () => {
    it('calcula revenuePct sobre el grandTotal', async () => {
      dataSource.query.mockResolvedValue([
        { pharmacistName: 'Ana', totalRevenue: '600' },
        { pharmacistName: 'Beto', totalRevenue: '400' },
      ]);

      const result = await service.getSalesByPharmacist({ clinicId: CLINIC_ID });

      expect(result.map((r: any) => r.revenuePct)).toEqual([60, 40]);
    });

    it('revenuePct es 0 si grandTotal es 0', async () => {
      dataSource.query.mockResolvedValue([{ pharmacistName: 'Ana', totalRevenue: '0' }]);
      const result = await service.getSalesByPharmacist({ clinicId: CLINIC_ID });
      expect(result[0].revenuePct).toBe(0);
    });
  });

  describe('getSalesByPharmacistMedicationDay (A2)', () => {
    it('agrupa por farmacéutico y día, formateando saleDay tanto Date como string', async () => {
      dataSource.query.mockResolvedValue([
        {
          pharmacistName: 'Ana',
          saleDay: new Date('2026-01-15'),
          medicationName: 'A',
          totalRevenue: '100',
          qtySold: '5',
        },
        { pharmacistName: 'Ana', saleDay: '2026-01-16', medicationName: 'B', totalRevenue: '50', qtySold: '2' },
      ]);

      const result = await service.getSalesByPharmacistMedicationDay({ clinicId: CLINIC_ID });

      expect(result.rows[0].saleDay).toBe('2026-01-15');
      expect(result.rows[1].saleDay).toBe('2026-01-16');
      expect(result.byPharmacist).toHaveLength(1);
      expect(result.byPharmacist[0].pharmacistName).toBe('Ana');
      expect(result.byPharmacist[0].days).toHaveLength(2);
    });
  });

  describe('getValorizedInventory (B1)', () => {
    it('resume totales y cuenta por status', async () => {
      dataSource.query.mockResolvedValue([
        { status: 'sin_stock', costValue: '0', saleValue: '0' },
        { status: 'critico', costValue: '100', saleValue: '150' },
        { status: 'por_vencer', costValue: '50', saleValue: '80' },
        { status: 'ok', costValue: '200', saleValue: '300' },
      ]);

      const result = await service.getValorizedInventory({ clinicId: CLINIC_ID });

      expect(result.summary).toEqual({
        totalProducts: 4,
        totalCostValue: 350,
        totalSaleValue: 530,
        potentialMargin: 180,
        sinStock: 1,
        critico: 1,
        porVencer: 1,
        ok: 1,
      });
    });
  });

  describe('getMedicationsWithoutMovement (B3)', () => {
    it('usa 30 días por defecto y suma totalStockValue', async () => {
      dataSource.query.mockResolvedValue([{ stockValue: '10.555' }, { stockValue: '5' }]);

      const result = await service.getMedicationsWithoutMovement({ clinicId: CLINIC_ID });

      expect(result.days).toBe(30);
      expect(result.totalStockValue).toBe(15.56);
      expect(dataSource.query.mock.calls[0][0]).toContain("INTERVAL '30 days'");
    });

    it('acepta un número de días custom', async () => {
      dataSource.query.mockResolvedValue([]);
      await service.getMedicationsWithoutMovement({ clinicId: CLINIC_ID }, 90);
      expect(dataSource.query.mock.calls[0][0]).toContain("INTERVAL '90 days'");
    });
  });

  describe('getPrescriptionVsFreeSales (C2)', () => {
    it('calcula pct por tipo sobre el grandTotal', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { type: 'con_receta', totalRevenue: '300' },
          { type: 'libre', totalRevenue: '700' },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getPrescriptionVsFreeSales({ clinicId: CLINIC_ID });

      expect(result.summary.map((r: any) => r.pct)).toEqual([30, 70]);
    });
  });

  describe('getSalesByPaymentDetailed (C3)', () => {
    it('calcula pct y formatea saleDay en el detalle diario', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ method: 'cash', totalRevenue: '1000' }])
        .mockResolvedValueOnce([{ saleDay: new Date('2026-01-01'), method: 'cash', totalRevenue: '100' }]);

      const result = await service.getSalesByPaymentDetailed({ clinicId: CLINIC_ID });

      expect(result.summary[0].pct).toBe(100);
      expect(result.daily[0].saleDay).toBe('2026-01-01');
      expect(result.grandTotal).toBe(1000);
    });
  });

  describe('getMonthlySalesComparison (C6)', () => {
    it('calcula revenueGrowth mes a mes y determina bestMonth', async () => {
      dataSource.query.mockResolvedValue([
        { month: '2026-01', totalRevenue: '1000' },
        { month: '2026-02', totalRevenue: '1500' },
        { month: '2026-03', totalRevenue: '1200' },
      ]);

      const result = await service.getMonthlySalesComparison({ clinicId: CLINIC_ID });

      expect(result.rows[0].revenueGrowth).toBeNull();
      expect(result.rows[1].revenueGrowth).toBe(50);
      expect(result.rows[2].revenueGrowth).toBe(-20);
      expect(result.summary.bestMonth).toBe('2026-02');
      expect(result.summary.totalRevenue).toBe(3700);
    });

    it('revenueGrowth es null si el mes previo tuvo revenue 0', async () => {
      dataSource.query.mockResolvedValue([
        { month: '2026-01', totalRevenue: '0' },
        { month: '2026-02', totalRevenue: '100' },
      ]);

      const result = await service.getMonthlySalesComparison({ clinicId: CLINIC_ID });

      expect(result.rows[1].revenueGrowth).toBeNull();
    });

    it('avgMonthlyRevenue y bestMonth manejan el caso sin filas', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await service.getMonthlySalesComparison({ clinicId: CLINIC_ID });

      expect(result.summary.avgMonthlyRevenue).toBe(0);
      expect(result.summary.bestMonth).toBe('-');
    });
  });
});
