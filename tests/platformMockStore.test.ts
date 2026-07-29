import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteCarbonAsset,
  deleteEnergyActivityRecord,
  deleteEnergyType,
  deleteEmissionSource,
  getBudgetTarget,
  getEfficiencyTarget,
  latestCarbonSnapshot,
  listEnergyBalanceRecords,
  listEnergyActivityRecords,
  listEnergyTypes,
  listEnergyFlowRecords,
  listEmissionSources,
  listOptimizationStrategies,
  publishCarbonSnapshot,
  resetPlatformMockStore,
  saveBudgetTarget,
  saveCarbonAsset,
  saveEnergyActivityRecord,
  saveEnergyType,
  saveEfficiencyTarget,
  saveEmissionSource,
  totalEnergyConsumption,
  updateStrategyState,
} from '../src/mocks/platformMockStore';

describe('shared platform mock store', () => {
  beforeEach(() => resetPlatformMockStore());

  it('keeps energy and carbon summaries consistent with shared detail data', () => {
    expect(totalEnergyConsumption()).toBe(13320);
    const sourceTotal = listEmissionSources().reduce((sum, source) => sum + source.emissionAmount, 0);
    expect(sourceTotal).toBeCloseTo(latestCarbonSnapshot()!.totalEmission, 2);
  });

  it('persists budget configuration and strategy actions in the central mock state', () => {
    const target = getBudgetTarget('energy')!;
    saveBudgetTarget({ ...target, targetValue: 13500 });
    expect(getBudgetTarget('energy')?.targetValue).toBe(13500);

    updateStrategyState('os-clinker', '执行中');
    expect(listOptimizationStrategies().find((item) => item.optimizationStrategyId === 'os-clinker')?.strategyState).toBe('执行中');
  });

  it('creates and deletes an unused asset while blocking referenced quantities', () => {
    const created = saveCarbonAsset({
      complianceCycle: '2026年度',
      assetType: 'CCER',
      assetSource: '市场购买',
      totalAmount: 100,
      eligibleAmount: 100,
      lockedAmount: 0,
      usedAmount: 0,
      voucherNumber: 'TEST-001',
      bookedAt: '2026-07-28',
      remark: '测试记录',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(deleteCarbonAsset(created.asset.carbonAssetId).ok).toBe(true);
    expect(deleteCarbonAsset('ca-quota-2026')).toMatchObject({ ok: false });
  });

  it('updates emission sources by stable id and publishes the new total to a formal snapshot', () => {
    const source = listEmissionSources().find((item) => item.emissionSourceId === 'es-diesel')!;
    const result = saveEmissionSource({ ...source, emissionAmount: 60.47 }, source.emissionSourceId);
    expect(result.ok).toBe(true);
    expect(listEmissionSources().find((item) => item.emissionSourceId === source.emissionSourceId)?.emissionAmount).toBe(60.47);

    const snapshot = publishCarbonSnapshot();
    const sourceTotal = listEmissionSources().reduce((sum, item) => sum + item.emissionAmount, 0);
    expect(snapshot.totalEmission).toBeCloseTo(sourceTotal, 2);
    expect(snapshot.sourceItems).toHaveLength(listEmissionSources().length);
    expect(snapshot.sourceItems).not.toBe(listEmissionSources());
    expect(latestCarbonSnapshot()?.carbonSnapshotId).toBe(snapshot.carbonSnapshotId);
  });

  it('persists master data and activity data by stable ids and blocks referenced master deletion', () => {
    const typeResult = saveEnergyType({
      analysisCategory: '其他能源',
      energyTypeName: '测试能源',
      measurementUnit: 't',
      standardCoalFactor: 1,
      standardCoalFactorUnit: 'tce/t',
      factorSource: '企业配置',
      enabled: true,
    });
    expect(typeResult.ok).toBe(true);
    if (!typeResult.ok) return;

    const recordResult = saveEnergyActivityRecord({
      energyUnitId: 'eu-office',
      energyTypeId: typeResult.item.energyTypeId,
      energyRole: '能源消费',
      entryMode: 'annual',
      year: 2026,
      annualPhysicalAmount: 10,
      physicalUnit: 't',
      standardCoalAmount: 10,
      monthlyStandardCoalAmounts: [],
    });
    expect(recordResult.ok).toBe(true);
    expect(deleteEnergyType(typeResult.item.energyTypeId).ok).toBe(false);
    if (!recordResult.ok) return;
    expect(deleteEnergyActivityRecord(recordResult.item.energyRecordId).ok).toBe(true);
    expect(deleteEnergyType(typeResult.item.energyTypeId).ok).toBe(true);
    expect(listEnergyTypes().some((item) => item.energyTypeId === typeResult.item.energyTypeId)).toBe(false);
    expect(listEnergyActivityRecords().some((item) => item.energyRecordId === recordResult.item.energyRecordId)).toBe(false);
  });

  it('creates and deletes a manual emission source without using its name as the key', () => {
    const result = saveEmissionSource({
      carbonTaskId: 'ct-2026',
      emissionGroup: '其他间接排放',
      sourceType: '商务出行',
      sourceName: '航空差旅',
      activityData: '1200 人公里',
      activityDataSource: '碳核算清单 · 人工录入',
      factorName: '航空差旅因子',
      emissionFactorId: 'ef-flight',
      emissionAmount: 0.18,
      entryMode: 'manual',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.emissionSourceId).toMatch(/^es-mock-/);
    expect(deleteEmissionSource(result.source.emissionSourceId).ok).toBe(true);
  });

  it('persists efficiency targets and keeps energy flow records traceable', () => {
    const current = getEfficiencyTarget('eu-clinker-line-1', '单位熟料综合能耗')!;
    saveEfficiencyTarget({ ...current, targetValue: 89.5 });
    expect(getEfficiencyTarget('eu-clinker-line-1', '单位熟料综合能耗')?.targetValue).toBe(89.5);
    expect(listEnergyBalanceRecords().every((item) => item.sourceEnergyRecordIds.length > 0)).toBe(true);
    expect(listEnergyFlowRecords().every((item) => item.sourceRecordIds.length > 0)).toBe(true);
  });
});
