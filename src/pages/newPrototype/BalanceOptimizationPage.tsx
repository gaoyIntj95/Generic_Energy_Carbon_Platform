/* eslint-disable no-irregular-whitespace */
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildFlowAnalysisDataset,
  summarizeFlowBalance,
  type FlowAnalysisDataset,
  type FlowLevelTwoBalanceRow,
  type FlowPeriod,
} from '../../mocks/energyFlowSelector';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import { buildBenchmarkDataset } from '../../mocks/energyBenchmarkSelector';
import {
  listBalanceTaskRecords,
  listBalanceTaskStatuses,
  saveBalanceTaskRecord,
  type BalanceTaskStatus,
  type BalanceTaskRecord,
} from '../../mocks/balanceOptimizationStore';
import {
  buildIntensityCalculationViews,
  type CalculatedIntensityMetric,
} from '../../mocks/energyIntensitySelector';
import { AssetAiAnalysis, type AssetAiConfig } from './AssetAiAnalysis';
import { Button, Drawer, Field, Modal, Tag, Toast } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
// Industrial-wide defaults: use 8% for attention and 15% for high-risk
// investigation. These are screening bands, not regulatory limits.
const ENERGY_DEVIATION_ATTENTION = 8;
const ENERGY_DEVIATION_HIGH = 15;
const ENTERPRISE_BALANCE_ID = '__enterprise_balance__';

type UnitBalanceStatus = '正常' | '关注' | '异常' | '待完善';
type DataCompletenessStatus = 'complete' | 'incomplete';
type DiagnosisMode = 'benchmark' | 'trend' | 'data';
type TrackingSelection = Pick<UnitBalanceRow, 'energyUnitId' | 'energyUnitName' | 'unitType' | 'intensityMetricName'> & {
  issueSource: string;
  issueType: string;
  evidence: string;
  action: string;
};

type DiagnosticIssueCode =
  | 'ENERGY_RECORD_MISSING'
  | 'ENERGY_NUMERATOR_MISSING'
  | 'OPERATION_DENOMINATOR_MISSING'
  | 'METRIC_PERIOD_INCOMPLETE'
  | 'BENCHMARK_DEVIATION'
  | 'INTENSITY_TREND_DEVIATION'
  | 'OBJECT_BALANCE_REVIEW';

interface DiagnosticIssue {
  code: DiagnosticIssueCode;
  evidence: string;
  action: string;
  actionCode: 'GO_ENERGY_DATA' | 'GO_OPERATION_DATA' | 'GO_INTENSITY' | 'GO_BENCHMARK' | 'REVIEW_FLOW';
}

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
  intensityYoYDeviation: number | null;
  intensityMoMDeviation: number | null;
  intensityTrendAttentionStreak: number;
  intensityMonthlyValues: Array<number | null>;
  intensityMonthlyMomChanges: Array<number | null>;
  intensityMonthlyYoyChanges: Array<number | null>;
  intensitySource: string;
  benchmarkMetricName: string;
  benchmarkMetricUnit: string;
  benchmarkDeviation: number | null;
  benchmarkActual: number | null;
  benchmarkTarget: number | null;
  benchmarkDirection: 'low' | 'high' | null;
  benchmarkMonthlyActuals: Array<number | null>;
  benchmarkMonthlyTargets: Array<number | null>;
  dataCompletenessStatus: DataCompletenessStatus;
  dataCompletenessReason: string;
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
      const yoy = metricDeviation(metric, period, '同比', previousMetric);
      const mom = metricDeviation(metric, period, '环比', previousMetric);
      const currentIndex = period.grain === 'month' ? period.month - 1 : 11;
      let attentionStreak = 0;
      for (let index = currentIndex; index >= 0; index -= 1) {
        const monthly = metric.monthlyMetrics[index];
        const risk = Math.max(Math.abs(monthly?.momChange ?? 0), Math.abs(monthly?.yoyChange ?? 0));
        if (risk < ENERGY_DEVIATION_ATTENTION) break;
        attentionStreak += 1;
      }
      return { metric, deviation: compare === '环比' ? mom : yoy, yoy: yoy.value, mom: mom.value, attentionStreak };
    }).filter((item) => item.yoy !== null || item.mom !== null);
    const selected = candidates.sort((left, right) => Math.max(Math.abs(right.yoy ?? 0), Math.abs(right.mom ?? 0)) - Math.max(Math.abs(left.yoy ?? 0), Math.abs(left.mom ?? 0)))[0];
    return [view.object.objectId, selected ? {
      metricName: selected.metric.name,
      value: period.grain === 'month' ? selected.metric.monthlyMetrics[period.month - 1]?.value ?? null : selected.metric.value,
      unit: selected.metric.unit,
      deviation: selected.deviation.value,
      label: selected.deviation.label,
      yoyDeviation: selected.yoy,
      momDeviation: selected.mom,
      attentionStreak: selected.attentionStreak,
      monthlyValues: selected.metric.monthlyMetrics.map((item) => item.value),
      monthlyMomChanges: selected.metric.monthlyMetrics.map((item) => item.momChange),
      monthlyYoyChanges: selected.metric.monthlyMetrics.map((item) => item.yoyChange),
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
  const result = new Map<string, {
    metricName: string;
    unit: string;
    actual: number | null;
    target: number;
    monthlyActuals: Array<number | null>;
    monthlyTargets: Array<number | null>;
    deviation: number | null;
    direction: 'low' | 'high';
  }>();
  rows.forEach((row) => {
    const monthlyActual = period.grain === 'month'
      ? row.monthlyMetrics?.[period.month - 1]?.actual ?? null
      : null;
    const actual = period.grain === 'month' ? monthlyActual : row.actual;
    const target = period.grain === 'month'
      ? row.monthlyTargets?.[period.month - 1] ?? row.target
      : row.target;
    const candidate = {
      metricName: row.metricName,
      unit: row.unit,
      actual,
      target,
      monthlyActuals: row.monthlyMetrics?.map((item) => item.actual) ?? [],
      monthlyTargets: row.monthlyTargets?.length ? row.monthlyTargets : Array.from({ length: 12 }, () => target),
      deviation: actual !== null && target > 0 ? (actual - target) / target * 100 : null,
      direction: row.direction,
    };
    const current = result.get(row.energyUnitId!);
    const risk = candidate.deviation === null
      ? Number.NEGATIVE_INFINITY
      : candidate.direction === 'high' ? -candidate.deviation : candidate.deviation;
    const currentRisk = current?.deviation === null || current?.deviation === undefined
      ? Number.NEGATIVE_INFINITY
      : current.direction === 'high' ? -current.deviation : current.deviation;
    if (!current || risk > currentRisk) result.set(row.energyUnitId!, candidate);
  });
  return result;
}

function buildDataCompletenessMap(year: number, period: FlowPeriod) {
  const views = buildIntensityCalculationViews(year, 'unit', 'level1');
  return new Map(views.map((view) => {
    const calculatedMetrics = view.metrics.filter((metric) => metric.resultType === 'ok');
    if (!calculatedMetrics.length) {
      return [view.object.objectId, {
        status: 'incomplete' as const,
        reason: view.pendingReasons[0] ?? '缺少能源数据或运营数据',
      }];
    }
    if (period.grain === 'month') {
      const hasCurrentMonthData = calculatedMetrics.some((metric) => metric.monthlyMetrics[period.month - 1]?.status === '已计算');
      return [view.object.objectId, {
        status: hasCurrentMonthData ? 'complete' as const : 'incomplete' as const,
        reason: hasCurrentMonthData ? '当前期间能源与运营数据完整' : `当前期间缺少${period.month}月能耗指标数据`,
      }];
    }
    return [view.object.objectId, { status: 'complete' as const, reason: '年度能源与运营数据完整' }];
  }));
}

export function buildStrategyEfficiencySignals(year: number, period: FlowPeriod) {
  const intensity = buildIntensityDeviationMap(year, period, '同比');
  const benchmark = buildBenchmarkDeviationMap(year, period);
  const completeness = buildDataCompletenessMap(year, period);
  return new Map(listEnergyUnits().filter((unit) => unit.parentEnergyUnitId === null).map((unit) => {
    const intensityRow = intensity.get(unit.energyUnitId);
    const benchmarkRow = benchmark.get(unit.energyUnitId);
    const complete = completeness.get(unit.energyUnitId);
    const benchmarkRisk = benchmarkRow?.deviation === null || benchmarkRow?.deviation === undefined
      ? null
      : benchmarkRow.direction === 'high' ? -benchmarkRow.deviation : benchmarkRow.deviation;
    const trendRisk = Math.max(Math.abs(intensityRow?.yoyDeviation ?? 0), Math.abs(intensityRow?.momDeviation ?? 0));
    const trendHigh = trendRisk >= ENERGY_DEVIATION_HIGH
      || (trendRisk >= ENERGY_DEVIATION_ATTENTION && (intensityRow?.attentionStreak ?? 0) >= 2);
    const benchmarkRiskLevel = benchmarkRisk !== null && benchmarkRisk >= ENERGY_DEVIATION_HIGH
      ? '高风险'
      : benchmarkRisk !== null && benchmarkRisk >= ENERGY_DEVIATION_ATTENTION
        ? '对标关注'
        : null;
    const trendRiskLevel = trendHigh
      ? '趋势恶化'
      : trendRisk >= ENERGY_DEVIATION_ATTENTION
        ? '趋势关注'
        : null;
    const status = complete?.status !== 'complete'
      ? '待完善'
      : benchmarkRiskLevel
        ?? trendRiskLevel
        ?? '正常';
    const ruleCode = status === '待完善'
      ? 'METRIC_PERIOD_INCOMPLETE'
      : benchmarkRiskLevel
        ? 'BENCHMARK_DEVIATION'
        : trendRiskLevel
          ? 'INTENSITY_TREND_DEVIATION'
          : 'NO_DIAGNOSIS';
    const actionCode = status === '待完善'
      ? 'GO_INTENSITY'
      : benchmarkRiskLevel
        ? 'GO_BENCHMARK'
        : trendRiskLevel
          ? 'GO_INTENSITY'
          : 'VIEW_DETAIL';
    const evidence = status === '待完善'
      ? '能效指标数据待完善'
      : benchmarkRiskLevel && benchmarkRow
        ? `${benchmarkRow.metricName}对标${(benchmarkRisk ?? 0) >= 0 ? '+' : ''}${format(benchmarkRisk ?? 0, 1)}%`
        : trendRiskLevel && intensityRow?.yoyDeviation !== null && intensityRow?.yoyDeviation !== undefined
          ? `${intensityRow.metricName}同比${intensityRow.yoyDeviation >= 0 ? '+' : ''}${format(intensityRow.yoyDeviation, 1)}%`
          : '能效指标已计算，暂无明显偏差';
    return [unit.energyUnitId, {
      status,
      ruleCode,
      actionCode,
      evidence,
      metricName: intensityRow?.metricName ?? benchmarkRow?.metricName ?? '能耗指标',
      value: intensityRow?.value ?? null,
      unit: intensityRow?.unit ?? '—',
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
  dataCompleteness: ReturnType<typeof buildDataCompletenessMap>,
) {
  return units.map<UnitBalanceRow>((unit) => {
    const rows = sourceRows.filter((row) => row.level1EnergyUnitId === unit.energyUnitId);
    const energyInputStandardAmount = rows.reduce((total, row) => total + row.distributionStandardAmount, 0);
    // The phase-one object balance stops at level-one allocation. Missing
    // level-two decomposition is data-completeness evidence, not an allocation
    // loss attributed to the parent unit.
    const effectiveUseStandardAmount = energyInputStandardAmount;
    const recoveredStandardAmount = 0;
    const externalOutputStandardAmount = dataset.detailRows
      .filter((row) => row.stage === '外部输出' && row.energyUnitName === unit.energyUnitName)
      .reduce((total, row) => total + row.standardCoalAmount, 0);
    const balanceDifferenceStandardAmount = 0;
    const deviationRate = energyInputStandardAmount > 0
      ? balanceDifferenceStandardAmount / energyInputStandardAmount * 100
      : null;
    const status: UnitBalanceStatus = energyInputStandardAmount <= 0 ? '待完善' : '正常';
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
      intensityYoYDeviation: intensityDeviations.get(unit.energyUnitId)?.yoyDeviation ?? null,
      intensityMoMDeviation: intensityDeviations.get(unit.energyUnitId)?.momDeviation ?? null,
      intensityTrendAttentionStreak: intensityDeviations.get(unit.energyUnitId)?.attentionStreak ?? 0,
      intensityMonthlyValues: intensityDeviations.get(unit.energyUnitId)?.monthlyValues ?? [],
      intensityMonthlyMomChanges: intensityDeviations.get(unit.energyUnitId)?.monthlyMomChanges ?? [],
      intensityMonthlyYoyChanges: intensityDeviations.get(unit.energyUnitId)?.monthlyYoyChanges ?? [],
      intensitySource: intensityDeviations.get(unit.energyUnitId)?.source ?? '能耗指标数据待完善',
      benchmarkMetricName: benchmarkDeviations.get(unit.energyUnitId)?.metricName ?? '—',
      benchmarkMetricUnit: benchmarkDeviations.get(unit.energyUnitId)?.unit ?? '—',
      benchmarkDeviation: benchmarkDeviations.get(unit.energyUnitId)?.deviation ?? null,
      benchmarkActual: benchmarkDeviations.get(unit.energyUnitId)?.actual ?? null,
      benchmarkTarget: benchmarkDeviations.get(unit.energyUnitId)?.target ?? null,
      benchmarkDirection: benchmarkDeviations.get(unit.energyUnitId)?.direction ?? null,
      benchmarkMonthlyActuals: benchmarkDeviations.get(unit.energyUnitId)?.monthlyActuals ?? [],
      benchmarkMonthlyTargets: benchmarkDeviations.get(unit.energyUnitId)?.monthlyTargets ?? [],
      dataCompletenessStatus: rows.length && dataCompleteness.get(unit.energyUnitId)?.status === 'complete' ? 'complete' : 'incomplete',
      dataCompletenessReason: rows.length ? dataCompleteness.get(unit.energyUnitId)?.reason ?? '缺少可追溯的能耗指标数据' : '当前期间未找到能源消费记录',
    };
  });
}

function initialBalanceFilters(search: string) {
  const params = new URLSearchParams(search);
  const requestedYear = Number(params.get('year'));
  const requestedMonth = Number(params.get('month'));
  return {
    year: Number.isInteger(requestedYear) && requestedYear >= 2024 && requestedYear <= 2026 ? requestedYear : 2026,
    period: params.get('grain') === 'year' ? 'year' as const : 'month' as const,
    month: Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : 6,
  };
}

export function BalanceOptimizationPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [initialFilters] = useState(() => initialBalanceFilters(search));
  const [toast, setToast] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitBalanceRow | null>(null);
  const [selectedTrackingUnit, setSelectedTrackingUnit] = useState<TrackingSelection | null>(null);
  const [selectedDiagnosisMode, setSelectedDiagnosisMode] = useState<DiagnosisMode>('benchmark');
  const [taskStatuses, setTaskStatuses] = useState<Record<string, BalanceTaskStatus>>(() => listBalanceTaskStatuses({
    year: initialFilters.year,
    grain: initialFilters.period,
    month: initialFilters.month,
  }));
  const [taskRecords, setTaskRecords] = useState<Record<string, BalanceTaskRecord>>(() => listBalanceTaskRecords({
    year: initialFilters.year,
    grain: initialFilters.period,
    month: initialFilters.month,
  }));
  const [year, setYear] = useState(initialFilters.year);
  const [period, setPeriod] = useState<'month' | 'year'>(initialFilters.period);
  const [month, setMonth] = useState(initialFilters.month);
  const [aiVersion, setAiVersion] = useState(0);
  const [applied, setApplied] = useState({
    ...initialFilters,
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
    year: applied.year,
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
    () => buildIntensityDeviationMap(applied.year, analysisPeriod, '同比'),
    [analysisPeriod, applied.year],
  );
  const benchmarkDeviations = useMemo(
    () => buildBenchmarkDeviationMap(applied.year, analysisPeriod),
    [analysisPeriod],
  );
  const dataCompleteness = useMemo(
    () => buildDataCompletenessMap(applied.year, analysisPeriod),
    [analysisPeriod],
  );
  const allUnitRows = useMemo(
    () => buildUnitBalanceRows(levelTwoDataset.levelTwoBalanceRows, levelOneUnits, levelOneDataset, intensityDeviations, benchmarkDeviations, dataCompleteness),
    [benchmarkDeviations, dataCompleteness, intensityDeviations, levelOneDataset, levelOneUnits, levelTwoDataset.levelTwoBalanceRows],
  );
  const visibleUnitRows = allUnitRows;
  const totals = useMemo(() => {
    const summary = summarizeFlowBalance(levelOneDataset, levelTwoDataset, 'enterprise');
    return {
      input: summary.inputStandardCoalAmount,
      effectiveUse: summary.effectiveUseStandardCoalAmount,
      recovered: summary.recoveredStandardCoalAmount,
      external: summary.externalOutputStandardCoalAmount,
      difference: summary.differenceStandardCoalAmount,
    };
  }, [levelOneDataset, levelTwoDataset]);
  const confirmedAmount = totals.effectiveUse + totals.recovered + totals.external;
  const confirmationRate = totals.input > 0 ? confirmedAmount / totals.input * 100 : 0;
  const deviationRate = totals.input > 0 ? totals.difference / totals.input * 100 : 0;
  const balanceHealth = Math.abs(deviationRate) <= 0.5 ? '正常' : Math.abs(deviationRate) <= 2 ? '需关注' : '异常';
  const unmatchedEnergy = Math.max(0, totals.input - confirmedAmount);
  const diagnosticRows = visibleUnitRows.filter((row) => diagnosticSignals(row).issue !== '暂无明显异常');
  const enterpriseFlowStatus = taskStatuses[ENTERPRISE_BALANCE_ID] ?? '待核查';
  const exceptionCount = diagnosticRows.filter((row) => (taskStatuses[row.energyUnitId] ?? '待核查') !== '已完成').length
    + (unmatchedEnergy > 0 && enterpriseFlowStatus !== '已完成' ? 1 : 0);
  const allocation = useMemo(() => visibleUnitRows.reduce((result, row) => {
    if (row.unitType === '生产单元') result.production += row.energyInputStandardAmount;
    else if (row.unitType === '公辅系统') result.power += row.energyInputStandardAmount;
    else result.auxiliary += row.energyInputStandardAmount;
    return result;
  }, { production: 0, power: 0, auxiliary: 0 }), [visibleUnitRows]);
  const selectedScopeName = '全企业';
  const ranks = [...visibleUnitRows]
    .filter((row) => {
      const flowIssue = row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10;
      const benchmarkIssue = (benchmarkGap(row) ?? 0) >= ENERGY_DEVIATION_ATTENTION;
      const trendIssue = trendNeedsAction(row);
      return flowIssue || benchmarkIssue || trendIssue;
    })
    .sort((left, right) => {
      const score = (row: UnitBalanceRow) => {
        const flowIssue = row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10 ? 8 : 0;
        return Math.max(benchmarkGap(row) ?? 0, 0) * 3
          + Math.max(Math.abs(row.intensityYoYDeviation ?? 0), Math.abs(row.intensityMoMDeviation ?? 0))
          + flowIssue
          + Math.min(row.energyInputStandardAmount / 1000, 5);
      };
      return score(right) - score(left);
    })
    .slice(0, 5);
  const topIssue = ranks[0];
  const pendingIntensityCount = visibleUnitRows.length - ranks.length;
  const periodText = applied.period === 'year' ? `${applied.year}年度` : `${applied.year}年${applied.month}月`;
  const aiConfig = useMemo<AssetAiConfig>(() => ({
    tone: 'aiBalance',
    title: '能源平衡与优化调度',
    reportTitle: '能源平衡与优化调度分析报告',
    generateLabel: '开始优化诊断',
    description: '结合能效对标、能流分析和运行数据，辅助优化工艺、设备运行参数，实现能源平衡与优化调度。',
    period: periodText,
    scope: selectedScopeName,
    cutoff: applied.period === 'year' ? '2026-12-31' : `2026-${String(applied.month).padStart(2, '0')}-30`,
    level: topIssue ? `优先级：${Math.max(Math.abs(topIssue.intensityYoYDeviation ?? 0), Math.abs(topIssue.intensityMoMDeviation ?? 0)) >= ENERGY_DEVIATION_HIGH ? '高' : '中'}` : '运行平稳',
    reasoningType: '规则命中后的跨指标深度诊断与优化方向识别',
    judgement: topIssue
      ? `${topIssue.energyUnitName}目前是优先优化对象。系统结合能效对标、能耗变化和能源分配结果，建议先核对数据，再调整工艺、设备或用能安排。`
      : '当前全企业范围内暂无具备完整同比数据的异常能效指标。',
    logic: `规则引擎负责识别异常与生成任务；AI仅在规则命中后，关联能效指标、趋势变化和能源分配关系生成可能原因、核查顺序与优化建议。当前能源输入${format(totals.input, 1)} tce，已关联去向${format(confirmedAmount, 1)} tce，未匹配能源${format(unmatchedEnergy, 1)} tce。`,
    evidence: [
      { label: '能源输入量', value: `${format(totals.input, 1)} tce`, note: '当前统计范围能源输入' },
      { label: '能源平衡率', value: `${format(confirmationRate, 2)}%`, note: '已关联去向 ÷ 能源输入量' },
      { label: '重点异常对象', value: `${diagnosticRows.length} 个`, note: '存在异常诊断结果的用能单元' },
      { label: '未匹配能源', value: `${format(unmatchedEnergy, 1)} tce`, note: '输入但未完成明确归属或分配' },
    ],
    actionLabel: '下一步行动',
    priorityAction: topIssue
      ? `先核对${topIssue.energyUnitName}的能源记录、产量和分配情况；确认数据无误后，再结合生产负荷调整工艺、设备运行参数和用能安排。`
      : '保持当前数据维护频率，并持续关注重点设备运行负荷和单位产出能耗变化。',
    uncertainty: '未匹配能源用于管理分析，不直接等同于物理损失；AI输出仅基于当前数据快照，原因仍需结合现场运行参数确认。',
    inputs: ['能效指标', '同比', '能源输入', '能源分配', '能效对标', '趋势变化'],
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
    const next = { year, period, month };
    setApplied(next);
    setTaskStatuses(listBalanceTaskStatuses({ year, grain: period, month }));
    setTaskRecords(listBalanceTaskRecords({ year, grain: period, month }));
    navigate({ pathname: '/asset-strategy/balance', search: `?${new URLSearchParams({ year: String(year), grain: period, month: String(month) })}` }, { replace: true });
    setAiVersion((value) => value + 1);
    notify('已按当前条件更新能效平衡分析');
  };

  const resetFilters = () => {
    setYear(2026);
    setPeriod('month');
    setMonth(6);
    setApplied({ year: 2026, period: 'month', month: 6 });
    setTaskStatuses(listBalanceTaskStatuses({ year: 2026, grain: 'month', month: 6 }));
    setTaskRecords(listBalanceTaskRecords({ year: 2026, grain: 'month', month: 6 }));
    navigate('/asset-strategy/balance', { replace: true });
    setAiVersion((value) => value + 1);
    notify('筛选条件已重置');
  };

  const openDiagnosis = (row: UnitBalanceRow, mode?: DiagnosisMode) => {
    const nextMode = mode ?? (row.dataCompletenessStatus === 'incomplete'
      ? 'data'
      : row.benchmarkDeviation !== null && (benchmarkGap(row) ?? 0) >= ENERGY_DEVIATION_ATTENTION
        ? 'benchmark'
        : 'trend');
    if (nextMode === 'data') {
      const dataIssue = buildDiagnosticIssues(row).find((issue) => ['ENERGY_RECORD_MISSING', 'ENERGY_NUMERATOR_MISSING', 'OPERATION_DENOMINATOR_MISSING', 'METRIC_PERIOD_INCOMPLETE'].includes(issue.code));
      const path = dataIssue?.actionCode === 'GO_OPERATION_DATA'
        ? '/data-management/operations'
        : dataIssue?.actionCode === 'GO_INTENSITY'
          ? '/energy-analysis/intensity'
          : '/data-management/energy-data';
      navigateFromDiagnosis(path, row);
      return;
    }
    setSelectedDiagnosisMode(nextMode);
    setSelectedUnit(row);
  };
  const openTracking = (row: UnitBalanceRow) => {
    setSelectedUnit(null);
    const signal = diagnosticSignals(row);
    setSelectedTrackingUnit({
      energyUnitId: row.energyUnitId,
      energyUnitName: row.energyUnitName,
      unitType: row.unitType,
      intensityMetricName: row.intensityMetricName,
      issueSource: diagnosticSource(row),
      issueType: signal.issue === '能流异常' ? '能源分配缺失' : signal.issue === '能效偏离' ? '能效对标偏离' : signal.issue,
      evidence: diagnosisBasis(row),
      action: optimizationDirection(row),
    });
  };
  const openEnterpriseTracking = () => {
    setSelectedUnit(null);
    setSelectedTrackingUnit({
      energyUnitId: ENTERPRISE_BALANCE_ID,
      energyUnitName: '全企业',
      unitType: '企业级问题',
      intensityMetricName: '能源平衡',
      issueSource: '能源平衡',
      issueType: '能源分配异常',
      evidence: `未匹配能源 ${format(unmatchedEnergy, 1)} tce`,
      action: '核对能源分配、终端利用和外部输出记录',
    });
  };
  const saveTaskProgressById = (energyUnitId: string, energyUnitName: string, record: BalanceTaskRecord) => {
    const savedRecord = saveBalanceTaskRecord(analysisPeriod, energyUnitId, record);
    setTaskRecords((current) => ({ ...current, [energyUnitId]: savedRecord }));
    setTaskStatuses((current) => ({ ...current, [energyUnitId]: savedRecord.status }));
    notify(`${energyUnitName}处理进展已保存`);
  };
  const navigateFromDiagnosis = (path: string, targetRow?: UnitBalanceRow) => {
    const targetUnitId = targetRow?.energyUnitId ?? selectedUnit?.energyUnitId ?? 'enterprise';
    const params = new URLSearchParams({
      year: String(applied.year),
      grain: applied.period,
      month: String(applied.month),
      scope: targetUnitId,
      returnTo: `/asset-strategy/balance?${new URLSearchParams({ year: String(applied.year), grain: applied.period, month: String(applied.month) })}`,
    });
    if (path === '/energy-analysis/benchmarking') {
      params.set('objectType', 'unit');
      params.set('objectId', targetUnitId);
    }
    if (path === '/data-management/energy-data') params.set('energyUnitId', targetUnitId);
    if (path === '/data-management/operations') params.set('energyUnitId', targetUnitId);
    if (path === '/energy-analysis/intensity') params.set('objectId', targetUnitId);
    setSelectedUnit(null);
    navigate(`${path}?${params}`);
  };

  return <Page toast={toast}>
    <BalanceFilters
      period={period}
      year={year}
      setPeriod={setPeriod}
      month={month}
      setMonth={setMonth}
      onQuery={applyFilters}
      onReset={resetFilters}
    />
    <div className={`${styles.kpiThree} ${styles.balanceKpiThree}`}>
      <Kpi label="能源输入量" value={format(totals.input, 1)} unit="tce" sub={<>当前统计范围内的能源输入</>} />
      <Kpi label="能源平衡率" value={format(confirmationRate, 2)} unit="%" sub={<>已确认去向 ÷ 能源输入量</>} />
      <Kpi label="待处理问题" value={String(exceptionCount)} unit="个" danger={exceptionCount > 0} sub={<>当前统计范围内未完成的问题</>} />
    </div>
    <div className={`${styles.twoColumns} ${styles.balanceColumns}`}>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>能源分配平衡概览</h2>
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
        <BalanceIssueHint unmatched={unmatchedEnergy} />
      </section>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>能效与能耗指标诊断摘要</h2>
        </div>
        <EnergyDiagnosisPanel rows={visibleUnitRows} onOpen={openDiagnosis} />
      </section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}>
      <div className={styles.panelHead}>
        <h2>异常问题清单</h2>
      </div>
      <UnitBalanceTable
        rows={diagnosticRows}
        taskStatuses={taskStatuses}
        enterpriseFlow={unmatchedEnergy > 0 ? { amount: unmatchedEnergy, status: enterpriseFlowStatus } : undefined}
        onOpenTracking={openTracking}
        onEnterpriseTracking={openEnterpriseTracking}
      />
    </section>
    <AssetAiAnalysis analysisKey="balance" invalidationVersion={aiVersion} notify={notify} configOverride={aiConfig} />
    {selectedUnit && <BalanceDiagnosisDrawer
      selection={selectedUnit}
      mode={selectedDiagnosisMode}
      period={analysisPeriod}
      onClose={() => setSelectedUnit(null)}
      onNavigate={navigateFromDiagnosis}
    />}
    {selectedTrackingUnit && <BalanceTrackingModal
      selection={selectedTrackingUnit}
      period={analysisPeriod}
      taskRecord={taskRecords[selectedTrackingUnit.energyUnitId] ?? { status: '待核查', handlingNote: '', completionEvidence: '' }}
      onClose={() => setSelectedTrackingUnit(null)}
      onSaveTaskRecord={(record) => saveTaskProgressById(selectedTrackingUnit.energyUnitId, selectedTrackingUnit.energyUnitName, record)}
    />}
  </Page>;
}

function BalanceFilters({
  period,
  year,
  setPeriod,
  month,
  setMonth,
  onQuery,
  onReset,
}: {
  period: 'month' | 'year';
  year: number;
  setPeriod: (period: 'month' | 'year') => void;
  month: number;
  setMonth: (month: number) => void;
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
    <Field label="年份"><select value={year} disabled><option value={year}>{year}年</option></select></Field>
    {period === 'month' && <Field label="月份"><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthLabels.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}</select></Field>}
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
    <svg viewBox="0 0 820 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="能源平衡诊断概览">
      <path className={styles.balanceFlowTotal} d="M200 135 C252 135 270 137 320 137" />
      <path className={styles.balanceFlowProduction} d="M480 110 C545 110 554 34 630 34" />
      <path className={styles.balanceFlowAux} d="M480 125 C545 125 558 92 630 92" />
      <path className={styles.balanceFlowAux} d="M480 140 C548 140 560 150 630 150" />
      <path className={styles.balanceFlowExternal} d="M480 155 C548 155 560 208 630 208" />
      <path className={styles.balanceFlowWarn} d="M200 165 C380 165 454 266 630 266" />
      <g className={`${styles.balanceNode} ${styles.balanceInputNode}`}>
        <rect x="20" y="91" width="180" height="112" rx="14" />
        <text x="42" y="126">能源输入量</text>
        <text className={styles.balanceNodeValue} x="42" y="165">{format(input, 1)}<tspan className={styles.balanceNodeUnit} dx="7">tce</tspan></text>
      </g>
      <g className={`${styles.balanceNode} ${styles.balanceConfirmedNode}`}>
        <rect x="320" y="91" width="160" height="92" rx="13" />
        <text x="342" y="126">已确认去向</text>
        <text className={styles.balanceNodeValueSmall} x="342" y="158">{format(confirmed, 1)} tce</text>
      </g>
      <BalanceOverviewNode x={630} y={10} label="生产系统" value={production} tone="blue" />
      <BalanceOverviewNode x={630} y={68} label="动力系统" value={power} tone="green" />
      <BalanceOverviewNode x={630} y={126} label="辅助系统" value={auxiliary} tone="green" />
      <BalanceOverviewNode x={630} y={184} label="外供输出" value={external} tone="orange" />
      <BalanceOverviewNode x={630} y={242} label="未匹配能源" value={unmatched} tone="red" />
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
    <rect x={x} y={y} width="168" height="48" rx="11" />
    <text x={x + 16} y={y + 19}>{label}</text>
    <text className={styles.balanceNodeValueSmall} x={x + 16} y={y + 39}>{format(value, 1)} tce</text>
  </g>;
}

function BalanceIssueHint({ unmatched }: { unmatched: number }) {
  return <div className={styles.balanceIssueHint}>
    <b>{unmatched > 0 ? `全企业未匹配能源 ${format(unmatched, 1)} tce` : '全企业能源分配已完成匹配'}</b>
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
      const trendRisk = Math.max(Math.abs(row.intensityYoYDeviation ?? 0), Math.abs(row.intensityMoMDeviation ?? 0));
      const primary = benchmark !== null && (benchmarkGap(row) ?? 0) >= ENERGY_DEVIATION_ATTENTION
        ? '能效对标偏离'
        : row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10
          ? '能源分配缺失'
          : trendRisk >= ENERGY_DEVIATION_ATTENTION
            ? '能耗波动异常'
            : '能耗强度偏高';
      const priority = signal.priority;
      return <button type="button" key={row.energyUnitId} onClick={() => onOpen(row)}>
        <b title={`${row.energyUnitName}｜${row.unitType}`}><i style={{ background: colors[index] }}>{index + 1}</i>{row.energyUnitName}</b>
        <Tag tone={primary === '能效对标偏离' ? 'red' : primary === '能源分配缺失' ? 'orange' : 'blue'}>{primary}</Tag>
        <strong className={benchmark !== null && Math.abs(benchmark) >= ENERGY_DEVIATION_ATTENTION ? styles.rankDanger : ''}>{benchmark === null ? (row.deviationRate === null ? '—' : `${row.deviationRate > 0 ? '+' : ''}${format(row.deviationRate, 1)}%`) : `${benchmark > 0 ? '+' : ''}${format(benchmark, 1)}%`}</strong>
        <span>{reviewScope(row)}</span>
        <Tag tone={priority === '高' ? 'red' : priority === '中' ? 'orange' : 'gray'}>{priority}</Tag>
      </button>;
    }) : <div className={styles.rankEmpty}>当前范围暂无具备明确优化信号的对象。</div>}
    {pendingCount > 0 && <div className={styles.rankEmpty}>另有 {pendingCount} 个对象未达到重点优化筛选条件。</div>}
  </div>;
}

function EnergyDiagnosisPanel({
  rows,
  onOpen,
}: {
  rows: UnitBalanceRow[];
  onOpen: (row: UnitBalanceRow, mode?: DiagnosisMode) => void;
}) {
  const benchmarkIssueRows = rows.filter((row) => row.benchmarkDeviation !== null && (benchmarkGap(row) ?? 0) >= ENERGY_DEVIATION_ATTENTION);
  const trendIssueRows = rows.filter(trendNeedsAction);
  const dataRows = rows.filter((row) => row.dataCompletenessStatus === 'incomplete');
  const groups = [
    {
      key: 'benchmark',
      label: '能效对标诊断',
      tone: 'blue',
      rows: benchmarkIssueRows.slice(0, 1),
      total: benchmarkIssueRows.length,
      empty: '当前期间暂无可用能效对标数据',
      detail: (row: UnitBalanceRow) => row.benchmarkDeviation === null
        ? `${row.intensityMetricName} · 未配置目标`
        : `${row.benchmarkMetricName} · 对标${row.benchmarkDeviation > 0 ? '+' : ''}${format(row.benchmarkDeviation, 1)}%`,
    },
    {
      key: 'trend',
      label: '能耗指标变化',
      tone: 'orange',
      rows: trendIssueRows.slice(0, 1),
      total: trendIssueRows.length,
      empty: '当前期间暂无可用同比/环比数据',
      detail: (row: UnitBalanceRow, _summary: boolean) => {
        const trends = [
          row.intensityYoYDeviation === null ? null : `同比${row.intensityYoYDeviation > 0 ? '+' : ''}${format(row.intensityYoYDeviation, 1)}%`,
          row.intensityMoMDeviation === null ? null : `环比${row.intensityMoMDeviation > 0 ? '+' : ''}${format(row.intensityMoMDeviation, 1)}%`,
        ].filter(Boolean).join(' · ') || '同比/环比暂无对比';
        return `${row.intensityMetricName} · ${trends}`;
      },
    },
    {
      key: 'data',
      label: '数据完整性问题',
      tone: 'purple',
      rows: dataRows.slice(0, 3),
      total: dataRows.length,
      summary: false,
      empty: '当前未发现数据完整性异常',
      detail: (row: UnitBalanceRow, _summary: boolean) => row.dataCompletenessReason,
    },
  ].filter((group) => group.rows.length > 0);

  return <div className={styles.energyDiagnosisPanel}>
    {groups.map((group, index) => {
      const total = group.total;
      return <section key={group.key} className={styles.energyDiagnosisGroup}>
      <div className={styles.energyDiagnosisGroupHead}><b className={`${styles.energyDiagnosisBadge} ${styles[`energyDiagnosis${group.tone}`]}`}>{String.fromCharCode(65 + index)}</b><strong>{group.label}</strong></div>
      {group.rows.length ? group.rows.slice(0, 1).map((row) => <div className={styles.energyDiagnosisRow} key={row.energyUnitId}>
        <span>{row.energyUnitName}</span><em>{group.detail(row, false)}</em><Tag tone={diagnosticSignals(row).priority === '高' ? 'red' : diagnosticSignals(row).priority === '中' ? 'orange' : 'gray'}>{diagnosticSignals(row).priority}</Tag><button type="button" className={styles.energyDiagnosisAction} onClick={() => onOpen(row, group.key as DiagnosisMode)}>{group.key === 'data' ? '补充数据' : '查看详情'}</button>
      </div>) : <p className={styles.energyDiagnosisEmpty}>{group.empty}</p>}
      {total > 1 && <button type="button" className={styles.energyDiagnosisMore} onClick={() => document.querySelector(`.${styles.tableCard}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>其余 {total - 1} 个对象已汇总到下方清单 <span>查看清单 ↓</span></button>}
    </section>;
    })}
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
      const severity = Math.abs(deviation ?? 0) >= ENERGY_DEVIATION_HIGH ? '高异常' : Math.abs(deviation ?? 0) >= ENERGY_DEVIATION_ATTENTION ? '关注' : '正常波动';
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

function taskStatusTone(status: BalanceTaskStatus): 'green' | 'blue' | 'orange' {
  if (status === '已完成') return 'green';
  if (status === '处理中') return 'blue';
  return 'orange';
}

function benchmarkGap(row: UnitBalanceRow) {
  if (row.benchmarkDeviation === null) return null;
  return row.benchmarkDirection === 'high' ? -row.benchmarkDeviation : row.benchmarkDeviation;
}

function trendRisk(row: UnitBalanceRow) {
  return Math.max(Math.abs(row.intensityYoYDeviation ?? 0), Math.abs(row.intensityMoMDeviation ?? 0));
}

function trendNeedsAction(row: UnitBalanceRow) {
  const risk = trendRisk(row);
  // 摘要诊断需要保留当前周期的异常追踪；连续周期用于判断严重程度，
  // 不应阻止单次已超过关注阈值的同比/环比异常进入问题摘要。
  return risk >= ENERGY_DEVIATION_ATTENTION;
}

function diagnosticSignals(row: UnitBalanceRow) {
  const flowAbnormal = row.energyInputStandardAmount > 0 && Math.abs(row.deviationRate ?? 0) > 10;
  const flowAttention = row.energyInputStandardAmount > 0 && !flowAbnormal && Math.abs(row.deviationRate ?? 0) > 5;
  const benchmarkDeviation = row.benchmarkDeviation;
  const benchmarkRisk = benchmarkDeviation === null ? null : benchmarkGap(row);
  const benchmarkAbnormal = benchmarkRisk !== null && benchmarkRisk >= ENERGY_DEVIATION_HIGH;
  const benchmarkAttention = benchmarkRisk !== null && benchmarkRisk >= ENERGY_DEVIATION_ATTENTION;
  const trendMagnitude = trendRisk(row);
  const trendAbnormal = trendMagnitude >= ENERGY_DEVIATION_HIGH;
  const trendAttention = trendNeedsAction(row);
  const flowLabel = row.energyInputStandardAmount <= 0 ? '待完善' : flowAbnormal ? '未闭合' : flowAttention ? '需关注' : '基本闭合';
  const benchmarkLabel = benchmarkDeviation === null
    ? row.dataCompletenessStatus === 'incomplete' ? '指标数据缺失' : '未配置目标'
    : benchmarkAbnormal ? '明显偏离' : benchmarkAttention ? '轻度偏离' : '正常波动';
  const issueParts = [
    flowAbnormal || flowAttention ? '能源分配异常' : '',
    benchmarkAbnormal || benchmarkAttention ? '能效对标偏离' : '',
    trendAbnormal || trendAttention ? '能耗波动异常' : '',
    row.dataCompletenessStatus === 'incomplete' ? '数据完整性异常' : '',
  ].filter(Boolean);
  const issue = issueParts.length ? issueParts.join(' + ') : '暂无明显异常';
  const priority = benchmarkAbnormal || trendAbnormal || issueParts.length >= 2 || benchmarkAbnormal && flowAbnormal
    ? '高'
    : issueParts.length ? '中' : '低';
  return { flowLabel, benchmarkLabel, issue, priority };
}

function buildDiagnosticIssues(row: UnitBalanceRow): DiagnosticIssue[] {
  const signal = diagnosticSignals(row);
  const issues: DiagnosticIssue[] = [];

  // Object-level balance is not enabled in phase one. Keep this branch as a
  // future rule contract, but do not generate it from the enterprise-only
  // balance result used by the current page.
  if (signal.flowLabel === '未闭合' || signal.flowLabel === '需关注') {
    issues.push({
      code: 'OBJECT_BALANCE_REVIEW',
      evidence: `未匹配能源 ${format(Math.abs(row.balanceDifferenceStandardAmount), 1)} tce，占对象输入 ${format(Math.abs(row.deviationRate ?? 0), 1)}%`,
      action: '核查能源归属、分配记录与计量来源',
      actionCode: 'REVIEW_FLOW',
    });
  }

  if (row.dataCompletenessStatus === 'incomplete') {
    const reason = row.dataCompletenessReason;
    if (reason.includes('未找到能源消费记录')) {
      issues.push({
        code: 'ENERGY_RECORD_MISSING',
        evidence: reason,
        action: '确认该对象是否应采集能源数据；如应采集，请补录当前期间能源消费记录',
        actionCode: 'GO_ENERGY_DATA',
      });
    } else if (reason.includes('运营分母') || reason.includes('蒸汽产量')) {
      issues.push({
        code: 'OPERATION_DENOMINATOR_MISSING',
        evidence: reason,
        action: '补充产量、产值等适用运营分母；如不适用，请维护指标适用性',
        actionCode: 'GO_OPERATION_DATA',
      });
    } else if (reason.includes('缺少能源数据')) {
      issues.push({
        code: 'ENERGY_NUMERATOR_MISSING',
        evidence: reason,
        action: '补齐当前期间能源消费数据，并重新计算能耗指标',
        actionCode: 'GO_ENERGY_DATA',
      });
    } else {
      issues.push({
        code: 'METRIC_PERIOD_INCOMPLETE',
        evidence: reason,
        action: '检查能源分子、运营分母和指标配置后重新计算',
        actionCode: 'GO_INTENSITY',
      });
    }
  }

  if ((benchmarkGap(row) ?? 0) >= ENERGY_DEVIATION_ATTENTION && row.benchmarkDeviation !== null) {
    const risk = benchmarkGap(row) ?? 0;
    issues.push({
      code: 'BENCHMARK_DEVIATION',
      evidence: `${row.benchmarkMetricName === '—' ? row.intensityMetricName : row.benchmarkMetricName}不利对标偏差 ${format(risk, 1)}%`,
      action: '核对指标目标、统计期间和计算口径，再结合生产负荷与设备状态分析',
      actionCode: 'GO_BENCHMARK',
    });
  }

  const trendValues = [
    row.intensityYoYDeviation === null ? null : { label: '同比', value: row.intensityYoYDeviation },
    row.intensityMoMDeviation === null ? null : { label: '环比', value: row.intensityMoMDeviation },
  ].filter((item): item is { label: string; value: number } => item !== null && Math.abs(item.value) >= ENERGY_DEVIATION_ATTENTION);
  if (trendNeedsAction(row) && trendValues.length) {
    issues.push({
      code: 'INTENSITY_TREND_DEVIATION',
      evidence: `${row.intensityMetricName}${trendValues.map((item) => `${item.label}${item.value >= 0 ? '+' : ''}${format(item.value, 1)}%`).join('、')}`,
      action: '核对指标分子、分母和统计期间，再结合生产负荷分析变化原因',
      actionCode: 'GO_INTENSITY',
    });
  }

  return issues;
}

function diagnosisBasis(row: UnitBalanceRow) {
  const issues = buildDiagnosticIssues(row);
  return issues.length ? issues.map((issue) => issue.evidence).join('、') : '暂无完整依据';
}

function optimizationDirection(row: UnitBalanceRow) {
  const issue = buildDiagnosticIssues(row)[0];
  if (issue) return issue.action;
  return '关注后续周期能耗强度及运行变化';
}

function diagnosticSource(row: UnitBalanceRow) {
  const codes = new Set(buildDiagnosticIssues(row).map((issue) => issue.code));
  const sources: string[] = [];
  if (codes.has('OBJECT_BALANCE_REVIEW')) sources.push('能源平衡');
  if (codes.has('BENCHMARK_DEVIATION')) sources.push('能效对标');
  if (codes.has('INTENSITY_TREND_DEVIATION')) sources.push('能耗指标');
  if (['ENERGY_RECORD_MISSING', 'ENERGY_NUMERATOR_MISSING', 'OPERATION_DENOMINATOR_MISSING', 'METRIC_PERIOD_INCOMPLETE'].some((code) => codes.has(code as DiagnosticIssueCode))) {
    sources.push('数据完整性');
  }
  return sources.join('、') || '能效诊断';
}

function UnitBalanceTable({
  rows,
  taskStatuses,
  enterpriseFlow,
  onOpenTracking,
  onEnterpriseTracking,
}: {
  rows: UnitBalanceRow[];
  taskStatuses: Record<string, BalanceTaskStatus>;
  enterpriseFlow?: { amount: number; status: BalanceTaskStatus };
  onOpenTracking: (row: UnitBalanceRow) => void;
  onEnterpriseTracking: () => void;
}) {
  const hasRows = Boolean(enterpriseFlow) || rows.length > 0;
  return <div className={styles.tableWrap}><table className={styles.diagnosisTable}><thead><tr>
    <th>对象</th><th>对象类型</th><th>问题来源</th><th>问题类型</th><th>诊断依据</th><th>建议动作</th><th>处理进展</th>
  </tr></thead><tbody>{hasRows ? <>
    {enterpriseFlow && <tr key={ENTERPRISE_BALANCE_ID}>
      <td className={styles.diagnosisObject}>全企业</td>
      <td>企业级问题</td>
      <td>能源平衡</td>
      <td><Tag tone="red">能源分配异常</Tag></td>
      <td>未匹配能源 {format(enterpriseFlow.amount, 1)} tce</td>
      <td>核对能源分配、终端利用和外部输出记录</td>
      <td><button type="button" className={`${styles.diagnosisStatusButton} ${taskStatusButtonClass(enterpriseFlow.status)}`} aria-label={`${enterpriseFlow.status}，打开核查详情`} onClick={onEnterpriseTracking}>{taskStatusActionLabel(enterpriseFlow.status)}</button></td>
    </tr>}
    {rows.map((row) => {
      const signal = diagnosticSignals(row);
      const issueTone = signal.issue.includes('异常') || signal.issue.includes('偏离') ? 'red' : signal.issue.includes('缺少') || signal.issue.includes('待') ? 'orange' : 'green';
      const status = taskStatuses[row.energyUnitId] ?? '待核查';
      return <tr key={row.energyUnitId}>
        <td className={styles.diagnosisObject}>{row.energyUnitName}</td>
        <td>{row.unitType}</td>
        <td>{diagnosticSource(row)}</td>
        <td><Tag tone={issueTone}>{signal.issue === '能流异常' ? '能源分配缺失' : signal.issue === '能效偏离' ? '能效对标偏离' : signal.issue}</Tag></td>
        <td>{diagnosisBasis(row)}</td>
        <td>{optimizationDirection(row)}</td>
        <td><button type="button" className={`${styles.diagnosisStatusButton} ${taskStatusButtonClass(status)}`} aria-label={`${status}，打开核查详情`} onClick={() => onOpenTracking(row)}>{taskStatusActionLabel(status)}</button></td>
      </tr>;
    })}
  </> : <tr><td colSpan={7} className={styles.emptyCell}>当前范围暂无待跟进的异常问题</td></tr>}</tbody></table></div>;
}

function taskStatusActionLabel(status: BalanceTaskStatus) {
  if (status === '待核查') return '去核查';
  if (status === '处理中') return '查看进展';
  return '查看结果';
}

function taskStatusButtonClass(status: BalanceTaskStatus) {
  if (status === '待核查') return styles.diagnosisStatusPending;
  if (status === '处理中') return styles.diagnosisStatusProcessing;
  return styles.diagnosisStatusCompleted;
}



function BalanceDiagnosisDrawer({
  selection,
  mode,
  period,
  onClose,
  onNavigate,
}: {
  selection: UnitBalanceRow;
  mode: DiagnosisMode;
  period: FlowPeriod;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const issues = buildDiagnosticIssues(selection);
  const dataIssue = issues.find((issue) => ['ENERGY_RECORD_MISSING', 'ENERGY_NUMERATOR_MISSING', 'OPERATION_DENOMINATOR_MISSING', 'METRIC_PERIOD_INCOMPLETE'].includes(issue.code));
  const metricIssue = issues.find((issue) => issue.code === (mode === 'benchmark' ? 'BENCHMARK_DEVIATION' : 'INTENSITY_TREND_DEVIATION'));
  const isDataMode = mode === 'data' || Boolean(dataIssue);
  const isBenchmarkMode = mode === 'benchmark' && !isDataMode;
  const benchmarkValue = selection.benchmarkDeviation;
  const periodText = period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
  const benchmarkMetricValue = selection.benchmarkActual === null
    ? '—'
    : `${format(selection.benchmarkActual, 2)} ${selection.benchmarkMetricUnit}`;
  const metricValue = selection.intensityMetricValue === null
    ? '—'
    : `${format(selection.intensityMetricValue, 2)} ${selection.intensityMetricUnit}`;
  const deviationValue = [
    selection.intensityYoYDeviation === null ? null : `同比${selection.intensityYoYDeviation >= 0 ? '+' : ''}${format(selection.intensityYoYDeviation, 1)}%`,
    selection.intensityMoMDeviation === null ? null : `环比${selection.intensityMoMDeviation >= 0 ? '+' : ''}${format(selection.intensityMoMDeviation, 1)}%`,
  ].filter(Boolean).join(' · ') || '—';
  const benchmarkDeviationValue = benchmarkValue === null
    ? '—'
    : `${benchmarkValue >= 0 ? '+' : ''}${format(benchmarkValue, 1)}%`;
  const currentValueText = isBenchmarkMode
    ? selection.benchmarkActual === null ? '当前值缺失' : `当前值 ${format(selection.benchmarkActual, 2)} ${selection.benchmarkMetricUnit}`
    : selection.intensityMetricValue === null ? '当前值缺失' : `当前值 ${format(selection.intensityMetricValue, 2)} ${selection.intensityMetricUnit}`;
  const targetValueText = selection.benchmarkTarget === null
    ? '未配置目标'
    : `${format(selection.benchmarkTarget, 2)} ${selection.benchmarkMetricUnit}`;
  const trendText = deviationValue === '—' ? '暂无可比趋势数据' : deviationValue;
  const judgement = isDataMode
    ? `${selection.dataCompletenessReason}，暂无法完成能效诊断。`
      : isBenchmarkMode
      ? `${selection.intensityMetricName}${currentValueText}；${metricIssue
        ? `较目标值 ${targetValueText} 存在不利对标偏差 ${format(Math.max(0, benchmarkGap(selection) ?? Math.abs(selection.benchmarkDeviation ?? 0)), 1)}%`
        : '尚未配置对标目标，仅展示当前指标事实'}。`
      : `${selection.intensityMetricName}${currentValueText}；同比/环比变化为 ${trendText}。该视图用于确认指标变化趋势，不直接替代对标结论。`;
  const primaryPath = dataIssue?.actionCode === 'GO_OPERATION_DATA'
    ? '/data-management/operations'
    : dataIssue?.actionCode === 'GO_INTENSITY'
      ? '/energy-analysis/intensity'
      : dataIssue
        ? '/data-management/energy-data'
        : isBenchmarkMode
          ? '/energy-analysis/benchmarking'
          : '/energy-analysis/intensity';
  const primaryLabel = isDataMode ? '去补齐数据' : isBenchmarkMode ? '查看能效对标' : '查看能耗指标';
  const modalTitle = isDataMode ? '数据完整性' : isBenchmarkMode ? '能效对标详情' : '能耗指标变化详情';
  return <Modal
    title={`${modalTitle}｜${selection.energyUnitName}`}
    width={980}
    onClose={onClose}
    footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={() => onNavigate(primaryPath)}>{primaryLabel}</Button></>}
  >
    <div className={styles.diagnosisIntro}>
      <div><span>{periodText} · {selection.unitType}{isDataMode ? '' : ` · ${isBenchmarkMode ? '能效对标' : '能耗指标变化'}`}</span><h3>{judgement}</h3></div>
    </div>
    {isDataMode ? <>
      <section className={styles.diagnosisSection}>
        <div className={styles.diagnosisSectionHead}><strong>诊断状态</strong><Tag tone="orange">待补齐</Tag></div>
        <div className={styles.diagnosisFactList}>
          <div><span>影响范围</span><b>能效指标、同比/对标判断</b></div>
        </div>
      </section>
    </> : isBenchmarkMode ? <>
      <section className={`${styles.diagnosisSection} ${styles.diagnosisBenchmarkSection}`}>
        <div className={styles.diagnosisSectionHead}><strong>指标证据</strong><span>{selection.benchmarkMetricName === '—' ? selection.intensityMetricName : selection.benchmarkMetricName}</span></div>
        <div className={`${styles.diagnosisMetricGrid} ${styles.diagnosisMetricGridBenchmark}`}>
          <div><span>当前值</span><b>{benchmarkMetricValue}</b></div>
          <div><span>对标目标</span><b>{targetValueText}</b></div>
          <div><span>对标偏差</span><b>{benchmarkDeviationValue}</b></div>
        </div>
        <IntensityTrendChart
          values={selection.benchmarkMonthlyActuals}
          target={selection.benchmarkTarget}
          targets={selection.benchmarkMonthlyTargets}
          currentMonth={12}
          benchmarkStyle
        />
      </section>
    </> : <>
      <section className={styles.diagnosisSection}>
        <div className={styles.diagnosisSectionHead}><strong>指标趋势</strong><span>{selection.intensityMetricName}</span></div>
        <div className={styles.diagnosisMetricGrid}>
          <div><span>当前值</span><b>{metricValue}</b></div>
          <div><span>同比/环比变化</span><b>{deviationValue}</b></div>
        </div>
        <IntensityTrendChart values={selection.intensityMonthlyValues} target={null} currentMonth={period.grain === 'month' ? period.month : 12} />
        <IntensityMonthlyDetailTable
          values={selection.intensityMonthlyValues}
          momChanges={selection.intensityMonthlyMomChanges}
          yoyChanges={selection.intensityMonthlyYoyChanges}
          currentMonth={period.grain === 'month' ? period.month : 12}
          unit={selection.intensityMetricUnit}
        />
      </section>
    </>}
  </Modal>;
}

function BalanceTrackingModal({
  selection,
  period,
  taskRecord,
  onClose,
  onSaveTaskRecord,
}: {
  selection: TrackingSelection;
  period: FlowPeriod;
  taskRecord: BalanceTaskRecord;
  onClose: () => void;
  onSaveTaskRecord: (record: BalanceTaskRecord) => void;
}) {
  const [trackingStatus, setTrackingStatus] = useState<BalanceTaskStatus>(taskRecord.status);
  const [handlingNote, setHandlingNote] = useState(taskRecord.handlingNote);
  const periodText = period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
  const saveTracking = () => {
    onSaveTaskRecord({
      status: trackingStatus,
      handlingNote: handlingNote.trim(),
      completionEvidence: '',
      completedAt: trackingStatus === '已完成' ? taskRecord.completedAt : undefined,
    });
    onClose();
  };
  return <Modal
    title={`问题核查｜${selection.energyUnitName}`}
    width={760}
    onClose={onClose}
    footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={saveTracking}>保存处理结果</Button></>}
  >
    <section className={`${styles.diagnosisSection} ${styles.diagnosisTrackingSection}`}>
      <div className={styles.diagnosisTrackingSectionHead}>
        <div><strong>处理记录</strong><span>{periodText} · {selection.unitType}</span></div>
        <small>记录核查结论、原因和后续安排</small>
      </div>
      <label className={styles.diagnosisTrackingField}>
        <span>核查结论 / 处理记录</span>
        <textarea value={handlingNote} onChange={(event) => setHandlingNote(event.target.value)} placeholder="例如：已核对数据口径，确认问题原因，或记录后续处理安排" rows={5} />
      </label>
      <div className={styles.diagnosisTrackingFooter}>
        <label className={styles.diagnosisTrackingField}>
          <span>处理进展</span>
          <select value={trackingStatus} onChange={(event) => setTrackingStatus(event.target.value as BalanceTaskStatus)}><option>待核查</option><option>处理中</option><option>已完成</option></select>
        </label>
        {taskRecord.completedAt && trackingStatus === '已完成' && <div className={styles.diagnosisTrackingMeta}>完成时间：{taskRecord.completedAt}</div>}
      </div>
    </section>
  </Modal>;
}

function IntensityTrendChart({ values, target, targets, currentMonth, benchmarkStyle = false }: { values: Array<number | null>; target: number | null; targets?: Array<number | null>; currentMonth: number; benchmarkStyle?: boolean }) {
  const visibleValues = values.slice(0, currentMonth);
  const points = visibleValues.map((value, index) => value === null ? null : { value, index }).filter((point): point is { value: number; index: number } => point !== null);
  if (points.length < 2) return <p className={styles.diagnosisChartEmpty}>当前期间暂无足够的月度指标数据形成趋势图。</p>;
  const visibleTargets = (targets ?? []).slice(0, currentMonth).filter((value): value is number => value !== null);
  const targetValues = visibleTargets.length ? visibleTargets : target === null ? [] : [target];
  const min = Math.min(...points.map((point) => point.value), ...targetValues);
  const max = Math.max(...points.map((point) => point.value), ...targetValues);
  const span = Math.max(max - min, 1);
  const low = benchmarkStyle ? min - span * 0.12 : min - span * 0.08;
  const high = benchmarkStyle ? max + span * 0.12 : max + span * 0.08;
  const x = (index: number) => 24 + index / Math.max(1, visibleValues.length - 1) * 452;
  const y = (value: number) => 28 + (high - value) / (high - low) * 88;
  const axisValues = benchmarkStyle
    ? [0, 0.25, 0.5, 0.75, 1].map((tick) => high - tick * (high - low))
    : [max, (max + min) / 2, min];
  const latestTarget = visibleTargets.length ? visibleTargets[visibleTargets.length - 1] : target;
  const latestPoint = points[points.length - 1];
  const targetY = latestTarget === null ? null : y(latestTarget);
  const targetLabelY = targetY === null
    ? null
    : Math.max(12, Math.min(126, targetY - (latestPoint && Math.abs(targetY - y(latestPoint.value)) < 18 ? -14 : 4)));
  return <div className={styles.diagnosisTrendChart}>
    <div className={styles.diagnosisChartLegend}><span><i className={benchmarkStyle ? styles.diagnosisChartBenchmarkActual : styles.diagnosisChartActual} />实际值</span>{targetValues.length > 0 && <span><i className={benchmarkStyle ? styles.diagnosisChartBenchmarkTarget : styles.diagnosisChartTarget} />对标目标</span>}</div>
    <svg viewBox="0 0 500 140" preserveAspectRatio="none" role="img" aria-label="能耗指标月度趋势图">
      {(benchmarkStyle ? [28, 50, 72, 94, 116] : [28, 72, 116]).map((line) => <line key={line} x1="24" x2="476" y1={line} y2={line} className={styles.diagnosisChartGrid} />)}
      {axisValues.map((value, index) => <text key={index} x="1" y={(benchmarkStyle ? [28, 50, 72, 94, 116] : [28, 72, 116])[index]} className={styles.diagnosisChartScaleLabel}>{format(value, benchmarkStyle ? 1 : 2)}</text>)}
      {targetValues.length > 0 && <polyline points={visibleTargets.length ? visibleTargets.map((value, index) => `${x(index)},${y(value)}`).join(' ') : `24,${y(target!)}` } className={benchmarkStyle ? styles.diagnosisChartBenchmarkTargetLine : styles.diagnosisChartTargetLine} />}
      {targetValues.length > 0 && targetLabelY !== null && <text x="476" y={targetLabelY} textAnchor="end" className={benchmarkStyle ? styles.diagnosisChartBenchmarkTargetLabel : styles.diagnosisChartTargetLabel}>{benchmarkStyle ? '年度目标' : '目标'} {format(latestTarget!, 2)}</text>}
      <polyline points={points.map((point) => `${x(point.index)},${y(point.value)}`).join(' ')} className={benchmarkStyle ? styles.diagnosisChartBenchmarkLine : styles.diagnosisChartLine} />
      {points.map((point) => <g key={point.index}><circle cx={x(point.index)} cy={y(point.value)} r={benchmarkStyle ? 3.5 : 3} className={benchmarkStyle ? styles.diagnosisChartBenchmarkDot : styles.diagnosisChartDot} />{benchmarkStyle && <text x={x(point.index)} y={Math.max(12, y(point.value) - 7)} textAnchor="middle" className={styles.diagnosisChartPointLabel}>{format(point.value, 1)}</text>}</g>)}
    </svg>
    <div className={styles.diagnosisChartAxis} style={{ gridTemplateColumns: `repeat(${visibleValues.length}, minmax(0, 1fr))` }}>{visibleValues.map((_, index) => <span key={index}>{index + 1}月</span>)}</div>
  </div>;
}

function IntensityMonthlyDetailTable({
  values,
  momChanges,
  yoyChanges,
  currentMonth,
  unit,
}: {
  values: Array<number | null>;
  momChanges: Array<number | null>;
  yoyChanges: Array<number | null>;
  currentMonth: number;
  unit: string;
}) {
  const rows = values.slice(0, currentMonth).map((value, index) => ({ value, mom: momChanges[index] ?? null, yoy: yoyChanges[index] ?? null, index }));
  return <div className={styles.diagnosisDetailTableWrap}>
    <div className={styles.diagnosisDetailTableTitle}>月度明细</div>
    <table className={styles.diagnosisDetailTable}><thead><tr><th>月份</th><th>指标值（{unit}）</th><th>环比</th><th>同比</th><th>变化状态</th></tr></thead><tbody>
      {rows.map((row) => {
        const risk = Math.max(Math.abs(row.mom ?? 0), Math.abs(row.yoy ?? 0));
        const status = risk >= ENERGY_DEVIATION_HIGH ? '高风险' : risk >= ENERGY_DEVIATION_ATTENTION ? '关注' : '正常';
        return <tr key={row.index}><td>{monthLabels[row.index]}</td><td>{row.value === null ? '—' : format(row.value, 2)}</td><td className={row.mom !== null && Math.abs(row.mom) >= ENERGY_DEVIATION_ATTENTION ? styles.diagnosisValueDanger : ''}>{row.mom === null ? '—' : `${row.mom >= 0 ? '+' : ''}${format(row.mom, 1)}%`}</td><td className={row.yoy !== null && Math.abs(row.yoy) >= ENERGY_DEVIATION_ATTENTION ? styles.diagnosisValueDanger : ''}>{row.yoy === null ? '—' : `${row.yoy >= 0 ? '+' : ''}${format(row.yoy, 1)}%`}</td><td><Tag tone={status === '高风险' ? 'red' : status === '关注' ? 'orange' : 'green'}>{status}</Tag></td></tr>;
      })}
    </tbody></table>
  </div>;
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
  const judgement = selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= ENERGY_DEVIATION_HIGH
    ? `${selection.energyUnitName}的${selection.intensityMetricName}${selection.intensityDeviationLabel}${format(selection.intensityDeviation, 1)}%，已达到高关注阈值，应先核对指标分子、分母、统计期间和运行负荷。`
    : selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= ENERGY_DEVIATION_ATTENTION
      ? `${selection.energyUnitName}的${selection.intensityMetricName}${selection.intensityDeviationLabel}${format(selection.intensityDeviation, 1)}%，建议结合平衡影响量和主要耗能环节进一步核查。`
      : selection.status === '异常'
        ? `${selection.energyUnitName}当前未匹配能源占输入的 ${format(selection.deviationRate ?? 0, 1)}%，应先核对能源记录、统计期间和分配关系。`
    : selection.status === '关注'
      ? `${selection.energyUnitName}当前未匹配能源为 ${format(selection.balanceDifferenceStandardAmount, 1)} tce，建议关注能源分配记录和主要用能环节。`
      : selection.status === '待完善'
        ? `${selection.energyUnitName}当前期间的能源输入或终端利用数据尚不完整，暂无法形成有效平衡判断。`
        : `${selection.energyUnitName}的能源输入与已确认去向总体稳定。`;
  const actions = selection.intensityDeviation !== null && Math.abs(selection.intensityDeviation) >= ENERGY_DEVIATION_ATTENTION
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
