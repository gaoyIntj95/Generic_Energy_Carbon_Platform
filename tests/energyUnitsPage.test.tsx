import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnergyUnit, resetEnergyUnitMockStore } from '../src/mocks/energyUnitMockStore';
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
    await setInput(keyword, '办公楼');
    await click(findButton('查询'));

    expect(container.textContent).toContain('办公楼');
    expect(container.textContent).not.toContain('1号熟料生产线');

    await click(findButton('重置'));
    expect(container.textContent).toContain('1号熟料生产线');

    const typeFilter = container.querySelector(
      'select[aria-label="单元类型"]',
    ) as HTMLSelectElement;
    await setSelect(typeFilter, '建筑/区域');
    await click(findButton('查询'));

    expect(container.textContent).toContain('办公楼');
    expect(container.textContent).not.toContain('水泥粉磨线');
  });

  it('creates a level-one unit and rejects a duplicate name in the actual dialog', async () => {
    await click(findButton('新增一级用能单元'));
    let form = modalForm();
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '生产单元');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '2号熟料生产线');
    await click(findButton('保存', form));

    expect(container.textContent).toContain('2号熟料生产线');

    await click(findButton('新增一级用能单元'));
    form = modalForm();
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '建筑/区域');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '办公楼');
    await click(findButton('保存', form));

    expect(form.textContent).toContain('用能单元名称已存在');
  });

  it('adds a third-level child under the selected parent with the correct id relationship', async () => {
    const parentRow = findRow('包装发运');
    await click(findButton('添加下级', parentRow));
    const form = modalForm();

    expect(form.textContent).toContain('所属单元');
    expect(form.textContent).toContain('包装发运');
    expect(form.textContent).toContain('三级用能单元');

    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '工序/环节');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '包装输送');
    await click(findButton('保存', form));

    const created = [...container.querySelectorAll('tbody tr')].find((row) =>
      row.textContent?.includes('包装输送'),
    );
    expect(created).toBeTruthy();
    expect(getEnergyUnit('eu-mock-100')?.parentEnergyUnitId).toBe('eu-packaging');
    expect(getEnergyUnit('eu-mock-100')?.unitLevel).toBe('level3');
  });

  it('edits the selected record without changing its id or parent relationship', async () => {
    const original = getEnergyUnit('eu-packaging')!;
    await click(findButton('编辑', findRow('包装发运')));
    const form = modalForm();
    const nameInput = form.querySelector(
      'input[aria-label="用能单元名称"]',
    ) as HTMLInputElement;
    await setInput(nameInput, '包装与发运');
    await click(findButton('保存', form));

    expect(container.textContent).toContain('包装与发运');
    expect(container.textContent).not.toContain('包装发运');
    expect(getEnergyUnit('eu-packaging')).toMatchObject({
      energyUnitId: original.energyUnitId,
      parentEnergyUnitId: original.parentEnergyUnitId,
      unitLevel: original.unitLevel,
      energyUnitName: '包装与发运',
    });
  });

  it('shows deletion blockers and deletes an unreferenced record after confirmation', async () => {
    await click(findButton('删除', findRow('公辅系统')));
    expect(modalForm().textContent).toContain('无法删除用能单元');
    expect(modalForm().textContent).toContain('4 个下级用能单元');
    await click(findButton('我知道了', modalForm()));

    await click(findButton('删除', findRow('包装发运')));
    const form = modalForm();
    expect(form.textContent).toContain('确认删除');
    await click(findButton('确认删除', form));

    expect(container.textContent).not.toContain('包装发运');
    expect(getEnergyUnit('eu-packaging')).toBeUndefined();
  });
});
