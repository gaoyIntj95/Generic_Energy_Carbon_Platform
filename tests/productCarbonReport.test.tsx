import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCarbonFootprint } from '../src/pages/newPrototype/ProductCarbonFootprint';
import { reportSupplementFields } from '../src/modules/product-footprint/reportSupplement';
import { downloadHtmlReport } from '../src/utils/reportDownload';

vi.mock('../src/utils/reportDownload', () => ({ downloadHtmlReport: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
const dialog = () => container.querySelector<HTMLFormElement>('form[role="dialog"]')!;
const button = (label: string, scope: ParentNode = container) => {
  const found = [...scope.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`未找到按钮：${label}`);
  return found;
};
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
async function render(project: number) {
  await act(async () => root.render(<MemoryRouter><ProductCarbonFootprint pathname={`/product-footprint/projects/${project}/report`} /></MemoryRouter>));
}
async function fill(key: string, value: string) {
  const input = dialog().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#report-${key}`)!;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function completeForm() {
  for (const field of reportSupplementFields) if (!('readOnly' in field)) await fill(field.key, `${field.label}：测试内容 <说明>`);
}

describe('碳足迹报告补充信息', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('未确认清单也能保存草稿，取消不保存，项目之间互不影响', async () => {
    await render(1);
    expect(button('⇩ 下载报告').disabled).toBe(true);
    await click(button('＋ 生成报告'));
    expect(button('生成报告', dialog()).disabled).toBe(true);
    expect(dialog().querySelector('nav')).toBeNull();
    expect(dialog().querySelectorAll('input, textarea')).toHaveLength(6);
    expect(dialog().textContent).toContain('已录入项目信息（只读）');
    expect(dialog().textContent).toContain('GWP 默认采用 AR6、100 年口径');
    expect(dialog().querySelector<HTMLInputElement>('#report-gwpVersion')).toMatchObject({ value: 'AR6', readOnly: true });
    expect(dialog().querySelector<HTMLInputElement>('#report-gwpHorizon')).toMatchObject({ value: '100 年（GWP100）', readOnly: true });
    expect(dialog().textContent).toContain('类别：机械设备');
    expect(dialog().textContent).toContain('VFD-75-工艺流程图.png');
    expect(dialog().textContent).not.toContain('工艺、取舍与分配补充说明');
    expect(container.querySelector('article')!.textContent).toContain('项目工艺图文件名');
    await fill('companyName', '项目一企业');
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-dataLimitations')!.value).toBe('');
    await click(button('保存补充信息', dialog()));
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLInputElement>('#report-companyName')!.value).toBe('项目一企业');
    await fill('companyName', '未保存的修改');
    await click(button('取消', dialog()));
    await render(2);
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLInputElement>('#report-companyName')!.value).toBe('');
    expect(dialog().querySelector<HTMLInputElement>('#report-gwpVersion')!.value).toBe('AR6');
    await click(button('取消', dialog()));
    await render(1);
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLInputElement>('#report-companyName')!.value).toBe('项目一企业');
  });

  it('校验必填内容，全部输入进入预览和下载，重新生成保留历史内容', async () => {
    await render(3);
    await click(button('＋ 生成报告'));
    await fill('companyName', '   ');
    await click(button('生成报告', dialog()));
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('企业名称');
    await completeForm();
    await click(button('生成报告', dialog()));
    expect(dialog()).toBeNull();
    for (const field of reportSupplementFields.filter((item) => !('readOnly' in item))) {
      expect(container.querySelector('article')!.textContent).toContain(`${field.label}：测试内容 <说明>`);
    }
    expect(container.querySelector('article')!.textContent).toContain('AR6');
    expect(container.querySelector('article')!.textContent).toContain('100 年（GWP100）');
    expect(container.textContent).not.toMatch(/不确定性等级|加权分|平均分|数据质量评分|初级数据覆盖率/);
    await click(button('⇩ 下载报告'));
    const exported = vi.mocked(downloadHtmlReport).mock.calls[0][0];
    const downloadedDocument = new DOMParser().parseFromString(exported.content, 'text/html');
    expect(downloadedDocument.querySelector('article')!.textContent).toBe(container.querySelector('article')!.textContent);
    expect(exported.content).toContain('&lt;说明&gt;');
    expect(exported.filename).toContain('V1');

    await click(button('重新生成'));
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-dataLimitations')!.value).toContain('测试内容');
    await fill('dataLimitations', '第二版：运输距离采用估算，可能影响运输阶段结果。');
    await click(button('生成报告', dialog()));
    expect(container.querySelector('article')!.textContent).toContain('第二版：运输距离采用估算');
    const firstVersion = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('V1 ·'))!;
    await click(firstVersion);
    expect(container.querySelector('article')!.textContent).not.toContain('第二版：运输距离采用估算');
    await click(button('⇩ 下载报告'));
    expect(vi.mocked(downloadHtmlReport).mock.calls[1][0].filename).toContain('V1');
    expect(vi.mocked(downloadHtmlReport).mock.calls[1][0].content).toBe(exported.content);
  });

  it('选填说明无需填写，GWP 默认值进入报告且不生成取舍与分配结论', async () => {
    await render(3);
    await click(button('＋ 生成报告'));
    await fill('companyName', '测试企业');
    await fill('standard', '实际采用的标准');
    await fill('dataLimitations', '部分数据采用估算，可能影响结果。');
    await click(button('生成报告', dialog()));
    expect(dialog()).toBeNull();
    expect(container.querySelector('article')!.textContent).toContain('部分数据采用估算');
    expect(container.querySelector('article')!.textContent).toContain('电子电器');
    expect(container.querySelector('article')!.textContent).toContain('GWP 来源版本AR6');
    expect(container.querySelector('article')!.textContent).toContain('GWP 时间尺度100 年（GWP100）');
    expect(container.querySelector('article')!.textContent).not.toMatch(/本次核算不涉及多产品分配|本次核算不涉及取舍/);
  });
});
