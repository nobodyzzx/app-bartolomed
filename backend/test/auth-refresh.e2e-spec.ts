import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';

const cookieValue = (setCookie: string | string[] | undefined, key: string): string | undefined => {
  const cookieList = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const entry = cookieList.find(c => c.startsWith(`${key}=`));
  if (!entry) return undefined;
  return decodeURIComponent(entry.split(';')[0].split('=')[1] || '');
};

describe('Auth Refresh Hardening (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtService: JwtService;
  const TEST_PASSWORD = 'Abc123!';
  const TEST_EMAIL = 'refresh-hardening@example.com';

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await userRepo.delete({ email: TEST_EMAIL });
    const user = userRepo.create({
      email: TEST_EMAIL,
      password: await bcrypt.hash(TEST_PASSWORD, 10),
      roles: ['user'],
      personalInfo: {
        firstName: 'Refresh',
        lastName: 'Hardening',
      } as any,
    });
    await userRepo.save(user);
  });

  afterAll(async () => {
    await userRepo.delete({ email: TEST_EMAIL });
    await app.close();
  });

  it('should rotate refresh token and invalidate session on stale token reuse', async () => {
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(loginResponse.status).toBe(201);
    const firstRefreshToken = cookieValue(loginResponse.headers['set-cookie'], 'rt');
    expect(firstRefreshToken).toBeDefined();

    const refreshResponse = await request(app.getHttpServer()).post('/auth/refresh').send({
      refreshToken: firstRefreshToken,
    });
    expect(refreshResponse.status).toBe(201);
    expect(refreshResponse.body.token).toBeDefined();

    const secondRefreshToken = cookieValue(refreshResponse.headers['set-cookie'], 'rt');
    expect(secondRefreshToken).toBeDefined();
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    const forgedRefreshToken = jwtService.sign(
      { id: loginResponse.body.user.id, jti: 'forged-refresh-token' },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '15d' },
    );

    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: forgedRefreshToken }).expect(401);

    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: secondRefreshToken }).expect(401);

    const stored = await userRepo.findOne({
      where: { email: TEST_EMAIL },
      select: { id: true, refreshTokenHash: true },
    });
    expect(stored?.refreshTokenHash ?? null).toBeNull();
  });
});
