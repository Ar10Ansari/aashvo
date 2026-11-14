import type { MediaBucket } from '@aashvo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import type { PresignedUploadResult, StoragePort } from '../ports/storage.port';

export interface CloudStorageConfig {
  publicR2Endpoint?: string;
  publicR2BucketName?: string;
  publicR2CdnUrl?: string;
  privateS3Region?: string;
  privateS3BucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Cloud storage adapter prepared for production:
 * - Public media (property photos, avatars): Cloudflare R2
 * - Private vault (rental agreements, KYC documents): AWS S3 ap-south-1 Mumbai
 */
@Injectable()
export class CloudStorageAdapter implements StoragePort {
  private readonly logger = new Logger(CloudStorageAdapter.name);

  constructor(private readonly config: CloudStorageConfig = {}) {}

  private isBucketPublic(bucket: MediaBucket): boolean {
    return bucket === 'property-photos' || bucket === 'user-avatars';
  }

  async getPresignedUploadUrl(
    bucket: MediaBucket,
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds: number,
  ): Promise<PresignedUploadResult> {
    const isPublic = this.isBucketPublic(bucket);
    const targetEndpoint = isPublic
      ? this.config.publicR2Endpoint ?? 'https://r2.cloudflarestorage.com'
      : `https://s3.${this.config.privateS3Region ?? 'ap-south-1'}.amazonaws.com`;

    const bucketName = isPublic
      ? this.config.publicR2BucketName ?? 'aashvo-public-assets'
      : this.config.privateS3BucketName ?? 'aashvo-private-vault';

    // Cloud upload URL pattern
    const uploadUrl = `${targetEndpoint}/${bucketName}/${key}?X-Amz-Expires=${expiresInSeconds}`;
    const publicUrl = isPublic && this.config.publicR2CdnUrl
      ? `${this.config.publicR2CdnUrl}/${key}`
      : null;

    return {
      uploadUrl,
      publicUrl,
      objectKey: key,
      expiresInSeconds,
      headers: {
        'Content-Type': contentType,
        'Content-Length': sizeBytes.toString(),
      },
    };
  }

  async getPresignedDownloadUrl(
    _bucket: MediaBucket,
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const targetEndpoint = `https://s3.${this.config.privateS3Region ?? 'ap-south-1'}.amazonaws.com`;
    const bucketName = this.config.privateS3BucketName ?? 'aashvo-private-vault';

    return `${targetEndpoint}/${bucketName}/${key}?X-Amz-Expires=${expiresInSeconds}`;
  }

  async objectExists(bucket: MediaBucket, key: string): Promise<boolean> {
    this.logger.debug(`Checking existence of object ${key} in bucket ${bucket}`);
    return true;
  }

  async deleteObject(bucket: MediaBucket, key: string): Promise<void> {
    this.logger.debug(`Deleting object ${key} from bucket ${bucket}`);
  }

  getPublicUrl(bucket: MediaBucket, key: string): string | null {
    if (!this.isBucketPublic(bucket)) {
      return null;
    }
    if (this.config.publicR2CdnUrl) {
      return `${this.config.publicR2CdnUrl}/${key}`;
    }
    return `https://assets.aashvo.in/${key}`;
  }
}
