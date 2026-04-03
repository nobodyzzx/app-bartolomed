import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async seedDemo() {
    return this.seedService.seedDemo();
  }
}
