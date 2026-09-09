import { beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store, listV11ConversionOutputs, listV11ExternalSupplyRecords, saveFlowExternal, saveFlowConversion, deleteV11ExternalSupplyRecord, flowExternalIssue } from '../src/mocks/dataManagementV11Store';
import { getDeviceIntensityParameter, saveDeviceIntensityParameter } from '../src/mocks/deviceIntensityParameterStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';

const period = { year: 2026, grain: 'month' as const, month: 6 };
const output = (id = 'v11-output-200') => listV11ConversionOutputs().find((r) => r.conversionOutputId === id)!;
const external = (amount: number, conversionOutputId = 'v11-output-201') => ({ year: 2026, conversionOutputId, energyTypeId: 'v11-energy-steam', receiver: '新增外部客户', unit: 'GJ', amount, monthlyAmounts: Array.from({ length: 12 }, (_, i) => i === 5 ? amount : 0), monthlyReported: Array.from({ length: 12 }, (_, i) => i === 5), remark: '' });

describe('simplified energy flow data contract', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('keeps unit output and flow unchanged when device output changes', () => {
    const before = buildFlowAnalysisDataset(period, 'level1');
    const p = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...p, monthlyValues: p.monthlyValues!.map((v, i) => i === 5 ? 1800000 : v), annualValue: p.annualValue! + 200000 });
    expect(output().monthlyOutputAmounts?.[5]).toBe(1600000);
    expect(buildFlowAnalysisDataset(period, 'level1')).toEqual(before);
  });

  it('updates flow from unit output without changing device data', () => {
    const before = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy');
    const current = output();
    const monthlyOutputAmounts = current.monthlyOutputAmounts!.map((v, i) => i === 5 ? 1800000 : v);
    expect(saveFlowConversion({ ...current, monthlyOutputAmounts, outputAmount: monthlyOutputAmounts.reduce((a, b) => a + b, 0) }, current.conversionOutputId).ok).toBe(true);
    expect(output().monthlyInternalAmounts?.[5]).toBe(1650000);
    const flow = buildFlowAnalysisDataset(period, 'level1');
    expect(flow.conversionDifferenceRows.find((r) => r.conversionOutputId === current.conversionOutputId)?.outputStandardAmount).toBeCloseTo(1800000 * 0.1229 / 1000);
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')).toEqual(before);
  });

  it('adds external supply by reducing internal availability, and deletion restores it', () => {
    const before = buildFlowAnalysisDataset(period, 'level1');
    expect(saveFlowExternal(external(100)).ok).toBe(true);
    expect(output('v11-output-201').monthlyInternalAmounts?.[5]).toBe(4350);
    const after = buildFlowAnalysisDataset(period, 'level1');
    expect(after.externalStandardCoalAmount - before.externalStandardCoalAmount).toBeCloseTo(3.41);
    const saved = listV11ExternalSupplyRecords().find((r) => r.receiver === '新增外部客户')!;
    deleteV11ExternalSupplyRecord(saved.externalSupplyId);
    expect(output('v11-output-201').monthlyInternalAmounts?.[5]).toBe(4450);
  });

  it('rejects cumulative external overflow without changing stored records', () => {
    const count = listV11ExternalSupplyRecords().length;
    expect(saveFlowExternal(external(4500))).toMatchObject({ ok: false });
    expect(listV11ExternalSupplyRecords()).toHaveLength(count);
  });

  it('retains missing unit output as missing and does not spread annual output into a month', () => {
    const current = output();
    expect(saveFlowConversion({ ...current, monthlyOutputReported: Array(12).fill(false) }, current.conversionOutputId).ok).toBe(true);
    expect(output().monthlyOutputReported?.[5]).toBe(false);
    expect(output().monthlyOutputAmounts?.[5]).toBe(0);
    expect(buildFlowAnalysisDataset(period, 'level1').dataNotice).toContain('本月单元产出待填报');
  });

  it('accepts unit steam totals independently of device output units', () => {
    const boiler = output('v11-output-201');
    saveDeviceIntensityParameter({ deviceId: 'v11-device-82', year: 2026, metricCode: 'boiler-standard-coal', value: 24000, unit: 't', monthlyValues: Array(12).fill(2000), monthlyReportedMonths: Array(12).fill(true) });
    expect(saveFlowConversion({ ...boiler, monthlyOutputAmounts: Array(12).fill(5000), outputAmount: 60000 }, boiler.conversionOutputId).ok).toBe(true);
    expect(output('v11-output-201').monthlyOutputAmounts?.[5]).toBe(5000);
    expect(output('v11-output-201').outputUnit).toBe('GJ');
    expect(getDeviceIntensityParameter('v11-device-82', 2026, 'boiler-standard-coal')?.unit).toBe('t');
  });

  it('saves pending external facts but excludes them from effective flow until output is reported', () => {
    const boiler = output('v11-output-201');
    expect(saveFlowConversion({ ...boiler, monthlyOutputReported: Array(12).fill(false) }, boiler.conversionOutputId).ok).toBe(true);
    expect(saveFlowExternal(external(100)).ok).toBe(true);
    const saved = listV11ExternalSupplyRecords().find((r) => r.receiver === '新增外部客户')!;
    expect(flowExternalIssue(saved, 6)).toContain('待补录');
    const flow = buildFlowAnalysisDataset(period, 'level1');
    expect(flow.dataNotice).toContain('部分外供记录待核验');
  });

  it('prevents duplicate input references', () => {
    const current = output();
    expect(saveFlowConversion({ ...current, outputEnergyTypeId: 'v11-energy-steam' })).toMatchObject({ ok: false });
  });
  it('allows direct unit output maintenance without device templates', () => {
    const current = output('v11-output-pressure-recovery');
    const result = saveFlowConversion({ ...current, outputAmount: 900000, monthlyOutputAmounts: Array(12).fill(75000) }, current.conversionOutputId);
    expect(result.ok).toBe(true);
    expect(output(current.conversionOutputId).monthlyOutputAmounts?.[5]).toBe(75000);
    expect(getDeviceIntensityParameter('v11-device-84', 2026, 'custom-device-work')).toBeUndefined();
  });

  it('keeps historical totals while allowing loss and relation maintenance', () => {
    const current = output('v11-output-captive-power');
    expect(saveFlowConversion({ ...current, lossAmount: 10, monthlyLossAmounts: Array.from({ length: 12 }, (_, i) => i === 5 ? 10 : 0), lossBasis: '' }, current.conversionOutputId).ok).toBe(true);
    expect(output(current.conversionOutputId).monthlyOutputAmounts?.[5]).toBe(830000);
    expect(output(current.conversionOutputId).monthlyInternalAmounts?.[5]).toBe(829990);
  });

  it('distinguishes an explicitly reported zero from a missing month', () => {
    const current = output('v11-output-pressure-recovery');
    expect(saveFlowConversion({ ...current, outputAmount: 0, monthlyOutputAmounts: Array(12).fill(0), monthlyOutputReported: Array.from({ length: 12 }, (_, i) => i === 5) }, current.conversionOutputId).ok).toBe(true);
    expect(output(current.conversionOutputId).monthlyOutputReported?.[5]).toBe(true);
    expect(output(current.conversionOutputId).monthlyOutputReported?.[4]).toBe(false);
    expect(buildFlowAnalysisDataset(period, 'level1').dataNotice).not.toContain('余压回收系统：本月单元产出待填报');
    expect(buildFlowAnalysisDataset({ ...period, month: 5 }, 'level1').dataNotice).toContain('余压回收系统：本月单元产出待填报');
  });

});
