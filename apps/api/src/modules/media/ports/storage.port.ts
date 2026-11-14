import type { MediaBucket } from '@aashvo/contracts';

export const STORAGE_PORT = Symbol('AASHVO_STORAGE_PORT');

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string | null;
  objectKey: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface StoragePort {
  getPresignedUploadUrl(
    bucket: MediaBucket,
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds: number,
  ): Promise<PresignedUploadResult>;

  getPresignedDownloadUrl(
    bucket: MediaBucket,
    key: string,
    expiresInSeconds: number,
  ): Promise<string>;

  objectExists(bucket: MediaBucket, key: string): Promise<boolean>;

  deleteObject(bucket: MediaBucket, key: string): Promise<void>;

  getPublicUrl(bucket: MediaBucket, key: string): string | null;
}

