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

  it('renders the V4 preview with totals and the three original analysis cards', async () => {
    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('12,984.23');
    expect(container.textContent).toContain('排放构成（按结果类别）');
    expect(container.textContent).toContain('排放趋势（近5年）');
    expect(container.textContent).toContain('主要排放源排行');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).toContain('正式核算清单｜确认人：管理员');
    expect(container.textContent).toContain('确认人：管理员');
    expect(container.textContent).not.toContain('草稿');
    expect(container.textContent).toContain('依据标准：GB/T 32150—2025');
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
    expect(container.textContent).toContain('已基于当前正式核算清单生成排放报告');
  });

  it('filters, creates and deletes inventory records with real mock-state changes', async () => {
    await render('/carbon-accounting/inventory');
    expect(container.querySelector('[class*="inventoryTask"]')?.textContent).toContain('新增排放源');
    expect(container.querySelector('[class*="filterbar"]')?.textContent).not.toContain('新增排放源');
    const gasRow = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉房）'))!;
    expect(gasRow.querySelector('[data-column="source-type"]')?.textContent).toContain('固定燃烧源');
    expect(gasRow.querySelector('[data-column="source"]')?.textContent).toContain('天然气燃烧（锅炉房）');
    expect(gasRow.querySelector('[data-column="activity"]')?.textContent).toContain('120,000 Nm³');
    expect(gasRow.querySelector('[data-column="gas-species"]')?.textContent).toContain('CO₂');
    expect(gasRow.querySelector('[data-column="emission-factor"]')?.textContent).toContain('2.154 kgCO₂/Nm³');
    expect(gasRow.querySelector('[data-column="emission"]')?.textContent).toContain('258.48');
    expect(gasRow.querySelector('[data-column="actions"]')?.textContent).toContain('查看');
    const search = container.querySelector('input[placeholder="搜索排放源、因子或参数"]') as HTMLInputElement;
    await setInput(search, '天然气燃烧');
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    expect(container.textContent).not.toContain('原材料公路运输');
    await setInput(search, '');
    await click(button('发起修订'));

    await click(button('新增排放源'));
    const sourceDialog = container.querySelector('[role="dialog"]')!;
    await setSelect(sourceDialog.querySelectorAll('select')[2] as HTMLSelectElement, '其他/自定义');
    await setInput(container.querySelector('input[placeholder="请输入具体排放源名称"]')!, '测试制冷剂补充');
    await setInput(container.querySelector('input[type="number"]')!, '10');
    await setInput(container.querySelector('input[placeholder="例如：kg、t、MWh"]')!, 'kg');
    await click(button('保存排放源'));
    expect(container.textContent).toContain('测试制冷剂补充');

    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('测试制冷剂补充'))!;
    await click(button('删除', row));
    expect(container.textContent).toContain('关联的上游能源或运营数据不会被删除');
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
    expect(previewHeader.textContent).not.toContain('XX科技有限公司');
    expect(previewHeader.textContent).not.toContain('企业法人边界');

    await render('/carbon-accounting/inventory');
    const inventoryHeader = container.querySelector('[class*="inventoryTask"]')!;
    expect(inventoryHeader.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(inventoryHeader.textContent).not.toContain('XX科技有限公司');
    expect(inventoryHeader.textContent).not.toContain('企业法人边界');

    await render('/carbon-accounting/support');
    const supportHeader = container.querySelector('[class*="supportHead"]')!;
    expect(supportHeader.textContent).toContain('依据标准：GB/T 32150—2025');
    expect(supportHeader.textContent).not.toContain('2026年度核算任务');
    expect(supportHeader.textContent).not.toContain('数据来源：当前正式核算清单');
    expect(supportHeader.textContent).not.toContain('XX科技有限公司');
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

  it('previews an energy-only draft without replacing the current inventory until confirmed', async () => {
    await render('/carbon-accounting/inventory');
    const currentRowCount = container.querySelectorAll('section[class*="inventoryShell"] table[class*="groupTable"] tbody tr').length;
    await click(button('开始年度核算'));
    expect(container.textContent).toContain('开始年度核算');
    await click(button('确定并开始核算'));

    const preview = container.querySelector('[role="dialog"]')!;
    expect(preview.textContent).toContain('年度草稿清单生成预览');
    expect(preview.textContent).toContain('即将生成的草稿清单');
    expect(preview.textContent).toContain('温室气体源类型');
    expect(preview.textContent).toContain('5 项');
    expect(preview.textContent).toContain('原煤（企业层级）');
    expect(preview.textContent).toContain('天然气（企业层级）');
    expect(preview.textContent).not.toContain('生产车间A');
    expect(preview.textContent).toContain('化石燃料燃烧排放（2）');
    expect(preview.textContent).toContain('218,735.82');
    expect(preview.textContent).not.toContain('待匹配排放类别');
    expect(preview.textContent).toContain('待完善 1');
    expect(preview.textContent).not.toContain('废水处理');
    expect(container.querySelectorAll('section[class*="inventoryShell"] table[class*="groupTable"] tbody tr').length).toBe(currentRowCount);

    await click(button('返回修改任务设置', preview));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelectorAll('section[class*="inventoryShell"] table[class*="groupTable"] tbody tr').length).toBe(currentRowCount);

    await click(button('开始年度核算'));
    await click(button('确定并开始核算'));
    await click(button('确认生成草稿清单'));
    expect(container.textContent).toContain('草稿已自动保存');
    expect(container.textContent).toContain('天然气');
  });

  it('opens the dedicated source drawer, switches a parameter group and confirms a formal snapshot', async () => {
    await render('/carbon-accounting/inventory');
    await click(button('发起修订'));
    const row = [...container.querySelectorAll('tr')].find((item) => item.textContent?.includes('天然气燃烧（锅炉房）'))!;
    await click(button('编辑', row));
    expect(container.textContent).toContain('编辑排放源');
    expect(container.textContent).toContain('结果因子/折算值');
    expect(container.textContent).toContain('因子拆解');
    expect(container.textContent).toContain('低位发热量 NCV');
    expect(container.querySelector('input[type="number"]')).not.toBeNull();
    expect(container.textContent).not.toContain('数据追溯信息');

    await click(button('更换因子/参数'));
    const radios = container.querySelectorAll('input[type="radio"]');
    await click(radios[1] as HTMLInputElement);
    await click(button('确认选择'));
    expect(container.textContent).toContain('2.086 kgCO₂/Nm³');
    await click(button('取消'));

    await click(button('查看本次修改'));
    expect(container.textContent).toContain('本次修改详情');
    await click(button('关闭'));
    await click(button('确认并更新正式清单'));
    expect(container.textContent).toContain('更新后状态');
    await click(button('确认更新'));
    expect(container.textContent).toContain('正式清单当前有效');
    expect(container.textContent).not.toContain('V2');
    expect(container.textContent).not.toContain('查看更新记录');
    expect(button('新增排放源').disabled).toBe(true);

    await render('/carbon-accounting/preview');
    expect(container.textContent).toContain('本次核算排放汇总');
    expect(container.textContent).toContain('正式核算清单｜确认人：管理员');
    expect(container.textContent).toContain('确认人：管理员');
    expect(container.textContent).toContain('查看正式核算清单');
    expect(container.textContent).toContain('导出核算结果');
  });

  it('shows basic and emission-source support in one page and keeps the enterprise-factor write flow separate', async () => {
    await render('/carbon-accounting/support');
    expect(container.textContent).toContain('核算主体与组织边界');
    expect(container.textContent).not.toContain('报告主体信息');
    expect(container.textContent).not.toContain('核算方法说明');
    expect(container.querySelectorAll('[data-support-table="basic"] col')).toHaveLength(4);
    expect(container.querySelectorAll('[data-support-table="basic"] tbody tr')).toHaveLength(2);
    expect(container.querySelectorAll('[data-support-table="source"] col')).toHaveLength(6);
    expect(container.querySelector('[data-group-title="核算主体与边界"]')).toBeNull();
    const directSupportScopeTitle = container.querySelector('[data-support-scope-title="范围一：直接排放"]');
    expect(directSupportScopeTitle).not.toBeNull();
    expect(directSupportScopeTitle?.getAttribute('aria-expanded')).toBe('true');
    expect(directSupportScopeTitle?.closest('tr')?.nextElementSibling?.querySelector('[data-group-title="化石燃料燃烧排放"]')).not.toBeNull();
    const fossilFuelGroup = container.querySelector('[data-group-title="化石燃料燃烧排放"]') as HTMLButtonElement;
    expect(fossilFuelGroup.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    await click(fossilFuelGroup);
    expect(fossilFuelGroup.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('天然气燃烧（锅炉房）');
    await click(fossilFuelGroup);
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    await click(directSupportScopeTitle as HTMLButtonElement);
    expect(directSupportScopeTitle?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('天然气燃烧（锅炉房）');
    await click(directSupportScopeTitle as HTMLButtonElement);
    expect(container.textContent).toContain('天然气燃烧（锅炉房）');
    expect(container.querySelector('[data-support-scope-title="范围二：间接排放"]')).not.toBeNull();
    expect(container.querySelector('[data-support-scope-title="范围三：其他间接排放"]')).not.toBeNull();
    expect(container.textContent).toContain('外购电力（企业整体）');
    expect(container.textContent).not.toContain('暂无符合条件的排放源支撑材料');
    expect(container.textContent).toContain('用户仅需维护对应的支撑材料');
    expect(container.textContent).toContain('查看');
    await click(button('查看'));
    expect(container.textContent).toContain('查看核查材料');
    await click(button('关闭'));

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
