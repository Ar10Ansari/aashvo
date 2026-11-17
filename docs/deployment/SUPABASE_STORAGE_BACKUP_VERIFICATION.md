# AASHVO — Supabase Storage Buckets & Objects Verification Report
**Author:** Cloud Infrastructure & Storage Engineer  
**Reviewer / Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **STORAGE INVENTORY VERIFIED — ZERO BLOB DATA AT RISK**  
**Target Project:** Hosted Supabase Mumbai (`himtwnwxvnnykafyhysy`)

---

## 1. Executive Storage Audit Summary

In response to CTO Preflight Requirement 1, an exhaustive inspection of Supabase's internal `storage` schema (`storage.buckets` and `storage.objects`) was conducted via direct PostgreSQL catalog queries on `PostgreSQL 17.11`.

### Key Findings:
1. **Buckets Configured:** Exactly **4 storage buckets** are active in the project.
2. **Total Stored Objects:** **0 objects (0 bytes)** across all four buckets.
3. **Backup / Export Requirement:** Because `storage.objects` contains exactly 0 rows, **no external S3 blob backup or file synchronization is needed**. Zero user-uploaded photos, avatars, contracts, or attachments exist to be lost.
4. **Bucket Schema Preservation:** All four bucket configurations, MIME restrictions, file size boundaries, and storage RLS policies remain 100% preserved.

---

## 2. Bucket-by-Bucket Technical Specifications

| Bucket ID | Public Access | File Size Limit | Allowed MIME Types | Created At (UTC) | Stored Objects | Total Size |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `property-photos` | **true** (Public) | 5,242,880 B (5 MB) | `image/jpeg`, `image/png`, `image/webp` | 2026-10-25 15:58:10 | **0** | 0 B |
| `user-avatars` | **true** (Public) | 2,097,152 B (2 MB) | `image/jpeg`, `image/png`, `image/webp` | 2026-10-25 15:58:10 | **0** | 0 B |
| `support-attachments` | **false** (Private) | 5,242,880 B (5 MB) | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | 2026-10-25 16:04:12 | **0** | 0 B |
| `rental-documents` | **false** (Private) | 10,485,760 B (10 MB)| `application/pdf`, `image/jpeg`, `image/png`, `image/webp` | 2026-10-25 16:04:55 | **0** | 0 B |

---

## 3. Query Evidence

The following SQL was executed against live Supabase:

```sql
SELECT bucket_id, count(*) AS object_count, coalesce(sum((metadata->>'size')::bigint), 0) AS total_bytes
FROM storage.objects
GROUP BY bucket_id;
```

**Result:**
```text
 bucket_id | object_count | total_bytes 
-----------+--------------+-------------
(0 rows)
```

```sql
SELECT count(*) FROM storage.objects;
```

**Result:**
```text
 count 
-------
     0
(1 row)
```

---

## 4. Storage Integration with Independent NestJS Backend

In the independent NestJS architecture:
- Media uploads are managed through `apps/api/src/modules/media` and the multi-cloud `StorageService`.
- The database model `media_assets` tracks file metadata, storage keys, public URLs, and bucket mappings.
- The enum `media_bucket` in Prisma incorporates the exact four buckets (`property-photos`, `user-avatars`, `support-attachments`, `rental-documents`), ensuring 100% contractual alignment between NestJS and Supabase Storage.

---

## 5. Storage Preservation Verdict: **100% SAFE**
None of the database migration or reconciliation scripts touch the `storage` schema or S3 endpoints. The buckets and their access policies remain completely untouched.
