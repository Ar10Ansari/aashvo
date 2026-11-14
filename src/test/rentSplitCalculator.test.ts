import { describe, expect, it } from 'vitest';
import {
  calculateRentSplit,
  deserializeCalculatorState,
  exportBreakdownText,
  serializeCalculatorState,
} from '../services/rentCalculatorService';
import type { CalculateRentSplitInput } from '@aashvo/contracts';

describe('Rent Split Calculator Service', () => {
  it('calculates equal rent and utility splits with exact integer remainder distribution', () => {
    const input: CalculateRentSplitInput = {
      splitMethod: 'equal',
      totalMonthlyRent: 25000,
      totalDeposit: 50000,
      utilities: {
        electricity: 2500,
        water: 500,
        wifi: 1000,
        maintenance: 2000,
      },
      flatmates: [
        { flatmateName: 'Aarav' },
        { flatmateName: 'Rohan' },
        { flatmateName: 'Vikram' },
      ],
    };

    const summary = calculateRentSplit(input);

    expect(summary.isValidAllocation).toBe(true);
    expect(summary.totalMonthlyRent).toBe(25000);
    expect(summary.totalMonthlyUtilities).toBe(6000);
    expect(summary.totalMonthlyCommitment).toBe(31000);
    expect(summary.allocations).toHaveLength(3);

    // Sum of rent shares must equal 25000 exactly
    const rentSum = summary.allocations.reduce((acc, a) => acc + a.rentShare, 0);
    expect(rentSum).toBe(25000);

    // Each person's utility share is 6000 / 3 = 2000
    summary.allocations.forEach((alloc) => {
      expect(alloc.utilitiesShare).toBe(2000);
    });

    // Sum of deposit shares must equal 50000 exactly
    const depositSum = summary.allocations.reduce((acc, a) => acc + a.depositShare, 0);
    expect(depositSum).toBe(50000);
  });

  it('calculates custom room-tier splits and validates rent discrepancies', () => {
    const validInput: CalculateRentSplitInput = {
      splitMethod: 'custom',
      totalMonthlyRent: 35000,
      totalDeposit: 70000,
      utilities: {
        electricity: 3000,
        wifi: 1000,
      },
      flatmates: [
        { flatmateName: 'Master Ensuite (Aarav)', customRentAmount: 16000 },
        { flatmateName: 'Balcony Room (Bhavna)', customRentAmount: 11000 },
        { flatmateName: 'Standard Room (Chirag)', customRentAmount: 8000 },
      ],
    };

    const summary = calculateRentSplit(validInput);
    expect(summary.isValidAllocation).toBe(true);
    expect(summary.allocations[0].rentShare).toBe(16000);
    expect(summary.allocations[1].rentShare).toBe(11000);
    expect(summary.allocations[2].rentShare).toBe(8000);

    // Test invalid custom split with shortfall
    const invalidInput: CalculateRentSplitInput = {
      ...validInput,
      flatmates: [
        { flatmateName: 'Master Ensuite', customRentAmount: 15000 },
        { flatmateName: 'Balcony Room', customRentAmount: 10000 },
        { flatmateName: 'Standard Room', customRentAmount: 8000 },
      ],
    };

    const invalidSummary = calculateRentSplit(invalidInput);
    expect(invalidSummary.isValidAllocation).toBe(false);
    expect(invalidSummary.validationMessage).toContain('leaving ₹2,000 unassigned');
  });

  it('calculates percentage splits and validates 100% total', () => {
    const input: CalculateRentSplitInput = {
      splitMethod: 'percentage',
      totalMonthlyRent: 40000,
      totalDeposit: 80000,
      utilities: {
        electricity: 4000,
      },
      flatmates: [
        { flatmateName: 'Priya', percentageShare: 50 },
        { flatmateName: 'Sneha', percentageShare: 30 },
        { flatmateName: 'Tanvi', percentageShare: 20 },
      ],
    };

    const summary = calculateRentSplit(input);
    expect(summary.isValidAllocation).toBe(true);
    expect(summary.allocations[0].rentShare).toBe(20000);
    expect(summary.allocations[1].rentShare).toBe(12000);
    expect(summary.allocations[2].rentShare).toBe(8000);
    expect(summary.allocations[0].depositShare).toBe(40000);

    // Test invalid percentage
    const invalidInput: CalculateRentSplitInput = {
      ...input,
      flatmates: [
        { flatmateName: 'Priya', percentageShare: 50 },
        { flatmateName: 'Sneha', percentageShare: 30 },
      ],
    };

    const invalidSummary = calculateRentSplit(invalidInput);
    expect(invalidSummary.isValidAllocation).toBe(false);
    expect(invalidSummary.validationMessage).toContain('sum to 80.0%. They must equal exactly 100%');
  });

  it('formats clean WhatsApp-friendly exportable breakdown text', () => {
    const input: CalculateRentSplitInput = {
      splitMethod: 'equal',
      totalMonthlyRent: 20000,
      totalDeposit: 40000,
      utilities: { electricity: 2000 },
      flatmates: [{ flatmateName: 'Aarav' }, { flatmateName: 'Rohan' }],
    };

    const summary = calculateRentSplit(input);
    const text = exportBreakdownText(summary);

    expect(text).toContain('AASHVO Rent & Expense Split Breakdown');
    expect(text).toContain('Total Monthly Rent: ₹20,000');
    expect(text).toContain('Aarav (50%):');
    expect(text).toContain('Notice: Informational calculation only');
  });

  it('serializes and deserializes calculator state correctly', () => {
    const input: CalculateRentSplitInput = {
      splitMethod: 'custom',
      totalMonthlyRent: 30000,
      totalDeposit: 60000,
      utilities: { wifi: 1000 },
      flatmates: [
        { flatmateName: 'Aarav', customRentAmount: 18000 },
        { flatmateName: 'Rohan', customRentAmount: 12000 },
      ],
    };

    const serialized = serializeCalculatorState(input);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(10);

    const deserialized = deserializeCalculatorState(serialized);
    expect(deserialized).toEqual(input);
  });
});

