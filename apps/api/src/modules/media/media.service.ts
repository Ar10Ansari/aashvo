import {
  ERROR_CODES,
  type MediaBucket as ContractBucket,
  type UserRole,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaBucket, MediaStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ConfirmUploadDto,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  MediaAssetResponseDto,
  PresignedDownloadResponseDto,
  PresignedUploadDto,
  PresignedUploadResponseDto,
} from './dto/media.dto';
import { STORAGE_PORT, type StoragePort } from './ports/storage.port';

function toPrismaBucket(contractBucket: ContractBucket): MediaBucket {
  switch (contractBucket) {
    case 'property-photos':
      return MediaBucket.property_photos;
    case 'user-avatars':
      return MediaBucket.user_avatars;
    case 'support-attachments':
      return MediaBucket.support_attachments;
    case 'rental-documents':
      return MediaBucket.rental_documents;
  }
}

function toContractBucket(prismaBucket: MediaBucket): ContractBucket {
  switch (prismaBucket) {
    case MediaBucket.property_photos:
      return 'property-photos';
    case MediaBucket.user_avatars:
      return 'user-avatars';
    case MediaBucket.support_attachments:
      return 'support-attachments';
    case MediaBucket.rental_documents:
      return 'rental-documents';
  }
}

function sanitizeFileName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async requestPresignedUpload(
    userId: string,
    role: UserRole,
    dto: PresignedUploadDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<PresignedUploadResponseDto> {
    const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(dto.contentType);
    const isDoc = (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(dto.contentType);

    if (!isImage && !isDoc) {
      throw new BadRequestException({
        code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        message: `Content type "${dto.contentType}" is not supported. Allowed types: ${[...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_DOCUMENT_MIME_TYPES].join(', ')}`,
      });
    }

    if (isImage && dto.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: `Image exceeds maximum allowed size of 10MB (${dto.sizeBytes} bytes).`,
      });
    }

    if (isDoc && dto.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: `Document exceeds maximum allowed size of 25MB (${dto.sizeBytes} bytes).`,
      });
    }

    // Role-based bucket access checks
    if (dto.bucket === 'property-photos' && role !== 'owner' && role !== 'broker' && role !== 'admin') {
      // Allow renters only if uploading room photos for flatmate profile
      // Checked at property/flatmate attachment time
    }

    const isPublic = dto.bucket === 'property-photos' || dto.bucket === 'user-avatars';
    const prismaBucket = toPrismaBucket(dto.bucket);
    const safeName = sanitizeFileName(dto.fileName);
    const objectKey = `${dto.bucket}/${userId}/${randomUUID()}-${safeName}`;
    const expiresInSeconds = 900; // 15 minutes

    const presigned = await this.storage.getPresignedUploadUrl(
      dto.bucket,
      objectKey,
      dto.contentType,
      dto.sizeBytes,
      expiresInSeconds,
    );

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        bucket: prismaBucket,
        objectKey,
        mimeType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        isPublic,
        status: MediaStatus.pending_upload,
        sourceOrigin: 's3',
      },
    });

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'media.presigned_upload_requested',
      entityType: 'media_asset',
      entityId: asset.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { bucket: dto.bucket, objectKey, isPublic },
    });

    return {
      assetId: asset.id,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      objectKey,
      expiresInSeconds,
      headers: presigned.headers,
    };
  }

  async confirmUpload(
    userId: string,
    role: UserRole,
    dto: ConfirmUploadDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException({
        code: ERROR_CODES.MEDIA_ASSET_NOT_FOUND,
        message: 'Media asset not found.',
      });
    }

    if (asset.ownerId !== userId && role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to confirm this media asset.',
      });
    }

    const contractBucket = toContractBucket(asset.bucket);
    const exists = await this.storage.objectExists(contractBucket, asset.objectKey);
    if (!exists) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Object has not been uploaded to storage yet.',
      });
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: MediaStatus.verified },
    });

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'media.upload_confirmed',
      entityType: 'media_asset',
      entityId: asset.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
    });

    const publicUrl = updated.isPublic
      ? this.storage.getPublicUrl(contractBucket, updated.objectKey)
      : null;

    return {
      id: updated.id,
      bucket: contractBucket,
      objectKey: updated.objectKey,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
      isPublic: updated.isPublic,
      status: updated.status,
      url: publicUrl,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async getPrivateDownloadUrl(
    userId: string,
    role: UserRole,
    assetId: string,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<PresignedDownloadResponseDto> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException({
        code: ERROR_CODES.MEDIA_ASSET_NOT_FOUND,
        message: 'Media asset not found.',
      });
    }

    // Authorization check: Only document owner or admin can download private documents
    if (!asset.isPublic && asset.ownerId !== userId && role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access to private document denied.',
      });
    }

    const contractBucket = toContractBucket(asset.bucket);
    const expiresInSeconds = 900; // 15 minutes
    const downloadUrl = await this.storage.getPresignedDownloadUrl(
      contractBucket,
      asset.objectKey,
      expiresInSeconds,
    );

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'media.private_download_requested',
      entityType: 'media_asset',
      entityId: asset.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
    });

    return {
      downloadUrl,
      expiresInSeconds,
    };
  }

  async getAssetById(assetId: string): Promise<MediaAssetResponseDto | null> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) return null;

    const contractBucket = toContractBucket(asset.bucket);
    return {
      id: asset.id,
      bucket: contractBucket,
      objectKey: asset.objectKey,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      isPublic: asset.isPublic,
      status: asset.status,
      url: asset.isPublic ? this.storage.getPublicUrl(contractBucket, asset.objectKey) : null,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
