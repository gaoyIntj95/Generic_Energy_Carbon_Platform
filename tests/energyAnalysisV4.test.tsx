import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store, saveV11EnergyRecord } from '../src/mocks/dataManagementV11Store';
import { buildBenchmarkDataset } from '../src/mocks/energyBenchmarkSelector';
import { buildDeviceIntensityRows, buildIntensityCalculationView } from '../src/mocks/energyIntensitySelector';
import { getBenchmarkTarget } from '../src/mocks/benchmarkTargetStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { getProduct, saveProduct } from '../src/mocks/productMasterStore';
import { EnergyAnalysisV4 } from '../src/pages/newPrototype/EnergyAnalysisV4';

let container: HTMLDivElement;
let root: Root;
let renderVersion = 0;

function button(text: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!result) throw new Error(`未找到按钮：${text}`);
  return result as HTMLButtonElement;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function setSelect(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function setInput(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function render(pathname: string) {
  renderVersion += 1;
  const routePath = pathname.split('?')[0];
  await act(async () => root.render(
    <MemoryRouter key={renderVersion} initialEntries={[pathname]}><EnergyAnalysisV4 pathname={routePath} /><LocationProbe /></MemoryRouter>,
  ));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('EnergyAnalysisV4 prototype fidelity and interactions', () => {
  beforeEach(() => {
    resetDataManagementV11Store();
    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('applies and resets the consumption scope and exposes valuable monthly drilldown', async () => {
    await render('/energy-analysis/consumption-query');
    expect(container.textContent).toContain('8,330');
    expect(container.textContent).not.toContain('余热回收');
    expect(container.textContent).toContain('能源消费趋势（2026年1—6月）');

    await setSelect(container.querySelector('select[aria-label="用能单元"]')!, 'prodA');
    await click(button('查询'));
    expect(container.textContent).toContain('综合能耗｜生产车间A');
    expect(container.textContent).toContain('7,513');
    expect([...container.querySelectorAll('button')].filter((item) => item.textContent?.includes('导出明细台账'))).toHaveLength(1);

    const electricityRow = [...container.querySelectorAll('table tbody tr')]
      .find((row) => row.textContent?.includes('电力8,400,000'))!;
    await click(electricityRow.querySelector('button')!);
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('月度能源消费明细｜电力');
    expect(dialog.textContent).toContain('日度消费趋势');
    expect(dialog.textContent).toContain('峰值日');
    expect(dialog.querySelectorAll('table[aria-label="月度日明细"] tbody tr')).toHaveLength(30);
    expect(dialog.textContent).toContain('8,400,000');
    expect(dialog.textContent).toContain('1,032');
    await click(button('关闭'));

    await click(button('重置'));
    expect(container.textContent).toContain('综合能耗｜全厂');
  });

  it('drills an annual consumption row down to twelve monthly records with matching totals', async () => {
    await render('/energy-analysis/consumption-query');
    await click(button('年度'));
    await click(button('查询'));
    await click(button('查看明细'));

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('年度能源消费明细｜外购电力');
    expect(dialog.textContent).toContain('月度消费分解');
    expect(dialog.querySelectorAll('table[aria-label="年度月明细"] tbody tr')).toHaveLength(12);
    expect(dialog.textContent).toContain('1月');
    expect(dialog.textContent).toContain('12月');
    expect(dialog.textContent).toContain('58,900,000');
    expect(dialog.textContent).toContain('58,900');
  });

  it('keeps flow query actions on the right without a balance-page shortcut', async () => {
    await render('/energy-analysis/flow-analysis?year=2025&grain=year&month=4');

    expect((container.querySelector('select[aria-label="分析年度"]') as HTMLSelectElement).value).toBe('2025');
    expect((container.querySelector('select[aria-label="时间粒度"]') as HTMLSelectElement).value).toBe('year');
    const filterCard = container.querySelector('section[class*="flowFilters"]')!;
    expect([...filterCard.querySelectorAll('button')].map((item) => item.textContent)).toEqual(['查询', '重置']);
    expect(filterCard.querySelector('div[class*="filterSpacer"]')).not.toBeNull();
    expect(filterCard.textContent).not.toContain('进入能效平衡');
  });

  it('keeps benchmark query actions together without a balance-page shortcut', async () => {
    await render('/energy-analysis/benchmarking');

    const filterCard = container.querySelector('section[class*="benchmarkFilters"]')!;
    const actions = filterCard.querySelector('div[class*="benchmarkFilterActions"]')!;
    expect([...actions.querySelectorAll('button')].map((item) => item.textContent)).toEqual(['查询', '重置']);
    expect(filterCard.querySelector('div[class*="filterSpacer"]')).not.toBeNull();
    expect(filterCard.textContent).not.toContain('进入能效平衡');
  });

  it('opens daily records only for monthly energy rows connected to IoT', async () => {
    await render('/energy-analysis/consumption-query');

    const electricityRow = [...container.querySelectorAll('table tbody tr')]
      .find((row) => row.querySelectorAll('td')[3]?.textContent === '电力')!;
    await click(electricityRow.querySelector('button') as HTMLButtonElement);

    let dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toContain('月度能源消费明细｜电力');
    expect(dialog.textContent).toContain('日度消费趋势');
    expect(dialog.querySelectorAll('table[aria-label="月度日明细"] tbody tr')).toHaveLength(30);
    expect(dialog.textContent).toContain('正常 · 偏高 · 偏低');
    expect([...dialog.querySelectorAll('table[aria-label="月度日明细"] tbody td:last-child')]
      .some((cell) => cell.textContent?.includes('偏低'))).toBe(true);
    await click(button('关闭'));

    const steamRow = [...container.querySelectorAll('table tbody tr')]
      .find((row) => row.querySelectorAll('td')[3]?.textContent === '蒸汽')!;
    await click(steamRow.querySelector('button') as HTMLButtonElement);

    dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toContain('暂无日度数据｜蒸汽');
    expect(dialog.querySelector('table')).toBeNull();
  });

  it('shows an explicit empty state when a monthly row has no daily data', async () => {
    await render('/energy-analysis/consumption-query');

    const steamRow = [...container.querySelectorAll('table tbody tr')]
      .find((row) => row.textContent?.includes('蒸汽'))!;
    await click(steamRow.querySelector('button') as HTMLButtonElement);

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toContain('暂无日度数据');
    expect(dialog.textContent).toContain('当前月份仅维护月度汇总数据');
    expect(dialog.textContent).toContain('月度能耗数据仍可正常使用');
    expect(dialog.querySelector('table')).toBeNull();
  });

  it('treats intensity scope as a calculation object and matches shared data by stable id', async () => {
    await render('/energy-analysis/intensity');
    expect(container.textContent).not.toContain('指标计算条件');
    expect(container.textContent).toContain('单位产品综合能耗');
    expect(container.textContent).toContain('单位产值综合能耗');
    expect(container.textContent).toContain('单位增加值综合能耗数据缺失');
    expect(container.textContent).not.toContain('全厂已生成');
    expect(container.textContent).not.toContain('单位营业收入电耗');
    expect(container.textContent).toContain('单位产品综合能耗｜月度趋势与明细');
    expect(container.textContent).toContain('查看明细');
    await click(button('查看明细'));
    expect(container.textContent).toContain('环比');
    expect(container.textContent).toContain('同比');
    expect(container.textContent).toContain('综合能源消耗量');
    expect(container.textContent).toContain('产品产量');
    expect(container.textContent).not.toContain('分子');
    expect(container.textContent).not.toContain('分母');
    expect(container.textContent).toContain('暂无同比数据');
    expect(container.querySelectorAll('[aria-label="月度指标明细：单位产品综合能耗"] table tbody tr')).toHaveLength(12);
    expect(container.textContent).not.toContain('导出明细台账');

    await click(button('用能单元'));
    await setSelect(container.querySelector('select[aria-label="用能单元层级"]')!, 'level1');
    const productionObjectSelect = container.querySelector(
      'select[aria-label="具体分析对象"]',
    ) as HTMLSelectElement;
    expect([...productionObjectSelect.options].map((option) => option.textContent)).toEqual(expect.arrayContaining([
      '全部用能单元',
      '生产车间A',
      '生产车间B',
      '动力中心',
    ]));
    await setSelect(productionObjectSelect, 'eu-clinker-line-1');
    await click(button('查询'));

    expect(container.textContent).toContain('生产车间A（2026年）');
    expect(container.textContent).toContain('已关联 4 条能源消费记录');
    expect(container.textContent).toContain('已关联：产品A产量、产品B产量');
    expect(container.textContent).not.toContain('当前展示');
    expect(container.textContent).not.toContain('单位产品电耗');
    expect(container.textContent).not.toContain('综合状态');

    await click(button('查看详情'));
    expect(container.textContent).toContain('指标计算详情');
    expect(container.textContent).toContain('生产车间A综合能耗（tce）×1000 ÷ 关联产品产量');
    expect(container.textContent).toContain('分子来源能源数据—生产车间A');
    expect(container.textContent).not.toContain('v11-er-31');
    expect(container.textContent).not.toContain('v11-operation-51');
    await click(button('取消'));

    await click(button('查看计算口径'));
    expect(container.textContent).toContain('单位产品综合能耗＝综合能耗 ÷ 产品产量');
  });

  it('shows object-specific utility calculation requirements instead of generic scope results', async () => {
    await render('/energy-analysis/intensity');
    await click(button('用能单元'));
    await setSelect(container.querySelector('select[aria-label="用能单元层级"]')!, 'level2');
    const objectSelect = container.querySelector('select[aria-label="具体分析对象"]')!;
    expect(objectSelect.textContent).toContain('空压系统');
    expect(objectSelect.textContent).toContain('锅炉系统');
    expect(objectSelect.textContent).toContain('余热发电机组');
    expect(objectSelect.textContent).toContain('余热回收利用系统');

    await setSelect(objectSelect, 'eu-gas-boiler');
    await click(button('查询'));
    expect(container.textContent).not.toContain('当前展示');
    expect(container.textContent).toContain('当前筛选对象暂无已计算的能耗指标结果');
    expect(container.textContent).not.toContain('综合状态');
  });

  it('switches intensity results across product and device objects', async () => {
    await render('/energy-analysis/intensity');

    await click(button('产品'));
    const productSelect = container.querySelector('select[aria-label="具体分析对象"]') as HTMLSelectElement;
    expect(productSelect.options.length).toBeGreaterThan(1);
    await click(button('查询'));
    expect(container.textContent).toContain('关联生产单元综合能耗');
    expect(container.textContent).toContain('产品关联生产用能单元的能源消费统计');
    expect(container.textContent).toContain('一期不进行多产品能源分配');
    expect(container.textContent).not.toContain('单位产品电耗');

    await click(button('设备'));
    const deviceSelect = container.querySelector('select[aria-label="具体设备"]') as HTMLSelectElement;
    expect(deviceSelect.options.length).toBeGreaterThan(1);
    await click(button('查询'));
    expect(container.textContent).toContain('重点设备指标结果');
    expect(container.textContent).toContain('单位产出能耗');
  });

  it('uses the same action semantics across factory, product, and key-device metrics', async () => {
    await render('/energy-analysis/intensity');
    expect([...container.querySelectorAll('button')].map((item) => item.textContent)).toEqual(expect.arrayContaining(['查看详情', '补充运营数据']));

    const missingFactoryMetric = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('单位增加值综合能耗'))!;
    await click(missingFactoryMetric.querySelector('button')!);
    const factoryLocation = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(factoryLocation).toContain('/data-management/operations');
    expect(factoryLocation).toContain('scopeLevel=企业');
    expect(factoryLocation).toContain('keyword=工业增加值');
    expect(factoryLocation).toContain('returnTo=/energy-analysis/intensity?objectType=factory');

    await render('/energy-analysis/intensity');
    await click(button('产品'));
    await click(button('查看详情'));
    let dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('指标计算详情');
    expect(dialog.textContent).toContain('修改能源数据');
    expect(dialog.textContent).toContain('修改运营数据');
    await click(button('取消', dialog));

    await click(button('重点设备'));
    await click(button('查看详情'));
    dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('设备指标详情');
    expect(dialog.textContent).toContain('修改能源消耗数据');
    expect(dialog.textContent).toContain('修改设备产出数据');
    expect(dialog.textContent).toContain('设备产出数据');
    await click(button('关闭', dialog));

    await click(button('展开'));
    const dualMissingRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('2#螺杆空压机'))!;
    expect(dualMissingRow.textContent).toContain('缺2项数据');
    expect(dualMissingRow.textContent).toContain('补充能源数据');
    expect(dualMissingRow.textContent).toContain('补充产出数据');
    expect(container.querySelector('[aria-label="完善设备指标数据"]')).toBeNull();

    await click(button('补充产出数据', dualMissingRow));
    const outputLocation = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(outputLocation).toContain('/data-management/device-output');
    expect(outputLocation).toContain('deviceId=v11-device-79');
    expect(outputLocation).toContain('metricCode=compressed-air-electricity');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows supplement data only for a level-one unit with missing operation data', async () => {
    await render('/energy-analysis/intensity');
    await click(button('一级用能单元'));

    const missingRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('仓储物流区域'))!;
    expect(missingRow.textContent).toContain('补充运营数据');
    expect(missingRow.textContent).not.toContain('查看详情');
    expect([...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('办公区域'))?.textContent).toContain('查看详情');

    await click(button('补充运营数据', missingRow));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/operations');
    expect(location).toContain('scopeLevel=一级用能单元');
    expect(location).toContain('unitId=eu-public-support');
    expect(location).toContain('keyword=货物吞吐量');
    expect(location).toContain('category=运行指标');
  });

  it('routes a missing device energy action directly to device energy data', async () => {
    await render('/energy-analysis/intensity?objectType=device');
    expect(container.querySelector('table[class*="deviceMetricTable"]')).not.toBeNull();
    await click(button('展开'));
    const dualMissingRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('2#螺杆空压机'))!;

    await click(button('补充能源数据', dualMissingRow));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('scope=device');
    expect(location).toContain('deviceId=v11-device-79');
    expect(location).toContain('keyword=');
    expect(location).not.toContain('recordId=');
    expect(location).not.toContain('new=1');
    expect(container.querySelector('[aria-label="完善设备指标数据"]')).toBeNull();
  });

  it('opens the energy-data list instead of auto-editing a source record', async () => {
    await render('/energy-analysis/intensity');
    await click(button('查看详情'));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改能源数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('scopeLevel=企业');
    expect(location).toContain('keyword=全厂');
    expect(location).not.toContain('recordId=');
    expect(location).not.toContain('new=1');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('passes the device energy query when editing energy data from a device detail', async () => {
    await render('/energy-analysis/intensity?objectType=device');
    await click(button('查看详情'));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改能源消耗数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('scope=device');
    expect(location).toContain('deviceId=');
    expect(location).toContain('year=2026');
    expect(location).toContain('energyTypeId=');
    expect(location).toContain('keyword=');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('passes the unit scope when editing energy data from a unit metric', async () => {
    await render('/energy-analysis/intensity');
    await click(button('一级用能单元'));
    const officeRow = [...container.querySelectorAll('tr')]
      .find((row) => row.textContent?.includes('办公区域'))!;
    await click(button('查看详情', officeRow));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改能源数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('scopeLevel=一级用能单元');
    expect(location).toContain('keyword=办公区域');
  });

  it('passes the related energy-unit scope when editing energy data from a product metric', async () => {
    await render('/energy-analysis/intensity');
    await click(button('重点产品'));
    await click(button('查看详情'));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改能源数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('scopeLevel=一级用能单元');
    expect(location).toContain('keyword=');
  });

  it('passes the factory output-value operation query when editing a value-intensity metric', async () => {
    await render('/energy-analysis/intensity');
    const outputValueRow = [...container.querySelectorAll('tr')]
      .find((row) => row.textContent?.includes('单位产值综合能耗'))!;
    await click(outputValueRow.querySelector('button')!);
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改运营数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/operations');
    expect(location).toContain('scopeLevel=企业');
    expect(location).toContain('keyword=工业总产值');
    expect(location).toContain('category=经济指标');
  });

  it('passes the factory added-value operation query when supplementing missing data', async () => {
    await render('/energy-analysis/intensity');
    const addedValueRow = [...container.querySelectorAll('tr')]
      .find((row) => row.textContent?.includes('单位增加值综合能耗'))!;

    await click(addedValueRow.querySelector('button')!);
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/operations');
    expect(location).toContain('scopeLevel=企业');
    expect(location).toContain('keyword=工业增加值');
    expect(location).toContain('category=经济指标');
  });

  it('passes product filters when opening a product source-data entry', async () => {
    await render('/energy-analysis/intensity');
    await click(button('产品'));
    await click(button('查看详情'));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改运营数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/operations');
    expect(location).toContain('scopeLevel=一级用能单元');
    expect(location).toContain('productId=');
    expect(location).toContain('category=产量');
  });

  it('routes missing device output maintenance to the device-output page', async () => {
    await render('/energy-analysis/intensity?objectType=device');
    await click(button('展开'));
    const missingRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('2#螺杆空压机'))!;

    await click(button('补充产出数据', missingRow));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/device-output');
    expect(location).toContain('deviceId=v11-device-79');
    expect(location).toContain('metricCode=compressed-air-electricity');
    expect(container.textContent).toContain('设备产出数据');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('passes the device output query when editing output data from a device detail', async () => {
    await render('/energy-analysis/intensity?objectType=device');
    await click(button('查看详情'));
    const dialog = container.querySelector('[role="dialog"]')!;

    await click(button('修改设备产出数据', dialog));
    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/device-output');
    expect(location).toContain('deviceId=');
    expect(location).toContain('year=2026');
    expect(location).toContain('metricCode=');
    expect(location).toContain('keyword=');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('routes conversion-based device output maintenance to the conversion ledger', async () => {
    await render('/energy-analysis/intensity?objectType=device');
    const conversionRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('余热发电机组'))!;

    await click(button('查看详情', conversionRow));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('修改转换产出数据');
    await click(button('修改转换产出数据', dialog));

    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/energy-data');
    expect(location).toContain('tab=conversion');
    expect(location).toContain('editConversionId=v11-output-200');
    expect(location).not.toContain('new=1');
  });

  it('opens the populated level-one operation tab when supplementing a key product', async () => {
    await render('/energy-analysis/intensity');
    await click(button('重点产品'));

    const missingProductRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('产品C'))!;
    await click(button('补充运营数据', missingProductRow));

    const location = decodeURIComponent(container.querySelector('[data-testid="location"]')?.textContent ?? '');
    expect(location).toContain('/data-management/operations');
    expect(location).toContain('scopeLevel=一级用能单元');
    expect(location).toContain('productId=');
    expect(location).toContain('keyword=产品C');
    expect(location).toContain('category=产量');
  });

  it('calculates waste heat generator unit electricity consumption from conversion output records', () => {
    const row = buildDeviceIntensityRows(2026).find((item) => item.deviceName === '余热发电机组');
    expect(row).toMatchObject({
      metricCode: 'device-output-energy',
      metricName: '单位产出能耗',
      metricUnit: 'kWh/kWh',
      resultStatus: '已计算',
      formula: '设备耗电量 ÷ 发电量',
    });
    expect(row?.value).toBeCloseTo(0.0377, 3);

    const pendingDevice = buildDeviceIntensityRows(2026).find((item) => item.deviceName === '1#数控加工中心');
    expect(pendingDevice).toMatchObject({ metricName: '单位产出能耗', resultStatus: '待完善', resultReason: '缺少加工件产量' });
  });

  it('closes benchmark data through units, products, devices and shared energy records', async () => {
    await render('/energy-analysis/benchmarking');
    expect(container.textContent).toContain('实际值与目标值对标（单位产品综合能耗）');
    expect(container.textContent).not.toContain('差距分析');
    expect(container.querySelector('[aria-label="指标摘要"]')?.textContent).toContain('相对偏差');
    expect(container.textContent).not.toContain('查看计算口径');
    expect(container.querySelector('[aria-label="指标摘要"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="时间粒度"]')).toBeNull();
    expect(container.querySelector('select[aria-label="对标对象"]')).toBeNull();
    expect(container.querySelector('select[aria-label="指标"]')).toBeNull();
    expect(container.querySelector('select[aria-label="趋势指标"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="月度对标摘要"]')).toBeNull();
    expect(container.querySelector('[aria-label="月度达标状态"]')).toBeNull();
    expect(container.textContent).toContain('达标规则：能耗强度类指标实际值不高于目标值');

    await click(button('用能单元'));
    expect(container.textContent).toContain('生产车间A');
    expect(container.querySelector('select[aria-label="指标分类"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="一级用能单元"]')).not.toBeNull();
    expect(container.textContent).toContain('配置目标');
    expect(container.textContent).not.toContain('记录ID');

    await click(button('产品'));
    expect(container.querySelector('select[aria-label="趋势指标"]')).toBeNull();
    expect(container.textContent).toContain('当前企业尚未维护产品基础信息');
    expect(container.textContent).not.toContain('关联生产单元综合能耗');
    expect(container.textContent).not.toContain('v11-er-');
    expect(container.textContent).not.toContain('v11-operation-');

    await click(button('设备'));
    const deviceSelect = container.querySelector('select[aria-label="趋势指标"]') as HTMLSelectElement;
    expect([...deviceSelect.options].map((option) => option.textContent)).toEqual(expect.arrayContaining([
      '余热发电机组｜单位产出能耗',
    ]));
    expect([...deviceSelect.options].every((option) => !option.textContent?.includes('待完善'))).toBe(true);
    expect(container.textContent).not.toContain('待完善设备');
    expect(container.textContent).toContain('实际值与目标值对标（单位产出能耗）');
    expect(container.textContent).toContain('当前指标读取1#数控加工中心独立设备能源记录');
    expect(container.textContent).toContain('未配置目标');
    expect(container.querySelector('[aria-label="指标趋势图"]')?.textContent).not.toContain('年度目标');

    await click(button('配置目标'));
    expect(container.textContent).not.toContain('评价方向');
    expect(container.textContent).not.toContain('越低越好');
    expect(container.textContent).not.toContain('越高越好');
    const deviceTarget = container.querySelector('input[aria-label="目标值"]') as HTMLInputElement;
    expect(deviceTarget.value).toMatch(/^\d+\.\d{2}$/);
    await setInput(deviceTarget, '3300000');
    await click(button('保存配置'));
    expect(container.querySelector('[aria-label="指标摘要"]')?.textContent).toContain('目标值3,300,000kWh');

    await click(button('调整目标'));
    expect(container.querySelectorAll('[data-monthly-target]')).toHaveLength(12);
    expect(container.textContent).toContain('按年度目标填充');
    await click(button('按年度目标填充'));
    await click(button('保存配置'));
    expect(container.querySelector('[aria-label="月度达标状态"]')).not.toBeNull();

    expect(container.querySelector('[aria-label="指标趋势图"]')).not.toBeNull();

    await click(button('全厂'));
    await click(button('调整目标'));
    const target = container.querySelector('input[aria-label="目标值"]') as HTMLInputElement;
    await setInput(target, '0.330');
    await click(button('保存配置'));
    expect(container.querySelector('[aria-label="指标摘要"]')?.textContent).toContain('目标值0.330kgce/t');
  });

  it('reuses intensity actual values in benchmark rows', () => {
    const intensity = buildIntensityCalculationView(2026, 'factory', 'factory');
    const benchmark = buildBenchmarkDataset(2026);
    expect(benchmark.rows.filter((row) => row.objectTypeKey === 'enterprise').length).toBeGreaterThan(0);
    expect(benchmark.rows.filter((row) => row.objectTypeKey !== 'enterprise').length).toBeGreaterThan(0);
    const pairs = [
      ['单位产品综合能耗', 'energy_per_product'],
    ] as const;

    pairs.forEach(([metricName, metricCode]) => {
      const source = intensity.metrics.find((metric) => metric.name === metricName);
      const target = benchmark.rows.find((row) => row.objectTypeKey === 'enterprise' && row.metricCode === metricCode);
      expect(source?.value).not.toBeNull();
      expect(target?.actual).toBe(source?.value);
      expect(target?.energyRecordIds).toEqual(source?.energyRecordIds);
      expect(target?.operationMetricIds).toEqual(source?.operationMetricIds);
      expect(target?.sourceMetricId).toBe(source?.intensityMetricId);
      expect([0, 12]).toContain(target?.trend.length);
      expect(target?.trend.every((value) => Number.isFinite(value))).toBe(true);
    });

    const missing = intensity.metrics.find((metric) => metric.name === '单位增加值综合能耗');
    expect(missing).toMatchObject({ value: null, issue: '缺少工业增加值', resultType: 'warn' });
  });

  it('uses the intensity selector as the shared source for product benchmark rows', () => {
    const initial = buildBenchmarkDataset(2026);
    const productRows = initial.rows.filter((row) => row.objectTypeKey === 'product');
    expect(productRows).toHaveLength(0);
    expect(initial.unavailableReasons.product).toContain('产品基础信息');
  });

  it('uses the intensity selector as the shared source for device benchmark rows', () => {
    const intensityRows = buildDeviceIntensityRows(2026);
    const benchmarkRows = buildBenchmarkDataset(2026).rows.filter((row) => row.objectTypeKey === 'device');

    intensityRows.forEach((source) => {
      const metricCode = source.metricCode ?? 'device_template_missing';
      const target = benchmarkRows.find((row) => row.objectId === source.deviceId && row.metricCode === metricCode);
      expect(target).toBeDefined();
      expect(target).toMatchObject({
        objectName: source.deviceName,
        metricName: source.metricName,
        unit: source.metricUnit,
        actual: source.value ?? 0,
        available: source.value !== null,
        dataCompleteness: source.dataProgress,
      });
    });
  });

  it('keeps product targets and calculated history associated after a product rename', () => {
    const product = getProduct('product-a');
    expect(product).not.toBeNull();
    if (!product) return;
    const { productId, ...input } = product;
    const renamed = saveProduct({ ...input, productName: '产品A（升级）' }, productId);

    expect(renamed.ok).toBe(true);
    expect(buildBenchmarkDataset(2026).rows.find((row) =>
      row.objectTypeKey === 'product' && row.objectId === productId)?.objectName).toBe('产品A（升级）');
    expect(getBenchmarkTarget('product', productId, 'energy_per_product', 2026)?.value).toBe(52);
  });

  it('keeps the phase-one flow page on the factory level-one view with matching balance and details', async () => {
    await render('/energy-analysis/flow-analysis');
    expect(container.textContent).not.toContain('当前数据能力');
    expect(container.textContent).not.toContain('管理口径说明');
    expect(container.textContent).not.toContain('组织范围');
    expect(container.textContent).not.toContain('返回全厂视图');
    expect(container.textContent).not.toContain('展示层级');
    expect(container.textContent).not.toContain('二级利用视图');
    expect(container.textContent).not.toContain('全厂二级能源利用视图');
    expect(container.textContent).toContain('一级用能单元');
    expect(container.textContent).toContain('生产车间A');
    expect(container.textContent).toContain('生产车间B');
    expect(container.textContent).toContain('仓储物流区域');
    expect(container.textContent).toContain('办公区域');
    expect(container.innerHTML).toContain('全厂一级能源分配视图');
    expect(container.textContent).not.toContain('重点用能单元 TOP5');
    expect(container.textContent).toContain('转换损失');
    expect(container.textContent).toContain('能流口径说明');
    expect(container.textContent).toContain('未分配能源');
    expect(container.textContent).toContain('可供分配能源 − 一级分配 − 外部输出');
    expect(container.textContent).toContain('由系统根据平衡关系计算');
    expect(container.textContent).not.toContain('加工工段');

    const productionNode = container.querySelector('g[data-key="distribution:eu-clinker-line-1"]')!;
    await act(async () => productionNode.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240, clientY: 180 })));
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('生产车间A');
    const refreshedProductionNode = container.querySelector('g[data-key="distribution:eu-clinker-line-1"]')!;
    await act(async () => refreshedProductionNode.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('相关流向已高亮');
    expect(container.textContent).not.toContain('查看二级利用');
    await click(button('取消选择'));

    await click(button('能源平衡表'));
    expect(container.textContent).toContain('外部输入');
    expect(container.textContent).toContain('内部回收');
    expect(container.textContent).toContain('转换投入');
    expect(container.textContent).toContain('转换产出');
    expect(container.textContent).toContain('内部分配');
    expect(container.textContent).toContain('未归属');
    expect(container.textContent).toContain('外部输入 + 内部回收 + 转换产出');
    expect(container.textContent).not.toContain('待细分');
    expect(container.textContent).not.toContain('上下级数据仅作层级核对');

    await click(button('流向明细'));
    expect(container.textContent).toContain('来源');
    expect(container.textContent).toContain('去向');
    expect(container.textContent).toContain('输出流');
    expect(container.textContent).toContain('未归属');
    expect(container.querySelector('th')?.parentElement?.textContent).not.toContain('状态');
    expect(container.textContent).not.toContain('数据性质');
    expect(container.textContent).toContain('全部能流阶段');
    await click(button('查看追溯'));
    expect(container.textContent).toContain('能源流向追溯');
    expect(container.textContent).toContain('数据说明');
    expect(container.textContent).toContain('折标系数');
    await click(button('关闭'));
  });

  it('keeps parent distribution isolated and uses one pending node without negative links', () => {
    const period = { year: 2026, grain: 'year' as const, month: 6 };
    const levelOne = buildFlowAnalysisDataset(period, 'level1');
    const levelTwo = buildFlowAnalysisDataset(period, 'level2');

    expect(levelOne.nodes.some((node) => node.stage === 'distribution')).toBe(true);
    expect(levelOne.nodes.some((node) => node.stage === 'utilization')).toBe(false);
    expect(levelOne.detailRows.some((row) => row.stage === '能源分配')).toBe(true);
    expect(levelOne.detailRows.some((row) => row.sourceRecordIds.some((id) => id.startsWith('v11-er-')))).toBe(true);
    expect(levelOne.detailRows.some((row) => row.sourceRecordIds.some((id) => id.startsWith('v11-output-')))).toBe(true);
    expect(levelOne.internalAvailableStandardCoalAmount).toBeGreaterThan(0);
    expect(levelOne.conversionDifferenceStandardCoalAmount).toBeCloseTo(
      levelOne.conversionDifferenceRows.reduce(
        (total, row) => total + row.absoluteDifferenceStandardAmount,
        0,
      ),
    );
    expect(levelOne.conversionDifferenceRows
      .filter((row) => row.inputStandardAmount === 0)
      .every((row) => row.differenceStandardAmount === 0 && row.dataStatus === '已校验')).toBe(true);

    expect(levelTwo.viewLevel).toBe('level2');
    expect(levelTwo.nodes.some((node) => node.stage === 'input')).toBe(true);
    expect(levelTwo.nodes.some((node) => node.stage === 'conversion')).toBe(true);
    expect(levelTwo.nodes.some((node) => node.stage === 'medium')).toBe(true);
    expect(levelTwo.nodes.some((node) => node.stage === 'distribution')).toBe(true);
    expect(levelTwo.nodes.filter((node) => node.stage === 'pending')).toHaveLength(1);
    expect(levelTwo.links.every((link) => link.standardCoalAmount >= 0)).toBe(true);
    expect(levelTwo.levelTwoBalanceRows.some((row) => row.status === '待分解')).toBe(true);
    expect(levelTwo.levelTwoBalanceRows.every((row) =>
      row.pendingStandardAmount >= 0 && row.overAllocatedStandardAmount >= 0)).toBe(true);
    expect(levelTwo.detailRows.some((row) => row.stage === '待分解')).toBe(true);
    expect(levelTwo.internalMetricLabel).toBe('内部利用量');
    expect(levelTwo.differenceMetricLabel).toBe('待分解量');
  });

  it('marks over-allocated level-two energy without creating a negative pending flow', () => {
    const saved = saveV11EnergyRecord({
      year: 2026,
      scopeLevel: '二级用能单元',
      scopeType: 'energyUnit',
      scopeId: 'eu-raw-material',
      energyUnitId: 'eu-raw-material',
      energyRole: '能源消费',
      energyTypeId: 'v11-energy-electricity',
      entryMode: 'monthly',
      annualAmount: 0,
      monthlyAmounts: Array.from({ length: 12 }, () => 20_000_000),
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level2');
    const row = result.levelTwoBalanceRows.find((item) =>
      item.level1EnergyUnitId === 'eu-clinker-line-1'
      && item.energyTypeId === 'v11-energy-electricity');

    expect(row?.status).toBe('层级异常');
    expect(row?.pendingStandardAmount).toBe(0);
    expect(row?.overAllocatedStandardAmount).toBeGreaterThan(0);
    expect(result.links.every((link) => link.standardCoalAmount >= 0)).toBe(true);
    expect(result.dataNotice).toContain('层级勾稽异常');
  });
});
