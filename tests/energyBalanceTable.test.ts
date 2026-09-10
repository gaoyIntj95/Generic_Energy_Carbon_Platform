import { describe, expect, it } from 'vitest';
import type { FlowLevelOneBalanceRow } from '../src/mocks/energyFlowSelector';
import { buildEnergyBalanceTable, energyBalanceCsvRows, formatBalanceAmount } from '../src/pages/newPrototype/energyBalanceTable';

const fixture = (values: Partial<FlowLevelOneBalanceRow> = {}): FlowLevelOneBalanceRow => ({
  energyTypeId: 'electricity', energyTypeName: '电力', measurementUnit: 'kWh',
  externalInputStandardAmount: 0, internalRecoveryStandardAmount: 0,
  conversionInputStandardAmount: 0, conversionOutputStandardAmount: 0,
  availableAmount: 0, availableStandardAmount: 0, distributionAmount: 0, distributionStandardAmount: 0,
  externalOutputAmount: 0, externalOutputStandardAmount: 0, confirmedConversionLossAmount: 0,
  confirmedConversionLossStandardAmount: 0, unallocatedAmount: 0, unallocatedStandardAmount: 0,
  overAllocatedAmount: 0, overAllocatedStandardAmount: 0, distributionRate: 0, status: '已分配',
  ...values,
});

describe('energy balance table accounting and export', () => {
  it('compares actual source and use entries without counting pending allocations as uses', () => {
    const input = fixture({ externalInputStandardAmount: 100, internalRecoveryStandardAmount: 10,
      conversionOutputStandardAmount: 20, conversionInputStandardAmount: 30, distributionStandardAmount: 70,
      externalOutputStandardAmount: 5, confirmedConversionLossStandardAmount: 2,
      unallocatedStandardAmount: 23, overAllocatedStandardAmount: 99 });
    const before = structuredClone(input);
    const { rows } = buildEnergyBalanceTable([input]);
    expect(rows[0]).toMatchObject({ sourceTotal: 130, useTotal: 107, difference: 23, status: '待分配' });
    expect(input).toEqual(before);
  });

  it('keeps positive and negative energy differences actionable when their total cancels', () => {
    const result = buildEnergyBalanceTable([
      fixture({ externalInputStandardAmount: 100, distributionStandardAmount: 90 }),
      fixture({ energyTypeId: 'steam', energyTypeName: '蒸汽', conversionOutputStandardAmount: 100, distributionStandardAmount: 110 }),
    ]);
    expect(result.totals.difference).toBe(0);
    expect(result.issueRows.map((row) => row.status)).toEqual(['待分配', '超分配']);
    expect(result.totalStatus).toBe('分项待核对');
    expect(energyBalanceCsvRows(result.rows, '测试期间').find((row) => row[0] === '分项合计')?.slice(-2)).toEqual(['0.00', '分项待核对']);
  });

  it('normalizes floating-point residues and uses the displayed precision for issue flags', () => {
    const result = buildEnergyBalanceTable([fixture({ externalInputStandardAmount: 0.1 + 0.2, distributionStandardAmount: 0.3 })]);
    expect(result.issueRows).toHaveLength(0);
    expect(formatBalanceAmount(result.rows[0].difference, true)).toBe('0.00');
    expect(formatBalanceAmount(-0.0000000001)).toBe('0.00');
    expect(buildEnergyBalanceTable([fixture({ externalInputStandardAmount: 10, distributionStandardAmount: 10.004 })]).issueRows).toHaveLength(0);
    expect(buildEnergyBalanceTable([fixture({ externalInputStandardAmount: 10, distributionStandardAmount: 10.006 })]).rows[0].status).toBe('超分配');
  });

  it('totals unrounded amounts and exports the same scope, fields and differences as the table', () => {
    const input = [fixture({ externalInputStandardAmount: 1.004 }), fixture({ energyTypeId: 'steam', energyTypeName: '蒸汽', conversionOutputStandardAmount: 1.004 })];
    const result = buildEnergyBalanceTable(input);
    const csv = energyBalanceCsvRows(input, '2025年度｜全厂');
    expect(result.totals.sourceTotal).toBeCloseTo(2.008);
    expect(csv[0]).toEqual(['分析范围', '2025年度｜全厂']);
    expect(csv[2]).toEqual(['能源品种', '外部输入', '过程回收', '转换产出', '来源合计', '转换投入', '用能单元消耗', '对外输出', '已确认损失', '去向合计', '收支差额', '核对结果']);
    expect(csv.find((row) => row[0] === '分项合计')?.[4]).toBe('2.01');
    expect(csv[3].slice(-2)).toEqual(['+1.00', '待分配']);
  });

  it('distinguishes recovered heat input from canonical steam output', () => {
    const result = buildEnergyBalanceTable([
      fixture({ energyTypeId: 'heat', energyTypeName: '余热', internalRecoveryStandardAmount: 100, conversionInputStandardAmount: 100 }),
      fixture({ energyTypeId: 'steam', energyTypeName: '蒸汽', conversionOutputStandardAmount: 90, distributionStandardAmount: 89, confirmedConversionLossStandardAmount: 1 }),
    ]);
    expect(result.rows.map((row) => row.sourceTotal)).toEqual([100, 90]);
    expect(result.rows[1].internalRecoveryStandardAmount).toBe(0);
    expect(result.issueRows).toHaveLength(0);
    expect(result.rows[1].useTotal).toBe(90);
  });

  it('does not describe an empty or zero-only table as balanced', () => {
    expect(buildEnergyBalanceTable([]).totalStatus).toBe('无可核对量');
    expect(buildEnergyBalanceTable([fixture()]).rows[0].status).toBe('无可核对量');
  });
});
