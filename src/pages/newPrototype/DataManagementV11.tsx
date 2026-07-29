import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  deleteV11ConversionRelation,
  deleteV11EnergyCost,
  deleteV11EnergyRecord,
  deleteV11EnergyType,
  deleteV11KeyDevice,
  deleteV11OperationMetric,
  listV11ConversionRelations,
  listV11EnergyCosts,
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11KeyDevices,
  listV11OperationMetrics,
  saveV11ConversionRelation,
  saveV11EnergyCost,
  saveV11EnergyRecord,
  saveV11EnergyType,
  saveV11KeyDevice,
  saveV11OperationMetric,
  v11ScopeName,
  type AnalysisCategory,
  type EnergyRole,
  type ScopeLevel,
  type V11ConversionRelation,
  type V11EnergyCost,
  type V11EnergyRecord,
  type V11EnergyType,
  type V11KeyDevice,
  type V11OperationMetric,
} from '../../mocks/dataManagementV11Store';
import { Button, Field, Modal, Tag, Toast } from './PrototypeUI';
import { EnergyUnitsPage } from './EnergyUnitsPage';
import styles from './DataManagementV11.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const categories: AnalysisCategory[] = ['电力', '热力', '化石燃料', '可再生及替代能源', '回收能源', '其他能源'];
const roles: EnergyRole[] = ['能源消费', '回收能源', '能源产出', '外供能源'];
const levels: Array<'全部层级' | ScopeLevel> = ['全部层级', '企业', '一级用能单元', '二级用能单元'];
const deviceTypePresets = ['动力设备', '泵类', '风机', '空压设备', '制冷/空调设备', '加热/锅炉设备', '输送设备', '其他（自定义）'];
const metricPresets = {
  产量与业务量: [
    ['产品产量', 't'],
    ['熟料产量', 't'],
    ['水泥产量', 't'],
    ['服务量', '项'],
    ['运输量', 't·km'],
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

const roleCopy: Record<EnergyRole, { description: string; stage: string }> = {
  能源消费: { description: '记录企业边界输入、一级分配和二级利用数据，能流阶段由归属层级自动识别。', stage: '能源输入 / 能源分配 / 能源利用' },
  回收能源: { description: '记录余热、回收蒸汽等回收能源，通常作为能源转换关系的投入。', stage: '能源回收' },
  能源产出: { description: '记录锅炉产汽、余热发电、光伏发电等转换或自产能源的产出总量。', stage: '能源产出' },
  外供能源: { description: '记录企业向外部输出的能源量，系统据此识别外部输出。', stage: '外部输出' },
};

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
    <button type="button" className={active === 'quantity' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-consumption')}>能源量数据</button>
    <button type="button" className={active === 'costs' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-costs')}>能源成本</button>
    <button type="button" className={active === 'relations' ? styles.activeTab : ''} onClick={() => navigate('/data-management/energy-relations')}>能源转换关系</button>
  </div>;
}

export function DataManagementV11({ pathname }: { pathname: string }) {
  const page = pathname.split('/').pop();
  if (page === 'units') return <EnergyUnitsPage />;
  if (page === 'energy-types') return <EnergyTypesPage />;
  if (page === 'energy-consumption') return <EnergyQuantityPage />;
  if (page === 'energy-costs') return <EnergyCostsPage />;
  if (page === 'energy-relations') return <EnergyRelationsPage />;
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
      <Notice><strong>说明：</strong>分析类别用于能耗查询和结构汇总；能源品种只维护基础属性，能源转换关系在“能源转换关系”中配置；外部输出由外供能源数据自动识别。</Notice>
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
  const [version, setVersion] = useState(0);
  const [role, setRole] = useState<EnergyRole>('能源消费');
  const [level, setLevel] = useState<'全部层级' | ScopeLevel>('全部层级');
  const [year, setYear] = useState('2026');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11EnergyRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11EnergyRecord | null>(null);
  const types = listV11EnergyTypes();
  const records = listV11EnergyRecords();
  const rows = records.filter((item) => item.energyRole === role && item.year === Number(year)
    && (level === '全部层级' || item.scopeLevel === level)
    && (!category || types.find((type) => type.energyTypeId === item.energyTypeId)?.analysisCategory === category)
    && (!keyword || `${v11ScopeName(item.energyUnitId)}${types.find((type) => type.energyTypeId === item.energyTypeId)?.energyTypeName ?? ''}`.includes(keyword)));
  void version;
  const countForLevel = (value: '全部层级' | ScopeLevel) => records.filter((item) => item.energyRole === role && (value === '全部层级' || item.scopeLevel === value)).length;
  return <Page toast={toast}>
    <section className={styles.card}>
      <EnergyDataTabs active="quantity" />
      <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增能源数据</Button>}>
        <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
        <Field label="分析类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="用能单元 / 能源品种" /></Field>
      </Toolbar>
      <div className={styles.roleTabs}>{roles.map((item) => <button key={item} type="button" className={role === item ? styles.activeRole : ''} onClick={() => { setRole(item); setLevel('全部层级'); setExpanded(null); }}>{item}</button>)}</div>
      <Notice><strong>{role}：</strong>{roleCopy[role].description}<span className={styles.stageMap}>形成阶段：<Tag tone="blue">{roleCopy[role].stage}</Tag></span></Notice>
      <div className={styles.levelTabs}>{levels.map((item) => <button key={item} type="button" className={level === item ? styles.activeLevel : ''} onClick={() => setLevel(item)}>{item}（{countForLevel(item)}）</button>)}</div>
      <div className={styles.tableWrap}><table className={styles.wideTable}><thead><tr><th>数据角色</th><th>归属范围</th><th>归属层级</th><th>能流阶段</th><th>分析类别</th><th>能源品种</th><th>单位</th><th>数据进度</th><th>年度合计</th><th>操作</th></tr></thead>
        <tbody>{rows.length ? rows.flatMap((row) => {
          const type = types.find((item) => item.energyTypeId === row.energyTypeId);
          const total = annual(row.monthlyAmounts, row.annualAmount);
          const detail = expanded === row.energyRecordId;
          return [<tr key={row.energyRecordId}><td><Tag>{row.energyRole}</Tag></td><td className={styles.strong}>{v11ScopeName(row.energyUnitId)}</td><td>{row.scopeLevel}</td><td><span className={styles.stagePill}>{energyStage(row)}</span></td><td>{type?.analysisCategory}</td><td>{type?.energyTypeName}</td><td>{type?.measurementUnit}</td><td>{row.entryMode === 'monthly' ? `${row.monthlyAmounts.filter((value) => value > 0).length}/12月` : '年度已填报'}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={() => setExpanded(detail ? null : row.energyRecordId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.energyRecordId}-detail`}><td colSpan={10}><MonthDetail values={row.monthlyAmounts} annualValue={total} unit={type?.measurementUnit ?? ''} /></td></tr>];
        }) : <EmptyRow colSpan={10} />}</tbody>
      </table></div>
      <Pagination count={rows.length} />
    </section>
    {editing && <EnergyRecordDialog role={role} item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
    {deleting && <Modal title="删除能源数据" width={520} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => {
      const result = deleteV11EnergyRecord(deleting.energyRecordId);
      if (!result.ok) return notify(result.error);
      setDeleting(null); setVersion((value) => value + 1); notify('能源数据已删除');
    }}><div className={styles.warning}>确认删除当前能源数据吗？删除前将检查能源转换关系引用。</div></Modal>}
  </Page>;
}

function energyStage(record: V11EnergyRecord) {
  if (record.energyRole === '回收能源') return '能源回收';
  if (record.energyRole === '能源产出') return '能源产出';
  if (record.energyRole === '外供能源') return '外部输出';
  if (record.scopeLevel === '企业') return '能源输入';
  return record.scopeLevel === '一级用能单元' ? '能源分配' : '能源利用';
}
function MonthDetail({ values, annualValue, unit }: { values: number[]; annualValue: number; unit: string }) {
  return <div className={styles.detailPanel}><div className={styles.detailHead}><span>月度明细</span><span>计量单位：{unit}</span></div><div className={styles.monthDetailGrid}>{months.map((month, index) => <div key={month}><span>{month}</span><strong>{values[index] === undefined ? '—' : format(values[index], 2)}</strong></div>)}</div><div className={styles.summaryLine}>年度合计 <strong>{format(annualValue, 2)}</strong> {unit}</div></div>;
}

function EnergyRecordDialog({ role, item, onClose, onSaved }: { role: EnergyRole; item?: V11EnergyRecord; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const [level, setLevel] = useState<ScopeLevel>(item?.scopeLevel ?? (role === '能源消费' ? '企业' : '二级用能单元'));
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [typeId, setTypeId] = useState(item?.energyTypeId ?? '');
  const [entryMode, setEntryMode] = useState<'monthly' | 'annual'>(item?.entryMode ?? 'monthly');
  const [values, setValues] = useState<string[]>(item?.monthlyAmounts.map(String) ?? Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualAmount || ''));
  const [error, setError] = useState('');
  const type = types.find((value) => value.energyTypeId === typeId);
  const availableUnits = units.filter((unit) => level === '一级用能单元' ? unit.unitLevel === 'level1' : unit.unitLevel === 'level2');
  const effectiveUnitId = level === '企业' ? null : unitId;
  const recordPreview: V11EnergyRecord = { energyRecordId: '', year: 2026, energyRole: role, scopeLevel: level, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode, monthlyAmounts: [], annualAmount: 0 };
  return <Modal title={item ? '编辑能源数据' : '新增能源数据'} width={820} onClose={onClose} onSubmit={() => {
    const monthNumbers = values.map((value) => Number(value || 0));
    if ((level !== '企业' && !unitId) || !typeId) return setError('请选择归属范围和能源品种。');
    if (entryMode === 'monthly' && !monthNumbers.some((value) => value > 0)) return setError('月度填报至少填写一个月份。');
    if (entryMode === 'annual' && !(Number(annualValue) > 0)) return setError('请填写年度值。');
    const result = saveV11EnergyRecord({ year: 2026, energyRole: role, scopeLevel: level, energyUnitId: effectiveUnitId, energyTypeId: typeId, entryMode, monthlyAmounts: entryMode === 'monthly' ? monthNumbers : [], annualAmount: entryMode === 'annual' ? Number(annualValue) : 0 }, item?.energyRecordId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源数据已更新' : '能源数据已新增');
  }}><div className={styles.formGrid}>
    <div className={styles.contextStrip}><span>数据角色 <strong>{role}</strong></span><span>业务阶段 <strong>{energyStage(recordPreview)}</strong></span></div>
    <Field label="归属层级" required><select value={level} onChange={(event) => { setLevel(event.target.value as ScopeLevel); setUnitId(''); }}><option>企业</option><option>一级用能单元</option><option>二级用能单元</option></select></Field>
    <Field label="归属范围" required><select disabled={level === '企业'} value={level === '企业' ? '全厂' : unitId} onChange={(event) => setUnitId(event.target.value)}>{level === '企业' ? <option>全厂</option> : <><option value="">请选择用能单元</option>{availableUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select></Field>
    <Field label="能源品种" required><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">请选择能源品种</option>{types.map((value) => <option key={value.energyTypeId} value={value.energyTypeId}>{value.energyTypeName}</option>)}</select></Field>
    <div className={styles.autoInfo}><span>分析类别 <strong>{type?.analysisCategory ?? '—'}</strong></span><span>计量单位 <strong>{type?.measurementUnit ?? '—'}</strong></span><span>归属层级 <strong>{level}</strong></span></div>
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

function EnergyRelationsPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [year, setYear] = useState('2026');
  const [unitId, setUnitId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<V11ConversionRelation | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11ConversionRelation | null>(null);
  const units = listEnergyUnits();
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const rows = listV11ConversionRelations().filter((item) => item.year === Number(year) && (!unitId || item.conversionEnergyUnitId === unitId) && (!keyword || `${item.conversionScene}${v11ScopeName(item.conversionEnergyUnitId)}`.includes(keyword)));
  void version;
  const recordLabel = (recordId: string) => {
    const record = records.find((item) => item.energyRecordId === recordId);
    const type = types.find((item) => item.energyTypeId === record?.energyTypeId);
    return record ? `${type?.energyTypeName ?? '能源'} ${format(annual(record.monthlyAmounts, record.annualAmount), 2)} ${type?.measurementUnit ?? ''}` : '—';
  };
  return <Page toast={toast}><section className={styles.card}>
    <EnergyDataTabs active="relations" />
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增能源转换关系</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="转换单元"><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">全部</option>{units.filter((unit) => unit.conversionScene).map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="转换场景 / 转换单元" /></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>仅在这里配置真实发生的能源转换：锅炉产汽/产热、余热发电、自发电或其他转换。外购能源由企业级能源消费识别，一级和二级消费分别形成能源分配与利用，外供能源由系统自动识别。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>转换场景</th><th>转换单元</th><th>投入能源</th><th>产出能源</th><th>数据期间</th><th>计算状态</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.flatMap((row) => {
        const inputTce = row.inputEnergyRecordIds.reduce((sum, id) => sum + standardCoalForRecord(records.find((record) => record.energyRecordId === id), types), 0);
        const outputTce = row.outputEnergyRecordIds.reduce((sum, id) => sum + standardCoalForRecord(records.find((record) => record.energyRecordId === id), types), 0);
        const detail = expanded === row.conversionRelationId;
        return [<tr key={row.conversionRelationId}><td><span className={styles.conversionMark}>{row.conversionScene}</span></td><td className={styles.strong}>{v11ScopeName(row.conversionEnergyUnitId)}</td><td>{row.inputEnergyRecordIds.length ? row.inputEnergyRecordIds.map(recordLabel).join('、') : '无可计量燃料投入'}</td><td>{row.outputEnergyRecordIds.map(recordLabel).join('、')}</td><td>{row.year}年</td><td><Tag tone={row.outputEnergyRecordIds.length && (row.inputEnergyRecordIds.length || row.conversionScene === '自发电') ? 'green' : 'orange'}>{row.outputEnergyRecordIds.length ? '可计算' : '待补充'}</Tag></td><td><Actions onView={() => setExpanded(detail ? null : row.conversionRelationId)} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
          detail && <tr className={styles.detailRow} key={`${row.conversionRelationId}-detail`}><td colSpan={7}><div className={styles.relationDetail}><div className={styles.relationPreview}><strong>{row.inputEnergyRecordIds.length ? row.inputEnergyRecordIds.map(recordLabel).join('、') : '太阳能等自然输入'}</strong><span>→</span><b>{v11ScopeName(row.conversionEnergyUnitId)} · {row.conversionScene}</b><span>→</span><strong>{row.outputEnergyRecordIds.map(recordLabel).join('、')}</strong></div><p>{row.remark}</p><div className={styles.relationSummary}><div><span>投入折标量</span><strong>{format(inputTce, 2)} tce</strong></div><div><span>产出折标量</span><strong>{format(outputTce, 2)} tce</strong></div><div><span>转换效率</span><strong>{inputTce ? `${(outputTce / inputTce * 100).toFixed(1)}%` : '不适用'}</strong></div><div><span>损失量</span><strong>{inputTce ? `${format(Math.max(0, inputTce - outputTce), 2)} tce` : '—'}</strong></div></div></div></td></tr>];
      }) : <EmptyRow colSpan={7} />}</tbody>
    </table></div><Pagination count={rows.length} />
    <div className={styles.readonlySection}><div><h3>已识别的外部输出</h3><p>以下数据来自“外供能源”，无需重复配置转换关系。</p></div>{records.filter((record) => record.energyRole === '外供能源').map((record) => <span key={record.energyRecordId}><Tag tone="blue">{v11ScopeName(record.energyUnitId)}</Tag> {recordLabel(record.energyRecordId)}</span>)}</div>
  </section>
  {editing && <RelationDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除能源转换关系" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11ConversionRelation(deleting.conversionRelationId); setDeleting(null); setVersion((value) => value + 1); notify('能源转换关系已删除'); }}><div className={styles.warning}>确认删除“{deleting.conversionScene}”关系吗？</div></Modal>}
  </Page>;
}

function standardCoalForRecord(record: V11EnergyRecord | undefined, types: V11EnergyType[]) {
  if (!record) return 0;
  const type = types.find((item) => item.energyTypeId === record.energyTypeId);
  if (!type) return 0;
  const amount = annual(record.monthlyAmounts, record.annualAmount);
  return type.standardCoalFactorUnit.startsWith('kgce') ? amount * type.standardCoalFactor / 1000 : amount * type.standardCoalFactor;
}
function RelationDialog({ item, onClose, onSaved }: { item?: V11ConversionRelation; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const records = listV11EnergyRecords();
  const types = listV11EnergyTypes();
  const [scene, setScene] = useState<V11ConversionRelation['conversionScene']>(item?.conversionScene ?? '余热发电');
  const [unitId, setUnitId] = useState(item?.conversionEnergyUnitId ?? '');
  const [inputId, setInputId] = useState(item?.inputEnergyRecordIds[0] ?? '');
  const [outputId, setOutputId] = useState(item?.outputEnergyRecordIds[0] ?? '');
  const [advanced, setAdvanced] = useState(false);
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [error, setError] = useState('');
  const label = (record: V11EnergyRecord) => `${v11ScopeName(record.energyUnitId)}｜${types.find((type) => type.energyTypeId === record.energyTypeId)?.energyTypeName}｜${format(annual(record.monthlyAmounts, record.annualAmount), 2)}`;
  const conversionUnits = units.filter((unit) => unit.conversionScene === scene || (scene === '其他转换' && unit.conversionScene));
  return <Modal title={item ? '编辑能源转换关系' : '新增能源转换关系'} width={880} onClose={onClose} onSubmit={() => {
    if (!unitId || !outputId || (scene !== '自发电' && !inputId)) return setError('请选择转换单元并完整关联投入、产出能源数据。');
    const result = saveV11ConversionRelation({ year: 2026, conversionEnergyUnitId: unitId, conversionScene: scene, inputEnergyRecordIds: inputId ? [inputId] : [], outputEnergyRecordIds: [outputId], remark }, item?.conversionRelationId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '能源转换关系已更新' : '能源转换关系已新增');
  }}><div className={styles.formGrid}>
    <div className={`${styles.sceneGrid} ${styles.full}`}>{(['锅炉产汽/产热', '余热发电', '自发电', '其他转换'] as const).map((value) => <button type="button" key={value} className={scene === value ? styles.sceneActive : ''} onClick={() => { setScene(value); setUnitId(''); setInputId(''); setOutputId(''); }}><strong>{value}</strong><span>{value === '锅炉产汽/产热' ? '燃料投入后产出蒸汽或热力' : value === '余热发电' ? '回收余热后产出电力' : value === '自发电' ? '无可计量燃料投入的发电' : '其他真实能源形态转换'}</span></button>)}</div>
    <Field label="转换单元" required><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">请选择转换单元</option>{conversionUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
    <Field label="数据年度" required><input value="2026" readOnly /></Field>
    <div className={`${styles.simpleRelation} ${styles.full}`}><Field label={scene === '自发电' ? '投入能源（不适用）' : '投入能源数据'} required={scene !== '自发电'}><select disabled={scene === '自发电'} value={inputId} onChange={(event) => setInputId(event.target.value)}><option value="">{scene === '自发电' ? '无可计量燃料投入' : '请选择已有能源数据'}</option>{records.filter((record) => record.energyRole === '能源消费' || record.energyRole === '回收能源').map((record) => <option key={record.energyRecordId} value={record.energyRecordId}>{label(record)}</option>)}</select></Field><span>→</span><Field label="产出能源数据" required><select value={outputId} onChange={(event) => setOutputId(event.target.value)}><option value="">请选择已有产出数据</option>{records.filter((record) => record.energyRole === '能源产出' && (!unitId || record.energyUnitId === unitId)).map((record) => <option key={record.energyRecordId} value={record.energyRecordId}>{label(record)}</option>)}</select></Field></div>
    <div className={styles.full}><button type="button" className={styles.advancedLink} onClick={() => setAdvanced((value) => !value)}>{advanced ? '收起高级关联' : '＋ 高级关联（选填）'}</button>{advanced && <div className={styles.advancedBox}>一期高级关联仅保留入口；多投入、多产出仍使用已有能源数据 ID 关联，不在此新增能源量。</div>}</div>
    <div className={`${styles.relationPreviewBox} ${styles.full}`}>关系预览：<strong>{inputId ? label(records.find((record) => record.energyRecordId === inputId)!) : scene === '自发电' ? '自然输入' : '待选择投入'}</strong> → <strong>{v11ScopeName(unitId || null)} · {scene}</strong> → <strong>{outputId ? label(records.find((record) => record.energyRecordId === outputId)!) : '待选择产出'}</strong></div>
    <div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
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
  const rows = listV11OperationMetrics().filter((item) => item.year === Number(year) && (!category || item.metricCategory === category) && (!keyword || `${v11ScopeName(item.energyUnitId)}${item.metricName}`.includes(keyword)));
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增运营数据</Button>}>
      <Field label="年度"><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option></select></Field>
      <Field label="指标类别"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option><option>产量与业务量</option><option>经济指标</option></select></Field>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="归属范围 / 指标名称" /></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>一期仅采集直接用于能耗强度和经营分析的产量与业务量、经济指标；规模和运行参数后续按实际功能需要扩展。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>归属范围</th><th>指标类别</th><th>指标名称</th><th>单位</th><th>年度值</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.flatMap((row) => {
      const total = annual(row.monthlyValues, row.annualValue); const detail = expanded === row.operationMetricId;
      return [<tr key={row.operationMetricId}><td className={styles.strong}>{v11ScopeName(row.energyUnitId)}<small className={styles.subText}>{row.scopeLevel}</small></td><td><Tag tone={row.metricCategory === '经济指标' ? 'blue' : 'green'}>{row.metricCategory}</Tag></td><td>{row.metricName}</td><td>{row.metricUnit}</td><td className={styles.number}>{format(total, 2)}</td><td><Actions onView={row.entryMode === 'monthly' ? () => setExpanded(detail ? null : row.operationMetricId) : undefined} onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>,
      detail && <tr className={styles.detailRow} key={`${row.operationMetricId}-detail`}><td colSpan={6}><MonthDetail values={row.monthlyValues} annualValue={total} unit={row.metricUnit} /></td></tr>];
    }) : <EmptyRow colSpan={6} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <OperationDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除运营数据" width={500} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11OperationMetric(deleting.operationMetricId); setDeleting(null); setVersion((value) => value + 1); notify('运营数据已删除'); }}><div className={styles.warning}>确认删除“{deleting.metricName}”数据吗？</div></Modal>}
  </Page>;
}

function OperationDialog({ item, onClose, onSaved }: { item?: V11OperationMetric; onClose: () => void; onSaved: (message: string) => void }) {
  const units = listEnergyUnits();
  const initialMetricPreset = item
    ? metricPresets[item.metricCategory].find((entry) => entry[0] === item.metricName)
    : undefined;
  const [category, setCategory] = useState<V11OperationMetric['metricCategory']>(item?.metricCategory ?? '产量与业务量');
  const [preset, setPreset] = useState(item ? initialMetricPreset?.[0] ?? '其他（自定义）' : '');
  const [customName, setCustomName] = useState(item && !initialMetricPreset ? item.metricName : '');
  const [unitId, setUnitId] = useState(item?.energyUnitId ?? '');
  const [metricUnit, setMetricUnit] = useState(item?.metricUnit ?? '');
  const [values, setValues] = useState<string[]>(item?.monthlyValues.map(String) ?? Array(12).fill(''));
  const [annualValue, setAnnualValue] = useState(String(item?.annualValue || ''));
  const [error, setError] = useState('');
  const custom = preset === '其他（自定义）';
  const annualMode = category === '经济指标';
  return <Modal title={item ? '编辑运营数据' : '新增运营数据'} width={820} onClose={onClose} onSubmit={() => {
    const name = custom ? customName.trim() : preset;
    if (!name || !metricUnit || (!annualMode && !unitId)) return setError('请完整填写必填字段。');
    const monthNumbers = values.map((value) => Number(value || 0));
    if (!annualMode && !monthNumbers.some((value) => value > 0)) return setError('月度填报至少填写一个月份。');
    if (annualMode && !(Number(annualValue) > 0)) return setError('请填写年度值。');
    const selectedUnit = units.find((unit) => unit.energyUnitId === unitId);
    const result = saveV11OperationMetric({ year: 2026, scopeLevel: annualMode ? '企业' : selectedUnit?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元', energyUnitId: annualMode ? null : unitId, metricCategory: category, aggregationMethod: annualMode ? '年度单值' : '月度求和', metricName: name, metricUnit, entryMode: annualMode ? 'annual' : 'monthly', monthlyValues: annualMode ? [] : monthNumbers, annualValue: annualMode ? Number(annualValue) : 0 }, item?.operationMetricId);
    if (!result.ok) return setError(result.error);
    onSaved(item ? '运营数据已更新' : '运营数据已新增');
  }}><div className={styles.formGrid}>
    <Field label="指标类别" required><select value={category} onChange={(event) => { const next = event.target.value as V11OperationMetric['metricCategory']; setCategory(next); setPreset(''); setMetricUnit(''); }}><option>产量与业务量</option><option>经济指标</option></select></Field>
    <Field label="指标名称" required><select value={preset} onChange={(event) => { const value = event.target.value; setPreset(value); const option = metricPresets[category].find((entry) => entry[0] === value); if (option) setMetricUnit(option[1]); }}><option value="">请选择指标</option>{metricPresets[category].map(([name]) => <option key={name}>{name}</option>)}</select></Field>
    {custom && <Field label="自定义指标名称" required><input value={customName} onChange={(event) => setCustomName(event.target.value)} /></Field>}
    <Field label="归属范围" required><select disabled={annualMode} value={annualMode ? '全厂' : unitId} onChange={(event) => setUnitId(event.target.value)}>{annualMode ? <option>全厂</option> : <><option value="">请选择用能单元</option>{units.filter((unit) => unit.unitLevel === 'level1' || unit.unitLevel === 'level2').map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</>}</select></Field>
    <Field label="计量单位" required><input value={metricUnit} readOnly={!custom} onChange={(event) => setMetricUnit(event.target.value)} /></Field>
    <div className={styles.autoInfo}><span>汇总方式 <strong>{annualMode ? '年度单值' : '月度求和'}</strong></span><span>录入方式 <strong>{annualMode ? '年度填报' : '月度填报'}</strong></span></div>
    {annualMode ? <div className={styles.full}><Field label="年度值" required><input type="number" min="0" value={annualValue} onChange={(event) => setAnnualValue(event.target.value)} /></Field></div> : <div className={`${styles.monthGrid} ${styles.full}`}>{months.map((month, index) => <Field key={month} label={month}><input type="number" min="0" value={values[index]} onChange={(event) => setValues((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}</div>}
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function DevicesPage() {
  const { toast, notify } = useNotice();
  const [version, setVersion] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [unitId, setUnitId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [editing, setEditing] = useState<V11KeyDevice | 'new' | null>(null);
  const [deleting, setDeleting] = useState<V11KeyDevice | null>(null);
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const rows = listV11KeyDevices().filter((item) => (!keyword || `${item.deviceName}${item.deviceType}`.includes(keyword)) && (!unitId || item.energyUnitId === unitId) && (!typeId || item.mainEnergyTypeId === typeId));
  void version;
  return <Page toast={toast}><section className={styles.card}>
    <Toolbar actions={<Button primary onClick={() => setEditing('new')}>＋ 新增重点设备</Button>}>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="设备名称 / 设备类型" /></Field>
      <Field label="所属用能单元"><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">全部</option>{units.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}</select></Field>
      <Field label="主要能源品种"><select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">全部</option>{types.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
    </Toolbar>
    <Notice><strong>说明：</strong>一期仅维护设备基础档案，不在本页重复录入月度能耗；后续如需设备级计量，统一进入能源数据台账。</Notice>
    <div className={styles.tableWrap}><table><thead><tr><th>所属用能单元</th><th>设备名称</th><th>设备类型</th><th>主要能源品种</th><th>备注</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.deviceId}><td>{v11ScopeName(row.energyUnitId)}</td><td className={styles.strong}>{row.deviceName}</td><td>{row.deviceType}</td><td><Tag tone="blue">{types.find((type) => type.energyTypeId === row.mainEnergyTypeId)?.energyTypeName}</Tag></td><td>{row.remark || '—'}</td><td><Actions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} /></td></tr>) : <EmptyRow colSpan={6} />}</tbody></table></div><Pagination count={rows.length} />
  </section>
  {editing && <DeviceDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setVersion((value) => value + 1); notify(message); }} />}
  {deleting && <Modal title="删除重点设备" width={480} submitText="确认删除" onClose={() => setDeleting(null)} onSubmit={() => { deleteV11KeyDevice(deleting.deviceId); setDeleting(null); setVersion((value) => value + 1); notify('重点设备已删除'); }}><div className={styles.warning}>确认删除重点设备“{deleting.deviceName}”吗？</div></Modal>}
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
