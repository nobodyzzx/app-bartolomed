import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    dataSource = { query: jest.fn() } as unknown as jest.Mocked<DataSource>;
    controller = new HealthController(dataSource);
  });

  it('devuelve status "ok" y latencyMs si la DB responde', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.checkHealth();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checks.database.error).toBeUndefined();
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('devuelve status "error" con el mensaje si la query a la DB falla', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    const result = await controller.checkHealth();

    expect(result.status).toBe('error');
    expect(result.checks.database.status).toBe('error');
    expect(result.checks.database.error).toBe('connection refused');
  });

  it('usa un mensaje por defecto si el error rechazado no es una instancia de Error', async () => {
    dataSource.query.mockRejectedValue('boom');

    const result = await controller.checkHealth();

    expect(result.checks.database.error).toBe('boom');
  });
});
