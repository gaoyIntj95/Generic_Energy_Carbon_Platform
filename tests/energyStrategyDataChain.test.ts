import { beforeEach, describe, expect, it } from 'vitest';
import {
  listV11EnergyCosts,
  listV11EnergyRecords,
  resetDataManagementV11Store,
  saveV11EnergyCost,
  saveV11EnergyRecord,
} from '../src/mocks/dataManagementV11Store';
import { buildEnergyQueryDataset } from '../src/mocks/energyQuerySelector';
import { buildFlowAnalysisDataset, summarizeFlowBalance } from '../src/mocks/energyFlowSelector';
import { buildStrategyAnalysis } from '../src/pages/newPrototype/AssetOperationsV2';

describe('energy strategy data chain', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('uses energy records for the consumption query and analysis summary', () => {
    const queryBefore = buildEnergyQueryDataset({ year: 2026, period: 'month', month: 6 });
    const analysisBefore = buildStrategyAnalysis('month', '全企业');
    const source = listV11EnergyRecords().find((item) => item.energyRecordId === 'v11-er-30')!;
    const monthlyAmounts = [...source.monthlyAmounts];
    monthlyAmounts[5] += 1_000;
    expect(saveV11EnergyRecord({ ...source, monthlyAmounts }, source.energyRecordId).ok).toBe(true);

    const queryAfter = buildEnergyQueryDataset({ year: 2026, period: 'month', month: 6 });
    const analysisAfter = buildStrategyAnalysis('month', '全企业');
    expect(queryAfter.total).toBeGreaterThan(queryBefore.total);
    expect(analysisAfter.query.total).toBe(queryAfter.total);
    expect(analysisAfter.intensity).not.toBe(analysisBefore.intensity);
  });

  it('uses energy costs for the analysis cost summary and structure', () => {
    const before = buildStrategyAnalysis('month', '全企业');
    expect(before.costStructure).toHaveLength(5);
    const source = listV11EnergyCosts().find((item) => item.energyCostId === 'v11-cost-40')!;
    const monthlyCosts = [...source.monthlyCosts];
    monthlyCosts[5] += 100;
    expect(saveV11EnergyCost({ ...source, monthlyCosts }, source.energyCostId).ok).toBe(true);

    const after = buildStrategyAnalysis('month', '全企业');
    expect(after.totalCost).toBeCloseTo(before.totalCost + 100, 5);
    expect(after.costStructure.find((item) => item.name === '电力')?.value)
      .toBeCloseTo((before.costStructure.find((item) => item.name === '电力')?.value ?? 0) + 100, 5);
  });

  it('inherits balance optimization summary values from the flow analysis datasets', () => {
    const period = { year: 2026, grain: 'year' as const, month: 6 };
    const levelOne = buildFlowAnalysisDataset(period, 'level1');
    const levelTwo = buildFlowAnalysisDataset(period, 'level2');
    const summary = summarizeFlowBalance(levelOne, levelTwo);
    const recovered = levelOne.levelOneBalanceRows.reduce(
      (total, row) => total + row.internalRecoveryStandardAmount,
      0,
    );

    expect(summary.inputStandardCoalAmount).toBe(levelOne.utilizationStandardCoalAmount);
    expect(summary.effectiveUseStandardCoalAmount).toBe(levelTwo.utilizationStandardCoalAmount);
    expect(summary.recoveredStandardCoalAmount).toBe(recovered);
    expect(summary.externalOutputStandardCoalAmount).toBe(levelOne.externalStandardCoalAmount);
    expect(summary.differenceStandardCoalAmount).toBeCloseTo(
      levelOne.utilizationStandardCoalAmount
        - levelTwo.utilizationStandardCoalAmount
        - recovered
        - levelOne.externalStandardCoalAmount,
      8,
    );
    // The remaining small annual difference is the conversion-loss / rounding
    // remainder; it must not be confused with the former 95k tce data gap.
    expect(Math.abs(summary.differenceStandardCoalAmount)).toBeLessThan(100);

    const monthly = summarizeFlowBalance(
      buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1'),
      buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level2'),
    );
    expect(Math.abs(monthly.differenceStandardCoalAmount)).toBeLessThan(100);
  });
});
