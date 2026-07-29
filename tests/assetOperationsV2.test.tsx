import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getBudgetTarget,
  listCarbonAssets,
  resetPlatformMockStore,
} from '../src/mocks/platformMockStore';
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

  it('renders the five balance KPIs, flow, table, and detail drawer', async () => {
    await render('/asset-strategy/balance');
    expect(container.textContent).toContain('28,450');
    expect(container.textContent).toContain('终端有效利用量');
    expect(container.textContent).toContain('关键偏差对象 TOP5');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);

    await click(button('查看详情'));
    expect(container.textContent).toContain('平衡详情');
    expect(container.textContent).toContain('可能原因');
    expect(container.textContent).toContain('生成优化方案');
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

  it('creates a carbon asset and updates the new-cycle estimate', async () => {
    await render('/asset-strategy/assets');
    expect(container.textContent).toContain('95,000');
    expect(container.textContent).toContain('履约缺口趋势');

    await click(button('录入碳资产'));
    const amount = container.querySelector('input[aria-label="资产数量（tCO₂）"]') as HTMLInputElement;
    await setInput(amount, '800');
    await click(button('保存'));
    expect(listCarbonAssets('2026年度')).toHaveLength(4);

    await click(button('新周期配额测算'));
    const result = container.querySelector('input[aria-label="初步测算结果"]') as HTMLInputElement;
    await setInput(result, '97000');
    await click(button('保存测算'));
    expect(container.textContent).toContain('97,000');
  });
});
