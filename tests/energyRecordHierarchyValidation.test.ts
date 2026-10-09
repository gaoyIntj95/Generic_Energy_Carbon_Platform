import { beforeEach, describe, expect, it } from 'vitest';
import { listEnergyUnits } from '../src/mocks/energyUnitMockStore';
import {
  listV11EnergyRecords,
  resetDataManagementV11Store,
  saveV11EnergyRecord,
} from '../src/mocks/dataManagementV11Store';

const monthly = (amount: number) => Array(12).fill(amount) as number[];
const reported = Array(12).fill(true) as boolean[];

function record(scopeLevel: '企业' | '一级用能单元' | '二级用能单元', amount: number, energyUnitId: string | null = null, annualAmount = 0) {
  return {
    year: 2021,
    energyRole: '能源消费' as const,
    scopeLevel,
    scopeType: scopeLevel === '企业' ? 'enterprise' as const : 'energyUnit' as const,
    scopeId: energyUnitId,
    energyUnitId,
    energyTypeId: 'v11-energy-electricity',
    entryMode: 'monthly' as const,
    monthlyAmounts: monthly(amount),
    monthlyReportedMonths: reported,
    annualAmount,
  };
}

describe('energy record hierarchy validation', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('rejects level-one annual totals above the enterprise annual total', () => {
    expect(saveV11EnergyRecord(record('企业', 0, null, 100)).ok).toBe(true);
    const unit = listEnergyUnits(2021).find((item) => item.unitLevel === 'level1')!;
    const result = saveV11EnergyRecord(record('一级用能单元', 0, unit.energyUnitId, 101));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('一级用能单元年度汇总不能超过上级年度值');
  });

  it('rejects a reported month above the enterprise month when annual totals are within bounds', () => {
    expect(saveV11EnergyRecord(record('企业', 10, null, 200)).ok).toBe(true);
    const unit = listEnergyUnits(2021).find((item) => item.unitLevel === 'level1')!;
    const values = monthly(10);
    values[4] = 11;
    const result = saveV11EnergyRecord({ ...record('一级用能单元', 0, unit.energyUnitId, 150), monthlyAmounts: values });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('5月汇总不能超过上级月度值');
  });

  it('rejects the sum of second-level annual values above their parent', () => {
    const parent = listEnergyUnits(2021).find((item) => item.unitLevel === 'level1')!;
    const child = listEnergyUnits(2021).find((item) => item.parentEnergyUnitId === parent.energyUnitId)!;
    expect(saveV11EnergyRecord(record('一级用能单元', 0, parent.energyUnitId, 100)).ok).toBe(true);
    expect(saveV11EnergyRecord(record('二级用能单元', 0, child.energyUnitId, 80)).ok).toBe(true);
    const sibling = listEnergyUnits(2021).find((item) => item.parentEnergyUnitId === parent.energyUnitId && item.energyUnitId !== child.energyUnitId);
    if (!sibling) return;
    const result = saveV11EnergyRecord(record('二级用能单元', 0, sibling.energyUnitId, 30));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('二级用能单元年度汇总不能超过上级年度值');
  });

  it('keeps the rejected record out of the store', () => {
    const enterprise = saveV11EnergyRecord(record('企业', 10));
    expect(enterprise.ok).toBe(true);
    const unit = listEnergyUnits(2021).find((item) => item.unitLevel === 'level1')!;
    saveV11EnergyRecord(record('一级用能单元', 8, unit.energyUnitId));
    const before = listV11EnergyRecords().length;
    const secondUnit = listEnergyUnits(2021).find((item) => item.unitLevel === 'level1' && item.energyUnitId !== unit.energyUnitId)!;
    const result = saveV11EnergyRecord(record('一级用能单元', 3, secondUnit.energyUnitId));
    expect(result.ok).toBe(false);
    expect(listV11EnergyRecords()).toHaveLength(before);
  });
});
