import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type LoginResponse = {
  success: boolean;
  data: {
    sessionToken: string;
    user: {
      username: string;
    };
  };
};

describe('Anonymous Chat API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in and wraps the response', async () => {
    const username = `ali_${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({ username })
      .expect(200);

    const body = response.body as LoginResponse;

    expect(body.success).toBe(true);
    expect(body.data.sessionToken).toEqual(expect.any(String));
    expect(body.data.user.username).toBe(username);
  });
});
