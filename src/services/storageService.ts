/**
 * Aashvo Supabase Storage Service
 *
 * Implements client-side validation and Supabase Storage integration for:
 * 1. Property photos (`property-photos` bucket, 5MB limit, public read).
 * 2. User avatars (`user-avatars` bucket, 2MB limit, public read).
 * 3. Support attachments (`support-attachments` bucket, 5MB limit, private read).
 *
 * Strict folder-level isolation is enforced:
 * Files must be uploaded to `<bucket>/<userId>/<filename>`.
 */

import { supabase, isLiveBackendConfigured } from './supabase';
import { apiClient } from './apiClient';

export const STORAGE_BUCKETS = {
  PROPERTY_PHOTOS: 'property-photos',
  USER_AVATARS: 'user-avatars',
  SUPPORT_ATTACHMENTS: 'support-attachments',
  RENTAL_DOCUMENTS: 'rental-documents',
} as const;

export const STORAGE_LIMITS = {
  PROPERTY_PHOTO_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
  USER_AVATAR_MAX_BYTES: 2 * 1024 * 1024,    // 2 MB
  SUPPORT_ATTACHMENT_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
  RENTAL_DOCUMENT_MAX_BYTES: 10 * 1024 * 1024, // 10 MB
};

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf'];

export interface StorageUploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

function cleanStorageFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Validates file constraints before upload.
 */
export function validateStorageFile(
  fileSize: number,
  mimeType: string,
  bucket: 'property-photos' | 'user-avatars' | 'support-attachments' | 'rental-documents'
): { isValid: boolean; error?: string } {
  let maxSize = STORAGE_LIMITS.PROPERTY_PHOTO_MAX_BYTES;
  let allowedMime = ALLOWED_IMAGE_MIME_TYPES;

  if (bucket === 'user-avatars') {
    maxSize = STORAGE_LIMITS.USER_AVATAR_MAX_BYTES;
  } else if (bucket === 'support-attachments') {
    maxSize = STORAGE_LIMITS.SUPPORT_ATTACHMENT_MAX_BYTES;
    allowedMime = ALLOWED_DOCUMENT_MIME_TYPES;
  } else if (bucket === 'rental-documents') {
    maxSize = STORAGE_LIMITS.RENTAL_DOCUMENT_MAX_BYTES;
    allowedMime = ALLOWED_DOCUMENT_MIME_TYPES;
  }

  if (fileSize > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    return {
      isValid: false,
      error: `File size exceeds the ${maxMb}MB limit for this category.`,
    };
  }

  if (!allowedMime.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: `File format ${mimeType} is not permitted. Allowed: ${allowedMime.join(', ')}.`,
    };
  }

  return { isValid: true };
}

/**
 * Uploads a property photo to the user's isolated folder in the property-photos bucket.
 */
export async function uploadPropertyPhoto(
  file: Blob | ArrayBuffer | Uint8Array,
  userId: string,
  filename: string,
  mimeType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const size = file instanceof Blob ? file.size : file.byteLength;
  const validation = validateStorageFile(size, mimeType, 'property-photos');
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const cleanFilename = cleanStorageFilename(filename);
  const path = `${userId}/${Date.now()}_${cleanFilename}`;

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.PROPERTY_PHOTOS)
        .upload(path, file, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKETS.PROPERTY_PHOTOS)
        .getPublicUrl(data.path);

      return {
        success: true,
        path: data.path,
        publicUrl: urlData.publicUrl,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Storage upload failed' };
    }
  }

  // Local fallback simulation
  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured. Cannot upload file in production.' };
  }

  return {
    success: true,
    path,
    publicUrl: `https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80`,
  };
}

/**
 * Uploads a user avatar to the user-avatars bucket.
 */
export async function uploadUserAvatar(
  file: Blob | ArrayBuffer | Uint8Array,
  userId: string,
  filename: string,
  mimeType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const size = file instanceof Blob ? file.size : file.byteLength;
  const validation = validateStorageFile(size, mimeType, 'user-avatars');
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const cleanFilename = cleanStorageFilename(filename);
  const path = `${userId}/${Date.now()}_${cleanFilename}`;

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.USER_AVATARS)
        .upload(path, file, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKETS.USER_AVATARS)
        .getPublicUrl(data.path);

      return {
        success: true,
        path: data.path,
        publicUrl: urlData.publicUrl,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Avatar upload failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured. Cannot upload avatar in production.' };
  }

  return {
    success: true,
    path,
    publicUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80`,
  };
}

/**
 * Uploads an agreement document or inspection photo to the rental-documents bucket
 * Scoped by agreement ID so both parties can access under RLS
 */
export async function uploadRentalDocument(
  file: Blob | ArrayBuffer | Uint8Array,
  agreementId: string,
  filename: string,
  mimeType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const size = file instanceof Blob ? file.size : file.byteLength;
  const validation = validateStorageFile(size, mimeType, 'rental-documents');
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const cleanFilename = cleanStorageFilename(filename);
  const path = `${agreementId}/${Date.now()}_${cleanFilename}`;

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.RENTAL_DOCUMENTS)
        .upload(path, file, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        path: data.path,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Document upload failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured. Cannot upload document in production.' };
  }

  return {
    success: true,
    path,
    publicUrl: `https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80`,
  };
}

/**
 * Uploads authenticated support evidence to a private, user-scoped folder.
 * The database stores only the object metadata; callers must use an
 * authenticated session because the storage policy intentionally rejects guests.
 */
export async function uploadSupportAttachment(
  file: Blob | ArrayBuffer | Uint8Array,
  userId: string,
  filename: string,
  mimeType: string
): Promise<StorageUploadResult> {
  const size = file instanceof Blob ? file.size : file.byteLength;
  const validation = validateStorageFile(size, mimeType, 'support-attachments');
  if (!validation.isValid) return { success: false, error: validation.error };

  const path = `${userId}/${Date.now()}_${cleanStorageFilename(filename)}`;

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.SUPPORT_ATTACHMENTS)
        .upload(path, file, { contentType: mimeType, upsert: false });

      if (error) return { success: false, error: error.message };
      return { success: true, path: data.path };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Support attachment upload failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured. Cannot upload evidence in production.' };
  }

  return { success: true, path };
}

/**
 * Deletes a property photo from storage.
 */
export async function deletePropertyPhoto(path: string): Promise<{ success: boolean; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKETS.PROPERTY_PHOTOS)
        .remove([path]);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Storage deletion failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured. Cannot delete file in production.' };
  }

  return { success: true };
}

/**
 * Generates a time-limited signed URL for reading objects from private Storage buckets.
 */
export async function createSignedStorageUrl(
  bucket: 'support-attachments' | 'rental-documents',
  path: string,
  expiresInSeconds: number = 300
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  if (!path || !path.trim()) {
    return { success: false, error: 'Storage path is required.' };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error) return { success: false, error: error.message };
      if (!data?.signedUrl) return { success: false, error: 'Signed URL generation returned no URL.' };
      return { success: true, signedUrl: data.signedUrl };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Signed URL failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Storage service is unconfigured in production.' };
  }

  return { success: true, signedUrl: `#local-preview/${bucket}/${path}` };
}

/**
 * Uploads media assets via the independent NestJS MediaModule presigned URLs.
 * Public buckets (property-photos, user-avatars) route to Cloudflare R2.
 * Private documents (rental-documents, support-attachments) route to encrypted AWS S3 Mumbai.
 */
export async function uploadMediaWithBackend(
  file: File,
  purpose: 'property-photos' | 'user-avatars' | 'rental-documents' | 'support-attachments'
): Promise<StorageUploadResult> {
  try {
    const presigned = await apiClient.post<{
      assetId: string;
      uploadUrl: string;
      publicUrl: string | null;
      storageBucket: string;
      storageKey: string;
    }>('/media/presigned-upload', {
      purpose,
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
    });

    await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    await apiClient.post('/media/confirm', { assetId: presigned.assetId });

    return {
      success: true,
      path: presigned.storageKey,
      publicUrl: presigned.publicUrl || undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Media upload failed';
    return { success: false, error: message };
  }
}
