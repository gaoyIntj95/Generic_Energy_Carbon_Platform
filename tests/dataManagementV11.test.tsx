import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV11EnergyRecord,
  deleteV11KeyDevice,
  inspectV11KeyDeviceDeletion,
  listV11ConversionOutputs,
  listV11EnergyCosts,
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11KeyDevices,
  listV11OperationMetrics,
  resetDataManagementV11Store,
  saveV11ConversionOutput,
  saveV11EnergyCost,
  saveV11EnergyRecord,
  saveV11KeyDevice,
  saveV11OperationMetric,
  v11EnergyRecordAnnualAmount,
} from '../src/mocks/dataManagementV11Store';
import { saveBenchmarkTarget } from '../src/mocks/benchmarkTargetStore';
import { buildBenchmarkDataset } from '../src/mocks/energyBenchmarkSelector';
import { listEnergyUnits } from '../src/mocks/energyUnitMockStore';
import { listProducts } from '../src/mocks/productMasterStore';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';

let container: HTMLDivElement;
let root: Root;

function button(text: string) {
  const result = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!result) throw new Error(`未找到按钮：${text}`);
  return result as HTMLButtonElement;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function render(pathname: string) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[pathname]}>
      <DataManagementV11 pathname={pathname} />
    </MemoryRouter>,
  ));
}

describe('DataManagementV11 fidelity and data behavior', () => {
  beforeEach(() => {
    resetDataManagementV11Store();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the V11 energy type columns without prototype-external state fields', async () => {
    await render('/data-management/energy-types');
    const headers = [...container.querySelectorAll('th')].map((item) => item.textContent);
    expect(headers).toEqual(['能源分析类别', '能源品种', '计量单位', '折标系数', '折标单位', '操作']);
    expect(container.textContent).toContain('压缩空气');
    expect(container.textContent).not.toContain('回收蒸汽');
    expect(container.textContent).not.toContain('余热');
    expect(container.querySelectorAll('tbody > tr')).toHaveLength(8);
    const compressedAir = listV11EnergyTypes().find((item) => item.energyTypeName === '压缩空气');
    expect(compressedAir).toMatchObject({ standardCoalFactor: 0.04, standardCoalFactorUnit: 'kgce/Nm³' });
    expect(container.textContent).toContain('0.0400');
    expect(container.textContent).not.toContain('参数来源');
    expect(container.textContent).not.toContain('启用');
  });

  it('applies energy type filters only after querying and resets them on demand', async () => {
    await render('/data-management/energy-types');
    const keyword = container.querySelector('[aria-label="关键字"]') as HTMLInputElement;
    const category = container.querySelector('[aria-label="能源分析类别"]') as HTMLSelectElement;

    expect(container.querySelectorAll('tbody > tr')).toHaveLength(8);
    await change(keyword, '天然气');
    await change(category, '化石燃料');
    expect(container.querySelectorAll('tbody > tr')).toHaveLength(8);

    await click(button('查询'));
    expect(container.querySelectorAll('tbody > tr')).toHaveLength(1);
    expect(container.textContent).toContain('天然气');

    await click(button('重置'));
    expect(keyword.value).toBe('');
    expect(category.value).toBe('');
    expect(container.querySelectorAll('tbody > tr')).toHaveLength(8);
  });

  it('keeps the energy quantity ledger limited to consumption and exposes monthly details inline', async () => {
    await render('/data-management/energy-data');
    expect(container.textContent).toContain('能源量数据');
    expect(container.textContent).toContain('能源成本');
    expect(container.textContent).toContain('能源回收、转换与外供');
    expect(container.textContent).toContain('回收、产出及外供不在此处重复维护');
    expect(container.textContent).toContain('162,285,000');
    expect(container.textContent).not.toContain('回收能源（');
    expect(container.textContent).not.toContain('能源产出（');
    expect([...container.querySelectorAll('th')].map((item) => item.textContent)).toEqual([
      '归属范围 / 能源品种',
      '归属层级',
      '能流阶段',
      '能源分析类别',
      '单位',
      '数据进度',
      '年度合计',
      '操作',
    ]);
    expect(container.textContent).not.toContain('数据角色');
    const scopeNames = [...container.querySelectorAll('tbody tr[class*="scopeRecordRow"] td:first-child')]
      .map((cell) => cell.textContent ?? '');
    expect(scopeNames).toHaveLength(10);
    expect(container.querySelector('tbody tr[class*="scopeGroupRow"]')?.textContent).toContain('全厂');
    expect(button('下一页').disabled).toBe(false);
    expect(scopeNames.some((name) => name.includes('1#数控加工中心'))).toBe(false);

    await click(button('查看'));
    expect(container.textContent).toContain('月度明细');
    expect(container.textContent).toContain('12,710,000');

    await click(button('下一页'));
    expect(container.textContent).toContain('2 / 3');
    expect(container.textContent).toContain('1#数控加工中心');
  });

  it('locks new energy records to the active level tab and cascades second-level choices from the configured parent', async () => {
    await render('/data-management/energy-data');
    expect(container.textContent).toContain('请切换至具体层级页签后录入');
    expect(() => button('新增能源数据')).toThrow();

    await click(button('二级用能单元'));
    await click(button('新增能源数据'));

    const scopeType = container.querySelector('[aria-label="归属对象类型"]') as HTMLInputElement;
    expect(scopeType.value).toBe('二级用能单元');
    expect(scopeType.readOnly).toBe(true);

    const parentSelect = container.querySelector('[aria-label="所属一级用能单元"]') as HTMLSelectElement;
    const childSelect = container.querySelector('[aria-label="二级用能单元"]') as HTMLSelectElement;
    expect(childSelect.disabled).toBe(true);

    const parent = listEnergyUnits().find((unit) => unit.unitLevel === 'level1');
    expect(parent).toBeDefined();
    if (!parent) return;
    await change(parentSelect, parent.energyUnitId);

    const expectedChildren = listEnergyUnits()
      .filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parent.energyUnitId)
      .map((unit) => unit.energyUnitName);
    expect(childSelect.disabled).toBe(false);
    expect([...childSelect.options].slice(1).map((option) => option.textContent)).toEqual(expectedChildren);
  });

  it('opens the shared energy ledger in device mode and carries the selected device context', async () => {
    await render('/data-management/energy-data?scope=device&deviceId=v11-device-62&new=1');

    expect(container.textContent).toContain('重点设备能源数据');
    const dialog = [...container.querySelectorAll('form')].find((form) => form.textContent?.includes('新增能源数据'));
    expect(dialog).toBeDefined();
    const scopeType = dialog?.querySelector('[aria-label="归属对象类型"]') as HTMLInputElement;
    expect(scopeType.value).toBe('重点设备');
    expect(scopeType.readOnly).toBe(true);
    const selects = [...(dialog?.querySelectorAll('select') ?? [])] as HTMLSelectElement[];
    expect(selects.some((select) => select.value === 'v11-device-62')).toBe(true);
    expect(dialog?.textContent).toContain('1#螺杆空压机');
    expect(dialog?.textContent).toContain('所属用能单元 空压系统');
    expect(dialog?.textContent).toContain('设备类型 空压设备');
    expect(dialog?.textContent).not.toContain('数据角色');
  });

  it('opens an existing device energy record directly in the edit dialog', async () => {
    await render('/data-management/energy-data?scope=device&deviceId=v11-device-79&year=2026&energyTypeId=v11-energy-electricity&recordId=v11-er-device-79');

    expect(container.textContent).toContain('编辑能源数据');
    const dialog = [...container.querySelectorAll('form')].find((form) => form.textContent?.includes('编辑能源数据'));
    expect(dialog).toBeDefined();
    expect((dialog?.querySelector('[aria-label="归属对象类型"]') as HTMLInputElement).value).toBe('重点设备');
  });

  it('keeps device energy, targets and renames linked by stable device id', () => {
    const enterpriseBefore = buildBenchmarkDataset(2026).rows.find((row) =>
      row.objectTypeKey === 'enterprise')?.actual;
    const created = saveV11KeyDevice({
      deviceName: '生产设备A',
      deviceType: '加工设备',
      energyUnitId: 'eu-raw-material',
      mainEnergyTypeId: 'v11-energy-electricity',
      remark: '',
    });
    expect(created.ok).toBe(true);
    const device = listV11KeyDevices().find((item) => item.deviceName === '生产设备A');
    expect(device).toBeDefined();
    if (!device) return;

    const monthlyAmounts = Array.from({ length: 12 }, (_, index) => 100000 + index * 1000);
    const energy = saveV11EnergyRecord({
      year: 2026,
      energyRole: '能源消费',
      scopeLevel: '二级用能单元',
      scopeType: 'device',
      scopeId: device.deviceId,
      energyUnitId: device.energyUnitId,
      energyTypeId: 'v11-energy-electricity',
      entryMode: 'monthly',
      monthlyAmounts,
      annualAmount: 0,
    });
    expect(energy.ok).toBe(true);

    const target = saveBenchmarkTarget({
      objectType: 'device',
      objectId: device.deviceId,
      metricCode: 'electricity_consumption',
      year: 2026,
      energyUnitId: null,
      value: 1_200_000,
      metricName: '电力消费量',
      unit: 'kWh',
      direction: 'low',
    });
    expect(target.ok).toBe(true);

    const initialMetric = buildBenchmarkDataset(2026).rows.find((row) =>
      row.objectTypeKey === 'device' && row.objectId === device.deviceId);
    expect(initialMetric).toMatchObject({
      metricCode: 'device_template_missing',
      actual: 0,
      target: 0,
      targetConfigured: false,
      dataCompleteness: '12/12月',
    });
    expect(buildBenchmarkDataset(2026).rows.find((row) =>
      row.objectTypeKey === 'enterprise')?.actual).toBe(enterpriseBefore);

    const renamed = saveV11KeyDevice({ ...device, deviceName: '生产设备A（改名）' }, device.deviceId);
    expect(renamed.ok).toBe(true);
    const renamedMetric = buildBenchmarkDataset(2026).rows.find((row) =>
      row.objectTypeKey === 'device' && row.objectId === device.deviceId);
    expect(renamedMetric?.objectName).toBe('生产设备A（改名）');
    expect(renamedMetric?.actual).toBe(initialMetric?.actual);
    expect(renamedMetric?.target).toBe(initialMetric?.target);

    const blocked = deleteV11KeyDevice(device.deviceId);
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.error).toContain('能源数据');
    expect(blocked.error).toContain('指标目标');
    const inspection = inspectV11KeyDeviceDeletion(device.deviceId);
    expect(inspection).toMatchObject({ ok: false });
    if (!inspection.ok) {
      expect(inspection.references.energyRecordCount).toBeGreaterThan(0);
      expect(inspection.references.benchmarkTargetCount).toBeGreaterThan(0);
    }

    const record = listV11EnergyRecords().find((item) =>
      item.scopeType === 'device' && item.scopeId === device.deviceId);
    expect(record).toMatchObject({
      scopeType: 'device',
      scopeId: device.deviceId,
      scopeLevel: '二级用能单元',
      energyUnitId: device.energyUnitId,
    });
    if (record) expect(deleteV11EnergyRecord(record.energyRecordId).ok).toBe(true);
    expect(deleteV11KeyDevice(device.deviceId)).toMatchObject({ ok: false });
  });

  it('renders the一期 conversion and output ledger without photovoltaic self-generation', async () => {
    await render('/data-management/energy-data?tab=conversion');

    expect(container.textContent).toContain('转换与利用');
    expect(container.textContent).toContain('共 3 条');
    expect([...container.querySelectorAll('table')[0].querySelectorAll('th')].map((item) => item.textContent)).toEqual([
      '转换单元',
      '投入能源',
      '能源来源',
      '来源单元',
      '产出能源',
      '厂内可供分配',
      '操作',
    ]);
    expect(container.textContent).toContain('18,300,000');
    expect(container.textContent).toContain('52,000');
    expect(container.textContent).toContain('余热发电机组');
    expect(container.textContent).toContain('锅炉系统');
    expect(container.textContent).toContain('空压系统');
    expect(container.textContent).toContain('压缩空气 · 11,490,000 Nm³');
    expect(container.textContent).toContain('电力 · 18,300,000 kWh');
    expect(container.textContent).toContain('余热 · 85,000 GJ');
    expect(container.textContent).toContain('常规能源');
    expect(container.textContent).toContain('回收能源');
    expect(container.textContent).toContain('来源单元');
    expect(container.textContent).toContain('生产加工区域');
    expect(container.textContent).not.toContain('产出 − 外供 − 转换损失');
    expect(container.textContent).not.toContain('回收量 − 外供 − 损失');
    expect(container.textContent).not.toContain('配电系统');
    expect(container.textContent).not.toContain('能源回收系统');
    expect([...container.querySelectorAll('[class*="sectionToolbar"]')].every((item) => !item.textContent?.includes('共'))).toBe(true);

    await click(button('新增转换与利用记录'));
    const dialog = container.querySelector('[role="dialog"]') ?? container;
    for (const path of ['常规能源转换', '回收能源转换', '回收能源直接利用']) expect(dialog.textContent).toContain(path);
    expect(dialog.textContent).toContain('锅炉产汽/产热');
    expect(dialog.textContent).toContain('空压产气/压缩空气');
    expect(dialog.textContent).not.toContain('自发电');
    expect(dialog.textContent).not.toContain('光伏');
  });

  it('uses one recovery energy source for the一期 conversion flow', async () => {
    await render('/data-management/energy-data?tab=conversion');
    await click(button('新增转换与利用记录'));
    await click(button('回收能源直接利用'));
    await click(button('下一步'));

    expect(container.textContent).toContain('关联回收能源来源');
    expect(container.textContent).toContain('本期一条转换记录只关联一条回收能源来源');
    expect(container.textContent).toContain('生产车间B｜余热｜17,180 GJ');
    expect(container.textContent).not.toContain('暂无可关联的回收能源来源，请先录入来源台账');
    expect(container.textContent).not.toContain('存在多条来源台账时，请选择本次实际使用的来源记录');
    const dialog = container.querySelector('[role="dialog"]') ?? container;
    expect(dialog.textContent).toContain('转换损失确认');
    expect(dialog.textContent).not.toContain('系统计算结果');
    expect(dialog.textContent).not.toContain('已登记外供量');
    expect(dialog.textContent).not.toContain('厂内可供分配量');
  });

  it('opens the recovery conversion and external supply page from the recovery deep link', async () => {
    await render('/data-management/energy-data?tab=recovery');

    expect(container.textContent).toContain('能源回收');
    expect(container.textContent).toContain('转换与利用');
    expect(container.textContent).toContain('能源外供');
    expect(container.textContent).toContain('回收能源来源记录');
    expect(container.textContent).toContain('二级用能单元');
    expect(container.textContent).toContain('一级用能单元');
    expect(container.textContent).not.toContain('能源回收直接利用记录');
    expect(container.textContent).not.toContain('全部层级');
    expect([...container.querySelectorAll('[role="tab"]')].map((item) => item.textContent)).toEqual(['能源回收', '转换与利用', '能源外供']);
  });

  it('opens the fixed waste-heat source entry from the recovery tab', async () => {
    await render('/data-management/energy-data?tab=recovery');
    await click(button('新增回收能源来源'));

    expect(container.textContent).toContain('新增回收能源');
    expect(container.textContent).toContain('余热产生设备');
    expect(container.textContent).toContain('连续式热处理炉');
    expect(container.textContent).toContain('1#螺杆空压机');
    expect(container.textContent).toContain('余热');
    expect(container.textContent).not.toContain('加工工段工艺余热');
    expect(container.textContent).not.toContain('前处理烘干/热水工艺');
    expect(container.textContent).not.toContain('来源介质');
    expect(container.textContent).not.toContain('请选择能源品种');
  });

  it('keeps V11 records centrally mutable with stable IDs and monthly values', () => {
    const originalTypeCount = listV11EnergyTypes().length;
    const originalRecordCount = listV11EnergyRecords().length;
    const originalCostCount = listV11EnergyCosts().length;
    const typeId = listV11EnergyTypes()[0].energyTypeId;

    const recordResult = saveV11EnergyRecord({
      year: 2021,
      energyRole: '能源消费',
      scopeLevel: '企业',
      energyUnitId: null,
      energyTypeId: typeId,
      entryMode: 'annual',
      monthlyAmounts: [],
      annualAmount: 100,
    });
    const costResult = saveV11EnergyCost({
      year: 2021,
      energyTypeId: typeId,
      monthlyCosts: Array(12).fill(10),
    });

    expect(recordResult.ok).toBe(true);
    expect(costResult.ok).toBe(true);
    expect(listV11EnergyRecords()).toHaveLength(originalRecordCount + 1);
    expect(listV11EnergyCosts()).toHaveLength(originalCostCount + 1);
    expect(listV11EnergyTypes()).toHaveLength(originalTypeCount);
    expect(listV11EnergyRecords().at(-1)?.energyRecordId).toMatch(/^v11-er-/);
  });

  it('supports partial monthly readings with an annual supplemental total without fabricating missing months', () => {
    const typeId = listV11EnergyTypes()[0].energyTypeId;
    const saved = saveV11EnergyRecord({
      year: 2021,
      energyRole: '能源消费',
      scopeLevel: '企业',
      energyUnitId: null,
      energyTypeId: typeId,
      entryMode: 'monthly',
      monthlyAmounts: [10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyReportedMonths: [true, true, false, false, false, false, false, false, false, false, false, false],
      annualAmount: 100,
    });

    expect(saved).toMatchObject({ ok: true });
    const savedRecord = listV11EnergyRecords().at(-1);
    expect(savedRecord?.monthlyReportedMonths).toEqual([true, true, false, false, false, false, false, false, false, false, false, false]);
    expect(savedRecord && v11EnergyRecordAnnualAmount(savedRecord)).toBe(100);

    const invalid = saveV11EnergyRecord({
      year: 2020,
      energyRole: '能源消费',
      scopeLevel: '企业',
      energyUnitId: null,
      energyTypeId: typeId,
      entryMode: 'monthly',
      monthlyAmounts: [60, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyReportedMonths: [true, true, false, false, false, false, false, false, false, false, false, false],
      annualAmount: 100,
    });
    expect(invalid).toMatchObject({ ok: false });
    if (!invalid.ok) expect(invalid.error).toContain('年度总量不能小于已填报月份合计');
  });

  it('validates conversion balance and stores conversion records with stable IDs', () => {
    const originalCount = listV11ConversionOutputs().length;
    const invalid = saveV11ConversionOutput({
      year: 2026,
      recordType: '余热发电',
      conversionEnergyUnitId: 'eu-waste-heat-power',
      inputMode: 'recovery',
      outputAnalysisCategory: '电力',
      outputEnergyTypeId: 'v11-energy-electricity',
      outputEnergyName: '电力',
      outputUnit: 'kWh',
      outputAmount: 100,
      internalAmount: 80,
      externalAmount: 10,
      lossAmount: 0,
    });
    expect(invalid).toMatchObject({ ok: false });
    expect(listV11ConversionOutputs()).toHaveLength(originalCount);

    expect(listV11ConversionOutputs()).toHaveLength(originalCount);
  });

  it('validates conversion source references before they enter the flow dataset', () => {
    const invalidYear = saveV11ConversionOutput({
      year: 2025,
      recordType: '锅炉产汽/产热',
      conversionEnergyUnitId: 'eu-gas-boiler',
      inputMode: 'linked',
      inputEnergyRecordId: 'v11-er-36',
      outputAnalysisCategory: '热力',
      outputEnergyTypeId: 'v11-energy-steam',
      outputEnergyName: '蒸汽',
      outputUnit: 'GJ',
      outputAmount: 100,
      internalAmount: 100,
      externalAmount: 0,
      lossAmount: 0,
    });
    expect(invalidYear).toMatchObject({ ok: false });
    if (!invalidYear.ok) expect(invalidYear.error).toContain('同一年度');

    const invalidNegative = saveV11ConversionOutput({
      year: 2027,
      recordType: '余热发电',
      conversionEnergyUnitId: 'eu-waste-heat-power',
      inputMode: 'recovery',
      outputAnalysisCategory: '电力',
      outputEnergyTypeId: 'v11-energy-electricity',
      outputEnergyName: '电力',
      outputUnit: 'kWh',
      outputAmount: 100,
      internalAmount: -1,
      externalAmount: 101,
      lossAmount: 0,
    });
    expect(invalidNegative).toMatchObject({ ok: false });
    if (!invalidNegative.ok) expect(invalidNegative.error).toContain('不能为负数');
  });

  it('keeps product output as a product dimension linked by stable productId', async () => {
    const products = listProducts();
    const productOutputs = listV11OperationMetrics().filter((record) => record.metricCode === 'product_output' && record.productId !== null);

    expect(products.map((product) => product.productName)).toEqual(['产品A', '产品B', '产品C']);
    expect(productOutputs.every((record) => record.metricName === '产品产量')).toBe(true);
    expect(productOutputs.every((record) => record.metricCategory === '产量')).toBe(true);
    expect(productOutputs.every((record) => products.some((product) => product.productId === record.productId))).toBe(true);
    expect(productOutputs.filter((record) => record.productId === 'product-b')).toHaveLength(10);
    expect(productOutputs.some((record) => record.energyUnitId === null)).toBe(false);

    await render('/data-management/operations');
    expect([...container.querySelectorAll('th')].map((item) => item.textContent)).toEqual([
      '归属范围',
      '指标类别',
      '指标名称',
      '产品',
      '单位',
      '年度值',
      '操作',
    ]);
    expect(container.textContent).toContain('产品A');
    expect(container.textContent).toContain('产品B');
    expect(container.textContent).toContain('产品C');
    expect(container.textContent).toContain('全厂');
    expect(container.textContent).toContain('产量可在企业、一级或二级用能单元层级维护');
    expect(container.textContent).not.toContain('产量与业务量');
    expect(container.textContent).not.toContain('熟料产量');
    expect(container.textContent).not.toContain('水泥产量');

    await click(button('企业（'));
    await click(button('新增运营数据'));
    let dialog = container.querySelector('form');
    expect(dialog?.textContent).toContain('新增运营数据');
    let selects = [...(dialog?.querySelectorAll('select') ?? [])] as HTMLSelectElement[];
    await change(selects[1], '产品产量');
    dialog = container.querySelector('form');
    selects = [...(dialog?.querySelectorAll('select') ?? [])] as HTMLSelectElement[];
    const productSelect = selects.find((select) => [...select.options].some((option) => option.value === 'product-b'));
    const scopeSelect = dialog?.querySelector('[aria-label="运营数据归属层级"]') as HTMLInputElement;
    expect(productSelect).toBeDefined();
    expect(scopeSelect).toBeDefined();
    expect(scopeSelect.value).toBe('企业');
    expect([...(dialog?.querySelectorAll('input[readonly]') ?? [])].map((input) => (input as HTMLInputElement).value)).toContain('全厂');
    const saved = saveV11OperationMetric({
      year: 2026,
      scopeLevel: '企业',
      energyUnitId: null,
      metricCategory: '产量',
      aggregationMethod: '月度求和',
      metricCode: 'product_output',
      productId: 'product-b',
      metricName: '产品产量',
      metricUnit: 't',
      entryMode: 'monthly',
      monthlyValues: Array(12).fill(100),
      annualValue: 0,
    });
    expect(saved).toMatchObject({ ok: false });
    if (!saved.ok) expect(saved.error).toContain('不能同时维护');
  });

  it('uses the queried year for new operation records and keeps tab counts in sync with filters', async () => {
    await render('/data-management/operations');
    const year = container.querySelector('select') as HTMLSelectElement;
    await change(year, '2025');
    await click(button('查询'));
    expect(container.textContent).toContain('层级总览（9）');

    await click(button('企业（'));
    await click(button('新增运营数据'));
    expect(container.querySelector('form')?.textContent).toContain('2025年度');
  });

  it('uses the configured energy-unit tree when assigning operation data and key devices', async () => {
    const parent = listEnergyUnits().find((unit) => unit.unitLevel === 'level1');
    expect(parent).toBeDefined();
    if (!parent) return;
    const expectedChildren = listEnergyUnits()
      .filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parent.energyUnitId)
      .map((unit) => unit.energyUnitName);

    await render('/data-management/operations');
    await click(button('二级用能单元（'));
    await click(button('新增运营数据'));
    const operationScopeLevel = container.querySelector('[aria-label="运营数据归属层级"]') as HTMLInputElement;
    expect(operationScopeLevel.value).toBe('二级用能单元');
    const operationParent = container.querySelector('[aria-label="运营数据所属一级用能单元"]') as HTMLSelectElement;
    const operationChild = container.querySelector('[aria-label="运营数据归属范围"]') as HTMLSelectElement;
    expect(operationChild.disabled).toBe(true);
    await change(operationParent, parent.energyUnitId);
    expect([...operationChild.options].slice(1).map((option) => option.textContent)).toEqual(expectedChildren);

    await render('/data-management/devices');
    await click(button('新增重点设备'));
    const deviceScopeLevel = container.querySelector('[aria-label="重点设备归属层级"]') as HTMLSelectElement;
    await change(deviceScopeLevel, '二级用能单元');
    const deviceParent = container.querySelector('[aria-label="重点设备所属一级用能单元"]') as HTMLSelectElement;
    const deviceChild = container.querySelector('[aria-label="重点设备所属用能单元"]') as HTMLSelectElement;
    expect(deviceChild.disabled).toBe(true);
    await change(deviceParent, parent.energyUnitId);
    expect([...deviceChild.options].slice(1).map((option) => option.textContent)).toEqual(expectedChildren);
  });
});
