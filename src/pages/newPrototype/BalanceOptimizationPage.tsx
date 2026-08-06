/* eslint-disable no-irregular-whitespace */
import { useMemo, useState, type ReactNode } from 'react';
import {
  buildFlowAnalysisDataset,
  summarizeFlowBalance,
  type FlowAnalysisDataset,
  type FlowLevelTwoBalanceRow,
  type FlowPeriod,
} from '../../mocks/energyFlowSelector';
import { listV11ConversionOutputs } from '../../mocks/dataManagementV11Store';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import { buildBenchmarkDataset } from '../../mocks/energyBenchmarkSelector';
import {
  buildIntensityCalculationViews,
  type CalculatedIntensityMetric,
} from '../../mocks/energyIntensitySelector';
import { AssetAiAnalysis, type AssetAiConfig } from './AssetAiAnalysis';
import { Button, Drawer, Field, Tag, Toast } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

type UnitBalanceStatus = '正常' | '关注' | '异常' | '待完善';
type TaskStatus = '待确认' | '待处理' | '已完成';

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
  intensityMetricName: string;
  intensityMetricValue: number | null;
  intensityMetricUnit: string;
  intensityDeviation: number | null;
  intensityDeviationLabel: '环比' | '同比' | '—';
  intensitySource: string;
  benchmarkMetricName: string;
  benchmarkDeviation: number | null;
  benchmarkActual: number | null;
  benchmarkTarget: number | null;
  benchmarkDirection: 'low' | 'high' | null;
}

function metricDeviation(
  metric: CalculatedIntensityMetric,
  period: FlowPeriod,
  compare: string,
  previousMetric?: CalculatedIntensityMetric,
) {
  if (period.grain === 'month') {
    const current = metric.monthlyMetrics[period.month - 1];
    if (!current || current.value === null) return { value: null, label: '—' as const };
    if (compare === '环比') return { value: current.momChange, label: '环比' as const };
    return { value: current.yoyChange, label: '同比' as const };
  }
  if (compare === '环比') return { value: null, label: '—' as const };
  if (metric.value === null || previousMetric?.value === null || previousMetric?.value === undefined || previousMetric.value === 0) {
    return { value: null, label: '同比' as const };
  }
  return { value: (metric.value - previousMetric.value) / previousMetric.value * 100, label: '同比' as const };
}

function buildIntensityDeviationMap(year: number, period: FlowPeriod, compare: string) {
  const views = buildIntensityCalculationViews(year, 'unit', 'level1');
  const previousViews = buildIntensityCalculationViews(year - 1, 'unit', 'level1');
  return new Map(views.map((view) => {
    const metrics = view.metrics.filter((item) => item.resultType === 'ok');
    const previous = previousViews.find((item) => item.object.objectId === view.object.objectId);
    const candidates = metrics.map((metric) => {
      const previousMetric = previous?.metrics.find((item) => item.intensityMetricId === metric.intensityMetricId);
      return { metric, deviation: metricDeviation(metric, period, compare, previousMetric) };
    }).filter((item) => item.deviation.value !== null);
    const selected = candidates.sort((left, right) => Math.abs(right.deviation.value ?? 0) - Math.abs(left.deviation.value ?? 0))[0];
    return [view.object.objectId, selected ? {
      metricName: selected.metric.name,
      value: period.grain === 'month' ? selected.metric.monthlyMetrics[period.month - 1]?.value ?? null : selected.metric.value,
      unit: selected.metric.unit,
      deviation: selected.deviation.value,
      label: selected.deviation.label,
      source: `能耗指标｜${selected.metric.name}｜${selected.metric.unit}`,
    } : null];
  }));
}

function buildBenchmarkDeviationMap(year: number, period: FlowPeriod) {
  const rows = buildBenchmarkDataset(year).rows.filter((row) =>
    row.objectTypeKey === 'unit'
    && row.energyUnitId
    && row.targetConfigured
    && row.target > 0
    && row.available,
  );
  return new Map(rows.map((row) => {
    const monthlyActual = period.grain === 'month'
      ? row.monthlyMetrics?.[period.month - 1]?.actual ?? null
      : null;
    const actual = period.grain === 'month' ? monthlyActual : row.actual;
    const target = period.grain === 'month'
      ? row.monthlyTargets?.[period.month - 1] ?? row.target
      : row.target;
    return [row.energyUnitId!, {
      metricName: row.metricName,
      actual,
      target,
      deviation: actual !== null && target > 0 ? (actual - target) / target * 100 : null,
      direction: row.direction,
    }];
  }));
}

function format(value: number | null, digits = 0) {
  return (value ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: digits });
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
  intensityDeviations: ReturnType<typeof buildIntensityDeviationMap>,
  benchmarkDeviations: ReturnType<typeof buildBenchmarkDeviationMap>,
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
      intensityMetricName: intensityDeviations.get(unit.energyUnitId)?.metricName ?? '暂无已计算能耗指标',
      intensityMetricValue: intensityDeviations.get(unit.energyUnitId)?.value ?? null,
      intensityMetricUnit: intensityDeviations.get(unit.energyUnitId)?.unit ?? '—',
      intensityDeviation: intensityDeviations.get(unit.energyUnitId)?.deviation ?? null,
      intensityDeviationLabel: intensityDeviations.get(unit.energyUnitId)?.label ?? '—',
      intensitySource: intensityDeviations.get(unit.energyUnitId)?.source ?? '能耗指标数据待完善',
      benchmarkMetricName: benchmarkDeviations.get(unit.energyUnitId)?.metricName ?? '—',
      benchmarkDeviation: benchmarkDeviations.get(unit.energyUnitId)?.deviation ?? null,
      benchmarkActual: benchmarkDeviations.get(unit.energyUnitId)?.actual ?? null,
      benchmarkTarget: benchmarkDeviations.get(unit.energyUnitId)?.target ?? null,
      benchmarkDirection: benchmarkDeviations.get(unit.energyUnitId)?.direction ?? null,
    };
  });
}

export function BalanceOptimizationPage() {
  const [toast, setToast] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitBalanceRow | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
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
  const intensityDeviations = useMemo(
    () => buildIntensityDeviationMap(2026, analysisPeriod, applied.compare),
    [analysisPeriod, applied.compare],
  );
  const benchmarkDeviations = useMemo(
    () => buildBenchmarkDeviationMap(2026, analysisPeriod),
    [analysisPeriod],
  );
  const allUnitRows = useMemo(
    () => buildUnitBalanceRows(levelTwoDataset.levelTwoBalanceRows, levelOneUnits, levelOneDataset, intensityDeviations, benchmarkDeviations),
    [benchmarkDeviations, intensityDeviations, levelOneDataset, levelOneUnits, levelTwoDataset.levelTwoBalanceRows],
  );
  const visibleUnitRows = applied.scope === 'enterprise'
    ? allUnitRows
    : allUnitRows.filter((row) => row.energyUnitId === applied.scope);
  const totals = useMemo(() => {
    const summary = summarizeFlowBalance(levelOneDataset, levelTwoDataset, applied.scope);
    return {
      input: summary.inputStandardCoalAmount,
      effectiveUse: summary.effectiveUseStandardCoalAmount,
      recovered: summary.recoveredStandardCoalAmount,
      external: summary.externalOutputStandardCoalAmount,
      difference: summary.differenceStandardCoalAmount,
    };
  }, [applied.scope, levelOneDataset, levelTwoDataset]);
  const confirmedAmount = totals.effectiveUse + totals.recovered + totals.external;
  const confirmationRate = totals.input > 0 ? confirmedAmount / totals.input * 100 : 0;
  const deviationRate = totals.input > 0 ? totals.difference / totals.input * 100 : 0;
  const balanceHealth = Math.abs(deviationRate) <= 0.5 ? '正常' : Math.abs(deviationRate) <= 2 ? '需关注' : '异常';
  const diagnosticRows = visibleUnitRows.filter((row) => diagnosticSignals(row).issue !== '暂无明显异常');
  const exceptionCount = visibleUnitRows.reduce((count, row) => {
    const signal = diagnosticSignals(row);
    return count
      + (signal.flowLabel === '未闭合' || signal.flowLabel === '待完善' ? 1 : 0)
      + (signal.benchmarkLabel === '明显偏离' || signal.benchmarkLabel === '轻度偏离' ? 1 : 0)
      + (row.intensityDeviation !== null && Math.abs(row.intensityDeviation) >= 8 ? 1 : 0);
  }, 0);
  const unmatchedEnergy = Math.max(0, totals.input - confirmedAmount);
  const allocation = useMemo(() => visibleUnitRows.reduce((result, row) => {
    if (row.unitType === '生产单元') result.production += row.energyInputStandardAmount;
    else if (row.unitType === '公辅系统') result.power += row.energyInputStandardAmount;
    else result.auxiliary += row.energyInputStandardAmount;
    return result;
  }, { production: 0, power: 0, auxiliary: 0 }), [visibleUnitRows]);
  const selectedScopeName = applied.scope === 'enterprise'
    ? '全企业'
    : levelOneUnits.find((unit) => unit.energyUnitId === applied.scope)?.energyUnitName ?? '用能单元';
  const ranks = [...visibleUnitRows]
    .filter((row) => {
      const flowIssue = row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10;
      const benchmarkIssue = (benchmarkGap(row) ?? 0) >= 8;
      const trendIssue = row.intensityDeviation !== null && Math.abs(row.intensityDeviation) >= 8;
      return flowIssue || benchmarkIssue || trendIssue;
    })
    .sort((left, right) => {
      const score = (row: UnitBalanceRow) => {
        const flowIssue = row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10 ? 8 : 0;
        return Math.max(benchmarkGap(row) ?? 0, 0) * 3
          + Math.abs(row.intensityDeviation ?? 0)
          + flowIssue
          + Math.min(row.energyInputStandardAmount / 1000, 5);
      };
      return score(right) - score(left);
    })
    .slice(0, 5);
  const topIssue = ranks[0];
  const pendingIntensityCount = visibleUnitRows.length - ranks.length;
  const flowExceptions = [...visibleUnitRows]
    .filter((row) => ['未闭合', '需关注', '待完善'].includes(diagnosticSignals(row).flowLabel))
    .sort((left, right) => Math.abs(right.deviationRate ?? 0) - Math.abs(left.deviationRate ?? 0))
    .slice(0, 3);
  const periodText = applied.period === 'year' ? '2026年度' : `2026年${applied.month}月`;
  const aiConfig = useMemo<AssetAiConfig>(() => ({
    tone: 'aiBalance',
    title: 'AI辅助分析',
    description: '基于能源分配、能效指标、趋势变化和对标结果生成辅助解读。',
    period: periodText,
    scope: selectedScopeName,
    cutoff: applied.period === 'year' ? '2026-12-31' : `2026-${String(applied.month).padStart(2, '0')}-30`,
    level: topIssue ? `优先级：${Math.abs(topIssue.intensityDeviation ?? 0) >= 15 ? '高' : '中'}` : '运行平稳',
    reasoningType: '规则命中后的跨指标深度诊断与优化建议',
    judgement: topIssue
      ? `${topIssue.energyUnitName}是当前优先核查对象。规则已识别其能效对标或能源分配异常；AI结合能效指标、趋势变化和分配关系后，建议先排除数据口径与统计范围问题，再进入运行因素分析。`
      : '当前统计范围内暂无具备完整环比/同比数据的异常能耗指标。',
    logic: `规则引擎负责识别异常与生成任务；AI仅在规则命中后，关联能效指标、趋势变化和能源分配关系生成可能原因、核查顺序与优化建议。当前能源输入${format(totals.input, 1)} tce，已关联去向${format(confirmedAmount, 1)} tce，未匹配能源${format(unmatchedEnergy, 1)} tce。`,
    evidence: [
      { label: '能源输入量', value: `${format(totals.input, 1)} tce`, note: '当前统计范围能源输入' },
      { label: '能源平衡率', value: `${format(confirmationRate, 2)}%`, note: '已关联去向 ÷ 能源输入量' },
      { label: '重点异常对象', value: `${diagnosticRows.length} 个`, note: '存在异常诊断结果的用能单元' },
      { label: '未匹配能源', value: `${format(unmatchedEnergy, 1)} tce`, note: '输入但未完成明确归属或分配' },
    ],
    priorityAction: topIssue
      ? `先完成${topIssue.energyUnitName}的数据口径与分配关系核查；确认数据可靠后，再结合生产负荷和设备运行状态制定运行优化方案。`
      : '保持当前数据维护频率，并持续关注重点设备运行负荷和单位产出能耗变化。',
    uncertainty: '未匹配能源用于管理分析，不直接等同于物理损失；AI输出仅基于当前数据快照，原因仍需结合现场运行参数确认。',
    inputs: ['能效指标', applied.compare, '能源输入', '能源分配', '能效对标', '趋势变化'],
    deepAnalysis: topIssue ? {
      evidenceChain: [
        `${topIssue.intensityMetricName}${topIssue.intensityDeviationLabel}${topIssue.intensityDeviation === null ? '暂无变化数据' : `${topIssue.intensityDeviation >= 0 ? '+' : ''}${format(topIssue.intensityDeviation, 1)}%`}`,
        topIssue.benchmarkDeviation === null ? '当前对象缺少可用能效对标目标' : `能效对标偏差 ${topIssue.benchmarkDeviation >= 0 ? '+' : ''}${format(topIssue.benchmarkDeviation, 1)}%`,
        `当前范围未匹配能源 ${format(unmatchedEnergy, 1)} tce，平衡率 ${format(confirmationRate, 2)}%`,
      ],
      hypotheses: [
        { level: '较高可能', text: '能源记录、统计期间、产量分母或折标口径存在不一致，需要先排除数据口径影响。' },
        { level: '待核实', text: '生产负荷、运行策略或设备状态变化可能造成指标波动，需结合现场运行数据验证。' },
      ],
      verificationSteps: [
        `核对${topIssue.energyUnitName}的能源记录、计量来源与统计期间。`,
        `复核${topIssue.intensityMetricName}的分子、分母及对标目标口径。`,
        '数据确认后，结合生产负荷与设备运行状态评估可执行的运行优化措施。',
      ],
      limitation: '当前未接入设备工况、维修记录等现场数据，AI不能确认具体设备原因或直接测算节能量。',
    } : undefined,
  }), [
    applied.month,
    applied.period,
    applied.compare,
    periodText,
    selectedScopeName,
    topIssue,
    totals.difference,
    totals.effectiveUse,
    totals.external,
    totals.input,
    totals.recovered,
    confirmedAmount,
    confirmationRate,
    diagnosticRows.length,
    unmatchedEnergy,
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

  const openDiagnosis = (row: UnitBalanceRow) => setSelectedUnit(row);
  const updateTaskStatus = (row: UnitBalanceRow, status: TaskStatus) => {
    setTaskStatuses((current) => ({ ...current, [row.energyUnitId]: status }));
    notify(`${row.energyUnitName}处理状态已更新为${status}`);
  };
  const navigateFromDiagnosis = (path: string) => {
    setSelectedUnit(null);
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
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
      <Kpi label="能源输入量" value={format(totals.input, 1)} unit="tce" sub={<>企业能源输入折标量</>} />
      <Kpi label="能源平衡率" value={format(confirmationRate, 2)} unit="%" sub={<>已关联去向 ÷ 能源输入量</>} />
      <Kpi label="重点异常对象" value={String(diagnosticRows.length)} unit="个" sub={<>存在异常诊断结果的用能单元</>} />
      <Kpi label="异常项" value={String(exceptionCount)} unit="项" sub={<>分配、对标或趋势异常</>} />
      <Kpi
        label="未匹配能源"
        value={format(unmatchedEnergy, 1)}
        unit="tce"
        danger={unmatchedEnergy > 0}
        sub={<>存在输入但未完成明确归属或分配</>}
      />
    </div>
    <div className={styles.twoColumns}>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>能效平衡概览</h2>
          <span>{selectedScopeName} · {periodText}</span>
        </div>
        <BalanceOverview
          input={totals.input}
          confirmed={confirmedAmount}
          production={allocation.production}
          power={allocation.power}
          auxiliary={allocation.auxiliary}
          external={totals.external}
          unmatched={unmatchedEnergy}
        />
        <BalanceIssueHint rows={flowExceptions} unmatched={unmatchedEnergy} />
      </section>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>重点异常对象 TOP5</h2>
        </div>
        <BalanceRankList rows={ranks} compare={applied.compare} pendingCount={pendingIntensityCount} onOpen={(row) => notify(`${row.energyUnitName}：可查看能效研判依据`)} />
      </section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}>
      <div className={styles.panelHead}>
        <h2>异常诊断与优化任务</h2>
        <span>{diagnosticRows.length} 个规则命中任务待跟进</span>
      </div>
      <UnitBalanceTable rows={diagnosticRows} taskStatuses={taskStatuses} onOpen={openDiagnosis} onStatusChange={updateTaskStatus} />
    </section>
    <AssetAiAnalysis analysisKey="balance" invalidationVersion={aiVersion} notify={notify} configOverride={aiConfig} />
    {selectedUnit && <BalanceDiagnosisDrawer
      selection={selectedUnit}
      period={analysisPeriod}
      onClose={() => setSelectedUnit(null)}
      onNavigate={navigateFromDiagnosis}
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
  confirmed,
  production,
  power,
  auxiliary,
  external,
  unmatched,
}: {
  input: number;
  confirmed: number;
  production: number;
  power: number;
  auxiliary: number;
  external: number;
  unmatched: number;
}) {
  return <div className={styles.balanceOverview}>
    <svg viewBox="0 0 760 325" role="img" aria-label="能源平衡诊断概览">
      <path className={styles.balanceFlowMain} d="M170 103 C255 103 260 74 345 74" />
      <path className={styles.balanceFlowMain} d="M465 75 C535 75 535 36 610 36" />
      <path className={styles.balanceFlowAux} d="M465 88 C535 88 535 80 610 80" />
      <path className={styles.balanceFlowAux} d="M465 101 C535 101 535 137 610 137" />
      <path className={styles.balanceFlowAux} d="M465 114 C535 114 535 194 610 194" />
      <path className={styles.balanceFlowWarn} d="M170 148 C365 148 440 238 610 238" />
      <g className={styles.balanceNode}>
        <rect x="20" y="72" width="150" height="104" rx="9" />
        <text x="38" y="104">能源输入量</text>
        <text className={styles.balanceNodeValue} x="38" y="139">{format(input, 1)}<tspan className={styles.balanceNodeUnit} dx="6">tce</tspan></text>
      </g>
      <g className={styles.balanceNode}>
        <rect x="345" y="46" width="120" height="76" rx="8" />
        <text x="362" y="72">已确认去向</text>
        <text className={styles.balanceNodeValueSmall} x="362" y="101">{format(confirmed, 1)} tce</text>
      </g>
      <BalanceOverviewNode x={610} y={40} label="生产系统" value={production} tone="blue" />
      <BalanceOverviewNode x={610} y={97} label="动力系统" value={power} tone="green" />
      <BalanceOverviewNode x={610} y={154} label="辅助系统" value={auxiliary} tone="green" />
      <BalanceOverviewNode x={610} y={211} label="外供输出" value={external} tone="orange" />
      <BalanceOverviewNode x={610} y={268} label="未匹配能源" value={unmatched} tone="red" />
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

function BalanceIssueHint({ rows, unmatched }: { rows: UnitBalanceRow[]; unmatched: number }) {
  const sources = rows.map((row) => row.energyUnitName).join('、');
  return <div className={styles.balanceIssueHint}>
    <b>{unmatched > 0 ? `未匹配能源 ${format(unmatched, 1)} tce` : '能源分配已完成匹配'}</b>
    <span>{sources ? `异常来源：${sources}，请核查归属和分配记录。` : '当前范围内未发现需优先核查的分配异常。'}</span>
  </div>;
}

function BalanceFlowSummary({ rows, onOpen }: { rows: UnitBalanceRow[]; onOpen: (row: UnitBalanceRow) => void }) {
  return <div className={styles.balanceFlowSummary}>
    <div className={styles.balanceFlowSummaryHead}><strong>能源分配异常来源</strong><span>按未匹配能源优先展示</span></div>
    {rows.length ? <div className={styles.balanceFlowSummaryList}>{rows.map((row) => {
      const signal = diagnosticSignals(row);
      const tone = signal.flowLabel === '未闭合' ? 'red' : signal.flowLabel === '需关注' ? 'orange' : 'gray';
      return <button type="button" key={row.energyUnitId} onClick={() => onOpen(row)}>
        <b>{row.energyUnitName}</b><Tag tone={tone}>{signal.flowLabel}</Tag><span>未匹配能源 {format(row.balanceDifferenceStandardAmount, 1)} tce</span><i>查看</i>
      </button>;
    })}</div> : <p className={styles.balanceFlowEmpty}>当前范围内暂无需要优先核查的能源分配异常对象。</p>}
  </div>;
}

function reviewScope(row: UnitBalanceRow) {
  const signal = diagnosticSignals(row);
  if (signal.flowLabel === '未闭合' || signal.flowLabel === '待完善') return `未匹配 ${format(Math.abs(row.balanceDifferenceStandardAmount), 1)} tce`;
  if (row.benchmarkDeviation !== null) return row.benchmarkMetricName === '—' ? row.intensityMetricName : row.benchmarkMetricName;
  if (row.intensityDeviation !== null) return row.intensityMetricName;
  return '待补充数据';
}

function BalanceRankList({
  rows,
  compare,
  pendingCount,
  onOpen,
}: {
  rows: UnitBalanceRow[];
  compare: string;
  pendingCount: number;
  onOpen: (row: UnitBalanceRow) => void;
}) {
  const colors = ['#3478F6', '#0AA06C', '#FF8700', '#7A54E8', '#37B5C3'];
  return <div className={styles.optimizationRanks}>
    <div className={styles.optimizationRankHead}><span>对象</span><span>异常类型</span><span>偏差情况</span><span>待核查范围</span><span>优先级</span></div>
    {rows.length ? rows.map((row, index) => {
      const signal = diagnosticSignals(row);
      const benchmark = row.benchmarkDeviation;
      const trend = row.intensityDeviation;
      const primary = benchmark !== null && (benchmarkGap(row) ?? 0) >= 8
        ? '能效对标偏离'
        : row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10
          ? '能源分配缺失'
          : trend !== null && Math.abs(trend) >= 8
            ? '能耗波动异常'
            : '能耗强度偏高';
      const priority = signal.priority;
      return <button type="button" key={row.energyUnitId} onClick={() => onOpen(row)}>
        <b title={`${row.energyUnitName}｜${row.unitType}`}><i style={{ background: colors[index] }}>{index + 1}</i>{row.energyUnitName}</b>
        <Tag tone={primary === '能效对标偏离' ? 'red' : primary === '能源分配缺失' ? 'orange' : 'blue'}>{primary}</Tag>
        <strong className={benchmark !== null && Math.abs(benchmark) >= 8 ? styles.rankDanger : ''}>{benchmark === null ? (row.deviationRate === null ? '—' : `${row.deviationRate > 0 ? '+' : ''}${format(row.deviationRate, 1)}%`) : `${benchmark > 0 ? '+' : ''}${format(benchmark, 1)}%`}</strong>
        <span>{reviewScope(row)}</span>
        <Tag tone={priority === '高' ? 'red' : priority === '中' ? 'orange' : 'gray'}>{priority}</Tag>
      </button>;
    }) : <div className={styles.rankEmpty}>当前范围暂无具备明确优化信号的对象。</div>}
    {pendingCount > 0 && <div className={styles.rankEmpty}>另有 {pendingCount} 个对象未达到重点优化筛选条件。</div>}
  </div>;
}

function LegacyBalanceRankList({
  rows,
  compare,
  pendingCount,
  onOpen,
}: {
  rows: UnitBalanceRow[];
  compare: string;
  pendingCount: number;
  onOpen: (row: UnitBalanceRow) => void;
}) {
  const colors = ['#3478F6', '#0AA06C', '#FF8700', '#7A54E8', '#37B5C3'];
  const max = Math.max(...rows.map((row) => Math.abs(row.intensityDeviation ?? 0)), 1);
  return <div className={styles.ranks} aria-label="相对幅度按同比环比波动与对标偏差的较大绝对值归一化展示">
    <div className={styles.rankHead}><span /><span>对象</span><span /><span>{compare}波动</span><span>对标偏差</span><span>波动等级</span></div>
    {rows.length ? rows.map((row, index) => {
      const deviation = row.intensityDeviation;
      const severity = Math.abs(deviation ?? 0) >= 15 ? '高异常' : Math.abs(deviation ?? 0) >= 8 ? '关注' : '正常波动';
      return <button type="button" key={row.energyUnitId} onClick={() => onOpen(row)}>
        <i style={{ background: colors[index] }}>{index + 1}</i>
        <b title={row.energyUnitName}>{row.energyUnitName}<small>{row.intensityMetricName}</small></b>
        <span title="按当前 TOP5 内同比/环比波动的绝对值归一化"><em style={{ width: `${Math.abs(deviation ?? 0) / max * 100}%`, background: colors[index] }} /></span>
        <strong>{deviation === null ? '—' : `${compare}${deviation > 0 ? '+' : ''}${format(deviation, 1)}%`}</strong>
        <strong className={styles.benchmarkDeviation}>{row.benchmarkDeviation === null ? '—' : `${row.benchmarkDeviation > 0 ? '+' : ''}${format(row.benchmarkDeviation, 1)}%`}</strong>
        <small>{severity}</small>
      </button>;
    }) : <div className={styles.rankEmpty}>当前范围暂无已计算的能效指标波动数据，请先完善能源数据及指标分母。</div>}
    {pendingCount > 0 && <div className={styles.rankEmpty}>另有 {pendingCount} 个用能单元缺少能效指标或{compare}数据，暂不纳入 TOP5。</div>}
  </div>;
}

function statusTone(status: UnitBalanceStatus) {
  if (status === '异常') return 'red';
  if (status === '正常') return 'green';
  return 'orange';
}

function benchmarkGap(row: UnitBalanceRow) {
  if (row.benchmarkDeviation === null) return null;
  return row.benchmarkDirection === 'high' ? -row.benchmarkDeviation : row.benchmarkDeviation;
}

function diagnosticSignals(row: UnitBalanceRow) {
  const flowAbnormal = row.deviationRate === null || Math.abs(row.deviationRate) > 10;
  const flowAttention = !flowAbnormal && Math.abs(row.deviationRate ?? 0) > 5;
  const benchmarkDeviation = row.benchmarkDeviation ?? row.intensityDeviation;
  const benchmarkRisk = row.benchmarkDeviation === null
    ? (row.intensityDeviation === null ? null : Math.abs(row.intensityDeviation))
    : benchmarkGap(row);
  const benchmarkAbnormal = benchmarkRisk !== null && benchmarkRisk >= 15;
  const benchmarkAttention = benchmarkRisk !== null && benchmarkRisk >= 8;
  const flowLabel = row.energyInputStandardAmount <= 0 ? '待完善' : flowAbnormal ? '未闭合' : flowAttention ? '需关注' : '基本闭合';
  const benchmarkLabel = benchmarkDeviation === null ? '指标缺失' : benchmarkAbnormal ? '明显偏离' : benchmarkAttention ? '轻度偏离' : '正常波动';
  const issue = row.energyInputStandardAmount <= 0
    ? '数据待核查'
    : flowAbnormal && (benchmarkAbnormal || benchmarkAttention)
      ? '能源分配异常 + 能效偏离'
      : flowAbnormal
        ? '能流异常'
        : benchmarkAbnormal || benchmarkAttention
          ? '能效偏离'
            : benchmarkDeviation === null
            ? '缺少对标依据'
            : '暂无明显异常';
  const priority = flowAbnormal && (benchmarkAbnormal || benchmarkAttention)
    ? '高'
    : flowAbnormal || benchmarkAbnormal
      ? '中'
      : '低';
  return { flowLabel, benchmarkLabel, issue, priority };
}

function diagnosisBasis(row: UnitBalanceRow) {
  const signal = diagnosticSignals(row);
  const basis: string[] = [];
  if (signal.flowLabel === '未闭合' || signal.flowLabel === '待完善') basis.push(`未匹配能源 ${format(Math.abs(row.balanceDifferenceStandardAmount), 1)} tce，占对象输入 ${format(Math.abs(row.deviationRate ?? 0), 1)}%`);
  if (row.benchmarkDeviation !== null) basis.push(`${row.benchmarkMetricName === '—' ? row.intensityMetricName : row.benchmarkMetricName}对标偏差 ${row.benchmarkDeviation >= 0 ? '+' : ''}${format(row.benchmarkDeviation, 1)}%`);
  if (row.intensityDeviation !== null) basis.push(`${row.intensityMetricName}${row.intensityDeviationLabel}${row.intensityDeviation >= 0 ? '+' : ''}${format(row.intensityDeviation, 1)}%`);
  return basis.length ? basis.join('、') : '暂无完整依据';
}

function optimizationDirection(row: UnitBalanceRow) {
  const signal = diagnosticSignals(row);
  if (signal.flowLabel === '未闭合' || signal.flowLabel === '待完善') return '核查能源归属、分配记录与计量来源';
  if (row.benchmarkDeviation !== null) return '结合生产计划、负荷与设备状态分析运行策略';
  return '关注后续周期能耗强度及运行变化';
}

function UnitBalanceTable({
  rows,
  taskStatuses,
  onOpen,
  onStatusChange,
}: {
  rows: UnitBalanceRow[];
  taskStatuses: Record<string, TaskStatus>;
  onOpen: (row: UnitBalanceRow) => void;
  onStatusChange: (row: UnitBalanceRow, status: TaskStatus) => void;
}) {
  return <div className={styles.tableWrap}><table className={styles.diagnosisTable}><thead><tr>
    <th>对象</th><th>问题类型</th><th>诊断依据</th><th>建议动作</th><th>处理状态</th>
  </tr></thead><tbody>{rows.length ? rows.map((row) => {
    const signal = diagnosticSignals(row);
    const issueTone = signal.issue.includes('异常') || signal.issue.includes('偏离') ? 'red' : signal.issue.includes('缺少') || signal.issue.includes('待') ? 'orange' : 'green';
    const status = taskStatuses[row.energyUnitId] ?? '待确认';
    return <tr key={row.energyUnitId}>
      <td className={styles.diagnosisObject}><button type="button" className={styles.link} onClick={() => onOpen(row)}>{row.energyUnitName}</button><small>{row.unitType}</small></td>
      <td><Tag tone={issueTone}>{signal.issue === '能流异常' ? '能源分配缺失' : signal.issue === '能效偏离' ? '能效对标偏离' : signal.issue}</Tag></td>
      <td>{diagnosisBasis(row)}</td>
      <td>{optimizationDirection(row)}</td>
      <td><select className={styles.taskStatus} value={status} onChange={(event) => onStatusChange(row, event.target.value as TaskStatus)}><option>待确认</option><option>待处理</option><option>已完成</option></select></td>
    </tr>;
  }) : <tr><td colSpan={5} className={styles.emptyCell}>当前范围暂无待跟进的异常对象</td></tr>}</tbody></table></div>;
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
  const signal = diagnosticSignals(selection);
  const benchmarkValue = selection.benchmarkDeviation;
  const flowText = signal.flowLabel === '基本闭合'
    ? '能源输入与已确认去向基本匹配。'
    : `当前管理平衡差额为 ${format(selection.balanceDifferenceStandardAmount, 1)} tce，需先核查能源分配与计量记录。`;
  const benchmarkText = benchmarkValue === null
    ? '当前没有可用的目标值或标杆值，暂不做能效优劣判断。'
    : `当前对标偏差为 ${benchmarkValue > 0 ? '+' : ''}${format(benchmarkValue, 1)}%，${Math.abs(benchmarkValue) >= 8 ? '建议优先核查指标口径和运行表现。' : '处于正常波动范围。'}`;
  const judgement = signal.issue === '暂无明显异常'
    ? '当前未发现需要优先处置的综合异常，建议持续跟踪。'
    : signal.issue === '数据待核查' || signal.issue === '缺少对标依据'
      ? '当前数据条件不足，建议先补齐或核对基础数据，再进行 AI 诊断。'
      : `${signal.issue}，建议列为${signal.priority}优先级对象，由 AI 结合能流和能效证据进一步研判。`;
  const actions = signal.flowLabel === '未闭合'
    ? ['核对能源输入、分配去向及计量记录是否完整一致。', '确认差额原因后，再判断是否需要设备或运行优化。']
    : benchmarkValue !== null && Math.abs(benchmarkValue) >= 8
      ? ['核对指标分子、分母、目标值和统计期间。', '结合产量、运行负荷及重点设备数据判断原因。']
      : ['持续跟踪本期及后续周期的能流闭合和能效变化。'];
  const periodText = period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
  return <Drawer
    title={`能效诊断｜${selection.energyUnitName}`}
    width={560}
    onClose={onClose}
    footer={<><Button onClick={() => onNavigate('/energy-analysis/flow')}>查看能流分析</Button><Button primary onClick={() => onNavigate('/data-management/energy')}>前往能源数据</Button></>}
  >
    <div className={styles.diagnosisIntro}>
      <div><span>{periodText} · {selection.unitType}</span><h3>{judgement}</h3></div>
      <Tag tone={signal.priority === '高' ? 'red' : signal.priority === '中' ? 'orange' : 'green'}>{signal.priority}优先级</Tag>
    </div>
    <div className={styles.diagnosisEvidence}>
      <article><span>能流分析</span><strong><Tag tone={signal.flowLabel === '未闭合' ? 'red' : 'green'}>{signal.flowLabel}</Tag></strong><p>{flowText}</p></article>
      <article><span>能效对标</span><strong><Tag tone={signal.benchmarkLabel === '明显偏离' ? 'red' : signal.benchmarkLabel === '轻度偏离' ? 'orange' : 'green'}>{signal.benchmarkLabel}</Tag></strong><p>{benchmarkText}</p></article>
      <article><span>能源规模</span><strong>{format(selection.energyInputStandardAmount, 1)} tce</strong><p>本期能源输入量</p></article>
    </div>
    <div className={styles.diagnosisJudgement}><strong>AI分析结论</strong><p>{judgement}</p></div>
    <div className={styles.diagnosisActions}><strong>建议下一步</strong><ul>{actions.map((action) => <li key={action}>{action}</li>)}</ul></div>
    <p className={styles.drawerHint}>诊断结论基于当前能源分配、能效指标和对标数据；AI仅提供辅助解读，最终原因需结合现场数据确认。</p>
  </Drawer>;
}

function LegacyBalanceDiagnosisDrawer({
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
    ['已分配能源量', `${format(selection.effectiveUseStandardAmount, 1)} tce`],
    ['回收利用量', `${format(selection.recoveredStandardAmount, 1)} tce`],
    ['外部输出量', `${format(selection.externalOutputStandardAmount, 1)} tce`],
    ['能耗指标', selection.intensityMetricName],
    ['指标值', selection.intensityMetricValue === null ? '—' : `${format(selection.intensityMetricValue, 2)} ${selection.intensityMetricUnit}`],
    [`指标${selection.intensityDeviationLabel}`, selection.intensityDeviation === null ? '—' : `${selection.intensityDeviation > 0 ? '+' : ''}${format(selection.intensityDeviation, 1)}%`],
    ['指标数据来源', selection.intensitySource],
    ['未匹配能源', `${format(selection.balanceDifferenceStandardAmount, 1)} tce`],
    ['偏差率', selection.deviationRate === null ? '—' : `${format(selection.deviationRate, 1)}%`],
  ];
  const judgement = selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= 15
    ? `${selection.energyUnitName}的${selection.intensityMetricName}${selection.intensityDeviationLabel}${format(selection.intensityDeviation, 1)}%，已达到高关注阈值，应先核对指标分子、分母、统计期间和运行负荷。`
    : selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= 8
      ? `${selection.energyUnitName}的${selection.intensityMetricName}${selection.intensityDeviationLabel}${format(selection.intensityDeviation, 1)}%，建议结合平衡影响量和主要耗能环节进一步核查。`
      : selection.status === '异常'
        ? `${selection.energyUnitName}当前未匹配能源占输入的 ${format(selection.deviationRate ?? 0, 1)}%，应先核对能源记录、统计期间和分配关系。`
    : selection.status === '关注'
      ? `${selection.energyUnitName}当前未匹配能源为 ${format(selection.balanceDifferenceStandardAmount, 1)} tce，建议关注能源分配记录和主要用能环节。`
      : selection.status === '待完善'
        ? `${selection.energyUnitName}当前期间的能源输入或终端利用数据尚不完整，暂无法形成有效平衡判断。`
        : `${selection.energyUnitName}的能源输入与已确认去向总体稳定。`;
  const actions = selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= 8
    ? ['核对能耗指标分子、分母、统计期间及用能单元归属。', '检查重点设备运行负荷、产量变化和异常能源去向。']
    : selection.status === '异常'
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
    <div className={styles.tableWrap}><table><thead><tr><th>能源品种</th><th>能源输入量</th><th>已分配能源量</th><th>未匹配能源</th></tr></thead><tbody>
      {selection.sourceRows.length
        ? selection.sourceRows.map((row) => <tr key={row.rowId}><td>{row.energyTypeName}</td><td>{format(row.distributionStandardAmount, 1)}</td><td>{format(row.utilizationStandardAmount, 1)}</td><td>{format(row.distributionStandardAmount - row.utilizationStandardAmount, 1)}</td></tr>)
        : <tr><td colSpan={4} className={styles.emptyCell}>当前期间暂无能源品种明细</td></tr>}
    </tbody></table></div>
    <p className={styles.drawerHint}>页面数值与能流分析读取同一聚合结果；未匹配能源用于管理分析，不直接等同于物理损失或设备效率结论。</p>
  </Drawer>;
}
