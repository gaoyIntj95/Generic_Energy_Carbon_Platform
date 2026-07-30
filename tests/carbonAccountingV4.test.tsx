import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPlatformMockStore } from '../src/mocks/platformMockStore';
import { CarbonAccountingV4 } from '../src/pages/newPrototype/CarbonAccountingV4';

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
  await act(async () => root.render(<MemoryRouter><CarbonAccountingV4 pathname={pathname} /></MemoryRouter>));
}

describe('CarbonAccountingV4 prototype fidelity and interactions', () => {
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

  it('renders the V4 preview with totals and the three original analysis cards', async () => {
    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('12,984.23');
    expect(container.textContent).toContain('排放构成（按结果类别）');
    expect(container.textContent).toContain('排放趋势（近5年）');
    expect(container.textContent).toContain('主要排放源排行');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).toContain('正式核算清单 V1');
    expect(container.textContent).toContain('确认人：管理员');
    expect(container.textContent).toContain('正式核算清单数据完整，共8项排放源');
    expect(container.textContent).toContain('化石燃料燃烧排放');
    expect(container.textContent).toContain('购入电力与热力产生的排放');
    expect(container.textContent).toContain('交通运输产生的排放');
    expect(container.textContent).toContain('合计');
    expect(container.textContent).toContain('100.00%');
    expect(container.textContent).toContain('查看正式核算清单');
    expect(container.textContent).toContain('导出核算结果');
    expect(container.textContent).not.toContain('本次核算清单快照');
    const summaryTable = [...container.querySelectorAll('table')].find((table) => table.textContent?.includes('排放源数量'))!;
    expect([...summaryTable.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['结果类别', '排放类别', '排放源数量', '排放量', '占比']);
    expect(summaryTable.querySelector('tbody td[rowspan="4"]')?.textContent).toBe('直接排放');
    expect(summaryTable.querySelector('tbody tr:last-child')?.textContent).toContain('12,984.23 tCO₂e');
  });

  it('renders generated carbon reports and opens the verification package export dialog', async () => {
    await render('/carbon-accounting/report');
    expect(container.textContent).toContain('选择年份');
    expect(container.textContent).toContain('生成报告');
    expect(container.textContent).toContain('7天内');
    expect(container.textContent).toContain('企业温室气体排放报告');
    expect(container.textContent).toContain('报告主体基本信息');
    expect(container.textContent).toContain('温室气体排放汇总');
    expect(container.textContent).toContain('12,984.23');
    expect(container.textContent).not.toContain('一期暂不展开报告编制页面');

    await click(button('导出核查资料包'));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('核算年度：2026年');
    expect(dialog.textContent).toContain('排放报告');
    expect(dialog.textContent).toContain('核查凭证材料');
    expect(dialog.textContent).toContain('当前正式清单已关联');
    expect(dialog.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    await click(button('取消', dialog));

    await click(button('生成报告'));
    expect(container.textContent).toContain('已基于正式核算清单 V1 生成排放报告');
  });

  it('filters, creates and deletes inventory records with real mock-state changes', async () => {
    await render('/carbon-accounting/inventory');
    const gasRow = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉房）'))!;
    expect(gasRow.querySelector('[data-column="source-type"]')?.textContent).toContain('固定燃烧源');
    expect(gasRow.querySelector('[data-column="source"]')?.textContent).toContain('天然气燃烧（锅炉房）');
    expect(gasRow.querySelector('[data-column="activity"]')?.textContent).toContain('120,000 Nm³');
    expect(gasRow.querySelector('[data-column="gas-species"]')?.textContent).toContain('CO₂');
    expect(gasRow.querySelector('[data-column="factor"]')?.textContent).toContain('2.154 kgCO₂/Nm³');
    expect(gasRow.querySelector('[data-column="emission"]')?.textContent).toContain('258.48');
    expect(gasRow.querySelector('[data-column="actions"]')?.textContent).toContain('查看');
    const search = container.querySelector('input[placeholder="搜索排放源、因子或参数"]') as HTMLInputElement;
    await setInput(search, '天然气燃烧');
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    expect(container.textContent).not.toContain('原材料公路运输');
    await setInput(search, '');
    await click(button('发起修订'));

    await click(button('新增排放源'));
    await setInput(container.querySelector('input[placeholder="例如：制冷剂逸散源"]')!, '制冷剂逸散源');
    await setInput(container.querySelector('input[placeholder="请输入排放源名称"]')!, '测试制冷剂补充');
    await setInput(container.querySelector('input[type="number"]')!, '10');
    await setInput(container.querySelector('input[placeholder="例如：kg、t、MWh"]')!, 'kg');
    await click(button('保存排放源'));
    expect(container.textContent).toContain('测试制冷剂补充');

    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('测试制冷剂补充'))!;
    await click(button('删除', row));
    expect(container.textContent).toContain('该记录为人工新增');
    await click(button('确认删除'));
    expect(container.textContent).not.toContain('测试制冷剂补充');
  });

  it('opens the dedicated source drawer, switches a parameter group and confirms a formal snapshot', async () => {
    await render('/carbon-accounting/inventory');
    await click(button('发起修订'));
    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉房）'))!;
    await click(button('编辑', row));
    expect(container.textContent).toContain('编辑排放源');
    expect(container.textContent).toContain('计算因子拆解');

    await click(button('从因子与参数库重新选择'));
    const radios = container.querySelectorAll('input[type="radio"]');
    await click(radios[1] as HTMLInputElement);
    await click(button('确认选择'));
    expect(container.textContent).toContain('2.086 kgCO₂/Nm³');
    await click(button('取消'));

    await click(button('查看本次修改'));
    expect(container.textContent).toContain('本次修改详情');
    await click(button('关闭'));
    await click(button('确认并更新正式清单'));
    expect(container.textContent).toContain('正式版本');
    await click(button('确认更新'));
    expect(container.textContent).toContain('正式清单版本：V2');
    expect(button('新增排放源').disabled).toBe(true);

    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).toContain('正式核算清单 V2');
    expect(container.textContent).toContain('确认人：管理员');
    expect(container.textContent).toContain('查看正式核算清单');
    expect(container.textContent).toContain('导出核算结果');
  });

  it('keeps support tabs and the enterprise-factor write flow separate', async () => {
    await render('/carbon-accounting/support');
    expect(container.textContent).toContain('报告主体信息');
    expect(container.querySelectorAll('[data-support-table] col')).toHaveLength(7);
    expect(container.querySelector('[data-group-title="核算主体与边界"]')?.textContent).toContain('核算主体与边界');
    await click(button('排放源支撑材料'));
    expect(container.querySelectorAll('[data-support-table] col')).toHaveLength(8);
    expect(container.querySelector('[data-group-title="化石燃料燃烧排放"]')?.textContent).toContain('化石燃料燃烧排放');
    expect(container.textContent).toContain('外购电力（企业整体）');
    expect(container.textContent).toContain('用户可根据企业实际台账、报表和凭证进行确认、调整或补充');
    expect(container.textContent).toContain('支撑管理');

    await render('/carbon-accounting/factors');
    await click(button('企业自定义因子/参数'));
    await click(button('新增企业因子/参数'));
    const factorDialog = container.querySelector('[role="dialog"]')!;
    const textInputs = [...factorDialog.querySelectorAll('input')];
    await setInput(textInputs[0], '企业测试排放因子');
    await setInput(textInputs[1], '0.123');
    await setInput(textInputs[2], 'tCO₂/t');
    await setInput(textInputs[textInputs.length - 1], '检测报告 TEST-001');
    await click(button('保存企业数据'));
    expect(container.textContent).toContain('企业测试排放因子');
  });
});
