import { ERROR_CODES, USER_ROLES } from '@aashvo/contracts';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { Public } from '../src/common/decorators/public.decorator';
import { buildOpenApiDocument } from '../src/infrastructure/openapi/swagger.setup';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

class ValidationProbeDto {
  @ApiProperty()
  @IsString()
  label!: string;
}

@Controller('api/v1/_test-validation')
class ValidationProbeController {
  @Post()
  @Public()
  echo(@Body() dto: ValidationProbeDto) {
    return { label: dto.label };
  }
}

describe('Aashvo NestJS Foundation Integration (Supertest)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('shares @aashvo/contracts enums and error codes cleanly', () => {
    expect(USER_ROLES).toEqual(['renter', 'owner', 'broker', 'admin']);
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
  });

  test('GET /api/v1/health/live returns 200 OK with security headers and X-Request-ID', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-ID', 'trace_abc_123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('trace_abc_123');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'aashvo-api',
      version: '1.0.0',
      environment: 'test',
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  test('GET /api/v1/health/ready returns 200 ready against real local PostgreSQL', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

    expect(res.body).toMatchObject({
      status: 'ready',
      service: 'aashvo-api',
      checks: {
        database: {
          status: 'up',
        },
      },
    });
    expect(typeof res.body.checks.database.latencyMs).toBe('number');
  });

  test('GET /api/v1/health/ready honestly returns 503 degraded when database probe fails', async () => {
    const querySpy = jest
      .spyOn(prisma, '$queryRawUnsafe')
      .mockRejectedValueOnce(new Error('Connection terminated'));

    try {
      const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
      expect(res.body).toMatchObject({
        status: 'degraded',
        checks: {
          database: {
            status: 'down',
            error: 'Database unavailable',
          },
        },
      });
    } finally {
      querySpy.mockRestore();
    }
  });

  test('unknown route returns canonical 404 and protected routes default to 401 when unauthenticated', async () => {
    const notFoundRes = await request(app.getHttpServer())
      .get('/api/v1/nonexistent-route')
      .expect(404);

    expect(notFoundRes.headers['x-request-id']).toMatch(/^req_/);
    expect(notFoundRes.body).toMatchObject({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        requestId: notFoundRes.headers['x-request-id'],
      },
    });

    const unauthRes = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(unauthRes.body).toMatchObject({
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
      },
    });
  });

  test('ValidationPipe forbids unexpected payload properties (forbidNonWhitelisted)', async () => {
    const okRes = await request(app.getHttpServer())
      .post('/api/v1/_test-validation')
      .send({ label: 'safe' })
      .expect(201);
    expect(okRes.body).toEqual({ label: 'safe' });

    const rejectedRes = await request(app.getHttpServer())
      .post('/api/v1/_test-validation')
      .send({ label: 'safe', role: 'admin' })
      .expect(400);
    expect(rejectedRes.body).toMatchObject({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Request validation failed.',
      },
    });
  });

  test('CORS allows allowlisted origin and blocks unauthorized origin', async () => {
    const allowedRes = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const deniedRes = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('Origin', 'https://attacker.example.com')
      .expect(200);
    expect(deniedRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('OpenAPI 3 document includes health + auth endpoints and BearerAuth security scheme', () => {
    const document = buildOpenApiDocument(app);

    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths['/api/v1/health/live']?.get).toBeDefined();
    expect(document.paths['/api/v1/health/ready']?.get).toBeDefined();
    expect(document.paths['/api/v1/auth/register']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/login']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/refresh']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/me']?.get).toBeDefined();
    expect(document.components?.securitySchemes?.BearerAuth).toBeDefined();
  });
});
