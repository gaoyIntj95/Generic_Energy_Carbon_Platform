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

async function setSelect(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, value);
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

  it('uses accounting year as the user-facing context and switches independent annual data', async () => {
    await render('/carbon-accounting/inventory');

    const header = container.querySelector('[class*="inventoryTask"]')!;
    const yearSelect = header.querySelector('select[aria-label="核算年度"]') as HTMLSelectElement;
    expect(header.textContent).toContain('核算年度');
    expect(header.textContent).not.toContain('当前核算任务');
    expect(header.textContent).not.toContain('新建核算任务');
    expect([...yearSelect.options].map((option) => option.textContent)).toEqual(['2026年', '2025年']);
    expect(header.textContent?.match(/核算年度/g)).toHaveLength(1);
    expect(header.textContent).toContain('修订中');
    expect(container.textContent).toContain('102,737.63 tCO₂e');
    expect(container.textContent).toContain('原材料公路运输');
    expect(container.textContent).toContain('4 项能源数据已纳入核算');
    expect(container.textContent).not.toContain('待完善项');
    expect(container.textContent).not.toContain('查看数据规则');
    const gasRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes('天然气燃烧（锅炉系统）'))!;
    expect(gasRow.textContent).toContain('能源数据');
    expect([...gasRow.querySelectorAll('button')].some((item) => item.textContent === '编辑')).toBe(false);
    await click(button('详情', gasRow));
    expect(container.textContent).toContain('数据管理 / 能源消费数据');
    expect(container.textContent).toContain('数据期间2026年度');
    expect(container.textContent).toContain('能源品种天然气');
    expect(container.textContent).toContain('使用对象 / 用能单元锅炉系统');
    expect(container.textContent).toContain('原始活动数据1,493,000 Nm³');
    expect(container.textContent).toContain('活动数据只读');
    expect(container.querySelector('input[type="number"]')).toBeNull();
    await click(button('关闭'));

    await setSelect(yearSelect, 'ct-2025');

    const switchedHeader = container.querySelector('[class*="inventoryTask"]')!;
    expect(switchedHeader.textContent).toContain('已确认');
    expect(switchedHeader.textContent).toContain('2025年');
    expect(container.textContent).toContain('12,683.03 tCO₂e');
    expect(container.textContent).not.toContain('原材料公路运输');
  });

  it('routes confirmed-year energy changes through the existing revision flow', async () => {
    await render('/carbon-accounting/inventory');
    const yearSelect = container.querySelector('select[aria-label="核算年度"]') as HTMLSelectElement;
    await setSelect(yearSelect, 'ct-2025');
    expect(container.textContent).toContain('已确认');

    expect(container.textContent).not.toContain('清单视图');
    expect(container.textContent).not.toContain('本次修改（');
    expect(container.textContent).not.toContain('当前没有待确认修改');
    expect(container.textContent).toContain('已确认');
    expect(container.textContent).toContain('12,683.03 tCO₂e');
  });

  it('renders the V4 preview with totals and the three original analysis cards', async () => {
    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('12,980.53');
    expect(container.textContent).toContain('排放构成（按排放范围）');
    expect(container.textContent).toContain('排放趋势（近5年）');
    expect(container.textContent).toContain('主要排放源排行');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).not.toContain('草稿');
    expect(container.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(container.textContent).toContain('化石燃料燃烧排放');
    expect(container.textContent).toContain('购入电力与热力产生的排放');
    expect(container.textContent).toContain('交通运输产生的排放');
    expect(container.textContent).toContain('合计');
    expect(container.textContent).toContain('100.00%');
    expect(container.textContent).toContain('导出核算结果');
    expect(container.textContent).not.toContain('本次核算清单快照');
    const summaryTable = [...container.querySelectorAll('table')].find((table) => table.textContent?.includes('排放范围'))!;
    expect([...summaryTable.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['排放范围', '排放类别', '排放量', '占比']);
    const summaryRows = [...summaryTable.querySelectorAll('tbody tr:not(:last-child)')];
    expect(summaryRows.map((row) => row.querySelectorAll('td').length)).toEqual([4, 3, 3, 3, 4, 4]);
    expect(summaryRows.map((row) => row.textContent?.trim()).join('|')).toMatch(/化石燃料燃烧排放.*交通运输产生的排放/);
    expect(summaryTable.querySelector('tbody tr:last-child')?.textContent).toContain('12,980.53 tCO₂e');
    const rankTable = [...container.querySelectorAll('table')].find((table) => table.textContent?.includes('排放源') && table.textContent?.includes('排放量'))!;
    expect([...rankTable.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['排名', '排放源', '排放量', '占比']);
    expect(rankTable.querySelectorAll('tbody tr')).toHaveLength(5);
    expect([...rankTable.querySelectorAll('tbody tr')].every((row) => row.querySelectorAll('td').length === 4)).toBe(true);
  });

  it('renders generated carbon reports and opens the verification package export dialog', async () => {
    await render('/carbon-accounting/report');
    expect(container.textContent).toContain('选择年份');
    expect(container.textContent).toContain('生成报告');
    expect(container.textContent).toContain('7天内');
    expect(container.textContent).toContain('企业温室气体排放报告');
    expect(container.textContent).toContain('报告主体基本信息');
    expect(container.textContent).toContain('温室气体排放汇总');
    expect(container.textContent).toContain('12,980.53');
    expect(container.textContent).not.toContain('一期暂不展开报告编制页面');

    await click(button('生成报告'));
    expect(container.textContent).toContain('已基于当前正式核算清单生成排放报告');
  });

  it('filters, creates and deletes inventory records with real mock-state changes', async () => {
    await render('/carbon-accounting/inventory');
    expect(container.querySelector('[class*="inventoryTask"]')?.textContent).toContain('新增排放源');
    expect(container.querySelector('[class*="filterbar"]')?.textContent).not.toContain('新增排放源');
    const gasRow = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉系统）'))!;
    expect(gasRow.querySelector('[data-column="source-type"]')?.textContent).toContain('固定燃烧源');
    expect(gasRow.querySelector('[data-column="source"]')?.textContent).toContain('天然气燃烧（锅炉系统）');
    expect(gasRow.querySelector('[data-column="activity"]')?.textContent).toContain('1,493,000 Nm³');
    expect(gasRow.querySelector('[data-column="emission-factor"]')?.textContent).toContain('2.154 kgCO₂/Nm³');
    expect(gasRow.querySelector('[data-column="emission"]')?.textContent).toContain('3,215.92');
    expect(gasRow.querySelector('[data-column="actions"]')?.textContent).toContain('详情');
    const search = container.querySelector('input[placeholder="搜索排放源、能源品种或使用对象"]') as HTMLInputElement;
    await setInput(search, '天然气燃烧');
    expect(container.textContent).toContain('天然气燃烧（锅炉系统）');
    expect(container.textContent).not.toContain('原材料公路运输');
    await setInput(search, '');
    await click(button('新增排放源'));
    const sourceDialog = container.querySelector('[role="dialog"]')!;
    await setSelect(sourceDialog.querySelectorAll('select')[2] as HTMLSelectElement, '其他/自定义');
    await setInput(container.querySelector('input[placeholder="请输入具体排放源名称"]')!, '测试制冷剂补充');
    await setInput(container.querySelector('input[type="number"]')!, '10');
    await setInput(container.querySelector('input[placeholder="例如：kg、t、MWh"]')!, 'kg');
    await click(button('从因子库选择'));
    const r134aChoice = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('R134a'))!;
    await click(r134aChoice.querySelector('input[type="radio"]') as HTMLInputElement);
    await click(button('确认选择'));
    await click(button('保存排放源'));
    expect(container.textContent).toContain('测试制冷剂补充');

    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('测试制冷剂补充'))!;
    await click(button('删除', row));
    expect(container.textContent).toContain('不会删除能源、运营等上游模块的原始数据');
    await click(button('确认删除'));
    expect(container.textContent).not.toContain('测试制冷剂补充');
  });

  it('groups inventory categories by emission scope and cascades scope choices in the new-source dialog', async () => {
    await render('/carbon-accounting/inventory');

    const directScope = container.querySelector('[data-scope-title="范围一：直接排放"]')!;
    expect(directScope).not.toBeNull();
    const directScopeToggle = directScope.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(directScopeToggle.getAttribute('aria-expanded')).toBe('true');
    expect(directScope.textContent).not.toContain('包含 4 个排放类别');
    expect(directScope.querySelector('[data-category-title="化石燃料燃烧排放"]')).not.toBeNull();
    await click(directScopeToggle);
    expect(directScopeToggle.getAttribute('aria-expanded')).toBe('false');
    expect(directScope.querySelector('[data-category-title="化石燃料燃烧排放"]')).toBeNull();
    await click(directScopeToggle);
    expect(directScope.querySelector('[data-category-title="化石燃料燃烧排放"]')).not.toBeNull();
    expect(container.querySelector('[data-scope-title="范围二：间接排放"] [data-category-title="购入的电力与热力产生的排放"]')).not.toBeNull();
    expect(container.querySelector('[data-scope-title="范围三：其他间接排放"] [data-category-title="交通运输产生的排放"]')).not.toBeNull();

    await click(button('新增排放源'));
    const sourceDialog = container.querySelector('[role="dialog"]')!;
    const sourceNameField = [...sourceDialog.querySelectorAll('label')].find((label) => label.textContent?.includes('排放源名称'));
    expect(sourceNameField?.className).not.toContain('fieldFull');
    const scopeSelect = sourceDialog.querySelector('select[aria-label="排放范围"]') as HTMLSelectElement;
    const categorySelect = sourceDialog.querySelector('select[aria-label="排放类别"]') as HTMLSelectElement;
    expect([...scopeSelect.options].map((option) => option.textContent)).toEqual(['范围一：直接排放', '范围二：间接排放', '范围三：其他间接排放', '其他排放', '特殊排放']);

    await setSelect(scopeSelect, 'scope-2');
    expect([...categorySelect.options].map((option) => option.textContent)).toEqual(['购入的电力与热力产生的排放']);
    await setSelect(scopeSelect, 'scope-3');
    expect([...categorySelect.options].map((option) => option.textContent)).toEqual(['交通运输产生的排放', '所使用的产品和服务隐含的排放', '所生产的产品和服务的排放']);
    await setSelect(scopeSelect, 'other');
    expect([...categorySelect.options].map((option) => option.textContent)).toEqual(['其他排放']);
    await setSelect(scopeSelect, 'special');
    expect([...categorySelect.options].map((option) => option.textContent)).toEqual(['特殊排放']);
  });

  it('keeps the three carbon pages focused on formal-list context without repeated organization details', async () => {
    await render('/carbon-accounting/preview');
    const previewHeader = container.querySelector('[class*="previewTask"]')!;
    expect(previewHeader.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(previewHeader.textContent).not.toContain('草稿');
    expect(previewHeader.textContent).toContain('XX科技有限公司');
    expect(previewHeader.textContent).toContain('企业法人边界');

    await render('/carbon-accounting/inventory');
    const inventoryHeader = container.querySelector('[class*="inventoryTask"]')!;
    expect(inventoryHeader.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(inventoryHeader.textContent).toContain('XX科技有限公司');
    expect(inventoryHeader.textContent).toContain('企业法人边界');

    await render('/carbon-accounting/support');
    const supportHeader = container.querySelector('[class*="supportHead"]')!;
    expect(supportHeader.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(supportHeader.textContent).not.toContain('2026年度核算任务');
    expect(supportHeader.textContent).not.toContain('数据来源：当前正式核算清单');
    expect(supportHeader.textContent).toContain('XX科技有限公司');
    expect(supportHeader.textContent).not.toContain('2026-01-01');
  });

  it('combines trend totals and scope composition while keeping small non-zero scopes visible', async () => {
    await render('/carbon-accounting/preview');
    expect(container.querySelector('[role="group"][aria-label="趋势口径"]')).toBeNull();
    expect(container.textContent).toContain('柱顶为排放总量，柱体按范围构成');
    const currentYear = container.querySelector('[data-trend-year="2026"]')!;
    expect(currentYear.querySelectorAll('[data-scope-segment]')).toHaveLength(3);
    expect(currentYear.querySelector('[data-scope-segment="scope-3"]')?.getAttribute('title')).toContain('范围三：297.50');
  });

  it('loads the annual energy-backed inventory without a task-creation workflow', async () => {
    await render('/carbon-accounting/inventory');
    expect(container.textContent).not.toContain('开始年度核算');
    expect(container.textContent).not.toContain('新建核算任务');
    expect(container.textContent).not.toContain('待完善');
    expect(container.textContent).toContain('4 项能源数据已纳入核算');
    expect(container.textContent).toContain('外购电力（企业整体）');
    expect(container.textContent).toContain('天然气燃烧（锅炉系统）');
  });

  it('keeps synchronized activity data read-only and confirms the annual inventory', async () => {
    await render('/carbon-accounting/inventory');
    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉系统）'))!;
    await click(button('详情', row));
    expect(container.textContent).toContain('排放源详情');
    expect(container.textContent).toContain('结果因子/折算值');
    expect(container.textContent).toContain('因子拆解');
    expect(container.textContent).toContain('低位发热量 NCV');
    expect(container.textContent).toContain('活动数据只读');
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).toContain('数据追溯信息');
    await click(button('关闭'));

    await click(button('确认正式清单'));
    expect(container.textContent).toContain('更新后状态');
    await click(button('确认更新'));
    expect(container.textContent).toContain('已确认');
    expect(container.textContent).not.toContain('清单视图');
    expect(button('新增排放源').disabled).toBe(false);

    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).toContain('导出核算结果');
  });

  it('shows basic and emission-source support in one page and keeps the enterprise-factor write flow separate', async () => {
    await render('/carbon-accounting/support');
    expect(container.textContent).toContain('核算主体与组织边界');
    expect(container.textContent).not.toContain('报告主体信息');
    expect(container.textContent).not.toContain('核算方法说明');
    expect(container.querySelectorAll('[data-support-table="basic"] col')).toHaveLength(4);
    expect(container.querySelectorAll('[data-support-table="basic"] tbody tr')).toHaveLength(2);
    expect(container.querySelectorAll('[data-support-table="source"] col')).toHaveLength(8);
    expect(container.querySelector('[data-group-title="核算主体与边界"]')).toBeNull();
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    expect(container.textContent).toContain('外购电力（企业整体）');
    expect(container.textContent).not.toContain('暂无符合条件的排放源支撑材料');
    expect(container.textContent).toContain('用户仅需维护对应的支撑材料');
    expect(container.textContent).toContain('查看');
    await click(button('查看'));
    expect(container.textContent).toContain('查看核查材料');
    await click(button('关闭'));

    await render('/carbon-accounting/factors');
    await click(button('新增因子'));
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
