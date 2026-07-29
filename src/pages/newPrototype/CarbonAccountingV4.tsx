/* eslint-disable no-irregular-whitespace */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  carbonFactorsV4,
  getCarbonFactorV4,
  supportBasicV4,
  type CarbonFactor,
  type CarbonFactorParameter,
} from '../../mocks/carbonAccountingV4Mock';
import {
  deleteEmissionSource,
  listEmissionSources,
  publishCarbonSnapshot,
  replaceEmissionSourcesForTask,
  saveEmissionSource,
} from '../../mocks/platformMockStore';
import type { EmissionSource } from '../../types/platformDomain';
import styles from './CarbonAccountingV4.module.css';

type TaskState = 'draft' | 'confirmed' | 'pending';
type SourceMode = 'view' | 'edit';
type SupportItem = {
  group: string;
  type?: string;
  item: string;
  activity: string;
  origin: string;
  materials: number;
  state: '已上传' | '待补充';
};
type DialogState =
  | { kind: 'settings' | 'task' | 'newSource' | 'enterpriseFactor' | 'importFactor' }
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

const numberFromActivity = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;
const unitFromActivity = (value: string) =>
  value.match(/(Nm³|MWh|GJ|kg|t·km|t)$/)?.[1] ?? 't';

const resultCategory = (group: string) => {
  if (group === '购入电力与热力产生的排放') return 'purchased';
  if (group === '其他间接排放') return 'other';
  return 'direct';
};

type ValidationIssue = { emissionSourceId: string; message: string };

const validateInventory = (inventory: EmissionSource[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  inventory.forEach((row) => {
    const unit = row.activityData.match(/(Nm³|MWh|GJ|kg|t·km|t)$/)?.[1];
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
  if (!factor) return row.factorName;
  if (factor.calculationType === 'processParameter') return `参数化计算（${factor.parameters?.length ?? 0}项）`;
  return `${factor.value} ${factor.unit}`;
};

const recalculate = (activity: number, unit: string, factor: CarbonFactor) => {
  if (factor.calculationType === 'fuelParameter') {
    const composite = Number(factor.value.match(/[\d.]+/)?.[0] ?? 0);
    return factor.unit.startsWith('kg') ? activity * composite / 1000 : activity * composite;
  }
  if (factor.factorId === 'pf-process') return activity * 0.92 * 0.478 * 0.998;
  const factorValue = Number(factor.value);
  if (!Number.isFinite(factorValue)) return 0;
  return factor.unit.startsWith('kg') ? activity * factorValue / 1000 : activity * factorValue;
};

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
      <span>{state === 'draft' ? '尚未生成正式清单' : `正式清单版本：V${version}`}</span>
    </div>
  );
}

function Preview({
  inventory,
  state,
  version,
  confirmedAt,
  openSettings,
  exportInventory,
}: {
  inventory: EmissionSource[];
  state: TaskState;
  version: number;
  confirmedAt?: string;
  openSettings: () => void;
  exportInventory: () => void;
}) {
  const navigate = useNavigate();
  const total = inventory.reduce((sum, row) => sum + row.emissionAmount, 0);
  const direct = inventory.filter((row) => resultCategory(row.emissionGroup) === 'direct').reduce((sum, row) => sum + row.emissionAmount, 0);
  const purchased = inventory.filter((row) => resultCategory(row.emissionGroup) === 'purchased').reduce((sum, row) => sum + row.emissionAmount, 0);
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
  const snapshotRows = [...new Set(inventory.map((row) => row.emissionGroup))].map((group) => {
    const rows = inventory.filter((row) => row.emissionGroup === group);
    const emission = rows.reduce((sum, row) => sum + row.emissionAmount, 0);
    const category = resultCategory(group);
    const boundaryName = category === 'direct' ? '直接排放' : category === 'purchased' ? '间接排放' : '其他间接排放';
    const sourceCategory = ({
      '化石燃料燃烧排放': '化石燃料燃烧',
      '生产过程排放': '生产过程排放',
      '废弃物处理处置排放': '废弃物处理处置',
      '逸散排放': '逸散排放',
      '购入电力与热力产生的排放': '购入电力与热力',
      '其他间接排放': '运输等其他排放',
    } as Record<string, string>)[group] ?? group;
    const complete = rows.every((row) => Boolean(row.activityData && row.emissionFactorId) && Number.isFinite(row.emissionAmount));
    return { group, boundaryName, sourceCategory, count: rows.length, emission, complete };
  });
  const isFormal = state === 'confirmed';
  const snapshotTitle = isFormal || state === 'pending' ? '本次核算清单快照' : '当前草稿清单摘要';
  const snapshotDescription = isFormal
    ? `正式清单 V${version} · 确认人：管理员${confirmedAt ? ` · 确认时间：${confirmedAt}` : ''}`
    : state === 'pending'
      ? `正式清单 V${version} · 当前存在尚未确认的清单修改，本页仍展示正式版本结果。`
      : '当前结果基于草稿核算清单实时汇总，尚未形成正式核算结果。';
  const resultDescription = isFormal
    ? `结果读取正式清单 V${version} 冻结快照${confirmedAt ? ` · 确认人：管理员 · 确认时间：${confirmedAt}` : ''}`
    : state === 'pending'
      ? `数据来源：正式核算清单 V${version}；当前存在尚未确认的清单修改`
      : '当前结果基于草稿核算清单实时汇总，尚未形成正式核算结果。';

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.previewTask}`}>
        <div>
          <div className={styles.taskLine}>
            <b>当前核算任务：</b><span>2026年度组织温室气体核算</span>
            <Tag>通用工业企业</Tag><Tag>GB/T 32150—2025</Tag><Tag>企业法人边界</Tag>
            <Tag tone={state === 'confirmed' ? 'green' : state === 'pending' ? 'orange' : 'orange'}>
              {state === 'draft' ? '草稿结果' : state === 'confirmed' ? `正式结果 V${version}` : `编辑副本（正式版V${version}）`}
            </Tag>
          </div>
          <div className={styles.meta}><span>核算组织：XX科技有限公司</span><i /><span>核算范围：全部组织与设施</span><i /><span>{resultDescription}</span></div>
        </div>
        <Button outline onClick={openSettings}>⚙ 核算设置</Button>
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
          <p className={styles.note}>结果类别由核算清单分组映射汇总；分项合计与总量保持同一数据源。</p>
        </section>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <h3>排放趋势（近5年）</h3><small>单位：tCO₂e</small>
          <div className={styles.barChart}>{trend.map((value, index) => <div key={value}><span>{format(value)}</span><i className={index === 4 ? styles.barCurrent : ''} style={{ height: `${value / trendMax * 100}%` }} /><small>{2022 + index}年</small></div>)}</div>
        </section>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <h3>主要排放源排行</h3><small>单位：tCO₂e</small>
          <table className={styles.rankTable}><thead><tr><th>排名</th><th>排放源</th><th>排放量</th><th>占比</th></tr></thead><tbody>
            {ranked.map((row, index) => <tr key={row.emissionSourceId}><td>{['🥇', '🥈', '🥉', '4', '5'][index]}</td><td>{row.sourceName.replace(/（.*?）/, '')}</td><td>{format(row.emissionAmount)}</td><td>{format(row.emissionAmount / total * 100)}%</td></tr>)}
            <tr><td colSpan={2}><b>合计</b></td><td><b>{format(total)}</b></td><td><b>100.00%</b></td></tr>
          </tbody></table>
        </section>
      </div>

      <section className={`${styles.card} ${styles.snapshotCard}`}>
        <header className={styles.snapshotHeader}>
          <div><h3>{snapshotTitle}</h3><p>{snapshotDescription}</p></div>
          <span>{inventory.length} 项排放源</span>
        </header>
        <table className={styles.snapshotTable}>
          <colgroup><col style={{ width: '14%' }} /><col style={{ width: '28%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /></colgroup>
          <thead><tr><th>核算边界</th><th>排放源类别</th><th>排放源数量</th><th>排放量</th><th>占比</th><th>数据状态</th></tr></thead>
          <tbody>{snapshotRows.map((row) => <tr key={row.group}><td>{row.boundaryName}</td><td>{row.sourceCategory}</td><td>{row.count} 项</td><td>{format(row.emission)} tCO₂e</td><td>{format(row.emission / total * 100)}%</td><td><span className={row.complete ? styles.snapshotComplete : styles.snapshotPending}>{row.complete ? '完整' : '待完善'}</span></td></tr>)}</tbody>
        </table>
        <footer className={styles.snapshotActions}>
          {isFormal ? <><Button outline compact onClick={() => navigate('/carbon-accounting/inventory')}>查看正式核算清单</Button><Button primary compact onClick={exportInventory}>导出核算清单</Button></> : <Button outline compact onClick={() => navigate('/carbon-accounting/inventory')}>返回核算清单继续完善</Button>}
        </footer>
      </section>
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
  const groups = [...new Set(inventory.map((row) => row.emissionGroup))];
  const filtered = inventory.filter((row) => {
    const matchKeyword = !keyword || [row.sourceName, row.sourceType, row.factorName, factorSummary(row)].some((text) => text.includes(keyword));
    return matchKeyword && (!boundary || row.emissionGroup === boundary);
  });
  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.inventoryTask}`}>
        <div className={styles.taskLeft}><div className={styles.taskIcon}>▣</div><div>
          <div className={styles.taskLine}><b>当前核算任务：</b><select><option>2026年度组织温室气体核算</option><option>2025年度组织温室气体核算</option></select>
            <Tag tone={taskState === 'confirmed' ? 'green' : 'orange'}>{taskState === 'draft' ? '草稿' : taskState === 'confirmed' ? '正式版' : '待确认更新'}</Tag>
          </div>
          <TaskMeta state={taskState} version={version} />
        </div></div>
        <div className={styles.taskActions}>
          {taskState === 'draft' && <><span className={styles.autosave}>草稿已自动保存</span><Button outline onClick={() => openDialog({ kind: 'task' })}>⊕ 新建任务</Button><Button primary onClick={confirmSnapshot}>确认并生成正式清单</Button></>}
          {taskState === 'confirmed' && <><Button outline onClick={exportInventory}>导出</Button><Button primary onClick={startUpdate}>发起修订</Button></>}
          {taskState === 'pending' && <><span className={styles.autosave}>已自动保存至编辑副本</span><Button onClick={() => openDialog({ kind: 'cancelUpdate' })}>取消本次修改</Button><Button primary onClick={confirmUpdate}>确认并更新正式清单</Button></>}
        </div>
      </section>
      {taskState === 'pending' && <div className={styles.syncBanner}><span>当前存在未确认的修改。碳排放预览、核查支撑清单及导出仍使用正式清单 V{version}。</span><button type="button" onClick={showChanges}>查看本次修改</button></div>}
      <section className={`${styles.card} ${styles.filterbar}`}>
        <div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索排放源、因子或参数" /></div>
        <label>核算边界<select value={boundary} onChange={(event) => setBoundary(event.target.value)}><option value="">全部</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
        <span />
        <Button primary disabled={taskState === 'confirmed'} onClick={() => openDialog({ kind: 'newSource' })}>⊕ 新增排放源</Button>
      </section>
      <section className={`${styles.card} ${styles.inventoryShell}`}>
        {groups.map((group) => {
          if (boundary && group !== boundary) return null;
          const rows = filtered.filter((row) => row.emissionGroup === group);
          if (keyword && !rows.length) return null;
          return <div className={styles.groupCard} key={group}>
            <button type="button" className={styles.groupHead} onClick={() => toggleGroup(group)}>
              <span>{collapsed.has(group) ? '›' : '⌄'}</span><b>{group}</b><em>（{inventory.filter((row) => row.emissionGroup === group).length}）</em>
              <strong>小计 {format(rows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong>
            </button>
            {!collapsed.has(group) && <div className={styles.groupTableWrap}><table className={styles.groupTable}>
              <colgroup><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '25%' }} /><col style={{ width: '11%' }} /><col style={{ width: '12%' }} /></colgroup>
              <thead><tr><th>温室气体源类型</th><th>排放源</th><th>活动数据</th><th>排放因子/计算参数</th><th>排放量（tCO₂e）</th><th>操作</th></tr></thead>
              <tbody>{rows.length ? rows.map((row) => <tr key={row.emissionSourceId} className={invalidSourceIds.has(row.emissionSourceId) ? styles.invalidRow : ''}>
                <td className={styles.sourceTypeCell} data-column="source-type">{row.sourceType}</td>
                <td className={styles.sourceCell} data-column="source"><b>{row.sourceName}</b><small>{row.entryMode === 'manual' ? '人工新增' : '系统生成'}</small></td>
                <td className={styles.activityCell} data-column="activity"><b>{row.activityData}</b><small>{row.activityDataSource}</small></td>
                <td className={styles.factorCell} data-column="factor"><b>{factorSummary(row)}</b><small>{row.factorName}</small></td>
                <td className={styles.emissionCell} data-column="emission"><b>{format(row.emissionAmount)}</b></td>
                <td className={styles.rowActions} data-column="actions"><button type="button" onClick={() => openSource(row, 'view')}>查看</button>{taskState !== 'confirmed' && <><button type="button" onClick={() => openSource(row, 'edit')}>编辑</button><button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSource', row })}>删除</button></>}</td>
              </tr>) : <tr><td colSpan={6} className={styles.emptyRow}>暂无排放源</td></tr>}</tbody>
            </table></div>}
          </div>;
        })}
      </section>
    </div>
  );
}

function SupportPage({
  inventory,
  openDrawer,
}: {
  inventory: EmissionSource[];
  openDrawer: (drawer: DrawerState) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'basic' | 'source'>('basic');
  const [keyword, setKeyword] = useState('');
  const [state, setState] = useState('');
  const sourceRows: SupportItem[] = inventory.map((row) => ({
    group: row.emissionGroup,
    type: row.sourceType,
    item: row.sourceName,
    activity: row.activityData,
    origin: row.activityDataSource,
    materials: row.emissionSourceId === 'es-electricity' ? 12 : row.entryMode === 'manual' ? 1 : 2,
    state: row.emissionSourceId === 'es-r134a' ? '待补充' : '已上传',
  }));
  const data: SupportItem[] = tab === 'basic' ? supportBasicV4 : sourceRows;
  const filtered = data.filter((item) => (!keyword || [item.item, item.group, item.activity].some((text) => text.includes(keyword))) && (!state || item.state === state));
  const groups = [...new Set(filtered.map((item) => item.group))];
  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.supportHead}`}><div><div className={styles.taskLine}><b>当前核算任务：</b><strong>2026年度组织温室气体核算</strong><Tag tone="blue">通用工业企业</Tag></div><div className={styles.supportMeta}><span>核算组织：XX科技有限公司</span><span>核算周期：2026-01-01 ~ 2026-12-31</span><span>依据标准：GB/T 32150—2025</span></div></div><Button outline onClick={() => navigate('/carbon-accounting/inventory')}>← 返回核算清单</Button></section>
      <section className={`${styles.card} ${styles.supportPanel}`}>
        <div className={styles.tabs}><button className={tab === 'basic' ? styles.activeTab : ''} onClick={() => setTab('basic')}>核算基础材料</button><button className={tab === 'source' ? styles.activeTab : ''} onClick={() => setTab('source')}>排放源支撑材料</button></div>
        <div className={styles.supportInfo}>{tab === 'source' ? '说明：排放源支撑清单由碳核算清单自动生成，活动数据、因子引用及来源保持只读；用户仅维护支撑材料和备注。' : '说明：基础材料用于证明核算主体、组织边界、核算方法和数据质量制度。主体信息来自核算任务创建时保存的组织档案快照。'}</div>
        <div className={styles.supportToolbar}><div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索核查事项、排放源或材料名称" /></div><label>状态<select value={state} onChange={(event) => setState(event.target.value)}><option value="">全部</option><option>已上传</option><option>待补充</option></select></label></div>
        <div className={styles.supportTableWrap}><table className={styles.supportTable} data-support-table>
          <colgroup>{tab === 'source' ? <><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '7%' }} /><col style={{ width: '6%' }} /><col style={{ width: '9%' }} /></> : <><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '26%' }} /><col style={{ width: '16%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} /></>}</colgroup>
          <thead><tr>{tab === 'source' ? <><th>核算边界</th><th>温室气体源类型</th></> : <th>核查事项</th>}<th>排放源/材料事项</th><th>活动数据项</th><th>活动数据来源</th><th>支撑材料</th><th>状态</th><th>操作</th></tr></thead><tbody>
          {groups.flatMap((group) => [
            <tr className={styles.supportGroup} key={`${group}-head`}><td colSpan={tab === 'source' ? 8 : 7}><div className={styles.supportGroupTitle} data-group-title={group}><span aria-hidden="true">⌄</span><b>{group}</b></div></td></tr>,
            ...filtered.filter((item) => item.group === group).map((item) => <tr key={`${group}-${item.item}`}>{tab === 'source' ? <><td>{item.group}</td><td>{item.type}</td></> : <td>{item.group}</td>}<td>{item.item}</td><td>{item.activity}</td><td>{item.origin}</td><td><span className={styles.blueText}>{item.materials} 份</span></td><td><Tag tone={item.state === '已上传' ? 'green' : 'orange'}>{item.state}</Tag></td><td className={styles.rowActions}><button onClick={() => openDrawer({ kind: 'support', item, manage: false })}>查看</button><button onClick={() => openDrawer({ kind: 'support', item, manage: true })}>材料管理</button></td></tr>),
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
  const factor = getCarbonFactorV4(state.factorId ?? row.emissionFactorId) ?? getCarbonFactorV4('pf-ng')!;
  const unit = unitFromActivity(row.activityData);
  const readOnly = state.mode === 'view';
  const system = row.entryMode === 'system';
  const result = recalculate(Number(activity), unit, factor);
  const submit = () => save({ ...row, factorName: factor.name, emissionFactorId: factor.factorId, activityData: `${row.emissionSourceId === 'es-clinker' ? '原料消耗量：' : ''}${Number(activity).toLocaleString('zh-CN')} ${unit}`, emissionAmount: result }, row.emissionSourceId);
  return (
    <Drawer title={readOnly ? '排放源详情' : '编辑排放源'} onClose={close} footer={<><Button onClick={close}>{readOnly ? '关闭' : '取消'}</Button>{readOnly && allowEdit ? <Button primary onClick={() => save(row, row.emissionSourceId)}>编辑</Button> : !readOnly ? <Button primary onClick={submit}>保存并重新计算</Button> : null}</>}>
      <DetailBlock title="基本信息"><div className={styles.kv}><span>核算边界</span><b>{row.emissionGroup}</b><span>温室气体源类型</span><span>{row.sourceType}</span><span>排放源</span><span>{row.sourceName}</span><span>记录来源</span><span>{row.entryMode === 'manual' ? '人工新增' : '系统自动生成'}</span></div></DetailBlock>
      <DetailBlock title="核算摘要"><div className={styles.calcSummary}><div><span>活动数据</span><b>{row.activityData}</b></div><div><span>计算因子/参数</span><b>{factorSummary(row, factor.factorId)}</b></div><div><span>排放量</span><b>{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div></div></DetailBlock>
      <DetailBlock title="活动数据">{readOnly || system ? <><div className={styles.kv}><span>活动数据</span><b>{row.activityData}</b><span>数据来源</span><span>{row.activityDataSource}</span></div>{!readOnly && system && <div className={styles.infoBox}>该数据由数据管理模块自动关联，在核算清单中保持只读。需要调整时，请返回源数据页面修改。</div>}</> : <div className={styles.formGrid}><Field label="活动数据值"><input type="number" min="0" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位"><input value={unit} readOnly /></Field></div>}</DetailBlock>
      <DetailBlock title={factor.parameters?.length ? '计算因子拆解' : '计算因子说明'}>
        {factor.parameters?.length ? <table className={styles.parameterTable}><thead><tr><th>参数及来源</th><th>数值</th><th>单位</th></tr></thead><tbody>{calculationParameters(factor.factorId).map((parameter) => <tr key={parameter.key}><td><b>{parameter.name}</b><small>{parameter.sourceType} · {parameter.source}</small></td><td><b>{parameter.display}</b></td><td>{parameter.unit}</td></tr>)}</tbody></table> : <div className={styles.sourceCard}><span>因子名称</span><b>{factor.name}</b><span>因子值</span><b>{factor.value} {factor.unit}</b><span>来源与版本</span><span>{factor.source} · {factor.version}</span></div>}
        {!readOnly && <Button outline compact onClick={() => chooseFactor(row)}>从因子与参数库重新选择</Button>}
      </DetailBlock>
      <DetailBlock title="计算公式"><div className={styles.formulaBox}>{factor.formula}<br /><b>当前结果：{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div><p className={styles.note}>正式清单确认时将保存公式版本、全部原始参数和折算结果快照。</p></DetailBlock>
      <DetailBlock title="来源与材料"><div className={styles.sourceCard}><span>活动数据来源</span><b>{row.activityDataSource}</b><span>因子/参数来源</span><span>{factor.source} · {factor.version}</span><span>支撑材料</span><span><Tag>已关联材料</Tag>　<button className={styles.textButton} onClick={goSupport}>前往核查支撑</button></span></div></DetailBlock>
    </Drawer>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailBlock}><h3>{title}</h3>{children}</section>;
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}><span>{label}</span>{children}</label>;
}

export function CarbonAccountingV4({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const page = pathname.split('/').pop();
  const [inventory, setInventory] = useState(() => listEmissionSources());
  // 演示任务已完成录入并确认，碳排放预览默认只读取正式清单快照。
  const [taskState, setTaskState] = useState<TaskState>('confirmed');
  const [version, setVersion] = useState(1);
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
  const [factors, setFactors] = useState<CarbonFactor[]>(() => carbonFactorsV4.map((factor) => ({ ...factor, parameters: factor.parameters?.map((parameter) => ({ ...parameter })) })));
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const officialInventory = taskState === 'pending' && baseline ? baseline : inventory;
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
    const displayVersion = version || 1;
    setVersion(displayVersion);
    setTaskState('confirmed');
    setInvalidSourceIds(new Set());
    setHistory((items) => [{ version: displayVersion, time: new Date().toLocaleString('zh-CN', { hour12: false }), total: snapshot.totalEmission, count: snapshot.sourceItems.length }, ...items]);
    setDialog(null);
    notify(`正式核算清单 V${displayVersion} 已生成`);
  };
  const completeUpdate = () => {
    const snapshot = publishCarbonSnapshot();
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
    anchor.download = `XX科技有限公司_2026年度碳核算清单_V${version}.csv`;
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
  if (page === 'preview') content = <Preview inventory={officialInventory} state={taskState} version={version} confirmedAt={history[0]?.time} openSettings={() => setDialog({ kind: 'settings' })} exportInventory={exportInventory} />;
  else if (page === 'inventory') content = <Inventory inventory={inventory} taskState={taskState} version={version} keyword={keyword} boundary={boundary} collapsed={collapsed} setKeyword={setKeyword} setBoundary={setBoundary} toggleGroup={toggleGroup} openSource={openSource} openDialog={setDialog} startUpdate={() => { setBaseline(inventory.map((row) => ({ ...row }))); setInvalidSourceIds(new Set()); setTaskState('pending'); notify(`已基于正式清单 V${version} 创建编辑副本`); }} confirmSnapshot={requestSnapshotConfirmation} confirmUpdate={requestUpdateConfirmation} showChanges={() => setDrawer({ kind: 'changes', baseline: baseline ?? inventory, draft: inventory, version })} exportInventory={exportInventory} invalidSourceIds={invalidSourceIds} />;
  else if (page === 'support') content = <SupportPage inventory={officialInventory} openDrawer={setDrawer} />;
  else if (page === 'factors') content = <FactorPage factors={factors} setFactors={setFactors} openDrawer={setDrawer} openDialog={setDialog} />;
  else content = <div className={styles.page}><section className={`${styles.card} ${styles.reportEmpty}`}><div><i>▤</i><h2>一期暂不展开报告编制页面</h2><p>当前核算任务、核算清单和核查材料已形成报告数据基础；报告模板及编制流程作为后续迭代项。</p><Button outline onClick={() => navigate('/carbon-accounting/preview')}>返回碳排放预览</Button></div></section></div>;

  return <>{content}{toast && <div className={styles.toast}>{toast}</div>}
    {dialog?.kind === 'settings' && <SettingsDialog close={() => setDialog(null)} save={() => { setDialog(null); notify('核算设置已保存'); }} />}
    {dialog?.kind === 'task' && <TaskDialog close={() => setDialog(null)} create={() => { setTaskState('draft'); setVersion(0); setBaseline(null); setHistory([]); setDialog(null); notify('年度核算任务已创建，已生成草稿清单并自动保存'); }} />}
    {dialog?.kind === 'newSource' && <NewSourceDialog groups={[...new Set(inventory.map((row) => row.emissionGroup))]} close={() => setDialog(null)} save={(input) => { if (saveSource(input)) setDialog(null); }} />}
    {dialog?.kind === 'deleteSource' && <Dialog title="删除排放源" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { deleteEmissionSource(dialog.row.emissionSourceId); refresh(); setDialog(null); notify(dialog.row.entryMode === 'system' ? '已从当前核算任务中移除' : '排放源已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>{dialog.row.entryMode === 'system' ? '该记录由系统根据源数据生成。删除后仅从当前核算任务中移除，不会删除能源消费、运营数据等上游源数据。' : '该记录为人工新增。删除后将从当前核算任务中逻辑移除，后台保留删除人、时间和操作记录。'}</div><p><b>{dialog.row.sourceName}</b></p></Dialog>}
    {dialog?.kind === 'confirmSnapshot' && <ConfirmSnapshot title="确认生成正式核算清单" previousVersion={0} version={1} baseline={[]} inventory={inventory} close={() => setDialog(null)} confirm={confirmSnapshot} />}
    {dialog?.kind === 'completeUpdate' && <ConfirmSnapshot title="确认更新正式核算清单" previousVersion={version} version={version + 1} baseline={baseline ?? []} inventory={inventory} close={() => setDialog(null)} confirm={completeUpdate} />}
    {dialog?.kind === 'cancelUpdate' && <Dialog title="取消本次修改" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>继续编辑</Button><Button danger onClick={cancelUpdate}>确认取消</Button></>}><div className={styles.confirmBox}>取消后将恢复正式清单 V{version}，本次编辑副本中的修改不会保留。</div></Dialog>}
    {dialog?.kind === 'factorSelect' && <FactorSelectDialog row={dialog.row} factors={factors} close={() => setDialog(null)} choose={(factorId) => { setDialog(null); setDrawer({ kind: 'source', row: dialog.row, mode: 'edit', factorId }); notify('已切换计算因子/参数组'); }} />}
    {dialog?.kind === 'enterpriseFactor' && <EnterpriseFactorDialog close={() => setDialog(null)} save={(factor) => { setFactors([...factors, factor]); setDialog(null); notify('企业因子/参数已保存'); }} />}
    {dialog?.kind === 'importFactor' && <Dialog title="导入企业因子/参数" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button primary onClick={() => { setDialog(null); notify('企业因子导入校验已启动（演示）'); }}>开始导入</Button></>}><div className={styles.infoBox}>仅导入当前企业的实测因子、核算参数或参数组。公共因子由平台管理员通过受控流程统一导入、校验和发布。</div><div className={styles.importBox}><b>导入文件 *</b><Button outline>选择Excel文件</Button><small>导入后将执行字段、单位、重复项、适用年度和依据材料校验。</small></div></Dialog>}
    {drawer?.kind === 'source' && <SourceDrawer state={drawer} allowEdit={taskState !== 'confirmed'} close={() => setDrawer(null)} save={(input, id) => { if (drawer.mode === 'view' && taskState !== 'confirmed') setDrawer({ ...drawer, mode: 'edit' }); else if (drawer.mode !== 'view') saveSource(input, id); }} chooseFactor={(row) => { setDrawer(null); setDialog({ kind: 'factorSelect', row }); }} goSupport={() => { setDrawer(null); navigate('/carbon-accounting/support'); }} />}
    {drawer?.kind === 'support' && <SupportDrawer state={drawer} close={() => setDrawer(null)} manage={() => setDrawer({ ...drawer, manage: true })} save={() => { setDrawer(null); notify('支撑材料信息已保存'); }} />}
    {drawer?.kind === 'factor' && <FactorDrawer factor={drawer.factor} close={() => setDrawer(null)} />}
    {drawer?.kind === 'history' && <HistoryDrawer history={history} close={() => setDrawer(null)} />}
    {drawer?.kind === 'changes' && <ChangeDrawer baseline={drawer.baseline} draft={drawer.draft} version={drawer.version} close={() => setDrawer(null)} />}
  </>;
}

function SettingsDialog({ close, save }: { close: () => void; save: () => void }) {
  return <Dialog title="核算设置" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={save}>保存设置</Button></>}><div className={styles.orgBox}><span><b>核算组织：XX科技有限公司</b><small>组织信息来自任务创建时的档案快照，不可直接修改。</small></span><Tag>只读</Tag></div><div className={styles.formGrid}><Field label="核算年度"><input value="2026年" readOnly /></Field><Field label="行业核算方法"><select><option>通用工业企业</option><option>其他适用行业方法</option></select></Field><Field label="核算范围" full><select><option>全部组织与设施</option><option>指定组织或设施</option></select></Field><Field label="核算用途" full><select><option>企业年度盘查</option><option>第三方核查</option><option>对外披露</option></select></Field><Field label="边界说明" full><textarea placeholder="如存在特殊边界情况，请填写说明" /></Field></div></Dialog>;
}

function TaskDialog({ close, create }: { close: () => void; create: () => void }) {
  const [scope, setScope] = useState('all');
  return <Dialog title="新建年度核算任务" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={create}>创建并生成核算清单</Button></>}><div className={styles.orgBox}><span><b>当前核算组织：XX科技有限公司</b><small>统一社会信用代码：9132XXXXXXXXXXXXXX｜来源：当前组织档案</small></span><button className={styles.textButton}>切换组织</button></div><div className={styles.formGrid}><Field label="核算年度 *"><select><option>2027年</option><option>2026年</option><option>2025年</option></select></Field><Field label="行业核算方法 *"><select><option>通用工业企业（自动匹配）</option><option>其他适用行业方法</option></select></Field><Field label="核算范围 *" full><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">全部组织与设施</option><option value="selected">指定组织或设施</option></select></Field>{scope === 'selected' && <div className={styles.scopeTree}><label><input type="checkbox" defaultChecked />总部及办公区</label><label><input type="checkbox" defaultChecked />一厂区</label><label><input type="checkbox" />二厂区</label></div>}<div className={`${styles.infoBox} ${styles.fieldFull}`}>核算依据将自动匹配：GB/T 32150—2025、ISO 14064-1:2018及适用行业方法。创建任务时，系统将保存组织ID、主体名称、统一社会信用代码及标准版本快照。</div></div></Dialog>;
}

function NewSourceDialog({ groups, close, save }: { groups: string[]; close: () => void; save: (input: Omit<EmissionSource, 'emissionSourceId'>) => void }) {
  const [group, setGroup] = useState(groups[0]);
  const [sourceType, setSourceType] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [activity, setActivity] = useState('');
  const [unit, setUnit] = useState('');
  const factor = getCarbonFactorV4('pf-r134a')!;
  const submit = () => {
    if (!sourceName.trim() || !unit.trim()) return;
    save({ carbonTaskId: 'ct-2026', emissionGroup: group, sourceType: sourceType || '人工新增排放源', sourceName: sourceName.trim(), activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, activityDataSource: '核算清单·在线录入', factorName: factor.name, emissionFactorId: factor.factorId, emissionAmount: recalculate(Number(activity), unit, factor), entryMode: 'manual' });
  };
  return <Dialog title="新增排放源" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={submit}>保存排放源</Button></>}><form className={styles.formGrid} onSubmit={(event: FormEvent) => { event.preventDefault(); submit(); }}><div className={`${styles.infoBox} ${styles.fieldFull}`}>人工新增排放源可编辑和删除；由能源消费、运营数据等模块自动识别的排放源应通过源数据生成，不在此重复新增。</div><Field label="核算边界 *"><select value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="温室气体源类型 *"><input value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="例如：逸散排放" /></Field><Field label="排放源名称 *" full><input required value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="请输入排放源名称" /></Field><Field label="活动数据值 *"><input required type="number" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位 *"><input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：kg、t、MWh" /></Field><Field label="排放因子/参数" full><Button outline>从因子库选择</Button><small>默认演示：R134a全球变暖潜势</small></Field><button type="submit" className={styles.hiddenSubmit}>保存</button></form></Dialog>;
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
  const items = [
    ['当前正式版本', previousVersion ? `V${previousVersion}` : '尚未生成正式版本'],
    ['更新后版本', `V${version}`],
    ['排放源总数', `${inventory.length} 项`],
    ['本次新增', `${added} 项`],
    ['本次修改', `${modified} 项`],
    ['本次删除', `${deleted} 项`],
    ['更新前排放总量', `${format(previousTotal)} tCO₂e`],
    ['更新后排放总量', `${format(total)} tCO₂e`],
    ['排放量变化', `${delta >= 0 ? '+' : ''}${format(delta)} tCO₂e`],
  ];
  return <Dialog title={title} onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={confirm}>{version === 1 ? '确认生成' : '确认更新'}</Button></>}><table className={styles.confirmTable}><tbody>{items.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table><div className={styles.infoBox}>确认后将生成新的正式核算清单版本，并同步更新碳排放预览、核查支撑清单及导出数据。历史正式版本将保留，不会被覆盖删除。</div></Dialog>;
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
  return <Drawer title="本次修改详情" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.calcSummary}><div><span>正式版本</span><b>V{version}</b></div><div><span>排放总量变化</span><b>{totalAfter - totalBefore >= 0 ? '+' : ''}{format(totalAfter - totalBefore)} tCO₂e</b></div><div><span>变更记录</span><b>{rows.length} 项</b></div></div><DetailBlock title="具体变更记录"><table className={styles.changeTable}><thead><tr><th>变更类型</th><th>排放源</th><th>变更前排放量</th><th>变更后排放量</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.type}-${row.name}-${index}`}><td>{row.type}</td><td>{row.name}</td><td>{row.before === '—' ? row.before : `${row.before} tCO₂e`}</td><td>{row.after === '—' ? row.after : `${row.after} tCO₂e`}</td></tr>) : <tr><td colSpan={4} className={styles.emptyRow}>当前编辑副本暂无变更</td></tr>}</tbody></table></DetailBlock></Drawer>;
}

function FactorSelectDialog({ row, factors, close, choose }: { row: EmissionSource; factors: CarbonFactor[]; close: () => void; choose: (factorId: string) => void }) {
  const current = getCarbonFactorV4(row.emissionFactorId);
  const candidates = factors.filter((factor) => factor.validity === '当前有效' && factor.selectable && (factor.activity === current?.activity || factor.activity === row.sourceType || (row.emissionSourceId === 'es-clinker' && factor.activity === '工业过程')));
  const [selected, setSelected] = useState(row.emissionFactorId);
  const [keyword, setKeyword] = useState('');
  const visible = candidates.filter((factor) => !keyword || [factor.name, factor.source, factor.objectType].some((value) => value.includes(keyword)));
  return <Dialog title="选择排放因子/参数组" wide onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={() => choose(selected)}>确认选择</Button></>}><div className={styles.infoBox}>系统根据排放活动、行业、地理范围和核算年度筛选可用的综合因子或参数组。基础参数和方法学常数在参数组内引用，不作为独立计算方法选择。</div><div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索候选因子或参数组" /></div><div className={styles.factorChoices}>{visible.map((factor) => <label key={factor.factorId} className={selected === factor.factorId ? styles.selectedChoice : ''}><input type="radio" checked={selected === factor.factorId} onChange={() => setSelected(factor.factorId)} /><span><b>{factor.name}　<Tag tone={factor.scope === 'enterprise' ? 'orange' : 'blue'}>{factor.scope === 'enterprise' ? '企业数据' : '公共数据'}</Tag></b><small>{factor.objectType}｜{factor.value} {factor.unit === '参数组' ? '' : factor.unit}｜{factor.source}｜{factor.version}</small></span><Tag>{factor.validity}</Tag></label>)}</div></Dialog>;
}

function EnterpriseFactorDialog({ close, save }: { close: () => void; save: (factor: CarbonFactor) => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  return <Dialog title="新增企业因子/参数" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={() => { if (!name.trim() || !source.trim()) return; save({ factorId: `ef-${Date.now()}`, scope: 'enterprise', name, objectType: '综合排放因子', activity: '固定燃烧', gas: 'CO₂', value, unit, source: '企业自定义', version: '2026年度', geo: '当前企业', industry: '通用工业', validity: '当前有效', raw: `${value} ${unit}`, quality: '企业配置', effective: '2026年度', reference: source, selectable: true, calculationType: 'direct', approval: '待审核' }); }}>保存企业数据</Button></>}><div className={styles.infoBox}>企业数据仅适用于当前组织。建议优先录入可验证的单项实测参数；系统可将企业参数与公共缺省参数组合为计算参数组。</div><div className={styles.formGrid}><Field label="对象名称 *"><input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="对象类型 *"><select><option>综合排放因子</option><option>基础核算参数</option><option>参数组/公式模板</option></select></Field><Field label="排放活动 *"><select><option>固定燃烧</option><option>购入电力</option><option>工业过程</option></select></Field><Field label="温室气体"><select><option>CO₂</option><option>CO₂e</option><option>CH₄</option></select></Field><Field label="数值/参数摘要 *"><input value={value} onChange={(event) => setValue(event.target.value)} /></Field><Field label="单位 *"><input value={unit} onChange={(event) => setUnit(event.target.value)} /></Field><Field label="适用年度 *"><input value="2026年度" readOnly /></Field><Field label="取值方式 *"><select><option>多批次加权平均</option><option>单次检测值</option><option>供应商提供值</option></select></Field><Field label="来源及依据材料 *" full><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="例如：检测报告编号、台账或供应商证明" /></Field></div></Dialog>;
}

function SupportDrawer({ state, close, manage, save }: { state: Extract<DrawerState, { kind: 'support' }>; close: () => void; manage: () => void; save: () => void }) {
  const item = state.item;
  const files = ['结算单_202601-202612.pdf', '采购发票_2026.pdf', '检测报告_2026.pdf'].slice(0, Math.min(item.materials, 3));
  return <Drawer title={state.manage ? '材料管理' : '支撑材料详情'} onClose={close} footer={<><Button onClick={close}>关闭</Button>{state.manage ? <Button primary onClick={save}>保存</Button> : <Button outline onClick={manage}>材料管理</Button>}</>}><DetailBlock title={item.item}><div className={styles.kv}><span>核算边界/事项</span><span>{item.group}</span><span>活动数据项</span><b>{item.activity}</b><span>活动数据来源</span><span>{item.origin}</span><span>材料状态</span><Tag tone={item.state === '已上传' ? 'green' : 'orange'}>{item.state}</Tag></div></DetailBlock><DetailBlock title={`关联材料列表（${item.materials}）`}>{files.length ? files.map((file, index) => <div className={styles.fileRow} key={file}><i>PDF</i><span><b>{file}</b><small>2027-01-05　{(2.34 - index * .31).toFixed(2)}MB　张三</small></span><em>⌄</em></div>) : <p className={styles.note}>暂无上传材料</p>}</DetailBlock>{state.manage && <DetailBlock title="材料维护"><Button outline>⇧ 上传文件</Button><p className={styles.note}>支持PDF、图片、Word和Excel文件。</p></DetailBlock>}<DetailBlock title="备注说明（选填）"><textarea className={styles.textarea} placeholder="请输入备注说明" /></DetailBlock></Drawer>;
}

function FactorDrawer({ factor, close }: { factor: CarbonFactor; close: () => void }) {
  return <Drawer title="因子/参数详情" onClose={close} footer={<Button onClick={close}>关闭</Button>}><DetailBlock title="基础信息"><div className={styles.kv}><span>对象名称</span><b>{factor.name}</b><span>对象类型</span><span className={styles.objectTag}>{factor.objectType}</span><span>编码</span><span>{factor.factorId}</span><span>排放活动</span><span>{factor.activity}</span><span>温室气体</span><span>{factor.gas}</span><span>当前值/摘要</span><b>{factor.value} {factor.unit === '参数组' ? '' : factor.unit}</b><span>有效状态</span><Tag>{factor.validity}</Tag></div></DetailBlock>{factor.parameters?.length && <><DetailBlock title="参数组成"><table className={styles.parameterTable}><thead><tr><th>参数及来源</th><th>数值</th><th>单位</th></tr></thead><tbody>{factor.parameters.map((parameter) => <tr key={parameter.key}><td><b>{parameter.name}</b><small>{parameter.sourceType} · {parameter.source}</small></td><td><b>{parameter.display}</b></td><td>{parameter.unit}</td></tr>)}</tbody></table></DetailBlock><DetailBlock title="公式模板"><div className={styles.formulaBox}>{factor.formula}</div></DetailBlock></>}<DetailBlock title="权威来源与版本"><div className={styles.sourceCard}><span>来源机构/文件</span><b>{factor.source}</b><span>版本</span><span>{factor.version}</span><span>原始值/结构</span><span>{factor.raw}</span><span>分类或条款</span><span>{factor.reference}</span><span>适用期</span><span>{factor.effective}</span></div></DetailBlock><DetailBlock title="适用性与数据质量"><div className={styles.sourceCard}><span>地理代表性</span><span>{factor.geo}</span><span>行业代表性</span><span>{factor.industry}</span><span>技术/活动</span><span>{factor.activity}</span><span>数据质量</span><span>{factor.quality}</span></div></DetailBlock></Drawer>;
}

function HistoryDrawer({ history, close }: { history: { version: number; time: string; total: number; count: number }[]; close: () => void }) {
  return <Drawer title="核算清单更新记录" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.infoBox}>前端仅展示轻量更新记录；后台保留每个正式版本的完整活动数据、因子参数、公式和结果快照。</div><div className={styles.versionList}>{history.length ? history.map((item, index) => <div className={index === 0 ? styles.currentVersion : ''} key={item.version}><strong>V{item.version}</strong><span><b>{index === 0 ? '当前正式清单' : '历史正式清单'}</b><small>确认时间：{item.time}｜确认人：管理员</small><small>排放源 {item.count} 项｜排放总量 {format(item.total)} tCO₂e</small></span><Tag tone={index === 0 ? 'green' : 'gray'}>{index === 0 ? '当前' : '历史'}</Tag></div>) : <p className={styles.note}>尚未生成正式清单版本。</p>}</div></Drawer>;
}
