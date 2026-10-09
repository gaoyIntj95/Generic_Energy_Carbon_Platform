import JSZip from 'jszip';
import type { CarbonReportBasicInfo, CarbonReportRecord } from '../../mocks/carbonReportMock';
import type { CarbonSnapshot, EmissionSource } from '../../types/platformDomain';
import { getCarbonFactorV4 } from '../../mocks/carbonAccountingV4Mock';
import templateBlocks from './reportTemplate.json';

type TemplateBlock =
  | { kind: 'paragraph'; text: string; style: string }
  | { kind: 'table'; index: number; rows: string[][] };

export const reportSupplementFields: { key: keyof CarbonReportBasicInfo; label: string; section: 'enterprise' | 'report' | 'verification' | 'contact'; multiline?: boolean }[] = [
  { key: 'organizationName', label: '企业名称', section: 'enterprise' },
  { key: 'industryCategory', label: '所属行业及行业代码', section: 'enterprise' },
  { key: 'generalManager', label: '总经理姓名', section: 'enterprise' },
  { key: 'registeredAddress', label: '企业地址', section: 'enterprise' },
  { key: 'businessScope', label: '企业经营范围', section: 'enterprise', multiline: true },
  { key: 'preparer', label: '报告编制人', section: 'report' },
  { key: 'reportDepartment', label: '报告编制部门', section: 'report' },
  { key: 'boundaryDescription', label: '报告边界', section: 'report', multiline: true },
  { key: 'internalVerificationDate', label: '内部查证日期', section: 'verification' },
  { key: 'internalVerificationLead', label: '内部查证牵头部门', section: 'verification' },
  { key: 'internalVerificationParticipants', label: '内部查证参与部门', section: 'verification' },
  { key: 'contactName', label: '联系人', section: 'contact' },
  { key: 'contactDepartment', label: '联系部门', section: 'contact' },
  { key: 'contactPhone', label: '联系电话', section: 'contact' },
  { key: 'contactAddress', label: '联系地址', section: 'contact' },
];

export function emptyReportInfo(organizationName = ''): CarbonReportBasicInfo {
  return Object.fromEntries(reportSupplementFields.map(({ key }) => [key, key === 'organizationName' ? organizationName : ''])) as unknown as CarbonReportBasicInfo;
}

const number = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const placeholder = /\{\{([^{}]+)\}\}/g;

function scopeOf(row: EmissionSource) {
  if (['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放'].includes(row.emissionCategory)) return '范围一';
  if (row.emissionCategory.includes('购入的电力与热力')) return '范围二';
  if (row.emissionCategory.includes('生物质') || row.emissionCategory.includes('清除')) return '特殊排放';
  return '范围三';
}

function templateCategory(row: EmissionSource) {
  if (row.sourceType === '购入电力') return '外购电力';
  if (row.sourceType === '购入热力') return '外购热力';
  if (row.emissionCategory.includes('交通运输')) return '交通运输排放';
  if (row.emissionCategory.includes('所使用的产品和服务')) return '所使用的产品和服务排放';
  if (row.emissionCategory.includes('所生产的产品和服务')) return '所生产的产品和服务排放';
  if (row.emissionCategory.includes('其他') && scopeOf(row) === '范围三') return '其他排放';
  return row.emissionCategory;
}

const factorNumber = (value: string | number) => String(value).match(/\d+(?:,\d{3})*(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/)?.[0];
const savedFactorNumber = (value: string, unit: string) => {
  const unitIndex = unit && unit !== '—' ? value.lastIndexOf(unit) : -1;
  const candidates = [...value.slice(0, unitIndex >= 0 ? unitIndex : undefined).matchAll(/\d+(?:,\d{3})*(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/g)];
  return candidates.at(-1)?.[0];
};

function currentFactorText(row: EmissionSource) {
  const factor = getCarbonFactorV4(row.emissionFactorId);
  if (!factor) return '—';
  if (factor.unit !== '参数组') {
    const value = factorNumber(factor.value);
    return value ? `${value}${factor.unit && factor.unit !== '—' ? ` ${factor.unit}` : ''}` : '—';
  }
  return factor.parameters?.length
    ? factor.parameters.map(({ display, unit }) => `${display}${unit && unit !== '—' ? ` ${unit}` : ''}`).join('；')
    : '—';
}

function factorText(row: EmissionSource, report: CarbonReportRecord) {
  const saved = report.factorTexts?.[row.emissionSourceId];
  const factor = getCarbonFactorV4(row.emissionFactorId);
  if (!saved || !factor) return currentFactorText(row);
  if (factor.unit === '参数组') return saved.includes('参数组') ? currentFactorText(row) : saved;
  const value = savedFactorNumber(saved, factor.unit);
  return value ? `${value}${factor.unit && factor.unit !== '—' ? ` ${factor.unit}` : ''}` : currentFactorText(row);
}

export function captureReportFactorTexts(snapshot: CarbonSnapshot) {
  return Object.fromEntries(snapshot.sourceItems.map((row) => [row.emissionSourceId, currentFactorText(row)]));
}

function activityText(row: EmissionSource) {
  const value = row.activityValue.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
  return `${value}${row.activityUnit && row.activityUnit !== '—' ? ` ${row.activityUnit}` : ''}`;
}

function sourceCells(row: EmissionSource, category = templateCategory(row)) {
  return [category, row.sourceType || '—', row.sourceName || '—', activityText(row), number(row.emissionAmount)];
}

function categoryRows(rows: EmissionSource[], category: string) {
  const matches = rows.filter((row) => templateCategory(row) === category);
  return matches.length
    ? matches.map((row) => sourceCells(row, category))
    : [[category, '—', '未纳入核算清单', '—', '—']];
}

export function buildCarbonReportContent(report: CarbonReportRecord, snapshot: CarbonSnapshot, info: CarbonReportBasicInfo) {
  const rows = snapshot.sourceItems;
  const included = rows.filter((row) => scopeOf(row) !== '特殊排放');
  const sum = (selected: EmissionSource[]) => selected.reduce((total, row) => total + row.emissionAmount, 0);
  const scopeTotal = (scope: string) => scope === '范围一' ? snapshot.directEmission
    : scope === '范围二' ? snapshot.purchasedEnergyEmission : snapshot.otherIndirectEmission;
  const special = (keyword: string) => {
    const selected = rows.filter((row) => row.emissionCategory.includes(keyword));
    return selected.length ? `${number(sum(selected))} tCO₂e` : '未纳入本次核算';
  };
  const date = report.generatedAt.slice(0, 10).split('-');
  const values: Record<string, string> = {
    '输入:企业名称': info.organizationName,
    '输入：企业名称': info.organizationName,
    '企业名称': info.organizationName,
    '输入:报告年度': String(report.year),
    '系统:报告年度': String(report.year),
    '输入：编制人': info.preparer,
    '输入:总经理姓名': info.generalManager,
    'current_year': date[0] || '',
    'current_month': date[1] || '',
    'current_day': date[2] || '',
    '输入：起始日期': `${report.year}-01-01`,
    '输入：截止日期': `${report.year}-12-31`,
    '输入：企业地址': info.registeredAddress,
    '输入:企业地址': info.registeredAddress,
    '输入:报告边界': info.boundaryDescription,
    '输入:所属行业及行业代码': info.industryCategory,
    '输入:企业经营范围': info.businessScope,
    '内部查证日期': info.internalVerificationDate,
    '内部查证牵头部门': info.internalVerificationLead,
    '内部查证参与部门': info.internalVerificationParticipants,
    '联系人': info.contactName,
    '联系部门': info.contactDepartment,
    '联系电话': info.contactPhone,
    '联系地址': info.contactAddress,
    '报告编制部门': info.reportDepartment,
    '系统:汇总排放量': `${number(snapshot.totalEmission)} tCO₂e`,
    '系统：汇总排放量': number(snapshot.totalEmission),
    '系统:范围一汇总排放量': number(scopeTotal('范围一')),
    '系统:范围二汇总排放量': number(scopeTotal('范围二')),
    '系统:范围三汇总排放量': number(scopeTotal('范围三')),
  };
  const replace = (text: string) => {
    let specialIndex = 0;
    return text.replace(placeholder, (_match, key: string) => {
      if (key === '系统:排放量') return special(specialIndex++ === 0 ? '生物质' : '清除');
      return values[key]?.trim() || '—';
    });
  };
  const group = (categories: string[]) => categories.flatMap((category) => categoryRows(included, category));
  const summary = [...new Set(included.map((row) => `${scopeOf(row)}\u0000${templateCategory(row)}`))]
    .map((entry) => {
      const [scope, category] = entry.split('\u0000');
      return [scope, category, number(sum(included.filter((row) => scopeOf(row) === scope && templateCategory(row) === category)))];
    });
  const tables: Record<number, string[][]> = {
    1: [
      ['温室气体源类别', '排放源', '活动数据', '核算因子', '排放量'],
      ...included.map((row) => [templateCategory(row), row.sourceName, activityText(row), factorText(row, report), number(row.emissionAmount)]),
      ['合计', '—', '—', '—', number(snapshot.totalEmission)],
    ],
    2: [
      ['排放范围', '排放类别', '排放量'],
      ...summary,
      ['合计', '—', number(snapshot.totalEmission)],
    ],
    3: [
      ['排放类别', '温室气体源类型', '排放源名称', '活动数据及单位', '排放量 / （tCO₂e）'],
      ...group(['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放']),
      ['合计', '—', '—', '—', number(scopeTotal('范围一'))],
    ],
    4: [
      ['排放类别', '温室气体源类型', '排放源名称', '活动数据及单位', '排放量 / （tCO₂e）'],
      ...group(['外购电力', '外购热力']),
      ['合计', '—', '—', '—', number(scopeTotal('范围二'))],
    ],
    5: [
      ['排放类别', '温室气体源类型', '排放源名称', '活动数据及单位', '排放量 / （tCO₂e）'],
      ...group(['交通运输排放', '所使用的产品和服务排放', '所生产的产品和服务排放', '其他排放']),
      ['合计', '—', '—', '—', number(scopeTotal('范围三'))],
    ],
    6: [
      ['排放类别', '温室气体源类型', '排放源名称', '活动数据及单位', '排放量 / （tCO₂e）'],
      ...['生物质燃烧排放', '温室气体清除'].flatMap((category) => {
        const matches = rows.filter((row) => row.emissionCategory.includes(category.slice(0, 3)));
        return matches.length ? matches.map((row) => sourceCells(row, category)) : [[category, '—', '未纳入核算清单', '—', '—']];
      }),
    ],
  };
  const blocks = (templateBlocks as TemplateBlock[]).map((block) => block.kind === 'paragraph'
    ? { ...block, text: replace(block.text) }
    : { ...block, rows: (tables[block.index] ?? block.rows).map((row) => row.map(replace)) });
  return { blocks, tables, replace };
}

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const elements = (parent: Element, name: string) => Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1 && (node as Element).localName === name);

function setWordText(element: Element, content: string) {
  const nodes = Array.from(element.getElementsByTagNameNS(wordNamespace, 't'));
  if (!nodes.length) return;
  nodes[0].textContent = content;
  nodes[0].setAttribute('xml:space', 'preserve');
  nodes.slice(1).forEach((node) => { node.textContent = ''; });
}

export async function createCarbonReportDocx(report: CarbonReportRecord, snapshot: CarbonSnapshot, info: CarbonReportBasicInfo) {
  const response = await fetch(new URL('./industrial-ghg-report.docx', import.meta.url));
  if (!response.ok) throw new Error('无法读取工业企业温室气体报告模板');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('报告模板缺少正文');
  const xml = new DOMParser().parseFromString(await part.async('string'), 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('报告模板正文无法解析');
  const content = buildCarbonReportContent(report, snapshot, info);
  const body = xml.getElementsByTagNameNS(wordNamespace, 'body')[0];
  const tables = elements(body, 'tbl');
  tables.forEach((table, index) => {
    const desired = content.tables[index];
    if (!desired) {
      elements(table, 'tr').forEach((row) => elements(row, 'tc').forEach((cell) => {
        const cellText = Array.from(cell.getElementsByTagNameNS(wordNamespace, 't')).map((node) => node.textContent ?? '').join('');
        if (cellText.includes('{{')) setWordText(cell, content.replace(cellText));
      }));
      return;
    }
    const original = elements(table, 'tr');
    const last = original.length - 1;
    const hasTotal = index !== 6;
    const clones = desired.map((cells, rowIndex) => {
      const templateIndex = rowIndex === 0 ? 0 : hasTotal && rowIndex === desired.length - 1 ? last : Math.min(rowIndex, last - (hasTotal ? 1 : 0));
      const row = original[templateIndex].cloneNode(true) as Element;
      elements(row, 'tc').forEach((cell, cellIndex) => setWordText(cell, cells[cellIndex] ?? ''));
      return row;
    });
    original.forEach((row) => table.removeChild(row));
    clones.forEach((row) => table.appendChild(row));
  });
  Array.from(xml.getElementsByTagNameNS(wordNamespace, 'p')).forEach((paragraph) => {
    const nodes = Array.from(paragraph.getElementsByTagNameNS(wordNamespace, 't'));
    const original = nodes.map((node) => node.textContent ?? '').join('');
    if (original.includes('{{')) setWordText(paragraph, content.replace(original));
  });
  const result = new XMLSerializer().serializeToString(xml);
  if (result.includes('{{')) throw new Error('报告模板仍有未填充标注');
  zip.file('word/document.xml', result);
  const settingsPart = zip.file('word/settings.xml');
  if (settingsPart) {
    const settings = new DOMParser().parseFromString(await settingsPart.async('string'), 'application/xml');
    const root = settings.documentElement;
    let updateFields = root.getElementsByTagNameNS(wordNamespace, 'updateFields')[0];
    if (!updateFields) {
      updateFields = settings.createElementNS(wordNamespace, 'w:updateFields');
      root.appendChild(updateFields);
    }
    updateFields.setAttributeNS(wordNamespace, 'w:val', 'true');
    zip.file('word/settings.xml', new XMLSerializer().serializeToString(settings));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
