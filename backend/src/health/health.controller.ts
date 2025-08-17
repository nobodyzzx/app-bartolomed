import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  checkHealth() {
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
