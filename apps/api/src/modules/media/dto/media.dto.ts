import { MEDIA_BUCKETS, type MediaBucket } from '@aashvo/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;
export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export class PresignedUploadDto {
  @ApiProperty({ description: 'Original file name', example: 'living-room.webp' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'Allowed MIME content type',
    example: 'image/webp',
    enum: ALL_ALLOWED_MIME_TYPES,
  })
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_SIZE_BYTES)
  sizeBytes!: number;

  @ApiProperty({
    description: 'Target storage bucket',
    example: 'property-photos',
    enum: MEDIA_BUCKETS,
  })
  @IsEnum(MEDIA_BUCKETS)
  bucket!: MediaBucket;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Media asset UUID returned by presigned upload' })
  @IsUUID()
  assetId!: string;
}

export class PresignedUploadResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  assetId!: string;

  @ApiProperty({ example: 'http://localhost:4000/api/v1/media/mock-upload/...' })
  uploadUrl!: string;

  @ApiProperty({
    nullable: true,
    example: 'http://localhost:4000/public-media/property-photos/...',
    description: 'Public CDN URL for public assets; null for sensitive private documents',
  })
  publicUrl!: string | null;

  @ApiProperty({ example: 'property-photos/123/uuid-photo.webp' })
  objectKey!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;

  @ApiProperty({ example: { 'Content-Type': 'image/webp' } })
  headers!: Record<string, string>;
}

export class MediaAssetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MEDIA_BUCKETS })
  bucket!: MediaBucket;

  @ApiProperty()
  objectKey!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  isPublic!: boolean;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  url!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class PresignedDownloadResponseDto {
  @ApiProperty({ description: 'Short-lived signed download URL (15 minutes TTL)' })
  downloadUrl!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;
}

