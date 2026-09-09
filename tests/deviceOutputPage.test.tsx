import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { listV11KeyDevices, resetDataManagementV11Store } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { getDeviceIntensityParameter, saveDeviceIntensityParameter, resetDeviceIntensityParameters } from '../src/mocks/deviceIntensityParameterStore';

let container: HTMLDivElement;
let root: Root;

async function render(pathname = '/data-management/device-output?year=2026') {
  await act(async () => root.render(<MemoryRouter initialEntries={[pathname]}><DataManagementV11 pathname={pathname} /></MemoryRouter>));
}
async function click(button: HTMLElement) { await act(async () => button.click()); }
function pageButton(text: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`未找到按钮：${text}`);
  return button as HTMLButtonElement;
}

describe('device output page inheritance and entry', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    resetDataManagementV11Store();
    resetDeviceIntensityParameters();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('cancels or deletes only the selected annual output while retaining the device and flow', async () => {
    const current = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...current, year: 2025 });
    const flow = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    await render('/data-management/device-output?year=2026&deviceId=v11-device-81');
    await click(pageButton('删除'));
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('2026年度的全部产出数据');
    await click(pageButton('取消'));
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')).toEqual(current);
    await click(pageButton('删除')); await click(pageButton('确认删除'));
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')).toBeUndefined();
    expect(getDeviceIntensityParameter('v11-device-81', 2025, 'device-output-energy')).toEqual({ ...current, year: 2025 });
    expect(container.querySelector('tbody tr')?.textContent).toContain('待录入');
    expect(pageButton('录入')).toBeDefined();
    expect([...container.querySelectorAll('tbody button')].some((button) => button.textContent === '删除')).toBe(false);
    expect(buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1')).toEqual(flow);
  });

  it('inherits every key device and puts existing output data first', async () => {
    await render();
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(listV11KeyDevices().length);
    expect(rows[0].textContent).toContain('1#螺杆空压机');
    expect(rows[0].textContent).toContain('12/12月');
    expect(rows.at(-1)?.textContent).toContain('待录入');
  });

  it('allows a device without a prior output record to enter monthly data', async () => {
    await render('/data-management/device-output?year=2026&deviceId=v11-device-60');
    expect(container.textContent).toContain('待录入');
    await click(pageButton('录入'));
    const dialog = container.querySelector('[role="dialog"]')!;
    const input = dialog.querySelector<HTMLInputElement>('[aria-label="1月加工件产量"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '100');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const unit = dialog.querySelector<HTMLInputElement>('[aria-label="产出计量单位"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(unit, '件');
      unit.dispatchEvent(new Event('input', { bubbles: true }));
      unit.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(pageButton('保存并重新计算'));
    expect(getDeviceIntensityParameter('v11-device-60', 2026, 'custom-device-work')?.monthlyValues?.[0]).toBe(100);
    expect(container.textContent).toContain('1/12月｜年度已补录');
  });
  it('keeps device edits independent from flow even from an old metric link', async () => {
    await render('/data-management/device-output?year=2026&deviceId=v11-device-81&metricCode=custom-device-work');
    const before = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    expect([...container.querySelectorAll('th')].map((el) => el.textContent)).toEqual(['重点设备', '所属用能单元', '设备产出口径', '数据进度', '年度值', '操作']);
    expect(container.textContent).not.toContain('能流');
    await click(pageButton('编辑'));
    const input = container.querySelector<HTMLInputElement>('[aria-label="6月发电量"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1800000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(pageButton('保存并重新计算'));
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'custom-device-work')).toBeUndefined();
    const flow = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')?.monthlyValues?.[5]).toBe(1800000);
    expect(flow).toEqual(before);
  });

  it('preserves missing months while displaying and saving explicitly reported zero', async () => {
    const current = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...current, value: 0, annualValue: 0, monthlyValues: Array(12).fill(0), monthlyReportedMonths: Array.from({ length: 12 }, (_, i) => i === 5) });
    await render('/data-management/device-output?year=2026&deviceId=v11-device-81');
    expect(container.querySelector('tbody tr')?.textContent).toContain('0 kWh');
    await click(pageButton('编辑'));
    expect(container.querySelector<HTMLInputElement>('[aria-label="1月发电量"]')?.value).toBe('');
    await click(pageButton('取消'));
    await click(pageButton('编辑'));
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月发电量"]')?.value).toBe('0');
    await click(pageButton('保存并重新计算'));
    const saved = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    expect(saved.monthlyValues?.[0]).toBeNull();
    expect(saved.monthlyReportedMonths?.filter(Boolean)).toHaveLength(1);
  });

});
