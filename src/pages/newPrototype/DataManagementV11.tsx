import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  deleteV11ConversionOutput,
  deleteV11EnergyCost,
  deleteV11EnergyRecord,
  deleteV11EnergyType,
  deleteV11KeyDevice,
  deleteV11OperationMetric,
  inspectV11KeyDeviceDeletion,
  listV11ConversionOutputs,
  listV11EnergyCosts,
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11KeyDevices,
  listV11OperationMetrics,
  saveV11ConversionOutput,
  saveV11EnergyCost,
  saveV11EnergyRecord,
  saveV11EnergyType,
  saveV11KeyDevice,
  saveV11OperationMetric,
  v11RecordScopeType,
  v11ScopeName,
  type AnalysisCategory,
  type ConversionInputMode,
  type ConversionOutputType,
  type ScopeLevel,
  type V11ConversionOutput,
  type V11EnergyCost,
  type V11EnergyRecord,
  type V11EnergyType,
  type V11KeyDevice,
  type V11OperationMetric,
} from '../../mocks/dataManagementV11Store';
import {
  getProduct,
  linkProductEnergyUnit,
  listProducts,
  saveProduct,
} from '../../mocks/productMasterStore';
import { Button, Field, Modal, Tag, Toast } from './PrototypeUI';
import { EnergyUnitsPage } from './EnergyUnitsPage';
import styles from './DataManagementV11.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const categories: AnalysisCategory[] = ['电力', '热力', '化石燃料', '可再生及替代能源', '回收能源', '其他能源'];
type EnergyScopeView = ScopeLevel | '重点设备';
const levels: Array<'全部层级' | EnergyScopeView> = ['全部层级', '企业', '一级用能单元', '二级用能单元', '重点设备'];
type OperationScopeView = ScopeLevel | '全部层级';
const operationLevels: OperationScopeView[] = ['全部层级', '企业', '一级用能单元', '二级用能单元'];
const deviceTypePresets = ['能源转换设备', '动力设备', '泵类', '风机', '空压设备', '制冷/空调设备', '加热/锅炉设备', '输送设备', '加工设备', '表面处理设备', '检测设备', '其他（自定义）'];
const metricPresets = {
  产量: [
    ['产品产量', 't'],
    ['其他（自定义）', ''],
  ],
  经济指标: [
    ['工业总产值', '万元'],
    ['工业增加值', '万元'],
    ['营业收入', '万元'],
    ['其他（自定义）', ''],
  ],
} as const;

const energyPresets: Record<AnalysisCategory, Array<[string, string, number, string]>> = {
  电力: [['电力', 'kWh', 0.1229, 'kgce/kWh']],
  热力: [['蒸汽', 'GJ', 0.0341, 'tce/GJ'], ['热水', 'GJ', 0.0341, 'tce/GJ']],
  化石燃料: [['原煤', 't', 0.7143, 'tce/t'], ['烟煤', 't', 0.7143, 'tce/t'], ['石油焦', 't', 1.0918, 'tce/t'], ['柴油', 't', 1.4571, 'tce/t'], ['天然气', 'Nm³', 1.33, 'kgce/Nm³']],
  可再生及替代能源: [['生物质燃料', 't', 0.5, 'tce/t'], ['RDF', 't', 0.6, 'tce/t'], ['废轮胎', 't', 0.8, 'tce/t']],
  回收能源: [['余热', 'GJ', 0.0341, 'tce/GJ'], ['回收蒸汽', 'GJ', 0.0341, 'tce/GJ']],
  其他能源: [['压缩空气', 'Nm³', 0, 'kgce/Nm³'], ['其他（自定义）', '', 0, '']],
};

const conversionOutputTypes: ConversionOutputType[] = ['锅炉产汽/产热', '余热发电', '自发电', '回收利用', '直接外供', '其他转换'];
const recoveryEnergyOptions = ['余热', '回收蒸汽', '冷凝水', '回收热水', '可燃尾气', '压力能'];

function annual(values: number[], fallback = 0) {
  return fallback > 0 ? fallback : values.reduce((sum, value) => sum + value, 0);
}
function reportedMonths(record: V11EnergyRecord) {
  return record.monthlyReportedMonths ?? record.monthlyAmounts.map((value) => value > 0);
}
function energyDataProgress(record: V11EnergyRecord) {
  const count = reportedMonths(record).filter(Boolean).length;
  if (!count) return record.annualAmount > 0 ? '年度汇总录入' : '待完善';
  if (count < 12) return record.annualAmount > 0 ? `${count}/12月｜年度已补录` : `${count}/12月｜年度待完善`;
  return '12/12月';
}
const PAGE_SIZE = 10;
function format(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}
function useNotice() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };
  return { toast, notify };
}
function Actions({ onView, viewLabel = '查看', onEdit, onDelete }: { onView?: () => void; viewLabel?: string; onEdit: () => void; onDelete: () => void }) {
  return <div className={styles.actions}>{onView && <button type="button" onClick={onView}>{viewLabel}</button>}<button type="button" onClick={onEdit}>编辑</button><button type="button" className={styles.danger} onClick={onDelete}>删除</button></div>;
}
function Page({ children, toast }: { children: ReactNode; toast: string }) {
  return <div className={styles.page}>{children}<Toast message={toast} /></div>;
}
function Toolbar({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return <div className={styles.toolbar}><div className={styles.toolbarFields}>{children}</div><div className={styles.toolbarActions}>{actions}</div></div>;
}
function Notice({ children }: { children: ReactNode }) {
  return <div className={styles.notice}>{children}</div>;
}
function Pagination({ count, currentPage = 1, onPageChange }: { count: number; currentPage?: number; onPageChange?: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const canChange = !!onPageChange && pageCount > 1;
  return <div className={styles.pagination}>
    <span>共 {count} 条</span>
    {canChange && <button type="button" disabled={currentPage === 1} onClick={() => onPageChange?.(currentPage - 1)}>上一页</button>}
    {canChange && <span>{currentPage} / {pageCount}</span>}
    <button type="button" className={styles.pageDot} disabled={!canChange || currentPage === pageCount} onClick={() => onPageChange?.(currentPage + 1)}>{canChange ? '下一页' : '1'}</button>
  </div>;
}
function EmptyRow({ colSpan }: { colSpan: number }) {
  return <tr><td className={styles.empty} colSpan={colSpan}>暂无匹配数据</td></tr>;
}
function EnergyDataTabs({ active }: { active: 'quantity' | 'costs' | 'relations' }) {
  const navigate = useNavigate();
  return <div className={styles.topTabs}>
    <button type="button" className={active === 'quantity' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-data')}>能源量数据</button>
    <button type="button" className={active === 'costs' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-data?tab=costs')}>能源成本</button>
    <button type="button" className={active === 'relations' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-data?tab=conversion')}>能源转换与输出</button>
  </div>;
}

export function DataManagementV11({ pathname }: { pathname: string }) {
  const { search } = useLocation();
  const page = pathname.split('?')[0].split('/').pop();
  const energyTab = new URLSearchParams(search).get('tab');
  if (page === 'units') return <EnergyUnitsPage />;
  if (page === 'energy-types') return <EnergyTypesPage />;
  if (page === 'energy-data') {
    if (energyTab === 'costs') return <EnergyCostsPage />;
    if (energyTab === 'conversion') return <EnergyConversionOutputPage />;
    return <EnergyQuantityPage />;
  }
  if (page === 'energy-consumption') return <EnergyQuantityPage />;
  if (page === 'energy-costs') return <EnergyCostsPage />;
  if (page === 'energy-relations') return <EnergyConversionOutputPage />;
  if (page === 'operations') return <OperationsPage />;
  return <DevicesPage />;
}

function EnergyTypesPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<V11EnergyType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyType | null>(null);
  const rows = listV11EnergyTypes().filter((item) => (!keyword || item.energyTypeName.includes(keyword)) && (!category || item.analysisCategory === category));
  void version;
  return <Page toast={toast}>
    <section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => { setKeyword(keywordInput.trim()); setCategory(categoryInput); }}>查询</Button><Button onClick={() => { setKeywordInput(''); setCategoryInput(''); setKeyword(''); setCategory(''); }}>重置</Button><Button primary onClick={() => setEditing('new')}>＋ 新增能源品种</Button></>}>
        <Field label="关键字"><input aria-label="关键字" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="搜索能源品种名称" /></Field>
        <Field label="能源分析类别"><select aria-label="能源分析类别" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </Toolbar>
      <Notice><strong>说明：</strong>能源分析类别用于能耗查询和结构汇总；能源品种只维护基础属性，能源转换、回收利用和外部输出统一在“能源转换与输出”中维护。</Notice>
      <div className={styles.tableWrap}><table><thead><tr><th>能源分析类别</th><th>能源品种</th><th>计量单位</th><th>折标系数</th><th>折标单位</th><th className={styles.operationColumn}>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.energyTypeId}><td><Tag tone="blue">{row.analysisCategory}</Tag></td><td className={styles.strong}>{row.energyTypeName}</td><td>{row.measurementUnit}</td><td>{row.standardCoalFactor.toFixed(4)}</td><td>{row.standardCoalFactorUnit}</td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>)}</tbody>
      </table></div>
      <Pagination count={rows.length} />
    </section>
    {editing && <EnergyTypeDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
    {deleting && <Modal title="删除能源品种" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyType(deleting.energyTypeId);
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源品种已删除');
    }}><div className={styles.warning}>确认删除能源品种“{deleting.energyTypeName}”吗？系统将先检查能源数据、成本和重点设备引用。</div></Modal>}
  </Page>;
}

function EnergyTypeDialog({ item, onClose, onSaved }: { item?: V11EnergyType; onClose: () => void; onSaved: (message: string) => void }) {
  const [category, setCategory] = useState<AnalysisCategory>(item?.analysisCategory ?? '电力');
  const initialPreset = energyPresets[item?.analysisCategory ?? '电力'].find((entry) => entry[0] === item?.energyTypeName);
  const [preset, setPreset] = useState(item ? initialPreset?.[0] ?? '其他（自定义）' : '');
  const [customName, setCustomName] = useState(item && !initialPreset ? item.energyTypeName : '');
  const [unit, setUnit] = useState(item?.measurementUnit ?? initialPreset?.[1] ?? '');
  const [factor, setFactor] = useState(String(item?.standardCoalFactor ?? initialPreset?.[2] ?? ''));
  const [factorUnit, setFactorUnit] = useState(item?.standardCoalFactorUnit ?? initialPreset?.[3] ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const custom = preset === '其他（自定义）';
  const choosePreset = (value: string, nextCategory = category) => {
    setPreset(value);
    const option = energyPresets[nextCategory].find((entry) => entry[0] === value);
    if (option) { setUnit(option[1]); setFactor(String(option[2])); setFactorUnit(option[3]); }
  };
  return <Modal title={item ? '编辑能源品种' : '新增能源品种'} width={760} onClose={onClose} onSubmit={() => {
    const name = custom ? customName.trim() : preset;
    if (!name || !unit || factor === '' || !factorUnit) return setError('请完整填写必填字段。');
    const result = saveV11EnergyType({ analysisCategory: category, energyTypeName: name, measurementUnit: unit, standardCoalFactor: Number(factor), standardCoalFactorUnit: factorUnit, remark }, item?.energyTypeId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源品种已更新' : '能源品种已新增');
  }}><div className={styles.formGrid}>
    <Field label="能源分析类别" required><select value={category} onChange={(event) => { const next = event.target.value as AnalysisCategory; setCategory(next); setPreset(''); setUnit(''); setFactor(''); setFactorUnit(''); }}>{categories.map((value) => <option key={value}>{value}</option>)}</select></Field>
    <Field label="能源品种" required><select value={preset} onChange={(event) => choosePreset(event.target.value)}><option value="">请选择能源品种</option>{energyPresets[category].map(([name]) => <option key={name}>{name}</option>)}</select></Field>
    {custom && <Field label="自定义能源品种" required><input value={customName} onChange={(event) => setCustomName(event.target.value)} /></Field>}
    <Field label="计量单位" required><input value={unit} readOnly={!custom} onChange={(event) => setUnit(event.target.value)} /></Field>
    <Field label="折标系数" required><input min="0" step="0.0001" type="number" value={factor} onChange={(event) => setFactor(event.target.value)} /></Field>
    <Field label="折标单位" required><input value={factorUnit} readOnly={!custom} onChange={(event) => setFactorUnit(event.target.value)} /></Field>
    <div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="选填" /></Field></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function EnergyQuantityPage() {
  const { toast, notify } = useNotice();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const linkedDeviceId = params.get('deviceId') ?? '';
  const linkedEnergyTypeId = params.get('energyTypeId') ?? '';
  const linkedRecordId = params.get('recordId') ?? '';
  const deviceEntry = params.get('scope') === 'device';
  const [version, setVersion] = useState(0);
  const [level, setLevel] = useState<'全部层级' | EnergyScopeView>(deviceEntry ? '重点设备' : '全部层级');
  const [currentPage, setCurrentPage] = useState(1);
  const [year, setYear] = useState(params.get('year') ?? '2026');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState(params.get('keyword') ?? '');
  const [appliedFilters, setAppliedFilters] = useState({ year: params.get('year') ?? '2026', category: '', keyword: params.get('keyword') ?? '', energyTypeId: linkedEnergyTypeId });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<V11EnergyRecord | 'new' | null>(() => {
    if (linkedRecordId) return listV11EnergyRecords().find((record) => record.energyRecordId === linkedRecordId) ?? null;
    return deviceEntry && params.get('new') === '1' ? 'new' : null;
  });
  const [deleting, setDeleting] = useState<V11EnergyRecord | null>(null);
  const types = listV11EnergyTypes();
  const devices = listV11KeyDevices();
  const records = listV11EnergyRecords();
  const units = listEnergyUnits();
  const unitById = new Map(units.map((unit) => [unit.energyUnitId, unit]));
  const energyTypeOrder = new Map(types.map((type, index) => [type.energyTypeId, index]));
  const orderedUnitIds: string[] = [];
  const visitUnits = (parentId: string | null) => {
    units.filter((unit) => unit.parentEnergyUnitId === parentId).forEach((unit) => {
      orderedUnitIds.push(unit.energyUnitId);
      visitUnits(unit.energyUnitId);
    });
  };
  visitUnits(null);
  const unitOrder = new Map(orderedUnitIds.map((id, index) => [id, index]));
  const rows = records.filter((item) => item.energyRole === '能源消费' && item.year === Number(appliedFilters.year)
    && (level === '全部层级'
      ? true
      : level === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === level)
    && (!linkedDeviceId || level !== '重点设备' || item.scopeId === linkedDeviceId)
    && (!appliedFilters.energyTypeId || item.energyTypeId === appliedFilters.energyTypeId)
    && (!appliedFilters.category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === appliedFilters.category)
    && (!appliedFilters.keyword || `${v11RecordScopeType(item) === 'device' ? devices.find((device) => device.deviceId === item.scopeId)?.deviceName ?? '' : v11ScopeName(item.energyUnitId)}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(appliedFilters.keyword)))
    .sort((left, right) => {
      const scopeOrder = (record: V11EnergyRecord) => {
        const scopeType = v11RecordScopeType(record);
        if (scopeType === 'enterprise') return -100;
        const base = (unitOrder.get(record.energyUnitId ?? '') ?? 999) * 10;
        return scopeType === 'device' ? base + 5 : base;
      };
      const order = scopeOrder(left) - scopeOrder(right);
      if (order) return order;
      const scope = String(left.scopeId ?? left.energyUnitId ?? '').localeCompare(String(right.scopeId ?? right.energyUnitId ?? ''), 'zh-CN');
      if (scope) return scope;
      return (energyTypeOrder.get(left.energyTypeId) ?? 999) - (energyTypeOrder.get(right.energyTypeId) ?? 999);
    });
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setCurrentPage(1); }, [appliedFilters, level]);
  void version;
  const countForLevel = (value: '全部层级' | EnergyScopeView) => records.filter((item) =>
    item.energyRole === '能源消费'
    && item.year === Number(appliedFilters.year)
    && (!appliedFilters.energyTypeId || item.energyTypeId === appliedFilters.energyTypeId)
    && (!appliedFilters.category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === appliedFilters.category)
    && (!appliedFilters.keyword || `${v11RecordScopeType(item) === 'device' ? devices.find((device) => device.deviceId === item.scopeId)?.deviceName ?? '' : v11ScopeName(item.energyUnitId)}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(appliedFilters.keyword))
    && (value === '全部层级'
      ? true
      : value === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === value)).length;
  return <Page toast={toast}>
    <section className={styles.card}>
      <EnergyDataTabs active="quantity" />
      <Toolbar actions={<><Button primary onClick={() => setAppliedFilters({ year, category, keyword, energyTypeId: linkedEnergyTypeId })}>查询</Button><Button onClick={() => { setYear('2026'); setCategory(''); setKeyword(''); setLevel(deviceEntry ? '重点设备' : '全部层级'); setAppliedFilters({ year: '2026', category: '', keyword: '', energyTypeId: linkedEnergyTypeId }); }}>重置</Button>{level === '全部层级' ? <span className={styles.entryHint}>请切换至具体层级页签后录入</span> : <Button primary onClick={() => setEditing('new')}>＋ 新增能源数据</Button>}</>}>
        <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
        <Field label="能源分析类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={level === '重点设备' ? '重点设备 / 能源品种' : '用能单元 / 能源品种'} /></Field>
      </Toolbar>
      <div className={styles.levelTabs}>{levels.map((item) => <button key={item} type="button" className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{item}（{countForLevel(item)}）</button>)}</div>
      <Notice>{level === '重点设备'
        ? <><strong>重点设备能源数据：</strong>设备数据用于设备用能分析和能效对标，是所属用能单元能源量的明细拆分，不重复增加企业或用能单元总能耗。</>
        : <><strong>能源量数据：</strong>企业级记录用于边界总量控制，一级和二级用能单元按实际计量条件分别录入。系统依据归属层级自动识别能源输入、分配和利用阶段；回收、产出及外供不在此处重复维护。</>}</Notice>
      {level === '重点设备' ? <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>能源分析类别</th><th>能源品种</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{pageRows.length ? pageRows.flatMap((row) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const device = devices.find((item) => item.deviceId === row.scopeId);
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          return [<tr key={row.energyRecordId}><td className={styles.strong}>{device?.deviceName ?? '设备档案已移除'}</td><td>{v11ScopeName(device?.energyUnitId ?? row.energyUnitId)}</td><td>{device?.deviceType ?? '—'}</td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)} {type?.measurementUnit}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={8}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={8} />}</tbody>
      </table></div> : <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>归属范围 / 能源品种</th><th>归属层级</th><th>能流阶段</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{pageRows.length ? pageRows.flatMap((row, index) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const scopeType = v11RecordScopeType(row);
          const unit = row.energyUnitId ? unitById.get(row.energyUnitId) : null;
          const device = scopeType === 'device' ? devices.find((item) => item.deviceId === row.scopeId) : null;
          const scopeName = scopeType === 'device' ? device?.deviceName ?? '设备档案已移除' : v11ScopeName(row.energyUnitId);
          const scopeLevel = scopeType === 'device' ? '重点设备' : row.scopeLevel;
          const depth = scopeType === 'enterprise' ? 0 : scopeType === 'device' ? (unit?.unitLevel === 'level1' ? 2 : 3) : unit?.unitLevel === 'level1' ? 1 : 2;
          const currentScopeKey = scopeType === 'device' ? `device:${row.scopeId}` : `${scopeType}:${row.energyUnitId ?? 'enterprise'}`;
          const previous = pageRows[index - 1];
          const previousScopeType = previous ? v11RecordScopeType(previous) : null;
          const previousScopeKey = previous
            ? previousScopeType === 'device' ? `device:${previous.scopeId}` : `${previousScopeType}:${previous.energyUnitId ?? 'enterprise'}`
            : '';
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          const isScopeStart = currentScopeKey !== previousScopeKey;
          const isCollapsed = collapsedScopes.has(currentScopeKey);
          const groupCount = pageRows.filter((item) => {
            const itemType = v11RecordScopeType(item);
            return (itemType === 'device' ? `device:${item.scopeId}` : `${itemType}:${item.energyUnitId ?? 'enterprise'}`) === currentScopeKey;
          }).length;
          if (isCollapsed && !isScopeStart) return [];
          const groupRow = isScopeStart ? <tr className={styles.scopeGroupRow} key={`${currentScopeKey}-group`}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${scopeName}`} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(currentScopeKey)) next.delete(currentScopeKey); else next.add(currentScopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{scopeName}</b><em className={styles.scopeCount}>{groupCount}项</em>{device && <small>所属：{v11ScopeName(device.energyUnitId)}</small>}</span></div></td><td colSpan={7} /></tr> : null;
          return [groupRow, <tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={`${styles.scopeChild} ${styles[`scopeDepth${depth}`]}`} aria-label={`${scopeName}下的${type?.energyTypeName ?? '能源记录'}`}><span>└─ {type?.energyTypeName}</span></div></td><td>{scopeLevel}</td><td><span className={styles.stagePill}>{energyStage(row)}</span></td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={8}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={8} />}</tbody>
      </table></div>}
      <Pagination count={rows.length} currentPage={safePage} onPageChange={setCurrentPage} />
    </section>
    {editing && <EnergyRecordDialog item={editing === 'new' ? undefined : editing} dataYear={Number(appliedFilters.year)} lockedScopeLevel={editing === 'new' && level !== '全部层级' ? level : undefined} initialDeviceId={linkedDeviceId} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
    {deleting && <Modal title="删除能源数据" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyRecord(deleting.energyRecordId);
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源数据已删除');
    }}><div className={styles.warning}>确认删除当前能源数据吗？删除前将检查能源转换关系引用。</div></Modal>}
  </Page>;
}

function energyStage(record: V11EnergyRecord) {
  if (v11RecordScopeType(record) === 'device') return '设备用能';
  if (record.scopeLevel === '企业') return '能源输入';
  return record.scopeLevel === '一级用能单元' ? '能源分配' : '能源利用';
}
function MonthDetail({ values, reported, annualValue, annualSupplemented = false, unit }: { values: number[]; reported?: boolean[]; annualValue: number; annualSupplemented?: boolean; unit: string }) {
  const visibleMonths = reported ?? values.map((value) => value > 0);
  return <div className={styles.detailPanel}><div className={styles.detailHead}><span>月度明细</span><span>计量单位：{unit}</span></div><div className={styles.monthDetailGrid}>{months.map((month, index) => <div key={month}><span>{month}</span><strong>{visibleMonths[index] ? format(values[index] ?? 0, 2) : '—'}</strong></div>)}</div><div className={styles.summaryLine}>{annualSupplemented ? '年度总量（补录）' : '年度合计'} <strong>{format(annualValue, 2)}</strong> {unit}</div></div>;
}

function EnergyRecordDialog({ item, dataYear, lockedScopeLevel, initialDeviceId = '', onClose, onSaved }: { item?: V11EnergyRecord; dataYear: number; lockedScopeLevel?: EnergyScopeView; initialDeviceId?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const devices = listV11KeyDevices();
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const [level] = useState<EnergyScopeView>(item && v11RecordScopeType(item) === 'device' ? '重点设备' : item?.scopeLevel ?? lockedScopeLevel ?? '企业');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : '');
  const [deviceId, setDeviceId] = useState(item?.scopeType === 'device' ? item.scopeId ?? '' : initialDeviceId);
  const initialDevice = devices.find((device) => device.deviceId === (item?.scopeType === 'device' ? item.scopeId : initialDeviceId));
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? initialDevice?.mainEnergyTypeId ?? '');
  const initialReportedMonths = item ? reportedMonths(item) : Array(12).fill(false);
  const [reported, setReported] = useState<boolean[]>(initialReportedMonths);
  const [values, setValues] = useState<string[]>(item ? item.monthlyAmounts.map((value, index) => initialReportedMonths[index] ? String(value) : '') : Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualAmount || ''));
  const [error, setError] = useState('');
  const type = types.find((value) => value.energyTypeId === typeId);
  const device = devices.find((value) => value.deviceId === deviceId);
  const deviceUnit = units.find((unit) => unit.energyUnitId === device?.energyUnitId);
  const persistedScopeLevel: ScopeLevel = level === '重点设备'
    ? deviceUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'
    : level;
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = level === '一级用能单元'
    ? levelOneUnits
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  const effectiveUnitId = level === '企业' ? null : level === '重点设备' ? device?.energyUnitId ?? null : unitId;
  const selectedUnit = units.find((unit) => unit.energyUnitId === effectiveUnitId);
  const scopeType = level === '企业' ? 'enterprise' : level === '重点设备' ? 'device' : 'energyUnit';
  const scopeId = scopeType === 'enterprise' ? null : scopeType === 'device' ? deviceId : effectiveUnitId;
  const monthNumbers = values.map((value) => Number(value || 0));
  const monthlyTotal = monthNumbers.reduce((sum, value) => sum + value, 0);
  const reportedCount = reported.filter(Boolean).length;
  const monthlyComplete = reportedCount === 12;
  const recordPreview: V11EnergyRecord = { energyRecordId: '', year: dataYear, energyRole: '能源消费', scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode: reportedCount ? 'monthly' : 'annual', monthlyAmounts: [], annualAmount: 0 };
  return <Modal title={item ? '编辑能源数据' : '新增能源数据'} width={820} onClose={onClose} onSubmit={() => {
    if ((level === '重点设备' ? !deviceId : level !== '企业' && !unitId) || !typeId) return setError('请选择归属范围和能源品种。');
    const reportedAnnual = monthlyComplete ? 0 : Number(annualValue || 0);
    if (!reportedCount && !(reportedAnnual > 0)) return setError('请至少填写一个月度数据，或补录年度总量。');
    if (reportedAnnual > 0 && reportedAnnual < monthlyTotal) return setError('年度总量不能小于已录月份之和。');
    const result = saveV11EnergyRecord({ year: dataYear, energyRole: '能源消费', scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode: reportedCount ? 'monthly' : 'annual', monthlyAmounts: monthNumbers, monthlyReportedMonths: reported, annualAmount: reportedAnnual }, item?.energyRecordId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源数据已更新' : '能源数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}>
      <span>业务阶段 <strong>{energyStage(recordPreview)}</strong></span>
      {level === '重点设备' && <>
        <span>重点设备 <strong>{device?.deviceName ?? '待选择'}</strong></span>
        <span>所属用能单元 <strong>{v11ScopeName(device?.energyUnitId ?? null)}</strong></span>
        <span>设备类型 <strong>{device?.deviceType ?? '—'}</strong></span>
      </>}
    </div>
    <Field label="归属对象类型"><input aria-label="归属对象类型" value={level} readOnly /></Field>
    {level === '重点设备' ? <>
      <Field label="重点设备" required><select value={deviceId} onChange={(event) => { const id = event.target.value; const nextDevice = devices.find((value) => value.deviceId === id); setDeviceId(id); setTypeId(nextDevice?.mainEnergyTypeId ?? ''); }}><option value="">请选择重点设备</option>{devices.map((value) => <option key={value.deviceId} value={value.deviceId}>{value.deviceName}</option>)}</select></Field>
    </> : level === '企业' ? <Field label="归属范围" required><input value="全厂" readOnly /></Field> : <>
      {level === '二级用能单元' && <Field label="所属一级用能单元" required><select aria-label="所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请先选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
      <Field label={level === '一级用能单元' ? '归属范围' : '二级用能单元'} required><select aria-label={level === '一级用能单元' ? '归属范围' : '二级用能单元'} disabled={level === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{level === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : '请选择用能单元'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
    </>}
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{types.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field>
    <div className={styles.autoInfo}><span>能源分析类别 <strong>{type?.analysisCategory ?? '—'}</strong></span><span>计量单位 <strong>{type?.measurementUnit ?? '—'}</strong></span>{level !== '重点设备' && <span>归属对象 <strong>{level === '企业' ? '全厂' : selectedUnit?.energyUnitName ?? '—'}</strong></span>}</div>
    <div className={`${styles.full} ${styles.helpText}`}>按实际已取得月份填报；月度数据不完整时可补录年度总量，系统不会自动分摊缺失月份。</div>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => { const value = event.target.value; setValues((current) => current.map((item, i) => i === index ? value : item)); setReported((current) => current.map((item, i) => i === index ? value !== '' : item)); }} /></Field>)}</div>
    <div className={styles.full}><Field label={`${monthlyComplete ? '年度合计' : '年度总量补录'}${type ? `（${type.measurementUnit}）` : ''}`} required={!monthlyComplete}><input type="number" min="0" value={monthlyComplete ? String(monthlyTotal) : annualValue} readOnly={monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整或仅有年度台账时填写'} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function EnergyCostsPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [year, setYear] = useState('2026');
  const [typeId, setTypeId] = useState('');
  const [editing, setEditing] = useState<V11EnergyCost | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyCost | null>(null);
  const types = listV11EnergyTypes();
  const rows = listV11EnergyCosts().filter((item) => item.year === Number(year) && (!typeId || item.energyTypeId === typeId));
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <EnergyDataTabs active="costs" />
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增成本数据</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="能源品种"><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">全部</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    </Toolbar>
    <div className={styles.tableWrap}><table className={styles.costTable}><thead><tr><th>能源品种</th>{months.map((month) => <th key={month}>{month}成本（万元）</th>)}<th>年度合计（万元）</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.energyCostId}><td className={styles.strong}>{types.find((type) => type.energyTypeId === row.energyTypeId)?.energyTypeName}</td>{row.monthlyCosts.map((value, index) => <td key={index}>{format(value, 2)}</td>)}<td className={styles.number}>{format(annual(row.monthlyCosts), 2)}</td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>) : <EmptyRow colSpan={15} />}</tbody>
    </table></div><Pagination count={rows.length} />
  </section>
  {editing && <EnergyCostDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除成本数据" width={480} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11EnergyCost(deleting.energyCostId); setDeleting(null); setVersion((value) => value + 1); notify('成本数据已删除'); }}><div className={styles.warning}>确认删除当前能源成本数据吗？</div></Modal>}
  </Page>;
}
function EnergyCostDialog({ item, onClose, onSaved }: { item?: V11EnergyCost; onClose: () => void; onSaved: (message: string) => void }) {
  const types = listV11EnergyTypes();
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? '');
  const [values, setValues] = useState<string[]>(item?.monthlyCosts.map(String) ?? Array(12).fill(''));
  const [error, setError] = useState('');
  return <Modal title={item ? '编辑成本数据' : '新增成本数据'} width={820} onClose={onClose} onSubmit={() => {
    if (!typeId || values.some((value) => value === '')) return setError('请选择能源品种并完整填写12个月成本。');
    const result = saveV11EnergyCost({ year: 2026, energyTypeId: typeId, monthlyCosts: values.map(Number) }, item?.energyCostId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '成本数据已更新' : '成本数据已新增');
  }}><div className={styles.formGrid}>
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    <Field label="成本单位"><input value="万元" readOnly /></Field>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={`${month}成本`} required><input min="0" type="number" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div>
    <div className={`${styles.autoInfo} ${styles.full}`}>年度合计 <strong>{format(annual(values.map((value) => Number(value || 0))), 2)} 万元</strong></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function conversionTypeCopy(type: ConversionOutputType) {
  return type === '锅炉产汽/产热' ? '关联燃料投入并记录蒸汽/热力产出'
    : type === '余热发电' ? '回收余热后发电，余热量可选'
      : type === '自发电' ? '无燃料投入的光伏、风电等'
        : type === '回收利用' ? '回收蒸汽、热水、冷凝水等'
          : type === '直接外供' ? '已有能源量直接输出企业边界'
            : '其他真实能源形态转换';
}

function listConversionSystemCandidates() {
  return listEnergyUnits().filter(
    (unit) => unit.unitLevel === 'level2' && ['公辅系统', '其他'].includes(unit.unitType),
  );
}

function listScenarioConversionSystems(recordType: ConversionOutputType) {
  const candidates = listConversionSystemCandidates();
  if (recordType === '锅炉产汽/产热') return candidates.filter((unit) => unit.energyUnitName.includes('锅炉'));
  if (recordType === '余热发电' || recordType === '回收利用') return candidates.filter((unit) => /回收|余热/.test(unit.energyUnitName));
  if (recordType === '自发电') return candidates.filter((unit) => /光伏|风电|发电/.test(unit.energyUnitName));
  if (recordType === '其他转换') return candidates;
  return [];
}

function conversionQuantityLabel(recordType: ConversionOutputType, energyName: string) {
  if (recordType === '锅炉产汽/产热') return energyName === '蒸汽' ? '本次产汽量' : '本次供热量';
  if (recordType === '余热发电' || recordType === '自发电') return '本次发电量';
  if (recordType === '回收利用') return '本次回收利用量';
  return '本次产出量';
}

function conversionBalance(item: V11ConversionOutput) {
  if (item.recordType === '直接外供') {
    const source = listV11EnergyRecords().find((record) => record.energyRecordId === item.inputEnergyRecordId);
    const ok = Boolean(source) && item.externalAmount <= annual(source?.monthlyAmounts ?? [], source?.annualAmount ?? 0);
    return { tone: ok ? 'green' as const : 'orange' as const, text: ok ? '已平衡' : '需调整' };
  }
  const unallocated = (item.outputAmount ?? 0) - (item.internalAmount ?? 0) - item.externalAmount;
  if (unallocated < -1e-8) return { tone: 'orange' as const, text: '需调整' };
  if (unallocated > 1e-8) return { tone: 'orange' as const, text: '待确认' };
  return { tone: 'green' as const, text: '已平衡' };
}

function monthlyConversionText(values?: number[]) {
  return values?.length === 12 ? values.join(',') : '';
}

function parseMonthlyConversionText(value: string) {
  if (!value.trim()) return undefined;
  return value.split(/[,，\s]+/).filter(Boolean).map(Number);
}

function conversionInputText(item: V11ConversionOutput, records: V11EnergyRecord[], types: V11EnergyType[]) {
  if (item.recordType === '自发电') return { main: '—', sub: '无燃料投入' };
  if (item.inputMode === 'linked' || item.inputMode === 'direct') {
    const source = records.find((record) => record.energyRecordId === item.inputEnergyRecordId);
    const energy = types.find((type) => type.energyTypeId === source?.energyTypeId);
    return source
      ? { main: energy?.energyTypeName ?? '能源数据', sub: `关联能源数据：${v11ScopeName(source.energyUnitId)}｜${format(annual(source.monthlyAmounts, source.annualAmount), 2)} ${energy?.measurementUnit ?? ''}` }
      : { main: '来源记录不可用', sub: '请编辑该记录' };
  }
  if (item.inputMode === 'manual') {
    const energy = types.find((type) => type.energyTypeId === item.inputEnergyTypeId);
    return { main: energy?.energyTypeName ?? '手工投入', sub: `手工补充：${format(item.inputAmount ?? 0, 2)} ${item.inputUnit ?? ''}` };
  }
  return {
    main: item.recoveryEnergyName ?? '回收来源',
    sub: item.recoverySourceEnergyUnitId
      ? `${v11ScopeName(item.recoverySourceEnergyUnitId)}｜${item.recoveryAmount == null ? '未计量来源量' : `${format(item.recoveryAmount, 2)} ${item.recoveryUnit ?? ''}`}`
      : '未补充来源追溯信息',
  };
}

function EnergyConversionOutputPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [yearInput, setYearInput] = useState('2026');
  const [recordTypeInput, setRecordTypeInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [filters, setFilters] = useState({ year: '2026', recordType: '', keyword: '' });
  const [editing, setEditing] = useState<V11ConversionOutput | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11ConversionOutput | null>(null);
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const rows = listV11ConversionOutputs().filter((item) =>
    item.year === Number(filters.year)
    && (!filters.recordType || item.recordType === filters.recordType)
    && (!filters.keyword || `${v11ScopeName(item.conversionEnergyUnitId)}${v11ScopeName(item.recoverySourceEnergyUnitId ?? null)}`.includes(filters.keyword)),
  );
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <EnergyDataTabs active="relations" />
    <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, recordType: recordTypeInput, keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setRecordTypeInput(''); setKeywordInput(''); setFilters({ year: '2026', recordType: '', keyword: '' }); }}>重置</Button><Button primary onClick={() => setEditing('new')}>＋ 新增转换/输出记录</Button></>}>
      <Field label="数据年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="记录类型"><select value={recordTypeInput} onChange={(event) => setRecordTypeInput(event.target.value)}><option value="">全部</option>{conversionOutputTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
      <Field label="转换/来源单元"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="输入单元名称" /></Field>
    </Toolbar>
    <Notice><strong>能源转换与输出：</strong>锅炉产汽/产热、余热发电、自发电、回收利用及其他转换均属于“转换与回收利用场景”，在一条业务记录中维护投入、产出和去向；直接外供仅用于已有能源直接离开企业边界。锅炉等燃料投入优先关联“能源量数据”中的已有记录，避免重复填写。</Notice>
    <div className={styles.conversionGuide}>
      {conversionOutputTypes.slice(0, 5).map((type) => <div className={styles.conversionGuideCard} key={type}><strong>{type}</strong><span>{type === '锅炉产汽/产热' ? '关联锅炉已有燃料数据，填写蒸汽或热力产出及去向。' : type === '余热发电' ? '填写余热来源与发电量；余热量未计量时可留空。' : type === '自发电' ? '光伏、风电等无燃料投入发电，记录内部消纳与外供。' : type === '回收利用' ? '回收蒸汽、热水、冷凝水、压力能等直接利用场景。' : '仅用于非转换产出的能源直接离开企业边界；转换产出的外供量在原记录中填写。'}</span></div>)}
    </div>
    <div className={styles.sectionToolbar}><div><h3>能源转换与输出台账</h3><p>一条业务记录仅维护一次投入、产出和能源去向。</p></div><span>共 {rows.length} 条</span></div>
    <div className={styles.tableWrap}><table className={styles.conversionTable}><thead><tr><th>记录类型</th><th>转换/来源单元</th><th>投入或回收来源</th><th>产出/回收能源</th><th>内部使用</th><th>外供量</th><th>去向状态</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => {
        const input = conversionInputText(row, records, types);
        const balance = conversionBalance(row);
        const source = records.find((record) => record.energyRecordId === row.inputEnergyRecordId);
        const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
        const outputName = row.recordType === '直接外供' ? sourceType?.energyTypeName ?? '外供能源' : row.outputEnergyName ?? types.find((type) => type.energyTypeId === row.outputEnergyTypeId)?.energyTypeName ?? '—';
        const outputUnit = row.recordType === '直接外供' ? sourceType?.measurementUnit ?? '' : row.outputUnit ?? '';
        const outputAmount = row.recordType === '直接外供' ? row.externalAmount : row.outputAmount ?? 0;
        return <tr key={row.conversionOutputId}><td><Tag tone={row.recordType === '自发电' ? 'orange' : row.recordType === '锅炉产汽/产热' ? 'blue' : row.recordType === '回收利用' ? 'gray' : 'green'}>{row.recordType === '锅炉产汽/产热' ? '锅炉产汽' : row.recordType}</Tag></td><td className={styles.strong}>{row.recordType === '直接外供' ? '企业边界' : v11ScopeName(row.conversionEnergyUnitId)}</td><td><b className={styles.conversionSourceMain}>{input.main}</b><small className={styles.subText}>{input.sub}</small></td><td><b className={styles.conversionSourceMain}>{outputName}</b><small className={styles.subText}><span className={styles.number}>{format(outputAmount, 2)}</span> {outputUnit}</small></td><td>{row.recordType === '直接外供' ? '—' : `${format(row.internalAmount ?? 0, 2)} ${outputUnit}`}</td><td>{format(row.externalAmount, 2)} {outputUnit}</td><td><Tag tone={balance.tone}>{balance.text}</Tag></td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>;
      }) : <EmptyRow colSpan={8} />}</tbody>
    </table></div><Pagination count={rows.length} />
  </section>
  {editing && <ConversionOutputDialog key={editing === 'new' ? 'new' : editing.conversionOutputId} item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onEditExisting={(existing) => setEditing(existing)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除能源转换/输出记录" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11ConversionOutput(deleting.conversionOutputId); setDeleting(null); setVersion((value) => value + 1); notify('能源转换/输出记录已删除'); }}><div className={styles.warning}>确认删除该能源转换/输出记录吗？关联的能源量数据不会被删除。</div></Modal>}
  </Page>;
}

function ConversionOutputDialog({ item, onClose, onEditExisting, onSaved }: { item?: V11ConversionOutput; onClose: () => void; onEditExisting: (existing: V11ConversionOutput) => void; onSaved: (message: string) => void }) {
  const navigate = useNavigate();
  const units = listEnergyUnits();
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const [recordType, setRecordType] = useState<ConversionOutputType>(item?.recordType ?? '锅炉产汽/产热');
  const [year, setYear] = useState(String(item?.year ?? 2026));
  const [unitId, setUnitId] = useState(item?.conversionEnergyUnitId ?? '');
  const [inputMode, setInputMode] = useState<ConversionInputMode>(item?.inputMode === 'manual' ? 'linked' : item?.inputMode ?? 'linked');
  const [inputRecordId, setInputRecordId] = useState(item?.inputEnergyRecordId ?? '');
  const [recoveryTraceVisible, setRecoveryTraceVisible] = useState(Boolean(item?.recoverySourceEnergyUnitId || item?.recoveryAmount != null));
  const [recoverySourceId, setRecoverySourceId] = useState(item?.recoverySourceEnergyUnitId ?? '');
  const [recoveryEnergy, setRecoveryEnergy] = useState(item?.recoveryEnergyName ?? '余热');
  const [recoveryAmount, setRecoveryAmount] = useState(item?.recoveryAmount == null ? '' : String(item.recoveryAmount));
  const [recoveryUnit, setRecoveryUnit] = useState(item?.recoveryUnit ?? 'GJ');
  const [outputCategory, setOutputCategory] = useState<AnalysisCategory>(item?.outputAnalysisCategory ?? '热力');
  const [outputEnergyName, setOutputEnergyName] = useState(item?.outputEnergyName ?? '蒸汽');
  const [outputUnit, setOutputUnit] = useState(item?.outputUnit ?? 'GJ');
  const [outputAmount, setOutputAmount] = useState(String(item?.outputAmount ?? 0));
  const [internalAmount, setInternalAmount] = useState(String(item?.internalAmount ?? 0));
  const [externalAmount, setExternalAmount] = useState(String(item?.externalAmount ?? 0));
  const [monthlyInputAmounts, setMonthlyInputAmounts] = useState(monthlyConversionText(item?.monthlyInputAmounts));
  const [monthlyOutputAmounts, setMonthlyOutputAmounts] = useState(monthlyConversionText(item?.monthlyOutputAmounts));
  const [monthlyInternalAmounts, setMonthlyInternalAmounts] = useState(monthlyConversionText(item?.monthlyInternalAmounts));
  const [monthlyExternalAmounts, setMonthlyExternalAmounts] = useState(monthlyConversionText(item?.monthlyExternalAmounts));
  const [receiver, setReceiver] = useState(item?.receiver ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const conversionUnits = recordType === '直接外供' ? [] : listScenarioConversionSystems(recordType);
  const existingRecord = !item ? listV11ConversionOutputs().find((record) => record.year === Number(year) && record.recordType === recordType && record.conversionEnergyUnitId === (recordType === '直接外供' ? null : unitId)) : undefined;
  const linkedCandidates = records.filter((record) => record.year === Number(year) && record.energyUnitId === unitId && (recordType !== '锅炉产汽/产热' || ['化石燃料', '可再生及替代能源'].includes(types.find((type) => type.energyTypeId === record.energyTypeId)?.analysisCategory ?? '')));
  const directCandidates = records.filter((record) => record.year === Number(year) && record.scopeLevel === '企业');
  const outputOptions = [
    ...types.filter((type) => type.analysisCategory === outputCategory).map((type) => type.energyTypeName),
    ...(outputCategory === '回收能源' ? ['冷凝水', '回收热水', '可燃尾气', '压力能'] : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const outputValue = Number(outputAmount || 0);
  const internalValue = Number(internalAmount || 0);
  const externalValue = Number(externalAmount || 0);
  const unallocatedAmount = outputValue - internalValue - externalValue;
  const hasOverAllocated = unallocatedAmount < -1e-8;
  const source = records.find((record) => record.energyRecordId === inputRecordId);
  const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
  const linkedCandidate = linkedCandidates.length === 1 ? linkedCandidates[0] : undefined;
  const soleOutputOption = outputOptions.length === 1 ? outputOptions[0] : undefined;
  useEffect(() => {
    if (recordType === '直接外供') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the dependent unit selection valid after its source changes.
    if (conversionUnits.length === 1 && unitId !== conversionUnits[0].energyUnitId) setUnitId(conversionUnits[0].energyUnitId);
    if (conversionUnits.length > 1 && unitId && !conversionUnits.some((unit) => unit.energyUnitId === unitId)) setUnitId('');
    if (conversionUnits.length === 0 && unitId) setUnitId('');
  }, [recordType, unitId, conversionUnits]);
  useEffect(() => {
    if (recordType !== '锅炉产汽/产热' && recordType !== '其他转换') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the linked energy record in sync with the selected conversion context.
    if (linkedCandidate && inputRecordId !== linkedCandidate.energyRecordId) setInputRecordId(linkedCandidate.energyRecordId);
    if (linkedCandidates.length !== 1 && inputRecordId && !linkedCandidates.some((record) => record.energyRecordId === inputRecordId)) setInputRecordId('');
  }, [recordType, year, unitId, inputRecordId, linkedCandidate, linkedCandidates]);
  useEffect(() => {
    if (!soleOutputOption || outputEnergyName === soleOutputOption) return;
    const energyType = types.find((type) => type.energyTypeName === soleOutputOption && type.analysisCategory === outputCategory);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply the only valid output energy option when its category changes.
    setOutputEnergyName(soleOutputOption);
    setOutputUnit(energyType?.measurementUnit ?? '');
  }, [soleOutputOption, outputEnergyName, outputCategory, types]);
  const selectType = (next: ConversionOutputType) => {
    setRecordType(next);
    setError('');
    setUnitId('');
    setInputMode(next === '自发电' ? 'none' : next === '余热发电' || next === '回收利用' ? 'recovery' : next === '直接外供' ? 'direct' : 'linked');
    setRecoveryTraceVisible(false);
    setInputRecordId('');
    const nextCategory: AnalysisCategory = next === '锅炉产汽/产热' ? '热力' : next === '余热发电' || next === '自发电' ? '电力' : next === '回收利用' ? '回收能源' : '电力';
    const nextName = next === '锅炉产汽/产热' ? '蒸汽' : next === '余热发电' || next === '自发电' ? '电力' : next === '回收利用' ? '回收热水' : '电力';
    setOutputCategory(nextCategory); setOutputEnergyName(nextName); setOutputUnit(next === '锅炉产汽/产热' ? 't' : next === '回收利用' ? 'GJ' : 'kWh');
  };
  const save = () => {
    setError('');
    if (existingRecord) return;
    if (recordType === '直接外供') {
      const directSource = records.find((record) => record.energyRecordId === inputRecordId);
      if (!directSource || Number(externalAmount) <= 0) return setError('请选择外供来源能源数据并填写外供量。');
      const result = saveV11ConversionOutput({ year: Number(year), recordType, conversionEnergyUnitId: null, inputMode: 'direct', inputEnergyRecordId: inputRecordId, externalAmount: Number(externalAmount), receiver, remark: '' }, item?.conversionOutputId);
      if (!result.ok) return setError(result.error);
      return onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
    }
    if (!unitId || outputValue <= 0) return setError('请选择实际转换/来源单元，并填写产出或回收总量。');
    if (hasOverAllocated) return setError('内部使用量与外供量不能大于产出总量。');
    if ((recordType === '锅炉产汽/产热' || recordType === '其他转换') && !inputRecordId) return setError('当前系统暂无可关联的能源数据，请先补录后再保存。');
    const outputType = types.find((type) => type.energyTypeName === outputEnergyName && type.analysisCategory === outputCategory);
    const monthlyInput = parseMonthlyConversionText(monthlyInputAmounts);
    const monthlyOutput = parseMonthlyConversionText(monthlyOutputAmounts);
    const monthlyInternal = parseMonthlyConversionText(monthlyInternalAmounts);
    const monthlyExternal = parseMonthlyConversionText(monthlyExternalAmounts);
    if ([monthlyInput, monthlyOutput, monthlyInternal, monthlyExternal].some((values) => values && values.length !== 12)) {
      return setError('月度数据请按1月至12月填写12个数值，多个数值用逗号分隔。');
    }
    const result = saveV11ConversionOutput({
      year: Number(year), recordType, conversionEnergyUnitId: unitId, inputMode,
      inputEnergyRecordId: inputMode === 'linked' ? inputRecordId : undefined,
      recoverySourceEnergyUnitId: inputMode === 'recovery' && recoveryTraceVisible && recoverySourceId ? recoverySourceId : undefined,
      recoveryEnergyName: inputMode === 'recovery' ? recoveryEnergy : undefined,
      recoveryAmount: inputMode === 'recovery' && recoveryTraceVisible ? recoveryAmount === '' ? null : Number(recoveryAmount) : undefined,
      recoveryUnit: inputMode === 'recovery' ? recoveryUnit : undefined,
      outputAnalysisCategory: outputCategory, outputEnergyTypeId: outputType?.energyTypeId, outputEnergyName, outputUnit,
      outputAmount: outputValue, internalAmount: internalValue, externalAmount: externalValue, lossAmount: Math.max(unallocatedAmount, 0), remark,
      monthlyInputAmounts: monthlyInput, monthlyOutputAmounts: monthlyOutput, monthlyInternalAmounts: monthlyInternal, monthlyExternalAmounts: monthlyExternal,
    }, item?.conversionOutputId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
  };
  return <Modal title={item ? '编辑能源转换/输出记录' : '新增能源转换/输出记录'} width={1040} onClose={onClose} onSubmit={save}>
    <div className={styles.conversionModalIntro}><i>i</i><span>记录类型决定本次录入字段与校验规则；请从企业已维护的二级公辅系统中选择实际发生转换、回收或发电的系统。</span></div>
    <div className={styles.compactGrid}>
      <Field label="记录类型" required><select value={recordType} onChange={(event) => selectType(event.target.value as ConversionOutputType)}>{conversionOutputTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
      <Field label="数据年度" required><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label={recordType === '直接外供' ? '业务归属' : '转换/来源单元'} required>{recordType === '直接外供' ? <input value="企业边界" readOnly /> : conversionUnits.length === 1 ? <input value={conversionUnits[0].energyUnitName} readOnly /> : <select value={unitId} onChange={(event) => { setUnitId(event.target.value); setInputRecordId(''); }} disabled={conversionUnits.length === 0}>{conversionUnits.length === 0 ? <option>暂无适用系统</option> : <><option value="">请选择</option>{conversionUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select>}</Field>
    </div>
    <p className={styles.sceneDescription}>{conversionTypeCopy(recordType)}</p>
    {recordType === '直接外供' ? <div className={styles.conversionFormSection}><h3>外供来源</h3><div className={`${styles.formGrid} ${styles.conversionFormBody}`}>
      <Field label="关联已有能源量数据" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择</option>{directCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{v11ScopeName(record.energyUnitId)}｜{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select></Field>
      <Field label="本次外供量" required><input type="number" min="0" value={externalAmount} onChange={(event) => setExternalAmount(event.target.value)} /></Field>
      <Field label="接收方"><input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="选填" /></Field>
      <div className={`${styles.sourceLocked} ${styles.full}`}>{source ? <>来源：<strong>{v11ScopeName(source.energyUnitId)}｜{sourceType?.energyTypeName}｜{format(annual(source.monthlyAmounts, source.annualAmount), 2)} {sourceType?.measurementUnit}</strong><br />直接外供仅关联企业级能源输入记录；转换产出的外供请在对应转换记录中填写。</> : '暂无可关联能源量数据，请先新增能源数据。'}</div>
    </div></div> : <>
      {(recordType === '锅炉产汽/产热' || recordType === '其他转换') && <div className={styles.conversionFormSection}><h3>投入能源</h3><div className={styles.conversionFormBody}>
        {linkedCandidate ? <><Field label="关联能源记录" required><input value={`${types.find((value) => value.energyTypeId === linkedCandidate.energyTypeId)?.energyTypeName ?? '能源数据'}｜${format(annual(linkedCandidate.monthlyAmounts, linkedCandidate.annualAmount), 2)} ${types.find((value) => value.energyTypeId === linkedCandidate.energyTypeId)?.measurementUnit ?? ''}`} readOnly /></Field><div className={styles.linkedPreview}>系统已自动关联当前系统唯一的能源数据。</div></> : linkedCandidates.length > 1 ? <><Field label="关联能源记录" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择已有能源数据</option>{linkedCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select></Field><div className={styles.inlineLinkRow}><span>当前系统存在多条可用能源数据，请确认本次实际投入来源。</span></div></> : <div className={styles.inlineLinkRow}><span>当前年度和系统下暂无可关联的能源数据。</span><button type="button" onClick={() => { onClose(); navigate('/data-management/energy-data'); }}>前往补录能源数据</button></div>}
      </div></div>}
      {(recordType === '余热发电' || recordType === '回收利用') && <div className={styles.conversionFormSection}><h3>回收信息</h3><div className={styles.conversionFormBody}><div className={styles.compactGrid}><Field label="回收能源/介质" required><select value={recoveryEnergy} onChange={(event) => { setRecoveryEnergy(event.target.value); setRecoveryUnit(['余热', '压力能'].includes(event.target.value) ? 'GJ' : event.target.value === '可燃尾气' ? 'Nm³' : 't'); }}>{recoveryEnergyOptions.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="计量单位"><input value={recoveryUnit} readOnly /></Field></div><button type="button" className={styles.advancedToggle} onClick={() => setRecoveryTraceVisible((value) => !value)}>{recoveryTraceVisible ? '收起补充追溯信息' : '补充来源追溯信息（选填）'}</button>{recoveryTraceVisible && <div className={`${styles.compactGrid} ${styles.advancedBody}`}><Field label="回收来源单元"><select value={recoverySourceId} onChange={(event) => setRecoverySourceId(event.target.value)}><option value="">请选择（选填）</option>{units.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field><Field label="回收来源量"><input type="number" min="0" value={recoveryAmount} onChange={(event) => setRecoveryAmount(event.target.value)} placeholder="未计量可留空" /></Field></div>}<div className={styles.helpText}>{recordType === '余热发电' ? '未计量余热量时，可直接填写发电量。' : '来源单元仅用于补充追溯，不影响回收量录入。'}</div></div></div>}
      <div className={styles.conversionFormSection}><h3>{recordType === '回收利用' ? '回收量与去向' : '产出能源与去向'}</h3><div className={`${styles.compactGrid} ${styles.conversionFormBody}`}>{recordType === '其他转换' ? <Field label="能源分析类别" required><select value={outputCategory} onChange={(event) => { const category = event.target.value as AnalysisCategory; const next = types.find((type) => type.analysisCategory === category); setOutputCategory(category); setOutputEnergyName(next?.energyTypeName ?? ''); setOutputUnit(next?.measurementUnit ?? ''); }}>{categories.map((value) => <option key={value}>{value}</option>)}</select></Field> : <Field label="能源分析类别"><input value={outputCategory} readOnly /></Field>}<Field label="能源品种" required>{soleOutputOption ? <input value={soleOutputOption} readOnly /> : <select value={outputEnergyName} onChange={(event) => { const name = event.target.value; const type = types.find((value) => value.energyTypeName === name); setOutputEnergyName(name); setOutputUnit(type?.measurementUnit ?? (name === '回收热水' ? 'GJ' : '')); }}>{outputOptions.map((value) => <option key={value}>{value}</option>)}</select>}</Field><Field label="单位"><input value={outputUnit} readOnly /></Field><Field label={conversionQuantityLabel(recordType, outputEnergyName)} required><input type="number" min="0" value={outputAmount} onChange={(event) => setOutputAmount(event.target.value)} /></Field><Field label="内部使用量" required><input type="number" min="0" value={internalAmount} onChange={(event) => setInternalAmount(event.target.value)} /></Field><Field label="外供量"><input type="number" min="0" value={externalAmount} onChange={(event) => setExternalAmount(event.target.value)} /></Field><div className={`${styles.balanceBox} ${hasOverAllocated ? styles.balanceWarn : ''} ${styles.full}`}><div><strong>{hasOverAllocated ? '去向量超过本次产出量' : unallocatedAmount > 0 ? `待确认差额：${format(unallocatedAmount, 2)} ${outputUnit}` : '本次产出量已全部归属'}</strong><p>{hasOverAllocated ? '请调整内部使用量或外供量。' : '系统按本次产出、内部使用和外供自动计算管理差额，不需要手工录入。'}</p></div><Tag tone={hasOverAllocated ? 'orange' : unallocatedAmount > 0 ? 'orange' : 'green'}>{hasOverAllocated ? '需调整' : unallocatedAmount > 0 ? '待确认' : '已平衡'}</Tag></div></div></div>
      <div className={styles.conversionFormSection}><h3>月度转换数据（选填）</h3><div className={styles.conversionFormBody}><div className={styles.monthlyHint}>按1月至12月顺序填写，多个数值用逗号分隔；未填写时，关联上游能源记录可按其月度数据计算。</div><div className={styles.compactGrid}><Field label="月度投入量"><input value={monthlyInputAmounts} onChange={(event) => setMonthlyInputAmounts(event.target.value)} placeholder="如：100,120,……" /></Field><Field label="月度产出量"><input value={monthlyOutputAmounts} onChange={(event) => setMonthlyOutputAmounts(event.target.value)} placeholder="如：100,120,……" /></Field><Field label="月度内部使用量"><input value={monthlyInternalAmounts} onChange={(event) => setMonthlyInternalAmounts(event.target.value)} placeholder="如：90,110,……" /></Field><Field label="月度外供量"><input value={monthlyExternalAmounts} onChange={(event) => setMonthlyExternalAmounts(event.target.value)} placeholder="如：10,10,……" /></Field></div></div></div>
      <div className={styles.conversionRemark}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></div>
    </>}
    {existingRecord && <div className={styles.duplicateRecordNotice}><span>{year} 年度“{recordType}”在“{recordType === '直接外供' ? '企业边界' : v11ScopeName(unitId)}”已维护。请直接编辑已有记录后再调整数据。</span><button type="button" onClick={() => onEditExisting(existingRecord)}>编辑已有记录</button></div>}
    {error && <div className={styles.error}>{error}</div>}
  </Modal>;
}

function OperationsPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const requestedScopeLevel = params.get('scopeLevel');
  const requestedScope = requestedScopeLevel === '一级用能单元' || requestedScopeLevel === '二级用能单元' ? requestedScopeLevel : undefined;
  const requestedUnitId = params.get('unitId') ?? '';
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [yearInput, setYearInput] = useState(params.get('year') ?? '2026');
  const [categoryInput, setCategoryInput] = useState('');
  const [keywordInput, setKeywordInput] = useState(params.get('keyword') ?? '');
  const [filters, setFilters] = useState({ year: params.get('year') ?? '2026', category: '', keyword: params.get('keyword') ?? '' });
  const [level, setLevel] = useState<OperationScopeView>(requestedScope ?? '全部层级');
  const [newScopeLevel, setNewScopeLevel] = useState<ScopeLevel | null>(requestedScope ?? null);
  const [newUnitId, setNewUnitId] = useState(requestedUnitId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11OperationMetric | 'new' | null>(() => params.get('new') === '1' ? 'new' : null);
  const [deleting, setDeleting] = useState<V11OperationMetric | null>(null);
  const products = listProducts();
  const productNames = new Map(products.map((product) => [product.productId, product.productName]));
  const matchesFilters = (item: V11OperationMetric) => item.year === Number(filters.year)
    && (!filters.category || item.metricCategory === filters.category)
    && (!filters.keyword || `${v11ScopeName(item.energyUnitId)}${item.metricName}${item.productId ? productNames.get(item.productId) ?? '' : ''}`.includes(filters.keyword));
  const operationRecords = listV11OperationMetrics();
  const rows = operationRecords.filter((item) => matchesFilters(item) && (level === '全部层级' || item.scopeLevel === level));
  const countForLevel = (item: OperationScopeView) => operationRecords.filter((record) => matchesFilters(record) && (item === '全部层级' || record.scopeLevel === item)).length;
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, category: categoryInput, keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setCategoryInput(''); setKeywordInput(''); setLevel('全部层级'); setFilters({ year: '2026', category: '', keyword: '' }); }}>重置</Button>{level === '全部层级' ? <span className={styles.entryHint}>请选择具体层级页签后录入</span> : <Button primary onClick={() => { setNewScopeLevel(level); setEditing('new'); }}>＋ 新增运营数据</Button>}</>}>
      <Field label="年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="指标类别"><select value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option><option>产量</option><option>经济指标</option></select></Field>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="产品 / 归属范围 / 指标名称" /></Field>
    </Toolbar>
    <div className={styles.levelTabs}>{operationLevels.map((item) => <button type="button" key={item} className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{item}（{countForLevel(item)}）</button>)}</div>
    <Notice><strong>说明：</strong>产量可在企业、一级或二级用能单元层级维护；经济指标仅在企业层级维护。“全部层级”用于汇总查看，不提供录入入口。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>归属范围</th><th>指标类别</th><th>指标名称</th><th>产品</th><th>单位</th><th>年度值</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.flatMap((row) => {
      const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
      return [<tr key={row.operationMetricId}><td className={styles.strong}>{v11ScopeName(row.energyUnitId)}<small className={styles.subText}>{row.scopeLevel}</small></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} viewLabel="月度明细" onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
      detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
    }) : <EmptyRow colSpan={7} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <OperationDialog item={editing === 'new' ? undefined : editing} dataYear={Number(filters.year)} scopeContext={editing === 'new' ? newScopeLevel ?? undefined : undefined} initialUnitId={editing === 'new' ? newUnitId : undefined} onClose={() => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); }} onSaved={(message) => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除运营数据" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11OperationMetric(deleting.operationMetricId); setDeleting(null); setVersion((value) => value + 1); notify('运营数据已删除，相关分析将按最新数据重新计算'); }}><div className={styles.warning}>确认删除“{deleting.metricName}”数据吗？删除后会影响相关能耗强度、能效对标和分析结果。</div></Modal>}
  </Page>;
}

function OperationDialog({ item, dataYear, scopeContext, initialUnitId, onClose, onSaved }: { item?: V11OperationMetric; dataYear: number; scopeContext?: ScopeLevel; initialUnitId?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const products = listProducts();
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const initialMetricPreset = item
    ? metricPresets[item.metricCategory].find((entry) => entry[0] === item.metricName)
    : undefined;
  const scopedCreation = !item && !!scopeContext;
  const [category, setCategory] = useState<V11OperationMetric['metricCategory']>(item?.metricCategory ?? '产量');
  const [preset, setPreset] = useState(item ? initialMetricPreset?.[0] ?? '其他（自定义）' : '');
  const [customName, setCustomName] = useState(item && !initialMetricPreset ? item.metricName : '');
  const [productId, setProductId] = useState(item?.productId ?? '');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('通用工业产品');
  const [newProductUnit, setNewProductUnit] = useState('t');
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(item?.scopeLevel ?? scopeContext ?? '企业');
  const [unitId, setUnitId] = useState(item ? item.energyUnitId ?? '__enterprise__' : initialUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : '');
  const [metricUnit, setMetricUnit] = useState(item?.metricUnit ?? '');
  const [values, setValues] = useState<string[]>(item?.monthlyValues.map(String) ?? Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualValue || ''));
  const [error, setError] = useState('');
  const custom = preset === '其他（自定义）';
  const annualMode = category === '经济指标';
  const allowEconomicMetric = !scopedCreation || scopeContext === '企业';
  const productOutput = category === '产量' && preset === '产品产量';
  const enterpriseScope = scopeLevel === '企业';
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = scopeLevel === '一级用能单元'
    ? levelOneUnits
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  const recordYear = item?.year ?? dataYear;
  return <Modal title={item ? '编辑运营数据' : `新增运营数据（${recordYear}年度）`} width={820} onClose={onClose} onSubmit={() => {
    const name = productOutput ? '产品产量' : custom ? customName.trim() : preset;
    if (!name || !metricUnit || (!annualMode && !enterpriseScope && !unitId) || (productOutput && !productId)) return setError('请完整填写必填字段。');
    const monthNumbers = values.map((value) => Number(value || 0));
    if (!annualMode && !monthNumbers.some((value) => value > 0)) return setError('月度填报至少填写一个月份。');
    if (annualMode && !(Number(annualValue) > 0)) return setError('请填写年度值。');
    let resolvedProductId: string | null = productOutput ? productId : null;
    if (productOutput && productId === '__new__') {
      if (!newProductName.trim() || !newProductUnit.trim()) return setError('请填写新产品名称和计量单位。');
      const created = saveProduct({
        productName: newProductName.trim(),
        productCategory: newProductCategory.trim() || '通用工业产品',
        unit: newProductUnit.trim(),
        linkedEnergyUnitIds: [],
        allocationMode: 'exclusive',
        energyAllocations: [],
        directEnergyRecordIds: [],
        status: 'active',
      });
      if (!created.ok) return setError(created.error);
      resolvedProductId = created.productId;
    }
    if (productOutput && resolvedProductId && unitId && !enterpriseScope) {
      const linked = linkProductEnergyUnit(resolvedProductId, unitId);
      if (!linked.ok) return setError(linked.error);
    }
    const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
    const metricCode = productOutput
      ? 'product_output'
      : item?.metricCode ?? (name === '工业增加值' ? 'industrial_added_value' : `custom_${name}`);
    const result = saveV11OperationMetric({ year: recordYear, scopeLevel: annualMode || enterpriseScope ? '企业' : selectedUnit?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元', energyUnitId: annualMode || enterpriseScope ? null : unitId, metricCategory: category, aggregationMethod: annualMode ? '年度单值' : '月度求和', metricCode, productId: resolvedProductId, metricName: name, metricUnit, entryMode: annualMode ? 'annual' : 'monthly', monthlyValues: annualMode ? [] : monthNumbers, annualValue: annualMode ? Number(annualValue) : 0 }, item?.operationMetricId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '运营数据已更新' : '运营数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}><span>数据年度 <strong>{recordYear}年</strong></span></div>
    <Field label="指标类别" required>{allowEconomicMetric ? <select value={category} onChange={(event) => { const next = event.target.value as V11OperationMetric['metricCategory']; setCategory(next); setPreset(''); setProductId(''); setMetricUnit(''); if (next === '经济指标') { setScopeLevel('企业'); setUnitId(''); setParentUnitId(''); } }}><option>产量</option><option>经济指标</option></select> : <input value="产量" readOnly />}</Field>
    <Field label="指标名称" required><select value={preset} onChange={(event) => { const value = event.target.value; setPreset(value); const option = metricPresets[category].find((entry) => entry[0] === value); if (option) setMetricUnit(option[1]); }}><option value="">请选择指标</option>{metricPresets[category].map(([name]) => <option key={name}>{name}</option>)}</select></Field>
    {custom && <Field label="自定义指标名称" required><input value={customName} onChange={(event) => setCustomName(event.target.value)} /></Field>}
    {productOutput && <Field label="产品" required><select value={productId} onChange={(event) => {
      const value = event.target.value;
      setProductId(value);
      const product = getProduct(value);
      if (product) setMetricUnit(product.unit);
      if (value === '__new__') setMetricUnit(newProductUnit);
    }}><option value="">请选择产品</option>{products.map((product) => <option key={product.productId} value={product.productId} disabled={product.status === 'inactive'}>{product.productName}{product.status === 'inactive' ? '（已停用）' : ''}</option>)}<option value="__new__">＋ 新增自定义产品</option></select></Field>}
    {productOutput && productId === '__new__' && <>
      <Field label="新产品名称" required><input value={newProductName} onChange={(event) => setNewProductName(event.target.value)} placeholder="例如：产品D" /></Field>
      <Field label="产品类别"><input value={newProductCategory} onChange={(event) => setNewProductCategory(event.target.value)} /></Field>
      <Field label="产品计量单位" required><input value={newProductUnit} onChange={(event) => { setNewProductUnit(event.target.value); setMetricUnit(event.target.value); }} placeholder="t / 件 / 台" /></Field>
    </>}
    <Field label="归属层级" required>{scopedCreation ? <input aria-label="运营数据归属层级" value={scopeLevel} readOnly /> : <select aria-label="运营数据归属层级" disabled={annualMode} value={annualMode ? '企业' : scopeLevel} onChange={(event) => { setScopeLevel(event.target.value as ScopeLevel); setUnitId(''); setParentUnitId(''); }}><option>企业</option><option>一级用能单元</option><option>二级用能单元</option></select>}</Field>
    {scopeLevel === '二级用能单元' && !annualMode && <Field label="所属一级用能单元" required><select aria-label="运营数据所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请先选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
    <Field label="归属范围" required>{annualMode || scopeLevel === '企业' ? <input value="全厂" readOnly /> : <select aria-label="运营数据归属范围" disabled={scopeLevel === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{scopeLevel === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : '请选择归属范围'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select>}</Field>
    <Field label="计量单位" required><input value={metricUnit} readOnly={!custom && productId !== '__new__'} onChange={(event) => setMetricUnit(event.target.value)} /></Field>
    <div className={styles.autoInfo}><span>汇总方式 <strong>{annualMode ? '年度单值' : '月度求和'}</strong></span><span>录入方式 <strong>{annualMode ? '年度填报' : '月度填报'}</strong></span></div>
    {annualMode ? <div className={styles.full}><Field label="年度值" required><input type="number" min="0" value={annualValue} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div> : <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div>}
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function DevicesPage() {
  const navigate = useNavigate();
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [levelOneUnitIdInput, setLevelOneUnitIdInput] = useState('');
  const [unitIdInput, setUnitIdInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<AnalysisCategory | ''>('');
  const [typeIdInput, setTypeIdInput] = useState('');
  const [filters, setFilters] = useState<{ keyword: string; levelOneUnitId: string; unitId: string; category: AnalysisCategory | ''; typeId: string }>({ keyword: '', levelOneUnitId: '', unitId: '', category: '', typeId: '' });
  const [editing, setEditing] = useState<V11KeyDevice | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11KeyDevice | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<V11KeyDevice | null>(null);
  const [collapsedLevelOneIds, setCollapsedLevelOneIds] = useState<string[]>([]);
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const energyRecords = listV11EnergyRecords();
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const childUnits = units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === levelOneUnitIdInput);
  const categoryTypes = types.filter((type) => type.analysisCategory === categoryInput);
  const rows = listV11KeyDevices().filter((item) => {
    const deviceUnit = units.find((unit) => unit.energyUnitId === item.energyUnitId);
    const isUnderSelectedLevelOne = !filters.levelOneUnitId || item.energyUnitId === filters.levelOneUnitId || deviceUnit?.parentEnergyUnitId === filters.levelOneUnitId;
    const deviceEnergyType = types.find((type) => type.energyTypeId === item.mainEnergyTypeId);
    return (!filters.keyword || `${item.deviceName}${item.deviceType}`.includes(filters.keyword)) &&
      isUnderSelectedLevelOne &&
      (!filters.unitId || item.energyUnitId === filters.unitId) &&
      (!filters.category || deviceEnergyType?.analysisCategory === filters.category) &&
      (!filters.typeId || item.mainEnergyTypeId === filters.typeId);
  });
  const groupedRows = levelOneUnits.map((levelOneUnit) => {
    const children = units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === levelOneUnit.energyUnitId);
    const directDevices = rows.filter((device) => device.energyUnitId === levelOneUnit.energyUnitId);
    const childGroups = children.map((unit) => ({ unit, devices: rows.filter((device) => device.energyUnitId === unit.energyUnitId) })).filter((group) => group.devices.length);
    return { unit: levelOneUnit, directDevices, childGroups };
  }).filter((group) => group.directDevices.length || group.childGroups.length);
  void version;
  const blockedInspection = deleteBlocked ? inspectV11KeyDeviceDeletion(deleteBlocked.deviceId) : null;
  const blockedReferences = blockedInspection && !blockedInspection.ok ? blockedInspection.references : null;

  const openBlockedDeviceEnergyData = () => {
    if (!deleteBlocked) return;
    const deviceId = deleteBlocked.deviceId;
    setDeleteBlocked(null);
    navigate(`/data-management/energy-data?scope=device&deviceId=${deviceId}`);
  };

  const openBlockedDeviceTargets = () => {
    if (!deleteBlocked) return;
    const deviceId = deleteBlocked.deviceId;
    setDeleteBlocked(null);
    navigate(`/energy-analysis/benchmarking?objectType=device&objectId=${deviceId}`);
  };

  const renderDeviceRow = (row: V11KeyDevice) => {
    const deviceRecords = energyRecords.filter((record) => v11RecordScopeType(record) === 'device' && record.scopeId === row.deviceId && record.year === 2026);
    const primaryRecord = deviceRecords.find((record) => record.energyTypeId === row.mainEnergyTypeId) ?? deviceRecords[0];
    const progress = primaryRecord ? primaryRecord.entryMode === 'annual' ? 12 : primaryRecord.monthlyAmounts.filter((value) => value > 0).length : 0;
    const total = primaryRecord ? annual(primaryRecord.monthlyAmounts, primaryRecord.annualAmount) : 0;
    const energyType = types.find((type) => type.energyTypeId === (primaryRecord?.energyTypeId ?? row.mainEnergyTypeId));
    const maintain = () => navigate(`/data-management/energy-data?scope=device&deviceId=${row.deviceId}${primaryRecord ? '' : '&new=1'}`);
    const requestDelete = () => {
      const inspection = inspectV11KeyDeviceDeletion(row.deviceId);
      if (!inspection.ok) return setDeleteBlocked(row);
      setDeleting(row);
    };
    return <tr key={row.deviceId}><td className={styles.strong}>{row.deviceName}</td><td>{row.deviceType}</td><td><Tag tone="blue">{types.find((type) => type.energyTypeId === row.mainEnergyTypeId)?.energyTypeName}</Tag></td><td><Tag tone={progress === 12 ? 'green' : progress > 0 ? 'orange' : 'gray'}>{progress === 0 ? '未录入' : progress === 12 ? '已完整录入（12/12月）' : `部分录入（${progress}/12月）`}</Tag></td><td className={styles.number}>{primaryRecord ? `${format(total, 2)} ${energyType?.measurementUnit ?? ''}` : '—'}</td><td><div className={styles.actions}><button type="button" onClick={() => setEditing(row)}>编辑档案</button><button type="button" onClick={maintain}>{primaryRecord ? '维护数据' : '录入能源数据'}</button><button type="button" className={styles.danger} onClick={requestDelete}>删除</button></div></td></tr>;
  };

  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ keyword: keywordInput.trim(), levelOneUnitId: levelOneUnitIdInput, unitId: unitIdInput, category: categoryInput, typeId: typeIdInput })}>查询</Button><Button onClick={() => { setKeywordInput(''); setLevelOneUnitIdInput(''); setUnitIdInput(''); setCategoryInput(''); setTypeIdInput(''); setFilters({ keyword: '', levelOneUnitId: '', unitId: '', category: '', typeId: '' }); }}>重置</Button><Button primary onClick={() => setEditing('new')}>＋ 新增重点设备</Button></>}>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="设备名称 / 设备类型" /></Field>
      <Field label="一级用能单元"><select value={levelOneUnitIdInput} onChange={(event) => { setLevelOneUnitIdInput(event.target.value); setUnitIdInput(''); }}><option value="">全部</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      {levelOneUnitIdInput && <Field label="具体用能单元"><select value={unitIdInput} onChange={(event) => setUnitIdInput(event.target.value)}><option value="">全部</option>{childUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
      <Field label="能源分析类别"><select value={categoryInput} onChange={(event) => { setCategoryInput(event.target.value as AnalysisCategory | ''); setTypeIdInput(''); }}><option value="">全部</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
      {categoryInput && <Field label="主要能源品种"><select value={typeIdInput} onChange={(event) => setTypeIdInput(event.target.value)}><option value="">全部</option>{categoryTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>}
    </Toolbar>
    <Notice><strong>说明：</strong>本页按一级、二级用能单元层级展示重点设备；设备月度能源量统一进入“能源数据—重点设备”维护，并用于设备用能与能效对标。设备明细不会重复增加所属用能单元或企业总能耗。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>设备名称</th><th>设备类型</th><th>主要能源品种</th><th>数据状态</th><th>本年度能源量</th><th>操作</th></tr></thead><tbody>{groupedRows.length ? groupedRows.flatMap((group) => {
      const collapsed = collapsedLevelOneIds.includes(group.unit.energyUnitId);
      const toggle = () => setCollapsedLevelOneIds((current) => current.includes(group.unit.energyUnitId) ? current.filter((id) => id !== group.unit.energyUnitId) : [...current, group.unit.energyUnitId]);
      const deviceCount = group.directDevices.length + group.childGroups.reduce((count, childGroup) => count + childGroup.devices.length, 0);
      return [<tr className={styles.deviceLevelOneRow} key={`level-one-${group.unit.energyUnitId}`}><td colSpan={6}><div className={styles.deviceLevelOneNode}><button type="button" aria-label={`${collapsed ? '展开' : '收起'}${group.unit.energyUnitName}`} className={styles.deviceToggle} onClick={toggle}>{collapsed ? '+' : '−'}</button><b>{group.unit.energyUnitName}</b><span className={styles.deviceCount}>{deviceCount} 台设备</span></div></td></tr>,
        ...(!collapsed ? [
          ...(group.directDevices.length ? [<tr className={styles.deviceDirectRow} key={`direct-${group.unit.energyUnitId}`}><td colSpan={6}><div className={`${styles.deviceTreeChild} ${styles.deviceDirectNode}`}>直属设备 <small>{group.directDevices.length} 台设备</small></div></td></tr>, ...group.directDevices.map(renderDeviceRow)] : []),
          ...group.childGroups.flatMap((childGroup) => [<tr className={styles.deviceLevelTwoRow} key={`level-two-${childGroup.unit.energyUnitId}`}><td colSpan={6}><div className={`${styles.deviceTreeChild} ${styles.deviceLevelTwoNode}`}>{childGroup.unit.energyUnitName}<small>{childGroup.devices.length} 台设备</small></div></td></tr>, ...childGroup.devices.map(renderDeviceRow)]),
        ] : []),
      ];
    }) : <EmptyRow colSpan={6} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <DeviceDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleteBlocked && <Modal title="无法删除重点设备" width={520} cancelText="我知道了" onClose={() => setDeleteBlocked(null)}>
    <div className={styles.warning}>{blockedInspection?.ok ? '当前设备的关联状态已变化，请关闭后重新操作。' : `重点设备“${deleteBlocked.deviceName}”已关联业务数据，暂不能删除。请先处理关联数据。`}</div>
    {blockedReferences && <div className={styles.blockedActions}>
      {blockedReferences.energyRecordCount > 0 && <button type="button" className={styles.blockedAction} onClick={openBlockedDeviceEnergyData}>处理设备能源数据</button>}
      {blockedReferences.benchmarkTargetCount > 0 && <button type="button" className={styles.blockedAction} onClick={openBlockedDeviceTargets}>处理设备指标目标</button>}
    </div>}
  </Modal>}
  {deleting && <Modal title="删除重点设备" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
    const result = deleteV11KeyDevice(deleting.deviceId);
    if (!result.ok) return notify(result.error);
    setDeleting(null); setVersion((value) => value + 1); notify('重点设备已删除');
  }}><div className={styles.warning}>确认删除重点设备“{deleting.deviceName}”吗？删除后无法恢复。</div></Modal>}
  </Page>;
}

function DeviceDialog({ item, onClose, onSaved }: { item?: V11KeyDevice; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const initialPreset = deviceTypePresets.includes(item?.deviceType ?? '') ? item?.deviceType ?? '' : item ? '其他（自定义）' : '';
  const [scopeLevel, setScopeLevel] = useState<'一级用能单元' | '二级用能单元'>(initialUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : '');
  const [preset, setPreset] = useState(initialPreset);
  const [customType, setCustomType] = useState(initialPreset === '其他（自定义）' ? item?.deviceType ?? '' : '');
  const [name, setName] = useState(item?.deviceName ?? '');
  const [typeId, setTypeId] = useState(item?.mainEnergyTypeId ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = scopeLevel === '一级用能单元'
    ? levelOneUnits
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  return <Modal title={item ? '编辑重点设备档案' : '新增重点设备'} width={720} submitText="保存设备" onClose={onClose} onSubmit={() => {
    const deviceType = preset === '其他（自定义）' ? customType.trim() : preset;
    if (!unitId || !deviceType || !name.trim() || !typeId) return setError('请完整填写必填字段。');
    const result = saveV11KeyDevice({ energyUnitId: unitId, deviceType, deviceName: name.trim(), mainEnergyTypeId: typeId, remark }, item?.deviceId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '重点设备已更新' : '重点设备已新增');
  }}><div className={styles.deviceForm}>
    <section className={styles.deviceFormSection}>
      <h3>设备信息</h3>
      <div className={styles.formGrid}>
        <Field label="设备名称" required><input value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入设备名称" /></Field>
        <Field label="设备类型" required><select value={preset} onChange={(event) => setPreset(event.target.value)}><option value="">请选择设备类型</option>{deviceTypePresets.map((value) => <option key={value}>{value}</option>)}</select></Field>
        {preset === '其他（自定义）' && <Field label="自定义设备类型" required><input value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="请输入具体设备类型" /></Field>}
        <Field label="主要能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
      </div>
    </section>
    <section className={styles.deviceFormSection}>
      <h3>归属信息</h3>
      <div className={styles.deviceOwnershipFields}>
        <Field label="归属层级" required><select aria-label="重点设备归属层级" value={scopeLevel} onChange={(event) => { setScopeLevel(event.target.value as '一级用能单元' | '二级用能单元'); setUnitId(''); setParentUnitId(''); }}><option>一级用能单元</option><option>二级用能单元</option></select></Field>
        {scopeLevel === '二级用能单元' && <Field label="所属一级用能单元" required><select aria-label="重点设备所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
        <Field label="所属用能单元" required><select aria-label="重点设备所属用能单元" disabled={scopeLevel === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{scopeLevel === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : '请选择所属用能单元'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      </div>
    </section>
    <section className={styles.deviceFormSection}>
      <h3>备注 <small>（选填）</small></h3>
      <Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="请输入设备补充说明" /></Field>
    </section>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}
