import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductCarbonFootprint } from '../src/pages/newPrototype/ProductCarbonFootprint';

let container: HTMLDivElement;
let root: Root;

function button(text: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!result) throw new Error(`未找到按钮：${text}`);
  return result as HTMLButtonElement;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

describe('产品碳足迹运输活动', () => {
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-footprint/projects/1/checklist" /><LocationProbe /></MemoryRouter>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('入厂运输复用统一的标准活动数据弹窗', async () => {
    await click(button('入厂运输'));
    await click(button('新增入厂运输'));

    const dialog = container.querySelector('form')!;
    expect(dialog.textContent).toContain('活动数据');
    expect(dialog.textContent).toContain('排放因子');
    expect(dialog.textContent).toContain('证明材料');
    expect(dialog.textContent).not.toContain('运输重量');
    expect(dialog.textContent).not.toContain('运输方式');
    const selects = dialog.querySelectorAll('select');
    expect([...selects[0].options].map((option) => option.textContent)).toEqual(['t·km', 'kg·km']);
  });

  it('工艺过程排放统一使用活动数据和因子法', async () => {
    await click(button('工艺过程排放'));
    await click(button('新增工艺过程排放'));
    const dialog = container.querySelector('form')!;
    expect(dialog.textContent).toContain('新增工艺过程排放');
    expect(dialog.textContent).toContain('活动数据');
    expect(dialog.textContent).toContain('排放因子');
    expect(dialog.textContent).toContain('证明材料');
    expect([...dialog.querySelectorAll('label')].some((label) => label.textContent?.includes('核算方式'))).toBe(false);
    expect(dialog.textContent).toContain('选择排放因子');
    expect(dialog.textContent).not.toContain('排放量获取方式');
    expect(dialog.textContent).not.toContain('参数计算');
    expect(dialog.textContent).not.toContain('实测排放量');
    await click(button('选择排放因子'));
    expect([...container.querySelectorAll('button')].some((item) => item.textContent?.trim() === '选择')).toBe(false);
  });

  it('项目列表移除更新时间列', async () => {
    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-footprint/projects" /><LocationProbe /></MemoryRouter>));
    expect(container.querySelector('table')?.textContent).not.toContain('更新时间');
  });

  it('将确认后的核算清单快照传递至核算结果和报告', async () => {
    const editButtons = [...container.querySelectorAll('button')].filter((item) => item.textContent?.trim() === '编辑');
    await click(editButtons[editButtons.length - 1]);
    await click(button('选择排放因子'));
    await click(container.querySelector('input[type="radio"]')!);
    await click(button('确认选择'));
    await click(button('保存'));
    await click(button('确认核算清单'));

    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-footprint/projects/1/result" /></MemoryRouter>));
    expect(container.textContent).toContain('工业变频器 VFD-75');
    expect(container.textContent).toContain('98.88');
    expect(container.textContent).toContain('已确认清单快照');
    expect(container.textContent).toContain('排放量（kgCO₂e/1 台产品）');
    expect(container.textContent).toContain('65.88 kgCO₂e/1 台产品');
    expect(container.querySelector('div[style*="conic-gradient"]')).not.toBeNull();
    expect(container.textContent).not.toContain('生成报告');

    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-footprint/projects/1/report" /></MemoryRouter>));
    expect(container.textContent).toContain('数据依据已确认核算清单快照');
    expect(container.textContent).toContain('98.88');
    expect(container.textContent).toContain('01 报告摘要');
    expect(container.textContent).toContain('03 数据收集与核算方法');
    expect(container.textContent).toContain('06 排放热点与减排建议');
  });

  it('在项目工作台内保持当前项目上下文并切换 Tab', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/product-footprint/projects/1/checklist']}><ProductCarbonFootprint pathname="/product-footprint/projects/1/checklist" /><LocationProbe /></MemoryRouter>));
    expect(container.textContent).toContain('热轧钢卷');
    await click(button('核算结果'));
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/product-footprint/projects/1/result');
    expect(container.textContent).toContain('工业变频器 VFD-75');
    expect(container.textContent).not.toContain('核算项目');
  });

  it('从项目链接打开清单时按 projectId 恢复对应项目', async () => {
    await act(async () => root.render(<MemoryRouter key="project-3" initialEntries={['/product-footprint/projects/3/checklist']}><ProductCarbonFootprint pathname="/product-footprint/projects/3/checklist" /><LocationProbe /></MemoryRouter>));

    expect(container.textContent).toContain('PCB 线路板');
    expect(container.textContent).not.toContain('热轧钢卷');
    expect(container.textContent).toContain('电子控制器 EC-20');
  });

  it('按目标详情字段展示公共碳足迹因子', async () => {
    await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname="/product-footprint/factors" /><LocationProbe /></MemoryRouter>));
    await click(button('查看'));

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).not.toContain('数据质量综合评估');
    expect(dialog.textContent).not.toContain('数据点击量');
    expect(dialog.textContent).toContain('功能单元');
    expect(dialog.textContent).toContain('核算边界');
    expect(dialog.textContent).toContain('技术代表性');
    expect(dialog.textContent).toContain('地域代表性');
    expect(dialog.textContent).toContain('数据来源');
    expect(dialog.textContent).toContain('数据时间');
    expect(dialog.textContent).toContain('产品描述');
    expect(dialog.textContent).toContain('生命周期各阶段碳足迹');
    expect(dialog.textContent).not.toContain('原始数据编号');
    expect(dialog.textContent).not.toContain('数据说明');
  });
});
