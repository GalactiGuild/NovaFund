import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { KYCModule } from '../../src/kyc/kyc.module';

describe('KYCController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [KYCModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/POST admin/kyc/override', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/kyc/override')
      .send({ userId: 'user123', action: 'APPROVE', reason: 'Manual check passed' });
    expect(res.status).toBe(201);
    expect(res.body.action).toBe('APPROVE');
  });

  afterAll(async () => {
    await app.close();
  });
});
