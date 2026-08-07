import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';

const mockExecFile = jest.fn();
jest.mock('node:child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
}));

const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockRm = jest.fn();
jest.mock('node:fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  rm: (...args: any[]) => mockRm(...args),
}));

import { TypstCompilerService } from './typst-compiler.service';
import { MetricsService } from '../metrics/metrics.service';

describe('TypstCompilerService', () => {
  let service: TypstCompilerService;
  const mockInc = jest.fn();
  const mockObserve = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    // execFile con firma (file, args, callback) — sin `options`, como se
    // invoca en el service.
    mockExecFile.mockImplementation((_file: string, _args: string[], callback: any) => {
      callback(null, { stdout: '', stderr: '' });
    });
    mockReadFile.mockResolvedValue(Buffer.from('%PDF-fake'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypstCompilerService,
        {
          provide: MetricsService,
          useValue: {
            pdfGeneratedTotal: { inc: mockInc },
            pdfCompileDurationSeconds: { observe: mockObserve },
          },
        },
      ],
    }).compile();

    service = module.get(TypstCompilerService);
  });

  it('compila y devuelve el buffer del PDF generado', async () => {
    const result = await service.compile('#set page(paper: "a4")\nHola');

    expect(result).toEqual(Buffer.from('%PDF-fake'));
    expect(mockExecFile).toHaveBeenCalledWith(
      'typst',
      expect.arrayContaining(['compile', '--root', '--ignore-system-fonts', '--font-path']),
      expect.any(Function),
    );
  });

  it('escribe la entrada .typ antes de compilar', async () => {
    await service.compile('contenido typst');

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('entrada.typ'),
      'contenido typst',
      'utf8',
    );
  });

  it('escribe los assets adicionales (ej. gráficos rasterizados) en el mismo directorio de trabajo', async () => {
    const png = Buffer.from('fake-png');
    await service.compile('contenido typst', [{ filename: 'chart-1.png', buffer: png }]);

    expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining('chart-1.png'), png);
  });

  it('limpia el directorio de trabajo temporal incluso si la compilación fue exitosa', async () => {
    await service.compile('contenido typst');

    expect(mockRm).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
  });

  /**
   * Regresión: si `typst compile` falla (error de sintaxis en la plantilla,
   * fuente/asset faltante), el service debe lanzar una excepción Nest clara
   * en vez de propagar el error crudo de `execFile` — y limpiar igual el
   * directorio temporal (no dejar basura acumulándose ante errores).
   */
  it('lanza InternalServerErrorException si typst compile falla, y limpia igual', async () => {
    mockExecFile.mockImplementation((_file: string, _args: string[], callback: any) => {
      callback(new Error('typst: error: file not found'));
    });

    await expect(service.compile('contenido typst')).rejects.toThrow(InternalServerErrorException);
    expect(mockRm).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
  });

  it('no propaga un fallo de limpieza (rm) como error de la compilación', async () => {
    mockRm.mockRejectedValue(new Error('permission denied'));

    await expect(service.compile('contenido typst')).resolves.toEqual(Buffer.from('%PDF-fake'));
  });

  describe('métricas Prometheus (bartolomed_pdf_generated_total / bartolomed_pdf_compile_duration_seconds)', () => {
    it('incrementa el contador con status="success" y observa la duración cuando compila bien', async () => {
      await service.compile('contenido typst');

      expect(mockInc).toHaveBeenCalledWith({ status: 'success' });
      expect(mockObserve).toHaveBeenCalledWith(expect.any(Number));
    });

    it('incrementa el contador con status="error" si typst compile falla', async () => {
      mockExecFile.mockImplementation((_file: string, _args: string[], callback: any) => {
        callback(new Error('typst: error: file not found'));
      });

      await expect(service.compile('contenido typst')).rejects.toThrow(InternalServerErrorException);

      expect(mockInc).toHaveBeenCalledWith({ status: 'error' });
      expect(mockInc).not.toHaveBeenCalledWith({ status: 'success' });
    });
  });
});
