import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordsPdfService } from './medical-records-pdf.service';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { ConsentPdfDto, SummaryPdfDto } from '../dto/pdf.dto';

const mockTypstCompile = jest.fn();

const makePatient = (overrides: Partial<ConsentPdfDto['patient']> = {}) => ({
  firstName: 'María & José',
  lastName: 'Pérez "Test"',
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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTypstCompile.mockResolvedValue(Buffer.from('%PDF-TYPST'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsPdfService,
        { provide: TypstCompilerService, useValue: { compile: mockTypstCompile } },
      ],
    }).compile();

    service = module.get(MedicalRecordsPdfService);
  });

  describe('generate*Pdf()', () => {
    it('generateConsentPdf compila vía TypstCompilerService y devuelve un Buffer', async () => {
      const result = await service.generateConsentPdf(makeConsentDto());

      expect(mockTypstCompile).toHaveBeenCalledWith(expect.stringContaining('Consentimiento Informado'));
      expect(result).toEqual(Buffer.from('%PDF-TYPST'));
    });

    it('generateSummaryPdf compila vía TypstCompilerService y devuelve un Buffer', async () => {
      const result = await service.generateSummaryPdf(makeSummaryDto());

      expect(mockTypstCompile).toHaveBeenCalledWith(expect.stringContaining('Resumen de Consulta'));
      expect(result).toEqual(Buffer.from('%PDF-TYPST'));
    });
  });

  describe('consentTypst — plantillas por printTemplate', () => {
    const typ = (dto: ConsentPdfDto) => (service as any).consentTypst(dto);

    it('usa la plantilla diagnóstica por defecto', () => {
      const result = typ(makeConsentDto({ printTemplate: 'diagnostic', objective: 'Evaluar dolor' }));
      expect(result).toContain('OTORGO MI CONSENTIMIENTO LIBRE, VOLUNTARIO E INFORMADO');
      expect(result).toContain('Evaluar dolor');
    });

    it('usa la plantilla quirúrgica cuando printTemplate=surgery', () => {
      const result = typ(
        makeConsentDto({ printTemplate: 'surgery', surgicalDiagnosis: 'Apendicitis', leadSurgeonName: 'Dr. Rojas' }),
      );
      expect(result).toContain('Apendicitis');
      expect(result).toContain('Dr. Rojas');
      expect(result).toContain('a cargo del Dr./Dra. #cirujano');
    });

    it('usa la plantilla de transfusión cuando printTemplate=blood_transfusion', () => {
      const result = typ(makeConsentDto({ printTemplate: 'blood_transfusion', bloodProductType: 'Plaquetas' }));
      expect(result).toContain('Plaquetas');
      expect(result).toContain('transfusión sanguínea o hemoderivados');
    });

    it('usa la plantilla de rechazo cuando printTemplate=rejection', () => {
      const result = typ(
        makeConsentDto({ printTemplate: 'rejection', rejectionDiagnosis: 'Fractura', clinicName: 'Clínica X' }),
      );
      expect(result).toContain('RECHAZO el tratamiento');
      expect(result).toContain('Fractura');
      expect(result).toContain('Clínica X');
    });

    it('usa el título por defecto combinando consentTypeLabel si no viene título', () => {
      const result = typ(makeConsentDto({ title: undefined, consentType: 'surgery' }));
      expect(result).toContain('Consentimiento Informado — Cirugía');
    });

    it('respeta un título explícito si viene en el dto', () => {
      const result = typ(makeConsentDto({ title: 'Consentimiento Personalizado' }));
      expect(result).toContain('Consentimiento Personalizado');
    });

    it('escapa comillas del nombre del paciente (nunca inyecta markup crudo)', () => {
      const result = typ(makeConsentDto());
      expect(result).toContain('Pérez \\"Test\\"');
    });

    /**
     * Regresión: el cuerpo del consentimiento se arma con `#let var = "..."`
     * (typstString) + interpolación `#var` en markup — nunca con el texto del
     * usuario embebido directo. Un objetivo/riesgo con `*`/`#` no debe
     * reinterpretarse como sintaxis Typst.
     */
    it('escapa caracteres especiales de Typst en campos de texto libre', () => {
      const result = typ(makeConsentDto({ objective: 'Evaluar *dolor* y #síntomas' }));
      expect(result).toContain('Evaluar *dolor* y #síntomas');
    });
  });

  describe('summaryTypst — secciones condicionales', () => {
    const typ = (dto: SummaryPdfDto) => (service as any).summaryTypst(dto);

    it('muestra el indicador de emergencia solo si isEmergency=true', () => {
      const withEmergency = typ(makeSummaryDto({ isEmergency: true }));
      expect(withEmergency).toContain('EMERGENCIA');

      const withoutEmergency = typ(makeSummaryDto({ isEmergency: false }));
      expect(withoutEmergency).not.toContain('EMERGENCIA');
    });

    it('omite la sección de antecedentes si no hay ningún campo de historia', () => {
      const result = typ(makeSummaryDto());
      expect(result).not.toContain('Antecedentes e Historia Médica');
    });

    it('incluye la sección de antecedentes si al menos un campo viene informado', () => {
      const result = typ(makeSummaryDto({ allergies: 'Penicilina' }));
      expect(result).toContain('Antecedentes e Historia Médica');
      expect(result).toContain('Penicilina');
    });

    it('omite signos vitales si el objeto viene vacío o con todo falsy', () => {
      const result = typ(makeSummaryDto({ vitalSigns: { temperature: undefined } }));
      expect(result).not.toContain('Signos Vitales');
    });

    it('incluye la sección de signos vitales si al menos un valor viene informado', () => {
      const result = typ(makeSummaryDto({ vitalSigns: { weight: 70, height: 175, temperature: 36.5 } }));
      expect(result).toContain('Signos Vitales');
      expect(result).toContain('"70"');
      expect(result).toContain('"175"');
    });

    it('usa el bmi ya calculado del dto si viene informado', () => {
      const result = typ(makeSummaryDto({ vitalSigns: { weight: 70, height: 175, bmi: 30 } }));
      expect(result).toContain('"30"');
    });

    it('omite examen físico si no hay ningún campo', () => {
      const result = typ(makeSummaryDto());
      expect(result).not.toContain('Examen Físico');
    });

    it('incluye examen físico si al menos un campo viene informado', () => {
      const result = typ(makeSummaryDto({ cardiovascular: 'Ritmo regular' }));
      expect(result).toContain('Examen Físico');
      expect(result).toContain('Ritmo regular');
    });

    it('omite evaluación/diagnóstico si no hay ningún campo', () => {
      const result = typ(makeSummaryDto());
      expect(result).not.toContain('Evaluación y Diagnóstico');
    });

    it('incluye evaluación/diagnóstico si al menos un campo viene informado', () => {
      const result = typ(makeSummaryDto({ diagnosis: 'Gastritis aguda' }));
      expect(result).toContain('Evaluación y Diagnóstico');
      expect(result).toContain('Gastritis aguda');
    });

    it('omite plan/seguimiento si no hay ningún campo', () => {
      const result = typ(makeSummaryDto());
      expect(result).not.toContain('Plan y Seguimiento');
    });

    it('incluye plan/seguimiento si al menos un campo viene informado (incluye followUpDate)', () => {
      const result = typ(makeSummaryDto({ followUpDate: '2026-08-01' }));
      expect(result).toContain('Plan y Seguimiento');
      expect(result).toContain('Próxima cita');
    });

    it('incluye notas solo si vienen en el dto', () => {
      const withNotes = typ(makeSummaryDto({ notes: 'Control en 15 días' }));
      expect(withNotes).toContain('Notas Adicionales');

      const withoutNotes = typ(makeSummaryDto({ notes: undefined }));
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

    it('val devuelve "—" para valores vacíos, null o undefined', () => {
      const val = (v: any) => (service as any).val(v);
      expect(val(undefined)).toBe('—');
      expect(val(null)).toBe('—');
      expect(val('')).toBe('—');
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
