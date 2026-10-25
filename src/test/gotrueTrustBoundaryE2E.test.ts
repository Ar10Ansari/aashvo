import { describe, it, expect, beforeAll } from 'vitest';
declare function require(moduleName: string): any;
const { execSync } = require('child_process');

const GOTRUE_URL = 'http://127.0.0.1:54321/auth/v1';
const MAILPIT_URL = 'http://127.0.0.1:54324/api/v1';
const POSTGREST_URL = 'http://127.0.0.1:54321/rest/v1';

// Helper for HTTP requests
async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    redirect?: RequestRedirect;
  } = {}
) {
  const headers: Record<string, string> = {
    ...options.headers,
  };

  let bodyStr: string | undefined = undefined;
  if (options.body) {
    if (typeof options.body === 'object') {
      bodyStr = JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else {
      bodyStr = String(options.body);
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
    redirect: options.redirect || 'manual',
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

// Fast helper to query local database safely via psycopg2 with CLI fallback
function queryLocalDb(sql: string): any[] {
  // Try fast python connector first (50ms)
  try {
    const escapedSql = sql.replace(/'/g, "\\'");
    const pyScript = `import psycopg2, json; conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur = conn.cursor(); cur.execute('''${escapedSql}'''); cols = [d[0] for d in cur.description] if cur.description else []; rows = [dict(zip(cols, r)) for r in cur.fetchall()] if cur.description else []; print(json.dumps(rows, default=str)); conn.close()`;
    const pyOutput = execSync(`python -c "${pyScript}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return JSON.parse(pyOutput.trim()) || [];
  } catch {
    // Fallback to npx supabase db query
    try {
      const escapedSql = sql.replace(/"/g, '\\"');
      const output = execSync(`npx supabase db query --local "${escapedSql}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const jsonStart = output.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(output.slice(jsonStart));
        return parsed.rows || [];
      }
      return [];
    } catch (err) {
      console.warn('Direct DB query error:', err);
      return [];
    }
  }
}

describe('Automated Local GoTrue HTTP & PostgREST Trust-Boundary Suite', () => {
  let isLocalStackRunning = false;
  const testId = Date.now();
  const initialEmail = `gotrue.e2e.${testId}@aashvo.in`;
  const changedEmail = `gotrue.confirmed.${testId}@aashvo.in`;
  const password = 'StrongPassword123#';
  let userId = '';
  let accessToken = '';

  beforeAll(async () => {
    try {
      const health = await httpRequest(`${GOTRUE_URL}/health`);
      if (health.status === 200 && health.json?.name === 'GoTrue') {
        isLocalStackRunning = true;
      }
    } catch {
      isLocalStackRunning = false;
    }
  });

  it('verifies the local Supabase GoTrue and Mailpit stack is live and responsive', async () => {
    if (!isLocalStackRunning) {
      console.warn('Skipping: Local Supabase GoTrue stack is not reachable on port 54321.');
      return;
    }

    const health = await httpRequest(`${GOTRUE_URL}/health`);
    expect(health.status).toBe(200);
    expect(health.json.name).toBe('GoTrue');

    const mailpit = await httpRequest(`${MAILPIT_URL}/messages`);
    expect(mailpit.status).toBe(200);
    expect(Array.isArray(mailpit.json.messages)).toBe(true);
  }, 10000);

  it('registers a new user via genuine GoTrue HTTP API and provisions public.profiles automatically', async () => {
    if (!isLocalStackRunning) return;

    const signupRes = await httpRequest(`${GOTRUE_URL}/signup`, {
      method: 'POST',
      body: {
        email: initialEmail,
        password: password,
        data: {
          full_name: 'GoTrue E2E User',
        },
      },
    });

    expect(signupRes.status).toBe(200);
    expect(signupRes.json.user).toBeDefined();
    expect(signupRes.json.user.email).toBe(initialEmail);
    expect(signupRes.json.access_token).toBeDefined();

    userId = signupRes.json.user.id;
    accessToken = signupRes.json.access_token;
    expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Verify profile provisioning via PostgREST with the authenticated JWT
    const profileRes = await httpRequest(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(profileRes.status).toBe(200);
    expect(profileRes.json.length).toBe(1);
    const profile = profileRes.json[0];
    expect(profile.id).toBe(userId);
    expect(profile.email).toBe(initialEmail);
    expect(profile.full_name).toBe('GoTrue E2E User');
    expect(profile.role).toBe('renter'); // Default role strictly enforced
    expect(profile.phone_verified).toBe(false);
    expect(profile.id_verified).toBe(false);
  }, 10000);

  it('executes email change verification through Mailpit and verifies synchronized profile status', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    // 1. Clear existing Mailpit messages to isolate test
    await httpRequest(`${MAILPIT_URL}/messages`, { method: 'DELETE' });

    // 2. Request email change via GoTrue API
    const updateRes = await httpRequest(`${GOTRUE_URL}/user`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        email: changedEmail,
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.json.new_email).toBe(changedEmail);

    // 3. Retrieve dispatched confirmation emails from Mailpit
    await new Promise((r) => setTimeout(r, 600));

    const mailRes = await httpRequest(`${MAILPIT_URL}/messages`);
    expect(mailRes.status).toBe(200);
    expect(mailRes.json.total).toBeGreaterThanOrEqual(1);

    // Find message containing email change token
    let confirmationUrl = '';
    for (const msg of mailRes.json.messages) {
      const msgDetail = await httpRequest(`${MAILPIT_URL}/message/${msg.ID}`);
      const text = msgDetail.json.Text || '';
      const match = text.match(/http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s\)]+/);
      if (match) {
        confirmationUrl = match[0];
        break;
      }
    }

    expect(confirmationUrl).toContain('type=email_change');
    expect(confirmationUrl).toContain('token=');

    // 4. Follow confirmation URL via GoTrue verify endpoint
    const verifyRes = await httpRequest(confirmationUrl, {
      method: 'GET',
      redirect: 'manual',
    });

    // GoTrue responds with 303 redirect to site_url with access_token fragment
    expect([302, 303]).toContain(verifyRes.status);
    const location = verifyRes.headers.get('location') || '';
    expect(location).toContain('access_token=');
    expect(location).toContain('type=email_change');

    // 5. Verify database profile synchronization
    const rows = queryLocalDb(
      `SELECT email, email_verified, role FROM public.profiles WHERE id = '${userId}';`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(changedEmail);
    expect(rows[0].email_verified).toBe(true);
    expect(rows[0].role).toBe('renter');
  }, 15000);

  it('authenticates via GoTrue password sign-in and obtains valid user session', async () => {
    if (!isLocalStackRunning) return;

    const loginRes = await httpRequest(`${GOTRUE_URL}/token?grant_type=password`, {
      method: 'POST',
      body: {
        email: changedEmail,
        password: password,
      },
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.json.access_token).toBeDefined();
    expect(loginRes.json.user.id).toBe(userId);
    accessToken = loginRes.json.access_token;
  }, 10000);

  it('proves that authenticated client CANNOT escalate role to admin via PostgREST PATCH', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    const escalateRes = await httpRequest(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        role: 'admin',
      },
    });

    expect(escalateRes.status).toBe(400);
    expect(escalateRes.json.code).toBe('P0001');
    expect(escalateRes.json.message).toContain('Privilege escalation rejected: only administrators can alter account roles');

    const rows = queryLocalDb(`SELECT role FROM public.profiles WHERE id = '${userId}';`);
    expect(rows[0].role).toBe('renter');
  }, 10000);

  it('proves that authenticated client CANNOT forge phone_verified or id_verified via PostgREST PATCH', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    // 1. Attempt phone_verified forgery
    const phoneRes = await httpRequest(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        phone_verified: true,
      },
    });

    expect(phoneRes.status).toBe(400);
    expect(phoneRes.json.code).toBe('P0001');
    expect(phoneRes.json.message).toContain('Privilege escalation rejected: verification status cannot be mutated');

    // 2. Attempt id_verified forgery
    const idRes = await httpRequest(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        id_verified: true,
      },
    });

    expect(idRes.status).toBe(400);
    expect(idRes.json.code).toBe('P0001');
    expect(idRes.json.message).toContain('Privilege escalation rejected: verification status cannot be mutated');

    // Verify flags remained FALSE
    const rows = queryLocalDb(
      `SELECT phone_verified, id_verified FROM public.profiles WHERE id = '${userId}';`
    );
    expect(rows[0].phone_verified).toBe(false);
    expect(rows[0].id_verified).toBe(false);
  }, 10000);

  it('proves that authenticated client CANNOT forge verification badges via direct PostgREST INSERT', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    const fakeUserId = '99999999-9999-9999-9999-999999999999';
    const insertRes = await httpRequest(`${POSTGREST_URL}/profiles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        id: fakeUserId,
        email: 'forged.admin@aashvo.in',
        full_name: 'Forged Admin',
        role: 'admin',
        phone_verified: true,
        id_verified: true,
        email_verified: true,
      },
    });

    expect(insertRes.status).toBe(400);
    expect(insertRes.json.code).toBe('P0001');
    expect(insertRes.json.message).toContain('Privilege escalation rejected');
  }, 10000);

  it('enforces host phone verification prerequisite when creating listings via PostgREST', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    const listingRes = await httpRequest(`${POSTGREST_URL}/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        owner_id: userId,
        title: 'Direct API Property',
        description: 'Attempting listing creation without phone verification',
        locality: 'DLF Phase 5',
        city: 'Gurugram',
        address_short: 'Golf Course Road',
        rent_amount: 30000,
        deposit_amount: 30000,
        status: 'active',
      },
    });

    expect(listingRes.status).toBe(400);
    expect(listingRes.json.code).toBe('P0001');
    expect(listingRes.json.message).toContain('Host phone verification required');
  }, 10000);

  it('enforces RLS isolation preventing authenticated clients from viewing other users private profiles', async () => {
    if (!isLocalStackRunning || !accessToken) return;

    const otherProfileRes = await httpRequest(
      `${POSTGREST_URL}/profiles?id=neq.${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(otherProfileRes.status).toBe(200);
    expect(otherProfileRes.json).toEqual([]);
  }, 10000);

  it('verifies actual PostgreSQL session identities captured in _auth_trigger_audit during GoTrue operations', async () => {
    if (!isLocalStackRunning || !userId) return;

    const rows = queryLocalDb(
      `SELECT captured_session_user, captured_current_user, is_gotrue_api FROM public._auth_trigger_audit WHERE auth_user_id = '${userId}' ORDER BY id DESC LIMIT 5;`
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.captured_session_user).toBe('supabase_auth_admin');
      expect(row.captured_current_user).toBe('postgres');
      expect(row.is_gotrue_api).toBe(true);
    }
  }, 10000);
});
