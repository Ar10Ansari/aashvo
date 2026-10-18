import { ProviderType, RoomType } from '../types';

export function formatINR(amount: number): string {
  if (amount === 0) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRent(amount: number): string {
  return `${formatINR(amount)}/mo`;
}

export function getFreshnessInfo(isoDateStr: string): { label: string; isFresh: boolean; badgeColor: string } {
  try {
    const date = new Date(isoDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { label: 'Active Today', isFresh: true, badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (diffDays === 1) {
      return { label: 'Confirmed Yesterday', isFresh: true, badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (diffDays <= 4) {
      return { label: `Verified ${diffDays}d ago`, isFresh: true, badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (diffDays <= 10) {
      return { label: `Checked ${diffDays}d ago`, isFresh: true, badgeColor: 'bg-sand-100 text-charcoal-700 border-sand-300' };
    }
    return { label: `Active ${diffDays}d ago`, isFresh: false, badgeColor: 'bg-ivory-300 text-charcoal-500 border-ivory-400' };
  } catch {
    return { label: 'Availability Verified', isFresh: true, badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
}

export function getProviderBadge(providerType: ProviderType, brokerage: number): { label: string; badgeStyle: string } {
  switch (providerType) {
    case 'owner':
      return {
        label: 'Direct Owner (₹0 Brokerage)',
        badgeStyle: 'bg-forest-50 text-forest-700 border-forest-200 font-medium',
      };
    case 'tenant_flatmate':
      return {
        label: 'Current Flatmate',
        badgeStyle: 'bg-amber-50 text-amber-900 border-amber-200 font-medium',
      };
    case 'verified_manager':
      return {
        label: brokerage > 0 ? `Manager (${formatINR(brokerage)} Fee)` : 'Property Manager',
        badgeStyle: 'bg-charcoal-50 text-charcoal-700 border-charcoal-200 font-medium',
      };
    default:
      return { label: 'Verified Provider', badgeStyle: 'bg-ivory-200 text-charcoal-700 border-ivory-300' };
  }
}

export function formatRoomType(roomType: RoomType): string {
  switch (roomType) {
    case 'private_room':
      return 'Private Room';
    case 'shared_room':
      return 'Shared Room';
    case 'entire_flat':
      return 'Entire Flat';
    default:
      return 'Room';
  }
}
