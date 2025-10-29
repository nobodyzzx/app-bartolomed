import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PersonalInfo } from './users/entities/personal-info.entity';
import { User } from './users/entities/user.entity';

async function seedDefaultUser(dataSource: DataSource): Promise<void> {
  const logger = new Logger('Seeder');

  try {
    const userRepository = dataSource.getRepository(User);
    const personalInfoRepository = dataSource.getRepository(PersonalInfo);

    // Check if default user already exists
    const existingUser = await userRepository.findOne({
      where: { email: 'doctor@example.com' },
    });

    if (existingUser) {
      logger.log('✅ Default user already exists: doctor@example.com');
      return;
    }

    logger.log('🌱 Creating default user...');

    // Create personal info first
    const personalInfo = personalInfoRepository.create({
      firstName: 'Doctor',
      lastName: 'Default',
      phone: '+591 70000000',
      address: 'Sistema Médico Bartolomé',
      birthDate: new Date('1980-01-01'),
    });

    await personalInfoRepository.save(personalInfo);

    // Create the default user
    const defaultUser = userRepository.create({
      email: 'doctor@example.com',
      password: bcrypt.hashSync('Abc123', 10),
      roles: ['super_user', 'admin', 'user'],
      isActive: true,
      personalInfo: personalInfo,
    });

    await userRepository.save(defaultUser);

    logger.log('✅ Default user created successfully:');
    logger.log(`   Name: Doctor Default`);
    logger.log(`   Email: doctor@example.com`);
    logger.log(`   Password: Abc123`);
    logger.log(`   Role: super_user`);
  } catch (error) {
    logger.error('❌ Error creating default user:', error.message);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalFilters(new HttpExceptionFilter());

  // Configuración de CORS para producción y desarrollo
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProduction
      ? ['https://bartolomed.tecnocondor.dev', 'https://api.bartolomed.tecnocondor.dev']
      : ['http://localhost:4200', 'http://localhost:3000'], // En desarrollo permite localhost específicos
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-god-token', 'x-clinic-id'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Get the DataSource and run seeder
  const dataSource = app.get(DataSource);
  await seedDefaultUser(dataSource);

  await app.listen(3000);
  logger.log(`Application listening on port 3000`);
}
bootstrap();
