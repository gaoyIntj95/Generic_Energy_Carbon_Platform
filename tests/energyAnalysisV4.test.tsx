import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  await act(async () => root.render(<EnergyAnalysisV4 pathname={pathname} />));
}

describe('EnergyAnalysisV4 prototype fidelity and interactions', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('applies and resets the consumption scope and exposes record details', async () => {
    await render('/energy-analysis/consumption-query');
    expect(container.textContent).toContain('13,320');
    expect(container.textContent).toContain('能源消费趋势（2026年1—6月）');

    await setSelect(container.querySelector('select[aria-label="用能单元"]')!, 'prodA');
    await click(button('查询'));
    expect(container.textContent).toContain('综合能耗｜生产单元A');
    expect(container.textContent).toContain('5,160');

    await click(button('查看'));
    expect(container.textContent).toContain('能源消费记录详情');
    expect(container.textContent).toContain('折标口径');
    await click(button('关闭'));

    await click(button('重置'));
    expect(container.textContent).toContain('综合能耗｜全厂');
  });

  it('keeps the intensity page as the five-row result table and opens each prototype dialog', async () => {
    await render('/energy-analysis/intensity');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.textContent).toContain('3 项可用，1 项待补充，1 项需核验');

    await click(button('去补充'));
    expect(container.textContent).toContain('补充指标数据');
    expect(container.textContent).toContain('前往运营数据');
    await click(button('取消'));

    await click(button('查看计算口径'));
    expect(container.textContent).toContain('单位产品综合能耗＝综合能耗 ÷ 产品产量');
  });

  it('supports benchmark type switching, the product empty state, and target updates', async () => {
    await render('/energy-analysis/benchmarking');
    expect(container.textContent).toContain('指标趋势（单位产值综合能耗）');
    await click(button('产品'));
    expect(container.textContent).toContain('暂无可计算的产品能效指标');

    await click(button('全部'));
    await click(button('指标目标配置'));
    const target = container.querySelector('input[aria-label="目标值"]') as HTMLInputElement;
    await setInput(target, '0.330');
    await click(button('保存配置'));
    expect(container.textContent).toContain('目标值 0.330 tce/万元');
  });

  it('switches the flow level and tabs and opens traceability details', async () => {
    await render('/energy-analysis/flow-analysis');
    expect(container.textContent).toContain('13,320');
    expect(container.innerHTML).toContain('企业一级能源分配图');

    await click(button('展开到二级'));
    expect(container.innerHTML).toContain('企业能源分配与利用图');

    await click(button('能源平衡表'));
    expect(container.textContent).toContain('二级利用口径');
    expect(container.textContent).toContain('存在未归属');

    await click(button('流向明细'));
    await click(button('查看来源'));
    expect(container.textContent).toContain('能源流向来源');
    expect(container.textContent).toContain('引用数据');
  });
});
