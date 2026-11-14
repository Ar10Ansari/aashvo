import type { MediaBucket } from '@aashvo/contracts';
import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import type { PresignedUploadResult, StoragePort } from '../ports/storage.port';

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly existingObjects = new Set<string>();
  private readonly signingSecret = randomBytes(32).toString('hex');
  private readonly baseUrl = 'http://localhost:4000';

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
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = createHmac('sha256', this.signingSecret)
      .update(`${bucket}:${key}:${contentType}:${expiresAt}`)
      .digest('hex');

    const uploadUrl = `${this.baseUrl}/api/v1/media/mock-upload/${bucket}/${encodeURIComponent(key)}?exp=${expiresAt}&sig=${signature}`;
    const publicUrl = this.isBucketPublic(bucket)
      ? `${this.baseUrl}/public-media/${bucket}/${key}`
      : null;

    // Simulate presence for automated testing flows
    this.existingObjects.add(`${bucket}:${key}`);

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
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = createHmac('sha256', this.signingSecret)
      .update(`download:${bucket}:${key}:${expiresAt}`)
      .digest('hex');

    return `${this.baseUrl}/api/v1/media/private-download/${bucket}/${encodeURIComponent(key)}?exp=${expiresAt}&sig=${signature}`;
  }

  async objectExists(bucket: MediaBucket, key: string): Promise<boolean> {
    return this.existingObjects.has(`${bucket}:${key}`);
  }

  async deleteObject(bucket: MediaBucket, key: string): Promise<void> {
    this.existingObjects.delete(`${bucket}:${key}`);
  }

  getPublicUrl(bucket: MediaBucket, key: string): string | null {
    if (!this.isBucketPublic(bucket)) {
      return null;
    }
    return `${this.baseUrl}/public-media/${bucket}/${key}`;
  }

  // Test helper to mock object presence
  simulateObjectUploaded(bucket: MediaBucket, key: string): void {
    this.existingObjects.add(`${bucket}:${key}`);
  }
}

