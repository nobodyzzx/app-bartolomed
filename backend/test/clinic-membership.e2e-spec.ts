import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Clinic } from '../src/clinics/entities/clinic.entity';
import { UserClinic } from '../src/users/entities/user-clinic.entity';
import { User } from '../src/users/entities/user.entity';

describe('Clinic Membership Management (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let clinicRepo: Repository<Clinic>;
  let userClinicRepo: Repository<UserClinic>;

  let superAdminToken: string;
  let superAdminUser: User;
  let testClinic: Clinic;
  let clinicAdminUser: User;
  let clinicAdminToken: string;
  let regularUser: User;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    clinicRepo = moduleFixture.get<Repository<Clinic>>(getRepositoryToken(Clinic));
    userClinicRepo = moduleFixture.get<Repository<UserClinic>>(getRepositoryToken(UserClinic));

    // Crear SUPER_ADMIN
    superAdminUser = userRepo.create({
      email: 'superadmin-membership@example.com',
      password: 'hashedpassword',
      roles: ['super-admin', 'admin'],
      personalInfo: {
        firstName: 'Super',
        lastName: 'Admin',
      } as any,
    });
    await userRepo.save(superAdminUser);

    // Login para obtener token
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'superadmin-membership@example.com',
      password: 'hashedpassword',
    });
    superAdminToken = loginResponse.body.token;

    // Crear clínica de prueba
    testClinic = clinicRepo.create({
      name: 'Test Clinic Membership',
      address: 'Test Address',
      phone: '1234567890',
      createdBy: superAdminUser,
    });
    await clinicRepo.save(testClinic);

    // Crear admin de clínica
    clinicAdminUser = userRepo.create({
      email: 'clinicadmin-test@example.com',
      password: 'hashedpassword',
      roles: ['user'],
      personalInfo: {
        firstName: 'Clinic',
        lastName: 'Admin',
      } as any,
    });
    await userRepo.save(clinicAdminUser);

    // Asignar como admin de la clínica
    const adminMembership = userClinicRepo.create({
      user: clinicAdminUser,
      clinic: testClinic,
      roles: ['admin'],
    });
    await userClinicRepo.save(adminMembership);

    // Login clinic admin
    const adminLoginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'clinicadmin-test@example.com',
      password: 'hashedpassword',
    });
    clinicAdminToken = adminLoginResponse.body.token;

    // Crear usuario regular
    regularUser = userRepo.create({
      email: 'regular-member@example.com',
      password: 'hashedpassword',
      roles: ['user'],
      personalInfo: {
        firstName: 'Regular',
        lastName: 'User',
      } as any,
    });
    await userRepo.save(regularUser);
  });

  afterAll(async () => {
    // Limpiar
    await userClinicRepo.delete({ clinic: { id: testClinic.id } });
    await clinicRepo.delete({ id: testClinic.id });
    await userRepo.delete({ email: 'superadmin-membership@example.com' });
    await userRepo.delete({ email: 'clinicadmin-test@example.com' });
    await userRepo.delete({ email: 'regular-member@example.com' });
    await app.close();
  });

  describe('GET /clinics/:clinicId/members', () => {
    it('should list members for SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get(`/clinics/${testClinic.id}/members`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('userId');
      expect(response.body[0]).toHaveProperty('email');
      expect(response.body[0]).toHaveProperty('clinicRoles');
    });

    it('should list members for clinic admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/clinics/${testClinic.id}/members`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject without authentication', async () => {
      return request(app.getHttpServer()).get(`/clinics/${testClinic.id}/members`).expect(401);
    });
  });

  describe('POST /clinics/:clinicId/members', () => {
    it('should add a new member with roles (clinic admin)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/clinics/${testClinic.id}/members`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .send({
          userId: regularUser.id,
          roles: ['doctor', 'pharmacist'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject duplicate membership', async () => {
      return request(app.getHttpServer())
        .post(`/clinics/${testClinic.id}/members`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .send({
          userId: regularUser.id,
          roles: ['doctor'],
        })
        .expect(400);
    });

    it('should reject without admin role in clinic', async () => {
      // Crear otro usuario sin rol de admin
      const nonAdminUser = userRepo.create({
        email: 'nonadmin@example.com',
        password: 'hashedpassword',
        roles: ['user'],
        personalInfo: {
          firstName: 'Non',
          lastName: 'Admin',
        } as any,
      });
      await userRepo.save(nonAdminUser);

      // Asignar como miembro sin rol admin
      const membership = userClinicRepo.create({
        user: nonAdminUser,
        clinic: testClinic,
        roles: ['doctor'],
      });
      await userClinicRepo.save(membership);

      const loginResp = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'nonadmin@example.com',
        password: 'hashedpassword',
      });
      const nonAdminToken = loginResp.body.token;

      // Crear otro usuario a agregar
      const newUser = userRepo.create({
        email: 'newmember@example.com',
        password: 'hashedpassword',
        roles: ['user'],
        personalInfo: { firstName: 'New', lastName: 'Member' } as any,
      });
      await userRepo.save(newUser);

      await request(app.getHttpServer())
        .post(`/clinics/${testClinic.id}/members`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          userId: newUser.id,
          roles: ['nurse'],
        })
        .expect(403);

      // Limpiar
      await userClinicRepo.delete({ user: { id: nonAdminUser.id } });
      await userRepo.delete({ id: nonAdminUser.id });
      await userRepo.delete({ id: newUser.id });
    });
  });

  describe('PATCH /clinics/:clinicId/members/:userId', () => {
    it('should update member roles (clinic admin)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/clinics/${testClinic.id}/members/${regularUser.id}`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .send({
          roles: ['doctor', 'nurse'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });

    it('should update member roles (SUPER_ADMIN)', async () => {
      return request(app.getHttpServer())
        .patch(`/clinics/${testClinic.id}/members/${regularUser.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roles: ['pharmacist'],
        })
        .expect(200);
    });
  });

  describe('DELETE /clinics/:clinicId/members/:userId', () => {
    it('should remove a member (clinic admin)', async () => {
      return request(app.getHttpServer())
        .delete(`/clinics/${testClinic.id}/members/${regularUser.id}`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .expect(200);
    });

    it('should return success even if member does not exist', async () => {
      // Re-eliminar mismo miembro
      return request(app.getHttpServer())
        .delete(`/clinics/${testClinic.id}/members/${regularUser.id}`)
        .set('Authorization', `Bearer ${clinicAdminToken}`)
        .expect(200);
    });
  });
});
