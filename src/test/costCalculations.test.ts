import { describe, it, expect } from 'vitest';
import { formatINR, getFreshnessInfo, getProviderBadge, formatRoomType } from '../utils/formatters';
import { Property } from '../types';

describe('Cost Calculations & Financial Transparency Formatters', () => {
  it('correctly formats INR currency values with appropriate symbol and commas', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(500)).toBe('₹500');
    expect(formatINR(23500)).toBe('₹23,500');
    expect(formatINR(120000)).toBe('₹1,20,000');
  });

  it('accurately calculates total estimated first-month outlay', () => {
    const mockProperty: Partial<Property> = {
      rent: 23500,
      deposit: 30000,
      maintenance: 1800,
      brokerageFee: 0,
    };

    const totalOutlay =
      (mockProperty.rent || 0) +
      (mockProperty.deposit || 0) +
      (mockProperty.maintenance || 0) +
      (mockProperty.brokerageFee || 0);

    expect(totalOutlay).toBe(55300);
    expect(formatINR(totalOutlay)).toBe('₹55,300');
  });

  it('accurately accounts for declared upfront brokerage fees', () => {
    const brokerProperty: Partial<Property> = {
      rent: 18500,
      deposit: 25000,
      maintenance: 1000,
      brokerageFee: 3500,
    };

    const totalOutlay =
      (brokerProperty.rent || 0) +
      (brokerProperty.deposit || 0) +
      (brokerProperty.maintenance || 0) +
      (brokerProperty.brokerageFee || 0);

    expect(totalOutlay).toBe(48000);
    expect(formatINR(totalOutlay)).toBe('₹48,000');
  });

  it('returns transparent zero-brokerage badge for direct owner listings', () => {
    const badge = getProviderBadge('owner', 0);
    expect(badge.label).toBe('Direct Owner (₹0 Brokerage)');
    expect(badge.badgeStyle).toContain('forest');
  });

  it('returns transparent fixed brokerage fee badge for property managers', () => {
    const badge = getProviderBadge('verified_manager', 3500);
    expect(badge.label).toBe('Manager (₹3,500 Fee)');
  });

  it('returns current flatmate badge for room-sharing listings', () => {
    const badge = getProviderBadge('tenant_flatmate', 0);
    expect(badge.label).toBe('Current Flatmate');
  });

  it('computes accurate verified availability freshness labels', () => {
    const now = new Date().toISOString();
    const fresh = getFreshnessInfo(now);
    expect(fresh.label).toBe('Active Today');
    expect(fresh.badgeColor).toContain('emerald');

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const fresh2 = getFreshnessInfo(twoDaysAgo);
    expect(fresh2.label).toBe('Verified 2d ago');

    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
    const freshOld = getFreshnessInfo(twentyDaysAgo);
    expect(freshOld.isFresh).toBe(false);
    expect(freshOld.label).toContain('Active 20d ago');
  });

  it('correctly maps room type identifiers to human-readable strings', () => {
    expect(formatRoomType('private_room')).toBe('Private Room');
    expect(formatRoomType('shared_room')).toBe('Shared Room');
    expect(formatRoomType('entire_flat')).toBe('Entire Flat');
  });
});
