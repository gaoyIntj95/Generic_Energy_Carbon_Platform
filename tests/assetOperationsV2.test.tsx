import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getBudgetTarget,
  listCarbonAssets,
  resetPlatformMockStore,
} from '../src/mocks/platformMockStore';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { AssetOperationsV2 } from '../src/pages/newPrototype/AssetOperationsV2';

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

async function setSelect(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function render(pathname: string) {
  await act(async () => root.render(<AssetOperationsV2 pathname={pathname} />));
}

describe('AssetOperationsV2 V2 prototype fidelity and interactions', () => {
  beforeEach(() => {
    resetPlatformMockStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses the shared flow aggregation in the V7 balance overview and opens unit details', async () => {
    const levelTwo = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level2');
    const unitInput = levelTwo.levelTwoBalanceRows
      .reduce((total, row) => total + row.distributionStandardAmount, 0);
    await render('/asset-strategy/balance');
    expect(container.textContent).toContain('能源输入量');
    expect(container.textContent).toContain('终端有效利用量');
    expect(container.textContent).toContain('回收利用量');
    expect(container.textContent).toContain('外部输出量');
    expect(container.textContent).toContain('平衡偏差');
    expect(container.textContent).toContain('能效平衡总览');
    expect(container.textContent).toContain('关键偏差对象 TOP5');
    expect(container.textContent).toContain('用能单元平衡清单');
    expect(container.textContent).toContain('AI平衡研判');
    expect(container.textContent).toContain(
      unitInput.toLocaleString('zh-CN', { maximumFractionDigits: 1 }),
    );
    expect(container.textContent).not.toContain('待细分量');
    expect(container.textContent).not.toContain('层级异常量');
    expect(container.textContent).not.toContain('利用归集率');

    await click(button('查看详情'));
    expect(container.textContent).toContain('能效平衡诊断');
    expect(container.textContent).toContain('问题判断');
    expect(container.textContent).toContain('查看能流分析');
    expect(container.textContent).toContain('前往能源数据');
  });

  it('filters a single unit with the simplified business balance fields', async () => {
    await render('/asset-strategy/balance');
    const selects = [...container.querySelectorAll('select')];
    await setSelect(selects[2], 'eu-clinker-line-1');
    await click(button('查询'));

    expect(container.textContent).toContain('生产车间A');
    expect(container.textContent).toContain('能源输入量');
    expect(container.textContent).toContain('终端有效利用量');
    expect(container.textContent).toContain('平衡偏差');
    expect(container.textContent).toContain('偏差率');
    expect(container.textContent).not.toContain('待细分量');
    expect(container.textContent).not.toContain('利用归集率');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('switches budget tabs and saves target configuration into the shared store', async () => {
    await render('/asset-strategy/budget');
    expect(container.textContent).toContain('120,600');
    await click(button('碳排放预算管理'));
    expect(container.textContent).toContain('95,000');
    expect(container.textContent).toContain('51,200');

    await click(button('目标预算配置'));
    const target = container.querySelector('input[aria-label="年度目标"]') as HTMLInputElement;
    await setInput(target, '96000');
    await click(button('保存'));

    expect(getBudgetTarget('carbon')?.targetValue).toBe(96000);
    expect(container.textContent).toContain('96,000');
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

    await click(button('新周期履约需求预测'));
    expect(container.textContent).toContain('用于企业内部未来排放预测和碳资产需求规划');
    const baseline = container.querySelector('input[aria-label="历史基准排放"]') as HTMLInputElement;
    await setInput(baseline, '100000');
    await click(button('保存预测'));
    expect(container.textContent).toContain('101,000');
    expect(container.textContent).toContain('5,200');
  });

  it.each([
    ['/asset-strategy/analysis', 'AI用能洞察', '生产规模变化驱动'],
    ['/asset-strategy/assets', 'AI履约研判', '账面碳资产仍无法完全覆盖'],
  ])('renders the V7 AI summary on %s with one report entry', async (pathname, title, judgement) => {
    await render(pathname);

    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(judgement);
    const reportButtons = [...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('导出分析报告'));
    expect(reportButtons).toHaveLength(1);
  });

  it('keeps separate energy and carbon budget judgements', async () => {
    await render('/asset-strategy/budget');
    expect(container.textContent).toContain('年度能源预算存在超支风险');

    await click(button('碳排放预算管理'));
    expect(container.textContent).toContain('年度碳排放预算存在超标风险');
    expect([...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('导出分析报告'))).toHaveLength(1);
  });

  it('opens evidence, implementation details and the same-source report', async () => {
    await render('/asset-strategy/analysis');

    await click(button('查看研判依据'));
    expect(container.textContent).toContain('页面引用的系统事实');
    expect(container.textContent).toContain('能源消费总量同比');
    expect(container.textContent).toContain('+2.3%');
    await click(button('标记已阅'));

    await click(button('研发实现说明'));
    expect(container.textContent).toContain('一次生成形成一份结构化分析结果');
    expect(container.textContent).toContain('analysisId');
    await click(button('关闭说明'));

    await click(button('导出分析报告'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('用能洞察专项分析报告');
    expect(container.textContent).toContain('页面摘要与本报告读取同一个 analysisId');
    expect(container.textContent).toContain('下载HTML报告');
  });

  it('marks the AI result stale when query conditions change', async () => {
    await render('/asset-strategy/analysis');
    await click(button('查询'));

    expect(container.textContent).toContain('需更新');
    expect(container.textContent).toContain('当前摘要与报告仍基于上一版数据快照');
    expect([...container.querySelectorAll('button')]
      .filter((item) => item.textContent?.includes('重新生成'))).toHaveLength(1);
  });
});
