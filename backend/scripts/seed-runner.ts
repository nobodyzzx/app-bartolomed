import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAppointments, seedClinics, seedDoctors, seedPatients, seedPrescriptions, seedUsers } from '../src/seed';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource) as DataSource;

    console.log('🔁 Running seeds in order...');

    // Run seeds in explicit order
    await seedClinics(dataSource);
    await seedUsers(dataSource);
    await seedPatients(dataSource);
    await seedDoctors(dataSource);
    await seedAppointments(dataSource);
    await seedPrescriptions(dataSource);

    console.log('✅ All seeds executed');
  } catch (err) {
    console.error('❌ Error running seeds:', err);
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
