import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

/**
 * Rasteriza configs de Chart.js a PNG en el servidor, sin browser —
 * reemplaza el `<canvas>`+`<script>new Chart(...)` que hoy renderiza
 * `reports-pdf.service.ts` dentro de la página de Puppeteer. Recibe
 * EXACTAMENTE el mismo objeto `{type, data, options}` que ya arma cada
 * `*Html()` para `inlineChart()` — cero reescritura de la lógica de
 * gráficos, solo cambia dónde se renderiza.
 */
@Injectable()
export class ChartRasterizerService {
  // Bug real encontrado en vivo tras la limpieza de Fase 4: al quitar
  // `fonts-liberation` del Dockerfile (asumiendo que solo lo usaba
  // Puppeteer/Chromium), `chartjs-node-canvas` (Cairo/Pango vía node-canvas)
  // se quedó sin NINGÚN font registrado en el contenedor — el texto de ejes,
  // ticks y leyenda de todo gráfico rasterizado se renderizaba como
  // cuadrados (glifo faltante), aunque las barras/colores sí dibujaban bien
  // (Cairo en sí funciona, solo fallaba el text shaping). Fix: registrar
  // directo el mismo TTF de Inter que ya usa Typst para el cuerpo del
  // documento — evita reinstalar un paquete de fuentes del sistema, y de
  // paso deja el texto del gráfico visualmente consistente con el resto del
  // PDF.
  private readonly fontPath = join(process.env.PDF_ROOT ?? join(process.cwd(), 'public', 'pdf'), 'fonts', 'Inter.ttf');

  async rasterize(config: ChartConfiguration, width: number, height: number): Promise<Buffer> {
    const canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white',
      chartCallback: ChartJS => {
        ChartJS.defaults.font.family = 'Inter';
      },
    });
    canvas.registerFont(this.fontPath, { family: 'Inter' });
    return canvas.renderToBuffer(config, 'image/png');
  }
}
