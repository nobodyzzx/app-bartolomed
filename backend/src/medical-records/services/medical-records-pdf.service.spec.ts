import * as fs from 'fs';
import puppeteer from 'puppeteer-core';
import { MedicalRecordsPdfService } from './medical-records-pdf.service';
import { ConsentPdfDto, SummaryPdfDto } from '../dto/pdf.dto';

jest.mock('puppeteer-core', () => ({ __esModule: true, default: { launch: jest.fn() } }));

const mockLaunch = puppeteer.launch as jest.Mock;
let mockReadFileSync: jest.SpyInstance;

const makePage = (pdfBuf: Buffer = Buffer.from('%PDF-1.4')) => ({
  setContent: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(pdfBuf),
});

const makeBrowser = (overrides: Record<string, any> = {}) => ({
  newPage: jest.fn().mockResolvedValue(makePage()),
  close: jest.fn().mockResolvedValue(undefined),
  process: jest.fn().mockReturnValue({ kill: jest.fn() }),
  ...overrides,
});

const makePatient = (overrides: Partial<ConsentPdfDto['patient']> = {}) => ({
  firstName: 'María & José',
  lastName: 'Pérez <Test>',
  documentNumber: '1234567',
  birthDate: '1990-05-10',
  address: 'Calle Falsa 123',
  phone: '70000000',
  ...overrides,
});

const makeDoctor = (overrides: Partial<ConsentPdfDto['doctor']> = {}) => ({
  firstName: 'Carla',
  lastName: 'Gómez',
  specialization: 'Pediatría',
  ...overrides,
});

const makeConsentDto = (overrides: Partial<ConsentPdfDto> = {}): ConsentPdfDto => ({
  patient: makePatient(),
  doctor: makeDoctor(),
  printTemplate: 'diagnostic',
  consentType: 'treatment',
  ...overrides,
});

const makeSummaryDto = (overrides: Partial<SummaryPdfDto> = {}): SummaryPdfDto => ({
  patient: makePatient(),
  doctor: makeDoctor(),
  recordType: 'consultation',
  isEmergency: false,
  chiefComplaint: 'Dolor abdominal',
  ...overrides,
});

describe('MedicalRecordsPdfService', () => {
  let service: MedicalRecordsPdfService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-logo-bytes'));
    service = new MedicalRecordsPdfService();
  });

  afterEach(() => {
    mockReadFileSync.mockRestore();
  });

  describe('constructor / logo', () => {
    it('carga el logo en base64 si el archivo existe', () => {
      expect((service as any).logo64).toBe(Buffer.from('fake-logo-bytes').toString('base64'));
    });

    it('deja logo64 vacío si falla la lectura del archivo', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const noLogoService = new MedicalRecordsPdfService();
      expect((noLogoService as any).logo64).toBe('');
    });
  });

  describe('render() vía generate*Pdf()', () => {
    it('generateConsentPdf lanza Puppeteer, setea el HTML y devuelve un Buffer', async () => {
      const page = makePage(Buffer.from('%PDF-CONSENT'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      const result = await service.generateConsentPdf(makeConsentDto());

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ executablePath: '/usr/bin/chromium', headless: true }),
      );
      expect(page.setContent).toHaveBeenCalledWith(expect.stringContaining('Consentimiento Informado'), {
        waitUntil: 'networkidle0',
      });
      expect(browser.close).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('%PDF-CONSENT'));
    });

    it('generateSummaryPdf lanza Puppeteer, setea el HTML y devuelve un Buffer', async () => {
      const browser = makeBrowser();
      mockLaunch.mockResolvedValue(browser);

      const result = await service.generateSummaryPdf(makeSummaryDto());

      expect(browser.newPage).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('si browser.close() falla, intenta SIGKILL y no rompe el flujo', async () => {
      const kill = jest.fn();
      const browser = makeBrowser({
        close: jest.fn().mockRejectedValue(new Error('close failed')),
        process: jest.fn().mockReturnValue({ kill }),
      });
      mockLaunch.mockResolvedValue(browser);

      await service.generateSummaryPdf(makeSummaryDto());

      expect(kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('si page.pdf() falla, propaga el error pero igual cierra el browser', async () => {
      const page = makePage();
      (page.pdf as jest.Mock).mockRejectedValue(new Error('render failed'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generateSummaryPdf(makeSummaryDto())).rejects.toThrow('render failed');
      expect(browser.close).toHaveBeenCalled();
    });
  });

  describe('consentHtml — plantillas por printTemplate', () => {
    const consentHtml = (dto: ConsentPdfDto) => (service as any).consentHtml(dto);

    it('usa la plantilla diagnóstica por defecto', () => {
      const html = consentHtml(makeConsentDto({ printTemplate: 'diagnostic', objective: 'Evaluar dolor' }));
      expect(html).toContain('OTORGO MI CONSENTIMIENTO LIBRE, VOLUNTARIO E INFORMADO');
      expect(html).toContain('Evaluar dolor');
    });

    it('usa la plantilla quirúrgica cuando printTemplate=surgery', () => {
      const html = consentHtml(
        makeConsentDto({ printTemplate: 'surgery', surgicalDiagnosis: 'Apendicitis', leadSurgeonName: 'Dr. Rojas' }),
      );
      expect(html).toContain('Apendicitis');
      expect(html).toContain('a cargo del Dr./Dra. Dr. Rojas');
    });

    it('usa la plantilla de transfusión cuando printTemplate=blood_transfusion', () => {
      const html = consentHtml(makeConsentDto({ printTemplate: 'blood_transfusion', bloodProductType: 'Plaquetas' }));
      expect(html).toContain('Plaquetas');
      expect(html).toContain('transfusión sanguínea o hemoderivados');
    });

    it('usa la plantilla de rechazo cuando printTemplate=rejection', () => {
      const html = consentHtml(
        makeConsentDto({ printTemplate: 'rejection', rejectionDiagnosis: 'Fractura', clinicName: 'Clínica X' }),
      );
      expect(html).toContain('RECHAZO el tratamiento');
      expect(html).toContain('Fractura');
      expect(html).toContain('Clínica X');
    });

    it('usa el título por defecto combinando consentTypeLabel si no viene título', () => {
      const html = consentHtml(makeConsentDto({ title: undefined, consentType: 'surgery' }));
      expect(html).toContain('Consentimiento Informado — Cirugía');
    });

    it('respeta un título explícito si viene en el dto', () => {
      const html = consentHtml(makeConsentDto({ title: 'Consentimiento Personalizado' }));
      expect(html).toContain('Consentimiento Personalizado');
    });

    it('escapa caracteres especiales del paciente', () => {
      const html = consentHtml(makeConsentDto());
      expect(html).toContain('María &amp; José');
    });
  });

  describe('summaryHtml — secciones condicionales', () => {
    const summaryHtml = (dto: SummaryPdfDto) => (service as any).summaryHtml(dto);

    it('muestra el badge de emergencia solo si isEmergency=true', () => {
      const withEmergency = summaryHtml(makeSummaryDto({ isEmergency: true }));
      expect(withEmergency).toContain('EMERGENCIA');

      const withoutEmergency = summaryHtml(makeSummaryDto({ isEmergency: false }));
      expect(withoutEmergency).not.toContain('EMERGENCIA');
    });

    it('omite la sección de antecedentes si no hay ningún campo de historia', () => {
      const html = summaryHtml(makeSummaryDto());
      expect(html).not.toContain('Antecedentes e Historia Médica');
    });

    it('incluye la sección de antecedentes si al menos un campo viene informado', () => {
      const html = summaryHtml(makeSummaryDto({ allergies: 'Penicilina' }));
      expect(html).toContain('Antecedentes e Historia Médica');
      expect(html).toContain('Penicilina');
    });

    it('omite signos vitales si el objeto viene vacío o con todo falsy', () => {
      const html = summaryHtml(makeSummaryDto({ vitalSigns: { temperature: undefined } }));
      expect(html).not.toContain('Signos Vitales');
    });

    it('incluye la sección de signos vitales si al menos un valor viene informado', () => {
      const html = summaryHtml(makeSummaryDto({ vitalSigns: { weight: 70, height: 175, temperature: 36.5 } }));
      expect(html).toContain('Signos Vitales');
      expect(html).toContain('<td>70</td>');
      expect(html).toContain('<td>175</td>');
    });

    it('usa el bmi ya calculado del dto si viene informado', () => {
      const html = summaryHtml(makeSummaryDto({ vitalSigns: { weight: 70, height: 175, bmi: 30 } }));
      expect(html).toContain('>30<');
    });

    it('omite examen físico si no hay ningún campo', () => {
      const html = summaryHtml(makeSummaryDto());
      expect(html).not.toContain('Examen Físico');
    });

    it('incluye examen físico si al menos un campo viene informado', () => {
      const html = summaryHtml(makeSummaryDto({ cardiovascular: 'Ritmo regular' }));
      expect(html).toContain('Examen Físico');
      expect(html).toContain('Ritmo regular');
    });

    it('omite evaluación/diagnóstico si no hay ningún campo', () => {
      const html = summaryHtml(makeSummaryDto());
      expect(html).not.toContain('Evaluación y Diagnóstico');
    });

    it('incluye evaluación/diagnóstico si al menos un campo viene informado', () => {
      const html = summaryHtml(makeSummaryDto({ diagnosis: 'Gastritis aguda' }));
      expect(html).toContain('Evaluación y Diagnóstico');
      expect(html).toContain('Gastritis aguda');
    });

    it('omite plan/seguimiento si no hay ningún campo', () => {
      const html = summaryHtml(makeSummaryDto());
      expect(html).not.toContain('Plan y Seguimiento');
    });

    it('incluye plan/seguimiento si al menos un campo viene informado (incluye followUpDate)', () => {
      const html = summaryHtml(makeSummaryDto({ followUpDate: '2026-08-01' }));
      expect(html).toContain('Plan y Seguimiento');
      expect(html).toContain('Próxima cita');
    });

    it('incluye notas solo si vienen en el dto', () => {
      const withNotes = summaryHtml(makeSummaryDto({ notes: 'Control en 15 días' }));
      expect(withNotes).toContain('Notas Adicionales');

      const withoutNotes = summaryHtml(makeSummaryDto({ notes: undefined }));
      expect(withoutNotes).not.toContain('Notas Adicionales');
    });
  });

  describe('helpers de formato', () => {
    it('fmtDate formatea una fecha ISO válida en formato es-BO', () => {
      const fmtDate = (d?: string | null) => (service as any).fmtDate(d);
      expect(fmtDate('2026-05-10')).toMatch(/\d{2}\/\d{2}\/2026/);
    });

    it('fmtDate devuelve "—" si no hay fecha', () => {
      const fmtDate = (d?: string | null) => (service as any).fmtDate(d);
      expect(fmtDate(undefined)).toBe('—');
    });

    it('val devuelve &mdash; para valores vacíos, null o undefined', () => {
      const val = (v: any) => (service as any).val(v);
      expect(val(undefined)).toBe('&mdash;');
      expect(val(null)).toBe('&mdash;');
      expect(val('')).toBe('&mdash;');
      expect(val(0)).toBe('0');
    });

    it('consentTypeLabel traduce tipos conocidos y deja el resto tal cual', () => {
      const label = (t: string) => (service as any).consentTypeLabel(t);
      expect(label('blood_transfusion')).toBe('Transfusión sanguínea');
      expect(label('unknown_type')).toBe('unknown_type');
    });

    it('recordTypeLabel traduce tipos conocidos y deja el resto tal cual', () => {
      const label = (t: string) => (service as any).recordTypeLabel(t);
      expect(label('emergency')).toBe('Emergencia');
      expect(label('unknown_type')).toBe('unknown_type');
    });

    it('calcBmi devuelve "—" si falta peso o talla', () => {
      const calcBmi = (w?: any, h?: any) => (service as any).calcBmi(w, h);
      expect(calcBmi(undefined, 170)).toBe('—');
      expect(calcBmi(70, undefined)).toBe('—');
    });

    it('calcBmi calcula el IMC a partir de peso (kg) y talla (cm)', () => {
      const calcBmi = (w?: any, h?: any) => (service as any).calcBmi(w, h);
      expect(calcBmi(70, 175)).toBe('22.9');
    });
  });
});
