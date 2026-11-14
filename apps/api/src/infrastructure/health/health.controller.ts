import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import type { AppConfig } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { LivenessResponseDto, ReadinessResponseDto } from './health.dto';

const SERVICE_NAME = 'aashvo-api';
const SERVICE_VERSION = '1.0.0';

@ApiTags('Health')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Get('live')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({ status: 200, description: 'API process is running', type: LivenessResponseDto })
  getLiveness(): LivenessResponseDto {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: this.configService.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Database readiness probe' })
  @ApiResponse({
    status: 200,
    description: 'Database dependency is reachable',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Database dependency is unreachable',
    type: ReadinessResponseDto,
  })
  async getReadiness(@Res() res: Response): Promise<void> {
    const database = await this.prisma.checkDatabaseHealth();
    const isReady = database.status === 'up';

    const payload: ReadinessResponseDto = {
      status: isReady ? 'ready' : 'degraded',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      checks: { database },
    };

    res.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(payload);
  }
}

