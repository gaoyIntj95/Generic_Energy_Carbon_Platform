/* eslint-disable no-irregular-whitespace */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  carbonFactorsV4,
  getCarbonFactorV4,
  saveCarbonFactorV4,
  supportBasicV4,
  type CarbonFactor,
  type CarbonFactorParameter,
} from '../../mocks/carbonAccountingV4Mock';
import {
  deleteEmissionSource,
  listCarbonSnapshots,
  listEmissionSources,
  latestCarbonSnapshot,
  publishCarbonSnapshot,
  replaceEmissionSourcesForTask,
  saveEmissionSource,
} from '../../mocks/platformMockStore';
import {
  createCarbonReportMock,
  listCarbonReportMocks,
  type CarbonReportRecord,
} from '../../mocks/carbonReportMock';
import type { EmissionSource } from '../../types/platformDomain';
import { listV11EnergyRecords, listV11EnergyTypes, v11EnergyRecordAnnualAmount, v11RecordScopeType } from '../../mocks/dataManagementV11Store';
import styles from './CarbonAccountingV4.module.css';

type TaskState = 'draft' | 'confirmed' | 'pending';
type SourceMode = 'view' | 'edit';
type SupportItem = {
  id?: string;
  group: string;
  type?: string;
  item: string;
  activity: string;
  activityDataSources: string;
  materials: number;
  state: '待确认' | '待补充' | '已完成';
  emission?: EmissionSource;
  evidenceFiles?: { evidenceFileId: string; fileName: string; activityDataSource: string }[];
  supportRemark?: string;
};
type DialogState =
  | { kind: 'settings' | 'task' | 'newSource' | 'enterpriseFactor' | 'importFactor' }
  | { kind: 'draftPreview'; year: number; sources: EmissionSource[] }
  | { kind: 'deleteSource'; row: EmissionSource }
  | { kind: 'factorSelect'; row: EmissionSource }
  | { kind: 'confirmSnapshot' | 'completeUpdate' | 'cancelUpdate' }
  | null;
type DrawerState =
  | { kind: 'source'; row: EmissionSource; mode: SourceMode; factorId?: string }
  | { kind: 'support'; item: SupportItem; manage: boolean }
  | { kind: 'factor'; factor: CarbonFactor }
  | { kind: 'history' }
  | { kind: 'changes'; baseline: EmissionSource[]; draft: EmissionSource[]; version: number }
  | null;

const format = (value: number, digits = 2) =>
  value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const createTarBlob = (files: Array<{ name: string; content: string }>) => {
  const encoder = new TextEncoder();
  const blocks: Uint8Array[] = [];
  const writeText = (target: Uint8Array, offset: number, length: number, value: string) => {
    target.set(encoder.encode(value).slice(0, length), offset);
  };
  const writeOctal = (target: Uint8Array, offset: number, length: number, value: number) => {
    writeText(target, offset, length, value.toString(8).padStart(length - 1, '0') + '\0');
  };
  files.forEach((file) => {
    const content = encoder.encode(file.content);
    const header = new Uint8Array(512);
    writeText(header, 0, 100, file.name);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, content.length);
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(32, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeText(header, 257, 6, 'ustar\0');
    writeText(header, 263, 2, '00');
    writeOctal(header, 148, 8, header.reduce((sum, byte) => sum + byte, 0));
    blocks.push(header, content);
    const remainder = content.length % 512;
    if (remainder) blocks.push(new Uint8Array(512 - remainder));
  });
  blocks.push(new Uint8Array(1024));
  return new Blob(blocks as BlobPart[], { type: 'application/x-tar' });
};

const numberFromActivity = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;
const unitFromActivity = (value: string) =>
  value.match(/(人·天(?:\/年)?|Nm³|MWh|GJ|kg|t·km|t)$/)?.[1] ?? 't';

const resultCategory = (emissionCategory: string) => {
  if (emissionCategory === '购入电力与热力产生的排放' || emissionCategory === '购入的电力与热力产生的排放') return 'purchased';
  if (['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放'].includes(emissionCategory)) return 'direct';
  return 'other';
};

const emissionCategoryDictionary = ['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放', '购入的电力与热力产生的排放', '交通运输产生的排放', '所使用的产品和服务隐含的排放', '所生产的产品和服务的排放', '其他排放', '特殊排放'];

const emissionSourceMapping: Record<string, Array<{ sourceType: string; sources: string[] }>> = {
  化石燃料燃烧排放: [
    { sourceType: '固定燃烧源', sources: ['电站锅炉', '燃气轮机', '工业锅炉', '熔炼炉'] },
    { sourceType: '移动燃烧源', sources: ['汽车', '火车', '船舶', '飞机'] },
  ],
  生产过程排放: [{ sourceType: '生产活动中的过程排放', sources: ['氧化铝回转炉', '合成氨造气炉', '水泥回转窑', '水泥立窑', '工艺放空'] }],
  废弃物处理处置排放: [{ sourceType: '废弃物处理处置过程排放', sources: ['污水处理系统', '石化、化工火炬系统'] }],
  逸散排放: [{ sourceType: '边界内逸散排放', sources: ['矿坑', '天然气处理设施', '变压器'] }],
  购入的电力与热力产生的排放: [{ sourceType: '购入的电力与热力排放', sources: ['电加热炉窑', '电动机系统', '泵系统', '风机系统', '变压器、调压器', '压缩机', '制热设备', '制冷设备', '交流电焊机', '照明设备'] }],
  交通运输产生的排放: [{ sourceType: '运输活动排放', sources: ['飞机', '火车', '汽车', '船舶'] }],
  所使用的产品和服务隐含的排放: [{ sourceType: '采购的产品和服务隐含排放', sources: ['原材料', '制造设备生产商'] }],
  所生产的产品和服务的排放: [{ sourceType: '产品或服务使用阶段排放', sources: ['产品或服务'] }],
  其他排放: [{ sourceType: '其他边界外排放', sources: ['通勤', '差旅', '投资'] }],
  特殊排放: [
    { sourceType: '生物质燃料燃烧排放', sources: ['生物质燃料汽车', '生物质燃料飞机', '生物质锅炉'] },
    { sourceType: '温室气体清除（碳清除）', sources: ['钢铁、水泥等产品', '碳捕集、碳封存（人工）', '林业碳汇等（自然）'] },
  ],
};

type ValidationIssue = { emissionSourceId: string; message: string };

const validateInventory = (inventory: EmissionSource[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  inventory.forEach((row) => {
    const unit = row.activityData.match(/(人·天(?:\/年)?|Nm³|MWh|GJ|kg|t·km|t)$/)?.[1];
    const factor = getCarbonFactorV4(row.emissionFactorId);
    const key = `${row.emissionGroup}|${row.sourceType}|${row.sourceName}`;
    if (!row.activityData || !Number.isFinite(numberFromActivity(row.activityData))) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据缺失或无法识别' });
    if (!unit) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据单位不完整' });
    if (!factor) issues.push({ emissionSourceId: row.emissionSourceId, message: '未匹配排放因子或计算参数' });
    if (factor && unit && factor.calculationType !== 'processParameter' && !factor.unit.includes(`/${unit}`) && !(unit === 't' && factor.unit.includes('/t'))) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据单位与因子单位不匹配' });
    if (!Number.isFinite(row.emissionAmount)) issues.push({ emissionSourceId: row.emissionSourceId, message: '排放量无法计算' });
    if (factor?.parameters?.some((parameter) => !Number.isFinite(Number(parameter.value)))) issues.push({ emissionSourceId: row.emissionSourceId, message: '参数化计算参数不完整' });
    if (seen.has(key)) duplicateKeys.add(key); else seen.add(key);
  });
  if (duplicateKeys.size) inventory.filter((row) => duplicateKeys.has(`${row.emissionGroup}|${row.sourceType}|${row.sourceName}`)).forEach((row) => issues.push({ emissionSourceId: row.emissionSourceId, message: '存在重复排放源记录' }));
  return issues;
};

const changed = (previous: EmissionSource, next: EmissionSource) =>
  previous.sourceType !== next.sourceType
  || previous.sourceName !== next.sourceName
  || previous.activityData !== next.activityData
  || previous.emissionFactorId !== next.emissionFactorId
  || previous.emissionAmount !== next.emissionAmount;

const calculationParameters = (factorId: string): CarbonFactorParameter[] =>
  getCarbonFactorV4(factorId)?.parameters?.map((item) => ({ ...item })) ?? [];

const factorSummary = (row: EmissionSource, factorId = row.emissionFactorId) => {
  const factor = getCarbonFactorV4(factorId);
  if (!factor) return '—';
  if (factor.calculationType === 'processParameter') {
    const activity = Number(row.activityValue);
    const effectiveValue = activity > 0 ? row.emissionAmount / activity : 0;
    return `${Number(effectiveValue.toFixed(6))} ${factor.gas}/${row.activityUnit}`;
  }
  return `${factor.value.replace(/^折算因子\s*/, '')} ${factor.unit}`;
};

const recalculate = (activity: number, unit: string, factor: CarbonFactor) => {
  if (factor.calculationType === 'fuelParameter') {
    const parameters = new Map((factor.parameters ?? []).map((parameter) => [parameter.key, parameter.value]));
    const ncv = parameters.get('ncv') ?? 0;
    const cc = parameters.get('cc') ?? 0;
    const oxidationRate = (parameters.get('of') ?? 0) / 100;
    const molecularWeight = parameters.get('mw') ?? 44 / 12;
    const composite = ncv * cc * oxidationRate * molecularWeight;
    return factor.unit.startsWith('kg') ? activity * composite / 1000 : activity * composite;
  }
  if (factor.calculationType === 'processParameter') {
    const parameters = new Map((factor.parameters ?? []).map((parameter) => [parameter.key, parameter.value]));
    const content = (parameters.get('content') ?? 0) / 100;
    const conversion = parameters.get('conversion') ?? 0;
    const rate = (parameters.get('rate') ?? 0) / 100;
    const deduction = parameters.get('deduction') ?? 0;
    return activity * content * conversion * rate - deduction;
  }
  const factorValue = Number(factor.value);
  if (!Number.isFinite(factorValue)) return 0;
  return factor.unit.startsWith('kg') ? activity * factorValue / 1000 : activity * factorValue;
};

const energyFactorMap: Record<string, { factorId: string; category: string; group: string; sourceType: string; gas: string }> = {
  'energy-electricity': {
    factorId: 'pf-power', category: '购入的电力与热力产生的排放', group: '购入电力与热力产生的排放', sourceType: '购入电力', gas: 'CO₂e',
  },
  'energy-steam': {
    factorId: 'pf-heat', category: '购入的电力与热力产生的排放', group: '购入电力与热力产生的排放', sourceType: '购入热力', gas: 'CO₂',
  },
  'energy-natural-gas': {
    factorId: 'pf-ng', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂',
  },
  'energy-coal': {
    factorId: 'pf-coal', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂',
  },
  'energy-rdf': {
    factorId: 'pf-rdf', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂e',
  },
};

function buildEnergyDraftSources(year: number): EmissionSource[] {
  const types = new Map(listV11EnergyTypes().map((item) => [item.energyTypeId, item]));
  const energyTypeIds: Record<string, string> = {
    'v11-energy-electricity': 'energy-electricity',
    'v11-energy-steam': 'energy-steam',
    'v11-energy-natural-gas': 'energy-natural-gas',
    'v11-energy-coal': 'energy-coal',
    'v11-energy-rdf': 'energy-rdf',
  };
  return listV11EnergyRecords()
    .filter((record) => record.year === year && record.energyRole === '能源消费' && v11RecordScopeType(record) === 'enterprise')
    .map((record, index) => {
      const energyType = types.get(record.energyTypeId);
      const rule = energyFactorMap[energyTypeIds[record.energyTypeId] ?? ''];
      const factor = rule ? getCarbonFactorV4(rule.factorId) : undefined;
      const factorValue = factor ? Number(factor.value.match(/[\d.]+/)?.[0] ?? 0) : 0;
      const annualPhysicalAmount = v11EnergyRecordAnnualAmount(record);
      const activityValue = rule?.factorId === 'pf-power' ? annualPhysicalAmount / 1000 : annualPhysicalAmount;
      const emissionAmount = factor && factor.calculationType !== 'fuelParameter'
        ? Number((activityValue * factorValue).toFixed(2))
        : factor
          ? Number((activityValue * factorValue / (factor.unit.startsWith('kg') ? 1000 : 1)).toFixed(2))
          : 0;
      const group = rule?.group ?? '待完善排放源';
      const category = rule?.category ?? '待完善排放源';
      return {
        emissionSourceId: `draft-energy-${year}-${index + 1}`,
        carbonTaskId: `ct-${year}`,
        organizationBoundary: '企业法人边界',
        emissionCategory: category,
        emissionGroup: group,
        sourceType: rule?.sourceType ?? '能源消费待匹配排放源',
        sourceName: `${energyType?.energyTypeName ?? record.energyTypeId}（企业层级）`,
        greenhouseGasSpecies: [rule?.gas ?? '待匹配'],
        activityValue,
        activityUnit: rule?.factorId === 'pf-power' ? 'MWh' : energyType?.measurementUnit ?? '—',
        activityData: `${activityValue.toLocaleString('zh-CN')} ${rule?.factorId === 'pf-power' ? 'MWh' : energyType?.measurementUnit ?? '—'}`,
        activityDataSource: '数据管理·能源消费',
        factorName: factor?.name ?? '待补充排放因子/参数',
        emissionFactorId: rule?.factorId ?? '',
        recordGenerationType: 'system',
        sourceModule: '数据管理—能源数据',
        sourceRecordId: record.energyRecordId,
        factorObjectId: rule?.factorId ?? '',
        factorVersionId: factor?.version ?? '',
        createdBy: '系统',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        recommendedActivityDataSources: ['企业能源平衡表'],
        confirmedActivityDataSources: [],
        customActivityDataSources: [],
        evidenceFiles: [],
        evidenceStatus: '待补充',
        relatedEnergyRecordId: record.energyRecordId,
        emissionAmount,
        entryMode: 'system',
      };
    });
}

function Button({
  children,
  primary,
  outline,
  danger,
  compact,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  outline?: boolean;
  danger?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.button} ${primary ? styles.primary : ''} ${outline ? styles.outline : ''} ${danger ? styles.danger : ''} ${compact ? styles.compact : ''}`}
    >
      {children}
    </button>
  );
}

function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'blue' | 'orange' | 'gray' | 'red' }) {
  return <span className={`${styles.tag} ${styles[`tag${tone}`]}`}>{children}</span>;
}

function Dialog({
  title,
  children,
  footer,
  wide,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`${styles.modal} ${wide ? styles.modalWide : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
        <div className={styles.modalBody}>{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}

function Drawer({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
        <div className={styles.drawerBody}>{children}</div>
        <footer>{footer}</footer>
      </aside>
    </div>
  );
}

function TaskMeta({ state, version }: { state: TaskState; version: number }) {
  return (
    <div className={styles.meta}>
      <span>核算组织：XX科技有限公司</span><i />
      <span>通用工业企业</span><i />
      <span>GB/T 32150—2025</span><i />
      <span>企业法人边界</span><i />
      <span>{state === 'draft' ? '尚未生成正式清单' : '当前正式清单'}</span>
    </div>
  );
}

function Preview({
  inventory,
  state,
  version,
  confirmedAt,
}: {
  inventory: EmissionSource[];
  state: TaskState;
  version: number;
  confirmedAt?: string;
}) {
  const total = inventory.reduce((sum, row) => sum + row.emissionAmount, 0);
  const direct = inventory.filter((row) => resultCategory(row.emissionCategory) === 'direct').reduce((sum, row) => sum + row.emissionAmount, 0);
  const purchased = inventory.filter((row) => resultCategory(row.emissionCategory) === 'purchased').reduce((sum, row) => sum + row.emissionAmount, 0);
  const other = total - direct - purchased;
  const cards = [
    { icon: '♧', label: '温室气体排放总量', value: total, sub: <span>较上年　<em>↓ 2.30%</em></span> },
    { icon: '▥', label: '直接排放', value: direct, sub: `占比　${format(direct / total * 100)}%` },
    { icon: 'ϟ', label: '购入能源间接排放', value: purchased, sub: `占比　${format(purchased / total * 100)}%` },
    { icon: '↗', label: '其他间接排放', value: other, sub: `占比　${format(other / total * 100)}%` },
  ];
  const slices = [
    { label: '直接排放', value: direct, color: '#16a36f' },
    { label: '购入能源间接排放', value: purchased, color: '#4b9dec' },
    { label: '其他间接排放', value: other, color: '#d6a85f' },
  ];
  const trend = [11820.3, 12210.8, 12740.5, 13290.1, total];
  const trendMax = Math.max(...trend) * 1.08;
  const ranked = [...inventory].sort((a, b) => b.emissionAmount - a.emissionAmount).slice(0, 5);
  const directEnd = direct / total * 100;
  const purchasedEnd = directEnd + purchased / total * 100;
  const summaryRows = [...new Set(inventory.map((row) => row.emissionCategory))].map((emissionCategory) => {
    const rows = inventory.filter((row) => row.emissionCategory === emissionCategory);
    const emission = rows.reduce((sum, row) => sum + row.emissionAmount, 0);
    const category = resultCategory(emissionCategory);
    const resultCategoryName = category === 'direct' ? '直接排放' : category === 'purchased' ? '购入能源间接排放' : '其他间接排放';
    const displayEmissionCategory = emissionCategory === '购入的电力与热力产生的排放'
      ? '购入电力与热力产生的排放'
      : emissionCategory;
    return { emissionCategory, resultCategoryName, displayEmissionCategory, count: rows.length, emission };
  });
  const hasFormalVersion = state !== 'draft';
  const confirmedTime = confirmedAt?.slice(0, 16);
  const exportSummary = () => {
    const taskRows = [
      ['核算任务', '2026年度组织温室气体核算'],
      ['核算组织', 'XX科技有限公司'],
      ['组织边界', '企业法人边界'],
      ['正式清单', hasFormalVersion ? '当前正式清单' : '尚未生成'],
      ['确认人', hasFormalVersion ? '管理员' : '—'],
      ['确认时间', hasFormalVersion ? confirmedTime ?? '—' : '—'],
      [],
      ['结果类别', '排放类别', '排放源数量', '排放量（tCO₂e）', '占比'],
      ...summaryRows.map((row) => [
        row.resultCategoryName,
        row.displayEmissionCategory,
        `${row.count}项`,
        format(row.emission),
        `${format(row.emission / total * 100)}%`,
      ]),
      ['合计', '—', `${inventory.length}项`, format(total), '100.00%'],
    ];
    const csv = '\ufeff' + taskRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'XX科技有限公司_2026年度核算结果汇总.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.previewTask}`}>
        <div className={styles.taskLeft}>
          <div className={styles.taskIcon}>▣</div>
          <div className={styles.taskInfo}>
            <div className={styles.taskLine}>
              <b>当前核算任务：</b>
              <select aria-label="当前核算任务" value="2026" onChange={() => undefined}>
                <option value="2026">2026年度组织温室气体核算</option>
              </select>
              <Tag tone={state === 'confirmed' ? 'green' : 'orange'}>
                {state === 'draft' ? '草稿' : state === 'confirmed' ? '已确认' : '待核查修改'}
              </Tag>
            </div>
            <div className={styles.taskMetaGrid}>
              <div><span>核算组织</span><b>XX科技有限公司</b></div>
              <div><span>行业类型</span><b>通用工业企业</b></div>
              <div><span>依据标准</span><b>GB/T 32150—2025</b></div>
              <div><span>核算边界</span><b>企业法人边界</b></div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.summaryGrid}>
        {cards.map((card) => <section className={`${styles.card} ${styles.summaryCard}`} key={card.label}><div className={styles.summaryIcon}>{card.icon}</div><div><b>{card.label}</b><strong>{format(card.value)} <small>tCO₂e</small></strong><span>{card.sub}</span></div></section>)}
      </div>

      <div className={styles.analysisGrid}>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <h3>排放构成（按结果类别）</h3><small>单位：tCO₂e</small>
          <div className={styles.donutWrap}>
            <div
              className={styles.donut}
              style={{ background: `conic-gradient(#16a36f 0 ${directEnd}%, #4b9dec ${directEnd}% ${purchasedEnd}%, #d6a85f ${purchasedEnd}% 100%)` }}
            ><div><b>{format(total)}</b><span>tCO₂e</span></div></div>
            <div className={styles.legend}>{slices.map((slice) => <div key={slice.label}><i style={{ background: slice.color }} /><span>{slice.label}<small>{format(slice.value)}（{format(slice.value / total * 100)}%）</small></span></div>)}</div>
          </div>
        </section>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <h3>排放趋势（近5年）</h3><small>单位：tCO₂e</small>
          <div className={styles.barChart}>{trend.map((value, index) => <div key={value}><span>{format(value)}</span><i className={index === 4 ? styles.barCurrent : ''} style={{ height: `${value / trendMax * 100}%` }} /><small>{2022 + index}年</small></div>)}</div>
        </section>
      </div>

      <div className={styles.previewLowerGrid}>
        <section className={`${styles.card} ${styles.snapshotCard}`}>
        <header className={styles.snapshotHeader}>
          <h3>本次核算排放汇总</h3>
          <div className={styles.snapshotActions}>
            {hasFormalVersion ? <Button primary compact onClick={exportSummary}>导出核算结果</Button> : <Button outline compact onClick={() => window.history.back()}>返回核算清单继续完善</Button>}
          </div>
        </header>
        <table className={styles.snapshotTable}>
          <colgroup><col style={{ width: '22%' }} /><col style={{ width: '38%' }} /><col style={{ width: '24%' }} /><col style={{ width: '16%' }} /></colgroup>
          <thead><tr><th>结果类别</th><th>排放类别</th><th className={styles.snapshotAmountCell}>排放量</th><th className={styles.snapshotPercentCell}>占比</th></tr></thead>
          <tbody>
            {summaryRows.map((row, index) => {
              const firstIndex = summaryRows.findIndex((item) => item.resultCategoryName === row.resultCategoryName);
              const rowSpan = summaryRows.filter((item) => item.resultCategoryName === row.resultCategoryName).length;
              return (
                <tr key={row.emissionCategory}>
                  {firstIndex === index && <td className={styles.snapshotResultCategory} rowSpan={rowSpan}>{row.resultCategoryName}</td>}
                  <td>{row.displayEmissionCategory}</td>
                  <td className={styles.snapshotAmountCell}>{format(row.emission)} tCO₂e</td>
                  <td className={styles.snapshotPercentCell}>{format(row.emission / total * 100)}%</td>
                </tr>
              );
            })}
            <tr className={styles.snapshotTotalRow}>
              <td>合计</td><td>—</td><td className={styles.snapshotAmountCell}>{format(total)} tCO₂e</td><td className={styles.snapshotPercentCell}>100.00%</td>
            </tr>
          </tbody>
        </table>
        </section>
        <section className={`${styles.card} ${styles.analysisCard} ${styles.rankAnalysisCard}`}>
          <h3>主要排放源排行</h3><small>单位：tCO₂e</small>
          <table className={styles.rankTable}><thead><tr><th>排名</th><th>排放源</th><th>排放量</th><th>占比</th></tr></thead><tbody>
            {ranked.map((row, index) => <tr key={row.emissionSourceId}><td>{['🥇', '🥈', '🥉', '4', '5'][index]}</td><td>{row.sourceName.replace(/（.*?）/, '')}</td><td>{format(row.emissionAmount)}</td><td>{format(row.emissionAmount / total * 100)}%</td></tr>)}
            <tr><td colSpan={2}><b>合计</b></td><td><b>{format(total)}</b></td><td><b>100.00%</b></td></tr>
          </tbody></table>
        </section>
      </div>
    </div>
  );
}

function Inventory({
  inventory,
  taskState,
  version,
  keyword,
  boundary,
  collapsed,
  setKeyword,
  setBoundary,
  toggleGroup,
  openSource,
  openDialog,
  startUpdate,
  confirmSnapshot,
  confirmUpdate,
  showChanges,
  exportInventory,
  invalidSourceIds,
}: {
  inventory: EmissionSource[];
  taskState: TaskState;
  version: number;
  keyword: string;
  boundary: string;
  collapsed: Set<string>;
  setKeyword: (value: string) => void;
  setBoundary: (value: string) => void;
  toggleGroup: (value: string) => void;
  openSource: (row: EmissionSource, mode: SourceMode) => void;
  openDialog: (dialog: DialogState) => void;
  startUpdate: () => void;
  confirmSnapshot: () => void;
  confirmUpdate: () => void;
  showChanges: () => void;
  exportInventory: () => void;
  invalidSourceIds: Set<string>;
}) {
  const groups = [...new Set(inventory.map((row) => row.emissionCategory))];
  const filtered = inventory.filter((row) => {
    const matchKeyword = !keyword || [row.sourceName, row.sourceType, row.factorName, factorSummary(row)].some((text) => text.includes(keyword));
    return matchKeyword && (!boundary || row.emissionCategory === boundary);
  });
  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.inventoryTask}`}>
<<<<<<< Updated upstream
        <div className={styles.taskLeft}><div className={styles.taskIcon}>▣</div><div>
          <div className={styles.taskLine}><b>当前核算任务：</b><select><option>2026年度组织温室气体核算</option><option>2025年度组织温室气体核算</option></select>
            <Tag tone={taskState === 'confirmed' ? 'green' : 'orange'}>{taskState === 'draft' ? '草稿' : taskState === 'confirmed' ? '正式版' : '待确认更新'}</Tag>
=======
        <div className={styles.taskLeft}>
          <div className={styles.taskIcon} aria-hidden="true">▣</div>
          <div className={styles.taskInfo}>
            <div className={styles.taskLine}>
              <span className={styles.taskLabel}>当前核算任务</span>
              <select aria-label="当前核算任务" value="2026" onChange={() => undefined}><option value="2026">2026年度组织温室气体核算</option></select>
              {taskState !== 'pending' && <Tag tone={taskState === 'confirmed' ? 'green' : 'orange'}>{taskState === 'draft' ? '草稿' : '已确认'}</Tag>}
            </div>
            <div className={styles.taskMetaGrid}>
              <div><span>核算组织</span><b>XX科技有限公司</b></div>
              <div><span>行业类型</span><b>通用工业企业</b></div>
              <div><span>依据标准</span><b>GB/T 32150—2025</b></div>
              <div><span>核算边界</span><b>企业法人边界</b></div>
            </div>
>>>>>>> Stashed changes
          </div>
        </div>
        <div className={styles.taskActions}>
<<<<<<< Updated upstream
          {taskState === 'draft' && <><span className={styles.autosave}>草稿已自动保存</span><Button outline onClick={() => openDialog({ kind: 'task' })}>⊕ 新建任务</Button><Button primary onClick={confirmSnapshot}>确认并生成正式清单</Button></>}
          {taskState === 'confirmed' && <><Button outline onClick={exportInventory}>导出</Button><Button primary onClick={startUpdate}>发起修订</Button></>}
          {taskState === 'pending' && <><span className={styles.autosave}>已自动保存至编辑副本</span><Button onClick={() => openDialog({ kind: 'cancelUpdate' })}>取消本次修改</Button><Button primary onClick={confirmUpdate}>确认并更新正式清单</Button></>}
=======
          <div className={styles.taskSecondaryActions}>
            <Button outline onClick={() => openDialog({ kind: 'task' })}>⊕ 开始年度核算</Button>
            {taskState === 'confirmed' && <Button outline onClick={exportInventory}>导出</Button>}
          </div>
          {taskState === 'draft' && <><span className={styles.autosave}>草稿已自动保存</span><Button primary onClick={confirmSnapshot}>确认并生成正式清单</Button></>}
          {taskState === 'confirmed' && <Button primary onClick={startUpdate}>发起修订</Button>}
          {taskState === 'pending' && <><Button outline compact onClick={showChanges}>查看本次修改</Button><Button onClick={() => openDialog({ kind: 'cancelUpdate' })}>取消本次修改</Button><Button primary onClick={confirmUpdate}>确认并更新正式清单</Button></>}
>>>>>>> Stashed changes
        </div>
      </section>
      <section className={`${styles.card} ${styles.filterbar}`}>
        <div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索排放源、因子或参数" /></div>
        <label>排放类别<select value={boundary} onChange={(event) => setBoundary(event.target.value)}><option value="">全部</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
        <span />
        <Button primary disabled={taskState === 'confirmed'} onClick={() => openDialog({ kind: 'newSource' })}>⊕ 新增排放源</Button>
      </section>
      <section className={`${styles.card} ${styles.inventoryShell}`}>
        {groups.map((group) => {
          if (boundary && group !== boundary) return null;
          const rows = filtered.filter((row) => row.emissionCategory === group);
          if (keyword && !rows.length) return null;
          return <div className={styles.groupCard} key={group}>
<<<<<<< Updated upstream
            <button type="button" className={styles.groupHead} onClick={() => toggleGroup(group)}>
              <span>{collapsed.has(group) ? '›' : '⌄'}</span><b>{group}</b><em>（{inventory.filter((row) => row.emissionCategory === group).length}）</em>
              <strong>小计 {format(rows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong>
            </button>
            {!collapsed.has(group) && <div className={styles.groupTableWrap}><table className={styles.groupTable}>
              <colgroup><col style={{ width: '13%' }} /><col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '21%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /></colgroup>
              <thead><tr><th>温室气体源类型</th><th>排放源</th><th>温室气体种类</th><th>活动数据</th><th>排放因子/计算参数</th><th>排放量（tCO₂e）</th><th>操作</th></tr></thead>
              <tbody>{rows.length ? rows.map((row) => <tr key={row.emissionSourceId} className={invalidSourceIds.has(row.emissionSourceId) ? styles.invalidRow : ''}>
                <td className={styles.sourceTypeCell} data-column="source-type">{row.sourceType}</td>
                <td className={styles.sourceCell} data-column="source"><b>{row.sourceName}</b></td>
                <td data-column="gas-species">{row.greenhouseGasSpecies.join('、')}</td>
                <td className={styles.activityCell} data-column="activity"><b>{row.activityData}</b></td>
                <td className={styles.factorCell} data-column="factor"><b>{factorSummary(row)}</b></td>
                <td className={styles.emissionCell} data-column="emission"><b>{format(row.emissionAmount)}</b></td>
                <td className={styles.rowActions} data-column="actions"><button type="button" onClick={() => openSource(row, 'view')}>查看</button>{taskState !== 'confirmed' && <><button type="button" onClick={() => openSource(row, 'edit')}>编辑</button><button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSource', row })}>删除</button></>}</td>
              </tr>) : <tr><td colSpan={7} className={styles.emptyRow}>暂无排放源</td></tr>}</tbody>
=======
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={!collapsed.has(group)}
              onClick={() => toggleGroup(group)}
            >
              <span className={styles.groupToggle} aria-hidden="true">{collapsed.has(group) ? '›' : '⌄'}</span>
              <b className={styles.groupTitle}>{group}</b>
              <span className={styles.groupSummary}><small>小计</small><strong>{format(rows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong></span>
            </button>
            {!collapsed.has(group) && <div className={styles.groupTableWrap}><table className={styles.groupTable}>
              <colgroup><col style={{ width: '15%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col style={{ width: '17%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /></colgroup>
              <thead><tr><th>温室气体源类型</th><th>排放源</th><th>活动数据</th><th>碳排放因子</th><th>排放量（tCO₂e）</th><th>操作</th></tr></thead>
              <tbody>{rows.length ? rows.map((row) => <tr key={row.emissionSourceId} className={invalidSourceIds.has(row.emissionSourceId) ? styles.invalidRow : ''}>
                <td className={styles.sourceTypeCell} data-column="source-type">{row.sourceType}</td>
                <td className={styles.sourceCell} data-column="source"><b>{row.sourceName}</b>{validationMessages[row.emissionSourceId]?.map((message) => <span className={styles.validationMessage} key={message}>{message}</span>)}</td>
                <td className={styles.activityCell} data-column="activity"><b>{row.activityData}</b><span className={styles.compactMeta} data-column="gas-species">气体：{row.greenhouseGasSpecies.join('、')}</span></td>
                <td className={styles.factorCell} data-column="emission-factor"><b>{factorSummary(row)}</b></td>
                <td className={styles.emissionCell} data-column="emission"><b>{format(row.emissionAmount)}</b></td>
                <td className={styles.rowActions} data-column="actions"><button type="button" onClick={() => openSource(row, 'view')}>查看详情</button>{taskState !== 'confirmed' && <><button type="button" onClick={() => openSource(row, 'edit')}>编辑</button><button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSource', row })}>删除</button></>}</td>
              </tr>) : <tr><td colSpan={6} className={styles.emptyRow}>暂无排放源</td></tr>}</tbody>
>>>>>>> Stashed changes
            </table></div>}
          </div>;
        })}
      </section>
    </div>
  );
}

const materialType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'PDF';
  if (extension === 'xls' || extension === 'xlsx') return 'Excel';
  if (extension === 'doc' || extension === 'docx') return 'Word';
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return '图片';
  return '文件';
};

function SupportPage({
  inventory,
  basicItems,
  basicOverrides,
  openDrawer,
}: {
  inventory: EmissionSource[];
  basicItems: SupportItem[];
  basicOverrides: Record<string, Pick<SupportItem, 'evidenceFiles' | 'supportRemark' | 'materials'>>;
  openDrawer: (drawer: DrawerState) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'basic' | 'source'>('basic');
  const [keyword, setKeyword] = useState('');
  const [state, setState] = useState('');
  const sourceRows: SupportItem[] = inventory.map((row) => ({
    id: row.emissionSourceId,
    group: row.emissionCategory,
    type: row.sourceType,
    item: row.sourceName,
    activity: row.activityData,
    activityDataSources: row.confirmedActivityDataSources.length ? row.confirmedActivityDataSources.join('、') : '待确认',
    materials: row.evidenceFiles.length,
    state: row.evidenceStatus,
    evidenceFiles: row.evidenceFiles,
    emission: row,
  }));
  const basicRowsWithFiles = basicItems.map((item) => ({
    ...item,
    id: item.item,
    ...(basicOverrides[item.item] ?? {}),
    evidenceFiles: basicOverrides[item.item]?.evidenceFiles ?? item.evidenceFiles ?? Array.from({ length: item.materials }, (_, index) => ({ evidenceFileId: `${item.item}-${index}`, fileName: `基础材料-${index + 1}.pdf`, activityDataSource: item.activityDataSources })),
  }));
  const data: SupportItem[] = tab === 'basic' ? basicRowsWithFiles : sourceRows;
  const filtered = data.filter((item) => (!keyword || [item.item, item.group, item.activity, ...(item.evidenceFiles ?? []).map((file) => file.fileName)].some((text) => text.includes(keyword))) && (!state || item.state === state));
  const groups = [...new Set(filtered.map((item) => item.group))];
  const linkedCount = data.filter((item) => item.materials > 0).length;
  const pendingCount = data.filter((item) => item.state !== '已完成').length;
  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.supportHead}`}><div className={styles.supportTitleBlock}><div className={styles.eyebrow}>核查准备</div><div className={styles.taskLine}><strong>核查支撑工作台</strong><Tag tone="blue">通用工业企业</Tag></div><div className={styles.taskContext}>2026年度组织温室气体核算 · XX科技有限公司 · 2026-01-01 ~ 2026-12-31</div><div className={styles.supportMeta}><span>依据标准：GB/T 32150—2025</span><span>数据来源：当前正式核算清单</span></div></div><div className={styles.supportHeadRight}><div className={styles.supportSummary}><div><b>{data.length}</b><span>核查事项/排放源事项</span></div><div><b>{linkedCount}</b><span>已关联材料</span></div><div className={pendingCount ? styles.supportSummaryWarning : ''}><b>{pendingCount}</b><span>待补充</span></div></div><Button outline onClick={() => navigate('/carbon-accounting/inventory')}>← 返回核算清单</Button></div></section>
      <section className={`${styles.card} ${styles.supportPanel}`}>
        <div className={styles.tabs}><button className={tab === 'basic' ? styles.activeTab : ''} onClick={() => setTab('basic')}>核算基础材料 <span className={styles.tabCount}>{basicItems.length}</span></button><button className={tab === 'source' ? styles.activeTab : ''} onClick={() => setTab('source')}>排放源支撑材料 <span className={styles.tabCount}>{sourceRows.length}</span></button></div>
        <div className={styles.supportInfo}>{tab === 'source' ? '说明：排放源、活动数据及因子信息由正式碳核算清单自动带入并保持只读；活动数据来源依据标准规则推荐，用户可根据企业实际台账、报表和凭证进行确认、调整或补充。' : '说明：基础材料用于证明核算主体、组织边界、核算方法和数据质量制度。主体信息来自核算任务创建时保存的组织档案快照。'}</div>
        <div className={styles.supportToolbar}><div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索核查事项、排放源或材料名称" /></div><label>材料状态<select value={state} onChange={(event) => setState(event.target.value)}><option value="">全部</option><option value="待确认">待确认</option><option value="待补充">待补充</option><option value="已完成">已关联</option></select></label><span className={styles.supportToolbarHint}>共 {data.length} 项 · 已关联 {linkedCount} 项</span></div>
        <div className={styles.supportTableWrap}><table className={styles.supportTable} data-support-table>
          <colgroup>{tab === 'source' ? <><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '25%' }} /><col style={{ width: '7%' }} /><col style={{ width: '4%' }} /></> : <><col style={{ width: '16%' }} /><col style={{ width: '19%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '23%' }} /><col style={{ width: '7%' }} /><col style={{ width: '5%' }} /></>}</colgroup>
          <thead><tr>{tab === 'source' ? <th>温室气体源类型</th> : <th>核查事项</th>}<th>排放源/材料事项</th><th>活动数据项</th><th>活动数据来源</th><th>支撑材料</th><th>材料状态</th><th>操作</th></tr></thead><tbody>
          {groups.flatMap((group) => [
            <tr className={styles.supportGroup} key={`${group}-head`}><td colSpan={7}><div className={styles.supportGroupTitle} data-group-title={group}><span aria-hidden="true">⌄</span><b>{group}</b><small>{filtered.filter((item) => item.group === group).length} 项</small></div></td></tr>,
            ...filtered.filter((item) => item.group === group).map((item) => <tr key={`${group}-${item.item}`}>{tab === 'source' ? <td><div className={styles.chainCell}><span className={styles.chainLabel}>源类型</span><b>{item.type}</b></div></td> : <td><div className={styles.chainCell}><span className={styles.chainLabel}>核查事项</span><b>{item.group}</b></div></td>}<td><div className={styles.chainCell}><span className={styles.chainLabel}>排放源</span><b>{item.item}</b></div></td><td><div className={styles.chainCell}><span className={styles.chainLabel}>活动数据</span><span>{item.activity}</span></div></td><td><div className={styles.chainCell}><span className={styles.chainLabel}>来源</span><span>{item.activityDataSources}</span></div></td><td>{item.evidenceFiles?.length ? <div className={styles.materialCell}><div className={styles.materialPrimary}><b>{item.evidenceFiles[0].fileName}</b><span>{materialType(item.evidenceFiles[0].fileName)}</span></div>{item.evidenceFiles.length > 1 && <small>等 {item.evidenceFiles.length} 份材料</small>}</div> : <span className={styles.materialEmpty}>未关联材料</span>}</td><td><Tag tone={item.state === '已完成' ? 'green' : 'orange'}>{item.state === '已完成' ? '已关联' : item.state}</Tag></td><td className={styles.rowActions}><button onClick={() => openDrawer({ kind: 'support', item, manage: false })}>查看</button></td></tr>),
          ])}
        </tbody></table></div>
      </section>
    </div>
  );
}

function FactorPage({
  factors,
  setFactors,
  openDrawer,
  openDialog,
}: {
  factors: CarbonFactor[];
  setFactors: (value: CarbonFactor[]) => void;
  openDrawer: (drawer: DrawerState) => void;
  openDialog: (dialog: DialogState) => void;
}) {
  const [tab, setTab] = useState<'public' | 'enterprise' | 'history'>('public');
  const [filters, setFilters] = useState({ keyword: '', activity: '', industry: '', gas: '', source: '', geo: '', validity: '' });
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const rows = factors.filter((factor) => {
    const inTab = tab === 'public' ? factor.scope === 'public' && factor.validity === '当前有效' : tab === 'enterprise' ? factor.scope === 'enterprise' && factor.validity !== '停用' : factor.validity !== '当前有效';
    return inTab
      && (!filters.keyword || [factor.name, factor.activity, factor.source, factor.objectType].some((value) => value.includes(filters.keyword)))
      && (!filters.activity || factor.activity === filters.activity)
      && (!filters.industry || factor.industry === filters.industry)
      && (!filters.gas || factor.gas === filters.gas)
      && (!filters.source || factor.source === filters.source)
      && (!filters.geo || factor.geo === filters.geo)
      && (!filters.validity || factor.validity === filters.validity);
  });
  const activities = [...new Set(factors.map((factor) => factor.activity))];
  const sources = [...new Set(factors.map((factor) => factor.source))];
  return (
    <div className={styles.page}>
      {tab === 'enterprise' && <div className={styles.factorHeadActions}><Button outline onClick={() => openDialog({ kind: 'enterpriseFactor' })}>▣ 新增企业因子/参数</Button><Button outline onClick={() => openDialog({ kind: 'importFactor' })}>▦ 导入企业因子/参数</Button></div>}
      <section className={`${styles.card} ${styles.factorMain}`}>
        <div className={styles.factorTip}>{tab === 'public' ? '公共库同时管理综合排放因子、基础核算参数、参数组/公式模板、GWP值和方法学常数。公共数据由平台统一接入、审核和发布，普通租户仅可查看与引用。' : tab === 'enterprise' ? '企业可录入实测因子或单项核算参数，并保存适用年度、取值方式和依据材料；参数组可由企业值与公共缺省值组合形成。' : '历史或已失效数据仅用于历史任务追溯，不再作为新任务候选。'}</div>
        <div className={styles.factorFilters}>
          <input value={filters.keyword} onChange={(event) => setFilter('keyword', event.target.value)} placeholder="搜索因子、参数、公式模板或来源" />
          <select value={filters.activity} onChange={(event) => setFilter('activity', event.target.value)}><option value="">排放活动　全部</option>{activities.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={filters.industry} onChange={(event) => setFilter('industry', event.target.value)}><option value="">行业　全部</option><option>通用工业</option><option>水泥</option><option>电力</option></select>
          <select value={filters.gas} onChange={(event) => setFilter('gas', event.target.value)}><option value="">温室气体　全部</option><option>CO₂</option><option>CH₄</option><option>N₂O</option><option>CO₂e</option></select>
          <select value={filters.source} onChange={(event) => setFilter('source', event.target.value)}><option value="">来源　全部</option>{sources.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={filters.geo} onChange={(event) => setFilter('geo', event.target.value)}><option value="">地理范围　全部</option><option>全国</option><option>全球</option><option>当前企业</option></select>
          <select value={filters.validity} onChange={(event) => setFilter('validity', event.target.value)}><option value="">有效状态　全部</option><option>当前有效</option><option>已被替代</option><option>停用</option></select>
          <Button primary compact>查询</Button><Button compact onClick={() => setFilters({ keyword: '', activity: '', industry: '', gas: '', source: '', geo: '', validity: '' })}>重置</Button>
        </div>
        <div className={styles.tabs}><button className={tab === 'public' ? styles.activeTab : ''} onClick={() => setTab('public')}>公共因子与参数</button><button className={tab === 'enterprise' ? styles.activeTab : ''} onClick={() => setTab('enterprise')}>企业自定义因子/参数</button><button className={tab === 'history' ? styles.activeTab : ''} onClick={() => setTab('history')}>历史/已失效数据</button></div>
        <div className={styles.factorTableWrap}><table className={styles.factorTable}><thead><tr><th style={{ width: '16%' }}>对象名称</th><th style={{ width: '11%' }}>对象类型</th><th style={{ width: '10%' }}>排放活动</th><th style={{ width: '7%' }}>气体</th><th style={{ width: '15%' }}>当前值/参数摘要</th><th style={{ width: '17%' }}>来源与版本</th><th style={{ width: '11%' }}>适用范围</th><th style={{ width: '7%' }}>状态</th><th style={{ width: '6%' }}>操作</th></tr></thead><tbody>
          {rows.map((factor) => <tr key={factor.factorId} onClick={() => openDrawer({ kind: 'factor', factor })}><td><b>{factor.name}</b><small>{factor.scope === 'public' ? '公共库' : '企业库'}</small></td><td><span className={`${styles.objectTag} ${styles[`object${factor.objectType.replace(/[^\u4e00-\u9fa5]/g, '')}`] ?? ''}`}>{factor.objectType}</span></td><td>{factor.activity}</td><td>{factor.gas}</td><td><b>{factor.value}</b><small>{factor.unit}</small></td><td>{factor.source}<small>{factor.version}</small></td><td>{factor.geo}<small>{factor.industry}</small></td><td><Tag tone={factor.validity === '当前有效' ? 'green' : factor.validity === '已被替代' ? 'orange' : 'gray'}>{factor.validity}</Tag></td><td className={styles.rowActions}><button onClick={(event) => { event.stopPropagation(); openDrawer({ kind: 'factor', factor }); }}>查看</button>{factor.scope === 'enterprise' && tab === 'enterprise' && <button onClick={(event) => { event.stopPropagation(); setFactors(factors); openDialog({ kind: 'enterpriseFactor' }); }}>编辑</button>}</td></tr>)}
        </tbody></table></div>
        <div className={styles.pagination}><span>共 {rows.length} 条</span><div><button>‹</button><button className={styles.currentPage}>1</button><button>2</button><button>3</button><span>…</span><button>›</button></div></div>
      </section>
    </div>
  );
}

function SourceDrawer({
  state,
  allowEdit,
  close,
  save,
  chooseFactor,
}: {
  state: Extract<DrawerState, { kind: 'source' }>;
  allowEdit: boolean;
  close: () => void;
  save: (input: Omit<EmissionSource, 'emissionSourceId'>, id: string) => void;
  chooseFactor: (row: EmissionSource) => void;
}) {
  const row = state.row;
  const [activity, setActivity] = useState(String(numberFromActivity(row.activityData)));
  const [unit, setUnit] = useState(unitFromActivity(row.activityData));
  const factor = getCarbonFactorV4(state.factorId ?? row.emissionFactorId);
  const readOnly = state.mode === 'view';
  const result = factor ? recalculate(Number(activity), unit, factor) : 0;
  const submit = () => factor && save({ ...row, factorName: factor.name, emissionFactorId: factor.factorId, factorObjectId: factor.factorId, factorVersionId: factor.version, activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, emissionAmount: result }, row.emissionSourceId);
  return <Drawer title={readOnly ? '排放源详情' : '编辑排放源'} onClose={close} footer={<><Button onClick={close}>{readOnly ? '关闭' : '取消'}</Button>{readOnly && allowEdit ? <Button primary onClick={() => save(row, row.emissionSourceId)}>编辑</Button> : !readOnly && allowEdit ? <Button primary onClick={submit}>保存并重新计算</Button> : null}</>}>
    <DetailBlock title="基本信息"><div className={styles.basicInfoGrid}><div><span>排放类别</span><b>{row.emissionCategory}</b></div><div><span>温室气体源类型</span><b>{row.sourceType}</b></div><div><span>排放源</span><b>{row.sourceName}</b></div><div><span>温室气体种类</span><b>{row.greenhouseGasSpecies.join('、')}</b></div></div></DetailBlock>
    <DetailBlock title="核算数据"><div className={styles.calculationGrid}><div className={styles.activityPane}>{readOnly ? <><span>活动数据</span><b>{row.activityData}</b><small>{row.activityDataSource}</small></> : <div className={styles.activityInputs}><Field label="活动数据值"><input type="number" min="0" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位"><input value={unit} onChange={(event) => setUnit(event.target.value)} /></Field></div>}</div><div className={styles.resultPane}><div><span>结果因子/折算值</span><b>{factor ? factorSummary(row, factor.factorId) : '待补充'}</b></div><div><span>排放量</span><b>{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div></div></div></DetailBlock>
    <DetailBlock title="因子来源"><div className={styles.factorSourceLayout}><div className={styles.sourceCard}><span>名称</span><b>{factor?.name ?? '尚未匹配排放因子'}</b><span>来源与版本</span><span>{factor ? `${factor.source} · ${factor.version}` : '请从因子库选择或新增自定义因子'}</span></div>{!readOnly && <div className={styles.factorActions}><Button outline compact onClick={() => chooseFactor(row)}>{factor ? '更换因子/参数' : '选择因子/参数'}</Button></div>}</div></DetailBlock>
    <FactorCalculationDetails factor={factor} row={row} />
  </Drawer>;
}

function LegacySourceDrawer({
  state,
  allowEdit,
  close,
  save,
  chooseFactor,
  goSupport,
}: {
  state: Extract<DrawerState, { kind: 'source' }>;
  allowEdit: boolean;
  close: () => void;
  save: (input: Omit<EmissionSource, 'emissionSourceId'>, id: string) => void;
  chooseFactor: (row: EmissionSource) => void;
  goSupport: () => void;
}) {
  const row = state.row;
  const [activity, setActivity] = useState(String(numberFromActivity(row.activityData)));
  const factor = getCarbonFactorV4(state.factorId ?? row.emissionFactorId);
  const unit = unitFromActivity(row.activityData);
  const readOnly = state.mode === 'view';
  const system = row.entryMode === 'system';
  const result = factor ? recalculate(Number(activity), unit, factor) : 0;
  const submit = () => factor && save({ ...row, factorName: factor.name, emissionFactorId: factor.factorId, factorObjectId: factor.factorId, factorVersionId: factor.version, activityValue: Number(activity), activityUnit: unit, activityData: `${row.emissionSourceId === 'es-clinker' ? '原料消耗量：' : ''}${Number(activity).toLocaleString('zh-CN')} ${unit}`, emissionAmount: result }, row.emissionSourceId);
  return (
    <Drawer title={readOnly ? '排放源详情' : '编辑排放源'} onClose={close} footer={<><Button onClick={close}>{readOnly ? '关闭' : '取消'}</Button>{readOnly && allowEdit ? <Button primary onClick={() => save(row, row.emissionSourceId)}>编辑</Button> : !readOnly ? <Button primary onClick={submit}>保存并重新计算</Button> : null}</>}>
      <DetailBlock title="基本信息"><div className={styles.basicInfoGrid}><div><span>排放类别</span><b>{row.emissionCategory}</b></div><div><span>温室气体源类型</span><b>{row.sourceType}</b></div><div><span>排放源</span><b>{row.sourceName}</b></div><div><span>温室气体种类</span><b>{row.greenhouseGasSpecies.join('、')}</b></div></div></DetailBlock>
      <DetailBlock title="核算数据">
        <div className={styles.calculationGrid}><div className={styles.activityPane}>{readOnly || system ? <><span>活动数据</span><b>{row.activityData}</b><small>{row.activityDataSource}{!readOnly && system ? ' · 数据由能源数据模块关联，只读' : ''}</small></> : <div className={styles.activityInputs}><Field label="活动数据值"><input type="number" min="0" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位"><input value={unit} readOnly /></Field></div>}</div><div className={styles.resultPane}><div><span>结果因子/折算值</span><b>{factor ? factorSummary(row, factor.factorId) : '待补充'}</b></div><div><span>排放量</span><b>{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div></div></div>
      </DetailBlock>
<<<<<<< Updated upstream
      <DetailBlock title="计算公式"><div className={styles.formulaBox}>{factor.formula}<br /><b>当前结果：{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div><p className={styles.note}>正式清单确认时将保存公式版本、全部原始参数和折算结果快照。</p></DetailBlock>
      <DetailBlock title="数据追溯信息"><div className={styles.kv}><span>记录生成方式</span><span>{row.recordGenerationType === 'system' ? '系统识别' : '人工新增'}</span><span>上游数据模块</span><span>{row.sourceModule}</span><span>上游记录编号</span><span>{row.sourceRecordId}</span><span>因子或参数对象</span><span>{row.factorObjectId}</span><span>因子版本</span><span>{row.factorVersionId}</span><span>创建人</span><span>{row.createdBy}</span><span>创建时间</span><span>{row.createdAt}</span></div></DetailBlock>
      <DetailBlock title="来源与材料"><div className={styles.sourceCard}><span>活动数据来源</span><b>{row.activityDataSource}</b><span>因子/参数来源</span><span>{factor.source} · {factor.version}</span><span>支撑材料</span><span><Tag>已关联材料</Tag>　<button className={styles.textButton} onClick={goSupport}>前往核查支撑</button></span></div></DetailBlock>
=======
      <DetailBlock title="因子来源"><div className={styles.factorSourceLayout}><div className={styles.sourceCard}><span>名称</span><b>{factor?.name ?? '尚未匹配排放因子'}</b><span>来源与版本</span><span>{factor ? `${factor.source} · ${factor.version}` : '请从因子库选择或新增自定义因子'}</span></div>{!readOnly && <div className={styles.factorActions}><Button outline compact onClick={() => chooseFactor(row)}>{factor ? '更换因子/参数' : '选择因子/参数'}</Button></div>}</div></DetailBlock>
      <FactorCalculationDetails factor={factor} row={row} />
      <DetailBlock title="数据追溯信息"><div className={styles.kv}><span>记录生成方式</span><span>{row.recordGenerationType === 'system' ? '系统识别' : '人工新增'}</span><span>上游数据模块</span><span>{row.sourceModule}</span><span>上游记录编号</span><span>{row.sourceRecordId}</span><span>因子或参数对象</span><span>{row.factorObjectId}</span><span>因子版本</span><span>{row.factorVersionId}</span><span>创建人</span><span>{row.createdBy}</span><span>创建时间</span><span>{row.createdAt}</span></div>{system && <Button outline compact onClick={goUpstream}>前往上游数据</Button>}</DetailBlock>
      <DetailBlock title="来源与材料"><div className={styles.sourceCard}><span>活动数据来源</span><b>{row.activityDataSource}</b><span>因子/参数来源</span><span>{factor ? `${factor.source} · ${factor.version}` : '待补充'}</span><span>支撑材料</span><span><Tag>已关联材料</Tag>　<button className={styles.textButton} onClick={goSupport}>前往核查支撑</button></span></div></DetailBlock>
>>>>>>> Stashed changes
    </Drawer>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailBlock}><h3>{title}</h3>{children}</section>;
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}><span>{label}</span>{children}</label>;
}

function FactorCalculationDetails({ factor, row }: { factor?: CarbonFactor; row?: EmissionSource }) {
  if (!factor) return null;
  if (factor.factorId === 'pf-waste' && row) {
    const peopleDays = Number(row.activityValue) || 0;
    const bod = 40;
    const industrialCorrection = 1.25;
    const bo = 0.6;
    const mcf = 0.5;
    const gwp = 21;
    const tow = peopleDays * bod * 0.001 * industrialCorrection;
    const ef = bo * mcf;
    const methane = tow * ef;
    const methodResult = methane * gwp / 1000;
    return <DetailBlock title="废水处理核算方法"><div className={styles.wastewaterMethodBox}>
      <div className={styles.wastewaterMethodHeader}><b>核查口径：人天法 + 缺省值</b><span>按人员活动量估算生活污水有机物总量，再计算 CH₄ 排放并折算 CO₂e。</span></div>
      <div className={styles.wastewaterMethodGrid}>
        <div><span>BOD 缺省值</span><b>{bod} g BOD/人·天</b></div>
        <div><span>工业修正因子 I</span><b>{industrialCorrection}</b></div>
        <div><span>Bo × MCF</span><b>{bo} × {mcf} = {ef} kg CH₄/kg BOD</b></div>
        <div><span>CH₄ GWP</span><b>{gwp}</b></div>
      </div>
      <div className={styles.formulaBox}><span>核查口径公式</span><br />TOW = 人天数 × BOD × 0.001 × I = {format(tow, 2)} kg BOD/年<br />CH₄ = TOW × Bo × MCF = {format(methane, 2)} kg CH₄/年<br />CO₂e = CH₄ × GWP ÷ 1,000 = {format(methodResult)} tCO₂e</div>
    </div></DetailBlock>;
  }
  if (!factor.parameters?.length) {
    return <DetailBlock title="计算说明"><div className={styles.formulaBox}><span>计算公式</span><br />{factor.formula ?? '活动数据 × 结果因子/折算值'}</div></DetailBlock>;
  }
  return <DetailBlock title="因子拆解"><div className={styles.factorBreakdown}><div className={styles.breakdownHeader}><span>参数及来源</span><span>数值</span><span>单位</span></div>{factor.parameters.map((parameter) => <div className={styles.breakdownRow} key={parameter.key}><div><b>{parameter.name}</b><small>{parameter.sourceType} · {parameter.source}{parameter.editable ? ' · 可调整' : ' · 只读'}</small></div><b>{parameter.display}</b><span>{parameter.unit}</span></div>)}</div>{factor.formula && <div className={styles.formulaBox}><span>计算公式</span><br />{factor.formula}</div>}</DetailBlock>;
}

function CarbonReportPage({
  inventory,
  formalVersion,
  confirmedAt,
  notify,
}: {
  inventory: EmissionSource[];
  formalVersion: number;
  confirmedAt: string;
  notify: (message: string) => void;
}) {
  const [reports, setReports] = useState<CarbonReportRecord[]>(() => listCarbonReportMocks());
  const [year, setYear] = useState(2026);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(() => listCarbonReportMocks()[0]?.carbonReportId ?? '');
  const [exportOpen, setExportOpen] = useState(false);
  const [includeReport, setIncludeReport] = useState(true);
  const [includeEvidence, setIncludeEvidence] = useState(false);
  const snapshots = listCarbonSnapshots();
  const visibleReports = reports.filter((report) =>
    report.year === year && report.reportName.includes(keyword.trim()));
  const selectedReport = reports.find((report) => report.carbonReportId === selectedId)
    ?? visibleReports[0]
    ?? reports[0];
  const reportDateParts = selectedReport?.generatedAt.slice(0, 10).split('-') ?? [];
  const reportDate = reportDateParts.length === 3
    ? `${reportDateParts[0]} 年 ${reportDateParts[1]} 月 ${reportDateParts[2]} 日`
    : selectedReport?.generatedAt.slice(0, 10) ?? '—';
  const selectedSnapshot = snapshots.find((snapshot) =>
    snapshot.carbonSnapshotId === selectedReport?.carbonSnapshotId)
    ?? snapshots.find((snapshot) =>
      snapshot.year === selectedReport?.year && snapshot.version === selectedReport?.version);
  const reportInventory = selectedReport?.year === 2026 && selectedReport.version === formalVersion
    ? inventory
    : selectedSnapshot?.sourceItems ?? [];
  const totalEmission = selectedReport?.year === 2026 && selectedReport.version === formalVersion
    ? inventory.reduce((total, row) => total + row.emissionAmount, 0)
    : selectedSnapshot?.totalEmission ?? 0;
  const categoryRows = [...new Set(reportInventory.map((row) => row.emissionCategory))].map((category) => {
    const rows = reportInventory.filter((row) => row.emissionCategory === category);
    return {
      category,
      count: rows.length,
      amount: rows.reduce((total, row) => total + row.emissionAmount, 0),
    };
  });
  const evidenceFiles = reportInventory.flatMap((row) => row.evidenceFiles ?? []);
  const selectYear = (nextYear: number) => {
    setYear(nextYear);
    const next = reports.find((report) => report.year === nextYear);
    if (next) setSelectedId(next.carbonReportId);
  };
  const generateReport = () => {
    const snapshot = snapshots
      .filter((item) => item.year === year)
      .sort((left, right) => right.version - left.version)[0];
    if (!snapshot) {
      notify(`${year}年度尚未形成正式核算清单，无法生成报告`);
      return;
    }
    const generatedAt = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/\//g, '-');
    const report = createCarbonReportMock({
      carbonSnapshotId: snapshot.carbonSnapshotId,
      year,
      version: snapshot.version,
      generatedAt,
    });
    setReports((items) => [report, ...items]);
    setSelectedId(report.carbonReportId);
    notify('已基于当前正式核算清单生成排放报告');
  };
  const exportPackage = () => {
    if (!selectedReport || (!includeReport && !includeEvidence)) return;
    const reportHtml = [
      '<!doctype html><meta charset="utf-8">',
      `<title>${selectedReport.reportName}</title>`,
      '<style>body{font:14px/1.7 Arial,"Microsoft YaHei";padding:32px;color:#24333c}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cad4d8;padding:8px;text-align:left}</style>',
      `<h1>${selectedReport.reportName}</h1>`,
      `<p>核算年度：${selectedReport.year}年　核算主体：${selectedReport.organizationName}　数据来源：当前正式清单</p>`,
      includeReport
        ? `<h2>排放报告</h2><p>排放总量：${format(totalEmission)} tCO₂e</p><table><thead><tr><th>排放类别</th><th>排放源数量</th><th>排放量（tCO₂e）</th></tr></thead><tbody>${categoryRows.map((row) => `<tr><td>${row.category}</td><td>${row.count}</td><td>${format(row.amount)}</td></tr>`).join('')}</tbody></table>`
        : '',
    ].join('');
    const packageFiles: Array<{ name: string; content: string }> = [];
    if (includeReport) packageFiles.push({ name: `${selectedReport.reportName}.html`, content: reportHtml });
    if (includeEvidence) packageFiles.push({
      name: '核查凭证材料目录.txt',
      content: evidenceFiles.length
        ? evidenceFiles.map((file, index) => `${index + 1}. ${file.fileName}｜关联来源：${file.activityDataSource}`).join('\n')
        : '当前正式清单尚未关联可导出的核查凭证材料。',
    });
    const url = URL.createObjectURL(createTarBlob(packageFiles));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedReport.reportName}_核查资料包.tar`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    notify('核查资料包已生成');
  };

  return <div className={`${styles.page} ${styles.reportPage}`}>
    <section className={styles.reportWorkbench}>
      <aside className={styles.reportSidebar}>
        <Field label="选择年份">
          <select value={year} onChange={(event) => selectYear(Number(event.target.value))}>
            {[...new Set(reports.map((report) => report.year))].sort((a, b) => b - a).map((item) =>
              <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Button primary onClick={generateReport}>生成报告</Button>
        <div className={styles.reportSearch}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="请输入报告名称"
            aria-label="搜索报告"
          />
          <span>⌕</span>
        </div>
        <div className={styles.reportList}>
          {(['7天内', '30天内'] as const).map((group) => {
            const groupReports = visibleReports.filter((report) => report.recentGroup === group);
            if (!groupReports.length) return null;
            return <section key={group}>
              <h3><span>⌁</span>{group}</h3>
              {groupReports.map((report) =>
                <button
                  type="button"
                  key={report.carbonReportId}
                  className={report.carbonReportId === selectedReport?.carbonReportId ? styles.reportListActive : ''}
                  onClick={() => setSelectedId(report.carbonReportId)}
                  title={report.reportName}
                >
                  <b>{report.reportName}</b>
                  <small>当前正式清单 · {report.generatedAt.slice(5, 16)}</small>
                </button>)}
            </section>;
          })}
          {!visibleReports.length && <div className={styles.reportListEmpty}>未找到匹配的报告</div>}
        </div>
      </aside>
      <main className={styles.reportPreviewPane}>
        <div className={styles.reportPreviewActions}>
          <Button primary compact onClick={() => setExportOpen(true)}>导出核查资料包</Button>
        </div>
        {selectedReport ? <article className={styles.carbonReportPaper}>
          <header>
            <h1>企业温室气体排放报告</h1>
            <p>（{selectedReport.templateName}）</p>
            <p>依据《{selectedReport.standardName}》及《工业其他行业企业温室气体排放核算方法与报告指南（试行）》编制</p>
            <p>报告主体：{selectedReport.organizationName}</p>
            <p>报告年度：{selectedReport.year} 年</p>
            <p>编制日期：{reportDate}</p>
          </header>
          <h2>一、企业基本情况</h2>
          <h3>1.1 报告主体基本信息</h3>
          <table><thead><tr><th>项目</th><th>内容</th></tr></thead><tbody>
            <tr><td>报告主体名称</td><td>{selectedReport.organizationName}</td></tr>
            <tr><td>统一社会信用代码</td><td>9132XXXXXXXXXXXXXX</td></tr>
            <tr><td>报告年度</td><td>{selectedReport.year}</td></tr>
            <tr><td>单位性质</td><td>工业企业</td></tr>
            <tr><td>所属行业</td><td>通用工业企业</td></tr>
            <tr><td>核算标准</td><td>{selectedReport.standardName}</td></tr>
            <tr><td>清单状态</td><td>当前正式清单</td></tr>
          </tbody></table>
          <h3>1.2 核算边界说明</h3>
          <p>本报告主体以企业法人边界作为组织边界，核算并报告其运营控制范围内生产场所、辅助生产系统及办公区域产生的温室气体排放。</p>
          <p>排放源、活动数据和排放因子均读取已确认的正式核算清单，报告生成后不随编辑副本实时变化。</p>
          <h2>二、温室气体排放汇总</h2>
          <table><thead><tr><th>排放类别</th><th>排放源数量</th><th>排放量（tCO₂e）</th><th>占比</th></tr></thead><tbody>
            {categoryRows.map((row) => <tr key={row.category}><td>{row.category}</td><td>{row.count}项</td><td>{format(row.amount)}</td><td>{totalEmission ? format(row.amount / totalEmission * 100) : '0.00'}%</td></tr>)}
            <tr className={styles.reportTotalRow}><td>合计</td><td>{reportInventory.length}项</td><td>{format(totalEmission)}</td><td>100.00%</td></tr>
          </tbody></table>
          <p className={styles.reportDocumentFoot}>数据来源：当前正式核算清单　确认时间：{selectedReport.year === 2026 ? confirmedAt : selectedReport.generatedAt}</p>
        </article> : <div className={styles.reportDocumentEmpty}>请选择或生成报告</div>}
      </main>
    </section>
    {exportOpen && selectedReport && <Dialog
      title="导出核查资料包"
      onClose={() => setExportOpen(false)}
      footer={<><Button onClick={() => setExportOpen(false)}>取消</Button><Button primary disabled={!includeReport && !includeEvidence} onClick={exportPackage}>导出资料包</Button></>}
    >
      <div className={styles.exportReportSection}>
        <h3>导出信息</h3>
        <p><span>核算年度：{selectedReport.year}年</span><span>核算主体：{selectedReport.organizationName}</span></p>
      </div>
      <div className={styles.exportReportSection}>
        <h3>导出内容</h3>
        <label><input type="checkbox" checked={includeReport} onChange={(event) => setIncludeReport(event.target.checked)} /> 排放报告</label>
        <label><input type="checkbox" checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)} /> 核查凭证材料</label>
      </div>
      <div className={styles.exportReportSection}>
        <h3>导出提示</h3>
        <p>系统将导出当前报告及已上传的凭证材料目录。未上传的凭证材料不会生成空文件。</p>
        <small>当前正式清单已关联 {evidenceFiles.length} 份凭证材料。</small>
      </div>
    </Dialog>}
  </div>;
}

export function CarbonAccountingV4({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const page = pathname.split('/').pop();
  const [inventory, setInventory] = useState(() => listEmissionSources());
  // 演示任务已完成录入并确认，碳排放预览默认只读取正式清单快照。
  const [taskState, setTaskState] = useState<TaskState>('confirmed');
  const [version, setVersion] = useState(1);
  const [formalSnapshot, setFormalSnapshot] = useState(() => latestCarbonSnapshot());
  const [baseline, setBaseline] = useState<EmissionSource[] | null>(null);
  const [history, setHistory] = useState<{ version: number; time: string; total: number; count: number }[]>(() => [{
    version: 1,
    time: '2026-06-30 18:00:00',
    total: inventory.reduce((sum, row) => sum + row.emissionAmount, 0),
    count: inventory.length,
  }]);
  const [keyword, setKeyword] = useState('');
  const [boundary, setBoundary] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [toast, setToast] = useState('');
  const [invalidSourceIds, setInvalidSourceIds] = useState<Set<string>>(new Set());
  const [supportOverrides, setSupportOverrides] = useState<Record<string, EmissionSource>>({});
  const [basicSupportOverrides, setBasicSupportOverrides] = useState<Record<string, Pick<SupportItem, 'evidenceFiles' | 'supportRemark' | 'materials'>>>({});
  const [factors, setFactors] = useState<CarbonFactor[]>(() => carbonFactorsV4.map((factor) => ({ ...factor, parameters: factor.parameters?.map((parameter) => ({ ...parameter })) })));
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  // 正式版预览以发布后的快照为准；编辑副本期间继续展示发布前的正式快照。
  // inventory 只作为清单编辑态和尚未生成正式快照时的来源。
  const officialInventory = taskState === 'pending' && baseline
    ? baseline
    : taskState === 'confirmed' && formalSnapshot
      ? formalSnapshot.sourceItems
      : inventory;
  const supportInventory = officialInventory.map((row) => supportOverrides[row.emissionSourceId] ?? row);
  const refresh = () => setInventory(listEmissionSources());
  const toggleGroup = (group: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });
  const openSource = (row: EmissionSource, mode: SourceMode) => setDrawer({ kind: 'source', row, mode });
  const saveSource = (input: Omit<EmissionSource, 'emissionSourceId'>, id?: string) => {
    const result = saveEmissionSource(input, id);
    if (!result.ok) { notify(result.error); return false; }
    refresh();
    setDrawer(null);
    if (taskState === 'confirmed') setTaskState('pending');
    notify(id ? '排放源已保存并重新计算' : '排放源已新增');
    return true;
  };
  const confirmSnapshot = () => {
    const snapshot = publishCarbonSnapshot();
    setFormalSnapshot(snapshot);
    const displayVersion = version || 1;
    setVersion(displayVersion);
    setTaskState('confirmed');
    setInvalidSourceIds(new Set());
    setHistory((items) => [{ version: displayVersion, time: new Date().toLocaleString('zh-CN', { hour12: false }), total: snapshot.totalEmission, count: snapshot.sourceItems.length }, ...items]);
    setDialog(null);
    notify('正式核算清单已生成');
  };
  const completeUpdate = () => {
    const snapshot = publishCarbonSnapshot();
    setFormalSnapshot(snapshot);
    const displayVersion = version + 1;
    setVersion(displayVersion);
    setTaskState('confirmed');
    setBaseline(null);
    setInvalidSourceIds(new Set());
    setHistory((items) => [{ version: displayVersion, time: new Date().toLocaleString('zh-CN', { hour12: false }), total: snapshot.totalEmission, count: snapshot.sourceItems.length }, ...items]);
    setDialog(null);
    notify(`正式核算清单已更新为 V${displayVersion}`);
  };
  const cancelUpdate = () => {
    const restored = replaceEmissionSourcesForTask('ct-2026', baseline ?? inventory);
    setInventory(restored);
    setBaseline(null);
    setTaskState('confirmed');
    setInvalidSourceIds(new Set());
    setDialog(null);
    notify('已恢复正式清单');
  };
  const exportInventory = () => {
    const header = ['核算边界', '温室气体源类型', '排放源', '活动数据', '因子/参数', '排放量（tCO₂e）'];
    const csv = '\ufeff' + [header, ...officialInventory.map((row) => [row.emissionGroup, row.sourceType, row.sourceName, row.activityData, row.factorName, format(row.emissionAmount)])].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'XX科技有限公司_2026年度碳核算清单.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    notify('正式核算清单已导出');
  };
  const requestSnapshotConfirmation = () => {
    const issues = validateInventory(inventory);
    setInvalidSourceIds(new Set(issues.map((issue) => issue.emissionSourceId)));
    if (issues.length) { notify(`当前有${new Set(issues.map((issue) => issue.emissionSourceId)).size}项数据未通过校验，请完善后再确认正式清单。`); return; }
    setDialog({ kind: 'confirmSnapshot' });
  };
  const requestUpdateConfirmation = () => {
    const issues = validateInventory(inventory);
    setInvalidSourceIds(new Set(issues.map((issue) => issue.emissionSourceId)));
    if (issues.length) { notify(`当前有${new Set(issues.map((issue) => issue.emissionSourceId)).size}项数据未通过校验，请完善后再确认正式清单。`); return; }
    setDialog({ kind: 'completeUpdate' });
  };

  let content: ReactNode;
<<<<<<< Updated upstream
  if (page === 'preview') content = <Preview inventory={officialInventory} state={taskState} version={version} confirmedAt={history[0]?.time} openSettings={() => setDialog({ kind: 'settings' })} />;
  else if (page === 'inventory') content = <Inventory inventory={inventory} taskState={taskState} version={version} keyword={keyword} boundary={boundary} collapsed={collapsed} setKeyword={setKeyword} setBoundary={setBoundary} toggleGroup={toggleGroup} openSource={openSource} openDialog={setDialog} startUpdate={() => { setBaseline(inventory.map((row) => ({ ...row }))); setInvalidSourceIds(new Set()); setTaskState('pending'); notify(`已基于正式清单 V${version} 创建编辑副本`); }} confirmSnapshot={requestSnapshotConfirmation} confirmUpdate={requestUpdateConfirmation} showChanges={() => setDrawer({ kind: 'changes', baseline: baseline ?? inventory, draft: inventory, version })} exportInventory={exportInventory} invalidSourceIds={invalidSourceIds} />;
  else if (page === 'support') content = <SupportPage inventory={supportInventory} openDrawer={setDrawer} />;
=======
  if (page === 'preview') content = <Preview inventory={officialInventory} state={taskState} version={version} confirmedAt={history[0]?.time} />;
  else if (page === 'inventory') content = <Inventory inventory={inventory} taskState={taskState} version={version} keyword={keyword} boundary={boundary} collapsed={collapsed} setKeyword={setKeyword} setBoundary={setBoundary} toggleGroup={toggleGroup} openSource={openSource} openDialog={setDialog} startUpdate={() => { setBaseline(inventory.map((row) => ({ ...row }))); setInvalidSourceIds(new Set()); setValidationMessages({}); setTaskState('pending'); notify('已基于当前正式清单创建编辑副本'); }} confirmSnapshot={requestSnapshotConfirmation} confirmUpdate={requestUpdateConfirmation} showChanges={() => setDrawer({ kind: 'changes', baseline: baseline ?? inventory, draft: inventory, version })} exportInventory={exportInventory} invalidSourceIds={invalidSourceIds} validationMessages={validationMessages} />;
  else if (page === 'support') content = <SupportPage inventory={supportInventory} basicItems={supportBasicV4.map((item) => ({ ...item, id: item.item, activityDataSources: item.origin, state: item.state === '已上传' ? '已完成' : '待补充' }))} basicOverrides={basicSupportOverrides} openDrawer={setDrawer} />;
>>>>>>> Stashed changes
  else if (page === 'factors') content = <FactorPage factors={factors} setFactors={setFactors} openDrawer={setDrawer} openDialog={setDialog} />;
  else content = <CarbonReportPage
    inventory={officialInventory}
    formalVersion={version}
    confirmedAt={history[0]?.time ?? '2026-06-30 18:00:00'}
    notify={notify}
  />;

  return <>{content}{toast && <div className={styles.toast}>{toast}</div>}
    {dialog?.kind === 'settings' && <SettingsDialog close={() => setDialog(null)} save={() => { setDialog(null); notify('核算设置已保存'); }} />}
<<<<<<< Updated upstream
    {dialog?.kind === 'task' && <TaskDialog close={() => setDialog(null)} create={() => { setTaskState('draft'); setVersion(0); setBaseline(null); setHistory([]); setDialog(null); notify('年度核算任务已创建，已生成草稿清单并自动保存'); }} />}
    {dialog?.kind === 'newSource' && <NewSourceDialog groups={[...new Set(inventory.map((row) => row.emissionGroup))]} close={() => setDialog(null)} save={(input) => { if (saveSource(input)) setDialog(null); }} />}
    {dialog?.kind === 'deleteSource' && <Dialog title="删除排放源" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { deleteEmissionSource(dialog.row.emissionSourceId); refresh(); setDialog(null); notify(dialog.row.entryMode === 'system' ? '已从当前核算任务中移除' : '排放源已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>{dialog.row.entryMode === 'system' ? '该记录由系统根据源数据生成。删除后仅从当前核算任务中移除，不会删除能源消费、运营数据等上游源数据。' : '该记录为人工新增。删除后将从当前核算任务中逻辑移除，后台保留删除人、时间和操作记录。'}</div><p><b>{dialog.row.sourceName}</b></p></Dialog>}
=======
    {dialog?.kind === 'task' && <TaskDialog close={() => setDialog(null)} create={(year) => {
      const sources = buildEnergyDraftSources(year);
      setDialog({ kind: 'draftPreview', year, sources });
    }} />}
    {dialog?.kind === 'draftPreview' && <DraftPreviewDialog
      year={dialog.year}
      sources={dialog.sources}
      close={() => setDialog(null)}
      confirm={() => {
        const next = replaceEmissionSourcesForTask(`ct-${dialog.year}`, dialog.sources);
        setInventory(next.filter((row) => row.carbonTaskId === `ct-${dialog.year}`));
        setTaskState('draft');
        setVersion(0);
        setFormalSnapshot(undefined);
        setBaseline(null);
        setHistory([]);
        setDialog(null);
        notify(`已生成${dialog.year}年度草稿清单，当前清单已保留为草稿状态`);
      }}
    />}
    {dialog?.kind === 'newSource' && <NewSourceDialog groups={emissionCategoryDictionary} close={() => setDialog(null)} save={(input) => { if (saveSource(input)) setDialog(null); }} />}
    {dialog?.kind === 'deleteSource' && <Dialog title="删除排放源" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { deleteEmissionSource(dialog.row.emissionSourceId); refresh(); setDialog(null); notify('排放源已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>删除后，该排放源将从当前草稿清单中移除；关联的上游能源或运营数据不会被删除。</div><p><b>{dialog.row.sourceName}</b></p></Dialog>}
>>>>>>> Stashed changes
    {dialog?.kind === 'confirmSnapshot' && <ConfirmSnapshot title="确认生成正式核算清单" previousVersion={0} version={1} baseline={[]} inventory={inventory} close={() => setDialog(null)} confirm={confirmSnapshot} />}
    {dialog?.kind === 'completeUpdate' && <ConfirmSnapshot title="确认更新正式核算清单" previousVersion={version} version={version + 1} baseline={baseline ?? []} inventory={inventory} close={() => setDialog(null)} confirm={completeUpdate} />}
    {dialog?.kind === 'cancelUpdate' && <Dialog title="取消本次修改" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>继续编辑</Button><Button danger onClick={cancelUpdate}>确认取消</Button></>}><div className={styles.confirmBox}>取消后将恢复当前正式清单，本次编辑副本中的修改不会保留。</div></Dialog>}
    {dialog?.kind === 'factorSelect' && <FactorSelectDialog row={dialog.row} factors={factors} close={() => setDialog(null)} choose={(factorId) => { setDialog(null); setDrawer({ kind: 'source', row: dialog.row, mode: 'edit', factorId }); notify('已切换计算因子/参数组'); }} onCreateFactor={(factor) => { saveCarbonFactorV4(factor); setFactors((current) => [...current, factor]); setDialog(null); setDrawer({ kind: 'source', row: dialog.row, mode: 'edit', factorId: factor.factorId }); notify('自定义排放因子已保存并应用'); }} />}
    {dialog?.kind === 'enterpriseFactor' && <EnterpriseFactorDialog close={() => setDialog(null)} save={(factor) => { setFactors([...factors, factor]); setDialog(null); notify('企业因子/参数已保存'); }} />}
    {dialog?.kind === 'importFactor' && <Dialog title="导入企业因子/参数" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button primary onClick={() => { setDialog(null); notify('企业因子导入校验已启动（演示）'); }}>开始导入</Button></>}><div className={styles.infoBox}>仅导入当前企业的实测因子、核算参数或参数组。公共因子由平台管理员通过受控流程统一导入、校验和发布。</div><div className={styles.importBox}><b>导入文件 *</b><Button outline>选择Excel文件</Button><small>导入后将执行字段、单位、重复项、适用年度和依据材料校验。</small></div></Dialog>}
<<<<<<< Updated upstream
    {drawer?.kind === 'source' && <SourceDrawer state={drawer} allowEdit={taskState !== 'confirmed'} close={() => setDrawer(null)} save={(input, id) => { if (drawer.mode === 'view' && taskState !== 'confirmed') setDrawer({ ...drawer, mode: 'edit' }); else if (drawer.mode !== 'view') saveSource(input, id); }} chooseFactor={(row) => { setDrawer(null); setDialog({ kind: 'factorSelect', row }); }} goSupport={() => { setDrawer(null); navigate('/carbon-accounting/support'); }} />}
    {drawer?.kind === 'support' && <SupportDrawer state={drawer} close={() => setDrawer(null)} manage={() => setDrawer({ ...drawer, manage: true })} save={(source) => { if (source) setSupportOverrides((items) => ({ ...items, [source.emissionSourceId]: source })); setDrawer(null); notify('支撑信息已保存'); }} />}
=======
    {drawer?.kind === 'source' && <SourceDrawer state={drawer} allowEdit={taskState !== 'confirmed'} close={() => setDrawer(null)} save={(input, id) => { if (drawer.mode !== 'view') saveSource(input, id); }} chooseFactor={(row) => { setDrawer(null); setDialog({ kind: 'factorSelect', row }); }} />}
    {drawer?.kind === 'support' && <SupportDrawer state={drawer} close={() => setDrawer(null)} manage={() => setDrawer({ ...drawer, manage: true })} save={(item) => { if (item.emission) setSupportOverrides((items) => ({ ...items, [item.emission!.emissionSourceId]: item.emission! })); else setBasicSupportOverrides((items) => ({ ...items, [item.item]: { evidenceFiles: item.evidenceFiles ?? [], supportRemark: item.supportRemark, materials: item.evidenceFiles?.length ?? 0 } })); setDrawer(null); notify('支撑信息已保存'); }} />}
>>>>>>> Stashed changes
    {drawer?.kind === 'factor' && <FactorDrawer factor={drawer.factor} close={() => setDrawer(null)} />}
    {drawer?.kind === 'history' && <HistoryDrawer history={history} close={() => setDrawer(null)} />}
    {drawer?.kind === 'changes' && <ChangeDrawer baseline={drawer.baseline} draft={drawer.draft} version={drawer.version} close={() => setDrawer(null)} />}
  </>;
}

function SettingsDialog({ close, save }: { close: () => void; save: () => void }) {
  return <Dialog title="核算设置" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={save}>保存设置</Button></>}><div className={styles.orgBox}><span><b>核算组织：XX科技有限公司</b><small>组织信息来自任务创建时的档案快照，不可直接修改。</small></span><Tag>只读</Tag></div><div className={styles.formGrid}><Field label="核算年度"><input value="2026年" readOnly /></Field><Field label="行业核算方法"><select><option>通用工业企业</option><option>其他适用行业方法</option></select></Field><Field label="核算范围" full><select><option>全部组织与设施</option><option>指定组织或设施</option></select></Field><Field label="核算用途" full><select><option>企业年度盘查</option><option>第三方核查</option><option>对外披露</option></select></Field><Field label="边界说明" full><textarea placeholder="如存在特殊边界情况，请填写说明" /></Field></div></Dialog>;
}

function TaskDialog({ close, create }: { close: () => void; create: (year: number) => void }) {
  const [year, setYear] = useState('2026');
  const [customYear, setCustomYear] = useState('');
  const yearOptions = ['2027', '2026', '2025', '2024', '2023', '2022'];
  const isCustom = year === 'custom';
  return <Dialog title="开始年度核算" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={() => create(Number(isCustom ? customYear : year))}>确定并开始核算</Button></>}>
    <p className={styles.dialogIntro}>选择核算年度，系统将自动初始化本年度核算清单。</p>
    <div className={styles.taskYearPicker}>
      <Field label="核算年度 *"><select value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions.map((item) => <option key={item} value={item}>{item}年</option>)}<option value="custom">自定义年度</option></select></Field>
      {isCustom && <input className={styles.customYearInput} type="number" min="2000" max="2100" value={customYear} onChange={(event) => setCustomYear(event.target.value)} placeholder="请输入四位年度" aria-label="自定义核算年度" />}
    </div>
    <div className={styles.taskInitSummary}>
      <div><span>组织范围</span><b>继承组织管理中的当前有效范围</b></div>
      <div><span>核算标准</span><b>GB/T 32150-2025《工业企业温室气体排放核算和报告通则》</b></div>
    </div>
    <div className={`${styles.infoBox} ${styles.fieldFull}`}><span>系统将按上述组织范围和核算标准创建本年度任务，并生成待完善的年度核算草稿清单。如检测到组织范围发生变化，系统会在进入清单前提示确认。</span></div>
  </Dialog>;
}

function DraftPreviewDialog({ year, sources, close, confirm }: { year: number; sources: EmissionSource[]; close: () => void; confirm: () => void }) {
  const pendingFactorCount = sources.filter((source) => !source.emissionFactorId).length;
  const groupedSources = [...new Set(sources.map((source) => source.emissionCategory))].map((category) => ({
    category,
    rows: sources.filter((source) => source.emissionCategory === category),
  }));
  return <Dialog title={`${year}年度草稿清单生成预览`} onClose={close} wide footer={<><Button onClick={close}>返回修改任务设置</Button><Button primary onClick={confirm} disabled={!sources.length}>确认生成草稿清单</Button></>}>
    <div className={styles.infoBox}>以下为系统即将生成的草稿清单，共 {sources.length} 项排放源。{pendingFactorCount > 0 ? `其中 ${pendingFactorCount} 项暂待补充因子/参数，生成后可在清单中完善。` : '当前记录均已具备计算条件。'}产品产量、产值等运营指标不会生成排放源。</div>
    <div className={styles.previewInventoryShell}>
      {groupedSources.map(({ category, rows }) => {
        const pendingCount = rows.filter((row) => !row.emissionFactorId).length;
        const subtotal = rows.reduce((sum, row) => sum + row.emissionAmount, 0);
        return <div className={styles.groupCard} key={category}>
          <div className={styles.groupHead}><span className={styles.groupToggle} aria-hidden="true">⌄</span><b className={styles.groupTitle}>{category}</b>{pendingCount > 0 && <small className={styles.groupStatus}>待完善 {pendingCount}</small>}<span className={styles.groupSummary}><small>小计</small><strong>{format(subtotal)} tCO₂e</strong></span></div>
          <div className={styles.groupTableWrap}><table className={styles.groupTable}>
            <colgroup><col style={{ width: '18%' }} /><col style={{ width: '28%' }} /><col style={{ width: '24%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /></colgroup>
            <thead><tr><th>温室气体源类型</th><th>排放源</th><th>活动数据</th><th>碳排放因子</th><th>排放量（tCO₂e）</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.emissionSourceId}>
              <td>{row.sourceType}</td><td><b>{row.sourceName}</b></td><td><b>{row.activityData}</b></td><td><b>{factorSummary(row)}</b></td><td><b>{format(row.emissionAmount)}</b></td>
            </tr>)}</tbody>
          </table></div>
        </div>;
      })}
      {!sources.length && <div className={styles.emptyRow}>该年度暂无可关联的能源消费记录，未生成草稿清单。</div>}
    </div>
  </Dialog>;
}

function NewSourceDialog({ groups, close, save }: { groups: string[]; close: () => void; save: (input: Omit<EmissionSource, 'emissionSourceId'>) => void }) {
  const [group, setGroup] = useState(groups[0] ?? emissionCategoryDictionary[0]);
  const mappedTypes = emissionSourceMapping[group] ?? [];
  const [sourceType, setSourceType] = useState(mappedTypes[0]?.sourceType ?? '');
  const [sourceName, setSourceName] = useState('');
  const [customSourceName, setCustomSourceName] = useState('');
  const [activity, setActivity] = useState('');
  const [unit, setUnit] = useState('');
  const [factorId, setFactorId] = useState('pf-r134a');
  const [factorPickerOpen, setFactorPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const factor = getCarbonFactorV4(factorId) ?? getCarbonFactorV4('pf-r134a')!;
  const selectedType = mappedTypes.find((item) => item.sourceType === sourceType);
  const sourceOptions = selectedType?.sources ?? [];
  const customSource = sourceType === '其他/自定义' || sourceOptions.length === 0 || sourceName === '__custom__';
  const changeGroup = (value: string) => {
    const nextTypes = emissionSourceMapping[value] ?? [];
    setGroup(value);
    setSourceType(nextTypes[0]?.sourceType ?? '');
    setSourceName('');
    setCustomSourceName('');
  };
  const changeSourceType = (value: string) => { setSourceType(value); setSourceName(''); setCustomSourceName(''); };
  const changeSourceName = (value: string) => { setSourceName(value); if (value !== '__custom__') setCustomSourceName(''); };
  const submit = () => {
    const finalSourceName = sourceName === '__custom__' ? customSourceName : sourceName;
    if (!sourceType || !finalSourceName.trim() || !activity.trim() || !unit.trim()) {
      setError('请补齐排放源类型、排放源名称、活动数据值和单位后再保存');
      return;
    }
    setError('');
    save({ carbonTaskId: 'ct-2026', organizationBoundary: '企业法人边界', emissionCategory: group, emissionGroup: group, sourceType: sourceType || '人工新增排放源', sourceName: finalSourceName.trim(), greenhouseGasSpecies: ['CO₂e'], activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, activityDataSource: '核算清单·在线录入', factorName: factor.name, emissionFactorId: factor.factorId, recordGenerationType: 'manual', sourceModule: '核算清单—在线录入', sourceRecordId: `CARBON-2026-${Date.now()}`, factorObjectId: factor.factorId, factorVersionId: factor.version, createdBy: '管理员', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), recommendedActivityDataSources: ['企业报告（可选）'], confirmedActivityDataSources: [], customActivityDataSources: [], evidenceFiles: [], evidenceStatus: '待确认', emissionAmount: recalculate(Number(activity), unit, factor), entryMode: 'manual' });
  };
  return <><Dialog title="新增排放源" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={submit}>保存排放源</Button></>}><form className={styles.formGrid} onSubmit={(event: FormEvent) => { event.preventDefault(); submit(); }}>
    <div className={`${styles.infoBox} ${styles.fieldFull}`}><b>适用场景：补充系统未自动生成的排放源。</b><span>请依次选择排放类别、排放源类型和具体设施，填写活动数据，并关联对应的排放因子。能源消费、运营数据等模块已自动生成的排放源无需重复新增。</span></div>
    <Field label="排放类别 *"><select value={group} onChange={(event) => changeGroup(event.target.value)}>{groups.map((value) => <option key={value}>{value}</option>)}</select></Field>
    <Field label="温室气体源类型 *"><select value={sourceType} onChange={(event) => changeSourceType(event.target.value)}>{mappedTypes.map((item) => <option key={item.sourceType}>{item.sourceType}</option>)}<option value="其他/自定义">其他/自定义</option></select></Field>
    <Field label="排放源名称 *" full>{customSource ? <input required value={sourceName === '__custom__' ? customSourceName : sourceName} onChange={(event) => { setCustomSourceName(event.target.value); setSourceName('__custom__'); }} placeholder="请输入具体排放源名称" /> : <select required value={sourceName} onChange={(event) => changeSourceName(event.target.value)}><option value="">请选择设施/来源</option>{sourceOptions.map((value) => <option key={value}>{value}</option>)}<option value="__custom__">自定义排放源</option></select>}</Field>
    <Field label="活动数据值 *"><input required type="number" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field>
    <Field label="单位 *"><input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：kg、t、MWh" /></Field>
    <Field label="排放因子/参数" full><Button outline onClick={() => setFactorPickerOpen(true)}>从因子库选择</Button></Field>
    {error && <div className={`${styles.infoBox} ${styles.fieldFull}`}><span>{error}</span></div>}
    <button type="submit" className={styles.hiddenSubmit}>保存</button>
  </form></Dialog>{factorPickerOpen && <FactorSelectDialog row={{ emissionSourceId: 'new-source', emissionFactorId: factorId, sourceType }} factors={carbonFactorsV4} close={() => setFactorPickerOpen(false)} choose={(nextFactorId) => { setFactorId(nextFactorId); setFactorPickerOpen(false); }} onCreateFactor={(factor) => { saveCarbonFactorV4(factor); setFactorId(factor.factorId); setFactorPickerOpen(false); }} />}</>;
}

function LegacyNewSourceDialog({ groups, close, save }: { groups: string[]; close: () => void; save: (input: Omit<EmissionSource, 'emissionSourceId'>) => void }) {
  const [group, setGroup] = useState(groups[0]);
  const [sourceType, setSourceType] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [activity, setActivity] = useState('');
  const [unit, setUnit] = useState('');
  const factor = getCarbonFactorV4('pf-r134a')!;
  const submit = () => {
    if (!sourceName.trim() || !unit.trim()) return;
    save({ carbonTaskId: 'ct-2026', organizationBoundary: '企业法人边界', emissionCategory: group, emissionGroup: group, sourceType: sourceType || '人工新增排放源', sourceName: sourceName.trim(), greenhouseGasSpecies: ['CO₂e'], activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, activityDataSource: '核算清单·在线录入', factorName: factor.name, emissionFactorId: factor.factorId, recordGenerationType: 'manual', sourceModule: '核算清单—在线录入', sourceRecordId: `CARBON-2026-${Date.now()}`, factorObjectId: factor.factorId, factorVersionId: factor.version, createdBy: '管理员', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), recommendedActivityDataSources: ['企业报告（可选）'], confirmedActivityDataSources: [], customActivityDataSources: [], evidenceFiles: [], evidenceStatus: '待确认', emissionAmount: recalculate(Number(activity), unit, factor), entryMode: 'manual' });
  };
  return <Dialog title="新增排放源" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={submit}>保存排放源</Button></>}><form className={styles.formGrid} onSubmit={(event: FormEvent) => { event.preventDefault(); submit(); }}><div className={`${styles.infoBox} ${styles.fieldFull}`}><b>适用场景：补充系统未自动生成的排放源。</b><span>能源消费、运营数据等模块已自动生成的排放源无需重复新增。</span></div><Field label="排放类别 *"><select value={group} onChange={(event) => setGroup(event.target.value)}>{emissionCategoryDictionary.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="温室气体源类型 *"><input value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="例如：制冷剂逸散源" /></Field><Field label="排放源名称 *" full><input required value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="请输入排放源名称" /></Field><Field label="活动数据值 *"><input required type="number" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位 *"><input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：kg、t、MWh" /></Field><Field label="排放因子/参数" full><Button outline>从因子库选择</Button></Field><button type="submit" className={styles.hiddenSubmit}>保存</button></form></Dialog>;
}

function ConfirmSnapshot({ title, previousVersion, version, baseline, inventory, close, confirm }: { title: string; previousVersion: number; version: number; baseline: EmissionSource[]; inventory: EmissionSource[]; close: () => void; confirm: () => void }) {
  const baselineById = new Map(baseline.map((row) => [row.emissionSourceId, row]));
  const inventoryById = new Map(inventory.map((row) => [row.emissionSourceId, row]));
  const added = inventory.filter((row) => !baselineById.has(row.emissionSourceId)).length;
  const modified = inventory.filter((row) => { const before = baselineById.get(row.emissionSourceId); return before ? changed(before, row) : false; }).length;
  const deleted = baseline.filter((row) => !inventoryById.has(row.emissionSourceId)).length;
  const previousTotal = baseline.reduce((sum, row) => sum + row.emissionAmount, 0);
  const total = inventory.reduce((sum, row) => sum + row.emissionAmount, 0);
  const delta = total - previousTotal;
  const hasChanges = version === 1 || added > 0 || modified > 0 || deleted > 0;
  const changeSummary = version > 1 ? `${added} 项新增 · ${modified} 项修改 · ${deleted} 项删除` : `共 ${inventory.length} 个排放源`;
  const deltaText = `${delta >= 0 ? '+' : ''}${format(delta)} tCO₂e`;

  return <Dialog title={title} onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={confirm}>{version === 1 ? '确认生成' : '确认更新'}</Button></>}>
    <div className={styles.confirmLead}>
      <strong>{version === 1 ? '确认生成首个正式核算清单？' : '确认用本次修改更新正式核算清单？'}</strong>
      <span>{version === 1 ? `系统将保存当前 ${inventory.length} 个排放源及其核算结果。` : hasChanges ? '系统将以当前编辑副本生成新的正式版本。' : '当前没有检测到排放源数据变化。'}</span>
    </div>
    <div className={styles.confirmSummary}>
      <div><span>更新后状态</span><b>当前正式清单</b></div>
      <div><span>{version === 1 ? '排放源数量' : '本次变更'}</span><b>{changeSummary}</b></div>
      <div><span>{version === 1 ? '排放总量' : '排放量变化'}</span><b>{version === 1 ? `${format(total)} tCO₂e` : deltaText}</b></div>
    </div>
    {version > 1 && hasChanges && <div className={styles.confirmChangeHint}>发布后将同步更新碳排放预览、核查支撑清单及导出数据，历史正式版本将保留。</div>}
    {version > 1 && !hasChanges && <div className={styles.confirmNoChanges}>当前没有检测到排放源数据变化，确认后仍将保存本次更新记录。</div>}
  </Dialog>;
}

function ChangeDrawer({ baseline, draft, version, close }: { baseline: EmissionSource[]; draft: EmissionSource[]; version: number; close: () => void }) {
  const baselineById = new Map(baseline.map((row) => [row.emissionSourceId, row]));
  const draftById = new Map(draft.map((row) => [row.emissionSourceId, row]));
  const rows = [
    ...draft.filter((row) => !baselineById.has(row.emissionSourceId)).map((row) => ({ type: '新增', name: row.sourceName, before: '—', after: format(row.emissionAmount) })),
    ...draft.filter((row) => { const before = baselineById.get(row.emissionSourceId); return before ? changed(before, row) : false; }).map((row) => ({ type: '修改', name: row.sourceName, before: format(baselineById.get(row.emissionSourceId)!.emissionAmount), after: format(row.emissionAmount) })),
    ...baseline.filter((row) => !draftById.has(row.emissionSourceId)).map((row) => ({ type: '删除', name: row.sourceName, before: format(row.emissionAmount), after: '—' })),
  ];
  const totalBefore = baseline.reduce((sum, row) => sum + row.emissionAmount, 0);
  const totalAfter = draft.reduce((sum, row) => sum + row.emissionAmount, 0);
  return <Drawer title="本次修改详情" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.calcSummary}><div><span>当前基准</span><b>当前正式清单</b></div><div><span>排放总量变化</span><b>{totalAfter - totalBefore >= 0 ? '+' : ''}{format(totalAfter - totalBefore)} tCO₂e</b></div><div><span>变更记录</span><b>{rows.length} 项</b></div></div><DetailBlock title="具体变更记录"><table className={styles.changeTable}><thead><tr><th>变更类型</th><th>排放源</th><th>变更前排放量</th><th>变更后排放量</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.type}-${row.name}-${index}`}><td>{row.type}</td><td>{row.name}</td><td>{row.before === '—' ? row.before : `${row.before} tCO₂e`}</td><td>{row.after === '—' ? row.after : `${row.after} tCO₂e`}</td></tr>) : <tr><td colSpan={4} className={styles.emptyRow}>当前编辑副本暂无变更</td></tr>}</tbody></table></DetailBlock></Drawer>;
}

function FactorSelectDialog({ row, factors, close, choose, onCreateFactor }: { row: Pick<EmissionSource, 'emissionSourceId' | 'emissionFactorId' | 'sourceType'>; factors: CarbonFactor[]; close: () => void; choose: (factorId: string) => void; onCreateFactor: (factor: CarbonFactor) => void }) {
  const current = getCarbonFactorV4(row.emissionFactorId);
  const candidates = factors
    .filter((factor) => factor.validity === '当前有效' && factor.selectable && (row.emissionSourceId === 'new-source' || factor.activity === current?.activity || factor.activity === row.sourceType || (row.emissionSourceId === 'es-clinker' && factor.activity === '工业过程')))
    .sort((left, right) => {
      const order = ['pf-ng', 'ef-ng', 'pf-coal'];
      return (order.indexOf(left.factorId) < 0 ? 99 : order.indexOf(left.factorId)) - (order.indexOf(right.factorId) < 0 ? 99 : order.indexOf(right.factorId));
    });
  const [selected, setSelected] = useState(row.emissionFactorId);
  const [keyword, setKeyword] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [customError, setCustomError] = useState('');
  const visible = candidates.filter((factor) => !keyword || [factor.name, factor.source, factor.objectType].some((value) => value.includes(keyword)));
  const saveCustom = () => {
    const numericValue = Number(customValue);
    if (!customName.trim() || !customUnit.trim() || !customSource.trim() || !Number.isFinite(numericValue)) {
      setCustomError('请补齐因子名称、因子值、单位和来源依据');
      return;
    }
    setCustomError('');
    const factor: CarbonFactor = {
      factorId: `custom-${Date.now()}`,
      scope: 'enterprise',
      name: customName.trim(),
      objectType: '综合排放因子',
      activity: current?.activity ?? row.sourceType,
      gas: 'CO₂e',
      value: String(numericValue),
      unit: customUnit.trim(),
      source: '企业自定义',
      version: '2026年度',
      geo: '当前企业',
      industry: '通用工业',
      validity: '当前有效',
      raw: `${numericValue} ${customUnit.trim()}`,
      quality: '企业配置',
      effective: '2026年度',
      reference: customSource.trim(),
      selectable: true,
      calculationType: 'direct',
      approval: '待审核',
    };
    onCreateFactor(factor);
  };
  return <Dialog title={customOpen ? '新增自定义因子' : '选择排放因子/参数组'} wide onClose={close} footer={<><Button onClick={() => customOpen ? setCustomOpen(false) : close()}>{customOpen ? '返回因子列表' : '取消'}</Button>{!customOpen && <Button primary disabled={!selected} onClick={() => choose(selected)}>确认选择</Button>}{customOpen && <Button primary onClick={saveCustom}>保存并应用自定义因子</Button>}</>}>
    {!customOpen ? <><div className={styles.infoBox}>系统根据排放活动、行业、地理范围和核算年度筛选可用的综合因子或参数组。基础参数和方法学常数在参数组内引用，不作为独立计算方法选择。</div><div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索候选因子或参数组" /></div><div className={styles.factorChoices}>{visible.map((factor) => <label key={factor.factorId} className={selected === factor.factorId ? styles.selectedChoice : ''}><input type="radio" checked={selected === factor.factorId} onChange={() => setSelected(factor.factorId)} /><span><b>{factor.name}　<Tag tone={factor.scope === 'enterprise' ? 'orange' : 'blue'}>{factor.scope === 'enterprise' ? '企业数据' : '公共数据'}</Tag></b><small>{factor.objectType}｜{factor.value} {factor.unit === '参数组' ? '' : factor.unit}｜{factor.source}｜{factor.version}</small></span><Tag>{factor.validity}</Tag></label>)}</div>{!visible.length && <div className={styles.emptyRow}>暂无匹配的排放因子或参数组。</div>}<div className={styles.factorPickerActions}><span><b>未找到适用因子？</b>可录入当前企业的实测或供应商因子，并填写可核验依据。</span><Button outline onClick={() => { setCustomError(''); setCustomOpen(true); }}>新增自定义因子</Button></div></> : <><div className={styles.customFactorBack}><Button outline compact onClick={() => setCustomOpen(false)}>← 返回因子列表</Button></div><div className={`${styles.infoBox} ${styles.customFactorHint}`}>自定义因子仅适用于当前企业。请填写可核验的因子值、单位和来源依据，保存后将立即用于当前排放源计算。</div><div className={styles.formGrid}><Field label="因子名称 *" full><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="例如：企业实测天然气排放因子" /></Field><Field label="因子值 *"><input type="number" step="any" value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="例如：2.154" /></Field><Field label="单位 *"><input value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="例如：kgCO₂/Nm³" /></Field><Field label="来源及依据 *" full><input value={customSource} onChange={(event) => setCustomSource(event.target.value)} placeholder="例如：检测报告编号或供应商证明" /></Field>{customError && <div className={`${styles.infoBox} ${styles.fieldFull}`}><span>{customError}</span></div>}</div></>}
  </Dialog>;
}

function EnterpriseFactorDialog({ close, save }: { close: () => void; save: (factor: CarbonFactor) => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  return <Dialog title="新增企业因子/参数" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={() => { if (!name.trim() || !source.trim()) return; save({ factorId: `ef-${Date.now()}`, scope: 'enterprise', name, objectType: '综合排放因子', activity: '固定燃烧', gas: 'CO₂', value, unit, source: '企业自定义', version: '2026年度', geo: '当前企业', industry: '通用工业', validity: '当前有效', raw: `${value} ${unit}`, quality: '企业配置', effective: '2026年度', reference: source, selectable: true, calculationType: 'direct', approval: '待审核' }); }}>保存企业数据</Button></>}><div className={styles.infoBox}>企业数据仅适用于当前组织。建议优先录入可验证的单项实测参数；系统可将企业参数与公共缺省参数组合为计算参数组。</div><div className={styles.formGrid}><Field label="对象名称 *"><input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="对象类型 *"><select><option>综合排放因子</option><option>基础核算参数</option><option>参数组/公式模板</option></select></Field><Field label="排放活动 *"><select><option>固定燃烧</option><option>购入电力</option><option>工业过程</option></select></Field><Field label="温室气体"><select><option>CO₂</option><option>CO₂e</option><option>CH₄</option></select></Field><Field label="数值/参数摘要 *"><input value={value} onChange={(event) => setValue(event.target.value)} /></Field><Field label="单位 *"><input value={unit} onChange={(event) => setUnit(event.target.value)} /></Field><Field label="适用年度 *"><input value="2026年度" readOnly /></Field><Field label="取值方式 *"><select><option>多批次加权平均</option><option>单次检测值</option><option>供应商提供值</option></select></Field><Field label="来源及依据材料 *" full><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="例如：检测报告编号、台账或供应商证明" /></Field></div></Dialog>;
}

function SupportDrawer({ state, close, manage, save }: { state: Extract<DrawerState, { kind: 'support' }>; close: () => void; manage: () => void; save: (item: SupportItem) => void }) {
  const item = state.item;
  const source = item.emission;
  const [confirmed, setConfirmed] = useState(source?.confirmedActivityDataSources ?? []);
  const [customSource, setCustomSource] = useState('');
  const [customSources, setCustomSources] = useState(source?.customActivityDataSources ?? []);
  const [files, setFiles] = useState(source?.evidenceFiles ?? item.evidenceFiles ?? []);
  const [remark, setRemark] = useState(source?.supportRemark ?? item.supportRemark ?? '');
  const sources = source ? [...source.recommendedActivityDataSources, ...customSources] : [];
  const submit = () => source
    ? save({ ...item, emission: { ...source, confirmedActivityDataSources: confirmed, customActivityDataSources: customSources, evidenceFiles: files, evidenceStatus: confirmed.length ? files.length ? '已完成' : '待补充' : '待确认', supportRemark: remark } })
    : save({ ...item, evidenceFiles: files, materials: files.length, state: files.length ? '已完成' : '待补充', supportRemark: remark });
  const fileSection = <DetailBlock title="支撑材料和备注">{files.map((file) => <div className={styles.fileRow} key={file.evidenceFileId}><i>FILE</i><span><b>{file.fileName}</b><small>关联来源：{file.activityDataSource}</small></span>{state.manage && <button type="button" className={styles.textButton} onClick={() => setFiles((items) => items.filter((current) => current.evidenceFileId !== file.evidenceFileId))}>删除</button>}</div>)}{state.manage && <><Button outline onClick={() => setFiles((items) => [...items, { evidenceFileId: `ev-${Date.now()}`, fileName: source ? '新增支撑凭证.pdf' : '新增基础材料.pdf', activityDataSource: source ? confirmed[0] ?? '未指定来源' : item.activityDataSources }])}>⇧ 上传文件</Button><p className={styles.note}>一期使用 Mock 文件；上传后可在当前页面删除或保留。</p></>}<textarea className={styles.textarea} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="填写数据口径、年度汇总方法、缺失月份处理或来源差异说明" readOnly={!state.manage} />{state.manage && source && <Button primary onClick={submit}>确认来源并保存</Button>}</DetailBlock>;
  if (!source) return <Drawer title={state.manage ? '基础材料管理' : '基础材料详情'} onClose={close} footer={<><Button onClick={close}>关闭</Button>{state.manage ? <Button primary onClick={submit}>保存支撑信息</Button> : <Button outline onClick={manage}>支撑管理</Button>}</>}><DetailBlock title={item.item}><div className={styles.kv}><span>核查事项</span><span>{item.group}</span><span>活动数据项</span><b>{item.activity}</b><span>活动数据来源</span><span>{item.activityDataSources}</span><span>材料数量</span><b>{files.length} 份</b></div></DetailBlock>{fileSection}</Drawer>;
  return <Drawer title={state.manage ? '支撑管理' : '支撑材料详情'} onClose={close} footer={<><Button onClick={close}>关闭</Button>{state.manage ? <Button primary onClick={submit}>保存支撑信息</Button> : <Button outline onClick={manage}>支撑管理</Button>}</>}><DetailBlock title="核算数据（只读）"><div className={styles.kv}><span>排放类别</span><b>{source.emissionCategory}</b><span>温室气体源类型</span><span>{source.sourceType}</span><span>排放源</span><span>{source.sourceName}</span><span>温室气体种类</span><span>{source.greenhouseGasSpecies.join('、')}</span><span>活动数据</span><b>{source.activityData}</b><span>清单状态</span><span>当前正式清单</span></div></DetailBlock><DetailBlock title="活动数据来源"><p className={styles.note}>系统已根据排放源类型推荐活动数据来源，请结合企业实际台账和凭证确认。</p>{sources.map((value) => <label className={styles.sourceChoice} key={value}><input type="checkbox" checked={confirmed.includes(value)} onChange={() => setConfirmed((items) => items.includes(value) ? items.filter((current) => current !== value) : [...items, value])} disabled={!state.manage} />{value}{state.manage && customSources.includes(value) && <button type="button" onClick={() => { setCustomSources((items) => items.filter((current) => current !== value)); setConfirmed((items) => items.filter((current) => current !== value)); }}>删除</button>}</label>)}{state.manage && <div className={styles.customSource}><input value={customSource} onChange={(event) => setCustomSource(event.target.value)} placeholder="添加自定义活动数据来源" /><Button compact onClick={() => { if (customSource.trim() && !sources.includes(customSource.trim())) { setCustomSources((items) => [...items, customSource.trim()]); setCustomSource(''); } }}>添加</Button></div>}</DetailBlock>{fileSection}</Drawer>;
}

function FactorDrawer({ factor, close }: { factor: CarbonFactor; close: () => void }) {
  return <Drawer title="因子/参数详情" onClose={close} footer={<Button onClick={close}>关闭</Button>}><DetailBlock title="基础信息"><div className={styles.kv}><span>对象名称</span><b>{factor.name}</b><span>对象类型</span><span className={styles.objectTag}>{factor.objectType}</span><span>编码</span><span>{factor.factorId}</span><span>排放活动</span><span>{factor.activity}</span><span>温室气体</span><span>{factor.gas}</span><span>当前值/摘要</span><b>{factor.value} {factor.unit === '参数组' ? '' : factor.unit}</b><span>有效状态</span><Tag>{factor.validity}</Tag></div></DetailBlock>{factor.parameters?.length && <><DetailBlock title="参数组成"><table className={styles.parameterTable}><thead><tr><th>参数及来源</th><th>数值</th><th>单位</th></tr></thead><tbody>{factor.parameters.map((parameter) => <tr key={parameter.key}><td><b>{parameter.name}</b><small>{parameter.sourceType} · {parameter.source}</small></td><td><b>{parameter.display}</b></td><td>{parameter.unit}</td></tr>)}</tbody></table></DetailBlock><DetailBlock title="公式模板"><div className={styles.formulaBox}>{factor.formula}</div></DetailBlock></>}<DetailBlock title="权威来源与版本"><div className={styles.sourceCard}><span>来源机构/文件</span><b>{factor.source}</b><span>版本</span><span>{factor.version}</span><span>原始值/结构</span><span>{factor.raw}</span><span>分类或条款</span><span>{factor.reference}</span><span>适用期</span><span>{factor.effective}</span></div></DetailBlock><DetailBlock title="适用性与数据质量"><div className={styles.sourceCard}><span>地理代表性</span><span>{factor.geo}</span><span>行业代表性</span><span>{factor.industry}</span><span>技术/活动</span><span>{factor.activity}</span><span>数据质量</span><span>{factor.quality}</span></div></DetailBlock></Drawer>;
}

function HistoryDrawer({ history, close }: { history: { version: number; time: string; total: number; count: number }[]; close: () => void }) {
  return <Drawer title="核算清单更新记录" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.infoBox}>页面仅展示当前状态和变更摘要；系统后台保留完整的更新记录和数据快照。</div><div className={styles.versionList}>{history.length ? history.map((item, index) => <div className={index === 0 ? styles.currentVersion : ''} key={item.version}><strong>正式清单</strong><span><b>{index === 0 ? '当前正式清单' : '历史正式清单'}</b><small>确认时间：{item.time}｜确认人：管理员</small><small>排放源 {item.count} 项｜排放总量 {format(item.total)} tCO₂e</small></span><Tag tone={index === 0 ? 'green' : 'gray'}>{index === 0 ? '当前' : '历史'}</Tag></div>) : <p className={styles.note}>尚未生成正式清单。</p>}</div></Drawer>;
}
