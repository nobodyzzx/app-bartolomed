import { Test, TestingModule } from '@nestjs/testing';

const mockRenderToBuffer = jest.fn();
const mockRegisterFont = jest.fn();
jest.mock('chartjs-node-canvas', () => ({
  ChartJSNodeCanvas: jest.fn().mockImplementation((opts: any) => ({
    __opts: opts,
    registerFont: mockRegisterFont,
    renderToBuffer: mockRenderToBuffer,
  })),
}));

import { ChartRasterizerService } from './chart-rasterizer.service';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

describe('ChartRasterizerService', () => {
  let service: ChartRasterizerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRenderToBuffer.mockResolvedValue(Buffer.from('fake-png-bytes'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChartRasterizerService],
    }).compile();

    service = module.get(ChartRasterizerService);
  });

  it('devuelve el buffer PNG rasterizado', async () => {
    const config: any = { type: 'bar', data: { labels: [], datasets: [] } };

    const result = await service.rasterize(config, 520, 200);

    expect(result).toEqual(Buffer.from('fake-png-bytes'));
  });

  it('crea el canvas con las dimensiones pedidas y fondo blanco (sin fondo blanco el PNG queda transparente sobre la página del PDF)', async () => {
    await service.rasterize({ type: 'doughnut', data: { labels: [], datasets: [] } } as any, 240, 180);

    expect(ChartJSNodeCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ width: 240, height: 180, backgroundColour: 'white' }),
    );
  });

  it('pasa el config de Chart.js sin modificarlo — cero reescritura de la lógica de gráficos existente', async () => {
    const config: any = {
      type: 'bar',
      data: { labels: ['Ene', 'Feb'], datasets: [{ label: 'Facturado', data: [100, 200] }] },
      options: { responsive: false },
    };

    await service.rasterize(config, 520, 200);

    expect(mockRenderToBuffer).toHaveBeenCalledWith(config, 'image/png');
  });

  /**
   * Regresión: sin esto, el texto de ejes/ticks/leyenda de todo gráfico
   * rasterizado se renderiza como cuadrados (glifo faltante) — encontrado en
   * vivo tras quitar `fonts-liberation` del Dockerfile en la limpieza de
   * Fase 4 (chartjs-node-canvas se quedó sin ningún font de sistema
   * registrado). Cairo en sí funciona bien (las barras/colores sí dibujan),
   * el problema es específicamente el text shaping sin fuente.
   */
  it('registra el TTF de Inter (mismo que usa Typst) y lo fija como font family default de Chart.js', async () => {
    await service.rasterize({ type: 'bar', data: { labels: [], datasets: [] } } as any, 520, 200);

    expect(mockRegisterFont).toHaveBeenCalledWith(expect.stringContaining('Inter.ttf'), { family: 'Inter' });

    const opts = (ChartJSNodeCanvas as jest.Mock).mock.calls[0][0];
    const fakeChartJS = { defaults: { font: { family: 'Helvetica Neue' } } };
    opts.chartCallback(fakeChartJS);
    expect(fakeChartJS.defaults.font.family).toBe('Inter');
  });
});
