import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { listV11EnergyRecords, listV11EnergyCosts, listV11ConversionOutputs, listV11ExternalSupplyRecords, saveV11EnergyRecord, saveV11EnergyCost, resetDataManagementV11Store } from '../src/mocks/dataManagementV11Store';
import { getDeviceIntensityParameter, saveDeviceIntensityParameter, resetDeviceIntensityParameters } from '../src/mocks/deviceIntensityParameterStore';
import { resetEnergyUnitMockStore } from '../src/mocks/energyUnitMockStore';

let container: HTMLDivElement;
let root: Root;
const scenarios = [
  { name: '能源消费', path: '/data-management/energy-data?year=2026&scopeLevel=企业', region: '月度明细', input: '6月能源数量', save: '保存', scope: 'table', read: () => listV11EnergyRecords().find((row) => row.year === 2026 && row.scopeLevel === '企业' && row.energyTypeId === 'v11-energy-electricity')!.monthlyAmounts },
  { name: '能源成本', path: '/data-management/energy-data?tab=costs&year=2026', region: '月度明细', input: '6月成本', save: '保存', scope: 'table', read: () => listV11EnergyCosts().find((row) => row.year === 2026)!.monthlyCosts },
  { name: '设备产出', path: '/data-management/device-output?year=2026&deviceId=v11-device-81', region: '月度明细', input: '6月发电量', save: '保存并重新计算', scope: 'table', read: () => getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!.monthlyValues! },
  { name: '能源转换', path: '/data-management/energy-data?tab=conversion&year=2026', region: '能源产出月度明细', input: '6月产出量', save: '保存', scope: 'section[aria-label="用能单元数据"]', row: '余热发电机组', read: () => listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!.monthlyOutputAmounts! },
  { name: '外供', path: '/data-management/energy-data?tab=conversion&year=2026', region: '外供月度明细', input: '6月外供数量', save: '保存', scope: 'section[aria-label="对外供能台账"]', row: '余热发电机组', read: () => listV11ExternalSupplyRecords().find((row) => row.year === 2026 && row.conversionOutputId === 'v11-output-200')!.monthlyAmounts! },
];
function button(label: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === label);
  if (!found) throw new Error('未找到按钮：' + label);
  return found;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function change(input: HTMLInputElement, value: string) { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
}); }

describe('consistent data editing dialogs', () => {
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); resetDataManagementV11Store(); resetDeviceIntensityParameters(); resetEnergyUnitMockStore(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  it.each(scenarios)('$name edits in a dialog, preserves list structure and saves only the changed month', async (scenario) => {
    const before = [...scenario.read()];
    await act(async () => root.render(<MemoryRouter initialEntries={[scenario.path]}><DataManagementV11 pathname={scenario.path.split('?')[0]} /></MemoryRouter>));
    const scope = container.querySelector(scenario.scope)!;
    const row = [...scope.querySelectorAll('tbody tr')].find((row) => (!scenario.row || row.textContent?.includes(scenario.row)) && [...row.querySelectorAll('button')].some((button) => button.textContent === '编辑'))!;
    const rowCount = scope.querySelectorAll('tbody tr').length;
    const input = () => container.querySelector<HTMLInputElement>('[aria-label="' + scenario.input + '"]')!;
    await click(button('编辑', row));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.contains(input())).toBe(true);
    expect(container.querySelector('[data-inline-editor]')).toBeNull();
    expect(scope.querySelectorAll('tbody tr')).toHaveLength(rowCount);
    const original = input().value;
    await change(input(), String(Number(original) + 1));
    await click(button('取消', dialog));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(scope.querySelectorAll('tbody tr')).toHaveLength(rowCount);
    expect(scenario.read()).toEqual(before);
    await click(button('编辑', row));
    expect(input().value).toBe(original);
    await change(input(), String(Number(original) + 1));
    await click(button(scenario.save, container.querySelector('[role="dialog"]')!));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(scope.querySelectorAll('tbody tr')).toHaveLength(rowCount);
    expect(scenario.read()[5]).toBe(Number(original) + 1);
    expect(scenario.read().filter((_, i) => i !== 5)).toEqual(before.filter((_, i) => i !== 5));
    await click(button('查看', row));
    const detail = container.querySelector('[aria-label="' + scenario.region + '"]')!;
    expect(detail).not.toBeNull();
    expect(detail.querySelector('input')).toBeNull();
    const expandedCount = scope.querySelectorAll('tbody tr').length;
    await click(button('编辑', row));
    expect(input().value).toBe(String(Number(original) + 1));
    expect(scope.querySelectorAll('tbody tr')).toHaveLength(expandedCount);
    await click(button('取消', container.querySelector('[role="dialog"]')!));
    await click(button('收起明细'));
    expect(container.querySelector('[aria-label="' + scenario.region + '"]')).toBeNull();
  });

  it.each(scenarios.slice(0, 3))('$name keeps annual supplementation in a dialog without filling missing months', async (scenario) => {
    const values = [10, ...Array(11).fill(0)];
    const reported = [true, ...Array(11).fill(false)];
    if (scenario.name === '能源消费') {
      const row = listV11EnergyRecords().find((row) => row.year === 2026 && row.scopeLevel === '企业' && row.energyTypeId === 'v11-energy-electricity')!;
      expect(saveV11EnergyRecord({ ...row, monthlyAmounts: values, monthlyReportedMonths: reported, annualAmount: 100 }, row.energyRecordId).ok).toBe(true);
    } else if (scenario.name === '能源成本') {
      const row = listV11EnergyCosts().find((row) => row.year === 2026)!;
      expect(saveV11EnergyCost({ ...row, monthlyCosts: values, monthlyReportedMonths: reported, annualCost: 100 }, row.energyCostId).ok).toBe(true);
    } else {
      const row = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
      expect(saveDeviceIntensityParameter({ ...row, monthlyValues: [10, ...Array(11).fill(null)], monthlyReportedMonths: reported, value: 100, annualValue: 100, entryMode: 'annual-fallback' }).ok).toBe(true);
    }
    const before = [...scenario.read()];
    await act(async () => root.render(<MemoryRouter initialEntries={[scenario.path]}><DataManagementV11 pathname={scenario.path.split('?')[0]} /></MemoryRouter>));
    await click(button('查看')); await click(button('编辑'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const form = container.querySelector('[role="dialog"]')!;
    const field = [...form.querySelectorAll('label')].find((label) => label.textContent?.startsWith('年度'))!.querySelector('input')!;
    expect(field.value).toBe('100'); await change(field, '200'); await click(button(scenario.save));
    expect(scenario.read()).toEqual(before);
    expect(container.querySelector('[aria-label="月度明细"]')?.textContent).toContain('200');
    expect([...container.querySelectorAll('[aria-label="月度明细"] [data-month] > strong')].map((item) => item.textContent)).toEqual(['10', ...Array(11).fill('—')]);
    await click(button('收起明细')); expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
