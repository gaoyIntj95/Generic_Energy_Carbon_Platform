/* eslint-disable no-irregular-whitespace */
import { useMemo, useState, type ReactNode } from 'react';
import {
  buildFlowAnalysisDataset,
  type FlowAnalysisDataset,
  type FlowLevelTwoBalanceRow,
  type FlowPeriod,
} from '../../mocks/energyFlowSelector';
import { listV11ConversionOutputs } from '../../mocks/dataManagementV11Store';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import { AssetAiAnalysis, type AssetAiConfig } from './AssetAiAnalysis';
import { Button, Drawer, Field, Tag, Toast } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

type UnitBalanceStatus = '正常' | '关注' | '异常' | '待完善';

interface UnitBalanceRow {
  energyUnitId: string;
  energyUnitName: string;
  unitType: string;
  energyInputStandardAmount: number;
  effectiveUseStandardAmount: number;
  recoveredStandardAmount: number;
  externalOutputStandardAmount: number;
  balanceDifferenceStandardAmount: number;
  deviationRate: number | null;
  status: UnitBalanceStatus;
  sourceRows: FlowLevelTwoBalanceRow[];
}

function format(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function Page({ children, toast }: { children: ReactNode; toast: string }) {
  return <div className={styles.page}>{children}<Toast message={toast} /></div>;
}

function Kpi({
  label,
  value,
  unit,
  sub,
  danger = false,
}: {
  label: string;
  value: string;
  unit: string;
  sub: ReactNode;
  danger?: boolean;
}) {
  return <div className={`${styles.card} ${styles.kpi} ${danger ? styles.kpiDanger : ''}`}>
    <span>{label}</span>
    <strong>{value}<small>{unit}</small></strong>
    <p>{sub}</p>
  </div>;
}

function buildUnitBalanceRows(
  sourceRows: FlowLevelTwoBalanceRow[],
  units: ReturnType<typeof listEnergyUnits>,
  dataset: FlowAnalysisDataset,
) {
  const recoveryRecords = listV11ConversionOutputs()
    .filter((record) => record.recordType === '回收利用' || record.recordType === '余热发电');
  const unitById = new Map(units.map((unit) => [unit.energyUnitId, unit]));
  const firstLevelUnitId = (energyUnitId: string | null | undefined) => {
    let current = energyUnitId ? unitById.get(energyUnitId) : undefined;
    while (current && current.unitLevel !== 'level1' && current.parentEnergyUnitId) {
      current = unitById.get(current.parentEnergyUnitId);
    }
    return current?.unitLevel === 'level1' ? current.energyUnitId : null;
  };
  return units.map<UnitBalanceRow>((unit) => {
    const rows = sourceRows.filter((row) => row.level1EnergyUnitId === unit.energyUnitId);
    const energyInputStandardAmount = rows.reduce((total, row) => total + row.distributionStandardAmount, 0);
    const effectiveUseStandardAmount = rows.reduce((total, row) => total + row.utilizationStandardAmount, 0);
    const recoveredStandardAmount = recoveryRecords
      .filter((record) => firstLevelUnitId(record.recoverySourceEnergyUnitId) === unit.energyUnitId)
      .reduce((total, record) => total + (dataset.conversionDifferenceRows
        .find((row) => row.conversionOutputId === record.conversionOutputId)?.inputStandardAmount ?? 0), 0);
    const externalOutputStandardAmount = dataset.detailRows
      .filter((row) => row.stage === '外部输出' && row.energyUnitName === unit.energyUnitName)
      .reduce((total, row) => total + row.standardCoalAmount, 0);
    const balanceDifferenceStandardAmount = energyInputStandardAmount
      - effectiveUseStandardAmount
      - recoveredStandardAmount
      - externalOutputStandardAmount;
    const deviationRate = energyInputStandardAmount > 0
      ? balanceDifferenceStandardAmount / energyInputStandardAmount * 100
      : null;
    const status: UnitBalanceStatus = energyInputStandardAmount <= 0
      ? effectiveUseStandardAmount + recoveredStandardAmount + externalOutputStandardAmount > 0
        ? '异常'
        : '待完善'
      : effectiveUseStandardAmount <= 0
        ? '待完善'
        : Math.abs(deviationRate ?? 0) > 10
          ? '异常'
          : Math.abs(deviationRate ?? 0) > 5
            ? '关注'
            : '正常';
    return {
      energyUnitId: unit.energyUnitId,
      energyUnitName: unit.energyUnitName,
      unitType: unit.unitType,
      energyInputStandardAmount,
      effectiveUseStandardAmount,
      recoveredStandardAmount,
      externalOutputStandardAmount,
      balanceDifferenceStandardAmount,
      deviationRate,
      status,
      sourceRows: rows,
    };
  });
}

export function BalanceOptimizationPage() {
  const [toast, setToast] = useState('');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(6);
  const [scope, setScope] = useState('enterprise');
  const [compare, setCompare] = useState('同比');
  const [aiVersion, setAiVersion] = useState(0);
  const [applied, setApplied] = useState({
    period: 'month' as 'month' | 'year',
    month: 6,
    scope: 'enterprise',
    compare: '同比',
  });
  const [selection, setSelection] = useState<UnitBalanceRow | null>(null);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };
  const levelOneUnits = useMemo(
    () => listEnergyUnits().filter((unit) => unit.unitLevel === 'level1'),
    [],
  );
  const analysisPeriod = useMemo<FlowPeriod>(() => ({
    year: 2026,
    grain: applied.period,
    month: applied.month,
  }), [applied.month, applied.period]);
  const levelOneDataset = useMemo(
    () => buildFlowAnalysisDataset(analysisPeriod, 'level1'),
    [analysisPeriod],
  );
  const levelTwoDataset = useMemo(
    () => buildFlowAnalysisDataset(analysisPeriod, 'level2'),
    [analysisPeriod],
  );
  const allUnitRows = useMemo(
    () => buildUnitBalanceRows(levelTwoDataset.levelTwoBalanceRows, levelOneUnits, levelOneDataset),
    [levelOneDataset, levelOneUnits, levelTwoDataset.levelTwoBalanceRows],
  );
  const visibleUnitRows = applied.scope === 'enterprise'
    ? allUnitRows
    : allUnitRows.filter((row) => row.energyUnitId === applied.scope);
  const totals = useMemo(() => ({
    input: visibleUnitRows.reduce((total, row) => total + row.energyInputStandardAmount, 0),
    effectiveUse: visibleUnitRows.reduce((total, row) => total + row.effectiveUseStandardAmount, 0),
    recovered: visibleUnitRows.reduce((total, row) => total + row.recoveredStandardAmount, 0),
    external: visibleUnitRows.reduce((total, row) => total + row.externalOutputStandardAmount, 0),
    difference: visibleUnitRows.reduce((total, row) => total + row.balanceDifferenceStandardAmount, 0),
  }), [visibleUnitRows]);
  const selectedScopeName = applied.scope === 'enterprise'
    ? '全企业'
    : levelOneUnits.find((unit) => unit.energyUnitId === applied.scope)?.energyUnitName ?? '用能单元';
  const ranks = [...visibleUnitRows]
    .sort((left, right) =>
      Math.abs(right.balanceDifferenceStandardAmount) - Math.abs(left.balanceDifferenceStandardAmount))
    .slice(0, 5);
  const topIssue = ranks.find((row) =>
    Math.abs(row.balanceDifferenceStandardAmount) > 0.01);
  const periodText = applied.period === 'year' ? '2026年度' : `2026年${applied.month}月`;
  const aiConfig = useMemo<AssetAiConfig>(() => ({
    tone: 'aiBalance',
    title: 'AI平衡研判',
    description: '关联能源输入、有效利用、回收利用和外部输出，提示优先核查与优化对象。',
    period: periodText,
    scope: selectedScopeName,
    cutoff: applied.period === 'year' ? '2026-12-31' : `2026-${String(applied.month).padStart(2, '0')}-30`,
    level: topIssue ? `优先级：${topIssue.status === '异常' ? '高' : '中'}` : '运行平稳',
    reasoningType: '能流勾稽与优化优先级研判',
    judgement: topIssue
      ? `${topIssue.energyUnitName}是当前优先核查对象，平衡偏差为${format(topIssue.balanceDifferenceStandardAmount, 1)} tce，偏差率为${format(topIssue.deviationRate ?? 0, 1)}%。建议先核对能源记录和运行负荷，再判断是否需要采取优化措施。`
      : '当前统计范围内能源输入与已确认去向总体稳定，暂未识别到需要优先处置的平衡偏差。',
    logic: `能源输入${format(totals.input, 1)} tce，扣除终端有效利用${format(totals.effectiveUse, 1)} tce、回收利用${format(totals.recovered, 1)} tce和外部输出${format(totals.external, 1)} tce后，形成管理平衡偏差${format(totals.difference, 1)} tce。`,
    evidence: [
      { label: '能源输入量', value: `${format(totals.input, 1)} tce`, note: '当前统计范围能源输入' },
      { label: '终端有效利用量', value: `${format(totals.effectiveUse, 1)} tce`, note: '已确认的终端能源利用' },
      { label: '回收利用量', value: `${format(totals.recovered, 1)} tce`, note: '回收能源再次利用' },
      { label: '平衡偏差', value: `${format(totals.difference, 1)} tce`, note: '管理分析口径差额' },
    ],
    priorityAction: topIssue
      ? `优先核查${topIssue.energyUnitName}的上下级能源记录、统计期间和折标口径，再结合重点设备与运营负荷判断是否需要运行优化。`
      : '保持当前数据维护频率，并持续关注重点设备运行负荷和单位产出能耗变化。',
    uncertainty: '平衡偏差用于管理分析，不直接等同于物理损失；终端有效利用仍以当前已记录的下级利用数据为准，设备效率与工艺优化结论需结合现场运行参数确认。',
    inputs: ['能源输入', '终端有效利用', '回收利用', '外部输出', '平衡偏差'],
  }), [
    applied.month,
    applied.period,
    periodText,
    selectedScopeName,
    topIssue,
    totals.difference,
    totals.effectiveUse,
    totals.external,
    totals.input,
    totals.recovered,
  ]);

  const applyFilters = () => {
    setApplied({ period, month, scope, compare });
    setAiVersion((value) => value + 1);
    notify('已按当前条件更新能效平衡分析');
  };

  const resetFilters = () => {
    setPeriod('month');
    setMonth(6);
    setScope('enterprise');
    setCompare('同比');
    setApplied({ period: 'month', month: 6, scope: 'enterprise', compare: '同比' });
    setAiVersion((value) => value + 1);
    notify('筛选条件已重置');
  };

  return <Page toast={toast}>
    <BalanceFilters
      period={period}
      setPeriod={setPeriod}
      month={month}
      setMonth={setMonth}
      scope={scope}
      setScope={setScope}
      compare={compare}
      setCompare={setCompare}
      levelOneUnits={levelOneUnits}
      onQuery={applyFilters}
      onReset={resetFilters}
    />
    <div className={styles.kpiFive}>
      <Kpi label="能源输入量" value={format(totals.input, 1)} unit="tce" sub={<>当前统计范围能源输入</>} />
      <Kpi label="终端有效利用量" value={format(totals.effectiveUse, 1)} unit="tce" sub={<>已确认的终端利用</>} />
      <Kpi label="回收利用量" value={format(totals.recovered, 1)} unit="tce" sub={<>回收能源再次利用</>} />
      <Kpi label="外部输出量" value={format(totals.external, 1)} unit="tce" sub={<>向企业边界外输出</>} />
      <Kpi
        label="平衡偏差"
        value={format(totals.difference, 1)}
        unit="tce"
        danger={Math.abs(totals.difference) > 0.01}
        sub={<>管理分析口径差额</>}
      />
    </div>
    <div className={styles.twoColumns}>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>能效平衡总览</h2>
          <span>{selectedScopeName} · {periodText}</span>
        </div>
        <BalanceOverview
          input={totals.input}
          effectiveUse={totals.effectiveUse}
          recovered={totals.recovered}
          external={totals.external}
          difference={totals.difference}
        />
      </section>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>关键偏差对象 TOP5</h2>
          <span>差额量（tce）　差额率</span>
        </div>
        <BalanceRankList rows={ranks} onOpen={setSelection} />
      </section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}>
      <div className={styles.panelHead}>
        <h2>用能单元平衡清单</h2>
        <span>按当前统计范围汇总能源输入、利用、回收和外部输出</span>
      </div>
      <UnitBalanceTable rows={visibleUnitRows} onOpen={setSelection} />
      <div className={styles.formula}>
        ⓘ　平衡偏差＝能源输入量－终端有效利用量－回收利用量－外部输出量；本表为管理分析口径，不等同于专业工艺热平衡。
      </div>
    </section>
    <AssetAiAnalysis analysisKey="balance" invalidationVersion={aiVersion} notify={notify} configOverride={aiConfig} />
    {selection && <BalanceDiagnosisDrawer
      selection={selection}
      period={analysisPeriod}
      onClose={() => setSelection(null)}
      onNavigate={(path) => {
        setSelection(null);
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
    />}
  </Page>;
}

function BalanceFilters({
  period,
  setPeriod,
  month,
  setMonth,
  scope,
  setScope,
  compare,
  setCompare,
  levelOneUnits,
  onQuery,
  onReset,
}: {
  period: 'month' | 'year';
  setPeriod: (period: 'month' | 'year') => void;
  month: number;
  setMonth: (month: number) => void;
  scope: string;
  setScope: (scope: string) => void;
  compare: string;
  setCompare: (compare: string) => void;
  levelOneUnits: ReturnType<typeof listEnergyUnits>;
  onQuery: () => void;
  onReset: () => void;
}) {
  return <section className={`${styles.card} ${styles.filters}`}>
    <div className={styles.filterField}>
      <span>分析周期</span>
      <div className={styles.segment}>
        <button type="button" className={period === 'month' ? styles.segmentActive : ''} onClick={() => setPeriod('month')}>月度</button>
        <button type="button" className={period === 'year' ? styles.segmentActive : ''} onClick={() => setPeriod('year')}>年度</button>
      </div>
    </div>
    <Field label="年份"><select value={2026} disabled><option value={2026}>2026年</option></select></Field>
    {period === 'month' && <Field label="月份"><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthLabels.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}</select></Field>}
    <Field label="统计范围"><select value={scope} onChange={(event) => setScope(event.target.value)}>
      <option value="enterprise">全企业</option>
      {levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}
    </select></Field>
    <Field label="对比口径"><select value={compare} onChange={(event) => setCompare(event.target.value)}><option>同比</option><option>环比</option></select></Field>
    <div className={styles.filterSpacer} />
    <Button primary onClick={onQuery}>查询</Button>
    <Button onClick={onReset}>重置</Button>
  </section>;
}

function BalanceOverview({
  input,
  effectiveUse,
  recovered,
  external,
  difference,
}: {
  input: number;
  effectiveUse: number;
  recovered: number;
  external: number;
  difference: number;
}) {
  const confirmed = effectiveUse + recovered + external;
  return <div className={styles.balanceOverview}>
    <svg viewBox="0 0 760 250" role="img" aria-label="能效平衡总览">
      <path className={styles.balanceFlowMain} d="M170 103 C255 103 260 74 345 74" />
      <path className={styles.balanceFlowMain} d="M465 75 C535 75 535 36 610 36" />
      <path className={styles.balanceFlowAux} d="M465 88 C535 88 535 98 610 98" />
      <path className={styles.balanceFlowAux} d="M465 101 C535 101 535 160 610 160" />
      <path className={styles.balanceFlowWarn} d="M170 148 C365 148 440 219 610 219" />
      <g className={styles.balanceNode}>
        <rect x="20" y="72" width="150" height="104" rx="9" />
        <text x="38" y="104">能源输入量</text>
        <text className={styles.balanceNodeValue} x="38" y="139">{format(input, 1)}</text>
        <text className={styles.balanceNodeUnit} x="132" y="139">tce</text>
      </g>
      <g className={styles.balanceNode}>
        <rect x="345" y="46" width="120" height="76" rx="8" />
        <text x="362" y="72">已确认去向</text>
        <text className={styles.balanceNodeValueSmall} x="362" y="101">{format(confirmed, 1)} tce</text>
      </g>
      <BalanceOverviewNode x={610} y={12} label="终端有效利用量" value={effectiveUse} tone="blue" />
      <BalanceOverviewNode x={610} y={74} label="回收利用量" value={recovered} tone="green" />
      <BalanceOverviewNode x={610} y={136} label="外部输出量" value={external} tone="orange" />
      <BalanceOverviewNode x={610} y={198} label="平衡偏差" value={difference} tone="red" />
    </svg>
  </div>;
}

function BalanceOverviewNode({
  x,
  y,
  label,
  value,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'orange' | 'red';
}) {
  return <g className={`${styles.balanceNode} ${styles[`balanceNode${tone}`]}`}>
    <rect x={x} y={y} width="138" height="48" rx="7" />
    <text x={x + 14} y={y + 19}>{label}</text>
    <text className={styles.balanceNodeValueSmall} x={x + 14} y={y + 39}>{format(value, 1)} tce</text>
  </g>;
}

function BalanceRankList({
  rows,
  onOpen,
}: {
  rows: UnitBalanceRow[];
  onOpen: (row: UnitBalanceRow) => void;
}) {
  const colors = ['#3478F6', '#0AA06C', '#FF8700', '#7A54E8', '#37B5C3'];
  const max = Math.max(...rows.map((row) => Math.abs(row.balanceDifferenceStandardAmount)), 1);
  return <div className={styles.ranks}>
    <div className={styles.rankHead}><span /><span>对象</span><span /><span>差额量</span><span>差额率</span></div>
    {rows.length ? rows.map((row, index) => {
      const amount = Math.abs(row.balanceDifferenceStandardAmount);
      const rate = Math.abs(row.deviationRate ?? 0);
      return <button type="button" key={row.energyUnitId} onClick={() => onOpen(row)}>
        <i style={{ background: colors[index] }}>{index + 1}</i>
        <b title={row.energyUnitName}>{row.energyUnitName}<small>{row.status}</small></b>
        <span><em style={{ width: `${amount / max * 100}%`, background: colors[index] }} /></span>
        <strong>{format(amount, 1)}</strong>
        <small>{format(rate, 1)}%</small>
      </button>;
    }) : <div className={styles.rankEmpty}>当前范围暂无用能单元平衡数据</div>}
  </div>;
}

function statusTone(status: UnitBalanceStatus) {
  if (status === '异常') return 'red';
  if (status === '正常') return 'green';
  return 'orange';
}

function UnitBalanceTable({
  rows,
  onOpen,
}: {
  rows: UnitBalanceRow[];
  onOpen: (row: UnitBalanceRow) => void;
}) {
  return <div className={styles.tableWrap}><table><thead><tr>
    <th>用能单元</th><th>能源输入量（tce）</th><th>终端有效利用量（tce）</th><th>回收利用量（tce）</th><th>外部输出量（tce）</th><th>平衡偏差（tce）</th><th>偏差率</th><th>状态</th><th>操作</th>
  </tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.energyUnitId}>
    <td>{row.energyUnitName}</td>
    <td>{format(row.energyInputStandardAmount, 1)}</td>
    <td>{format(row.effectiveUseStandardAmount, 1)}</td>
    <td>{format(row.recoveredStandardAmount, 1)}</td>
    <td>{format(row.externalOutputStandardAmount, 1)}</td>
    <td className={row.status === '异常' ? styles.dangerNumber : row.status === '关注' ? styles.warningNumber : ''}>{format(row.balanceDifferenceStandardAmount, 1)}</td>
    <td>{row.deviationRate === null ? '—' : `${format(row.deviationRate, 1)}%`}</td>
    <td><Tag tone={statusTone(row.status)}>{row.status}</Tag></td>
    <td><button type="button" className={styles.link} onClick={() => onOpen(row)}>查看详情</button></td>
  </tr>) : <tr><td colSpan={9} className={styles.emptyCell}>当前范围暂无用能单元平衡数据</td></tr>}</tbody></table></div>;
}

function BalanceDiagnosisDrawer({
  selection,
  period,
  onClose,
  onNavigate,
}: {
  selection: UnitBalanceRow;
  period: FlowPeriod;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const periodText = period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
  const values: Array<[string, string]> = [
    ['分析期间', periodText],
    ['用能单元', selection.energyUnitName],
    ['单元类型', selection.unitType],
    ['能源输入量', `${format(selection.energyInputStandardAmount, 1)} tce`],
    ['终端有效利用量', `${format(selection.effectiveUseStandardAmount, 1)} tce`],
    ['回收利用量', `${format(selection.recoveredStandardAmount, 1)} tce`],
    ['外部输出量', `${format(selection.externalOutputStandardAmount, 1)} tce`],
    ['平衡偏差', `${format(selection.balanceDifferenceStandardAmount, 1)} tce`],
    ['偏差率', selection.deviationRate === null ? '—' : `${format(selection.deviationRate, 1)}%`],
  ];
  const judgement = selection.status === '异常'
    ? `${selection.energyUnitName}当前平衡偏差率为 ${format(selection.deviationRate ?? 0, 1)}%，应先核对能源记录、统计期间和运行负荷。`
    : selection.status === '关注'
      ? `${selection.energyUnitName}当前平衡偏差为 ${format(selection.balanceDifferenceStandardAmount, 1)} tce，建议关注主要耗能环节和能源去向。`
      : selection.status === '待完善'
        ? `${selection.energyUnitName}当前期间的能源输入或终端利用数据尚不完整，暂无法形成有效平衡判断。`
        : `${selection.energyUnitName}的能源输入与已确认去向总体稳定。`;
  const actions = selection.status === '异常'
    ? ['核对能源记录是否重复、跨期或单位不一致。', '检查重点设备运行负荷和异常能源去向。']
    : selection.status === '关注'
      ? ['核对终端利用、回收利用和外部输出记录。', '结合运营负荷判断偏差是否具有合理业务原因。']
      : ['持续跟踪重点设备运行效率和单位产出能耗。', '数据口径变化后重新生成平衡研判。'];

  return <Drawer
    title={`能效平衡诊断｜${selection.energyUnitName}`}
    width={620}
    onClose={onClose}
    footer={<><Button onClick={() => onNavigate('/energy-analysis/flow')}>查看能流分析</Button><Button primary onClick={() => onNavigate('/data-management/energy')}>前往能源数据</Button></>}
  >
    <div className={styles.detailGrid}>{values.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className={styles.diagnosisJudgement}><Tag tone={statusTone(selection.status)}>{selection.status}</Tag><p><strong>问题判断：</strong>{judgement}</p></div>
    <ul className={styles.diagnosisActions}>{actions.map((action) => <li key={action}>{action}</li>)}</ul>
    <div className={styles.tableWrap}><table><thead><tr><th>能源品种</th><th>能源输入量</th><th>终端有效利用量</th><th>平衡偏差</th></tr></thead><tbody>
      {selection.sourceRows.length
        ? selection.sourceRows.map((row) => <tr key={row.rowId}><td>{row.energyTypeName}</td><td>{format(row.distributionStandardAmount, 1)}</td><td>{format(row.utilizationStandardAmount, 1)}</td><td>{format(row.distributionStandardAmount - row.utilizationStandardAmount, 1)}</td></tr>)
        : <tr><td colSpan={4} className={styles.emptyCell}>当前期间暂无能源品种明细</td></tr>}
    </tbody></table></div>
    <p className={styles.drawerHint}>页面数值与能流分析读取同一聚合结果；平衡偏差用于管理分析，不直接等同于物理损失或设备效率结论。</p>
  </Drawer>;
}
