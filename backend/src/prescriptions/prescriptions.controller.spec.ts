import { Response } from 'express';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsPdfService } from './prescriptions-pdf.service';
import { PrescriptionStatus } from './entities/prescription.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('PrescriptionsController', () => {
  let controller: PrescriptionsController;
  let service: jest.Mocked<PrescriptionsService>;
  let pdfService: jest.Mocked<PrescriptionsPdfService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'rx-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'rx-1', prescriptionNumber: 'RX-0001' }),
      update: jest.fn().mockResolvedValue({ id: 'rx-1' }),
      setStatus: jest.fn().mockResolvedValue({ id: 'rx-1' }),
      sign: jest.fn().mockResolvedValue({ id: 'rx-1' }),
      refill: jest.fn().mockResolvedValue({ id: 'rx-1' }),
    } as unknown as jest.Mocked<PrescriptionsService>;
    pdfService = {
      generate: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    } as unknown as jest.Mocked<PrescriptionsPdfService>;
    controller = new PrescriptionsController(service, pdfService);
  });

  it('create resuelve clinicId y delega dto/user/paciente', async () => {
    const dto = { patientId: 'patient-1' } as any;
    const patient = { id: 'patient-1' } as Patient;
    const user = { id: 'user-1' } as User;

    await controller.create(dto, patient, user, makeReq());

    expect(service.create).toHaveBeenCalledWith(dto, user, 'clinic-1', patient);
  });

  describe('findAll', () => {
    it('usa page/pageSize por defecto (1/20) y limpia esos campos del filtro', async () => {
      await controller.findAll(makeReq(), undefined, undefined, { page: '2', pageSize: '5', status: 'active' });

      expect(service.findAll).toHaveBeenCalledWith(1, 20, { status: 'active' }, 'clinic-1');
    });

    it('convierte page/pageSize a número si vienen', async () => {
      await controller.findAll(makeReq(), 3, 15, {});
      expect(service.findAll).toHaveBeenCalledWith(3, 15, {}, 'clinic-1');
    });
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('rx-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('rx-1', 'clinic-1');
  });

  it('getPdf arma el PDF, setea headers de descarga inline y termina la respuesta', async () => {
    const res = { set: jest.fn(), end: jest.fn() } as unknown as jest.Mocked<Response>;

    await controller.getPdf('rx-1', makeReq(), res);

    expect(service.findOne).toHaveBeenCalledWith('rx-1', 'clinic-1');
    expect(pdfService.generate).toHaveBeenCalledWith({ id: 'rx-1', prescriptionNumber: 'RX-0001' });
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="receta-RX-0001.pdf"',
      'Content-Length': 8,
    });
    expect(res.end).toHaveBeenCalledWith(Buffer.from('%PDF-1.4'));
  });

  it('update delega id, dto y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('rx-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('rx-1', dto, 'clinic-1');
  });

  it('setStatus delega id, status, clinicId y user', async () => {
    const user = { id: 'user-1' } as User;
    await controller.setStatus('rx-1', PrescriptionStatus.DISPENSED, makeReq(), user);
    expect(service.setStatus).toHaveBeenCalledWith('rx-1', PrescriptionStatus.DISPENSED, 'clinic-1', user);
  });

  it('sign delega id, clinicId y user', async () => {
    const user = { id: 'user-1' } as User;
    await controller.sign('rx-1', makeReq(), user);
    expect(service.sign).toHaveBeenCalledWith('rx-1', 'clinic-1', user);
  });

  it('refill delega id y clinicId', async () => {
    await controller.refill('rx-1', makeReq());
    expect(service.refill).toHaveBeenCalledWith('rx-1', 'clinic-1');
  });
});
