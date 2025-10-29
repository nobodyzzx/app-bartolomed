import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';

describe('Auth Godmode (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  const GOD_TOKEN = 'test-god-token-123';

  beforeAll(async () => {
    // Configurar GOD_MODE_TOKEN para las pruebas
    process.env.GOD_MODE_TOKEN = GOD_TOKEN;
    process.env.JWT_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    // Limpiar usuarios creados en pruebas
    await userRepo.delete({ email: 'godmode-test@example.com' });
    await userRepo.delete({ email: 'promote-test@example.com' });
    await app.close();
  });

  describe('POST /auth/godmode/super-admin (create mode)', () => {
    it('should reject without god token', async () => {
      return request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .send({
          email: 'godmode-test@example.com',
          password: 'Abc123!',
          firstName: 'God',
          lastName: 'Test',
        })
        .expect(401);
    });

    it('should reject with invalid god token', async () => {
      return request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .set('x-god-token', 'wrong-token')
        .send({
          email: 'godmode-test@example.com',
          password: 'Abc123!',
          firstName: 'God',
          lastName: 'Test',
        })
        .expect(401);
    });

    it('should create a new SUPER_ADMIN user with valid god token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .set('x-god-token', GOD_TOKEN)
        .send({
          email: 'godmode-test@example.com',
          password: 'Abc123!',
          firstName: 'God',
          lastName: 'Test',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('godmode-test@example.com');
      expect(response.body.user.roles).toContain('super-admin');
      expect(response.body.user.roles).toContain('admin');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should accept god token via Authorization Bearer header', async () => {
      // Limpiar usuario previo
      await userRepo.delete({ email: 'godmode-bearer@example.com' });

      const response = await request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .set('Authorization', `Bearer ${GOD_TOKEN}`)
        .send({
          email: 'godmode-bearer@example.com',
          password: 'Abc123!',
          firstName: 'Bearer',
          lastName: 'Test',
        })
        .expect(201);

      expect(response.body.user.email).toBe('godmode-bearer@example.com');
      expect(response.body.user.roles).toContain('super-admin');

      // Limpiar
      await userRepo.delete({ email: 'godmode-bearer@example.com' });
    });
  });

  describe('POST /auth/godmode/super-admin (promote mode)', () => {
    beforeAll(async () => {
      // Crear un usuario normal para promover
      const existingUser = userRepo.create({
        email: 'promote-test@example.com',
        password: 'hashedpassword',
        roles: ['user'],
        personalInfo: {
          firstName: 'Promote',
          lastName: 'Test',
        } as any,
      });
      await userRepo.save(existingUser);
    });

    it('should promote an existing user to SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .set('x-god-token', GOD_TOKEN)
        .send({
          email: 'promote-test@example.com',
          mode: 'promote',
        })
        .expect(201);

      expect(response.body.user.email).toBe('promote-test@example.com');
      expect(response.body.user.roles).toContain('super-admin');
      expect(response.body.user.roles).toContain('admin');
      expect(response.body.user.roles).toContain('user'); // mantiene roles previos
    });
  });

  describe('Godmode disabled (no token configured)', () => {
    it('should reject when GOD_MODE_TOKEN is not set', async () => {
      const originalToken = process.env.GOD_MODE_TOKEN;
      delete process.env.GOD_MODE_TOKEN;

      await request(app.getHttpServer())
        .post('/auth/godmode/super-admin')
        .set('x-god-token', 'any-token')
        .send({
          email: 'test@example.com',
          password: 'Abc123!',
        })
        .expect(401);

      // Restaurar
      process.env.GOD_MODE_TOKEN = originalToken;
    });
  });
});
