import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createEnergyQueryAnnualDetails,
  createEnergyQueryMonthlyDetails,
  energyAnalysisUnitLabels,
  type BenchmarkType,
  type EnergyAnalysisPeriod,
  type EnergyAnalysisScope,
  type EnergyQueryRow,
  type EnergyQueryDayDetail,
  type EnergyQueryMonthDetail,
} from '../../mocks/energyAnalysisV4Mock';
import {
  buildEnergyQueryDataset,
  ENERGY_QUERY_CURRENT_YEAR,
  ENERGY_QUERY_REPORTED_MONTH,
  getEnergyQueryMonthlyAmounts,
} from '../../mocks/energyQuerySelector';
import {
  buildBenchmarkDataset,
  type BenchmarkMetric,
} from '../../mocks/energyBenchmarkSelector';
import { saveBenchmarkTarget } from '../../mocks/benchmarkTargetStore';
import {
  buildIntensityCalculationView,
  buildIntensityCalculationViews,
  buildDeviceIntensityRows,
  listIntensityObjects,
  type CalculatedIntensityMetric,
  type IntensityObjectOption,
  type IntensityObjectType,
} from '../../mocks/energyIntensitySelector';
import {
  saveDeviceIntensityTemplate,
  DEVICE_METRIC_TEMPLATES,
  type DeviceIntensityTemplateConfig,
  type DeviceMetricTemplateId,
  type DeviceIntensityMetricCode,
} from '../../mocks/deviceIntensityParameterStore';
import {
  buildFlowAnalysisDataset,
  selectFlowRelations,
  buildFlowViewTables,
  type FlowNodeBalanceRow,
  type FlowAnalysisDataset,
} from '../../mocks/energyFlowSelector';
import { balanceSourceColumns, balanceUseColumns, buildEnergyBalanceTable, energyBalanceCsvRows, formatBalanceAmount, roundedBalanceAmount } from './energyBalanceTable';
import styles from './EnergyAnalysisV4.module.css';

type DialogState = {
  title: string;
  body: ReactNode;
  submitText?: string;
  cancelText?: string;
  onSubmit?: () => unknown;
  secondarySubmitText?: string;
  onSecondarySubmit?: () => void;
  wide?: boolean;
} | null;

const format = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const percent = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : `${value > 0 ? '+' : ''}${format(value, 1)}%`;

const metricDigits = (value: number | null) =>
  value === null ? 3 : value < 1 ? 3 : value < 10 ? 2 : value > 10000 ? 0 : 1;

function deviceEnergyTypeId(metricCode: string) {
  return metricCode === 'compressed-air-electricity' || metricCode === 'electricity_consumption'
    ? 'v11-energy-electricity'
    : 'v11-energy-natural-gas';
}

function deviceEnergyDataPath(deviceId: string, year: number | string, metricCode: string, recordId?: string | null) {
  const recordQuery = recordId ? `&recordId=${encodeURIComponent(recordId)}` : '&new=1';
  return `/data-management/energy-data?scope=device&deviceId=${encodeURIComponent(deviceId)}&year=${year}&energyTypeId=${deviceEnergyTypeId(metricCode)}${recordQuery}`;
}

function deviceEnergyDataTabPath(deviceId: string, year: number | string, metricCode: string, keyword?: string) {
  const keywordQuery = keyword ? `&keyword=${encodeURIComponent(keyword)}` : '';
  return `/data-management/energy-data?scope=device&deviceId=${encodeURIComponent(deviceId)}&year=${year}&energyTypeId=${deviceEnergyTypeId(metricCode)}${keywordQuery}`;
}

function deviceOutputDataPath(deviceId: string, year: number | string, metricCode: string, keyword?: string) {
  const keywordQuery = keyword ? `&keyword=${encodeURIComponent(keyword)}` : '';
  return `/data-management/device-output?deviceId=${encodeURIComponent(deviceId)}&year=${year}&metricCode=${encodeURIComponent(metricCode)}${keywordQuery}`;
}

function intensityStatus(metric: CalculatedIntensityMetric) {
  if (metric.resultType === 'ok') return { label: '已计算', tone: 'ok' as const, reason: '' };
  const reason = metric.issue ?? '数据或计算依据未完整';
  if (reason === '数据缺失' || reason === '缺少工业增加值') return { label: '数据缺失', tone: 'warn' as const, reason };
  if (reason === '当前产品无法直接汇总' || reason === '未关联生产用能单元' || reason === '缺少必要关联关系') {
    return { label: '暂不可计算', tone: 'warn' as const, reason };
  }
  return { label: '待完善', tone: 'warn' as const, reason };
}

const energyDataIssues = new Set(['能源数据未录入', '能源数据部分录入', '缺少能源数据']);
const operationDataIssues = new Set([
  '缺少产品产量',
  '缺少工业增加值',
  '缺少供气量',
  '缺少蒸汽产量',
  '缺少适用运营分母',
  '数据缺失',
]);
const relationDataIssues = new Set(['当前产品无法直接汇总', '未关联生产用能单元', '缺少必要关联关系']);

function missingDataSources(metric: CalculatedIntensityMetric) {
  const issue = metric.issue ?? '';
  if (relationDataIssues.has(issue)) return { energy: false, operation: true };
  const energy = energyDataIssues.has(issue) || (issue === '数据缺失' && metric.energyRecordIds.length === 0);
  const operation = operationDataIssues.has(issue) || metric.operationMetricIds.length === 0;
  return { energy, operation };
}

function missingDataActionLabel(metric: CalculatedIntensityMetric) {
  const missing = missingDataSources(metric);
  if (missing.energy && missing.operation) return '补充数据';
  if (missing.energy) return '补充能源数据';
  return '补充运营数据';
}

function EnergyButton({
  children,
  primary,
  outline,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  outline?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`${styles.button} ${primary ? styles.buttonPrimary : ''} ${outline ? styles.buttonOutline : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function EnergyDialog({
  state,
  close,
}: {
  state: DialogState;
  close: () => void;
}) {
  if (!state) return null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (state.onSubmit?.() !== false) close();
  };
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form
        className={`${styles.modal} ${state.wide ? styles.modalWide : ''}`}
        role="dialog"
        aria-label={state.title}
        onSubmit={submit}
      >
        <header>
          <h2>{state.title}</h2>
          <button type="button" onClick={close}>×</button>
        </header>
        <div className={styles.modalBody}>{state.body}</div>
        <footer>
          <EnergyButton onClick={close}>{state.cancelText ?? (state.onSubmit ? '取消' : '关闭')}</EnergyButton>
          {state.onSecondarySubmit && <EnergyButton onClick={() => { state.onSecondarySubmit?.(); close(); }}>{state.secondarySubmitText ?? '修改能源数据'}</EnergyButton>}
          {state.onSubmit && <EnergyButton type="submit" primary>{state.submitText ?? '确定'}</EnergyButton>}
        </footer>
      </form>
    </div>
  );
}

function EnergyToast({ message }: { message: string }) {
  return message ? <div className={styles.toast}>✓ {message}</div> : null;
}

function useFeedback() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1700);
  };
  return { toast, notify };
}

function FilterField({
  label,
  children,
  wide,
  className,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ''} ${className ?? ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusTag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'ok' | 'warn' | 'check' | 'bad' | 'none';
}) {
  return <span className={`${styles.status} ${styles[`status${tone}`]}`}>{children}</span>;
}

function DetailGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className={styles.detailGrid}>
      {items.map(([label, value]) => (
        <div className={styles.detailBox} key={label}>
          <span>{label}</span>
          {value}
        </div>
      ))}
    </div>
  );
}

function DrilldownContext({
  row,
  period,
}: {
  row: EnergyQueryRow;
  period: string;
}) {
  return (
    <div className={styles.drillContext}>
      <span><small>用能单元</small><b>{row.energyUnitName}</b></span>
      <span><small>能源类别</small><b>{row.analysisCategory}</b></span>
      <span><small>能源品种</small><b>{row.energyTypeName}</b></span>
      <span><small>统计期间</small><b>{period}</b></span>
    </div>
  );
}

function AnnualEnergyDetail({
  row,
  details,
  period,
}: {
  row: EnergyQueryRow;
  details: EnergyQueryMonthDetail[];
  period: string;
}) {
  const peak = details.reduce((current, item) => item.standardCoalAmount > current.standardCoalAmount ? item : current);
  const max = peak.standardCoalAmount;
  const peakIndex = details.findIndex((item) => item.detailId === peak.detailId);
  const monthlyAverage = row.standardCoalAmount / details.length;
  const statusFor = (amount: number) => amount >= monthlyAverage * 1.12 ? '偏高' : amount <= monthlyAverage * 0.88 ? '偏低' : '正常';
  return (
    <div className={styles.drilldown}>
      <DrilldownContext row={row} period={period} />
      <div className={styles.drillStats}>
        <span><small>年度实物量</small><b>{format(row.physicalAmount)} {row.measurementUnit}</b></span>
        <span><small>年度折标量</small><b>{format(row.standardCoalAmount)} tce</b></span>
        <span><small>{details.length < 12 ? '已报月份月均折标量' : '月均折标量'}</small><b>{format(row.standardCoalAmount / details.length, 1)} tce</b></span>
        <span><small>峰值月份</small><b>{peak.month}｜{format(peak.standardCoalAmount)} tce</b></span>
      </div>
      <div className={styles.drillSectionTitle}>
        <div><b>月度消费趋势</b><small>用于快速识别各月消费波动与峰值。</small></div>
        <span><i />正常 · <i />偏高 · <i />偏低</span>
      </div>
      <div className={styles.annualBars} aria-label="骞村害鏈堝害娑堣垂瓒嬪娍">
        {details.map((item, index) => (
          <div key={item.detailId} title={`${item.month}：${format(item.standardCoalAmount)} tce`}>
            <i className={index === peakIndex || statusFor(item.standardCoalAmount) === '偏高' ? styles.annualBarPeak : statusFor(item.standardCoalAmount) === '偏低' ? styles.annualBarLow : ''} style={{ height: `${Math.max(18, item.standardCoalAmount / max * 100)}%` }} />
            {(index === 0 || (index + 1) % 3 === 0 || index === details.length - 1) && <small>{item.month}</small>}
          </div>
        ))}
      </div>
      <div className={styles.drillSectionTitle}>
        <div><b>月度消费分解</b><small>年度数值按月度能源记录汇总，表尾合计与当前年度记录一致。</small></div>
      </div>
      <div className={styles.drillTableWrap}>
        <table className={styles.drillTable} aria-label="年度月明细">
          <thead><tr><th>月份</th><th>实物量</th><th>单位</th><th>折标量（tce）</th><th>占全年</th><th>同比（较上年同月）</th><th>环比（较上月）</th><th>数据状态</th></tr></thead>
          <tbody>{details.map((item) => (
            <tr key={item.detailId}>
              <td>{item.month}</td>
              <td>{format(item.physicalAmount)}</td>
              <td>{row.measurementUnit}</td>
              <td>{format(item.standardCoalAmount)}</td>
              <td>{format(item.share, 1)}%</td>
              <td className={item.yearOnYear < 0 ? styles.down : styles.up}>{percent(item.yearOnYear)}</td>
              <td className={(item.monthOnMonth ?? 0) < 0 ? styles.down : styles.up}>{percent(item.monthOnMonth)}</td>
              <td><StatusTag tone={statusFor(item.standardCoalAmount) === '正常' ? 'ok' : 'warn'}>{statusFor(item.standardCoalAmount)}</StatusTag></td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td>合计</td><td>{format(row.physicalAmount)}</td><td>{row.measurementUnit}</td><td>{format(row.standardCoalAmount)}</td><td>100.0%</td><td>{percent(row.yearOnYear)}</td><td>—</td><td>完整</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.modalNote}><strong>数据来源：</strong>{row.sourceDescription}<br /><strong>折标口径：</strong>各月读取对应能源品种的有效折标参数，年度值由已报月份记录汇总。<br /><strong>比较口径：</strong>同比为本月与上年同月比较，环比为本月与上月比较；首月无上月数据时不展示环比。<br /><strong>状态规则：</strong>月度折标量相对年度月均值高于或等于12%标记“偏高”，低于或等于-12%标记“偏低”，其余为“正常”。</div>
    </div>
  );
}

function MonthlyEnergyDetail({
  row,
  details,
  period,
}: {
  row: EnergyQueryRow;
  details: EnergyQueryDayDetail[];
  period: string;
}) {
  const peak = details.reduce((current, item) => item.standardCoalAmount > current.standardCoalAmount ? item : current);
  const max = peak.standardCoalAmount;
  const [peakMonth, peakDay] = peak.date.slice(5).split('-').map(Number);
  return (
    <div className={styles.drilldown}>
      <DrilldownContext row={row} period={period} />
      <div className={styles.drillStats}>
        <span><small>本月折标量</small><b>{format(row.standardCoalAmount)} tce</b></span>
        <span><small>日均折标量</small><b>{format(row.standardCoalAmount / details.length, 1)} tce</b></span>
        <span><small>峰值日</small><b>{peakMonth}月{peakDay}日｜{format(peak.standardCoalAmount)} tce</b></span>
        <span><small>数据完整性</small><b>{details.length}/{details.length}天｜完整</b></span>
      </div>
      <div className={styles.drillSectionTitle}>
        <div><b>日度消费趋势</b><small>用于识别月内波动和异常值，点击月度记录后下钻至每日汇总。</small></div>
        <span><i />正常 · <i />偏高 · <i />偏低</span>
      </div>
      <div className={styles.dailyBars} aria-label="日度消费趋势">
        {details.map((item, index) => (
          <div key={item.detailId} title={`${item.date}：${format(item.standardCoalAmount)} tce`}>
            <i
              className={item.dataStatus === '偏高' ? styles.dailyBarHigh : item.dataStatus === '偏低' ? styles.dailyBarLow : ''}
              style={{ height: `${Math.max(18, item.standardCoalAmount / max * 100)}%` }}
            />
            {(index === 0 || (index + 1) % 5 === 0 || index === details.length - 1) && <small>{index + 1}日</small>}
          </div>
        ))}
      </div>
      <div className={styles.drillSectionTitle}>
        <div><b>日度消费明细</b><small>“较日均”用于快速判断单日波动，不替代异常诊断。</small></div>
      </div>
      <div className={`${styles.drillTableWrap} ${styles.dailyTableWrap}`}>
        <table className={styles.drillTable} aria-label="月度日明细">
          <thead><tr><th>日期</th><th>实物量</th><th>单位</th><th>折标量（tce）</th><th>较日均</th><th>数据状态</th></tr></thead>
          <tbody>{details.map((item) => (
            <tr key={item.detailId}>
              <td>{item.date}</td>
              <td>{format(item.physicalAmount)}</td>
              <td>{row.measurementUnit}</td>
              <td>{format(item.standardCoalAmount)}</td>
              <td className={item.deviationFromDailyAverage < 0 ? styles.down : styles.up}>{percent(item.deviationFromDailyAverage)}</td>
              <td><StatusTag tone={item.dataStatus === '正常' ? 'ok' : 'warn'}>{item.dataStatus}</StatusTag></td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td>合计</td><td>{format(row.physicalAmount)}</td><td>{row.measurementUnit}</td><td>{format(row.standardCoalAmount)}</td><td>—</td><td>完整</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.modalNote}><strong>数据来源：</strong>{row.sourceDescription}<br /><strong>统计说明：</strong>日度数据按当前用能单元和能源品种汇总；折标量合计与月度记录一致。<br /><strong>状态规则：</strong>日度折标量相对本月日均值高于或等于12%标记“偏高”，低于或等于-12%标记“偏低”，其余为“正常”。</div>
    </div>
  );
}

function withReturnTo(path: string, returnTo: string) {
  return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}

export function EnergyAnalysisV4({ pathname }: { pathname: string }) {
  const page = pathname.split('/').pop();
  if (page === 'consumption-query') return <ConsumptionQueryPage />;
  if (page === 'intensity') return <IntensityPage />;
  if (page === 'benchmarking') return <BenchmarkPage />;
  return <FlowAnalysisPage />;
}

function ConsumptionQueryPage() {
  const [draftPeriod, setDraftPeriod] = useState<EnergyAnalysisPeriod>('month');
  const [draftTime, setDraftTime] = useState('2026-06');
  const [draftScope, setDraftScope] = useState<EnergyAnalysisScope>('all');
  const [applied, setApplied] = useState({
    period: 'month' as EnergyAnalysisPeriod,
    time: '2026-06',
    scope: 'all' as EnergyAnalysisScope,
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const scopeUnitIds: Partial<Record<EnergyAnalysisScope, string>> = {
    prodA: 'eu-clinker-line-1',
    prodB: 'eu-cement-grinding-line',
    utilities: 'eu-utilities',
  };
  const queryYear = Number(applied.time.slice(0, 4));
  const queryMonth = applied.period === 'month' ? Number(applied.time.slice(5, 7)) : 12;
  const data = buildEnergyQueryDataset({ year: queryYear, period: applied.period, month: queryMonth, energyUnitId: scopeUnitIds[applied.scope] });
  const monthMode = applied.period === 'month';
  const currentYearYtd = !monthMode && queryYear === ENERGY_QUERY_CURRENT_YEAR;
  const titleUnit = applied.scope === 'all' ? '全厂' : energyAnalysisUnitLabels[applied.scope];
  const maxTrend = Math.max(...data.trend, 1) * 1.15;
  const rows = data.rows;
  const conicGradient = data.structure
    .map((item, index) => {
      const start = data.structure.slice(0, index).reduce((sum, current) => sum + current.share, 0);
      return `${item.color} ${start}% ${start + item.share}%`;
    })
    .join(',');
  const appliedPeriodLabel = monthMode
    ? `${applied.time.slice(0, 4)}年${Number(applied.time.slice(5, 7))}月`
    : `${applied.time}年度`;

  const openDetail = (row: EnergyQueryRow) => {
    const dailyDetails = monthMode ? createEnergyQueryMonthlyDetails(row) : null;
    const body = monthMode
      ? dailyDetails?.length
        ? <MonthlyEnergyDetail row={row} details={dailyDetails} period={appliedPeriodLabel} />
        : <div className={styles.emptyState}>
          <strong>暂无日度数据</strong>
          <span>当前月份仅维护月度汇总数据，暂未接入日度计量数据，因此无法展示日度明细。</span>
          <small>月度能耗数据仍可正常使用，后续接入日度数据后将支持下钻查看。</small>
        </div>
      : <AnnualEnergyDetail
        row={row}
        details={createEnergyQueryAnnualDetails({
          ...row,
          monthlyPhysicalAmounts: getEnergyQueryMonthlyAmounts(row).physical,
          monthlyStandardCoalAmounts: getEnergyQueryMonthlyAmounts(row).standardCoal,
        })}
        period={appliedPeriodLabel}
      />;
    setDialog({
      title: `${monthMode && !dailyDetails?.length ? '暂无日度数据｜' : `${monthMode ? '月度' : '年度'}能源消费明细｜`}${row.energyTypeName}`,
      body,
      wide: true,
    });
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard}`}>
        <FilterField label="统计周期">
          <span className={styles.segment}>
            <button type="button" className={draftPeriod === 'month' ? styles.active : ''} onClick={() => { setDraftPeriod('month'); setDraftTime('2026-06'); }}>月度</button>
            <button type="button" className={draftPeriod === 'year' ? styles.active : ''} onClick={() => { setDraftPeriod('year'); setDraftTime('2026'); }}>年度</button>
          </span>
        </FilterField>
        <FilterField label="时间" wide>
          {draftPeriod === 'month' ? <input aria-label="时间" type="month" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} /> : <select aria-label="时间" value={draftTime} onChange={(event) => setDraftTime(event.target.value)}><option value="2026">2026年度</option><option value="2025">2025年度</option><option value="2024">2024年度</option></select>}
        </FilterField>
        <FilterField label="用能单元" wide>
          <select aria-label="用能单元" value={draftScope} onChange={(event) => setDraftScope(event.target.value as EnergyAnalysisScope)}>
            <option value="all">全厂</option>
            <option value="prodA">生产车间A</option>
            <option value="prodB">生产车间B</option>
            <option value="utilities">公辅系统</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => {
          setApplied({ period: draftPeriod, time: draftTime || (draftPeriod === 'month' ? '2026-06' : '2026'), scope: draftScope });
          notify('查询结果已按用能单元更新');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftPeriod('month');
          setDraftTime('2026-06');
          setDraftScope('all');
          setApplied({ period: 'month', time: '2026-06', scope: 'all' });
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.summaryCompact} ${monthMode ? '' : styles.summaryAnnual}`}>
        <div className={styles.summaryItem}>
          <span>综合能耗｜{titleUnit}</span>
          <strong>{format(data.total)}<small>tce</small></strong>
        </div>
        <div className={styles.summaryItem}>
          <span>同比</span>
          <strong className={data.yearOnYear < 0 ? styles.down : styles.up}>
            {data.yearOnYear > 0 ? '↑' : '↓'} {percent(data.yearOnYear)}
          </strong>
        </div>
        {monthMode && (
          <div className={styles.summaryItem}>
            <span>环比</span>
            <strong className={(data.monthOnMonth ?? 0) < 0 ? styles.down : styles.up}>
              {(data.monthOnMonth ?? 0) > 0 ? '↑' : '↓'} {percent(data.monthOnMonth)}
            </strong>
          </div>
        )}
      </section>

      <div className={styles.queryCharts}>
        <section className={`${styles.card} ${styles.chartCard}`}>
          <div className={styles.chartTitle}>能源消费趋势（{monthMode ? '2026年1—6月' : currentYearYtd ? `2022—2026年｜2026年截至${ENERGY_QUERY_REPORTED_MONTH}月` : '2022—2026年'}）</div>
          <div className={styles.chartSub}>{titleUnit}｜折标煤（tce），仅展示实际数据</div>
          <div className={styles.barChart}>
            {data.trend.map((value, index) => (
              <div className={styles.barItem} key={data.labels[index]}>
                <div className={styles.bar} style={{ height: Math.round(value / maxTrend * 180) }}>
                  <span>{format(value)}</span>
                </div>
                <small>{data.labels[index]}</small>
              </div>
            ))}
          </div>
        </section>
        <section className={`${styles.card} ${styles.chartCard}`}>
          <div className={styles.chartTitle}>能源结构</div>
          <div className={styles.chartSub}>{titleUnit}</div>
          <div className={styles.donutWrap}>
            <div className={styles.donut} style={{ background: `conic-gradient(${conicGradient})` }}>
              <div>{format(data.total)}<small>tce</small></div>
            </div>
            <div className={styles.legend}>
              {data.structure.map((item) => (
                <div key={item.label}>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <span>{format(item.share, 1)}%</span>
                  <span>{format(item.amount)} tce</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={`${styles.card} ${styles.tableCard}`}>
        <div className={styles.tableToolbar}>
          <div>
            <div className={styles.chartTitle}>能源消费明细（{titleUnit}｜{monthMode ? '2026年6月' : '2026年度'}）</div>
            <div className={styles.exportHint}>导出内容与当前筛选条件一致，包含用能单元、能源品种、实物量、折标量及期间比较。</div>
          </div>
          <EnergyButton onClick={() => notify('能源消费明细台账已导出')}>⇩ 导出明细台账</EnergyButton>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr>
              <th>序号</th>
              {applied.scope === 'all' && <th>用能单元</th>}
              <th>能源类别</th><th>能源品种</th><th>实物量</th><th>单位</th><th>折标量（tce）</th><th>占比</th><th>同比</th>
              {monthMode && <th>环比</th>}
              <th>操作</th>
            </tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.energyQueryRowId}>
                  <td>{index + 1}</td>
                  {applied.scope === 'all' && <td>{row.energyUnitName}</td>}
                  <td>{row.analysisCategory}</td><td>{row.energyTypeName}</td><td>{format(row.physicalAmount)}</td><td>{row.measurementUnit}</td>
                  <td>{format(row.standardCoalAmount)}</td><td>{format(row.share, 1)}%</td>
                  <td className={row.yearOnYear < 0 ? styles.down : styles.up}>{percent(row.yearOnYear)}</td>
                  {monthMode && <td className={(row.monthOnMonth ?? 0) < 0 ? styles.down : styles.up}>{percent(row.monthOnMonth)}</td>}
                  <td><button type="button" className={styles.link} onClick={() => openDetail(row)}>查看明细</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={applied.scope === 'all' ? 6 : 5}>合计</td>
              <td>{format(data.total)}</td><td>100.0%</td>
              <td className={data.yearOnYear < 0 ? styles.down : styles.up}>{percent(data.yearOnYear)}</td>
              {monthMode && <td className={(data.monthOnMonth ?? 0) < 0 ? styles.down : styles.up}>{percent(data.monthOnMonth)}</td>}
              <td>—</td>
            </tr></tfoot>
          </table>
        </div>
      </section>
      <EnergyDialog state={dialog} close={() => setDialog(null)} />
      <EnergyToast message={toast} />
    </div>
  );
}

function DeviceIntensityTab({ onTabChange }: { onTabChange: (type: IntensityObjectType) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const deviceSearch = new URLSearchParams(location.search);
  const requestedDeviceId = deviceSearch.get('deviceId') ?? undefined;
  const requestedYear = deviceSearch.get('year') ?? undefined;
  const requestedEnergyUnitId = deviceSearch.get('energyUnitId') ?? undefined;
  const savedFilters = (() => { try { return JSON.parse(window.sessionStorage.getItem('energy-intensity-device-filters') ?? 'null') as { year?: string; energyUnitId?: string; deviceId?: string } | null; } catch { return null; } })();
  const [year, setYear] = useState(requestedYear ?? savedFilters?.year ?? '2026');
  const [energyUnitId, setEnergyUnitId] = useState(requestedEnergyUnitId ?? savedFilters?.energyUnitId ?? 'all');
  const [deviceId, setDeviceId] = useState(requestedDeviceId ?? savedFilters?.deviceId ?? 'all');
  const [trendDeviceId, setTrendDeviceId] = useState(requestedDeviceId ?? (savedFilters?.deviceId !== 'all' ? savedFilters?.deviceId ?? '' : ''));
  const [showDeviceMonthly, setShowDeviceMonthly] = useState(false);
  const [showPendingDevices, setShowPendingDevices] = useState(false);
  const [applied, setApplied] = useState({ year: Number(requestedYear ?? savedFilters?.year ?? 2026), energyUnitId: requestedEnergyUnitId ?? savedFilters?.energyUnitId ?? 'all', deviceId: requestedDeviceId ?? savedFilters?.deviceId ?? 'all' });
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const allRows = useMemo(() => { void version; return buildDeviceIntensityRows(applied.year, 'all', applied.energyUnitId, applied.deviceId); }, [applied, version]);
  const previousRows = useMemo(() => buildDeviceIntensityRows(applied.year - 1, 'all', applied.energyUnitId, applied.deviceId), [applied]);
  const rows = useMemo(() => [...allRows]
    .filter((row) => row.resultStatus !== '暂不可计算')
    .sort((left, right) => (left.resultStatus === '已计算' ? 0 : 1) - (right.resultStatus === '已计算' ? 0 : 1)), [allRows]);
  const calculatedRows = useMemo(() => rows.filter((row) => row.resultStatus === '已计算'), [rows]);
  const pendingRows = useMemo(() => rows.filter((row) => row.resultStatus !== '已计算'), [rows]);
  const devices = useMemo(() => buildDeviceIntensityRows(Number(year) || 2026), [year]);
  const openParameterDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    navigate(withReturnTo(deviceOutputDataPath(row.deviceId, applied.year, row.metricCode ?? 'custom-device-work', row.deviceName), returnToIntensityPath()));
  };
  const openDeviceMetricConfig = (row?: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    let templateId: DeviceMetricTemplateId = row?.templateConfig?.templateId ?? 'unit-output-energy';
    const metricName = '单位产出能耗';
    let energyTypeId = row?.templateConfig?.numerator.energyTypeId ?? 'v11-energy-electricity';
    let denominatorName = row?.templateConfig?.denominator.name ?? '设备作业量';
    let denominatorUnit = row?.templateConfig?.denominator.unit ?? 't';
    let resultUnit = row?.templateConfig?.resultUnit ?? 'kWh/t';
    let denominatorMetricCode = row?.templateConfig?.denominator.metricCode ?? '';
    const syncResultUnit = () => { resultUnit = `${energyTypeId === 'v11-energy-electricity' ? 'kWh' : 'kgce'}/${denominatorUnit}`; };
    setDialog({
      title: '配置设备指标口径',
      wide: true,
      body: <>
        <div className={styles.modalNote}>指标模板由系统预置，设备只绑定模板并配置数据来源；公式和计算方式由模板统一管理。</div>
        {row && <DetailGrid items={[['绑定设备', row.deviceName], ['设备类型', row.deviceType]]} />}
        <label className={styles.modalField}><span className={styles.required}>指标模板</span><select aria-label="指标模板" defaultValue={templateId} onChange={(event) => { templateId = event.target.value as DeviceMetricTemplateId; energyTypeId = 'v11-energy-electricity'; denominatorName = '设备作业量'; denominatorUnit = 't'; denominatorMetricCode = ''; syncResultUnit(); }}>
          {DEVICE_METRIC_TEMPLATES.map((item) => <option key={item.templateId} value={item.templateId}>{item.label}</option>)}
        </select></label>
        <label className={styles.modalField}><span>指标名称</span><input aria-label="指标名称" value={metricName} readOnly /></label>
        <label className={styles.modalField}><span className={styles.required}>能源消耗</span><select aria-label="能源消耗" defaultValue={energyTypeId} onChange={(event) => { energyTypeId = event.target.value; syncResultUnit(); }}><option value="v11-energy-electricity">电力</option><option value="v11-energy-natural-gas">天然气折标综合能耗</option></select></label>
        <div className={styles.modalNote}>设备产出用于设备能耗指标；能流分析使用能源转换与外供中独立维护的用能单元产出。</div>
        <label className={styles.modalField}><span className={styles.required}>产出口径</span><input aria-label="产出口径" value={denominatorName} readOnly /></label>
        <label className={styles.modalField}><span>产出计量单位（数据录入时维护）</span><input aria-label="分母单位" value={denominatorUnit} readOnly /></label>
        <label className={styles.modalField}><span>分母指标编码（选填）</span><input aria-label="分母指标编码" defaultValue={denominatorMetricCode} placeholder="例如：steam_output" onChange={(event) => { denominatorMetricCode = event.target.value; }} /></label>
        <div className={styles.formulaBox}>统一计算方式：设备能源消耗 ÷ 配置的设备产出（结果单位：{resultUnit}）</div>
      </>,
      submitText: row ? '保存并绑定设备' : '保存指标口径',
      cancelText: '取消',
      onSubmit: () => {
        if (!metricName.trim() || !denominatorName.trim() || !denominatorUnit.trim()) { notify('请完整填写指标名称、分母名称和单位'); return false; }
        if (!row) { notify('请从待配置设备进入指标口径配置'); return false; }
        const selected = DEVICE_METRIC_TEMPLATES.find((item) => item.templateId === templateId) ?? DEVICE_METRIC_TEMPLATES[0];
        const metricCode: DeviceIntensityMetricCode = row?.metricCode ?? 'device-output-energy';
        const config: DeviceIntensityTemplateConfig = { templateId: selected.templateId, metricCode, metricName, calculationMethod: 'ratio', numerator: { source: 'device-energy', energyTypeId, name: '设备能源消耗', unit: energyTypeId === 'v11-energy-electricity' ? 'kWh' : 'kgce' }, denominator: { source: 'operation-data', metricCode: denominatorMetricCode.trim() || undefined, name: denominatorName.trim(), unit: denominatorUnit.trim() }, resultUnit, factor: 1, formula: `设备能源消耗 ÷ ${denominatorName.trim()}` };
        saveDeviceIntensityTemplate({ deviceId: row.deviceId, year: applied.year, metricCode, config });
        setVersion((current) => current + 1);
        notify('设备指标口径已保存，设备已纳入待完善列表');
      },
    });
  };
  const returnToIntensityPath = () => `/energy-analysis/intensity?objectType=device&year=${applied.year}&energyUnitId=${encodeURIComponent(applied.energyUnitId)}&deviceId=${encodeURIComponent(applied.deviceId)}`;
  const openConversionOutputDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const energyPath = `/data-management/energy-data?tab=conversion&editConversionId=${encodeURIComponent(row.calculationInputs?.conversionOutputId ?? '')}`;
    navigate(withReturnTo(energyPath, returnToIntensityPath()));
  };
  const openEnergyDataDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    navigate(withReturnTo(deviceEnergyDataTabPath(row.deviceId, applied.year, row.metricCode ?? 'custom-device-work', row.deviceName), returnToIntensityPath()));
  };
  const hasDeviceOutputData = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.templateConfig?.denominator.source === 'energy-conversion') return (row.calculationInputs?.denominatorRaw ?? 0) > 0;
    return (row.parameter?.annualValue ?? row.parameter?.value ?? 0) > 0;
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const config = row.templateConfig;
    const numeratorName = config?.numerator.name ?? '分子';
    const denominatorName = config?.denominator.name ?? '分母';
    const isConversionOutput = config?.denominator.source === 'energy-conversion';
    const denominatorLabel = isConversionOutput ? '转换产出' : '设备产出';
    const inputs = row.calculationInputs;
    const hasSourceInputs = inputs?.numeratorRaw !== undefined && inputs.denominatorRaw !== undefined;
    const numerator = `${format(inputs?.numerator ?? row.annualEnergy)} ${inputs?.unit ?? config?.numerator.unit ?? row.energyUnit}`;
    const denominator = `${format(inputs?.denominator ?? row.parameter?.value)} ${inputs?.denominatorRawUnit ?? row.parameter?.unit ?? config?.denominator.unit ?? ''}`;
    const formula = `${row.metricName} = ${row.formula}`;
    const sourceLabel = (source?: string) => source === 'device-energy'
      ? '设备能源数据'
      : source === 'operation-data'
        ? '设备产出数据'
      : source === 'energy-conversion'
          ? '能源转换与外供'
          : undefined;
    setDialog({
      title: '设备指标详情',
      body: (
        <div className={`${styles.basisDialog} ${styles.deviceDetailDialog}`}>
          <section className={styles.basisSection}>
            <h4>基本信息</h4>
            <div className={styles.basisInfoGrid}>
              <div><span>设备名称</span><strong>{row.deviceName}</strong></div>
              <div><span>所属用能单元</span><strong>{row.energyUnitName}</strong></div>
              <div><span>指标名称</span><strong>{row.metricName}</strong></div>
              <div><span>统计期间</span><strong>{applied.year}年度</strong></div>
              <div><span>计算结果</span><strong>{format(row.value, 3)} {row.metricUnit}</strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueGrid}>
              <div><span>能源消耗</span><strong>{hasSourceInputs ? `${format(inputs.numeratorRaw ?? 0)} ${inputs.numeratorRawUnit ?? ''}` : numerator}</strong><small>具体口径：{numeratorName}｜来源：{sourceLabel(config?.numerator.source) ?? '数据来源未配置'}</small></div>
              <div><span>{denominatorLabel}</span><strong>{hasSourceInputs ? `${format(inputs.denominatorRaw ?? 0)} ${inputs.denominatorRawUnit ?? ''}` : denominator}</strong><small>具体口径：{denominatorName}｜来源：{sourceLabel(config?.denominator.source) ?? '数据来源未配置'}</small></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{formula}</strong>
          </section>
        </div>
      ),
      cancelText: '关闭',
      wide: true,
      secondarySubmitText: config?.numerator.source === 'device-energy' ? '修改能源消耗数据' : undefined,
      onSecondarySubmit: config?.numerator.source === 'device-energy' ? () => window.setTimeout(() => openEnergyDataDialog(row), 0) : undefined,
      submitText: isConversionOutput ? '修改转换产出数据' : '修改设备产出数据',
      onSubmit: () => window.setTimeout(() => {
        if (config?.denominator.source === 'energy-conversion') openConversionOutputDialog(row);
        else openParameterDialog(row);
      }, 0),
    });
  };
  const query = () => { const next = { year: Number(year) || 2026, energyUnitId, deviceId }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const reset = () => { setYear('2026'); setEnergyUnitId('all'); setDeviceId('all'); const next = { year: 2026, energyUnitId: 'all', deviceId: 'all' }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const deviceOptions = devices.filter((row) => energyUnitId === 'all' || row.energyUnitId === energyUnitId);
  const trendCandidates = rows.filter((row) => row.resultStatus === '已计算');
  const trendRow = trendCandidates.find((row) => row.deviceId === trendDeviceId) ?? trendCandidates[0];
  const trendMax = Math.max(...(trendRow?.monthlyMetricValues.filter((value): value is number => value !== null) ?? [0]), 0);
  const deviceTrendDisplayMax = trendMax > 0 ? trendMax * 1.15 : 1;
  const deviceTrendLineSegments: Array<Array<{ x: number; y: number }>> = [];
  let deviceTrendLine: Array<{ x: number; y: number }> = [];
  trendRow?.monthlyMetricValues.forEach((value, index) => {
    if (value === null) {
      if (deviceTrendLine.length) deviceTrendLineSegments.push(deviceTrendLine);
      deviceTrendLine = [];
      return;
    }
    deviceTrendLine.push({ x: ((index + 0.5) / 12) * 100, y: 100 - Math.min(100, value / deviceTrendDisplayMax * 100) });
  });
  if (deviceTrendLine.length) deviceTrendLineSegments.push(deviceTrendLine);
  const latestMetricIndex = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => row.monthlyMetricValues.reduce<number>((last, value, index) => value !== null ? index : last, -1);
  const deviceLatestIndex = trendRow ? latestMetricIndex(trendRow) : -1;
  const changeFor = (row: ReturnType<typeof buildDeviceIntensityRows>[number], index: number) => {
    const current = row.monthlyMetricValues[index];
    const previousMonth = row.monthlyMetricValues[index - 1];
    const priorYear = previousRows.find((item) => item.deviceId === row.deviceId)?.monthlyMetricValues[index];
    return {
      mom: current !== null && previousMonth !== null && previousMonth !== undefined && previousMonth !== 0 ? (current - previousMonth) / previousMonth * 100 : null,
      yoy: current !== null && priorYear !== null && priorYear !== undefined && priorYear !== 0 ? (current - priorYear) / priorYear * 100 : null,
    };
  };
  const renderMetricRow = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const index = latestMetricIndex(row);
    const changes = index >= 0 ? changeFor(row, index) : { mom: null, yoy: null };
    const needsEnergyData = row.resultStatus === '待完善' && !row.completeEnergy;
    const needsOutputData = row.resultStatus === '待完善' && !hasDeviceOutputData(row);
    const selectRow = () => { setTrendDeviceId(row.deviceId); setShowDeviceMonthly(false); };
    const outputActionLabel = row.templateConfig?.denominator.source === 'energy-conversion' ? '补充转换产出数据' : '补充产出数据';
    const openOutputData = () => {
      if (row.templateConfig?.denominator.source === 'energy-conversion') openConversionOutputDialog(row);
      else openParameterDialog(row);
    };
    return <tr key={row.deviceId}><td>{row.deviceName}</td><td>{row.energyUnitName}</td><td>{row.metricName}</td><td>{row.value === null ? '—' : `${format(row.value, 3)} ${row.metricUnit}`}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><div className={styles.deviceInlineActions}>{row.resultStatus === '已计算' && <button type="button" className={styles.link} onClick={() => { selectRow(); openDetail(row); }}>查看详情</button>}{needsEnergyData && <button type="button" className={styles.link} onClick={() => { selectRow(); openEnergyDataDialog(row); }}>补充能源数据</button>}{needsOutputData && <button type="button" className={styles.link} onClick={() => { selectRow(); openOutputData(); }}>{outputActionLabel}</button>}{row.resultStatus === '暂不可计算' && <button type="button" className={styles.link} onClick={() => { selectRow(); openDeviceMetricConfig(row); }}>配置指标口径</button>}</div></td></tr>;
  };
  return <div className={styles.page}>
    <section className={`${styles.card} ${styles.filterCard}`}>
      <FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '一级用能单元'], ['product', '重点产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField>
      <FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select></FilterField>
      <FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField>
      <FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField>
      <div className={styles.filterSpacer} /><EnergyButton primary onClick={query}>查询</EnergyButton><EnergyButton onClick={reset}>重置</EnergyButton>
    </section>
    <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div><div className={styles.chartTitle}>重点设备指标结果</div></div></div><div className={styles.tableWrap}><table className={styles.deviceMetricTable}><thead><tr><th>重点设备</th><th>所属用能单元</th><th>指标名称</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>操作</th></tr></thead><tbody>{calculatedRows.map(renderMetricRow)}</tbody>{pendingRows.length > 0 && <tbody><tr className={`${styles.deviceGroupRow} ${styles.deviceGroupPending}`}><th colSpan={7}><button type="button" className={styles.deviceGroupToggle} aria-expanded={showPendingDevices} onClick={() => setShowPendingDevices((current) => !current)}>待完善设备（{pendingRows.length}台）<small>{showPendingDevices ? '收起' : '展开'}</small></button></th></tr>{showPendingDevices && pendingRows.map(renderMetricRow)}</tbody>}</table></div>{trendRow && <section className={styles.intensityMonthlyDetail} aria-label="重点设备月度指标趋势"><div className={styles.intensityMonthlyHeader}><div><strong>{trendRow.deviceName}｜月度{trendRow.metricName}趋势</strong></div><FilterField label="趋势设备"><select aria-label="趋势设备" value={trendRow.deviceId} onChange={(event) => { setTrendDeviceId(event.target.value); setShowDeviceMonthly(false); }}>{trendCandidates.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></div><div className={styles.intensityTrendChart} aria-label="重点设备月度指标趋势"><div className={styles.intensityTrendAxis} aria-hidden="true">{[deviceTrendDisplayMax, deviceTrendDisplayMax / 2, 0].map((tick) => <span key={tick}>{format(tick, metricDigits(tick))}</span>)}</div><div className={styles.intensityTrendPlot}><div className={styles.intensityTrendGrid} aria-hidden="true"><i /><i /><i /></div><div className={styles.intensityTrendOverlay} aria-hidden="true"><svg className={styles.intensityTrendLine} viewBox="0 0 100 100" preserveAspectRatio="none">{deviceTrendLineSegments.map((segment, segmentIndex) => segment.length > 1 && <polyline key={segmentIndex} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} />)}</svg>{deviceTrendLineSegments.flatMap((segment) => segment).map((point, pointIndex) => <i key={pointIndex} className={styles.intensityTrendNode} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}</div><div className={styles.intensityTrendBars}>{trendRow.monthlyMetricValues.map((value, index) => { const reported = value !== null; const isLatest = index === deviceLatestIndex; const tone = !reported ? styles.trendBarEmpty : isLatest ? styles.trendBarCurrent : styles.trendBarNormal; return <div key={index} className={styles.intensityTrendBar} title={`${index + 1}月：${reported ? `${format(value, metricDigits(value))} ${trendRow.metricUnit}` : '—'}`}><strong className={styles.intensityTrendValue}>{reported ? format(value, metricDigits(value)) : '—'}</strong><div className={styles.intensityTrendBarTrack}><i className={tone} style={{ height: `${reported ? Math.max(8, value / deviceTrendDisplayMax * 100) : 0}%` }} /></div><small>{index + 1}月</small></div>; })}</div></div></div><div className={styles.monthlyDetailToggle}><span>月度指标明细{!trendRow.completeEnergy ? '｜部分月份缺失' : ''}</span><button type="button" className={styles.link} aria-expanded={showDeviceMonthly} onClick={() => setShowDeviceMonthly((current) => !current)}>{showDeviceMonthly ? '收起明细' : '查看明细'}</button></div>{showDeviceMonthly && <div className={styles.tableWrap}><table className={styles.intensityMonthlyTable}><thead><tr><th>月份</th><th>能源消费量{trendRow.energyUnit ? `（${trendRow.energyUnit}）` : ''}</th><th>设备产出量{trendRow.denominatorUnit && trendRow.denominatorUnit !== '—' ? `（${trendRow.denominatorUnit}）` : ''}</th><th>指标值{trendRow.metricUnit && trendRow.metricUnit !== '—' ? `（${trendRow.metricUnit}）` : ''}</th><th>环比变化</th><th>同比变化</th></tr></thead><tbody>{trendRow.monthlyMetricValues.map((value, index) => { const changes = changeFor(trendRow, index); const energy = trendRow.reportedMonths[index] ? trendRow.monthlyEnergy[index] : null; const output = trendRow.monthlyDenominator[index]; return <tr key={index}><td>{index + 1}月</td><td>{energy === null ? '—' : format(energy, 2)}</td><td>{output === null ? '—' : format(output, 2)}</td><td>{value === null ? '—' : format(value, metricDigits(value))}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td></tr>; })}</tbody></table></div>}</section>}</section>
      <div className={styles.slimNote}><div><i>i</i><span>所有重点设备统一按“单位产出能耗”展示；已维护设备产出口径的设备直接纳入分析，缺少能源消耗或设备产出数据时显示“待完善”。趋势分析仅支持已计算设备。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} />
  </div>;
}

function ProductMetricDetail({ metric, objectName }: { metric: CalculatedIntensityMetric; objectName: string }) {
  return <>
    <section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={[['分析对象', `${objectName}｜产品`], ['指标名称', metric.name], ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`], ['统计期间', metric.period], ['结果说明', '产品关联生产用能单元的能源消费统计，不代表产品独立能耗']]} /></section>
    <section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={[['分子数据', metric.numerator], ['分子来源', metric.numeratorSource ?? '能源数据—企业层级—全厂'], ['分母数据', metric.denominator], ['分母来源', metric.denominatorSource ?? '运营数据—产品产量'], ['计算公式', metric.formula]]} /></section>
    <section className={styles.modalSection}><h3>数据来源</h3><DetailGrid items={[['能源数据来源', metric.numeratorSource ?? '能源数据—关联一级用能单元'], ['运营数据来源', metric.denominatorSource ?? '运营数据—一级用能单元—产品产量'], ['多产品规则', '一期不进行能源分配；同一生产单元关联多个产品时不计算单位产品综合能耗'], ['最近计算时间', '2026-08-04']]} /></section>
  </>;
}

/* function DeviceIntensityTab({ onTabChange }: { onTabChange: (type: IntensityObjectType) => void }) {
  const navigate = useNavigate();
  const [year, setYear] = useState('2026');
  const [energyUnitId, setEnergyUnitId] = useState('all');
  const [deviceType, setDeviceType] = useState('all');
  const [deviceId, setDeviceId] = useState('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast } = useFeedback();
  const rows = useMemo(() => buildDeviceIntensityRows(Number(year) || 2026, deviceType, energyUnitId, deviceId), [year, deviceType, energyUnitId, deviceId]);
  const devices = useMemo(() => buildDeviceIntensityRows(Number(year) || 2026), [year]);
  const calculated = rows.filter((row) => row.resultStatus === '已计算').length;
  const openEnergyData = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const entered = row.reportedMonths.map((item, index) => item ? `${index + 1}月` : '').filter(Boolean).join('、') || '暂无';
    const missing = row.reportedMonths.map((item, index) => item ? '' : `${index + 1}月`).filter(Boolean).join('、') || '无';
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['能源品种', row.energyTypeName], ['数据进度', row.dataProgress], ['已录入月份', entered], ['缺失月份', missing], ['具体原因', row.resultReason ?? '能源数据未录入']]} /><div className={styles.modalNote}>能源数据未完整时不生成正式年度指标。请补齐能源数据后重新计算。</div></>, submitText: '补充能源数据', onSubmit: () => navigate(row.templateConfig?.numerator.source === 'energy-conversion' ? '/data-management/energy-data?tab=conversion' : deviceEnergyDataPath(row.deviceId, year, row.metricCode ?? 'custom-device-work', row.energyRecordId)) });
  };
  const openParameter = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    let value = row.parameter?.value ? String(row.parameter.value) : '';
    const label = `${row.templateConfig?.denominator.name ?? '分母数据'}（${row.templateConfig?.denominator.unit ?? '单位'}）`;
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['典型指标', row.metricName], ['具体原因', row.resultReason ?? '缺少计算参数']]} /><label className={styles.modalField}><span className={styles.required}>{label}</span><input aria-label={label} type="number" min="0" step="0.001" defaultValue={value} onChange={(event) => { value = event.target.value; }} /></label></>, submitText: '补充计算参数', onSubmit: () => { const parsed = Number(value); if (Number.isFinite(parsed) && parsed > 0) saveDeviceIntensityParameter({ deviceId: row.deviceId, year: Number(year), metricCode: row.metricCode as DeviceIntensityMetricCode, value: parsed, unit: row.templateConfig?.denominator.unit ?? '—' }); } });
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const config = row.templateConfig;
    const numerator = `${config?.numerator.name ?? '分子'} ${format(row.annualEnergy)} ${config?.numerator.unit ?? row.energyUnit}`;
    const denominator = `${config?.denominator.name ?? '分母'} ${format(row.parameter?.value)} ${config?.denominator.unit ?? ''}`;
    const formula = row.formula;
    setDialog({
      title: '设备指标详情',
      body: (
        <div className={styles.basisDialog}>
          <section className={styles.basisSection}>
            <h4>基本信息</h4>
            <div className={styles.basisInfoGrid}>
              <div><span>设备名称</span><strong>{row.deviceName}</strong></div>
              <div><span>所属用能单元</span><strong>{row.energyUnitName}</strong></div>
              <div><span>指标名称</span><strong>{row.metricName}</strong></div>
              <div><span>统计期间</span><strong>{year}年度</strong></div>
              <div><span>指标结果</span><strong>{format(row.value, 3)} {row.metricUnit}</strong></div>
              <div><span>指标单位</span><strong>{row.metricUnit}</strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueGrid}>
              <div><span>{config?.numerator.name ?? '分子'}</span><strong>{numerator}</strong><small>{config?.numerator.source ?? '数据来源未配置'}</small></div>
              <div><span>{config?.denominator.name ?? '分母'}</span><strong>{denominator}</strong><small>{config?.denominator.source ?? '数据来源未配置'}</small></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{formula}</strong>
          </section>
        </div>
      ),
      cancelText: '关闭',
      submitText: '编辑参数',
      onSubmit: () => openParameter(row),
    });
  };
  };
  const openUnavailable = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => setDialog({ title: '指标暂不可计算', body: <DetailGrid items={[['重点设备', row.deviceName], ['典型指标', row.metricName], ['当前状态', row.resultStatus], ['具体原因', row.resultReason ?? '当前设备暂无可用指标模板']]} />, cancelText: '关闭' });
  const deviceTypes = [...new Set(devices.map((row) => row.deviceType))];
  const deviceOptions = devices.filter((row) => (deviceType === 'all' || row.deviceType === deviceType) && (energyUnitId === 'all' || row.energyUnitId === energyUnitId));
  return <div className={styles.page}><section className={`${styles.card} ${styles.filterCard}`}><FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '一级用能单元'], ['product', '重点产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField><FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option><option>2024</option></select></FilterField><FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField><FilterField label="设备类型"><select aria-label="设备类型" value={deviceType} onChange={(event) => { setDeviceType(event.target.value); setDeviceId('all'); }}><option value="all">全部设备类型</option>{deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterField><FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></section><section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div><div className={styles.chartTitle}>重点设备指标结果</div></div></div><div className={styles.tableWrap}><table><thead><tr><th>重点设备</th><th>所属用能单元</th><th>指标名称</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>操作</th></tr></thead><tbody>{calculatedRows.map(renderMetricRow)}</tbody>{pendingRows.length > 0 && <tbody><tr className={`${styles.deviceGroupRow} ${styles.deviceGroupPending}`}><th colSpan={7}><button type="button" className={styles.deviceGroupToggle} aria-expanded={showPendingDevices} onClick={() => setShowPendingDevices((current) => !current)}>待完善设备（{pendingRows.length}台）<small>{showPendingDevices ? '收起' : '展开'}</small></button></th></tr>{showPendingDevices && pendingRows.map(renderMetricRow)}</tbody>}</table></div>{trendRow && <section className={styles.intensityMonthlyDetail} aria-label="重点设备月度指标趋势"><div className={styles.intensityMonthlyHeader}><div><strong>{trendRow.deviceName}｜月度{trendRow.metricName}趋势</strong></div><FilterField label="趋势设备"><select aria-label="趋势设备" value={trendRow.deviceId} onChange={(event) => { setTrendDeviceId(event.target.value); setShowDeviceMonthly(false); }}>{trendCandidates.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></div><div className={styles.intensityTrendChart} aria-label="重点设备月度指标趋势"><div className={styles.intensityTrendAxis} aria-hidden="true">{[deviceTrendDisplayMax, deviceTrendDisplayMax / 2, 0].map((tick) => <span key={tick}>{format(tick, metricDigits(tick))}</span>)}</div><div className={styles.intensityTrendPlot}><div className={styles.intensityTrendGrid} aria-hidden="true"><i /><i /><i /></div><div className={styles.intensityTrendOverlay} aria-hidden="true"><svg className={styles.intensityTrendLine} viewBox="0 0 100 100" preserveAspectRatio="none">{deviceTrendLineSegments.map((segment, segmentIndex) => segment.length > 1 && <polyline key={segmentIndex} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} />)}</svg>{deviceTrendLineSegments.flatMap((segment) => segment).map((point, pointIndex) => <i key={pointIndex} className={styles.intensityTrendNode} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}</div><div className={styles.intensityTrendBars}>{trendRow.monthlyMetricValues.map((value, index) => { const reported = value !== null; const isLatest = index === deviceLatestIndex; const tone = !reported ? styles.trendBarEmpty : isLatest ? styles.trendBarCurrent : styles.trendBarNormal; return <div key={index} className={styles.intensityTrendBar} title={`${index + 1}月：${reported ? `${format(value, metricDigits(value))} ${trendRow.metricUnit}` : '—'}`}><strong className={styles.intensityTrendValue}>{reported ? format(value, metricDigits(value)) : '—'}</strong><div className={styles.intensityTrendBarTrack}><i className={tone} style={{ height: `${reported ? Math.max(8, value / deviceTrendDisplayMax * 100) : 0}%` }} /></div><small>{index + 1}月</small></div>; })}</div></div></div><div className={styles.monthlyDetailToggle}><span>月度指标明细{!trendRow.completeEnergy ? '｜部分月份缺失' : ''}</span><button type="button" className={styles.link} aria-expanded={showDeviceMonthly} onClick={() => setShowDeviceMonthly((current) => !current)}>{showDeviceMonthly ? '收起明细' : '查看明细'}</button></div>{showDeviceMonthly && <div className={styles.tableWrap}><table className={styles.intensityMonthlyTable}><thead><tr><th>月份</th><th>能源消费量{trendRow.energyUnit ? `（${trendRow.energyUnit}）` : ''}</th><th>设备产出量{trendRow.denominatorUnit && trendRow.denominatorUnit !== '—' ? `（${trendRow.denominatorUnit}）` : ''}</th><th>指标值{trendRow.metricUnit && trendRow.metricUnit !== '—' ? `（${trendRow.metricUnit}）` : ''}</th><th>环比变化</th><th>同比变化</th></tr></thead><tbody>{trendRow.monthlyMetricValues.map((value, index) => { const changes = changeFor(trendRow, index); const energy = trendRow.reportedMonths[index] ? trendRow.monthlyEnergy[index] : null; const output = trendRow.monthlyDenominator[index]; return <tr key={index}><td>{index + 1}月</td><td>{energy === null ? '—' : format(energy, 2)}</td><td>{output === null ? '—' : format(output, 2)}</td><td>{value === null ? '—' : format(value, metricDigits(value))}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td></tr>; })}</tbody></table></div>}</section>}</section><div className={styles.slimNote}><div><i>i</i><span>所有重点设备统一按“单位产出能耗”展示；已维护设备产出口径的设备直接纳入分析，缺少能源消耗或设备产出数据时显示“待完善”。趋势分析仅支持已计算设备。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} /></div>;
}

} */

function monthlyInputLabels(metric: CalculatedIntensityMetric) {
  const numerator = metric.name.includes('电耗') || metric.unit.startsWith('kWh/') ? '电力消耗量（kWh）' : '综合能源消耗量（tce）';
  const denominatorUnit = metric.unit.split('/')[1];
  const withUnit = (label: string) => denominatorUnit ? `${label}（${denominatorUnit}）` : label;
  if (metric.name.includes('增加值')) return { numerator, denominator: withUnit('工业增加值') };
  if (metric.name.includes('产值')) return { numerator, denominator: withUnit('工业总产值') };
  if (metric.name.includes('蒸汽')) return { numerator, denominator: withUnit('蒸汽产量') };
  if (metric.name.includes('供能量')) return { numerator, denominator: withUnit('动力中心供能量') };
  if (metric.name.includes('建筑面积')) return { numerator, denominator: withUnit('办公建筑面积') };
  if (metric.name.includes('物流作业量')) return { numerator, denominator: withUnit('货物吞吐量') };
  if (metric.name.includes('运行')) return { numerator, denominator: withUnit('业务量') };
  return { numerator, denominator: withUnit('产品产量') };
}

function IntensityMonthlyDetail({ metric, year, object, options, onChange, getOptionLabel, getOptionGroup }: { metric: CalculatedIntensityMetric; year: number; object?: IntensityObjectOption; options?: CalculatedIntensityMetric[]; onChange?: (metricId: string) => void; getOptionLabel?: (metric: CalculatedIntensityMetric) => string; getOptionGroup?: (metric: CalculatedIntensityMetric) => string }) {
  const navigate = useNavigate();
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);
  const optionGroups = options && getOptionGroup ? [...new Set(options.map(getOptionGroup))] : [];
  const [selectedGroup, setSelectedGroup] = useState(() => getOptionGroup?.(metric) ?? 'all');
  const groupedOptions = options && optionGroups.length > 1
    ? options.filter((option) => getOptionGroup?.(option) === selectedGroup)
    : options;
  const values = metric.monthlyMetrics.map((item) => item.value).filter((value): value is number => value !== null);
  const max = Math.max(...values, 0);
  const displayMax = max > 0 ? max * 1.15 : 1;
  const trendLineSegments: Array<Array<{ x: number; y: number }>> = [];
  let currentTrendLine: Array<{ x: number; y: number }> = [];
  metric.monthlyMetrics.forEach((item, index) => {
    if (item.value === null) {
      if (currentTrendLine.length) trendLineSegments.push(currentTrendLine);
      currentTrendLine = [];
      return;
    }
    currentTrendLine.push({ x: ((index + 0.5) / 12) * 100, y: 100 - Math.min(100, item.value / displayMax * 100) });
  });
  if (currentTrendLine.length) trendLineSegments.push(currentTrendLine);
  const tickValues = [displayMax, displayMax / 2, 0];
  const latestIndex = metric.monthlyMetrics.reduce((last, item, index) => item.value !== null ? index : last, -1);
  const calculatedCount = metric.monthlyMetrics.filter((item) => item.status === '已计算').length;
  const basis = metric.monthlyDataStatus === 'complete'
    ? '真实月度能源与运营数据'
    : metric.monthlyDataStatus === 'incomplete'
      ? `月度数据不完整，已计算 ${calculatedCount}/12 个月`
      : '当前仅有年度数据，未生成月度指标';
  const statusTone = (status: string) => status === '已计算' ? 'ok' as const : status === '数据不完整' ? 'warn' as const : 'none' as const;
  const inputLabels = monthlyInputLabels(metric);
  const hasMonthlyData = metric.monthlyDataStatus !== 'unavailable';
  const annualOnly = metric.value !== null && metric.monthlyDataStatus === 'unavailable';
  const staticAnnualMetric = object?.objectId === 'eu-office' || metric.name.includes('建筑面积');
  const monthlyEmptyTitle = metric.value === null ? '数据缺失' : '年度指标已计算，月度数据缺失';
  const monthlyEmptyDescription = metric.value === null
    ? '当前指标所需基础数据缺失，年度指标和月度趋势暂不可用。'
    : staticAnnualMetric
      ? '办公建筑面积按年度静态基数维护，当前指标不生成月度趋势。'
      : '当前存在年度数据，但尚未取得可用的月度能源或运营数据。补录月度数据后将生成趋势与明细。';

  return (
    <div className={styles.intensityMonthlyDetail} aria-label={`月度指标明细：${metric.name}`}>
      <div className={styles.intensityMonthlyHeader}>
        <div>
          <strong>{metric.name}｜月度趋势与明细</strong>
          {metric.monthlyDataStatus === 'unavailable' && !staticAnnualMetric && <button type="button" className={styles.monthlyDataAction} onClick={() => {
            const officeMetric = object?.objectId === 'eu-office' || metric.name.includes('建筑面积');
            const unitMetric = object?.objectType === 'unit';
            const metricName = officeMetric ? '办公建筑面积' : metric.name.includes('增加值') ? '工业增加值' : metric.name.includes('产值') ? '工业总产值' : metric.name.includes('供能量') ? '动力中心供能量' : '产品产量';
            const category = officeMetric || metric.name.includes('供能量') ? '运行指标' : metricName === '产品产量' ? '产量' : '经济指标';
            const scope = unitMetric ? `&scopeLevel=${encodeURIComponent(object?.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元')}&unitId=${encodeURIComponent(object?.energyUnitId ?? '')}` : '&scopeLevel=企业';
            const query = `year=${year}${scope}&category=${encodeURIComponent(category)}&metricName=${encodeURIComponent(metricName)}`;
            navigate(`/data-management/operations?${annualOnly ? query : `new=1&${query}`}`);
          }}>{annualOnly ? '补录月度数据' : '补充运营数据'}</button>}
        </div>
        {options && options.length > 0 && onChange && <div className={styles.monthlyTrendFilters}>
          {optionGroups.length > 1 && <FilterField label="指标分类"><select aria-label="指标分类" value={selectedGroup} onChange={(event) => { const nextGroup = event.target.value; setSelectedGroup(nextGroup); const firstOption = options.find((option) => getOptionGroup?.(option) === nextGroup); if (firstOption) onChange(firstOption.intensityMetricId); }}>{optionGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select></FilterField>}
          <FilterField label={optionGroups.length > 1 ? '一级用能单元' : '趋势指标'}><select aria-label={optionGroups.length > 1 ? '一级用能单元' : '趋势指标'} value={groupedOptions?.some((option) => option.intensityMetricId === metric.intensityMetricId) ? metric.intensityMetricId : groupedOptions?.[0]?.intensityMetricId ?? metric.intensityMetricId} onChange={(event) => onChange(event.target.value)}>{groupedOptions?.map((option) => <option key={option.intensityMetricId} value={option.intensityMetricId}>{getOptionLabel?.(option) ?? option.name}</option>)}</select></FilterField>
        </div>}
      </div>
      {!hasMonthlyData && <div className={styles.monthlyEmptyState}>
        <strong>{monthlyEmptyTitle}</strong>
        <span>{monthlyEmptyDescription}</span>
      </div>}
      {hasMonthlyData && values.length > 0 && (
        <>
          <div className={styles.intensityTrendChart} aria-label="月度指标趋势">
            <div className={styles.intensityTrendAxis} aria-hidden="true">
              {tickValues.map((tick) => <span key={tick}>{format(tick, metricDigits(tick))}</span>)}
            </div>
            <div className={styles.intensityTrendPlot}>
              <div className={styles.intensityTrendGrid} aria-hidden="true"><i /><i /><i /></div>
              <div className={styles.intensityTrendOverlay} aria-hidden="true">
                <svg className={styles.intensityTrendLine} viewBox="0 0 100 100" preserveAspectRatio="none">
                  {trendLineSegments.map((segment, segmentIndex) => segment.length > 1 && <polyline key={segmentIndex} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />)}
                </svg>
                {trendLineSegments.flatMap((segment) => segment).map((point, pointIndex) => <i key={pointIndex} className={styles.intensityTrendNode} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}
              </div>
              <div className={styles.intensityTrendBars}>
                {metric.monthlyMetrics.map((item, index) => {
                  const isLatest = index === latestIndex;
                  const tone = item.value === null ? styles.trendBarEmpty : isLatest ? styles.trendBarCurrent : styles.trendBarNormal;
                  return <div key={item.month} className={styles.intensityTrendBar} title={`${item.month}月：${item.value === null ? item.status : `${format(item.value, metricDigits(item.value))} ${metric.unit}`}`}>
                    <strong className={styles.intensityTrendValue}>{item.value === null ? '—' : format(item.value, metricDigits(item.value))}</strong>
                    <div className={styles.intensityTrendBarTrack}><i className={tone} style={{ height: `${item.value === null ? 0 : Math.max(8, item.value / displayMax * 100)}%` }} /></div>
                    <small>{item.month}月</small>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </>
      )}
      {hasMonthlyData && <div className={styles.monthlyDetailToggle}>
        <span>月度明细{metric.monthlyDataStatus === 'incomplete' ? '｜部分月份缺失' : ''}</span>
        <button type="button" className={styles.link} aria-expanded={showMonthlyTable} onClick={() => setShowMonthlyTable((current) => !current)}>{showMonthlyTable ? '收起明细' : '查看明细'}</button>
      </div>}
      {hasMonthlyData && showMonthlyTable && <div className={styles.tableWrap}>
        <table className={styles.intensityMonthlyTable}>
        <thead><tr><th>月份</th><th>{inputLabels.numerator}</th><th>{object?.objectType === 'unit' ? '指标核算基数' : inputLabels.denominator}</th><th>指标值（{metric.unit}）</th><th>环比</th><th>同比</th></tr></thead>
          <tbody>
            {metric.monthlyMetrics.map((item) => (
              <tr key={item.month}>
                <td>{item.month}月</td>
                <td>{item.numerator === null ? '—' : format(item.numerator, metricDigits(item.numerator))}</td>
                <td>{item.denominator === null ? '—' : format(item.denominator, metricDigits(item.denominator))}</td>
                <td>{item.value === null ? '—' : format(item.value, metricDigits(item.value))}</td>
                <td className={item.momChange !== null && item.momChange < 0 ? styles.down : item.momChange !== null ? styles.up : ''}>{item.momChange === null ? '—' : percent(item.momChange)}</td>
                <td className={item.yoyChange !== null && item.yoyChange < 0 ? styles.down : item.yoyChange !== null ? styles.up : ''}>{item.yoyChange === null ? '—' : percent(item.yoyChange)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

function IntensityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const intensitySearch = new URLSearchParams(location.search);
  const requestedObjectType = intensitySearch.get('objectType') as IntensityObjectType | null;
  const initialObjectType = requestedObjectType === 'factory' || requestedObjectType === 'unit' || requestedObjectType === 'product' || requestedObjectType === 'device'
    ? requestedObjectType
    : window.sessionStorage.getItem('energy-intensity-tab') === 'device' ? 'device' : 'factory';
  const initialYear = intensitySearch.get('year') ?? '2026';
  const initialObjectId = intensitySearch.get('objectId') ?? 'all';
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftObjectType, setDraftObjectType] = useState<IntensityObjectType>(initialObjectType);
  const [draftObjectId, setDraftObjectId] = useState(initialObjectId);
  const [applied, setApplied] = useState({
    year: Number(initialYear) || 2026,
    objectType: initialObjectType,
    objectId: initialObjectType === 'factory' ? 'factory' : initialObjectId,
    unitLevel: initialObjectType === 'unit' ? 'level1' as const : 'all' as const,
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [trendMetricId, setTrendMetricId] = useState<string | null>(null);
  const { toast, notify } = useFeedback();
  const draftObjects = useMemo(
    () => listIntensityObjects(draftObjectType).filter((object) => draftObjectType !== 'unit' || object.unitLevel === 'level1'),
    [draftObjectType],
  );
  const draftProductSummary = draftObjectType === 'product' ? draftObjects[0] : undefined;
  const view = useMemo(
    () => buildIntensityCalculationViews(applied.year, applied.objectType, applied.unitLevel, applied.objectId)[0]
      ?? buildIntensityCalculationView(applied.year, applied.objectType, applied.objectId),
    [applied],
  );
  const resultViews = useMemo(
    () => buildIntensityCalculationViews(applied.year, applied.objectType, applied.unitLevel, applied.objectId),
    [applied],
  );
  const previousResultViews = useMemo(
    () => buildIntensityCalculationViews(applied.year - 1, applied.objectType, applied.unitLevel, applied.objectId),
    [applied],
  );
  const rows = resultViews.flatMap((resultView) => resultView.metrics);
  const visibleRows = applied.objectType === 'unit'
    ? rows.filter((metric) => metric.resultType === 'ok')
    : rows;
  const legacyScopeNote = applied.objectType === 'factory'
    ? '全厂指标只读取企业层级能源数据，产品产量和经济指标按企业年度数据匹配。'
    : applied.objectType === 'unit'
      ? '一级用能单元指标一期只展示一级用能单元，仅读取当前一级单元能源数据，不读取或汇总二级能源消费记录。'
      : '产品 Tab 按产品—一级用能单元展示关联生产单元综合能耗，不进行多产品能源分配。';
  const scopeNote = applied.objectType === 'product' ? '产品Tab读取一级用能单元运营数据中的产品产量，并匹配关联生产单元能源数据；一期不进行多产品能源分配。' : legacyScopeNote;
  const productScopeNote = '产品Tab展示产品关联生产用能单元的能源消费统计，不代表产品独立能耗；一期不进行多产品能源分配，同一生产单元关联多个产品时不计算单位产品综合能耗。';
  const metricObjectMap = new Map(resultViews.flatMap((resultView) => resultView.metrics.map((metric) => [metric.intensityMetricId, resultView.object])));
  const metricViewFor = (metric: CalculatedIntensityMetric) => resultViews.find((resultView) => resultView.object.objectId === metricObjectMap.get(metric.intensityMetricId)?.objectId) ?? view;
  const metricGroupFor = (metric: CalculatedIntensityMetric) => metricObjectMap.get(metric.intensityMetricId)?.unitKind === 'production' ? '生产类用能单元' : '非生产类用能单元';
  const defaultMonthlyMetric = visibleRows[0];
  const trendRows = applied.objectType === 'unit' ? rows : visibleRows;
  const displayedMonthlyMetric = trendRows.find((metric) => metric.intensityMetricId === trendMetricId) ?? (applied.objectType === 'unit' ? trendRows[0] : defaultMonthlyMetric);
  const comparisonMetricNames = [...new Set(visibleRows.map((metric) => metric.name))];
  const comparisonViews = resultViews
    .map((resultView) => ({ ...resultView, metrics: resultView.metrics.filter((metric) => visibleRows.some((item) => item.intensityMetricId === metric.intensityMetricId)) }))
    .filter((resultView) => resultView.metrics.length > 0);
  const metricChanges = (metric: CalculatedIntensityMetric, objectId?: string) => {
    const latestIndex = metric.monthlyMetrics.reduce<number>((last, item, index) => item.value !== null ? index : last, -1);
    const previousMetric = objectId
      ? previousResultViews.find((resultView) => resultView.object.objectId === objectId)?.metrics.find((item) => item.name === metric.name)
      : undefined;
    const annualYoy = metric.value !== null && previousMetric?.value !== null && previousMetric?.value !== undefined && previousMetric.value !== 0
      ? (metric.value - previousMetric.value) / previousMetric.value * 100
      : null;
    if (latestIndex < 0) return { mom: null, yoy: annualYoy };
    const current = metric.monthlyMetrics[latestIndex]?.value;
    const previous = metric.monthlyMetrics[latestIndex - 1]?.value;
    return {
      mom: current !== null && current !== undefined && previous !== null && previous !== undefined && previous !== 0 ? (current - previous) / previous * 100 : null,
      yoy: annualYoy ?? metric.monthlyMetrics[latestIndex]?.yoyChange ?? null,
    };
  };
  const unitMetricGroups = [
    { key: 'production', label: '生产类用能单元', description: '以单位产品综合能耗衡量生产单元的能源利用表现。', unitKind: 'production' as const },
    { key: 'utility', label: '非生产类用能单元', description: '按非生产单元的运营活动展示对应的能耗指标。', unitKind: 'utility' as const },
  ].map((group) => ({ ...group, views: resultViews.filter((resultView) => resultView.object.unitKind === group.unitKind && resultView.metrics.length > 0) })).filter((group) => group.views.length > 0);

  const openLegacyMetricDialog = (metric: CalculatedIntensityMetric, action: boolean, metricView = view) => {
    const year = metric.period.replace('年度', '');
    const status = intensityStatus(metric);
    const sourcePath = metricView.object.objectType === 'factory'
      ? `/data-management/energy-data?year=${year}`
      : metricView.object.objectType === 'unit'
        ? `/data-management/energy-data?year=${year}&keyword=${encodeURIComponent(metricView.object.objectName)}`
        : `/data-management/operations?year=${year}&keyword=${encodeURIComponent(metric.relatedProductName ?? metricView.object.objectName)}`;
    if (action && metric.resultType === 'warn') {
      setDialog({
        title: '数据待完善',
        body: (
          <>
            <DetailGrid items={[
              ['分析对象', metricView.object.objectName],
              ['指标名称', metric.name],
              ['指标状态', status.label],
              ['具体原因', status.reason],
            ]} />
            <div className={styles.modalNote}>
              '补充对应能源数据、运营数据或计算参数后，系统将按当前分析对象自动重新计算。'
            </div>
          </>
        ),
        submitText: '完善数据',
        onSubmit: () => navigate(sourcePath),
      });
      return;
    }
    const isFactory = metricView.object.objectType === 'factory';
    const isUnit = metricView.object.objectType === 'unit';
    const productCalculationBasis: Array<[string, ReactNode]> = [['企业产品口径', `${metricView.object.objectName}｜产品`], ['企业年度综合能耗', metric.numerator], ['能源数据来源', metric.numeratorSource ?? '能源数据—企业层级—全厂'], ['产品年度产量', metric.denominator], ['产品产量来源', metric.denominatorSource ?? '运营数据—产品产量'], ['计算公式', metric.formula]];
    const unitCalculationBasis: Array<[string, ReactNode]> = [['用能单元层级', metricView.object.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'], ['当前用能单元能源数据', `${metric.energyTypeNames?.join('、') || '—'}｜能源记录${metric.energyRecordIds.length}条`], ['关联产品产量及来源', metric.denominator], ['关联关系', metric.relatedProductName ? `${metric.relatedProductName}关联${metricView.object.objectName}` : '尚未形成关联']];
    const calculationBasis = metricView.object.objectType === 'product' ? productCalculationBasis : isUnit ? unitCalculationBasis : isFactory
      ? [['分子来源', `能源数据—企业层级—全厂｜${metric.energyTypeNames?.join('、') || '企业能源品种'}｜${metric.energyRecordIds.length}条记录`], ['分母来源', `运营数据—企业层级｜${metric.operationMetricIds.length}条经济/产量指标`], ['层级口径', '只读取企业级能源数据，不汇总下级用能单元和重点设备数据。']]
      : isUnit
        ? [['用能单元层级', metricView.object.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'], ['关联产品名称', metric.relatedProductName ?? '未关联产品'], ['产品与用能单元关联关系', metric.relatedProductName ? `${metric.relatedProductName}关联${metricView.object.objectName}` : '尚未形成关联'], ['当前用能单元能源数据', `${metric.energyTypeNames?.join('、') || '—'}｜能源记录${metric.energyRecordIds.length}条`], ['关联产品产量', metric.denominator], ['多产品规则', metric.allocationDescription ?? '按已确认的产量汇总或能耗分配结果']]
        : [];
    const objectLevel = isFactory ? '企业' : isUnit ? (metricView.object.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元') : '产品';
    const resultItems: Array<[string, ReactNode]> = [['分析对象', `${metricView.object.objectName}｜${objectLevel}`], ['指标名称', metric.name], ['计算结果', metric.value === null ? (metric.issue === '数据缺失' || metric.issue === '缺少工业增加值' ? '数据缺失' : '—') : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`], ['统计期间', metric.period], ['计算状态', status.label]];
    const traceSource = metricView.object.objectType === 'factory'
      ? '能源数据—企业层级—全厂；运营数据—企业层级指标'
      : metricView.object.objectType === 'product'
        ? `能源数据—企业层级—全厂；运营数据—产品产量`
        : `能源数据—${metricView.object.objectName}；运营数据—关联产品产量`;
    setDialog({
      title: '指标计算详情',
      body: metricView.object.objectType === 'product' ? <ProductMetricDetail metric={metric} objectName={metricView.object.objectName} /> : <>
        <section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={resultItems} /></section>
        <section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={calculationBasis as Array<[string, ReactNode]>} /></section>
        <section className={styles.modalSection}><h3>计算公式</h3><div className={styles.formulaBox}>{metric.formula}</div></section>
        <section className={styles.modalSection}><h3>数据追溯</h3><div className={styles.modalNote}>{traceSource}<br />能源记录{metric.energyRecordIds.length}条；运营记录{metric.operationMetricIds.length}条；最近计算时间：2026-08-04。</div></section>
      </>,
      submitText: '查看源数据',
      onSubmit: () => navigate(sourcePath),
    });
  };
  void openLegacyMetricDialog;

  const openMetricDialog = (metric: CalculatedIntensityMetric, action: boolean, metricView = view) => {
    const year = metric.period.replace('年度', '');
    const returnTo = `/energy-analysis/intensity?objectType=${applied.objectType}&year=${applied.year}&objectId=${encodeURIComponent(applied.objectId)}`;
    const status = intensityStatus(metric);
    const displayFormula = metric.name.includes('单位产品')
      ? `${metric.name} = 综合能耗 × 1000 ÷ 产品产量`
      : metric.name.includes('单位产值')
        ? `${metric.name} = 综合能耗 ÷ 工业总产值`
        : metric.name.includes('单位增加值')
          ? `${metric.name} = 综合能耗 ÷ 工业增加值`
          : metric.formula;
    const valueOnly = (text: string) => {
      if (text.startsWith('缺少')) return '数据缺失';
      const match = text.match(/(-?\d[\d,]*(?:\.\d+)?)\s+([^\s]+)$/);
      return match ? `${match[1]} ${match[2]}` : text;
    };
    const itemOnly = (text: string) => text.replace(/\s+-?\d[\d,]*(?:\.\d+)?\s+[^\s]+$/, '');
    const energyPath = metricView.object.objectType === 'unit'
      ? `/data-management/energy-data?year=${year}&scopeLevel=${encodeURIComponent(metricView.object.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元')}&keyword=${encodeURIComponent(metricView.object.objectName)}`
      : metricView.object.objectType === 'device'
        ? deviceEnergyDataTabPath(metricView.object.objectId, year, metric.intensityMetricId.includes('boiler') ? 'boiler-standard-coal' : 'compressed-air-electricity', metricView.object.objectName)
        : metricView.object.objectType === 'product'
          ? `/data-management/energy-data?year=${year}&scopeLevel=${encodeURIComponent('一级用能单元')}&keyword=${encodeURIComponent(metric.relatedEnergyUnitNames?.[0] ?? metricView.object.objectName)}`
          : `/data-management/energy-data?year=${year}&scopeLevel=${encodeURIComponent('企业')}&keyword=${encodeURIComponent('全厂')}`;
    const operationScopeParams = metricView.object.objectType === 'unit'
      ? `&scopeLevel=${encodeURIComponent(metricView.object.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元')}&unitId=${encodeURIComponent(metricView.object.energyUnitId ?? '')}`
      : metricView.object.objectType === 'product'
        ? `&scopeLevel=${encodeURIComponent('一级用能单元')}&productId=${encodeURIComponent(metricView.object.objectId)}`
        : metricView.object.objectType === 'factory'
          ? `&scopeLevel=${encodeURIComponent('企业')}`
          : '';
    const logisticsMetric = metricView.object.objectId === 'eu-public-support' || metric.name.includes('物流作业量');
    const officeMetric = metricView.object.objectId === 'eu-office' || (metric.name.includes('建筑面积') && !logisticsMetric);
    const operationKeyword = logisticsMetric
      ? '货物吞吐量'
      : officeMetric
      ? '办公建筑面积'
      : metricView.object.objectType === 'product'
      ? metric.relatedProductName ?? metric.name
      : metric.name.includes('增加值')
        ? '工业增加值'
        : metric.name.includes('产值')
          ? '工业总产值'
          : metric.name.includes('供气电耗')
            ? '供气量'
            : metric.name.includes('蒸汽')
              ? '蒸汽产量'
          : metric.name.includes('供能量')
            ? '动力中心供能量'
            : metric.name.includes('建筑面积')
              ? '办公建筑面积'
              : metric.name.includes('物流作业量')
                ? '货物吞吐量'
                : metric.name.includes('产品')
                  ? '产品产量'
                  : metric.name.includes('运行能耗')
                    ? (metric.denominator.match(/按([^）)]+)/)?.[1] ?? '运营量')
                    : metricView.object.objectName;
    const operationCategory = metricView.object.objectType === 'product' || metric.name.includes('单位产品')
      ? '产量'
      : metric.name.includes('产值') || metric.name.includes('增加值')
        ? '经济指标'
        : officeMetric || metric.name.includes('供能量') || metric.name.includes('单位')
          ? '运行指标'
          : undefined;
    const operationPath = `/data-management/operations?year=${year}&keyword=${encodeURIComponent(operationKeyword)}${operationCategory ? `&category=${encodeURIComponent(operationCategory)}` : ''}${operationScopeParams}`;
    const operationEntryPath = operationPath;
    if (action && metric.resultType !== 'ok') {
      const missing = missingDataSources(metric);
      const energyTarget = withReturnTo(energyPath, returnTo);
      const operationTarget = withReturnTo(operationEntryPath, returnTo);
      if (missing.energy && missing.operation) {
        setDialog({
          title: '数据待补充',
          body: <>
            <DetailGrid items={[['分析对象', metricView.object.objectName], ['指标名称', metric.name], ['具体原因', status.reason || '能源数据和运营数据均未完整']]} />
            <div className={styles.modalNote}>当前指标同时缺少能源数据和运营数据，请选择需要补充的数据类型。</div>
          </>,
          secondarySubmitText: '补充能源数据',
          onSecondarySubmit: () => navigate(energyTarget),
          submitText: '补充运营数据',
          onSubmit: () => navigate(operationTarget),
        });
      } else {
        navigate(missing.energy ? energyTarget : operationTarget);
      }
      return;
    }
    const objectLevel = metricView.object.objectType === 'factory'
      ? '全厂'
      : metricView.object.objectType === 'unit'
        ? metricView.object.unitLevel === 'level1' ? '一级用能单元' : '二级用能单元'
        : '产品';
    const numeratorSource = metricView.object.objectType === 'unit'
      ? `能源数据—${metricView.object.objectName}`
      : '能源数据—企业层级—全厂';
    const denominatorSource = '运营数据—产品产量';
    setDialog({
      title: '指标计算详情',
      body: (
        <div className={styles.basisDialog}>
          <section className={styles.basisSection}>
            <h4>基本信息</h4>
            <div className={styles.basisInfoGrid}>
              <div><span>指标对象</span><strong>{metricView.object.objectName}</strong></div>
              <div><span>统计范围</span><strong>{objectLevel}</strong></div>
              <div><span>统计期间</span><strong>{metric.period}</strong></div>
              <div><span>指标单位</span><strong>{metric.unit}</strong></div>
              <div><span>计算结果</span><strong>{metric.value === null ? (metric.issue === '数据缺失' || metric.issue === '缺少工业增加值' ? '数据缺失' : '—') : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`}</strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueTable}>
              <div className={styles.basisValueTableHeader}><span>数据项</span><span>数值</span><span>数据来源</span></div>
              <div className={styles.basisValueTableRow}><strong>分子｜{itemOnly(metric.numerator)}</strong><strong>{valueOnly(metric.numerator)}</strong><small>{numeratorSource}</small></div>
              <div className={styles.basisValueTableRow}><strong>分母｜{metric.name.includes('单位产品') ? '企业产品产量' : metric.name.includes('单位产值') ? '工业总产值' : '工业增加值'}</strong><strong>{valueOnly(metric.denominator)}</strong><small>{denominatorSource}</small></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{displayFormula}</strong>
          </section>
        </div>
      ),
      secondarySubmitText: '修改能源数据',
      onSecondarySubmit: () => navigate(withReturnTo(energyPath, returnTo)),
      submitText: '修改运营数据',
      onSubmit: () => navigate(withReturnTo(metric.operationMetricIds[0] ? operationPath : operationEntryPath, returnTo)),
    });
  };

  if (draftObjectType === 'device') {
    return <DeviceIntensityTab onTabChange={(nextType) => {
      setDraftObjectType(nextType);
      window.sessionStorage.setItem('energy-intensity-tab', nextType);
      setDraftObjectId('all');
      setApplied({ year: Number(draftYear) || 2026, objectType: nextType, objectId: nextType === 'factory' ? 'factory' : 'all', unitLevel: nextType === 'unit' ? 'level1' : 'all' });
    }} />;
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard}`}>
        <FilterField label="指标对象类型" wide>
          <span className={styles.objectSegment}>
            {[
              ['factory', '全厂'],
              ['unit', '一级用能单元'],
              ['product', '重点产品'],
              ['device', '重点设备'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={draftObjectType === value ? styles.active : ''}
                onClick={() => {
                  const nextType = value as IntensityObjectType;
                  setDraftObjectType(nextType);
                  window.sessionStorage.setItem('energy-intensity-tab', nextType);
                  setDraftObjectId('all');
                  setApplied({ year: Number(draftYear) || 2026, objectType: nextType, objectId: nextType === 'factory' ? 'factory' : 'all', unitLevel: nextType === 'unit' ? 'level1' : 'all' });
                }}
              >{label}</button>
            ))}
          </span>
        </FilterField>
        <FilterField label="分析年度">
          <select aria-label="分析年度" value={draftYear} onChange={(event) => setDraftYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select>
        </FilterField>
        {draftObjectType === 'product' ? <FilterField label="产品对象" wide><select aria-label="具体分析对象" value={draftObjectId} onChange={(event) => setDraftObjectId(event.target.value)}><option value="all">全部产品</option>{draftObjects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectName}</option>)}</select></FilterField> : draftObjectType !== 'factory' && <FilterField label="具体一级用能单元" wide>
          <select aria-label="具体一级用能单元" value={draftObjectId} onChange={(event) => setDraftObjectId(event.target.value)}>
            <option value="all">全部一级用能单元</option>
            {draftObjects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectName}</option>)}
          </select>
        </FilterField>}
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => {
          setApplied({
            year: Number(draftYear) || 2026,
            objectType: draftObjectType,
            objectId: draftObjectType === 'factory' ? 'factory' : draftObjectType === 'product' ? draftObjectId : draftObjectId,
            unitLevel: draftObjectType === 'unit' ? 'level1' : 'all',
          });
          notify(draftObjectType === 'unit' ? '已按一级用能单元匹配能源数据与运营数据' : '已按分析对象匹配能源数据与运营数据');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026');
          setDraftObjectType('factory');
          setDraftObjectId('all');
          setApplied({ year: 2026, objectType: 'factory', objectId: 'factory', unitLevel: 'all' });
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}>
        <div className={styles.tableToolbar}>
          <div>
            <div className={styles.chartTitle}>指标结果明细</div>
          </div>
        </div>
        {applied.objectType === 'factory' ? <div className={styles.tableWrap} aria-label="全厂指标摘要"><table className={`${styles.unitMetricTable} ${styles.factoryMetricTable}`}><thead><tr><th>指标名称</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>操作</th></tr></thead><tbody>{rows.map((metric) => { const changes = metricChanges(metric, 'factory'); return <tr key={metric.intensityMetricId}><td><strong>{metric.name}</strong></td><td>{metric.value === null ? '—' : <><strong>{format(metric.value, metricDigits(metric.value))}</strong><small>{metric.unit}</small></>}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true, metricViewFor(metric))}>{metric.resultType === 'warn' ? missingDataActionLabel(metric) : '查看详情'}</button></td></tr>; })}</tbody></table></div> : applied.objectType === 'unit' ? <div className={styles.unitMetricGroups} aria-label="一级用能单元适用指标">
          {unitMetricGroups.map((group) => <section className={styles.unitMetricGroup} key={group.key}>
            <div className={styles.unitMetricGroupHeader}><div><strong>{group.label}</strong><span>{group.description}</span></div></div>
            <div className={styles.tableWrap}><table className={styles.unitMetricTable}><thead><tr><th>名称</th><th>适用核心指标</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>操作</th></tr></thead><tbody>{group.views.map((resultView) => { const metric = resultView.metrics[0]; const isCalculated = metric.resultType === 'ok'; const changes = metricChanges(metric, resultView.object.objectId); return <tr key={resultView.object.objectId}><td><strong>{resultView.object.objectName}</strong></td><td>{metric.name}</td><td>{isCalculated ? <><strong>{format(metric.value, metricDigits(metric.value))}</strong><small>{metric.unit}</small></> : '—'}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><button type="button" className={styles.link} onClick={() => { setTrendMetricId(metric.intensityMetricId); openMetricDialog(metric, true, resultView); }}>{isCalculated ? '查看详情' : missingDataActionLabel(metric)}</button></td></tr>; })}</tbody></table></div>
          </section>)}
        </div> : <div className={styles.tableWrap}>
          <table className={styles.comparisonTable}>
            <thead><tr><th>产品</th><th>关联一级用能单元</th>{comparisonMetricNames.map((name) => <th key={name}>{name}</th>)}<th>环比变化</th><th>同比变化</th><th>操作</th></tr></thead>
            <tbody>{comparisonViews.map((resultView) => { const primaryMetric = resultView.metrics.find((metric) => metric.resultType === 'ok') ?? resultView.metrics[0]; const changes = metricChanges(primaryMetric, resultView.object.objectId); return <tr key={resultView.object.objectId}><td>{resultView.object.objectName}</td><td>{primaryMetric.relatedEnergyUnitNames?.join('、') || '—'}</td>{comparisonMetricNames.map((name) => { const metric = resultView.metrics.find((item) => item.name === name && item.resultType === 'ok'); return <td key={name}>{metric ? <><strong>{format(metric.value, metricDigits(metric.value))}</strong><small>{metric.unit}</small></> : '—'}</td>; })}<td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><button type="button" className={styles.link} onClick={() => { setTrendMetricId(primaryMetric.intensityMetricId); openMetricDialog(primaryMetric, true, resultView); }}>{primaryMetric.resultType === 'ok' ? '查看详情' : missingDataActionLabel(primaryMetric)}</button></td></tr>; })}</tbody>
          </table>
        </div>}
        {applied.objectType === 'unit' && unitMetricGroups.length === 0 && <div className={styles.slimNote}><div><i>i</i><span>当前筛选对象暂无适用的能耗指标结果。</span></div></div>}
        {displayedMonthlyMetric && <IntensityMonthlyDetail key={displayedMonthlyMetric.intensityMetricId} metric={displayedMonthlyMetric} year={applied.year} object={metricObjectMap.get(displayedMonthlyMetric.intensityMetricId)} options={trendRows} onChange={setTrendMetricId} getOptionGroup={applied.objectType === 'unit' ? metricGroupFor : undefined} getOptionLabel={(metric) => applied.objectType === 'unit' ? metricObjectMap.get(metric.intensityMetricId)?.objectName ?? view.object.objectName : `${metricObjectMap.get(metric.intensityMetricId)?.objectName ?? view.object.objectName}｜${metric.name}`} />}
      </section>


      <div className={styles.slimNote}>
        <div><i>i</i><span>{applied.objectType === 'product' ? productScopeNote : scopeNote}</span></div>
      </div>
      <EnergyDialog state={dialog} close={() => setDialog(null)} />
      <EnergyToast message={toast} />
    </div>
  );
}

function benchmarkMetricGroup(row: BenchmarkMetric) {
  return row.metricName.includes('单位产品') ? '生产类用能单元' : '非生产类用能单元';
}

function BenchmarkPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const initialParams = new URLSearchParams(search);
  const requestedType = initialParams.get('objectType');
  const initialType: BenchmarkType = requestedType === 'unit' || requestedType === 'product' || requestedType === 'device'
    ? requestedType
    : 'all';
  const initialObjectId = initialType === 'all' ? '' : initialParams.get('objectId') ?? '';
  const initialYear = ['2024', '2025', '2026'].includes(initialParams.get('year') ?? '') ? initialParams.get('year')! : '2026';
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftType, setDraftType] = useState<BenchmarkType>(initialType);
  const [draftObjectId, setDraftObjectId] = useState(initialObjectId);
  const [draftUnitLevel, setDraftUnitLevel] = useState<'all' | 'level1' | 'level2'>(initialType === 'unit' ? 'level1' : 'all');
  const [draftMetricGroup, setDraftMetricGroup] = useState('all');
  const [draftSelectedId, setDraftSelectedId] = useState(initialObjectId ? '' : 'benchmark-enterprise-factory-factory-product-energy');
  const [applied, setApplied] = useState<{
    year: number;
    type: BenchmarkType;
    objectId: string;
    unitLevel: 'all' | 'level1' | 'level2';
  }>({
    year: Number(initialYear),
    type: initialType,
    objectId: initialObjectId,
    unitLevel: initialType === 'unit' ? 'level1' : 'all' as 'all' | 'level1' | 'level2',
  });
  const [selectedId, setSelectedId] = useState(initialObjectId ? '' : 'benchmark-enterprise-factory-factory-product-energy');
  const [dataVersion, setDataVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();

  const dataset = useMemo(() => {
    void dataVersion;
    return buildBenchmarkDataset(applied.year);
  }, [applied.year, dataVersion]);
  const metrics = dataset.rows;
  const draftDataset = useMemo(() => buildBenchmarkDataset(Number(draftYear) || 2026), [draftYear]);
  const draftFilteredRows = (draftType === 'all'
    ? draftDataset.rows.filter((row) => row.objectTypeKey === 'enterprise')
    : draftDataset.rows.filter((row) => row.objectTypeKey === draftType))
    .filter((row) => row.available)
    .filter((row) => draftType !== 'unit' || listIntensityObjects('unit').find((object) => object.objectId === row.objectId)?.unitLevel === 'level1');
  const draftObjects = [...new Map(draftFilteredRows.map((row) => [row.objectId, row])).values()];
  const draftTrendRows = draftType === 'unit' && draftMetricGroup !== 'all'
    ? draftFilteredRows.filter((row) => benchmarkMetricGroup(row) === draftMetricGroup)
    : draftFilteredRows;
  const draftMetricGroups = draftType === 'unit'
    ? [...new Set(draftFilteredRows.map(benchmarkMetricGroup))]
    : [];
  // “全部” follows the intensity page's factory scope; it is not an
  // aggregation of factory, unit, product and device rows.
  const filteredRows = (applied.type === 'all'
    ? metrics.filter((row) => row.objectTypeKey === 'enterprise')
    : metrics.filter((row) => row.objectTypeKey === applied.type))
    .filter((row) => row.available)
    .filter((row) => applied.type !== 'unit' || listIntensityObjects('unit').find((object) => object.objectId === row.objectId)?.unitLevel === 'level1');
  const objects = [...new Map(filteredRows.map((row) => [row.objectId, row])).values()];
  const selected = metrics.find((row) => row.benchmarkMetricId === selectedId && row.available)
    ?? filteredRows.find((row) => !applied.objectId || row.objectId === applied.objectId)
    ?? filteredRows[0]
    ?? metrics[0]
    ?? null;

  const activeObjectId = applied.objectId || objects[0]?.objectId || '';
  const metricRows = applied.type === 'all' ? [] : filteredRows.filter((row) => row.objectId === activeObjectId);
  const noData = filteredRows.length === 0;
  const unavailableReason = applied.type === 'all'
    ? '当前年度没有可用于对标的数据。'
    : dataset.unavailableReasons[applied.type];
  const selectedAvailable = Boolean(selected?.available);
  const monthlyDataAvailable = selected?.monthlyDataStatus === 'complete';
  const displayGrain = monthlyDataAvailable ? 'month' : 'year';
  const targetConfigured = Boolean(selected?.targetConfigured && selected.target > 0);
  const good = selected && targetConfigured ? isBenchmarkGood(selected) : false;
  const deviation = targetConfigured && selected ? (selected.actual - selected.target) / selected.target * 100 : 0;
  const absoluteGap = targetConfigured && selected ? selected.actual - selected.target : 0;
  const monthlyStatuses = selected ? benchmarkMonthlyStatuses(selected) : [];

  const preferredRow = (rows: BenchmarkMetric[], nextType: BenchmarkType) => {
    const usableRows = rows.filter((row) => row.available && row.actual !== null);
    if (nextType === 'all') {
      return usableRows.find((row) => row.metricCode === 'energy_per_product') ?? usableRows[0] ?? rows[0];
    }
    return usableRows[0] ?? rows[0];
  };

  const selectType = (nextType: BenchmarkType) => {
    const nextUnitLevel = nextType === 'unit' ? 'level1' : 'all' as 'all' | 'level1' | 'level2';
    const nextDataset = buildBenchmarkDataset(applied.year);
    const nextRows = nextType === 'all'
      ? nextDataset.rows.filter((row) => row.objectTypeKey === 'enterprise')
      : nextDataset.rows.filter((row) => row.objectTypeKey === nextType);
    const first = preferredRow(nextRows, nextType);
    const nextObjectId = nextType === 'all' ? '' : first?.objectId ?? '';
    const nextSelectedId = nextType === 'all'
      ? preferredRow(nextRows, nextType)?.benchmarkMetricId ?? ''
      : first?.benchmarkMetricId ?? '';
    setDraftType(nextType);
    setDraftYear(String(applied.year));
    setDraftUnitLevel(nextUnitLevel);
    setDraftObjectId(nextObjectId);
    setDraftMetricGroup('all');
    setDraftSelectedId(nextSelectedId);
    setSelectedId(nextSelectedId);
    setApplied({ ...applied, type: nextType, objectId: nextObjectId, unitLevel: nextUnitLevel });
    notify('对标对象类型已切换');
  };

  const applyFilters = () => {
    const nextYear = Number(draftYear) || 2026;
    const nextDataset = buildBenchmarkDataset(nextYear);
    const nextRows = (draftType === 'all'
      ? nextDataset.rows.filter((row) => row.objectTypeKey === 'enterprise')
      : nextDataset.rows.filter((row) => row.objectTypeKey === draftType))
      .filter((row) => draftType !== 'unit' || draftUnitLevel === 'all' || listIntensityObjects('unit').find((object) => object.objectId === row.objectId)?.unitLevel === draftUnitLevel);
    const objectRows = draftType === 'all' ? nextRows : nextRows.filter((row) => row.objectId === draftObjectId);
    const first = objectRows[0] ?? preferredRow(nextRows, draftType);
    const nextObjectId = draftType === 'all' ? '' : first?.objectId ?? draftObjectId;
    const nextSelectedId = nextRows.some((row) => row.benchmarkMetricId === draftSelectedId)
      ? draftSelectedId
      : draftType === 'all'
        ? preferredRow(nextRows, draftType)?.benchmarkMetricId ?? ''
        : first?.benchmarkMetricId ?? '';
    setApplied({ year: nextYear, type: draftType, objectId: nextObjectId, unitLevel: draftUnitLevel });
    setDraftObjectId(nextObjectId);
    setDraftSelectedId(nextSelectedId);
    setSelectedId(nextSelectedId);
    notify('对标筛选条件已应用');
  };

  const openTarget = (targetRow: BenchmarkMetric | null = selected) => {
    if (!targetRow || !targetRow.available) {
      notify('请先补充当前对象的能源或运营数据');
      return;
    }
    let draftTargetValue = roundToTwo(targetRow.target || targetRow.actual);
    let monthlyTargetsEnabled = targetRow.monthlyTargets?.length === 12;
    let draftMonthlyTargets = targetRow.monthlyTargets?.length === 12
      ? targetRow.monthlyTargets.map(roundToTwo)
      : Array.from({ length: 12 }, () => draftTargetValue);
    setDialog({
      title: '指标目标配置',
      body: (
        <div className={styles.modalForm} data-target-form>
          <FilterField label="目标年度"><input value={applied.year} readOnly /></FilterField>
          <FilterField label="对象类型"><input value={targetRow.objectTypeKey === 'unit' ? '一级用能单元' : targetRow.objectType} readOnly /></FilterField>
          <FilterField label="对标对象"><input value={targetRow.objectName} readOnly /></FilterField>
          <FilterField label="指标名称"><input value={targetRow.metricName} readOnly /></FilterField>
          <label className={styles.modalField}><span className={styles.required}>年度目标值（{targetRow.unit}）</span><input aria-label="目标值" required min="0.01" step="0.01" type="number" defaultValue={draftTargetValue.toFixed(2)} onChange={(event) => { draftTargetValue = Number(event.target.value); }} /></label>
          <details className={`${styles.monthlyTargetPanel} ${styles.full}`} open={monthlyTargetsEnabled} onToggle={(event) => { monthlyTargetsEnabled = event.currentTarget.open; }}>
            <summary>配置月度目标（可选）</summary>
            <div className={styles.monthlyTargetToolbar}>
              <span>月度目标用于趋势图和月度达标状态；未配置时默认使用年度目标。</span>
              <button type="button" onClick={(event) => {
                const form = event.currentTarget.closest('[data-target-form]');
                form?.querySelectorAll<HTMLInputElement>('[data-monthly-target]').forEach((input, index) => {
                  input.value = roundToTwo(draftTargetValue).toFixed(2);
                  draftMonthlyTargets[index] = roundToTwo(draftTargetValue);
                });
                monthlyTargetsEnabled = true;
                const panel = event.currentTarget.closest('details');
                if (panel) panel.open = true;
              }}>按年度目标填充</button>
            </div>
            <div className={styles.monthlyTargetGrid}>
              {draftMonthlyTargets.map((value, index) => (
                <label key={index}>
                  <span>{index + 1}月</span>
                  <input
                    aria-label={`${index + 1}月目标`}
                    data-monthly-target
                    min="0.01"
                    step="0.01"
                    type="number"
                    defaultValue={roundToTwo(value).toFixed(2)}
                    onChange={(event) => {
                      draftMonthlyTargets[index] = Number(event.target.value);
                      monthlyTargetsEnabled = true;
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          <div className={`${styles.modalNote} ${styles.full}`}>年度目标用于年度结果判断；月度趋势默认以年度目标绘制水平参考线，配置月度目标后将优先展示月度目标线。</div>
        </div>
      ),
      submitText: '保存配置',
      onSubmit: () => {
        const value = roundToTwo(draftTargetValue);
        if (Number.isFinite(value) && value > 0) {
          let monthlyTargets: number[] | undefined;
          if (monthlyTargetsEnabled) {
            if (!draftMonthlyTargets.every((target) => Number.isFinite(target) && target > 0)) {
              notify('请完整填写 12 个月目标值');
              return false;
            }
            monthlyTargets = draftMonthlyTargets.map(roundToTwo);
          }
          saveBenchmarkTarget({
            objectType: targetRow.objectTypeKey,
            objectId: targetRow.objectId,
            metricCode: targetRow.metricCode,
            year: applied.year,
            energyUnitId: targetRow.objectTypeKey === 'unit' ? targetRow.energyUnitId : null,
            value,
            metricName: targetRow.metricName,
            unit: targetRow.unit,
            monthlyTargets,
          });
          setDataVersion((current) => current + 1);
          notify('指标目标值已保存');
        }
      },
    });
  };

  const openBasis = () => {
    if (!selected) return;
    const isDevice = selected.objectTypeKey === 'device';
    const numerator = selected.numeratorDescription ?? selected.energyScopeDescription;
    const denominator = selected.denominatorDescription ?? selected.outputScopeDescription;
    setDialog({
      title: '指标口径与计算说明',
      body: (
        <div className={styles.basisDialog}>
          <section className={styles.basisSection}>
            <h4>基本信息</h4>
            <div className={styles.basisInfoGrid}>
              <div><span>指标对象</span><strong>{selected.objectName}</strong></div>
              <div><span>{isDevice ? '所属用能单元' : '统计范围'}</span><strong>{selected.scopeNames.join('、') || (isDevice ? '尚未关联用能单元' : '尚未关联生产单元')}</strong></div>
              <div><span>统计期间</span><strong>{selected.periodDescription}</strong></div>
              <div><span>指标单位</span><strong>{selected.unit}</strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueGrid}>
              <div><span>{isDevice ? '能源消费量' : '综合能源消费量'}</span><strong>{numerator}</strong></div>
              <div><span>{isDevice ? '计算参数' : '产品产量'}</span><strong>{denominator}</strong></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{selected.formulaDescription}</strong>
            {isDevice && <p>设备指标只读取通过稳定设备ID关联的设备级能源记录，不使用所属用能单元总量代替，也不重复计入组织汇总。</p>}
          </section>

          {!isDevice && <section className={styles.basisSection}>
            <h4>口径说明</h4>
            <div className={styles.basisRuleList}>
              <div><span>能源口径</span><strong>{selected.energyScopeDescription}</strong></div>
              <div><span>产量口径</span><strong>{selected.outputScopeDescription}</strong></div>
            </div>
          </section>}
        </div>
      ),
    });
  };

  const goToData = (path: string) => navigate(path);

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard} ${styles.benchmarkFilters}`}>
        <FilterField label="分析年度"><select aria-label="分析年度" value={draftYear} onChange={(event) => setDraftYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select></FilterField>
        <FilterField label="对象类型">
          <span className={styles.objectSegment}>
            {([
              ['all', '全厂'],
              ['unit', '一级用能单元'],
              ['product', '重点产品'],
              ['device', '重点设备'],
            ] as Array<[BenchmarkType, string]>).map(([value, label]) => (
              <button type="button" key={value} className={draftType === value ? styles.active : ''} onClick={() => selectType(value)}>{label}</button>
            ))}
          </span>
        </FilterField>
        <div className={styles.filterSpacer} />
        <div className={styles.benchmarkFilterActions}>
          <EnergyButton primary onClick={applyFilters}>查询</EnergyButton>
          <EnergyButton onClick={() => {
            setDraftYear('2026'); setDraftType('all'); setDraftUnitLevel('all'); setDraftObjectId(''); setDraftMetricGroup('all');
            setApplied({ year: 2026, type: 'all', objectId: '', unitLevel: 'all' });
            setSelectedId('benchmark-enterprise-factory-factory-product-energy'); setDraftSelectedId('benchmark-enterprise-factory-factory-product-energy');
            notify('筛选条件已重置');
          }}>重置</EnergyButton>
        </div>
      </section>

      {noData || !selected ? (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <strong>暂无可计算指标</strong>
          <span>原因：{unavailableReason}</span>
          <small>
            {applied.type === 'device' && '设备对标需要重点设备台账和设备级能源计量记录。'}
            {applied.type === 'product' && '请先维护产品产量、生产单元关系及必要的能源分摊规则。'}
            {applied.type === 'unit' && '请确保用能单元在同一年度具备能源消费和运营数据。'}
          </small>
          {applied.type === 'device' && <div className={styles.emptyActions}><EnergyButton primary onClick={() => goToData('/data-management/devices')}>新增重点设备</EnergyButton></div>}
        </section>
      ) : (
        <>
          {selectedAvailable ? <>
            <section className={`${styles.card} ${styles.benchmarkSummary}`} aria-label="指标摘要">
              <div><span>当前值</span><strong>{format(selected.actual, metricDigits(selected.actual))}<small>{selected.unit}</small></strong></div>
              <div className={styles.benchmarkTargetSummaryItem}><span>目标值</span><strong>{targetConfigured ? <>{format(selected.target, metricDigits(selected.target))}<small>{selected.unit}</small></> : '未配置目标'}</strong><button type="button" className={styles.summaryAction} aria-label="指标目标配置" onClick={() => openTarget()}>{targetConfigured ? '调整目标' : '配置目标'}</button></div>
              <div><span>差距</span><strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? <>{absoluteGap > 0 ? '+' : ''}{format(absoluteGap, metricDigits(Math.abs(absoluteGap)))}<small>{selected.unit}</small></> : '—'}</strong></div>
              <div className={styles.benchmarkSummaryDeviation}>
                <span>{'相对偏差'}</span>
                <strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? percent(deviation) : '—'}</strong>
              </div>
              <div><span>对标状态</span><strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? good ? '达标' : '未达标' : '未配置目标'}</strong></div>
            </section>
            <div className={styles.benchmarkMain}>
            <section className={`${styles.card} ${styles.benchmarkChart}`}>
              <div className={styles.benchmarkHead}>
                <div><div className={styles.chartTitle}>实际值与目标值对标（{selected.metricName}）</div><div className={styles.chartSub}>{selected.objectName}｜单位：{selected.unit}｜{selected.direction === 'high' ? '效率类，越高越好' : selected.metricName.includes('能耗') || selected.metricName.includes('消费') ? '能耗强度/能源消费量类，越低越好' : '越低越好'}{monthlyDataAvailable ? '｜真实月度数据' : '｜当前仅按年度对标'}</div></div>
              </div>
              <div className={styles.benchmarkChartControls}>
                <div className={styles.benchmarkLegend} aria-label="对标图例">
                  <span><i className={styles.actualLegend} />实际值</span>
                  <span><i className={styles.targetLegend} />目标值</span>
                </div>
                <div className={styles.benchmarkActions}>
                  {draftType === 'unit' ? <>
                    <FilterField label="指标分类" className={styles.benchmarkMetricSelector}>
                      <select aria-label="指标分类" value={draftMetricGroup} onChange={(event) => {
                        const nextGroup = event.target.value;
                        const nextRows = nextGroup === 'all' ? draftFilteredRows : draftFilteredRows.filter((row) => benchmarkMetricGroup(row) === nextGroup);
                        const nextSelectedId = nextRows[0]?.benchmarkMetricId ?? '';
                        setDraftMetricGroup(nextGroup);
                        setDraftSelectedId(nextSelectedId);
                        setSelectedId(nextSelectedId);
                      }}>
                        <option value="all">全部指标</option>
                        {draftMetricGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="一级用能单元" className={styles.benchmarkMetricSelector}>
                      <select aria-label="一级用能单元" disabled={draftTrendRows.length === 0} value={draftTrendRows.some((row) => row.benchmarkMetricId === draftSelectedId) ? draftSelectedId : draftTrendRows[0]?.benchmarkMetricId ?? ''} onChange={(event) => {
                        const nextSelectedId = event.target.value;
                        setDraftSelectedId(nextSelectedId);
                        setSelectedId(nextSelectedId);
                      }}>
                        {draftTrendRows.length
                          ? draftTrendRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.objectName}</option>)
                          : <option value="">暂无已维护指标</option>}
                      </select>
                    </FilterField>
                  </> : <FilterField label="趋势指标" className={styles.benchmarkMetricSelector}>
                    <select aria-label="趋势指标" disabled={draftFilteredRows.length === 0} value={draftFilteredRows.some((row) => row.benchmarkMetricId === draftSelectedId) ? draftSelectedId : draftFilteredRows[0]?.benchmarkMetricId ?? ''} onChange={(event) => {
                      const nextSelectedId = event.target.value;
                      setDraftSelectedId(nextSelectedId);
                      setSelectedId(nextSelectedId);
                    }}>
                      {draftFilteredRows.length
                        ? draftFilteredRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.objectName}｜{row.metricName}</option>)
                        : <option value="">暂无已维护指标</option>}
                    </select>
                  </FilterField>}
                </div>
              </div>
              <div className={styles.lineChart} dangerouslySetInnerHTML={{ __html: benchmarkLineSvg(selected, displayGrain, applied.year) }} />
              {monthlyStatuses.length > 0 && (
                <div className={styles.monthlyStatusGrid} aria-label="月度达标状态">
                  {monthlyStatuses.map((item) => (
                    <div className={styles.monthlyStatusItem} key={item.month} title={`${item.month}：实际 ${format(item.actual, metricDigits(item.actual))}，目标 ${format(item.target, metricDigits(item.target))}，偏差 ${percent(item.deviation)}`}>
                      <span>{item.month}</span>
                      <StatusTag tone={item.good ? 'ok' : 'bad'}>{item.good ? '达标' : '未达标'}</StatusTag>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {false && <section className={`${styles.card} ${styles.benchmarkInsight}`}>
              <div className={styles.chartTitle}>差距分析</div>
              <div className={styles.benchmarkStatusLine}>
                <StatusTag tone={targetConfigured ? good ? 'ok' : 'bad' : 'warn'}>{targetConfigured ? good ? '达标' : '未达标' : '未配置目标'}</StatusTag>
              </div>
              <div className={styles.gapValue}>
                <span>相对目标偏差</span>
                <strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? percent(deviation) : '—'}</strong>
              </div>
              <dl className={styles.benchmarkFacts}>
                <div><dt>对标对象</dt><dd>{selected.objectName}</dd></div>
                <div><dt>指标名称</dt><dd>{selected.metricName}</dd></div>
                <div><dt>实际与目标差值</dt><dd>{targetConfigured ? `${absoluteGap > 0 ? '+' : ''}${format(absoluteGap, metricDigits(Math.abs(absoluteGap)))} ${selected.unit}` : '未配置年度目标'}</dd></div>
              </dl>
              <div className={targetConfigured && good ? styles.benchmarkGoodNote : styles.benchmarkWarnNote}>
                <strong>{targetConfigured ? good ? '当前指标达到目标要求' : '当前指标与目标仍有差距' : '当前指标尚未配置目标值'}</strong>
                <span>{targetConfigured ? good ? '建议继续跟踪后续期间变化，保持当前管理水平。' : '建议优先核对能源消费与运营数据，并结合趋势识别偏差形成环节。' : '实际数据和趋势已形成，配置年度目标后即可判断达标状态。'}</span>
              </div>
              <div className={styles.benchmarkCompactBasis}>
                <div>
                  <span>计算口径</span>
                  <strong>{selected.objectTypeKey === 'device'
                    ? `当前指标读取${selected.objectName}独立设备能源记录`
                    : `当前指标按${selected.scopeNames.join('、')}中归属于${selected.objectName}的综合能耗，结合同期${selected.objectName}产量计算。｜${selected.allocationDescription}`}</strong>
                </div>
                <EnergyButton outline onClick={openBasis}>查看详情</EnergyButton>
              </div>
            </section>}
            </div>
          </> : <section className={`${styles.card} ${styles.emptyState}`}>
            <strong>暂无可对标指标</strong>
            <span>当前筛选条件下没有已形成能耗指标的数据。</span>
          </section>}
          <section className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.tableToolbar}><div><div className={styles.chartTitle}>{applied.type === 'all' ? '全厂指标对标明细' : applied.type === 'product' ? '全部产品指标对标明细' : applied.type === 'device' ? '设备用能与能效对标明细' : '指标对标明细'}（{applied.year}年）</div><div className={styles.benchmarkRuleNote}>达标规则：能耗强度类指标实际值不高于目标值，效率类指标实际值不低于目标值；能源消费量类按实际值不高于目标值判断。规则依据指标定义方向，未配置目标的指标保留实际值，但不参与达标判断。</div>{applied.type === 'product' && <div className={styles.chartSub}>点击产品行可联动切换上方单产品趋势与口径。</div>}{applied.type === 'device' && <div className={styles.chartSub}>设备消费量来自重点设备独立能源记录；“单位产出能耗”属于能耗强度类，具备运行时长、产量或供气量等分母前不生成该指标。</div>}</div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead>{applied.type === 'device'
                  ? <tr><th>对标对象</th><th>所属用能单元</th><th>指标名称</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>数据完整度</th><th>状态</th><th>操作</th></tr>
                  : <tr><th>对标对象</th><th>对象类型</th><th>指标名称</th><th>单位</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>状态</th><th>操作</th></tr>}</thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const rowGood = isBenchmarkGood(row);
                    const rowDeviation = row.available && row.targetConfigured && row.target > 0 ? (row.actual - row.target) / row.target * 100 : null;
                    const rowStatus = !row.targetConfigured ? '未配置目标' : rowGood ? '达标' : '未达标';
                    return (
                      <tr key={row.benchmarkMetricId} className={row.benchmarkMetricId === selected.benchmarkMetricId ? styles.selectedRow : ''} title={row.available ? '' : row.unavailableReason} onClick={() => {
                        setSelectedId(row.benchmarkMetricId); setDraftSelectedId(row.benchmarkMetricId); setDraftObjectId(row.objectId);
                      }}>
                        {applied.type === 'device' ? <>
                          <td>{row.objectName}</td><td>{row.scopeNames.join('、') || '—'}</td><td>{row.metricName}</td>
                          <td>{row.available ? `${format(row.actual, metricDigits(row.actual))} ${row.unit}` : '—'}</td><td>{row.targetConfigured ? `${format(row.target, metricDigits(row.target))} ${row.unit}` : '—'}</td>
                          <td className={rowDeviation === null ? '' : rowGood ? styles.down : styles.up}>{rowDeviation === null ? '—' : percent(rowDeviation)}</td><td>{row.dataCompleteness ?? '—'}</td>
                          <td><StatusTag tone={!row.targetConfigured ? 'warn' : rowGood ? 'ok' : 'bad'}>{rowStatus}</StatusTag></td>
                          <td><button type="button" className={styles.link} onClick={(event) => { event.stopPropagation(); setSelectedId(row.benchmarkMetricId); setDraftSelectedId(row.benchmarkMetricId); openTarget(row); }}>{row.targetConfigured ? '调整目标' : '配置目标'}</button></td>
                        </> : <>
                          <td>{row.objectName}</td><td>{row.objectTypeKey === 'unit' ? '一级用能单元' : row.objectType}</td><td>{row.metricName}</td><td>{row.unit}</td>
                          <td>{format(row.actual, metricDigits(row.actual))}</td><td>{row.targetConfigured ? format(row.target, metricDigits(row.target)) : '—'}</td>
                          <td className={rowGood ? styles.down : styles.up}>{rowDeviation === null ? '—' : percent(rowDeviation)}</td>
                          <td><StatusTag tone={row.targetConfigured ? rowGood ? 'ok' : 'bad' : 'warn'}>{rowStatus}</StatusTag></td>
                          <td><button type="button" className={styles.link} onClick={(event) => { event.stopPropagation(); setSelectedId(row.benchmarkMetricId); setDraftSelectedId(row.benchmarkMetricId); openTarget(row); }}>{row.targetConfigured ? '调整目标' : '配置目标'}</button></td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <EnergyDialog state={dialog} close={() => setDialog(null)} />
      <EnergyToast message={toast} />
    </div>
  );
}

function isBenchmarkGood(row: BenchmarkMetric) {
  return row.available && row.target > 0
    && (row.direction === 'high' ? row.actual >= row.target : row.actual <= row.target);
}

function benchmarkMonthlyStatuses(row: BenchmarkMetric) {
  if (!row.available || row.monthlyDataStatus !== 'complete' || row.monthlyTargets?.length !== 12 || !row.targetConfigured) return [];
  return row.monthlyTargets.map((target, index) => {
    const actual = row.monthlyMetrics?.[index]?.actual;
    if (actual === null || actual === undefined) return null;
    const deviation = target > 0 ? (actual - target) / target * 100 : 0;
    return {
      month: `${index + 1}月`,
      actual,
      target,
      deviation,
      good: row.direction === 'high' ? actual >= target : actual <= target,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

function benchmarkLineSvg(row: BenchmarkMetric, grain: 'month' | 'quarter' | 'year', year: number) {
  const hasMonthlyTrend = row.monthlyDataStatus === 'complete' && row.trend.length === 12;
  let values = hasMonthlyTrend ? [...row.trend] : [row.actual];
  let targetValues: number[] | null = hasMonthlyTrend && row.targetConfigured
    ? row.monthlyTargets?.length === 12
      ? [...row.monthlyTargets]
      : Array.from({ length: 12 }, () => row.target)
    : null;
  let targetLabel = row.monthlyTargets?.length === 12 ? '月度目标' : '年度目标';
  let labels = hasMonthlyTrend ? values.map((_, index) => `${index + 1}月`) : [`${year}年度`];
  if (grain === 'quarter' && hasMonthlyTrend) {
    const aggregateQuarter = (source: number[]) => [0, 1, 2, 3].map((quarter) => {
      const quarterValues = source.slice(quarter * 3, quarter * 3 + 3);
      const total = quarterValues.reduce((sum, value) => sum + value, 0);
      return row.objectTypeKey === 'device' ? total : total / Math.max(quarterValues.length, 1);
    });
    values = aggregateQuarter(values);
    targetValues = targetValues ? aggregateQuarter(targetValues) : null;
    labels = ['一季度', '二季度', '三季度', '四季度'];
  } else if (grain === 'year' || !hasMonthlyTrend) {
    values = [row.actual];
    targetValues = row.targetConfigured ? [row.target] : null;
    targetLabel = '年度目标';
    labels = [`${year}年`];
  }
  const width = 1120;
  const height = 260;
  const padding = { left: 55, right: 36, top: 28, bottom: 46 };
  const scaleValues = targetValues ? [...values, ...targetValues] : values;
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);
  const span = max - min || 1;
  const low = min - span * 0.12;
  const high = max + span * 0.12;
  const x = (index: number) => values.length === 1 ? width / 2 : padding.left + index * (width - padding.left - padding.right) / (values.length - 1);
  const y = (value: number) => padding.top + (high - value) * (height - padding.top - padding.bottom) / (high - low);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const grid = [0, 0.25, 0.5, 0.75, 1].map((tick) => {
    const lineY = padding.top + tick * (height - padding.top - padding.bottom);
    const value = high - tick * (high - low);
    return `<line x1="${padding.left}" y1="${lineY}" x2="${width - padding.right}" y2="${lineY}" stroke="#E5EAF0" stroke-dasharray="4 4"/><text x="4" y="${lineY + 4}" font-size="11" fill="#8A94A3">${format(value, row.unit === '%' ? 1 : row.actual < 1 ? 3 : 1)}</text>`;
  }).join('');
  const targetPoints = targetValues?.map((value, index) => `${x(index)},${y(value)}`).join(' ') ?? '';
  const isFlatTarget = Boolean(targetValues?.length && targetValues.every((value) => value === targetValues[0]));
  const targetGraphic = targetValues
    ? targetValues.length === 1
      ? `<line x1="${padding.left}" y1="${y(targetValues[0])}" x2="${width - padding.right}" y2="${y(targetValues[0])}" stroke="#00A870" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${width - padding.right - 4}" y="${y(targetValues[0]) - 7}" text-anchor="end" font-size="10" fill="#00875A">${targetLabel} ${format(targetValues[0], metricDigits(targetValues[0]))}</text>`
      : isFlatTarget
        ? `<line x1="${padding.left}" y1="${y(targetValues[0])}" x2="${width - padding.right}" y2="${y(targetValues[0])}" stroke="#00A870" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${width - padding.right - 4}" y="${y(targetValues[0]) - 7}" text-anchor="end" font-size="10" fill="#00875A">${targetLabel} ${format(targetValues[0], metricDigits(targetValues[0]))}</text>`
      : `<polyline points="${targetPoints}" fill="none" stroke="#00A870" stroke-width="1.5" stroke-dasharray="6 5"/>${targetValues.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="#fff" stroke="#00A870" stroke-width="1.5"/>`).join('')}`
    : '';
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="指标趋势图">${grid}${targetGraphic}${values.length > 1 ? `<polyline points="${points}" fill="none" stroke="#1677FF" stroke-width="2.2" stroke-dasharray="7 5"/>` : ''}${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="#fff" stroke="#1677FF" stroke-width="1.7"/><text x="${x(index)}" y="${y(value) - 10}" text-anchor="middle" font-size="10" fill="#365A7A">${format(value, metricDigits(value))}</text><text x="${x(index)}" y="${height - 15}" text-anchor="middle" font-size="10" fill="#667085">${labels[index]}</text>`).join('')}</svg>`;
}

type FlowTab = 'diagram' | 'balance';
type FlowHoverState = { nodeId: string; x: number; y: number } | null;

function downloadFlowCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportEnergyBalance(data: FlowAnalysisDataset, scopeLabel: string) {
  downloadFlowCsv(`能源平衡表_${scopeLabel}.csv`, energyBalanceCsvRows(data.levelOneBalanceRows, scopeLabel));
}

function FlowAnalysisPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const initialParams = new URLSearchParams(search);
  const initialYear = ['2024', '2025', '2026'].includes(initialParams.get('year') ?? '') ? initialParams.get('year')! : '2026';
  const initialGrain = initialParams.get('grain') === 'year' ? 'year' as const : 'month' as const;
  const requestedMonth = Number(initialParams.get('month'));
  const initialMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? String(requestedMonth) : '6';
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftGrain, setDraftGrain] = useState<'month' | 'year'>(initialGrain);
  const [draftMonth, setDraftMonth] = useState(initialMonth);
  const [applied, setApplied] = useState({
    year: Number(initialYear),
    grain: initialGrain as 'month' | 'year',
    month: Number(initialMonth),
  });
  const [tab, setTab] = useState<FlowTab>('diagram');
  const [selectedNode, setSelectedNode] = useState('');
  const [hoveredNode, setHoveredNode] = useState<FlowHoverState>(null);
  const { toast, notify } = useFeedback();
  const data = useMemo(
    () => buildFlowAnalysisDataset(
      { year: applied.year, grain: applied.grain, month: applied.month },
      'level1',
    ),
    [applied],
  );
  const overviewFlow = useMemo(() => selectFlowRelations(data), [data]);
  const focusedFlow = useMemo(() => selectFlowRelations(data, selectedNode), [data, selectedNode]);
  const selectedNodeData = data.nodes.find((node) => node.nodeId === selectedNode) ?? null;
  const scopedTables = useMemo(() => buildFlowViewTables(data, focusedFlow), [data, focusedFlow]);
  const isScoped = Boolean(selectedNodeData);
  const scopeLabel = selectedNodeData ? selectedNodeData.name + '关联链路' : '全厂';
  const periodScope = `${applied.year}年${applied.grain === 'month' ? applied.month + '月' : '度'}｜${scopeLabel}`;
  const hoveredNodeData = data.nodes.find((node) => node.nodeId === hoveredNode?.nodeId) ?? null;

  const handleSankeyClick = (event: MouseEvent<HTMLDivElement>) => {
    setHoveredNode(null);
    const node = (event.target as Element).closest<SVGGElement>('g[data-key]');
    if (!node) {
      setSelectedNode('');
      return;
    }
    setSelectedNode((current) => current === node.dataset.key ? '' : node.dataset.key ?? '');
  };

  const handleSankeyHover = (event: MouseEvent<HTMLDivElement>) => {
    const node = (event.target as Element).closest<SVGGElement>('g[data-key]');
    if (!node?.dataset.key) {
      setHoveredNode(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 230;
    setHoveredNode({
      nodeId: node.dataset.key,
      x: Math.max(12, Math.min(event.clientX - rect.left + 14, rect.width - tooltipWidth - 12)),
      y: Math.max(42, event.clientY - rect.top - 16),
    });
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard} ${styles.flowFilters}`}>
        <FilterField label="分析年度">
          <select aria-label="分析年度" value={draftYear} onChange={(event) => setDraftYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select>
        </FilterField>
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={draftGrain} onChange={(event) => setDraftGrain(event.target.value as 'month' | 'year')}>
            <option value="month">月度</option>
            <option value="year">年度</option>
          </select>
        </FilterField>
        {draftGrain === 'month' && (
          <FilterField label="月份">
            <select aria-label="月份" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}
            </select>
          </FilterField>
        )}
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => {
          setApplied({
            year: Number(draftYear) || 2026,
            grain: draftGrain,
            month: Number(draftMonth),
          });
          setSelectedNode('');
          notify('已按当前期间重新生成全厂能源流向');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026');
          setDraftGrain('month');
          setDraftMonth('6');
          setApplied({ year: 2026, grain: 'month', month: 6 });
          setTab('diagram');
          setSelectedNode('');
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.flowSummary}`}>
        <ClosedLoopFlowStat icon="⇥" label="能源输入量" value={data.inputStandardCoalAmount} unit="tce" />
        <ClosedLoopFlowStat
          icon="✓"
          label={data.internalMetricLabel}
          value={data.utilizationStandardCoalAmount}
          unit="tce"
          note={data.externalStandardCoalAmount > 0 ? `外部输出 ${format(data.externalStandardCoalAmount, 1)} tce` : undefined}
        />
        <ClosedLoopFlowStat
          icon="!"
          label={data.differenceMetricLabel}
          value={data.differenceStandardCoalAmount}
          unit="tce"
          orange
        />
        <ClosedLoopFlowStat
          icon="↻"
          label="转换折标差额"
          value={data.conversionLossStandardCoalAmount}
          unit="tce"
          digits={1}
          orange={data.conversionLossStandardCoalAmount > 0}
          note={data.confirmedConversionLossStandardCoalAmount > 0 ? `已确认转换损失 ${format(data.confirmedConversionLossStandardCoalAmount, 1)} tce` : undefined}
        />
      </section>

      <section className={`${styles.card} ${styles.flowMain}`}>
        <div className={styles.flowTabs}>
          <div>
            <button type="button" className={tab === 'diagram' ? styles.active : ''} onClick={() => setTab('diagram')}>能流图</button>
            <button type="button" className={tab === 'balance' ? styles.active : ''} onClick={() => setTab('balance')}>能源平衡表</button>
          </div>
          <div className={styles.flowHeadActions}>
            {selectedNodeData ? <>
              <span className={styles.flowScopeLabel}>已选：<strong>{selectedNodeData.name}</strong></span>
              <button type="button" className={styles.link} onClick={() => { setSelectedNode(''); setHoveredNode(null); }}>清除选择</button>
            </> : <span className={styles.flowScopeLabel}>点击节点查看相关流向</span>}
          </div>
        </div>

        {tab === 'diagram' && (
          <>
            <div className={styles.flowLegend}>
              <span><i style={{ background: '#1677FF' }} />企业边界输入</span>
              <span><i style={{ background: '#F79009' }} />能源转换</span>
              <span><i style={{ background: '#00A870' }} />厂内可供分配能源</span>
              <span><i style={{ background: '#00AD83' }} />一级用能单元</span>
              <span><i style={{ background: '#F9AB00' }} />能源回收与循环利用</span>
              <span><i style={{ border: '2px dashed #00A870', background: 'transparent' }} />回收能源回流</span>
              {overviewFlow.nodes.some((node) => node.stage === 'external') && <span><i style={{ background: '#8547FF' }} />企业边界输出</span>}
              <span><i style={{ background: '#98A2B3' }} />未分配</span>
            </div>
            {data.dataNotice && (
              <div className={styles.flowDataNotice}>
                <span>! {data.dataNotice}</span>
              </div>
            )}
            <div
              className={styles.sankeyWrap}
              onClick={handleSankeyClick}
              onMouseMove={handleSankeyHover}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {data.nodes.length > 0
                ? <div dangerouslySetInnerHTML={{ __html: closedLoopFlowSankeySvg({ ...data, ...overviewFlow }, selectedNode, focusedFlow) }} />
                : (
                  <div className={styles.emptyState}>
                    <strong>暂无可展示的能源流向</strong>
                    <span>请先在数据管理中维护当前范围对应层级的能源记录。</span>
                  </div>
                )}
              {hoveredNodeData && hoveredNode && (
                <div className={styles.flowNodeTooltip} role="tooltip" style={{ left: hoveredNode.x, top: hoveredNode.y }}>
                  <strong>{hoveredNodeData.name}</strong>
                  <span>{hoveredNodeData.nodeType}</span>
                  <span>{hoveredNodeData.valueLabel}</span>
                  {hoveredNodeData.sourceLabel && <span>{hoveredNodeData.sourceLabel}</span>}
                  {hoveredNodeData.detailLabel && <span>{hoveredNodeData.detailLabel}</span>}
                  {hoveredNodeData.detailLabelSecondary && <span>{hoveredNodeData.detailLabelSecondary}</span>}
                  <span>占全厂当前去向 {format(hoveredNodeData.share, 1)}%</span>
                </div>
              )}
            </div>
            <div className={`${styles.flowMethodNote} ${styles.flowDiagramNote}`}>
              <div className={styles.flowReadingHeader}>
                <div className={styles.flowNoteTitle}>能流口径说明</div>
                <span>读图时重点关注最终去向和异常差额</span>
              </div>
              <div className={styles.flowReadingItems}>
                <span className={styles.flowReadingItem}><i className={styles.available} />厂内可供分配：进入厂内能源池、可继续分配或直接外供的能源</span>
                <span className={styles.flowReadingItem}><i className={styles.external} />外部输出：供给企业外部的能源</span>
                <span className={styles.flowReadingItem}><i className={styles.unallocated} />未分配：扣除一级分配和直接外供后暂未归属的差额</span>
                <span className={styles.flowReadingItem}><i className={styles.overAllocated} />超分配：去向超过可供量，需核查</span>
                <span className={styles.flowReadingItem}><i className={styles.conversion} />转换折标差额：转换投入与产出的折标差额</span>
              </div>
              <details className={styles.flowCalculationDetails}>
                <summary>查看计算关系</summary>
                <div className={styles.flowFormulaRow}>
                  <span>平衡校验</span>
                  <code>外部输入 + 内部回收 + 转换产出 = 转换投入 + 一级分配 + 外部输出 + 已确认转换损失 + 未分配</code>
                </div>
                <div className={styles.flowCalculationText}>
                  图中厂内可供分配能源展示外供前可供量，包含厂内净可供量及转换外供量；外供从能源池以紫色支线展示。未分配能源 = 可供分配能源 − 一级分配 − 外部输出，由系统根据平衡关系计算；去向超过可供量时显示超分配。平衡表按能源品种列示完整转换产出与外部输出，核对来源、已登记去向和收支差额。回收能源沿底部虚线返回能源池，带回收标识的节点包含回收产出，同品种能源合并展示，不重复计入企业边界输入。平衡表中的“已确认转换损失”来自转换记录的产出去向，转换折标差额仅用于分析投入与产出的折标差异；未分配和超分配均不代表物理损失。
                </div>
              </details>
              <div className={styles.flowNoteFooter}>单位：tce。卡片展示节点本期总量，连线展示对应关系的登记量；能源池汇总不代表设备与车间之间的专属供能。点击节点在原图突出关联流向；能源平衡表按所选链路联动，顶部指标为全厂汇总。</div>
            </div>
          </>
        )}
        {tab === 'balance' && (isScoped ? (
          <FocusedFlowBalanceTable rows={scopedTables.balanceRows} scopeLabel={periodScope} />
        ) : (
          <ClosedLoopBalanceTable
            data={data}
            onExport={() => {
              exportEnergyBalance(data, periodScope);
              notify('能源平衡表已导出');
            }}
          />
        ))}
      </section>
      <EnergyToast message={toast} />
    </div>
  );
}

function ClosedLoopFlowStat({
  icon,
  label,
  value,
  unit,
  orange,
  digits = 0,
  note,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  orange?: boolean;
  digits?: number;
  note?: string;
}) {
  return (
    <div className={styles.flowStat}>
      <i>{icon}</i>
      <div>
        <span>{label}</span>
        <strong className={orange ? styles.orangeText : ''}>{format(value, digits)}<small>{unit}</small></strong>
        {note && <small className={styles.flowStatNote}>{note}</small>}
      </div>
    </div>
  );
}

function FocusedFlowBalanceTable({ rows, scopeLabel }: { rows: FlowNodeBalanceRow[]; scopeLabel: string }) {
  const value = (amount: number | null) => amount === null ? '—' : formatBalanceAmount(amount);
  return <div className={styles.balanceCard}>
    <div className={styles.balanceHead}>
      <div>
        <div className={styles.chartTitle}>能源平衡表｜{scopeLabel}</div>
        <div className={styles.balanceCaption}>按当前链路逐节点核对，单位：tce。流入、流出只统计图中显示的连线。</div>
      </div>
      <EnergyButton onClick={() => downloadFlowCsv(`能源平衡表_${scopeLabel}.csv`, [
        ['范围', scopeLabel], ['节点', '节点类型', '本视图流入（tce）', '本视图流出（tce）', '折标差额（tce）', '核对说明'],
        ...rows.map((row) => [row.name, row.nodeType, row.incoming, row.outgoing, row.difference ?? '—', row.note]),
      ])}>⇩ 导出能源平衡表</EnergyButton>
    </div>
    <div className={styles.tableWrap}>
      <table className={styles.flowDetailTable} aria-label="当前链路能源平衡表">
        <thead><tr><th>节点</th><th>节点类型</th><th>本视图流入（tce）</th><th>本视图流出（tce）</th><th>折标差额（tce）</th><th>核对说明</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.nodeId}>
          <td>{row.name}</td><td>{row.nodeType}</td><td>{value(row.incoming)}</td><td>{value(row.outgoing)}</td><td>{value(row.difference)}</td><td>{row.note}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length === 0 && <div className={styles.emptyState}>当前范围暂无能源流向</div>}
    <div className={styles.flowMethodNote}>仅在节点收支完整且可比较时显示折标差额。未展开的来源或去向、用能单元及边界节点显示“—”，不据此判定损失或超分配。不同节点之间存在能源传递，不重复累加为企业总量。</div>
  </div>;
}

function ClosedLoopBalanceTable({
  data,
  onExport,
}: {
  data: FlowAnalysisDataset;
  onExport: () => void;
}) {
  const value = (amount: number) => amount ? format(amount, amount < 10 ? 2 : 1) : '—';
  const levelOneStatus = (row: FlowAnalysisDataset['levelOneBalanceRows'][number]) => {
    if (row.status === '存在未分配') return { label: '存在未归属', tone: 'warn' as const };
    if (row.status === '一级分配超出可用量') return { label: '待核验', tone: 'bad' as const };
    const hasConversion = row.conversionInputStandardAmount > 0 || row.conversionOutputStandardAmount > 0;
    return { label: hasConversion ? '转换已平衡' : '已平衡', tone: 'ok' as const };
  };
  const levelTwoStatus = (status: FlowAnalysisDataset['levelTwoBalanceRows'][number]['status']) => {
    if (status === '待分解') return { label: '待细分', tone: 'warn' as const };
    if (status === '层级异常') return { label: '待核验', tone: 'bad' as const };
    if (status === '无数据') return { label: '暂无数据', tone: 'check' as const };
    return { label: '已平衡', tone: 'ok' as const };
  };
  if (data.viewLevel === 'level1') {
    return <div className={styles.balanceCard}>
      <div className={`${styles.balanceHead} ${styles.balanceLedgerHeader}`}>
        <div>
          <div className={styles.chartTitle}>能源平衡表</div>
          <div className={styles.balanceCaption}>按能源品种核对来源、去向与收支差额</div>
        </div>
        <div className={styles.balanceToolbar}><span>单位：吨标准煤（tce）</span><EnergyButton disabled={!data.levelOneBalanceRows.length} onClick={onExport}>⇩ 导出能源平衡表</EnergyButton></div>
      </div>
          <EnergyBalanceLedger data={data} />
    </div>;
  }
  return (
    <div className={styles.balanceCard}>
      <div className={styles.balanceHead}>
        <div>
          <div className={styles.chartTitle}>能源平衡表</div>
          <div className={styles.balanceCaption}>
            {(data.viewLevel as string) === 'level1'
              ? '按能源品种逐行核对：从哪里来、用到哪里、还差多少。单位：吨标准煤（tce）。'
              : '按一级分配量和二级利用量核对能源去向；上下级数据仅作层级核对，不重复计入企业总量。'}
          </div>
        </div>
        <EnergyButton onClick={onExport}>⇩ 导出能源平衡表</EnergyButton>
      </div>
      <div className={styles.tableWrap}>
        {(data.viewLevel as string) === 'level1' ? (
          <table>
            <thead><tr><th>能源品种</th><th>外部输入</th><th>内部回收</th><th>转换投入</th><th>转换产出</th><th>内部分配</th><th>外部输出</th><th>已确认转换损失</th><th>未归属</th><th>超分配</th><th>平衡状态</th></tr></thead>
            <tbody>{data.levelOneBalanceRows.map((row) => {
              const status = levelOneStatus(row);
              return (
                <tr key={row.energyTypeId}>
                  <td>{row.energyTypeName}</td>
                  <td>{value(row.externalInputStandardAmount)}</td>
                  <td>{value(row.internalRecoveryStandardAmount)}</td>
                  <td>{value(row.conversionInputStandardAmount)}</td>
                  <td>{value(row.conversionOutputStandardAmount)}</td>
                  <td>{value(row.distributionStandardAmount)}</td>
                  <td>{value(row.externalOutputStandardAmount)}</td>
                  <td>{value(row.confirmedConversionLossStandardAmount)}</td>
                  <td className={row.unallocatedStandardAmount ? styles.up : ''}>
                    {value(row.unallocatedStandardAmount)}
                  </td>
                  <td className={row.overAllocatedStandardAmount ? styles.up : ''}>{value(row.overAllocatedStandardAmount)}</td>
                  <td><StatusTag tone={status.tone}>{status.label}</StatusTag></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>一级用能单元</th><th>能源品种</th><th>一级分配</th><th>二级利用</th><th>待细分</th><th>平衡状态</th></tr></thead>
            <tbody>{data.levelTwoBalanceRows.map((row) => {
              const status = levelTwoStatus(row.status);
              return (
                <tr key={row.rowId}>
                  <td>{row.level1EnergyUnitName}</td>
                  <td>{row.energyTypeName}</td>
                  <td>{value(row.distributionStandardAmount)}</td>
                  <td className={row.status === '层级异常' ? styles.up : ''}>
                    {value(row.utilizationStandardAmount)}
                    {row.overAllocatedStandardAmount > 0 && <small>超出 {format(row.overAllocatedStandardAmount, 1)}</small>}
                  </td>
                  <td className={row.pendingStandardAmount ? styles.up : ''}>
                    {value(row.pendingStandardAmount)}
                  </td>
                  <td><StatusTag tone={status.tone}>{status.label}</StatusTag></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      <div className={styles.flowMethodNote}>
        {(data.viewLevel as string) === 'level1'
          ? '平衡关系：外部输入 + 内部回收 + 转换产出 = 转换投入 + 内部分配 + 外部输出 + 已确认转换损失 + 未归属。转换折标差额按各转换关系的投入与产出另行分析，不参与平衡表闭合。'
          : '层级关系：一级分配量 = 二级利用量 + 待细分量。二级利用超过一级分配时提示核验，不生成负值流向。'}
      </div>
    </div>
  );
}

function EnergyBalanceLedger({ data }: { data: FlowAnalysisDataset }) {
  const { rows, totals, totalStatus } = buildEnergyBalanceTable(data.levelOneBalanceRows);
  const amountCell = (amount: number) => roundedBalanceAmount(amount) === 0 ? '—' : formatBalanceAmount(amount);
  const differenceClass = (status: string) => status === '超分配' ? styles.balanceExcess : status === '待分配' || status === '分项待核对' ? styles.balancePending : styles.balanceMatched;
  const renderDifference = (difference: number, status: string) => (
    <td className={`${styles.balanceResult} ${differenceClass(status)}`}>
      <div className={styles.balanceResultContent}><strong>{formatBalanceAmount(difference, true)}</strong><span>{status}</span></div>
    </td>
  );
  if (!rows.length) return <div className={styles.emptyState}><strong>暂无可核对的能源数据</strong><span>{data.dataNotice || '请先维护当前期间的能源消费与转换数据。'}</span></div>;
  return (
    <>
      {data.dataNotice && <div className={styles.flowDataNotice}>{data.dataNotice}</div>}
      <div className={`${styles.tableWrap} ${styles.balanceTableFrame}`}>
        <table className={styles.energyBalanceTable} aria-label="全厂能源平衡表">
          <colgroup><col className={styles.balanceEnergyColumn} /><col span={5} /><col className={styles.balanceConsumptionColumn} /><col span={3} /><col className={styles.balanceDifferenceColumn} /></colgroup>
          <thead>
            <tr className={styles.balanceGroupHead}>
              <th rowSpan={2} scope="col">能源品种</th>
              <th colSpan={4} scope="colgroup" className={styles.balanceSourceHead}>能源来源</th>
              <th colSpan={5} scope="colgroup" className={styles.balanceUseHead}>已登记去向</th>
              <th rowSpan={2} scope="col" className={styles.balanceResultHead}>收支差额<span>来源 − 去向</span></th>
            </tr>
            <tr>
              {balanceSourceColumns.map((column) => <th key={column.key} scope="col" title={column.note}>{column.label}</th>)}
              <th scope="col" className={styles.balanceSubtotal}>来源合计</th>
              {balanceUseColumns.map((column) => <th key={column.key} scope="col" title={column.note}>{column.label}</th>)}
              <th scope="col" className={styles.balanceSubtotal}>去向合计</th>
            </tr>
          </thead>
          <tbody>{rows.map((row) => <tr key={row.energyTypeId}>
            <th scope="row">{row.energyTypeName}</th>
            {balanceSourceColumns.map((column) => <td key={column.key}>{amountCell(row[column.key])}</td>)}
            <td className={styles.balanceSubtotal}>{formatBalanceAmount(row.sourceTotal)}</td>
            {balanceUseColumns.map((column) => <td key={column.key}>{amountCell(row[column.key])}</td>)}
            <td className={styles.balanceSubtotal}>{formatBalanceAmount(row.useTotal)}</td>
            {renderDifference(row.difference, row.status)}
          </tr>)}</tbody>
          <tfoot><tr className={styles.balanceTotalRow}>
            <th scope="row">分项合计</th>
            {totals.sourceValues.map((amount, index) => <td key={balanceSourceColumns[index].key}>{amountCell(amount)}</td>)}
            <td>{formatBalanceAmount(totals.sourceTotal)}</td>
            {totals.useValues.map((amount, index) => <td key={balanceUseColumns[index].key}>{amountCell(amount)}</td>)}
            <td>{formatBalanceAmount(totals.useTotal)}</td>
            {renderDifference(totals.difference, totalStatus)}
          </tr></tfoot>
        </table>
      </div>
      <section className={styles.balanceDefinitions} aria-label="能源平衡口径说明">
        <div className={styles.balanceDefinitionHeader}>
          <h3>口径说明</h3>
          <p>“回收蒸汽”是能源品种；“过程回收、转换产出”是来源环节，分别在表内核对。</p>
        </div>
        <dl className={styles.balanceDefinitionGrid}>
          <div><dt>过程回收</dt><dd>生产过程中回收的余热、余压等，进入回收装置时同时列入“转换投入”。</dd></div>
          <div><dt>转换产出</dt><dd>发电、供汽、空压及回收装置产出的能源。例如余热回收产汽，余热和蒸汽各自按品种核对。</dd></div>
          <div><dt>已确认损失</dt><dd>仅取台账已登记的转换损失；未填报不代表零损失，顶部“转换折标差额”不在此重复计入。</dd></div>
        </dl>
        <div className={styles.balanceAccountingNotes}>
          <p><strong>差额判断</strong><span>正值待分配，负值超分配，均不直接代表物理损失；不同能源的正负差额分别核对。</span></p>
          <p><strong>合计与精度</strong><span>合计包含厂内转换与回收，不等同于外购量或综合能耗。按未舍入数据汇总，显示值相加可能存在尾差；“—”表示零或不足两位小数的显示精度。</span></p>
        </div>
        <p className={styles.balanceScopeNote}>本表用于企业内部能源收支与分配核对；差额按两位小数提示，不作为计量允差或正式标准报表的合格判定。</p>
      </section>
    </>
  );
}

function closedLoopFlowSankeySvg(
  data: Pick<FlowAnalysisDataset, 'nodes' | 'links' | 'viewLevel' | 'viewName'>,
  selected: string,
  related: Pick<FlowAnalysisDataset, 'nodes' | 'links'>,
) {
  const relatedNodes = new Set(related.nodes.map((node) => node.nodeId));
  const relatedLinks = new Set(related.links.map((link) => link.linkId));
  const branchGap = data.nodes.some((node) => node.stage === 'external') ? 0 : 204;
  const stageX = data.viewLevel === 'level1'
    ? new Map<string, number>([['input', 24], ['conversion', 270], ['medium', 520], ['external', 752], ['distribution', 970], ['recovery', 1220], ['unallocated', 970]])
    : new Map<string, number>([['input', 24], ['conversion', 270], ['medium', 520], ['external', 752], ['distribution', 970], ['utilization', 1220], ['recovery', 1470], ['pending', 1220]]);
  stageX.forEach((x, stage) => { if (x >= 970) stageX.set(stage, x - branchGap); });
  const chartWidth = (data.viewLevel === 'level1' ? 1450 : 1700) - branchGap;
  const externalX = stageX.get('external')!;
  const returnLabelX = ((stageX.get('medium') ?? 24) + chartWidth - 286) / 2;
  const stageColors: Record<string, string> = {
    input: '#1677FF',
    conversion: '#F79009',
    recovery: '#F9AB00',
    medium: '#00A870',
    distribution: '#00AD83',
    utilization: '#45B36B',
    external: '#8547FF',
    unallocated: '#98A2B3',
    pending: '#98A2B3',
  };
  const nodeWidth = 198;
  const compactNodeHeight = 64;
  const nodeGap = 14;
  const nodeWidthFor = (node: FlowAnalysisDataset['nodes'][number]) => node.stage === 'external' ? 150 : nodeWidth;
  const recoveryTargets = new Set(data.links.filter((link) => link.flowType === 'recovery_output').map((link) => link.targetNodeId));
  // Wrap labels within the card while retaining the full value in the tooltip.
  const wrapText = (value: string, maxWidth: number, fontSize: number) => {
    const lines: string[] = [];
    let line = '';
    let width = 0;
    for (const character of value) {
      const characterWidth = character.codePointAt(0)! > 255 ? fontSize : fontSize * .58;
      if (line && width + characterWidth > maxWidth) { lines.push(line); line = ''; width = 0; }
      line += character;
      width += characterWidth;
    }
    if (line) lines.push(line);
    return lines;
  };
  const labels = new Map(data.nodes.map((node) => {
    const width = nodeWidthFor(node) - 28;
    const title = wrapText(node.name, width - (recoveryTargets.has(node.nodeId) ? 20 : 0), 16);
    const details = [node.sourceLabel, node.valueLabel, node.detailLabel, ...(node.detailLabelSecondary?.split('｜') ?? [])]
      .filter((line): line is string => Boolean(line)).flatMap((line) => wrapText(line, width, 13));
    return [node.nodeId, { title, details }];
  }));
  const columnOrder = data.viewLevel === 'level1'
    ? [['input'], ['conversion'], ['medium'], ['distribution', 'unallocated'], ['recovery']]
    : [['input'], ['conversion'], ['medium'], ['distribution'], ['utilization', 'pending'], ['recovery']];
  const grouped = columnOrder.map((stages) => data.nodes.filter((node) => stages.includes(node.stage)));
  const nodeHeightFor = (node: FlowAnalysisDataset['nodes'][number]) => {
    const label = labels.get(node.nodeId)!;
    const minimum = node.stage === 'conversion' || node.stage === 'recovery' ? 138 : node.stage === 'medium' ? 56 : compactNodeHeight;
    return Math.max(minimum, 22 + label.title.length * 22 + label.details.length * 19);
  };
  const maxContentHeight = Math.max(
    ...grouped.map((nodes) => nodes.reduce((total, node) => total + nodeHeightFor(node), 0) + Math.max(nodes.length - 1, 0) * nodeGap),
    1,
  );
  const externalNodes = data.nodes.filter((node) => node.stage === 'external');
  const externalContentHeight = externalNodes.reduce((total, node) => total + nodeHeightFor(node) + nodeGap, 0);
  const height = Math.max(690, maxContentHeight + 170, externalContentHeight + 170);
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes) => {
    const startY = 94;
    let currentY = startY;
    nodes.forEach((node) => {
      positions.set(node.nodeId, { x: stageX.get(node.stage) ?? 0, y: currentY });
      currentY += nodeHeightFor(node) + nodeGap;
    });
  });
  let externalY = 76;
  externalNodes.forEach((node) => {
    positions.set(node.nodeId, { x: externalX + 10, y: externalY });
    externalY += nodeHeightFor(node) + nodeGap;
  });
  const nodesById = new Map(data.nodes.map((node) => [node.nodeId, node]));
  const maxLink = Math.max(...data.links.map((link) => link.standardCoalAmount), 1);
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
  const links = data.links.map((link) => {
    const source = positions.get(link.sourceNodeId);
    const target = positions.get(link.targetNodeId);
    if (!source || !target || link.standardCoalAmount <= 0) return '';
    const x1 = source.x + nodeWidthFor(nodesById.get(link.sourceNodeId)!);
    const y1 = source.y + nodeHeightFor(nodesById.get(link.sourceNodeId)!) / 2;
    const x2 = target.x;
    const y2 = target.y + nodeHeightFor(nodesById.get(link.targetNodeId)! ) / 2;
    const middle = (x1 + x2) / 2;
    const width = Math.max(3, Math.min(26, Math.sqrt(link.standardCoalAmount / maxLink) * 26));
    const active = selected ? relatedLinks.has(link.linkId) ? ' active' : ' muted' : '';
    const sourceStage = nodesById.get(link.sourceNodeId)?.stage ?? 'medium';
    const targetStage = nodesById.get(link.targetNodeId)?.stage;
    const stroke = targetStage === 'external' || targetStage === 'unallocated' || targetStage === 'pending'
      ? stageColors[targetStage]
      : stageColors[sourceStage];
    const returning = link.flowType === 'recovery_output';
    const dash = returning ? ` stroke-dasharray="7 5" stroke-dashoffset="${y1}"` : '';
    const returnY = height - 34;
    const route = returning
      ? `M${x1} ${y1} H${x1 + 12} Q${x1 + 18} ${y1} ${x1 + 18} ${y1 + 6} V${returnY - 8} Q${x1 + 18} ${returnY} ${x1 + 10} ${returnY} H${x2 - 18} Q${x2 - 26} ${returnY} ${x2 - 26} ${returnY - 8} V${y2 + 8} Q${x2 - 26} ${y2} ${x2 - 18} ${y2} H${x2}`
      : `M${x1} ${y1} C${middle} ${y1},${middle} ${y2},${x2} ${y2}`;
    const title = link.tooltip ?? `${nodesById.get(link.sourceNodeId)?.name ?? ''} → ${nodesById.get(link.targetNodeId)?.name ?? ''}｜${format(link.standardCoalAmount, 1)} tce`;
    return `<path data-link-id="${escape(link.linkId)}" class="flow${returning ? ' return-flow' : ''}${active}" d="${route}" stroke="${returning ? '#00A870' : targetStage === 'recovery' ? stageColors.recovery : stroke}" stroke-width="${returning ? 2.5 : width}"${dash}${returning ? ' marker-end="url(#recovery-arrow)"' : ''}><title>${escape(title)}</title></path>`;
  }).join('');
  const nodes = data.nodes.map((node) => {
    const position = positions.get(node.nodeId)!;
    const selectedClass = selected === node.nodeId ? ' selected' : '';
    const mutedClass = selected && !relatedNodes.has(node.nodeId) ? ' muted' : '';
    const anomalyClass = node.anomalous ? ' anomalous' : '';
    const nodeHeight = nodeHeightFor(node);
    const label = labels.get(node.nodeId)!;
    const title = [node.name, node.nodeType, node.sourceLabel, node.valueLabel, node.detailLabel, node.detailLabelSecondary].filter(Boolean).join('｜');
    const color = node.anomalous ? '#F04438' : stageColors[node.stage];
    const recycled = recoveryTargets.has(node.nodeId);
    const cardWidth = nodeWidthFor(node);
    const fill = recycled ? 'url(#recovered-energy)' : '#FFFFFF';
    const recycleIcon = recycled ? `<use href="#recycle-icon" x="${position.x + cardWidth - 30}" y="${position.y + 10}" width="20" height="20" aria-label="含回收能源"/>` : '';
    return `<g class="node${selectedClass}${mutedClass}${anomalyClass}" data-key="${escape(node.nodeId)}"><title>${escape(title)}</title><rect x="${position.x}" y="${position.y}" width="${cardWidth}" height="${nodeHeight}" rx="7" fill="${fill}" stroke="${color}" stroke-width="1.5"/><rect x="${position.x}" y="${position.y}" width="7" height="${nodeHeight}" rx="3" fill="${color}"/>${label.title.map((line, index) => `<text x="${position.x + 16}" y="${position.y + 25 + index * 22}" font-size="16" font-weight="600" fill="#102039">${escape(line)}</text>`).join('')}${label.details.map((line, index) => `<text x="${position.x + 16}" y="${position.y + 25 + label.title.length * 22 + index * 19}" font-size="13" fill="#536580">${escape(line)}</text>`).join('')}${recycleIcon}</g>`;

  }).join('');
  const columns = [
    ['input', '企业边界输入', '外部进入企业的能源'],
    ['conversion', '能源转换', '使用外部输入能源'],
    ['medium', '厂内可供分配能源', '厂内可继续分配的能源'],
    ['distribution', '一级用能单元', '能源使用对象'],
    ...(data.viewLevel === 'level2' ? [['utilization', '二级用能单元', '一级单元内部利用']] : []),
    ['recovery', '能源回收与循环利用', '回收用能过程产生的余能'],
  ];
  const headings = columns.map(([stage, label, subtitle]) => { const x = stageX.get(stage)!; return `<rect x="${x - 12}" y="10" width="222" height="${height - 74}" rx="8" fill="#F3F9FB"/><text x="${x + 4}" y="40" font-size="17" font-weight="700" fill="#172033">${label}</text><text x="${x + 4}" y="63" font-size="13" fill="#667085">${subtitle}</text>`; }).join('');
  const externalPanel = externalNodes.length ? `<rect x="${externalX}" y="16" width="170" height="${externalY - 16}" rx="8" fill="#FAF7FF" fill-opacity=".94" stroke="#B692F6" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${externalX + 10}" y="39" font-size="14" font-weight="600" fill="#8547FF">企业边界输出</text><text x="${externalX + 10}" y="59" font-size="11.5" fill="#9670DA">仅显示已登记的能源外供</text>` : '';
  const returnLabel = data.links.some((link) => link.flowType === 'recovery_output') ? `<rect x="${returnLabelX}" y="${height - 47}" width="286" height="24" rx="4" fill="white"/><text x="${returnLabelX + 12}" y="${height - 30}" font-size="14" font-weight="600" fill="#00A870">回收能源回流至厂内可供分配能源</text>` : '';
  return `<svg class="sankey" viewBox="0 0 ${chartWidth} ${height}" aria-label="${escape(data.viewName)}"><defs><linearGradient id="recovered-energy" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6F7F1"/></linearGradient><symbol id="recycle-icon" viewBox="0 0 24 24"><g fill="none" stroke="#00AD83" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6l2-3a2 2 0 0 1 3.5 0L17 9m-4-1 4 1 1-4M19 12l2 4a2 2 0 0 1-1.7 3H13m3-3-3 3 3 3M9 19H5a2 2 0 0 1-1.8-3L6 10m-4 1 4-1 1 4"/></g></symbol><marker id="recovery-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#00A870"/></marker></defs>${headings}${links}${externalPanel}${nodes}${returnLabel}</svg>`;
}
