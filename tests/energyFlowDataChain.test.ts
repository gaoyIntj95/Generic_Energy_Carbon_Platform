import { beforeEach, describe, expect, it } from 'vitest';
import { listV11ConversionOutputs, listV11EnergyRecords, listV11ExternalSupplyRecords, listV11EnergyTypes, resetDataManagementV11Store, saveV11EnergyRecord, saveFlowConversion, saveFlowExternal, deleteFlowExternalData, saveV11ConversionOutput, v11RecordScopeType } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
const period = { year: 2026, grain: 'month' as const, month: 6 };
const conversion = () => listV11ConversionOutputs().find(r => r.conversionOutputId === 'v11-output-201')!;
const source = () => listV11EnergyRecords().find(r => r.energyRecordId === conversion().inputEnergyRecordId)!;
const annualPeriod = { ...period, grain: 'year' as const };
const conversionFlow = () => buildFlowAnalysisDataset(period).conversionDifferenceRows.find(r => r.conversionOutputId === conversion().conversionOutputId)!;

describe('consumption to conversion to flow data chain', () => {
  beforeEach(() => resetDataManagementV11Store());
  it('links every ordinary seeded conversion to its own second-level consumption ledger', () => {
    for (const row of listV11ConversionOutputs().filter(r => r.year === 2026 && r.inputMode !== 'recovery' && r.inputMode !== 'none')) {
      const input = listV11EnergyRecords().find(r => r.energyRecordId === row.inputEnergyRecordId)!;
      expect(input, row.conversionOutputId).toBeDefined();
      expect(v11RecordScopeType(input)).toBe('energyUnit');
      expect(input.scopeLevel).toBe('二级用能单元');
      expect(input.energyUnitId).toBe(row.conversionEnergyUnitId);
    }
  });
  it('does not infer monthly output from annual output even when the input has monthly quantities', () => {
    const row = listV11ConversionOutputs().find(r => r.conversionOutputId === 'v11-output-captive-power')!;
    expect(saveV11ConversionOutput({ ...row, monthlyOutputAmounts: undefined, monthlyInternalAmounts: undefined }, row.conversionOutputId).ok).toBe(true);
    const flow = buildFlowAnalysisDataset(period);
    const result = flow.conversionDifferenceRows.find(r => r.conversionOutputId === row.conversionOutputId)!;
    expect(result.inputStandardAmount).toBeGreaterThan(0);
    expect(result.outputStandardAmount).toBe(0);
  });
  it('uses the second-level consumption amount on the input edge without changing output or external data', () => {
    const original = source(); const output = conversion(); const supplies = listV11ExternalSupplyRecords();
    const factor = listV11EnergyTypes().find(t => t.energyTypeId === original.energyTypeId)!;
    const amounts = original.monthlyAmounts.map((n,i) => i === 5 ? 130000 : n);
    expect(saveV11EnergyRecord({ ...original, monthlyAmounts: amounts }, original.energyRecordId).ok).toBe(true);
    expect(conversionFlow().inputStandardAmount).toBeCloseTo(130000 * factor.standardCoalFactor / 1000);
    const edge = buildFlowAnalysisDataset(period).links.find(l => l.linkId === 'conversion:v11-output-201:input')!;
    expect(edge.calculation?.physicalAmount).toBeCloseTo(130000);
    expect(conversion().monthlyOutputAmounts).toEqual(output.monthlyOutputAmounts);
    expect(listV11ExternalSupplyRecords()).toEqual(supplies);
  });
  it('does not use a stale quantity when the linked consumption month is marked missing', () => {
    const original = source();
    expect(saveV11EnergyRecord({ ...original, monthlyReportedMonths: Array.from({length:12},(_,i) => i !== 5) }, original.energyRecordId).ok).toBe(true);
    expect(conversionFlow().inputStandardAmount).toBe(0);
    expect(buildFlowAnalysisDataset(period).dataNotice).toContain('投入待填报');
  });
  it('saves an explicit zero consumption month and preserves its reported state', () => {
    const original = source();
    expect(saveV11EnergyRecord({ ...original, annualAmount: 0, monthlyAmounts: Array(12).fill(0), monthlyReportedMonths: Array.from({length:12},(_,i) => i === 5) }, original.energyRecordId).ok).toBe(true);
    expect(source().entryMode).toBe('monthly');
    expect(conversionFlow().inputStandardAmount).toBe(0);
    expect(buildFlowAnalysisDataset(period).dataNotice).not.toContain('锅炉系统：本月投入待填报');
  });
  it('rejects a device consumption record as the unit input', () => {
    const row = conversion();
    expect(saveFlowConversion({ ...row, inputEnergyRecordId: 'v11-er-device-82' }, row.conversionOutputId).ok).toBe(false);
    expect(conversion().inputEnergyRecordId).toBe('v11-er-36');
  });
  it('uses recorded loss on the conversion node instead of labeling the input-output difference as loss', () => {
    const row = conversion();
    expect(saveFlowConversion({ ...row, monthlyLossAmounts: Array.from({length:12},(_,i) => i === 5 ? 20 : 0), monthlyLossReported: Array.from({length:12},(_,i) => i === 5), lossAmount: 20 },row.conversionOutputId).ok).toBe(true);
    const flow=buildFlowAnalysisDataset(period);
    expect(flow.confirmedConversionLossStandardCoalAmount).toBeGreaterThan(0);
    expect(flow.nodes.find(n=>n.nodeId==='conversion:v11-output-201')?.detailLabelSecondary).toContain('已确认损失 0.7 tce');
  });
  it('updates external and internal flow when the maintained external amount is edited and deleted', () => {
    const before=buildFlowAnalysisDataset(period);
    const row=listV11ExternalSupplyRecords().find(r=>r.conversionOutputId===conversion().conversionOutputId)!;
    const amounts=row.monthlyAmounts!.map((n,i)=>i===5?250:n);
    expect(saveFlowExternal({...row,monthlyAmounts:amounts,amount:amounts.reduce((a,b)=>a+b,0)},row.externalSupplyId).ok).toBe(true);
    expect(buildFlowAnalysisDataset(period).externalStandardCoalAmount-before.externalStandardCoalAmount).toBeCloseTo(3.41);
    expect(conversion().monthlyInternalAmounts?.[5]).toBe(4350);
    deleteFlowExternalData(row.externalSupplyId,6);
    expect(conversion().monthlyInternalAmounts?.[5]).toBe(4600);
    expect(conversionFlow().externalOutputStandardAmount).toBe(0);
  });
  it('includes December input, output, supply and loss in the annual flow without changing June', () => {
    const before = buildFlowAnalysisDataset(annualPeriod);
    const juneBefore = buildFlowAnalysisDataset(period);
    const input = source();
    expect(saveV11EnergyRecord({ ...input, monthlyAmounts: input.monthlyAmounts.map((n, i) => i === 11 ? n + 1000 : n) }, input.energyRecordId).ok).toBe(true);
    const output = conversion();
    expect(saveFlowConversion({ ...output, monthlyOutputAmounts: output.monthlyOutputAmounts!.map((n, i) => i === 11 ? n + 100 : n), monthlyLossAmounts: Array.from({ length: 12 }, (_, i) => i === 11 ? 20 : 0), monthlyLossReported: Array.from({ length: 12 }, (_, i) => i === 11), lossAmount: 20 }, output.conversionOutputId).ok).toBe(true);
    const supply = listV11ExternalSupplyRecords().find(row => row.conversionOutputId === output.conversionOutputId)!;
    expect(saveFlowExternal({ ...supply, monthlyAmounts: supply.monthlyAmounts!.map((n, i) => i === 11 ? n + 50 : n) }, supply.externalSupplyId).ok).toBe(true);
    const after = buildFlowAnalysisDataset(annualPeriod);
    const original = before.conversionDifferenceRows.find(row => row.conversionOutputId === output.conversionOutputId)!;
    const updated = after.conversionDifferenceRows.find(row => row.conversionOutputId === output.conversionOutputId)!;
    expect(updated.inputStandardAmount - original.inputStandardAmount).toBeCloseTo(1.33);
    expect(updated.outputStandardAmount - original.outputStandardAmount).toBeCloseTo(3.41);
    expect(updated.externalOutputStandardAmount - original.externalOutputStandardAmount).toBeCloseTo(1.705);
    expect(after.confirmedConversionLossStandardCoalAmount - before.confirmedConversionLossStandardCoalAmount).toBeCloseTo(0.682);
    expect(after.nodes.find(node => node.nodeId === 'conversion:v11-output-201')?.detailLabelSecondary).toContain('已确认损失 0.7 tce');
    expect(buildFlowAnalysisDataset(period).conversionDifferenceRows).toEqual(juneBefore.conversionDifferenceRows);
    const monthly = Array.from({ length: 12 }, (_, i) => buildFlowAnalysisDataset({ ...period, month: i + 1 }));
    expect(after.conversionDifferenceRows.reduce((total, row) => total + row.outputStandardAmount, 0)).toBeCloseTo(monthly.reduce((total, flow) => total + flow.conversionDifferenceRows.reduce((sum, row) => sum + row.outputStandardAmount, 0), 0));
    expect(after.externalStandardCoalAmount).toBeCloseTo(monthly.reduce((total, flow) => total + flow.externalStandardCoalAmount, 0));
    expect(after.confirmedConversionLossStandardCoalAmount).toBeCloseTo(monthly.reduce((total, flow) => total + flow.confirmedConversionLossStandardCoalAmount, 0));
  });
  it('omits missing December data and invalid external supply from annual totals', () => {
    const input = source(); const output = conversion();
    const reported = Array.from({ length: 12 }, (_, i) => i !== 11);
    expect(saveV11EnergyRecord({ ...input, monthlyReportedMonths: reported }, input.energyRecordId).ok).toBe(true);
    expect(saveFlowConversion({ ...output, monthlyOutputReported: reported }, output.conversionOutputId).ok).toBe(true);
    const annual = buildFlowAnalysisDataset(annualPeriod);
    const row = annual.conversionDifferenceRows.find(item => item.conversionOutputId === output.conversionOutputId)!;
    expect(row.inputStandardAmount).toBeCloseTo(input.monthlyAmounts.slice(0, 11).reduce((a, b) => a + b, 0) * 1.33 / 1000);
    expect(row.outputStandardAmount).toBeCloseTo(output.monthlyOutputAmounts!.slice(0, 11).reduce((a, b) => a + b, 0) * 0.0341);
    const supply = listV11ExternalSupplyRecords().find(item => item.conversionOutputId === output.conversionOutputId)!;
    expect(row.externalOutputStandardAmount).toBeCloseTo(supply.monthlyAmounts!.slice(0, 11).reduce((a, b) => a + b, 0) * 0.0341);
  });
  it('keeps annual-only input and output in annual analysis without creating December values', () => {
    const input = source();
    expect(saveV11EnergyRecord({ ...input, annualAmount: 1600000, monthlyAmounts: Array(12).fill(0), monthlyReportedMonths: Array(12).fill(false) }, input.energyRecordId).ok).toBe(true);
    const output = listV11ConversionOutputs().find(row => row.conversionOutputId === 'v11-output-captive-power')!;
    expect(saveV11ConversionOutput({ ...output, monthlyOutputAmounts: undefined, monthlyInternalAmounts: undefined }, output.conversionOutputId).ok).toBe(true);
    const annual = buildFlowAnalysisDataset(annualPeriod);
    expect(annual.conversionDifferenceRows.find(row => row.conversionOutputId === conversion().conversionOutputId)?.inputStandardAmount).toBeCloseTo(2128);
    expect(annual.conversionDifferenceRows.find(row => row.conversionOutputId === output.conversionOutputId)?.outputStandardAmount).toBeCloseTo(output.outputAmount! * 0.1229 / 1000);
    const december = buildFlowAnalysisDataset({ ...period, month: 12 });
    expect(december.conversionDifferenceRows.find(row => row.conversionOutputId === conversion().conversionOutputId)?.inputStandardAmount).toBe(0);
    expect(december.conversionDifferenceRows.find(row => row.conversionOutputId === output.conversionOutputId)?.outputStandardAmount).toBe(0);
    expect(annual.detailRows.flatMap(row => row.traceRecords).every(row => row.periodLabel === '2026年度')).toBe(true);
  });

});
