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
  type IntensityObjectType,
} from '../../mocks/energyIntensitySelector';
import {
  saveDeviceIntensityParameter,
  saveDeviceIntensityTemplate,
  type DeviceIntensityMetricCode,
} from '../../mocks/deviceIntensityParameterStore';
import {
  buildFlowAnalysisDataset,
  type FlowAnalysisDataset,
  type FlowDetailRow as ClosedLoopFlowDetailRow,
} from '../../mocks/energyFlowSelector';
import styles from './EnergyAnalysisV4.module.css';

type DialogState = {
  title: string;
  body: ReactNode;
  submitText?: string;
  cancelText?: string;
  onSubmit?: () => void;
  wide?: boolean;
} | null;

const format = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

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

function intensityStatus(metric: CalculatedIntensityMetric) {
  if (metric.resultType === 'ok') return { label: '已计算', tone: 'ok' as const, reason: '' };
  const reason = metric.issue ?? '数据或计算依据未完整';
  if (reason === '当前产品无法直接汇总' || reason === '未关联生产用能单元' || reason === '缺少必要关联关系') {
    return { label: '暂不可计算', tone: 'warn' as const, reason };
  }
  return { label: '待完善', tone: 'warn' as const, reason };
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
    state.onSubmit?.();
    close();
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
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
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
        <div><b>月度消费分解</b><small>年度数值按月度能源记录汇总，表尾合计与当前年度记录一致。</small></div>
      </div>
      <div className={styles.drillTableWrap}>
        <table className={styles.drillTable} aria-label="年度月明细">
          <thead><tr><th>月份</th><th>实物量</th><th>单位</th><th>折标量（tce）</th><th>占全年</th><th>同比</th><th>环比</th></tr></thead>
          <tbody>{details.map((item) => (
            <tr key={item.detailId}>
              <td>{item.month}</td>
              <td>{format(item.physicalAmount)}</td>
              <td>{row.measurementUnit}</td>
              <td>{format(item.standardCoalAmount)}</td>
              <td>{format(item.share, 1)}%</td>
              <td className={item.yearOnYear < 0 ? styles.down : styles.up}>{percent(item.yearOnYear)}</td>
              <td className={(item.monthOnMonth ?? 0) < 0 ? styles.down : styles.up}>{percent(item.monthOnMonth)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td>合计</td><td>{format(row.physicalAmount)}</td><td>{row.measurementUnit}</td><td>{format(row.standardCoalAmount)}</td><td>100.0%</td><td>{percent(row.yearOnYear)}</td><td>—</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.modalNote}><strong>数据来源：</strong>{row.sourceDescription}<br /><strong>折标口径：</strong>各月读取对应能源品种的有效折标参数，年度值由12个月记录汇总。</div>
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
        <div><b>日度消费趋势</b><small>用于识别月内波动和异常高值，点击月度记录后下钻至每日汇总。</small></div>
        <span><i />正常 · <i />偏高</span>
      </div>
      <div className={styles.dailyBars} aria-label="日度消费趋势">
        {details.map((item, index) => (
          <div key={item.detailId} title={`${item.date}：${format(item.standardCoalAmount)} tce`}>
            <i
              className={item.dataStatus === '偏高' ? styles.dailyBarHigh : ''}
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
              <td><StatusTag tone={item.dataStatus === '偏高' ? 'warn' : 'ok'}>{item.dataStatus}</StatusTag></td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td>合计</td><td>{format(row.physicalAmount)}</td><td>{row.measurementUnit}</td><td>{format(row.standardCoalAmount)}</td><td>—</td><td>完整</td></tr></tfoot>
        </table>
      </div>
      <div className={styles.modalNote}><strong>数据来源：</strong>{row.sourceDescription}<br /><strong>统计说明：</strong>日度数据按当前用能单元和能源品种汇总；折标量合计与月度记录一致。</div>
    </div>
  );
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
            <option value="all">全部</option>
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
  const savedFilters = (() => { try { return JSON.parse(window.sessionStorage.getItem('energy-intensity-device-filters') ?? 'null') as { year?: string; energyUnitId?: string; deviceType?: string; deviceId?: string } | null; } catch { return null; } })();
  const [year, setYear] = useState(savedFilters?.year ?? '2026');
  const [energyUnitId, setEnergyUnitId] = useState(savedFilters?.energyUnitId ?? 'all');
  const [deviceType, setDeviceType] = useState(savedFilters?.deviceType ?? 'all');
  const [deviceId, setDeviceId] = useState(savedFilters?.deviceId ?? 'all');
  const [trendDeviceId, setTrendDeviceId] = useState(savedFilters?.deviceId !== 'all' ? savedFilters?.deviceId ?? '' : '');
  const [showDeviceMonthly, setShowDeviceMonthly] = useState(false);
  const [applied, setApplied] = useState({ year: Number(savedFilters?.year ?? 2026), energyUnitId: savedFilters?.energyUnitId ?? 'all', deviceType: savedFilters?.deviceType ?? 'all', deviceId: savedFilters?.deviceId ?? 'all' });
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const allRows = useMemo(() => { void version; return buildDeviceIntensityRows(applied.year, applied.deviceType, applied.energyUnitId, applied.deviceId); }, [applied, version]);
  const previousRows = useMemo(() => buildDeviceIntensityRows(applied.year - 1, applied.deviceType, applied.energyUnitId, applied.deviceId), [applied]);
  // The main table only shows devices that already have a metric template or
  // are waiting for data. Devices without a template stay in the expandable
  // follow-up list below, so a second status filter is unnecessary.
  const rows = useMemo(() => allRows.filter((row) => row.resultStatus !== '暂不可计算'), [allRows]);
  const devices = useMemo(() => buildDeviceIntensityRows(Number(year) || 2026), [year]);
  const openParameterDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入') {
      openEnergyDataDialog(row);
      return;
    }
    let parameterValue = row.parameter?.value ? String(row.parameter.value) : '';
    let source = row.parameter?.source ?? '';
    const parameterLabel = row.metricCode === 'compressed-air-electricity' ? '年度供气量' : row.metricCode === 'custom-device-work' ? '年度作业量' : '年度蒸汽产量';
    const parameterUnit = row.metricCode === 'compressed-air-electricity' ? 'Nm³' : row.metricCode === 'custom-device-work' ? row.metricUnit.split('/')[1] ?? '作业单位' : 't';
    setDialog({
      title: '补充数据',
      body: <>
        <DetailGrid items={[['具体缺失原因', row.resultReason ?? '缺少计算参数'], ['设备名称', row.deviceName], ['所属用能单元', row.energyUnitName], ['分析年度', `${applied.year}年`], ['设备类型', row.deviceType], ['年度能源消费', `${format(row.annualEnergy)} ${row.energyUnit}`], ['数据进度', row.dataProgress], ['典型指标', row.metricName], ['计算公式', row.formula]]} />
        <label className={styles.modalField}><span className={styles.required}>{parameterLabel}（{parameterUnit}）</span><input aria-label={parameterLabel} type="number" min="0" step="0.001" defaultValue={parameterValue} onChange={(event) => { parameterValue = event.target.value; }} /></label>
        <label className={styles.modalField}><span>数据来源说明（选填）</span><input aria-label="数据来源说明" defaultValue={source} onChange={(event) => { source = event.target.value; }} /></label>
      </>,
      submitText: '保存并计算',
      onSubmit: () => {
        const value = Number(parameterValue);
        if (!Number.isFinite(value) || value <= 0) { notify(`请填写${parameterLabel}`); return; }
        saveDeviceIntensityParameter({ deviceId: row.deviceId, year: applied.year, metricCode: row.metricCode as DeviceIntensityMetricCode, value, unit: parameterUnit as 'Nm³' | 't' | '—', source: source || undefined });
        setVersion((current) => current + 1);
        notify(row.completeEnergy ? '设备参数已保存，指标已重新计算' : '参数已保存，待能源数据完整后自动计算');
      },
    });
  };
  const openDeviceMetricConfig = (row?: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    let metricName = row ? `${row.deviceType}单位作业能耗` : '';
    let energyTypeId = 'v11-energy-electricity';
    let denominatorName = '设备作业量';
    let denominatorUnit = 't';
    let metricUnit = 'kWh/t';
    setDialog({
      title: '配置设备指标口径',
      wide: true,
      body: <>
        <div className={styles.modalNote}>配置一个通用的“设备能源消费量 ÷ 作业量”指标。保存后，绑定设备会进入待完善状态，补齐能源数据和作业量后自动计算。</div>
        {row && <DetailGrid items={[['绑定设备', row.deviceName], ['设备类型', row.deviceType]]} />}
        <label className={styles.modalField}><span className={styles.required}>指标名称</span><input aria-label="指标名称" defaultValue={metricName} onChange={(event) => { metricName = event.target.value; }} /></label>
        <label className={styles.modalField}><span className={styles.required}>能源消费口径</span><select aria-label="能源消费口径" defaultValue={energyTypeId} onChange={(event) => { energyTypeId = event.target.value; metricUnit = event.target.value === 'v11-energy-electricity' ? `kWh/${denominatorUnit}` : `kgce/${denominatorUnit}`; }}><option value="v11-energy-electricity">电力消费量</option><option value="v11-energy-natural-gas">天然气折标综合能耗</option></select></label>
        <label className={styles.modalField}><span className={styles.required}>作业量名称</span><input aria-label="作业量名称" defaultValue={denominatorName} onChange={(event) => { denominatorName = event.target.value; }} /></label>
        <label className={styles.modalField}><span className={styles.required}>作业量单位</span><input aria-label="作业量单位" defaultValue={denominatorUnit} onChange={(event) => { denominatorUnit = event.target.value; metricUnit = energyTypeId === 'v11-energy-electricity' ? `kWh/${event.target.value}` : `kgce/${event.target.value}`; }} /></label>
        <div className={styles.formulaBox}>计算公式：设备能源消费量 ÷ {denominatorName}（结果单位：{metricUnit}）</div>
      </>,
      submitText: row ? '保存并绑定设备' : '保存指标口径',
      cancelText: '取消',
      onSubmit: () => {
        if (!metricName.trim() || !denominatorName.trim() || !denominatorUnit.trim()) { notify('请完整填写指标名称和作业量口径'); return; }
        if (!row) { notify('请从待配置设备进入指标口径配置'); return; }
        saveDeviceIntensityTemplate({ deviceId: row.deviceId, year: applied.year, metricCode: 'custom-device-work', config: { metricCode: 'custom-device-work', metricName: metricName.trim(), energyTypeId, denominatorName: denominatorName.trim(), denominatorUnit: denominatorUnit.trim(), metricUnit, formula: `设备能源消费量 ÷ ${denominatorName.trim()}` } });
        setVersion((current) => current + 1);
        notify('设备指标口径已保存，设备已纳入待完善列表');
      },
    });
  };
  const openEnergyDataDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const entered = row.reportedMonths.map((reported, index) => reported ? `${index + 1}月` : '').filter(Boolean).join('、') || '暂无';
    const missing = row.reportedMonths.map((reported, index) => reported ? '' : `${index + 1}月`).filter(Boolean).join('、') || '无';
    setDialog({
      title: '补充数据',
      body: <><DetailGrid items={[['具体缺失原因', row.resultReason ?? '能源数据未录入'], ['重点设备', row.deviceName], ['分析年度', `${applied.year}年`], ['能源品种', row.energyTypeName], ['当前数据进度', row.dataProgress], ['已录入月份', entered], ['缺失月份', missing]]} /><div className={styles.modalNote}>能源数据未完整时不生成正式年度指标。补齐能源数据后，系统将自动重新读取并计算。</div></>,
      submitText: '去补充能源数据',
      onSubmit: () => navigate(row.metricCode === 'waste-heat-power-efficiency' ? '/data-management/energy-data?tab=conversion' : deviceEnergyDataPath(row.deviceId, applied.year, row.metricCode ?? 'compressed-air-electricity', row.energyRecordId)),
    });
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const boiler = row.metricCode === 'boiler-standard-coal';
    const generator = row.metricCode === 'waste-heat-power-efficiency';
    const numerator = generator
      ? `回收余热｜发电量 ${format(row.annualEnergy)} kWh`
      : boiler
        ? `年度折标综合能耗 ${format(row.annualEnergy * row.standardCoalFactor, 3)} tce`
        : `年度电耗 ${format(row.annualEnergy)} kWh`;
    const denominator = generator
      ? `发电量 ${format(row.parameter?.value)} kWh`
      : boiler
        ? `年度蒸汽产量 ${format(row.parameter?.value)} t`
        : `年度供气量 ${format(row.parameter?.value)} Nm³`;
    const formula = generator
      ? row.formula
      : boiler
        ? '年度折标综合能耗 × 1000 ÷ 年度蒸汽产量'
        : '年度电耗 ÷ 年度供气量';
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
              <div><span>统计期间</span><strong>{applied.year}年度</strong></div>
              <div><span>指标结果</span><strong>{format(row.value, 3)} {row.metricUnit}</strong></div>
              <div><span>指标单位</span><strong>{row.metricUnit}</strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueGrid}>
              <div><span>{generator ? '能源输入' : boiler ? '年度折标综合能耗' : '年度能源消耗'}</span><strong>{numerator}</strong><small>{generator ? '能源转换与输出—余热发电' : boiler ? `${row.standardCoalFactor} ${row.standardCoalFactorUnit}｜能源品种参数` : '能源数据—重点设备'}</small></div>
              <div><span>{generator ? '能源输出' : boiler ? '年度蒸汽产量' : '年度供气量'}</span><strong>{denominator}</strong><small>{generator ? '余热发电转换记录' : '重点设备指标计算参数'}</small></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{formula}</strong>
          </section>
        </div>
      ),
      cancelText: '关闭',
      submitText: generator ? undefined : '编辑参数',
      onSubmit: generator ? undefined : () => window.setTimeout(() => openParameterDialog(row), 0),
    });
  };
  const openDeviceAction = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultStatus === '已计算') return openDetail(row);
    if (row.resultStatus === '待完善') {
      return row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入'
        ? openEnergyDataDialog(row)
        : row.resultReason === '缺少余热发电转换数据' ? openEnergyDataDialog(row)
        : openParameterDialog(row);
    }
    return undefined;
  };
  const deviceActionLabel = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultStatus === '已计算') return '查看详情';
    if (row.resultStatus === '待完善') {
      return row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' || row.resultReason === '缺少余热发电转换数据' ? '补充转换数据' : '补充计算参数';
    }
    return '暂无适用指标';
  };
  const query = () => { const next = { year: Number(year) || 2026, energyUnitId, deviceType, deviceId }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const reset = () => { setYear('2026'); setEnergyUnitId('all'); setDeviceType('all'); setDeviceId('all'); const next = { year: 2026, energyUnitId: 'all', deviceType: 'all', deviceId: 'all' }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const deviceTypes = [...new Set(devices.map((row) => row.deviceType))];
  const deviceOptions = devices.filter((row) => (deviceType === 'all' || row.deviceType === deviceType) && (energyUnitId === 'all' || row.energyUnitId === energyUnitId));
  const calculated = allRows.filter((row) => row.resultStatus === '已计算').length;
  const pending = allRows.filter((row) => row.resultStatus === '待完善').length;
  const unavailableRows = allRows.filter((row) => row.resultStatus === '暂不可计算');
  const unavailable = unavailableRows.length;
  const trendCandidates = rows.length > 0 ? rows : allRows;
  const trendRow = trendCandidates.find((row) => row.deviceId === trendDeviceId) ?? trendCandidates[0];
  const trendMax = Math.max(...(trendRow?.monthlyMetricValues.filter((value): value is number => value !== null) ?? [0]), 1);
  const deviceTrendDisplayMax = trendMax * 1.15;
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
  return <div className={styles.page}>
    <section className={`${styles.card} ${styles.filterCard}`}>
      <FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '用能单元'], ['product', '产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField>
      <FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select></FilterField>
      <FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField>
      <FilterField label="设备类型"><select aria-label="设备类型" value={deviceType} onChange={(event) => { setDeviceType(event.target.value); setDeviceId('all'); }}><option value="all">全部设备类型</option>{deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterField>
      <FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField>
      <div className={styles.filterSpacer} /><EnergyButton primary onClick={query}>查询</EnergyButton><EnergyButton onClick={reset}>重置</EnergyButton>
    </section>
    <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div><div className={styles.chartTitle}>重点设备指标结果</div><div className={styles.subtleCount}>已识别 {rows.length} 台已配置指标口径的重点设备，{calculated} 项已计算，{rows.length - calculated} 项待完善。</div></div></div><div className={styles.tableWrap}><table><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>指标口径</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>数据状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => { const index = latestMetricIndex(row); const changes = index >= 0 ? changeFor(row, index) : { mom: null, yoy: null }; return <tr key={row.deviceId}><td>{row.deviceName}</td><td>{row.energyUnitName}</td><td>{row.deviceType}</td><td>{row.metricName}</td><td>{row.value === null ? '—' : `${format(row.value, 3)} ${row.metricUnit}`}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><StatusTag tone={row.resultStatus === '已计算' ? 'ok' : 'warn'}>{row.resultStatus}</StatusTag></td><td><button type="button" className={styles.link} onClick={() => { setTrendDeviceId(row.deviceId); setShowDeviceMonthly(false); openDeviceAction(row); }}>{deviceActionLabel(row)}</button></td></tr>; })}</tbody></table></div>{trendRow && <section className={styles.intensityMonthlyDetail} aria-label="重点设备月度指标趋势"><div className={styles.intensityMonthlyHeader}><div><strong>{trendRow.deviceName}｜月度{trendRow.metricName}趋势</strong><span>展示指标值及环比、同比变化；缺少对应期间数据时显示“—”。</span></div><FilterField label="趋势设备"><select aria-label="趋势设备" value={trendRow.deviceId} onChange={(event) => { setTrendDeviceId(event.target.value); setShowDeviceMonthly(false); }}>{rows.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></div><div className={styles.intensityTrendChart} aria-label="重点设备月度指标趋势"><div className={styles.intensityTrendAxis} aria-hidden="true">{[deviceTrendDisplayMax, deviceTrendDisplayMax / 2, 0].map((tick) => <span key={tick}>{format(tick, metricDigits(tick))}</span>)}</div><div className={styles.intensityTrendPlot}><div className={styles.intensityTrendGrid} aria-hidden="true"><i /><i /><i /></div><div className={styles.intensityTrendBars}>{trendRow.monthlyMetricValues.map((value, index) => { const reported = value !== null; const isLatest = index === deviceLatestIndex; const tone = !reported ? styles.trendBarEmpty : isLatest ? styles.trendBarCurrent : styles.trendBarNormal; return <div key={index} className={styles.intensityTrendBar} title={`${index + 1}月：${reported ? `${format(value, metricDigits(value))} ${trendRow.metricUnit}` : '—'}`}><strong className={styles.intensityTrendValue}>{reported ? format(value, metricDigits(value)) : '—'}</strong><div className={styles.intensityTrendBarTrack}><i className={tone} style={{ height: `${reported ? Math.max(8, value / deviceTrendDisplayMax * 100) : 0}%` }} /></div><small>{index + 1}月</small></div>; })}</div></div></div><div className={styles.monthlyDetailToggle}><span>月度指标明细{!trendRow.completeEnergy ? '｜部分月份缺失' : ''}</span><button type="button" className={styles.link} aria-expanded={showDeviceMonthly} onClick={() => setShowDeviceMonthly((current) => !current)}>{showDeviceMonthly ? '收起明细' : '查看明细'}</button></div>{showDeviceMonthly && <div className={styles.tableWrap}><table className={styles.intensityMonthlyTable}><thead><tr><th>月份</th><th>指标值</th><th>环比变化</th><th>同比变化</th><th>数据状态</th></tr></thead><tbody>{trendRow.monthlyMetricValues.map((value, index) => { const changes = changeFor(trendRow, index); return <tr key={index}><td>{index + 1}月</td><td>{value === null ? '—' : `${format(value, metricDigits(value))} ${trendRow.metricUnit}`}</td><td className={styles.changeCell}>{percent(changes.mom)}</td><td className={styles.changeCell}>{percent(changes.yoy)}</td><td><StatusTag tone={value !== null ? 'ok' : 'warn'}>{value !== null ? '已计算' : '—'}</StatusTag></td></tr>; })}</tbody></table></div>}</section>}</section>
      {unavailableRows.length > 0 && <details className={styles.unavailableDevices}><summary>暂未配置设备指标（{unavailable} 台）</summary><div>{unavailableRows.map((row) => <span key={row.deviceId}><strong>{row.deviceName}</strong><small>{row.resultReason ?? '当前暂无匹配的设备指标模板；暂不参与本页指标计算'}</small><button type="button" className={styles.link} onClick={() => openDeviceMetricConfig(row)}>配置指标口径</button></span>)}</div></details>}<div className={styles.slimNote}><div><i>i</i><span>主列表展示已配置指标口径的设备；未配置设备可按“能源消费量 ÷ 作业量”建立企业自定义指标。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} />
  </div>;
}

function ProductMetricDetail({ metric, objectName }: { metric: CalculatedIntensityMetric; objectName: string }) {
  const status = intensityStatus(metric);
  return <>
    <section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={[['分析对象', `${objectName}｜产品`], ['指标名称', metric.name], ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`], ['统计期间', metric.period], ['计算状态', status.label]]} /></section>
    <section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={[['分子数据', metric.numerator], ['分子来源', metric.numeratorSource ?? '能源数据—企业层级—全厂'], ['分母数据', metric.denominator], ['分母来源', metric.denominatorSource ?? '运营数据—产品产量'], ['计算公式', metric.formula]]} /></section>
    <section className={styles.modalSection}><h3>数据来源</h3><DetailGrid items={[['能源数据来源', '能源数据—企业层级—全厂'], ['运营数据来源', '运营数据—产品产量'], ['最近计算时间', '2026-08-04']]} /></section>
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
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['能源品种', row.energyTypeName], ['数据进度', row.dataProgress], ['已录入月份', entered], ['缺失月份', missing], ['具体原因', row.resultReason ?? '能源数据未录入']]} /><div className={styles.modalNote}>能源数据未完整时不生成正式年度指标。请补齐能源数据后重新计算。</div></>, submitText: '补充能源数据', onSubmit: () => navigate(deviceEnergyDataPath(row.deviceId, year, row.metricCode ?? 'compressed-air-electricity', row.energyRecordId)) });
  };
  const openParameter = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    let value = row.parameter?.value ? String(row.parameter.value) : '';
    const label = row.metricCode === 'compressed-air-electricity' ? '年度供气量（Nm³）' : '年度蒸汽产量（t）';
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['典型指标', row.metricName], ['具体原因', row.resultReason ?? '缺少计算参数']]} /><label className={styles.modalField}><span className={styles.required}>{label}</span><input aria-label={label} type="number" min="0" step="0.001" defaultValue={value} onChange={(event) => { value = event.target.value; }} /></label></>, submitText: '补充计算参数', onSubmit: () => { const parsed = Number(value); if (Number.isFinite(parsed) && parsed > 0) saveDeviceIntensityParameter({ deviceId: row.deviceId, year: Number(year), metricCode: row.metricCode as DeviceIntensityMetricCode, value: parsed, unit: row.metricCode === 'compressed-air-electricity' ? 'Nm³' : 't' }); } });
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const isBoiler = row.metricCode === 'boiler-standard-coal';
    const numerator = isBoiler
      ? `年度折标综合能耗 ${format(row.annualEnergy * row.standardCoalFactor, 3)} tce`
      : `年度电耗 ${format(row.annualEnergy)} kWh`;
    const denominator = isBoiler
      ? `年度蒸汽产量 ${format(row.parameter?.value)} t`
      : `年度供气量 ${format(row.parameter?.value)} Nm³`;
    const formula = isBoiler
      ? '年度折标综合能耗 × 1000 ÷ 年度蒸汽产量'
      : '年度电耗 ÷ 年度供气量';
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
              <div><span>{isBoiler ? '年度折标综合能耗' : '年度能源消耗'}</span><strong>{numerator}</strong><small>{isBoiler ? `${row.standardCoalFactor} ${row.standardCoalFactorUnit}｜能源品种参数` : '能源数据—重点设备'}</small></div>
              <div><span>{isBoiler ? '年度蒸汽产量' : '年度供气量'}</span><strong>{denominator}</strong><small>{isBoiler ? '重点设备指标计算参数' : '重点设备指标计算参数'}</small></div>
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
  return <div className={styles.page}><section className={`${styles.card} ${styles.filterCard}`}><FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '用能单元'], ['product', '产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField><FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option><option>2024</option></select></FilterField><FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField><FilterField label="设备类型"><select aria-label="设备类型" value={deviceType} onChange={(event) => { setDeviceType(event.target.value); setDeviceId('all'); }}><option value="all">全部设备类型</option>{deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterField><FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></section><section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div className={styles.chartTitle}>重点设备典型能耗指标</div><div className={styles.subtleCount}>已识别 {rows.length} 台具备典型指标条件的重点设备，{calculated} 项已计算，{rows.length - calculated} 项待完善。</div></div><div className={styles.tableWrap}><table><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>年度能源消费</th><th>典型指标</th><th>指标结果</th><th>结果状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.deviceId}><td>{row.deviceName}</td><td>{row.energyUnitName}</td><td>{row.deviceType}</td><td>{format(row.annualEnergy)} {row.energyUnit}</td><td>{row.metricName}</td><td>{row.value === null ? '—' : `${format(row.value, 3)} ${row.metricUnit}`}</td><td><StatusTag tone={row.resultStatus === '已计算' ? 'ok' : 'warn'}>{row.resultStatus}</StatusTag></td><td><button type="button" className={styles.link} onClick={() => row.resultStatus === '已计算' ? openDetail(row) : row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' ? openEnergyData(row) : row.resultReason ? openParameter(row) : openEnergyData(row)}>{row.resultStatus === '已计算' ? '查看详情' : row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' ? '补充能源数据' : row.resultReason ? '补充计算参数' : '完善数据'}</button></td></tr>)}</tbody></table></div></section><div className={styles.slimNote}><div><i>i</i><span>重点设备仅对已匹配典型指标模板、能源数据完整且计算参数完整的设备生成正式指标。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} /></div>;
}

} */

function monthlyInputLabels(metric: CalculatedIntensityMetric) {
  if (metric.name.includes('营业收入电耗')) return { numerator: '电力消耗量', denominator: '营业收入' };
  if (metric.name.includes('增加值')) return { numerator: '综合能源消耗量', denominator: '工业增加值' };
  if (metric.name.includes('产值')) return { numerator: '综合能源消耗量', denominator: '工业总产值' };
  if (metric.name.includes('蒸汽')) return { numerator: '综合能源消耗量', denominator: '蒸汽产量' };
  if (metric.name.includes('运行')) return { numerator: '综合能源消耗量', denominator: '业务量' };
  if (metric.name.includes('电耗') || metric.unit.startsWith('kWh/')) return { numerator: '电力消耗量', denominator: '产品产量' };
  return { numerator: '综合能源消耗量', denominator: '产品产量' };
}

function IntensityMonthlyDetail({ metric, options, onChange, getOptionLabel }: { metric: CalculatedIntensityMetric; options?: CalculatedIntensityMetric[]; onChange?: (metricId: string) => void; getOptionLabel?: (metric: CalculatedIntensityMetric) => string }) {
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);
  const values = metric.monthlyMetrics.map((item) => item.value).filter((value): value is number => value !== null);
  const max = Math.max(...values, 0);
  const displayMax = max > 0 ? max * 1.15 : 1;
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

  return (
    <div className={styles.intensityMonthlyDetail} aria-label={`月度指标明细：${metric.name}`}>
      <div className={styles.intensityMonthlyHeader}>
        <div>
          <strong>{metric.name}｜月度趋势与明细</strong>
          <span>{basis}；不对缺失月份自动补齐或平均分摊。</span>
        </div>
        {options && options.length > 0 && onChange && <FilterField label="趋势指标"><select aria-label="趋势指标" value={metric.intensityMetricId} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.intensityMetricId} value={option.intensityMetricId}>{getOptionLabel?.(option) ?? option.name}</option>)}</select></FilterField>}
      </div>
      {values.length > 0 && (
        <>
          <div className={styles.intensityTrendChart} aria-label="月度指标趋势">
            <div className={styles.intensityTrendAxis} aria-hidden="true">
              {tickValues.map((tick) => <span key={tick}>{format(tick, metricDigits(tick))}</span>)}
            </div>
            <div className={styles.intensityTrendPlot}>
              <div className={styles.intensityTrendGrid} aria-hidden="true"><i /><i /><i /></div>
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
      <div className={styles.monthlyDetailToggle}>
        <span>月度明细{metric.monthlyDataStatus === 'incomplete' ? '｜部分月份缺失' : ''}</span>
        <button type="button" className={styles.link} aria-expanded={showMonthlyTable} onClick={() => setShowMonthlyTable((current) => !current)}>{showMonthlyTable ? '收起明细' : '查看明细'}</button>
      </div>
      {showMonthlyTable && <div className={styles.tableWrap}>
        <table className={styles.intensityMonthlyTable}>
        <thead><tr><th>月份</th><th>{inputLabels.numerator}</th><th>{inputLabels.denominator}</th><th>指标值</th><th>环比</th><th>同比</th><th>数据状态</th></tr></thead>
          <tbody>
            {metric.monthlyMetrics.map((item) => (
              <tr key={item.month}>
                <td>{item.month}月</td>
                <td>{item.numerator === null ? '—' : format(item.numerator, metricDigits(item.numerator))}</td>
                <td>{item.denominator === null ? '—' : format(item.denominator, metricDigits(item.denominator))}</td>
                <td>{item.value === null ? '—' : `${format(item.value, metricDigits(item.value))} ${metric.unit}`}</td>
                <td className={item.momChange !== null && item.momChange < 0 ? styles.down : item.momChange !== null ? styles.up : ''}>{item.momChange === null ? '—' : percent(item.momChange)}</td>
                <td className={item.yoyChange !== null && item.yoyChange < 0 ? styles.down : item.yoyChange !== null ? styles.up : ''}>{item.yoyChange === null ? '—' : percent(item.yoyChange)}</td>
                <td><StatusTag tone={statusTone(item.status)}>{item.status}</StatusTag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      <div className={styles.modalNote}>计算公式：{metric.formula}。月度数据来源：{metric.source}。</div>
    </div>
  );
}

function IntensityPage() {
  const navigate = useNavigate();
  const [draftYear, setDraftYear] = useState('2026');
  const [draftObjectType, setDraftObjectType] = useState<IntensityObjectType>(() => window.sessionStorage.getItem('energy-intensity-tab') === 'device' ? 'device' : 'factory');
  const [draftObjectId, setDraftObjectId] = useState('all');
  const [draftUnitLevel, setDraftUnitLevel] = useState<'all' | 'level1' | 'level2'>('all');
  const [applied, setApplied] = useState({
    year: 2026,
    objectType: 'factory' as IntensityObjectType,
    objectId: 'all',
    unitLevel: 'all' as 'all' | 'level1' | 'level2',
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [trendMetricId, setTrendMetricId] = useState<string | null>(null);
  const [showUnitPending, setShowUnitPending] = useState(false);
  const { toast, notify } = useFeedback();
  const draftObjects = useMemo(
    () => listIntensityObjects(draftObjectType).filter((object) => draftObjectType !== 'unit' || draftUnitLevel === 'all' || object.unitLevel === draftUnitLevel),
    [draftObjectType, draftUnitLevel],
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
  const rows = resultViews.flatMap((resultView) => resultView.metrics);
  const isUnitOverview = applied.objectType === 'unit' && applied.objectId === 'all';
  const pendingRows = rows.filter((metric) => metric.resultType !== 'ok');
  const visibleRows = isUnitOverview
    ? rows.filter((metric) => metric.resultType === 'ok')
    : rows;
  const calculatedCount = rows.filter((row) => row.resultType === 'ok').length;
  const summaryText = applied.objectType === 'factory'
    ? `全厂已生成 ${rows.length} 项指标，其中 ${calculatedCount} 项已计算`
    : applied.objectType === 'unit'
      ? `当前共展示 ${resultViews.filter((item) => item.metrics.length > 0).length} 个具备计算条件的生产用能单元，已生成 ${rows.length} 项指标，其中 ${calculatedCount} 项已计算、${rows.length - calculatedCount} 项数据不完整`
      : `产品Tab展示企业级产品汇总指标，已生成 ${rows.length} 项指标，其中 ${calculatedCount} 项已计算、${rows.length - calculatedCount} 项待完善`;
  const legacyScopeNote = applied.objectType === 'factory'
    ? '全厂指标只读取企业层级能源数据，产品产量和经济指标按企业年度数据匹配。'
    : applied.objectType === 'unit'
      ? '用能单元指标只读取当前用能单元能源数据，并与已关联产品产量匹配，不跨层级重复汇总。'
      : '产品 Tab 仅以企业边界能源消费和基准主产品产量计算单位主产品指标，不进行产品能耗分摊。';
  const scopeNote = applied.objectType === 'product' ? '产品Tab读取企业层级能源数据和同计量单位产品产量合计，不进行产品能耗分配。' : legacyScopeNote;
  const productScopeNote = '产品指标按照企业年度产品综合口径计算，仅支持相同计量单位产品产量汇总，不进行产品能源分摊。';
  const metricObjectMap = new Map(resultViews.flatMap((resultView) => resultView.metrics.map((metric) => [metric.intensityMetricId, resultView.object])));
  const metricViewFor = (metric: CalculatedIntensityMetric) => resultViews.find((resultView) => resultView.object.objectId === metricObjectMap.get(metric.intensityMetricId)?.objectId) ?? view;
  const defaultMonthlyMetric = rows.find((metric) => metric.resultType === 'ok') ?? rows[0];
  const displayedMonthlyMetric = visibleRows.find((metric) => metric.intensityMetricId === trendMetricId) ?? visibleRows.find((metric) => metric.resultType === 'ok') ?? defaultMonthlyMetric;
  const comparisonMetricNames = [...new Set(rows.map((metric) => metric.name))];
  const comparisonViews = resultViews
    .map((resultView) => ({ ...resultView, metrics: resultView.metrics.filter((metric) => visibleRows.some((item) => item.intensityMetricId === metric.intensityMetricId)) }))
    .filter((resultView) => resultView.metrics.length > 0);

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
    const resultItems: Array<[string, ReactNode]> = [['分析对象', `${metricView.object.objectName}｜${objectLevel}`], ['指标名称', metric.name], ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`], ['统计期间', metric.period], ['计算状态', status.label]];
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
    const status = intensityStatus(metric);
    const energyPath = metricView.object.objectType === 'unit'
      ? `/data-management/energy-data?year=${year}&keyword=${encodeURIComponent(metricView.object.objectName)}`
      : metricView.object.objectType === 'device'
        ? deviceEnergyDataPath(metricView.object.objectId, year, metric.intensityMetricId.includes('boiler') ? 'boiler-standard-coal' : 'compressed-air-electricity', metric.energyRecordIds[0])
        : `/data-management/energy-data?year=${year}`;
    const operationScopeParams = metricView.object.objectType === 'unit'
      ? `&new=1&scopeLevel=${encodeURIComponent(metricView.object.unitLevel === 'level2' ? '二级用能单元' : '一级用能单元')}&unitId=${encodeURIComponent(metricView.object.energyUnitId ?? '')}`
      : '';
    const operationPath = `/data-management/operations?year=${year}${metricView.object.objectType === 'product' ? '' : `&keyword=${encodeURIComponent(metric.relatedProductName ?? metricView.object.objectName)}`}${operationScopeParams}`;
    const openSourceData = () => setDialog({
      title: '源数据',
      body: <>
        <div className={styles.modalNote}>以下入口打开本指标实际使用的能源记录和运营记录。</div>
        <div className={styles.modalSourceActions}>
          <button type="button" className={styles.link} onClick={() => navigate(energyPath)}>查看能源记录</button>
          <button type="button" className={styles.link} onClick={() => navigate(operationPath)}>查看运营记录</button>
        </div>
      </>,
      cancelText: '关闭',
    });
    if (action && metric.resultType !== 'ok') {
      const actionText = status.reason === '缺少能源数据' || status.reason === '能源数据未录入' || status.reason === '能源数据部分录入'
        ? '补充能源数据'
        : status.reason === '缺少产品产量' || status.reason === '缺少必要关联关系' || status.reason === '未关联生产用能单元'
          ? '补充运营数据'
          : '完善数据';
      setDialog({
        title: '数据待完善',
        body: <DetailGrid items={[['分析对象', metricView.object.objectName], ['指标名称', metric.name], ['结果状态', status.label], ['具体原因', status.reason]]} />,
        submitText: actionText,
        onSubmit: () => navigate(status.reason === '缺少能源数据' ? energyPath : operationPath),
      });
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
              <div><span>计算结果</span><strong>{metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`}</strong></div>
              <div><span>计算状态</span><strong><StatusTag tone={status.tone}>{status.label}</StatusTag></strong></div>
            </div>
          </section>

          <section className={styles.basisSection}>
            <h4>参与计算值</h4>
            <div className={styles.basisValueGrid}>
              <div><span>分子数据</span><strong>{metric.numerator}</strong><small>{numeratorSource}</small></div>
              <div><span>分母数据</span><strong>{metric.denominator}</strong><small>{denominatorSource}</small></div>
            </div>
          </section>

          <section className={`${styles.basisSection} ${styles.basisFormula}`}>
            <h4>计算公式</h4>
            <strong>{metric.formula}</strong>
          </section>
        </div>
      ),
      submitText: '查看源数据',
      onSubmit: () => window.setTimeout(openSourceData, 0),
    });
  };

  if (draftObjectType === 'device') {
    return <DeviceIntensityTab onTabChange={(nextType) => {
      setDraftObjectType(nextType);
      window.sessionStorage.setItem('energy-intensity-tab', nextType);
      setDraftObjectId('all');
      setApplied({ year: Number(draftYear) || 2026, objectType: nextType, objectId: nextType === 'factory' ? 'factory' : 'all', unitLevel: nextType === 'unit' ? draftUnitLevel : 'all' });
    }} />;
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard}`}>
        <FilterField label="指标对象类型" wide>
          <span className={styles.objectSegment}>
            {[
              ['factory', '全厂'],
              ['unit', '用能单元'],
              ['product', '产品'],
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
                  if (nextType !== 'unit') setDraftUnitLevel('all');
                  setApplied({ year: Number(draftYear) || 2026, objectType: nextType, objectId: nextType === 'factory' ? 'factory' : 'all', unitLevel: nextType === 'unit' ? draftUnitLevel : 'all' });
                }}
              >{label}</button>
            ))}
          </span>
        </FilterField>
        <FilterField label="分析年度">
          <select aria-label="分析年度" value={draftYear} onChange={(event) => setDraftYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select>
        </FilterField>
        {draftObjectType === 'unit' && <FilterField label="用能单元层级">
          <select aria-label="用能单元层级" value={draftUnitLevel} onChange={(event) => {
            const nextLevel = event.target.value as 'all' | 'level1' | 'level2';
            setDraftUnitLevel(nextLevel);
            setDraftObjectId('all');
          }}>
            <option value="all">全部层级</option>
            <option value="level1">一级用能单元</option>
            <option value="level2">二级用能单元</option>
          </select>
        </FilterField>}
        {draftObjectType === 'product' ? <FilterField label="产品对象" wide><select aria-label="具体分析对象" value={draftObjectId} onChange={(event) => setDraftObjectId(event.target.value)}><option value="all">全部产品</option>{draftObjects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectName}</option>)}</select></FilterField> : draftObjectType !== 'factory' && <FilterField label="具体用能单元" wide>
          <select aria-label="具体分析对象" value={draftObjectId} onChange={(event) => setDraftObjectId(event.target.value)}>
            <option value="all">全部用能单元</option>
            {draftObjects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectName}</option>)}
          </select>
        </FilterField>}
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => {
          setApplied({
            year: Number(draftYear) || 2026,
            objectType: draftObjectType,
            objectId: draftObjectType === 'factory' ? 'factory' : draftObjectType === 'product' ? draftObjectId : draftObjectId,
            unitLevel: draftObjectType === 'unit' ? draftUnitLevel : 'all',
          });
          notify('已按分析对象匹配能源数据与运营数据');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026');
          setDraftObjectType('factory');
          setDraftObjectId('all');
          setDraftUnitLevel('all');
          setApplied({ year: 2026, objectType: 'factory', objectId: 'factory', unitLevel: 'all' });
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}>
        <div className={styles.tableToolbar}>
          <div>
            <div className={styles.chartTitle}>指标结果明细</div>
            <div className={styles.subtleCount}>
              {summaryText}
            </div>
          </div>
        </div>
        {applied.objectType === 'factory' ? <div className={styles.metricCardGrid} aria-label="全厂指标摘要">
          {rows.map((metric) => { const status = intensityStatus(metric); return <article className={styles.metricSummaryCard} key={metric.intensityMetricId}><div className={styles.metricSummaryTop}><span>{metric.name}</span><StatusTag tone={status.tone}>{status.label}</StatusTag></div><strong>{metric.value === null ? '—' : format(metric.value, metricDigits(metric.value))}</strong><small>{metric.unit}</small><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true, metricViewFor(metric))}>{metric.resultType === 'warn' ? '完善数据' : '查看详情'}</button></article>; })}
        </div> : <div className={styles.tableWrap}>
          <table className={styles.comparisonTable}>
            <thead><tr><th>{applied.objectType === 'unit' ? '用能单元' : '产品'}</th>{comparisonMetricNames.map((name) => <th key={name}>{name}</th>)}<th>综合状态</th><th>操作</th></tr></thead>
            <tbody>{comparisonViews.map((resultView) => { const primaryMetric = resultView.metrics.find((metric) => metric.resultType === 'ok') ?? resultView.metrics[0]; const pendingMetric = resultView.metrics.find((metric) => metric.resultType !== 'ok'); const hasPending = Boolean(pendingMetric); return <tr key={resultView.object.objectId}><td>{resultView.object.objectName}</td>{comparisonMetricNames.map((name) => { const metric = resultView.metrics.find((item) => item.name === name); return <td key={name}>{metric ? <><strong>{metric.value === null ? '—' : format(metric.value, metricDigits(metric.value))}</strong><small>{metric.unit}</small></> : '—'}</td>; })}<td><StatusTag tone={hasPending ? 'warn' : 'ok'}>{hasPending ? '待完善' : '已计算'}</StatusTag>{pendingMetric?.issue && <small>具体原因：{pendingMetric.issue}</small>}</td><td>{primaryMetric && <button type="button" className={styles.link} onClick={() => { setTrendMetricId(primaryMetric.intensityMetricId); openMetricDialog(primaryMetric, true, resultView); }}>查看详情</button>}</td></tr>; })}</tbody>
          </table>
        </div>}
        {isUnitOverview && <section className={styles.pendingSummary} aria-label="待完善用能单元"><div><strong>待完善用能单元（{pendingRows.length}）</strong><span>暂不可计算或缺少必要数据的对象已收起，不影响当前指标分析。</span></div><div className={styles.pendingActions}>{pendingRows.length > 0 && <button type="button" className={styles.link} onClick={() => setShowUnitPending((current) => !current)}>{showUnitPending ? '收起待完善项' : '展开待完善项'}</button>}</div></section>}
        {isUnitOverview && showUnitPending && pendingRows.length > 0 && <div className={styles.pendingTable}><div className={styles.subtleCount}>共 {pendingRows.length} 项待完善指标</div><div className={styles.tableWrap}><table><thead><tr><th>分析对象</th><th>指标名称</th><th>结果状态</th><th>具体原因</th><th>操作</th></tr></thead><tbody>{pendingRows.map((metric) => <tr key={`pending-${metric.intensityMetricId}`}><td>{metricObjectMap.get(metric.intensityMetricId)?.objectName ?? view.object.objectName}</td><td>{metric.name}</td><td><StatusTag tone="warn">{intensityStatus(metric).label}</StatusTag></td><td>{intensityStatus(metric).reason}</td><td><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true, metricViewFor(metric))}>完善数据</button></td></tr>)}</tbody></table></div></div>}
        {displayedMonthlyMetric && <IntensityMonthlyDetail key={displayedMonthlyMetric.intensityMetricId} metric={displayedMonthlyMetric} options={visibleRows} onChange={setTrendMetricId} getOptionLabel={(metric) => `${metricObjectMap.get(metric.intensityMetricId)?.objectName ?? view.object.objectName}｜${metric.name}`} />}
      </section>


      <div className={styles.slimNote}>
        <div><i>i</i><span>{applied.objectType === 'product' ? productScopeNote : scopeNote} 具体计算公式及数据来源以指标详情为准。</span></div>
        <button type="button" className={styles.link} onClick={() => setDialog({
          title: '能耗指标计算口径',
          body: (
            <>
              <div className={styles.formulaBox}>
                <strong>单位产品综合能耗</strong>＝综合能耗 ÷ 产品产量<br />
                <strong>单位产品电耗</strong>＝电力消费量 ÷ 产品产量<br />
                <strong>单位产值综合能耗</strong>＝综合能耗 ÷ 工业总产值<br />
                <strong>单位增加值综合能耗</strong>＝综合能耗 ÷ 工业增加值
              </div>
              <div className={styles.modalNote}>分子与分母必须属于同一分析对象和统计期间；不适用的指标不生成，缺少必要数据时显示明确缺失状态。</div>
            </>
          ),
        })}>查看计算口径</button>
      </div>
      <EnergyDialog state={dialog} close={() => setDialog(null)} />
      <EnergyToast message={toast} />
    </div>
  );
}

function BenchmarkPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const initialDeviceId = new URLSearchParams(search).get('objectType') === 'device'
    ? new URLSearchParams(search).get('objectId') ?? ''
    : '';
  const initialType: BenchmarkType = initialDeviceId ? 'device' : 'all';
  const [draftYear, setDraftYear] = useState('2026');
  const [draftType, setDraftType] = useState<BenchmarkType>(initialType);
  const [draftObjectId, setDraftObjectId] = useState(initialDeviceId);
  const [draftUnitLevel, setDraftUnitLevel] = useState<'all' | 'level1' | 'level2'>('all');
  const [draftGrain, setDraftGrain] = useState<'month' | 'quarter' | 'year'>('month');
  const [draftSelectedId, setDraftSelectedId] = useState(initialDeviceId ? '' : 'benchmark-enterprise-factory-factory-product-energy');
  const [applied, setApplied] = useState<{
    year: number;
    type: BenchmarkType;
    objectId: string;
    unitLevel: 'all' | 'level1' | 'level2';
    grain: 'month' | 'quarter' | 'year';
  }>({
    year: 2026,
    type: initialType,
    objectId: initialDeviceId,
    unitLevel: 'all' as 'all' | 'level1' | 'level2',
    grain: 'month' as 'month' | 'quarter' | 'year',
  });
  const [selectedId, setSelectedId] = useState(initialDeviceId ? '' : 'benchmark-enterprise-factory-factory-product-energy');
  const [dataVersion, setDataVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showBenchmarkPending, setShowBenchmarkPending] = useState(false);
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
    .filter((row) => draftType !== 'unit' || draftUnitLevel === 'all' || listIntensityObjects('unit').find((object) => object.objectId === row.objectId)?.unitLevel === draftUnitLevel);
  const draftObjects = [...new Map(draftFilteredRows.map((row) => [row.objectId, row])).values()];
  const draftMetricRows = draftType === 'all' ? [] : draftFilteredRows.filter((row) => row.objectId === draftObjectId);
  // “全部” follows the intensity page's factory scope; it is not an
  // aggregation of factory, unit, product and device rows.
  const filteredRows = (applied.type === 'all'
    ? metrics.filter((row) => row.objectTypeKey === 'enterprise')
    : metrics.filter((row) => row.objectTypeKey === applied.type))
    .filter((row) => applied.type !== 'unit' || applied.unitLevel === 'all' || listIntensityObjects('unit').find((object) => object.objectId === row.objectId)?.unitLevel === applied.unitLevel);
  const collapsiblePendingType = applied.type === 'unit' || applied.type === 'device';
  const pendingBenchmarkRows = collapsiblePendingType ? filteredRows.filter((row) => !row.available) : [];
  const visibleBenchmarkRows = collapsiblePendingType ? filteredRows.filter((row) => row.available) : filteredRows;
  const objects = [...new Map(filteredRows.map((row) => [row.objectId, row])).values()];
  const selected = metrics.find((row) => row.benchmarkMetricId === selectedId)
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
  const displayGrain = monthlyDataAvailable ? applied.grain : 'year';
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
    const nextUnitLevel = 'all' as 'all' | 'level1' | 'level2';
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
    setApplied({ year: nextYear, type: draftType, objectId: nextObjectId, unitLevel: draftUnitLevel, grain: draftGrain });
    setDraftObjectId(nextObjectId);
    setDraftSelectedId(nextSelectedId);
    setSelectedId(nextSelectedId);
    notify('对标筛选条件已应用');
  };

  const openTarget = () => {
    if (!selected || !selected.available) {
      notify('请先补充当前对象的能源或运营数据');
      return;
    }
    let draftTargetValue = selected.target || selected.actual;
    setDialog({
      title: '指标目标配置',
      body: (
        <div className={styles.modalForm}>
          <FilterField label="目标年度"><input value={applied.year} readOnly /></FilterField>
          <FilterField label="对象类型"><input value={selected.objectType} readOnly /></FilterField>
          <FilterField label="对标对象"><input value={selected.objectName} readOnly /></FilterField>
          <FilterField label="指标名称"><input value={selected.metricName} readOnly /></FilterField>
          <label className={styles.modalField}><span className={styles.required}>年度目标值（{selected.unit}）</span><input aria-label="目标值" required min="0.001" step="0.001" type="number" defaultValue={selected.target || selected.actual} onChange={(event) => { draftTargetValue = Number(event.target.value); }} /></label>
          <label className={styles.modalField}><span>评价方向</span><span className={styles.targetDirection}><button type="button" className={selected.direction === 'low' ? styles.active : ''}>越低越好</button><button type="button" className={selected.direction === 'high' ? styles.active : ''}>越高越好</button></span></label>
          <div className={`${styles.modalNote} ${styles.full}`}>年度目标用于年度结果判断；月度趋势默认以年度目标绘制水平参考线，配置月度目标后将优先展示月度目标线。</div>
        </div>
      ),
      submitText: '保存配置',
      onSubmit: () => {
        const value = draftTargetValue;
        if (Number.isFinite(value) && value > 0) {
          saveBenchmarkTarget({
            objectType: selected.objectTypeKey,
            objectId: selected.objectId,
            metricCode: selected.metricCode,
            year: applied.year,
            energyUnitId: selected.objectTypeKey === 'unit' ? selected.energyUnitId : null,
            value,
            metricName: selected.metricName,
            unit: selected.unit,
            direction: selected.direction,
            monthlyTargets: selected.monthlyTargets,
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
              ['unit', '用能单元'],
              ['product', '产品'],
              ['device', '设备'],
            ] as Array<[BenchmarkType, string]>).map(([value, label]) => (
              <button type="button" key={value} className={draftType === value ? styles.active : ''} onClick={() => selectType(value)}>{label}</button>
            ))}
          </span>
        </FilterField>
        <FilterField label="对标对象" wide>
          <select
            aria-label="对标对象"
            disabled={draftType === 'all'}
            value={draftObjectId}
            onChange={(event) => {
              const next = event.target.value;
              setDraftObjectId(next);
              setDraftSelectedId(draftFilteredRows.find((row) => row.objectId === next)?.benchmarkMetricId ?? '');
            }}
          >
            {draftType === 'all'
              ? <option value="">全厂</option>
              : draftObjects.length
                ? draftObjects.map((item) => <option key={item.objectId} value={item.objectId}>{item.objectName}｜{item.availabilityLabel}{item.available ? '' : `：${item.unavailableReason}`}</option>)
                : <option value="">暂无已维护对象</option>}
          </select>
        </FilterField>
        {draftType === 'unit' && <FilterField label="用能单元层级">
          <select aria-label="用能单元层级" value={draftUnitLevel} onChange={(event) => {
            const nextLevel = event.target.value as typeof draftUnitLevel;
            setDraftUnitLevel(nextLevel);
            setDraftObjectId('');
            setDraftSelectedId('');
          }}>
            <option value="all">全部层级</option>
            <option value="level1">一级用能单元</option>
            <option value="level2">二级用能单元</option>
          </select>
        </FilterField>}
        {draftType === 'all' && <FilterField label="指标" wide>
          <select aria-label="指标" value={draftSelectedId} onChange={(event) => setDraftSelectedId(event.target.value)}>
            {draftFilteredRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.metricName}｜{row.objectName}</option>)}
          </select>
        </FilterField>}
        {draftType !== 'all' && <FilterField label="指标" wide>
          <select aria-label="指标" disabled={draftMetricRows.length === 0} value={draftSelectedId} onChange={(event) => setDraftSelectedId(event.target.value)}>
            {draftMetricRows.length
              ? draftMetricRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.metricName}</option>)
              : <option value="">暂无已维护指标</option>}
          </select>
        </FilterField>}
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={draftGrain} onChange={(event) => {
            const nextGrain = event.target.value as typeof draftGrain;
            setDraftGrain(nextGrain);
            setApplied((current) => ({ ...current, grain: nextGrain }));
          }}>
            {monthlyDataAvailable && <><option value="month">月度</option><option value="quarter">季度</option></>}
            <option value="year">年度</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={applyFilters}>查询</EnergyButton>
        <EnergyButton onClick={() => {
           setDraftYear('2026'); setDraftType('all'); setDraftUnitLevel('all'); setDraftObjectId(''); setDraftGrain('month');
           setApplied({ year: 2026, type: 'all', objectId: '', unitLevel: 'all', grain: 'month' });
           setSelectedId('benchmark-enterprise-factory-factory-product-energy'); setDraftSelectedId('benchmark-enterprise-factory-factory-product-energy');
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
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
              <div><span>目标值</span><strong>{targetConfigured ? <>{format(selected.target, metricDigits(selected.target))}<small>{selected.unit}</small></> : '未配置'}</strong></div>
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
                <div><div className={styles.chartTitle}>实际值与目标值对标（{selected.metricName}）</div><div className={styles.chartSub}>{selected.objectName}｜单位：{selected.unit}{monthlyDataAvailable ? '｜真实月度数据' : '｜当前仅按年度对标'}</div></div>
                <div className={styles.benchmarkActions}>
                  <EnergyButton onClick={openBasis}>查看计算口径</EnergyButton>
                  <EnergyButton outline disabled={!selectedAvailable} onClick={openTarget}>指标目标配置</EnergyButton>
                </div>
              </div>
              <div className={styles.benchmarkLegend} aria-label="对标图例">
                <span><i className={styles.actualLegend} />实际值</span>
                <span><i className={styles.targetLegend} />目标值</span>
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
                <span>评价方向：{selected.direction === 'low' ? '越低越好' : '越高越好'}</span>
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
            <strong>{selected.objectName}｜待完善</strong>
            <span>{selected.objectTypeKey === 'device' ? '已维护重点设备，但尚未录入设备级能源数据，暂无法形成设备用能指标。' : '当前产品暂无法计算单位产品综合能耗。'}</span>
            <small>原因：{selected.unavailableReason}</small>
            <div className={styles.emptyActions}>
              {selected.objectTypeKey === 'device'
                ? <EnergyButton primary onClick={() => goToData(deviceEnergyDataPath(selected.objectId, applied.year, selected.metricCode, selected.energyRecordIds[0]))}>录入设备能源数据</EnergyButton>
                : selected.unavailableReason.includes('目标值')
                ? <EnergyButton primary onClick={openTarget}>配置指标目标</EnergyButton>
                : <EnergyButton primary onClick={() => goToData('/data-management/operations')}>补充产品及运营数据</EnergyButton>}
              {selected.unavailableReason.includes('能源数据') && <EnergyButton onClick={() => goToData(selected.objectTypeKey === 'device' ? deviceEnergyDataPath(selected.objectId, applied.year, selected.metricCode, selected.energyRecordIds[0]) : `/data-management/energy-data?year=${applied.year}`)}>补充能源数据</EnergyButton>}
              <EnergyButton outline onClick={openBasis}>查看所需口径</EnergyButton>
            </div>
          </section>}
          <section className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.tableToolbar}><div><div className={styles.chartTitle}>{applied.type === 'all' ? '全厂指标对标明细' : applied.type === 'product' ? '全部产品指标对标明细' : applied.type === 'device' ? '设备用能与能效对标明细' : '指标对标明细'}（{applied.year}年）</div>{applied.type === 'product' && <div className={styles.chartSub}>点击产品行可联动切换上方单产品趋势与口径。</div>}{applied.type === 'device' && <div className={styles.chartSub}>设备消费量来自重点设备独立能源记录；具备运行时长、产量或供气量等分母前，不虚构设备效率指标。</div>}</div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead>{applied.type === 'device'
                  ? <tr><th>对标对象</th><th>所属用能单元</th><th>指标名称</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>数据完整度</th><th>状态</th></tr>
                  : <tr><th>对标对象</th><th>对象类型</th><th>指标名称</th><th>单位</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>状态</th></tr>}</thead>
                <tbody>
                  {visibleBenchmarkRows.map((row) => {
                    const rowGood = isBenchmarkGood(row);
                    const rowDeviation = row.available && row.targetConfigured && row.target > 0 ? (row.actual - row.target) / row.target * 100 : null;
                    const rowStatus = !row.available ? '待录入' : !row.targetConfigured ? '未配置目标' : rowGood ? '达标' : '未达标';
                    return (
                      <tr key={row.benchmarkMetricId} className={row.benchmarkMetricId === selected.benchmarkMetricId ? styles.selectedRow : ''} title={row.available ? '' : row.unavailableReason} onClick={() => {
                        setSelectedId(row.benchmarkMetricId); setDraftSelectedId(row.benchmarkMetricId); setDraftObjectId(row.objectId);
                      }}>
                        {applied.type === 'device' ? <>
                          <td>{row.objectName}</td><td>{row.scopeNames.join('、') || '—'}</td><td>{row.metricName}</td>
                          <td>{row.available ? `${format(row.actual, metricDigits(row.actual))} ${row.unit}` : '—'}</td><td>{row.targetConfigured ? `${format(row.target, metricDigits(row.target))} ${row.unit}` : '—'}</td>
                          <td className={rowDeviation === null ? '' : rowGood ? styles.down : styles.up}>{rowDeviation === null ? '—' : percent(rowDeviation)}</td><td>{row.dataCompleteness ?? '—'}</td>
                          <td><StatusTag tone={!row.available || !row.targetConfigured ? 'warn' : rowGood ? 'ok' : 'bad'}>{rowStatus}</StatusTag></td>
                        </> : <>
                          <td>{row.objectName}</td><td>{row.objectType}</td><td>{row.metricName}</td><td>{row.unit}</td>
                          <td>{row.available ? format(row.actual, metricDigits(row.actual)) : '—'}</td><td>{row.targetConfigured ? format(row.target, metricDigits(row.target)) : '—'}</td>
                          <td className={row.available ? rowGood ? styles.down : styles.up : ''}>{rowDeviation === null ? '—' : percent(rowDeviation)}</td>
                          <td><StatusTag tone={row.available ? row.targetConfigured ? rowGood ? 'ok' : 'bad' : 'warn' : 'warn'}>{rowStatus}</StatusTag></td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {collapsiblePendingType && <section className={styles.pendingSummary} aria-label={applied.type === 'unit' ? '待完善对标用能单元' : '待完善对标设备'}><div><strong>待完善{applied.type === 'unit' ? '用能单元' : '设备'}（{pendingBenchmarkRows.length}）</strong><span>未满足能耗指标计算条件的{applied.type === 'unit' ? '用能单元' : '设备'}已收起，不影响当前已计算指标对标。</span></div><div className={styles.pendingActions}>{pendingBenchmarkRows.length > 0 && <button type="button" className={styles.link} onClick={() => setShowBenchmarkPending((current) => !current)}>{showBenchmarkPending ? '收起待完善项' : '展开待完善项'}</button>}</div></section>}
            {collapsiblePendingType && showBenchmarkPending && pendingBenchmarkRows.length > 0 && <div className={styles.pendingTable}><div className={styles.subtleCount}>共 {pendingBenchmarkRows.length} 个待完善{applied.type === 'unit' ? '用能单元' : '设备'}</div><div className={styles.tableWrap}><table><thead><tr><th>{applied.type === 'unit' ? '用能单元' : '设备'}</th><th>指标名称</th><th>具体原因</th><th>操作</th></tr></thead><tbody>{pendingBenchmarkRows.map((row) => <tr key={`pending-${row.benchmarkMetricId}`}><td>{row.objectName}</td><td>{row.metricName}</td><td>{row.unavailableReason}</td><td><button type="button" className={styles.link} onClick={() => setSelectedId(row.benchmarkMetricId)}>查看详情</button></td></tr>)}</tbody></table></div></div>}
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
      ? `<line x1="${padding.left}" y1="${y(targetValues[0])}" x2="${width - padding.right}" y2="${y(targetValues[0])}" stroke="#00A870" stroke-width="2" stroke-dasharray="7 5"/><text x="${width - padding.right - 4}" y="${y(targetValues[0]) - 7}" text-anchor="end" font-size="11" fill="#00875A">${targetLabel} ${format(targetValues[0], metricDigits(targetValues[0]))}</text>`
      : isFlatTarget
        ? `<line x1="${padding.left}" y1="${y(targetValues[0])}" x2="${width - padding.right}" y2="${y(targetValues[0])}" stroke="#00A870" stroke-width="2" stroke-dasharray="7 5"/><text x="${width - padding.right - 4}" y="${y(targetValues[0]) - 7}" text-anchor="end" font-size="11" fill="#00875A">${targetLabel} ${format(targetValues[0], metricDigits(targetValues[0]))}</text>`
      : `<polyline points="${targetPoints}" fill="none" stroke="#00A870" stroke-width="2" stroke-dasharray="7 5"/>${targetValues.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="#fff" stroke="#00A870" stroke-width="2"/>`).join('')}`
    : '';
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="指标趋势图">${grid}${targetGraphic}${values.length > 1 ? `<polyline points="${points}" fill="none" stroke="#1677FF" stroke-width="3"/>` : ''}${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="5" fill="#fff" stroke="#1677FF" stroke-width="2"/><text x="${x(index)}" y="${y(value) - 11}" text-anchor="middle" font-size="11" fill="#365A7A">${format(value, metricDigits(value))}</text><text x="${x(index)}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#667085">${labels[index]}</text>`).join('')}</svg>`;
}

type FlowTab = 'diagram' | 'balance' | 'detail';
type FlowHoverState = { nodeId: string; x: number; y: number } | null;

function exportEnergyBalance(data: FlowAnalysisDataset) {
  const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const value = (amount: number) => amount ? format(amount, amount < 10 ? 2 : 1) : '—';
  const rows = data.levelOneBalanceRows;
  const incomeRows = [
    ['一、收入项'],
    ['1. 外购能源', ...rows.map((row) => value(row.externalInputStandardAmount))],
    ['2. 自产/回收能源', ...rows.map((row) => value(row.internalRecoveryStandardAmount + row.conversionOutputStandardAmount))],
    ['收入合计', ...rows.map((row) => value(row.externalInputStandardAmount + row.internalRecoveryStandardAmount + row.conversionOutputStandardAmount))],
  ];
  const expenseRows = [
    ['二、支出项'],
    ['3. 能源转换投入', ...rows.map((row) => value(row.conversionInputStandardAmount))],
    ['4. 各用能单元消耗', ...rows.map((row) => value(row.distributionStandardAmount))],
    ['5. 对外输出', ...rows.map((row) => value(row.externalOutputStandardAmount))],
    ['6. 未分配量', ...rows.map((row) => value(row.unallocatedStandardAmount))],
    ['7. 超分配量', ...rows.map((row) => value(row.overAllocatedStandardAmount))],
    ['支出合计', ...rows.map((row) => value(
      row.conversionInputStandardAmount + row.distributionStandardAmount + row.externalOutputStandardAmount
      + row.unallocatedStandardAmount + row.overAllocatedStandardAmount,
    ))],
    ['三、平衡差', ...rows.map((row) => value(
      row.externalInputStandardAmount + row.internalRecoveryStandardAmount + row.conversionOutputStandardAmount
      - row.conversionInputStandardAmount - row.distributionStandardAmount - row.externalOutputStandardAmount
      - row.unallocatedStandardAmount - row.overAllocatedStandardAmount,
    ))],
  ];
  const header = ['项目', ...rows.map((row) => `${row.energyTypeName}（tce）`), '合计（tce）'];
  const addTotals = (row: (string | number)[]) => [...row, value(row.slice(1).reduce<number>((total, amount) => total + (Number(String(amount).replace(/,/g, '')) || 0), 0))];
  const csv = [header, ...incomeRows.map(addTotals), ...expenseRows.map(addTotals)]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `能源平衡表_${data.viewName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FlowAnalysisPage() {
  const [draftYear, setDraftYear] = useState('2026');
  const [draftGrain, setDraftGrain] = useState<'month' | 'year'>('month');
  const [draftMonth, setDraftMonth] = useState('6');
  const [applied, setApplied] = useState({
    year: 2026,
    grain: 'month' as 'month' | 'year',
    month: 6,
  });
  const [tab, setTab] = useState<FlowTab>('diagram');
  const [selectedNode, setSelectedNode] = useState('');
  const [hoveredNode, setHoveredNode] = useState<FlowHoverState>(null);
  const [traceRow, setTraceRow] = useState<ClosedLoopFlowDetailRow | null>(null);
  const [detailInitialStage, setDetailInitialStage] = useState('');
  const { toast, notify } = useFeedback();
  const data = useMemo(
    () => buildFlowAnalysisDataset(
      { year: applied.year, grain: applied.grain, month: applied.month },
      'level1',
    ),
    [applied],
  );
  const selectedNodeData = data.nodes.find((node) => node.nodeId === selectedNode) ?? null;
  const hoveredNodeData = data.nodes.find((node) => node.nodeId === hoveredNode?.nodeId) ?? null;

  const handleSankeyClick = (event: MouseEvent<HTMLDivElement>) => {
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
          setDetailInitialStage('');
          notify('已按当前期间重新生成全厂能源流向');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026');
          setDraftGrain('month');
          setDraftMonth('6');
          setApplied({ year: 2026, grain: 'month', month: 6 });
          setTab('diagram');
          setSelectedNode('');
          setDetailInitialStage('');
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
          label="转换损失"
          value={data.conversionLossStandardCoalAmount}
          unit="tce"
          digits={1}
          orange={data.conversionLossStandardCoalAmount > 0}
        />
      </section>

      <section className={`${styles.card} ${styles.flowMain}`}>
        <div className={styles.flowTabs}>
          <div>
            <button type="button" className={tab === 'diagram' ? styles.active : ''} onClick={() => setTab('diagram')}>能流图</button>
            <button type="button" className={tab === 'balance' ? styles.active : ''} onClick={() => setTab('balance')}>能源平衡表</button>
            <button type="button" className={tab === 'detail' ? styles.active : ''} onClick={() => setTab('detail')}>流向明细</button>
          </div>
        </div>

        {tab === 'diagram' && (
          <>
            <div className={styles.flowLegend}>
              <span><i style={{ background: '#1677FF' }} />企业边界输入</span>
              <span><i style={{ background: '#F79009' }} />能源转换</span>
              <span><i style={{ background: '#00A870' }} />厂内可供分配能源</span>
              <span><i style={{ background: '#23A35A' }} />一级用能单元</span>
              <span><i style={{ background: '#7A5AF8' }} />外部输出</span>
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
                ? <div dangerouslySetInnerHTML={{ __html: closedLoopFlowSankeySvg(data, selectedNode) }} />
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
                  {hoveredNodeData.detailLabel && <span>{hoveredNodeData.detailLabel}</span>}
                  {hoveredNodeData.detailLabelSecondary && <span>{hoveredNodeData.detailLabelSecondary}</span>}
                  <span>占当前去向 {format(hoveredNodeData.share, 1)}%</span>
                </div>
              )}
            </div>
            {selectedNodeData && (
              <div className={styles.flowSelectionBar}>
                <span>已选节点：<strong>{selectedNodeData.name}</strong>，相关流向已高亮。</span>
                <button type="button" className={styles.link} onClick={() => setTab('detail')}>查看流向明细</button>
                <button type="button" className={styles.link} onClick={() => setSelectedNode('')}>取消选择</button>
              </div>
            )}
            <div className={`${styles.flowMethodNote} ${styles.flowDiagramNote}`}>
              一期展示企业边界输入、能源转换、厂内可供分配能源及向一级用能单元的分配。
              厂内可供分配能源表示外购能源或转换产出进入厂内后的可分配能源量，不代表已经实际使用；实际使用需查看后续用能单元的分配/利用数据。
              缺少专线计量或明确分配规则时，系统不推断能源来源比例；未分配量是厂内能源尚未完整分配到一级用能单元的管理口径差额，不等同于物理损失。
            </div>
          </>
        )}
        {tab === 'balance' && (
          <ClosedLoopBalanceTable
            data={data}
            onExport={() => {
              exportEnergyBalance(data);
              notify('能源平衡表已导出');
            }}
            showUnallocated={() => {
              setDetailInitialStage('未分配');
              setTab('detail');
            }}
          />
        )}
        {tab === 'detail' && (
          <ClosedLoopFlowDetailTable
            key={`${data.viewName}:${detailInitialStage}:${selectedNode}`}
            data={data}
            notify={notify}
            open={setTraceRow}
            initialStage={detailInitialStage}
            selectedNodeId={selectedNode}
          />
        )}
      </section>
      <FlowTraceDrawer row={traceRow} close={() => setTraceRow(null)} />
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

function ClosedLoopBalanceTable({
  data,
  showUnallocated,
  onExport,
}: {
  data: FlowAnalysisDataset;
  showUnallocated: () => void;
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
      <div className={styles.balanceHead}>
        <div>
          <div className={styles.chartTitle}>能源平衡表</div>
          <div className={styles.balanceCaption}>参考 GB/T 28751-2012《企业能量平衡表编制方法》；用于平台内部能源收支与分配核对，不等同于正式标准表式。</div>
        </div>
        <EnergyButton onClick={onExport}>⇩ 导出能源平衡表</EnergyButton>
      </div>
          <EnergyBalanceLedger data={data} onUnallocated={showUnallocated} />
    </div>;
  }
  return (
    <div className={styles.balanceCard}>
      <div className={styles.balanceHead}>
        <div>
          <div className={styles.chartTitle}>能源平衡表</div>
          <div className={styles.balanceCaption}>
            {(data.viewLevel as string) === 'level1'
              ? '参考 GB/T 28751-2012《企业能量平衡表编制方法》；用于平台内部能源收支与分配核对，不等同于正式标准表式。'
              : '按一级分配量和二级利用量核对能源去向；上下级数据仅作层级核对，不重复计入企业总量。'}
          </div>
        </div>
        <EnergyButton onClick={onExport}>⇩ 导出能源平衡表</EnergyButton>
      </div>
      <div className={styles.tableWrap}>
        {(data.viewLevel as string) === 'level1' ? (
          <table>
            <thead><tr><th>能源品种</th><th>外部输入</th><th>内部回收</th><th>转换投入</th><th>转换产出</th><th>内部分配</th><th>外部输出</th><th>未归属</th><th>超分配</th><th>平衡状态</th></tr></thead>
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
                  <td className={row.unallocatedStandardAmount ? styles.up : ''}>
                    {value(row.unallocatedStandardAmount)}
                    {row.unallocatedStandardAmount > 0 && <button type="button" className={styles.miniLink} onClick={showUnallocated}>查看构成</button>}
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
                    {row.pendingStandardAmount > 0 && <button type="button" className={styles.miniLink} onClick={showUnallocated}>查看明细</button>}
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
          ? '平衡关系：外部输入 + 内部回收 + 转换产出 = 转换投入 + 内部分配 + 外部输出 + 未归属。转换损失按各转换关系的投入与有效产出差额单独计算。'
          : '层级关系：一级分配量 = 二级利用量 + 待细分量。二级利用超过一级分配时提示核验，不生成负值流向。'}
      </div>
    </div>
  );
}

function EnergyBalanceLedger({
  data,
  onUnallocated,
}: {
  data: FlowAnalysisDataset;
  onUnallocated: () => void;
}) {
  const rows = data.levelOneBalanceRows;
  const value = (amount: number) => amount ? format(amount, amount < 10 ? 2 : 1) : '—';
  const balanceValue = (amount: number) => format(amount, Math.abs(amount) < 10 ? 2 : 1);
  const incomeRows = [
    { label: '1. 外购能源', values: rows.map((row) => row.externalInputStandardAmount) },
    { label: '2. 自产/回收能源', values: rows.map((row) => row.internalRecoveryStandardAmount + row.conversionOutputStandardAmount) },
  ];
  const expenseRows = [
    { label: '3. 能源转换投入', values: rows.map((row) => row.conversionInputStandardAmount) },
    { label: '4. 各用能单元消耗', values: rows.map((row) => row.distributionStandardAmount) },
    { label: '5. 对外输出', values: rows.map((row) => row.externalOutputStandardAmount) },
    { label: '6. 未分配量', values: rows.map((row) => row.unallocatedStandardAmount) },
    { label: '7. 超分配量', values: rows.map((row) => row.overAllocatedStandardAmount) },
  ];
  const totals = (items: typeof incomeRows) => rows.map((_, index) => items.reduce((total, item) => total + item.values[index], 0));
  const incomeTotals = totals(incomeRows);
  const expenseTotals = totals(expenseRows);
  const differences = incomeTotals.map((amount, index) => amount - expenseTotals[index]);
  const grandTotal = (values: number[]) => values.reduce((total, amount) => total + amount, 0);
  const renderRow = (row: (typeof incomeRows)[number], abnormal = false) => (
    <tr key={row.label}>
      <td>{row.label}</td>
      {row.values.map((amount, index) => <td key={rows[index].energyTypeId} className={abnormal && amount > 0 ? styles.up : ''}>
        {row.label === '6. 未分配量' && amount > 0
          ? <button type="button" className={styles.balanceValueLink} onClick={onUnallocated} title="查看未分配流向明细">{value(amount)}</button>
          : value(amount)}
      </td>)}
      <td className={abnormal && grandTotal(row.values) > 0 ? styles.up : ''}>
        {row.label === '6. 未分配量' && grandTotal(row.values) > 0
          ? <button type="button" className={styles.balanceValueLink} onClick={onUnallocated} title="查看未分配流向明细">{value(grandTotal(row.values))}</button>
          : value(grandTotal(row.values))}
      </td>
    </tr>
  );
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.energyBalanceTable}>
          <thead><tr><th>项目</th>{rows.map((row) => <th key={row.energyTypeId}>{row.energyTypeName}（tce）</th>)}<th>合计（tce）</th></tr></thead>
          <tbody>
            <tr className={styles.balanceSectionRow}><th colSpan={rows.length + 2}>一、收入项</th></tr>
            {incomeRows.map((row) => renderRow(row))}
            <tr className={styles.balanceTotalRow}><th>收入合计</th>{incomeTotals.map((amount, index) => <td key={rows[index].energyTypeId}>{value(amount)}</td>)}<td>{value(grandTotal(incomeTotals))}</td></tr>
            <tr className={styles.balanceSectionRow}><th colSpan={rows.length + 2}>二、支出项</th></tr>
            {expenseRows.map((row) => renderRow(row, row.label === '6. 未分配量' || row.label === '7. 超分配量'))}
            <tr className={styles.balanceTotalRow}><th>支出合计</th>{expenseTotals.map((amount, index) => <td key={rows[index].energyTypeId}>{value(amount)}</td>)}<td>{value(grandTotal(expenseTotals))}</td></tr>
            <tr className={styles.balanceDifferenceRow}><th>三、平衡差</th>{differences.map((amount, index) => <td key={rows[index].energyTypeId} className={amount !== 0 ? styles.up : ''}>{balanceValue(amount)}</td>)}<td>{balanceValue(grandTotal(differences))}</td></tr>
          </tbody>
        </table>
      </div>
      <div className={styles.flowMethodNote}>
        平衡关系：外购能源 + 自产/回收能源 = 能源转换投入 + 各用能单元消耗 + 对外输出 + 未分配量 + 超分配量。自产/回收能源包含转换产出；转换损失按转换关系单独计算{data.conversionLossStandardCoalAmount > 0 ? `，当前合计 ${value(data.conversionLossStandardCoalAmount)} tce` : ''}。
      </div>
    </>
  );
}

function ClosedLoopFlowDetailTable({
  data,
  notify,
  open,
  initialStage,
  selectedNodeId,
}: {
  data: FlowAnalysisDataset;
  notify: (message: string) => void;
  open: (row: ClosedLoopFlowDetailRow) => void;
  initialStage: string;
  selectedNodeId: string;
}) {
  const [stage, setStage] = useState(initialStage);
  const [energyType, setEnergyType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const stages = [...new Set(data.detailRows.map((row) => row.stage))];
  const energyTypes = [...new Set(data.detailRows.map((row) => row.energyTypeName))];
  const rows = data.detailRows.filter((row) =>
    (!stage || row.stage === stage)
    && (!energyType || row.energyTypeName === energyType)
    && (!keyword || `${row.source}${row.target}`.includes(keyword.trim()))
    && (!abnormalOnly || row.abnormal)
    && (!selectedNodeId || row.relatedNodeIds.includes(selectedNodeId)));
  const stageDisplay = (value: ClosedLoopFlowDetailRow['stage']) => ({
    能源输入: '外部输入',
    能源转换: '转换产出',
    能源分配: '一级分配',
    能源利用: '二级利用',
    外部输出: '外部输出',
    未分配: '未归属',
    待分解: '待细分',
  }[value]);
  const stageTone = (row: ClosedLoopFlowDetailRow) =>
    row.stage === '未分配' || row.stage === '待分解'
      ? 'warn'
      : row.stage === '能源转换'
        ? 'check'
        : 'ok';
  const flowGroups: Array<{ title: string; description: string; stages: ClosedLoopFlowDetailRow['stage'][] }> = [
    { title: '一、输入流', description: '企业边界进入厂内', stages: ['能源输入'] },
    { title: '二、转换流', description: '转换节点产生的产出', stages: ['能源转换'] },
    { title: '三、分配流', description: '厂内能源流向用能单元及其他去向', stages: ['能源分配', '能源利用', '外部输出', '未分配', '待分解'] },
  ];
  const flowAmount = (row: ClosedLoopFlowDetailRow) => row.amountUnit === 'tce'
    ? `${format(row.standardCoalAmount, row.standardCoalAmount < 10 ? 2 : 1)} tce`
    : `${format(row.amount, row.amount < 10 ? 2 : 1)} ${row.amountUnit}（${format(row.standardCoalAmount, row.standardCoalAmount < 10 ? 2 : 1)} tce）`;
  const renderRow = (row: ClosedLoopFlowDetailRow) => (
    <tr key={row.flowDetailId}>
      <td>{row.source}</td>
      <td>{row.target}</td>
      <td>{row.energyTypeName}</td>
      <td>
        {flowAmount(row)}
      </td>
      <td><StatusTag tone={stageTone(row)}>{stageDisplay(row.stage)}</StatusTag></td>
      <td><button type="button" className={styles.link} onClick={() => open(row)}>{row.traceRecords.length ? '查看追溯' : '查看说明'}</button></td>
    </tr>
  );
  return (
    <div className={styles.flowDetailTab}>
      <div className={styles.tableToolbar}>
        <div>
          <div className={styles.chartTitle}>能源流向明细</div>
          <div className={styles.subtleCount}>记录每一条能源流的来源、去向、能源品种和流量，共 {rows.length} 条。</div>
        </div>
        <EnergyButton onClick={() => notify('已按当前期间和展示层级导出能源流向明细')}>⇩ 导出当前明细</EnergyButton>
      </div>
      <div className={styles.detailFilters}>
        <select aria-label="能流阶段" value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="">全部能流阶段</option>
          {stages.map((item) => <option key={item} value={item}>{stageDisplay(item)}</option>)}
        </select>
        <select aria-label="能源品种筛选" value={energyType} onChange={(event) => setEnergyType(event.target.value)}>
          <option value="">全部能源品种</option>
          {energyTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input aria-label="来源去向关键字" placeholder="搜索来源或去向" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <label><input type="checkbox" checked={abnormalOnly} onChange={(event) => setAbnormalOnly(event.target.checked)} /> 仅看异常或差额</label>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>来源</th><th>去向</th><th>能源品种</th><th>流量</th><th>能流阶段</th><th>操作</th></tr></thead>
          {flowGroups.map((group) => {
            const groupRows = rows.filter((row) => group.stages.includes(row.stage));
            if (groupRows.length === 0) return null;
            return (
              <tbody key={group.title}>
                <tr className={styles.flowDetailGroupRow}><th colSpan={6}>{group.title}<span>｜{group.description}</span><small>{groupRows.length} 条</small></th></tr>
                {groupRows.map(renderRow)}
              </tbody>
            );
          })}
        </table>
      </div>
      {rows.length === 0 && <div className={styles.emptyState}><strong>没有符合条件的流向记录</strong><span>请调整筛选条件后重试。</span></div>}
    </div>
  );
}

function FlowTraceDrawer({ row, close }: { row: ClosedLoopFlowDetailRow | null; close: () => void }) {
  if (!row) return null;
  const singleTrace = row.traceRecords.length === 1 ? row.traceRecords[0] : null;
  const calculatedFactor = singleTrace && singleTrace.originalAmount
    ? singleTrace.standardCoalAmount * 1000 / singleTrace.originalAmount
    : null;
  const formula = singleTrace && calculatedFactor !== null
    ? `折标量 = ${format(singleTrace.originalAmount, singleTrace.originalAmount < 10 ? 2 : 1)} ${singleTrace.originalUnit} × ${format(calculatedFactor, 4)} kgce/${singleTrace.originalUnit} ÷ 1000 = ${format(singleTrace.standardCoalAmount, singleTrace.standardCoalAmount < 10 ? 2 : 1)} tce`
    : null;
  return (
    <div className={styles.drawerOverlay} onClick={close}>
      <aside className={styles.traceDialog} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><h2>能源流向追溯</h2><span>{row.source} → {row.target}｜{row.energyTypeName}</span></div>
          <button type="button" aria-label="关闭追溯抽屉" onClick={close}>×</button>
        </header>
        <div className={styles.traceDialogBody}>
          <section className={styles.traceSection}>
            <h3>基本信息</h3>
            <DetailGrid items={[
              ['来源', row.source],
              ['去向', row.target],
              ['能源品种', row.energyTypeName],
              ['数据期间', singleTrace?.periodLabel ?? '当前分析期间'],
            ]} />
          </section>
          {singleTrace ? (
            <>
              <section className={styles.traceSection}>
                <h3>参与计算值</h3>
                <div className={`${styles.traceRecord} ${styles.traceValueGrid}`}>
                  <div><span>原始实物量</span><strong>{format(singleTrace.originalAmount, singleTrace.originalAmount < 10 ? 2 : 1)} {singleTrace.originalUnit}</strong></div>
                  <div><span>折标系数</span><strong>{format(calculatedFactor ?? 0, 4)} kgce/{singleTrace.originalUnit}</strong></div>
                  <div className={styles.traceResult}><span>折标量</span><strong>{format(singleTrace.standardCoalAmount, singleTrace.standardCoalAmount < 10 ? 2 : 1)} tce</strong></div>
                </div>
              </section>
              {formula && <section className={styles.traceSection}>
                <h3>计算公式</h3>
                <div className={styles.traceFormula}>{formula}</div>
              </section>}
            </>
          ) : (
            <section className={styles.traceSection}>
              <h3>{row.stage === '未分配' || row.stage === '待分解' ? '差额说明' : '数据说明'}</h3>
              <p>{row.traceDescription}</p>
              {row.traceRecords.length > 1 ? (
                <div className={styles.modalNote}>该流向由 {row.traceRecords.length} 条数据汇总生成，普通用户无需逐条查看原始记录。</div>
              ) : (
                <div className={styles.modalNote}>该项由管理平衡关系计算得出，没有独立的上游数据记录。</div>
              )}
            </section>
          )}
        </div>
        <footer><EnergyButton onClick={close}>关闭</EnergyButton></footer>
      </aside>
    </div>
  );
}

function closedLoopFlowSankeySvg(data: FlowAnalysisDataset, selected: string) {
  const stageX = data.viewLevel === 'level1'
    ? new Map<string, number>([['input', 18], ['conversion', 220], ['medium', 430], ['distribution', 680], ['external', 930], ['unallocated', 930]])
    : new Map<string, number>([['input', 10], ['conversion', 180], ['medium', 350], ['distribution', 530], ['utilization', 720], ['external', 930], ['pending', 930]]);
  const stageColors: Record<string, string> = {
    input: '#1677FF',
    conversion: '#F79009',
    medium: '#00A870',
    distribution: '#23A35A',
    utilization: '#45B36B',
    external: '#7A5AF8',
    unallocated: '#98A2B3',
    pending: '#98A2B3',
  };
  const nodeWidth = data.viewLevel === 'level1' ? 118 : 112;
  const compactNodeHeight = 54;
  const conversionNodeHeight = 72;
  const nodeGap = 10;
  const columnOrder = data.viewLevel === 'level1'
    ? [['input'], ['conversion'], ['medium'], ['distribution'], ['external', 'unallocated']]
    : [['input'], ['conversion'], ['medium'], ['distribution'], ['utilization'], ['external', 'pending']];
  const grouped = columnOrder.map((stages) => data.nodes.filter((node) => stages.includes(node.stage)));
  const nodeHeightFor = (node: FlowAnalysisDataset['nodes'][number]) => node.stage === 'conversion' ? conversionNodeHeight : compactNodeHeight;
  const maxContentHeight = Math.max(
    ...grouped.map((nodes) => nodes.reduce((total, node) => total + nodeHeightFor(node), 0) + Math.max(nodes.length - 1, 0) * nodeGap),
    1,
  );
  const height = Math.max(390, maxContentHeight + 100);
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes) => {
    const contentHeight = nodes.reduce((total, node) => total + nodeHeightFor(node), 0) + Math.max(nodes.length - 1, 0) * nodeGap;
    const startY = 42 + Math.max((height - 58 - contentHeight) / 2, 0);
    let currentY = startY;
    nodes.forEach((node) => {
      positions.set(node.nodeId, { x: stageX.get(node.stage) ?? 0, y: currentY });
      currentY += nodeHeightFor(node) + nodeGap;
    });
  });
  const nodesById = new Map(data.nodes.map((node) => [node.nodeId, node]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  data.links.forEach((link) => {
    incoming.set(link.targetNodeId, [...(incoming.get(link.targetNodeId) ?? []), link.sourceNodeId]);
    outgoing.set(link.sourceNodeId, [...(outgoing.get(link.sourceNodeId) ?? []), link.targetNodeId]);
  });
  const related = new Set<string>();
  const visit = (nodeId: string, graph: Map<string, string[]>) => {
    if (related.has(nodeId)) return;
    related.add(nodeId);
    (graph.get(nodeId) ?? []).forEach((next) => visit(next, graph));
  };
  if (selected) {
    visit(selected, incoming);
    const ancestors = [...related];
    related.clear();
    visit(selected, outgoing);
    ancestors.forEach((nodeId) => related.add(nodeId));
  }
  const maxLink = Math.max(...data.links.map((link) => link.standardCoalAmount), 1);
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
  const links = data.links.map((link) => {
    const source = positions.get(link.sourceNodeId);
    const target = positions.get(link.targetNodeId);
    if (!source || !target || link.standardCoalAmount <= 0) return '';
    const x1 = source.x + nodeWidth;
    const y1 = source.y + nodeHeightFor(nodesById.get(link.sourceNodeId)!) / 2;
    const x2 = target.x;
    const y2 = target.y + nodeHeightFor(nodesById.get(link.targetNodeId)! ) / 2;
    const middle = (x1 + x2) / 2;
    const width = Math.max(3, Math.min(20, link.standardCoalAmount / maxLink * 20));
    const isRelated = !selected || (related.has(link.sourceNodeId) && related.has(link.targetNodeId));
    const active = selected && isRelated ? ' active' : '';
    const muted = selected && !isRelated ? ' muted' : '';
    const sourceStage = nodesById.get(link.sourceNodeId)?.stage ?? 'medium';
    const targetStage = nodesById.get(link.targetNodeId)?.stage;
    const stroke = targetStage === 'external' || targetStage === 'unallocated' || targetStage === 'pending'
      ? stageColors[targetStage]
      : stageColors[sourceStage];
    const title = link.tooltip ?? `${nodesById.get(link.sourceNodeId)?.name ?? ''} → ${nodesById.get(link.targetNodeId)?.name ?? ''}｜${format(link.standardCoalAmount, 1)} tce`;
    return `<path class="flow${active}${muted}" d="M${x1} ${y1} C${middle} ${y1},${middle} ${y2},${x2} ${y2}" stroke="${stroke}" stroke-width="${width}"><title>${escape(title)}</title></path>`;
  }).join('');
  const nodes = data.nodes.map((node) => {
    const position = positions.get(node.nodeId)!;
    const selectedClass = selected === node.nodeId ? ' selected' : '';
    const mutedClass = selected && !related.has(node.nodeId) ? ' muted' : '';
    const anomalyClass = node.anomalous ? ' anomalous' : '';
    const lineOne = node.name.length > 9 ? node.name.slice(0, 9) : node.name;
    const lineTwo = node.name.length > 9 ? node.name.slice(9, 18) : '';
    const valueY = lineTwo ? position.y + 45 : position.y + 34;
    const detailY = valueY + 13;
    const secondaryDetailY = detailY + 12;
    const nodeHeight = nodeHeightFor(node);
    return `<g class="node${selectedClass}${mutedClass}${anomalyClass}" data-key="${escape(node.nodeId)}"><title>${escape(`${node.name}｜${node.nodeType}｜${node.valueLabel}${node.detailLabel ? `｜${node.detailLabel}` : ''}${node.detailLabelSecondary ? `｜${node.detailLabelSecondary}` : ''}`)}</title><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="7" fill="#fff" stroke="${node.anomalous ? '#F04438' : stageColors[node.stage]}"/><rect x="${position.x}" y="${position.y}" width="7" height="${nodeHeight}" rx="3" fill="${node.anomalous ? '#F04438' : stageColors[node.stage]}"/><text x="${position.x + 16}" y="${position.y + 18}" font-size="11.5" fill="#172033">${escape(lineOne)}</text>${lineTwo ? `<text x="${position.x + 16}" y="${position.y + 31}" font-size="11.5" fill="#172033">${escape(lineTwo)}</text>` : ''}<text x="${position.x + 16}" y="${valueY}" font-size="10" fill="#5F6B7A">${escape(node.valueLabel)}</text>${node.detailLabel ? `<text x="${position.x + 16}" y="${detailY}" font-size="9.5" fill="#5F6B7A">${escape(node.detailLabel)}</text>` : ''}${node.detailLabelSecondary ? `<text x="${position.x + 16}" y="${secondaryDetailY}" font-size="9.5" fill="#5F6B7A">${escape(node.detailLabelSecondary)}</text>` : ''}</g>`;
  }).join('');
  const headings = data.viewLevel === 'level1'
    ? [
      ['企业边界输入', 18],
      ['能源转换', 220],
      ['厂内可供分配能源', 430],
      ['能源分配（一级用能单元）', 680],
      ['外部输出 / 未分配', 930],
    ].map(([label, x]) => `<text x="${x}" y="24" font-size="13" font-weight="700" fill="#172033">${label}</text>`).join('')
    : [
      ['企业边界输入', 10],
      ['能源转换', 180],
      ['厂内可供分配能源', 350],
      ['能源分配（一级）', 530],
      ['能源利用（二级）', 720],
      ['外部输出 / 待分解', 930],
    ].map(([label, x]) => `<text x="${x}" y="24" font-size="13" font-weight="700" fill="#172033">${label}</text>`).join('');
  return `<svg class="sankey" viewBox="0 0 1070 ${height}" aria-label="${escape(data.viewName)}">${headings}${links}${nodes}</svg>`;
}
