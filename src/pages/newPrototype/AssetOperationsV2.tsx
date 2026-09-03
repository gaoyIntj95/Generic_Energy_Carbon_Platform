/* eslint-disable no-irregular-whitespace */
import { useMemo, useState, type ReactNode } from 'react';
import {
  getBudgetTarget,
  latestCarbonSnapshot,
  listCarbonAssets,
  saveBudgetTarget,
  saveCarbonAsset,
} from '../../mocks/platformMockStore';
import {
  buildFlowAnalysisDataset,
  type FlowLevelOneBalanceRow,
  type FlowLevelTwoBalanceRow,
  type FlowPeriod,
  type FlowViewLevel,
} from '../../mocks/energyFlowSelector';
import {
  DEMO_ORGANIZATION_ID,
  listEnergyUnits,
} from '../../mocks/energyUnitMockStore';
import { listV11EnergyCosts } from '../../mocks/dataManagementV11Store';
import { listV11OperationMetrics } from '../../mocks/dataManagementV11Store';
import { buildEnergyQueryDataset } from '../../mocks/energyQuerySelector';
import { buildIntensityCalculationView } from '../../mocks/energyIntensitySelector';
import type { BudgetType, CarbonAsset, CarbonAssetType } from '../../types/platformDomain';
import { Button, Drawer, Field, Modal, Tag, Toast } from './PrototypeUI';
import { AssetAiAnalysis } from './AssetAiAnalysis';
import { BalanceOptimizationPage, buildStrategyEfficiencySignals } from './BalanceOptimizationPage';
import styles from './AssetOperationsV2.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const scopes = ['全企业', '生产车间A', '生产车间B', '动力中心', '仓储物流区域', '办公区域'];
const ENERGY_CHANGE_ATTENTION = 8;

const strategyActionLabels = {
  COMPLETE_DATA: '完善数据',
  GO_ENERGY_DATA: '核查能源数据',
  GO_OPERATION_DATA: '核查运营数据',
  GO_INTENSITY: '查看能耗指标',
  GO_BENCHMARK: '查看能效对标',
  VIEW_DETAIL: '查看问题详情',
} as const;

type BudgetTrend = { actual: number[]; forecast: number[] };
type BudgetRow = readonly [string, number | null, number, number, string | null];

export type CarbonForecastScenario = {
  productionChange: number;
  productIntensityChange: number;
  industryBalanceChange: number;
};

export type IndustryAllocationRule = {
  ruleId: string;
  applicableIndustry: string;
  referenceYear: number;
  ruleVersion: string;
  allocationMethod: string;
  deviationRule: string;
  coefficientRule: string;
  coefficientMin: number;
  coefficientMax: number;
  source: string;
  status: string;
  calculateAlpha: (intensityDeviation: number) => number;
};

const steelCementAluminiumAllocationRule: IndustryAllocationRule = {
  ruleId: 'steel-cement-aluminium-2026-consultation',
  applicableIndustry: '钢铁 / 水泥 / 铝冶炼',
  referenceYear: 2026,
  ruleVersion: '2026年度配额方案征求意见稿',
  allocationMethod: '强度基准法',
  deviationRule: 'X =（行业平衡值 − 企业预计排放强度）÷ 行业平衡值',
  coefficientRule: '−20% < X < 20% 时 α = 0.15 × X；X ≥ 20% 时 α = +3%；X ≤ −20% 时 α = −3%',
  coefficientMin: -0.03,
  coefficientMax: 0.03,
  source: '生态环境部2026年度配额方案征求意见稿（待正式发布）',
  status: '征求意见稿·非正式核定规则',
  calculateAlpha: (intensityDeviation) => intensityDeviation >= 0.2
    ? 0.03
    : intensityDeviation <= -0.2
      ? -0.03
      : 0.15 * intensityDeviation,
};

const genericScenarioAllocationRule: IndustryAllocationRule = {
  ...steelCementAluminiumAllocationRule,
  ruleId: 'generic-intensity-scenario-v2',
  applicableIndustry: '通用工业企业（规则待匹配）',
  ruleVersion: '参考上一年度规则',
  source: '平台情景估算规则（非正式核定）',
  status: '情景估算',
};

export function getIndustryAllocationRule(industry?: string): IndustryAllocationRule | null {
  if (industry && ['钢铁', '水泥', '铝冶炼'].some((name) => industry.includes(name))) {
    return steelCementAluminiumAllocationRule;
  }
  return genericScenarioAllocationRule;
}

export function calculateCarbonForecast({
  baseProduction,
  baseUnitProductIntensity,
  baseIndustryBalance,
  carryoverAssets,
  industryAllocationRule,
  manualExpectedQuota,
  scenario,
}: {
  baseProduction: number;
  baseUnitProductIntensity: number;
  baseIndustryBalance: number;
  carryoverAssets: number;
  industryAllocationRule: IndustryAllocationRule | null;
  manualExpectedQuota?: number;
  scenario: CarbonForecastScenario;
}) {
  const expectedProduction = Math.max(0, baseProduction * (1 + scenario.productionChange));
  const expectedUnitProductIntensity = Math.max(0, baseUnitProductIntensity * (1 + scenario.productIntensityChange));
  const expectedIndustryBalance = Math.max(0, baseIndustryBalance * (1 + scenario.industryBalanceChange));
  const expectedEmission = Math.max(0, Math.round(expectedProduction * expectedUnitProductIntensity));
  const intensityDeviation = industryAllocationRule && expectedIndustryBalance > 0
    ? (expectedIndustryBalance - expectedUnitProductIntensity) / expectedIndustryBalance
    : null;
  const quotaAdjustmentCoefficient = industryAllocationRule && intensityDeviation !== null
    ? industryAllocationRule.calculateAlpha(intensityDeviation)
    : null;
  const expectedQuota = Math.max(0, Math.round(industryAllocationRule && quotaAdjustmentCoefficient !== null
    ? expectedEmission * (1 + quotaAdjustmentCoefficient)
    : manualExpectedQuota ?? expectedEmission));
  const expectedCarryover = Math.max(0, Math.round(carryoverAssets));
  const balance = expectedQuota + expectedCarryover - expectedEmission;
  return {
    expectedProduction: Math.round(expectedProduction),
    expectedUnitProductIntensity,
    expectedIndustryBalance,
    expectedEmission,
    expectedQuota,
    intensityDeviation,
    quotaAdjustmentCoefficient,
    expectedCarryover,
    balance,
    gap: Math.max(0, -balance),
    surplus: Math.max(0, balance),
  };
}

function annualOperationValue(metric: ReturnType<typeof listV11OperationMetrics>[number]) {
  return metric.entryMode === 'monthly' && metric.monthlyValues.length
    ? metric.monthlyValues.reduce((sum, value) => sum + value, 0)
    : metric.annualValue;
}

export function listNextCycleCarryoverAssets(assets: CarbonAsset[], currentCycle: string) {
  return assets.filter((asset) => (
    asset.complianceCycle === currentCycle
    && asset.assetState !== '待核验'
    && asset.assetState !== '已用尽'
    && (asset.carryoverEligibleAmount ?? 0) > 0
  ));
}

function buildBudgetDataset(type: BudgetType) {
  const year = 2026;
  const reportedMonth = 6;
  const units = listEnergyUnits().filter((unit) => unit.parentEnergyUnitId === null);
  const targets = units.map((unit) => [unit.energyUnitName, unit.energyUnitId] as const);
  const energyTrend = (energyUnitId?: string): BudgetTrend => {
    const query = buildEnergyQueryDataset({ year, period: 'month', month: reportedMonth, energyUnitId });
    const actual = query.trend;
    const average = actual.length ? query.total / actual.length : 0;
    const forecast = [query.total, ...Array.from({ length: 6 }, (_, index) => query.total + average * (index + 1))];
    return { actual, forecast };
  };
  const carbonSnapshot = latestCarbonSnapshot(year);
  const carbonMonthly = carbonSnapshot?.monthlyEmissions ?? [];
  const carbonActual = carbonMonthly.slice(0, reportedMonth).reduce<number[]>((values, value) => [...values, (values.at(-1) ?? 0) + value], []);
  const carbonCurrent = carbonActual.at(-1) ?? 0;
  const carbonForecast = carbonSnapshot?.totalEmission ?? carbonCurrent;
  const carbonTrend: BudgetTrend = { actual: carbonActual, forecast: [carbonCurrent, ...carbonMonthly.slice(reportedMonth).reduce<number[]>((values, value) => [...values, (values.at(-1) ?? carbonCurrent) + value], [])] };
  const enterpriseTrend = type === 'energy' ? energyTrend() : carbonTrend;
  const enterpriseCurrent = enterpriseTrend.actual.at(-1) ?? 0;
  const enterpriseForecast = type === 'energy' ? enterpriseTrend.forecast.at(-1) ?? enterpriseCurrent : carbonForecast;
  const shares = targets.map(([name, energyUnitId]) => {
    const trend = energyTrend(energyUnitId);
    return [name, energyUnitId, trend, trend.actual.at(-1) ?? 0, trend.forecast.at(-1) ?? 0] as const;
  });
  const rows: BudgetRow[] = [
    ['全企业', null, enterpriseCurrent, enterpriseForecast, null],
    ...shares.map(([name, energyUnitId, trend, current, forecast]) => [name, null, type === 'energy' ? current : enterpriseCurrent * (current / Math.max(shares.reduce((sum, item) => sum + item[3], 0), 1)), type === 'energy' ? forecast : enterpriseForecast * (current / Math.max(shares.reduce((sum, item) => sum + item[3], 0), 1)), energyUnitId] as const),
  ];
  return { rows, trends: { '全企业': enterpriseTrend, ...Object.fromEntries(shares.map(([name, , trend]) => [name, trend])) } as Record<string, BudgetTrend> };
}

type Overlay =
  | { kind: 'budget'; type: BudgetType; energyUnitId: string | null; scopeName: string }
  | { kind: 'budgetDetail'; row: readonly [string, number, number, number]; type: BudgetType; forecastReady: boolean }
  | { kind: 'asset'; asset?: CarbonAsset }
  | { kind: 'assetDetail'; asset: CarbonAsset }
  | { kind: 'quotaRules' }
  | { kind: 'carryoverDetail'; assets: CarbonAsset[] }
  | { kind: 'rules' }
  | null;

type StrategyAnalysisRow = ReturnType<typeof buildStrategyAnalysis>['rows'][number];

function useFeedback() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };
  return { toast, notify };
}

function format(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function Page({ children, toast }: { children: ReactNode; toast: string }) {
  return <div className={styles.page}>{children}<Toast message={toast} /></div>;
}

function CommonFilters({
  cycle = false,
  compare = false,
  period,
  setPeriod,
  scope,
  setScope,
  showScope = true,
  onQuery,
  onReset,
}: {
  cycle?: boolean;
  compare?: boolean;
  period?: 'month' | 'year';
  setPeriod?: (period: 'month' | 'year') => void;
  scope?: string;
  setScope?: (scope: string) => void;
  showScope?: boolean;
  onQuery: () => void;
  onReset: () => void;
}) {
  return <section className={`${styles.card} ${styles.filters}`}>
    {!cycle && <div className={styles.filterField}><span>分析周期</span><div className={styles.segment}><button type="button" className={period === 'month' ? styles.segmentActive : ''} onClick={() => setPeriod?.('month')}>月度</button><button type="button" className={period === 'year' ? styles.segmentActive : ''} onClick={() => setPeriod?.('year')}>年度</button></div></div>}
    <Field label={cycle ? '履约周期' : '年份'}><select><option>{cycle ? '2026年度' : '2026年'}</option><option>{cycle ? '2025年度' : '2025年'}</option></select></Field>
    {!cycle && period !== 'year' && <Field label="月份"><select><option>6月</option><option>5月</option><option>4月</option></select></Field>}
    {showScope && <Field label="统计范围"><select value={scope} onChange={(event) => setScope?.(event.target.value)}>{scopes.map((value) => <option key={value}>{value}</option>)}</select></Field>}
    {compare && <Field label="对比口径"><select><option>同比</option><option>环比</option></select></Field>}
    <div className={styles.filterSpacer} />
    <Button primary onClick={onQuery}>查询</Button><Button onClick={onReset}>重置</Button>
  </section>;
}

function Kpi({ label, value, unit, sub, danger = false, icon, hideSub = false }: { label: string; value: string; unit: string; sub: ReactNode; danger?: boolean; icon?: string; hideSub?: boolean }) {
  return <div className={`${styles.card} ${styles.kpi} ${danger ? styles.kpiDanger : ''}`}>{icon && <i>{icon}</i>}<span>{label}</span><strong>{value}<small>{unit}</small></strong>{!hideSub && <p>{sub}</p>}</div>;
}

function Status({ value }: { value: string }) {
  const tone = value.includes('异常') || value.includes('超预算')
    ? 'red'
    : ['正常', '已平衡', '已归集'].includes(value)
      ? 'green'
      : 'orange';
  return <Tag tone={tone}>{value}</Tag>;
}

export function AssetOperationsV2({ pathname }: { pathname: string }) {
  if (pathname.endsWith('/balance')) return <BalanceOptimizationPage />;
  if (pathname.endsWith('/analysis')) return <AnalysisPage />;
  if (pathname.endsWith('/budget')) return <BudgetPage />;
  return <CarbonAssetsPage />;
}

type BalanceSelection =
  | { level: 'level1'; row: FlowLevelOneBalanceRow }
  | { level: 'level2'; row: FlowLevelTwoBalanceRow };

type DiagnosisRank = {
  id: string;
  name: string;
  description: string;
  amount: number;
  rate: number;
  issueType: string;
  selection: BalanceSelection;
};

export function BalancePage() {
  const { toast, notify } = useFeedback();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(6);
  const [scope, setScope] = useState('enterprise');
  const [diagnosisLevel, setDiagnosisLevel] = useState<FlowViewLevel>('level1');
  const [applied, setApplied] = useState({
    period: 'month' as 'month' | 'year',
    month: 6,
    scope: 'enterprise',
  });
  const [selection, setSelection] = useState<BalanceSelection | null>(null);
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
  const effectiveScope = diagnosisLevel === 'level1' ? 'enterprise' : applied.scope;
  const levelTwoRows = effectiveScope === 'enterprise'
    ? levelTwoDataset.levelTwoBalanceRows
    : levelTwoDataset.levelTwoBalanceRows.filter((row) => row.level1EnergyUnitId === effectiveScope);
  const levelTwoAllocated = levelTwoRows.reduce(
    (total, row) => total + row.distributionStandardAmount,
    0,
  );
  const levelTwoUtilized = levelTwoRows.reduce(
    (total, row) => total + row.utilizationStandardAmount,
    0,
  );
  const levelTwoPending = levelTwoRows.reduce(
    (total, row) => total + row.pendingStandardAmount,
    0,
  );
  const levelTwoOver = levelTwoRows.reduce(
    (total, row) => total + row.overAllocatedStandardAmount,
    0,
  );
  const levelOneAllocated = levelOneDataset.utilizationStandardCoalAmount;
  const levelOneRate = levelOneDataset.internalAvailableStandardCoalAmount > 0
    ? levelOneAllocated / levelOneDataset.internalAvailableStandardCoalAmount * 100
    : 0;
  const levelTwoRate = levelTwoAllocated > 0 ? levelTwoUtilized / levelTwoAllocated * 100 : 0;
  const anomalyCount = diagnosisLevel === 'level1'
    ? levelOneDataset.levelOneBalanceRows.filter((row) => row.status !== '已分配').length
    : levelTwoRows.filter((row) => row.status !== '已归集').length;
  const ranks = buildDiagnosisRanks(
    diagnosisLevel,
    levelOneDataset.levelOneBalanceRows,
    levelTwoRows,
  );
  const issueValues = [
    {
      label: '一级未分配',
      value: effectiveScope === 'enterprise' ? levelOneDataset.differenceStandardCoalAmount : 0,
      tone: 'blue',
    },
    { label: '二级待分解', value: levelTwoPending, tone: 'orange' },
    { label: '二级超额', value: levelTwoOver, tone: 'red' },
    {
      label: '转换待校验差额',
      value: effectiveScope === 'enterprise'
        ? levelOneDataset.conversionDifferenceStandardCoalAmount
        : 0,
      tone: 'purple',
    },
  ] as const;

  const applyFilters = () => {
    setApplied({
      period,
      month,
      scope: diagnosisLevel === 'level1' ? 'enterprise' : scope,
    });
    notify('已按当前条件更新能源平衡诊断');
  };

  const resetFilters = () => {
    setPeriod('month');
    setMonth(6);
    setScope('enterprise');
    setDiagnosisLevel('level1');
    setApplied({ period: 'month', month: 6, scope: 'enterprise' });
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
      level={diagnosisLevel}
      setLevel={(level) => {
        setDiagnosisLevel(level);
        if (level === 'level1') setScope('enterprise');
      }}
      levelOneUnits={levelOneUnits}
      onQuery={applyFilters}
      onReset={resetFilters}
    />
    <div className={styles.balanceLevelSummary}>
      <strong>{diagnosisLevel === 'level1' ? '一级分配平衡' : '二级利用归集'}</strong>
      <span>
        {applied.period === 'year' ? '2026年度' : `2026年${applied.month}月`}
        {' · '}
        {effectiveScope === 'enterprise'
          ? '全企业'
          : levelOneUnits.find((unit) => unit.energyUnitId === effectiveScope)?.energyUnitName}
      </span>
    </div>
    <div className={styles.kpiFive}>
      {diagnosisLevel === 'level1' ? <>
        <Kpi label="厂内可分配量" value={format(levelOneDataset.internalAvailableStandardCoalAmount, 1)} unit="tce" sub={<>统一读取能流聚合结果</>} />
        <Kpi label="一级已分配量" value={format(levelOneAllocated, 1)} unit="tce" sub={<>一级用能单元归集量</>} />
        <Kpi label="一级未分配量" value={format(levelOneDataset.differenceStandardCoalAmount, 1)} unit="tce" danger={levelOneDataset.differenceStandardCoalAmount > 0.01} sub={<>另有外部输出 {format(levelOneDataset.externalStandardCoalAmount, 1)} tce</>} />
        <Kpi label="一级分配率" value={format(levelOneRate, 1)} unit="%" sub={<>已分配量 ÷ 厂内可分配量</>} />
        <Kpi label="异常对象数" value={String(anomalyCount)} unit="项" danger={anomalyCount > 0} sub={<>按能源品种识别勾稽问题</>} />
      </> : <>
        <Kpi label="一级分配量" value={format(levelTwoAllocated, 1)} unit="tce" sub={<>当前范围的一级控制量</>} />
        <Kpi label="二级已归集量" value={format(levelTwoUtilized, 1)} unit="tce" sub={<>已归集至工序、系统或区域</>} />
        <Kpi label="待分解量" value={format(levelTwoPending, 1)} unit="tce" danger={levelTwoPending > 0.01} sub={<>仅统计一级大于二级的正差额</>} />
        <Kpi label="二级归集率" value={format(levelTwoRate, 1)} unit="%" sub={<>二级利用量 ÷ 一级分配量</>} />
        <Kpi label="层级异常量" value={format(levelTwoOver, 1)} unit="tce" danger={levelTwoOver > 0.01} sub={<>二级利用超出一级分配的部分</>} />
      </>}
    </div>
    <div className={styles.twoColumns}>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>平衡问题构成</h2>
          <span>不同问题使用独立管理口径</span>
        </div>
        <BalanceIssueBars items={issueValues} />
      </section>
      <section className={`${styles.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>{diagnosisLevel === 'level1' ? '一级分配异常对象 TOP5' : '二级归集异常对象 TOP5'}</h2>
          <span>差额量（tce）　归集/分配率</span>
        </div>
        <DiagnosisRankList rows={ranks} onOpen={setSelection} />
      </section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}>
      <h2>能源平衡诊断清单</h2>
      {diagnosisLevel === 'level1'
        ? <LevelOneDiagnosisTable
            rows={levelOneDataset.levelOneBalanceRows}
            onOpen={(row) => setSelection({ level: 'level1', row })}
          />
        : <LevelTwoDiagnosisTable
            rows={levelTwoRows}
            onOpen={(row) => setSelection({ level: 'level2', row })}
          />}
      <div className={styles.formula}>
        ⓘ　本页复用能流分析统一聚合结果；未分配、待分解、层级超额和转换差额分别统计，不将管理差额直接定义为能源损失。
      </div>
    </section>
    <BalanceRuleGuide />
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
  level,
  setLevel,
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
  level: FlowViewLevel;
  setLevel: (level: FlowViewLevel) => void;
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
    {period === 'month' && <Field label="月份"><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{months.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}</select></Field>}
    <Field label="统计范围">
      <select value={level === 'level1' ? 'enterprise' : scope} disabled={level === 'level1'} onChange={(event) => setScope(event.target.value)}>
        <option value="enterprise">全企业</option>
        {levelOneUnits.map((unit) => <option key={unit.energyUnitId} value={unit.energyUnitId}>{unit.energyUnitName}</option>)}
      </select>
    </Field>
    <div className={styles.filterField}>
      <span>诊断层级</span>
      <div className={styles.segment}>
        <button type="button" className={level === 'level1' ? styles.segmentActive : ''} onClick={() => setLevel('level1')}>一级分配平衡</button>
        <button type="button" className={level === 'level2' ? styles.segmentActive : ''} onClick={() => setLevel('level2')}>二级利用归集</button>
      </div>
    </div>
    <div className={styles.filterSpacer} />
    <Button primary onClick={onQuery}>查询</Button>
    <Button onClick={onReset}>重置</Button>
  </section>;
}

function buildDiagnosisRanks(
  level: FlowViewLevel,
  levelOneRows: FlowLevelOneBalanceRow[],
  levelTwoRows: FlowLevelTwoBalanceRow[],
): DiagnosisRank[] {
  if (level === 'level1') {
    return levelOneRows
      .filter((row) => row.status !== '已分配')
      .map((row) => {
        const over = Math.max(
          row.distributionStandardAmount + row.externalOutputStandardAmount - row.availableStandardAmount,
          0,
        );
        const amount = row.unallocatedStandardAmount || over;
        const rate = row.availableStandardAmount > 0
          ? amount / row.availableStandardAmount * 100
          : 0;
        return {
          id: row.energyTypeId,
          name: row.energyTypeName,
          description: row.status === '存在未分配' ? '一级未分配' : '一级分配超出可用量',
          amount,
          rate,
          issueType: row.status === '存在未分配' ? '待分配' : '层级异常',
          selection: { level: 'level1' as const, row },
        };
      })
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  }
  return levelTwoRows
    .filter((row) => row.status !== '已归集')
    .map((row) => ({
      id: row.rowId,
      name: row.level1EnergyUnitName,
      description: row.energyTypeName,
      amount: row.pendingStandardAmount || row.overAllocatedStandardAmount,
      rate: Number.isFinite(row.collectionRate) ? row.collectionRate : 0,
      issueType: row.status === '层级异常'
        ? '二级超额'
        : row.utilizationStandardAmount === 0
          ? '未维护二级数据'
          : '待分解',
      selection: { level: 'level2' as const, row },
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
}

function BalanceIssueBars({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: number; tone: 'blue' | 'orange' | 'red' | 'purple' }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className={styles.issueBars}>
    {items.map((item) => <div key={item.label}>
      <span>{item.label}</span>
      <div><i className={styles[`issue${item.tone}`]} style={{ width: `${item.value / max * 100}%` }} /></div>
      <strong>{format(item.value, 1)}</strong>
      <small>tce</small>
    </div>)}
    <p>转换差额仅表示投入与产出尚待核验的折标差额，不默认等同于实际损失。</p>
  </div>;
}

function DiagnosisRankList({
  rows,
  onOpen,
}: {
  rows: DiagnosisRank[];
  onOpen: (selection: BalanceSelection) => void;
}) {
  const colors = ['#3478F6', '#0AA06C', '#FF8700', '#7A54E8', '#37B5C3'];
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return <div className={styles.ranks}>
    <div className={styles.rankHead}><span /><span>对象</span><span /><span>差额量</span><span>比率</span></div>
    {rows.length ? rows.map((row, index) => <button type="button" key={row.id} onClick={() => onOpen(row.selection)}>
      <i style={{ background: colors[index] }}>{index + 1}</i>
      <b title={`${row.name}｜${row.description}`}>{row.name}<small>{row.description}</small></b>
      <span><em style={{ width: `${row.amount / max * 100}%`, background: colors[index] }} /></span>
      <strong>{format(row.amount, 1)}</strong>
      <small>{format(row.rate, 1)}%</small>
    </button>) : <div className={styles.rankEmpty}>当前范围未识别到平衡异常对象</div>}
  </div>;
}

function levelOneDisplayStatus(row: FlowLevelOneBalanceRow) {
  if (row.status === '已分配') return '已平衡';
  if (row.status === '存在未分配') return '待分配';
  return '层级异常';
}

function levelTwoDisplayStatus(row: FlowLevelTwoBalanceRow) {
  if (row.status === '层级异常') return '层级异常';
  if (row.distributionStandardAmount > 0 && row.utilizationStandardAmount === 0) return '未维护二级数据';
  if (row.status === '待分解') return '待分解';
  return row.status === '已归集' ? '已归集' : '数据不完整';
}

function LevelOneDiagnosisTable({
  rows,
  onOpen,
}: {
  rows: FlowLevelOneBalanceRow[];
  onOpen: (row: FlowLevelOneBalanceRow) => void;
}) {
  return <div className={styles.tableWrap}><table><thead><tr>
    <th>能源品种</th><th>厂内可分配量（tce）</th><th>一级已分配量（tce）</th><th>外部输出量（tce）</th><th>一级未分配量（tce）</th><th>分配率</th><th>状态</th><th>操作</th>
  </tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.energyTypeId}>
    <td>{row.energyTypeName}</td>
    <td>{format(row.availableStandardAmount, 1)}</td>
    <td>{format(row.distributionStandardAmount, 1)}</td>
    <td>{format(row.externalOutputStandardAmount, 1)}</td>
    <td className={row.unallocatedStandardAmount > 0.01 ? styles.warningNumber : ''}>{format(row.unallocatedStandardAmount, 1)}</td>
    <td>{format(row.distributionRate, 1)}%</td>
    <td><Status value={levelOneDisplayStatus(row)} /></td>
    <td><button type="button" className={styles.link} onClick={() => onOpen(row)}>查看详情</button></td>
  </tr>) : <tr><td colSpan={8} className={styles.emptyCell}>当前期间暂无一级能源平衡数据</td></tr>}</tbody></table></div>;
}

function LevelTwoDiagnosisTable({
  rows,
  onOpen,
}: {
  rows: FlowLevelTwoBalanceRow[];
  onOpen: (row: FlowLevelTwoBalanceRow) => void;
}) {
  return <div className={styles.tableWrap}><table><thead><tr>
    <th>一级用能单元</th><th>能源品种</th><th>一级分配量（tce）</th><th>二级利用量（tce）</th><th>待分解量（tce）</th><th>超出量（tce）</th><th>二级归集率</th><th>状态</th><th>操作</th>
  </tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.rowId}>
    <td>{row.level1EnergyUnitName}</td>
    <td>{row.energyTypeName}</td>
    <td>{format(row.distributionStandardAmount, 1)}</td>
    <td>{format(row.utilizationStandardAmount, 1)}</td>
    <td className={row.pendingStandardAmount > 0.01 ? styles.warningNumber : ''}>{format(row.pendingStandardAmount, 1)}</td>
    <td className={row.overAllocatedStandardAmount > 0.01 ? styles.dangerNumber : ''}>{format(row.overAllocatedStandardAmount, 1)}</td>
    <td>{Number.isFinite(row.collectionRate) ? `${format(row.collectionRate, 1)}%` : '—'}</td>
    <td><Status value={levelTwoDisplayStatus(row)} /></td>
    <td><button type="button" className={styles.link} onClick={() => onOpen(row)}>查看详情</button></td>
  </tr>) : <tr><td colSpan={9} className={styles.emptyCell}>当前范围暂无二级利用归集数据</td></tr>}</tbody></table></div>;
}

function BalanceRuleGuide() {
  const rules = [
    ['一级未分配', '厂内可分配量大于一级分配量及外部输出', '检查一级用能单元数据或分配规则'],
    ['二级待分解', '一级分配量大于二级利用量', '补充下级工序、系统或区域利用数据'],
    ['二级超额', '二级利用量大于一级分配量', '检查重复录入、期间及单位'],
    ['转换差额偏高', '转换投入与产出折标差额待核验', '检查转换计量、输出记录及损失数据'],
    ['数据缺失', '月度记录不完整', '补录缺失月份'],
    ['单位异常', '上下级单位或折标逻辑不一致', '检查能源品种、单位及折标系数'],
  ];
  return <section className={`${styles.card} ${styles.ruleGuide}`}>
    <div><h2>规则说明与异常处置建议</h2><p>一期采用明确规则生成处置建议，不将管理差额包装为设备效率或泛化 AI 结论。</p></div>
    <div className={styles.ruleGrid}>{rules.map(([type, rule, action]) => <article key={type}><strong>{type}</strong><span>{rule}</span><p>{action}</p></article>)}</div>
  </section>;
}

function BalanceDiagnosisDrawer({
  selection,
  period,
  onClose,
  onNavigate,
}: {
  selection: BalanceSelection;
  period: FlowPeriod;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const periodText = period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
  let objectName: string;
  let status: string;
  let values: Array<[string, string]>;
  let judgement: string;
  let actions: string[];
  if (selection.level === 'level1') {
    const row = selection.row;
    objectName = row.energyTypeName;
    status = levelOneDisplayStatus(row);
    values = [
      ['分析期间', periodText],
      ['诊断对象', row.energyTypeName],
      ['诊断层级', '一级分配平衡'],
      ['数据来源', '能源数据及能源转换与输出'],
      ['厂内可分配量', `${format(row.availableStandardAmount, 1)} tce`],
      ['一级已分配量', `${format(row.distributionStandardAmount, 1)} tce`],
      ['外部输出量', `${format(row.externalOutputStandardAmount, 1)} tce`],
      ['一级未分配量', `${format(row.unallocatedStandardAmount, 1)} tce`],
    ];
    judgement = row.status === '存在未分配'
      ? `${row.energyTypeName}仍有 ${format(row.unallocatedStandardAmount, 1)} tce 未归集到一级用能单元。`
      : `${row.energyTypeName}的一级分配及外部输出超过当前可分配量，需要核查重复记录或统计口径。`;
    actions = [
      '核对一级用能单元能源记录是否已录入',
      '检查能源品种、期间与折标单位是否一致',
      '核查外部输出与一级分配是否重复统计',
    ];
  } else {
    const row = selection.row;
    objectName = row.level1EnergyUnitName;
    status = levelTwoDisplayStatus(row);
    values = [
      ['分析期间', periodText],
      ['诊断对象', row.level1EnergyUnitName],
      ['能源品种', row.energyTypeName],
      ['诊断层级', '二级利用归集'],
      ['一级分配量', `${format(row.distributionStandardAmount, 1)} tce`],
      ['二级利用量', `${format(row.utilizationStandardAmount, 1)} tce`],
      ['待分解量', `${format(row.pendingStandardAmount, 1)} tce`],
      ['二级归集率', Number.isFinite(row.collectionRate) ? `${format(row.collectionRate, 1)}%` : '无法计算'],
    ];
    judgement = row.status === '层级异常'
      ? `${row.level1EnergyUnitName}的二级利用量超过一级分配量 ${format(row.overAllocatedStandardAmount, 1)} tce。`
      : `${row.level1EnergyUnitName}仍有 ${format(row.pendingStandardAmount, 1)} tce 能源未归集到下级工序、系统或区域。`;
    actions = row.status === '层级异常'
      ? ['检查一级和二级能源数据是否重复录入', '检查上下级记录期间与单位是否一致', '核查用能单元父子关系是否正确']
      : ['核对是否已维护对应二级用能单元', '核对二级能源记录与分析期间是否一致', '检查能源品种与单位是否一致'];
  }
  return <Drawer
    title={`${objectName}｜能源平衡诊断`}
    width={560}
    onClose={onClose}
    footer={<>
      <Button onClick={() => onNavigate('/energy-analysis/flow-analysis?tab=detail')}>查看流向明细</Button>
      <Button primary onClick={() => onNavigate('/data-management/energy-data')}>前往数据管理</Button>
    </>}
  >
    <h3 className={styles.detailTitle}>关键证据</h3>
    <DetailGrid values={values} />
    <h3 className={styles.detailTitle}>问题判断</h3>
    <div className={styles.diagnosisJudgement}><Status value={status} /><p>{judgement}</p></div>
    <h3 className={styles.detailTitle}>建议动作</h3>
    <ul className={styles.diagnosisActions}>{actions.map((action) => <li key={action}>{action}</li>)}</ul>
  </Drawer>;
}

export function buildStrategyAnalysis(period: 'month' | 'year', scopeName: string) {
  const STRUCTURE_COST_GAP_THRESHOLD = 10;
  const HIGH_CARBON_SHARE_THRESHOLD = 40;
  const year = 2026;
  const month = 6;
  const allUnits = listEnergyUnits().filter((unit) => unit.parentEnergyUnitId === null);
  const selectedUnit = scopeName === '全企业' ? undefined : allUnits.find((unit) => unit.energyUnitName === scopeName);
  const query = buildEnergyQueryDataset({ year, period, month, energyUnitId: selectedUnit?.energyUnitId });
  const previousQuery = buildEnergyQueryDataset({ year: year - 1, period, month, energyUnitId: selectedUnit?.energyUnitId });
  const unitQueries = allUnits.map((unit) => ({ unit, query: buildEnergyQueryDataset({ year, period, month, energyUnitId: unit.energyUnitId }) }));
  const typeConsumption = new Map<string, number>();
  unitQueries.forEach(({ query: unitQuery }) => unitQuery.rows.forEach((row) => {
    typeConsumption.set(row.energyTypeName, (typeConsumption.get(row.energyTypeName) ?? 0) + row.standardCoalAmount);
  }));
  const costs = listV11EnergyCosts().filter((item) => item.year === year);
  const costByType = new Map<string, number>();
  costs.forEach((cost) => {
    const energyRow = query.rows.find((row) => row.energyQueryRowId.includes(`:${cost.energyTypeId}`));
    const unitRows = unitQueries.flatMap((item) => item.query.rows);
    const source = energyRow ?? unitRows.find((row) => row.energyQueryRowId.includes(`:${cost.energyTypeId}`));
    if (!source) return;
    const value = period === 'month' ? (cost.monthlyCosts[month - 1] ?? 0) : cost.monthlyCosts.reduce((sum, amount) => sum + amount, 0);
    costByType.set(source.energyTypeName, value);
  });
  const totalCost = [...costByType.values()].reduce((sum, value) => sum + value, 0);
  const costStructure = [...costByType.entries()].map(([name, value], index) => ({
    name,
    value,
    share: totalCost ? value / totalCost * 100 : 0,
    color: ['#2878FF', '#14AA72', '#FF8A00', '#7657F6', '#8D98A8'][index % 5],
  })).sort((a, b) => b.value - a.value);
  const structureDiagnosis = query.structure.map((item) => {
    const previousShare = previousQuery.structure.find((previous) => previous.label === item.label)?.share ?? 0;
    const shareChange = item.share - previousShare;
    const cost = costStructure.find((entry) => entry.name === item.label);
    const costValue = cost?.value ?? 0;
    const costShare = cost?.share ?? 0;
    const unitCost = item.amount > 0 ? costValue / item.amount * 10000 : null;
    const costGap = costShare - item.share;
    const isFossil = ['原煤', '天然气', '燃油', '焦炭'].includes(item.label);
    const isAlternative = ['RDF', '生物质', '绿电', '可再生能源'].includes(item.label);
    if (costGap >= STRUCTURE_COST_GAP_THRESHOLD) {
      return {
        ...item,
        shareChange,
        costValue,
        costShare,
        unitCost,
        priority: '重点优化',
        diagnosis: `成本占比高出 ${costGap.toFixed(1)} pp，优先核查价格与使用时段`,
        tone: 'red' as const,
      };
    }
    if (isFossil && item.share >= 40) {
      return {
        ...item,
        shareChange,
        costValue,
        costShare,
        unitCost,
        priority: '重点关注',
        diagnosis: `高碳能源占比 ${item.share.toFixed(1)}%，关注替代能源与工艺优化空间`,
        tone: 'orange' as const,
      };
    }
    if (isAlternative && shareChange > 0) {
      return {
        ...item,
        shareChange,
        costValue,
        costShare,
        unitCost,
        priority: '表现改善',
        diagnosis: `替代能源占比较上年同期提升 ${shareChange.toFixed(1)} 个百分点`,
        tone: 'green' as const,
      };
    }
    return {
      ...item,
      shareChange,
      costValue,
      costShare,
      unitCost,
      priority: Math.abs(shareChange) >= 1 ? '持续观察' : '结构稳定',
      diagnosis: Math.abs(shareChange) >= 1
        ? `占比较上年同期${shareChange > 0 ? '上升' : '下降'} ${Math.abs(shareChange).toFixed(1)} 个百分点`
        : '占比与上年同期基本持平',
      tone: Math.abs(shareChange) >= 1 ? 'blue' as const : 'gray' as const,
    };
  }).sort((left, right) => {
    const order = { red: 0, orange: 1, blue: 2, green: 3, gray: 4 };
    return order[left.tone] - order[right.tone] || right.share - left.share;
  });
  const costMismatch = [...structureDiagnosis]
    .filter((item) => item.costShare - item.share >= STRUCTURE_COST_GAP_THRESHOLD)
    .sort((left, right) => (right.costShare - right.share) - (left.costShare - left.share))[0];
  const fossilDependency = [...structureDiagnosis]
    .filter((item) => ['原煤', '天然气', '燃油', '焦炭'].includes(item.label) && item.share >= HIGH_CARBON_SHARE_THRESHOLD)
    .sort((left, right) => right.share - left.share)[0];
  const highestUnitCost = [...structureDiagnosis]
    .filter((item) => item.unitCost !== null)
    .sort((left, right) => (right.unitCost ?? 0) - (left.unitCost ?? 0))[0];
  const efficiencySignals = buildStrategyEfficiencySignals(year, { year, grain: period, month });
  const totalUnitConsumption = unitQueries.reduce((sum, item) => sum + item.query.total, 0);
  const rows = (selectedUnit ? unitQueries.filter((item) => item.unit.energyUnitId === selectedUnit.energyUnitId) : unitQueries)
    .filter((item) => item.query.total > 0)
    .map(({ unit, query: unitQuery }) => {
      const referenceCost = unitQuery.rows.reduce((sum, row) => {
        const totalForType = typeConsumption.get(row.energyTypeName) ?? 0;
        return sum + (costByType.get(row.energyTypeName) ?? 0) * (totalForType ? row.standardCoalAmount / totalForType : 0);
      }, 0);
      const efficiency = efficiencySignals.get(unit.energyUnitId);
      const efficiencyRisk = efficiency?.status === '高风险' || efficiency?.status === '趋势恶化';
      const efficiencyAttention = efficiency?.status === '对标关注' || efficiency?.status === '趋势关注';
      const efficiencyStatus = !efficiency || efficiency.status === '正常'
        ? '正常'
        : efficiency.status === '待完善'
          ? '数据待完善'
          : efficiency.status === '高风险'
            ? '高风险'
            : efficiency.status === '趋势恶化'
              ? '趋势恶化'
              : '需关注';
      return {
        name: unit.energyUnitName,
        consumption: unitQuery.total,
        share: totalUnitConsumption ? unitQuery.total / totalUnitConsumption * 100 : 0,
        cost: referenceCost,
        unitCost: unitQuery.total > 0 ? referenceCost / unitQuery.total * 10000 : null,
        change: unitQuery.yearOnYear,
        monthChange: period === 'month' ? unitQuery.monthOnMonth ?? null : null,
        attention: unitQuery.total / Math.max(totalUnitConsumption, 1) >= 0.2 ? '重点关注' : '一般关注',
        efficiency,
        efficiencyStatus,
        efficiencyRisk,
        efficiencyAttention,
      };
    }).sort((a, b) => b.consumption - a.consumption)
    .map((row) => {
      const highConcentration = row.share >= 50;
      const issueCode = row.efficiency?.ruleCode !== 'NO_DIAGNOSIS'
        ? row.efficiency?.ruleCode
        : Math.abs(row.change) >= ENERGY_CHANGE_ATTENTION
          ? 'ENERGY_CHANGE'
          : highConcentration
            ? 'LARGE_CONSUMER'
            : 'NO_DIAGNOSIS';
      const actionCode = row.efficiency?.actionCode !== 'VIEW_DETAIL'
        ? row.efficiency?.actionCode
        : issueCode === 'ENERGY_CHANGE'
          ? 'GO_OPERATION_DATA'
          : 'VIEW_DETAIL';
      const problem = issueCode === 'METRIC_PERIOD_INCOMPLETE'
        ? '能效数据待完善'
        : issueCode === 'BENCHMARK_DEVIATION'
          ? '能效对标偏差'
          : issueCode === 'INTENSITY_TREND_DEVIATION'
            ? '能效趋势偏差'
            : issueCode === 'ENERGY_CHANGE'
              ? '能耗量变化，需结合业务量判断'
              : issueCode === 'LARGE_CONSUMER'
                ? '能耗规模较大，能效正常'
                : '暂无明确异常';
      return {
        ...row,
        issueCode,
        actionCode,
        problem,
        action: strategyActionLabels[actionCode as keyof typeof strategyActionLabels] ?? strategyActionLabels.VIEW_DETAIL,
      };
    });
  const intensityView = buildIntensityCalculationView(year, selectedUnit ? 'unit' : 'factory', selectedUnit?.energyUnitId ?? 'factory');
  const intensity = intensityView.metrics.find((metric) => metric.name === '单位产品综合能耗');
  const intensityValue = period === 'month'
    ? intensity?.monthlyMetrics.find((item) => item.month === month)?.value ?? intensity?.value ?? null
    : intensity?.value ?? null;
  const coreFindings = [
    costMismatch && {
      category: '成本结构',
      categoryClass: 'findingCategoryCost',
      icon: '¥',
      title: `${costMismatch.label}成本结构差异`,
      evidence: <>成本占比明显高于能耗占比，结构差异 <b>+{(costMismatch.costShare - costMismatch.share).toFixed(1)} pp</b></>,
      action: '采购单价、峰谷时段及基本费用',
    },
    fossilDependency && {
      category: '能源结构',
      categoryClass: 'findingCategoryEnergy',
      icon: '◒',
      title: `${fossilDependency.label}高碳能源占比高`,
      evidence: <>原煤是当前主要高碳能源，需关注能源替代与重点工序优化</>,
      action: '替代能源比例和重点工序优化空间',
    },
    highestUnitCost && {
      category: '单位成本',
      categoryClass: 'findingCategoryUnitCost',
      icon: '↗',
      title: `${highestUnitCost.label}单位用能成本最高`,
      evidence: <>电力是当前单位用能成本最高的能源品种</>,
      action: '采购价格、计价方式及使用时段',
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  return { query, totalCost, costStructure, structureDiagnosis, coreFindings, rows, intensity: intensityValue, intensityUnit: intensity?.unit ?? 'kgce/t' };
}

function AnalysisPage() {
  const { toast, notify } = useFeedback();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [aiVersion, setAiVersion] = useState(0);
  const [selectedRow, setSelectedRow] = useState<StrategyAnalysisRow | null>(null);
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const analysis = useMemo(() => buildStrategyAnalysis(period, '全企业'), [period]);
  return <Page toast={toast}>
    <CommonFilters period={period} setPeriod={(value) => { setPeriod(value); setAiVersion((current) => current + 1); }} showScope={false} onQuery={() => { setAiVersion((current) => current + 1); notify('查询条件已更新，AI结果需重新生成'); }} onReset={() => { setPeriod('month'); setAiVersion((current) => current + 1); notify('已重置查询条件，AI结果需重新生成'); }} />
    <div className={styles.kpiThree}><Kpi label="能源消费总量" value={format(analysis.query.total, 1)} unit="tce" icon="◔" hideSub sub={<>同比　<b className={analysis.query.yearOnYear > 0 ? styles.up : styles.down}>{analysis.query.yearOnYear >= 0 ? '+' : ''}{analysis.query.yearOnYear.toFixed(1)}%</b></>} /><Kpi label="综合能源成本" value={format(analysis.totalCost, 1)} unit="万元" icon="◉" hideSub sub={<>来自数据管理－能源成本</>} /><Kpi label="单位综合用能成本" value={analysis.query.total > 0 ? format(analysis.totalCost / analysis.query.total * 10000, 2) : '—'} unit="元/tce" icon="¥" hideSub sub={<>综合能源成本 ÷ 能源消费总量</>} /><Kpi label="单位产品综合能耗" value={analysis.intensity === null ? '—' : format(analysis.intensity, 1)} unit={analysis.intensityUnit} icon="↗" hideSub sub={<>来自能耗指标</>} /></div>
    <div className={styles.analysisInsightGrid}>
      <section className={`${styles.card} ${styles.panel} ${styles.structureDiagnosisCard}`}>
        <div className={styles.panelHead}>
          <div><h2>能源品种消耗与成本对比</h2><p>对比各能源品种的能耗占比、成本占比及单位用能成本</p></div>
        </div>
        <StructureCostComparison rows={analysis.structureDiagnosis} />
      </section>
      <section className={`${styles.card} ${styles.panel} ${styles.coreFindingsCard}`}><div className={styles.panelHead}><div><h2>结构对比分析发现</h2><p>从能源结构、成本结构和单位成本三个角度列出本期发现</p></div><span className={styles.findingCount}>本期发现 {analysis.coreFindings.length} 项</span></div><CoreFindings rows={analysis.coreFindings} /></section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}>
      <div className={styles.panelHead}><div><h2>重点用能单元分析</h2><p>集中查看各用能单元的能耗、能效和成本情况，简要识别需要关注的对象</p></div></div>
      <div className={styles.tableWrap}><table className={`${styles.priorityTable} ${styles.analysisPreparationTable}`}><thead><tr><th>用能单元</th><th>能耗量（tce）</th><th>能耗占比</th><th>估算成本（万元）</th><th>能效指标</th><th>分析结论</th><th>操作</th></tr></thead><tbody>{analysis.rows.map((row) => <tr key={row.name}>
        <td><strong>{row.name}</strong></td>
        <td>{format(row.consumption, 1)}</td>
        <td>{row.share.toFixed(1)}%</td>
        <td>{format(row.cost, 1)}</td>
        <td>{row.efficiency?.value === null || row.efficiency?.value === undefined ? '—' : `${format(row.efficiency.value, 1)} ${row.efficiency.unit}`}</td>
        <td>{row.problem}</td>
        <td><button type="button" className={`${styles.link} ${styles.actionLink}`} onClick={() => row.efficiencyStatus === '数据待完善' ? navigateTo('/data-management/operations?returnTo=/asset-strategy/analysis') : setSelectedRow(row)}>{row.efficiencyStatus === '数据待完善' ? '完善数据' : '查看分析'}　›</button></td>
      </tr>)}</tbody></table></div>
      <small className={styles.structureNote}>表格用于快速识别用能单元的分析状态；数据待完善对象请先点击“完善数据”，其他对象可点击“查看分析”了解纳入原因、关键指标（含能耗量同比/环比）和判断依据。成本为参考估算值，不代表用能单元实际财务成本。</small>
    </section>
    <AssetAiAnalysis analysisKey="analysis" invalidationVersion={aiVersion} notify={notify} />
    {selectedRow && <StrategyAnalysisModal row={selectedRow} onClose={() => setSelectedRow(null)} onNavigate={(path) => { setSelectedRow(null); navigateTo(path); }} />}
  </Page>;
}

type UnitAnalysisStatus = 'normal' | 'attention' | 'incomplete';

type UnitAnalysisDetail = {
  status: UnitAnalysisStatus;
  statusLabel: string;
  headline: string;
  explanation: string;
  inclusionReason: string;
  metrics: Array<[string, string, string]>;
  judgement: string;
  judgementSource: string;
  nextStep: string;
  checks: string[];
  actionCode: keyof typeof strategyActionLabels;
};

const strategyActionRoutes: Partial<Record<keyof typeof strategyActionLabels, string>> = {
  COMPLETE_DATA: '/data-management/operations?returnTo=/asset-strategy/analysis',
  GO_BENCHMARK: '/energy-analysis/benchmarking',
  GO_OPERATION_DATA: '/data-management/operations',
  GO_ENERGY_DATA: '/data-management/energy-data',
  GO_INTENSITY: '/energy-analysis/intensity',
};

function buildUnitAnalysisDetail(row: StrategyAnalysisRow): UnitAnalysisDetail {
  const isIncomplete = row.efficiencyStatus === '数据待完善';
  const isAttention = row.efficiencyRisk || row.efficiencyAttention || row.issueCode === 'ENERGY_CHANGE';
  const status: UnitAnalysisStatus = isIncomplete ? 'incomplete' : isAttention ? 'attention' : 'normal';
  const statusLabel = status === 'incomplete' ? '数据待完善' : status === 'attention' ? '存在关注项' : '暂无明显偏差';
  const actionCode = (isIncomplete
    ? 'COMPLETE_DATA'
    : row.actionCode && row.actionCode in strategyActionLabels ? row.actionCode : 'VIEW_DETAIL') as keyof typeof strategyActionLabels;
  const metricValue = row.efficiency?.value === null || row.efficiency?.value === undefined
    ? '—'
    : `${format(row.efficiency.value, 1)} ${row.efficiency.unit}`;
  const headline = isIncomplete
    ? `${row.name}当前数据待完善`
    : row.issueCode === 'LARGE_CONSUMER' || row.issueCode === 'NO_DIAGNOSIS'
      ? `${row.name}暂未发现明显能效偏差`
      : row.problem;
  const inclusionReason = isIncomplete
    ? '当前期间缺少形成能效指标所需的数据，因此需要补充数据后再判断。'
    : row.issueCode === 'BENCHMARK_DEVIATION'
      ? `${row.name}的能效对标结果存在偏差，因此列入分析对象。`
      : row.issueCode === 'INTENSITY_TREND_DEVIATION'
        ? `${row.name}的单位产品综合能耗变化值得关注，因此列入分析对象。`
        : row.issueCode === 'ENERGY_CHANGE'
          ? `${row.name}的能耗量发生变化，需要结合业务量进一步分析。`
          : row.issueCode === 'LARGE_CONSUMER'
            ? `${row.name}能耗规模较大，占当前分析范围的 ${row.share.toFixed(1)}%，因此列入分析对象。`
            : '当前对象已纳入本期用能单元分析，暂未命中明确异常规则。';
  const judgement = isIncomplete
    ? '能效指标数据待完善'
    : row.efficiency?.evidence ?? (row.issueCode === 'ENERGY_CHANGE'
      ? `能耗量同比 ${row.change >= 0 ? '+' : ''}${row.change.toFixed(1)}%`
      : '当前没有命中异常规则。');
  const checks = isIncomplete
    ? ['当前期间能源数据是否已录入', '产量、产值等运营分母是否已维护', '指标适用性和计算口径是否正确']
    : row.issueCode === 'BENCHMARK_DEVIATION' || row.issueCode === 'INTENSITY_TREND_DEVIATION'
      ? ['指标目标、统计期间和计算口径', '生产负荷与产量变化', '对应能源数据和运营数据是否属于同一期间']
      : row.issueCode === 'ENERGY_CHANGE'
        ? ['生产负荷、产量或运行时长是否发生变化', '能耗数据与运营数据是否属于同一期间']
        : ['生产负荷与产量变化是否匹配', '当前期间能耗数据是否与分析范围一致'];
  const nextStep = isIncomplete
    ? '补充当前期间能耗指标数据后重新计算'
    : actionCode === 'VIEW_DETAIL'
      ? '继续观察单位产品综合能耗变化'
      : row.action ?? strategyActionLabels.VIEW_DETAIL;
  return {
    status,
    statusLabel,
    headline,
    explanation: isIncomplete
      ? '请先补充当前期间所需数据，再重新计算能效指标。'
      : isAttention
        ? '已识别到需要关注的指标，建议查看下方判断依据。'
        : '当前指标已完成计算，可继续观察后续变化。',
    inclusionReason,
    metrics: [
      ['能耗量', `${format(row.consumption, 1)} tce`, '能源数据'],
      ['能耗占比', `${row.share.toFixed(1)}%`, '当前分析范围'],
      ['能耗量环比', row.monthChange === null ? '年度分析不适用' : `${row.monthChange >= 0 ? '+' : ''}${row.monthChange.toFixed(1)}%`, '能源数据'],
      ['能耗量同比', `${row.change >= 0 ? '+' : ''}${row.change.toFixed(1)}%`, '同期对比'],
      ['单位产品综合能耗', metricValue, row.efficiency?.metricName ?? '能耗指标'],
      ['单位用能成本（参考）', row.unitCost === null ? '—' : `${format(row.unitCost, 2)} 元/tce`, '企业级成本按用量折算'],
    ],
    judgement,
    judgementSource: isIncomplete
      ? '请补充当前期间能源数据和运营数据后重新计算'
      : row.efficiency?.metricName ? `指标：${row.efficiency.metricName}（${metricValue}）` : '依据：能耗规模和变化情况',
    nextStep,
    checks,
    actionCode,
  };
}

function StrategyAnalysisModal({ row, onClose, onNavigate }: { row: StrategyAnalysisRow; onClose: () => void; onNavigate: (path: string) => void }) {
  const detail = buildUnitAnalysisDetail(row);
  const targetPath = strategyActionRoutes[detail.actionCode];
  return <Modal title={`${row.name}｜用能分析详情`} width={720} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button>{targetPath && <Button primary onClick={() => onNavigate(targetPath)}>{strategyActionLabels[detail.actionCode]}</Button>}</>}>
    <div className={`${styles.strategyDetailSummary} ${styles[`strategyDetailSummary${detail.status === 'incomplete' ? 'incomplete' : detail.status === 'attention' ? 'attention' : 'normal'}`]}`}><span className={styles.strategyDetailBadge}>{detail.statusLabel}</span><div><strong>{detail.headline}</strong><p>{detail.explanation}</p></div></div>
    <section className={styles.strategyDetailSection}><h3>纳入分析原因</h3><div className={styles.strategyEvidence}><strong>{detail.inclusionReason}</strong></div></section>
    <section className={`${styles.strategyDetailSection} ${styles.strategyEvidenceSection}`}><h3>关键指标</h3><div className={styles.strategyEvidenceCards}>{detail.metrics.map(([label, value, source]) => <div key={label}><span>{label}</span><b>{value}</b><small>{source}</small></div>)}</div></section>
    <section className={styles.strategyDetailSection}><h3>判断依据</h3><div className={styles.strategyEvidence}><strong>{detail.judgement}｜{detail.judgementSource}</strong></div></section>
    <section className={`${styles.strategyDetailSection} ${styles.strategyActionSection}`}><h3>后续建议</h3><div className={styles.strategyActionBox}><strong>{detail.nextStep}</strong><ul>{detail.checks.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
  </Modal>;
}

function StructureCostComparison({ rows }: { rows: ReturnType<typeof buildStrategyAnalysis>['structureDiagnosis'] }) {
  return <div className={styles.structureComparison}>
    <div className={styles.comparisonLegend}><span><i className={styles.energyShareDot} />能耗占比</span><span><i className={styles.costShareDot} />成本占比</span></div>
    <div className={styles.comparisonHeader}><span /><span /><span>能耗占比</span><span>成本占比</span><span>单位用能成本</span></div>
    {rows.map((row) => {
      return <div className={styles.comparisonRow} key={row.label}>
        <strong><i style={{ background: row.color }} />{row.label}</strong>
        <div className={styles.shareTracks}>
          <span><i style={{ width: `${row.share}%` }} /></span>
          <span><i style={{ width: `${row.costShare}%` }} /></span>
        </div>
        <span className={styles.shareValue}>{row.share.toFixed(1)}%</span>
        <span className={styles.shareValue}>{row.costShare.toFixed(1)}%</span>
        <span className={styles.unitCostValue}>{row.unitCost === null ? '—' : `${format(row.unitCost, 2)} 元/tce`}</span>
      </div>;
    })}
    <small className={styles.structureNote}>单位成本和成本结构差异用于提示进一步核查，不等同于能效偏差、能源浪费或节能潜力。</small>
  </div>;
}

function CoreFindings({ rows }: { rows: ReturnType<typeof buildStrategyAnalysis>['coreFindings'] }) {
  return <div className={styles.coreFindings}>{rows.map((row) => <article key={row.title} className={`${styles.findingNeutral} ${styles[row.categoryClass]}`}>
    <div className={styles.findingBody}><div className={styles.findingHeader}><span className={`${styles.findingCategory} ${styles[row.categoryClass]}`}><i>{row.icon}</i>{row.category}</span><strong>{row.title}</strong></div><p className={styles.findingEvidence}>{row.evidence}</p><span className={styles.findingAction}><b>建议核查</b>：{row.action}</span></div>
  </article>)}</div>;
}

function BudgetPage() {
  const { toast, notify } = useFeedback();
  const [budgetType, setBudgetType] = useState<BudgetType>('energy');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [aiVersion, setAiVersion] = useState(0);
  const [forecastReady, setForecastReady] = useState(true);
  const [trendScope, setTrendScope] = useState('全企业');
  const targetRecord = getBudgetTarget(budgetType);
  const target = targetRecord?.targetValue ?? 0;
  const targetConfigured = targetRecord?.targetValue !== undefined && targetRecord.targetValue !== null;
  const budgetDataset = buildBudgetDataset(budgetType);
  const baseRows = budgetDataset.rows.map((row, index) => {
    const energyUnitId = row[4];
    const configuredTarget = getBudgetTarget(budgetType, 2026, energyUnitId)?.targetValue;
    return [row[0], configuredTarget ?? (index === 0 ? target : row[1]), row[2], row[3], energyUnitId] as const;
  });
  const rows = appliedScope === '全企业' ? baseRows : baseRows.filter((row) => row[0] === appliedScope);
  const displayRow = baseRows.find((row) => row[0] === appliedScope) ?? baseRows[0];
  const displayTarget = displayRow?.[1] ?? (appliedScope === '全企业' ? target : null);
  const current = displayRow?.[2] ?? 0;
  const forecast = displayRow?.[3] ?? 0;
  const unit = budgetType === 'energy' ? 'tce' : 'tCO₂';
  const activeTrendScope = trendScope === '全企业' || baseRows.some((row) => row[0] === trendScope) ? trendScope : '全企业';
  const trendTarget = baseRows.find((row) => row[0] === activeTrendScope)?.[1] ?? (activeTrendScope === '全企业' ? target : null);
  void version;
  return <Page toast={toast}>
    <CommonFilters cycle showScope={false} scope={scope} setScope={setScope} onQuery={() => { setAppliedScope(scope); setForecastReady(true); setAiVersion((current) => current + 1); notify('查询条件已更新，预测结果已同步展示'); }} onReset={() => { setScope('全企业'); setAppliedScope('全企业'); setForecastReady(true); setAiVersion((current) => current + 1); notify('已重置查询条件，预测结果已同步展示'); }} />
    <section className={`${styles.card} ${styles.budgetCard}`}>
      <div className={styles.budgetTabs}><button type="button" className={budgetType === 'energy' ? styles.activeBudget : ''} onClick={() => { setBudgetType('energy'); setForecastReady(true); }}>能源预算管理</button><button type="button" className={budgetType === 'carbon' ? styles.activeBudget : ''} onClick={() => { setBudgetType('carbon'); setForecastReady(true); }}>碳排放预算管理</button></div>
      <div className={styles.budgetSummary}><div className={styles.targetSummary}><div className={styles.summaryLabel}><span>年度目标</span><button type="button" className={styles.summaryAction} onClick={() => setOverlay({ kind: 'budget', type: budgetType, energyUnitId: null, scopeName: '全企业' })}>{targetConfigured ? '调整目标' : '配置目标'}<span className={styles.srOnly}>目标预算配置</span></button></div><strong>{displayTarget !== null ? <>{format(displayTarget)} {unit}</> : '未配置'}</strong></div><div><span>当前累计</span><strong>{format(current)} {unit}</strong></div><div><span>预计全年</span><strong>{forecastReady ? `${format(forecast)} ${unit}` : '待预测'}</strong></div><div><span>预测偏差</span><strong className={forecastReady && displayTarget !== null ? styles.up : ''}>{forecastReady && displayTarget !== null ? <>{forecast - displayTarget >= 0 ? '+' : ''}{format(forecast - displayTarget)} {unit}<small>（{displayTarget ? ((forecast - displayTarget) / displayTarget * 100).toFixed(1) : '—'}%）</small></> : '—'}</strong></div><div><span>预算执行状态</span><strong>{forecastReady && displayTarget !== null ? <Tag tone="red">超预算风险</Tag> : <Tag tone="gray">未配置目标</Tag>}</strong><small>{forecastReady && displayTarget !== null ? '消耗进度高于时间进度' : '请先配置年度目标'}</small></div></div>
      <div className={styles.linePanel}><div className={styles.chartHead}><div><h2>{activeTrendScope === '全企业' ? '企业级年度预算累计趋势' : `${activeTrendScope}｜年度预算累计趋势`} <small>（单位：{unit}）</small></h2><p className={styles.chartContext}>趋势对象</p></div><div className={styles.chartActions}><select aria-label="趋势对象" className={styles.trendScopeSelect} value={activeTrendScope} onChange={(event) => setTrendScope(event.target.value)}>{baseRows.map((row) => <option key={row[0]} value={row[0]}>{row[0]}</option>)}</select><Button primary onClick={() => { setForecastReady(true); notify('已根据最新数据完成预测'); }}>{forecastReady ? '↻ 重新预测' : '开始预测'}</Button></div></div><BudgetLine trends={budgetDataset.trends} scope={activeTrendScope} target={trendTarget} forecastReady={forecastReady} /></div>
      <div className={styles.execution}><div className={styles.executionHead}><div><h2>用能单元预算分解</h2><p>表格用于展示预算执行情况；目标可针对企业或一级用能单元独立配置</p></div><span className={styles.executionScope}>当前范围：{appliedScope}</span></div><div className={styles.tableWrap}><table><thead><tr><th>管理对象</th><th>年度目标（{unit}）</th><th>操作</th><th>当前累计（{unit}）</th><th>预计全年（{unit}）</th><th>偏差（{unit}）</th><th>偏差（%）</th><th>状态</th></tr></thead><tbody>{rows.map((row) => { const rowTarget = row[1]; const diff = rowTarget === null ? null : row[3] - rowTarget; const rate = diff === null || rowTarget === null ? null : diff / rowTarget * 100; const state = rowTarget === null ? '未配置目标' : !forecastReady ? '待预测' : diff !== null && diff <= 0 ? '正常' : row[0] === '全企业' ? '超预算风险' : '关注'; const configured = rowTarget !== null; return <tr key={row[0]}><td>{row[0]}</td><td>{rowTarget === null ? '未配置' : format(rowTarget)}</td><td><button type="button" className={styles.targetConfigButton} onClick={() => setOverlay({ kind: 'budget', type: budgetType, energyUnitId: row[4] ?? null, scopeName: row[0] })}>{configured ? '调整目标' : '配置目标'}</button></td><td>{format(row[2])}</td><td>{forecastReady ? format(row[3]) : '—'}</td><td className={forecastReady && diff !== null ? (diff > 0 ? styles.up : styles.down) : ''}>{forecastReady && diff !== null ? `${diff > 0 ? '+' : ''}${format(diff)}` : '—'}</td><td className={forecastReady && rate !== null ? (rate > 0 ? styles.up : styles.down) : ''}>{forecastReady && rate !== null ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%` : '—'}</td><td><Status value={state} /></td></tr>; })}</tbody></table></div></div>
      <AssetAiAnalysis analysisKey={budgetType === 'energy' ? 'budgetEnergy' : 'budgetCarbon'} invalidationVersion={aiVersion} notify={notify} />
    </section>
    {overlay?.kind === 'budget' && <BudgetDialog type={overlay.type} energyUnitId={overlay.energyUnitId} scopeName={overlay.scopeName} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setForecastReady(true); setVersion((value) => value + 1); setAiVersion((current) => current + 1); notify('目标预算配置已保存，预测结果已同步展示'); }} />}
    {overlay?.kind === 'budgetDetail' && <BudgetDetailDrawer row={overlay.row} type={overlay.type} forecastReady={overlay.forecastReady} onClose={() => setOverlay(null)} onAdjust={() => setOverlay({ kind: 'budget', type: overlay.type, energyUnitId: null, scopeName: '全企业' })} />}
  </Page>;
}

function BudgetLine({ trends, scope, target: rawTarget, forecastReady }: { trends: Record<string, BudgetTrend>; scope: string; target: number | null; forecastReady: boolean }) {
  const trend = trends[scope] ?? trends['全企业'];
  const actual = trend.actual;
  const forecast = trend.forecast;
  const max = Math.max(...actual, ...forecast, 1) * 1.15;
  const point = (value: number, index: number, start = 0) => `${60 + (915 * (start + index) / 11)},${35 + 250 * (1 - value / max)}`;
  const target = rawTarget ?? 0;
  const ty = rawTarget === null ? null : Math.max(35, Math.min(285, 35 + 250 * (1 - target / max)));
  const yTicks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  return <div className={styles.lineChart}><svg viewBox="0 0 1000 340" preserveAspectRatio="none" role="img" aria-label={scope === '全企业' ? '年度预算累计趋势图' : `${scope}年度预算累计趋势图`}><g className={styles.chartGrid}>{[35,97.5,160,222.5,285].map((y) => <line key={y} x1="60" x2="975" y1={y} y2={y} />)}</g><g className={styles.chartAxis}>{yTicks.map((value, index) => <text key={value} x="50" y={35 + 62.5 * index + 4} textAnchor="end">{format(value)}</text>)}</g>{ty !== null && <><line x1="60" x2="975" y1={ty} y2={ty} className={styles.targetLine} /><text x="970" y={Math.min(320, ty + 16)} textAnchor="end" className={styles.targetValue}>目标 {format(target)}</text></>}<polyline points={actual.map((value, index) => point(value,index)).join(' ')} className={styles.actualLine} />{forecastReady && <polyline points={forecast.map((value, index) => point(value,index,5)).join(' ')} className={styles.forecastLine} />}{actual.map((value,index) => { const [x,y] = point(value,index).split(','); return <g key={`actual-${index}`}><circle cx={x} cy={y} r="4" className={styles.actualDot} /><text x={x} y={Number(y) - 10} textAnchor="middle" className={styles.actualValue}>{format(value)}</text></g>; })}{forecastReady && forecast.map((value,index) => { const [x,y] = point(value,index,5).split(','); return <g key={`forecast-${index}`}><circle cx={x} cy={y} r="4" className={styles.forecastDot} />{index > 0 && <text x={x} y={Number(y) - 24} textAnchor="middle" className={styles.forecastValue}>{format(value)}</text>}</g>; })}{months.map((month,index) => <text key={month} x={60 + 915 * index / 11} y="325" textAnchor="middle">{month}</text>)}<g className={styles.chartLegend}><line x1="390" x2="420" y1="18" y2="18" className={styles.actualLine} /><text x="427" y="22">实际累计值</text>{forecastReady && <><line x1="510" x2="540" y1="18" y2="18" className={styles.forecastLine} /><text x="547" y="22">预测累计值</text></>} {ty !== null && <><line x1="630" x2="660" y1="18" y2="18" className={styles.targetLine} /><text x="667" y="22">年度目标线</text></>}</g></svg></div>;
}

function BudgetDialog({ type, energyUnitId, scopeName, onClose, onSaved }: { type: BudgetType; energyUnitId: string | null; scopeName: string; onClose: () => void; onSaved: () => void }) {
  const current = getBudgetTarget(type, 2026, energyUnitId);
  const initialTarget = current?.targetValue ?? (type === 'energy' ? 120600 : 95000);
  const [target, setTarget] = useState(String(initialTarget));
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(current?.monthlyTargetValues ?? Array.from({ length: 12 }, () => initialTarget / 12));
  const [description, setDescription] = useState('');
  const fillMonthlyTargets = () => setMonthlyTargets(Array.from({ length: 12 }, () => Number(target) / 12));
  const save = () => {
    saveBudgetTarget({
      budgetTargetId: current?.budgetTargetId ?? `bt-${type}-2026`,
      budgetType: type,
      organizationId: DEMO_ORGANIZATION_ID,
      energyUnitId,
      year: 2026,
      targetValue: Number(target),
      monthlyTargetValues: monthlyTargets,
      warningThreshold: 0.95,
      targetUnit: type === 'energy' ? 'tce' : 'tCO₂e',
      description: type === 'energy' ? '年度能源消费预算' : '年度碳排放预算',
      version: current?.version ?? 1,
      versionState: '生效',
      forecastMethod: current?.forecastMethod ?? 'recentAverage',
      adjustmentReason: description,
    });
    onSaved();
  };
  return <Modal
    title={`${scopeName}｜目标预算配置`}
    description={`2026年 · ${scopeName} · ${type === 'energy' ? '能源消费预算' : '碳排放预算'} · 单位：${type === 'energy' ? 'tce' : 'tCO₂e'}`}
    width={860}
    onClose={onClose}
    footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={save}>保存配置</Button></>}
  >
    <div className={styles.budgetTargetForm}>
      <Field label="年度目标" required><input aria-label="年度目标" type="number" min="0" value={target} onInput={(event) => setTarget(event.currentTarget.value)} onChange={(event) => setTarget(event.target.value)} /></Field>
      <section className={styles.monthlyBudgetPanel}><div className={styles.monthlyBudgetHead}><strong>▼ 配置月度目标（可选）</strong></div><div className={styles.monthlyBudgetIntro}><span>月度目标用于趋势图和月度执行状态；未配置时默认按年度目标平均分配。</span><button type="button" className={styles.monthlyFillButton} onClick={fillMonthlyTargets}>按年度目标填充</button></div><div className={styles.monthlyBudgetGrid}>{monthlyTargets.map((value, index) => <Field key={months[index]} label={months[index]}><input aria-label={`${months[index]}目标`} type="number" min="0" value={Number.isFinite(value) ? value : ''} onChange={(event) => setMonthlyTargets((values) => values.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} /></Field>)}</div></section>
      <div className={styles.budgetTargetNote}>年度目标用于年度结果判断；月度趋势默认以年度目标绘制水平参考线，配置月度目标后将优先展示月度目标线。</div>
      <Field label="调整说明"><textarea aria-label="调整说明" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="填写预算制定或调整说明" /></Field>
    </div>
  </Modal>;
}

function BudgetDetailDrawer({ row, type, forecastReady, onClose, onAdjust }: { row: readonly [string, number, number, number]; type: BudgetType; forecastReady: boolean; onClose: () => void; onAdjust: () => void }) {
  const unit = type === 'energy' ? 'tce' : 'tCO₂';
  const executionRate = row[1] > 0 ? `${format(row[2] / row[1] * 100, 1)}%` : '—';
  const forecastDeviation = forecastReady ? row[3] - row[1] : null;
  const judgement = !forecastReady
    ? '当前尚未形成全年预测，暂不能判断年度预算是否会超目标。'
    : forecastDeviation! > 0
      ? `按当前预测，预计全年将超出年度目标 ${format(forecastDeviation!)} ${unit}。`
      : `按当前预测，预计全年不超过年度目标，预测结余 ${format(Math.abs(forecastDeviation!))} ${unit}。`;
  const actions = !forecastReady
    ? ['先生成全年预测，再判断预算执行风险']
    : forecastDeviation! > 0
      ? ['核对后续生产计划与月度用能安排', '确认年度目标和月度分解是否需要调整']
      : ['按月跟踪累计执行值与预测值', '生产计划发生变化时重新生成预测'];
  return <Drawer title={`${row[0]}｜预算执行详情`} width={560} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onAdjust}>调整预算</Button></>}><h3 className={styles.detailTitle}>关键证据</h3><DetailGrid values={[['年度目标', `${format(row[1])} ${unit}`],['当前累计',`${format(row[2])} ${unit}`],['预算执行率', executionRate],['预计全年', forecastReady ? `${format(row[3])} ${unit}` : '待预测'],['预测偏差', forecastReady ? `${forecastDeviation! > 0 ? '+' : ''}${format(forecastDeviation!)} ${unit}` : '待预测']]} /><h3 className={styles.detailTitle}>判断结论</h3><div className={styles.diagnosisJudgement}><Status value={forecastReady ? (forecastDeviation! > 0 ? '超目标风险' : '预计正常') : '待预测'} /><p>{judgement}</p></div><h3 className={styles.detailTitle}>建议动作</h3><ul className={styles.diagnosisActions}>{actions.map((action) => <li key={action}>{action}</li>)}</ul></Drawer>;
}

function CarbonAssetsPage() {
  const { toast, notify } = useFeedback();
  const [cycle, setCycle] = useState('2026年度');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [aiVersion, setAiVersion] = useState(0);
  const assets = listCarbonAssets(cycle);
  const snapshot = latestCarbonSnapshot(Number(cycle.slice(0, 4)));
  const quota = assets.find((asset) => asset.assetType === '碳配额');
  const ccerAssets = assets.filter((asset) => asset.assetType === 'CCER');
  const quotaAvailable = quota?.eligibleAmount ?? 0;
  const ccerAvailable = ccerAssets.reduce((sum, asset) => sum + asset.eligibleAmount, 0);
  const availableForFulfilment = quotaAvailable + ccerAvailable;
  const currentNeed = snapshot?.totalEmission ?? 0;
  const currentSurplus = availableForFulfilment - currentNeed;
  const currentCoverageRate = currentNeed > 0 ? Math.min(100, availableForFulfilment / currentNeed * 100) : 0;
  const [businessChange, setBusinessChange] = useState(0.1);
  const [intensityChange, setIntensityChange] = useState(-0.02);
  const [showForecastProcess, setShowForecastProcess] = useState(false);
  const [industryBalanceChange, setIndustryBalanceChange] = useState(0);
  const [appliedScenario, setAppliedScenario] = useState<CarbonForecastScenario>({ productionChange: 0.1, productIntensityChange: -0.02, industryBalanceChange: 0 });
  const nextCycleCarryoverAssets = listNextCycleCarryoverAssets(assets, cycle);
  const expectedCarryover = nextCycleCarryoverAssets.reduce((sum, asset) => sum + (asset.carryoverEligibleAmount ?? 0), 0);
  const productionMetric = listV11OperationMetrics().find((metric) => metric.year === Number(cycle.slice(0, 4)) && metric.scopeLevel === '企业' && metric.metricCode === 'product_output' && metric.productId === null);
  const derivedBaseProduction = Math.max(1, productionMetric ? annualOperationValue(productionMetric) : 1);
  const derivedBaseUnitProductIntensity = currentNeed / derivedBaseProduction;
  const baseProduction = derivedBaseProduction;
  const baseUnitProductIntensity = derivedBaseUnitProductIntensity;
  const baseIndustryBalance = 0.0446;

  const [manualIndustryBalance, setManualIndustryBalance] = useState<number | null>(null);
  const effectiveIndustryBalance = manualIndustryBalance ?? baseIndustryBalance;
  const industryAllocationRule = getIndustryAllocationRule()!;
  const forecast = calculateCarbonForecast({
    baseProduction,
    baseUnitProductIntensity,
    baseIndustryBalance: effectiveIndustryBalance,
    carryoverAssets: expectedCarryover,
    industryAllocationRule,
    scenario: { productionChange: businessChange, productIntensityChange: intensityChange, industryBalanceChange: 0 },
  });
  const { expectedProduction, expectedUnitProductIntensity, expectedIndustryBalance, expectedEmission: nextEmission, expectedQuota, intensityDeviation, quotaAdjustmentCoefficient, expectedCarryover: nextCarryover, balance: nextBalance, gap: nextGap, surplus: nextSurplus } = forecast;
  const nextCoverageRate = nextEmission > 0 ? (expectedQuota + nextCarryover) / nextEmission : 1;
  const nextRiskStatus = nextCoverageRate >= 1 ? '风险：较低' : '风险：需关注';
  const ruleTitle = industryAllocationRule
    ? `测算规则：${industryAllocationRule.applicableIndustry} · 参考${industryAllocationRule.referenceYear}年度规则（${industryAllocationRule.status}）`
    : '通用工业企业（规则待匹配） · 参考上一年度规则 · 情景估算';
  const pendingForReview = assets.filter((asset) => asset.assetState === '待核验').reduce((sum, asset) => sum + asset.totalAmount, 0);
  const assetTypeAttribute = (type: CarbonAssetType) => type === '碳配额' ? '可履约' : type === 'CCER' ? '可抵销' : '暂不可用';
  const [assetTypeFilter, setAssetTypeFilter] = useState<'全部' | CarbonAssetType>('全部');
  const visibleAssets = assetTypeFilter === '全部' ? assets : assets.filter((asset) => asset.assetType === assetTypeFilter);
  const assetTypeStats = (['碳配额', 'CCER', '绿证折算减排量'] as CarbonAssetType[]).map((type) => {
    const rows = assets.filter((asset) => asset.assetType === type);
    return { type, total: rows.reduce((sum, asset) => sum + asset.totalAmount, 0), available: rows.reduce((sum, asset) => sum + asset.eligibleAmount, 0), used: rows.reduce((sum, asset) => sum + asset.usedAmount, 0), count: rows.length };
  });
  const coverageScale = Math.max(currentNeed, availableForFulfilment, 1);
  const demandPosition = Math.min(100, currentNeed / coverageScale * 100);
  const gapWidth = Math.min(100, Math.max(0, currentNeed - availableForFulfilment) / coverageScale * 100);
  const gapPosition = Math.min(100, availableForFulfilment / coverageScale * 100 + gapWidth / 2);
  const nextRiskText = nextBalance < 0
    ? `预计配额及可用于下一周期的履约资产不足以覆盖预计排放，预计履约缺口为 ${format(nextGap)} tCO₂，建议提前准备履约资产。`
    : expectedQuota >= nextEmission
      ? `预计配额已可覆盖下一履约周期预计排放；叠加可结转资产后，预计履约余量为 ${format(nextSurplus)} tCO₂。`
      : `预计配额尚不足以覆盖下一履约周期预计排放；叠加可结转资产后，预计履约余量为 ${format(nextSurplus)} tCO₂。`;
  void version;
  return <Page toast={toast}>
    <section className={`${styles.card} ${styles.filters}`}><Field label="履约周期"><select value={cycle} onChange={(event) => { setCycle(event.target.value); setAssetTypeFilter('全部'); setAiVersion((current) => current + 1); }}><option>2026年度</option><option>2025年度</option></select></Field><div className={styles.filterSpacer} /><Button primary onClick={() => notify(`已刷新 ${cycle} 履约视图`)}>查询</Button><Button onClick={() => { setCycle('2026年度'); setAssetTypeFilter('全部'); notify('已重置履约视图'); }}>重置</Button></section>
    <section className={styles.referenceTwoCol}><section className={`${styles.card} ${styles.referenceSection}`}><div className={styles.referenceSectionHead}><h2>当前年度履约覆盖情况</h2><span className={`${styles.coverageStatus} ${currentSurplus >= 0 ? styles.coverageStatusOk : styles.coverageStatusAttention}`}>{cycle} · {currentSurplus >= 0 ? '履约状态：充足' : '履约状态：需关注'}</span></div><div className={styles.coverageMetrics}><div><small>预计履约需求</small><strong className={styles.blueText}>{format(currentNeed)} <em>tCO₂</em></strong></div><div><small>已确认可用资产</small><strong>{format(availableForFulfilment)} <em>tCO₂</em></strong></div><div><small>履约覆盖率</small><strong className={currentSurplus >= 0 ? styles.greenText : styles.redText}>{currentCoverageRate.toFixed(1)}%</strong></div><div><small>{currentSurplus >= 0 ? '预计结余' : '预计缺口'}</small><strong className={currentSurplus >= 0 ? styles.greenText : styles.redText}>{format(Math.abs(currentSurplus))} <em>tCO₂</em></strong></div></div><div className={styles.referenceCoverageFigure}><div className={styles.referenceCoverageBar}><i className={styles.coverageQuota} style={{ width: `${Math.min(100, quotaAvailable / coverageScale * 100)}%` }} /><i className={styles.coverageCcer} style={{ width: `${Math.min(100, ccerAvailable / coverageScale * 100)}%` }} />{gapWidth > 0 && <span className={styles.coverageGapLabel} style={{ left: `${gapPosition}%` }}>待补足 {format(Math.abs(currentSurplus))} tCO₂</span>}{gapWidth > 0 && <i className={styles.coverageGap} style={{ width: `${gapWidth}%` }} />}<i className={styles.coverageDemandMarker} style={{ left: `${demandPosition}%` }} /></div><div className={styles.referenceBarScale}><span>0</span><span className={styles.coverageDemandLabel} style={{ left: `${demandPosition}%` }}><strong>{format(currentNeed)} <em>tCO₂</em></strong></span></div></div><div className={styles.referenceLegend}><span><i className={styles.coverageQuota} />碳配额覆盖 {format(quotaAvailable)} tCO₂</span><span><i className={styles.coverageCcer} />CCER等抵销 {format(ccerAvailable)} tCO₂</span><span><i className={styles.coverageGap} />待补足 {format(Math.max(0, currentNeed - availableForFulfilment))} tCO₂</span></div></section><section className={`${styles.card} ${styles.referenceSection}`}><div className={styles.referenceSectionHead}><h2>履约状态提示</h2><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'rules' })}>查看规则说明</button></div><p className={styles.ruleSummaryText}>{currentSurplus >= 0 ? '根据当前履约需求与已确认可用资产判断，当前周期履约覆盖充足。' : '根据当前履约需求与已确认可用资产判断，当前周期存在履约缺口。'}</p><div className={styles.ruleList}><div className={styles.ruleItem}><span className={styles.ruleBadgeOk}>✓</span><span>当前周期{currentSurplus >= 0 ? `覆盖充足，预计结余 ${format(currentSurplus)} tCO₂` : `预计缺口 ${format(Math.abs(currentSurplus))} tCO₂`}</span></div>{pendingForReview > 0 && <div className={styles.ruleItem}><span className={styles.ruleBadgeWarn}>◷</span><span>存在 <strong>{format(pendingForReview)} tCO₂</strong> 待核验资产，不计入当前履约覆盖</span></div>}<div className={styles.ruleItem}><span className={nextBalance < 0 ? styles.ruleBadgeDanger : styles.ruleBadgeOk}>{nextBalance < 0 ? '!' : '✓'}</span><span>{Number(cycle.slice(0, 4)) + 1}年度情景测算{nextBalance < 0 ? `预计履约缺口 ${format(nextGap)} tCO₂，建议提前准备` : expectedQuota >= nextEmission ? `预计配额已覆盖排放，叠加可结转资产后余量 ${format(nextSurplus)} tCO₂` : `预计配额不足，但叠加可结转资产后余量 ${format(nextSurplus)} tCO₂`}</span></div></div></section></section>
    <section className={`${styles.card} ${styles.referenceSection} ${styles.referenceAssets}`}><div className={styles.referenceSectionHead}><h2>履约资产构成</h2><span>点击资产类型查看台账明细</span></div><div className={styles.referenceAssetGrid}>{assetTypeStats.map((row) => <button type="button" key={row.type} className={styles.referenceAssetCard} onClick={() => { setAssetTypeFilter(row.type); document.querySelector(`.${styles.assetLedger}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><div className={styles.referenceAssetTop}><div><b>{row.type}</b><strong>{format(row.total)} <em>tCO₂</em></strong></div></div><div className={styles.referenceAssetMeta}><span>已使用 <b>{format(row.used)}</b></span><span>当前可用 <b>{format(row.available)}</b></span><span>{row.type === '绿证折算减排量' ? '计入履约' : '可结转/可用'} <b>{format(row.available)}</b></span></div></button>)}</div></section>
    <section className={`${styles.card} ${styles.referenceForecast}`}><div className={styles.referenceSectionHead}><h2>下一履约周期预测 <span className={styles.planTag}>{Number(cycle.slice(0, 4)) + 1}年度</span></h2><span>{ruleTitle}　<button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'quotaRules' })}>调整参考值</button></span></div><div className={styles.referenceForecastGrid}><div className={styles.referenceScenario}><h3>情景假设</h3><div className={styles.referenceScenarioControls}><Field label="预计产量变化"><select value={businessChange} onChange={(event) => setBusinessChange(Number(event.target.value))}><option value={-0.1}>-10%</option><option value={0}>0%</option><option value={0.05}>+5%</option><option value={0.1}>+10%</option><option value={0.15}>+15%</option></select></Field><Field label="单位产品排放强度变化"><select value={intensityChange} onChange={(event) => setIntensityChange(Number(event.target.value))}><option value={-0.1}>-10%</option><option value={-0.05}>-5%</option><option value={-0.02}>-2%</option><option value={0}>0%</option><option value={0.05}>+5%</option></select></Field><Field label="行业平衡值变化"><select value={industryBalanceChange} onChange={(event) => setIndustryBalanceChange(Number(event.target.value))}><option value={-0.1}>-10%</option><option value={-0.05}>-5%</option><option value={0}>0%</option><option value={0.05}>+5%</option><option value={0.1}>+10%</option></select></Field></div><div className={styles.forecastFormulaBlock}><p>排放测算逻辑：预计产量 × 预计单位产品排放强度 = {format(expectedProduction)} t × {format(expectedUnitProductIntensity, 4)} tCO₂/t</p>{industryAllocationRule ? <><p>强度偏离度 X =（BP − I）÷ BP =（{format(expectedIndustryBalance, 4)} − {format(expectedUnitProductIntensity, 4)}）÷ {format(expectedIndustryBalance, 4)} = {format(intensityDeviation! * 100, 2)}%</p><p>配额调整系数 α = 0.15 × X = 0.15 × {format(intensityDeviation! * 100, 2)}% = {format(quotaAdjustmentCoefficient! * 100, 2)}%（当前规则：−20% &lt; X &lt; 20%）</p><p>预计配额 A：预计排放 ×（1 + α）= {format(expectedQuota)} tCO₂</p></> : <p>配额测算逻辑：未加载正式行业规则，使用人工配置的情景配额值或简化估算值 {format(expectedQuota)} tCO₂</p>}</div><p className={styles.forecastModelNote}>{industryAllocationRule ? '测算结果基于当前行业配额规则及情景假设，仅用于履约准备分析，不代表主管部门最终核定配额。' : '当前采用通用情景估算，未加载正式行业配额规则；预计配额为非正式行业配额测算结果。'}</p><Button primary onClick={() => { setAppliedScenario({ productionChange: businessChange, productIntensityChange: intensityChange, industryBalanceChange }); setAiVersion((current) => current + 1); notify('情景测算已更新'); }}>重新测算</Button></div><div className={styles.referenceForecastResult}><div className={styles.referenceForecastHead}><h3>预测结果</h3><Status value={nextRiskStatus} /></div><p className={styles.forecastRiskHint}>{nextRiskText}</p><div className={styles.referenceForecastMetrics}><div><span>预计排放</span><strong>{format(nextEmission)} <em>tCO₂</em></strong></div><div><span>预计配额</span><strong className={styles.blueText}>{format(expectedQuota)} <em>tCO₂</em></strong></div><div><span>预计可结转资产</span><strong className={styles.greenText}>{format(nextCarryover)} <em>tCO₂</em></strong><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'carryoverDetail', assets: nextCycleCarryoverAssets })}>查看构成</button></div><div><span>{nextBalance >= 0 ? '预计履约余量' : '预计履约缺口'}</span><strong className={nextBalance >= 0 ? styles.greenText : styles.redText}>{format(Math.abs(nextBalance))} <em>tCO₂</em></strong></div></div></div></div></section>
    <section className={`${styles.card} ${styles.tableCard} ${styles.assetLedger}`}><div className={styles.panelHead}><div><h2>碳资产台账</h2><p className={styles.panelHint}>{assetTypeFilter === '全部' ? `2026年度资产明细：履约属性反映资产可用范围。` : `当前筛选：${assetTypeFilter}`}</p></div><Button primary onClick={() => setOverlay({ kind: 'asset' })}>录入碳资产</Button></div><div className={styles.tableWrap}><table className={styles.assetTable}><thead><tr><th>资产类型</th><th>履约周期</th><th>来源</th><th>取得量(tCO₂)</th><th>已使用</th><th>当前可用</th><th>履约属性</th><th>操作</th></tr></thead><tbody>{visibleAssets.map((asset) => <tr key={asset.carbonAssetId}><td>{asset.assetType}</td><td>{asset.complianceCycle}</td><td>{asset.assetSource}</td><td>{format(asset.totalAmount)}</td><td>{format(asset.usedAmount)}</td><td>{format(asset.eligibleAmount)}</td><td><Status value={assetTypeAttribute(asset.assetType)} /></td><td><div className={styles.assetActions}><button type="button" className={styles.link} onClick={() => asset.voucherNumber ? setOverlay({ kind: 'assetDetail', asset }) : setOverlay({ kind: 'asset', asset })}>{asset.voucherNumber ? '查看凭证' : '上传凭证'}</button><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'asset', asset })}>编辑</button></div></td></tr>)}</tbody></table></div></section>
    <NextCycleForecastModule cycle={cycle} baseProduction={baseProduction} baseIntensity={baseUnitProductIntensity} baseBalance={effectiveIndustryBalance} carryover={expectedCarryover} rule={industryAllocationRule} onAdjustIndustryBalance={() => setOverlay({ kind: 'quotaRules' })} />
    <AssetAiAnalysis analysisKey="asset" invalidationVersion={aiVersion} notify={notify} />
    {overlay?.kind === 'asset' && <AssetDialog asset={overlay.asset} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setVersion((value) => value + 1); setAiVersion((current) => current + 1); notify('碳资产已保存，AI结果需重新生成'); }} />}
    {overlay?.kind === 'assetDetail' && <AssetDrawer asset={overlay.asset} onClose={() => setOverlay(null)} onReplace={() => setOverlay({ kind: 'asset', asset: overlay.asset })} />}
    {overlay?.kind === 'quotaRules' && <CarbonQuotaParametersDialog baseIndustryBalance={effectiveIndustryBalance} onClose={() => setOverlay(null)} onSave={(value) => { setManualIndustryBalance(value); setOverlay(null); notify('行业参考基准已应用于本次测算'); }} />}
    {overlay?.kind === 'carryoverDetail' && <Modal title="下一周期可用履约资产构成" width={620} onClose={() => setOverlay(null)} footer={<Button primary onClick={() => setOverlay(null)}>关闭</Button>}><div className={styles.tableWrap}><table className={styles.assetTable}><thead><tr><th>资产类型</th><th>来源</th><th>履约状态</th><th>可结转量(tCO₂)</th></tr></thead><tbody>{overlay.assets.length ? overlay.assets.map((asset) => <tr key={asset.carbonAssetId}><td>{asset.assetType}</td><td>{asset.assetSource}</td><td>{asset.assetState}</td><td>{format(asset.carryoverEligibleAmount ?? 0)}</td></tr>) : <tr><td colSpan={4}>暂无符合条件的下一周期可结转资产</td></tr>}</tbody></table></div></Modal>}
    {overlay?.kind === 'rules' && <Modal title="履约状态与预测规则说明" width={600} onClose={() => setOverlay(null)} footer={<Button primary onClick={() => setOverlay(null)}>知道了</Button>}><div className={styles.referenceRuleModal}><p><strong>当前履约状态规则</strong></p><p><strong>规则1｜当前履约覆盖：</strong>碳配额与符合规则的CCER等已确认可用资产之和，大于等于预计履约需求时，判断为“充足”；否则按差额形成预计缺口。</p><p><strong>规则2｜资产有效性：</strong>待核验、过期或暂不可履约的资产不计入当前履约覆盖量。</p><p><strong>规则3｜覆盖率与缺口：</strong>履约覆盖率 = 已确认可用资产 ÷ 预计履约需求；预计缺口 = 预计履约需求 − 已确认可用资产。</p><p className={styles.ruleModalNote}>以上为当前履约周期（{cycle}）的状态判断规则。</p><p><strong>下一履约周期预测规则</strong></p><p><strong>规则1｜排放侧：</strong>预计产量 × 预计单位产品排放强度 = 预计排放。</p><p><strong>规则2｜配额侧：</strong>比较预计企业排放强度与预计行业平衡值，计算强度偏离度和配额调整系数，再由预计排放 ×（1 + 配额调整系数）得到预计配额。</p><p><strong>规则3｜行业规则边界：</strong>水泥、钢铁、铝冶炼等行业应使用对应行业配额规则；未配置行业规则时，当前使用通用工业简化强度基准估算，也可扩展为人工填写预计配额。</p><p><strong>规则4｜预计履约余量/缺口：</strong>预计配额 + 可用于下一周期的履约资产 − 预计排放；结果大于等于0为履约余量，小于0为履约缺口。</p><p className={styles.ruleModalNote}>测算结果基于当前行业配额规则及情景假设，仅用于履约准备分析，不代表主管部门最终核定配额。</p></div></Modal>}
  </Page>;
}

function ForecastBasisDialog({
  cycle,
  baseProduction,
  baseIntensity,
  baseBalance,
  carryover,
  rule,
  onClose,
}: {
  cycle: string;
  baseProduction: number;
  baseIntensity: number;
  baseBalance: number;
  carryover: number;
  rule: IndustryAllocationRule;
  onClose: () => void;
}) {
  return <Modal title="下一周期测算依据" width={720} onClose={onClose} footer={<Button primary onClick={onClose}>知道了</Button>}>
    <div className={`${styles.referenceRuleModal} ${styles.forecastBasisDialog}`}>
      <p><strong>企业基础数据</strong></p>
      <div className={styles.sourceCard}><span>基期产量</span><strong>{format(baseProduction)} t</strong><span>来源</span><span>运营数据 · {cycle}主产品产量</span><span>基期单位产品排放强度</span><strong>{format(baseIntensity, 4)} tCO₂/t</strong><span>来源</span><span>碳排放核算结果 ÷ 基期产品产量</span></div>
      <p><strong>政策规则参数</strong></p>
      <div className={styles.sourceCard}><span>适用范围</span><span>{rule.applicableIndustry}</span><span>配额规则</span><span>{rule.ruleVersion} · 情景估算</span><span>行业参考基准强度</span><strong>{format(baseBalance, 4)} tCO₂/t</strong><span>参数状态</span><span>情景参考值 · 非正式核定</span><span>X计算公式</span><span>{rule.deviationRule}</span><span>α计算规则</span><span>{rule.coefficientRule}</span></div>
      <p><strong>碳资产数据</strong></p>
      <div className={styles.sourceCard}><span>预计可结转资产</span><strong>{format(carryover)} tCO₂</strong><span>来源</span><span>碳资产台账 · 按有效、已核验、可结转规则汇总</span><span>用户可调整项</span><span>预计产量变化、单位产品排放强度变化</span></div>
      <p className={styles.ruleModalNote}>本模块用于下一履约周期准备分析。未来年度政策参数尚未正式发布时，行业参考基准仅作为情景参考值，测算结果不代表主管部门最终核定配额。</p>
    </div>
  </Modal>;
}

function NextCycleForecastModule({
  cycle,
  baseProduction,
  baseIntensity,
  baseBalance,
  carryover,
  rule,
  onAdjustIndustryBalance,
}: {
  cycle: string;
  baseProduction: number;
  baseIntensity: number;
  baseBalance: number;
  carryover: number;
  rule: IndustryAllocationRule;
  onAdjustIndustryBalance: () => void;
}) {
  const [productionChange, setProductionChange] = useState(0.1);
  const [intensityChange, setIntensityChange] = useState(-0.02);
  const [draftProductionChange, setDraftProductionChange] = useState(0.1);
  const [draftIntensityChange, setDraftIntensityChange] = useState(-0.02);
  const [productionCustom, setProductionCustom] = useState(false);
  const [intensityCustom, setIntensityCustom] = useState(false);
  const [showProcess, setShowProcess] = useState(true);
  const result = calculateCarbonForecast({ baseProduction, baseUnitProductIntensity: baseIntensity, baseIndustryBalance: baseBalance, carryoverAssets: carryover, industryAllocationRule: rule, scenario: { productionChange, productIntensityChange: intensityChange, industryBalanceChange: 0 } });
  const marginRate = result.expectedEmission > 0 ? result.balance / result.expectedEmission : 0;
  const marginRatePercent = marginRate * 100;
  const isShortfall = result.balance < 0;
  const isLowMargin = !isShortfall && marginRate < 0.03;
  const risk = isShortfall ? '需关注' : isLowMargin ? '低余量' : '余量正常';
  const summary = isShortfall
    ? `当前情景下预计存在履约缺口，建议提前准备补充履约资产。`
    : isLowMargin
      ? `预计不会形成履约缺口，但安全余量较低。若实际排放较当前预测增加约${(marginRate * 100).toFixed(1)}%以上，可能出现履约缺口。`
      : '预计配额与可结转资产可以覆盖下一履约周期预计排放，当前情景下履约保障度较好。';
  return <section className={styles.forecastV2}>
    <div className={styles.forecastV2Head}><div><h2>下一履约周期情景测算 <span className={styles.planTag}>{Number(cycle.slice(0, 4)) + 1}年度</span></h2></div></div>
    <div className={styles.forecastBasis}><div><span>基期</span><strong>{cycle}实际数据</strong></div><div><span>适用范围</span><strong>通用工业企业（规则待匹配）</strong></div><div><span>配额规则</span><strong>参考{rule.referenceYear}年度规则 · 情景估算</strong></div><div><span>行业基准参数</span><span><strong className={styles.warningText}>{format(baseBalance, 4)} tCO₂/t · 情景参考值</strong> <button type="button" className={styles.link} onClick={onAdjustIndustryBalance}>调整参考值</button></span></div></div>
    <div className={styles.forecastV2Grid}>
      <div className={styles.scenarioV2}>
        <h3>情景设置</h3>
        <div className={styles.scenarioV2Controls}>
          <div className={styles.scenarioControlV2}>
            <label>预计产量变化</label>
            <select value={productionCustom ? 'custom' : String(draftProductionChange)} onChange={(event) => { if (event.target.value === 'custom') { setProductionCustom(true); return; } setProductionCustom(false); setDraftProductionChange(Number(event.target.value)); }}>
              <option value={-0.1}>-10%</option><option value={0}>0%</option><option value={0.05}>+5%</option><option value={0.1}>+10%</option><option value={0.15}>+15%</option><option value="custom">自定义</option>
            </select>
            {productionCustom && <div className={styles.customScenarioInput}><input type="number" value={draftProductionChange * 100} min={-100} max={100} step={0.1} onChange={(event) => setDraftProductionChange(Number(event.target.value) / 100)} /><span>%</span></div>}
            <div>基期 {format(baseProduction)} t → 预计 <strong>{format(baseProduction * (1 + draftProductionChange))} t</strong></div>
          </div>
          <div className={styles.scenarioControlV2}>
            <label>单位产品排放强度变化</label>
            <select value={intensityCustom ? 'custom' : String(draftIntensityChange)} onChange={(event) => { if (event.target.value === 'custom') { setIntensityCustom(true); return; } setIntensityCustom(false); setDraftIntensityChange(Number(event.target.value)); }}>
              <option value={-0.1}>-10%</option><option value={-0.05}>-5%</option><option value={-0.02}>-2%</option><option value={0}>0%</option><option value={0.05}>+5%</option><option value="custom">自定义</option>
            </select>
            {intensityCustom && <div className={styles.customScenarioInput}><input type="number" value={draftIntensityChange * 100} min={-100} max={100} step={0.1} onChange={(event) => setDraftIntensityChange(Number(event.target.value) / 100)} /><span>%</span></div>}
            <div>基期 {format(baseIntensity, 4)} tCO₂/t → 预计 <strong>{format(baseIntensity * (1 + draftIntensityChange), 4)} tCO₂/t</strong></div>
          </div>
        </div>
        <div className={styles.scenarioHelper}>调整情景参数后，点击“开始测算”更新右侧结果；支持下拉预设或自定义百分比。</div>
        <div className={styles.scenarioV2Actions}>
          <button type="button" className={styles.primaryButtonV2} onClick={() => { setProductionChange(draftProductionChange); setIntensityChange(draftIntensityChange); }}>开始测算</button>
          <button type="button" className={styles.outlineButton} onClick={() => { setDraftProductionChange(0.1); setDraftIntensityChange(-0.02); setProductionChange(0.1); setIntensityChange(-0.02); setProductionCustom(false); setIntensityCustom(false); }}>恢复默认情景</button>
        </div>
      </div>
      <div className={`${styles.forecastResultV2} ${isShortfall ? styles.resultNegative : ''}`}><div className={styles.resultV2Top}><div><span>预计履约{isShortfall ? '缺口' : '余量'}</span><strong>{isShortfall ? format(Math.abs(result.balance)) : `+${format(result.balance)}`} <em>tCO₂</em></strong><small>余量率 {marginRatePercent.toFixed(2)}%{isLowMargin ? ' · 低于3%，安全余量偏低' : ''}</small></div><span className={`${styles.riskChipV2} ${isShortfall ? styles.riskWarnV2 : isLowMargin ? styles.riskLowV2 : styles.riskOkV2}`}>{risk}</span></div><div className={styles.balanceEquationV2}><div><span>预计获得配额</span><strong>{format(result.expectedQuota)}</strong></div><i>＋</i><div><span>预计可结转资产</span><strong>{format(result.expectedCarryover)}</strong></div><i>−</i><div><span>预计排放</span><strong>{format(result.expectedEmission)}</strong></div><i>＝</i><div className={styles.equationResultV2}><span>预计{isShortfall ? '缺口' : '余量'}</span><strong>{format(Math.abs(result.balance))}</strong></div></div><div className={styles.resultSummaryV2}><strong>当前判断：</strong>{summary}</div><div className={styles.actionTipV2}>建议持续关注产量及排放强度变化；若经营计划上调，提前准备补充履约资产。</div><div className={styles.resultLinksV2}><button type="button" className={styles.textActionV2} onClick={() => setShowProcess((value) => !value)}>{showProcess ? '收起测算过程' : '查看测算过程'}</button></div></div>
    </div>
    {showProcess && <div className={styles.calcDetailsV2}><p>① 预计排放：{format(result.expectedProduction)} t × {format(result.expectedUnitProductIntensity, 4)} tCO₂/t = {format(result.expectedEmission)} tCO₂</p><p>② 行业规则判断：企业预计强度 {format(result.expectedUnitProductIntensity, 4)} vs 行业参考基准 {format(result.expectedIndustryBalance, 4)} → X = {result.intensityDeviation !== null ? `${result.intensityDeviation >= 0 ? '+' : ''}${(result.intensityDeviation * 100).toFixed(2)}%` : '—'}</p><p>③ 配额调整：α = {result.quotaAdjustmentCoefficient !== null ? `${result.quotaAdjustmentCoefficient >= 0 ? '+' : ''}${(result.quotaAdjustmentCoefficient * 100).toFixed(2)}%` : '—'}（参考规则自动计算）</p><p>④ 预计配额：{format(result.expectedEmission)} ×（1 + α）= {format(result.expectedQuota)} tCO₂</p></div>}
  </section>;
}

function CarbonQuotaParametersDialog({ baseIndustryBalance, onClose, onSave }: { baseIndustryBalance: number; onClose: () => void; onSave: (value: number) => void }) {
  const [industryBalance, setIndustryBalance] = useState(String(baseIndustryBalance));
  const save = () => {
    const value = Number(industryBalance);
    if (Number.isFinite(value) && value > 0) onSave(value);
  };
  return <Modal title="调整行业参考基准" width={520} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button onClick={() => onSave(0.0446)}>恢复默认</Button><Button primary onClick={save}>应用测算</Button></>}>
    <div className={styles.referenceRuleModal}>
      <p>当前值仅用于下一履约周期情景测算，不修改系统默认配置。</p>
      <Field label="行业参考基准（tCO₂/t）"><input type="number" min="0.0001" step="0.0001" value={industryBalance} onChange={(event) => setIndustryBalance(event.target.value)} /></Field>
      <p className={styles.forecastModelNote}>当前默认值：0.0446 tCO₂/t；调整后将重新计算强度偏离度、配额调整系数和预计履约余量/缺口。</p>
    </div>
  </Modal>;
}
function AssetCoverage({ expectedEmission, quotaAvailable, ccer, gap }: { expectedEmission: number; quotaAvailable: number; ccer: number; gap: number }) {
  const covered = Math.min(expectedEmission, quotaAvailable + ccer);
  const max = Math.max(expectedEmission, quotaAvailable + ccer, 1);
  const quotaWidth = Math.min(100, quotaAvailable / max * 100);
  const ccerWidth = Math.min(100 - quotaWidth, ccer / max * 100);
  const gapWidth = Math.min(100, gap / max * 100);
  return <div className={styles.assetCoverage}>
    <div className={styles.coverageTrackWrap}><div className={styles.coverageTrack} aria-label="资产覆盖分析"><i className={styles.coverageQuota} style={{ width: `${quotaWidth}%` }} /><i className={styles.coverageCcer} style={{ width: `${ccerWidth}%` }} /><i className={styles.coverageGap} style={{ width: `${gapWidth}%` }} /></div><i className={styles.coverageDemandMarker} style={{ left: `${Math.min(100, expectedEmission / max * 100)}%` }}><b>{format(expectedEmission)}</b><span>预计需求</span></i></div>
    <div className={styles.coverageScale}><span>0</span><span>{format(max)} tCO₂</span></div>
    <div className={styles.coverageLegend}><span><i className={styles.coverageQuota} />可用配额 <b>{format(quotaAvailable)} tCO₂</b></span><span><i className={styles.coverageCcer} />可用CCER <b>{format(ccer)} tCO₂</b></span><span><i className={styles.coverageGap} />预计缺口 <b>{format(gap)} tCO₂</b></span></div>
    <p className={styles.coverageConclusion}>{gap > 0 ? `预计全年履约需求为 ${format(expectedEmission)} tCO₂，现有资产可覆盖 ${format(covered)} tCO₂，还需准备 ${format(gap)} tCO₂。` : `预计全年履约需求为 ${format(expectedEmission)} tCO₂，现有资产预计可全部覆盖。`}</p>
  </div>;
}

function AssetDialog({ asset, onClose, onSaved }: { asset?: CarbonAsset; onClose: () => void; onSaved: () => void }) {
  const [assetType, setAssetType] = useState<CarbonAssetType>(asset?.assetType ?? '碳配额');
  const [source, setSource] = useState(asset?.assetSource ?? '政府分配');
  const [amount, setAmount] = useState(String(asset?.totalAmount ?? ''));
  const [remark, setRemark] = useState(asset?.remark ?? '');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileSelected, setFileSelected] = useState(false);
  const [error, setError] = useState('');
  const selectFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
    setFileSelected(true);
    setError('');
  };
  return <Modal title={asset ? '编辑碳资产' : '录入碳资产'} width={620} onClose={onClose} onSubmit={() => {
    if (!(Number(amount) > 0)) return setError('请输入有效的资产数量。');
    const used = asset?.usedAmount ?? 0;
    const locked = asset?.lockedAmount ?? 0;
    const eligible = assetType === '绿证折算减排量' ? 0 : Math.max(0, Number(amount) - used - locked);
    const result = saveCarbonAsset({ complianceCycle: '2026年度', assetType, assetSource: source, totalAmount: Number(amount), eligibleAmount: eligible, carryoverEligibleAmount: asset?.carryoverEligibleAmount ?? 0, lockedAmount: locked, usedAmount: used, voucherNumber: fileName || asset?.voucherNumber || `MOCK-${Date.now()}`, voucherPreviewUrl: fileSelected ? (previewUrl || undefined) : asset?.voucherPreviewUrl, bookedAt: asset?.bookedAt ?? '2026-07-28', remark }, asset?.carbonAssetId);
    if (!result.ok) return setError(result.error);
    onSaved();
  }}><div className={styles.formGrid}><Field label="资产类型" required><select value={assetType} onChange={(event) => setAssetType(event.target.value as CarbonAssetType)}><option>碳配额</option><option>CCER</option><option>绿证折算减排量</option></select></Field><Field label="履约周期" required><select><option>2026年度</option></select></Field><Field label="资产来源" required><select value={source} onChange={(event) => setSource(event.target.value)}><option>政府分配</option><option>市场购买</option><option>内部转化</option></select></Field><Field label="资产数量（tCO₂）" required><input aria-label="资产数量（tCO₂）" required type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="请输入数量" /></Field><div className={styles.full}><div className={styles.voucherUploadSection}><span className={styles.voucherUploadLabel}>凭证材料</span><label className={styles.voucherDropzone} htmlFor="carbon-asset-voucher-file" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}><span className={styles.voucherUploadIcon}>↑</span><strong>点击或拖拽文件到此处上传</strong><small>支持图片或PDF，单个文件不超过20MB</small><span className={styles.voucherChooseButton}>选择文件</span><input id="carbon-asset-voucher-file" className={styles.voucherFileInput} type="file" accept="image/*,.pdf" onChange={(event) => selectFile(event.target.files?.[0])} /></label>{previewUrl && <img className={styles.voucherUploadPreview} src={previewUrl} alt="待保存凭证预览" />}{fileName && <p className={styles.voucherSelected}>已选择凭证</p>}{!fileName && asset?.voucherNumber && <p className={styles.voucherExisting}>已有凭证，可重新选择文件进行更换</p>}</div></div><div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="填写资产来源或使用限制说明" /></Field></div>{error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}</div></Modal>;
}

function AssetDrawer({ asset, onClose, onReplace }: { asset: CarbonAsset; onClose: () => void; onReplace: () => void }) {
  const hasFile = Boolean(asset.voucherPreviewUrl);
  return <Modal title={`${asset.assetType}｜已上传凭证`} width={720} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onReplace}>更换凭证</Button></>}><div className={styles.voucherPreviewBody}>{hasFile ? <div className={styles.voucherFilePanel}><div className={styles.voucherFileIcon}>FILE</div><div className={styles.voucherFileMeta}><strong>{asset.voucherNumber || '已上传凭证文件'}</strong><span>已上传文件，可在线查看或下载</span><div className={styles.voucherFileActions}><a href={asset.voucherPreviewUrl} target="_blank" rel="noreferrer">查看文件</a><a href={asset.voucherPreviewUrl} download={asset.voucherNumber || `${asset.assetType}-凭证`}>下载文件</a></div></div></div> : <div className={styles.voucherPreviewEmpty}><span>暂无已上传凭证</span><small>当前资产没有可查看或下载的凭证文件。</small></div>}</div></Modal>;
}

function DetailGrid({ values }: { values: [string, string][] }) {
  return <div className={styles.detailGrid}>{values.map(([label,value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}

function formatSignedPercent(value: number) {
  const rounded = value.toFixed(2);
  return `${value > 0 ? '+' : ''}${rounded}%`;
}






