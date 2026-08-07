import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsPdfService } from './prescriptions-pdf.service';
import { TypstCompilerService } from '../pdf/typst-compiler.service';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';

const mockTypstCompile = jest.fn();

const makePrescription = (overrides: Partial<Prescription> = {}): Prescription =>
  ({
    id: 'rx-1',
    prescriptionNumber: 'RX-0001',
    status: PrescriptionStatus.ACTIVE,
    prescriptionDate: new Date('2026-06-01'),
    expiryDate: new Date('2026-07-01'),
    notes: null,
    patient: {
      firstName: 'María & José',
      lastName: 'Pérez "Test"',
      documentNumber: '1234567',
    },
    doctor: {
      personalInfo: { firstName: 'Carla', lastName: 'Gómez' },
      professionalInfo: { specialization: 'Pediatría', license: 'MP-123' },
    },
    clinic: { name: 'Clínica Central', address: 'Av. Siempre Viva 123', phone: '70000000' },
    items: [
      {
        medicationName: 'Amoxicilina',
        strength: '500mg',
        dosageForm: 'tableta',
        route: 'oral',
        quantity: '20',
        dosage: '1 tableta',
        frequency: 'cada 8 horas',
        duration: 7,
        instructions: 'Tomar con alimentos',
      },
    ],
    ...overrides,
  }) as unknown as Prescription;

describe('PrescriptionsPdfService', () => {
  let service: PrescriptionsPdfService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTypstCompile.mockResolvedValue(Buffer.from('%PDF-TYPST'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsPdfService,
        { provide: TypstCompilerService, useValue: { compile: mockTypstCompile } },
      ],
    }).compile();

    service = module.get(PrescriptionsPdfService);
  });

  describe('generate()', () => {
    it('compila vía TypstCompilerService y devuelve el PDF como Buffer', async () => {
      const result = await service.generate(makePrescription());

      expect(mockTypstCompile).toHaveBeenCalledWith(expect.stringContaining('RX-0001'));
      expect(result).toEqual(Buffer.from('%PDF-TYPST'));
    });
  });

  describe('prescriptionTypst (contenido de la receta)', () => {
    const typ = (p: Prescription) => (service as any).prescriptionTypst(p);

    it('escapa comillas y barras en el nombre del paciente (nunca inyecta markup crudo)', () => {
      const result = typ(makePrescription());
      expect(result).toContain('Pérez \\"Test\\"');
      expect(result).toContain('María & José');
    });

    it('incluye el nombre y especialidad del médico prescriptor', () => {
      const result = typ(makePrescription());
      expect(result).toContain('Dr. Carla Gómez');
      expect(result).toContain('Pediatría');
    });

    it('usa "—" para el médico si no viene en la receta', () => {
      const result = typ(makePrescription({ doctor: undefined }));
      expect(result).toContain(`field("Médico Prescriptor", "—")`);
    });

    it('traduce el estado a español y colorea el badge', () => {
      const result = typ(makePrescription({ status: PrescriptionStatus.DISPENSED }));
      expect(result).toContain('"Dispensada"');
      expect(result).toContain('color: "blue"');
    });

    it('deja el código de estado desconocido tal cual si no está en el mapa', () => {
      const result = typ(makePrescription({ status: 'weird-status' as PrescriptionStatus }));
      expect(result).toContain('"weird-status"');
      expect(result).toContain('color: "gray"'); // default
    });

    it('renderiza cada medicamento con su forma farmacéutica traducida e instrucciones', () => {
      const result = typ(makePrescription());
      expect(result).toContain('Amoxicilina');
      expect(result).toContain('Tableta');
      expect(result).toContain('Vía oral');
      expect(result).toContain('Tomar con alimentos');
      expect(result).toContain('7 días');
    });

    it('omite el bloque de instrucciones si el item no las trae', () => {
      const result = typ(
        makePrescription({
          items: [
            {
              medicationName: 'Paracetamol',
              strength: '500mg',
              dosageForm: 'tableta',
              quantity: '10',
              dosage: '1',
              frequency: 'cada 6 horas',
            } as any,
          ],
        }),
      );
      expect(result).not.toContain('style: "italic"');
    });

    it('muestra el mensaje "Sin medicamentos" si items está vacío', () => {
      const result = typ(makePrescription({ items: [] }));
      expect(result).toContain('Sin medicamentos');
    });

    it('incluye la sección de notas solo si vienen en la receta', () => {
      const withNotes = typ(makePrescription({ notes: 'Reposo relativo' }));
      expect(withNotes).toContain('Reposo relativo');
      expect(withNotes).toContain('Notas e Indicaciones');

      const withoutNotes = typ(makePrescription({ notes: undefined }));
      expect(withoutNotes).not.toContain('Notas e Indicaciones');
    });

    /**
     * Regresión: todo el texto dinámico (nombre de medicamento, instrucciones,
     * notas) debe pasar como argumento de función Typst (typstString), nunca
     * embebido directo en un bloque `[...]` de markup — un nombre con `*` o
     * `#` ahí sería reinterpretado como sintaxis Typst en vez de texto literal.
     */
    it('escapa caracteres especiales de Typst en nombre de medicamento e instrucciones', () => {
      const result = typ(
        makePrescription({
          items: [
            {
              medicationName: 'Jarabe "Fuerte" #1',
              strength: '10mg',
              dosageForm: 'jarabe',
              quantity: '1',
              dosage: '5ml',
              frequency: 'cada 12 horas',
              instructions: 'Agitar *bien* antes de usar',
            } as any,
          ],
        }),
      );
      expect(result).toContain('Jarabe \\"Fuerte\\" #1');
      expect(result).toContain('Agitar *bien* antes de usar');
    });
  });
});
