import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Filter to unread notifications only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ default: 20, description: 'Maximum notifications to fetch' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 20))
  limit?: number;
}

export class NotificationResponseDto {
  @ApiProperty({ example: 'notif-1a2b3c' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiProperty({ example: 'Visit Request Confirmed' })
  title!: string;

  @ApiProperty({ example: 'Your visit for DLF Phase 2 room was confirmed for 20 Nov 2026, 04:30 PM IST.' })
  body!: string;

  @ApiProperty({ enum: NOTIFICATION_CATEGORIES, example: 'visit_update' })
  category!: NotificationCategory;

  @ApiPropertyOptional({ example: '/my-activity/visits' })
  targetUrl?: string | null;

  @ApiPropertyOptional({ example: { visitId: 'vst-1' } })
  metadata?: Record<string, any>;

  @ApiProperty({ example: false })
  read!: boolean;

  @ApiPropertyOptional({ example: '2026-11-15T01:30:00.000Z' })
  readAt?: string | null;

  @ApiProperty({ example: '2026-11-15T01:25:00.000Z' })
  createdAt!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ example: 3 })
  unreadCount!: number;

  @ApiProperty({ example: 12 })
  total!: number;
}
