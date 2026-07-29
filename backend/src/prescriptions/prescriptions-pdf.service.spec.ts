import * as fs from 'fs';
import puppeteer from 'puppeteer-core';
import { PrescriptionsPdfService } from './prescriptions-pdf.service';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';

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
      lastName: 'Pérez <Test>',
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-logo-bytes'));
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  });

  afterEach(() => {
    mockReadFileSync.mockRestore();
  });

  describe('constructor / logo', () => {
    it('carga el logo en base64 si el archivo existe', () => {
      mockReadFileSync.mockReturnValue(Buffer.from('logo-bytes'));
      const service = new PrescriptionsPdfService();
      expect((service as any).logo64).toBe(Buffer.from('logo-bytes').toString('base64'));
    });

    it('deja logo64 vacío si falla la lectura del archivo', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const service = new PrescriptionsPdfService();
      expect((service as any).logo64).toBe('');
    });
  });

  describe('generate() / render()', () => {
    let service: PrescriptionsPdfService;

    beforeEach(() => {
      service = new PrescriptionsPdfService();
    });

    it('lanza Puppeteer con el executablePath por defecto y devuelve el PDF como Buffer', async () => {
      const page = makePage(Buffer.from('%PDF-CONTENT'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      const result = await service.generate(makePrescription());

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/usr/bin/chromium',
          headless: true,
          args: expect.arrayContaining(['--no-sandbox', '--disable-setuid-sandbox']),
        }),
      );
      expect(page.setContent).toHaveBeenCalledWith(expect.stringContaining('RX-0001'), { waitUntil: 'networkidle0' });
      expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'letter', printBackground: true }));
      expect(browser.close).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('%PDF-CONTENT'));
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('usa PUPPETEER_EXECUTABLE_PATH si está seteado', async () => {
      process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome';
      const browser = makeBrowser();
      mockLaunch.mockResolvedValue(browser);

      await service.generate(makePrescription());

      expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: '/custom/chrome' }));
    });

    it('si browser.close() falla, intenta SIGKILL sobre el proceso y no rompe el flujo', async () => {
      const kill = jest.fn();
      const browser = makeBrowser({
        close: jest.fn().mockRejectedValue(new Error('close failed')),
        process: jest.fn().mockReturnValue({ kill }),
      });
      mockLaunch.mockResolvedValue(browser);

      const result = await service.generate(makePrescription());

      expect(browser.close).toHaveBeenCalled();
      expect(kill).toHaveBeenCalledWith('SIGKILL');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('si close() y process().kill() fallan, no propaga el error de limpieza', async () => {
      const browser = makeBrowser({
        close: jest.fn().mockRejectedValue(new Error('close failed')),
        process: jest.fn().mockImplementation(() => {
          throw new Error('no process');
        }),
      });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generate(makePrescription())).resolves.toBeInstanceOf(Buffer);
    });

    it('si page.pdf() falla, propaga el error pero igual cierra el browser (finally)', async () => {
      const page = makePage();
      (page.pdf as jest.Mock).mockRejectedValue(new Error('render failed'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generate(makePrescription())).rejects.toThrow('render failed');
      expect(browser.close).toHaveBeenCalled();
    });
  });

  describe('buildHtml (contenido de la receta)', () => {
    let service: PrescriptionsPdfService;
    const buildHtml = (p: Prescription) => (service as any).buildHtml(p);

    beforeEach(() => {
      service = new PrescriptionsPdfService();
    });

    it('escapa caracteres especiales del nombre del paciente', () => {
      const html = buildHtml(makePrescription());
      expect(html).toContain('María &amp; José');
      expect(html).toContain('Pérez &lt;Test&gt;');
    });

    it('incluye el nombre y especialidad del médico prescriptor', () => {
      const html = buildHtml(makePrescription());
      expect(html).toContain('Dr. Carla Gómez');
      expect(html).toContain('Pediatría');
    });

    it('usa "—" para el médico si no viene en la receta', () => {
      const html = buildHtml(makePrescription({ doctor: undefined }));
      expect(html).toContain('<div class="val">—</div>');
    });

    it('traduce el estado a español con statusLabel', () => {
      const html = buildHtml(makePrescription({ status: PrescriptionStatus.DISPENSED }));
      expect(html).toContain('Dispensada');
    });

    it('deja el código de estado desconocido tal cual si no está en el mapa', () => {
      const html = buildHtml(makePrescription({ status: 'weird-status' as PrescriptionStatus }));
      expect(html).toContain('weird-status');
    });

    it('renderiza cada medicamento con su forma farmacéutica traducida e instrucciones', () => {
      const html = buildHtml(makePrescription());
      expect(html).toContain('Amoxicilina');
      expect(html).toContain('Tableta');
      expect(html).toContain('Vía oral');
      expect(html).toContain('Tomar con alimentos');
      expect(html).toContain('7 días');
    });

    it('omite el bloque de instrucciones si el item no las trae', () => {
      const html = buildHtml(
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
      expect(html).not.toContain('<div class="med-instr">');
      expect(html).toContain('—'); // duration ausente
    });

    it('muestra el mensaje "Sin medicamentos" si items está vacío', () => {
      const html = buildHtml(makePrescription({ items: [] }));
      expect(html).toContain('Sin medicamentos');
    });

    it('incluye la sección de notas solo si vienen en la receta', () => {
      const withNotes = buildHtml(makePrescription({ notes: 'Reposo relativo' }));
      expect(withNotes).toContain('Reposo relativo');

      const withoutNotes = buildHtml(makePrescription({ notes: undefined }));
      expect(withoutNotes).not.toContain('Notas e Indicaciones');
    });

    it('renderiza el logo en base64 si está disponible', () => {
      const html = buildHtml(makePrescription());
      expect(html).toContain('data:image/png;base64,');
    });

    it('no renderiza tag de imagen si no hay logo', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const noLogoService = new PrescriptionsPdfService();
      const html = (noLogoService as any).buildHtml(makePrescription());
      expect(html).not.toContain('<img');
    });
  });
});
