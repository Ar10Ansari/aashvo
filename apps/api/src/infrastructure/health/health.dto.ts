import type { DependencyCheckResult, LivenessResponse, ReadinessResponse } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DependencyCheckDto implements DependencyCheckResult {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';

  @ApiPropertyOptional({ example: 4 })
  latencyMs?: number;

  @ApiPropertyOptional({ example: 'Database unavailable' })
  error?: string;
}

export class LivenessResponseDto implements LivenessResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'aashvo-api' })
  service!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: 'development' })
  environment!: string;

  @ApiProperty({ example: 12 })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-11-12T16:30:00.000Z' })
  timestamp!: string;
}

export class ReadinessChecksDto {
  @ApiProperty({ type: DependencyCheckDto })
  database!: DependencyCheckDto;
}

export class ReadinessResponseDto implements ReadinessResponse {
  @ApiProperty({ enum: ['ready', 'degraded'], example: 'ready' })
  status!: 'ready' | 'degraded';

  @ApiProperty({ example: 'aashvo-api' })
  service!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: '2026-11-12T16:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}

