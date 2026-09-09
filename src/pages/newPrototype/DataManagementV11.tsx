import { InlineDataForm } from './InlineDataForm';
import { useInlineEditGuard } from './useInlineEditGuard';
import { MonthlyDataDetails as MonthDetail } from './MonthlyDataDetails';
import { useDataYear } from './useDataYear';
import { DATA_YEARS } from '../../mocks/annualData';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  deleteV11EnergyCost,
  deleteV11EnergyRecord,
  deleteV11EnergyType,
  listV11EnergyTypeReferences,
  isV11EnergyTypeEnabled,
  deleteV11KeyDevice,
  deleteV11OperationMetric,
  inspectV11KeyDeviceDeletion,
  listV11EnergyCosts,
  listV11EnergyRecords,
  listV11ConversionOutputs,
  saveFlowConversion,
  listV11EnergyTypes,
  listV11KeyDevices,
  listV11OperationMetrics,
  saveV11EnergyCost,
  saveV11EnergyRecord,
  saveV11EnergyType,
  saveV11KeyDevice,
  saveV11OperationMetric,
  v11RecordScopeType,
  v11EnergyRecordAnnualAmount,
  v11ScopeName,
  type AnalysisCategory,
  type EnergyRole,
  type ScopeLevel,
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
  updateProductAllocation,
} from '../../mocks/productMasterStore';
import {
  DEVICE_METRIC_TEMPLATES,
  deleteDeviceIntensityParameter,
  getDeviceIntensityParameter,
  getDeviceIntensityTemplate,
  getDeviceIntensityTemplateConfig,
  saveDeviceIntensityParameter,
  saveDeviceIntensityTemplate,
  type DeviceIntensityParameter,
  type DeviceIntensityMetricCode,
  type DeviceIntensityTemplateConfig,
} from '../../mocks/deviceIntensityParameterStore';
import type { ProductMaster } from '../../types/product';
import { Button, Field, Modal, Tag, Toast } from './PrototypeUI';
import { EnergyFlowMaintenance } from './EnergyFlowMaintenance';
import { EnergyUnitsPage } from './EnergyUnitsPage';
import styles from './DataManagementV11.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const categories: AnalysisCategory[] = ['电力', '热力', '化石燃料', '可再生及替代能源', '其他能源'];
type EnergyScopeView = ScopeLevel | '重点设备';
const levels: Array<'全部层级' | EnergyScopeView> = ['全部层级', '企业', '一级用能单元', '二级用能单元', '重点设备'];
type OperationScopeView = ScopeLevel | '全部层级';
const operationLevels: OperationScopeView[] = ['全部层级', '企业', '一级用能单元', '二级用能单元'];
function scopeViewLabel(value: '全部层级' | EnergyScopeView) {
  if (value === '全部层级') return '层级总览';
  return value === '企业' ? '全厂' : value;
}

function fallbackDeviceOutputConfig(device: V11KeyDevice, metricCode: DeviceIntensityMetricCode): DeviceIntensityTemplateConfig {
  const outputName = device.outputBasis?.trim() || '设备产出量';
  return {
    templateId: 'unit-output-energy',
    metricCode,
    metricName: '设备产出',
    calculationMethod: 'ratio',
    numerator: { source: 'device-energy', name: '设备能耗', unit: '—' },
    denominator: { source: 'operation-data', metricCode: 'custom_device_output', name: outputName, unit: '' },
    resultUnit: '',
    formula: '设备能耗 ÷ 设备产出',
  };
}

function uniqueOperationRecords(records: V11OperationMetric[]) {
  const grouped = new Map<string, V11OperationMetric>();
  records.forEach((record) => {
    const key = [record.year, record.scopeLevel, record.energyUnitId ?? '', record.metricCode, record.productId ?? ''].join('|');
    const current = grouped.get(key);
    if (!current || (record.entryMode === 'monthly' && current.entryMode !== 'monthly')) grouped.set(key, record);
  });
  return [...grouped.values()];
}
const deviceTypePresets = ['动力设备', '泵类', '风机', '空压设备', '制冷/空调设备', '加热/锅炉设备', '输送设备', '加工设备', '表面处理设备', '检测设备', '其他（自定义）'];
const metricPresets = {
  产量: [
    ['产品产量', 't'],
  ],
  经济指标: [
    ['工业总产值', '万元'],
    ['工业增加值', '万元'],
  ],
  运行指标: [
    ['动力中心供能量', 'GJ'],
    ['办公建筑面积', 'm²'],
    ['货物吞吐量', 't'],
    ['运营量', '项'],
  ],
} as const;

const metricCodes: Record<string, string> = {
  工业总产值: 'industrial_output_value',
  工业增加值: 'industrial_added_value',
  动力中心供能量: 'energy_supply',
  办公建筑面积: 'building_area',
  货物吞吐量: 'logistics_throughput',
  运营量: 'business_volume',
};

const energyPresets: Record<AnalysisCategory, Array<[string, string, number, string]>> = {
  电力: [['电力', 'kWh', 0.1229, 'kgce/kWh']],
  热力: [['蒸汽', 'GJ', 0.0341, 'tce/GJ'], ['热水', 'GJ', 0.0341, 'tce/GJ']],
  化石燃料: [['原煤', 't', 0.7143, 'tce/t'], ['烟煤', 't', 0.7143, 'tce/t'], ['石油焦', 't', 1.0918, 'tce/t'], ['柴油', 't', 1.4571, 'tce/t'], ['天然气', 'Nm³', 1.33, 'kgce/Nm³']],
  可再生及替代能源: [['生物质燃料', 't', 0.5, 'tce/t'], ['RDF', 't', 0.6, 'tce/t'], ['废轮胎', 't', 0.8, 'tce/t']],
  回收能源: [['余热', 'GJ', 0.0341, 'tce/GJ'], ['回收蒸汽', 'GJ', 0.0341, 'tce/GJ']],
  其他能源: [['压缩空气', 'Nm³', 0, 'kgce/Nm³'], ['其他（自定义）', '', 0, '']],
};

const yearOptions = DATA_YEARS.map(String);

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
function Actions({ onView, viewLabel = '查看', onEdit, onDelete, extra }: { onView?: () => void; viewLabel?: string; onEdit: () => void; onDelete: () => void; extra?: ReactNode }) {
  return <div className={styles.actions}>{onView && <button type="button" onClick={onView}>{viewLabel}</button>}{extra}<button type="button" onClick={onEdit}>编辑</button><button type="button" className={styles.danger} onClick={onDelete}>删除</button></div>;
}
function Page({ children, toast }: { children: ReactNode; toast: string }) {
  const [year] = useDataYear();
  return <div className={styles.page}><div className={styles.notice} role="note"><strong>{year} 年度独立维护</strong> · 当前年度的用能单元、能源品种、设备及关联数据独立保存，修改不影响其他年度。</div>{children}<Toast message={toast} /></div>;
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
  if (!canChange) return <div className={styles.pagination}><span>共 {count} 条</span></div>;
  return <div className={styles.pagination}>
    <span>共 {count} 条</span>
    <button type="button" disabled={currentPage === 1} onClick={() => onPageChange?.(currentPage - 1)}>上一页</button>
    <span>{currentPage} / {pageCount}</span>
    <button type="button" className={styles.pageDot} disabled={currentPage === pageCount} onClick={() => onPageChange?.(currentPage + 1)}>下一页</button>
  </div>;
}
function EmptyRow({ colSpan }: { colSpan: number }) {
  return <tr><td className={styles.empty} colSpan={colSpan}>暂无匹配数据</td></tr>;
}
export function DataManagementV11({ pathname }: { pathname: string }) {
  const [year] = useDataYear();
  return <DataManagementContent key={pathname + year} pathname={pathname} />;
}
function DataManagementContent({ pathname }: { pathname: string }) {
  const { search } = useLocation();
  const page = pathname.split('?')[0].split('/').pop();
  const energyTab = new URLSearchParams(search).get('tab');
  if (page === 'units') return <EnergyUnitsPage />;
  if (page === 'energy-types') return <EnergyTypesPage />;
  if (page === 'energy-data') {
    if (energyTab === 'costs') return <EnergyCostsPage />;
    if (energyTab === 'flow' || energyTab === 'recovery' || energyTab === 'conversion' || energyTab === 'external') return <EnergyFlowMaintenance />;
    return <EnergyQuantityPage />;
  }
  if (page === 'energy-consumption') return <EnergyQuantityPage />;
  if (page === 'energy-costs') return <EnergyCostsPage />;
  if (page === 'energy-relations') return <EnergyFlowMaintenance />;
  if (page === 'operations') return <OperationsPage />;
  if (page === 'device-output') return <DeviceOutputPage />;
  return <DevicesPage />;
}

function EnergyTypesPage() {
  const [maintenanceYear, changeMaintenanceYear] = useDataYear();
  const { toast, notify } = useNotice();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const year = maintenanceYear;
  const setYear = changeMaintenanceYear;
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<V11EnergyType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyType | null>(null);
  const [blocked, setBlocked] = useState<{ item: V11EnergyType; references: ReturnType<typeof listV11EnergyTypeReferences> } | null>(null);
  // 回收能源通过来源入口维护，不作为外购能源消费品种展示。
  const rows = listV11EnergyTypes(Number(maintenanceYear)).filter((item) => item.analysisCategory !== '回收能源' && (!keyword || item.energyTypeName.includes(keyword)) && (!category || item.analysisCategory === category));
  void version;
  return <Page toast={toast}>
    <section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => { setKeyword(keywordInput.trim()); setCategory(categoryInput); }}>查询</Button><Button onClick={() => { setKeywordInput(''); setCategoryInput(''); setKeyword(''); setCategory(''); }}>重置</Button><Button primary onClick={() => setEditing('new')}>＋ 新增能源品种</Button></>}>
        <Field label="年度"><select aria-label="能源品种年度" value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
        <Field label="关键字"><input aria-label="关键字" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="搜索能源品种名称" /></Field>
        <Field label="能源分析类别"><select aria-label="能源分析类别" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </Toolbar>
      <Notice><strong>说明：</strong>能源分析类别用于能耗查询和结构汇总；能源品种只维护基础属性，能源回收、转换和外供去向统一在“能源转换与外供”中维护。</Notice>
      <div className={styles.tableWrap}><table><thead><tr><th>能源分析类别</th><th>能源品种</th><th>计量单位</th><th>折标系数</th><th>折标单位</th><th className={styles.operationColumn}>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.energyTypeId}><td><Tag tone="blue">{row.analysisCategory}</Tag></td><td className={styles.strong}>{row.energyTypeName}</td><td>{row.measurementUnit}</td><td>{row.standardCoalFactor.toFixed(4)}</td><td>{row.standardCoalFactorUnit}</td><td><div className={styles.actions}><button type="button" onClick={() => setEditing(row)}>编辑</button><button type="button" className={styles.danger} onClick={() => { const references = listV11EnergyTypeReferences(row.energyTypeId, Number(maintenanceYear)); if (references.length) setBlocked({ item: row, references }); else setDeleting(row); }}>删除</button></div></td></tr>)}</tbody>
      </table></div>
      <Pagination count={rows.length} />
    </section>
    {editing && <EnergyTypeDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
    {deleting && <Modal title="删除能源品种" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyType(deleting.energyTypeId, Number(maintenanceYear));
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源品种已删除');
    }}><div className={styles.warning}>确认删除能源品种“{deleting.energyTypeName}”吗？</div></Modal>}
    {blocked && <Modal title="无法删除能源品种" width={580} cancelText="关闭" onClose={() => setBlocked(null)}>
      <div className={styles.warning}>能源品种“{blocked.item.energyTypeName}”存在业务引用。请先处理引用后再删除。</div>
      <ul className={styles.referenceList}>{blocked.references.map((reference) => <li key={reference.kind}><span>{reference.label}</span><strong>{reference.count} 项</strong><button type="button" className={styles.blockedAction} onClick={() => { setBlocked(null); navigate(reference.path); }}>去处理</button></li>)}</ul>
    </Modal>}
  </Page>;
}

function EnergyTypeDialog({ item, onClose, onSaved }: { item?: V11EnergyType; onClose: () => void; onSaved: (message: string) => void }) {
  const [maintenanceYear] = useDataYear();
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
  return <Modal title={`${item ? '编辑能源品种' : '新增能源品种'}（${maintenanceYear}年度）`} width={760} onClose={onClose} onSubmit={() => {
    const name = custom ? customName.trim() : preset;
    if (!name || !unit || factor === '' || !factorUnit) return setError('请完整填写必填字段。');
    const result = saveV11EnergyType({ analysisCategory: category, energyTypeName: name, measurementUnit: unit, standardCoalFactor: Number(factor), standardCoalFactorUnit: factorUnit, remark }, item?.energyTypeId, Number(maintenanceYear));
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
  const [maintenanceYear, changeYear] = useDataYear();
  const { guard, onDirtyChange, confirmation } = useInlineEditGuard();
  const changeMaintenanceYear = (next: string) => guard(() => changeYear(next));
  const { toast, notify } = useNotice();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  const returnToFlow = returnTo?.startsWith('/data-management/energy-data?') && new URLSearchParams(returnTo.split('?')[1]).get('tab') === 'conversion';
  const returnToOrigin = () => {
    if (returnToFlow || returnTo?.startsWith('/energy-analysis/intensity')) navigate(returnTo!);
  };
  const linkedDeviceId = params.get('deviceId') ?? '';
  const linkedEnergyTypeId = params.get('energyTypeId') ?? '';
  const linkedRecordId = params.get('recordId') ?? '';
  const deviceEntry = params.get('scope') === 'device';
  const requestedScopeLevel = params.get('scopeLevel');
  const initialEnergyRole: EnergyRole = params.get('role') === '回收能源' ? '回收能源' : '能源消费';
  const requestedLevel: '全部层级' | EnergyScopeView = initialEnergyRole === '回收能源'
    ? '二级用能单元'
    : requestedScopeLevel === '企业' || requestedScopeLevel === '二级用能单元' || requestedScopeLevel === '一级用能单元' ? requestedScopeLevel : deviceEntry ? '重点设备' : '全部层级';
  const [version, setVersion] = useState(0);
  const [level, setLevel] = useState<'全部层级' | EnergyScopeView>(requestedLevel);
  const [energyRole, setEnergyRole] = useState<EnergyRole>(initialEnergyRole);
  const [currentPage, setCurrentPage] = useState(1);
  const year = maintenanceYear;
  const setYear = changeMaintenanceYear;
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState(params.get('keyword') ?? '');
  const [appliedFilters, setAppliedFilters] = useState({ year: maintenanceYear, category: '', keyword: params.get('keyword') ?? '', energyTypeId: linkedEnergyTypeId });
  const [expanded, setExpanded] = useState<string | null>(params.get('entry') !== 'list' ? linkedRecordId || null : null);
  const [editingMonth, setEditingMonth] = useState(Number(params.get('month')) || 0);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<V11EnergyRecord | 'new' | null>(() => {
    if (params.get('entry') === 'list') return null;
    if (linkedRecordId) return listV11EnergyRecords().find((record) => record.energyRecordId === linkedRecordId && record.year === Number(maintenanceYear)) ?? null;
    return params.get('new') === '1' ? 'new' : null;
  });
  const [newUnitId, setNewUnitId] = useState(params.get('unitId') ?? '');
  const [deleting, setDeleting] = useState<V11EnergyRecord | null>(null);
  const closeEditor = () => { setEditing(null); setNewUnitId(''); if (returnTo && params.get('entry') !== 'list') returnToOrigin(); };
  const savedEditor = (message: string) => { setEditing(null); setNewUnitId(''); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); };
  const showDetails = (id: string | null) => guard(() => { setEditing(null); setExpanded(id); });
  const editMonth = (row: V11EnergyRecord, month: number) => guard(() => { setExpanded(row.energyRecordId); setEditingMonth(month); setEditing(row); });
  const renderEnergyDetails = (row: V11EnergyRecord, total: number, unit: string) => <MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={unit}
    onCollapse={() => showDetails(null)} editor={editing !== 'new' && editing?.energyRecordId === row.energyRecordId ? <EnergyRecordDialog key={`${row.energyRecordId}:${version}`} inline onDirtyChange={onDirtyChange} item={row} dataYear={row.year} energyRole={row.energyRole} initialMonth={editingMonth} conversionInputId={params.get('conversionInputId') ?? undefined} onClose={closeEditor} onSaved={savedEditor} /> : undefined} />;
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const availableCategories = energyRole === '回收能源' ? ['回收能源'] : [...categories, '回收能源'];
  const visibleLevels = energyRole === '回收能源' ? (['二级用能单元'] as const) : levels;
  const devices = listV11KeyDevices(Number(maintenanceYear));
  const records = listV11EnergyRecords();
  const units = listEnergyUnits(Number(maintenanceYear));
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
  const unitConversions = listV11ConversionOutputs().filter(row => row.year === Number(maintenanceYear));
  const requestedConversion = unitConversions.find(row => row.conversionOutputId === params.get('conversionInputId'));
  const matchesEnergyRole = (item: V11EnergyRecord) => item.energyRole === energyRole || (energyRole === '能源消费' && item.energyRole === '回收能源' && unitConversions.some(row => row.inputEnergyRecordId === item.energyRecordId && row.conversionEnergyUnitId === item.energyUnitId));
  const requestedUnit = unitById.get(params.get('unitId') ?? '');
  const rows = records.filter((item) => matchesEnergyRole(item) && item.year === Number(appliedFilters.year)
    && (level === '全部层级'
      ? true
      : level === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === level)
    && (!linkedDeviceId || level !== '重点设备' || item.scopeId === linkedDeviceId)
    && (!requestedConversion || !requestedUnit || item.energyUnitId === requestedUnit.energyUnitId)
    && (!appliedFilters.energyTypeId || item.energyTypeId === appliedFilters.energyTypeId)
    && (!appliedFilters.category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === appliedFilters.category)
      && (!appliedFilters.keyword || `${v11RecordScopeType(item) === 'device' ? devices.find((device) => device.deviceId === item.scopeId)?.deviceName ?? '' : v11ScopeName(item.energyUnitId, Number(maintenanceYear))}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(appliedFilters.keyword)))
    .sort((left, right) => {
      const scopeOrder = (record: V11EnergyRecord) => {
        const scopeType = v11RecordScopeType(record);
        if (scopeType === 'enterprise') return -100;
        const base = (unitOrder.get(record.energyUnitId ?? '') ?? 999) * 10;
        const levelOrder = scopeType === 'device' ? 3 : record.scopeLevel === '一级用能单元' ? 1 : 2;
        return base + levelOrder;
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
  const levelOneUnitGroups = units
    .filter((unit) => unit.unitLevel === 'level1')
    .map((unit) => ({ unit, records: pageRows.filter((row) => row.energyUnitId === unit.energyUnitId) }))
    .filter((group) => !appliedFilters.keyword || group.records.length > 0);
  const allLevelTableRows = (() => {
    const scopedRows = rows.map((row) => {
      const scopeType = v11RecordScopeType(row);
      const unit = row.energyUnitId ? unitById.get(row.energyUnitId) : null;
      const device = scopeType === 'device' ? devices.find((item) => item.deviceId === row.scopeId) : null;
      const scopeName = scopeType === 'device' ? device?.deviceName ?? '设备档案已移除' : scopeType === 'enterprise' ? '全厂' : v11ScopeName(row.energyUnitId, Number(maintenanceYear));
      const scopeLevel = scopeType === 'device' ? '重点设备' : row.scopeLevel;
      const depth = scopeType === 'enterprise' ? 0 : scopeType === 'device' ? (unit?.unitLevel === 'level1' ? 2 : 3) : unit?.unitLevel === 'level1' ? 1 : 2;
      const scopeKey = scopeType === 'device' ? `device:${row.scopeId}` : `${scopeType}:${row.energyUnitId ?? 'enterprise'}`;
      return { row, unit, device, scopeName, scopeLevel, depth, scopeKey };
    });
    const groups = [...new Map(scopedRows.map((item) => [item.scopeKey, item])).values()].map((first) => ({
      ...first,
      items: scopedRows.filter((item) => item.scopeKey === first.scopeKey),
    }));
    const levelLabels = ['企业', '一级用能单元', '二级用能单元', '重点设备'];
    return levelLabels.flatMap((label) => {
      const levelGroups = groups.filter((group) => group.scopeLevel === label);
      if (!levelGroups.length) return [];
      return [
        <tr className={styles.functionalGroupRow} key={`level-${label}`}><td colSpan={7}><div className={styles.functionalGroupTitle}><strong>{label}层级</strong></div></td></tr>,
        ...levelGroups.flatMap((group) => {
          const isCollapsed = collapsedScopes.has(group.scopeKey);
          const groupRows = group.items.flatMap(({ row, scopeName, scopeLevel, depth }) => {
            const type = types.find((item) => item.energyTypeId === row.energyTypeId);
            const total = v11EnergyRecordAnnualAmount(row);
            const detail = expanded === row.energyRecordId;
            return [<tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={`${styles.scopeChild} ${styles[`scopeDepth${depth}`]}`} aria-label={`${scopeName}下的${type?.energyTypeName ?? '能源记录'}`}><span>└─ {type?.energyTypeName}</span></div></td><td>{scopeLevel}</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.energyRecordId)} onEdit={() => editMonth(row, 0)} onDelete={() => guard(() => { setEditing(null); setDeleting(row); })} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}>{renderEnergyDetails(row, total, type?.measurementUnit ?? '')}</td></tr>];
          });
          const canAddForScope = level === '二级用能单元' && group.row.energyUnitId;
          const groupRow = <tr className={styles.scopeGroupRow} key={`${group.scopeKey}-group`}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${group.depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${group.scopeName}`} aria-expanded={!isCollapsed} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(group.scopeKey)) next.delete(group.scopeKey); else next.add(group.scopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{group.scopeName}</b></span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}>{canAddForScope && <button type="button" className={styles.scopeAddButton} onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(group.row.energyUnitId ?? ''); setEditing('new'); })}>＋ 新增能源消费</button>}</td></tr>;
          return [groupRow, ...(isCollapsed ? [] : groupRows)];
        }),
      ];
    });
  })();
  useEffect(() => { setCurrentPage(1); }, [appliedFilters, level]);
  void version;
  const countForLevel = (value: '全部层级' | EnergyScopeView) => records.filter((item) =>
    matchesEnergyRole(item)
    && item.year === Number(appliedFilters.year)
    && (!appliedFilters.energyTypeId || item.energyTypeId === appliedFilters.energyTypeId)
    && (!appliedFilters.category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === appliedFilters.category)
    && (!appliedFilters.keyword || `${v11RecordScopeType(item) === 'device' ? devices.find((device) => device.deviceId === item.scopeId)?.deviceName ?? '' : v11ScopeName(item.energyUnitId, Number(maintenanceYear))}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(appliedFilters.keyword))
    && (value === '全部层级'
      ? true
      : value === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === value)).length;
  return <Page toast={toast}>{confirmation}
    <section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => guard(() => { setEditing(null); setExpanded(null); setAppliedFilters({ year, category, keyword, energyTypeId: linkedEnergyTypeId }); })}>查询</Button><Button onClick={() => guard(() => { setEditing(null); setExpanded(null);  setCategory(energyRole === '回收能源' ? '回收能源' : ''); setKeyword(''); setLevel(energyRole === '回收能源' ? '二级用能单元' : deviceEntry ? '重点设备' : '全部层级'); setAppliedFilters({ year: maintenanceYear, category: energyRole === '回收能源' ? '回收能源' : '', keyword: '', energyTypeId: linkedEnergyTypeId }); })}>重置</Button>{returnTo && <Button onClick={() => guard(returnToOrigin)}>{returnToFlow ? '返回能源转换与外供' : '返回能耗指标'}</Button>}{energyRole === '回收能源' && level === '二级用能单元' && <Button primary onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(''); setEditing('new'); })}>＋ 新增回收能源</Button>}{energyRole === '能源消费' && level === '企业' && <Button primary onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(''); setEditing('new'); })}>＋ 新增能源消费数据</Button>}{energyRole === '能源消费' && level === '重点设备' && <Button primary onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(''); setEditing('new'); })}>＋ 新增设备能源消费</Button>}{level === '全部层级' && <span className={styles.entryHint}>层级总览仅用于只读核查，请切换至具体层级后维护数据</span>}</>}>
        <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
        <Field label="能源分析类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{availableCategories.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="关键字"><input aria-label="能源消费关键字" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={level === '重点设备' ? '重点设备 / 能源品种' : '用能单元 / 能源品种'} /></Field>
      </Toolbar>
      <div className={styles.levelTabs}>{visibleLevels.map((item) => <button key={item} type="button" className={level === item ? styles.activeLevel : ''} onClick={() => guard(() => { setEditing(null); setExpanded(null); setLevel(item); })}>{scopeViewLabel(item)}{item === '企业' && <span className={styles.requiredMark}>必填</span>}（{countForLevel(item)}）</button>)}</div>
      <Notice>{energyRole === '回收能源'
        ? <><strong>回收能源：</strong>在产生余热、余压等回收能源的实际二级用能单元录入来源数据；该数据不会计入企业外购能源消费，后续由余热发电或回收利用记录关联。</>
        : level === '重点设备'
        ? <><strong>重点设备能源数据：</strong>设备数据用于设备用能分析和能效对标，是所属用能单元能源量的明细拆分，不重复增加企业或用能单元总能耗。</>
        : <><strong>能源消费：</strong>企业级记录用于边界总量控制，一级和二级用能单元按实际计量条件分别录入。系统依据归属层级自动识别能源输入、分配和利用阶段；转换与回收系统的投入统一按各自二级用能单元在本页维护；余热、余压保留内部回收属性，不计入企业外购能源。转换产出及外供在“能源转换与外供”中维护。</>}</Notice>
      {level === '重点设备' ? <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>能源分析类别</th><th>能源品种</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{pageRows.length ? pageRows.flatMap((row) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const device = devices.find((item) => item.deviceId === row.scopeId);
          const total = v11EnergyRecordAnnualAmount(row);
          const detail = expanded === row.energyRecordId;
          return [<tr key={row.energyRecordId}><td className={styles.strong}>{device?.deviceName ?? '设备档案已移除'}</td><td>{v11ScopeName(device?.energyUnitId ?? row.energyUnitId, Number(maintenanceYear))}</td><td>{device?.deviceType ?? '—'}</td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)} {type?.measurementUnit}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.energyRecordId)} onEdit={() => editMonth(row, 0)} onDelete={() => guard(() => { setEditing(null); setDeleting(row); })} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={8}>{renderEnergyDetails(row, total, type?.measurementUnit ?? '')}</td></tr>];
        }) : <EmptyRow colSpan={8} />}</tbody>
      </table></div> : level === '一级用能单元' ? <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead><tbody>{levelOneUnitGroups.flatMap(({ unit, records: unitRows }) => [
        ...unitRows.length ? [] : [],
        ...(() => {
          const scopeKey = `energyUnit:${unit.energyUnitId}`;
          const isCollapsed = collapsedScopes.has(scopeKey);
          const groupRow = <tr className={styles.scopeGroupRow} key={`${scopeKey}-group`}><td><div className={styles.scopeCell}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${unit.energyUnitName}`} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(scopeKey)) next.delete(scopeKey); else next.add(scopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{unit.energyUnitName}</b></span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}><button type="button" className={styles.scopeAddButton} onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(unit.energyUnitId); setEditing('new'); })}>＋ 新增能源消费</button></td></tr>;
          if (isCollapsed) return [groupRow];
          return [groupRow, ...(unitRows.length ? unitRows.flatMap((row) => { const type = types.find((item) => item.energyTypeId === row.energyTypeId); const total = v11EnergyRecordAnnualAmount(row); const detail = expanded === row.energyRecordId; return [<tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={styles.scopeChild}><span>└─ {type?.energyTypeName}</span></div></td><td>一级用能单元</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.energyRecordId)} onEdit={() => editMonth(row, 0)} onDelete={() => guard(() => { setEditing(null); setDeleting(row); })} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}>{renderEnergyDetails(row, total, type?.measurementUnit ?? '')}</td></tr>]; }) : [<tr key={`${scopeKey}-empty`}><td colSpan={7} className={styles.emptyRow}>暂无能源数据</td></tr>])];
        })(),
      ])}</tbody></table></div> : level === '全部层级' ? <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead><tbody>{allLevelTableRows.length ? allLevelTableRows : <EmptyRow colSpan={7} />}</tbody></table></div> : <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
      <tbody>{pageRows.length ? pageRows.flatMap((row, index) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const scopeType = v11RecordScopeType(row);
          const unit = row.energyUnitId ? unitById.get(row.energyUnitId) : null;
          const device = scopeType === 'device' ? devices.find((item) => item.deviceId === row.scopeId) : null;
          const scopeName = scopeType === 'device' ? device?.deviceName ?? '设备档案已移除' : v11ScopeName(row.energyUnitId, Number(maintenanceYear));
          const scopeLevel = scopeType === 'device' ? '重点设备' : row.scopeLevel;
          const depth = scopeType === 'enterprise' ? 0 : scopeType === 'device' ? (unit?.unitLevel === 'level1' ? 2 : 3) : unit?.unitLevel === 'level1' ? 1 : 2;
          const currentScopeKey = scopeType === 'device' ? `device:${row.scopeId}` : `${scopeType}:${row.energyUnitId ?? 'enterprise'}`;
          const previous = pageRows[index - 1];
          const previousScopeType = previous ? v11RecordScopeType(previous) : null;
          const previousScopeKey = previous
            ? previousScopeType === 'device' ? `device:${previous.scopeId}` : `${previousScopeType}:${previous.energyUnitId ?? 'enterprise'}`
            : '';
          const total = v11EnergyRecordAnnualAmount(row);
          const detail = expanded === row.energyRecordId;
          const isScopeStart = currentScopeKey !== previousScopeKey;
          const isCollapsed = collapsedScopes.has(currentScopeKey);
          if (isCollapsed && !isScopeStart) return [];
          const canAddForScope = level === '二级用能单元'
            && scopeType === 'energyUnit' && Boolean(row.energyUnitId);
          const groupRow = isScopeStart ? <tr className={styles.scopeGroupRow} key={`${currentScopeKey}-group`}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${scopeName}`} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(currentScopeKey)) next.delete(currentScopeKey); else next.add(currentScopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{scopeName}</b>{device && <small>所属：{v11ScopeName(device.energyUnitId, Number(maintenanceYear))}</small>}</span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}>{canAddForScope && <button type="button" className={styles.scopeAddButton} onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(row.energyUnitId ?? ''); setEditing('new'); })}>＋ {energyRole === '回收能源' ? '新增回收能源' : '新增能源消费'}</button>}</td></tr> : null;
          return [groupRow, <tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={`${styles.scopeChild} ${styles[`scopeDepth${depth}`]}`} aria-label={`${scopeName}下的${type?.energyTypeName ?? '能源记录'}`}><span>└─ {type?.energyTypeName}</span></div></td><td>{scopeLevel}</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.energyRecordId)} onEdit={() => editMonth(row, 0)} onDelete={() => guard(() => { setEditing(null); setDeleting(row); })} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}>{renderEnergyDetails(row, total, type?.measurementUnit ?? '')}</td></tr>];
        }) : requestedUnit?.unitLevel === 'level2' && level === '二级用能单元' && (!appliedFilters.keyword || requestedUnit.energyUnitName.includes(appliedFilters.keyword)) ? <><tr className={styles.scopeGroupRow}><td><div className={styles.scopeCell}><i /><b>{requestedUnit.energyUnitName}</b></div></td><td colSpan={5} /><td><button type="button" className={styles.scopeAddButton} onClick={() => guard(() => { setEditing(null); setExpanded(null);  setNewUnitId(requestedUnit.energyUnitId); setEditing('new'); })}>＋ 新增能源消费</button></td></tr><tr><td colSpan={7} className={styles.emptyRow}>暂无能源数据，请手动新增。</td></tr></> : <EmptyRow colSpan={7} />}</tbody>
      </table></div>}
      <Pagination count={rows.length} currentPage={safePage} onPageChange={level === '全部层级' ? undefined : (page) => guard(() => { setEditing(null); setExpanded(null); setCurrentPage(page); })} />
    </section>
    {editing === 'new' && <EnergyRecordDialog item={editing === 'new' ? undefined : editing} dataYear={Number(appliedFilters.year)} energyRole={requestedConversion?.inputMode === 'recovery' ? '回收能源' : energyRole} lockedScopeLevel={editing === 'new' && level !== '全部层级' ? level : undefined} initialUnitId={editing === 'new' ? newUnitId : undefined} initialDeviceId={linkedDeviceId} initialEnergyTypeId={linkedEnergyTypeId} initialMonth={Number(params.get('month')) || undefined} conversionInputId={params.get('conversionInputId') ?? undefined} onClose={() => { setEditing(null); setNewUnitId(''); if (returnTo && params.get('entry') !== 'list') returnToOrigin(); }} onSaved={(message) => { setEditing(null); setNewUnitId(''); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); }} />}
    {deleting && <Modal title="删除能源数据" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyRecord(deleting.energyRecordId);
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源数据已删除');
    }}><div className={styles.warning}>确认删除当前能源数据吗？</div></Modal>}
  </Page>;
}

function energyStage(record: V11EnergyRecord) {
  if (record.energyRole === '回收能源') return '回收能源';
  if (v11RecordScopeType(record) === 'device') return '设备用能';
  if (record.scopeLevel === '企业') return '能源输入';
  return record.scopeLevel === '一级用能单元' ? '能源分配' : '能源利用';
}
function EnergyRecordDialog({ inline = false, onDirtyChange, item, dataYear, energyRole = '能源消费', lockedScopeLevel, initialUnitId = '', initialDeviceId = '', initialEnergyTypeId = '', initialMonth, conversionInputId, readOnly = false, onClose, onSaved }: { inline?: boolean; initialMonth?: number; onDirtyChange?: (dirty: boolean) => void; item?: V11EnergyRecord; dataYear: number; energyRole?: EnergyRole; lockedScopeLevel?: EnergyScopeView; initialUnitId?: string; initialDeviceId?: string; initialEnergyTypeId?: string; conversionInputId?: string; readOnly?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const Form = inline ? InlineDataForm : Modal;
  const [maintenanceYear] = useDataYear();
  const units = listEnergyUnits(Number(maintenanceYear));
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const selectableTypes = types.filter((type) => {
    const matchesRole = energyRole === '回收能源' ? type.analysisCategory === '回收能源' : type.analysisCategory !== '回收能源';
    return matchesRole && (type.energyTypeId === item?.energyTypeId || isV11EnergyTypeEnabled(type.energyTypeId, Number(maintenanceYear)));
  });
  const devices = listV11KeyDevices(Number(maintenanceYear));
  const recoverySourceOptions = devices.map((device) => ({ value: `device:${device.deviceId}`, label: device.deviceName, unitId: device.energyUnitId, deviceId: device.deviceId }));
  const fixedRecoveryTypeId = 'v11-energy-waste-heat';
  const inputContext = listV11ConversionOutputs().find(row => row.year === dataYear && (row.conversionOutputId === conversionInputId || (item && row.inputEnergyRecordId === item.energyRecordId && row.conversionEnergyUnitId === item.energyUnitId)));
  const unitInput = Boolean(inputContext);
  const conversionInput = !item && inputContext && !inputContext.inputEnergyRecordId ? inputContext : undefined;
  const [level] = useState<EnergyScopeView>(item && v11RecordScopeType(item) === 'device' ? '重点设备' : item?.scopeLevel ?? lockedScopeLevel ?? '企业');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? initialUnitId);
  const existingSourceOption = energyRole === '回收能源'
    ? recoverySourceOptions.find((option) => option.deviceId === item?.sourceDeviceId)
    : undefined;
  const legacyRecoveryUnitId = energyRole === '回收能源' && !existingSourceOption ? item?.energyUnitId ?? (conversionInput ? initialUnitId : '') : '';
  const [sourceOptionId, setSourceOptionId] = useState(energyRole === '回收能源' ? existingSourceOption?.value ?? '' : '');
  const [sourceProcess, setSourceProcess] = useState(item?.sourceProcess ?? '');
  const parentUnitId = units.find((unit) => unit.energyUnitId === unitId)?.parentEnergyUnitId ?? '';
  const [deviceId, setDeviceId] = useState(item?.scopeType === 'device' ? item.scopeId ?? '' : initialDeviceId);
  const initialDevice = devices.find((device) => device.deviceId === (item?.scopeType === 'device' ? item.scopeId : initialDeviceId));
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? initialDevice?.mainEnergyTypeId ?? (initialEnergyTypeId || (energyRole === '回收能源' ? fixedRecoveryTypeId : '')));
  const initialReportedMonths = item ? reportedMonths(item) : Array(12).fill(false);
  const [reported, setReported] = useState<boolean[]>(initialReportedMonths);
  const [values, setValues] = useState<string[]>(Array.from({ length: 12 }, (_, index) => initialReportedMonths[index] ? String(item?.monthlyAmounts[index] ?? '') : ''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualAmount || ''));
  const [error, setError] = useState('');
  const type = types.find((value) => value.energyTypeId === typeId);
  const device = devices.find((value) => value.deviceId === deviceId);
  const deviceUnit = units.find((unit) => unit.energyUnitId === device?.energyUnitId);
  const selectedSourceOption = recoverySourceOptions.find((option) => option.value === sourceOptionId);
  const sourceDeviceName = existingSourceOption?.label ?? devices.find((value) => value.deviceId === item?.sourceDeviceId)?.deviceName ?? item?.sourceProcess ?? '历史来源设备';
  const resolvedRecoveryUnitId = item?.energyUnitId ?? selectedSourceOption?.unitId ?? legacyRecoveryUnitId;
  const effectiveUnitId = level === '企业' ? null : level === '重点设备' ? device?.energyUnitId ?? null : energyRole === '回收能源' && !unitInput ? resolvedRecoveryUnitId : unitId;
  const selectedUnit = units.find((unit) => unit.energyUnitId === effectiveUnitId);
  const recoveryScopeLevel: ScopeLevel = selectedUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元';
  const recoveryParentUnit = selectedUnit?.unitLevel === 'level2' ? units.find((unit) => unit.energyUnitId === selectedUnit.parentEnergyUnitId) : selectedUnit;
  const persistedScopeLevel: ScopeLevel = energyRole === '回收能源' && selectedUnit
    ? recoveryScopeLevel
    : level === '重点设备'
      ? deviceUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'
      : level;
  const scopeType = level === '企业' ? 'enterprise' : level === '重点设备' ? 'device' : 'energyUnit';
  const scopeId = scopeType === 'enterprise' ? null : scopeType === 'device' ? deviceId : effectiveUnitId;
  const monthNumbers = values.map((value) => Number(value || 0));
  const monthlyTotal = monthNumbers.reduce((sum, value) => sum + value, 0);
  const reportedCount = reported.filter(Boolean).length;
  const monthlyComplete = reportedCount === 12;
  const recordPreview: V11EnergyRecord = { energyRecordId: '', year: dataYear, energyRole, scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode: reportedCount ? 'monthly' : 'annual', monthlyAmounts: [], annualAmount: 0 };
  return <Form draft={[values, reported, annualValue, unitId, deviceId, typeId, sourceOptionId, sourceProcess]} onDirtyChange={onDirtyChange} title={readOnly ? '查看回收能源' : item ? energyRole === '回收能源' ? '编辑回收能源' : '编辑能源消费' : energyRole === '回收能源' ? '新增回收能源' : '新增能源消费'} width={820} onClose={onClose} onSubmit={readOnly ? undefined : () => {
    if ((level === '重点设备' ? !deviceId : level !== '企业' && !effectiveUnitId) || !typeId) return setError('请选择归属范围和能源品种。');
    const reportedAnnual = monthlyComplete ? 0 : Number(annualValue || 0);
    if (!reportedCount && !(reportedAnnual > 0)) return setError('请至少填写一个月度数据，或补录年度总量。');
    if (reportedAnnual > 0 && reportedAnnual < monthlyTotal) return setError('年度总量不能小于已录月份之和。');
    const result = saveV11EnergyRecord({ ...item, year: dataYear, energyRole, scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode: reportedCount ? 'monthly' : 'annual', monthlyAmounts: monthNumbers, monthlyReportedMonths: reported, annualAmount: reportedAnnual, sourceDeviceId: energyRole === '回收能源' ? unitInput ? item?.sourceDeviceId : selectedSourceOption?.deviceId : undefined, sourceProcess: energyRole === '回收能源' ? sourceProcess.trim() || undefined : undefined }, item?.energyRecordId);
    if (!result.ok) return setError(result.error);
    if (conversionInput) {
      const saved = listV11EnergyRecords().find((record) => record.year === dataYear && record.energyRole === energyRole && record.energyUnitId === effectiveUnitId && record.energyTypeId === typeId && v11RecordScopeType(record) === scopeType)!;
      const linked = saveFlowConversion({ ...conversionInput, inputEnergyRecordId: saved.energyRecordId, inputMode: energyRole === '回收能源' ? 'recovery' : 'linked', lossBasis: conversionInput.lossBasis ?? ((conversionInput.lossAmount ?? 0) > 0 ? conversionInput.remark : undefined) }, conversionInput.conversionOutputId);
      if (!linked.ok) { deleteV11EnergyRecord(saved.energyRecordId); return setError(linked.error); }
    }
    onSaved(item ? '能源数据已更新' : '能源数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}>
      <span>数据期间 <strong>{dataYear}年</strong></span><span>业务阶段 <strong>{energyStage(recordPreview)}</strong></span>
      {energyRole === '回收能源' && !unitInput ? <><span>能源品种 <strong>{type?.energyTypeName ?? '回收能源'}</strong></span><span>所属一级用能单元 <strong>{recoveryParentUnit?.energyUnitName ?? '待选择'}</strong></span><span>所属二级用能单元 <strong>{selectedUnit?.unitLevel === 'level2' ? selectedUnit.energyUnitName : selectedUnit ? '一级单元直属设备' : '待选择'}</strong></span></> : <>{level === '企业' && <><span>归属层级 <strong>企业</strong></span><span>录入范围 <strong>全厂</strong></span></>}{level === '一级用能单元' && <><span>归属层级 <strong>一级用能单元</strong></span><span>录入范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}{level === '二级用能单元' && <><span>归属层级 <strong>二级用能单元</strong></span><span>所属一级 <strong>{v11ScopeName(parentUnitId, Number(maintenanceYear))}</strong></span><span>录入范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}{level === '重点设备' && <><span>重点设备 <strong>{device?.deviceName ?? '待选择'}</strong></span><span>所属用能单元 <strong>{v11ScopeName(device?.energyUnitId ?? null, Number(maintenanceYear))}</strong></span><span>设备类型 <strong>{device?.deviceType ?? '—'}</strong></span></>}</>}
    </div>
    {energyRole === '回收能源' && level !== '重点设备' && !unitInput && <div className={styles.compactGrid}><Field label="余热产生设备" required>{item ? <div className={styles.readonlyField}>{sourceDeviceName}</div> : <select value={sourceOptionId} onChange={(event) => setSourceOptionId(event.target.value)}><option value="">{legacyRecoveryUnitId ? '历史来源未细化设备，可选择设备补充' : '请选择余热产生设备'}</option>{recoverySourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</Field><Field label="余热产生部位（选填）"><input value={sourceProcess} readOnly={readOnly} placeholder="如冷却系统、烘干段、排烟" onChange={(event) => setSourceProcess(event.target.value)} /></Field></div>}
    {level === '重点设备' ? <div className={styles.deviceEnergySelectors}>
      <Field label="重点设备" required><select disabled={inline && Boolean(initialMonth)} value={deviceId} onChange={(event) => { const id = event.target.value; const nextDevice = devices.find((value) => value.deviceId === id); setDeviceId(id); setTypeId(nextDevice?.mainEnergyTypeId ?? ''); }}><option value="">请选择重点设备</option>{devices.map((value) => <option key={value.deviceId} value={value.deviceId}>{value.deviceName}</option>)}</select></Field>
      <Field label="能源品种" required><select disabled={inline && Boolean(initialMonth)} value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{selectableTypes.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field>
    </div> : energyRole === '回收能源' && !unitInput ? null : <div className={styles.full}><Field label="能源品种" required><select disabled={inline && Boolean(initialMonth)} value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{selectableTypes.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field></div>}
    <div className={`${styles.full} ${styles.helpText}`}>{energyRole === '回收能源' ? `按实际已取得月份填报（单位：${type?.measurementUnit ?? '—'}）；月度数据不完整时可补录年度总量，系统不会自动分摊缺失月份。` : '按实际已取得月份填报；月度数据不完整时可补录年度总量，系统不会自动分摊缺失月份。'}</div>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input aria-label={`${month}能源数量`} autoFocus={initialMonth === index + 1} type="number" min="0" step="any" value={values[index]} readOnly={readOnly} onChange={(event) => { const value = event.target.value; setValues((current) => current.map((item, i) => i === index ? value : item)); setReported((current) => current.map((item, i) => i === index ? value !== '' : item)); }} /></Field>)}</div>
    {<div className={styles.full}><Field label={`${monthlyComplete ? '年度合计' : '年度总量补录'}${type ? `（${type.measurementUnit}）` : ''}`}><input type="number" min="0" step="any" value={monthlyComplete ? String(monthlyTotal) : annualValue} readOnly={readOnly || monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整或仅有年度台账时填写'} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div>}
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Form>;
}

function EnergyCostsPage() {
  const [maintenanceYear, changeYear] = useDataYear();
  const { guard, onDirtyChange, confirmation } = useInlineEditGuard();
  const changeMaintenanceYear = (next: string) => guard(() => changeYear(next));
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const year = maintenanceYear;
  const setYear = changeMaintenanceYear;
  const [typeId, setTypeId] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11EnergyCost | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyCost | null>(null);
  const showDetails = (id: string | null) => guard(() => { setEditing(null); setExpanded(id); });
  const editRecord = (row: V11EnergyCost) => guard(() => { setExpanded(row.energyCostId); setEditing(row); });
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const rows = listV11EnergyCosts().filter((item) => item.year === Number(year) && (!typeId || item.energyTypeId === typeId));
  void version;
  return <Page toast={toast}>{confirmation}<section className={styles.card}>
    <Toolbar actions={<Button primary onClick={() => guard(() => setEditing('new'))}>＋ 新增成本数据</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
      <Field label="能源品种"><select value={typeId} onChange={(event) => { const next = event.target.value; guard(() => { setEditing(null); setExpanded(null); setTypeId(next); }); }}><option value="">全部</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    </Toolbar>
    <div className={styles.tableWrap}><table className={styles.costTable}><thead><tr><th>能源品种</th><th>年度合计（万元）</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.flatMap((row) => {
        const total = annual(row.monthlyCosts, row.annualCost);
        const detail = expanded === row.energyCostId;
        return [<tr key={row.energyCostId}><td className={styles.strong}>{types.find((type) => type.energyTypeId === row.energyTypeId)?.energyTypeName}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.energyCostId)} onEdit={() => editRecord(row)} onDelete={() => guard(() => { setEditing(null); setDeleting(row); })} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyCostId}-detail`}><td colSpan={3}><MonthDetail onCollapse={() => showDetails(null)} editor={editing !== 'new' && editing?.energyCostId === row.energyCostId ? <EnergyCostDialog key={`${row.energyCostId}:${version}`} inline onDirtyChange={onDirtyChange} item={row} dataYear={row.year} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} /> : undefined} values={row.monthlyCosts} reported={row.monthlyReportedMonths ?? row.monthlyCosts.map((value) => value > 0)} annualValue={total} annualSupplemented={(row.annualCost ?? 0) > 0} unit="万元" /></td></tr>];
      }) : <EmptyRow colSpan={3} />}</tbody>
    </table></div><Pagination count={rows.length} />
  </section>
  {editing === 'new' && <EnergyCostDialog item={editing === 'new' ? undefined : editing} dataYear={Number(year)} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除成本数据" width={480} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11EnergyCost(deleting.energyCostId); setDeleting(null); setVersion((value) => value + 1); notify('成本数据已删除'); }}><div className={styles.warning}>确认删除能源成本数据吗？</div></Modal>}
  </Page>;
}
function EnergyCostDialog({ inline = false, onDirtyChange, item, dataYear, onClose, onSaved }: { inline?: boolean; onDirtyChange?: (dirty: boolean) => void; item?: V11EnergyCost; dataYear: number; onClose: () => void; onSaved: (message: string) => void }) {
  const Form = inline ? InlineDataForm : Modal;
  const [maintenanceYear] = useDataYear();
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const selectableTypes = types.filter((type) => type.energyTypeId === item?.energyTypeId || isV11EnergyTypeEnabled(type.energyTypeId, Number(maintenanceYear)));
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? '');
  const initialReported = item?.monthlyReportedMonths ?? item?.monthlyCosts.map((value) => value > 0) ?? Array(12).fill(false);
  const [reported, setReported] = useState<boolean[]>(initialReported);
  const [values, setValues] = useState<string[]>(item ? item.monthlyCosts.map((value, index) => initialReported[index] ? String(value) : '') : Array(12).fill(''));
  const [annualCost, setAnnualCost] = useState(String(item?.annualCost || ''));
  const [error, setError] = useState('');
  const monthlyCosts = values.map((value) => Number(value || 0));
  const monthlyTotal = monthlyCosts.reduce((sum, value) => sum + value, 0);
  const monthlyComplete = reported.every(Boolean);
  return <Form draft={[values, reported, annualCost, typeId]} onDirtyChange={onDirtyChange} title={`${item ? '编辑成本数据' : '新增成本数据'}（${maintenanceYear}年度）`} width={820} onClose={onClose} onSubmit={() => {
    const reportedCount = reported.filter(Boolean).length;
    const supplementedAnnualCost = monthlyComplete ? 0 : Number(annualCost || 0);
    if (!typeId || (!reportedCount && !(supplementedAnnualCost > 0))) return setError('请选择能源品种，并至少填写一个月度成本或补录年度总成本。');
    if (supplementedAnnualCost > 0 && supplementedAnnualCost < monthlyTotal) return setError('年度总成本不能小于已录月份成本之和。');
    const result = saveV11EnergyCost({ year: item?.year ?? dataYear, energyTypeId: typeId, monthlyCosts, monthlyReportedMonths: reported, annualCost: supplementedAnnualCost }, item?.energyCostId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '成本数据已更新' : '成本数据已新增');
  }}><div className={styles.formGrid}>
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择</option>{selectableTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    <Field label="成本单位"><input value="万元" readOnly /></Field>
    <div className={`${styles.full} ${styles.helpText}`}>按实际已取得月份填报；月度成本不完整时可补录年度总成本，系统不会自动分摊缺失月份。</div>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={`${month}成本`}><input aria-label={`${month}成本`} step="any" min="0" type="number" value={values[index]} onChange={(event) => { const value = event.target.value; setValues((current) => current.map((item, i) => i === index ? value : item)); setReported((current) => current.map((item, i) => i === index ? value !== '' : item)); }} /></Field>)}</div>
    {<div className={`${styles.full}`}><Field label={`${monthlyComplete ? '年度合计' : '年度总成本补录'}（万元）`}><input min="0" type="number" value={monthlyComplete ? String(monthlyTotal) : annualCost} readOnly={monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整或仅有年度台账时填写'} onChange={(event) => setAnnualCost(event.target.value)} /></Field></div>}
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Form>;
}

function OperationsPage() {
  const [maintenanceYear, changeYear] = useDataYear();
  const { guard, onDirtyChange, confirmation } = useInlineEditGuard();
  const changeMaintenanceYear = (next: string) => guard(() => changeYear(next));
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  const returnToOrigin = () => {
    if (returnTo?.startsWith('/energy-analysis/intensity')) navigate(returnTo);
  };
  const requestedScopeLevel = params.get('scopeLevel');
  const requestedScope = requestedScopeLevel === '企业' || requestedScopeLevel === '一级用能单元' || requestedScopeLevel === '二级用能单元' ? requestedScopeLevel : undefined;
  const requestedUnitId = params.get('unitId') ?? '';
  const requestedProductId = params.get('productId') ?? '';
  const requestedMetricName = params.get('metricName') ?? undefined;
  const requestedCategory = params.get('category') === '产量' || params.get('category') === '经济指标' || params.get('category') === '运行指标' ? params.get('category') as V11OperationMetric['metricCategory'] : undefined;
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const yearInput = maintenanceYear;
  const setYearInput = changeMaintenanceYear;
  const [categoryInput, setCategoryInput] = useState(requestedCategory ?? '');
  const [keywordInput, setKeywordInput] = useState(params.get('keyword') ?? '');
  const [filters, setFilters] = useState({ year: maintenanceYear, category: requestedCategory ?? '', keyword: params.get('keyword') ?? '' });
  const [level, setLevel] = useState<OperationScopeView>(requestedScope ?? '全部层级');
  const [newScopeLevel, setNewScopeLevel] = useState<ScopeLevel | null>(requestedScope ?? null);
  const [newUnitId, setNewUnitId] = useState(requestedUnitId);
  const [expanded, setExpanded] = useState<string | null>(params.get('recordId'));
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [newMetricPreset, setNewMetricPreset] = useState<{ category: V11OperationMetric['metricCategory']; metricName: string } | undefined>();
  const [editing, setEditing] = useState<V11OperationMetric | 'new' | null>(() => {
    const recordId = params.get('recordId');
    if (recordId) return listV11OperationMetrics().find((record) => record.operationMetricId === recordId) ?? null;
    return params.get('new') === '1' ? 'new' : null;
  });
  const showDetails = (id: string | null) => guard(() => { setEditing(null); setExpanded(id); });
  const editRecord = (row: V11OperationMetric) => guard(() => { setExpanded(row.operationMetricId); setEditing(row); });
  const renderOperationDetails = (row: V11OperationMetric, total: number) => <MonthDetail values={row.monthlyValues} reported={row.entryMode === 'annual' ? Array(12).fill(false) : row.monthlyReportedMonths ?? row.monthlyValues.map((value) => value > 0)} annualValue={total} annualSupplemented={row.annualValue > 0} unit={row.metricUnit} onCollapse={() => showDetails(null)} editor={editing !== 'new' && editing?.operationMetricId === row.operationMetricId ? <OperationDialog inline onDirtyChange={onDirtyChange} item={row} dataYear={row.year} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); }} /> : undefined} />;
  const [deleting, setDeleting] = useState<V11OperationMetric | null>(null);
  const [allocationEditing, setAllocationEditing] = useState<{ product?: ProductMaster; energyUnitId?: string } | null>(null);
  const products = listProducts(Number(maintenanceYear));
  const productNames = new Map(products.map((product) => [product.productId, product.productName]));
  const matchesFilters = (item: V11OperationMetric) => item.year === Number(filters.year)
    && (!filters.category || item.metricCategory === filters.category)
    && (!requestedUnitId || item.energyUnitId === requestedUnitId)
    && (!requestedProductId || item.productId === requestedProductId)
    && (!filters.keyword || `${v11ScopeName(item.energyUnitId, Number(maintenanceYear))}${item.metricName}${item.productId ? productNames.get(item.productId) ?? '' : ''}`.includes(filters.keyword));
  const operationRecords = uniqueOperationRecords(listV11OperationMetrics());
  const units = listEnergyUnits(Number(maintenanceYear));
  const rows = operationRecords.filter((item) => matchesFilters(item) && (level === '全部层级' || item.scopeLevel === level));
  const scopedUnits = (level === '一级用能单元' || level === '二级用能单元')
    ? units.filter((unit) => unit.unitLevel === (level === '一级用能单元' ? 'level1' : 'level2') && (!requestedUnitId || unit.energyUnitId === requestedUnitId))
    : [];
  const metricPresetForUnit = (unit: typeof units[number]) => unit.unitType === '生产单元' || unit.unitType === '工序/环节'
    ? { category: '产量' as const, metricName: '产品产量' }
    : unit.energyUnitId === 'eu-utilities'
      ? { category: '运行指标' as const, metricName: '动力中心供能量' }
      : unit.energyUnitId === 'eu-office'
        ? { category: '运行指标' as const, metricName: '办公建筑面积' }
        : unit.energyUnitId === 'eu-public-support'
          ? { category: '运行指标' as const, metricName: '货物吞吐量' }
          : { category: '运行指标' as const, metricName: '运营量' };
  const countForLevel = (item: OperationScopeView) => operationRecords.filter((record) => matchesFilters(record) && (item === '全部层级' || record.scopeLevel === item)).length;
  const overviewGroups = (['企业', '一级用能单元', '二级用能单元'] as ScopeLevel[]).flatMap((scopeLevel) => {
    const scopeRows = operationRecords.filter((row) => matchesFilters(row) && row.scopeLevel === scopeLevel);
    const groupMap = new Map<string, { scopeKey: string; scopeName: string; depth: number; rows: V11OperationMetric[] }>();
    scopeRows.forEach((row) => {
      const scopeKey = scopeLevel === '企业' ? 'operation:enterprise' : `operation:${scopeLevel}:${row.energyUnitId ?? 'unknown'}`;
      const group = groupMap.get(scopeKey) ?? { scopeKey, scopeName: scopeLevel === '企业' ? '全厂' : v11ScopeName(row.energyUnitId, Number(maintenanceYear)), depth: scopeLevel === '企业' ? 0 : scopeLevel === '一级用能单元' ? 1 : 2, rows: [] };
      group.rows.push(row);
      groupMap.set(scopeKey, group);
    });
    const groups = [...groupMap.values()];
    if (!groups.length) return [];
    return [
      <tr className={styles.functionalGroupRow} key={`operation-level-${scopeLevel}`}><td colSpan={7}><div className={styles.functionalGroupTitle}><strong>{scopeLevel}层级</strong></div></td></tr>,
      ...groups.flatMap((group) => {
        const isCollapsed = collapsedScopes.has(group.scopeKey);
        const groupRow = <tr className={styles.scopeGroupRow} key={`${group.scopeKey}-group`}><td colSpan={7}><div className={`${styles.scopeCell} ${styles[`scopeDepth${group.depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${group.scopeName}`} aria-expanded={!isCollapsed} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(group.scopeKey)) next.delete(group.scopeKey); else next.add(group.scopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{group.scopeName}</b></span></div></td></tr>;
        const records = isCollapsed ? [] : group.rows.flatMap((row) => {
          const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
          return [<tr className={styles.scopeRecordRow} key={row.operationMetricId}><td><div className={styles.scopeChild}><span>└─ {row.metricName}</span></div></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.operationMetricId)} onEdit={() => editRecord(row)} onDelete={() => setDeleting(row)} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}>{renderOperationDetails(row, total)}</td></tr>];
        });
        return [groupRow, ...records];
      }),
    ];
  });
  const renderScopedUnitRows = (unit: typeof units[number]) => {
    const unitRows = rows.filter((row) => row.energyUnitId === unit.energyUnitId);
    return [
      <tr className={styles.scopeGroupRow} key={`${unit.energyUnitId}-group`}>
        <td><div className={styles.scopeCell}><i /><span><b>{unit.energyUnitName}</b></span></div></td>
        <td colSpan={5} />
        <td className={styles.scopeGroupActionCell}><div className={styles.scopeGroupActions}><button type="button" className={styles.scopeAddButton} onClick={() => { setNewScopeLevel(level as ScopeLevel); setNewUnitId(unit.energyUnitId); setNewMetricPreset(metricPresetForUnit(unit)); setEditing('new'); }}>＋ 新增运营数据</button>{level === '一级用能单元' && unit.unitType === '生产单元' && <button type="button" className={styles.scopeAddButton} onClick={() => setAllocationEditing({ energyUnitId: unit.energyUnitId })}>配置分配</button>}</div></td>
      </tr>,
      ...(unitRows.length ? unitRows.flatMap((row) => {
        const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
        return [<tr key={row.operationMetricId}><td><div className={styles.scopeChild}><span>└─ {row.metricName}</span></div></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.operationMetricId)} onEdit={() => editRecord(row)} onDelete={() => setDeleting(row)} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}>{renderOperationDetails(row, total)}</td></tr>];
      }) : [<tr key={`${unit.energyUnitId}-empty`}><td colSpan={7} className={styles.emptyRow}>暂无运营数据</td></tr>]),
    ];
  };
  void version;
  return <Page toast={toast}>{confirmation}<section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, category: categoryInput, keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setCategoryInput(''); setKeywordInput(''); setLevel('全部层级'); setFilters({ year: maintenanceYear, category: '', keyword: '' }); }}>重置</Button>{returnTo && <Button onClick={returnToOrigin}>返回能耗指标</Button>}{level === '企业' && <Button primary onClick={() => { setNewScopeLevel('企业'); setNewUnitId(''); setEditing('new'); }}>＋ 新增运营数据</Button>}{level === '全部层级' && <span className={styles.entryHint}>层级总览仅用于只读核查，请切换至具体层级后维护数据</span>}</>}>
      <Field label="年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
      <Field label="指标类别"><select value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option><option>产量</option><option>运行指标</option><option>经济指标</option></select></Field>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="产品 / 归属范围 / 指标名称" /></Field>
    </Toolbar>
    <div className={styles.levelTabs}>{operationLevels.map((item) => <button type="button" key={item} className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{scopeViewLabel(item)}{item === '企业' && <span className={styles.requiredMark}>必填</span>}（{countForLevel(item)}）</button>)}</div>
    <Notice><strong>说明：</strong>产量和运行指标可在企业、一级或二级用能单元层级维护；经济指标仅在企业层级维护。“层级总览”用于跨层级只读核查，不提供录入入口。</Notice>
     <div className={styles.tableWrap}><table><thead><tr><th>归属范围</th><th>指标类别</th><th>指标名称</th><th>产品</th><th>单位</th><th>年度值</th><th>操作</th></tr></thead><tbody>{level === '全部层级' ? (overviewGroups.length ? overviewGroups : <EmptyRow colSpan={7} />) : level === '一级用能单元' || level === '二级用能单元' ? scopedUnits.flatMap(renderScopedUnitRows) : rows.length ? rows.flatMap((row) => {
      const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
      return [<tr key={row.operationMetricId}><td className={styles.strong}>{v11ScopeName(row.energyUnitId, Number(maintenanceYear))}<small className={styles.subText}>{row.scopeLevel}</small></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions viewLabel={detail ? '收起' : '查看'} onView={() => showDetails(detail ? null : row.operationMetricId)} onEdit={() => editRecord(row)} onDelete={() => setDeleting(row)} /></td></tr>,
      detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}>{renderOperationDetails(row, total)}</td></tr>];
    }) : <EmptyRow colSpan={7} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing === 'new' && <OperationDialog item={editing === 'new' ? undefined : editing} dataYear={Number(filters.year)} scopeContext={editing === 'new' ? newScopeLevel ?? undefined : undefined} initialUnitId={editing === 'new' ? newUnitId : undefined} initialCategory={editing === 'new' ? newMetricPreset?.category : requestedCategory} initialMetricName={editing === 'new' ? newMetricPreset?.metricName : requestedMetricName} onClose={() => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); setNewMetricPreset(undefined); if (returnTo) returnToOrigin(); }} onSaved={(message) => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); setNewMetricPreset(undefined); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); }} />}
   {deleting && <Modal title="删除运营数据" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11OperationMetric(deleting.operationMetricId); setDeleting(null); setVersion((value) => value + 1); notify('运营数据已删除，相关分析将按最新数据重新计算'); }}><div className={styles.warning}>确认删除“{deleting.metricName}”数据吗？</div></Modal>}
  {allocationEditing && <ProductAllocationDialog product={allocationEditing.product} energyUnitId={allocationEditing.energyUnitId} year={Number(filters.year)} onClose={() => setAllocationEditing(null)} onSaved={() => { setAllocationEditing(null); setVersion((value) => value + 1); notify('产品能源分配已保存，相关能耗指标将重新计算'); }} />}
  </Page>;
}

function DeviceOutputPage() {
  const [maintenanceYear, changeYear] = useDataYear();
  const { guard, onDirtyChange, confirmation } = useInlineEditGuard();
  const changeMaintenanceYear = (next: string) => guard(() => changeYear(next));
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo')?.startsWith('/energy-analysis/intensity') ? params.get('returnTo') : null;
  const returnToOrigin = () => {
    if (returnTo) navigate(returnTo);
  };
  const requestedDeviceId = params.get('deviceId') ?? '';
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const yearInput = maintenanceYear;
  const setYearInput = changeMaintenanceYear;
  const [filters, setFilters] = useState({ year: maintenanceYear, keyword: params.get('keyword') ?? '' });
  const [keywordInput, setKeywordInput] = useState(params.get('keyword') ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ device: V11KeyDevice; metricCode: DeviceIntensityMetricCode } | null>(null);
  const [deleting, setDeleting] = useState<{ device: V11KeyDevice; metricCode: DeviceIntensityMetricCode; year: number } | null>(null);
  const showDetails = (id: string | null) => guard(() => { setEditing(null); setExpanded(id); });
  const editRecord = (device: V11KeyDevice, metricCode: DeviceIntensityMetricCode) => guard(() => { setExpanded(device.deviceId); setEditing({ device, metricCode }); });
  const rows = listV11KeyDevices(Number(maintenanceYear)).flatMap((device) => {
    const metricCode = getDeviceIntensityTemplate(device.deviceId, Number(filters.year)) ?? 'custom-device-work';
    const config = getDeviceIntensityTemplateConfig(device.deviceId, Number(filters.year)) ?? fallbackDeviceOutputConfig(device, metricCode);
    const parameter = getDeviceIntensityParameter(device.deviceId, Number(filters.year), metricCode);
    return [{ device, metricCode, config, parameter }];
  }).filter((row) => (!requestedDeviceId || row.device.deviceId === requestedDeviceId)
    && (!filters.keyword || `${row.device.deviceName}${v11ScopeName(row.device.energyUnitId, Number(maintenanceYear))}${row.config?.denominator.name ?? row.device.outputBasis}`.includes(filters.keyword)));
  rows.sort((a, b) => Number(Boolean(b.parameter)) - Number(Boolean(a.parameter)) || a.device.deviceName.localeCompare(b.device.deviceName, 'zh-CN'));
  void version;
  return <Page toast={toast}>{confirmation}<section className={styles.card}>
    <Toolbar actions={<><Button primary onClick={() => guard(() => { setEditing(null); setExpanded(null); setFilters({ year: yearInput, keyword: keywordInput.trim() }); })}>查询</Button><Button onClick={() => guard(() => { setEditing(null); setExpanded(null);  setKeywordInput(''); setFilters({ year: maintenanceYear, keyword: '' }); })}>重置</Button>{returnTo && <Button onClick={() => guard(returnToOrigin)}>返回能耗指标</Button>}</>}>
      <Field label="年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="重点设备 / 所属用能单元 / 产出口径" /></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>设备产出数据自动继承“重点设备”中的全部设备。有数据的设备优先展示；没有数据的设备显示“待录入”，点击“录入”后按月或按年度补充。同一设备、同一年度只维护一份产出。设备产出用于设备能耗指标计算。</Notice>
    <div className={styles.tableWrap}><table className={styles.deviceOutputTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备产出口径</th><th>数据进度</th><th>年度值</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.flatMap((row) => {
      const parameterName = row.config?.denominator.name ?? row.device.outputBasis ?? '设备产出量';
      const parameterUnit = row.parameter?.unit ?? row.config?.denominator.unit ?? '—';
      const monthCount = row.parameter?.monthlyReportedMonths?.filter(Boolean).length ?? row.parameter?.monthlyValues?.filter((value) => value != null && value >= 0).length ?? 0;
      const progress = row.parameter ? monthCount === 12 ? '12/12月' : row.parameter.annualValue != null || row.parameter.value != null ? `${monthCount}/12月｜年度已补录` : `${monthCount}/12月｜年度待完善` : '待录入';
      const value = row.parameter?.annualValue ?? row.parameter?.value;
      const detail = expanded === row.device.deviceId;
      return [<tr key={`${row.device.deviceId}-${row.metricCode}`}><td className={styles.strong}>{row.device.deviceName}</td><td>{v11ScopeName(row.device.energyUnitId, Number(maintenanceYear))}</td><td>{parameterName}</td><td><Tag tone={row.parameter ? 'green' : 'orange'}>{progress}</Tag></td><td className={styles.number}>{value != null ? `${format(value, 2)} ${parameterUnit}` : '—'}</td><td><div className={styles.actions}>{row.parameter && <button type="button" onClick={() => showDetails(detail ? null : row.device.deviceId)}>{detail ? '收起' : '查看'}</button>}<button type="button" onClick={() => row.parameter ? editRecord(row.device, row.metricCode) : guard(() => setEditing({ device: row.device, metricCode: row.metricCode }))}>{row.parameter ? '编辑' : '录入'}</button>{row.parameter && <button type="button" className={styles.danger} onClick={() => setDeleting({ device: row.device, metricCode: row.metricCode, year: Number(filters.year) })}>删除</button>}</div></td></tr>,
        detail && row.parameter && <tr className={styles.detailRow} key={`${row.device.deviceId}-detail`}><td colSpan={6}><MonthDetail onCollapse={() => showDetails(null)} editor={editing?.device.deviceId === row.device.deviceId ? <DeviceOutputDialog key={`${row.device.deviceId}:${version}`} inline onDirtyChange={onDirtyChange} device={row.device} year={Number(filters.year)} metricCode={row.metricCode} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); }} /> : undefined} values={row.parameter.monthlyValues ?? []} reported={row.parameter.monthlyReportedMonths} annualValue={value} annualSupplemented={monthCount < 12 && value != null} unit={parameterUnit} /></td></tr>];
    }) : <EmptyRow colSpan={6} />}</tbody></table></div>
    <Pagination count={rows.length} />
  </section>
  {editing && !getDeviceIntensityParameter(editing.device.deviceId, Number(filters.year), editing.metricCode) && <DeviceOutputDialog device={editing.device} year={Number(filters.year)} metricCode={editing.metricCode} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToOrigin(); else notify(message); }} />}
  {deleting && <Modal title="删除设备产出数据" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteDeviceIntensityParameter(deleting.device.deviceId, deleting.year, deleting.metricCode); setDeleting(null); setVersion((value) => value + 1); notify('设备产出数据已删除'); }}><div className={styles.warning}>确认删除“{deleting.device.deviceName}”{deleting.year}年度的全部产出数据（含月度及年度值）吗？</div><p className={styles.modalNote}>设备档案和其他年度数据保留；本年度相关设备能耗指标将缺少产出数据。</p></Modal>}
  </Page>;
}

function DeviceOutputDialog({ inline = false, onDirtyChange, device, year, metricCode, onClose, onSaved }: { inline?: boolean; onDirtyChange?: (dirty: boolean) => void; device: V11KeyDevice; year: number; metricCode: DeviceIntensityMetricCode; onClose: () => void; onSaved: (message: string) => void }) {
  const Form = inline ? InlineDataForm : Modal;
  const config = getDeviceIntensityTemplateConfig(device.deviceId, year);
  const existing = getDeviceIntensityParameter(device.deviceId, year, metricCode);
  const effectiveConfig = config ?? fallbackDeviceOutputConfig(device, metricCode);
  const parameterName = effectiveConfig.denominator.name ?? device.outputBasis ?? '设备产出量';
  const [monthlyValues, setMonthlyValues] = useState<Array<number | null>>(() => existing?.monthlyValues?.length === 12 ? existing.monthlyValues.map((value, index) => existing.monthlyReportedMonths?.[index] === false ? null : value) : Array(12).fill(null));
  const [annualValue, setAnnualValue] = useState(existing?.entryMode === 'monthly' ? '' : String(existing?.annualValue ?? existing?.value ?? ''));
  const [unit, setUnit] = useState(existing?.unit ?? effectiveConfig.denominator.unit ?? '');
  const [source, setSource] = useState(existing?.source ?? '');
  const [error, setError] = useState('');
  const complete = monthlyValues.every((value) => value !== null && Number.isFinite(value) && value >= 0);
  const save = () => {
    const normalized = monthlyValues.map((value) => value !== null && Number.isFinite(value) ? value : null);
    const hasMonthlyInput = normalized.some((value) => value !== null);
    const annual = Number(annualValue);
    const monthlyTotal = normalized.reduce<number>((total, item) => total + (item ?? 0), 0);
    const value = complete || !annualValue.trim() ? monthlyTotal : annual;
    if (!hasMonthlyInput && (!annualValue.trim() || !Number.isFinite(value) || value < 0)) return setError(`请填写年度${parameterName}`);
    if (normalized.some((item) => item !== null && item < 0) || !Number.isFinite(value) || value < monthlyTotal) return setError('数量不能为负，年度补录值不能小于已填月份合计');
    if (!unit.trim()) return setError('请填写产出计量单位');
    const result = saveDeviceIntensityParameter({ deviceId: device.deviceId, year, metricCode, value, annualValue: value, monthlyValues: normalized, monthlyReportedMonths: normalized.map((item) => item !== null), entryMode: complete || !annualValue.trim() ? 'monthly' : 'annual-fallback', unit: unit.trim(), source: source || (complete ? `重点设备产出数据—月度${parameterName}` : `重点设备产出数据—年度${parameterName}`) } satisfies DeviceIntensityParameter);
    if (!result.ok) return setError('设备产出数据保存失败');
    if (!config) saveDeviceIntensityTemplate({ deviceId: device.deviceId, year, metricCode, config: { ...effectiveConfig, metricCode } });
    onSaved(complete ? '月度设备产出数据已保存，年度指标将重新计算' : '年度设备产出数据已保存，年度指标将重新计算');
  };
  return <Form draft={[monthlyValues, annualValue, unit, source]} onDirtyChange={onDirtyChange} title={`${existing ? '编辑设备产出数据' : '录入设备产出数据'}（${year}年度）`} width={980} onClose={onClose} onSubmit={save} submitText="保存并重新计算"><div className={styles.modalNote}>正在维护：<strong>{device.deviceName}</strong>｜{parameterName}。用于计算该设备的能耗指标。空白表示未取得，实际为零请填 0。</div><div className={styles.formGrid}><div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input aria-label={`${month}${parameterName}`} type="number" min="0" step="0.001" value={monthlyValues[index] ?? ''} onChange={(event) => setMonthlyValues((current) => current.map((value, valueIndex) => valueIndex === index ? (event.target.value.trim() === '' ? null : Number(event.target.value)) : value))} /></Field>)}</div>{<><Field label={complete ? '年度合计（自动汇总）' : `年度${parameterName}（选填，未填按已报月份汇总）`}><input aria-label={`年度${parameterName}`} type="number" min="0" step="0.001" value={complete ? monthlyValues.reduce<number>((total, item) => total + (item ?? 0), 0) : annualValue} readOnly={complete} onChange={(event) => setAnnualValue(event.target.value)} /></Field><Field label="产出计量单位" required><input aria-label="产出计量单位" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：Nm³、t、kWh" /></Field><div className={styles.full}><Field label="数据来源说明"><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="选填" /></Field></div></>}{error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}</div></Form>;
}

function ProductAllocationDialog({ product, energyUnitId, year, onClose, onSaved }: { product?: ProductMaster; energyUnitId?: string; year: number; onClose: () => void; onSaved: () => void }) {
  const products = listProducts(year).filter((item) => item.status === 'active');
  const units = listEnergyUnits(year).filter((unit) => energyUnitId ? unit.energyUnitId === energyUnitId : product?.linkedEnergyUnitIds.includes(unit.energyUnitId));
  const unitProducts = new Map(units.map((unit) => [unit.energyUnitId, products.filter((item) => item.linkedEnergyUnitIds.includes(unit.energyUnitId))]));
  const [shares, setShares] = useState<Record<string, string>>(() => Object.fromEntries(
    units.flatMap((unit) => (unitProducts.get(unit.energyUnitId) ?? []).map((item) => {
      const configured = item.energyAllocations.find((allocation) => allocation.energyUnitId === unit.energyUnitId)?.share;
      return [`${item.productId}:${unit.energyUnitId}`, String(configured ?? 100)];
    })),
  ));
  const submit = () => {
    for (const unit of units) {
      const related = unitProducts.get(unit.energyUnitId) ?? [];
      const total = related.reduce((sum, item) => sum + Number(shares[`${item.productId}:${unit.energyUnitId}`] || 0), 0);
      if (related.length > 1 && Math.abs(total - 100) > 0.001) return window.alert(`“${unit.energyUnitName}”下产品分配比例合计为${total}%，必须等于100%。`);
      if (related.some((item) => !(Number(shares[`${item.productId}:${unit.energyUnitId}`]) > 0))) return window.alert(`请完善“${unit.energyUnitName}”下所有产品的分配比例。`);
    }
    const affected = products.filter((item) => item.linkedEnergyUnitIds.some((unitId) => units.some((unit) => unit.energyUnitId === unitId)));
    affected.forEach((item) => {
      const hasSharedUnit = item.linkedEnergyUnitIds.some((unitId) => (unitProducts.get(unitId) ?? []).length > 1);
      const energyAllocations = item.linkedEnergyUnitIds.map((unitId) => ({
        energyUnitId: unitId,
        share: shares[`${item.productId}:${unitId}`] !== undefined
          ? Number(shares[`${item.productId}:${unitId}`])
          : item.energyAllocations.find((allocation) => allocation.energyUnitId === unitId)?.share ?? 100,
      }));
      updateProductAllocation(item.productId, hasSharedUnit ? 'ratio' : 'exclusive', energyAllocations, undefined, year);
    });
    onSaved();
  };
  return <Modal title={`配置产品能源分配（${year}年度）`} width={720} submitText="保存分配" onClose={onClose} onSubmit={submit}>
    <div className={styles.modalNote}>单一产品关联生产单元自动按 100% 归属；多个产品共用生产单元时，需维护年度手工比例，且合计必须为 100%。</div>
    {units.length ? units.map((unit) => {
      const related = unitProducts.get(unit.energyUnitId) ?? [];
      return <section key={unit.energyUnitId} className={styles.formSection}>
        <h4>{unit.energyUnitName}</h4>
        {related.map((item) => <label className={styles.modalField} key={`${item.productId}:${unit.energyUnitId}`}><span>{item.productName}（{item.unit}）</span><div className={styles.inlineField}><input aria-label={`${item.productName}在${unit.energyUnitName}的分配比例`} type="number" min="0.01" max="100" step="0.01" value={shares[`${item.productId}:${unit.energyUnitId}`] ?? ''} disabled={related.length === 1} onChange={(event) => setShares((current) => ({ ...current, [`${item.productId}:${unit.energyUnitId}`]: event.target.value }))} /><span>%</span></div></label>)}
        <div className={styles.helpText}>{related.length === 1 ? '当前生产单元仅关联一个有效产品，系统按 100% 自动归属。' : '同一生产单元下所有有效产品比例合计必须等于 100%。'}</div>
      </section>;
    }) : <div className={styles.emptyRow}>当前产品尚未关联生产用能单元。</div>}
  </Modal>;
}

function OperationDialog({ inline = false, onDirtyChange, item, dataYear, scopeContext, initialUnitId, initialCategory, initialMetricName, onClose, onSaved }: { inline?: boolean; onDirtyChange?: (dirty: boolean) => void; item?: V11OperationMetric; dataYear: number; scopeContext?: ScopeLevel; initialUnitId?: string; initialCategory?: V11OperationMetric['metricCategory']; initialMetricName?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const Form = inline ? InlineDataForm : Modal;
  const [maintenanceYear] = useDataYear();
  const units = listEnergyUnits(Number(maintenanceYear));
  const products = listProducts(Number(maintenanceYear));
  const officeScopedCreation = !item && initialUnitId === 'eu-office';
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const categoryValue = officeScopedCreation ? '运行指标' : item?.metricCategory ?? initialCategory ?? '产量';
  const defaultEnterpriseProduct = products.find((product) => product.status === 'active') ?? products[0];
  const enterpriseProductOutputCreation = !item && scopeContext === '企业' && categoryValue === '产量';
  const initialMetricPreset = item
    ? metricPresets[item.metricCategory].find((entry) => entry[0] === item.metricName)
    : metricPresets[categoryValue].find((entry) => entry[0] === (officeScopedCreation ? '办公建筑面积' : initialMetricName));
  const scopedCreation = !item && !!scopeContext;
  const linkedEntry = !item && Boolean(initialCategory && initialMetricName);
  const lockedMetricDefinition = Boolean(item) || linkedEntry || officeScopedCreation;
  const lockedOwnership = scopedCreation || Boolean(item) || linkedEntry;
  const [category, setCategory] = useState<V11OperationMetric['metricCategory']>(categoryValue);
  const [preset, setPreset] = useState(item ? initialMetricPreset?.[0] ?? '' : officeScopedCreation ? '办公建筑面积' : initialMetricName ?? (categoryValue === '产量' ? '产品产量' : ''));
  const [productId, setProductId] = useState(item?.productId ?? (enterpriseProductOutputCreation ? defaultEnterpriseProduct?.productId ?? '' : ''));
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(item?.scopeLevel ?? scopeContext ?? '企业');
  const [unitId, setUnitId] = useState(item ? item.energyUnitId ?? '__enterprise__' : initialUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : '');
  const [metricUnit, setMetricUnit] = useState(item?.metricUnit ?? initialMetricPreset?.[1] ?? (enterpriseProductOutputCreation ? defaultEnterpriseProduct?.unit ?? '' : ''));
  const [values, setValues] = useState<string[]>(Array.from({ length: 12 }, (_, index) => item && item.entryMode !== 'annual' && (item.monthlyReportedMonths?.[index] ?? item.monthlyValues[index] > 0) ? String(item.monthlyValues[index]) : ''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualValue || ''));
  const [error, setError] = useState('');
  const fixedAnnualMetric = preset === '办公建筑面积' || item?.metricCode === 'building_area';
  // 经济指标一期支持月度填报；只有办公建筑面积等静态基数保持年度单值。
  const annualMode = fixedAnnualMetric;
  const enterpriseMetric = category === '经济指标';
  const monthlyComplete = values.every((value) => value.trim() !== '');
  const monthlyTotal = values.reduce((sum, value) => sum + Number(value || 0), 0);
  const allowEconomicMetric = !scopedCreation || scopeContext === '企业';
  const productOutput = category === '产量' && preset === '产品产量';
  const enterpriseScope = scopeLevel === '企业';
  const productOptions = enterpriseScope && !item ? products.filter((product) => product.productId === productId) : products;
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = scopeLevel === '一级用能单元'
    ? levelOneUnits.filter((unit) => !productOutput || unit.unitType === '生产单元')
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
  const recordYear = item?.year ?? dataYear;
  return <Form draft={[values, annualValue, productId, metricUnit]} onDirtyChange={onDirtyChange} title={item ? '编辑运营数据' : `新增运营数据（${recordYear}年度）`} width={820} onClose={onClose} onSubmit={() => {
    const officeUnit = unitId === 'eu-office';
    const name = productOutput ? '产品产量' : officeUnit ? '办公建筑面积' : preset;
    if (!name || !metricUnit || (!annualMode && !enterpriseScope && !unitId) || (productOutput && !productId)) return setError('请完整填写必填字段。');
    if (productOutput && scopeLevel === '二级用能单元') return setError('最终产品产量仅支持企业或一级生产用能单元维护。');
    if (productOutput && scopeLevel === '一级用能单元' && selectedUnit?.unitType !== '生产单元') return setError('产品产量只能关联一级生产用能单元。');
    const monthNumbers = values.map((value) => Number(value || 0));
    if (fixedAnnualMetric && !(Number(annualValue) > 0)) return setError('请填写办公建筑面积年度值。');
    if (!fixedAnnualMetric) {
      if (!monthNumbers.some((value) => value > 0) && !(Number(annualValue) > 0)) return setError('月度数据或年度汇总数据至少填写一项。');
    }
    const resolvedProductId: string | null = productOutput ? productId : null;
    if (productOutput && resolvedProductId && unitId && !enterpriseScope) {
      const linked = linkProductEnergyUnit(resolvedProductId, unitId, Number(maintenanceYear));
      if (!linked.ok) return setError(linked.error);
    }
    const resolvedUnit = units.find((unit) => unit.energyUnitId === unitId);
    const metricCode = productOutput
      ? 'product_output'
      : item?.metricCode ?? metricCodes[name] ?? name;
    const result = saveV11OperationMetric({ year: recordYear, scopeLevel: fixedAnnualMetric || enterpriseMetric ? '企业' : resolvedUnit?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元', energyUnitId: fixedAnnualMetric || enterpriseMetric || enterpriseScope ? null : unitId, metricCategory: category, aggregationMethod: fixedAnnualMetric ? '年度单值' : '月度求和', metricCode, productId: resolvedProductId, metricName: name, metricUnit, entryMode: fixedAnnualMetric ? 'annual' : 'monthly', monthlyValues: fixedAnnualMetric ? [] : monthNumbers, monthlyReportedMonths: fixedAnnualMetric ? undefined : values.map((value) => value.trim() !== ''), annualValue: fixedAnnualMetric ? Number(annualValue) : monthlyComplete ? monthlyTotal : Number(annualValue) }, item?.operationMetricId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '运营数据已更新' : '运营数据已新增');
  }}><div className={`${styles.formGrid} ${styles.operationFormGrid} ${linkedEntry ? styles.linkedOperationForm : ''}`}>
    <div className={styles.contextStrip}><span>数据年度 <strong>{recordYear}年</strong></span>{lockedOwnership && <>{scopeLevel === '企业' ? <><span>归属层级 <strong>企业</strong></span><span>归属范围 <strong>全厂</strong></span></> : <><span>归属层级 <strong>{scopeLevel}</strong></span>{scopeLevel === '二级用能单元' && <span>所属一级 <strong>{v11ScopeName(parentUnitId, Number(maintenanceYear))}</strong></span>}<span>归属范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}</>}</div>
    <Field label="指标类别" required>{lockedMetricDefinition ? <div className={styles.readonlyControl}><strong>{category}</strong></div> : allowEconomicMetric ? <select value={category} onChange={(event) => { const next = event.target.value as V11OperationMetric['metricCategory']; setCategory(next); setPreset(''); setProductId(''); setMetricUnit(''); if (next === '经济指标') { setScopeLevel('企业'); setUnitId(''); setParentUnitId(''); } }}><option>产量</option><option>运行指标</option><option>经济指标</option></select> : <input value="产量" readOnly />}</Field>
    {category === '产量' ? <div className={styles.readonlyInfo}><span>指标名称</span><strong>产品产量</strong></div> : lockedMetricDefinition ? <Field label="指标名称" required><div className={`${styles.readonlyControl} ${linkedEntry ? styles.linkedMetricName : ''}`}><strong>{preset}</strong></div></Field> : <Field label="指标名称" required><select value={preset} onChange={(event) => { const value = event.target.value; setPreset(value); const option = metricPresets[category].find((entry) => entry[0] === value); if (option) setMetricUnit(option[1]); }}><option value="">请选择指标</option>{metricPresets[category].map(([name]) => <option key={name}>{name}</option>)}</select></Field>}
    {productOutput && <Field label={enterpriseScope ? '主产品' : '产品'} required><select value={productId} disabled={enterpriseScope && !item} onChange={(event) => {
      const value = event.target.value;
      setProductId(value);
      const product = getProduct(value, Number(maintenanceYear));
      if (product) setMetricUnit(product.unit);
    }}>{enterpriseScope && !item ? null : <option value="">请选择产品</option>}{productOptions.map((product) => <option key={product.productId} value={product.productId} disabled={product.status === 'inactive'}>{product.productName}{product.status === 'inactive' ? '（已停用）' : ''}</option>)}</select>{enterpriseScope && !item && <div className={styles.helpText}>企业层级能耗指标只取一项，默认按主产品录入。</div>}</Field>}
    {productOutput && <div className={styles.readonlyInfo}><span>计量单位</span><strong>{metricUnit || '选择产品后自动带出'}</strong></div>}
    {!lockedOwnership && !annualMode && !enterpriseMetric && <><Field label="归属层级" required><select aria-label="运营数据归属层级" value={scopeLevel} onChange={(event) => { const next = event.target.value as ScopeLevel; setScopeLevel(next); setUnitId(''); setParentUnitId(''); }}>{productOutput ? <><option>企业</option><option>一级用能单元</option></> : <><option>企业</option><option>一级用能单元</option><option>二级用能单元</option></>}</select></Field>
    {scopeLevel === '二级用能单元' && !annualMode && !enterpriseMetric && <Field label="所属一级用能单元" required><select aria-label="运营数据所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请先选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
    {!lockedOwnership && !annualMode && !enterpriseMetric && <>{scopeLevel === '企业' ? <div className={styles.readonlyInfo}><span>归属范围</span><strong>全厂</strong></div> : <Field label="归属范围" required><select aria-label="运营数据归属范围" disabled={scopeLevel === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{scopeLevel === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : '请选择归属范围'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}</>}
    </>}
    <div className={styles.helpText}>{fixedAnnualMetric ? '办公建筑面积按年度静态基数填报，不设置月度数据。' : `本项数据采用${metricUnit || '选择指标后自动带出'}计量，按月度填报。月度数据不完整时，必须补录年度汇总数据；月度完整时年度合计自动计算。`}</div>
    {fixedAnnualMetric ? <div className={styles.full}><Field label="办公建筑面积（m²）" required><input type="number" min="0" value={annualValue} placeholder="请输入年度办公建筑面积" onChange={(event) => setAnnualValue(event.target.value)} /></Field></div> : <><div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div><div className={styles.full}><Field label={`${monthlyComplete ? '年度合计' : '年度汇总补录'}（${metricUnit || '计量单位'}）`}><input type="number" min="0" value={monthlyComplete ? String(monthlyTotal) : annualValue} readOnly={monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整时可补录年度汇总'} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div></>}
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Form>;
}

function DevicesPage() {
  const [maintenanceYear, changeMaintenanceYear] = useDataYear();
  const navigate = useNavigate();
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [levelOneUnitIdInput, setLevelOneUnitIdInput] = useState('');
  const [unitIdInput, setUnitIdInput] = useState('');
  const [filters, setFilters] = useState({ keyword: '', levelOneUnitId: '', unitId: '' });
  const [editing, setEditing] = useState<V11KeyDevice | 'new' | DeviceDialogPreset | null>(null);
  const [configuringIndicator, setConfiguringIndicator] = useState<V11KeyDevice | null>(null);
  const [deleting, setDeleting] = useState<V11KeyDevice | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<V11KeyDevice | null>(null);
  const [collapsedLevelOneIds, setCollapsedLevelOneIds] = useState<string[]>([]);
  const [collapsedUnitIds, setCollapsedUnitIds] = useState<string[]>([]);
  const units = listEnergyUnits(Number(maintenanceYear));
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const childUnits = units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === levelOneUnitIdInput);
  const rows = listV11KeyDevices(Number(maintenanceYear)).filter((item) => {
    const deviceUnit = units.find((unit) => unit.energyUnitId === item.energyUnitId);
    const isUnderSelectedLevelOne = !filters.levelOneUnitId || item.energyUnitId === filters.levelOneUnitId || deviceUnit?.parentEnergyUnitId === filters.levelOneUnitId;
    return (!filters.keyword || `${item.deviceName}${item.deviceType}`.includes(filters.keyword)) &&
      isUnderSelectedLevelOne &&
      (!filters.unitId || item.energyUnitId === filters.unitId);
  });
  const groupedRows = levelOneUnits.map((levelOneUnit) => {
      const children = units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === levelOneUnit.energyUnitId);
      const directDevices = rows.filter((device) => device.energyUnitId === levelOneUnit.energyUnitId);
      const childGroups = children.map((unit) => ({ unit, devices: rows.filter((device) => device.energyUnitId === unit.energyUnitId) }));
      return {
        unit: levelOneUnit,
        directDevices,
        childGroups,
      };
    }).filter((group) => !filters.levelOneUnitId || group.unit.energyUnitId === filters.levelOneUnitId);
  void version;
  const blockedInspection = deleteBlocked ? inspectV11KeyDeviceDeletion(deleteBlocked.deviceId, Number(maintenanceYear)) : null;
  const blockedReferences = blockedInspection && !blockedInspection.ok ? blockedInspection.references : null;

  const openBlockedDeviceEnergyData = () => {
    if (!deleteBlocked) return;
    const deviceId = deleteBlocked.deviceId;
    setDeleteBlocked(null);
    navigate(`/data-management/energy-data?scope=device&deviceId=${deviceId}&year=${maintenanceYear}`);
  };

  const openBlockedDeviceTargets = () => {
    if (!deleteBlocked) return;
    const deviceId = deleteBlocked.deviceId;
    setDeleteBlocked(null);
    navigate(`/energy-analysis/benchmarking?objectType=device&objectId=${deviceId}&year=${maintenanceYear}`);
  };

  const renderDeviceRow = (row: V11KeyDevice) => {
    const energyType = types.find((type) => type.energyTypeId === row.mainEnergyTypeId);
    const requestDelete = () => {
      const inspection = inspectV11KeyDeviceDeletion(row.deviceId, Number(maintenanceYear));
      if (!inspection.ok) return setDeleteBlocked(row);
      setDeleting(row);
    };
    return <tr className={styles.deviceRow} key={row.deviceId}>
      <td><div className={styles.deviceNameCell}><span className={styles.deviceName}>{row.deviceName}</span></div></td>
      <td><span className={styles.deviceTypeText}>{row.deviceType}</span></td>
      <td>{row.outputBasis || '—'}</td>
      <td><Tag tone="blue">{energyType?.energyTypeName}</Tag></td>
      <td><div className={styles.actions}><button type="button" onClick={() => setEditing(row)}>编辑</button><button type="button" className={styles.danger} onClick={requestDelete}>删除</button></div></td>
    </tr>;
  };

  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ keyword: keywordInput.trim(), levelOneUnitId: levelOneUnitIdInput, unitId: unitIdInput })}>查询</Button><Button onClick={() => { setKeywordInput(''); setLevelOneUnitIdInput(''); setUnitIdInput(''); setFilters({ keyword: '', levelOneUnitId: '', unitId: '' }); }}>重置</Button></>}>
      <Field label="年度"><select aria-label="重点设备年度" value={maintenanceYear} onChange={(event) => changeMaintenanceYear(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="设备名称 / 设备类型" /></Field>
      <Field label="一级用能单元"><select value={levelOneUnitIdInput} onChange={(event) => { setLevelOneUnitIdInput(event.target.value); setUnitIdInput(''); }}><option value="">全部</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      {levelOneUnitIdInput && <Field label="具体用能单元"><select value={unitIdInput} onChange={(event) => setUnitIdInput(event.target.value)}><option value="">全部</option><option value={levelOneUnitIdInput}>一级单元直属设备</option>{childUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
    </Toolbar>
    <div className={styles.devicePageHeader}><h2>重点设备</h2></div>
    <div className={styles.tableWrap}><table className={styles.deviceTable}><thead><tr><th>重点设备</th><th>设备类型</th><th>设备产出口径</th><th>主要能源品种</th><th>操作</th></tr></thead><tbody>{groupedRows.length ? groupedRows.flatMap((group) => {
      const collapsed = collapsedLevelOneIds.includes(group.unit.energyUnitId);
      const toggle = () => setCollapsedLevelOneIds((current) => current.includes(group.unit.energyUnitId) ? current.filter((id) => id !== group.unit.energyUnitId) : [...current, group.unit.energyUnitId]);
      const groupDevices = [...group.directDevices, ...group.childGroups.flatMap((childGroup) => childGroup.devices)];
      return [<tr className={styles.deviceLevelOneRow} key={`level-one-${group.unit.energyUnitId}`}><td colSpan={5}><div className={styles.deviceLevelOneNode}><button type="button" aria-label={`${collapsed ? '展开' : '收起'}${group.unit.energyUnitName}`} className={styles.deviceToggle} onClick={toggle}>{collapsed ? '+' : '−'}</button><b>{group.unit.energyUnitName}</b><button type="button" className={`${styles.deviceAddButton} ${styles.deviceLevelOneAddButton}`} onClick={() => setEditing({ rootUnitId: group.unit.energyUnitId })}>＋ 新增设备</button></div></td></tr>,
        ...(!collapsed ? [
          ...group.directDevices.map((row) => renderDeviceRow(row)),
          ...group.childGroups.flatMap((childGroup) => {
            const childCollapsed = collapsedUnitIds.includes(childGroup.unit.energyUnitId);
            const childToggle = () => setCollapsedUnitIds((current) => current.includes(childGroup.unit.energyUnitId) ? current.filter((id) => id !== childGroup.unit.energyUnitId) : [...current, childGroup.unit.energyUnitId]);
            return [<tr className={styles.deviceLevelTwoRow} key={`level-two-${childGroup.unit.energyUnitId}`}><td colSpan={5}><div className={styles.deviceLevelTwoNode}><button type="button" aria-label={`${childCollapsed ? '展开' : '收起'}${childGroup.unit.energyUnitName}`} className={styles.deviceToggle} onClick={childToggle}>{childCollapsed ? '+' : '−'}</button><span>{childGroup.unit.energyUnitName}</span><button type="button" className={`${styles.deviceAddButton} ${styles.deviceLevelTwoAddButton}`} onClick={() => setEditing({ rootUnitId: childGroup.unit.energyUnitId })}>＋ 新增设备</button></div></td></tr>, ...(childCollapsed ? [] : childGroup.devices.map((row) => renderDeviceRow(row)))];
          }),
        ] : []),
      ];
    }) : <EmptyRow colSpan={5} />}</tbody></table></div>
    <Pagination count={rows.length} />
  </section>
  {editing && <DeviceDialog item={editing !== 'new' && !('rootUnitId' in editing) ? editing : undefined} dialogPreset={editing !== 'new' && 'rootUnitId' in editing ? editing : undefined} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {configuringIndicator && <DeviceIndicatorBindingDialog device={configuringIndicator} year={Number(maintenanceYear)} onClose={() => setConfiguringIndicator(null)} onSaved={() => { setConfiguringIndicator(null); setVersion((value) => value + 1); notify('设备指标配置已保存'); }} />}
  {deleteBlocked && <Modal title="无法删除重点设备" width={520} cancelText="我知道了" onClose={() => setDeleteBlocked(null)}>
    <div className={styles.warning}>{blockedInspection?.ok ? '当前设备的关联状态已变化，请关闭后重新操作。' : `重点设备“${deleteBlocked.deviceName}”已关联业务数据，暂不能删除。请先处理关联数据。`}</div>
    {blockedReferences && <div className={styles.blockedActions}>
      {blockedReferences.energyRecordCount > 0 && <button type="button" className={styles.blockedAction} onClick={openBlockedDeviceEnergyData}>处理设备能源数据</button>}
      {blockedReferences.indicatorBindingCount > 0 && <button type="button" className={styles.blockedAction} onClick={() => { setConfiguringIndicator(deleteBlocked); setDeleteBlocked(null); }}>处理设备指标配置</button>}
      {blockedReferences.benchmarkTargetCount > 0 && <button type="button" className={styles.blockedAction} onClick={openBlockedDeviceTargets}>处理设备指标目标</button>}
    </div>}
  </Modal>}
  {deleting && <Modal title="删除重点设备" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
    const result = deleteV11KeyDevice(deleting.deviceId, Number(maintenanceYear));
    if (!result.ok) return notify(result.error);
    setDeleting(null); setVersion((value) => value + 1); notify('重点设备已删除');
  }}><div className={styles.warning}>确认删除重点设备“{deleting.deviceName}”吗？</div></Modal>}
  </Page>;
}

type DeviceDialogPreset = { rootUnitId: string };

function DeviceDialog({ item, dialogPreset, onClose, onSaved }: { item?: V11KeyDevice; dialogPreset?: DeviceDialogPreset; onClose: () => void; onSaved: (message: string) => void }) {
  const [maintenanceYear] = useDataYear();
  const units = listEnergyUnits(Number(maintenanceYear));
  const types = listV11EnergyTypes(Number(maintenanceYear));
  const selectableTypes = types.filter((type) => type.energyTypeId === item?.mainEnergyTypeId || isV11EnergyTypeEnabled(type.energyTypeId, Number(maintenanceYear)));
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const initialPreset = deviceTypePresets.includes(item?.deviceType ?? '') ? item?.deviceType ?? '' : item ? '其他（自定义）' : '';
  const presetRootUnit = units.find((unit) => unit.energyUnitId === dialogPreset?.rootUnitId);
  const presetRootIsLevelOne = presetRootUnit?.unitLevel === 'level1';
  const [scopeLevel, setScopeLevel] = useState<'一级用能单元' | '二级用能单元'>(dialogPreset ? (presetRootIsLevelOne ? '一级用能单元' : '二级用能单元') : initialUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? (dialogPreset && !presetRootIsLevelOne ? dialogPreset.rootUnitId : ''));
  const [parentUnitId, setParentUnitId] = useState(dialogPreset && presetRootIsLevelOne ? dialogPreset.rootUnitId : (initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : ''));
  const [preset, setPreset] = useState(initialPreset);
  const [customType, setCustomType] = useState(initialPreset === '其他（自定义）' ? item?.deviceType ?? '' : '');
  const [name, setName] = useState(item?.deviceName ?? '');
  const [typeId, setTypeId] = useState(item?.mainEnergyTypeId ?? '');
  const [outputBasis, setOutputBasis] = useState(item?.outputBasis ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = scopeLevel === '一级用能单元'
    ? levelOneUnits
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  const lockedOwnership = Boolean(item);
  const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
  const selectedParentUnit = units.find((unit) => unit.energyUnitId === parentUnitId);
  const hasRootContext = Boolean(dialogPreset);
  return <Modal title={`${item ? '编辑重点设备档案' : '新增重点设备'}（${maintenanceYear}年度）`} width={720} submitText="保存设备" onClose={onClose} onSubmit={() => {
    const deviceType = preset === '其他（自定义）' ? customType.trim() : preset;
    const resolvedUnitId = hasRootContext ? (presetRootIsLevelOne ? parentUnitId : unitId) : unitId;
    if (!resolvedUnitId || !deviceType || !name.trim() || !typeId || !outputBasis.trim()) return setError('请完整填写设备名称、设备类型、主要能源品种、设备产出口径和归属用能单元。');
    const result = saveV11KeyDevice({ energyUnitId: resolvedUnitId, deviceType, deviceName: name.trim(), mainEnergyTypeId: typeId, outputBasis: outputBasis.trim(), remark }, item?.deviceId, Number(maintenanceYear));
    if (!result.ok) return setError(result.error);
    onSaved(item ? '重点设备已更新' : '重点设备已新增');
  }}><div className={styles.deviceForm}>
    {(lockedOwnership || hasRootContext) && <div className={styles.contextStrip}>
      {hasRootContext && presetRootIsLevelOne && <><span>所属一级用能单元 <strong>{presetRootUnit?.energyUnitName ?? '—'}</strong></span><span>归属方式 <strong>一级单元直属设备</strong></span></>}
      {hasRootContext && !presetRootIsLevelOne && <><span>所属一级用能单元 <strong>{selectedParentUnit?.energyUnitName ?? '—'}</strong></span><span>所属二级用能单元 <strong>{presetRootUnit?.energyUnitName ?? '—'}</strong></span></>}
      {lockedOwnership && <>
        <span>归属层级 <strong>{scopeLevel}</strong></span>
        {scopeLevel === '二级用能单元' && <span>所属一级 <strong>{selectedParentUnit?.energyUnitName ?? '—'}</strong></span>}
        <span>归属范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span>
      </>}
    </div>}
    <section className={styles.deviceFormSection}>
      <h3>设备信息</h3>
      <div className={styles.formGrid}>
        <Field label="设备名称" required><input value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入设备名称" /></Field>
        <Field label="设备类型" required><select value={preset} onChange={(event) => { setPreset(event.target.value); if (event.target.value !== '其他（自定义）') setCustomType(''); }}><option value="">请选择设备类型</option>{deviceTypePresets.map((value) => <option key={value}>{value}</option>)}</select></Field>
        {preset === '其他（自定义）' && <Field label="自定义设备类型" required><input value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="请输入具体设备类型" /></Field>}
        <Field label="主要能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择主要能源品种</option>{selectableTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
        <Field label="设备产出口径" required><input value={outputBasis} onChange={(event) => setOutputBasis(event.target.value)} placeholder="例如：供气量、发电量、产品产量" /></Field>
      </div>
    </section>
    {!lockedOwnership && !hasRootContext && <section className={styles.deviceFormSection}>
      <h3>归属信息</h3>
      <div className={`${styles.deviceOwnershipFields} ${hasRootContext ? styles.deviceRootOwnership : ''}`}>
        {!hasRootContext && <Field label="归属层级" required><select aria-label="重点设备归属层级" value={scopeLevel} onChange={(event) => { setScopeLevel(event.target.value as '一级用能单元' | '二级用能单元'); setUnitId(''); if (!hasRootContext) setParentUnitId(''); }}><option>一级用能单元</option><option>二级用能单元</option></select></Field>}
        {hasRootContext && <Field label="归属方式" required><select aria-label="重点设备归属层级" value={scopeLevel} onChange={(event) => { setScopeLevel(event.target.value as '一级用能单元' | '二级用能单元'); setUnitId(''); }}><option value="一级用能单元">一级单元直属设备</option><option value="二级用能单元">二级用能单元设备</option></select></Field>}
        {!hasRootContext && scopeLevel === '二级用能单元' && <Field label="所属一级用能单元" required><select aria-label="重点设备所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
        {hasRootContext && scopeLevel === '一级用能单元' && <div className={styles.readonlyInfo}><span>归属单元</span><strong>{selectedParentUnit?.energyUnitName ?? '—'}（直属设备）</strong></div>}
        {(!hasRootContext || scopeLevel === '二级用能单元') && <Field label={hasRootContext ? '所属二级用能单元' : '所属用能单元'} required><select aria-label={hasRootContext ? '所属二级用能单元' : '重点设备所属用能单元'} disabled={scopeLevel === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{scopeLevel === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : hasRootContext ? '请选择所属二级用能单元' : '请选择所属用能单元'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
      </div>
    </section>}
    <section className={styles.deviceFormSection}>
      <h3>备注 <small>（选填）</small></h3>
      <Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="请输入设备补充说明" /></Field>
    </section>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function DeviceIndicatorBindingDialog({ device, year, onClose, onSaved }: { device: V11KeyDevice; year: number; onClose: () => void; onSaved: () => void }) {
  const energyType = listV11EnergyTypes(year).find((item) => item.energyTypeId === device.mainEnergyTypeId);
  const existing = getDeviceIntensityTemplateConfig(device.deviceId, year);
  const [templateId, setTemplateId] = useState(existing?.templateId ?? DEVICE_METRIC_TEMPLATES[0].templateId);
  const template = DEVICE_METRIC_TEMPLATES.find((item) => item.templateId === templateId) ?? DEVICE_METRIC_TEMPLATES[0];
  const config = existing ?? {
    templateId: template.templateId,
    metricCode: template.legacyMetricCode as DeviceIntensityMetricCode,
    metricName: template.label,
    calculationMethod: template.calculationMethod,
    numerator: { source: 'device-energy' as const, energyTypeId: device.mainEnergyTypeId, name: `${energyType?.energyTypeName ?? '主要能源'}消耗`, unit: energyType?.measurementUnit ?? '' },
    denominator: { source: 'operation-data' as const, name: '设备产出量', unit: '件' },
    resultUnit: `${energyType?.measurementUnit ?? '能源单位'}/件`,
    factor: 1,
    energyTypeId: device.mainEnergyTypeId,
    metricUnit: `${energyType?.measurementUnit ?? '能源单位'}/件`,
    formula: `${energyType?.energyTypeName ?? '能源'}消耗 ÷ 设备产出量`,
  };
  return <Modal title={`配置设备指标（${year}年度）`} width={620} submitText="保存配置" onClose={onClose} onSubmit={() => {
    saveDeviceIntensityTemplate({ deviceId: device.deviceId, year, metricCode: config.metricCode, config: { ...config, templateId: template.templateId } });
    onSaved();
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}><span>重点设备 <strong>{device.deviceName}</strong></span><span>设备类型 <strong>{device.deviceType}</strong></span></div>
    <Field label="指标模板" required><select value={templateId} onChange={(event) => setTemplateId(event.target.value as typeof templateId)}>{DEVICE_METRIC_TEMPLATES.map((item) => <option key={item.templateId} value={item.templateId}>{item.label}</option>)}</select></Field>
    <div className={styles.readonlyInfo}><span>计算公式</span><strong>{config.formula}</strong></div>
    <div className={styles.helpText}>指标绑定独立于设备档案保存。保存后仍需补齐设备能源数据和设备产出参数，系统才会生成正式指标。</div>
  </div></Modal>;
}
