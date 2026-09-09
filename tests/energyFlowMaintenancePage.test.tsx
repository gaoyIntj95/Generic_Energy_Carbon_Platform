import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';
import { EnergyFlowMaintenance } from '../src/pages/newPrototype/EnergyFlowMaintenance';
import { listV11ConversionOutputs, listV11ExternalSupplyRecords, listV11EnergyRecords, resetDataManagementV11Store, deleteV11ConversionOutput, saveFlowConversion, saveV11EnergyRecord, saveV11ConversionOutput, deleteV11EnergyRecord } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { addChildEnergyUnit, updateEnergyUnit, resetEnergyUnitMockStore } from '../src/mocks/energyUnitMockStore';
import { getDeviceIntensityParameter } from '../src/mocks/deviceIntensityParameterStore';

let container: HTMLDivElement;
let root: Root;
const period = { year: 2026, grain: 'month' as const, month: 6 };
function button(text: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll('button')].find((el) => el.textContent === text);
  if (!found) throw new Error(`未找到按钮 ${text}`);
  return found;
}
async function click(el: HTMLElement) { await act(async () => el.click()); }
async function change(label: string, value: string) {
  const el = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function select(label: string, value: string) {
  const el = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
async function render(url = '/data-management/energy-data?tab=conversion&year=2026&month=6') {
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}><EnergyFlowMaintenance /><LocationProbe /></MemoryRouter>));
}
async function renderIntegrated(url = '/data-management/energy-data?tab=conversion&year=2026&month=6') {
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}><DataManagementV11 pathname="/data-management/energy-data" /><LocationProbe /></MemoryRouter>));
}
function systemRow(text: string) { return [...container.querySelectorAll('section[aria-label="用能单元数据"] tbody tr')].find((el) => el.textContent?.includes(text))!; }
async function openAnnualSystem(text: string) {
  if (container.querySelector('[role="dialog"]')) await click(button('关闭'));
  await click(button('编辑', systemRow(text)));
}
async function openSystem(text: string) { await openAnnualSystem(text); }
async function openExternal(receiver: string) {
  if (container.querySelector('[role="dialog"]')) await click(button('关闭'));
  await click(button('编辑', externalRow(receiver)));
}
function outputTotal(id: string) { const row = listV11ConversionOutputs().find((item) => item.conversionOutputId === id)!; return row.monthlyOutputAmounts!.filter((_, i) => row.monthlyOutputReported?.[i] !== false).reduce((total, value) => total + value, 0).toLocaleString('zh-CN'); }

function externalRow(receiver: string) { return [...container.querySelectorAll('section[aria-label="对外供能台账"] tbody tr')].find((el) => el.textContent?.includes(receiver))!; }

describe('minimal energy flow maintenance', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    resetDataManagementV11Store();
    resetEnergyUnitMockStore();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it('shows one compact list, keeps supply visible, and does not require saving existing data', async () => {
    await render();
    expect(container.querySelectorAll('table')).toHaveLength(2);
    expect([...container.querySelectorAll('section[aria-label="对外供能台账"] th')].map((el) => el.textContent)).toEqual(['外供能源', '供能来源', '接收方', '年度数量', '操作']);
    expect(container.textContent).not.toContain('数量已核验');
    expect([...container.querySelectorAll('section[aria-label="用能单元数据"] th')].map((el) => el.textContent)).toEqual(['用能单元（动力中心）', '能源关系', '产出能源', '年度能源投入', '年度产出', '年度损失', '操作']);
    expect(systemRow('余热发电机组').textContent).toContain(outputTotal('v11-output-200') + ' kWh');
    expect(systemRow('余热发电机组').textContent).not.toContain('动力中心');
    expect(container.textContent).not.toContain('查看本期能流图');
    expect(container.textContent).not.toContain('关联用能单元');
    expect(button('编辑', systemRow('余热发电机组'))).toBeDefined();
    expect(systemRow('余热发电机组').textContent).not.toContain('历史补录');
    expect(systemRow('余热发电机组').textContent).not.toContain('损失');
    const before = listV11ConversionOutputs();
    await openSystem('余热发电机组');
    expect(container.querySelector('[aria-label="本期回收量"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月产出量"]')?.value).toBe('1600000');
    expect(button('保存').disabled).toBe(true);
    await click(button('取消'));
    expect(listV11ConversionOutputs()).toEqual(before);
  });

it('opens every month directly with one footer and cancels unsaved changes', async () => {
    const before = listV11ConversionOutputs();
    await render(); await openSystem('余热发电机组');
    const form = container.querySelector('[data-inline-editor]')!;
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(form.querySelector('table')!.querySelectorAll('tbody input')).toHaveLength(24);
    expect([...form.querySelectorAll('button')].map((el) => el.textContent)).toEqual(['取消', '保存']);
    await change('6月已确认损失', '12'); await change('6月产出量', '1800000');
    await click(button('取消'));
    expect(container.querySelector('[data-inline-editor]')).toBeNull();
    expect(listV11ConversionOutputs()).toEqual(before);
    await openSystem('余热发电机组');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月产出量"]')?.value).toBe('1600000');
  });

  it('saves explicit zero loss and reads it back without changing production or other months', async () => {
    const before = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-202')!;
    await render(); await openSystem('余热回收利用系统');
    
    await change('6月已确认损失', '0'); await change('损失备注', '本月计量确认无损失');
    await click(button('保存'));
    const after = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    expect(after.monthlyLossAmounts?.[5]).toBe(0);
    expect(after.monthlyLossAmounts?.filter((_, i) => i !== 5)).toEqual(before.monthlyLossAmounts?.filter((_, i) => i !== 5));
    expect(after.monthlyOutputAmounts).toEqual(before.monthlyOutputAmounts);
    await openSystem('余热回收利用系统');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月已确认损失"]')?.value).toBe('0');
    expect(container.querySelector<HTMLInputElement>('[aria-label="损失备注"]')?.value).toBe('本月计量确认无损失');
  });

  it('registers supply in the external ledger and updates availability, analysis and only the selected month', async () => {
    await render();
    const before = buildFlowAnalysisDataset(period, 'level1');

    const conversionBefore = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-201')!;
    await click(button('＋ 登记外供'));
    await select('供能来源', 'v11-output-201');
    await change('接收方', '交互测试客户'); await change('6月外供数量', '20'); await click(button('保存'));
    const conversionAfter = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-201')!;
    expect(conversionAfter.monthlyInternalAmounts?.[5]).toBe(conversionBefore.monthlyInternalAmounts![5] - 20);
    expect(buildFlowAnalysisDataset(period, 'level1').externalStandardCoalAmount - before.externalStandardCoalAmount).toBeCloseTo(20 * 0.0341);
    const saved = listV11ExternalSupplyRecords().find((r) => r.receiver === '交互测试客户')!;
    expect(saved.monthlyReported?.[4]).toBe(false);
    expect(externalRow('交互测试客户')).toBeDefined();
    await click(button('查看', externalRow('交互测试客户')));
    expect(container.querySelector('[aria-label="外供月度明细"]')?.textContent).toContain('—');
    await openExternal('交互测试客户'); await change('5月外供数量', '10'); await click(button('保存'));
    const updated = listV11ExternalSupplyRecords().find((r) => r.externalSupplyId === saved.externalSupplyId)!;
    expect(updated.monthlyAmounts?.[4]).toBe(10); expect(updated.monthlyAmounts?.[5]).toBe(20);
  });

  it('automatically lists an unconfigured unit and derives recovery fields from its input source', async () => {
    deleteV11ConversionOutput('v11-output-pressure-recovery');
    const before = listV11ConversionOutputs();
    await render();
    expect(listV11ConversionOutputs()).toEqual(before);
    await openSystem('余压回收系统');
    expect(container.querySelector('[aria-label="记录用途"]')).toBeNull();
    const unit = container.querySelector<HTMLInputElement>('[aria-label="用能单元"]')!;
    expect(unit.value).toBe('动力中心 / 余压回收系统');
    expect(unit.readOnly).toBe(true);
    await select('投入数据来源', 'v11-er-recovery-pressure');
    expect(container.querySelector('[aria-label="回收来源"]')).toBeNull();
    expect(container.querySelector('[aria-label="6月产出量"]')).not.toBeNull();
    await select('投入数据来源', 'recovery');
    expect(container.querySelector('[aria-label="回收来源"]')).not.toBeNull();
  });

  it('fills missing unit output locally without navigating to device output', async () => {
    const current = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    expect(saveFlowConversion({ ...current, monthlyOutputReported: Array(12).fill(false) }, current.conversionOutputId).ok).toBe(true);
    const deviceBefore = getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy');
    await render();
    await openSystem('余热发电机组');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月产出量"]')?.value).toBe('');
    await change('6月产出量', '1800000'); await click(button('保存'));
    expect(systemRow('余热发电机组').textContent).toContain('1,800,000 kWh');
    expect(getDeviceIntensityParameter('v11-device-81', 2026, 'device-output-energy')).toEqual(deviceBefore);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain('/data-management/energy-data?');
  });

  it('queries the unified list only after applying filters and resets it', async () => {
    await render(); await change('流转关键字', '余热');
    expect(systemRow('锅炉系统')).toBeDefined();
    await click(button('查询'));
    expect(systemRow('锅炉系统')).toBeUndefined(); expect(systemRow('余热发电机组')).toBeDefined();
    await click(button('重置')); expect(systemRow('锅炉系统')).toBeDefined();
  });

  it('inherits new power-center children without a conversion scenario and follows master-data names', async () => {
    const added = addChildEnergyUnit('eu-utilities', { energyUnitName: '新增供热系统', unitType: '公辅系统' });
    expect(added.ok).toBe(true);
    expect(updateEnergyUnit('eu-utilities', { energyUnitName: '公用动力中心', unitType: '公辅系统' }).ok).toBe(true);
    const before = listV11ConversionOutputs();
    await render();
    expect(container.querySelector('th')?.textContent).toBe('用能单元（公用动力中心）');
    await openSystem('新增供热系统');
    expect(container.querySelector<HTMLInputElement>('[aria-label="用能单元"]')?.value).toBe('公用动力中心 / 新增供热系统');
    expect(listV11ConversionOutputs()).toEqual(before);
  });

  it('keeps external registration available in a year without records', async () => {
    await render('/data-management/energy-data?tab=conversion&year=2020');
    const section = container.querySelector('section[aria-label="对外供能台账"]')!;
    expect(section.textContent).toContain('本年度暂无外供记录');
    await click(button('＋ 登记外供', section));
    expect(container.querySelectorAll('[role="dialog"] input[aria-label$="月外供数量"]')).toHaveLength(12);
   
    expect(container.querySelector('[role="dialog"] header')?.textContent).toContain('2020年度');
  });

  it('keeps whole-year deletion explicit and requires confirmation', async () => {
    await render('/data-management/energy-data?tab=conversion&grain=year&year=2026');
    const before = listV11ExternalSupplyRecords();
    const row = container.querySelector('section[aria-label="对外供能台账"] tbody tr')!;
    await click(button('删除', row));
    expect(listV11ExternalSupplyRecords()).toHaveLength(before.length);
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('该年度全部月份');
    await click(button('确认删除')); expect(listV11ExternalSupplyRecords()).toHaveLength(before.length - 1);
  });

  it('edits unit output even when devices exist without asking for device sources', async () => {
    await render(); await openSystem('自备发电机组');
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).not.toContain('关联设备');
    await change('6月产出量', '850000'); await click(button('保存'));
    expect(systemRow('自备发电机组').textContent).toContain(outputTotal('v11-output-captive-power') + ' kWh');
    await openSystem('自备发电机组');
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).not.toContain('设置数据来源');
    expect(container.querySelector('[aria-label="产出数据来源"]')).toBeNull();
    expect(container.querySelector('[aria-label="产出换算系数"]')).toBeNull();
  });

  it('preserves unit history while updating only the selected month', async () => {
    const before = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-pressure-recovery')!;
    await render(); await openSystem('余压回收系统');
    await change('6月产出量', '75000'); await click(button('保存'));
    const after = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    expect(after.monthlyOutputAmounts?.[5]).toBe(75000);
    expect(after.monthlyOutputAmounts?.filter((_, i) => i !== 5)).toEqual(before.monthlyOutputAmounts?.filter((_, i) => i !== 5));
  });

  it('maintains the compressed-air unit total without replacing individual device output', async () => {
    const before = getDeviceIntensityParameter('v11-device-62', 2026, 'compressed-air-electricity');
    await render(); await openSystem('空压系统');
    await change('6月产出量', '480000'); await click(button('保存'));
    expect(systemRow('空压系统').textContent).toContain(outputTotal('v11-output-compressed-air-2026') + ' Nm³');
    expect(getDeviceIntensityParameter('v11-device-62', 2026, 'compressed-air-electricity')).toEqual(before);
  });

  it('registers recovery supply once and displays its source as plain text', async () => {
    await render();
    const before = listV11ConversionOutputs().find((item) => item.conversionOutputId === 'v11-output-200')!;
    const count = listV11ExternalSupplyRecords().length;
    await click(button('＋ 登记外供')); await select('供能来源', 'v11-output-200'); await change('接收方', '回收能源客户'); await change('6月外供数量', '1000'); await click(button('保存'));
    const after = listV11ConversionOutputs().find((item) => item.conversionOutputId === before.conversionOutputId)!;
    expect(listV11ExternalSupplyRecords()).toHaveLength(count + 1);
    expect(after.monthlyOutputAmounts?.[5]).toBe(before.monthlyOutputAmounts?.[5]);
    expect(after.monthlyInternalAmounts?.[5]).toBe(before.monthlyInternalAmounts![5] - 1000);
    const sourceCell = externalRow('回收能源客户').querySelector('td:nth-child(2)')!;
    expect(sourceCell.textContent).toBe('余热发电机组');
    expect(sourceCell.querySelector('button, a')).toBeNull();
  });

  it('records purchased energy supply without creating a conversion and displays its source as plain text', async () => {
    await render();
    const source = listV11EnergyRecords().find((item) => item.year === 2026 && item.scopeLevel === '企业' && item.energyRole === '能源消费' && item.energyTypeId === 'v11-energy-electricity')!;
    const count = listV11ConversionOutputs().length;
    await click(button('＋ 登记外供')); await select('供能来源', source.energyRecordId); await change('接收方', '外购直供客户'); await change('6月外供数量', '10'); await click(button('保存'));
    const saved = listV11ExternalSupplyRecords().find((item) => item.receiver === '外购直供客户')!;
    expect(saved.inputEnergyRecordId).toBe(source.energyRecordId); expect(saved.conversionOutputId).toBeUndefined();
    expect(listV11ConversionOutputs()).toHaveLength(count);
    const sourceCell = externalRow('外购直供客户').querySelector('td:nth-child(2)')!;
    expect(sourceCell.textContent).toBe('外购直供 · 电力');
    expect(sourceCell.querySelector('button, a')).toBeNull();
  });

  it('fills missing recovery input in the source ledger and returns without changing output or other months', async () => {
    const current = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    const source = listV11EnergyRecords().find((row) => row.energyRecordId === current.inputEnergyRecordId)!;
    expect(saveV11EnergyRecord({ ...source, monthlyReportedMonths: Array.from({ length: 12 }, (_, i) => i !== 5) }, source.energyRecordId).ok).toBe(true);
    await renderIntegrated(); await openSystem('余热发电机组');
    expect(container.querySelector('[aria-label="本期回收量"]')).toBeNull();
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('待填报');
    await click(button('补充数据'));
    const url = new URL(container.querySelector('[data-testid="location"]')!.textContent!, 'http://localhost');
    expect(url.searchParams.get('recordId')).toBe(source.energyRecordId);
    expect(url.searchParams.get('scopeLevel')).toBe('二级用能单元');
    expect(url.searchParams.get('entry')).toBe('list');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await click(button('编辑'));
    expect(url.searchParams.get('month')).toBe('6');
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('2026年');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月能源数量"]')?.value).toBe('');
    expect(container.querySelector('[aria-label="6月能源数量"]')).not.toBeNull();
    await change('6月能源数量', '7800'); await click(button('保存'));
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('7,800');
    const saved = listV11EnergyRecords().find((row) => row.energyRecordId === source.energyRecordId)!;
    expect(saved.monthlyAmounts.filter((_, i) => i !== 5)).toEqual(source.monthlyAmounts.filter((_, i) => i !== 5));
    expect(saved.energyRole).toBe(source.energyRole);
    expect(saved.energyUnitId).toBe(source.energyUnitId);
    expect(listV11ConversionOutputs().find((row) => row.conversionOutputId === current.conversionOutputId)?.monthlyOutputAmounts).toEqual(current.monthlyOutputAmounts);
  });

  it('updates the boiler input through second-level consumption and passes it into the flow graph', async () => {
    const current = listV11ConversionOutputs().find(row => row.conversionOutputId === 'v11-output-201')!;
    const source = listV11EnergyRecords().find(row => row.energyRecordId === current.inputEnergyRecordId)!;
    expect(saveV11EnergyRecord({ ...source, monthlyReportedMonths: Array.from({ length: 12 }, (_, i) => i !== 5) }, source.energyRecordId).ok).toBe(true);
    await renderIntegrated(); await openSystem('锅炉系统'); await click(button('补充数据')); await click(button('编辑'));
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('二级用能单元');
    await change('6月能源数量', '130000'); await click(button('保存'));
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('130,000');
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).not.toContain('补充投入');
    expect(listV11ConversionOutputs().find(row => row.conversionOutputId === current.conversionOutputId)?.monthlyOutputAmounts).toEqual(current.monthlyOutputAmounts);
    const flow = buildFlowAnalysisDataset(period);
    expect(flow.links.find(link => link.linkId === 'conversion:v11-output-201:input')?.calculation?.physicalAmount).toBe(130000);
  });

  it('links a missing input only after manually saving its second-level source record', async () => {
    const seeded = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-captive-power')!;
    expect(saveV11ConversionOutput({ ...seeded, inputMode: 'manual', inputEnergyRecordId: undefined }, seeded.conversionOutputId).ok).toBe(true);
    deleteV11EnergyRecord(seeded.inputEnergyRecordId!);
    const before = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-captive-power')!;
    const count = listV11EnergyRecords().length;
    await renderIntegrated(); await openSystem('自备发电机组'); await click(button('补充数据'));
    expect(listV11EnergyRecords()).toHaveLength(count);
    await click(button('＋ 新增能源消费'));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('二级用能单元');
    expect(dialog.textContent).toContain('自备发电机组');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月能源数量"]')?.value).toBe('');
    await change('6月能源数量', '175'); await click(button('保存'));
    const after = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    const source = listV11EnergyRecords().find((row) => row.energyRecordId === after.inputEnergyRecordId)!;
    expect(listV11EnergyRecords()).toHaveLength(count + 1);
    expect(source.energyUnitId).toBe(before.conversionEnergyUnitId);
    expect(source.energyRole).toBe('能源消费');
    expect(source.energyTypeId).toBe(before.inputEnergyTypeId);
    expect(source.monthlyAmounts[5]).toBe(175);
    expect(source.monthlyReportedMonths?.filter(Boolean)).toHaveLength(1);
    expect(source.monthlyAmounts.filter((_, i) => i !== 5)).toEqual(Array(11).fill(0));
    expect(after.monthlyOutputAmounts).toEqual(before.monthlyOutputAmounts);
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('175');
  });

  it('adds a recovery system from existing input and only asks for its missing output', async () => {
    deleteV11ConversionOutput('v11-output-202');
    const inputCount = listV11EnergyRecords().length;
    await render(); await openSystem('余热回收利用系统');
    await select('投入数据来源', 'v11-er-recovery-device-70');
    await select('产出能源', 'v11-energy-recovered-steam');
    await click(button('保存'));
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')).toBeNull();
    const added = listV11ConversionOutputs().find((row) => row.conversionEnergyUnitId === 'eu-waste-heat-utilization' && row.year === 2026)!;
    expect(container.querySelectorAll('section[aria-label="用能单元数据"] tbody tr')).toHaveLength(6);
    expect(button('编辑', systemRow('余热回收利用系统'))).toBeDefined();
    expect(added.inputMode).toBe('recovery');
    expect(added.inputEnergyRecordId).toBe('v11-er-recovery-device-70');
    expect(listV11EnergyRecords()).toHaveLength(inputCount);
    await openSystem('余热回收利用系统');
    expect(container.querySelector('[aria-label="本期回收量"]')).toBeNull();
    await change('6月产出量', '100'); await click(button('保存'));
    const saved = listV11ConversionOutputs().find((row) => row.conversionOutputId === added.conversionOutputId)!;
    expect(saved.monthlyOutputAmounts?.[5]).toBe(100);
    expect(saved.monthlyOutputReported?.filter(Boolean)).toHaveLength(1);
    expect(saved.monthlyLossAmounts).toBeUndefined();
  });

  it('completes a new unit record and monthly output in a single data-entry dialog', async () => {
    deleteV11ConversionOutput('v11-output-pressure-recovery');
    await render(); await openSystem('余压回收系统');
    await select('投入数据来源', 'v11-er-recovery-pressure');
    await select('产出能源', 'v11-energy-compressed-air');
    await change('6月产出量', '60000'); await click(button('保存'));
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')).toBeNull();
    expect(systemRow('余压回收系统').textContent).toContain('60,000 Nm³');
    expect(button('编辑', systemRow('余压回收系统'))).toBeDefined();
    const saved = listV11ConversionOutputs().find((row) => row.conversionEnergyUnitId === 'eu-pressure-recovery' && row.year === 2026)!;
    expect(saved.monthlyOutputReported?.filter(Boolean)).toHaveLength(1);
    await click(button('查看', systemRow('余压回收系统')));
    expect(button('编辑', systemRow('余压回收系统'))).toBeDefined();
  });

  it('shows annual totals with only a year filter and expands twelve months inline', async () => {
    const before = listV11ConversionOutputs();
    const supply = listV11ExternalSupplyRecords().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render('/data-management/energy-data?tab=conversion&grain=month&year=2026&month=6');
    expect(container.querySelector('[aria-label="时间粒度"]')).toBeNull();
    expect(container.querySelector('input[type="month"]')).toBeNull();
    expect(container.querySelector<HTMLSelectElement>('[aria-label="数据年度"]')?.value).toBe('2026');
    expect(systemRow('余热发电机组').textContent).toContain(outputTotal('v11-output-200') + ' kWh');
    await click(button('查看', systemRow('余热发电机组')));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const detail = container.querySelector('[aria-label="能源产出月度明细"]')!;
    expect(detail.querySelectorAll('[class*="monthDetailGrid"] > div')).toHaveLength(12);
    expect(detail.textContent).toContain('1,600,000');
    await click(button('收起', systemRow('余热发电机组')));
    expect(container.querySelector('[aria-label="能源产出月度明细"]')).toBeNull();
    await click(button('查看', externalRow('余热发电机组')));
    expect(container.querySelector('[aria-label="外供月度明细"]')?.querySelectorAll('[class*="monthDetailGrid"] > div')).toHaveLength(12);
    expect(externalRow('余热发电机组').textContent).toContain(supply.monthlyAmounts!.reduce((a,b) => a+b, 0).toLocaleString('zh-CN'));
    await select('数据年度', '2025');
    expect(container.querySelector('[aria-label="外供月度明细"]')).toBeNull();
    await click(button('重置'));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="数据年度"]')?.value).toBe('2025');
    expect(listV11ConversionOutputs()).toEqual(before);
  });

it('distinguishes zero and missing months while exposing all monthly inputs', async () => {
    const zero = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-pressure-recovery')!;
    const missing = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    expect(saveFlowConversion({ ...zero, monthlyOutputAmounts: Array(12).fill(0), monthlyOutputReported: Array.from({ length: 12 }, (_, i) => i === 0) }, zero.conversionOutputId).ok).toBe(true);
    expect(saveFlowConversion({ ...missing, monthlyOutputReported: Array(12).fill(false) }, missing.conversionOutputId).ok).toBe(true);
    const before = listV11ConversionOutputs();
    await render(); await click(button('查看', systemRow('余压回收系统')));
    const months = container.querySelectorAll('[aria-label="能源产出月度明细"] [data-month] strong');
    expect(months[0].textContent).toBe('0'); expect(months[1].textContent).toBe('—');
    await openSystem('余热发电机组');
    expect(container.querySelectorAll('[data-inline-editor] tbody tr')).toHaveLength(12);
    expect(listV11ConversionOutputs()).toEqual(before);
    await change('2月产出量', '1500000'); await click(button('保存'));
    const saved = listV11ConversionOutputs().find((row) => row.conversionOutputId === missing.conversionOutputId)!;
    expect(saved.monthlyOutputAmounts?.[1]).toBe(1500000); expect(saved.monthlyOutputReported?.filter(Boolean)).toHaveLength(1);
    await select('数据年度', '2025'); expect(container.querySelector('[data-inline-editor]')).toBeNull();
  });

  it('registers external data for the selected year and month', async () => {
    const conversion = listV11ConversionOutputs().find((row) => row.year === 2025 && row.conversionEnergyUnitId === 'eu-gas-boiler')!;
    await render(); await select('数据年度', '2025');
    const before = listV11ExternalSupplyRecords();
    await click(button('＋ 登记外供')); await click(button('取消'));
    expect(listV11ExternalSupplyRecords()).toEqual(before);
    await click(button('＋ 登记外供'));
    expect(container.querySelector('[role="dialog"] header')?.textContent).toContain('2025年度');
    await select('供能来源', conversion.conversionOutputId); await change('接收方', '年度筛选登记'); await change('3月外供数量', '20'); await click(button('保存'));
    const saved = listV11ExternalSupplyRecords().find((row) => row.receiver === '年度筛选登记')!;
    expect(saved.year).toBe(2025); expect(saved.monthlyAmounts?.[2]).toBe(20);
    expect(saved.monthlyReported?.filter(Boolean)).toHaveLength(1);
    expect(saved.monthlyReported?.[5]).toBe(false);
  });

  it('keeps annual external verification sensitive to missing source months', async () => {
    const conversion = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    const supply = listV11ExternalSupplyRecords().find((row) => row.conversionOutputId === conversion.conversionOutputId)!;
    expect(saveFlowConversion({ ...conversion, monthlyOutputReported: Array.from({ length: 12 }, (_, i) => i !== 5) }, conversion.conversionOutputId).ok).toBe(true);
    await render('/data-management/energy-data?tab=conversion&grain=year&year=2026');
    expect(systemRow('余热发电机组').textContent).toContain(conversion.monthlyOutputAmounts!.filter((_, i) => i !== 5).reduce((total, value) => total + value, 0).toLocaleString('zh-CN'));
    expect(externalRow('余热发电机组').textContent).toContain('待核验');
    await click(button('查看', externalRow('余热发电机组')));
    expect(externalRow('余热发电机组').textContent).toContain('6月：来源本期数据待补录');
    await openExternal('余热发电机组');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月外供数量"]')?.value).toBe(String(supply.monthlyAmounts?.[5]));
  });

  it('does not turn an annual-only input into monthly reported consumption', async () => {
    const conversion = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-201')!;
    const source = listV11EnergyRecords().find((row) => row.energyRecordId === conversion.inputEnergyRecordId)!;
    expect(saveV11EnergyRecord({ ...source, entryMode: 'annual', annualAmount: 123456, monthlyAmounts: Array(12).fill(0), monthlyReportedMonths: Array(12).fill(false) }, source.energyRecordId).ok).toBe(true);
    await render('/data-management/energy-data?tab=conversion&grain=year&year=2026');
    expect(systemRow('锅炉系统').textContent).toContain('123,456');
    await openSystem('锅炉系统');
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).toContain('待填报');
    expect(button('编辑', systemRow('锅炉系统'))).toBeDefined();
    expect(listV11EnergyRecords().find((row) => row.energyRecordId === source.energyRecordId)?.monthlyReportedMonths?.some(Boolean)).toBe(false);
  });

  it('saves a positive loss without a remark and can add or clear its optional remark later', async () => {
    const before = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render(); await openSystem('余热发电机组'); 
    expect(container.querySelector('[role="dialog"], [data-inline-editor]')?.textContent).not.toContain('确认依据');
    expect(container.querySelector<HTMLInputElement>('[aria-label="损失备注"]')?.required).toBe(false);
    await change('6月已确认损失', '100'); await click(button('保存'));
    const saved = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    expect(saved.monthlyLossAmounts?.[5]).toBe(100);
    expect(saved.lossBasis).toBe('');
    expect(saved.monthlyOutputAmounts).toEqual(before.monthlyOutputAmounts);
    await openSystem('余热发电机组'); 
    await change('损失备注', '本月管网检修'); await click(button('保存'));
    await openSystem('余热发电机组');
    expect(container.querySelector<HTMLInputElement>('[aria-label="损失备注"]')?.value).toBe('本月管网检修');
    await change('损失备注', ''); await click(button('保存'));
    const cleared = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    expect(cleared.lossBasis).toBe('');
    expect(cleared.monthlyLossAmounts).toEqual(saved.monthlyLossAmounts);
  });


  it('cancels the complete inline editor with escape without saving a draft', async () => {
    const before = listV11ConversionOutputs();
    await render(); await openSystem('锅炉系统');
    const form = container.querySelector<HTMLElement>('[data-inline-editor]')!;
    expect(form).not.toBeNull(); expect(container.querySelector('[role="dialog"]')).toBeNull();
    await change('6月产出量', '9999');
    await act(async () => form.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true})));
    expect(container.querySelector('[data-inline-editor]')).toBeNull();
    expect(listV11ConversionOutputs()).toEqual(before);
    expect(container.querySelector('[aria-label="能源产出月度明细"]')).not.toBeNull();
  });

  it('clears annual conversion quantities without cascading to external records or another year', async () => {
    const otherYear = listV11ConversionOutputs().filter((row) => row.year === 2025);
    const supplies = listV11ExternalSupplyRecords();
    await render('/data-management/energy-data?tab=conversion&grain=year&year=2026');
    await click(button('删除', systemRow('余热发电机组'))); await click(button('确认删除'));
    expect(systemRow('余热发电机组').textContent).toContain('待填报未填写');
    expect(externalRow('余热发电机组').textContent).toContain('待核验');
    expect(listV11ExternalSupplyRecords()).toEqual(supplies);
    expect(listV11ConversionOutputs().filter((row) => row.year === 2025)).toEqual(otherYear);
  });

it('clears one external month without changing the others', async () => {
    const before = listV11ExternalSupplyRecords().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render(); await openExternal('余热发电机组');
    await change('6月外供数量', ''); await click(button('保存'));
    const after = listV11ExternalSupplyRecords().find((row) => row.externalSupplyId === before.externalSupplyId)!;
    expect(after.monthlyReported?.[5]).toBe(false);
    expect(after.monthlyAmounts?.filter((_, i) => i !== 5)).toEqual(before.monthlyAmounts?.filter((_, i) => i !== 5));
    expect(container.querySelector('[aria-label="外供月度明细"] [data-month="6"]')?.textContent).toContain('—');
  });

  it('changes the source of one external month without moving other months and validates the new capacity', async () => {
    const before = listV11ExternalSupplyRecords().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render(); await openExternal('余热发电机组');
    expect(container.querySelector<HTMLSelectElement>('[aria-label="供能来源"]')?.disabled).toBe(false);
    await select('供能来源', 'v11-output-201');
    expect(container.querySelector<HTMLInputElement>('[aria-label="6月外供数量"]')?.value).toBe('');
    await change('6月外供数量', '999999'); await click(button('保存'));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('超过来源可供量');
    expect(listV11ExternalSupplyRecords().find((row) => row.externalSupplyId === before.externalSupplyId)).toEqual(before);
    await change('6月外供数量', '100'); await click(button('保存'));
    const old = listV11ExternalSupplyRecords().find((row) => row.externalSupplyId === before.externalSupplyId)!;
    const added = listV11ExternalSupplyRecords().find((row) => row.receiver === before.receiver && row.conversionOutputId === 'v11-output-201')!;
    expect(old.monthlyReported?.[5]).toBe(false);
    expect(old.monthlyAmounts?.filter((_, i) => i !== 5)).toEqual(before.monthlyAmounts?.filter((_, i) => i !== 5));
    expect(added.unit).toBe('GJ');
    expect(added.monthlyAmounts?.[5]).toBe(100);
    expect(added.monthlyReported?.filter(Boolean)).toHaveLength(1);
  });

  it('hides source navigation in annual details when the linked input is available', async () => {
    await render('/data-management/energy-data?tab=conversion&grain=year&year=2026');
    await click(button('查看', systemRow('余热发电机组')));
    const dialog = container.querySelector('[aria-label="能源投入月度明细"]')!;
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog.textContent).not.toContain('前往能源消费');
    expect(dialog.textContent).not.toContain('补充投入');
  });


it('opens twelve external quantity inputs without repeated buttons and refreshes totals', async () => {
    const before = listV11ExternalSupplyRecords().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render(); await click(button('查看', externalRow('余热发电机组')));
    expect(container.querySelector('[aria-label="外供月度明细"] input')).toBeNull();
    await openExternal('余热发电机组');
    const form = container.querySelector('[data-inline-editor]')!;
    expect([...form.querySelectorAll('input')].filter((el) => /月外供数量$/.test(el.getAttribute('aria-label') ?? ''))).toHaveLength(12);
    expect([...form.querySelectorAll('button')].map((el) => el.textContent)).toEqual(['取消', '保存']);
    await change('6月外供数量', '1234'); await click(button('保存'));
    const saved = listV11ExternalSupplyRecords().find((row) => row.externalSupplyId === before.externalSupplyId)!;
    expect(saved.monthlyAmounts?.[5]).toBe(1234);
    expect(saved.monthlyAmounts?.filter((_, i) => i !== 5)).toEqual(before.monthlyAmounts?.filter((_, i) => i !== 5));
    expect(externalRow('余热发电机组').textContent).toContain(saved.monthlyAmounts!.reduce((a,b) => a+b, 0).toLocaleString('zh-CN'));
  });

it('retains invalid loss drafts without saving any month until corrected', async () => {
    const before = listV11ConversionOutputs().find((row) => row.conversionOutputId === 'v11-output-200')!;
    await render(); await openSystem('余热发电机组');
    await change('5月产出量', '1700000'); await change('6月已确认损失', '999999999'); await click(button('保存'));
    expect(container.querySelector('[data-inline-editor] [role="alert"]')).not.toBeNull();
    expect(listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)).toEqual(before);
    await change('6月已确认损失', '0'); await click(button('保存'));
    const saved = listV11ConversionOutputs().find((row) => row.conversionOutputId === before.conversionOutputId)!;
    expect(saved.monthlyLossAmounts?.[5]).toBe(0); expect(saved.monthlyOutputAmounts?.[4]).toBe(1700000);
    expect(container.querySelector('[data-inline-editor]')).toBeNull();
  });

});
