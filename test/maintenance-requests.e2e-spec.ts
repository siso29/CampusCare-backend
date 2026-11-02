import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { PrismaService } from '../src/database/prisma.service';

type CreatedRequest = {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: string;
};

describe('Maintenance requests API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdIds: string[] = [];
  const marker = `CampusCare API test ${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.maintenanceRequest.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    await app.close();
  });

  it('creates a request and returns its persisted database record', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/maintenance-requests')
      .send({
        title: marker,
        description: 'Water is leaking from the main pipe near the dormitory.',
        category: 'WATER_SUPPLY',
        location: 'Main Campus, Dormitory Block A',
        priority: 'HIGH',
      })
      .expect(201);

    const created = response.body as CreatedRequest;
    createdIds.push(created.id);

    expect(created).toMatchObject({
      title: marker,
      status: 'PENDING',
      category: 'WATER_SUPPLY',
      priority: 'HIGH',
    });
    expect(created.id).toBeTruthy();

    const detail = await request(app.getHttpServer())
      .get(`/api/maintenance-requests/${created.id}`)
      .expect(200);

    expect(detail.body).toMatchObject({ id: created.id, title: marker });
  });

  it('filters and paginates real requests from PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/maintenance-requests')
      .query({
        search: marker,
        category: 'WATER_SUPPLY',
        priority: 'HIGH',
        page: 1,
        limit: 10,
      })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: marker, category: 'WATER_SUPPLY' }),
      ]),
    );
    expect(response.body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('returns dashboard counts from PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/maintenance-requests/summary')
      .expect(200);

    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.pending).toBeGreaterThanOrEqual(1);
    expect(response.body.highPriority).toBeGreaterThanOrEqual(1);
  });

  it('rejects system-controlled fields and invalid filters', async () => {
    await request(app.getHttpServer())
      .post('/api/maintenance-requests')
      .send({
        title: `${marker} invalid`,
        description: 'This payload tries to set a protected request status.',
        category: 'WATER_SUPPLY',
        location: 'Main Campus',
        status: 'RESOLVED',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/maintenance-requests')
      .query({ status: 'NOT_A_STATUS' })
      .expect(400);
  });

  it('returns 404 for an unknown request ID', async () => {
    await request(app.getHttpServer())
      .get('/api/maintenance-requests/not-a-real-request')
      .expect(404);
  });
});
