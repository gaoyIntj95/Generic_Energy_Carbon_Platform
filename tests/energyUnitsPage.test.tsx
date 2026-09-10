import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnergyUnit, listEnergyUnits, resetEnergyUnitMockStore, updateEnergyUnit } from '../src/mocks/energyUnitMockStore';
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

async function selectRelation(form: HTMLFormElement, label: string) {
  const select = form.querySelector<HTMLSelectElement>('select[aria-label="常用能源转换关系"]')!;
  const option = [...select.options].find((item) => item.textContent === label);
  if (!option) throw new Error('未找到关系：' + label);
  await setSelect(select, option.value);
}

function modalForm() {
  const form = container.querySelector('form');
  if (!form) throw new Error('未找到弹窗表单');
  return form;
}

describe('EnergyUnitsPage behavior', () => {
  beforeEach(async () => {
    resetDataManagementV11Store();
    resetEnergyUnitMockStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><EnergyUnitsPage /></MemoryRouter>));
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
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '生产类用能单元');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '生产车间C');
    await click(findButton('保存', form));

    expect(container.textContent).toContain('生产车间C');

    await click(findButton('新增一级用能单元'));
    form = modalForm();
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '非生产类用能单元');
    const nonProductionType = form.querySelector('select[aria-label="非生产类用能单元类型"]') as HTMLSelectElement;
    expect([...nonProductionType.options].map((option) => option.value)).toEqual(['', '公辅系统', '建筑/区域', '其他']);
    await setSelect(nonProductionType, '建筑/区域');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '办公区域');
    await click(findButton('保存', form));

    expect(form.textContent).toContain('同一所属单元下已存在该名称');
  });

  it('uses the two-level structure from the latest prototype', async () => {
    expect(container.textContent).toContain('一期仅支持两级');

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

  it('keeps the initial power-center form compact and saves a common relation with an optional remark', async () => {
    await click(findButton('添加下级', findRow('动力中心')));
    const form = modalForm();
    expect(form.querySelectorAll('select')).toHaveLength(1);
    expect(form.querySelectorAll('[role="group"]')).toHaveLength(1);
    const remark = form.querySelector('details')!;
    expect(remark.open).toBe(false);
    expect(form.querySelector('select[aria-label="投入能源"]')).toBeNull();
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '新增空压站');
    await selectRelation(form, '电力 → 压缩空气');
    await click(remark.querySelector('summary')!);
    await setInput(form.querySelector('textarea[aria-label="备注"]')!, '备用系统');
    await click(findButton('保存', form));
    expect(listEnergyUnits().find((unit) => unit.energyUnitName === '新增空压站')).toMatchObject({
      unitType: '公辅系统', remark: '备用系统',
      energyRelations: [{ inputEnergyTypeId: 'v11-energy-electricity', outputEnergyTypeId: 'v11-energy-compressed-air' }],
    });
    await click(findButton('编辑', findRow('新增空压站')));
    expect(modalForm().querySelector('details')?.open).toBe(true);
    expect(modalForm().querySelector<HTMLTextAreaElement>('textarea[aria-label="备注"]')?.value).toBe('备用系统');
  });

  it('uses a single relation and switches between presets and editable dictionary fields without losing values', async () => {
    const count = listEnergyUnits().length;
    await click(findButton('添加下级', findRow('动力中心')));
    const form = modalForm();
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '企业锅炉装置');
    expect(form.textContent).not.toContain('添加一条关系');
    expect(form.textContent).not.toContain('热电联产');
    await click(findButton('保存', form));
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('请选择常用能源转换关系');
    expect(listEnergyUnits()).toHaveLength(count);
    await selectRelation(form, '原煤 → 蒸汽');
    await click(findButton('自定义', form));
    expect(form.querySelector('select[aria-label="常用能源转换关系"]')).toBeNull();
    expect(findButton('自定义', form).getAttribute('aria-pressed')).toBe('true');
    expect(form.querySelector<HTMLSelectElement>('select[aria-label="投入能源"]')?.value).toBe('v11-energy-coal');
    expect(form.querySelector<HTMLSelectElement>('select[aria-label="产出能源"]')?.value).toBe('v11-energy-steam');
    await setSelect(form.querySelector('select[aria-label="产出能源"]')!, 'v11-energy-coal');
    await click(findButton('保存', form));
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('投入与产出能源不能相同');
    expect(listEnergyUnits()).toHaveLength(count);
    await setSelect(form.querySelector('select[aria-label="产出能源"]')!, 'v11-energy-electricity');
    await click(findButton('常用关系', form));
    expect(form.querySelector<HTMLSelectElement>('select[aria-label="常用能源转换关系"]')?.selectedOptions[0].textContent).toBe('原煤 → 电力');
    expect(form.querySelector('select[aria-label="投入能源"]')).toBeNull();
    await click(findButton('保存', form));
    expect(listEnergyUnits().find((unit) => unit.energyUnitName === '企业锅炉装置')?.energyRelations).toEqual([
      { inputEnergyTypeId: 'v11-energy-coal', outputEnergyTypeId: 'v11-energy-electricity' },
    ]);
  });

  it('does not truncate existing multiple relations through the single-relation editor', async () => {
    const original = listEnergyUnits().find((unit) => unit.energyUnitName === '锅炉系统')!;
    const relations = [
      { inputEnergyTypeId: 'v11-energy-coal', outputEnergyTypeId: 'v11-energy-steam' },
      { inputEnergyTypeId: 'v11-energy-coal', outputEnergyTypeId: 'v11-energy-electricity' },
    ];
    expect(updateEnergyUnit(original.energyUnitId, { ...original, energyRelations: relations }).ok).toBe(true);
    await click(findButton('编辑', findRow('锅炉系统')));
    const form = modalForm();
    expect(form.textContent).toContain('原有数据已保留');
    expect(form.querySelector('select[aria-label="常用能源转换关系"]')).toBeNull();
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '修改不应保存');
    await click(findButton('保存', form));
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('暂不支持编辑');
    expect(getEnergyUnit(original.energyUnitId)).toMatchObject({ energyUnitName: original.energyUnitName, energyRelations: relations });
  });

  it('saves a custom energy pair from the annual dictionary', async () => {
    const template = listV11EnergyTypes().find((type) => type.energyTypeId === 'v11-energy-natural-gas')!;
    saveV11EnergyType({ ...template, energyTypeName: '自定义燃料' });
    const fuel = listV11EnergyTypes().find((type) => type.energyTypeName === '自定义燃料')!;
    await click(findButton('添加下级', findRow('动力中心')));
    const form = modalForm();
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '企业自定义装置');
    await click(findButton('自定义', form));
    await setSelect(form.querySelector('select[aria-label="投入能源"]')!, fuel.energyTypeId);
    await setSelect(form.querySelector('select[aria-label="产出能源"]')!, 'v11-energy-steam');
    await click(findButton('常用关系', form));
    await click(findButton('保存', form));
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('请选择常用能源转换关系');
    await click(findButton('自定义', form));
    expect(form.querySelector<HTMLSelectElement>('select[aria-label="投入能源"]')?.value).toBe(fuel.energyTypeId);
    await click(findButton('保存', form));
    expect(listEnergyUnits().find((unit) => unit.energyUnitName === '企业自定义装置')?.energyRelations).toEqual([{ inputEnergyTypeId: fuel.energyTypeId, outputEnergyTypeId: 'v11-energy-steam' }]);
    await click(findButton('编辑', findRow('企业自定义装置')));
    expect(modalForm().querySelector<HTMLSelectElement>('select[aria-label="投入能源"]')?.value).toBe(fuel.energyTypeId);
  });

  it('explains relation selection on hover, keyboard focus and click without submitting', async () => {
    await click(findButton('添加下级', findRow('动力中心')));
    const form = modalForm();
    const help = form.querySelector<HTMLButtonElement>('button[aria-label="能源转换关系选择说明"]')!;
    expect(form.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => help.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(form.querySelector('[role="tooltip"]')?.textContent).toContain('不限定企业的单元名称');
    await act(async () => help.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
    expect(form.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => help.focus());
    expect(help.getAttribute('aria-describedby')).toBe(form.querySelector('[role="tooltip"]')?.id);
    await act(async () => help.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})));
    expect(form.querySelector('[role="tooltip"]')).toBeNull();
    await click(help);
    expect(form.querySelector('[role="tooltip"]')?.textContent).toContain('实际投入和产出的能源');
    expect(modalForm()).toBe(form);
    expect(form.querySelector('[role="alert"]')).toBeNull();
  });

  it('restores the energy relation of an existing secondary energy unit', async () => {
    await click(findButton('编辑', findRow('锅炉系统')));
    expect(modalForm().querySelector<HTMLSelectElement>('select[aria-label="常用能源转换关系"]')?.selectedOptions[0].textContent).toBe('天然气 → 蒸汽');
  });

  it('clears the relation when changing to another unit type', async () => {
    await click(findButton('添加下级', findRow('动力中心')));
    const form = modalForm();
    await selectRelation(form, '天然气 → 蒸汽');
    await setInput(form.querySelector('input[aria-label="用能单元名称"]')!, '动力中心其他单元');
    await click(findButton('修改类型', form));
    await setSelect(form.querySelector('select[aria-label="单元类型"]')!, '其他');
    expect(form.querySelector('select[aria-label="投入能源"]')).toBeNull();
    await click(findButton('保存', form));
    expect(listEnergyUnits().find((unit) => unit.energyUnitName === '动力中心其他单元')).toMatchObject({
      unitType: '其他', energyRelations: undefined, conversionScenarios: [],
    });
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
    expect(modalForm().textContent).toContain('下级用能单元')
    expect(modalForm().textContent).toContain('去处理');
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
import { resetDataManagementV11Store, listV11EnergyTypes, saveV11EnergyType } from '../src/mocks/dataManagementV11Store';
