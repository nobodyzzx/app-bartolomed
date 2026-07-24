import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  private assertNotProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Los endpoints de seed no están disponibles en producción.');
    }
  }

  @Auth(ValidRoles.SUPER_ADMIN)
  @Get()
  async seedDemo() {
    this.assertNotProduction();
    return this.seedService.seedDemo();
  }

  @Auth(ValidRoles.SUPER_ADMIN)
  @Get('reset')
  async resetAll() {
    this.assertNotProduction();
    return this.seedService.resetAll();
  }
}
