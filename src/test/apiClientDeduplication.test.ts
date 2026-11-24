import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../services/apiClient';

describe('ApiClient Single-Flight Request Deduplication Hardening', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    apiClient.clearSession();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent identical GET requests into a single network call', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ success: true, count: callCount }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const [res1, res2] = await Promise.all([
      apiClient.request<{ success: boolean; count: number }>('/properties'),
      apiClient.request<{ success: boolean; count: number }>('/properties'),
    ]);

    expect(callCount).toBe(1);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('canonicalizes query parameter ordering so identical queries share a single request', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ items: ['prop1', 'prop2'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const [res1, res2] = await Promise.all([
      apiClient.request('/properties?city=Delhi&sort=rent&limit=10'),
      apiClient.request('/properties?sort=rent&limit=10&city=Delhi'),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(res2);
  });

  it('does NOT deduplicate requests with different authorization contexts', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ user: 'authenticated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Request 1: with Bearer token A
    const req1 = apiClient.request('/user/me', {
      headers: { Authorization: 'Bearer token-user-A' },
    });

    // Request 2: with Bearer token B
    const req2 = apiClient.request('/user/me', {
      headers: { Authorization: 'Bearer token-user-B' },
    });

    await Promise.all([req1, req2]);
    expect(callCount).toBe(2);
  });

  it('does NOT deduplicate requests with different custom response-affecting headers', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ version: 'v1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const req1 = apiClient.request('/properties', {
      headers: { 'Accept-Language': 'en-US' },
    });
    const req2 = apiClient.request('/properties', {
      headers: { 'Accept-Language': 'hi-IN' },
    });

    await Promise.all([req1, req2]);
    expect(callCount).toBe(2);
  });

  it('does NOT deduplicate non-GET requests (e.g. POST, PUT)', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const [res1, res2] = await Promise.all([
      apiClient.request('/messages', { method: 'POST', body: JSON.stringify({ text: 'hi' }) }),
      apiClient.request('/messages', { method: 'POST', body: JSON.stringify({ text: 'hi' }) }),
    ]);

    expect(callCount).toBe(2);
    expect(res1).toEqual({ created: true });
    expect(res2).toEqual({ created: true });
  });

  it('does NOT allow one caller’s AbortSignal to cancel another concurrent caller’s request', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return new Response(JSON.stringify({ data: 'resilient' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const abortController = new AbortController();

    // Caller A attaches an AbortSignal and will abort early
    const callerAPromise = apiClient.request<{ data: string }>('/protected-data', {
      signal: abortController.signal,
    });

    // Caller B shares the request without aborting
    const callerBPromise = apiClient.request<{ data: string }>('/protected-data');

    // Abort caller A after 15ms
    setTimeout(() => {
      abortController.abort();
    }, 15);

    // Caller A must reject with AbortError
    await expect(callerAPromise).rejects.toThrow();

    // Caller B must succeed independently
    const resB = await callerBPromise;
    expect(resB.data).toBe('resilient');
  });

  it('returns cloned responses so mutation by one caller cannot affect another caller', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ items: ['apple', 'banana'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const [res1, res2] = await Promise.all([
      apiClient.request<{ items: string[] }>('/fruits'),
      apiClient.request<{ items: string[] }>('/fruits'),
    ]);

    // Mutate res1
    res1.items.push('cherry');

    // res2 must remain unaffected
    expect(res1.items).toEqual(['apple', 'banana', 'cherry']);
    expect(res2.items).toEqual(['apple', 'banana']);
  });
});
