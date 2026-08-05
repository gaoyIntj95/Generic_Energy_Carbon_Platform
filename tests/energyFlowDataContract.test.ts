import { beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store, saveV11ConversionOutput, saveV11EnergyRecord } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';

describe('energy flow phase-one data contract', () => {
  beforeEach(() => {
    resetDataManagementV11Store();
  });

  it('does not spread annual-only records into a monthly flow', () => {
    const saved = saveV11EnergyRecord({
      year: 2027,
      scopeLevel: '一级用能单元',
      scopeType: 'energyUnit',
      scopeId: 'eu-clinker-line-1',
      energyUnitId: 'eu-clinker-line-1',
      energyRole: '能源消费',
      energyTypeId: 'v11-energy-electricity',
      entryMode: 'annual',
      annualAmount: 120000,
      monthlyAmounts: Array(12).fill(0),
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2027, grain: 'month', month: 6 }, 'level1');

    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
    expect(result.inputStandardCoalAmount).toBe(0);
    expect(result.dataNotice).toContain('当前月份有');
  });

  it('does not spread manual annual conversion output into a monthly flow', () => {
    const saved = saveV11ConversionOutput({
      year: 2027,
      recordType: '回收利用',
      conversionEnergyUnitId: 'eu-waste-heat-power',
      inputMode: 'recovery',
      recoveryEnergyName: '余热',
      recoveryAmount: 120,
      recoveryUnit: 'GJ',
      outputAnalysisCategory: '电力',
      outputEnergyTypeId: 'v11-energy-electricity',
      outputEnergyName: '电力',
      outputUnit: 'kWh',
      outputAmount: 100,
      internalAmount: 100,
      externalAmount: 0,
      lossAmount: 0,
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2027, grain: 'month', month: 6 }, 'level1');

    expect(result.nodes.some((node) => node.stage === 'conversion')).toBe(false);
    expect(result.dataNotice).toContain('没有月度投入数据');
  });

  it('keeps the corrected self-generation source out of same-energy conversion warnings', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'year', month: 6 }, 'level1');

    expect(result.dataNotice).not.toContain('同品种转换');
  });

  it('maps monthly boiler, waste-heat and photovoltaic conversions into the flow view', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const conversionNames = result.nodes
      .filter((node) => node.stage === 'conversion')
      .map((node) => node.name);

    expect(conversionNames).toEqual(expect.arrayContaining(['锅炉系统', '能源回收系统', '配电系统']));
    expect(result.dataNotice).not.toContain('余热发电没有月度投入数据');
  });

  it('exposes conversion input and output amounts on conversion nodes', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const conversion = result.nodes.find((node) => node.stage === 'conversion' && node.name === '锅炉系统');

    expect(conversion?.detailLabel).toMatch(/投入 .* tce/);
    expect(conversion?.detailLabelSecondary).toMatch(/产出 .* tce/);
  });
});
