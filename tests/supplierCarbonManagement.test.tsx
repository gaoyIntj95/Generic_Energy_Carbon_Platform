import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageHeaderActionsProvider } from '../src/components/PageHeaderActionsContext';
import { SupplierCarbonManagement } from '../src/pages/newPrototype/SupplierCarbonManagement';

let container: HTMLDivElement;
let root: Root;

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

function SupplierCarbonManagementWithActions() {
  const [actions, setActions] = useState<ReactNode>(null);
  return <PageHeaderActionsProvider setActions={setActions}>{actions}<SupplierCarbonManagement /></PageHeaderActionsProvider>;
}

describe('供应商碳数据采集', () => {
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter initialEntries={['/supply-chain-carbon/suppliers']}><SupplierCarbonManagementWithActions /></MemoryRouter>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('证明材料列表只显示上传状态，查看操作保留材料详情', async () => {
    expect(container.textContent).toContain('已上传');
    expect(container.textContent).toContain('未上传');
    expect(container.textContent).not.toContain('份材料');
    expect(container.textContent).not.toContain('热轧钢卷_碳足迹报告_2026.pdf');

    const viewButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '查看')!;
    await click(viewButton);
    expect(container.textContent).toContain('热轧钢卷_碳足迹报告_2026.pdf');
    expect(container.textContent).toContain('供应商碳数据佐证材料');
    const closeButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '关闭')!;
    await click(closeButton);
    expect(container.textContent).not.toContain('热轧钢卷_碳足迹报告_2026.pdf');
  });

  it('不显示数据状态筛选和列表字段', () => {
    expect(container.textContent).not.toContain('数据状态');
    expect(container.querySelectorAll('thead th')).toHaveLength(9);
  });

  it('碳足迹结果同行展示结果单位', () => {
    const firstFootprint = [...container.querySelectorAll('strong')].find((element) => element.textContent === '1.82')?.parentElement;
    expect(firstFootprint?.textContent).toContain('1.82kgCO₂e/kg');
    expect(firstFootprint?.querySelector('small')).not.toBeNull();
  });

  it('新增供应商碳数据时要求填写所有碳数据字段', async () => {
    const addButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('新增供应商碳数据'))!;
    await click(addButton);

    for (const labelText of ['碳足迹结果', '结果单位', '生命周期边界', '核算标准/依据', '碳数据来源', '报告/数据有效期']) {
      const label = [...container.querySelectorAll('label')].find((element) => element.textContent?.includes(labelText));
      expect(label?.querySelector('em')?.textContent).toBe('*');
    }

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '保存数据')!;
    expect(saveButton).toBeDisabled();
  });
});
