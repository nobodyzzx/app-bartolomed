import { Controller, Headers, Post } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  // Dev-only/demo endpoint: POST /api/seed/demo
  @Post('demo')
  async runDemo(@Headers('x-god-token') godToken?: string) {
    const envToken = process.env.GOD_MODE_TOKEN;
    const isDev = process.env.NODE_ENV !== 'production';

    // Allow in dev always; in prod require matching x-god-token
    if (!isDev) {
      if (!envToken || !godToken || envToken !== godToken) {
        return { ok: false, error: 'Not allowed' };
      }
    }

    try {
      const res = await this.seedService.seedDemo();
      return { ...res, message: 'Demo seed executed' };
    } catch (e: any) {
      if (isDev) {
        return { ok: false, error: e?.message || 'seed error', stack: e?.stack };
      }
      return { ok: false, error: 'seed failed' };
    }
  }
}
