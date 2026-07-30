/* eslint-disable no-irregular-whitespace */
import { useMemo, useState, type ReactNode } from 'react';
import {
  getBudgetTarget,
  listCarbonAssets,
  saveBudgetTarget,
  saveCarbonAsset,
} from '../../mocks/platformMockStore';
import {
  calculateComplianceDemandForecast,
  createComplianceDemandForecastMock,
  type ComplianceDemandForecast,
  type ComplianceForecastMethod,
} from '../../mocks/complianceDemandForecastMock';
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
import type { BudgetType, CarbonAsset, CarbonAssetType } from '../../types/platformDomain';
import { Button, Drawer, Field, Modal, Tag, Toast } from './PrototypeUI';
import { AssetAiAnalysis } from './AssetAiAnalysis';
import { BalanceOptimizationPage } from './BalanceOptimizationPage';
import styles from './AssetOperationsV2.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const scopes = ['全企业', '生产车间A', '生产车间B', '动力中心', '仓储物流区域', '办公区域'];

const analysisRows = [
  { name: '生产车间A', consumption: 6320, share: '31.9%', cost: 2450, change: '+2.8%', attention: '重点关注' },
  { name: '生产车间B', consumption: 4650, share: '23.5%', cost: 1830, change: '+1.6%', attention: '关注' },
  { name: '动力中心', consumption: 3330, share: '16.8%', cost: 1120, change: '-0.4%', attention: '一般关注' },
  { name: '办公区域', consumption: 2880, share: '14.5%', cost: 760, change: '-1.2%', attention: '一般关注' },
  { name: '仓储物流区域', consumption: 2640, share: '13.3%', cost: 520, change: '+1.9%', attention: '关注' },
];

const budgetRows = {
  energy: [
    ['全企业', 120600, 65000, 125600],
    ['生产车间A', 48000, 28000, 52500],
    ['生产车间B', 39000, 19000, 38200],
    ['动力中心', 33600, 18000, 34900],
  ],
  carbon: [
    ['全企业', 95000, 51200, 99500],
    ['生产车间A', 42000, 23800, 45200],
    ['生产车间B', 31000, 16600, 30300],
    ['动力中心', 22000, 10800, 24000],
  ],
} as const;

type Overlay =
  | { kind: 'budget'; type: BudgetType }
  | { kind: 'budgetDetail'; row: readonly [string, number, number, number]; type: BudgetType }
  | { kind: 'asset'; asset?: CarbonAsset }
  | { kind: 'assetDetail'; asset: CarbonAsset }
  | { kind: 'estimate' }
  | null;

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
  onQuery,
  onReset,
}: {
  cycle?: boolean;
  compare?: boolean;
  period?: 'month' | 'year';
  setPeriod?: (period: 'month' | 'year') => void;
  scope: string;
  setScope: (scope: string) => void;
  onQuery: () => void;
  onReset: () => void;
}) {
  return <section className={`${styles.card} ${styles.filters}`}>
    {!cycle && <div className={styles.filterField}><span>分析周期</span><div className={styles.segment}><button type="button" className={period === 'month' ? styles.segmentActive : ''} onClick={() => setPeriod?.('month')}>月度</button><button type="button" className={period === 'year' ? styles.segmentActive : ''} onClick={() => setPeriod?.('year')}>年度</button></div></div>}
    <Field label={cycle ? '履约周期' : '年份'}><select><option>{cycle ? '2026年度' : '2026年'}</option><option>{cycle ? '2025年度' : '2025年'}</option></select></Field>
    {!cycle && period !== 'year' && <Field label="月份"><select><option>6月</option><option>5月</option><option>4月</option></select></Field>}
    <Field label="统计范围"><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((value) => <option key={value}>{value}</option>)}</select></Field>
    {compare && <Field label="对比口径"><select><option>同比</option><option>环比</option></select></Field>}
    <div className={styles.filterSpacer} />
    <Button primary onClick={onQuery}>查询</Button><Button onClick={onReset}>重置</Button>
  </section>;
}

function Kpi({ label, value, unit, sub, danger = false, icon }: { label: string; value: string; unit: string; sub: ReactNode; danger?: boolean; icon?: string }) {
  return <div className={`${styles.card} ${styles.kpi} ${danger ? styles.kpiDanger : ''}`}>{icon && <i>{icon}</i>}<span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{sub}</p></div>;
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
      '检查一级用能单元能源数据是否完整',
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
      : ['检查是否已维护二级用能单元', '检查二级能源数据期间是否完整', '检查能源品种与单位是否一致'];
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
    <h3 className={styles.detailTitle}>基本信息与勾稽关系</h3>
    <DetailGrid values={values} />
    <h3 className={styles.detailTitle}>问题判断</h3>
    <div className={styles.diagnosisJudgement}><Status value={status} /><p>{judgement}</p></div>
    <h3 className={styles.detailTitle}>建议动作</h3>
    <ul className={styles.diagnosisActions}>{actions.map((action) => <li key={action}>{action}</li>)}</ul>
  </Drawer>;
}

function AnalysisPage() {
  const { toast, notify } = useFeedback();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const [aiVersion, setAiVersion] = useState(0);
  const rows = appliedScope === '全企业' ? analysisRows : analysisRows.filter((row) => row.name === appliedScope);
  return <Page toast={toast}>
    <CommonFilters period={period} setPeriod={(value) => { setPeriod(value); setAiVersion((current) => current + 1); }} scope={scope} setScope={setScope} onQuery={() => { setAppliedScope(scope); setAiVersion((current) => current + 1); notify('查询条件已更新，AI结果需重新生成'); }} onReset={() => { setPeriod('month'); setScope('全企业'); setAppliedScope('全企业'); setAiVersion((current) => current + 1); notify('已重置查询条件，AI结果需重新生成'); }} />
    <div className={styles.kpiThree}><Kpi label="能源消费总量" value="12,580" unit="tce" icon="◔" sub={<>同比　<b className={styles.up}>+2.3%</b></>} /><Kpi label="综合能源成本" value="10,837" unit="万元" icon="◉" sub={<>同比　<b className={styles.up}>+2.3%</b></>} /><Kpi label="单位产品综合能耗" value="97.6" unit="kgce/t" icon="↗" sub={<>同比　<b className={styles.down}>-0.7%</b></>} /></div>
    <div className={styles.twoColumns}><section className={`${styles.card} ${styles.panel}`}><h2>能源消费结构</h2><EnergyDonut /></section><section className={`${styles.card} ${styles.panel}`}><h2>能源成本结构</h2><CostBars /></section></div>
    <section className={`${styles.card} ${styles.tableCard}`}><h2>重点用能单元分析</h2><div className={styles.tableWrap}><table><thead><tr><th>用能单元</th><th>能源消费量（tce）</th><th>占比</th><th>能源成本（万元）</th><th>同比变化</th><th>关注建议</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{format(row.consumption)}</td><td>{row.share}</td><td>{format(row.cost)}</td><td className={row.change.startsWith('+') ? styles.up : styles.down}>{row.change}</td><td><Status value={row.attention} /></td></tr>)}</tbody></table></div></section>
    <AssetAiAnalysis analysisKey="analysis" invalidationVersion={aiVersion} notify={notify} />
  </Page>;
}

function EnergyDonut() {
  const data = [['#3B82F6','煤炭','6,920 tce','55.0%'],['#35B99A','外购电力','3,546 tce','28.2%'],['#FF9D24','替代燃料','1,734 tce','13.8%'],['#7D61E8','天然气','226 tce','1.8%'],['#9BA7B6','其他','154 tce','1.2%']];
  return <div className={styles.donutLayout}><div className={styles.donut}><div>12,580<small>tce</small></div></div><div className={styles.legend}>{data.map(([color, name, value, share]) => <div key={name}><i style={{ background: color }} /><span>{name}</span><b>{value}</b><em>{share}</em></div>)}</div></div>;
}

function CostBars() {
  const rows = [['煤炭','6,240 万元','57.6%',100,'#2878FF'],['外购电力','2,340 万元','21.6%',55,'#14AA72'],['替代燃料','1,260 万元','11.6%',29,'#FF8A00'],['天然气','488 万元','4.5%',10,'#7657F6'],['其他','509 万元','4.7%',8,'#8D98A8']] as const;
  return <div className={styles.costBars}>{rows.map(([name, value, share, width, color], index) => <div key={name}><i style={{ background: color }}>{index + 1}</i><span>{name}</span><b><em style={{ width: `${width}%`, background: color }} /></b><strong>{value}</strong><small>{share}</small></div>)}</div>;
}

function BudgetPage() {
  const { toast, notify } = useFeedback();
  const [budgetType, setBudgetType] = useState<BudgetType>('energy');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [aiVersion, setAiVersion] = useState(0);
  const target = getBudgetTarget(budgetType)?.targetValue ?? (budgetType === 'energy' ? 120600 : 95000);
  const baseRows = budgetRows[budgetType].map((row, index) => index === 0 ? [row[0], target, row[2], row[3]] as const : row);
  const rows = appliedScope === '全企业' ? baseRows : baseRows.filter((row) => row[0] === appliedScope);
  const current = budgetType === 'energy' ? 65000 : 51200;
  const forecast = budgetType === 'energy' ? 125600 : 99500;
  const unit = budgetType === 'energy' ? 'tce' : 'tCO₂';
  void version;
  return <Page toast={toast}>
    <div className={styles.pageActions}><Button primary onClick={() => setOverlay({ kind: 'budget', type: budgetType })}>目标预算配置</Button></div>
    <CommonFilters cycle scope={scope} setScope={setScope} onQuery={() => { setAppliedScope(scope); setAiVersion((current) => current + 1); notify('查询条件已更新，AI结果需重新生成'); }} onReset={() => { setScope('全企业'); setAppliedScope('全企业'); setAiVersion((current) => current + 1); notify('已重置查询条件，AI结果需重新生成'); }} />
    <section className={`${styles.card} ${styles.budgetCard}`}>
      <div className={styles.budgetTabs}><button type="button" className={budgetType === 'energy' ? styles.activeBudget : ''} onClick={() => setBudgetType('energy')}>能源预算管理</button><button type="button" className={budgetType === 'carbon' ? styles.activeBudget : ''} onClick={() => setBudgetType('carbon')}>碳排放预算管理</button></div>
      <div className={styles.budgetSummary}>{[['年度目标',target],['当前累计',current],['预计全年',forecast],['预测偏差',forecast-target]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong className={label === '预测偏差' ? styles.up : ''}>{label === '预测偏差' && Number(value) >= 0 ? '+' : ''}{format(Number(value))} {unit}{label === '预测偏差' && <small>（{((Number(value) / target) * 100).toFixed(1)}%）</small>}</strong></div>)}<div><span>预算执行状态</span><strong><Tag tone="red">超预算风险</Tag></strong><small>消耗进度高于时间进度</small></div></div>
      <div className={styles.linePanel}><div className={styles.chartHead}><h2>年度预算累计趋势 <small>（单位：{unit}）</small></h2><Button primary onClick={() => notify('已根据最新数据重新预测')}>↻ 重新预测</Button></div><BudgetLine type={budgetType} target={target} /></div>
      <div className={styles.execution}><h2>预算执行分析</h2><div className={styles.tableWrap}><table><thead><tr><th>管理对象</th><th>年度目标（{unit}）</th><th>当前累计（{unit}）</th><th>预计全年（{unit}）</th><th>偏差（{unit}）</th><th>偏差（%）</th><th>状态</th></tr></thead><tbody>{rows.map((row) => { const diff = row[3] - row[1]; const rate = diff / row[1] * 100; const state = diff <= 0 ? '正常' : row[0] === '全企业' ? '超预算风险' : '关注'; return <tr key={row[0]} onClick={() => setOverlay({ kind: 'budgetDetail', row, type: budgetType })}><td>{row[0]}</td><td>{format(row[1])}</td><td>{format(row[2])}</td><td>{format(row[3])}</td><td className={diff > 0 ? styles.up : styles.down}>{diff > 0 ? '+' : ''}{format(diff)}</td><td className={rate > 0 ? styles.up : styles.down}>{rate > 0 ? '+' : ''}{rate.toFixed(1)}%</td><td><Status value={state} /></td></tr>; })}</tbody></table></div></div>
      <AssetAiAnalysis analysisKey={budgetType === 'energy' ? 'budgetEnergy' : 'budgetCarbon'} invalidationVersion={aiVersion} notify={notify} />
    </section>
    {overlay?.kind === 'budget' && <BudgetDialog type={overlay.type} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setVersion((value) => value + 1); setAiVersion((current) => current + 1); notify('目标预算配置已保存，AI结果需重新生成'); }} />}
    {overlay?.kind === 'budgetDetail' && <BudgetDetailDrawer row={overlay.row} type={overlay.type} onClose={() => setOverlay(null)} onAdjust={() => setOverlay({ kind: 'budget', type: overlay.type })} />}
  </Page>;
}

function BudgetLine({ type, target }: { type: BudgetType; target: number }) {
  const actual = type === 'energy' ? [20000,31000,41000,50000,59000,65000] : [12000,21000,29000,36000,44000,51200];
  const forecast = type === 'energy' ? [65000,78000,88000,98000,108000,118000,130000] : [51200,61000,71000,80000,89000,99500,108000];
  const max = type === 'energy' ? 160000 : 120000;
  const point = (value: number, index: number, start = 0) => `${60 + (915 * (start + index) / 11)},${25 + 200 * (1 - value / max)}`;
  const ty = 25 + 200 * (1 - target / max);
  return <div className={styles.lineChart}><svg viewBox="0 0 1000 260" preserveAspectRatio="none"><g className={styles.chartGrid}>{[25,75,125,175,225].map((y) => <line key={y} x1="60" x2="975" y1={y} y2={y} />)}</g><line x1="60" x2="975" y1={ty} y2={ty} className={styles.targetLine} /><polyline points={actual.map((value, index) => point(value,index)).join(' ')} className={styles.actualLine} /><polyline points={forecast.map((value, index) => point(value,index,5)).join(' ')} className={styles.forecastLine} />{actual.map((value,index) => { const [x,y] = point(value,index).split(','); return <circle key={index} cx={x} cy={y} r="4" className={styles.actualDot} />; })}{forecast.map((value,index) => { const [x,y] = point(value,index,5).split(','); return <circle key={index} cx={x} cy={y} r="4" className={styles.forecastDot} />; })}{months.map((month,index) => <text key={month} x={60 + 915 * index / 11} y="250" textAnchor="middle">{month}</text>)}<g className={styles.chartLegend}><line x1="390" x2="420" y1="12" y2="12" className={styles.actualLine} /><text x="427" y="16">实际累计值</text><line x1="510" x2="540" y1="12" y2="12" className={styles.forecastLine} /><text x="547" y="16">预测累计值</text><line x1="630" x2="660" y1="12" y2="12" className={styles.targetLine} /><text x="667" y="16">年度目标线</text></g></svg></div>;
}

function BudgetDialog({ type, onClose, onSaved }: { type: BudgetType; onClose: () => void; onSaved: () => void }) {
  const current = getBudgetTarget(type);
  const [target, setTarget] = useState(String(current?.targetValue ?? (type === 'energy' ? 120600 : 95000)));
  const [method, setMethod] = useState('按历史趋势分解');
  const [description, setDescription] = useState('');
  return <Modal title="目标预算配置" width={620} onClose={onClose} onSubmit={() => {
    saveBudgetTarget({
      budgetTargetId: current?.budgetTargetId ?? `bt-${type}-2026`,
      budgetType: type,
      organizationId: DEMO_ORGANIZATION_ID,
      energyUnitId: null,
      year: 2026,
      targetValue: Number(target),
      warningThreshold: 0.95,
      targetUnit: type === 'energy' ? 'tce' : 'tCO₂e',
      description: type === 'energy' ? '年度能源消费预算' : '年度碳排放预算',
      version: current?.version ?? 1,
      versionState: '生效',
      forecastMethod: method === '按历史趋势分解' ? 'recentAverage' : 'categoryProjection',
      adjustmentReason: description,
    });
    onSaved();
  }}><div className={styles.formGrid}><Field label="预算年度" required><select><option>2026年</option></select></Field><Field label="管理范围" required><select><option>全企业</option><option>生产单元A</option></select></Field><Field label="预算类型" required><select value={type === 'energy' ? '能源消费预算' : '碳排放预算'} disabled><option>{type === 'energy' ? '能源消费预算' : '碳排放预算'}</option></select></Field><Field label="年度目标" required><input aria-label="年度目标" required type="number" min="0" value={target} onChange={(event) => setTarget(event.target.value)} /></Field><Field label="目标单位" required><input value={type === 'energy' ? 'tce' : 'tCO₂'} readOnly /></Field><Field label="分解方式" required><select value={method} onChange={(event) => setMethod(event.target.value)}><option>按历史趋势分解</option><option>月度平均分解</option><option>自定义分解</option></select></Field><div className={styles.full}><Field label="调整说明"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="填写预算制定或调整说明" /></Field></div></div></Modal>;
}

function BudgetDetailDrawer({ row, type, onClose, onAdjust }: { row: readonly [string, number, number, number]; type: BudgetType; onClose: () => void; onAdjust: () => void }) {
  const unit = type === 'energy' ? 'tce' : 'tCO₂';
  return <Drawer title={`${row[0]}｜预算执行详情`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onAdjust}>调整预算</Button></>}><h3 className={styles.detailTitle}>执行概览</h3><DetailGrid values={[['年度目标', `${format(row[1])} ${unit}`],['当前累计',`${format(row[2])} ${unit}`],['预计全年',`${format(row[3])} ${unit}`],['预测偏差',`${row[3]-row[1] > 0 ? '+' : ''}${format(row[3]-row[1])} ${unit}`]]} /><h3 className={styles.detailTitle}>偏差说明</h3><p className={styles.detailText}>当前累计消耗进度高于时间进度，预计全年存在超目标风险。建议结合后续生产计划调整月度预算。</p></Drawer>;
}

function CarbonAssetsPage() {
  const { toast, notify } = useFeedback();
  const [scope, setScope] = useState('全企业');
  const [cycle, setCycle] = useState('2026年度');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [aiVersion, setAiVersion] = useState(0);
  const [complianceForecast, setComplianceForecast] = useState(createComplianceDemandForecastMock);
  const assets = listCarbonAssets(cycle);
  const quota = assets.find((asset) => asset.assetType === '碳配额');
  const ccer = assets.filter((asset) => asset.assetType === 'CCER').reduce((sum, asset) => sum + asset.totalAmount - asset.usedAmount - asset.lockedAmount, 0);
  const allocated = quota?.totalAmount ?? 95000;
  const planningAvailableAssets = assets
    .filter((asset) => asset.assetType === '碳配额')
    .reduce((sum, asset) => sum + asset.totalAmount, 0);
  const displayedComplianceForecast = calculateComplianceDemandForecast({
    ...complianceForecast,
    availableCarbonAssets: planningAvailableAssets || complianceForecast.availableCarbonAssets,
  });
  const used = quota?.usedAmount ?? 56000;
  const available = Math.max(0, allocated - used) + ccer;
  const forecast = 105000;
  const gap = Math.max(0, forecast - used - available);
  void version;
  return <Page toast={toast}>
    <div className={styles.pageActions}><Button primary onClick={() => setOverlay({ kind: 'asset' })}>录入碳资产</Button><Button onClick={() => setOverlay({ kind: 'estimate' })}>新周期履约需求预测</Button></div>
    <section className={`${styles.card} ${styles.filters}`}><Field label="履约周期"><select value={cycle} onChange={(event) => { setCycle(event.target.value); setAiVersion((current) => current + 1); }}><option>2026年度</option><option>2025年度</option></select></Field><Field label="统计范围"><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((value) => <option key={value}>{value}</option>)}</select></Field><div className={styles.filterSpacer} /><Button primary onClick={() => { setAiVersion((current) => current + 1); notify('查询条件已更新，AI结果需重新生成'); }}>查询</Button><Button onClick={() => { setCycle('2026年度'); setScope('全企业'); setAiVersion((current) => current + 1); notify('已重置查询条件，AI结果需重新生成'); }}>重置</Button></section>
    <section className={`${styles.card} ${styles.assetOverview}`}><h2>当前履约状态</h2><div className={styles.assetKpis}><AssetKpi label="已分配配额" value={allocated} tone="blue" /><AssetKpi label="已使用配额" value={used} /><AssetKpi label="CCER可用量" value={ccer} tone="purple" /><AssetKpi label="预计全年排放" value={forecast} tone="orange" /><AssetKpi label="预计缺口" value={gap} tone="red" /></div><div className={styles.assetProgress}><b>配额与预计排放对比</b><div><i style={{ width: '53.3%' }} /><i style={{ width: '41.9%' }} /><i style={{ width: '4.8%' }} /></div><span><em className={styles.dotGreen} />已使用配额　{format(used)} tCO₂（53.3%）　<em className={styles.dotBlue} />剩余可用资产　{format(available)} tCO₂（41.9%）　<em className={styles.dotRed} />预计缺口　{format(gap)} tCO₂（4.8%）</span></div></section>
    <div className={styles.assetGrid}><section className={`${styles.card} ${styles.tableCard}`}><h2>碳资产台账</h2><div className={styles.tableWrap}><table className={styles.assetTable}><thead><tr><th>资产类型</th><th>履约周期</th><th>来源</th><th>数量(tCO₂)</th><th>已使用(tCO₂)</th><th>剩余量(tCO₂)</th><th>操作</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.carbonAssetId}><td>{asset.assetType}</td><td>{asset.complianceCycle}</td><td>{asset.assetSource}</td><td>{format(asset.totalAmount)}</td><td>{format(asset.usedAmount)}</td><td>{format(asset.totalAmount - asset.usedAmount - asset.lockedAmount)}</td><td><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'assetDetail', asset })}>{asset.assetType === '绿证折算减排量' ? '待确认详情' : '编辑　查看凭证'}</button></td></tr>)}</tbody></table></div></section><section className={`${styles.card} ${styles.linePanel}`}><h2>履约缺口趋势</h2><AssetLine /></section></div>
    <section className={`${styles.card} ${styles.newCycle}`}><h2>新周期履约需求预测</h2><div className={styles.cycleGrid}><div><span>基准历史排放</span><strong>{format(displayedComplianceForecast.baselineEmission)} <small>tCO₂</small></strong></div><div><span>预计未来排放</span><strong>{format(displayedComplianceForecast.forecastEmission)} <small>tCO₂</small></strong></div><div><span>较当前周期变化</span><strong className={styles.blueText}>{formatSignedPercent(displayedComplianceForecast.baselineEmission === 0 ? 0 : (displayedComplianceForecast.forecastEmission - displayedComplianceForecast.baselineEmission) / displayedComplianceForecast.baselineEmission * 100)}</strong></div><div><span>预计资产缺口</span><strong className={displayedComplianceForecast.expectedAssetGap > 0 ? styles.redText : styles.greenText}>{format(displayedComplianceForecast.expectedAssetGap)} <small>tCO₂</small></strong></div><button type="button" className={styles.cycleLink} onClick={() => setOverlay({ kind: 'estimate' })}>查看预测说明 ＞</button></div></section>
    <AssetAiAnalysis analysisKey="asset" invalidationVersion={aiVersion} notify={notify} />
    {overlay?.kind === 'asset' && <AssetDialog asset={overlay.asset} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setVersion((value) => value + 1); setAiVersion((current) => current + 1); notify('碳资产已保存，AI结果需重新生成'); }} />}
    {overlay?.kind === 'assetDetail' && <AssetDrawer asset={overlay.asset} onClose={() => setOverlay(null)} onEdit={() => setOverlay({ kind: 'asset', asset: overlay.asset })} />}
    {overlay?.kind === 'estimate' && <ComplianceForecastDialog forecast={displayedComplianceForecast} onClose={() => setOverlay(null)} onSaved={(value) => { setComplianceForecast(value); setOverlay(null); setAiVersion((current) => current + 1); notify('新周期履约需求预测已保存，AI结果需重新生成'); }} />}
  </Page>;
}

function AssetKpi({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return <div className={`${styles.assetKpi} ${styles[tone] ?? ''}`}><span>{label}</span><strong>{format(value)}<small>tCO₂</small></strong></div>;
}

function AssetLine() {
  const actual = [12000,25000,34000,44000,53000,62000];
  const forecast = [62000,75000,88000,103000,118000,135000];
  const max = 150000;
  const point = (value: number, index: number, start = 0) => `${48 + 532 * (start + index) / 11},${28 + 162 * (1 - value / max)}`;
  const targetY = 28 + 162 * (1 - 100000 / max);
  return <div className={styles.assetLine}><svg viewBox="0 0 600 220" preserveAspectRatio="none"><g className={styles.chartGrid}>{[28,82,136,190].map((y) => <line key={y} x1="48" x2="580" y1={y} y2={y} />)}</g><line x1="48" x2="580" y1={targetY} y2={targetY} className={styles.assetTarget} /><polyline points={actual.map((value,index) => point(value,index)).join(' ')} className={styles.actualLine} /><polyline points={forecast.map((value,index) => point(value,index,5)).join(' ')} className={styles.forecastLine} />{months.map((month,index) => <text key={month} x={48 + 532 * index / 11} y="212" textAnchor="middle">{month}</text>)}<g className={styles.chartLegend}><line x1="130" x2="155" y1="12" y2="12" className={styles.actualLine} /><text x="161" y="16">实际累计排放</text><line x1="255" x2="280" y1="12" y2="12" className={styles.forecastLine} /><text x="286" y="16">预测累计排放</text><line x1="408" x2="433" y1="12" y2="12" className={styles.assetTarget} /><text x="439" y="16">年度可用资产上限</text></g></svg></div>;
}

function AssetDialog({ asset, onClose, onSaved }: { asset?: CarbonAsset; onClose: () => void; onSaved: () => void }) {
  const [assetType, setAssetType] = useState<CarbonAssetType>(asset?.assetType ?? '碳配额');
  const [source, setSource] = useState(asset?.assetSource ?? '政府分配');
  const [amount, setAmount] = useState(String(asset?.totalAmount ?? ''));
  const [remark, setRemark] = useState(asset?.remark ?? '');
  const [error, setError] = useState('');
  return <Modal title={asset ? '编辑碳资产' : '录入碳资产'} width={620} onClose={onClose} onSubmit={() => {
    if (!(Number(amount) > 0)) return setError('请输入有效的资产数量。');
    const used = asset?.usedAmount ?? 0;
    const locked = asset?.lockedAmount ?? 0;
    const eligible = assetType === '绿证折算减排量' ? 0 : Math.max(0, Number(amount) - used - locked);
    const result = saveCarbonAsset({ complianceCycle: '2026年度', assetType, assetSource: source, totalAmount: Number(amount), eligibleAmount: eligible, lockedAmount: locked, usedAmount: used, voucherNumber: asset?.voucherNumber ?? `MOCK-${Date.now()}`, bookedAt: asset?.bookedAt ?? '2026-07-28', remark }, asset?.carbonAssetId);
    if (!result.ok) return setError(result.error);
    onSaved();
  }}><div className={styles.formGrid}><Field label="资产类型" required><select value={assetType} onChange={(event) => setAssetType(event.target.value as CarbonAssetType)}><option>碳配额</option><option>CCER</option><option>绿证折算减排量</option></select></Field><Field label="履约周期" required><select><option>2026年度</option></select></Field><Field label="资产来源" required><select value={source} onChange={(event) => setSource(event.target.value)}><option>政府分配</option><option>市场购买</option><option>内部转化</option></select></Field><Field label="资产数量（tCO₂）" required><input aria-label="资产数量（tCO₂）" required type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="请输入数量" /></Field><div className={styles.full}><Field label="凭证材料"><input type="file" /><span className={styles.hint}>支持PDF、图片等格式，单个文件不超过20MB。</span></Field></div><div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="填写资产来源或使用限制说明" /></Field></div>{error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}</div></Modal>;
}

function ComplianceForecastDialog({ forecast, onClose, onSaved }: { forecast: ComplianceDemandForecast; onClose: () => void; onSaved: (value: ComplianceDemandForecast) => void }) {
  const [baseline, setBaseline] = useState(String(forecast.baselineEmission));
  const [businessChange, setBusinessChange] = useState(String(forecast.expectedBusinessChangeRate));
  const [reduction, setReduction] = useState(String(forecast.expectedReduction));
  const [method, setMethod] = useState<ComplianceForecastMethod>(forecast.forecastMethod);
  const [error, setError] = useState('');
  const calculated = calculateComplianceDemandForecast({
    ...forecast,
    baselineEmission: Number(baseline) || 0,
    expectedBusinessChangeRate: Number(businessChange) || 0,
    expectedReduction: Number(reduction) || 0,
    forecastMethod: method,
  });

  const save = () => {
    if (!(Number(baseline) > 0)) {
      setError('请输入有效的历史基准排放。');
      return;
    }
    if (Number(reduction) < 0) {
      setError('预计减排量不能小于0。');
      return;
    }
    onSaved(calculated);
  };

  return <Modal title="新周期履约需求预测" width={700} submitText="保存预测" onClose={onClose} onSubmit={save}><div className={styles.formGrid}>
    <Field label="预测周期" required><select value={forecast.forecastCycle} disabled><option>{forecast.forecastCycle}</option></select></Field>
    <Field label="预测范围" required><select value={forecast.forecastScope} disabled><option>{forecast.forecastScope}</option></select></Field>
    <Field label="历史基准排放" required><input aria-label="历史基准排放" type="number" min="0" value={baseline} onChange={(event) => setBaseline(event.target.value)} /><span className={styles.hint}>数据来源：{forecast.baselineSource}</span></Field>
    <Field label="预计业务变化" required><div className={styles.suffixInput}><input aria-label="预计业务变化" type="number" value={businessChange} onChange={(event) => setBusinessChange(event.target.value)} /><span>%</span></div><span className={styles.hint}>数据来源：{forecast.businessChangeSource}</span></Field>
    <Field label="预计减排量" required><div className={styles.suffixInput}><input aria-label="预计减排量" type="number" min="0" value={reduction} onChange={(event) => setReduction(event.target.value)} /><span>tCO₂</span></div><span className={styles.hint}>数据来源：{forecast.reductionSource}</span></Field>
    <Field label="预测方法" required><select aria-label="预测方法" value={method} onChange={(event) => setMethod(event.target.value as ComplianceForecastMethod)}><option>历史趋势预测</option><option>业务增长预测</option><option>自定义调整</option></select><span className={styles.hint}>用于企业内部预测，不代表主管部门最终配额。</span></Field>
    <div className={`${styles.forecastResult} ${styles.full}`}><h3>预测结果</h3><div><span>预计全年排放<strong>{format(calculated.forecastEmission)} <small>tCO₂</small></strong></span><span>当前可用碳资产<strong>{format(calculated.availableCarbonAssets)} <small>tCO₂</small></strong></span><span>预计资产缺口<strong className={calculated.expectedAssetGap > 0 ? styles.redText : styles.greenText}>{format(calculated.expectedAssetGap)} <small>tCO₂</small></strong></span></div><p>计算口径：历史基准排放 ×（1 + 预计业务变化）− 预计减排量，按内部规划精度取整至千吨。资产缺口 = 预计全年排放 − 当前可用碳资产。</p></div>
    <div className={`${styles.formula} ${styles.full}`}>本功能用于企业内部未来排放预测和碳资产需求规划，不模拟主管部门配额分配。未来可在具备政策数据后扩展行业规则库、基准值、调整系数和政策版本管理。</div>
    {error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}
  </div></Modal>;
}

function AssetDrawer({ asset, onClose, onEdit }: { asset: CarbonAsset; onClose: () => void; onEdit: () => void }) {
  return <Drawer title={`${asset.assetType}｜资产详情`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onEdit}>编辑资产</Button></>}><h3 className={styles.detailTitle}>资产信息</h3><DetailGrid values={[['资产类型',asset.assetType],['履约周期',asset.complianceCycle],['资产来源',asset.assetSource],['剩余数量',`${format(asset.totalAmount-asset.usedAmount-asset.lockedAmount)} tCO₂`]]} /><h3 className={styles.detailTitle}>凭证材料</h3><div className={styles.voucher}><span>文件名称</span><b>{asset.voucherNumber || `2026年度_${asset.assetType}_凭证.pdf`}</b></div><h3 className={styles.detailTitle}>使用记录</h3><div className={styles.tableWrap}><table><thead><tr><th>日期</th><th>用途</th><th>使用量</th></tr></thead><tbody><tr><td>2026-06-30</td><td>履约预占用</td><td>{format(asset.usedAmount)} tCO₂</td></tr></tbody></table></div></Drawer>;
}

function DetailGrid({ values }: { values: [string, string][] }) {
  return <div className={styles.detailGrid}>{values.map(([label,value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}

function formatSignedPercent(value: number) {
  const rounded = value.toFixed(2);
  return `${value > 0 ? '+' : ''}${rounded}%`;
}
