import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { LabReportsService } from './lab-reports.service';

const CLINIC_ID = 'clinic-1';

/**
 * Antes NINGÚN reporte cubría Laboratorio ni Estudios Especiales — los dos
 * comparten `lab_orders` (order_type: 'lab' | 'special') desde que existen,
 * pero "Reportes" se construyó casi solo alrededor de Farmacia.
 */
describe('LabReportsService', () => {
  let service: LabReportsService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LabReportsService, { provide: getDataSourceToken(), useValue: dataSource }],
    }).compile();
    service = module.get<LabReportsService>(LabReportsService);
  });

  it('exige clinicId', async () => {
    await expect(service.getLabActivityReport({})).rejects.toThrow(BadRequestException);
  });

  it('combina volumen, tiempo de respuesta, top exámenes y por médico en un solo reporte', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        { orderType: 'lab', status: 'completed', count: 2 },
        { orderType: 'lab', status: 'cancelled', count: 1 },
      ])
      .mockResolvedValueOnce([{ orderType: 'lab', resultedCount: 1, avgResponseHours: '0.2' }])
      .mockResolvedValueOnce([{ testName: 'Hemograma completo', orderType: 'lab', count: 3 }])
      .mockResolvedValueOnce([{ doctorId: 'doc-1', doctorName: 'Ana Pérez', orderType: 'lab', orderCount: 3 }]);

    const result = await service.getLabActivityReport({ clinicId: CLINIC_ID });

    expect(result.summary).toEqual({
      totalOrders: 3,
      completedOrders: 2,
      cancelledOrders: 1,
      cancellationRate: 33.33,
    });
    expect(result.byTypeAndStatus[0]).toEqual(
      expect.objectContaining({ orderTypeLabel: 'Laboratorio', statusLabel: 'Completada' }),
    );
    expect(result.turnaround[0]).toEqual(expect.objectContaining({ orderTypeLabel: 'Laboratorio', avgResponseHours: 0.2 }));
    expect(result.topTests[0]).toEqual(expect.objectContaining({ testName: 'Hemograma completo' }));
    expect(result.byDoctor[0]).toEqual(expect.objectContaining({ doctorName: 'Ana Pérez' }));
  });

  it('cancellationRate es 0 si no hay órdenes en el período (sin dividir por cero)', async () => {
    dataSource.query.mockResolvedValue([]);

    const result = await service.getLabActivityReport({ clinicId: CLINIC_ID });

    expect(result.summary).toEqual({
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      cancellationRate: 0,
    });
  });

  it('etiqueta order_type/status desconocidos con el valor crudo en vez de undefined', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ orderType: 'special', status: 'sample_collected', count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getLabActivityReport({ clinicId: CLINIC_ID });

    expect(result.byTypeAndStatus[0].orderTypeLabel).toBe('Estudio Especial');
    expect(result.byTypeAndStatus[0].statusLabel).toBe('Muestra Tomada');
  });

  it('aplica el filtro de fecha con el límite superior inclusivo (< día+1, no <=)', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getLabActivityReport({
      clinicId: CLINIC_ID,
      dateRange: { startDate: '2026-08-27', endDate: '2026-08-27' },
    });

    const volumeSql = dataSource.query.mock.calls[0][0];
    expect(volumeSql).toContain(`>= '2026-08-27'`);
    expect(volumeSql).toContain(`< ('2026-08-27'::date + INTERVAL '1 day')`);
    expect(volumeSql).not.toMatch(/<=\s*'2026-08-27'/);
  });
});
