import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppointmentType } from '../appointments/entities/appointment.entity';
import { ServicePricesService } from '../service-prices/service-prices.service';
import { ChargesService } from './charges.service';
import { Charge, ChargeOrigin, ChargeStatus } from './entities/charge.entity';

const CLINIC_ID = 'clinic-1';

const makeCharge = (overrides: Partial<Charge> = {}): Charge =>
  Object.assign(new Charge(), {
    id: 'charge-1',
    clinicId: CLINIC_ID,
    patientId: 'patient-1',
    origin: ChargeOrigin.CONSULTATION,
    description: 'Consulta general',
    quantity: 1,
    listPrice: 80,
    unitPrice: 80,
    discountAmount: 0,
    total: 80,
    status: ChargeStatus.PENDING,
    ...overrides,
  });

describe('ChargesService', () => {
  let service: ChargesService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let prices: { findConsultationPrice: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(dto => dto),
      save: jest.fn(entity => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    };
    prices = { findConsultationPrice: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargesService,
        { provide: getRepositoryToken(Charge), useValue: repo },
        { provide: ServicePricesService, useValue: prices },
      ],
    }).compile();

    service = module.get(ChargesService);
  });

  // ─── cargo de consulta ────────────────────────────────────────────────────

  describe('createForCompletedAppointment', () => {
    const params = {
      appointmentId: 'appt-1',
      appointmentType: AppointmentType.CONSULTATION,
      clinicId: CLINIC_ID,
      patientId: 'patient-1',
    };

    it('copia el precio del tarifario al cargo', async () => {
      prices.findConsultationPrice.mockResolvedValue({
        id: 'price-1',
        name: 'Consulta general',
        price: 80,
      });

      const charge = await service.createForCompletedAppointment(params);

      expect(charge).toMatchObject({
        origin: ChargeOrigin.CONSULTATION,
        originId: 'appt-1',
        servicePriceId: 'price-1',
        description: 'Consulta general',
        listPrice: 80,
      });
    });

    it('no genera cargo si no hay tarifa configurada para ese tipo de cita', async () => {
      prices.findConsultationPrice.mockResolvedValue(null);

      await expect(service.createForCompletedAppointment(params)).resolves.toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('no cobra dos veces la misma cita', async () => {
      repo.count.mockResolvedValue(1);

      await expect(service.createForCompletedAppointment(params)).resolves.toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('nunca propaga el error: cerrar una cita es clínico y no puede fallar por el cobro', async () => {
      prices.findConsultationPrice.mockRejectedValue(new Error('DB caída'));

      await expect(service.createForCompletedAppointment(params)).resolves.toBeNull();
    });
  });

  // ─── cuenta del paciente ──────────────────────────────────────────────────

  describe('findPendingByPatient', () => {
    it('suma el monto adeudado de los cargos pendientes', async () => {
      repo.find.mockResolvedValue([
        makeCharge({ total: 80 }),
        makeCharge({ id: 'charge-2', total: 45 }),
        makeCharge({ id: 'charge-3', total: 25 }),
      ]);

      const account = await service.findPendingByPatient('patient-1', CLINIC_ID);

      expect(account.total).toBe(3);
      expect(account.amount).toBe(150);
    });

    it('solo considera los pendientes de esa clínica', async () => {
      await service.findPendingByPatient('patient-1', CLINIC_ID);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1', clinicId: CLINIC_ID, status: ChargeStatus.PENDING },
        }),
      );
    });

    it('exige clinicId', async () => {
      await expect(service.findPendingByPatient('patient-1', undefined)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── anulación ────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('anula un cargo pendiente guardando el motivo', async () => {
      repo.findOne.mockResolvedValue(makeCharge());

      const cancelled = await service.cancel('charge-1', 'Examen no realizado', CLINIC_ID);

      expect(cancelled.status).toBe(ChargeStatus.CANCELLED);
      expect(cancelled.discountReason).toBe('Examen no realizado');
    });

    it('no deja anular un cargo ya facturado: la corrección va por la factura', async () => {
      repo.findOne.mockResolvedValue(makeCharge({ status: ChargeStatus.INVOICED }));

      await expect(service.cancel('charge-1', 'motivo', CLINIC_ID)).rejects.toThrow(BadRequestException);
    });

    it('no deja anular dos veces', async () => {
      repo.findOne.mockResolvedValue(makeCharge({ status: ChargeStatus.CANCELLED }));

      await expect(service.cancel('charge-1', 'motivo', CLINIC_ID)).rejects.toThrow(BadRequestException);
    });

    it('no toca un cargo de otra clínica', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.cancel('charge-1', 'motivo', 'otra-clinica')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── paciente sin ficha ───────────────────────────────────────────────────

  it('acepta un cargo sin paciente registrado (derivado externo)', async () => {
    const charge = await service.create({
      clinicId: CLINIC_ID,
      patientName: 'Juana Mamani (derivada)',
      origin: ChargeOrigin.LABORATORY,
      description: 'Perfil lipídico',
      listPrice: 80,
    });

    expect(charge.patientId).toBeNull();
    expect(charge.patientName).toBe('Juana Mamani (derivada)');
  });

  // ─── cálculo del total ────────────────────────────────────────────────────

  describe('cálculo del total (hook de la entidad)', () => {
    it('multiplica cantidad por precio de lista', () => {
      const charge = makeCharge({ quantity: 3, listPrice: 25, discountAmount: 0 });

      charge.calculateTotal();

      expect(charge.total).toBe(75);
      expect(charge.unitPrice).toBe(25);
    });

    it('resta el descuento una sola vez: es de la línea, no unitario', () => {
      const charge = makeCharge({ quantity: 2, listPrice: 50, discountAmount: 20 });

      charge.calculateTotal();

      expect(charge.total).toBe(80);
      // El unitario refleja lo realmente cobrado por unidad, para que el
      // recibo "absorbido" cuadre al multiplicar.
      expect(charge.unitPrice).toBe(40);
    });

    it('nunca deja un total negativo aunque el descuento exceda el bruto', () => {
      const charge = makeCharge({ quantity: 1, listPrice: 50, discountAmount: 80 });

      charge.calculateTotal();

      expect(charge.total).toBe(0);
    });
  });
});
