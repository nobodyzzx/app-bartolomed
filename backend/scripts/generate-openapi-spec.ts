import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../src/app.module';

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Bartolomed API')
    .setDescription('API clínica Bartolomed')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-clinic-id', in: 'header' }, 'clinic-id')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = resolve(
    __dirname,
    '../../frontend/src/generated/api-spec.json',
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI spec generado en: ${outputPath}`);
  await app.close();
}

run().catch((err) => {
  console.error('Error generando spec:', err);
  process.exit(1);
});
