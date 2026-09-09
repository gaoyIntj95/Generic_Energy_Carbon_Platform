import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { listV11EnergyCosts, listV11OperationMetrics, resetDataManagementV11Store, saveV11EnergyCost } from '../src/mocks/dataManagementV11Store';
import { getDeviceIntensityParameter, resetDeviceIntensityParameters, saveDeviceIntensityParameter } from '../src/mocks/deviceIntensityParameterStore';

let container: HTMLDivElement;
let root: Root;
async function render(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><DataManagementV11 pathname={path.split('?')[0]} /></MemoryRouter>));
}
function button(text: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll('button')].find((item) => item.textContent === text);
  if (!found) throw new Error(`未找到按钮 ${text}`);
  return found;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function monthlyValues() { return [...container.querySelectorAll('[aria-label="月度明细"] [class*="monthDetailGrid"] strong')].map((item) => item.textContent); }

describe('annual ledgers and shared monthly details', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    resetDataManagementV11Store(); resetDeviceIntensityParameters();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it.each(['/data-management/energy-data', '/data-management/energy-data?tab=costs', '/data-management/energy-data?tab=conversion', '/data-management/device-output', '/data-management/operations'])(
    'keeps the year first and removes month and period-grain filters on %s', async (path) => {
      await render(path);
      const toolbar = container.querySelector('[class*="toolbar"]')!;
      expect(toolbar.querySelector('label')?.textContent).toMatch(/^年度/);
      expect(toolbar.querySelector('select')?.value).toBe('2026');
      expect(toolbar.querySelector('input[type="month"], input[type="date"], [aria-label="时间粒度"]')).toBeNull();
      expect([...toolbar.querySelectorAll('option')].map((item) => item.textContent)).not.toContain('月度');
    },
  );

  it('shows annual cost in the list, expands actual months, and edits all monthly fields inline', async () => {
    const item = listV11EnergyCosts().find((row) => row.year === 2026)!;
    expect(saveV11EnergyCost({ ...item, monthlyCosts: [0, 25, ...Array(10).fill(0)], monthlyReportedMonths: [true, true, ...Array(10).fill(false)], annualCost: 100 }, item.energyCostId).ok).toBe(true);
    const before = listV11EnergyCosts();
    await render('/data-management/energy-data?tab=costs&year=2026');
    expect([...container.querySelectorAll('th')].map((el) => el.textContent)).toEqual(['能源品种', '年度合计（万元）', '操作']);
    expect(monthlyValues()).toHaveLength(0);
    await click(button('查看'));
    expect(monthlyValues()).toEqual(['0', '25', ...Array(10).fill('—')]);
    expect(container.querySelector('[aria-label="月度明细"]')?.textContent).toContain('年度总量（补录）');
    expect(listV11EnergyCosts()).toEqual(before);
    await click(button('收起')); expect(monthlyValues()).toHaveLength(0);
    await click(button('编辑'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const field = container.querySelector<HTMLInputElement>('[aria-label="3月成本"]')!;
    expect(field.value).toBe('');
    await change(field, '10'); await click(button('保存'));
    const saved = listV11EnergyCosts().find((row) => row.energyCostId === item.energyCostId)!;
    expect(saved.monthlyCosts).toEqual([0, 25, 10, ...Array(9).fill(0)]);
    expect(saved.monthlyReportedMonths?.slice(0, 4)).toEqual([true, true, true, false]);
    await change(container.querySelector('select')!, '2025');
    expect(monthlyValues()).toHaveLength(0);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(listV11EnergyCosts().filter((row) => row.year === 2025)).toEqual(before.filter((row) => row.year === 2025));
  });

  it('keeps missing device months distinct from explicit zero and edits all months without repeated edit buttons', async () => {
    const item = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')!;
    saveDeviceIntensityParameter({ ...item, monthlyValues: [0, 12, ...Array(10).fill(null)], monthlyReportedMonths: [true, true, ...Array(10).fill(false)] });
    const before = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy');
    await render('/data-management/device-output?year=2026&deviceId=v11-device-81');
    await click(button('查看'));
    expect(monthlyValues()).toEqual(['0', '12', ...Array(10).fill('—')]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')).toEqual(before);
    await click(button('编辑'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const fields = container.querySelectorAll<HTMLInputElement>('[data-inline-editor] input');
    const monthFields = [...fields].filter((field) => /^\d{1,2}月/.test(field.getAttribute('aria-label') ?? ''));
    expect(monthFields).toHaveLength(12); expect(monthFields[0].value).toBe('0'); expect(monthFields[2].value).toBe('');
    expect([...container.querySelectorAll('[data-inline-editor] button')].map((el) => el.textContent)).toEqual(['取消', '保存并重新计算']);

  });

  it('only offers entry for a device with no output record', async () => {
    await render('/data-management/device-output?year=2026&deviceId=v11-device-60');
    expect(button('录入')).toBeDefined();
    expect([...container.querySelectorAll('tbody button')].map((el) => el.textContent)).not.toContain('查看');
  });

  it('shows twelve empty months for annual-only operation data without allocating the annual value', async () => {
    const item = listV11OperationMetrics().find((row) => row.year === 2026 && row.entryMode === 'annual' && row.metricCategory === '经济指标')!;
    const before = listV11OperationMetrics();
    await render('/data-management/operations?year=2026');
    const row = [...container.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes(item.metricName) && [...tr.querySelectorAll('button')].some((el) => el.textContent === '查看'))!;
    await click(button('查看', row));
    expect(monthlyValues()).toEqual(Array(12).fill('—'));
    expect(container.querySelector('[aria-label="月度明细"]')?.textContent).toContain('仅有年度数据，暂无月度明细');
    expect(listV11OperationMetrics()).toEqual(before);
  });
  it.each(['/data-management/energy-data', '/data-management/energy-data?tab=costs', '/data-management/device-output', '/data-management/operations'])(
    'distinguishes read-only viewing from one complete inline editor on %s', async (path) => {
      await render(path);
      await click(button('查看'));
      const detail = container.querySelector('[aria-label="月度明细"]')!;
      expect(detail.querySelectorAll('input, select')).toHaveLength(0);
      expect([...detail.querySelectorAll('button')].some((el) => el.textContent === '编辑')).toBe(false);
      await click(button('编辑'));
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      const form = container.querySelector('[data-inline-editor]')!;
      expect(form).not.toBeNull();
      expect([...form.querySelectorAll('button')].some((el) => el.textContent === '编辑')).toBe(false);
      expect(form.querySelectorAll('footer button')).toHaveLength(2);
      expect(form.querySelectorAll('[class*="monthGrid"] input')).toHaveLength(12);
      await click(button('取消', form));
      expect(container.querySelector('[data-inline-editor]')).toBeNull();
    },
  );

});
