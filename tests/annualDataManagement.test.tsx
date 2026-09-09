import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addChildEnergyUnit, createEnergyUnit, deleteEnergyUnit, getEnergyUnit, listEnergyUnits, reorderEnergyUnits, resetEnergyUnitMockStore, updateEnergyUnit } from '../src/mocks/energyUnitMockStore';
import { deleteV11EnergyType, deleteV11KeyDevice, disableV11EnergyType, isV11EnergyTypeEnabled, listV11EnergyRecords, listV11EnergyTypes, listV11KeyDevices, resetDataManagementV11Store, saveV11EnergyRecord, saveV11EnergyType, saveV11KeyDevice } from '../src/mocks/dataManagementV11Store';
import { getProduct, linkProductEnergyUnit, updateProductAllocation } from '../src/mocks/productMasterStore';
import { getDeviceIntensityParameter, saveDeviceIntensityParameter } from '../src/mocks/deviceIntensityParameterStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { Sidebar } from '../src/components/Sidebar';

let container: HTMLDivElement;
let root: Root;
function App() {
  const location = useLocation();
  return <><Sidebar /><DataManagementV11 pathname={location.pathname} /><output data-testid="url">{location.pathname}{location.search}</output></>;
}
async function render(path: string) { await act(async () => root.render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)); }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  expect(element).toBeTruthy();
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function button(text: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);
  expect(result, text).toBeTruthy();
  return result!;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
function yearSelect() { return [...container.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.value === '2025'))!; }
function row(text: string) { return [...container.querySelectorAll('tbody tr')].find((item) => item.textContent?.includes(text))!; }

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  resetDataManagementV11Store();
  resetEnergyUnitMockStore();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('annual data management isolation', () => {
  it('isolates unit edits, hierarchy, sibling order and new units', () => {
    const original = getEnergyUnit('eu-clinker-line-1', 2025)!;
    expect(updateEnergyUnit(original.energyUnitId, { ...original, energyUnitName: '2026新车间' }, 2026).ok).toBe(true);
    expect(getEnergyUnit(original.energyUnitId, 2025)).toEqual(original);
    const created = createEnergyUnit({ energyUnitName: '当年新增车间', unitType: '生产单元' }, 2026).unit!;
    expect(getEnergyUnit(created.energyUnitId, 2025)).toBeUndefined();
    expect(addChildEnergyUnit(created.energyUnitId, { energyUnitName: '工序', unitType: '工序/环节' }, 2025).ok).toBe(false);
    const historyOrder = listEnergyUnits(2025).filter((unit) => !unit.parentEnergyUnitId).map((unit) => unit.energyUnitId);
    const currentOrder = listEnergyUnits(2026).filter((unit) => !unit.parentEnergyUnitId).map((unit) => unit.energyUnitId).reverse();
    expect(reorderEnergyUnits(null, currentOrder, 2026).ok).toBe(true);
    expect(listEnergyUnits(2025).filter((unit) => !unit.parentEnergyUnitId).map((unit) => unit.energyUnitId)).toEqual(historyOrder);
    expect(deleteEnergyUnit(created.energyUnitId, 2026).ok).toBe(true);
  });

  it('isolates energy coefficients, enabled state and annual device references', () => {
    const original = listV11EnergyTypes(2025).find((type) => type.energyTypeId === 'v11-energy-electricity')!;
    expect(saveV11EnergyType({ ...original, standardCoalFactor: 0.8 }, original.energyTypeId, 2026).ok).toBe(true);
    disableV11EnergyType(original.energyTypeId, 2026);
    expect(listV11EnergyTypes(2025).find((type) => type.energyTypeId === original.energyTypeId)).toEqual(original);
    expect(isV11EnergyTypeEnabled(original.energyTypeId, 2025)).toBe(true);
    expect(isV11EnergyTypeEnabled(original.energyTypeId, 2026)).toBe(false);
    expect(deleteV11KeyDevice('v11-device-60', 2026).ok).toBe(false);
    expect(deleteV11KeyDevice('v11-device-60', 2025).ok).toBe(true);
    expect(listV11KeyDevices(2026).some((device) => device.deviceId === 'v11-device-60')).toBe(true);
    expect(deleteV11EnergyType(original.energyTypeId, 2025).ok).toBe(false);
  });

  it('isolates device ownership, product allocation and device output', () => {
    const original = listV11KeyDevices(2025)[0];
    expect(saveV11KeyDevice({ ...original, deviceName: '2026设备', energyUnitId: 'eu-office' }, original.deviceId, 2026).ok).toBe(true);
    expect(listV11KeyDevices(2025)[0]).toEqual(original);
    const product = getProduct('product-a', 2025)!;
    updateProductAllocation('product-a', 'ratio', [{ energyUnitId: 'eu-clinker-line-1', share: 80 }], [], 2026);
    linkProductEnergyUnit('product-a', 'eu-cement-grinding-line', 2026);
    expect(getProduct('product-a', 2025)).toEqual(product);
    saveDeviceIntensityParameter({ deviceId: original.deviceId, year: 2025, metricCode: 'device-output-energy', value: 123, unit: 't', source: '历史台账' });
    expect(getDeviceIntensityParameter(original.deviceId, 2026, 'device-output-energy')).toBeUndefined();
  });

  it('rejects cross-year writes and references to units created in another year', () => {
    const original = listV11EnergyRecords().find((record) => record.year === 2026)!;
    expect(saveV11EnergyRecord({ ...original, year: 2025 }, original.energyRecordId).ok).toBe(false);
    const created = createEnergyUnit({ energyUnitName: '当年车间', unitType: '生产单元' }, 2026).unit!;
    expect(saveV11EnergyRecord({ ...original, year: 2025, scopeLevel: '一级用能单元', scopeType: 'energyUnit', scopeId: created.energyUnitId, energyUnitId: created.energyUnitId }).ok).toBe(false);
    expect(listV11EnergyRecords().find((record) => record.energyRecordId === original.energyRecordId)).toEqual(original);
  });

  it('protects historical analysis against current-year coefficient and unit changes', () => {
    const period = { year: 2025, grain: 'month' as const, month: 6 };
    const before = buildFlowAnalysisDataset(period);
    const energy = listV11EnergyTypes(2026)[0];
    saveV11EnergyType({ ...energy, standardCoalFactor: energy.standardCoalFactor * 2 }, energy.energyTypeId, 2026);
    const unit = getEnergyUnit('eu-clinker-line-1', 2026)!;
    updateEnergyUnit(unit.energyUnitId, { ...unit, energyUnitName: '改名车间' }, 2026);
    expect(buildFlowAnalysisDataset(period)).toEqual(before);
  });

  it('edits a historical unit using its historical values and retains the current year snapshot', async () => {
    const id = 'eu-clinker-line-1';
    const original = getEnergyUnit(id, 2026)!;
    updateEnergyUnit(id, { ...original, energyUnitName: '历史车间' }, 2025);
    await render('/data-management/units?year=2025');
    await click(button('编辑', row('历史车间')));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('2025年度');
    const input = [...dialog.querySelectorAll('input')].find((item) => item.value === '历史车间')!;
    await change(input, '历史车间修订');
    await click(button('保存', dialog));
    expect(getEnergyUnit(id, 2025)?.energyUnitName).toBe('历史车间修订');
    expect(getEnergyUnit(id, 2026)).toEqual(original);
    await change(yearSelect(), '2026');
    expect(container.textContent).not.toContain('历史车间修订');
    expect(container.textContent).toContain(original.energyUnitName);
  });

  it('switches annual energy types without status actions, closes stale dialogs and preserves the year on reset', async () => {
    await render('/data-management/energy-types?year=2026');
    expect(container.textContent).not.toMatch(/停用|启用/);
    await change(yearSelect(), '2025');
    expect(container.textContent).not.toMatch(/停用|启用/);
    await click(button('编辑', row('kWh')));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    await change(yearSelect(), '2026');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await change(yearSelect(), '2025');
    await click(button('重置'));
    expect(yearSelect().value).toBe('2025');
  });

  it('retains the selected year when navigating to devices and editing their archive', async () => {
    await render('/data-management/units?year=2025');
    const link = [...container.querySelectorAll('a')].find((item) => item.getAttribute('href') === '/data-management/devices?year=2025')!;
    expect(link).toBeTruthy();
    await click(link);
    expect(yearSelect().value).toBe('2025');
    await click(button('编辑', row(listV11KeyDevices(2025)[0].deviceName)));
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('2025年度');
  });

  it.each([
    '/data-management/energy-data',
    '/data-management/energy-data?tab=costs',
    '/data-management/operations',
    '/data-management/device-output',
  ])('uses the annual master data on %s', async (path) => {
    const unit = getEnergyUnit('eu-raw-material', 2025)!;
    updateEnergyUnit(unit.energyUnitId, { ...unit, energyUnitName: '历史年度专用名称' }, 2025);
    await render(path + (path.includes('?') ? '&' : '?') + 'year=2025');
    expect(yearSelect().value).toBe('2025');
    expect(container.textContent).toContain('2025 年度独立维护');
    await change(yearSelect(), '2026');
    await change(yearSelect(), '2025');
    expect(yearSelect().value).toBe('2025');
  });

  it('switches conversion year together with its unit definitions', async () => {
    const unit = getEnergyUnit('eu-compressed-air', 2025)!;
    updateEnergyUnit(unit.energyUnitId, { ...unit, energyUnitName: '历史空压系统' }, 2025);
    await render('/data-management/energy-data?tab=conversion&year=2026&month=6');
    await change(yearSelect(), '2025');
    await click(button('查询'));
    expect(container.textContent).toContain('2025 年度独立维护');
    expect(container.textContent).toContain('历史空压系统');
    expect(container.querySelector('[data-testid="url"]')?.textContent).toContain('year=2025');
  });
});
