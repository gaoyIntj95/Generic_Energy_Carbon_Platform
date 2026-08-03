import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnergyUnit, listEnergyUnits, resetEnergyUnitMockStore } from '../src/mocks/energyUnitMockStore';
import { EnergyUnitsPage } from '../src/pages/newPrototype/EnergyUnitsPage';

let container: HTMLDivElement;
let root: Root;

function findButton(text: string, scope: ParentNode = container) {
  const button = [...scope.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  );
  if (!button) throw new Error(`未找到按钮：${text}`);
  return button as HTMLButtonElement;
}

function findRow(text: string) {
  const row = [...container.querySelectorAll('tbody tr')].find((item) =>
    item.textContent?.includes(text),
  );
  if (!row) throw new Error(`未找到表格行：${text}`);
  return row;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function setInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function setSelect(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function modalForm() {
  const form = container.querySelector('form');
  if (!form) throw new Error('未找到弹窗表单');
  return form;
}

describe('EnergyUnitsPage behavior', () => {
  beforeEach(async () => {
    resetEnergyUnitMockStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<EnergyUnitsPage />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('applies keyword and unit type filters and reset restores the complete list', async () => {
    const keyword = container.querySelector('input[aria-label="关键字"]') as HTMLInputElement;
    await setInput(keyword, '办公区域');
    await click(findButton('查询'));

    expect(container.textContent).toContain('办公区域');
    expect(container.textContent).not.toContain('生产车间A');

    await click(findButton('重置'));
    expect(container.textContent).toContain('生产车间A');

    const typeFilter = container.querySelector(
      'select[aria-label="单元类型"]',
    ) as HTMLSelectElement;
    await setSelect(typeFilter, '建筑/区域');
    await click(findButton('查询'));

    expect(container.textContent).toContain('办公区域');
    expect(container.textContent).not.toContain('生产车间B');
  });

  it('creates a level-one unit and rejects a duplicate name in the actual dialog', async () => {
    await click(findButton('新增一级用能单元'));
    let form = modalForm();
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '生产单元');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '生产车间C');
    await click(findButton('保存', form));

    expect(container.textContent).toContain('生产车间C');

    await click(findButton('新增一级用能单元'));
    form = modalForm();
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '建筑/区域');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '办公区域');
    await click(findButton('保存', form));

    expect(form.textContent).toContain('同一所属单元下已存在该名称');
  });

  it('uses the two-level structure from the latest prototype', async () => {
    expect(container.textContent).toContain('一期采用两级结构');

    const levelOneRow = findRow('动力中心');
    expect(levelOneRow.textContent).toContain('添加下级');

    const levelTwoRow = findRow('包装区域');
    expect(levelTwoRow.textContent).not.toContain('添加下级');
  });

  it('derives a child unit type from its parent and exposes only compatible alternatives on demand', async () => {
    await click(findButton('添加下级', findRow('生产车间A')));
    const form = modalForm();

    expect(form.textContent).toContain('系统默认工序/环节');
    expect(form.querySelector('select[aria-label="单元类型"]')).toBeNull();

    await click(findButton('修改类型', form));
    const typeSelect = form.querySelector('select[aria-label="单元类型"]') as HTMLSelectElement;
    expect([...typeSelect.options].map((option) => option.value)).toEqual(['工序/环节', '公辅系统', '其他']);
  });

  it('reorders sibling units without changing their parent relationship', async () => {
    await click(findButton('调整下级顺序', findRow('生产车间A')));
    const form = modalForm();
    expect(form.textContent).toContain('调整“生产车间A”下级顺序');
    const firstItem = [...form.querySelectorAll('div')].find((item) => item.textContent?.includes('加工工段') && item.textContent?.includes('下移'));
    if (!firstItem) throw new Error('未找到加工工段排序项');
    await click(findButton('下移', firstItem));
    await click(findButton('保存顺序', form));

    expect(listEnergyUnits()
      .filter((unit) => unit.parentEnergyUnitId === 'eu-clinker-line-1')
      .map((unit) => unit.energyUnitName)).toEqual(['装配工段', '加工工段', '检测工段']);
    expect(getEnergyUnit('eu-raw-material')?.parentEnergyUnitId).toBe('eu-clinker-line-1');
  });

  it('edits the selected record without changing its id or parent relationship', async () => {
    const original = getEnergyUnit('eu-packaging')!;
    await click(findButton('编辑', findRow('包装区域')));
    const form = modalForm();
    const nameInput = form.querySelector(
      'input[aria-label="用能单元名称"]',
    ) as HTMLInputElement;
    await setInput(nameInput, '包装与发运');
    await click(findButton('保存', form));

    expect(container.textContent).toContain('包装与发运');
    expect(container.textContent).not.toContain('包装区域');
    expect(getEnergyUnit('eu-packaging')).toMatchObject({
      energyUnitId: original.energyUnitId,
      parentEnergyUnitId: original.parentEnergyUnitId,
      unitLevel: original.unitLevel,
      energyUnitName: '包装与发运',
    });
  });

  it('shows deletion blockers and deletes an unreferenced record after confirmation', async () => {
    await click(findButton('删除', findRow('动力中心')));
    expect(modalForm().textContent).toContain('无法删除用能单元');
    expect(modalForm().textContent).toContain('包含下级用能单元，请先处理下级用能单元后再删除');
    expect(modalForm().textContent).not.toContain('能源记录引用');
    await click(findButton('我知道了', modalForm()));

    await click(findButton('删除', findRow('包装区域')));
    const form = modalForm();
    expect(form.textContent).toContain('确认删除');
    await click(findButton('确认删除', form));

    expect(container.textContent).not.toContain('包装区域');
    expect(getEnergyUnit('eu-packaging')).toBeUndefined();
  });
});
