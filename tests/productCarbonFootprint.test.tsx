import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductCarbonFootprint } from '../src/pages/newPrototype/ProductCarbonFootprint';

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
  });
}

describe('产品碳足迹运输活动', () => {
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-carbon-footprint/activity" /></MemoryRouter>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('以质量和距离计算入厂运输周转量，并提供运输方式下拉选择', async () => {
    await click(button('入厂运输'));
    await click(button('新增入厂运输'));

    const dialog = container.querySelector('form')!;
    expect(dialog.textContent).toContain('运输重量');
    expect(dialog.textContent).toContain('运输周转量');
    const transportLabel = [...dialog.querySelectorAll('label')].find((label) => label.textContent?.includes('运输参数'))!;
    expect(transportLabel.parentElement?.getAttribute('style')).toContain('grid-column: 1 / -1');
    const sourceLabel = [...dialog.querySelectorAll('label')].find((label) => label.textContent?.includes('数据来源'))!;
    expect(sourceLabel.parentElement?.getAttribute('style')).toContain('grid-column: 1 / -1');
    const selects = dialog.querySelectorAll('select');
    expect([...selects[0].options].map((option) => option.textContent)).toEqual(['t', 'kg']);
    expect([...selects[1].options].map((option) => option.textContent)).toEqual(expect.arrayContaining([
      '公路货运（柴油货车）', '铁路货运', '沿海及远洋海运', '航空货运',
    ]));

    const inputs = dialog.querySelectorAll('input');
    await setInput(inputs[1], '0.35');
    await setInput(inputs[2], '120');
    expect(dialog.textContent).toContain('42.0000 t·km');
  });

  it('将工艺过程排放录入为生产过程排放，并支持两种排放量获取方式', async () => {
    await click(button('工艺过程排放'));
    await click(button('新增工艺过程排放'));
    const dialog = container.querySelector('form')!;
    expect(dialog.textContent).toContain('新增生产过程排放');
    expect(dialog.textContent).toContain('排放活动');
    expect(dialog.textContent).toContain('温室气体');
    expect(dialog.textContent).toContain('每个排放活动对应固定的排放量获取方式');
    expect(dialog.textContent).toContain('请选择排放活动');
    expect(dialog.textContent).toContain('选择排放活动后，系统自动加载对应的数据录入项。');
    expect(dialog.textContent).not.toContain('计算排放量');
    const activitySelect = dialog.querySelector('select') as HTMLSelectElement;
    await act(async () => { activitySelect.value = '碳酸盐分解'; activitySelect.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(dialog.textContent).toContain('碳酸盐原料消耗量');
    expect(dialog.textContent).toContain('请选择碳酸盐分解排放因子');
  });

  it('将确认后的核算清单快照传递至核算结果和报告', async () => {
    await click(button('补充因子'));
    await click(container.querySelector('input[type="radio"]')!);
    await click(button('确认选择'));
    await click(button('确认核算清单'));

    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-carbon-footprint/results" /></MemoryRouter>));
    expect(container.textContent).toContain('工业变频器 VFD-75');
    expect(container.textContent).toContain('98.88');
    expect(container.textContent).toContain('已确认清单快照');
    expect(container.querySelector('div[style*="conic-gradient"]')).not.toBeNull();
    expect(container.textContent).not.toContain('生成报告');

    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-carbon-footprint/reports" /></MemoryRouter>));
    expect(container.textContent).toContain('数据依据已确认核算清单快照');
    expect(container.textContent).toContain('98.88');
  });
});
