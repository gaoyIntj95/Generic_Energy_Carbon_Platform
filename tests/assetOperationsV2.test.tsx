import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getBudgetTarget,
  listCarbonAssets,
  resetPlatformMockStore,
} from '../src/mocks/platformMockStore';
import { buildFlowAnalysisDataset, summarizeFlowBalance } from '../src/mocks/energyFlowSelector';
import { buildIntensityCalculationViews } from '../src/mocks/energyIntensitySelector';
import { resetBalanceOptimizationStore } from '../src/mocks/balanceOptimizationStore';
import { AssetOperationsV2, buildStrategyAnalysis } from '../src/pages/newPrototype/AssetOperationsV2';

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

async function setInput(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function render(pathname: string) {
  const routePath = pathname.split('?')[0];
  await act(async () => root.render(
    <MemoryRouter initialEntries={[pathname]}>
      <AssetOperationsV2 pathname={routePath} />
      <LocationProbe />
    </MemoryRouter>,
  ));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('AssetOperationsV2 V2 prototype fidelity and interactions', () => {
  beforeEach(() => {
    resetPlatformMockStore();
    resetBalanceOptimizationStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses the shared flow aggregation in the V7 balance overview and opens unit details', async () => {
    const levelOne = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const levelTwo = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level2');
    const summary = summarizeFlowBalance(levelOne, levelTwo);
    await render('/asset-strategy/balance');
    expect(container.textContent).toContain('一级管理平衡基数');
    expect(container.textContent).toContain('能源分配平衡概览');
    expect(container.textContent).toContain('诊断摘要');
    expect(container.textContent).toContain('能效对标');
    expect(container.textContent).toContain('能效对标诊断');
    expect(container.textContent).toContain('能耗指标变化');
    expect(container.textContent).toContain('数据完整性问题');
    expect(container.textContent).toContain('同比');
    expect(container.textContent).toContain('环比');
    expect(container.textContent).toContain('异常问题清单');
    expect(container.textContent).toContain('AI辅助分析');
    expect(container.textContent).toContain('下一步行动');
    expect(container.textContent).not.toContain('研发实现说明');
    expect(container.textContent).not.toContain('生成：');
    expect(container.textContent).not.toContain('查看详情 →');
    expect(container.textContent).toContain('能效对标偏离');
    expect(container.textContent).toContain('办公区域');
    expect(container.textContent).toContain('当前期间缺少6月能耗指标数据');
    expect(container.textContent).toContain(
      summary.inputStandardCoalAmount.toLocaleString('zh-CN', { maximumFractionDigits: 1 }),
    );
    expect(summary.effectiveUseStandardCoalAmount).toBeCloseTo(levelOne.utilizationStandardCoalAmount, 8);
    expect(summary.differenceStandardCoalAmount).toBeCloseTo(levelOne.differenceStandardCoalAmount, 8);

    await click(button('查看详情'));
    expect(container.textContent).toContain('能效对标详情｜生产车间B');
    expect(container.querySelector('aside')).toBeNull();
    const diagnosisDialog = container.querySelector('form[role="dialog"]');
    expect(diagnosisDialog).not.toBeNull();
    expect(diagnosisDialog?.textContent).not.toContain('高优先级');
    expect(diagnosisDialog?.textContent).not.toContain('基本闭合');
    expect(diagnosisDialog?.textContent).not.toContain('建议动作');
    expect(diagnosisDialog?.textContent).not.toContain('诊断上下文');
    expect(container.textContent).toContain('指标证据');
    expect(container.textContent).toContain('同比/环比变化');
    expect(container.textContent).toContain('kgce/t');
    expect(container.textContent).not.toContain('AI分析结论');
    expect(container.textContent).toContain('查看能效对标');
    expect(container.textContent).not.toContain('AI辅助说明');
    expect(diagnosisDialog?.textContent).not.toContain('核查详情');
  });

  it('opens a trend-specific dialog from the B diagnosis group', async () => {
    await render('/asset-strategy/balance');
    const trendGroup = [...container.querySelectorAll('section[class*="energyDiagnosisGroup"]')]
      .find((section) => [...section.querySelectorAll('strong')].some((node) => node.textContent === '能耗指标变化'))!;
    await click(button('查看详情', trendGroup));
    expect(container.textContent).toContain('能耗指标变化详情｜生产车间B');
    expect(container.textContent).toContain('指标趋势');
    expect(container.querySelector('[aria-label="能耗指标月度趋势图"]')).not.toBeNull();
    expect(container.textContent).not.toContain('对标目标');
    expect(container.textContent).not.toContain('查看能流分析');
    expect(container.textContent).toContain('查看能耗指标');
  });

  it('opens the follow-up dialog from a pending status and keeps progress out of the metric detail', async () => {
    await render('/asset-strategy/balance');
    const productionBRow = [...container.querySelectorAll('tr')]
      .find((row) => row.textContent?.includes('生产车间B'))!;
    await click(button('去核查', productionBRow));

    expect(container.textContent).toContain('问题核查｜生产车间B');
    expect(container.textContent).toContain('处理进展');
    expect(container.textContent).toContain('保存处理结果');
    expect(container.textContent).not.toContain('完成依据');
    expect(container.textContent).not.toContain('指标证据');

    await click(button('关闭'));
    expect(container.textContent).not.toContain('问题核查｜生产车间B');
  });

  it('links data-completeness issues directly to data entry', async () => {
    await render('/asset-strategy/balance');
    const dataGroup = [...container.querySelectorAll('section[class*="energyDiagnosisGroup"]')]
      .find((section) => [...section.querySelectorAll('strong')].some((node) => node.textContent === '数据完整性问题'))!;
    await click(button('补充数据', dataGroup));
    expect(container.textContent).not.toContain('数据完整性｜办公区域');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps the balance overview at enterprise scope without treating missing level-two decomposition as loss', async () => {
    await render('/asset-strategy/balance');
    const filterBar = container.querySelector('section');
    expect(filterBar?.textContent).not.toContain('统计范围');
    expect(filterBar?.textContent).not.toContain('对比口径');
    expect(container.textContent).toContain('全企业 · 2026年6月');
    expect(container.textContent).not.toContain('8,095.7 tce');
    expect(container.textContent).toContain('一级分配与外供 ÷ 管理平衡基数');
  });

  it('keeps enterprise scope when opened with a legacy level-one scope URL', async () => {
    const levelTwo = buildFlowAnalysisDataset({ year: 2025, grain: 'year', month: 6 }, 'level2');
    const unitId = levelTwo.levelTwoBalanceRows[0]?.level1EnergyUnitId;
    expect(unitId).toBeTruthy();
    await render(`/asset-strategy/balance?year=2025&grain=year&month=6&scope=${unitId}`);

    const selects = [...container.querySelectorAll('select')];
    expect(selects[0].value).toBe('2025');
    expect(container.textContent).toContain('2025年度');
    expect(container.textContent).toContain('全企业 · 2025年度');
  });

  it('keeps multiple balance diagnosis data scenarios connected to the shared calculation views', () => {
    const views = buildIntensityCalculationViews(2026, 'unit', 'level1');
    const byName = (name: string) => views.find((view) => view.object.objectName === name)!;
    const productionA = byName('生产车间A');
    const productionB = byName('生产车间B');
    const office = byName('办公区域');
    const warehouse = byName('仓储物流区域');
    const metric = (view: typeof productionA) => view.metrics[0];

    expect(metric(productionA).monthlyMetrics[5]?.status).toBe('已计算');
    expect(metric(productionA).value).not.toBeNull();
    expect(metric(productionB).monthlyMetrics[5]?.status).toBe('已计算');
    expect(Math.abs(metric(productionB).monthlyMetrics[5]?.yoyChange ?? 0)).toBeGreaterThanOrEqual(15);
    expect(metric(office).monthlyMetrics[5]?.status).not.toBe('已计算');
    expect(metric(warehouse).monthlyMetrics[5]?.status).toBe('已计算');
  });

  it('switches budget tabs and saves target configuration into the shared store', async () => {
    await render('/asset-strategy/budget');
    expect(container.textContent).toContain('120,600');
    expect(container.textContent).toContain('调整目标');
    expect(container.textContent).toContain('配置目标');
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')?.textContent).toContain('20,000');
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')?.textContent).toContain('目标 120,600');
    await click(button('碳排放预算管理'));
    expect(container.textContent).toContain('95,000');
    expect(container.textContent).toContain('51,200');
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')?.textContent).toContain('12,000');
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')?.textContent).toContain('目标 95,000');

    await click(button('目标预算配置'));
    expect(container.textContent).not.toContain('分解方式');
    const target = container.querySelector('input[aria-label="年度目标"]') as HTMLInputElement;
    await setInput(target, '96000');
    await click(button('保存'));

    expect(getBudgetTarget('carbon')?.targetValue).toBe(96000);
    expect(container.textContent).toContain('96,000');
  });

  it('links the enterprise trend to the selected energy-unit breakdown row', async () => {
    await render('/asset-strategy/budget');
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')).not.toBeNull();

    const trendSelect = container.querySelector('select[aria-label="趋势对象"]') as HTMLSelectElement;
    await act(async () => {
      trendSelect.value = '生产车间A';
      trendSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('[aria-label="生产车间A年度预算累计趋势图"]')).not.toBeNull();
    expect(container.textContent).not.toContain('当前趋势');
    expect(container.querySelector('button').textContent).not.toContain('返回企业总览');

    await act(async () => {
      trendSelect.value = '全企业';
      trendSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[aria-label="年度预算累计趋势图"]')).not.toBeNull();
  });

  it('includes every first-level energy unit in the budget breakdown and trend selector', async () => {
    await render('/asset-strategy/budget');
    expect(container.textContent).toContain('125,600');
    expect(container.textContent).toContain('+5,000');
    expect(container.textContent).not.toContain('点击重新预测生成预测结果');
    for (const name of ['生产车间A', '生产车间B', '动力中心', '办公区域', '仓储物流区域']) {
      expect(container.textContent).toContain(name);
      expect(container.querySelector('select[aria-label="趋势对象"]')?.textContent).toContain(name);
    }
  });

  it('creates a carbon asset and updates the new-cycle compliance demand forecast', async () => {
    await render('/asset-strategy/assets');
    expect(container.textContent).toContain('95,000');
    expect(container.textContent).toContain('履约缺口趋势');
    expect(container.textContent).toContain('新周期履约需求预测');
    expect(container.textContent).toContain('99,000');
    expect(container.textContent).toContain('4,000');

    await click(button('录入碳资产'));
    const amount = container.querySelector('input[aria-label="资产数量（tCO₂）"]') as HTMLInputElement;
    await setInput(amount, '800');
    await click(button('保存'));
    expect(listCarbonAssets('2026年度')).toHaveLength(4);

    await click(button('开始预测'));
    expect(container.textContent).toContain('用于企业内部未来排放预测和碳资产需求规划');
    const baseline = container.querySelector('input[aria-label="历史基准排放"]') as HTMLInputElement;
    await setInput(baseline, '100000');
    await click(button('保存预测'));
    expect(container.textContent).toContain('101,000');
    expect(container.textContent).toContain('5,200');
  });

  it.each([
    ['/asset-strategy/analysis', 'AI用能洞察', '生产规模变化驱动'],
    ['/asset-strategy/assets', 'AI履约准备分析', '预计全年排放约10.5万吨'],
  ])('renders the V7 AI summary on %s with one report entry', async (pathname, title, judgement) => {
    await render(pathname);

    expect(container.textContent).toContain(title);
    if (pathname.endsWith('/assets')) {
      expect(container.textContent).toContain('开始分析');
      expect(container.textContent).not.toContain(judgement);
      await click(button('开始分析'));
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)); });
      expect(container.textContent).toContain(judgement);
      expect([...container.querySelectorAll('button')].filter((item) => item.textContent?.includes('查看研判依据'))).toHaveLength(0);
      expect([...container.querySelectorAll('button')].filter((item) => item.textContent?.includes('重新生成'))).toHaveLength(0);
    } else {
      expect(container.textContent).toContain(judgement);
    }
    const reportButtons = [...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('导出分析报告'));
    expect(reportButtons).toHaveLength(1);
  });

  it('turns duplicated structure charts into a finding-to-action analysis flow', async () => {
    const analysis = buildStrategyAnalysis('month', '全企业');
    await render('/asset-strategy/analysis');

    expect(container.textContent).not.toContain('统计范围');
    expect(container.textContent).toContain('能源品种消耗与成本对比');
    expect(container.textContent).toContain('单位综合用能成本');
    expect(container.textContent).toContain('元/tce');
    expect(container.textContent).toContain('结构对比分析发现');
    expect(container.textContent).toContain('从能源结构、成本结构和单位成本');
    expect(container.textContent).toContain('重点用能单元分析');
    expect(container.textContent).toContain('分析结论');
    expect(container.textContent).toContain('能耗量（tce）');
    expect(container.textContent).toContain('能耗占比');
    expect(container.textContent).toContain('能效指标');
    expect(container.textContent).toContain('能耗量同比');
    expect(container.textContent).not.toContain('能效依据');
    expect(container.textContent).not.toContain('优先关注级别');
    expect(container.textContent).toContain('能耗量');
    expect(container.textContent).toContain('估算成本（万元）');
    expect(container.textContent).toContain('不代表用能单元实际财务成本');
    expect(container.textContent).toContain('能效');
    expect(container.textContent).not.toContain('来源：');
    expect([...container.querySelectorAll('button')].some((item) => item.textContent?.includes('查看分析'))).toBe(true);
    const incompleteUnitRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('办公区域'));
    expect(incompleteUnitRow?.textContent).toContain('完善数据');
    expect(container.textContent).toContain('能耗占比');
    expect(container.textContent).toContain('成本占比');
    expect(container.textContent).toContain('单位用能成本');
    expect(container.textContent).not.toContain('单位成本 = 成本 ÷ 能耗量');
    expect(container.textContent).toContain('元/tce');
    expect(container.textContent).not.toContain('tce · 估算成本');
    expect(container.textContent).toContain('能耗占比');
    expect(container.textContent).toContain('成本占比');
    expect(container.textContent).toContain('操作');
    expect(container.textContent).not.toContain('能源消费结构');
    expect(container.textContent).not.toContain('能源成本结构');
    expect(analysis.structureDiagnosis).toHaveLength(analysis.query.structure.length);
    expect(analysis.coreFindings).toHaveLength(3);
    expect(analysis.coreFindings.map((finding) => finding.title).join(' ')).not.toContain('生产车间');
    expect(analysis.coreFindings.map((finding) => finding.title).join(' ')).toContain('成本结构差异');
    expect(analysis.coreFindings.map((finding) => finding.title).join(' ')).toContain('单位用能成本最高');
    expect(container.querySelectorAll('[class*="findingNeutral"]')).toHaveLength(3);
    expect(container.textContent).not.toContain('成本贡献显著偏高');
    expect(analysis.rows[0]?.action).toBeTruthy();
    expect(analysis.rows.find((row) => row.name === '生产车间B')?.efficiency?.ruleCode).toBe('BENCHMARK_DEVIATION');
    expect(analysis.rows.find((row) => row.name === '生产车间B')?.actionCode).toBe('GO_BENCHMARK');
    expect(analysis.rows.find((row) => row.name === '办公区域')?.efficiency?.ruleCode).toBe('METRIC_PERIOD_INCOMPLETE');
    expect(analysis.rows.find((row) => row.name === '办公区域')?.actionCode).toBe('GO_INTENSITY');

    await click(button('查看分析'));
    expect(container.textContent).toContain('生产车间A｜用能分析详情');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('纳入分析原因');
    expect(container.textContent).toContain('判断依据');
    expect(container.textContent).toContain('关键指标');
    expect(container.textContent).toContain('能耗量');
    expect(container.textContent).toContain('能耗占比');
    expect(container.textContent).toContain('单位产品综合能耗');
    expect(container.textContent).not.toContain('基于当前诊断类型');
    expect(container.textContent).toContain('暂无明显偏差');
    expect(container.textContent).toContain('继续观察单位产品综合能耗变化');
    expect(container.textContent).not.toContain('数据口径');
    expect(container.textContent).not.toContain('能源计量数据是否完整');
    expect(container.textContent).not.toContain('采购价格或计价方式影响');
    expect(container.textContent).not.toContain('分析指标');
    expect(container.textContent).not.toContain('问题编码');
  });

  it('keeps separate energy and carbon budget judgements', async () => {
    await render('/asset-strategy/budget');
    expect(container.textContent).toContain('年度能源预算存在超支风险');

    await click(button('碳排放预算管理'));
    expect(container.textContent).toContain('年度碳排放预算存在超标风险');
    expect([...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('导出分析报告'))).toHaveLength(1);
  });

  it('keeps strategy analysis focused on the report action', async () => {
    await render('/asset-strategy/analysis');

    expect(container.textContent).not.toContain('查看研判依据');
    expect(container.textContent).not.toContain('重新生成');

    await click(button('开始策略分析'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)); });
    await click(button('导出分析报告'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('用能分析与策略推荐报告');
    expect(container.textContent).toContain('分析编号：');
    expect(container.textContent).toContain('下载HTML报告');
  });

  it('does not expose regeneration after strategy query conditions change', async () => {
    await render('/asset-strategy/analysis');
    await click(button('查询'));

    expect(container.textContent).toContain('查询条件已更新');
    expect([...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('重新生成'))).toHaveLength(0);
  });
});
