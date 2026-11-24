import { CloudStorageAdapter } from './cloud-storage.adapter';
import * as presigner from '@aws-sdk/s3-request-presigner';

// Mock the presigner getSignedUrl
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('CloudStorageAdapter', () => {
  let adapter: CloudStorageAdapter;
  const mockGetSignedUrl = presigner.getSignedUrl as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new CloudStorageAdapter(undefined, {
      cloudflareR2AccountId: 'test-r2-account-id',
      cloudflareR2AccessKeyId: 'test-r2-access-key',
      cloudflareR2SecretAccessKey: 'test-r2-secret-key',
      cloudflareR2BucketName: 'aashvo-staging-public',
      cloudflareR2PublicUrl: 'https://cdn.staging.aashvo.in',
      awsRegion: 'ap-south-1',
      awsS3PrivateBucket: 'aashvo-staging-vault',
      awsAccessKeyId: 'test-aws-access-key',
      awsSecretAccessKey: 'test-aws-secret-key',
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('generates real signed PUT URL for public property photos and attaches public CDN URL', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-r2-account-id.r2.cloudflarestorage.com/aashvo-staging-public/properties/photo1.jpg?X-Amz-Signature=mock123',
      );

      const result = await adapter.getPresignedUploadUrl(
        'property-photos',
        'properties/photo1.jpg',
        'image/jpeg',
        1024 * 1024,
        900,
      );

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const callArgs = mockGetSignedUrl.mock.calls[0];
      const command = callArgs[1] as any;

      expect(command.input.Bucket).toBe('aashvo-staging-public');
      expect(command.input.Key).toBe('properties/photo1.jpg');
      expect(command.input.ContentType).toBe('image/jpeg');
      expect(command.input.ContentLength).toBe(1024 * 1024);
      expect(command.input.ServerSideEncryption).toBeUndefined(); // R2 doesn't require AWS SSE

      expect(result.uploadUrl).toContain('r2.cloudflarestorage.com');
      expect(result.publicUrl).toBe('https://cdn.staging.aashvo.in/properties/photo1.jpg');
      expect(result.objectKey).toBe('properties/photo1.jpg');
      expect(result.expiresInSeconds).toBe(900);
      expect(result.headers['Content-Type']).toBe('image/jpeg');
    });

    it('generates signed PUT URL with AES256 server-side encryption for private rental documents and returns null publicUrl', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://s3.ap-south-1.amazonaws.com/aashvo-staging-vault/contracts/lease123.pdf?X-Amz-Signature=mock456',
      );

      const result = await adapter.getPresignedUploadUrl(
        'rental-documents',
        'contracts/lease123.pdf',
        'application/pdf',
        2 * 1024 * 1024,
        900,
      );

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const callArgs = mockGetSignedUrl.mock.calls[0];
      const command = callArgs[1] as any;

      expect(command.input.Bucket).toBe('aashvo-staging-vault');
      expect(command.input.Key).toBe('contracts/lease123.pdf');
      expect(command.input.ContentType).toBe('application/pdf');
      expect(command.input.ContentLength).toBe(2 * 1024 * 1024);
      expect(command.input.ServerSideEncryption).toBe('AES256');

      expect(result.uploadUrl).toContain('s3.ap-south-1.amazonaws.com');
      expect(result.publicUrl).toBeNull(); // Strictly null for private documents
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('caps private document download URL lifetime to 300 seconds maximum', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://s3.ap-south-1.amazonaws.com/aashvo-staging-vault/contracts/lease123.pdf?X-Amz-Signature=download123',
      );

      const downloadUrl = await adapter.getPresignedDownloadUrl(
        'rental-documents',
        'contracts/lease123.pdf',
        3600, // Requested 1 hour, should be capped to 300s
      );

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const options = mockGetSignedUrl.mock.calls[0][2];
      expect(options.expiresIn).toBe(300); // Enforced 300s ceiling
      expect(downloadUrl).toContain('download123');
    });

    it('returns direct CDN public URL for public buckets', async () => {
      const publicUrl = await adapter.getPresignedDownloadUrl(
        'property-photos',
        'properties/photo1.jpg',
        300,
      );

      expect(mockGetSignedUrl).not.toHaveBeenCalled();
      expect(publicUrl).toBe('https://cdn.staging.aashvo.in/properties/photo1.jpg');
    });
  });

  describe('objectExists', () => {
    it('returns true when HeadObject succeeds', async () => {
      const s3Client = (adapter as any).s3Client;
      jest.spyOn(s3Client, 'send').mockResolvedValueOnce({} as any);

      const exists = await adapter.objectExists('rental-documents', 'contracts/lease123.pdf');
      expect(exists).toBe(true);
    });

    it('returns false when HeadObject throws NotFound or 404', async () => {
      const s3Client = (adapter as any).s3Client;
      const notFoundErr = new Error('NotFound');
      (notFoundErr as any).name = 'NotFound';
      (notFoundErr as any).$metadata = { httpStatusCode: 404 };
      jest.spyOn(s3Client, 'send').mockRejectedValueOnce(notFoundErr);

      const exists = await adapter.objectExists('rental-documents', 'contracts/missing.pdf');
      expect(exists).toBe(false);
    });
  });

  describe('deleteObject', () => {
    it('sends DeleteObjectCommand to target S3 client', async () => {
      const s3Client = (adapter as any).s3Client;
      const sendSpy = jest.spyOn(s3Client, 'send').mockResolvedValueOnce({} as any);

      await adapter.deleteObject('rental-documents', 'contracts/lease123.pdf');
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const command = sendSpy.mock.calls[0][0] as any;
      expect(command.input.Bucket).toBe('aashvo-staging-vault');
      expect(command.input.Key).toBe('contracts/lease123.pdf');
    });
  });
});
