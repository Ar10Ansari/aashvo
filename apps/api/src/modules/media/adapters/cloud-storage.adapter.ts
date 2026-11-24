import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaBucket } from '@aashvo/contracts';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PresignedUploadResult, StoragePort } from '../ports/storage.port';
import type { AppConfig } from '../../../infrastructure/config/env.schema';

export interface CloudStorageConfig {
  cloudflareR2AccountId?: string;
  cloudflareR2AccessKeyId?: string;
  cloudflareR2SecretAccessKey?: string;
  cloudflareR2BucketName?: string;
  cloudflareR2PublicUrl?: string;
  awsRegion?: string;
  awsS3PrivateBucket?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

/**
 * Enterprise Production Cloud Storage Adapter:
 * - Public media (property photos, avatars): Cloudflare R2 via AWS SDK v3 S3 Client (region: auto)
 * - Private vault (rental agreements, KYC docs): AWS S3 ap-south-1 Mumbai with KMS/SSE-S3 & Block Public Access
 */
@Injectable()
export class CloudStorageAdapter implements StoragePort {
  private readonly logger = new Logger(CloudStorageAdapter.name);
  private readonly r2Client: S3Client;
  private readonly s3Client: S3Client;
  private readonly config: CloudStorageConfig;

  constructor(
    @Optional() configService?: ConfigService<AppConfig, true>,
    @Optional() explicitConfig?: CloudStorageConfig,
  ) {
    this.config = explicitConfig || {
      cloudflareR2AccountId: configService?.get('CLOUDFLARE_R2_ACCOUNT_ID', { infer: true }) || process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      cloudflareR2AccessKeyId: configService?.get('CLOUDFLARE_R2_ACCESS_KEY_ID', { infer: true }) || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      cloudflareR2SecretAccessKey: configService?.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY', { infer: true }) || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      cloudflareR2BucketName: configService?.get('CLOUDFLARE_R2_BUCKET_NAME', { infer: true }) || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'aashvo-public-assets',
      cloudflareR2PublicUrl: configService?.get('CLOUDFLARE_R2_PUBLIC_URL', { infer: true }) || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://assets.aashvo.in',
      awsRegion: configService?.get('AWS_REGION', { infer: true }) || process.env.AWS_REGION || 'ap-south-1',
      awsS3PrivateBucket: configService?.get('AWS_S3_PRIVATE_BUCKET', { infer: true }) || process.env.AWS_S3_PRIVATE_BUCKET || 'aashvo-private-vault',
      awsAccessKeyId: configService?.get('AWS_ACCESS_KEY_ID', { infer: true }) || process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: configService?.get('AWS_SECRET_ACCESS_KEY', { infer: true }) || process.env.AWS_SECRET_ACCESS_KEY,
    };

    const r2AccountId = this.config.cloudflareR2AccountId;
    const r2AccessKey = this.config.cloudflareR2AccessKeyId;
    const r2SecretKey = this.config.cloudflareR2SecretAccessKey;

    const awsRegion = this.config.awsRegion || 'ap-south-1';
    const awsAccessKey = this.config.awsAccessKeyId;
    const awsSecretKey = this.config.awsSecretAccessKey;

    // 1. Cloudflare R2 Client (S3 API compatible, endpoint bound to Cloudflare Account)
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined,
      credentials:
        r2AccessKey && r2SecretKey
          ? {
              accessKeyId: r2AccessKey,
              secretAccessKey: r2SecretKey,
            }
          : undefined,
    });

    // 2. AWS S3 Mumbai Client (Encrypted Private Vault)
    this.s3Client = new S3Client({
      region: awsRegion,
      credentials:
        awsAccessKey && awsSecretKey
          ? {
              accessKeyId: awsAccessKey,
              secretAccessKey: awsSecretKey,
            }
          : undefined,
    });
  }

  private isBucketPublic(bucket: MediaBucket): boolean {
    return bucket === 'property-photos' || bucket === 'user-avatars';
  }

  private getBucketName(bucket: MediaBucket): string {
    if (this.isBucketPublic(bucket)) {
      return (
        this.config.cloudflareR2BucketName ||
        process.env.CLOUDFLARE_R2_BUCKET_NAME ||
        'aashvo-public-assets'
      );
    }
    return (
      this.config.awsS3PrivateBucket ||
      process.env.AWS_S3_PRIVATE_BUCKET ||
      'aashvo-private-vault'
    );
  }

  private getClient(bucket: MediaBucket): S3Client {
    return this.isBucketPublic(bucket) ? this.r2Client : this.s3Client;
  }

  async getPresignedUploadUrl(
    bucket: MediaBucket,
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds: number,
  ): Promise<PresignedUploadResult> {
    const isPublic = this.isBucketPublic(bucket);
    const client = this.getClient(bucket);
    const bucketName = this.getBucketName(bucket);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
      ...(isPublic ? {} : { ServerSideEncryption: 'AES256' }),
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds,
    });

    const publicUrl = isPublic ? this.getPublicUrl(bucket, key) : null;

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
    bucket: MediaBucket,
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    if (this.isBucketPublic(bucket)) {
      const publicUrl = this.getPublicUrl(bucket, key);
      if (publicUrl) return publicUrl;
    }

    // Strictly cap private document presigned URL lifetime to 300 seconds (5 minutes)
    const cappedTtl = Math.min(expiresInSeconds, 300);
    const client = this.getClient(bucket);
    const bucketName = this.getBucketName(bucket);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return getSignedUrl(client, command, {
      expiresIn: cappedTtl,
    });
  }

  async objectExists(bucket: MediaBucket, key: string): Promise<boolean> {
    const client = this.getClient(bucket);
    const bucketName = this.getBucketName(bucket);

    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.error(`Error checking object existence for ${key} in ${bucketName}`, err);
      throw err;
    }
  }

  async deleteObject(bucket: MediaBucket, key: string): Promise<void> {
    const client = this.getClient(bucket);
    const bucketName = this.getBucketName(bucket);

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
      this.logger.log(`Deleted object ${key} from ${bucketName}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to delete object ${key} from ${bucketName}`, err);
      throw err;
    }
  }

  getPublicUrl(bucket: MediaBucket, key: string): string | null {
    if (!this.isBucketPublic(bucket)) {
      return null;
    }
    const cdnUrl =
      this.config.cloudflareR2PublicUrl ||
      process.env.CLOUDFLARE_R2_PUBLIC_URL ||
      'https://assets.aashvo.in';
    const trimmed = cdnUrl.replace(/\/+$/, '');
    return `${trimmed}/${key}`;
  }
}
