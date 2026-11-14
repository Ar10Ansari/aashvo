import type {
  CalculateRentSplitInput,
  RentSplitAllocation,
  RentSplitSummary,
} from '@aashvo/contracts';

/**
 * Calculates rent and utility split across flatmates with support for
 * equal, custom room-tier, and percentage splits.
 *
 * Designed specifically for Indian urban flat-sharing dynamics.
 * Strictly non-custodial: does not process funds or act as an escrow agent.
 */
export function calculateRentSplit(input: CalculateRentSplitInput): RentSplitSummary {
  const { splitMethod, totalMonthlyRent, totalDeposit, utilities, flatmates } = input;

  const numFlatmates = flatmates.length;
  if (numFlatmates === 0) {
    return {
      splitMethod,
      totalMonthlyRent,
      totalMonthlyUtilities: 0,
      totalMonthlyCommitment: totalMonthlyRent,
      totalDeposit,
      allocations: [],
      isValidAllocation: false,
      validationMessage: 'At least one flatmate must be specified.',
    };
  }

  // Calculate total utilities
  const electricity = Number(utilities.electricity || 0);
  const water = Number(utilities.water || 0);
  const wifi = Number(utilities.wifi || 0);
  const maintenance = Number(utilities.maintenance || 0);
  const housekeeping = Number(utilities.housekeeping || 0);
  const other = Number(utilities.other || 0);

  const totalMonthlyUtilities = electricity + water + wifi + maintenance + housekeeping + other;
  const totalMonthlyCommitment = totalMonthlyRent + totalMonthlyUtilities;

  // Utilities are shared equally across all flatmates by standard convention
  const perPersonUtilities = Math.round((totalMonthlyUtilities / numFlatmates) * 100) / 100;

  const allocations: RentSplitAllocation[] = [];
  let isValidAllocation = true;
  let validationMessage: string | undefined;

  if (splitMethod === 'equal') {
    const baseShare = Math.floor(totalMonthlyRent / numFlatmates);
    const rentRemainder = totalMonthlyRent - baseShare * numFlatmates;

    const baseDeposit = Math.floor(totalDeposit / numFlatmates);
    const depositRemainder = totalDeposit - baseDeposit * numFlatmates;

    flatmates.forEach((fm, index) => {
      // Distribute remainder rupees to first N flatmates to guarantee exact sum
      const rentShare = baseShare + (index < rentRemainder ? 1 : 0);
      const depositShare = baseDeposit + (index < depositRemainder ? 1 : 0);
      const sharePercentage = totalMonthlyRent > 0 ? (rentShare / totalMonthlyRent) * 100 : 100 / numFlatmates;

      allocations.push({
        flatmateName: fm.flatmateName.trim() || `Flatmate ${index + 1}`,
        rentShare,
        utilitiesShare: perPersonUtilities,
        totalMonthlyPayment: rentShare + perPersonUtilities,
        depositShare,
        sharePercentage: Math.round(sharePercentage * 10) / 10,
      });
    });
  } else if (splitMethod === 'custom') {
    let customRentSum = 0;
    flatmates.forEach((fm) => {
      customRentSum += Number(fm.customRentAmount || 0);
    });

    const rentDiff = totalMonthlyRent - customRentSum;
    if (Math.abs(rentDiff) > 0.01) {
      isValidAllocation = false;
      validationMessage =
        rentDiff > 0
          ? `Allocated room rent totals ₹${customRentSum.toLocaleString('en-IN')}, leaving ₹${rentDiff.toLocaleString('en-IN')} unassigned.`
          : `Allocated room rent totals ₹${customRentSum.toLocaleString('en-IN')}, exceeding total rent by ₹${Math.abs(rentDiff).toLocaleString('en-IN')}.`;
    }

    flatmates.forEach((fm, index) => {
      const rentShare = Number(fm.customRentAmount || 0);
      const sharePercentage = totalMonthlyRent > 0 ? (rentShare / totalMonthlyRent) * 100 : 0;
      // Deposit share proportionally tied to room rent ratio
      const depositShare =
        totalMonthlyRent > 0 ? Math.round((rentShare / totalMonthlyRent) * totalDeposit) : Math.round(totalDeposit / numFlatmates);

      allocations.push({
        flatmateName: fm.flatmateName.trim() || `Flatmate ${index + 1}`,
        rentShare,
        utilitiesShare: perPersonUtilities,
        totalMonthlyPayment: rentShare + perPersonUtilities,
        depositShare,
        sharePercentage: Math.round(sharePercentage * 10) / 10,
      });
    });
  } else if (splitMethod === 'percentage') {
    let totalPercentage = 0;
    flatmates.forEach((fm) => {
      totalPercentage += Number(fm.percentageShare || 0);
    });

    if (Math.abs(totalPercentage - 100) > 0.1) {
      isValidAllocation = false;
      validationMessage = `Total percentage shares sum to ${totalPercentage.toFixed(1)}%. They must equal exactly 100%.`;
    }

    flatmates.forEach((fm, index) => {
      const sharePct = Number(fm.percentageShare || 0);
      const rentShare = Math.round((totalMonthlyRent * sharePct) / 100);
      const depositShare = Math.round((totalDeposit * sharePct) / 100);

      allocations.push({
        flatmateName: fm.flatmateName.trim() || `Flatmate ${index + 1}`,
        rentShare,
        utilitiesShare: perPersonUtilities,
        totalMonthlyPayment: rentShare + perPersonUtilities,
        depositShare,
        sharePercentage: sharePct,
      });
    });
  }

  return {
    splitMethod,
    totalMonthlyRent,
    totalMonthlyUtilities,
    totalMonthlyCommitment,
    totalDeposit,
    allocations,
    isValidAllocation,
    validationMessage,
  };
}

/**
 * Exports calculation summary to a clean, readable text format suitable
 * for WhatsApp, Slack, or email sharing among flatmates.
 */
export function exportBreakdownText(summary: RentSplitSummary): string {
  const currency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  const lines: string[] = [
    '🏡 AASHVO Rent & Expense Split Breakdown',
    '--------------------------------------------------',
    `Split Method: ${summary.splitMethod.toUpperCase()}`,
    `Total Monthly Rent: ${currency(summary.totalMonthlyRent)}`,
    `Total Monthly Utilities: ${currency(summary.totalMonthlyUtilities)}`,
    `Total Monthly Flat Commitment: ${currency(summary.totalMonthlyCommitment)}`,
    `Total Security Deposit: ${currency(summary.totalDeposit)}`,
    '--------------------------------------------------',
    'INDIVIDUAL FLATMAKER SHARES:',
  ];

  summary.allocations.forEach((alloc, i) => {
    lines.push(
      `${i + 1}. ${alloc.flatmateName} (${alloc.sharePercentage}%):`,
      `   • Room Rent: ${currency(alloc.rentShare)}`,
      `   • Utilities: ${currency(alloc.utilitiesShare)}`,
      `   • Total Monthly Payment: ${currency(alloc.totalMonthlyPayment)}`,
      `   • Security Deposit Share: ${currency(alloc.depositShare)}`,
    );
  });

  lines.push(
    '--------------------------------------------------',
    'Generated via AASHVO Shared Living Platform (aashvo.com)',
    '*Notice: Informational calculation only. AASHVO does not process funds or act as an escrow agent.',
  );

  return lines.join('\n');
}

/**
 * Serializes state to JSON base64 string for URL sharing or bookmarking.
 */
export function serializeCalculatorState(input: CalculateRentSplitInput): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(input)));
  } catch {
    return '';
  }
}

/**
 * Deserializes state from encoded string.
 */
export function deserializeCalculatorState(raw: string): CalculateRentSplitInput | null {
  try {
    const decoded = decodeURIComponent(atob(raw));
    return JSON.parse(decoded) as CalculateRentSplitInput;
  } catch {
    return null;
  }
}
