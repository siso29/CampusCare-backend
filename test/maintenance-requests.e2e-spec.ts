import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-at-least-32-characters';

describe('Maintenance requests API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let student: ReturnType<typeof request.agent>;
  let secondStudent: ReturnType<typeof request.agent>;
  const createdRequestIds: string[] = [];
  const createdUserEmails: string[] = [];
  const marker = `CampusCare API test ${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    student = request.agent(app.getHttpServer());
    secondStudent = request.agent(app.getHttpServer());

    const studentEmail = `student-${Date.now()}@example.test`;
    const secondStudentEmail = `student-two-${Date.now()}@example.test`;
    createdUserEmails.push(studentEmail, secondStudentEmail);

    await student
      .post('/api/auth/register')
      .send({
        email: studentEmail,
        firstName: 'Test',
        lastName: 'Student',
        password: 'CampusCareTest123',
      })
      .expect(201);
    await secondStudent
      .post('/api/auth/register')
      .send({
        email: secondStudentEmail,
        firstName: 'Second',
        lastName: 'Student',
        password: 'CampusCareTest123',
      })
      .expect(201);
  });

  afterAll(async () => {
    if (createdRequestIds.length > 0) {
      await prisma.maintenanceRequest.deleteMany({
        where: { id: { in: createdRequestIds } },
      });
    }
    if (createdUserEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdUserEmails } },
      });
    }
    await app.close();
  });

  it('registers a student with an HTTP-only session and returns their account', async () => {
    const response = await student.get('/api/auth/me').expect(200);

    expect(response.body).toMatchObject({
      firstName: 'Test',
      lastName: 'Student',
      role: 'STUDENT',
      status: 'ACTIVE',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('requires authentication before a maintenance request can be created', async () => {
    await request(app.getHttpServer())
      .post('/api/maintenance-requests')
      .send({
        title: marker,
        description: 'Water is leaking from the main pipe near the dormitory.',
        category: 'WATER_SUPPLY',
        location: 'Main Campus, Dormitory Block A',
      })
      .expect(401);
  });

  it('creates a request for its authenticated student and scopes list results', async () => {
    const response = await student
      .post('/api/maintenance-requests')
      .send({
        title: marker,
        description: 'Water is leaking from the main pipe near the dormitory.',
        category: 'WATER_SUPPLY',
        location: 'Main Campus, Dormitory Block A',
        priority: 'HIGH',
      })
      .expect(201);

    createdRequestIds.push(response.body.id);
    expect(response.body).toMatchObject({
      title: marker,
      status: 'PENDING',
      category: 'WATER_SUPPLY',
      priority: 'HIGH',
    });

    const ownList = await student
      .get('/api/maintenance-requests')
      .query({ search: marker, page: 1, limit: 10 })
      .expect(200);
    expect(ownList.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: response.body.id })]),
    );

    const otherList = await secondStudent
      .get('/api/maintenance-requests')
      .query({ search: marker, page: 1, limit: 10 })
      .expect(200);
    expect(otherList.body.data).toEqual([]);
  });

  it('prevents a different student from reading another student request', async () => {
    await secondStudent
      .get(`/api/maintenance-requests/${createdRequestIds[0]}`)
      .expect(403);
  });

  it('rejects system-controlled fields and invalid filters', async () => {
    await student
      .post('/api/maintenance-requests')
      .send({
        title: `${marker} invalid`,
        description: 'This payload tries to set a protected request status.',
        category: 'WATER_SUPPLY',
        location: 'Main Campus',
        status: 'RESOLVED',
      })
      .expect(400);

    await student
      .get('/api/maintenance-requests')
      .query({ status: 'NOT_A_STATUS' })
      .expect(400);
  });

  it('restricts dashboard summary to staff and administrators', async () => {
    await student.get('/api/maintenance-requests/summary').expect(403);
  });

  it('clears the session on logout', async () => {
    await student.post('/api/auth/logout').expect(201);
    await student.get('/api/auth/me').expect(401);
  });
});
