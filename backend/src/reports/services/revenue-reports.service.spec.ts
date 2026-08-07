import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Charge } from '../../charges/entities/charge.entity';
import { RevenueReportsService } from './revenue-reports.service';

const CLINIC_ID = 'clinic-1';

/** QueryBuilder encadenable cuyo `getRawMany` devuelve lo que se le indique. */
const makeQb = (rows: any[] = []) => {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  qb.clone = jest.fn(() => qb);
  return qb;
};

describe('RevenueReportsService', () => {
  let service: RevenueReportsService;
  let chargeRepo: { createQueryBuilder: jest.Mock };
  let auditRepo: { createQueryBuilder: jest.Mock };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueReportsService,
        { provide: getRepositoryToken(Charge), useValue: chargeRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();
    return module.get(RevenueReportsService);
  };

  beforeEach(async () => {
    chargeRepo = { createQueryBuilder: jest.fn() };
    auditRepo = { createQueryBuilder: jest.fn() };
    service = await build();
  });

  // ─── scoping ──────────────────────────────────────────────────────────────

  it.each([['getRevenueByOrigin'], ['getDiscountsReport'], ['getReceivables']])('%s exige clinicId', async method => {
    await expect((service as any)[method]({})).rejects.toThrow(BadRequestException);
  });

  it('filtra siempre por la clínica del request', async () => {
    const qb = makeQb();
    chargeRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getRevenueByOrigin({ clinicId: CLINIC_ID });

    expect(qb.where).toHaveBeenCalledWith('c.clinic_id = :clinicId', { clinicId: CLINIC_ID });
  });

  it('aplica el rango de fechas cuando se envía', async () => {
    const qb = makeQb();
    chargeRepo.createQueryBuilder.mockReturnValue(qb);
    const dateRange = { startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31') } as any;

    await service.getRevenueByOrigin({ clinicId: CLINIC_ID, dateRange });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'c."createdAt" BETWEEN :start AND :end',
      expect.objectContaining({ start: dateRange.startDate }),
    );
  });

  // ─── ingresos por origen ──────────────────────────────────────────────────

  describe('getRevenueByOrigin', () => {
    it('traduce el origen y separa cobrado de pendiente', async () => {
      chargeRepo.createQueryBuilder.mockReturnValue(
        makeQb([
          {
            origin: 'consultation',
            count: '2',
            gross: '160',
            discount: '10',
            collected: '80',
            pending: '70',
            cancelled: '0',
          },
          {
            origin: 'laboratory',
            count: '1',
            gross: '45',
            discount: '0',
            collected: '45',
            pending: '0',
            cancelled: '0',
          },
        ]),
      );

      const report = await service.getRevenueByOrigin({ clinicId: CLINIC_ID });

      expect(report.byOrigin[0]).toMatchObject({ label: 'Consultas', collected: 80, pending: 70 });
      expect(report.byOrigin[1].label).toBe('Laboratorio');
      expect(report.summary.collected).toBe(125);
    });

    it('calcula qué porcentaje del ingreso potencial se descontó', async () => {
      chargeRepo.createQueryBuilder.mockReturnValue(
        makeQb([
          {
            origin: 'consultation',
            count: '1',
            gross: '200',
            discount: '20',
            collected: '180',
            pending: '0',
            cancelled: '0',
          },
        ]),
      );

      const report = await service.getRevenueByOrigin({ clinicId: CLINIC_ID });

      expect(report.summary.discountRate).toBe(10);
    });

    it('no divide por cero cuando no hubo movimiento', async () => {
      chargeRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const report = await service.getRevenueByOrigin({ clinicId: CLINIC_ID });

      expect(report.summary.discountRate).toBe(0);
      expect(report.summary.gross).toBe(0);
    });

    it('convierte los SUM() de Postgres, que llegan como string', async () => {
      chargeRepo.createQueryBuilder.mockReturnValue(
        makeQb([
          {
            origin: 'other',
            count: '1',
            gross: '40.50',
            discount: '0.50',
            collected: '40',
            pending: '0',
            cancelled: '0',
          },
        ]),
      );

      const report = await service.getRevenueByOrigin({ clinicId: CLINIC_ID });

      // Sin la conversión, sumar strings concatena y el total sale mal.
      expect(report.summary.gross).toBe(40.5);
      expect(typeof report.byOrigin[0].gross).toBe('number');
    });
  });

  // ─── descuentos ───────────────────────────────────────────────────────────

  describe('getDiscountsReport', () => {
    const setup = (detail: any[]) => {
      const qb = makeQb();
      qb.getRawMany = jest
        .fn()
        .mockResolvedValueOnce([{ userId: 'u1', userEmail: 'rec@clinica.local', count: '2', total: '30', max: '20' }])
        .mockResolvedValueOnce([{ reason: 'Paciente frecuente', count: '2', total: '30' }])
        .mockResolvedValueOnce(detail);
      chargeRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('cuenta los descuentos que el paciente NO ve en su recibo', async () => {
      setup([
        { id: '1', description: 'Consulta', listPrice: '80', discount: '20', total: '60', display: 'absorbed' },
        { id: '2', description: 'Examen', listPrice: '45', discount: '10', total: '35', display: 'itemized' },
      ]);

      const report = await service.getDiscountsReport({ clinicId: CLINIC_ID });

      // El absorbido no aparece en el recibo; el reporte es el único lugar
      // donde queda constancia.
      expect(report.summary.hiddenOperations).toBe(1);
      expect(report.detail[0].hidden).toBe(true);
      expect(report.detail[1].hidden).toBe(false);
    });

    it('agrupa por usuario para poder ver quién descuenta', async () => {
      setup([]);

      const report = await service.getDiscountsReport({ clinicId: CLINIC_ID });

      expect(report.byUser[0]).toMatchObject({
        userEmail: 'rec@clinica.local',
        count: 2,
        total: 30,
        max: 20,
      });
    });

    it('etiqueta los descuentos sin autor identificado', async () => {
      const qb = makeQb();
      qb.getRawMany = jest
        .fn()
        .mockResolvedValueOnce([{ userId: null, userEmail: null, count: '1', total: '5', max: '5' }])
        .mockResolvedValueOnce([{ reason: null, count: '1', total: '5' }])
        .mockResolvedValueOnce([]);
      chargeRepo.createQueryBuilder.mockReturnValue(qb);

      const report = await service.getDiscountsReport({ clinicId: CLINIC_ID });

      expect(report.byUser[0].userEmail).toBe('Sin registrar');
      expect(report.byReason[0].reason).toBe('Sin motivo');
    });

    it('solo mira los cargos con descuento', async () => {
      const qb = setup([]);

      await service.getDiscountsReport({ clinicId: CLINIC_ID });

      expect(qb.andWhere).toHaveBeenCalledWith('c.discount_amount > 0');
    });
  });

  // ─── cuentas por cobrar ───────────────────────────────────────────────────

  describe('getReceivables', () => {
    it('agrupa la deuda por paciente y calcula la antigüedad', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      chargeRepo.createQueryBuilder.mockReturnValue(
        makeQb([{ patientId: 'p1', patient: 'Pedro Mamani', charges: '3', amount: '165', oldest: tenDaysAgo }]),
      );

      const report = await service.getReceivables({ clinicId: CLINIC_ID });

      expect(report.items[0]).toMatchObject({ patient: 'Pedro Mamani', charges: 3, amount: 165 });
      expect(report.items[0].daysOutstanding).toBe(10);
      expect(report.summary.amount).toBe(165);
    });

    it('identifica al paciente sin ficha por su nombre libre', async () => {
      chargeRepo.createQueryBuilder.mockReturnValue(
        makeQb([{ patientId: null, patient: 'Juana (derivada)', charges: '1', amount: '80', oldest: null }]),
      );

      const report = await service.getReceivables({ clinicId: CLINIC_ID });

      expect(report.items[0].patient).toBe('Juana (derivada)');
      expect(report.items[0].daysOutstanding).toBe(0);
    });
  });
});
