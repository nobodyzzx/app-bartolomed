import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { MetricsService } from '../metrics/metrics.service';

const execFileAsync = promisify(execFile);

export interface TypstAsset {
  /** Nombre de archivo dentro del directorio de trabajo (ej. "chart-1.png") — se referencia desde el .typ con una ruta relativa simple, sin `/` inicial. */
  filename: string;
  buffer: Buffer;
}

/**
 * Compila documentos Typst a PDF sin browser — reemplaza el patrón triplicado
 * de `puppeteer.launch()`/`page.pdf()`/cleanup-SIGKILL que hoy repiten
 * prescriptions-pdf.service.ts, medical-records-pdf.service.ts y
 * reports-pdf.service.ts. Mismo patrón de invocación que
 * cotizaciones-tecnocondor (`packages/plantilla-pdf/src/compilar-una.ts`):
 * `execFile` al binario `typst` del sistema, sin librería npm intermedia.
 */
@Injectable()
export class TypstCompilerService {
  private readonly logger = new Logger(TypstCompilerService.name);
  private readonly typstBin = process.env.TYPST_BIN ?? 'typst';
  private readonly root = process.env.PDF_ROOT ?? join(process.cwd(), 'public', 'pdf');
  private readonly fontsDir = join(this.root, 'fonts');
  private readonly tmpRoot = join(this.root, '.tmp');

  constructor(private readonly metrics: MetricsService) {}

  /**
   * Compila `typstSource` (el `.typ` de entrada ya armado, con `#import
   * "/templates/..."` a los componentes compartidos) a un Buffer PDF.
   * `assets` son archivos adicionales (ej. gráficos rasterizados) que el
   * `.typ` referencia por nombre relativo — se escriben en el mismo
   * directorio de trabajo temporal que la entrada, y todo el directorio se
   * borra al terminar, compile o no.
   */
  async compile(typstSource: string, assets: TypstAsset[] = []): Promise<Buffer> {
    const workDir = join(this.tmpRoot, randomUUID());
    const entryPath = join(workDir, 'entrada.typ');
    const outPath = join(workDir, 'salida.pdf');

    await mkdir(workDir, { recursive: true });
    const start = process.hrtime.bigint();
    try {
      await Promise.all([
        writeFile(entryPath, typstSource, 'utf8'),
        ...assets.map(a => writeFile(join(workDir, a.filename), a.buffer)),
      ]);

      await execFileAsync(this.typstBin, [
        'compile',
        entryPath,
        outPath,
        '--root',
        this.root,
        '--ignore-system-fonts',
        '--font-path',
        this.fontsDir,
      ]);

      const buffer = await readFile(outPath);
      this.recordMetrics(start, 'success');
      return buffer;
    } catch (err) {
      this.recordMetrics(start, 'error');
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Fallo compilando PDF con Typst: ${message}`);
      throw new InternalServerErrorException('No se pudo generar el PDF');
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {
        // Directorio temporal, no crítico si falla la limpieza puntual.
      });
    }
  }

  private recordMetrics(start: bigint, status: 'success' | 'error'): void {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.pdfGeneratedTotal.inc({ status });
    this.metrics.pdfCompileDurationSeconds.observe(durationSec);
  }
}
