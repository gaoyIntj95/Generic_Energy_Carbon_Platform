import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  deleteV11ConversionOutput,
  deleteV11EnergyCost,
  deleteV11EnergyRecord,
  deleteV11EnergyType,
  disableV11EnergyType,
  listV11EnergyTypeReferences,
  isV11EnergyTypeEnabled,
  deleteV11KeyDevice,
  deleteV11OperationMetric,
  deleteV11ExternalSupplyRecord,
  inspectV11KeyDeviceDeletion,
  listV11ConversionOutputs,
  listV11ExternalSupplyRecords,
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
  saveV11ExternalSupplyRecord,
  v11RecordScopeType,
  v11ScopeName,
  type AnalysisCategory,
  type ConversionInputMode,
  type ConversionOutputType,
  type EnergyRole,
  type ScopeLevel,
  type V11ConversionOutput,
  type V11EnergyCost,
  type V11EnergyRecord,
  type V11EnergyType,
  type V11ExternalSupplyRecord,
  type V11KeyDevice,
  type V11OperationMetric,
} from '../../mocks/dataManagementV11Store';
import {
  getProduct,
  linkProductEnergyUnit,
  listProducts,
  saveProduct,
  updateProductAllocation,
} from '../../mocks/productMasterStore';
import type { ProductMaster } from '../../types/product';
import { Button, Field, Modal, Tag, Toast } from './PrototypeUI';
import { EnergyUnitsPage } from './EnergyUnitsPage';
import styles from './DataManagementV11.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const categories: AnalysisCategory[] = ['电力', '热力', '化石燃料', '可再生及替代能源', '其他能源'];
type EnergyScopeView = ScopeLevel | '重点设备';
const levels: Array<'全部层级' | EnergyScopeView> = ['全部层级', '企业', '一级用能单元', '二级用能单元', '重点设备'];
type OperationScopeView = ScopeLevel | '全部层级';
const operationLevels: OperationScopeView[] = ['全部层级', '企业', '一级用能单元', '二级用能单元'];
function scopeViewLabel(value: '全部层级' | EnergyScopeView) {
  return value === '全部层级' ? '层级总览' : value;
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

const conversionOutputTypes: ConversionOutputType[] = ['锅炉产汽/产热', '余热发电', '空压产气/压缩空气', '回收利用'];
type ConversionBusinessPath = 'normal-conversion' | 'recovered-conversion' | 'recovered-direct-use';
const conversionBusinessPaths: Array<{ value: ConversionBusinessPath; label: string; description: string; types: ConversionOutputType[] }> = [
  { value: 'normal-conversion', label: '常规能源转换', description: '外购或自产能源经过设备转换，形成蒸汽、热力或压缩空气。', types: ['锅炉产汽/产热', '空压产气/压缩空气'] },
  { value: 'recovered-conversion', label: '回收能源转换', description: '已回收的余热、余压等继续转换为电力或其他能源。', types: ['余热发电'] },
  { value: 'recovered-direct-use', label: '回收能源直接利用', description: '回收能源不再改变能源形态，直接形成厂内可用能源。', types: ['回收利用'] },
];
const conversionSceneCopy: Record<string, string> = {
  '锅炉产汽/产热': '记录燃料投入、蒸汽/热力产出和使用去向',
  '余热发电': '记录余热/余压投入、发电量和电力去向',
  '空压产气/压缩空气': '记录空压机电力投入、压缩空气产出和厂内用气去向',
  '回收利用': '记录余热、余压、回收蒸汽等直接回用的数量和去向',
};
function conversionSceneLabel(type: ConversionOutputType) {
  return type === '回收利用' ? '回收能源直接利用' : type;
}
function conversionBusinessPathFor(type: ConversionOutputType): ConversionBusinessPath {
  if (type === '余热发电') return 'recovered-conversion';
  if (type === '回收利用') return 'recovered-direct-use';
  return 'normal-conversion';
}
function conversionBusinessPathLabel(path: ConversionBusinessPath) {
  return conversionBusinessPaths.find((item) => item.value === path)?.label ?? '常规能源转换';
}
const recoveryEnergyOptions = ['余热', '回收蒸汽', '冷凝水', '回收热水', '可燃尾气', '压力能'];
const recoverySourceOptions = [
  { value: 'device:v11-device-64', label: '连续式热处理炉', unitId: 'eu-clinker-line-1', deviceId: 'v11-device-64' },
  { value: 'device:v11-device-70', label: '1#注塑机冷却系统', unitId: 'eu-cement-grinding-line', deviceId: 'v11-device-70' },
  { value: 'device:v11-device-74', label: '自动喷涂线烘干/固化段', unitId: 'eu-production-processing', deviceId: 'v11-device-74' },
  { value: 'device:v11-device-62', label: '1#螺杆空压机', unitId: 'eu-compressed-air', deviceId: 'v11-device-62' },
  { value: 'device:v11-device-79', label: '2#螺杆空压机', unitId: 'eu-compressed-air', deviceId: 'v11-device-79' },
  { value: 'device:v11-device-82', label: '2t/h天然气蒸汽锅炉排烟', unitId: 'eu-gas-boiler', deviceId: 'v11-device-82' },
];
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(String);

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
  const { search } = useLocation();
  const page = pathname.split('?')[0].split('/').pop();
  const energyTab = new URLSearchParams(search).get('tab');
  if (page === 'units') return <EnergyUnitsPage />;
  if (page === 'energy-types') return <EnergyTypesPage />;
  if (page === 'energy-data') {
    if (energyTab === 'costs') return <EnergyCostsPage />;
    if (energyTab === 'recovery' || energyTab === 'conversion' || energyTab === 'external') return <EnergyConversionOutputPage />;
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
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<V11EnergyType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyType | null>(null);
  const [blocked, setBlocked] = useState<{ item: V11EnergyType; references: ReturnType<typeof listV11EnergyTypeReferences> } | null>(null);
  // 回收能源由“能源回收、转换与外供”维护，不作为能源消费/购入品种展示。
  const rows = listV11EnergyTypes().filter((item) => item.analysisCategory !== '回收能源' && (!keyword || item.energyTypeName.includes(keyword)) && (!category || item.analysisCategory === category));
  void version;
  return <Page toast={toast}>
    <section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => { setKeyword(keywordInput.trim()); setCategory(categoryInput); }}>查询</Button><Button onClick={() => { setYear(String(currentYear)); setKeywordInput(''); setCategoryInput(''); setKeyword(''); setCategory(''); }}>重置</Button><Button primary onClick={() => setEditing('new')}>＋ 新增能源品种</Button></>}>
        <Field label="年度"><select aria-label="能源品种年度" value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
        <Field label="关键字"><input aria-label="关键字" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="搜索能源品种名称" /></Field>
        <Field label="能源分析类别"><select aria-label="能源分析类别" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </Toolbar>
      <Notice><strong>说明：</strong>能源分析类别用于能耗查询和结构汇总；能源品种只维护基础属性，能源回收、转换和外供去向统一在“能源回收、转换与外供”中维护。</Notice>
      <div className={styles.tableWrap}><table><thead><tr><th>能源分析类别</th><th>能源品种</th><th>计量单位</th><th>折标系数</th><th>折标单位</th><th className={styles.operationColumn}>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.energyTypeId}><td><Tag tone="blue">{row.analysisCategory}</Tag></td><td className={styles.strong}>{row.energyTypeName} {!isV11EnergyTypeEnabled(row.energyTypeId) && <Tag tone="gray">已停用</Tag>}</td><td>{row.measurementUnit}</td><td>{row.standardCoalFactor.toFixed(4)}</td><td>{row.standardCoalFactorUnit}</td><td><Actions onEdit={() => setEditing(row)} onDelete={() => { const references = listV11EnergyTypeReferences(row.energyTypeId); if (references.length) setBlocked({ item: row, references }); else setDeleting(row); }} /></td></tr>)}</tbody>
      </table></div>
      <Pagination count={rows.length} />
    </section>
    {editing && <EnergyTypeDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
    {deleting && <Modal title="删除能源品种" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyType(deleting.energyTypeId);
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源品种已删除');
    }}><div className={styles.warning}>确认删除能源品种“{deleting.energyTypeName}”吗？</div></Modal>}
    {blocked && <Modal title="无法删除能源品种" width={580} cancelText="关闭" onClose={() => setBlocked(null)}>
      <div className={styles.warning}>能源品种“{blocked.item.energyTypeName}”存在业务引用。请先处理引用，或将该品种停用。</div>
      <ul className={styles.referenceList}>{blocked.references.map((reference) => <li key={reference.kind}><span>{reference.label}</span><strong>{reference.count} 项</strong><button type="button" className={styles.blockedAction} onClick={() => { setBlocked(null); navigate(reference.path); }}>去处理</button></li>)}</ul>
      <div className={styles.blockedActions}><button type="button" className={styles.blockedAction} onClick={() => { const result = disableV11EnergyType(blocked.item.energyTypeId); if (result.ok) { setBlocked(null); setVersion((value) => value + 1); notify('能源品种已停用，历史数据仍会保留'); } }}>停用该品种</button></div>
    </Modal>}
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
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  const returnToIntensity = () => {
    if (returnTo?.startsWith('/energy-analysis/intensity')) navigate(returnTo);
  };
  const linkedDeviceId = params.get('deviceId') ?? '';
  const linkedEnergyTypeId = params.get('energyTypeId') ?? '';
  const linkedRecordId = params.get('recordId') ?? '';
  const deviceEntry = params.get('scope') === 'device';
  const requestedScopeLevel = params.get('scopeLevel');
  const initialEnergyRole: EnergyRole = params.get('role') === '回收能源' ? '回收能源' : '能源消费';
  const requestedLevel: '全部层级' | EnergyScopeView = initialEnergyRole === '回收能源'
    ? '二级用能单元'
    : requestedScopeLevel === '二级用能单元' || requestedScopeLevel === '一级用能单元' ? requestedScopeLevel : deviceEntry ? '重点设备' : '全部层级';
  const [version, setVersion] = useState(0);
  const [level, setLevel] = useState<'全部层级' | EnergyScopeView>(requestedLevel);
  const [energyRole, setEnergyRole] = useState<EnergyRole>(initialEnergyRole);
  const [currentPage, setCurrentPage] = useState(1);
  const [year, setYear] = useState(params.get('year') ?? '2026');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState(params.get('keyword') ?? '');
  const [appliedFilters, setAppliedFilters] = useState({ year: params.get('year') ?? '2026', category: '', keyword: params.get('keyword') ?? '', energyTypeId: linkedEnergyTypeId });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<V11EnergyRecord | 'new' | null>(() => {
    if (linkedRecordId) return listV11EnergyRecords().find((record) => record.energyRecordId === linkedRecordId) ?? null;
    return params.get('new') === '1' ? 'new' : null;
  });
  const [newUnitId, setNewUnitId] = useState(params.get('unitId') ?? '');
  const [deleting, setDeleting] = useState<V11EnergyRecord | null>(null);
  const types = listV11EnergyTypes();
  const availableCategories = energyRole === '回收能源' ? ['回收能源'] : categories.filter((item) => item !== '回收能源');
  const visibleLevels = energyRole === '回收能源' ? (['二级用能单元'] as const) : levels;
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
  const rows = records.filter((item) => item.energyRole === energyRole && item.year === Number(appliedFilters.year)
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
      const scopeName = scopeType === 'device' ? device?.deviceName ?? '设备档案已移除' : scopeType === 'enterprise' ? '全厂' : v11ScopeName(row.energyUnitId);
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
            const total = annual(row.monthlyAmounts, row.annualAmount);
            const detail = expanded === row.energyRecordId;
            return [<tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={`${styles.scopeChild} ${styles[`scopeDepth${depth}`]}`} aria-label={`${scopeName}下的${type?.energyTypeName ?? '能源记录'}`}><span>└─ {type?.energyTypeName}</span></div></td><td>{scopeLevel}</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>];
          });
          const canAddForScope = level === '二级用能单元' && group.row.energyUnitId;
          const groupRow = <tr className={styles.scopeGroupRow} key={`${group.scopeKey}-group`}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${group.depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${group.scopeName}`} aria-expanded={!isCollapsed} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(group.scopeKey)) next.delete(group.scopeKey); else next.add(group.scopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{group.scopeName}</b></span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}>{canAddForScope && <button type="button" className={styles.scopeAddButton} onClick={() => { setNewUnitId(group.row.energyUnitId ?? ''); setEditing('new'); }}>＋ 新增能源消费</button>}</td></tr>;
          return [groupRow, ...(isCollapsed ? [] : groupRows)];
        }),
      ];
    });
  })();
  useEffect(() => { setCurrentPage(1); }, [appliedFilters, level]);
  void version;
  const countForLevel = (value: '全部层级' | EnergyScopeView) => records.filter((item) =>
    item.energyRole === energyRole
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
      <Toolbar actions={<><Button primary onClick={() => setAppliedFilters({ year, category, keyword, energyTypeId: linkedEnergyTypeId })}>查询</Button><Button onClick={() => { setYear('2026'); setCategory(energyRole === '回收能源' ? '回收能源' : ''); setKeyword(''); setLevel(energyRole === '回收能源' ? '二级用能单元' : deviceEntry ? '重点设备' : '全部层级'); setAppliedFilters({ year: '2026', category: energyRole === '回收能源' ? '回收能源' : '', keyword: '', energyTypeId: linkedEnergyTypeId }); }}>重置</Button>{returnTo && <Button onClick={returnToIntensity}>返回能耗指标</Button>}{energyRole === '回收能源' && level === '二级用能单元' && <Button primary onClick={() => { setNewUnitId(''); setEditing('new'); }}>＋ 新增回收能源</Button>}{energyRole === '能源消费' && level === '企业' && <Button primary onClick={() => { setNewUnitId(''); setEditing('new'); }}>＋ 新增能源消费数据</Button>}{energyRole === '能源消费' && level === '重点设备' && <Button primary onClick={() => { setNewUnitId(''); setEditing('new'); }}>＋ 新增设备能源消费</Button>}{level === '全部层级' && <span className={styles.entryHint}>层级总览仅用于只读核查，请切换至具体层级后维护数据</span>}</>}>
        <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
        <Field label="能源分析类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{availableCategories.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={level === '重点设备' ? '重点设备 / 能源品种' : '用能单元 / 能源品种'} /></Field>
      </Toolbar>
      <div className={styles.levelTabs}>{visibleLevels.map((item) => <button key={item} type="button" className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{scopeViewLabel(item)}{item === '企业' && <span className={styles.requiredMark}>必填</span>}（{countForLevel(item)}）</button>)}</div>
      <Notice>{energyRole === '回收能源'
        ? <><strong>回收能源：</strong>在产生余热、余压等回收能源的实际二级用能单元录入来源数据；该数据不会计入企业外购能源消费，后续由余热发电或回收利用记录关联。</>
        : level === '重点设备'
        ? <><strong>重点设备能源数据：</strong>设备数据用于设备用能分析和能效对标，是所属用能单元能源量的明细拆分，不重复增加企业或用能单元总能耗。</>
        : <><strong>能源消费：</strong>企业级记录用于边界总量控制，一级和二级用能单元按实际计量条件分别录入。系统依据归属层级自动识别能源输入、分配和利用阶段；回收、转换及外供请在“能源回收、转换与外供”中维护。</>}</Notice>
      {level === '重点设备' ? <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>能源分析类别</th><th>能源品种</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{pageRows.length ? pageRows.flatMap((row) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const device = devices.find((item) => item.deviceId === row.scopeId);
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          return [<tr key={row.energyRecordId}><td className={styles.strong}>{device?.deviceName ?? '设备档案已移除'}</td><td>{v11ScopeName(device?.energyUnitId ?? row.energyUnitId)}</td><td>{device?.deviceType ?? '—'}</td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)} {type?.measurementUnit}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={8}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={8} />}</tbody>
      </table></div> : level === '一级用能单元' ? <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead><tbody>{levelOneUnitGroups.flatMap(({ unit, records: unitRows }) => [
        ...unitRows.length ? [] : [],
        ...(() => {
          const scopeKey = `energyUnit:${unit.energyUnitId}`;
          const isCollapsed = collapsedScopes.has(scopeKey);
          const groupRow = <tr className={styles.scopeGroupRow} key={`${scopeKey}-group`}><td><div className={styles.scopeCell}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${unit.energyUnitName}`} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(scopeKey)) next.delete(scopeKey); else next.add(scopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{unit.energyUnitName}</b></span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}><button type="button" className={styles.scopeAddButton} onClick={() => { setNewUnitId(unit.energyUnitId); setEditing('new'); }}>＋ 新增能源消费</button></td></tr>;
          if (isCollapsed) return [groupRow];
          return [groupRow, ...(unitRows.length ? unitRows.flatMap((row) => { const type = types.find((item) => item.energyTypeId === row.energyTypeId); const total = annual(row.monthlyAmounts, row.annualAmount); const detail = expanded === row.energyRecordId; return [<tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={styles.scopeChild}><span>└─ {type?.energyTypeName}</span></div></td><td>一级用能单元</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>]; }) : [<tr key={`${scopeKey}-empty`}><td colSpan={7} className={styles.emptyRow}>暂无能源数据</td></tr>])];
        })(),
      ])}</tbody></table></div> : level === '全部层级' ? <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead><tbody>{allLevelTableRows.length ? allLevelTableRows : <EmptyRow colSpan={7} />}</tbody></table></div> : <div className={styles.tableWrap}><table className={`${styles.wideTable} ${styles.quantityTable}`}><thead><tr><th>{energyRole === '回收能源' ? '产生单元 / 回收能源' : '归属范围 / 能源品种'}</th><th>归属层级</th><th>能源分析类别</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
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
          if (isCollapsed && !isScopeStart) return [];
          const canAddForScope = level === '二级用能单元'
            && scopeType === 'energyUnit' && Boolean(row.energyUnitId);
          const groupRow = isScopeStart ? <tr className={styles.scopeGroupRow} key={`${currentScopeKey}-group`}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${depth}`]}`}><button type="button" className={styles.scopeToggle} aria-label={`${isCollapsed ? '展开' : '折叠'}${scopeName}`} onClick={() => setCollapsedScopes((current) => { const next = new Set(current); if (next.has(currentScopeKey)) next.delete(currentScopeKey); else next.add(currentScopeKey); return next; })}>{isCollapsed ? '+' : '−'}</button><i /><span><b>{scopeName}</b>{device && <small>所属：{v11ScopeName(device.energyUnitId)}</small>}</span></div></td><td colSpan={5} /><td className={styles.scopeGroupActionCell}>{canAddForScope && <button type="button" className={styles.scopeAddButton} onClick={() => { setNewUnitId(row.energyUnitId ?? ''); setEditing('new'); }}>＋ {energyRole === '回收能源' ? '新增回收能源' : '新增能源消费'}</button>}</td></tr> : null;
          return [groupRow, <tr className={styles.scopeRecordRow} key={row.energyRecordId}><td><div className={`${styles.scopeChild} ${styles[`scopeDepth${depth}`]}`} aria-label={`${scopeName}下的${type?.energyTypeName ?? '能源记录'}`}><span>└─ {type?.energyTypeName}</span></div></td><td>{scopeLevel}</td><td>{type?.analysisCategory}</td><td>{type?.measurementUnit}</td><td>{energyDataProgress(row)}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyAmounts} reported={reportedMonths(row)} annualValue={total} annualSupplemented={row.annualAmount > 0} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={7} />}</tbody>
      </table></div>}
      <Pagination count={rows.length} currentPage={safePage} onPageChange={level === '全部层级' ? undefined : setCurrentPage} />
    </section>
    {editing && <EnergyRecordDialog item={editing === 'new' ? undefined : editing} dataYear={Number(appliedFilters.year)} energyRole={energyRole} lockedScopeLevel={editing === 'new' && level !== '全部层级' ? level : undefined} initialUnitId={editing === 'new' ? newUnitId : undefined} initialDeviceId={linkedDeviceId} onClose={() => { setEditing(null); setNewUnitId(''); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setNewUnitId(''); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} />}
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
function MonthDetail({ values, reported, annualValue, annualSupplemented = false, unit }: { values: number[]; reported?: boolean[]; annualValue: number; annualSupplemented?: boolean; unit: string }) {
  const visibleMonths = reported ?? values.map((value) => value > 0);
  return <div className={styles.detailPanel}><div className={styles.detailHead}><span>月度明细</span><span>计量单位：{unit}</span></div><div className={styles.monthDetailGrid}>{months.map((month, index) => <div key={month}><span>{month}</span><strong>{visibleMonths[index] ? format(values[index] ?? 0, 2) : '—'}</strong></div>)}</div><div className={styles.summaryLine}>{annualSupplemented ? '年度总量（补录）' : '年度合计'} <strong>{format(annualValue, 2)}</strong> {unit}</div></div>;
}

function EnergyRecordDialog({ item, dataYear, energyRole = '能源消费', lockedScopeLevel, initialUnitId = '', initialDeviceId = '', readOnly = false, onClose, onSaved }: { item?: V11EnergyRecord; dataYear: number; energyRole?: EnergyRole; lockedScopeLevel?: EnergyScopeView; initialUnitId?: string; initialDeviceId?: string; readOnly?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const selectableTypes = types.filter((type) => energyRole === '回收能源' ? type.analysisCategory === '回收能源' : type.analysisCategory !== '回收能源');
  const devices = listV11KeyDevices();
  const fixedRecoveryTypeId = 'v11-energy-waste-heat';
  const [level] = useState<EnergyScopeView>(item && v11RecordScopeType(item) === 'device' ? '重点设备' : item?.scopeLevel ?? lockedScopeLevel ?? '企业');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? initialUnitId);
  const existingSourceOption = energyRole === '回收能源'
    ? recoverySourceOptions.find((option) => option.deviceId === item?.sourceDeviceId)
    : undefined;
  const legacyRecoveryUnitId = energyRole === '回收能源' && !existingSourceOption ? item?.energyUnitId ?? '' : '';
  const [sourceOptionId, setSourceOptionId] = useState(energyRole === '回收能源' ? existingSourceOption?.value ?? '' : '');
  const parentUnitId = units.find((unit) => unit.energyUnitId === unitId)?.parentEnergyUnitId ?? '';
  const [deviceId, setDeviceId] = useState(item?.scopeType === 'device' ? item.scopeId ?? '' : initialDeviceId);
  const initialDevice = devices.find((device) => device.deviceId === (item?.scopeType === 'device' ? item.scopeId : initialDeviceId));
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? initialDevice?.mainEnergyTypeId ?? (energyRole === '回收能源' ? fixedRecoveryTypeId : ''));
  const initialReportedMonths = item ? reportedMonths(item) : Array(12).fill(false);
  const [reported, setReported] = useState<boolean[]>(initialReportedMonths);
  const [values, setValues] = useState<string[]>(item ? item.monthlyAmounts.map((value, index) => initialReportedMonths[index] ? String(value) : '') : Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualAmount || ''));
  const [error, setError] = useState('');
  const type = types.find((value) => value.energyTypeId === typeId);
  const device = devices.find((value) => value.deviceId === deviceId);
  const deviceUnit = units.find((unit) => unit.energyUnitId === device?.energyUnitId);
  const selectedSourceOption = recoverySourceOptions.find((option) => option.value === sourceOptionId);
  const sourceDeviceName = existingSourceOption?.label ?? devices.find((value) => value.deviceId === item?.sourceDeviceId)?.deviceName ?? item?.sourceProcess ?? '历史来源设备';
  const resolvedRecoveryUnitId = selectedSourceOption?.unitId ?? legacyRecoveryUnitId;
  const effectiveUnitId = level === '企业' ? null : level === '重点设备' ? device?.energyUnitId ?? null : energyRole === '回收能源' ? resolvedRecoveryUnitId : unitId;
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
  return <Modal title={readOnly ? '查看回收能源' : item ? energyRole === '回收能源' ? '编辑回收能源' : '编辑能源消费' : energyRole === '回收能源' ? '新增回收能源' : '新增能源消费'} width={820} onClose={onClose} onSubmit={readOnly ? undefined : () => {
    if ((level === '重点设备' ? !deviceId : level !== '企业' && !effectiveUnitId) || !typeId) return setError('请选择归属范围和能源品种。');
    const reportedAnnual = monthlyComplete ? 0 : Number(annualValue || 0);
    if (!reportedCount && !(reportedAnnual > 0)) return setError('请至少填写一个月度数据，或补录年度总量。');
    if (!monthlyComplete && !(reportedAnnual > 0)) return setError('月度数据未填满时，年度总量必填。');
    if (reportedAnnual > 0 && reportedAnnual < monthlyTotal) return setError('年度总量不能小于已录月份之和。');
    const result = saveV11EnergyRecord({ year: dataYear, energyRole, scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode: reportedCount ? 'monthly' : 'annual', monthlyAmounts: monthNumbers, monthlyReportedMonths: reported, annualAmount: reportedAnnual, sourceDeviceId: energyRole === '回收能源' ? selectedSourceOption?.deviceId : undefined }, item?.energyRecordId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源数据已更新' : '能源数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}>
      <span>业务阶段 <strong>{energyStage(recordPreview)}</strong></span>
      {energyRole === '回收能源' ? <><span>能源品种 <strong>余热</strong></span><span>所属一级用能单元 <strong>{recoveryParentUnit?.energyUnitName ?? '待选择'}</strong></span><span>所属二级用能单元 <strong>{selectedUnit?.unitLevel === 'level2' ? selectedUnit.energyUnitName : selectedUnit ? '一级单元直属设备' : '待选择'}</strong></span></> : <>{level === '企业' && <><span>归属层级 <strong>企业</strong></span><span>录入范围 <strong>全厂</strong></span></>}{level === '一级用能单元' && <><span>归属层级 <strong>一级用能单元</strong></span><span>录入范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}{level === '二级用能单元' && <><span>归属层级 <strong>二级用能单元</strong></span><span>所属一级 <strong>{v11ScopeName(parentUnitId)}</strong></span><span>录入范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}{level === '重点设备' && <><span>重点设备 <strong>{device?.deviceName ?? '待选择'}</strong></span><span>所属用能单元 <strong>{v11ScopeName(device?.energyUnitId ?? null)}</strong></span><span>设备类型 <strong>{device?.deviceType ?? '—'}</strong></span></>}</>}
    </div>
    {energyRole === '回收能源' && level !== '重点设备' && <div className={styles.full}><Field label="余热产生设备" required>{item ? <div className={styles.readonlyField}>{sourceDeviceName}</div> : <select value={sourceOptionId} onChange={(event) => setSourceOptionId(event.target.value)}><option value="">{legacyRecoveryUnitId ? '历史来源未细化设备，可选择设备补充' : '请选择余热产生设备'}</option>{recoverySourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</Field></div>}
    {level === '重点设备' ? <div className={styles.deviceEnergySelectors}>
      <Field label="重点设备" required><select value={deviceId} onChange={(event) => { const id = event.target.value; const nextDevice = devices.find((value) => value.deviceId === id); setDeviceId(id); setTypeId(nextDevice?.mainEnergyTypeId ?? ''); }}><option value="">请选择重点设备</option>{devices.map((value) => <option key={value.deviceId} value={value.deviceId}>{value.deviceName}</option>)}</select></Field>
      <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{selectableTypes.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field>
    </div> : energyRole === '回收能源' ? null : <div className={styles.full}><Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{selectableTypes.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field></div>}
    <div className={`${styles.full} ${styles.helpText}`}>{energyRole === '回收能源' ? '按实际已取得月份填报（单位：GJ）；月度数据不完整时可补录年度总量，系统不会自动分摊缺失月份。' : '按实际已取得月份填报；月度数据不完整时可补录年度总量，系统不会自动分摊缺失月份。'}</div>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} readOnly={readOnly} onChange={(event) => { const value = event.target.value; setValues((current) => current.map((item, i) => i === index ? value : item)); setReported((current) => current.map((item, i) => i === index ? value !== '' : item)); }} /></Field>)}</div>
    <div className={styles.full}><Field label={`${monthlyComplete ? '年度合计' : '年度总量补录'}${type ? `（${type.measurementUnit}）` : ''}`} required={!monthlyComplete && !readOnly}><input type="number" min="0" value={monthlyComplete ? String(monthlyTotal) : annualValue} readOnly={readOnly || monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整或仅有年度台账时填写'} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div>
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
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增成本数据</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="能源品种"><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">全部</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    </Toolbar>
    <div className={styles.tableWrap}><table className={styles.costTable}><thead><tr><th>能源品种</th>{months.map((month) => <th key={month}>{month}成本（万元）</th>)}<th>年度合计（万元）</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.energyCostId}><td className={styles.strong}>{types.find((type) => type.energyTypeId === row.energyTypeId)?.energyTypeName}</td>{row.monthlyCosts.map((value, index) => <td key={index}>{row.monthlyReportedMonths?.[index] ?? value > 0 ? format(value, 2) : '—'}</td>)}<td className={styles.number}>{format(annual(row.monthlyCosts, row.annualCost), 2)}</td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>) : <EmptyRow colSpan={15} />}</tbody>
    </table></div><Pagination count={rows.length} />
  </section>
  {editing && <EnergyCostDialog item={editing === 'new' ? undefined : editing} dataYear={Number(year)} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除成本数据" width={480} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11EnergyCost(deleting.energyCostId); setDeleting(null); setVersion((value) => value + 1); notify('成本数据已删除'); }}><div className={styles.warning}>确认删除能源成本数据吗？</div></Modal>}
  </Page>;
}
function EnergyCostDialog({ item, dataYear, onClose, onSaved }: { item?: V11EnergyCost; dataYear: number; onClose: () => void; onSaved: (message: string) => void }) {
  const types = listV11EnergyTypes();
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? '');
  const initialReported = item?.monthlyReportedMonths ?? item?.monthlyCosts.map((value) => value > 0) ?? Array(12).fill(false);
  const [reported, setReported] = useState<boolean[]>(initialReported);
  const [values, setValues] = useState<string[]>(item ? item.monthlyCosts.map((value, index) => initialReported[index] ? String(value) : '') : Array(12).fill(''));
  const [annualCost, setAnnualCost] = useState(String(item?.annualCost || ''));
  const [error, setError] = useState('');
  const monthlyCosts = values.map((value) => Number(value || 0));
  const monthlyTotal = monthlyCosts.reduce((sum, value) => sum + value, 0);
  const monthlyComplete = reported.every(Boolean);
  return <Modal title={item ? '编辑成本数据' : '新增成本数据'} width={820} onClose={onClose} onSubmit={() => {
    const reportedCount = reported.filter(Boolean).length;
    const supplementedAnnualCost = monthlyComplete ? 0 : Number(annualCost || 0);
    if (!typeId || (!reportedCount && !(supplementedAnnualCost > 0))) return setError('请选择能源品种，并至少填写一个月度成本或补录年度总成本。');
    if (supplementedAnnualCost > 0 && supplementedAnnualCost < monthlyTotal) return setError('年度总成本不能小于已录月份成本之和。');
    const result = saveV11EnergyCost({ year: item?.year ?? dataYear, energyTypeId: typeId, monthlyCosts, monthlyReportedMonths: reported, annualCost: supplementedAnnualCost }, item?.energyCostId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '成本数据已更新' : '成本数据已新增');
  }}><div className={styles.formGrid}>
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    <Field label="成本单位"><input value="万元" readOnly /></Field>
    <div className={`${styles.full} ${styles.helpText}`}>按实际已取得月份填报；月度成本不完整时可补录年度总成本，系统不会自动分摊缺失月份。</div>
    <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={`${month}成本`}><input min="0" type="number" value={values[index]} onChange={(event) => { const value = event.target.value; setValues((current) => current.map((item, i) => i === index ? value : item)); setReported((current) => current.map((item, i) => i === index ? value !== '' : item)); }} /></Field>)}</div>
    <div className={`${styles.full}`}><Field label={`${monthlyComplete ? '年度合计' : '年度总成本补录'}（万元）`} required={!monthlyComplete}><input min="0" type="number" value={monthlyComplete ? String(monthlyTotal) : annualCost} readOnly={monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整或仅有年度台账时填写'} onChange={(event) => setAnnualCost(event.target.value)} /></Field></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function listConversionSystemCandidates() {
  return listEnergyUnits().filter(
    (unit) => unit.unitLevel === 'level2' && ['公辅系统', '其他'].includes(unit.unitType),
  );
}

function listScenarioConversionSystems(recordType: ConversionOutputType) {
  const candidates = listConversionSystemCandidates();
  if (recordType === '锅炉产汽/产热') return candidates.filter((unit) => unit.conversionScenarios?.includes('锅炉产汽/产热'));
  if (recordType === '余热发电') return candidates.filter((unit) => unit.conversionScenarios?.includes('余热发电'));
  if (recordType === '空压产气/压缩空气') return candidates.filter((unit) => unit.conversionScenarios?.includes('空压产气/压缩空气'));
  if (recordType === '回收利用') return candidates.filter((unit) => unit.conversionScenarios?.includes('回收利用'));
  if (recordType === '其他转换') return candidates.filter((unit) => unit.conversionScenarios?.includes('其他转换'));
  return [];
}

function conversionQuantityLabel(recordType: ConversionOutputType, energyName: string) {
  if (recordType === '锅炉产汽/产热') return energyName === '蒸汽' ? '本次产汽量' : '本次供热量';
  if (recordType === '余热发电') return '本次发电量';
  if (recordType === '空压产气/压缩空气') return '本次压缩空气产量';
  if (recordType === '回收利用') return '本次回收利用量';
  return '本次产出量';
}

function conversionOutputDescription(recordType: ConversionOutputType, energyName: string, outputUnit: string, outputCategory: AnalysisCategory) {
  if (recordType === '锅炉产汽/产热') return `本场景产出已确定为：${outputCategory} · ${energyName} · ${outputUnit}。上述信息由场景自动带出，无需修改。`;
  if (recordType === '余热发电') return `本场景产出已确定为：电力 · ${energyName} · ${outputUnit}。上述信息由场景自动带出，无需修改。`;
  if (recordType === '空压产气/压缩空气') return `本场景产出已确定为：其他能源 · 压缩空气 · ${outputUnit}。折标系数按能源品种配置，可使用参考值或企业实测值。`;
  return `本场景产出介质为：${energyName} · ${outputUnit}。如需调整，应选择其他转换场景。`;
}

function monthlyConversionFields(values?: number[]) {
  return Array.from({ length: 12 }, (_, index) => values?.[index] == null ? '' : String(values[index]));
}

function conversionExternalAmount(item: V11ConversionOutput) {
  return listV11ExternalSupplyRecords()
    .filter((record) => record.conversionOutputId === item.conversionOutputId)
    .reduce((sum, record) => sum + record.amount, 0);
}

function normalizeMonthlyConversion(values: string[]) {
  if (values.every((value) => value === '')) return undefined;
  if (values.some((value) => value === '')) return null;
  return values.map(Number);
}

function conversionInputText(item: V11ConversionOutput, records: V11EnergyRecord[], types: V11EnergyType[]) {
  if (item.inputMode === 'linked' || item.inputMode === 'direct') {
    const source = records.find((record) => record.energyRecordId === item.inputEnergyRecordId);
    const energy = types.find((type) => type.energyTypeId === source?.energyTypeId);
    return source
      ? { main: `${energy?.energyTypeName ?? '能源数据'} · ${format(annual(source.monthlyAmounts, source.annualAmount), 2)} ${energy?.measurementUnit ?? ''}`, source: v11ScopeName(source.energyUnitId) }
      : { main: '来源记录不可用', source: '请编辑该记录' };
  }
  if (item.inputMode === 'manual') {
    const energy = types.find((type) => type.energyTypeId === item.inputEnergyTypeId);
    return { main: `${energy?.energyTypeName ?? '手工投入'} · ${format(item.inputAmount ?? 0, 2)} ${item.inputUnit ?? ''}`, source: '手工补充' };
  }
  const amount = item.recoveryAmount == null ? '未计量' : `${format(item.recoveryAmount, 2)} ${item.recoveryUnit ?? ''}`;
  return {
    main: `${item.recoveryEnergyName ?? '回收来源'} · ${amount}`,
    source: item.recoverySourceEnergyUnitId ? v11ScopeName(item.recoverySourceEnergyUnitId) : '未补充来源',
  };
}

function EnergyConversionOutputPage() {
  const { toast, notify } = useNotice();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  const editConversionId = params.get('editConversionId');
  const returnToIntensity = () => {
    if (returnTo?.startsWith('/energy-analysis/intensity')) navigate(returnTo);
  };
  const [version, setVersion] = useState(0);
  const [yearInput, setYearInput] = useState('2026');
  const [recordTypeInput, setRecordTypeInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [entryTab, setEntryTab] = useState<'conversion' | 'recovery' | 'external'>(params.get('tab') === 'conversion' ? 'conversion' : 'recovery');
  const [filters, setFilters] = useState({ year: '2026', recordType: '', keyword: '' });
  const [editing, setEditing] = useState<V11ConversionOutput | V11ExternalSupplyRecord | V11EnergyRecord | 'new' | 'recovery-new' | 'recovery-source-new' | 'external-new' | null>(null);
  const [viewing, setViewing] = useState<V11EnergyRecord | null>(null);
  const [viewingConversion, setViewingConversion] = useState<V11ConversionOutput | null>(null);
  const [viewingExternal, setViewingExternal] = useState<V11ExternalSupplyRecord | null>(null);
  const [deleting, setDeleting] = useState<V11ConversionOutput | V11EnergyRecord | null>(null);
  const [deletingExternal, setDeletingExternal] = useState<V11ExternalSupplyRecord | null>(null);
  const switchEntryTab = (tab: 'conversion' | 'recovery' | 'external') => {
    setEntryTab(tab);
    setRecordTypeInput(tab === 'recovery' ? '回收利用' : '');
    setKeywordInput('');
    setFilters({ year: yearInput, recordType: tab === 'recovery' ? '回收利用' : '', keyword: '' });
  };
  useEffect(() => {
    if (!editConversionId) return;
    const record = listV11ConversionOutputs().find((item) => item.conversionOutputId === editConversionId);
    if (record) {
      setEntryTab(record.recordType === '回收利用' ? 'recovery' : 'conversion');
      setYearInput(String(record.year));
      setFilters({ year: String(record.year), recordType: '', keyword: '' });
      setEditing(record);
    }
  }, [editConversionId]);
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const devices = listV11KeyDevices();
  const units = listEnergyUnits();
  const conversionRows = listV11ConversionOutputs().filter((item) =>
    item.year === Number(filters.year)
    && conversionOutputTypes.includes(item.recordType)
    && item.recordType !== '回收利用'
    && (!filters.recordType || (filters.recordType === 'recovery' ? item.inputMode === 'recovery' : item.inputMode !== 'recovery'))
    && (!filters.keyword || `${v11ScopeName(item.conversionEnergyUnitId)}${v11ScopeName(item.recoverySourceEnergyUnitId ?? null)}`.includes(filters.keyword)),
  );
  const recoveryRows = listV11ConversionOutputs().filter((item) =>
    item.year === Number(filters.year)
    && item.recordType === '回收利用'
    && (!filters.keyword || `${v11ScopeName(item.conversionEnergyUnitId)}${v11ScopeName(item.recoverySourceEnergyUnitId ?? null)}`.includes(filters.keyword)),
  );
  const recoverySourceRows = records.filter((item) =>
    item.year === Number(filters.year)
    && item.energyRole === '回收能源'
    && (!filters.keyword || `${v11ScopeName(item.energyUnitId)}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(filters.keyword)),
  );
  const externalRows = listV11ConversionOutputs().filter((item) => item.year === Number(filters.year) && item.recordType === '直接外供');
  const externalLedgerRows = listV11ExternalSupplyRecords().filter((item) => item.year === Number(filters.year));
  void version;
  return <Page toast={toast}><section className={styles.card}>
        <div className={styles.energySubmenu} role="tablist" aria-label="能源回收、转换与利用、外供"><button type="button" className={entryTab === 'recovery' ? styles.activeSubmenuItem : ''} role="tab" aria-selected={entryTab === 'recovery'} onClick={() => switchEntryTab('recovery')}>能源回收</button><button type="button" className={entryTab === 'conversion' ? styles.activeSubmenuItem : ''} role="tab" aria-selected={entryTab === 'conversion'} onClick={() => switchEntryTab('conversion')}>转换与利用</button><button type="button" className={entryTab === 'external' ? styles.activeSubmenuItem : ''} role="tab" aria-selected={entryTab === 'external'} onClick={() => switchEntryTab('external')}>能源外供</button></div>
    {entryTab === 'conversion' && <>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, recordType: recordTypeInput, keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setRecordTypeInput(''); setKeywordInput(''); setFilters({ year: '2026', recordType: '', keyword: '' }); }}>重置</Button>{returnTo && <Button onClick={returnToIntensity}>返回能耗指标</Button>}<Button primary onClick={() => setEditing('new')}>＋ 新增转换与利用记录</Button></>}>
      <Field label="数据年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="能源来源"><select value={recordTypeInput} onChange={(event) => setRecordTypeInput(event.target.value)}><option value="">全部</option><option value="normal">常规能源</option><option value="recovery">回收能源</option></select></Field>
      <Field label="转换单元"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="输入转换单元名称" /></Field>
    </Toolbar>
    <Notice><strong>记录实际业务事实：</strong>先选择具体业务场景，再填写投入、产出和去向。已有能源消费或回收来源会优先自动关联；分析结果由系统在后台生成。</Notice>
    <div className={styles.sectionToolbar}><div><h3>能源转换记录</h3><p>维护常规能源转换和回收能源转换业务，能源来源由关联的上游记录确定。</p></div></div>
    <div className={styles.tableWrap}><table className={styles.conversionTable}><thead><tr><th>转换单元</th><th>投入能源</th><th>能源来源</th><th>来源单元</th><th>产出能源</th><th>厂内可供分配</th><th>操作</th></tr></thead>
      <tbody>{conversionRows.length ? conversionRows.map((row) => {
        const input = conversionInputText(row, records, types);
        const source = records.find((record) => record.energyRecordId === row.inputEnergyRecordId);
        const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
        const outputName = row.recordType === '直接外供' ? sourceType?.energyTypeName ?? '外供能源' : row.outputEnergyName ?? types.find((type) => type.energyTypeId === row.outputEnergyTypeId)?.energyTypeName ?? '—';
        const outputUnit = row.recordType === '直接外供' ? sourceType?.measurementUnit ?? '' : row.outputUnit ?? '';
        const outputAmount = row.recordType === '直接外供' ? row.externalAmount : row.outputAmount ?? 0;
        const externalAmount = conversionExternalAmount(row);
        const availableAmount = Math.max((row.outputAmount ?? 0) - externalAmount - (row.lossAmount ?? 0), 0);
        const recoveredSource = row.inputMode === 'recovery' || source?.energyRole === '回收能源';
        return <tr key={row.conversionOutputId}><td><b className={styles.conversionSourceMain}>{v11ScopeName(row.conversionEnergyUnitId)}</b></td><td>{input.main}</td><td><Tag tone={recoveredSource ? 'orange' : 'blue'}>{recoveredSource ? '回收能源' : '常规能源'}</Tag></td><td>{input.source}</td><td>{outputName} · {format(outputAmount, 2)} {outputUnit}</td><td>{format(availableAmount, 2)} {outputUnit}</td><td><Actions onView={() => setViewingConversion(row)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>;
      }) : <EmptyRow colSpan={7} />}</tbody>
    </table></div><Pagination count={conversionRows.length} />
    <div className={styles.sectionToolbar}><div><h3>回收能源直接利用记录</h3><p>回收能源经独立的回收利用系统直接转为蒸汽、热水等厂内可用能源，不经过余热发电机组。</p></div></div>
    <div className={styles.tableWrap}><table className={styles.conversionTable}><thead><tr><th>处理单元</th><th>回收能源</th><th>能源来源</th><th>来源单元</th><th>利用量</th><th>厂内利用去向</th><th>操作</th></tr></thead>
      <tbody>{recoveryRows.length ? recoveryRows.map((row) => { const input = conversionInputText(row, records, types); const outputName = row.outputEnergyName ?? types.find((type) => type.energyTypeId === row.outputEnergyTypeId)?.energyTypeName ?? '回收能源'; const outputUnit = row.outputUnit ?? ''; return <tr key={row.conversionOutputId}><td><b className={styles.conversionSourceMain}>{v11ScopeName(row.conversionEnergyUnitId)}</b></td><td>{input.main}</td><td><Tag tone="green">回收能源</Tag></td><td>{input.source}</td><td>{outputName} · {format(row.outputAmount ?? 0, 2)} {outputUnit}</td><td>{format(row.internalAmount ?? 0, 2)} {outputUnit}</td><td><Actions onView={() => setViewingConversion(row)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>; }) : <EmptyRow colSpan={7} />}</tbody>
    </table></div><Pagination count={recoveryRows.length} />
    </>}
    {entryTab === 'recovery' && <>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, recordType: '回收利用', keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setKeywordInput(''); setFilters({ year: '2026', recordType: '回收利用', keyword: '' }); }}>重置</Button>{returnTo && <Button onClick={returnToIntensity}>返回能耗指标</Button>}<Button primary onClick={() => setEditing('recovery-source-new')}>＋ 新增回收能源来源</Button></>}>
      <Field label="数据年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="回收来源"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="输入回收来源或利用单元" /></Field>
    </Toolbar>
    <div className={styles.sectionToolbar}><div><h3>回收能源来源记录</h3><p>维护生产设备和动力公辅设备实际产生的余热、余压等回收能源量；这是回收来源数据，不在本页维护能源利用或转换结果。</p></div><div className={styles.flowLedgerActions}><span>共 {recoverySourceRows.length} 条</span></div></div>
    <div className={styles.tableWrap}><table className={`${styles.conversionTable} ${styles.recoverySourceTable}`}><thead><tr><th>余热产生设备</th><th>二级用能单元</th><th>一级用能单元</th><th>回收能源</th><th>数据进度</th><th>年度总量</th><th>操作</th></tr></thead><tbody>{recoverySourceRows.length ? recoverySourceRows.map((row) => { const type = types.find((item) => item.energyTypeId === row.energyTypeId); const sourceDevice = devices.find((device) => device.deviceId === row.sourceDeviceId); const sourceOption = recoverySourceOptions.find((option) => option.deviceId === row.sourceDeviceId); const sourceUnit = units.find((unit) => unit.energyUnitId === (sourceDevice?.energyUnitId ?? row.energyUnitId)); const levelTwoUnit = sourceUnit?.unitLevel === 'level2' ? sourceUnit : undefined; const levelOneUnit = levelTwoUnit ? units.find((unit) => unit.energyUnitId === levelTwoUnit.parentEnergyUnitId) : sourceUnit; return <tr key={row.energyRecordId}><td><b className={styles.conversionSourceMain}>{sourceOption?.label ?? sourceDevice?.deviceName ?? '—'}</b></td><td>{levelTwoUnit?.energyUnitName ?? '—'}</td><td>{levelOneUnit?.energyUnitName ?? '—'}</td><td>{type?.energyTypeName ?? '回收能源'}</td><td>{energyDataProgress(row)}</td><td>{format(annual(row.monthlyAmounts, row.annualAmount), 2)} {type?.measurementUnit ?? ''}</td><td><Actions onView={() => setViewing(row)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>; }) : <EmptyRow colSpan={7} />}</tbody></table></div>
    </>}
    {entryTab === 'external' && <>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, recordType: '', keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setKeywordInput(''); setFilters({ year: '2026', recordType: '', keyword: '' }); }}>重置</Button>{returnTo && <Button onClick={returnToIntensity}>返回能耗指标</Button>}<Button primary onClick={() => setEditing('external-new')}>＋ 新增供能登记</Button></>}>
      <Field label="数据年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="来源能源/单元"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="输入来源能源或单元" /></Field>
    </Toolbar>
    <Notice><strong>记录能源外供事实：</strong>转换产出外供是主要场景；企业级能源直接转供仅适用于能源转售、园区分销或有独立外供计量的情况，不代表厂内燃料消耗。两类外供都会进入能流图的外部输出。</Notice>
    <div className={styles.sectionToolbar}><div><h3>能源外供登记</h3><p>转换产出在能源转换页维护；本页只维护来源、外供量、接收方和外供凭证。</p></div><span>共 {externalLedgerRows.length} 条</span></div>
    {externalLedgerRows.length > 0 ? <div className={styles.tableWrap}><table className={styles.conversionTable}><thead><tr><th>来源类型</th><th>来源能源/转换</th><th>外供量</th><th>接收方</th><th>操作</th></tr></thead><tbody>{externalLedgerRows.map((row) => { const source = records.find((record) => record.energyRecordId === row.inputEnergyRecordId); const conversion = listV11ConversionOutputs().find((item) => item.conversionOutputId === row.conversionOutputId); const type = types.find((item) => item.energyTypeId === (row.energyTypeId ?? source?.energyTypeId ?? conversion?.outputEnergyTypeId)); return <tr key={row.externalSupplyId}><td>{row.conversionOutputId ? '转换产出外供' : '直接外供'}</td><td>{type?.energyTypeName ?? '—'}<small className={styles.subText}>{row.conversionOutputId ? conversion?.recordType ?? '转换记录' : v11ScopeName(source?.energyUnitId ?? null)}</small></td><td>{format(row.amount, 2)} {row.unit ?? type?.measurementUnit}</td><td>{row.receiver || '—'}</td><td><Actions onView={() => setViewingExternal(row)} onEdit={() => setEditing(row)} onDelete={() => setDeletingExternal(row)} /></td></tr>; })}</tbody></table></div> : <div className={styles.empty}>暂无外供登记</div>}
    </>}
  </section>
  {viewing && <EnergyRecordDialog key={`view-${viewing.energyRecordId}`} item={viewing} dataYear={viewing.year} energyRole="回收能源" lockedScopeLevel="二级用能单元" readOnly onClose={() => setViewing(null)} onSaved={() => setViewing(null)} />}
  {viewingConversion && <ConversionOutputDialog key={`view-${viewingConversion.conversionOutputId}`} item={viewingConversion} readOnly onClose={() => setViewingConversion(null)} onSaved={() => setViewingConversion(null)} />}
  {viewingExternal && <ExternalSupplyDialog key={`view-${viewingExternal.externalSupplyId}`} item={viewingExternal} readOnly onClose={() => setViewingExternal(null)} onSaved={() => setViewingExternal(null)} />}
  {editing === 'external-new' ? <ExternalSupplyDialog onClose={() => { setEditing(null); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} /> : editing === 'recovery-source-new' ? <EnergyRecordDialog dataYear={Number(yearInput)} energyRole="回收能源" lockedScopeLevel="二级用能单元" onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} /> : editing === 'new' ? <ConversionOutputDialog onClose={() => { setEditing(null); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} /> : editing === 'recovery-new' ? <ConversionOutputDialog initialRecordType="回收利用" onClose={() => { setEditing(null); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} /> : editing && 'energyRecordId' in editing ? <EnergyRecordDialog key={editing.energyRecordId} item={editing} dataYear={editing.year} energyRole="回收能源" lockedScopeLevel="二级用能单元" onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} /> : editing && 'recordType' in editing ? <ConversionOutputDialog key={editing.conversionOutputId} item={editing} onClose={() => { setEditing(null); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} /> : editing ? <ExternalSupplyDialog key={editing.externalSupplyId} item={editing} onClose={() => { setEditing(null); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} /> : null}
  {deleting && 'energyRecordId' in deleting ? <Modal title="删除回收能源来源" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { const result = deleteV11EnergyRecord(deleting.energyRecordId); if (!result.ok) return notify(result.error); setDeleting(null); setVersion((value) => value + 1); notify('回收能源来源已删除'); }}><div className={styles.warning}>确认删除当前回收能源来源吗？</div></Modal> : deleting && <Modal title="删除能源转换记录" width={560} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11ConversionOutput(deleting.conversionOutputId); setDeleting(null); setVersion((value) => value + 1); notify('能源转换记录已删除'); }}><div className={styles.warning}>确认删除该能源转换记录吗？</div></Modal>}
    {deletingExternal && <Modal title="删除能源外供记录" width={520} submitText="确认删除" onClose={() => setDeletingExternal(null)} onSubmit={() => { deleteV11ExternalSupplyRecord(deletingExternal.externalSupplyId); setDeletingExternal(null); setVersion((value) => value + 1); notify('能源外供记录已删除'); }}><div className={styles.warning}>确认删除这笔能源外供记录吗？</div></Modal>}
  </Page>;
}

function ExternalSupplyDialog({ item, readOnly = false, onClose, onSaved }: { item?: V11ExternalSupplyRecord; readOnly?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const conversions = listV11ConversionOutputs().filter((record) => record.recordType !== '直接外供');
  const [sourceKind, setSourceKind] = useState<'direct' | 'conversion'>(item ? (item.conversionOutputId ? 'conversion' : 'direct') : 'conversion');
  const [year, setYear] = useState(String(item?.year ?? 2026));
  const [inputEnergyRecordId, setInputEnergyRecordId] = useState(item?.inputEnergyRecordId ?? '');
  const [conversionOutputId, setConversionOutputId] = useState(item?.conversionOutputId ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [monthlyAmounts, setMonthlyAmounts] = useState(monthlyConversionFields(item?.monthlyAmounts));
  const [receiver, setReceiver] = useState(item?.receiver ?? '');
  const [evidenceNames, setEvidenceNames] = useState(item?.evidenceNames ?? []);
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const directCandidates = records.filter((record) => record.year === Number(year) && record.scopeLevel === '企业');
  const conversionCandidates = conversions.filter((record) => record.year === Number(year));
  const selectedSource = directCandidates.find((record) => record.energyRecordId === inputEnergyRecordId);
  const selectedConversion = conversionCandidates.find((record) => record.conversionOutputId === conversionOutputId);
  const selectedTypeId = sourceKind === 'direct' ? selectedSource?.energyTypeId : selectedConversion?.outputEnergyTypeId;
  const selectedType = types.find((type) => type.energyTypeId === (item?.energyTypeId ?? selectedTypeId));
  const monthlyComplete = monthlyAmounts.every((value) => value !== '');
  const monthlyTotal = monthlyAmounts.reduce((sum, value) => sum + Number(value || 0), 0);
  const save = () => {
    setError('');
    if (sourceKind === 'direct' && !inputEnergyRecordId) return setError('请选择企业级能源数据作为直接转供来源。');
    if (sourceKind === 'conversion' && !conversionOutputId) return setError('请选择一条转换产出作为外供来源。');
    if (!receiver.trim()) return setError('请填写外供接收方，便于能流图追溯外部去向。');
    if (!monthlyComplete && !(Number(amount) > 0)) return setError('月度数据不完整时，请填写年度外供量。');
    const result = saveV11ExternalSupplyRecord({
      year: Number(year),
      inputEnergyRecordId: sourceKind === 'direct' ? inputEnergyRecordId : undefined,
      conversionOutputId: sourceKind === 'conversion' ? conversionOutputId : undefined,
      energyTypeId: selectedTypeId,
      amount: monthlyComplete ? monthlyTotal : Number(amount),
      unit: selectedType?.measurementUnit,
      monthlyAmounts: monthlyComplete ? monthlyAmounts.map((value) => Number(value)) : undefined,
      receiver: receiver.trim(),
      evidenceNames,
      remark: remark.trim(),
    }, item?.externalSupplyId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源供能记录已更新' : '能源供能记录已新增');
  };
  return <Modal title={readOnly ? '查看能源外供记录' : item ? '编辑能源外供记录' : '新增能源外供登记'} width={860} onClose={onClose} onSubmit={readOnly ? undefined : save} submitText={item ? '保存修改' : '保存登记'}>
    <div className={styles.conversionFormSection}><h3>外供来源</h3><div className={`${styles.conversionFormBody} ${styles.compactGrid}`}>
      <Field label="数据年度"><select value={year} onChange={(event) => { setYear(event.target.value); setInputEnergyRecordId(''); setConversionOutputId(''); }} disabled={Boolean(item) || readOnly}><option>2026</option><option>2025</option></select></Field>
      <Field label="外供来源类型"><select value={sourceKind} onChange={(event) => { setSourceKind(event.target.value as 'direct' | 'conversion'); setInputEnergyRecordId(''); setConversionOutputId(''); }} disabled={Boolean(item) || readOnly}><option value="conversion">转换产出外供（主要场景）</option><option value="direct">企业级能源直接转供（特殊场景）</option></select></Field>
      {sourceKind === 'direct' ? <Field label="关联企业级来源数据" required><select value={inputEnergyRecordId} onChange={(event) => setInputEnergyRecordId(event.target.value)} disabled={Boolean(item) || readOnly}><option value="">请选择企业级能源输入</option>{directCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{type?.energyTypeName ?? '能源'}｜企业输入｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit ?? ''}</option>; })}</select></Field> : <Field label="关联转换产出" required><select value={conversionOutputId} onChange={(event) => setConversionOutputId(event.target.value)} disabled={Boolean(item) || readOnly}><option value="">请选择转换产出</option>{conversionCandidates.map((record) => <option key={record.conversionOutputId} value={record.conversionOutputId}>{record.recordType}｜{record.outputEnergyName ?? '能源'}｜{format(record.outputAmount ?? 0, 2)} {record.outputUnit ?? ''}</option>)}</select></Field>}
      <div className={styles.helpText}>{sourceKind === 'direct' ? '仅当企业级能源存在独立转供/转售事实时使用；厂内生产燃料消耗不要登记为直接外供。' : '转换产出外供是主要场景，外供量会从对应转换产出的厂内可供分配量中扣除。'}来源关联用于生成能流分析追溯关系，凭证用于证明外供事实。</div>
    </div></div>
    <div className={styles.conversionFormSection}><h3>外供数量</h3><div className={styles.conversionFormBody}><div className={styles.monthlyHint}>按实际取得月份填写；月度数据不完整时补录年度总量，系统不会自动分摊缺失月份。</div><div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input aria-label={`${month}外供量`} type="number" min="0" value={monthlyAmounts[index]} onChange={(event) => setMonthlyAmounts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} readOnly={readOnly} /></Field>)}</div><Field label={`${monthlyComplete ? '年度合计' : '年度外供量补录'}（${selectedType?.measurementUnit ?? '原单位'}）`} required={!monthlyComplete}><input type="number" min="0" value={monthlyComplete ? String(monthlyTotal) : amount} readOnly={monthlyComplete || readOnly} placeholder={monthlyComplete ? '' : '月度不完整时填写年度外供量'} onChange={(event) => setAmount(event.target.value)} /></Field></div></div>
    <div className={styles.compactGrid}><Field label="接收方"><input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="例如：电网、园区蒸汽用户" readOnly={readOnly} /></Field></div><div className={styles.conversionFormSection}><h3>依据凭证</h3><div className={styles.conversionFormBody}><input type="file" multiple onChange={(event) => setEvidenceNames(Array.from(event.target.files ?? []).map((file) => file.name))} disabled={readOnly} /><div className={styles.helpText}>可上传计量表、销售/结算单、并网报表或供能合同；当前原型保存文件名，正式环境将保存附件。</div>{evidenceNames.length > 0 && <div className={styles.helpText}>已选择：{evidenceNames.join('、')}</div>}</div></div><div className={styles.conversionRemark}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="补充说明外供事实或计量口径" readOnly={readOnly} /></Field></div>{error && <div className={styles.error}>{error}</div>}
  </Modal>;
}

function ConversionOutputDialog({ item, initialRecordType, readOnly = false, onClose, onSaved }: { item?: V11ConversionOutput; initialRecordType?: ConversionOutputType; readOnly?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const navigate = useNavigate();
  const units = listEnergyUnits();
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const [recordType, setRecordType] = useState<ConversionOutputType>(item?.recordType ?? initialRecordType ?? '锅炉产汽/产热');
  const [businessPath, setBusinessPath] = useState<ConversionBusinessPath>(conversionBusinessPathFor(item?.recordType ?? initialRecordType ?? '锅炉产汽/产热'));
  const [step, setStep] = useState(item || initialRecordType ? 1 : 0);
  const entryMode = 'monthly';
  const [year, setYear] = useState(String(item?.year ?? 2026));
  const [unitId, setUnitId] = useState(item?.conversionEnergyUnitId ?? (initialRecordType ? listScenarioConversionSystems(initialRecordType)[0]?.energyUnitId ?? '' : ''));
  const [inputMode, setInputMode] = useState<ConversionInputMode>(item?.inputMode === 'manual' ? 'linked' : item?.inputMode ?? 'linked');
  const [inputRecordId, setInputRecordId] = useState(item?.inputEnergyRecordId ?? '');
  const [recoverySourceId, setRecoverySourceId] = useState(item?.recoverySourceEnergyUnitId ?? '');
  const [recoveryEnergy, setRecoveryEnergy] = useState(item?.recoveryEnergyName ?? '余热');
  const [recoveryUnit, setRecoveryUnit] = useState(item?.recoveryUnit ?? 'GJ');
  const [outputCategory, setOutputCategory] = useState<AnalysisCategory>(item?.outputAnalysisCategory ?? '热力');
  const [outputEnergyName, setOutputEnergyName] = useState(item?.outputEnergyName ?? '蒸汽');
  const [outputUnit, setOutputUnit] = useState(item?.outputUnit ?? 'GJ');
  const [outputAmount, setOutputAmount] = useState(String(item?.outputAmount ?? 0));
  const [lossAmount, setLossAmount] = useState(item?.lossAmount == null ? '' : String(item.lossAmount));
  const [externalAmount, setExternalAmount] = useState(String(item?.externalAmount ?? 0));
  const [monthlyInputAmounts, setMonthlyInputAmounts] = useState(monthlyConversionFields(item?.monthlyInputAmounts));
  const [monthlyOutputAmounts, setMonthlyOutputAmounts] = useState(monthlyConversionFields(item?.monthlyOutputAmounts));
  const [monthlyExternalAmounts, setMonthlyExternalAmounts] = useState(item ? monthlyConversionFields(item.monthlyExternalAmounts) : Array.from({ length: 12 }, () => '0'));
  const [receiver, setReceiver] = useState(item?.receiver ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const conversionUnits = recordType === '直接外供' ? [] : listScenarioConversionSystems(recordType);
  const existingRecord = !item ? listV11ConversionOutputs().find((record) => record.year === Number(year) && record.recordType === recordType && record.conversionEnergyUnitId === (recordType === '直接外供' ? null : unitId)) : undefined;
  const linkedCandidates = records.filter((record) => record.year === Number(year)
    && record.energyUnitId === unitId
    && v11RecordScopeType(record) !== 'device'
    && ['能源消费', '回收能源'].includes(record.energyRole)
    && (recordType !== '锅炉产汽/产热' || ['化石燃料', '可再生及替代能源'].includes(types.find((type) => type.energyTypeId === record.energyTypeId)?.analysisCategory ?? ''))
    && (recordType !== '空压产气/压缩空气' || types.find((type) => type.energyTypeId === record.energyTypeId)?.energyTypeName === '电力'));
  const recoveryCandidates = records.filter((record) => record.year === Number(year)
    && (!recoverySourceId || record.energyUnitId === recoverySourceId)
    && record.energyRole === '回收能源'
    && (recoveryEnergy === '余热' || types.find((type) => type.energyTypeId === record.energyTypeId)?.energyTypeName === recoveryEnergy));
  const recoveryCandidate = recoveryCandidates.length === 1 ? recoveryCandidates[0] : undefined;
  const selectedRecoveryCandidate = recoveryCandidate ?? records.find((record) => record.energyRecordId === inputRecordId && record.energyRole === '回收能源');
  const directCandidates = records.filter((record) => record.year === Number(year) && record.scopeLevel === '企业');
  const outputValue = Number(outputAmount || 0);
  const monthlyOutputValue = monthlyOutputAmounts.reduce((sum, value) => sum + Number(value || 0), 0);
  const monthlyOutputComplete = monthlyOutputAmounts.every((value) => value !== '');
  const effectiveOutputValue = monthlyOutputComplete ? monthlyOutputValue : outputValue;
  const effectiveRecoveryAmount = item?.recoveryAmount ?? (selectedRecoveryCandidate ? annual(selectedRecoveryCandidate.monthlyAmounts, selectedRecoveryCandidate.annualAmount) : null);
  const conversionSupplies = item ? listV11ExternalSupplyRecords().filter((record) => record.conversionOutputId === item.conversionOutputId) : [];
  const effectiveExternalValue = conversionSupplies.reduce((sum, record) => sum + record.amount, 0);
  const confirmedLossValue = Math.max(Number(lossAmount || 0), 0);
  const internalValue = Math.max(effectiveOutputValue - effectiveExternalValue - confirmedLossValue, 0);
  const unallocatedAmount = Math.max(effectiveExternalValue + confirmedLossValue - effectiveOutputValue, 0);
  const hasOverAllocated = unallocatedAmount > 1e-8;
  const source = records.find((record) => record.energyRecordId === inputRecordId);
  const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
  const linkedCandidate = linkedCandidates.length === 1 ? linkedCandidates[0] : undefined;
  useEffect(() => {
    if (recordType === '直接外供') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the dependent unit selection valid after its source changes.
    if (conversionUnits.length === 1 && unitId !== conversionUnits[0].energyUnitId) setUnitId(conversionUnits[0].energyUnitId);
    if (conversionUnits.length > 1 && unitId && !conversionUnits.some((unit) => unit.energyUnitId === unitId)) setUnitId('');
    if (conversionUnits.length === 0 && unitId) setUnitId('');
  }, [recordType, unitId, conversionUnits]);
  useEffect(() => {
    if (recordType !== '锅炉产汽/产热' && recordType !== '空压产气/压缩空气' && recordType !== '其他转换') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the linked energy record in sync with the selected conversion context.
    if (linkedCandidate && inputRecordId !== linkedCandidate.energyRecordId) setInputRecordId(linkedCandidate.energyRecordId);
    if (linkedCandidates.length !== 1 && inputRecordId && !linkedCandidates.some((record) => record.energyRecordId === inputRecordId)) setInputRecordId('');
  }, [recordType, year, unitId, inputRecordId, linkedCandidate, linkedCandidates]);
  useEffect(() => {
    if (inputMode !== 'recovery') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the recovery trace linked to the unique source ledger row.
    if (recoveryCandidate && recoverySourceId !== recoveryCandidate.energyUnitId) setRecoverySourceId(recoveryCandidate.energyUnitId ?? '');
    if (recoveryCandidate && inputRecordId !== recoveryCandidate.energyRecordId) setInputRecordId(recoveryCandidate.energyRecordId);
    if (recoveryCandidates.length !== 1 && inputRecordId && !recoveryCandidates.some((record) => record.energyRecordId === inputRecordId)) setInputRecordId('');
  }, [inputMode, inputRecordId, recoverySourceId, recoveryCandidate, recoveryCandidates]);
  const selectType = (next: ConversionOutputType) => {
    setRecordType(next);
    setError('');
    setUnitId(listScenarioConversionSystems(next)[0]?.energyUnitId ?? '');
    setInputMode(next === '余热发电' || next === '回收利用' ? 'recovery' : next === '直接外供' ? 'direct' : 'linked');
    setInputRecordId('');
    // 回收能源是转换/利用的投入来源；“回收蒸汽”等属于后续产出，不能用作来源筛选条件。
    setRecoveryEnergy('余热');
    setRecoveryUnit('GJ');
    const nextCategory: AnalysisCategory = next === '锅炉产汽/产热' ? '热力' : next === '余热发电' ? '电力' : next === '空压产气/压缩空气' ? '其他能源' : next === '回收利用' ? '回收能源' : '电力';
    const nextName = next === '锅炉产汽/产热' ? '蒸汽' : next === '余热发电' ? '电力' : next === '空压产气/压缩空气' ? '压缩空气' : next === '回收利用' ? '回收热水' : '电力';
    setOutputCategory(nextCategory); setOutputEnergyName(nextName); setOutputUnit(next === '锅炉产汽/产热' ? 'GJ' : next === '回收利用' ? 'GJ' : next === '空压产气/压缩空气' ? 'Nm³' : 'kWh');
  };
  const save = () => {
    if (!item && step === 0) { setStep(1); return; }
    setError('');
    if (existingRecord) return;
    if (recordType === '直接外供') {
      const directSource = records.find((record) => record.energyRecordId === inputRecordId);
      if (!directSource || Number(externalAmount) <= 0) return setError('请选择外供来源能源数据并填写外供量。');
      const result = saveV11ConversionOutput({ year: Number(year), recordType, conversionEnergyUnitId: null, inputMode: 'direct', inputEnergyRecordId: inputRecordId, externalAmount: Number(externalAmount), receiver, remark: '' }, item?.conversionOutputId);
      if (!result.ok) return setError(result.error);
      return onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
    }
    if (!unitId || effectiveOutputValue <= 0) return setError('请选择实际转换/来源单元，并填写产出或回收总量。');
    if (!monthlyOutputComplete && outputValue <= 0) return setError('月度数据不完整时，请补录年度总量。');
    if (inputMode === 'recovery' && !inputRecordId) return setError('请先补录并关联一条回收能源来源。');
    if (hasOverAllocated) return setError('外供量与转换损失合计不能大于产出量，请检查外供台账或损失数据。');
    if ((recordType === '锅炉产汽/产热' || recordType === '空压产气/压缩空气' || recordType === '其他转换') && !inputRecordId) return setError('当前系统暂无可关联的能源数据，请先补录后再保存。');
    const outputType = types.find((type) => type.energyTypeName === outputEnergyName && type.analysisCategory === outputCategory);
    const monthlyInput = normalizeMonthlyConversion(monthlyInputAmounts);
    const monthlyOutput = monthlyOutputComplete ? normalizeMonthlyConversion(monthlyOutputAmounts) : undefined;
    const monthlyExternal: undefined = undefined;
    const monthlyInternal = monthlyOutputComplete
      ? monthlyOutputAmounts.map((value) => Number(value) - effectiveExternalValue / 12 - confirmedLossValue / 12)
      : undefined;
    const result = saveV11ConversionOutput({
      year: Number(year), recordType, conversionEnergyUnitId: unitId, inputMode,
      inputEnergyRecordId: inputMode === 'linked' ? inputRecordId : undefined,
      recoverySourceEnergyUnitId: inputMode === 'recovery' && (selectedRecoveryCandidate || recoverySourceId) ? selectedRecoveryCandidate?.energyUnitId ?? recoverySourceId : undefined,
      recoveryEnergyName: inputMode === 'recovery' ? recoveryEnergy : undefined,
      recoveryAmount: inputMode === 'recovery' ? effectiveRecoveryAmount : undefined,
      recoveryUnit: inputMode === 'recovery' ? recoveryUnit : undefined,
      outputAnalysisCategory: outputCategory, outputEnergyTypeId: outputType?.energyTypeId, outputEnergyName, outputUnit,
      outputAmount: effectiveOutputValue, internalAmount: internalValue,
      outputTargetEnergyUnitId: recordType === '空压产气/压缩空气'
        ? units.find((unit) => unit.energyUnitId === unitId)?.parentEnergyUnitId ?? undefined
        : undefined,
      externalAmount: 0, receiver: '', lossAmount: confirmedLossValue, remark,
      monthlyInputAmounts: monthlyInput ?? undefined, monthlyOutputAmounts: monthlyOutput ?? undefined, monthlyInternalAmounts: monthlyInternal ?? undefined, monthlyExternalAmounts: monthlyExternal,
    }, item?.conversionOutputId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
  };
  const openEnergyEntry = (role: EnergyRole, targetUnitId = '') => {
    onClose();
    const query = new URLSearchParams({ scopeLevel: '二级用能单元', year, role });
    if (targetUnitId) {
      query.set('unitId', targetUnitId);
      query.set('new', '1');
    }
    navigate(`/data-management/energy-data?${query.toString()}`);
  };
  const selectedBusinessPath = conversionBusinessPaths.find((path) => path.value === businessPath) ?? conversionBusinessPaths[0];
  return <Modal title={readOnly ? '查看转换与利用记录' : item ? '编辑转换与利用记录' : step === 0 ? '新增转换与利用记录' : `新增${conversionSceneLabel(recordType)}`} width={1040} onClose={onClose} onSubmit={readOnly ? undefined : save} submitText={step === 0 ? '下一步' : item ? '保存修改' : '保存记录'} dataEntryMode={entryMode}>
    <fieldset disabled={readOnly} className={readOnly ? styles.readOnlyFieldset : undefined}>
    {step === 0 ? <>
      <div className={styles.conversionModalIntro}><i>1</i><span>请选择本次要记录的具体场景，系统将展示对应的填写内容。</span></div>
      {conversionBusinessPaths.map((path) => <section className={styles.conversionSceneGroup} key={path.value}><div className={styles.conversionSceneGroupHeader}><strong>{path.label}</strong><span>{path.description}</span></div><div className={styles.conversionSceneGrid}>{path.types.map((type) => <button type="button" key={type} className={recordType === type ? styles.sceneActive : ''} onClick={() => { setBusinessPath(path.value); selectType(type); }}><strong>{conversionSceneLabel(type)}</strong><span>{conversionSceneCopy[type]}</span></button>)}</div></section>)}
    </> : <>
    <div className={styles.conversionContextBar}>
      <span><small>业务路径</small><strong>{conversionBusinessPathLabel(businessPath)}</strong></span>
      <span><small>数据年度</small><strong>{year} 年</strong></span>
    <span><small>{recordType === '直接外供' ? '业务归属' : recordType === '回收利用' ? '处理单元' : '转换单元'}</small>{recordType === '直接外供' ? <strong>企业边界</strong> : conversionUnits.length === 1 ? <strong>{conversionUnits[0].energyUnitName}</strong> : <select className={styles.contextSelect} value={unitId} onChange={(event) => { setUnitId(event.target.value); setInputRecordId(''); }} disabled={conversionUnits.length === 0}>{conversionUnits.length === 0 ? <option>暂无适用转换单元</option> : <><option value="">请选择转换单元</option>{conversionUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select>}</span>
    </div>
    {recordType !== '直接外供' && conversionUnits.length === 0 && <div className={styles.missingDataAction}><span>暂无适用转换系统，请先在用能单元中维护对应的适用转换场景。</span><button type="button" onClick={() => navigate('/data-management/units')}>去维护用能单元</button></div>}
    {recordType === '直接外供' ? <div className={styles.conversionFormSection}><h3>外供来源</h3><div className={`${styles.formGrid} ${styles.conversionFormBody}`}>
      <Field label="关联已有能源量数据" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择</option>{directCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{v11ScopeName(record.energyUnitId)}｜{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select></Field>
      <Field label="本次外供量" required><input type="number" min="0" value={externalAmount} onChange={(event) => setExternalAmount(event.target.value)} /></Field>
      <Field label="接收方"><input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="选填" /></Field>
      <div className={`${styles.sourceLocked} ${styles.full}`}>{source ? <>来源：<strong>{v11ScopeName(source.energyUnitId)}｜{sourceType?.energyTypeName}｜{format(annual(source.monthlyAmounts, source.annualAmount), 2)} {sourceType?.measurementUnit}</strong><br />直接外供仅关联企业级能源输入记录；转换产出的外供请在对应转换记录中填写。</> : '暂无可关联能源量数据，请先新增能源数据。'}</div>
    </div></div> : <>
      {(recordType === '锅炉产汽/产热' || recordType === '空压产气/压缩空气' || recordType === '其他转换') && (!linkedCandidate || linkedCandidates.length > 1) && <div className={styles.conversionFormSection}><h3>投入能源</h3><div className={styles.conversionFormBody}>
        {linkedCandidate ? <><Field label="关联能源记录" required><input value={`${year}年度｜${v11ScopeName(linkedCandidate.energyUnitId)}｜${types.find((value) => value.energyTypeId === linkedCandidate.energyTypeId)?.energyTypeName ?? '能源数据'}｜${format(annual(linkedCandidate.monthlyAmounts, linkedCandidate.annualAmount), 2)} ${types.find((value) => value.energyTypeId === linkedCandidate.energyTypeId)?.measurementUnit ?? ''}`} readOnly /></Field></> : linkedCandidates.length > 1 ? <><Field label="关联能源记录" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择已有能源数据</option>{linkedCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{year}年度｜{v11ScopeName(record.energyUnitId)}｜{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select></Field></> : <div className={styles.inlineLinkRow}><span>暂无符合条件的能源消费记录。</span><button type="button" onClick={() => openEnergyEntry('能源消费', unitId)}>去二级用能单元录入</button></div>}
      </div></div>}
      {(recordType === '余热发电' || recordType === '回收利用') && !readOnly && <div className={styles.conversionFormSection}><h3>关联回收能源来源</h3><div className={styles.conversionFormBody}><div className={styles.helpText}>本弹窗只登记余热直接利用或余热发电结果。本期一条转换记录只关联一条回收能源来源；如多台设备的余热已汇总后利用，请先在“能源回收”中录入一条汇总后的来源台账。</div>{recoveryCandidates.length > 0 && <><div className={styles.compactGrid}><Field label="回收能源" required><select value={recoveryEnergy} onChange={(event) => { setRecoveryEnergy(event.target.value); setRecoveryUnit(['余热', '压力能'].includes(event.target.value) ? 'GJ' : event.target.value === '可燃尾气' ? 'Nm³' : 't'); }}>{recoveryEnergyOptions.map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className={styles.compactGrid}><Field label="关联回收能源来源" required>{recoveryCandidate ? <input value={`${year}年度｜${v11ScopeName(recoveryCandidate.energyUnitId)}｜${types.find((value) => value.energyTypeId === recoveryCandidate.energyTypeId)?.energyTypeName ?? recoveryEnergy}｜${format(annual(recoveryCandidate.monthlyAmounts, recoveryCandidate.annualAmount), 2)} ${types.find((value) => value.energyTypeId === recoveryCandidate.energyTypeId)?.measurementUnit ?? recoveryUnit}`} readOnly /> : <select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择一条回收能源来源</option>{recoveryCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{v11ScopeName(record.energyUnitId)}｜{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select>}</Field><Field label="来源单元"><input value={selectedRecoveryCandidate?.energyUnitId ? v11ScopeName(selectedRecoveryCandidate.energyUnitId) : '选择回收能源来源后自动带出'} readOnly /></Field></div><div className={styles.helpText}>已选来源的年度/月度数据将作为本次转换投入量。</div></>}</div>{recoveryCandidates.length === 0 && <div className={styles.missingDataAction}><span>暂无可关联的回收能源来源，请先录入来源台账</span><button type="button" onClick={() => openEnergyEntry('回收能源', recoverySourceId)}>去录入回收能源来源</button></div>}</div>}
      {(recordType === '余热发电' || recordType === '回收利用') && readOnly && <div className={styles.monthlyHint}>说明：本次转换使用{recoveryEnergy}作为回收能源，来源单元为{selectedRecoveryCandidate?.energyUnitId ? v11ScopeName(selectedRecoveryCandidate.energyUnitId) : '未关联'}，年度来源量为{selectedRecoveryCandidate ? `${format(annual(selectedRecoveryCandidate.monthlyAmounts, selectedRecoveryCandidate.annualAmount), 2)} ${types.find((value) => value.energyTypeId === selectedRecoveryCandidate.energyTypeId)?.measurementUnit ?? recoveryUnit}` : '未补充'}。该来源数据用于核算本次转换投入量。</div>}
      <div className={styles.conversionFormSection}><h3>逐月产出量</h3><div className={styles.conversionFormBody}><div className={styles.monthlyHint}>按实际已取得月份填报；月度数据不完整时，必须补录年度总量，系统不会自动分摊缺失月份。</div><div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input aria-label={`${month}产出量`} type="number" min="0" value={monthlyOutputAmounts[index]} onChange={(event) => setMonthlyOutputAmounts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></Field>)}</div><div className={styles.full}><Field label={`${monthlyOutputComplete ? '年度合计' : '年度总量补录'}（${outputUnit}）`} required={!monthlyOutputComplete}><input type="number" min="0" value={monthlyOutputComplete ? String(monthlyOutputValue) : outputAmount} readOnly={monthlyOutputComplete} placeholder={monthlyOutputComplete ? '' : '月度不完整时填写年度总量'} onChange={(event) => setOutputAmount(event.target.value)} /></Field></div></div></div>
      <div className={styles.conversionFormSection}><h3>转换损失确认</h3><div className={styles.conversionFormBody}><div className={styles.monthlyHint}>相关去向数据由系统自动汇总，无需在此填写；保存后可在台账或分析页面查看。</div><div className={styles.flowConfirmGroup}><div className={styles.flowResultGroupTitle}><strong>企业确认数据</strong><span>按需确认 · 非必填</span></div><Field label={<span>企业确认的转换损失（{outputUnit}）</span>}><input className={styles.flowEditableInput} type="number" min="0" value={lossAmount} placeholder="有明确依据时填写" onChange={(event) => setLossAmount(event.target.value)} /></Field><div className={styles.flowInputHint}>仅填写有计量、检修记录或工艺依据的损失；没有确认依据时无需估算，保持为空即可。</div></div></div></div>
      <div className={styles.conversionRemark}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></div>
    </>}
    {error && <div className={styles.error}>{error}</div>}
    </>}
    </fieldset>
  </Modal>;
}

function OperationsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  const returnToIntensity = () => {
    if (returnTo?.startsWith('/energy-analysis/intensity')) navigate(returnTo);
  };
  const requestedScopeLevel = params.get('scopeLevel');
  const requestedScope = requestedScopeLevel === '一级用能单元' || requestedScopeLevel === '二级用能单元' ? requestedScopeLevel : undefined;
  const requestedUnitId = params.get('unitId') ?? '';
  const requestedMetricName = params.get('metricName') ?? undefined;
  const requestedCategory = params.get('category') === '经济指标' || params.get('category') === '运行指标' ? params.get('category') as '经济指标' | '运行指标' : undefined;
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
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [newMetricPreset, setNewMetricPreset] = useState<{ category: V11OperationMetric['metricCategory']; metricName: string } | undefined>();
  const [editing, setEditing] = useState<V11OperationMetric | 'new' | null>(() => {
    const recordId = params.get('recordId');
    if (recordId) return listV11OperationMetrics().find((record) => record.operationMetricId === recordId) ?? null;
    return params.get('new') === '1' ? 'new' : null;
  });
  const [deleting, setDeleting] = useState<V11OperationMetric | null>(null);
  const [allocationEditing, setAllocationEditing] = useState<ProductMaster | null>(null);
  const products = listProducts();
  const productNames = new Map(products.map((product) => [product.productId, product.productName]));
  const matchesFilters = (item: V11OperationMetric) => item.year === Number(filters.year)
    && (!filters.category || item.metricCategory === filters.category)
    && (!filters.keyword || `${v11ScopeName(item.energyUnitId)}${item.metricName}${item.productId ? productNames.get(item.productId) ?? '' : ''}`.includes(filters.keyword));
  const operationRecords = listV11OperationMetrics();
  const units = listEnergyUnits();
  const rows = operationRecords.filter((item) => matchesFilters(item) && (level === '全部层级' || item.scopeLevel === level));
  const scopedUnits = (level === '一级用能单元' || level === '二级用能单元')
    ? units.filter((unit) => unit.unitLevel === (level === '一级用能单元' ? 'level1' : 'level2'))
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
      const group = groupMap.get(scopeKey) ?? { scopeKey, scopeName: scopeLevel === '企业' ? '全厂' : v11ScopeName(row.energyUnitId), depth: scopeLevel === '企业' ? 0 : scopeLevel === '一级用能单元' ? 1 : 2, rows: [] };
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
          return [<tr className={styles.scopeRecordRow} key={row.operationMetricId}><td><div className={styles.scopeChild}><span>└─ {row.metricName}</span></div></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} viewLabel="月度明细" onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} extra={row.productId ? <button type="button" onClick={() => { const product = products.find((item) => item.productId === row.productId); if (product) setAllocationEditing(product); }}>配置分配</button> : undefined} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
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
        <td className={styles.scopeGroupActionCell}><button type="button" className={styles.scopeAddButton} onClick={() => { setNewScopeLevel(level as ScopeLevel); setNewUnitId(unit.energyUnitId); setNewMetricPreset(metricPresetForUnit(unit)); setEditing('new'); }}>＋ 新增运营数据</button></td>
      </tr>,
      ...(unitRows.length ? unitRows.flatMap((row) => {
        const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
        return [<tr key={row.operationMetricId}><td><div className={styles.scopeChild}><span>└─ {row.metricName}</span></div></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} viewLabel="月度明细" onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} extra={row.productId ? <button type="button" onClick={() => { const product = products.find((item) => item.productId === row.productId); if (product) setAllocationEditing(product); }}>配置分配</button> : undefined} /></td></tr>, detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
      }) : [<tr key={`${unit.energyUnitId}-empty`}><td colSpan={7} className={styles.emptyRow}>暂无运营数据</td></tr>]),
    ];
  };
  void version;
  return <Page toast={toast}><section className={styles.card}>
      <Toolbar actions={<><Button primary onClick={() => setFilters({ year: yearInput, category: categoryInput, keyword: keywordInput.trim() })}>查询</Button><Button onClick={() => { setYearInput('2026'); setCategoryInput(''); setKeywordInput(''); setLevel('全部层级'); setFilters({ year: '2026', category: '', keyword: '' }); }}>重置</Button>{returnTo && <Button onClick={returnToIntensity}>返回能耗指标</Button>}{level === '企业' && <Button primary onClick={() => { setNewScopeLevel('企业'); setNewUnitId(''); setEditing('new'); }}>＋ 新增运营数据</Button>}{level === '全部层级' && <span className={styles.entryHint}>层级总览仅用于只读核查，请切换至具体层级后维护数据</span>}</>}>
      <Field label="年度"><select value={yearInput} onChange={(event) => setYearInput(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="指标类别"><select value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}><option value="">全部</option><option>产量</option><option>运行指标</option><option>经济指标</option></select></Field>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="产品 / 归属范围 / 指标名称" /></Field>
    </Toolbar>
    <div className={styles.levelTabs}>{operationLevels.map((item) => <button type="button" key={item} className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{scopeViewLabel(item)}{item === '企业' && <span className={styles.requiredMark}>必填</span>}（{countForLevel(item)}）</button>)}</div>
    <Notice><strong>说明：</strong>产量和运行指标可在企业、一级或二级用能单元层级维护；经济指标仅在企业层级维护。“层级总览”用于跨层级只读核查，不提供录入入口。</Notice>
     <div className={styles.tableWrap}><table><thead><tr><th>归属范围</th><th>指标类别</th><th>指标名称</th><th>产品</th><th>单位</th><th>年度值</th><th>操作</th></tr></thead><tbody>{level === '全部层级' ? (overviewGroups.length ? overviewGroups : <EmptyRow colSpan={7} />) : level === '一级用能单元' || level === '二级用能单元' ? scopedUnits.flatMap(renderScopedUnitRows) : rows.length ? rows.flatMap((row) => {
      const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
      return [<tr key={row.operationMetricId}><td className={styles.strong}>{v11ScopeName(row.energyUnitId)}<small className={styles.subText}>{row.scopeLevel}</small></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} viewLabel="月度明细" onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} extra={row.productId ? <button type="button" onClick={() => { const product = products.find((item) => item.productId === row.productId); if (product) setAllocationEditing(product); }}>配置分配</button> : undefined} /></td></tr>,
      detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
    }) : <EmptyRow colSpan={7} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <OperationDialog item={editing === 'new' ? undefined : editing} dataYear={Number(filters.year)} scopeContext={editing === 'new' ? newScopeLevel ?? undefined : undefined} initialUnitId={editing === 'new' ? newUnitId : undefined} initialCategory={editing === 'new' ? newMetricPreset?.category : requestedCategory} initialMetricName={editing === 'new' ? newMetricPreset?.metricName : requestedMetricName} onClose={() => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); setNewMetricPreset(undefined); if (returnTo) returnToIntensity(); }} onSaved={(message) => { setEditing(null); setNewScopeLevel(null); setNewUnitId(''); setNewMetricPreset(undefined); setVersion((value) => value + 1); if (returnTo) returnToIntensity(); else notify(message); }} />}
   {deleting && <Modal title="删除运营数据" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11OperationMetric(deleting.operationMetricId); setDeleting(null); setVersion((value) => value + 1); notify('运营数据已删除，相关分析将按最新数据重新计算'); }}><div className={styles.warning}>确认删除“{deleting.metricName}”数据吗？</div></Modal>}
   {allocationEditing && <ProductAllocationDialog product={allocationEditing} year={Number(filters.year)} onClose={() => setAllocationEditing(null)} onSaved={() => { setAllocationEditing(null); setVersion((value) => value + 1); notify('产品能源分配已保存，相关能耗指标将重新计算'); }} />}
  </Page>;
}

function ProductAllocationDialog({ product, year, onClose, onSaved }: { product: ProductMaster; year: number; onClose: () => void; onSaved: () => void }) {
  const products = listProducts().filter((item) => item.status === 'active');
  const units = listEnergyUnits().filter((unit) => product.linkedEnergyUnitIds.includes(unit.energyUnitId));
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
      updateProductAllocation(item.productId, hasSharedUnit ? 'ratio' : 'exclusive', energyAllocations);
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

function OperationDialog({ item, dataYear, scopeContext, initialUnitId, initialCategory, initialMetricName, onClose, onSaved }: { item?: V11OperationMetric; dataYear: number; scopeContext?: ScopeLevel; initialUnitId?: string; initialCategory?: V11OperationMetric['metricCategory']; initialMetricName?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const products = listProducts();
  const officeScopedCreation = !item && initialUnitId === 'eu-office';
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const categoryValue = officeScopedCreation ? '运行指标' : item?.metricCategory ?? initialCategory ?? '产量';
  const initialMetricPreset = item
    ? metricPresets[item.metricCategory].find((entry) => entry[0] === item.metricName)
    : metricPresets[categoryValue].find((entry) => entry[0] === (officeScopedCreation ? '办公建筑面积' : initialMetricName));
  const scopedCreation = !item && !!scopeContext;
  const linkedEntry = !item && Boolean(initialCategory && initialMetricName);
  const lockedMetricDefinition = Boolean(item) || linkedEntry || officeScopedCreation;
  const lockedOwnership = scopedCreation || Boolean(item) || linkedEntry;
  const [category, setCategory] = useState<V11OperationMetric['metricCategory']>(categoryValue);
  const [preset, setPreset] = useState(item ? initialMetricPreset?.[0] ?? '' : officeScopedCreation ? '办公建筑面积' : initialMetricName ?? (categoryValue === '产量' ? '产品产量' : ''));
  const [productId, setProductId] = useState(item?.productId ?? '');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('通用工业产品');
  const [newProductUnit, setNewProductUnit] = useState('t');
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(item?.scopeLevel ?? scopeContext ?? '企业');
  const [unitId, setUnitId] = useState(item ? item.energyUnitId ?? '__enterprise__' : initialUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : '');
  const [metricUnit, setMetricUnit] = useState(item?.metricUnit ?? initialMetricPreset?.[1] ?? '');
  const [values, setValues] = useState<string[]>(item?.monthlyValues.map(String) ?? Array(12).fill(''));
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
  const levelOneUnits = units.filter((unit) => unit.unitLevel === 'level1');
  const availableUnits = scopeLevel === '一级用能单元'
    ? levelOneUnits
    : units.filter((unit) => unit.unitLevel === 'level2' && unit.parentEnergyUnitId === parentUnitId);
  const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
  const recordYear = item?.year ?? dataYear;
  return <Modal title={item ? '编辑运营数据' : `新增运营数据（${recordYear}年度）`} width={820} onClose={onClose} onSubmit={() => {
    const officeUnit = unitId === 'eu-office';
    const name = productOutput ? '产品产量' : officeUnit ? '办公建筑面积' : preset;
    if (!name || !metricUnit || (!annualMode && !enterpriseScope && !unitId) || (productOutput && !productId)) return setError('请完整填写必填字段。');
    const monthNumbers = values.map((value) => Number(value || 0));
    if (fixedAnnualMetric && !(Number(annualValue) > 0)) return setError('请填写办公建筑面积年度值。');
    if (!fixedAnnualMetric) {
      if (!monthNumbers.some((value) => value > 0) && !(Number(annualValue) > 0)) return setError('月度数据或年度汇总数据至少填写一项。');
      if (!monthlyComplete && !(Number(annualValue) > 0)) return setError('月度数据不完整时，请填写年度汇总数据。');
    }
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
      : item?.metricCode ?? metricCodes[name] ?? name;
    const result = saveV11OperationMetric({ year: recordYear, scopeLevel: fixedAnnualMetric || enterpriseMetric ? '企业' : selectedUnit?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元', energyUnitId: fixedAnnualMetric || enterpriseMetric || enterpriseScope ? null : unitId, metricCategory: category, aggregationMethod: fixedAnnualMetric ? '年度单值' : '月度求和', metricCode, productId: resolvedProductId, metricName: name, metricUnit, entryMode: fixedAnnualMetric ? 'annual' : 'monthly', monthlyValues: fixedAnnualMetric ? [] : monthNumbers, monthlyReportedMonths: fixedAnnualMetric ? undefined : values.map((value) => value.trim() !== ''), annualValue: fixedAnnualMetric ? Number(annualValue) : monthlyComplete ? monthlyTotal : Number(annualValue) }, item?.operationMetricId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '运营数据已更新' : '运营数据已新增');
  }}><div className={`${styles.formGrid} ${styles.operationFormGrid} ${linkedEntry ? styles.linkedOperationForm : ''}`}>
    <div className={styles.contextStrip}><span>数据年度 <strong>{recordYear}年</strong></span>{lockedOwnership && <>{scopeLevel === '企业' ? <><span>归属层级 <strong>企业</strong></span><span>归属范围 <strong>全厂</strong></span></> : <><span>归属层级 <strong>{scopeLevel}</strong></span>{scopeLevel === '二级用能单元' && <span>所属一级 <strong>{v11ScopeName(parentUnitId)}</strong></span>}<span>归属范围 <strong>{selectedUnit?.energyUnitName ?? '—'}</strong></span></>}</>}</div>
    <Field label="指标类别" required>{lockedMetricDefinition ? <div className={styles.readonlyControl}><strong>{category}</strong></div> : allowEconomicMetric ? <select value={category} onChange={(event) => { const next = event.target.value as V11OperationMetric['metricCategory']; setCategory(next); setPreset(''); setProductId(''); setMetricUnit(''); if (next === '经济指标') { setScopeLevel('企业'); setUnitId(''); setParentUnitId(''); } }}><option>产量</option><option>运行指标</option><option>经济指标</option></select> : <input value="产量" readOnly />}</Field>
    {category === '产量' ? <div className={styles.readonlyInfo}><span>指标名称</span><strong>产品产量</strong></div> : lockedMetricDefinition ? <Field label="指标名称" required><div className={`${styles.readonlyControl} ${linkedEntry ? styles.linkedMetricName : ''}`}><strong>{preset}</strong></div></Field> : <Field label="指标名称" required><select value={preset} onChange={(event) => { const value = event.target.value; setPreset(value); const option = metricPresets[category].find((entry) => entry[0] === value); if (option) setMetricUnit(option[1]); }}><option value="">请选择指标</option>{metricPresets[category].map(([name]) => <option key={name}>{name}</option>)}</select></Field>}
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
    {productOutput && productId !== '__new__' && <div className={styles.readonlyInfo}><span>计量单位</span><strong>{metricUnit || '选择产品后自动带出'}</strong></div>}
    {!lockedOwnership && !annualMode && !enterpriseMetric && <><Field label="归属层级" required><select aria-label="运营数据归属层级" value={scopeLevel} onChange={(event) => { const next = event.target.value as ScopeLevel; setScopeLevel(next); setUnitId(''); setParentUnitId(''); }}><option>企业</option><option>一级用能单元</option><option>二级用能单元</option></select></Field>
    {scopeLevel === '二级用能单元' && !annualMode && !enterpriseMetric && <Field label="所属一级用能单元" required><select aria-label="运营数据所属一级用能单元" value={parentUnitId} onChange={(event) => { setParentUnitId(event.target.value); setUnitId(''); }}><option value="">请先选择所属一级用能单元</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
    {!lockedOwnership && !annualMode && !enterpriseMetric && <>{scopeLevel === '企业' ? <div className={styles.readonlyInfo}><span>归属范围</span><strong>全厂</strong></div> : <Field label="归属范围" required><select aria-label="运营数据归属范围" disabled={scopeLevel === '二级用能单元' && !parentUnitId} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{scopeLevel === '二级用能单元' && !parentUnitId ? '请先选择所属一级用能单元' : '请选择归属范围'}</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}</>}
    </>}
    <div className={styles.helpText}>{fixedAnnualMetric ? '办公建筑面积按年度静态基数填报，不设置月度数据。' : `本项数据采用${metricUnit || '选择指标后自动带出'}计量，按月度填报。月度数据不完整时，必须补录年度汇总数据；月度完整时年度合计自动计算。`}</div>
    {fixedAnnualMetric ? <div className={styles.full}><Field label="办公建筑面积（m²）" required><input type="number" min="0" value={annualValue} placeholder="请输入年度办公建筑面积" onChange={(event) => setAnnualValue(event.target.value)} /></Field></div> : <><div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div><div className={styles.full}><Field label={`${monthlyComplete ? '年度合计' : '年度汇总补录'}（${metricUnit || '计量单位'}）`} required={!monthlyComplete}><input type="number" min="0" value={monthlyComplete ? String(monthlyTotal) : annualValue} readOnly={monthlyComplete} placeholder={monthlyComplete ? '' : '月度不完整时填写年度汇总'} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div></>}
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
  const [editing, setEditing] = useState<V11KeyDevice | 'new' | DeviceDialogPreset | null>(null);
  const [deleting, setDeleting] = useState<V11KeyDevice | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<V11KeyDevice | null>(null);
  const [collapsedLevelOneIds, setCollapsedLevelOneIds] = useState<string[]>([]);
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const currentYear = new Date().getFullYear();
  const deviceEnergyRecords = listV11EnergyRecords().filter((record) => record.year === currentYear && v11RecordScopeType(record) === 'device');
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
      const childGroups = children.map((unit) => ({ unit, devices: rows.filter((device) => device.energyUnitId === unit.energyUnitId) }));
      return {
        unit: levelOneUnit,
        directDevices,
        childGroups,
      };
    }).filter((group) => !filters.levelOneUnitId || group.unit.energyUnitId === filters.levelOneUnitId);
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
    const energyRecords = deviceEnergyRecords.filter((record) => record.scopeId === row.deviceId);
    const energyType = types.find((type) => type.energyTypeId === row.mainEnergyTypeId);
    const annualEnergy = energyRecords.reduce((total, record) => total + annual(record.monthlyAmounts, record.annualAmount), 0);
    const requestDelete = () => {
      const inspection = inspectV11KeyDeviceDeletion(row.deviceId);
      if (!inspection.ok) return setDeleteBlocked(row);
      setDeleting(row);
    };
    const ownership = units.find((unit) => unit.energyUnitId === row.energyUnitId)?.energyUnitName ?? '—';
    return <tr className={styles.deviceRow} key={row.deviceId}>
      <td><div className={styles.deviceNameCell}><span className={styles.deviceName}>{row.deviceName}</span></div></td>
      <td>{ownership}</td>
      <td><span className={styles.deviceTypeText}>{row.deviceType}</span></td>
      <td><Tag tone="blue">{energyType?.energyTypeName}</Tag></td>
      <td className={styles.number}><span className={styles.deviceEnergyValue}>{energyRecords.length ? <><strong>{format(annualEnergy, 2)}</strong><small>{energyType?.measurementUnit ?? ''}</small></> : '—'}</span></td>
      <td><div className={styles.actions}><button type="button" onClick={() => setEditing(row)}>编辑</button><button type="button" onClick={() => navigate(`/data-management/energy-data?scope=device&deviceId=${row.deviceId}`)}>查看</button><button type="button" className={styles.danger} onClick={requestDelete}>删除</button></div></td>
    </tr>;
  };

  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<><Button primary onClick={() => setFilters({ keyword: keywordInput.trim(), levelOneUnitId: levelOneUnitIdInput, unitId: unitIdInput, category: categoryInput, typeId: typeIdInput })}>查询</Button><Button onClick={() => { setKeywordInput(''); setLevelOneUnitIdInput(''); setUnitIdInput(''); setCategoryInput(''); setTypeIdInput(''); setFilters({ keyword: '', levelOneUnitId: '', unitId: '', category: '', typeId: '' }); }}>重置</Button></>}>
      <Field label="关键字"><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="设备名称 / 设备类型" /></Field>
      <Field label="一级用能单元"><select value={levelOneUnitIdInput} onChange={(event) => { setLevelOneUnitIdInput(event.target.value); setUnitIdInput(''); }}><option value="">全部</option>{levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      {levelOneUnitIdInput && <Field label="具体用能单元"><select value={unitIdInput} onChange={(event) => setUnitIdInput(event.target.value)}><option value="">全部</option>{childUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>}
      <Field label="能源分析类别"><select value={categoryInput} onChange={(event) => { setCategoryInput(event.target.value as AnalysisCategory | ''); setTypeIdInput(''); }}><option value="">全部</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
      {categoryInput && <Field label="主要能源品种"><select value={typeIdInput} onChange={(event) => setTypeIdInput(event.target.value)}><option value="">全部</option>{categoryTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>}
    </Toolbar>
    <Notice><strong>说明：</strong>设备按归属单元平铺展示；点击“查看”进入对应能源数据。</Notice>
    <div className={styles.tableWrap}><table className={styles.deviceTable}><thead><tr><th>重点设备</th><th>归属单元</th><th>设备类型</th><th>主要能源品种</th><th>年度能源量</th><th>操作</th></tr></thead><tbody>{groupedRows.length ? groupedRows.flatMap((group) => {
      const collapsed = collapsedLevelOneIds.includes(group.unit.energyUnitId);
      const toggle = () => setCollapsedLevelOneIds((current) => current.includes(group.unit.energyUnitId) ? current.filter((id) => id !== group.unit.energyUnitId) : [...current, group.unit.energyUnitId]);
      const groupDevices = [...group.directDevices, ...group.childGroups.flatMap((childGroup) => childGroup.devices)];
      return [<tr className={styles.deviceLevelOneRow} key={`level-one-${group.unit.energyUnitId}`}><td colSpan={6}><div className={styles.deviceLevelOneNode}><button type="button" aria-label={`${collapsed ? '展开' : '收起'}${group.unit.energyUnitName}`} className={styles.deviceToggle} onClick={toggle}>{collapsed ? '+' : '−'}</button><b>{group.unit.energyUnitName}</b><button type="button" className={`${styles.deviceAddButton} ${styles.deviceLevelOneAddButton}`} onClick={() => setEditing({ rootUnitId: group.unit.energyUnitId })}>＋ 新增设备</button></div></td></tr>,
        ...(!collapsed ? [
          ...groupDevices.map((row) => renderDeviceRow(row)),
        ] : []),
      ];
    }) : <EmptyRow colSpan={6} />}</tbody></table></div>
    <Pagination count={rows.length} />
  </section>
  {editing && <DeviceDialog item={editing !== 'new' && !('rootUnitId' in editing) ? editing : undefined} dialogPreset={editing !== 'new' && 'rootUnitId' in editing ? editing : undefined} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
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
  }}><div className={styles.warning}>确认删除重点设备“{deleting.deviceName}”吗？</div></Modal>}
  </Page>;
}

type DeviceDialogPreset = { rootUnitId: string };

function DeviceDialog({ item, dialogPreset, onClose, onSaved }: { item?: V11KeyDevice; dialogPreset?: DeviceDialogPreset; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const initialUnit = units.find((unit) => unit.energyUnitId === item?.energyUnitId);
  const initialPreset = deviceTypePresets.includes(item?.deviceType ?? '') ? item?.deviceType ?? '' : item ? '其他（自定义）' : '';
  const [scopeLevel, setScopeLevel] = useState<'一级用能单元' | '二级用能单元'>(dialogPreset ? '二级用能单元' : initialUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [parentUnitId, setParentUnitId] = useState(dialogPreset?.rootUnitId ?? (initialUnit?.unitLevel === 'level2' ? initialUnit.parentEnergyUnitId ?? '' : ''));
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
  const lockedOwnership = Boolean(item);
  const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
  const selectedParentUnit = units.find((unit) => unit.energyUnitId === parentUnitId);
  const hasRootContext = Boolean(dialogPreset);
  return <Modal title={item ? '编辑重点设备档案' : '新增重点设备'} width={720} submitText="保存设备" onClose={onClose} onSubmit={() => {
    const deviceType = preset === '其他（自定义）' ? customType.trim() : preset;
    const resolvedUnitId = hasRootContext && scopeLevel === '一级用能单元' ? parentUnitId : unitId;
    if (!resolvedUnitId || !deviceType || !name.trim() || !typeId) return setError('请完整填写设备名称、设备类型、主要能源品种和归属用能单元。');
    const result = saveV11KeyDevice({ energyUnitId: resolvedUnitId, deviceType, deviceName: name.trim(), mainEnergyTypeId: typeId, remark }, item?.deviceId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '重点设备已更新' : '重点设备已新增');
  }}><div className={styles.deviceForm}>
    {(lockedOwnership || hasRootContext) && <div className={styles.contextStrip}>
      {hasRootContext && <span>所属一级用能单元 <strong>{selectedParentUnit?.energyUnitName ?? '—'}</strong></span>}
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
        <Field label="主要能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择主要能源品种</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
      </div>
    </section>
    {!lockedOwnership && <section className={styles.deviceFormSection}>
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
