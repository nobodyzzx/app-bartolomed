import { ForbiddenException } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

describe('SeedController', () => {
  let controller: SeedController;
  let seedService: jest.Mocked<SeedService>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    seedService = {
      seedDemo: jest.fn().mockResolvedValue({ ok: true }),
      resetAll: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as jest.Mocked<SeedService>;
    controller = new SeedController(seedService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('seedDemo', () => {
    it('delega en seedService.seedDemo() fuera de producción', async () => {
      process.env.NODE_ENV = 'development';
      const result = await controller.seedDemo();
      expect(seedService.seedDemo).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('lanza ForbiddenException en producción sin llamar al servicio', async () => {
      process.env.NODE_ENV = 'production';
      await expect(controller.seedDemo()).rejects.toThrow(ForbiddenException);
      expect(seedService.seedDemo).not.toHaveBeenCalled();
    });
  });

  describe('resetAll', () => {
    it('delega en seedService.resetAll() fuera de producción', async () => {
      process.env.NODE_ENV = 'test';
      const result = await controller.resetAll();
      expect(seedService.resetAll).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('lanza ForbiddenException en producción sin llamar al servicio (el hallazgo crítico de Sprint 5)', async () => {
      process.env.NODE_ENV = 'production';
      await expect(controller.resetAll()).rejects.toThrow(ForbiddenException);
      expect(seedService.resetAll).not.toHaveBeenCalled();
    });
  });
});
