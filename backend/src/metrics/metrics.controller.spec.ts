import { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;
  let res: jest.Mocked<Response>;

  beforeEach(() => {
    metricsService = {
      contentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
      metrics: jest.fn().mockResolvedValue('bartolomed_http_requests_total 42'),
    } as unknown as jest.Mocked<MetricsService>;
    res = { set: jest.fn(), send: jest.fn() } as unknown as jest.Mocked<Response>;
    controller = new MetricsController(metricsService);
  });

  it('setea el Content-Type del formato Prometheus y envía las métricas serializadas', async () => {
    await controller.getMetrics(res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
    expect(res.send).toHaveBeenCalledWith('bartolomed_http_requests_total 42');
  });
});
