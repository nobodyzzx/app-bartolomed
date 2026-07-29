import { Response } from 'express';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsPdfService } from './services/medical-records-pdf.service';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('MedicalRecordsController', () => {
  let controller: MedicalRecordsController;
  let service: jest.Mocked<MedicalRecordsService>;
  let pdfService: jest.Mocked<MedicalRecordsPdfService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'record-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getStats: jest.fn().mockResolvedValue({ total: 0 }),
      getMedicalRecordsByPatient: jest.fn().mockResolvedValue([]),
      getMedicalRecordsByDoctor: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'record-1' }),
      update: jest.fn().mockResolvedValue({ id: 'record-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      createConsentForm: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      findAllConsentForms: jest.fn().mockResolvedValue([]),
      findOneConsentForm: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      updateConsentForm: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      uploadConsentDocument: jest.fn().mockResolvedValue({ id: 'consent-1', documentUrl: 'x' }),
      removeConsentForm: jest.fn().mockResolvedValue(undefined),
      getConsentFormsByMedicalRecord: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<MedicalRecordsService>;
    pdfService = {
      generateConsentPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-CONSENT')),
      generateSummaryPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-SUMMARY')),
    } as unknown as jest.Mocked<MedicalRecordsPdfService>;
    controller = new MedicalRecordsController(service, pdfService);
  });

  it('create resuelve clinicId y delega dto/user', async () => {
    const dto = { patientId: 'p-1', type: 'consultation' } as any;
    await controller.create(dto, user, makeReq());
    expect(service.create).toHaveBeenCalledWith(dto, user, 'clinic-1');
  });

  describe('findAll', () => {
    it('usa page/limit por defecto (1/10) y convierte isEmergency a boolean', async () => {
      await controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        undefined,
        undefined,
        makeReq(),
      );

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isEmergency: true, clinicId: 'clinic-1' }),
        { page: 1, limit: 10 },
        'clinic-1',
      );
    });

    it('parsea page/limit provistos y deja isEmergency undefined si no viene', async () => {
      await controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '3',
        '25',
        makeReq(),
      );

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isEmergency: undefined }),
        { page: 3, limit: 25 },
        'clinic-1',
      );
    });

    it('funciona sin request (clinicId undefined)', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: undefined }),
        { page: 1, limit: 10 },
        undefined,
      );
    });
  });

  it('getStats delega clinicId', async () => {
    await controller.getStats(makeReq());
    expect(service.getStats).toHaveBeenCalledWith('clinic-1');
  });

  it('getMedicalRecordsByPatient delega patientId y clinicId', async () => {
    await controller.getMedicalRecordsByPatient('patient-1', makeReq());
    expect(service.getMedicalRecordsByPatient).toHaveBeenCalledWith('patient-1', 'clinic-1');
  });

  it('getMedicalRecordsByDoctor delega doctorId y clinicId', async () => {
    await controller.getMedicalRecordsByDoctor('doctor-1', makeReq());
    expect(service.getMedicalRecordsByDoctor).toHaveBeenCalledWith('doctor-1', 'clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('record-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('record-1', 'clinic-1');
  });

  it('update delega id, dto, user y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('record-1', dto, user, makeReq());
    expect(service.update).toHaveBeenCalledWith('record-1', dto, user, 'clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('record-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('record-1', 'clinic-1');
  });

  it('generateConsentPdf arma el buffer, setea headers y termina la respuesta', async () => {
    const dto = { patient: {}, doctor: {}, printTemplate: 'diagnostic', consentType: 'general' } as any;
    const res = { setHeader: jest.fn(), end: jest.fn() } as unknown as jest.Mocked<Response>;

    await controller.generateConsentPdf(dto, res);

    expect(pdfService.generateConsentPdf).toHaveBeenCalledWith(dto);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="consentimiento.pdf"');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 12);
    expect(res.end).toHaveBeenCalledWith(Buffer.from('%PDF-CONSENT'));
  });

  it('generateSummaryPdf arma el buffer, setea headers y termina la respuesta', async () => {
    const dto = { patient: {}, doctor: {}, recordType: 'consultation', isEmergency: false, chiefComplaint: 'x' } as any;
    const res = { setHeader: jest.fn(), end: jest.fn() } as unknown as jest.Mocked<Response>;

    await controller.generateSummaryPdf(dto, res);

    expect(pdfService.generateSummaryPdf).toHaveBeenCalledWith(dto);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="expediente-medico.pdf"');
    expect(res.end).toHaveBeenCalledWith(Buffer.from('%PDF-SUMMARY'));
  });

  it('createConsentForm resuelve clinicId y delega el dto', async () => {
    const dto = { patientId: 'p-1' } as any;
    await controller.createConsentForm(dto, makeReq());
    expect(service.createConsentForm).toHaveBeenCalledWith(dto, 'clinic-1');
  });

  it('findAllConsentForms delega filtros y clinicId', async () => {
    await controller.findAllConsentForms('patient-1', 'record-1', undefined, makeReq());
    expect(service.findAllConsentForms).toHaveBeenCalledWith({
      patientId: 'patient-1',
      medicalRecordId: 'record-1',
      status: undefined,
      clinicId: 'clinic-1',
    });
  });

  it('findOneConsentForm delega solo el id (sin scoping por clínica)', async () => {
    await controller.findOneConsentForm('consent-1');
    expect(service.findOneConsentForm).toHaveBeenCalledWith('consent-1');
  });

  it('updateConsentForm delega id y dto', async () => {
    const dto = { status: 'signed' } as any;
    await controller.updateConsentForm('consent-1', dto);
    expect(service.updateConsentForm).toHaveBeenCalledWith('consent-1', dto);
  });

  it('uploadConsentDocument delega id, file y dto', async () => {
    const file = { originalname: 'doc.pdf' };
    const dto = { notes: 'x' } as any;
    await controller.uploadConsentDocument('consent-1', file, dto);
    expect(service.uploadConsentDocument).toHaveBeenCalledWith('consent-1', file, dto);
  });

  it('removeConsentForm delega el id', async () => {
    await controller.removeConsentForm('consent-1');
    expect(service.removeConsentForm).toHaveBeenCalledWith('consent-1');
  });

  it('getConsentFormsByMedicalRecord delega el id del expediente', async () => {
    await controller.getConsentFormsByMedicalRecord('record-1');
    expect(service.getConsentFormsByMedicalRecord).toHaveBeenCalledWith('record-1');
  });
});
