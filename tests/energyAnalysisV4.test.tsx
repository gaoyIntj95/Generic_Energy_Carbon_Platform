import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store, saveV11EnergyRecord } from '../src/mocks/dataManagementV11Store';
import { buildBenchmarkDataset } from '../src/mocks/energyBenchmarkSelector';
import { buildIntensityCalculationView } from '../src/mocks/energyIntensitySelector';
import { getBenchmarkTarget } from '../src/mocks/benchmarkTargetStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { getProduct, saveProduct, updateProductAllocation } from '../src/mocks/productMasterStore';
import { EnergyAnalysisV4 } from '../src/pages/newPrototype/EnergyAnalysisV4';

let container: HTMLDivElement;
let root: Root;

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
  await act(async () => root.render(
    <MemoryRouter initialEntries={[pathname]}>
      <EnergyAnalysisV4 pathname={pathname} />
    </MemoryRouter>,
  ));
}

describe('EnergyAnalysisV4 prototype fidelity and interactions', () => {
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

  it('applies and resets the consumption scope and exposes valuable monthly drilldown', async () => {
    await render('/energy-analysis/consumption-query');
    expect(container.textContent).toContain('13,320');
    expect(container.textContent).toContain('能源消费趋势（2026年1—6月）');

    await setSelect(container.querySelector('select[aria-label="用能单元"]')!, 'prodA');
    await click(button('查询'));
    expect(container.textContent).toContain('综合能耗｜生产车间A');
    expect(container.textContent).toContain('5,160');
    expect([...container.querySelectorAll('button')].filter((item) => item.textContent?.includes('导出明细台账'))).toHaveLength(1);

    await click(button('查看明细'));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('月度能源消费明细｜外购电力');
    expect(dialog.textContent).toContain('日度消费趋势');
    expect(dialog.textContent).toContain('峰值日');
    expect(dialog.querySelectorAll('table[aria-label="月度日明细"] tbody tr')).toHaveLength(30);
    expect(dialog.textContent).toContain('5,380,000');
    expect(dialog.textContent).toContain('3,199');
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

  it('treats intensity scope as a calculation object and matches shared data by stable id', async () => {
    await render('/energy-analysis/intensity');
    expect(container.textContent).toContain('指标计算条件');
    expect(container.textContent).toContain('全厂（2026年）');
    expect(container.textContent).toContain('全厂已生成 4 项指标');
    expect(container.textContent).toContain('单位产品综合能耗');
    expect(container.textContent).toContain('单位产值综合能耗');
    expect(container.textContent).toContain('单位营业收入电耗');
    expect(container.textContent).not.toContain('导出明细台账');

    await click(button('用能单元'));
    await setSelect(container.querySelector('select[aria-label="用能单元层级"]')!, 'level1');
    const productionObjectSelect = container.querySelector(
      'select[aria-label="具体分析对象"]',
    ) as HTMLSelectElement;
    expect([...productionObjectSelect.options].map((option) => option.textContent)).toEqual([
      '全部用能单元',
      '生产车间A',
      '生产车间B',
      '动力中心',
    ]);
    await setSelect(productionObjectSelect, 'eu-clinker-line-1');
    await click(button('查询'));

    expect(container.textContent).toContain('生产车间A（2026年）');
    expect(container.textContent).toContain('已关联 4 条能源消费记录');
    expect(container.textContent).toContain('已关联：产品A产量、产品B产量');
    expect(container.textContent).toContain('生产车间A已生成 3 项指标，其中 2 项已计算，1 项待完善');
    expect(container.textContent).toContain('待完善');

    await click(button('查看详情'));
    expect(container.textContent).toContain('指标计算详情');
    expect(container.textContent).toContain('生产车间A能源消费折标量 ÷ 对应产品产量');
    expect(container.textContent).toContain('已关联能源记录 4 条、运营记录 1 条');
    expect(container.textContent).not.toContain('v11-er-31');
    expect(container.textContent).not.toContain('v11-operation-51');
    await click(button('关闭'));

    await click(button('完善数据'));
    expect(container.textContent).toContain('补充指标数据');
    expect(container.textContent).toContain('前往数据管理');
    expect(container.textContent).not.toContain('energyUnitId');
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
    expect(objectSelect.textContent).toContain('能源回收系统');

    await setSelect(objectSelect, 'eu-gas-boiler');
    await click(button('查询'));
    expect(container.textContent).toContain('锅炉系统（2026年）');
    expect(container.textContent).toContain('已关联 1 条能源消费记录');
    expect(container.textContent).toContain('未匹配到当前对象的运营数据');
    expect(container.textContent).toContain('缺少蒸汽产量');
    expect(container.textContent).toContain('单位蒸汽综合能耗');
  });

  it('switches intensity results across product and device objects', async () => {
    await render('/energy-analysis/intensity');

    await click(button('产品'));
    const productSelect = container.querySelector('select[aria-label="具体分析对象"]') as HTMLSelectElement;
    expect(productSelect.options.length).toBeGreaterThan(1);
    await click(button('查询'));
    expect(container.textContent).toContain('单位产品综合能耗');
    expect(container.textContent).toContain('单位产品电耗');

    await click(button('设备'));
    const deviceSelect = container.querySelector('select[aria-label="具体分析对象"]') as HTMLSelectElement;
    expect(deviceSelect.options.length).toBeGreaterThan(1);
    await click(button('查询'));
    expect(container.textContent).toContain('设备年度总能耗');
    expect(container.textContent).toContain('单位运行时长能耗');
  });

  it('closes benchmark data through units, products, devices and shared energy records', async () => {
    await render('/energy-analysis/benchmarking');
    expect(container.textContent).toContain('指标趋势（单位增加值综合能耗）');
    expect(container.textContent).toContain('差距分析');
    expect(container.querySelector('[aria-label="指标摘要"]')).not.toBeNull();

    await click(button('用能单元'));
    expect(container.textContent).toContain('生产车间A');
    expect(container.textContent).toContain('当前指标按生产车间A中归属于生产车间A的综合能耗');
    expect(container.textContent).not.toContain('记录ID');

    await click(button('产品'));
    const productSelect = container.querySelector('select[aria-label="对标对象"]') as HTMLSelectElement;
    expect([...productSelect.options].map((option) => option.textContent)).toEqual([
      '产品A｜可对标',
      '产品B｜可对标',
      '产品C｜待完善：未关联生产单元。',
    ]);
    await setSelect(productSelect, 'product-b');
    expect(container.textContent).toContain('产品B');
    expect(container.textContent).toContain('指标趋势（单位产品综合能耗）');
    const productSummary = container.querySelector('[aria-label="指标摘要"]');
    expect(productSummary?.textContent).toContain('当前值');
    expect(productSummary?.textContent).toContain('目标值26.0kgce/t');
    expect(container.textContent).toContain('生产车间A按40%分摊；生产车间B全部归属');
    expect(container.textContent).toContain('全部产品指标对标明细');
    expect(container.textContent).toContain('待完善');
    expect(container.textContent).not.toContain('v11-er-');
    expect(container.textContent).not.toContain('v11-operation-');

    await setSelect(productSelect, 'product-c');
    expect(container.textContent).toContain('当前产品暂无法计算单位产品综合能耗');
    expect(container.textContent).toContain('原因：未关联生产单元');

    await click(button('设备'));
    const deviceSelect = container.querySelector('select[aria-label="对标对象"]') as HTMLSelectElement;
    expect([...deviceSelect.options].map((option) => option.textContent)).toEqual(expect.arrayContaining([
      '1#数控加工中心｜待完善',
      '连续式热处理炉｜待完善',
      '1#螺杆空压机｜待完善：尚未录入设备级能源数据。',
    ]));
    expect(container.textContent).toContain('指标趋势（电力消费量）');
    expect(container.textContent).toContain('当前指标读取1#数控加工中心独立设备能源记录');
    expect(container.textContent).toContain('未配置目标');
    expect(container.textContent).toContain('12/12月');
    expect(container.querySelector('[aria-label="指标趋势图"]')?.textContent).not.toContain('年度目标');

    await click(button('指标目标配置'));
    const deviceTarget = container.querySelector('input[aria-label="目标值"]') as HTMLInputElement;
    await setInput(deviceTarget, '3300000');
    await click(button('保存配置'));
    expect(container.querySelector('[aria-label="指标摘要"]')?.textContent).toContain('目标值3,300,000kWh');
    expect(container.querySelector('[aria-label="指标趋势图"]')?.textContent).not.toContain('年度目标');

    await setSelect(container.querySelector('select[aria-label="时间粒度"]')!, 'year');
    expect(container.querySelector('[aria-label="指标趋势图"]')?.textContent).toContain('年度目标 3,300,000');

    await setSelect(deviceSelect, 'v11-device-62');
    expect(container.textContent).toContain('已维护重点设备，但尚未录入设备级能源数据');
    expect(container.textContent).toContain('录入设备能源数据');

    await click(button('全部'));
    await click(button('指标目标配置'));
    const target = container.querySelector('input[aria-label="目标值"]') as HTMLInputElement;
    await setInput(target, '0.330');
    await click(button('保存配置'));
    expect(container.querySelector('[aria-label="指标摘要"]')?.textContent).toContain('目标值0.330tce/万元');
  });

  it('reuses intensity actual values in benchmark rows', () => {
    const intensity = buildIntensityCalculationView(2026, 'factory', 'factory');
    const benchmark = buildBenchmarkDataset(2026);
    expect(benchmark.rows.filter((row) => row.objectTypeKey === 'enterprise').length).toBeGreaterThan(0);
    expect(benchmark.rows.filter((row) => row.objectTypeKey !== 'enterprise').length).toBeGreaterThan(0);
    const pairs = [
      ['单位产品综合能耗', 'energy_per_product'],
      ['单位增加值综合能耗', 'energy_per_added_value'],
    ] as const;

    pairs.forEach(([metricName, metricCode]) => {
      const source = intensity.metrics.find((metric) => metric.name === metricName);
      const target = benchmark.rows.find((row) => row.objectTypeKey === 'enterprise' && row.metricCode === metricCode);
      expect(source?.value).not.toBeNull();
      expect(target?.actual).toBe(source?.value);
      expect(target?.energyRecordIds).toEqual(source?.energyRecordIds);
      expect(target?.operationMetricIds).toEqual(source?.operationMetricIds);
      expect([0, 12]).toContain(target?.trend.length);
      expect(target?.trend.every((value) => Number.isFinite(value))).toBe(true);
    });
  });

  it('aggregates multi-unit product energy with explicit allocation and blocks invalid shared-line ratios', () => {
    const initial = buildBenchmarkDataset(2026);
    const productA = initial.rows.find((row) => row.productId === 'product-a');
    const productB = initial.rows.find((row) => row.productId === 'product-b');
    const productC = initial.rows.find((row) => row.productId === 'product-c');

    expect(productA).toMatchObject({ available: true, scopeNames: ['生产车间A'] });
    expect(productB).toMatchObject({ available: true, scopeNames: ['生产车间A', '生产车间B'] });
    expect(productB?.operationMetricIds).toHaveLength(2);
    expect(productC).toMatchObject({ available: false, unavailableReason: '未关联生产单元。' });

    updateProductAllocation('product-a', 'ratio', [
      { energyUnitId: 'eu-clinker-line-1', share: 70 },
    ]);
    const invalid = buildBenchmarkDataset(2026);
    expect(invalid.rows.find((row) => row.productId === 'product-a')).toMatchObject({
      available: false,
      unavailableReason: '当前生产单元的产品能源分摊比例合计为110%，必须等于100%。',
    });
    expect(invalid.rows.find((row) => row.productId === 'product-b')?.available).toBe(false);
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
    expect(container.textContent).toContain('重点用能单元 TOP5');
    expect(container.textContent).toContain('转换损失');
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
    expect(container.textContent).toContain('数据性质');
    expect(container.textContent).toContain('管理差额');
    expect(container.textContent).toContain('全部能流阶段');
    await click(button('查看追溯'));
    expect(container.textContent).toContain('能源流向数据追溯');
    expect(container.textContent).toContain('对应数据管理记录');
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
