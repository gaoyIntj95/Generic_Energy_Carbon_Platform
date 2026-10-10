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
async function grade(value: string) {
  await act(async () => {
    const select = dialog().querySelector<HTMLSelectElement>('#report-uncertaintyGrade')!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function upload(name = '不确定性评价计算表.pdf', content = '%PDF-1.4 test', type = 'application/pdf') {
  await act(async () => {
    const input = dialog().querySelector<HTMLInputElement>('#report-uncertaintyFile')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([content], name, { type })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
  });
}
async function completeForm() {
  for (const field of reportSupplementFields) await fill(field.key, `${field.label}：测试内容 <说明>`);
  await grade('B');
  await upload();
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
    expect(dialog().querySelectorAll('input, textarea, select')).toHaveLength(4);
    expect(dialog().textContent).toContain('已录入项目信息（只读）');
    expect([...dialog().querySelectorAll('select option')].map(option => option.textContent)).toEqual([
      '请选择评价等级',
      'A  优（平均分值 ≥ 5.0）',
      'B  良（5.0 ＞ 平均分值 ≥ 4.0）',
      'C  中（4.0 ＞ 平均分值 ≥ 3.0）',
      'D  较低（3.0 ＞ 平均分值 ≥ 2.0）',
      'E  低（平均分值 ＜ 2.0）',
    ]);
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-cutoff')!.placeholder).toContain('HMX-180 规整填料');
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-allocation')!.placeholder).toContain('空压机用电');
    expect(dialog().textContent).toContain('类别：机械设备');
    expect(dialog().textContent).toContain('VFD-75-工艺流程图.png');
    expect(dialog().textContent).not.toContain('工艺、取舍与分配补充说明');
    expect(container.querySelector('article')!.textContent).toContain('VFD-75-工艺流程图.png');
    await fill('cutoff', '项目一企业');
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-allocation')!.value).toBe('');
    await click(button('保存补充信息', dialog()));
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-cutoff')!.value).toBe('项目一企业');
    await fill('cutoff', '未保存的修改');
    await click(button('取消', dialog()));
    await render(2);
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-cutoff')!.value).toBe('');
    await click(button('取消', dialog()));
    await render(1);
    await click(button('＋ 生成报告'));
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-cutoff')!.value).toBe('项目一企业');
  });

  it('校验必填内容，全部输入进入预览和下载，重新生成保留历史内容', async () => {
    await render(3);
    await click(button('＋ 生成报告'));
    await fill('cutoff', '   ');
    await click(button('生成报告', dialog()));
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('取舍情况');
    await completeForm();
    await click(button('生成报告', dialog()));
    expect(dialog()).toBeNull();
    for (const field of reportSupplementFields.filter((item) => !('readOnly' in item))) {
      expect(container.querySelector('article')!.textContent).toContain(`${field.label}：测试内容 <说明>`);
    }
    expect(container.querySelector('article')!.textContent).toContain('清单数据不确定性分析结果为B等级');
    expect(container.querySelector('article a')!.getAttribute('href')).toContain('data:application/pdf;base64,');
    for (const heading of ['1 产品碳足迹（PCF）介绍', '2.3.2 取舍原则', '2.3.3 多产品分配', '4.3 清单数据不确定性分析', '5 碳足迹分析']) expect(container.querySelector('article')!.textContent).toContain(heading);
    expect(container.querySelector('article')!.textContent).not.toContain('{{');
    await click(button('⇩ 下载报告'));
    const exported = vi.mocked(downloadHtmlReport).mock.calls[0][0];
    const downloadedDocument = new DOMParser().parseFromString(exported.content, 'text/html');
    expect(downloadedDocument.querySelector('article')!.textContent).toBe(container.querySelector('article')!.textContent);
    expect(exported.content).toContain('&lt;说明&gt;');
    expect(exported.content).toContain('data:application/pdf;base64,');
    const tables = [...downloadedDocument.querySelectorAll('table')];
    expect(tables[0].textContent).toContain('数据来源');
    for (const table of tables) {
      const width = table.querySelectorAll('thead th').length;
      for (const row of table.querySelectorAll('tbody tr')) expect(row.children).toHaveLength(width);
    }
    expect(exported.filename).toContain('V1');

    await click(button('重新生成'));
    expect(dialog().querySelector<HTMLTextAreaElement>('#report-allocation')!.value).toContain('测试内容');
    await fill('allocation', '第二版：运输距离采用估算，可能影响运输阶段结果。');
    await grade('C');
    await upload('第二版计算表.pdf');
    await click(button('生成报告', dialog()));
    expect(container.querySelector('article')!.textContent).toContain('第二版：运输距离采用估算');
    const firstVersion = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('V1 ·'))!;
    await click(firstVersion);
    expect(container.querySelector('article')!.textContent).not.toContain('第二版：运输距离采用估算');
    expect(container.querySelector('article')!.textContent).toContain('清单数据不确定性分析结果为B等级');
    expect(container.querySelector('article a')!.getAttribute('download')).toBe('不确定性评价计算表.pdf');
    await click(button('⇩ 下载报告'));
    expect(vi.mocked(downloadHtmlReport).mock.calls[1][0].filename).toContain('V1');
    expect(vi.mocked(downloadHtmlReport).mock.calls[1][0].content).toBe(exported.content);
  });

  it('校验 PDF 扩展名和文件内容，支持更换和移除附件', async () => {
    await render(3);
    await click(button('＋ 生成报告'));
    await fill('cutoff', '不涉及取舍。');
    await fill('allocation', '采用质量分配法。');
    await click(button('生成报告', dialog()));
    expect(dialog().textContent).toContain('请先填写“评价等级”');
    await grade('E');
    await click(button('生成报告', dialog()));
    expect(dialog().textContent).toContain('请先填写“不确定性评价计算表”');
    await upload('错误.txt', 'text', 'text/plain');
    expect(dialog().textContent).toContain('仅支持上传 PDF');
    await upload('伪装.pdf', 'not a PDF');
    expect(dialog().textContent).toContain('文件内容不是有效的 PDF');
    await upload();
    await click(button('移除', dialog()));
    await click(button('生成报告', dialog()));
    expect(dialog()).not.toBeNull();
    await upload('新计算表.pdf');
    await click(button('保存补充信息', dialog()));
    await click(button('＋ 生成报告'));
    expect(dialog().textContent).toContain('新计算表.pdf');
    await click(button('生成报告', dialog()));
    expect(dialog()).toBeNull();
    expect(container.querySelector('article')!.textContent).toContain('清单数据不确定性分析结果为E等级');
    expect(container.querySelector('article a')!.getAttribute('download')).toBe('新计算表.pdf');
  });
});
