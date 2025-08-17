import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    };
  }

  @Get('db')
  dbHealthCheck() {
    return {
      status: 'Database connection available',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
