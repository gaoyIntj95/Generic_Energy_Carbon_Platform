import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { listV11ConversionOutputs, listV11EnergyRecords, resetDataManagementV11Store, saveV11EnergyRecord, saveV11ConversionOutput, deleteV11EnergyRecord, v11EnergyRecordAnnualAmount } from '../src/mocks/dataManagementV11Store';
import { resetEnergyUnitMockStore } from '../src/mocks/energyUnitMockStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';

let container: HTMLDivElement;
let root: Root;
const period = { year: 2026, grain: 'month' as const, month: 6 };
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
async function render(url = '/data-management/energy-data?year=2026&scopeLevel=二级用能单元') {
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}><DataManagementV11 pathname="/data-management/energy-data" /><LocationProbe /></MemoryRouter>));
}
async function clickButton(text: string, scope: ParentNode = container) {
  const button = [...scope.querySelectorAll('button')].find(button => button.textContent === text);
  expect(button, text).toBeDefined(); await act(async () => button!.click());
}
async function changeMonth(value: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="6月能源数量"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
}
const output = (id: string) => listV11ConversionOutputs().find(row => row.conversionOutputId === id)!;
const source = (id: string) => listV11EnergyRecords().find(row => row.energyRecordId === output(id).inputEnergyRecordId)!;
const inputRow = (name: string) => container.querySelector('[aria-label="' + name + '"]')!.closest('tr')!;
const editUrl = (id: string) => '/data-management/energy-data?tab=conversion&year=2026&month=6&editConversionId=' + id;

describe('unified second-level conversion inputs', () => {
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); resetDataManagementV11Store(); resetEnergyUnitMockStore(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it('shows all six system inputs in second-level consumption with the same ledger quantities', async () => {
    await render();
    const names = ['余热发电机组下的余热', '锅炉系统下的天然气', '余热回收利用系统下的余热', '自备发电机组下的原煤', '余压回收系统下的余压', '空压系统下的电力'];
    for (const name of names) expect(inputRow(name).textContent).toContain('二级用能单元');
    expect(container.querySelectorAll('tbody tr').length).toBe(12);
    for (const conversion of listV11ConversionOutputs().filter(row => row.year === 2026)) {
      const input = source(conversion.conversionOutputId);
      expect(input.energyUnitId).toBe(conversion.conversionEnergyUnitId);
      expect(input.scopeLevel).toBe('二级用能单元');
    }
    expect(inputRow(names[0]).textContent).toContain(v11EnergyRecordAnnualAmount(source('v11-output-200')).toLocaleString('zh-CN'));
  });

  it('shows the seeded missing month on the annual list and completes the supplement round trip', async () => {
    const original = source('v11-output-pressure-recovery');
    const originalOutput = output('v11-output-pressure-recovery');
    expect(original.monthlyReportedMonths?.[11]).toBe(false);
    expect(listV11EnergyRecords().find(row => row.energyRecordId === 'v11-er-recovery-pressure-2025')?.monthlyReportedMonths?.[11]).not.toBe(false);
    await render('/data-management/energy-data?tab=conversion&year=2026');
    const conversionRow = () => [...container.querySelectorAll('section[aria-label="用能单元数据"] tbody tr')].find(row => row.querySelector('td > strong')?.textContent === '余压回收系统')!;
    expect(conversionRow().textContent).toContain('缺 12 月投入');
    expect(conversionRow().textContent).toContain('查看');
    await clickButton('补充数据', conversionRow());
    const url = new URL(container.querySelector('[data-testid="location"]')!.textContent!, 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ year: '2026', month: '12', unitId: 'eu-pressure-recovery', scopeLevel: '二级用能单元', energyTypeId: 'v11-energy-waste-pressure', recordId: original.energyRecordId, entry: 'list' });
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')).toBeNull();
    expect(container.querySelectorAll('[aria-label$="下的余压"]')).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('[aria-label="能源消费关键字"]')?.value).toBe('余压回收系统');
    await clickButton('编辑', inputRow('余压回收系统下的余压'));
    const input = container.querySelector<HTMLInputElement>('[aria-label="12月能源数量"]')!;
    expect(input.value).toBe('');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await clickButton('保存');
    expect(conversionRow().textContent).not.toContain('补充数据');
    expect(source('v11-output-pressure-recovery').monthlyReportedMonths?.[11]).toBe(true);
    expect(source('v11-output-pressure-recovery').monthlyAmounts.slice(0, 11)).toEqual(original.monthlyAmounts.slice(0, 11));
    expect(output('v11-output-pressure-recovery').monthlyOutputAmounts).toEqual(originalOutput.monthlyOutputAmounts);
  });

  it('edits recovered heat in the same list without changing its role, output, or enterprise purchases', async () => {
    const before = output('v11-output-200'); const originalSource = source(before.conversionOutputId); const originalFlow = buildFlowAnalysisDataset(period);
    await render(); await clickButton('编辑', inputRow('余热发电机组下的余热')); await clickButton('编辑', container.querySelector('[aria-label="月度明细"] [data-month="6"]')!);
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).toContain('动力中心');
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).not.toContain('余热产生设备');
    await changeMonth('7800'); await clickButton('保存');
    expect(source(before.conversionOutputId)).toMatchObject({ energyRole: '回收能源', energyUnitId: 'eu-waste-heat-power', sourceDeviceId: originalSource.sourceDeviceId });
    expect(output(before.conversionOutputId).monthlyOutputAmounts).toEqual(before.monthlyOutputAmounts);
    const flow = buildFlowAnalysisDataset(period);
    expect(flow.levelOneBalanceRows.reduce((total, row) => total + row.externalInputStandardAmount, 0)).toBe(originalFlow.levelOneBalanceRows.reduce((total, row) => total + row.externalInputStandardAmount, 0));
    expect(flow.links.find(link => link.linkId === 'conversion:v11-output-200:recovery-input')?.calculation?.physicalAmount).toBeCloseTo(7800);
    expect(flow.links.find(link => link.linkId === 'conversion:v11-output-200:recovery-input')?.sourceNodeId).toBe('distribution:eu-cement-grinding-line');
  });

  it('opens a filtered list for a missing boiler month and waits for a manual edit', async () => {
    const original = source('v11-output-201');
    expect(saveV11EnergyRecord({ ...original, monthlyReportedMonths: Array.from({ length: 12 }, (_, i) => i !== 5) }, original.energyRecordId).ok).toBe(true);
    await render(editUrl('v11-output-201')); await clickButton('补充数据');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="能源消费关键字"]')?.value).toBe('锅炉系统');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain('scopeLevel=');
    await clickButton('编辑', inputRow('锅炉系统下的天然气')); await clickButton('编辑', container.querySelector('[aria-label="月度明细"] [data-month="6"]')!);
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月能源数量"]')?.value).toBe('');
    await changeMonth('130000'); await clickButton('保存');
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).toContain('130,000 Nm³');
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).not.toContain('补充数据');
    expect(source('v11-output-201').monthlyAmounts.filter((_, i) => i !== 5)).toEqual(original.monthlyAmounts.filter((_, i) => i !== 5));
  });

  it.each(['v11-output-captive-power', 'v11-output-200'])('creates a missing input manually with blank quantities for %s', async id => {
    const row = output(id); const originalSource = source(id);
    expect(saveV11ConversionOutput({ ...row, inputEnergyRecordId: undefined, inputMode: row.inputMode === 'recovery' ? 'recovery' : 'manual' }, id).ok).toBe(true);
    expect(deleteV11EnergyRecord(originalSource.energyRecordId).ok).toBe(true);
    const count = listV11EnergyRecords().length;
    expect(buildFlowAnalysisDataset(period).conversionDifferenceRows.find(item => item.conversionOutputId === id)?.inputStandardAmount).toBe(0);
    await render(editUrl(id)); expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).toContain('待填报'); await clickButton('补充数据');
    expect(container.querySelector('[role="dialog"]')).toBeNull(); expect(listV11EnergyRecords()).toHaveLength(count);
    await clickButton('＋ 新增能源消费');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月能源数量"]')?.value).toBe('');
    await clickButton('取消'); expect(container.querySelector('[role="dialog"]')).toBeNull(); expect(listV11EnergyRecords()).toHaveLength(count);
    await clickButton('＋ 新增能源消费'); await changeMonth('175'); await clickButton('保存');
    expect(listV11EnergyRecords()).toHaveLength(count + 1);
    expect(source(id)).toMatchObject({ energyUnitId: row.conversionEnergyUnitId, energyRole: originalSource.energyRole, scopeLevel: '二级用能单元' });
    expect(source(id).monthlyAmounts[5]).toBe(175);
    expect(source(id).monthlyReportedMonths?.filter(Boolean)).toHaveLength(1);
    expect(output(id).monthlyOutputAmounts).toEqual(row.monthlyOutputAmounts);
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).not.toContain('补充数据');
  });

  it('treats explicitly reported zero input as complete', async () => {
    const original = source('v11-output-201');
    expect(saveV11EnergyRecord({ ...original, monthlyAmounts: original.monthlyAmounts.map((value, i) => i === 5 ? 0 : value), monthlyReportedMonths: Array(12).fill(true) }, original.energyRecordId).ok).toBe(true);
    await render(editUrl('v11-output-201'));
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).toContain('0 Nm³');
    expect(container.querySelector('[data-inline-editor], [role="dialog"]')?.textContent).not.toContain('补充数据');
  });
});
