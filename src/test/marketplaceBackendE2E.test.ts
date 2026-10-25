import { describe, it, expect, beforeAll } from 'vitest';
import { validateStorageFile } from '../services/storageService';

declare function require(moduleName: string): any;
const { execSync } = require('child_process');

const GOTRUE_URL = 'http://127.0.0.1:54321/auth/v1';
const POSTGREST_URL = 'http://127.0.0.1:54321/rest/v1';
const STORAGE_URL = 'http://127.0.0.1:54321/storage/v1';

async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
) {
  const headers: Record<string, string> = {
    ...options.headers,
  };

  let body: any = undefined;
  if (options.body) {
    if (typeof options.body === 'object' && !(options.body instanceof Uint8Array) && !(options.body instanceof ArrayBuffer)) {
      body = JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else {
      body = options.body;
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
  };
}


function execLocalDb(sql: string): void {
  try {
    const escapedSql = sql.replace(/'/g, "\\'");
    const pyScript = `import psycopg2; conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); conn.autocommit = True; cur = conn.cursor(); cur.execute('SET session_replication_role = replica;'); cur.execute('''${escapedSql}'''); conn.close()`;
    execSync(`python -c "${pyScript}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch (err) {
    try {
      const escapedSql = `SET session_replication_role = replica; ${sql}`.replace(/"/g, '\\"');
      execSync(`npx supabase db query --local "${escapedSql}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch (fallbackErr) {
      console.warn('DB Exec Error:', fallbackErr);
    }
  }
}

describe('Marketplace Backend End-to-End Suite (Journeys B, C, D, E)', () => {
  let isLocalStackRunning = false;
  const testId = Date.now();

  let userA = {
    email: `host.a.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let userB = {
    email: `intruder.b.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let userC = {
    email: `renter.c.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let createdPropertyId = '';

  beforeAll(async () => {
    try {
      const healthRes = await httpRequest(`${GOTRUE_URL}/health`);
      if (healthRes.status === 200) {
        isLocalStackRunning = true;
      }
    } catch {
      isLocalStackRunning = false;
    }

    if (!isLocalStackRunning) {
      console.warn('Local Supabase stack not accessible. Tests will skip safely.');
      return;
    }

    // Provision User A (Host)
    const resA = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: {
        email: userA.email,
        password: userA.password,
        data: { full_name: 'Verified Host A' },
      },
    });
    userA.id = resA.json?.user?.id || resA.json?.id;
    userA.token = resA.json?.access_token || '';

    // If signup didn't return token (confirmation required), sign in
    if (!userA.token) {
      // Confirm email in auth.users directly for test isolation
      execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${userA.id}'`);
      const loginA = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
        method: 'POST',
        body: { email: userA.email, password: userA.password },
      });
      userA.token = loginA.json?.access_token;
    }

    // Provision User B (Intruder / Other User)
    const resB = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: {
        email: userB.email,
        password: userB.password,
        data: { full_name: 'Other User B' },
      },
    });
    userB.id = resB.json?.user?.id || resB.json?.id;
    userB.token = resB.json?.access_token || '';

    if (!userB.token) {
      execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${userB.id}'`);
      const loginB = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
        method: 'POST',
        body: { email: userB.email, password: userB.password },
      });
      userB.token = loginB.json?.access_token;
    }

    // Provision User C (Renter)
    const resC = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: {
        email: userC.email,
        password: userC.password,
        data: { full_name: 'Renter C' },
      },
    });
    userC.id = resC.json?.user?.id || resC.json?.id;
    userC.token = resC.json?.access_token || '';

    if (!userC.token) {
      execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${userC.id}'`);
      const loginC = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
        method: 'POST',
        body: { email: userC.email, password: userC.password },
      });
      userC.token = loginC.json?.access_token;
    }
  });

  // ==========================================
  // JOURNEY D: STORAGE VALIDATION & SECURITY
  // ==========================================

  it('D1. Client validation enforces file size limits and MIME types', () => {
    // 5MB limit for property photos
    const validPhoto = validateStorageFile(4 * 1024 * 1024, 'image/jpeg', 'property-photos');
    expect(validPhoto.isValid).toBe(true);

    const oversizedPhoto = validateStorageFile(6 * 1024 * 1024, 'image/jpeg', 'property-photos');
    expect(oversizedPhoto.isValid).toBe(false);
    expect(oversizedPhoto.error).toContain('5MB');

    // 2MB limit for user avatars
    const oversizedAvatar = validateStorageFile(3 * 1024 * 1024, 'image/png', 'user-avatars');
    expect(oversizedAvatar.isValid).toBe(false);
    expect(oversizedAvatar.error).toContain('2MB');

    // Disallowed MIME types
    const invalidMime = validateStorageFile(1024, 'application/x-msdownload', 'property-photos');
    expect(invalidMime.isValid).toBe(false);
    expect(invalidMime.error).toContain('not permitted');
  });

  it('D2. Authenticated user can upload a photo to their isolated folder and retrieve it publicly', async () => {
    if (!isLocalStackRunning || !userA.token) return;

    const fakePhotoData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const uploadPath = `${userA.id}/test_bedroom_${testId}.jpg`;

    const uploadRes = await httpRequest(`${STORAGE_URL}/object/property-photos/${uploadPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'image/jpeg',
      },
      body: fakePhotoData,
    });

    expect([200, 201]).toContain(uploadRes.status);

    // Verify public read access without authorization headers
    const publicUrl = `${STORAGE_URL}/object/public/property-photos/${uploadPath}`;
    const getRes = await httpRequest(publicUrl);
    expect(getRes.status).toBe(200);
  });

  it('D3. Storage RLS blocks cross-user uploads and deletions (Folder Isolation)', async () => {
    if (!isLocalStackRunning || !userA.token || !userB.token) return;

    // User B attempts to upload into User A's folder
    const maliciousUploadPath = `${userA.id}/malicious_${testId}.jpg`;
    const fakePhotoData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    const uploadRes = await httpRequest(`${STORAGE_URL}/object/property-photos/${maliciousUploadPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userB.token}`, // User B token
        'Content-Type': 'image/jpeg',
      },
      body: fakePhotoData,
    });

    // Supabase Storage returns 400 or 403 on RLS violation
    expect([400, 403]).toContain(uploadRes.status);

    // User B attempts to delete User A's uploaded file
    const targetPath = `${userA.id}/test_bedroom_${testId}.jpg`;
    const deleteRes = await httpRequest(`${STORAGE_URL}/object/property-photos/${targetPath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userB.token}`,
      },
    });

    // Storage policy prevents non-owner from deleting
    expect([400, 403, 404]).toContain(deleteRes.status);

    // Owner (User A) deletes own photo: succeeds
    const ownerDeleteRes = await httpRequest(`${STORAGE_URL}/object/property-photos/${targetPath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userA.token}`,
      },
    });
    expect([200, 204]).toContain(ownerDeleteRes.status);
  });

  // ==========================================
  // JOURNEY B: LISTING LIFECYCLE & PREREQUISITES
  // ==========================================

  it('B1. Unverified host cannot create a listing (Phone Verification Prerequisite)', async () => {
    if (!isLocalStackRunning || !userA.token) return;

    // Ensure phone_verified is false on host profile
    execLocalDb(`UPDATE public.profiles SET phone_verified = FALSE WHERE id = '${userA.id}'`);

    const propertyPayload = {
      owner_id: userA.id,
      title: 'Unverified Host Listing Attempt',
      description: 'Spacious room in South Extension',
      locality: 'South Extension II',
      city: 'New Delhi',
      address_short: 'Block M, South Ext II',
      rent_amount: 18000,
      deposit_amount: 18000,
      category: 'flats_rooms',
      property_type: 'apartment',
      room_type: 'private_room',
      furnishing: 'fully_furnished',
    };

    const res = await httpRequest(`${POSTGREST_URL}/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Prefer: 'return=representation',
      },
      body: propertyPayload,
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Host phone verification required');
  });

  it('B2. Family Stay eligibility constraint rejects non-resident landlords', async () => {
    if (!isLocalStackRunning || !userA.token) return;

    // Mark host phone verified via internal database
    execLocalDb(`UPDATE public.profiles SET phone_verified = TRUE, email_verified = TRUE WHERE id = '${userA.id}'`);

    // Ineligible Family Stay: host does NOT live on property
    const invalidFamilyStay = {
      owner_id: userA.id,
      title: 'Commercial Family Stay Bypass Attempt',
      description: 'Run by absent landlord',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      address_short: '100ft Road, Indiranagar',
      rent_amount: 22000,
      deposit_amount: 22000,
      category: 'family_stays',
      family_lives_on_property: false, // VIOLATION
      provider_type: 'owner',
      meals_offered: 'included',
      property_type: 'apartment',
      room_type: 'private_room',
      furnishing: 'fully_furnished',
    };

    const res = await httpRequest(`${POSTGREST_URL}/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Prefer: 'return=representation',
      },
      body: invalidFamilyStay,
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('chk_family_stay_eligibility');
  });

  it('B3. Valid listing creation forces status to pending_review (Anti-Bypass Trigger)', async () => {
    if (!isLocalStackRunning || !userA.token) return;

    // Eligible Family Stay
    const validListing = {
      owner_id: userA.id,
      title: 'Warm Family Homestay Near Cyber Hub',
      description: 'Host family lives on the second floor. Homecooked vegetarian dinners.',
      locality: 'DLF Phase 2',
      city: 'Gurugram',
      address_short: 'Near Cyber Hub Metro',
      rent_amount: 25000,
      deposit_amount: 25000,
      category: 'family_stays',
      family_lives_on_property: true,
      provider_type: 'owner',
      meals_offered: 'included',
      property_type: 'apartment',
      room_type: 'private_room',
      furnishing: 'fully_furnished',
      status: 'active', // ATTEMPT TO BYPASS EDITORIAL REVIEW
    };

    const res = await httpRequest(`${POSTGREST_URL}/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Prefer: 'return=representation',
      },
      body: validListing,
    });

    expect(res.status).toBe(201);
    expect(res.json).toBeInstanceOf(Array);
    const created = res.json[0];
    createdPropertyId = created.id;
    expect(created.id).toBeTruthy();
    // Verification: status MUST be overridden to pending_review
    expect(created.status).toBe('pending_review');
  });

  // ==========================================
  // JOURNEY C: SEARCH, DISCOVERY & PRIVACY VIEW
  // ==========================================

  it('C1. Public discovery view masks private address and hides pending listings', async () => {
    if (!isLocalStackRunning || !createdPropertyId) return;

    // 1. While status is pending_review, public_properties view should NOT return it
    const pendingRes = await httpRequest(`${POSTGREST_URL}/public_properties?id=eq.${createdPropertyId}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.json).toEqual([]);

    // 2. Simulate editorial approval via DB
    execLocalDb(`UPDATE public.properties SET status = 'active' WHERE id = '${createdPropertyId}'`);

    // 3. Now public view returns it, with private fields omitted
    const activeRes = await httpRequest(`${POSTGREST_URL}/public_properties?id=eq.${createdPropertyId}`);
    expect(activeRes.status).toBe(200);
    expect(activeRes.json.length).toBe(1);

    const publicListing = activeRes.json[0];
    expect(publicListing.city).toBe('Gurugram');
    expect(publicListing.locality).toBe('DLF Phase 2');
    expect(publicListing.meals_offered).toBe('included');
    // Ensure exact address fields are NOT exposed
    expect(publicListing.address_line_1).toBeUndefined();
    expect(publicListing.address_line_2).toBeUndefined();
    expect(publicListing.flat_number).toBeUndefined();
  });

  // ==========================================
  // JOURNEY B (CONT): UPDATE & DELETE AUTHORIZATION
  // ==========================================

  it('B4. Owner can update listing, non-owner is blocked by RLS', async () => {
    if (!isLocalStackRunning || !userA.token || !userB.token || !createdPropertyId) return;

    // Non-owner (User B) attempts to tamper with User A's property rent
    const tamperRes = await httpRequest(`${POSTGREST_URL}/properties?id=eq.${createdPropertyId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userB.token}`,
        Prefer: 'return=representation',
      },
      body: { rent_amount: 1000 },
    });

    // PostgREST returns 200 with [] or 404 because RLS filter prevents matching row
    if (tamperRes.status === 200) {
      expect(tamperRes.json).toEqual([]);
    }

    // Owner (User A) updates rent to 24000
    const ownerUpdateRes = await httpRequest(`${POSTGREST_URL}/properties?id=eq.${createdPropertyId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Prefer: 'return=representation',
      },
      body: { rent_amount: 24000 },
    });

    expect(ownerUpdateRes.status).toBe(200);
    expect(ownerUpdateRes.json[0].rent_amount).toBe(24000);
  });

  // ==========================================
  // JOURNEY E: INQUIRIES & CONTACT PRIVACY
  // ==========================================

  it('E1. Unverified renter cannot submit an inquiry (Verification Gate)', async () => {
    if (!isLocalStackRunning || !userC.token || !createdPropertyId) return;

    // Ensure User C is unverified
    execLocalDb(`UPDATE public.profiles SET email_verified = FALSE, phone_verified = FALSE WHERE id = '${userC.id}'`);

    const inquiryPayload = {
      property_id: createdPropertyId,
      sender_id: userC.id,
      sender_name: 'Unverified Renter',
      sender_email: userC.email,
      sender_phone: '9876543210',
      message: 'I want to rent this property.',
      move_in_date: 'Next week',
      status: 'pending',
    };

    const res = await httpRequest(`${POSTGREST_URL}/interest_requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userC.token}`,
        Prefer: 'return=representation',
      },
      body: inquiryPayload,
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Unverified email');
  });

  it('E2. Verified renter submits inquiry; owner can view; non-owner is blocked by RLS', async () => {
    if (!isLocalStackRunning || !userA.token || !userB.token || !userC.token || !createdPropertyId) return;

    // Mark renter verified
    execLocalDb(`UPDATE public.profiles SET email_verified = TRUE, phone_verified = TRUE WHERE id = '${userC.id}'`);

    const validInquiry = {
      property_id: createdPropertyId,
      sender_id: userC.id,
      sender_name: 'Verified Renter C',
      sender_email: userC.email,
      sender_phone: '+91 9876543210',
      message: 'Hello, I am interested in your family stay room.',
      move_in_date: 'Immediately',
      status: 'pending',
    };

    const postRes = await httpRequest(`${POSTGREST_URL}/interest_requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userC.token}`,
        Prefer: 'return=representation',
      },
      body: validInquiry,
    });

    expect(postRes.status).toBe(201);
    const inquiryId = postRes.json[0].id;
    expect(inquiryId).toBeTruthy();

    // Owner (User A) reads inquiries for their property
    const ownerReadRes = await httpRequest(`${POSTGREST_URL}/interest_requests?property_id=eq.${createdPropertyId}`, {
      headers: {
        Authorization: `Bearer ${userA.token}`,
      },
    });

    expect(ownerReadRes.status).toBe(200);
    expect(ownerReadRes.json.length).toBeGreaterThanOrEqual(1);
    expect(ownerReadRes.json[0].sender_id).toBe(userC.id);

    // Unrelated third-party (User B) attempts to read inquiries for User A's property
    const intruderReadRes = await httpRequest(`${POSTGREST_URL}/interest_requests?property_id=eq.${createdPropertyId}`, {
      headers: {
        Authorization: `Bearer ${userB.token}`,
      },
    });

    expect(intruderReadRes.status).toBe(200);
    // RLS policy prevents User B from seeing inquiries sent to User A
    expect(intruderReadRes.json).toEqual([]);
  });

  // ==========================================
  // JOURNEY B (CLEANUP): OWNER DELETES LISTING
  // ==========================================

  it('B5. Non-owner cannot delete listing; owner can delete listing', async () => {
    if (!isLocalStackRunning || !userA.token || !userB.token || !createdPropertyId) return;

    // Non-owner User B attempts to delete
    const nonOwnerDelete = await httpRequest(`${POSTGREST_URL}/properties?id=eq.${createdPropertyId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userB.token}`,
        Prefer: 'return=representation',
      },
    });

    if (nonOwnerDelete.status === 200) {
      expect(nonOwnerDelete.json).toEqual([]);
    }

    // Owner User A deletes
    const ownerDelete = await httpRequest(`${POSTGREST_URL}/properties?id=eq.${createdPropertyId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Prefer: 'return=representation',
      },
    });

    expect(ownerDelete.status).toBe(200);
    expect(ownerDelete.json[0].id).toBe(createdPropertyId);
  });
});
