import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Logging de variables de entorno para debug
  logger.log(`Environment Variables:
    DB_HOST: ${process.env.DB_HOST}
    DB_PORT: ${process.env.DB_PORT}
    DB_NAME: ${process.env.DB_NAME}
    DB_USER: ${process.env.DB_USER}
    NODE_ENV: ${process.env.NODE_ENV}
  `);
  
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application listening on port ${port} on all interfaces`);
}
bootstrap();
