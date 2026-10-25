import { describe, it, expect, beforeAll } from 'vitest';

declare function require(moduleName: string): any;
declare const Buffer: any;
const { execSync, execFileSync } = require('child_process');

const GOTRUE_URL = 'http://127.0.0.1:54321/auth/v1';
const POSTGREST_URL = 'http://127.0.0.1:54321/rest/v1';

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
    const b64Sql = Buffer.from(sql).toString('base64');
    const pyScript = `import psycopg2, base64; conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); conn.autocommit = True; cur = conn.cursor(); cur.execute('SET session_replication_role = replica;'); cur.execute(base64.b64decode("${b64Sql}").decode('utf-8')); conn.close()`;
    execFileSync('python', ['-c', pyScript], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
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



describe('Rental Trust & Protection End-to-End Suite (PostgREST & RLS)', () => {
  let isLocalStackRunning = false;
  const testId = Date.now();

  let landlord = {
    email: `landlord.trust.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let tenant = {
    email: `tenant.trust.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let intruder = {
    email: `intruder.trust.${testId}@aashvo.in`,
    password: 'StrongPassword123#',
    id: '',
    token: '',
  };

  let createdAgreementId = '';
  let createdPaymentId = '';

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

    // 1. Provision Landlord
    const resL = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: { email: landlord.email, password: landlord.password, data: { full_name: 'Verified Landlord' } },
    });
    landlord.id = resL.json?.user?.id || resL.json?.id;
    execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${landlord.id}'`);
    execLocalDb(`UPDATE public.profiles SET phone_verified = TRUE, email_verified = TRUE WHERE id = '${landlord.id}'`);
    const loginL = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
      method: 'POST',
      body: { email: landlord.email, password: landlord.password },
    });
    landlord.token = loginL.json?.access_token || '';

    // 2. Provision Tenant
    const resT = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: { email: tenant.email, password: tenant.password, data: { full_name: 'Verified Tenant' } },
    });
    tenant.id = resT.json?.user?.id || resT.json?.id;
    execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${tenant.id}'`);
    execLocalDb(`UPDATE public.profiles SET phone_verified = TRUE, email_verified = TRUE WHERE id = '${tenant.id}'`);
    const loginT = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
      method: 'POST',
      body: { email: tenant.email, password: tenant.password },
    });
    tenant.token = loginT.json?.access_token || '';

    // 3. Provision Intruder
    const resI = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: { email: intruder.email, password: intruder.password, data: { full_name: 'Third Party Intruder' } },
    });
    intruder.id = resI.json?.user?.id || resI.json?.id;
    execLocalDb(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${intruder.id}'`);
    const loginI = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
      method: 'POST',
      body: { email: intruder.email, password: intruder.password },
    });
    intruder.token = loginI.json?.access_token || '';
  });

  // ==========================================
  // FEATURE D: TENANCY AGREEMENTS
  // ==========================================

  it('RT1. Rejects agreement with matching landlord and tenant or invalid date range', async () => {
    if (!isLocalStackRunning || !landlord.token) return;

    // Matching landlord and tenant
    const selfRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${landlord.token}`,
        Prefer: 'return=representation',
      },
      body: {
        landlord_id: landlord.id,
        tenant_id: landlord.id, // Violation
        monthly_rent: 20000,
        security_deposit: 20000,
        start_date: '2026-08-01',
        end_date: '2027-07-31',
      },
    });

    expect(selfRes.status).toBe(400);
    expect(selfRes.text).toContain('distinct');

    // End date before start date
    const dateRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${landlord.token}`,
        Prefer: 'return=representation',
      },
      body: {
        landlord_id: landlord.id,
        tenant_id: tenant.id,
        monthly_rent: 20000,
        security_deposit: 20000,
        start_date: '2027-08-01',
        end_date: '2026-08-01', // Violation
      },
    });

    expect(dateRes.status).toBe(400);
    expect(dateRes.text).toContain('chk_tenancy_date_range');
  });

  it('RT2. Landlord creates valid agreement; parties can view; third-party is blocked by RLS', async () => {
    if (!isLocalStackRunning || !landlord.token || !tenant.token || !intruder.token) return;

    // Landlord creates agreement
    const createRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${landlord.token}`,
        Prefer: 'return=representation',
      },
      body: {
        landlord_id: landlord.id,
        tenant_id: tenant.id,
        monthly_rent: 24000,
        security_deposit: 24000,
        start_date: '2026-08-01',
        end_date: '2027-07-31',
        agreement_status: 'draft',
        terms_summary: '11-month lease with 1-month notice period',
      },
    });

    expect(createRes.status).toBe(201);
    createdAgreementId = createRes.json[0].id;
    expect(createdAgreementId).toBeTruthy();

    // Landlord can read
    const lRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements?id=eq.${createdAgreementId}`, {
      headers: { Authorization: `Bearer ${landlord.token}` },
    });
    expect(lRes.status).toBe(200);
    expect(lRes.json.length).toBe(1);

    // Tenant can read
    const tRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements?id=eq.${createdAgreementId}`, {
      headers: { Authorization: `Bearer ${tenant.token}` },
    });
    expect(tRes.status).toBe(200);
    expect(tRes.json.length).toBe(1);

    // Intruder cannot read (RLS yields empty array)
    const iRes = await httpRequest(`${POSTGREST_URL}/tenancy_agreements?id=eq.${createdAgreementId}`, {
      headers: { Authorization: `Bearer ${intruder.token}` },
    });
    expect(iRes.status).toBe(200);
    expect(iRes.json).toEqual([]);
  });

  // ==========================================
  // FEATURES A & C: PAYMENT LEDGER & FORGERY DEFENSE
  // ==========================================

  it('RT3. Tenant cannot self-confirm payments; landlord confirmation succeeds', async () => {
    if (!isLocalStackRunning || !tenant.token || !landlord.token || !createdAgreementId) return;

    // Tenant attempts to self-confirm payment
    const forgedPay = await httpRequest(`${POSTGREST_URL}/rent_payment_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        payer_id: tenant.id,
        recipient_id: landlord.id,
        amount: 24000,
        payment_category: 'rent',
        verification_status: 'confirmed_by_landlord', // FORGERY ATTEMPT
      },
    });

    expect(forgedPay.status).toBe(400);
    expect(forgedPay.text).toContain('Only the landlord or administrator can confirm rent payments');

    // Tenant records legitimate payment with pending confirmation
    const validPay = await httpRequest(`${POSTGREST_URL}/rent_payment_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        payer_id: tenant.id,
        recipient_id: landlord.id,
        amount: 24000,
        payment_category: 'rent',
        verification_status: 'pending_confirmation',
        transaction_reference: 'UPI-TEST-12345',
      },
    });

    expect(validPay.status).toBe(201);
    createdPaymentId = validPay.json[0].id;
    expect(createdPaymentId).toBeTruthy();

    // Landlord confirms payment
    const confirmRes = await httpRequest(`${POSTGREST_URL}/rent_payment_records?id=eq.${createdPaymentId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${landlord.token}`,
        Prefer: 'return=representation',
      },
      body: { verification_status: 'confirmed_by_landlord' },
    });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.json[0].verification_status).toBe('confirmed_by_landlord');
  });

  // ==========================================
  // FEATURE E: PROPERTY CONDITION INSPECTIONS
  // ==========================================

  it('RT4. Parties can log and acknowledge inspections; third-party is blocked by RLS', async () => {
    if (!isLocalStackRunning || !tenant.token || !landlord.token || !intruder.token || !createdAgreementId) return;

    // Intruder attempts to insert inspection on someone else's tenancy
    const intruderInsp = await httpRequest(`${POSTGREST_URL}/property_inspections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${intruder.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        inspection_type: 'move_in',
        conducted_by: intruder.id,
        room_name: 'Living Room',
        condition_rating: 'good',
      },
    });

    // PostgREST RLS blocks insert
    expect([400, 403]).toContain(intruderInsp.status);

    // Landlord logs Move-In Condition
    const validInsp = await httpRequest(`${POSTGREST_URL}/property_inspections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${landlord.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        inspection_type: 'move_in',
        conducted_by: landlord.id,
        room_name: 'Master Bedroom',
        condition_rating: 'pristine',
        damage_notes: 'All electrical fittings checked, freshly painted.',
      },
    });

    expect(validInsp.status).toBe(201);
    const inspId = validInsp.json[0].id;
    expect(inspId).toBeTruthy();

    // Tenant acknowledges condition log
    const ackRes = await httpRequest(`${POSTGREST_URL}/property_inspections?id=eq.${inspId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: { acknowledged_by_counterparty: true },
    });

    expect(ackRes.status).toBe(200);
    expect(ackRes.json[0].acknowledged_by_counterparty).toBe(true);
  });

  // ==========================================
  // FEATURE B: TWO-SIDED REPUTATION & DUPLICATE PREVENTION
  // ==========================================

  it('RT5. Reviews barred on draft agreements; allowed once active; duplicate review rejected', async () => {
    if (!isLocalStackRunning || !tenant.token || !landlord.token || !createdAgreementId) return;

    // Attempt review on draft agreement
    const draftReview = await httpRequest(`${POSTGREST_URL}/tenancy_reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        reviewer_id: tenant.id,
        reviewee_id: landlord.id,
        reviewer_role: 'tenant',
        communication_rating: 5,
        maintenance_rating: 5,
        property_care_rating: 5,
        agreement_clarity_rating: 5,
        review_title: 'Too early',
        review_content: 'Agreement is still in draft mode.',
      },
    });

    expect(draftReview.status).toBe(400);
    expect(draftReview.text).toContain('Reviews cannot be submitted for draft agreements');

    // Landlord activates agreement
    await httpRequest(`${POSTGREST_URL}/tenancy_agreements?id=eq.${createdAgreementId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${landlord.token}` },
      body: { agreement_status: 'active' },
    });

    // Tenant submits authentic review
    const validRev = await httpRequest(`${POSTGREST_URL}/tenancy_reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        reviewer_id: tenant.id,
        reviewee_id: landlord.id,
        reviewer_role: 'tenant',
        communication_rating: 5,
        maintenance_rating: 5,
        property_care_rating: 5,
        agreement_clarity_rating: 5,
        review_title: 'Outstanding Landlord',
        review_content: 'Extremely professional and respectful of tenant privacy.',
      },
    });

    expect(validRev.status).toBe(201);
    expect(validRev.json[0].overall_rating).toBe(5);

    // Duplicate review attempt for same agreement
    const duplicateRev = await httpRequest(`${POSTGREST_URL}/tenancy_reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        reviewer_id: tenant.id,
        reviewee_id: landlord.id,
        reviewer_role: 'tenant',
        communication_rating: 4,
        maintenance_rating: 4,
        property_care_rating: 4,
        agreement_clarity_rating: 4,
        review_title: 'Duplicate Review Attempt',
        review_content: 'Trying to review again.',
      },
    });

    expect([400, 409]).toContain(duplicateRev.status);
    expect(duplicateRev.text).toContain('chk_unique_agreement_reviewer');
  });

  // ==========================================
  // FEATURE F: RENTAL DISPUTE MANAGEMENT
  // ==========================================

  it('RT6. Tenancy party files dispute with auto-generated case ID; non-party is blocked by RLS', async () => {
    if (!isLocalStackRunning || !tenant.token || !landlord.token || !intruder.token || !createdAgreementId) return;

    // Tenant files dispute
    const disputeRes = await httpRequest(`${POSTGREST_URL}/rental_disputes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.token}`,
        Prefer: 'return=representation',
      },
      body: {
        agreement_id: createdAgreementId,
        initiator_id: tenant.id,
        respondent_id: landlord.id,
        dispute_type: 'security_deposit',
        disputed_amount: 12000,
        title: 'Disputed Painting Deduction',
        description: 'Landlord proposed Rs 12,000 deduction for painting despite move-in log showing pristine condition.',
      },
    });

    expect(disputeRes.status).toBe(201);
    const dispute = disputeRes.json[0];
    expect(dispute.dispute_number).toMatch(/^ASH-DSP-/);
    expect(dispute.status).toBe('open');

    // Respondent (Landlord) can view dispute
    const lDispRes = await httpRequest(`${POSTGREST_URL}/rental_disputes?id=eq.${dispute.id}`, {
      headers: { Authorization: `Bearer ${landlord.token}` },
    });
    expect(lDispRes.status).toBe(200);
    expect(lDispRes.json.length).toBe(1);

    // Intruder cannot view dispute (RLS blocks)
    const iDispRes = await httpRequest(`${POSTGREST_URL}/rental_disputes?id=eq.${dispute.id}`, {
      headers: { Authorization: `Bearer ${intruder.token}` },
    });
    expect(iDispRes.status).toBe(200);
    expect(iDispRes.json).toEqual([]);
  });

  // ==========================================
  // FEATURE G: STORAGE COUNTERPARTY ACCESS
  // ==========================================

  it('RT7. Scoped storage policy allows tenant counterparty read access while denying intruder', async () => {
    if (!isLocalStackRunning || !tenant.id || !landlord.id || !intruder.id || !createdAgreementId) return;

    // Simulate landlord uploading document to agreement folder
    const testDocName = `${createdAgreementId}/move_in_evidence_${Date.now()}.jpg`;
    execLocalDb(`
      INSERT INTO storage.objects (id, bucket_id, name, owner)
      VALUES (gen_random_uuid(), 'rental-documents', '${testDocName}', '${landlord.id}');
    `);

    // Verify tenant can view the object under RLS
    const pyTenant = `
import psycopg2, json
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()
cur.execute("SET LOCAL ROLE authenticated;")
cur.execute("SELECT set_config('request.jwt.claims', %s, true);", (json.dumps({'sub': '${tenant.id}', 'role': 'authenticated'}),))
cur.execute("SELECT name FROM storage.objects WHERE bucket_id = 'rental-documents' AND name = %s;", ('${testDocName}',))
rows = cur.fetchall()
print(len(rows))
conn.close()
`;
    const tenantOut = execFileSync('python', ['-c', pyTenant], { encoding: 'utf-8' });
    expect(parseInt(tenantOut.trim(), 10)).toBe(1);

    // Verify intruder CANNOT view the object under RLS
    const pyIntruder = `
import psycopg2, json
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()
cur.execute("SET LOCAL ROLE authenticated;")
cur.execute("SELECT set_config('request.jwt.claims', %s, true);", (json.dumps({'sub': '${intruder.id}', 'role': 'authenticated'}),))
cur.execute("SELECT name FROM storage.objects WHERE bucket_id = 'rental-documents' AND name = %s;", ('${testDocName}',))
rows = cur.fetchall()
print(len(rows))
conn.close()
`;
    const intruderOut = execFileSync('python', ['-c', pyIntruder], { encoding: 'utf-8' });
    expect(parseInt(intruderOut.trim(), 10)).toBe(0);
  });
});
