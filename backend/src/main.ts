import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalFilters(new HttpExceptionFilter());

  // Configuración de CORS para producción y desarrollo
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendDomain = process.env.FRONTEND_DOMAIN;
  const backendDomain = process.env.BACKEND_DOMAIN;
  const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(o => !!o);

  // Construye orígenes de producción a partir de variables de entorno
  const toUrl = (d?: string) => {
    if (!d) return undefined;
    return d.startsWith('http://') || d.startsWith('https://') ? d : `https://${d}`;
  };
  const prodOrigins = [toUrl(frontendDomain), toUrl(backendDomain), ...extraOrigins].filter(Boolean) as string[];

  // En producción con Docker interno, permitir origen null (peticiones desde el mismo servidor/red Docker)
  const allowedOrigins = isProduction
    ? prodOrigins.length
      ? prodOrigins
      : ['https://bartolomed.tecnocondor.dev', 'https://api.bartolomed.tecnocondor.dev']
    : ['http://localhost:4200', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (llamadas internas Docker, curl, etc.) en producción
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-god-token', 'x-clinic-id'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  // Swagger — sólo en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Bartolomed API')
      .setDescription('API clínica Bartolomed')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-clinic-id', in: 'header' }, 'clinic-id')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    logger.log(`Swagger docs available at http://localhost:3000/api/docs`)
  }

  await app.listen(3000);
  logger.log(`Application listening on port 3000`);
}
bootstrap();
