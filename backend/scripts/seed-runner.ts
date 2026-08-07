import { NestFactory } from '@nestjs/core';
import { SeedModule } from '../src/seed/seed.module';
import { SeedService } from '../src/seed/seed.service';
import { AppModule } from '../src/app.module';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const seedService = app.get(SeedService);

    console.log('🔁 Running global seed...');
    const result = await seedService.seedDemo();
    console.log('✅ Seed completed:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Error running seed:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
