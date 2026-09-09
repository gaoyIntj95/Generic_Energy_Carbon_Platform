import { beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store, listV11ConversionOutputs, listV11ExternalSupplyRecords, saveFlowExternal, saveFlowConversion, deleteV11ExternalSupplyRecord, flowExternalIssue } from '../src/mocks/dataManagementV11Store';
import { getDeviceIntensityParameter, saveDeviceIntensityParameter } from '../src/mocks/deviceIntensityParameterStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';

const period = { year: 2026, grain: 'month' as const, month: 6 };
const output = (id = 'v11-output-200') => listV11ConversionOutputs().find((r) => r.conversionOutputId === id)!;
const external = (amount: number, conversionOutputId = 'v11-output-201') => ({ year: 2026, conversionOutputId, energyTypeId: 'v11-energy-steam', receiver: '新增外部客户', unit: 'GJ', amount, monthlyAmounts: Array.from({ length: 12 }, (_, i) => i === 5 ? amount : 0), monthlyReported: Array.from({ length: 12 }, (_, i) => i === 5), remark: '' });

describe('simplified energy flow data contract', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('reads authoritative device output live without changing the legacy output snapshot', () => {
    const p = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...p, monthlyValues: p.monthlyValues!.map((v, i) => i === 5 ? 1800000 : v), annualValue: p.annualValue! + 200000 });
    expect(output().monthlyOutputAmounts?.[5]).toBe(1800000);
    expect(output().monthlyInternalAmounts?.[5]).toBe(1650000);
    const flow = buildFlowAnalysisDataset(period, 'level1');
    expect(flow.conversionDifferenceRows.find((r) => r.conversionOutputId === 'v11-output-200')?.outputStandardAmount).toBeCloseTo(1800000 * 0.1229 / 1000);
  });

  it('does not replace a system total with one compressed-air device', () => {
    expect(output('v11-output-compressed-air-2026').outputDeviceId).toBeUndefined();
    expect(output('v11-output-compressed-air-2026').monthlyOutputAmounts?.[5]).toBe(980000);
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

  it('retains missing device output as missing and does not spread annual output into a month', () => {
    const p = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...p, monthlyValues: Array(12).fill(null), monthlyReportedMonths: Array(12).fill(false) });
    expect(output().monthlyOutputReported?.[5]).toBe(false);
    expect(output().monthlyOutputAmounts?.[5]).toBe(0);
    expect(buildFlowAnalysisDataset(period, 'level1').dataNotice).toContain('本月设备产出待补录');
  });

  it('validates steam conversion units before enabling the device source', () => {
    const boiler = output('v11-output-201');
    saveDeviceIntensityParameter({ deviceId: 'v11-device-82', year: 2026, metricCode: 'boiler-standard-coal', value: 24000, unit: 't', monthlyValues: Array(12).fill(2000), monthlyReportedMonths: Array(12).fill(true) });
    expect(saveFlowConversion({ ...boiler, outputDeviceId: 'v11-device-82' }, boiler.conversionOutputId).ok).toBe(true);
    expect(output('v11-output-201').outputSourceIssue).toContain('换算依据');
    expect(saveFlowConversion({ ...boiler, outputDeviceId: 'v11-device-82', outputUnitFactor: 2.5, outputUnitBasis: '本企业蒸汽焓值核算' }, boiler.conversionOutputId).ok).toBe(true);
    expect(output('v11-output-201').monthlyOutputAmounts?.[5]).toBe(5000);
  });

  it('saves pending external facts but excludes them from effective flow until output is reported', () => {
    const boiler = output('v11-output-201');
    expect(saveFlowConversion({ ...boiler, outputDeviceId: 'v11-device-82' }, boiler.conversionOutputId).ok).toBe(true);
    expect(saveFlowExternal(external(100)).ok).toBe(true);
    const saved = listV11ExternalSupplyRecords().find((r) => r.receiver === '新增外部客户')!;
    expect(flowExternalIssue(saved, 6)).toContain('待补录');
    const flow = buildFlowAnalysisDataset(period, 'level1');
    expect(flow.dataNotice).toContain('部分外供记录待核验');
  });

  it('prevents duplicate device and input references', () => {
    const current = output();
    expect(saveFlowConversion({ ...current, outputEnergyTypeId: 'v11-energy-steam' })).toMatchObject({ ok: false });
  });
});
