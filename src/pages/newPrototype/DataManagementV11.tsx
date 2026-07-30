import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  deleteV11ConversionOutput,
  deleteV11EnergyCost,
  deleteV11EnergyRecord,
  deleteV11EnergyType,
  deleteV11KeyDevice,
  deleteV11OperationMetric,
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
const deviceTypePresets = ['动力设备', '泵类', '风机', '空压设备', '制冷/空调设备', '加热/锅炉设备', '输送设备', '其他（自定义）'];
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
  return values.length ? values.reduce((sum, value) => sum + value, 0) : fallback;
}
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
function Actions({ onView, onEdit, onDelete }: { onView?: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className={styles.actions}>{onView && <button type="button" onClick={onView}>查看</button>}<button type="button" onClick={onEdit}>编辑</button><button type="button" className={styles.danger} onClick={onDelete}>删除</button></div>;
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
function Pagination({ count }: { count: number }) {
  return <div className={styles.pagination}><span>共 {count} 条</span><span className={styles.pageDot}>1</span></div>;
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
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<V11EnergyType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyType | null>(null);
  const rows = listV11EnergyTypes().filter((item) => (!keyword || item.energyTypeName.includes(keyword)) && (!category || item.analysisCategory === category));
  void version;
  return <Page toast={toast}>
    <section className={styles.card}>
      <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增能源品种</Button>}>
        <Field label="关键字"><input aria-label="关键字" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索能源品种名称" /></Field>
        <Field label="分析类别"><select aria-label="分析类别" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </Toolbar>
      <Notice><strong>说明：</strong>分析类别用于能耗查询和结构汇总；能源品种只维护基础属性，能源转换、回收利用和外部输出统一在“能源转换与输出”中维护。</Notice>
      <div className={styles.tableWrap}><table><thead><tr><th>分析类别</th><th>能源品种</th><th>计量单位</th><th>折标系数</th><th>折标单位</th><th className={styles.operationColumn}>操作</th></tr></thead>
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
    <Field label="分析类别" required><select value={category} onChange={(event) => { const next = event.target.value as AnalysisCategory; setCategory(next); setPreset(''); setUnit(''); setFactor(''); setFactorUnit(''); }}>{categories.map((value) => <option key={value}>{value}</option>)}</select></Field>
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
  const deviceEntry = params.get('scope') === 'device';
  const [version, setVersion] = useState(0);
  const [level, setLevel] = useState<'全部层级' | EnergyScopeView>(deviceEntry ? '重点设备' : '全部层级');
  const [year, setYear] = useState('2026');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11EnergyRecord | 'new' | null>(deviceEntry && params.get('new') === '1' ? 'new' : null);
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
  const allowedCategories = categories.filter((item) => item !== '回收能源');
  const rows = records.filter((item) => item.energyRole === '能源消费' && item.year === Number(year)
    && (level === '全部层级'
      ? true
      : level === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === level)
    && (!linkedDeviceId || level !== '重点设备' || item.scopeId === linkedDeviceId)
    && (!category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === category)
    && (!keyword || `${v11RecordScopeType(item) === 'device' ? devices.find((device) => device.deviceId === item.scopeId)?.deviceName ?? '' : v11ScopeName(item.energyUnitId)}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(keyword)))
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
  void version;
  const countForLevel = (value: '全部层级' | EnergyScopeView) => records.filter((item) =>
    item.energyRole === '能源消费'
    && (value === '全部层级'
      ? true
      : value === '重点设备'
        ? v11RecordScopeType(item) === 'device'
        : v11RecordScopeType(item) !== 'device' && item.scopeLevel === value)).length;
  return <Page toast={toast}>
    <section className={styles.card}>
      <EnergyDataTabs active="quantity" />
      <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增能源数据</Button>}>
        <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
        <Field label="分析类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{allowedCategories.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={level === '重点设备' ? '重点设备 / 能源品种' : '用能单元 / 能源品种'} /></Field>
      </Toolbar>
      <div className={styles.levelTabs}>{levels.map((item) => <button key={item} type="button" className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{item}（{countForLevel(item)}）</button>)}</div>
      <Notice>{level === '重点设备'
        ? <><strong>重点设备能源数据：</strong>设备数据用于设备用能分析和能效对标，是所属用能单元能源量的明细拆分，不重复增加企业或用能单元总能耗。</>
        : <><strong>能源量数据：</strong>企业级记录用于边界总量控制，一级和二级用能单元按实际计量条件分别录入。系统依据归属层级自动识别能源输入、分配和利用阶段；回收、产出及外供不在此处重复维护。</>}</Notice>
      {level === '重点设备' ? <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>分析类别</th><th>能源品种</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{rows.length ? rows.flatMap((row) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const device = devices.find((item) => item.deviceId === row.scopeId);
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          return [<tr key={row.energyRecordId}><td className={styles.strong}>{device?.deviceName ?? '设备档案已移除'}</td><td>{v11ScopeName(device?.energyUnitId ?? row.energyUnitId)}</td><td>{device?.deviceType ?? '—'}</td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{row.entryMode === 'monthly' ? `${row.monthlyAmounts.filter((value) => value > 0).length}/12月` : '年度已填报'}</td><td className={styles.number}>{format(total, 2)} {type?.measurementUnit}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={8}><MonthDetail values={row.monthlyAmounts} annualValue={total} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={8} />}</tbody>
      </table></div> : <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>归属范围</th><th>归属层级</th><th>能流阶段</th><th>分析类别</th><th>能源品种</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{rows.length ? rows.flatMap((row, index) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const scopeType = v11RecordScopeType(row);
          const unit = row.energyUnitId ? unitById.get(row.energyUnitId) : null;
          const device = scopeType === 'device' ? devices.find((item) => item.deviceId === row.scopeId) : null;
          const scopeName = scopeType === 'device' ? device?.deviceName ?? '设备档案已移除' : v11ScopeName(row.energyUnitId);
          const scopeLevel = scopeType === 'device' ? '重点设备' : row.scopeLevel;
          const depth = scopeType === 'enterprise' ? 0 : scopeType === 'device' ? (unit?.unitLevel === 'level1' ? 2 : 3) : unit?.unitLevel === 'level1' ? 1 : 2;
          const currentScopeKey = scopeType === 'device' ? `device:${row.scopeId}` : `${scopeType}:${row.energyUnitId ?? 'enterprise'}`;
          const previous = rows[index - 1];
          const previousScopeType = previous ? v11RecordScopeType(previous) : null;
          const previousScopeKey = previous
            ? previousScopeType === 'device' ? `device:${previous.scopeId}` : `${previousScopeType}:${previous.energyUnitId ?? 'enterprise'}`
            : '';
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          return [<tr className={currentScopeKey !== previousScopeKey ? styles.scopeGroupStart : ''} key={row.energyRecordId}><td><div className={`${styles.scopeCell} ${styles[`scopeDepth${depth}`]}`}><i /><span><b>{scopeName}</b>{device && <small>所属：{v11ScopeName(device.energyUnitId)}</small>}</span></div></td><td>{scopeLevel}</td><td><span className={styles.stagePill}>{energyStage(row)}</span></td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{type?.measurementUnit}</td><td>{row.entryMode === 'monthly' ? `${row.monthlyAmounts.filter((value) => value > 0).length}/12月` : '年度已填报'}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={9}><MonthDetail values={row.monthlyAmounts} annualValue={total} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={9} />}</tbody>
      </table></div>}
      <Pagination count={rows.length} />
    </section>
    {editing && <EnergyRecordDialog item={editing === 'new' ? undefined : editing} initialScopeLevel={level === '重点设备' ? '重点设备' : undefined} initialDeviceId={linkedDeviceId} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
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
function MonthDetail({ values, annualValue, unit }: { values: number[]; annualValue: number; unit: string }) {
  return <div className={styles.detailPanel}><div className={styles.detailHead}><span>月度明细</span><span>计量单位：{unit}</span></div><div className={styles.monthDetailGrid}>{months.map((month, index) => <div key={month}><span>{month}</span><strong>{values[index] === undefined ? '—' : format(values[index], 2)}</strong></div>)}</div><div className={styles.summaryLine}>年度合计 <strong>{format(annualValue, 2)}</strong> {unit}</div></div>;
}

function EnergyRecordDialog({ item, initialScopeLevel, initialDeviceId = '', onClose, onSaved }: { item?: V11EnergyRecord; initialScopeLevel?: EnergyScopeView; initialDeviceId?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const devices = listV11KeyDevices();
  const [level, setLevel] = useState<EnergyScopeView>(item && v11RecordScopeType(item) === 'device' ? '重点设备' : item?.scopeLevel ?? initialScopeLevel ?? '企业');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [deviceId, setDeviceId] = useState(item?.scopeType === 'device' ? item.scopeId ?? '' : initialDeviceId);
  const initialDevice = devices.find((device) => device.deviceId === (item?.scopeType === 'device' ? item.scopeId : initialDeviceId));
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? initialDevice?.mainEnergyTypeId ?? '');
  const [entryMode, setEntryMode] = useState<'monthly' | 'annual'>(item?.entryMode ?? 'monthly');
  const [values, setValues] = useState<string[]>(item?.monthlyAmounts.map(String) ?? Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualAmount || ''));
  const [error, setError] = useState('');
  const type = types.find((value) => value.energyTypeId === typeId);
  const device = devices.find((value) => value.deviceId === deviceId);
  const deviceUnit = units.find((unit) => unit.energyUnitId === device?.energyUnitId);
  const persistedScopeLevel: ScopeLevel = level === '重点设备'
    ? deviceUnit?.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'
    : level;
  const availableUnits = units.filter((unit) => level === '一级用能单元' ? unit.unitLevel === 'level1' : unit.unitLevel === 'level2');
  const effectiveUnitId = level === '企业' ? null : level === '重点设备' ? device?.energyUnitId ?? null : unitId;
  const scopeType = level === '企业' ? 'enterprise' : level === '重点设备' ? 'device' : 'energyUnit';
  const scopeId = scopeType === 'enterprise' ? null : scopeType === 'device' ? deviceId : effectiveUnitId;
  const recordPreview: V11EnergyRecord = { energyRecordId: '', year: 2026, energyRole: '能源消费', scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode, monthlyAmounts: [], annualAmount: 0 };
  return <Modal title={item ? '编辑能源数据' : '新增能源数据'} width={820} onClose={onClose} onSubmit={() => {
    const monthNumbers = values.map((value) => Number(value || 0));
    if ((level === '重点设备' ? !deviceId : level !== '企业' && !unitId) || !typeId) return setError('请选择归属范围和能源品种。');
    if (entryMode === 'monthly' && !monthNumbers.some((value) => value > 0)) return setError('月度填报至少填写一个月份。');
    if (entryMode === 'annual' && !(Number(annualValue) > 0)) return setError('请填写年度值。');
    const result = saveV11EnergyRecord({ year: 2026, energyRole: '能源消费', scopeLevel: persistedScopeLevel, scopeType, scopeId, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode, monthlyAmounts: entryMode === 'monthly' ? monthNumbers : [], annualAmount: entryMode === 'annual' ? Number(annualValue) : 0 }, item?.energyRecordId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源数据已更新' : '能源数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}><span>业务阶段 <strong>{energyStage(recordPreview)}</strong></span></div>
    <Field label="归属对象类型" required><select value={level} onChange={(event) => { setLevel(event.target.value as EnergyScopeView); setUnitId(''); setDeviceId(''); }}><option>企业</option><option>一级用能单元</option><option>二级用能单元</option><option>重点设备</option></select></Field>
    {level === '重点设备' ? <>
      <Field label="重点设备" required><select value={deviceId} onChange={(event) => { const id = event.target.value; const nextDevice = devices.find((value) => value.deviceId === id); setDeviceId(id); setTypeId(nextDevice?.mainEnergyTypeId ?? ''); }}><option value="">请选择重点设备</option>{devices.map((value) => <option key={value.deviceId} value={value.deviceId}>{value.deviceName}</option>)}</select></Field>
      <Field label="所属用能单元"><input value={v11ScopeName(device?.energyUnitId ?? null)} readOnly /></Field>
      <Field label="设备类型"><input value={device?.deviceType ?? '—'} readOnly /></Field>
    </> : <Field label="归属范围" required><select disabled={level === '企业'} value={level === '企业' ? '全厂' : unitId} onChange={(event) => setUnitId(event.target.value)}>{level === '企业' ? <option>全厂</option> : <><option value="">请选择用能单元</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select></Field>}
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{types.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field>
    <div className={styles.autoInfo}><span>分析类别 <strong>{type?.analysisCategory ?? '—'}</strong></span><span>计量单位 <strong>{type?.measurementUnit ?? '—'}</strong></span><span>归属对象 <strong>{level === '重点设备' ? device?.deviceName ?? '—' : level}</strong></span></div>
    <div className={styles.full}><span className={styles.formLabel}>录入方式</span><div className={styles.choices}><button type="button" className={entryMode === 'monthly' ? styles.choiceActive : ''} onClick={() => setEntryMode('monthly')}>月度填报</button><button type="button" className={entryMode === 'annual' ? styles.choiceActive : ''} onClick={() => setEntryMode('annual')}>年度填报</button></div></div>
    {entryMode === 'monthly' ? <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div> : <div className={styles.full}><Field label={`年度值${type ? `（${type.measurementUnit}）` : ''}`} required><input type="number" min="0" value={annualValue} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div>}
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

function supportsConversionType(
  conversionScene: string | null,
  recordType: ConversionOutputType,
) {
  if (!conversionScene) return false;
  if (recordType === '锅炉产汽/产热') return conversionScene === '锅炉产汽/产热';
  if (recordType === '余热发电' || recordType === '回收利用') {
    return conversionScene === '余能回收';
  }
  if (recordType === '其他转换') {
    return conversionScene === '电力转换/分配' || conversionScene === '其他转换';
  }
  return false;
}

function conversionBalance(item: V11ConversionOutput) {
  if (item.recordType === '直接外供') {
    const source = listV11EnergyRecords().find((record) => record.energyRecordId === item.inputEnergyRecordId);
    const ok = Boolean(source) && item.externalAmount <= annual(source?.monthlyAmounts ?? [], source?.annualAmount ?? 0);
    return { ok, text: ok ? '来源校验通过' : '来源数量异常', detail: ok ? '企业边界输出' : '请检查来源记录' };
  }
  const assigned = (item.internalAmount ?? 0) + item.externalAmount + (item.lossAmount ?? 0);
  const ok = Math.abs((item.outputAmount ?? 0) - assigned) < 1e-8;
  return { ok, text: ok ? '校验通过' : '数量不平衡', detail: ok ? '产出=内部+外供+未分配' : '请调整能源去向' };
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
    sub: `${v11ScopeName(item.recoverySourceEnergyUnitId ?? null)}｜${item.recoveryAmount == null ? '未计量来源量' : `${format(item.recoveryAmount, 2)} ${item.recoveryUnit ?? ''}`}`,
  };
}

function EnergyConversionOutputPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [year, setYear] = useState('2026');
  const [recordType, setRecordType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<V11ConversionOutput | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11ConversionOutput | null>(null);
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const rows = listV11ConversionOutputs().filter((item) =>
    item.year === Number(year)
    && (!recordType || item.recordType === recordType)
    && (!keyword || `${v11ScopeName(item.conversionEnergyUnitId)}${v11ScopeName(item.recoverySourceEnergyUnitId ?? null)}`.includes(keyword)),
  );
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <EnergyDataTabs active="relations" />
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增转换/输出记录</Button>}>
      <Field label="数据年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="记录类型"><select value={recordType} onChange={(event) => setRecordType(event.target.value)}><option value="">全部</option>{conversionOutputTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
      <Field label="转换/来源单元"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入单元名称" /></Field>
    </Toolbar>
    <Notice><strong>能源转换与输出：</strong>回收、产出、内部使用和外供在一条业务记录中维护。锅炉等燃料投入优先关联“能源量数据”中的已有记录，避免重复填写；余热、冷凝水等回收介质在本页维护。</Notice>
    <div className={styles.conversionGuide}>
      {conversionOutputTypes.slice(0, 5).map((type) => <div className={styles.conversionGuideCard} key={type}><strong>{type}</strong><span>{type === '锅炉产汽/产热' ? '关联锅炉已有燃料数据，填写蒸汽或热力产出及去向。' : type === '余热发电' ? '填写余热来源与发电量；余热量未计量时可留空。' : type === '自发电' ? '光伏、风电等无燃料投入发电，记录内部消纳与外供。' : type === '回收利用' ? '回收蒸汽、热水、冷凝水、压力能等直接利用场景。' : '仅用于非转换产出的能源直接离开企业边界；转换产出的外供量在原记录中填写。'}</span></div>)}
    </div>
    <div className={styles.sectionToolbar}><div><h3>能源转换与输出台账</h3><p>一条业务记录仅维护一次投入、产出和能源去向。</p></div><span>共 {rows.length} 条</span></div>
    <div className={styles.tableWrap}><table className={styles.conversionTable}><thead><tr><th>记录类型</th><th>转换/来源单元</th><th>投入或回收来源</th><th>产出/回收能源</th><th>内部使用</th><th>外供量</th><th>平衡结果</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => {
        const input = conversionInputText(row, records, types);
        const balance = conversionBalance(row);
        const source = records.find((record) => record.energyRecordId === row.inputEnergyRecordId);
        const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
        const outputName = row.recordType === '直接外供' ? sourceType?.energyTypeName ?? '外供能源' : row.outputEnergyName ?? types.find((type) => type.energyTypeId === row.outputEnergyTypeId)?.energyTypeName ?? '—';
        const outputUnit = row.recordType === '直接外供' ? sourceType?.measurementUnit ?? '' : row.outputUnit ?? '';
        const outputAmount = row.recordType === '直接外供' ? row.externalAmount : row.outputAmount ?? 0;
        return <tr key={row.conversionOutputId}><td><Tag tone={row.recordType === '自发电' ? 'orange' : row.recordType === '锅炉产汽/产热' ? 'blue' : row.recordType === '回收利用' ? 'gray' : 'green'}>{row.recordType === '锅炉产汽/产热' ? '锅炉产汽' : row.recordType}</Tag></td><td className={styles.strong}>{row.recordType === '直接外供' ? '企业边界' : v11ScopeName(row.conversionEnergyUnitId)}</td><td><b className={styles.conversionSourceMain}>{input.main}</b><small className={styles.subText}>{input.sub}</small></td><td><b className={styles.conversionSourceMain}>{outputName}</b><small className={styles.subText}><span className={styles.number}>{format(outputAmount, 2)}</span> {outputUnit}</small></td><td>{row.recordType === '直接外供' ? '—' : `${format(row.internalAmount ?? 0, 2)} ${outputUnit}`}</td><td>{format(row.externalAmount, 2)} {outputUnit}</td><td><div className={styles.conversionBalance}><Tag tone={balance.ok ? 'green' : 'orange'}>{balance.text}</Tag><small className={styles.subText}>{balance.detail}</small></div></td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>;
      }) : <EmptyRow colSpan={8} />}</tbody>
    </table></div><Pagination count={rows.length} />
  </section>
  {editing && <ConversionOutputDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除能源转换/输出记录" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11ConversionOutput(deleting.conversionOutputId); setDeleting(null); setVersion((value) => value + 1); notify('能源转换/输出记录已删除'); }}><div className={styles.warning}>确认删除该能源转换/输出记录吗？关联的能源量数据不会被删除。</div></Modal>}
  </Page>;
}

function ConversionOutputDialog({ item, onClose, onSaved }: { item?: V11ConversionOutput; onClose: () => void; onSaved: (message: string) => void }) {
  const navigate = useNavigate();
  const units = listEnergyUnits();
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const [recordType, setRecordType] = useState<ConversionOutputType>(item?.recordType ?? '锅炉产汽/产热');
  const [year, setYear] = useState(String(item?.year ?? 2026));
  const [unitId, setUnitId] = useState(item?.conversionEnergyUnitId ?? '');
  const [inputMode, setInputMode] = useState<ConversionInputMode>(item?.inputMode ?? 'linked');
  const [inputRecordId, setInputRecordId] = useState(item?.inputEnergyRecordId ?? '');
  const [inputCategory, setInputCategory] = useState<AnalysisCategory>(item?.inputAnalysisCategory ?? '化石燃料');
  const [inputEnergyTypeId, setInputEnergyTypeId] = useState(item?.inputEnergyTypeId ?? '');
  const [inputAmount, setInputAmount] = useState(String(item?.inputAmount ?? ''));
  const [inputUnit, setInputUnit] = useState(item?.inputUnit ?? '');
  const [recoverySourceId, setRecoverySourceId] = useState(item?.recoverySourceEnergyUnitId ?? 'eu-production-processing');
  const [recoveryEnergy, setRecoveryEnergy] = useState(item?.recoveryEnergyName ?? '余热');
  const [recoveryAmount, setRecoveryAmount] = useState(item?.recoveryAmount == null ? '' : String(item.recoveryAmount));
  const [recoveryUnit, setRecoveryUnit] = useState(item?.recoveryUnit ?? 'GJ');
  const [outputCategory, setOutputCategory] = useState<AnalysisCategory>(item?.outputAnalysisCategory ?? '热力');
  const [outputEnergyName, setOutputEnergyName] = useState(item?.outputEnergyName ?? '蒸汽');
  const [outputUnit, setOutputUnit] = useState(item?.outputUnit ?? 't');
  const [outputAmount, setOutputAmount] = useState(String(item?.outputAmount ?? 0));
  const [internalAmount, setInternalAmount] = useState(String(item?.internalAmount ?? 0));
  const [externalAmount, setExternalAmount] = useState(String(item?.externalAmount ?? 0));
  const [lossAmount, setLossAmount] = useState(String(item?.lossAmount ?? 0));
  const [receiver, setReceiver] = useState(item?.receiver ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const conversionUnits = recordType === '直接外供'
    ? []
    : units.filter((unit) => supportsConversionType(unit.conversionScene, recordType));
  const linkedCandidates = records.filter((record) => record.year === Number(year) && record.energyUnitId === unitId && (recordType !== '锅炉产汽/产热' || ['化石燃料', '可再生及替代能源'].includes(types.find((type) => type.energyTypeId === record.energyTypeId)?.analysisCategory ?? '')));
  const directCandidates = records.filter((record) => record.year === Number(year) && record.scopeLevel === '企业');
  const outputOptions = [
    ...types.filter((type) => type.analysisCategory === outputCategory).map((type) => type.energyTypeName),
    ...(outputCategory === '回收能源' ? ['冷凝水', '回收热水', '可燃尾气', '压力能'] : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const balanced = Math.abs(Number(outputAmount || 0) - Number(internalAmount || 0) - Number(externalAmount || 0) - Number(lossAmount || 0)) < 1e-8;
  const source = records.find((record) => record.energyRecordId === inputRecordId);
  const sourceType = types.find((type) => type.energyTypeId === source?.energyTypeId);
  const selectType = (next: ConversionOutputType) => {
    setRecordType(next);
    setError('');
    const candidates = units.filter((unit) => supportsConversionType(unit.conversionScene, next));
    setUnitId(next === '直接外供' ? '' : candidates[0]?.energyUnitId ?? '');
    setInputMode(next === '自发电' ? 'none' : next === '余热发电' || next === '回收利用' ? 'recovery' : next === '直接外供' ? 'direct' : 'linked');
    setInputRecordId('');
    const nextCategory: AnalysisCategory = next === '锅炉产汽/产热' ? '热力' : next === '余热发电' || next === '自发电' ? '电力' : next === '回收利用' ? '回收能源' : '电力';
    const nextName = next === '锅炉产汽/产热' ? '蒸汽' : next === '余热发电' || next === '自发电' ? '电力' : next === '回收利用' ? '回收热水' : '电力';
    setOutputCategory(nextCategory); setOutputEnergyName(nextName); setOutputUnit(next === '锅炉产汽/产热' ? 't' : next === '回收利用' ? 'GJ' : 'kWh');
  };
  const save = () => {
    setError('');
    if (recordType === '直接外供') {
      const directSource = records.find((record) => record.energyRecordId === inputRecordId);
      if (!directSource || Number(externalAmount) <= 0) return setError('请选择外供来源能源数据并填写外供量。');
      const result = saveV11ConversionOutput({ year: Number(year), recordType, conversionEnergyUnitId: null, inputMode: 'direct', inputEnergyRecordId: inputRecordId, externalAmount: Number(externalAmount), receiver, remark: '' }, item?.conversionOutputId);
      if (!result.ok) return setError(result.error);
      return onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
    }
    if (!unitId || Number(outputAmount) <= 0) return setError('请选择转换或来源单元，并填写产出或回收总量。');
    if (!balanced) return setError('产出总量与内部使用、外供及损失/未分配量不平衡。');
    if ((recordType === '锅炉产汽/产热' || recordType === '其他转换') && inputMode === 'linked' && !inputRecordId) return setError('请选择可用的能源量数据，或改为手工补充。');
    if ((recordType === '锅炉产汽/产热' || recordType === '其他转换') && inputMode === 'manual' && Number(inputAmount) <= 0) return setError('请完整填写手工投入能源及数量。');
    const outputType = types.find((type) => type.energyTypeName === outputEnergyName && type.analysisCategory === outputCategory);
    const result = saveV11ConversionOutput({
      year: Number(year), recordType, conversionEnergyUnitId: unitId, inputMode,
      inputEnergyRecordId: inputMode === 'linked' ? inputRecordId : undefined,
      inputAnalysisCategory: inputMode === 'manual' ? inputCategory : undefined,
      inputEnergyTypeId: inputMode === 'manual' ? inputEnergyTypeId : undefined,
      inputAmount: inputMode === 'manual' ? Number(inputAmount) : undefined,
      inputUnit: inputMode === 'manual' ? inputUnit : undefined,
      recoverySourceEnergyUnitId: inputMode === 'recovery' ? recoverySourceId : undefined,
      recoveryEnergyName: inputMode === 'recovery' ? recoveryEnergy : undefined,
      recoveryAmount: inputMode === 'recovery' ? recoveryAmount === '' ? null : Number(recoveryAmount) : undefined,
      recoveryUnit: inputMode === 'recovery' ? recoveryUnit : undefined,
      outputAnalysisCategory: outputCategory, outputEnergyTypeId: outputType?.energyTypeId, outputEnergyName, outputUnit,
      outputAmount: Number(outputAmount), internalAmount: Number(internalAmount), externalAmount: Number(externalAmount), lossAmount: Number(lossAmount), remark,
    }, item?.conversionOutputId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源转换/输出记录已更新' : '能源转换/输出记录已新增');
  };
  return <Modal title={item ? '编辑能源转换/输出记录' : '新增能源转换/输出记录'} width={1040} onClose={onClose} onSubmit={save}>
    <div className={styles.conversionModalIntro}><i>i</i><span>系统根据记录类型限制可选单元、能源品种和单位。锅炉等燃料投入优先关联已有能源量数据；回收介质可在本记录中直接填写。</span></div>
    <div className={styles.conversionSceneGrid}>{conversionOutputTypes.map((type) => <button type="button" key={type} className={recordType === type ? styles.sceneActive : ''} onClick={() => selectType(type)}><strong>{type}</strong><span>{conversionTypeCopy(type)}</span></button>)}</div>
    <div className={styles.compactGrid}>
      <Field label="数据年度" required><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label={recordType === '直接外供' ? '业务归属' : recordType === '自发电' ? '发电单元' : recordType === '回收利用' ? '回收系统' : '转换单元'} required><select disabled={recordType === '直接外供'} value={recordType === '直接外供' ? '企业边界' : unitId} onChange={(event) => { setUnitId(event.target.value); setInputRecordId(''); }}>{recordType === '直接外供' ? <option>企业边界</option> : <><option value="">请选择</option>{conversionUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select></Field>
      <Field label="数据归属"><input value="企业能源转换与输出台账" readOnly /></Field>
    </div>
    {recordType === '直接外供' ? <div className={styles.conversionFormSection}><h3>外供来源</h3><div className={`${styles.formGrid} ${styles.conversionFormBody}`}>
      <Field label="关联已有能源量数据" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择</option>{directCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{v11ScopeName(record.energyUnitId)}｜{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}</option>; })}</select></Field>
      <Field label="本次外供量" required><input type="number" min="0" value={externalAmount} onChange={(event) => setExternalAmount(event.target.value)} /></Field>
      <Field label="接收方"><input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="选填" /></Field>
      <div className={`${styles.sourceLocked} ${styles.full}`}>{source ? <>来源：<strong>{v11ScopeName(source.energyUnitId)}｜{sourceType?.energyTypeName}｜{format(annual(source.monthlyAmounts, source.annualAmount), 2)} {sourceType?.measurementUnit}</strong><br />直接外供仅关联企业级能源输入记录；转换产出的外供请在对应转换记录中填写。</> : '暂无可关联能源量数据，请先新增能源数据。'}</div>
    </div></div> : <>
      {(recordType === '锅炉产汽/产热' || recordType === '其他转换') && <div className={styles.conversionFormSection}><h3>投入能源</h3><div className={styles.conversionFormBody}>
        <div className={styles.conversionRadio}><label><input type="radio" checked={inputMode === 'linked'} onChange={() => setInputMode('linked')} />关联已有能源量数据</label><label><input type="radio" checked={inputMode === 'manual'} onChange={() => setInputMode('manual')} />手工补充（无基础计量记录时）</label></div>
        {inputMode === 'linked' ? <><Field label="关联能源记录" required><select value={inputRecordId} onChange={(event) => setInputRecordId(event.target.value)}><option value="">请选择已有能源数据</option>{linkedCandidates.map((record) => { const type = types.find((value) => value.energyTypeId === record.energyTypeId); return <option key={record.energyRecordId} value={record.energyRecordId}>{type?.energyTypeName}｜{format(annual(record.monthlyAmounts, record.annualAmount), 2)} {type?.measurementUnit}｜{v11ScopeName(record.energyUnitId)}</option>; })}</select></Field><div className={styles.inlineLinkRow}><span>仅显示当前年度、当前转换单元及适用能源类别的数据。</span><button type="button" onClick={() => { onClose(); navigate('/data-management/energy-data'); }}>未找到？前往新增能源数据</button></div><div className={styles.linkedPreview}>{source ? <>已关联：<strong>{source.year}年｜{v11ScopeName(source.energyUnitId)}｜{sourceType?.energyTypeName}｜{format(annual(source.monthlyAmounts, source.annualAmount), 2)} {sourceType?.measurementUnit}</strong><br />转换记录仅保存引用关系，不重复保存投入数量。</> : '当前无匹配能源量数据。'}</div></> : <><div className={styles.compactGrid}><Field label="投入分析类别" required><select value={inputCategory} onChange={(event) => { setInputCategory(event.target.value as AnalysisCategory); setInputEnergyTypeId(''); }}><option>电力</option><option>热力</option><option>化石燃料</option><option>可再生及替代能源</option><option>其他能源</option></select></Field><Field label="投入能源品种" required><select value={inputEnergyTypeId} onChange={(event) => { const id = event.target.value; const type = types.find((value) => value.energyTypeId === id); setInputEnergyTypeId(id); setInputUnit(type?.measurementUnit ?? ''); }}><option value="">请选择</option>{types.filter((type) => type.analysisCategory === inputCategory).map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field><Field label="单位" required><input value={inputUnit} readOnly /></Field><Field label="投入数量" required><input type="number" min="0" value={inputAmount} onChange={(event) => setInputAmount(event.target.value)} /></Field></div><div className={styles.warningTip}>手工补充不会写入能源量数据台账。后续如补录基础计量数据，应改为关联已有记录，避免出现两套投入量。</div></>}
      </div></div>}
      {(recordType === '余热发电' || recordType === '回收利用') && <div className={styles.conversionFormSection}><h3>回收来源</h3><div className={`${styles.compactGrid} ${styles.conversionFormBody}`}><Field label="来源单元" required><select value={recoverySourceId} onChange={(event) => setRecoverySourceId(event.target.value)}>{units.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field><Field label="回收能源/介质" required><select value={recoveryEnergy} onChange={(event) => { setRecoveryEnergy(event.target.value); setRecoveryUnit(['余热', '压力能'].includes(event.target.value) ? 'GJ' : event.target.value === '可燃尾气' ? 'Nm³' : 't'); }}>{recoveryEnergyOptions.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="回收来源量"><input type="number" min="0" value={recoveryAmount} onChange={(event) => setRecoveryAmount(event.target.value)} placeholder="未计量可留空" /></Field><Field label="单位"><select value={recoveryUnit} onChange={(event) => setRecoveryUnit(event.target.value)}><option>GJ</option><option>t</option><option>Nm³</option></select></Field><div className={`${styles.helpText} ${styles.full}`}>{recordType === '余热发电' ? '企业未计量余热量时可留空，仅填写发电量。' : '回收介质在本记录中维护，不进入能源量数据页面。'}</div></div></div>}
      <div className={styles.conversionFormSection}><h3>{recordType === '回收利用' ? '回收能源' : '产出能源'}</h3><div className={`${styles.compactGrid} ${styles.conversionFormBody}`}><Field label="分析类别" required><select value={outputCategory} onChange={(event) => { const category = event.target.value as AnalysisCategory; const next = types.find((type) => type.analysisCategory === category); setOutputCategory(category); setOutputEnergyName(next?.energyTypeName ?? ''); setOutputUnit(next?.measurementUnit ?? ''); }}>{(recordType === '锅炉产汽/产热' ? ['热力'] : recordType === '余热发电' || recordType === '自发电' ? ['电力'] : recordType === '回收利用' ? ['回收能源'] : categories).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="能源品种" required><select value={outputEnergyName} onChange={(event) => { const name = event.target.value; const type = types.find((value) => value.energyTypeName === name); setOutputEnergyName(name); setOutputUnit(type?.measurementUnit ?? (name === '回收热水' ? 'GJ' : '')); }}>{outputOptions.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="单位" required><select value={outputUnit} onChange={(event) => setOutputUnit(event.target.value)}><option>{outputUnit || 'GJ'}</option>{['GJ', 't', 'kWh', 'Nm³'].filter((value) => value !== outputUnit).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label={recordType === '回收利用' ? '回收总量' : '产出总量'} required><input type="number" min="0" value={outputAmount} onChange={(event) => setOutputAmount(event.target.value)} /></Field></div></div>
      <div className={styles.conversionFormSection}><h3>{recordType === '回收利用' ? '回收能源去向' : '产出能源去向'}</h3><div className={`${styles.compactGrid} ${styles.conversionFormBody}`}><Field label="内部使用量" required><input type="number" min="0" value={internalAmount} onChange={(event) => setInternalAmount(event.target.value)} /></Field><Field label="外供量"><input type="number" min="0" value={externalAmount} onChange={(event) => setExternalAmount(event.target.value)} /></Field><Field label="损失/未分配量"><input type="number" min="0" value={lossAmount} onChange={(event) => setLossAmount(event.target.value)} /></Field><div className={`${styles.balanceBox} ${balanced ? '' : styles.balanceWarn} ${styles.full}`}><div><strong>产出总量 = 内部使用量 + 外供量 + 损失/未分配量</strong><p>系统实时校验，避免产出、内部使用和外供重复统计。</p></div><Tag tone={balanced ? 'green' : 'orange'}>{balanced ? '校验通过' : '数量不平衡'}</Tag></div></div></div>
      <div className={styles.conversionRemark}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></div>
    </>}
    {error && <div className={styles.error}>{error}</div>}
  </Modal>;
}

function OperationsPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [year, setYear] = useState('2026');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11OperationMetric | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11OperationMetric | null>(null);
  const products = listProducts();
  const productNames = new Map(products.map((product) => [product.productId, product.productName]));
  const rows = listV11OperationMetrics().filter((item) => item.year === Number(year)
    && (!category || item.metricCategory === category)
    && (!keyword || `${v11ScopeName(item.energyUnitId)}${item.metricName}${item.productId ? productNames.get(item.productId) ?? '' : ''}`.includes(keyword)));
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增运营数据</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="指标类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option><option>产量</option><option>经济指标</option></select></Field>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="产品 / 归属范围 / 指标名称" /></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>一期采集产品产量和经济指标，用于能耗强度、能效对标和经营分析；产量可按全厂或具体用能单元维护。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>归属范围</th><th>指标类别</th><th>指标名称</th><th>产品</th><th>单位</th><th>年度值</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.flatMap((row) => {
      const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
      return [<tr key={row.operationMetricId}><td className={styles.strong}>{v11ScopeName(row.energyUnitId)}<small className={styles.subText}>{row.scopeLevel}</small></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.productId ? productNames.get(row.productId) ?? '已停用产品' : '—'}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
      detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={7}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
    }) : <EmptyRow colSpan={7} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <OperationDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除运营数据" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11OperationMetric(deleting.operationMetricId); setDeleting(null); setVersion((value) => value + 1); notify('运营数据已删除'); }}><div className={styles.warning}>确认删除“{deleting.metricName}”数据吗？</div></Modal>}
  </Page>;
}

function OperationDialog({ item, onClose, onSaved }: { item?: V11OperationMetric; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const products = listProducts();
  const initialMetricPreset = item
    ? metricPresets[item.metricCategory].find((entry) => entry[0] === item.metricName)
    : undefined;
  const [category, setCategory] = useState<V11OperationMetric['metricCategory']>(item?.metricCategory ?? '产量');
  const [preset, setPreset] = useState(item ? initialMetricPreset?.[0] ?? '其他（自定义）' : '');
  const [customName, setCustomName] = useState(item && !initialMetricPreset ? item.metricName : '');
  const [productId, setProductId] = useState(item?.productId ?? '');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('通用工业产品');
  const [newProductUnit, setNewProductUnit] = useState('t');
  const [unitId, setUnitId] = useState(item ? item.energyUnitId ?? '__enterprise__' : '');
  const [metricUnit, setMetricUnit] = useState(item?.metricUnit ?? '');
  const [values, setValues] = useState<string[]>(item?.monthlyValues.map(String) ?? Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualValue || ''));
  const [error, setError] = useState('');
  const custom = preset === '其他（自定义）';
  const annualMode = category === '经济指标';
  const productOutput = category === '产量' && preset === '产品产量';
  const enterpriseScope = unitId === '__enterprise__';
  return <Modal title={item ? '编辑运营数据' : '新增运营数据'} width={820} onClose={onClose} onSubmit={() => {
    const name = productOutput ? '产品产量' : custom ? customName.trim() : preset;
    if (!name || !metricUnit || (!annualMode && !unitId) || (productOutput && !productId)) return setError('请完整填写必填字段。');
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
    const result = saveV11OperationMetric({ year: 2026, scopeLevel: annualMode || enterpriseScope ? '企业' : selectedUnit?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元', energyUnitId: annualMode || enterpriseScope ? null : unitId, metricCategory: category, aggregationMethod: annualMode ? '年度单值' : '月度求和', metricCode, productId: resolvedProductId, metricName: name, metricUnit, entryMode: annualMode ? 'annual' : 'monthly', monthlyValues: annualMode ? [] : monthNumbers, annualValue: annualMode ? Number(annualValue) : 0 }, item?.operationMetricId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '运营数据已更新' : '运营数据已新增');
  }}><div className={styles.formGrid}>
    <Field label="指标类别" required><select value={category} onChange={(event) => { const next = event.target.value as V11OperationMetric['metricCategory']; setCategory(next); setPreset(''); setProductId(''); setMetricUnit(''); }}><option>产量</option><option>经济指标</option></select></Field>
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
    <Field label="归属范围" required><select disabled={annualMode} value={annualMode ? '__enterprise__' : unitId} onChange={(event) => setUnitId(event.target.value)}>{annualMode ? <option value="__enterprise__">全厂</option> : <><option value="">请选择归属范围</option><option value="__enterprise__">全厂</option>{units.filter((unit) => unit.unitLevel === 'level1' || unit.unitLevel === 'level2').map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select></Field>
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
  const [keyword, setKeyword] = useState('');
  const [unitId, setUnitId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [editing, setEditing] = useState<V11KeyDevice | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11KeyDevice | null>(null);
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const energyRecords = listV11EnergyRecords();
  const rows = listV11KeyDevices().filter((item) => (!keyword || `${item.deviceName}${item.deviceType}`.includes(keyword)) && (!unitId || item.energyUnitId === unitId) && (!typeId || item.mainEnergyTypeId === typeId));
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增重点设备</Button>}>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="设备名称 / 设备类型" /></Field>
      <Field label="所属用能单元"><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">全部</option>{units.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      <Field label="主要能源品种"><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">全部</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>本页维护重点设备基础档案；设备月度能源量统一进入“能源数据—重点设备”维护，并用于设备用能与能效对标。设备明细不会重复增加所属用能单元或企业总能耗。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>所属用能单元</th><th>设备名称</th><th>设备类型</th><th>主要能源品种</th><th>数据状态</th><th>本年度能源量</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.map((row) => {
      const deviceRecords = energyRecords.filter((record) => v11RecordScopeType(record) === 'device' && record.scopeId === row.deviceId && record.year === 2026);
      const primaryRecord = deviceRecords.find((record) => record.energyTypeId === row.mainEnergyTypeId) ?? deviceRecords[0];
      const progress = primaryRecord ? primaryRecord.entryMode === 'annual' ? 12 : primaryRecord.monthlyAmounts.filter((value) => value > 0).length : 0;
      const total = primaryRecord ? annual(primaryRecord.monthlyAmounts, primaryRecord.annualAmount) : 0;
      const energyType = types.find((type) => type.energyTypeId === (primaryRecord?.energyTypeId ?? row.mainEnergyTypeId));
      const maintain = () => navigate(`/data-management/energy-data?scope=device&deviceId=${row.deviceId}${primaryRecord ? '' : '&new=1'}`);
      return <tr key={row.deviceId}><td>{v11ScopeName(row.energyUnitId)}</td><td className={styles.strong}>{row.deviceName}</td><td>{row.deviceType}</td><td><Tag tone="blue">{types.find((type) => type.energyTypeId === row.mainEnergyTypeId)?.energyTypeName}</Tag></td><td><Tag tone={progress === 12 ? 'green' : progress > 0 ? 'orange' : 'gray'}>{progress === 0 ? '未录入' : progress === 12 ? '已完整录入（12/12月）' : `部分录入（${progress}/12月）`}</Tag></td><td className={styles.number}>{primaryRecord ? `${format(total, 2)} ${energyType?.measurementUnit ?? ''}` : '—'}</td><td><div className={styles.actions}><button type="button" onClick={() => setEditing(row)}>编辑档案</button><button type="button" onClick={maintain}>{primaryRecord ? '维护数据' : '录入能源数据'}</button><button type="button" className={styles.danger} onClick={() => setDeleting(row)}>删除</button></div></td></tr>;
    }) : <EmptyRow colSpan={7} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <DeviceDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除重点设备" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
    const result = deleteV11KeyDevice(deleting.deviceId);
    if (!result.ok) return notify(result.error);
    setDeleting(null); setVersion((value) => value + 1); notify('重点设备已删除');
  }}><div className={styles.warning}>确认删除重点设备“{deleting.deviceName}”吗？系统将先检查设备能源数据和指标目标引用。</div></Modal>}
  </Page>;
}

function DeviceDialog({ item, onClose, onSaved }: { item?: V11KeyDevice; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const initialPreset = deviceTypePresets.includes(item?.deviceType ?? '') ? item?.deviceType ?? '' : item ? '其他（自定义）' : '';
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [preset, setPreset] = useState(initialPreset);
  const [customType, setCustomType] = useState(initialPreset === '其他（自定义）' ? item?.deviceType ?? '' : '');
  const [name, setName] = useState(item?.deviceName ?? '');
  const [typeId, setTypeId] = useState(item?.mainEnergyTypeId ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  return <Modal title={item ? '编辑重点设备' : '新增重点设备'} width={720} onClose={onClose} onSubmit={() => {
    const deviceType = preset === '其他（自定义）' ? customType.trim() : preset;
    if (!unitId || !deviceType || !name.trim() || !typeId) return setError('请完整填写必填字段。');
    const result = saveV11KeyDevice({ energyUnitId: unitId, deviceType, deviceName: name.trim(), mainEnergyTypeId: typeId, remark }, item?.deviceId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '重点设备已更新' : '重点设备已新增');
  }}><div className={styles.formGrid}>
    <Field label="所属用能单元" required><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">请选择用能单元</option>{units.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
    <Field label="设备类型" required><select value={preset} onChange={(event) => setPreset(event.target.value)}><option value="">请选择设备类型</option>{deviceTypePresets.map((value) => <option key={value}>{value}</option>)}</select></Field>
    {preset === '其他（自定义）' && <Field label="自定义设备类型" required><input value={customType} onChange={(event) => setCustomType(event.target.value)} /></Field>}
    <Field label="设备名称" required><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="主要能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    <div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}
