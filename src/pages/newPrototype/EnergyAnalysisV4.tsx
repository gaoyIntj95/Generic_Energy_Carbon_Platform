import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createEnergyQueryAnnualDetails,
  createEnergyQueryMonthlyDetails,
  energyAnalysisUnitLabels,
  energyQueryData,
  type BenchmarkType,
  type EnergyAnalysisPeriod,
  type EnergyAnalysisScope,
  type EnergyQueryRow,
  type EnergyQueryDayDetail,
  type EnergyQueryMonthDetail,
} from '../../mocks/energyAnalysisV4Mock';
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

const metricDigits = (value: number) =>
  value < 1 ? 3 : value < 10 ? 2 : value > 10000 ? 0 : 1;

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
        <span><small>月均折标量</small><b>{format(row.standardCoalAmount / 12, 1)} tce</b></span>
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
  const data = energyQueryData[applied.scope][applied.period];
  const monthMode = applied.period === 'month';
  const titleUnit = applied.scope === 'all' ? '全厂' : energyAnalysisUnitLabels[applied.scope];
  const maxTrend = Math.max(...data.trend) * 1.15;
  const rows = data.rows.length
    ? data.rows
    : energyQueryData.all[applied.period].rows.filter((row) => row.energyUnitName === titleUnit);
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
    const body = monthMode
      ? <MonthlyEnergyDetail row={row} details={createEnergyQueryMonthlyDetails(row)} period={appliedPeriodLabel} />
      : <AnnualEnergyDetail row={row} details={createEnergyQueryAnnualDetails(row)} period={appliedPeriodLabel} />;
    setDialog({
      title: `${monthMode ? '月度' : '年度'}能源消费明细｜${row.energyTypeName}`,
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
          <div className={styles.chartTitle}>能源消费趋势（{monthMode ? '2026年1—6月' : '2022—2026年'}）</div>
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
  const [applied, setApplied] = useState({ year: Number(savedFilters?.year ?? 2026), energyUnitId: savedFilters?.energyUnitId ?? 'all', deviceType: savedFilters?.deviceType ?? 'all', deviceId: savedFilters?.deviceId ?? 'all' });
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const rows = useMemo(() => { void version; return buildDeviceIntensityRows(applied.year, applied.deviceType, applied.energyUnitId, applied.deviceId); }, [applied, version]);
  const devices = useMemo(() => buildDeviceIntensityRows(Number(year) || 2026), [year]);
  const openParameterDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入') {
      openEnergyDataDialog(row);
      return;
    }
    let parameterValue = row.parameter?.value ? String(row.parameter.value) : '';
    let source = row.parameter?.source ?? '';
    const parameterLabel = row.metricCode === 'compressed-air-electricity' ? '年度供气量' : '年度蒸汽产量';
    setDialog({
      title: '补充数据',
      body: <>
        <DetailGrid items={[['具体缺失原因', row.resultReason ?? '缺少计算参数'], ['设备名称', row.deviceName], ['所属用能单元', row.energyUnitName], ['分析年度', `${applied.year}年`], ['设备类型', row.deviceType], ['年度能源消费', `${format(row.annualEnergy)} ${row.energyUnit}`], ['数据进度', row.dataProgress], ['典型指标', row.metricName], ['计算公式', row.formula]]} />
        <label className={styles.modalField}><span className={styles.required}>{parameterLabel}（{row.metricCode === 'compressed-air-electricity' ? 'Nm³' : 't'}）</span><input aria-label={parameterLabel} type="number" min="0" step="0.001" defaultValue={parameterValue} onChange={(event) => { parameterValue = event.target.value; }} /></label>
        <label className={styles.modalField}><span>数据来源说明（选填）</span><input aria-label="数据来源说明" defaultValue={source} onChange={(event) => { source = event.target.value; }} /></label>
      </>,
      submitText: '保存并计算',
      onSubmit: () => {
        const value = Number(parameterValue);
        if (!Number.isFinite(value) || value <= 0) { notify(`请填写${parameterLabel}`); return; }
        saveDeviceIntensityParameter({ deviceId: row.deviceId, year: applied.year, metricCode: row.metricCode as DeviceIntensityMetricCode, value, unit: row.metricCode === 'compressed-air-electricity' ? 'Nm³' : 't', source: source || undefined });
        setVersion((current) => current + 1);
        notify(row.completeEnergy ? '设备参数已保存，指标已重新计算' : '参数已保存，待能源数据完整后自动计算');
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
      onSubmit: () => navigate(deviceEnergyDataPath(row.deviceId, applied.year, row.metricCode, row.energyRecordId)),
    });
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    const boiler = row.metricCode === 'boiler-standard-coal';
    const basisItems: Array<[string, ReactNode]> = boiler
      ? [['能源消耗', `天然气消费量：${format(row.annualEnergy)} Nm³`], ['产出参数', `蒸汽产量：${format(row.parameter?.value)} t`], ['能源折算参数', `天然气折标系数：${row.standardCoalFactor} ${row.standardCoalFactorUnit}`]]
      : [['能源消耗', `电力消费量：${format(row.annualEnergy)} kWh`], ['产出参数', `供气量：${format(row.parameter?.value)} Nm³`]];
    setDialog({ title: '设备指标详情', body: <>
      <section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={[['设备名称', row.deviceName], ['所属用能单元', row.energyUnitName], ['指标名称', row.metricName], ['指标结果', `${format(row.value, 3)} ${row.metricUnit}`], ['统计期间', `${applied.year}年度`]]} /></section>
      <section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={basisItems} /></section>
      <section className={styles.modalSection}><h3>计算公式</h3><div className={styles.formulaBox}>{row.formula}</div></section>
    </>, cancelText: '关闭', submitText: '编辑参数', onSubmit: () => window.setTimeout(() => openParameterDialog(row), 0) });
  };
  const openUnavailableDialog = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => setDialog({
    title: '暂不可计算',
    body: <DetailGrid items={[['设备名称', row.deviceName], ['指标名称', row.metricName], ['结果状态', row.resultStatus], ['具体原因', row.resultReason ?? '当前设备暂不具备计算条件']]} />,
    cancelText: '关闭',
  });
  const openDeviceAction = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultStatus === '已计算') return openDetail(row);
    if (row.resultStatus === '待完善') {
      return row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入'
        ? openEnergyDataDialog(row)
        : openParameterDialog(row);
    }
    return openUnavailableDialog(row);
  };
  const deviceActionLabel = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    if (row.resultStatus === '已计算') return '查看详情';
    if (row.resultStatus === '待完善') {
      return row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' ? '补充能源数据' : '补充计算参数';
    }
    return '查看原因';
  };
  const query = () => { const next = { year: Number(year) || 2026, energyUnitId, deviceType, deviceId }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const reset = () => { setYear('2026'); setEnergyUnitId('all'); setDeviceType('all'); setDeviceId('all'); const next = { year: 2026, energyUnitId: 'all', deviceType: 'all', deviceId: 'all' }; setApplied(next); window.sessionStorage.setItem('energy-intensity-device-filters', JSON.stringify(next)); };
  const deviceTypes = [...new Set(devices.map((row) => row.deviceType))];
  const deviceOptions = devices.filter((row) => (deviceType === 'all' || row.deviceType === deviceType) && (energyUnitId === 'all' || row.energyUnitId === energyUnitId));
  const calculated = rows.filter((row) => row.resultStatus === '已计算').length;
  return <div className={styles.page}>
    <section className={`${styles.card} ${styles.filterCard}`}>
      <FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '用能单元'], ['product', '产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField>
      <FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select></FilterField>
      <FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField>
      <FilterField label="设备类型"><select aria-label="设备类型" value={deviceType} onChange={(event) => { setDeviceType(event.target.value); setDeviceId('all'); }}><option value="all">全部设备类型</option>{deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterField>
      <FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField>
      <div className={styles.filterSpacer} /><EnergyButton primary onClick={query}>查询</EnergyButton><EnergyButton onClick={reset}>重置</EnergyButton>
    </section>
    <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div><div className={styles.chartTitle}>重点设备典型能耗指标</div><div className={styles.subtleCount}>已识别 {rows.length} 台具备典型指标条件的重点设备，{calculated} 项已计算，{rows.length - calculated} 项待完善。</div></div></div><div className={styles.tableWrap}><table><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>年度能源消费</th><th>典型指标</th><th>指标结果</th><th>结果状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.deviceId}><td>{row.deviceName}</td><td>{row.energyUnitName}</td><td>{row.deviceType}</td><td>{format(row.annualEnergy)} {row.energyUnit}</td><td>{row.metricName}</td><td>{row.value === null ? '—' : `${format(row.value, 3)} ${row.metricUnit}`}</td><td><StatusTag tone={row.resultStatus === '已计算' ? 'ok' : 'warn'}>{row.resultStatus}</StatusTag></td><td><button type="button" className={styles.link} onClick={() => openDeviceAction(row)}>{deviceActionLabel(row)}</button></td></tr>)}</tbody></table></div></section>
      <div className={styles.slimNote}><div><i>i</i><span>重点设备指标仅对已匹配典型指标模板、能源数据完整且已补充必要产出参数的设备生成。其他重点设备仍用于下一页高耗能设备分析，不在本页强行计算能效指标。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} />
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
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['能源品种', row.energyTypeName], ['数据进度', row.dataProgress], ['已录入月份', entered], ['缺失月份', missing], ['具体原因', row.resultReason ?? '能源数据未录入']]} /><div className={styles.modalNote}>能源数据未完整时不生成正式年度指标。请补齐能源数据后重新计算。</div></>, submitText: '补充能源数据', onSubmit: () => navigate(deviceEnergyDataPath(row.deviceId, year, row.metricCode, row.energyRecordId)) });
  };
  const openParameter = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => {
    let value = row.parameter?.value ? String(row.parameter.value) : '';
    const label = row.metricCode === 'compressed-air-electricity' ? '年度供气量（Nm³）' : '年度蒸汽产量（t）';
    setDialog({ title: '数据待完善', body: <><DetailGrid items={[['重点设备', row.deviceName], ['分析年度', `${year}年度`], ['典型指标', row.metricName], ['具体原因', row.resultReason ?? '缺少计算参数']]} /><label className={styles.modalField}><span className={styles.required}>{label}</span><input aria-label={label} type="number" min="0" step="0.001" defaultValue={value} onChange={(event) => { value = event.target.value; }} /></label></>, submitText: '补充计算参数', onSubmit: () => { const parsed = Number(value); if (Number.isFinite(parsed) && parsed > 0) saveDeviceIntensityParameter({ deviceId: row.deviceId, year: Number(year), metricCode: row.metricCode as DeviceIntensityMetricCode, value: parsed, unit: row.metricCode === 'compressed-air-electricity' ? 'Nm³' : 't' }); } });
  };
  const openDetail = (row: ReturnType<typeof buildDeviceIntensityRows>[number]) => setDialog({ title: '指标计算详情', body: <><section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={[['分析对象', `${row.deviceName}｜重点设备`], ['指标名称', row.metricName], ['计算结果', `${format(row.value, 3)} ${row.metricUnit}`], ['统计期间', `${year}年度`]]} /></section><section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={row.metricCode === 'boiler-standard-coal' ? [['原始天然气消费量', `${format(row.annualEnergy)} Nm³`], ['天然气折标系数及来源', `${row.standardCoalFactor} ${row.standardCoalFactorUnit}｜能源品种参数`], ['年度折标综合能耗', `${format(row.annualEnergy * row.standardCoalFactor, 3)} tce`], ['年度蒸汽产量', `${format(row.parameter?.value)} t`], ['计算公式', '年度折标综合能耗 ×1000 ÷ 年度蒸汽产量']] : [['年度电耗', `${format(row.annualEnergy)} kWh`], ['年度供气量', `${format(row.parameter?.value)} Nm³`], ['计算公式', '年度电耗 ÷ 年度供气量']]} /></section><section className={styles.modalSection}><h3>数据来源</h3><DetailGrid items={[['能源数据来源', '数据管理—能源数据—重点设备'], ['参数来源', '重点设备指标计算参数'], ['最近计算时间', '2026-08-04']]} /></section></>, cancelText: '关闭', submitText: '编辑参数', onSubmit: () => openParameter(row) });
  };
  const deviceTypes = [...new Set(devices.map((row) => row.deviceType))];
  const deviceOptions = devices.filter((row) => (deviceType === 'all' || row.deviceType === deviceType) && (energyUnitId === 'all' || row.energyUnitId === energyUnitId));
  return <div className={styles.page}><section className={`${styles.card} ${styles.filterCard}`}><FilterField label="指标对象类型" wide><span className={styles.objectSegment}>{[['factory', '全厂'], ['unit', '用能单元'], ['product', '产品'], ['device', '重点设备']].map(([value, label]) => <button key={value} type="button" className={value === 'device' ? styles.active : ''} onClick={() => value !== 'device' && onTabChange(value as IntensityObjectType)}>{label}</button>)}</span></FilterField><FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option><option>2024</option></select></FilterField><FilterField label="所属用能单元"><select aria-label="所属用能单元" value={energyUnitId} onChange={(event) => { setEnergyUnitId(event.target.value); setDeviceId('all'); }}><option value="all">全部用能单元</option>{[...new Map(devices.map((row) => [row.energyUnitId, row.energyUnitName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FilterField><FilterField label="设备类型"><select aria-label="设备类型" value={deviceType} onChange={(event) => { setDeviceType(event.target.value); setDeviceId('all'); }}><option value="all">全部设备类型</option>{deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FilterField><FilterField label="具体设备" wide><select aria-label="具体设备" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="all">全部重点设备</option>{deviceOptions.map((row) => <option key={row.deviceId} value={row.deviceId}>{row.deviceName}</option>)}</select></FilterField></section><section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}><div className={styles.tableToolbar}><div className={styles.chartTitle}>重点设备典型能耗指标</div><div className={styles.subtleCount}>已识别 {rows.length} 台具备典型指标条件的重点设备，{calculated} 项已计算，{rows.length - calculated} 项待完善。</div></div><div className={styles.tableWrap}><table><thead><tr><th>重点设备</th><th>所属用能单元</th><th>设备类型</th><th>年度能源消费</th><th>典型指标</th><th>指标结果</th><th>结果状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.deviceId}><td>{row.deviceName}</td><td>{row.energyUnitName}</td><td>{row.deviceType}</td><td>{format(row.annualEnergy)} {row.energyUnit}</td><td>{row.metricName}</td><td>{row.value === null ? '—' : `${format(row.value, 3)} ${row.metricUnit}`}</td><td><StatusTag tone={row.resultStatus === '已计算' ? 'ok' : 'warn'}>{row.resultStatus}</StatusTag></td><td><button type="button" className={styles.link} onClick={() => row.resultStatus === '已计算' ? openDetail(row) : row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' ? openEnergyData(row) : row.resultReason ? openParameter(row) : openEnergyData(row)}>{row.resultStatus === '已计算' ? '查看详情' : row.resultReason === '能源数据未录入' || row.resultReason === '能源数据部分录入' ? '补充能源数据' : row.resultReason ? '补充计算参数' : '完善数据'}</button></td></tr>)}</tbody></table></div></section><div className={styles.slimNote}><div><i>i</i><span>重点设备仅对已匹配典型指标模板、能源数据完整且计算参数完整的设备生成正式指标。</span></div></div><EnergyDialog state={dialog} close={() => setDialog(null)} /><EnergyToast message={toast} /></div>;
}

} */

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
    const operationPath = `/data-management/operations?year=${year}${metricView.object.objectType === 'product' ? '' : `&keyword=${encodeURIComponent(metric.relatedProductName ?? metricView.object.objectName)}`}`;
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
    const calculationBasis: Array<[string, ReactNode]> = [
      ['分子数据', metric.numerator],
      ['分子来源', metricView.object.objectType === 'unit' ? `能源数据—${metricView.object.objectName}` : '能源数据—企业层级'],
      ['分母数据', metric.denominator],
      ['分母来源', '运营数据—产品产量'],
    ];
    setDialog({
      title: '指标计算详情',
      body: <>
        <section className={styles.modalSection}><h3>指标结果</h3><DetailGrid items={[['分析对象', `${metricView.object.objectName}（${objectLevel}）`], ['指标名称', metric.name], ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`], ['统计期间', metric.period], ['计算状态', status.label]]} /></section>
        <section className={styles.modalSection}><h3>计算依据</h3><DetailGrid items={calculationBasis} /></section>
        <section className={styles.modalSection}><h3>计算公式</h3><div className={styles.formulaBox}>{metric.formula}</div></section>
      </>,
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

      <section className={`${styles.card} ${styles.slimNote}`}>
        <div><strong>指标计算条件</strong><span>{view.object.objectName}（{applied.year}年）｜能源数据：{view.energyCondition.description}｜运营数据：{view.operationCondition.description}</span></div>
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
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>分析对象</th><th>指标名称</th><th>数值</th><th>单位</th><th>结果状态</th><th>操作</th></tr></thead>
            <tbody>
              {rows.map((metric) => (
                <tr key={metric.intensityMetricId}>
                  <td><span className={resultViews.length > 1 ? styles.treeBranch : ''}>{resultViews.length > 1 ? '⌞' : ''}</span>{metricObjectMap.get(metric.intensityMetricId)?.objectName ?? view.object.objectName}</td>
                  <td>{metric.name} <button type="button" aria-label={`查看${metric.name}口径`} className={styles.infoLink} onClick={() => openMetricDialog(metric, true, metricViewFor(metric))}>ⓘ</button></td>
                  <td>{metric.value === null ? '—' : format(metric.value, metricDigits(metric.value))}</td>
                  <td>{metric.unit}</td>
                  <td>{(() => { const status = intensityStatus(metric); return <><StatusTag tone={status.tone}>{status.label}</StatusTag>{status.reason && <small title={status.reason}>具体原因：{status.reason}</small>}</>; })()}</td>
                  <td><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true, metricViewFor(metric))}>{metric.resultType === 'warn' ? '完善数据' : '查看详情'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [year, setYear] = useState('2026');
  const [type, setType] = useState<BenchmarkType>(initialDeviceId ? 'device' : 'all');
  const [objectId, setObjectId] = useState(initialDeviceId);
  const [selectedId, setSelectedId] = useState(initialDeviceId ? '' : 'benchmark-enterprise-factory-factory-added-value-energy');
  const [grain, setGrain] = useState<'month' | 'quarter' | 'year'>('month');
  const [dataVersion, setDataVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();

  const dataset = useMemo(() => {
    void dataVersion;
    return buildBenchmarkDataset(Number(year) || 2026);
  }, [year, dataVersion]);
  const metrics = dataset.rows;
  // “全部” follows the intensity page's factory scope; it is not an
  // aggregation of factory, unit, product and device rows.
  const filteredRows = type === 'all'
    ? metrics.filter((row) => row.objectTypeKey === 'enterprise')
    : metrics.filter((row) => row.objectTypeKey === type);
  const objects = [...new Map(filteredRows.map((row) => [row.objectId, row])).values()];
  const selected = metrics.find((row) => row.benchmarkMetricId === selectedId)
    ?? filteredRows[0]
    ?? metrics[0]
    ?? null;

  const activeObjectId = objectId || objects[0]?.objectId || '';
  const metricRows = type === 'all' ? [] : filteredRows.filter((row) => row.objectId === activeObjectId);
  const noData = filteredRows.length === 0;
  const unavailableReason = type === 'all'
    ? '当前年度没有可用于对标的数据。'
    : dataset.unavailableReasons[type];
  const selectedAvailable = Boolean(selected?.available);
  const displayGrain = selected?.trend.length === 12 ? grain : 'year';
  const targetConfigured = Boolean(selected?.targetConfigured && selected.target > 0);
  const good = selected && targetConfigured ? isBenchmarkGood(selected) : false;
  const deviation = targetConfigured && selected ? (selected.actual - selected.target) / selected.target * 100 : 0;
  const absoluteGap = targetConfigured && selected ? selected.actual - selected.target : 0;

  const selectType = (nextType: BenchmarkType) => {
    setType(nextType);
    if (nextType === 'all') {
      setObjectId('');
      setSelectedId(metrics.find((row) => row.objectTypeKey === 'enterprise' && row.metricCode === 'energy_per_added_value')?.benchmarkMetricId ?? filteredRows[0]?.benchmarkMetricId ?? '');
      return;
    }
    const first = metrics.find((row) => row.objectTypeKey === nextType);
    setObjectId(first?.objectId ?? '');
      setSelectedId(first?.benchmarkMetricId ?? '');
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
          <FilterField label="目标年度"><input value={year} readOnly /></FilterField>
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
            year: Number(year) || 2026,
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
    setDialog({
      title: '指标口径说明',
      body: (
        <div className={styles.modalForm}>
          <FilterField label="对标对象"><input value={selected.objectName} readOnly /></FilterField>
          <FilterField label={isDevice ? '所属用能单元' : '统计范围'}><input value={selected.scopeNames.join('、') || (isDevice ? '尚未关联用能单元' : '尚未关联生产单元')} readOnly /></FilterField>
          <FilterField label="能源口径"><input value={selected.energyScopeDescription} readOnly /></FilterField>
          <FilterField label={isDevice ? '指标口径' : '产量口径'}><input value={selected.outputScopeDescription} readOnly /></FilterField>
          <FilterField label={isDevice ? '数据归属方式' : '能源归属方式'}><input value={selected.allocationDescription} readOnly /></FilterField>
          <FilterField label="统计期间"><input value={selected.periodDescription} readOnly /></FilterField>
          <div className={`${styles.modalNote} ${styles.full}`}>
            <strong>计算公式：</strong>{selected.formulaDescription}<br />
            {isDevice
              ? '设备指标只读取通过稳定设备ID关联的设备级能源记录，不使用所属用能单元总量代替，也不重复计入组织汇总。'
              : '分子、分母按相同年度和生产范围汇总；共线生产仅采用已确认的独立计量或能源分摊比例。'}
          </div>
        </div>
      ),
    });
  };

  const goToData = (path: string) => navigate(path);

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard} ${styles.benchmarkFilters}`}>
        <FilterField label="分析年度"><select aria-label="分析年度" value={year} onChange={(event) => setYear(event.target.value)}><option value="2026">2026年</option><option value="2025">2025年</option><option value="2024">2024年</option></select></FilterField>
        <FilterField label="对象类型">
          <span className={styles.objectSegment}>
            {([
              ['all', '全厂'],
              ['unit', '用能单元'],
              ['product', '产品'],
              ['device', '设备'],
            ] as Array<[BenchmarkType, string]>).map(([value, label]) => (
              <button type="button" key={value} className={type === value ? styles.active : ''} onClick={() => selectType(value)}>{label}</button>
            ))}
          </span>
        </FilterField>
        <FilterField label="对标对象" wide>
          <select
            aria-label="对标对象"
            disabled={type === 'all'}
            value={activeObjectId}
            onChange={(event) => {
              const next = event.target.value;
              setObjectId(next);
              const first = filteredRows.find((row) => row.objectId === next);
              if (first) setSelectedId(first.benchmarkMetricId);
            }}
          >
            {type === 'all'
              ? <option value="">全厂</option>
              : objects.length
                ? objects.map((item) => <option key={item.objectId} value={item.objectId}>{item.objectName}｜{item.availabilityLabel}{item.available ? '' : `：${item.unavailableReason}`}</option>)
                : <option value="">暂无已维护对象</option>}
          </select>
        </FilterField>
        {type !== 'all' && <FilterField label="指标" wide>
          <select aria-label="指标" disabled={metricRows.length === 0} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {metricRows.length
              ? metricRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.metricName}</option>)
              : <option value="">暂无已维护指标</option>}
          </select>
        </FilterField>}
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={displayGrain} onChange={(event) => setGrain(event.target.value as typeof grain)}>
            {selected?.trend.length === 12 && <><option value="month">月度</option><option value="quarter">季度</option></>}
            <option value="year">年度</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => notify('对标结果已更新')}>查询</EnergyButton>
        <EnergyButton onClick={() => { setYear('2026'); setType('all'); setObjectId(''); setSelectedId('benchmark-enterprise-factory-factory-added-value-energy'); setGrain('month'); notify('筛选条件已重置'); }}>重置</EnergyButton>
      </section>

      {noData || !selected ? (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <strong>暂无可计算指标</strong>
          <span>原因：{unavailableReason}</span>
          <small>
            {type === 'device' && '设备对标需要重点设备台账和设备级能源计量记录。'}
            {type === 'product' && '请先维护产品产量、生产单元关系及必要的能源分摊规则。'}
            {type === 'unit' && '请确保用能单元在同一年度具备能源消费和运营数据。'}
          </small>
          {type === 'device' && <div className={styles.emptyActions}><EnergyButton primary onClick={() => goToData('/data-management/devices')}>新增重点设备</EnergyButton></div>}
        </section>
      ) : (
        <>
          {selectedAvailable ? <>
            <section className={`${styles.card} ${styles.benchmarkSummary}`} aria-label="指标摘要">
              <div><span>当前值</span><strong>{format(selected.actual, metricDigits(selected.actual))}<small>{selected.unit}</small></strong></div>
              <div><span>目标值</span><strong>{targetConfigured ? <>{format(selected.target, metricDigits(selected.target))}<small>{selected.unit}</small></> : '未配置'}</strong></div>
              <div><span>差距</span><strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? <>{absoluteGap > 0 ? '+' : ''}{format(absoluteGap, metricDigits(Math.abs(absoluteGap)))}<small>{selected.unit}</small></> : '—'}</strong></div>
              <div><span>对标状态</span><strong className={targetConfigured ? good ? styles.down : styles.up : ''}>{targetConfigured ? good ? '达标' : '未达标' : '未配置目标'}</strong></div>
            </section>
            <div className={styles.benchmarkMain}>
            <section className={`${styles.card} ${styles.benchmarkChart}`}>
              <div className={styles.benchmarkHead}>
                <div><div className={styles.chartTitle}>指标趋势（{selected.metricName}）</div><div className={styles.chartSub}>{selected.objectName}｜单位：{selected.unit}{selected.trend.length === 12 ? `｜${selected.trendBasisLabel ?? '月度趋势'}` : '｜当前按年度展示'}</div></div>
<EnergyButton outline disabled={!selectedAvailable} onClick={openTarget}>指标目标配置</EnergyButton>
              </div>
              <div className={styles.lineChart} dangerouslySetInnerHTML={{ __html: benchmarkLineSvg(selected, displayGrain, Number(year) || 2026) }} />
            </section>
            <section className={`${styles.card} ${styles.benchmarkInsight}`}>
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
            </section>
            </div>
          </> : <section className={`${styles.card} ${styles.emptyState}`}>
            <strong>{selected.objectName}｜待完善</strong>
            <span>{selected.objectTypeKey === 'device' ? '已维护重点设备，但尚未录入设备级能源数据，暂无法形成设备用能指标。' : '当前产品暂无法计算单位产品综合能耗。'}</span>
            <small>原因：{selected.unavailableReason}</small>
            <div className={styles.emptyActions}>
              {selected.objectTypeKey === 'device'
                ? <EnergyButton primary onClick={() => goToData(deviceEnergyDataPath(selected.objectId, year, selected.metricCode, selected.energyRecordIds[0]))}>录入设备能源数据</EnergyButton>
                : selected.unavailableReason.includes('目标值')
                ? <EnergyButton primary onClick={openTarget}>配置指标目标</EnergyButton>
                : <EnergyButton primary onClick={() => goToData('/data-management/operations')}>补充产品及运营数据</EnergyButton>}
              {selected.unavailableReason.includes('能源数据') && <EnergyButton onClick={() => goToData(selected.objectTypeKey === 'device' ? deviceEnergyDataPath(selected.objectId, year, selected.metricCode, selected.energyRecordIds[0]) : `/data-management/energy-data?year=${year}`)}>补充能源数据</EnergyButton>}
              <EnergyButton outline onClick={openBasis}>查看所需口径</EnergyButton>
            </div>
          </section>}
          <section className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.tableToolbar}><div><div className={styles.chartTitle}>{type === 'all' ? '全厂指标对标明细' : type === 'product' ? '全部产品指标对标明细' : type === 'device' ? '设备用能与能效对标明细' : '指标对标明细'}（{year}年）</div>{type === 'product' && <div className={styles.chartSub}>点击产品行可联动切换上方单产品趋势与口径。</div>}{type === 'device' && <div className={styles.chartSub}>设备消费量来自重点设备独立能源记录；具备运行时长、产量或供气量等分母前，不虚构设备效率指标。</div>}</div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead>{type === 'device'
                  ? <tr><th>对标对象</th><th>所属用能单元</th><th>指标名称</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>数据完整度</th><th>状态</th></tr>
                  : <tr><th>对标对象</th><th>对象类型</th><th>指标名称</th><th>单位</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>状态</th></tr>}</thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const rowGood = isBenchmarkGood(row);
                    const rowDeviation = row.available && row.targetConfigured && row.target > 0 ? (row.actual - row.target) / row.target * 100 : null;
                    const rowStatus = !row.available ? '待录入' : !row.targetConfigured ? '未配置目标' : rowGood ? '达标' : '未达标';
                    return (
                      <tr key={row.benchmarkMetricId} className={row.benchmarkMetricId === selected.benchmarkMetricId ? styles.selectedRow : ''} title={row.available ? '' : row.unavailableReason} onClick={() => { setSelectedId(row.benchmarkMetricId); setObjectId(row.objectId); }}>
                        {type === 'device' ? <>
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

function benchmarkLineSvg(row: BenchmarkMetric, grain: 'month' | 'quarter' | 'year', year: number) {
  const hasMonthlyTrend = row.trend.length === 12;
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
  const height = 300;
  const padding = { left: 55, right: 36, top: 28, bottom: 46 };
  const scaleValues = targetValues ? [...values, ...targetValues] : values;
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);
  const span = max - min || 1;
  const low = min - span * 0.35;
  const high = max + span * 0.25;
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
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="指标趋势图">${grid}${targetGraphic}${values.length > 1 ? `<polyline points="${points}" fill="none" stroke="#1677FF" stroke-width="3"/>` : ''}${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="5" fill="#fff" stroke="#1677FF" stroke-width="2"/><text x="${x(index)}" y="${y(value) - 11}" text-anchor="middle" font-size="11" fill="#365A7A">${format(value, metricDigits(value))}</text><text x="${x(index)}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#667085">${labels[index]}</text>`).join('')}</svg>`;
}

type FlowTab = 'diagram' | 'balance' | 'detail';
type FlowHoverState = { nodeId: string; x: number; y: number } | null;

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
          <div className={styles.flowHeadActions}>
            <span className={styles.flowScopeLabel}><strong>{data.viewName}</strong></span>
          </div>
        </div>

        {tab === 'diagram' && (
          <>
            <div className={styles.flowLegend}>
              <span><i style={{ background: '#1677FF' }} />企业能源输入</span>
              <span><i style={{ background: '#F79009' }} />能源转换</span>
              <span><i style={{ background: '#00A870' }} />厂内能源介质</span>
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
              一期展示企业能源输入、转换及向一级用能单元的分配。
              缺少专线计量或明确分配规则时，系统不推断能源来源比例；未分配量是厂内能源尚未完整分配到一级用能单元的管理口径差额，不等同于物理损失。
            </div>
            <ClosedLoopFlowRank data={data} />
          </>
        )}
        {tab === 'balance' && (
          <ClosedLoopBalanceTable
            data={data}
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

function ClosedLoopFlowRank({ data }: { data: FlowAnalysisDataset }) {
  const max = Math.max(...data.rankRows.map((row) => row.standardCoalAmount), 1);
  return (
    <section className={styles.rankCard}>
      <div className={styles.rankHead}>
        <div>
          <div className={styles.chartTitle}>{data.viewLevel === 'level1' ? '重点用能单元 TOP5' : '二级能源利用对象 TOP5'}</div>
          <div className={styles.chartSub}>
            {data.viewLevel === 'level1'
              ? '按一级用能单元能源分配量排序｜折标量口径'
              : '按二级能源利用量排序｜折标量口径'}
          </div>
        </div>
        <StatusTag tone="check">{data.rankRows.length} 个对象</StatusTag>
      </div>
      <div className={styles.rankList}>
        {data.rankRows.map((row, index) => (
          <div key={row.energyUnitId}>
            <b>{index + 1}</b><span title={row.name}>{row.name}</span>
            <i><em style={{ width: `${Math.max(row.standardCoalAmount / max * 100, 3)}%` }} /></i>
            <span>{format(row.standardCoalAmount, 1)} tce</span><span>{format(row.share, 1)}%</span>
          </div>
        ))}
        {data.rankRows.length === 0 && <div className={styles.rankEmpty}>当前范围尚无可排名的下级能源利用记录。</div>}
      </div>
    </section>
  );
}

function ClosedLoopBalanceTable({
  data,
  showUnallocated,
}: {
  data: FlowAnalysisDataset;
  showUnallocated: () => void;
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
  return (
    <div className={styles.balanceCard}>
      <div className={styles.balanceHead}>
        <div>
          <div className={styles.chartTitle}>能源平衡表</div>
          <div className={styles.balanceCaption}>
            {data.viewLevel === 'level1'
              ? '管理口径平衡，不等同于设备级专业热平衡；内部回收能源与外部输入分开统计。'
              : '按一级分配量和二级利用量核对能源去向；上下级数据仅作层级核对，不重复计入企业总量。'}
          </div>
        </div>
        <StatusTag tone="check">{data.viewLevel === 'level1' ? '一级分配口径' : '二级利用口径'}</StatusTag>
      </div>
      <div className={styles.tableWrap}>
        {data.viewLevel === 'level1' ? (
          <table>
            <thead><tr><th>能源品种</th><th>外部输入</th><th>内部回收</th><th>转换投入</th><th>转换产出</th><th>内部分配</th><th>外部输出</th><th>未归属</th><th>平衡状态</th></tr></thead>
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
        {data.viewLevel === 'level1'
          ? '平衡关系：外部输入 + 内部回收 + 转换产出 = 转换投入 + 内部分配 + 外部输出 + 未归属。转换损失按各转换关系的投入与有效产出差额单独计算。'
          : '层级关系：一级分配量 = 二级利用量 + 待细分量。二级利用超过一级分配时提示核验，不生成负值流向。'}
      </div>
    </div>
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
  const dataNature = (row: ClosedLoopFlowDetailRow) => {
    if (row.stage === '未分配' || row.stage === '待分解') return '管理差额';
    if (row.stage === '能源转换') return '计算';
    if (row.stage === '能源分配' || row.traceRecords.length > 1) return '汇总';
    return row.traceRecords.some((trace) => trace.sourceType.includes('记录')) ? '实测' : '实测/核算';
  };
  const stageTone = (row: ClosedLoopFlowDetailRow) =>
    row.stage === '未分配' || row.stage === '待分解'
      ? 'warn'
      : row.stage === '能源转换'
        ? 'check'
        : 'ok';
  return (
    <div className={styles.flowDetailTab}>
      <div className={styles.tableToolbar}>
        <div>
          <div className={styles.chartTitle}>能源流向明细</div>
          <div className={styles.subtleCount}>用于核对每条能源流的来源、去向、能流阶段和数据口径，共 {rows.length} 条。</div>
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
          <thead><tr><th>来源</th><th>去向</th><th>能源品种</th><th>折标量</th><th>能流阶段</th><th>数据性质</th><th>追溯</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.flowDetailId}>
              <td>{row.source}</td>
              <td>{row.target}</td>
              <td>{row.energyTypeName}</td>
              <td>{format(row.standardCoalAmount, row.standardCoalAmount < 10 ? 2 : 1)} tce</td>
              <td><StatusTag tone={stageTone(row)}>{stageDisplay(row.stage)}</StatusTag></td>
              <td>{dataNature(row)}</td>
              <td><button type="button" className={styles.link} onClick={() => open(row)}>{row.traceRecords.length ? '查看追溯' : '查看构成'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length === 0 && <div className={styles.emptyState}><strong>没有符合条件的流向记录</strong><span>请调整筛选条件后重试。</span></div>}
    </div>
  );
}

function FlowTraceDrawer({ row, close }: { row: ClosedLoopFlowDetailRow | null; close: () => void }) {
  if (!row) return null;
  return (
    <div className={styles.drawerOverlay} onClick={close}>
      <aside className={styles.traceDrawer} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><h2>能源流向数据追溯</h2><span>{row.stage}｜{row.energyTypeName}</span></div>
          <button type="button" aria-label="关闭追溯抽屉" onClick={close}>×</button>
        </header>
        <div className={styles.traceDrawerBody}>
          <DetailGrid items={[
            ['来源', row.source],
            ['去向', row.target],
            ['能源量', `${format(row.amount, row.amount < 10 ? 2 : 1)} ${row.amountUnit}`],
            ['所属用能单元', row.energyUnitName],
          ]} />
          <section className={styles.traceSection}>
            <h3>对应数据管理记录</h3>
            <p>{row.traceDescription}</p>
            {row.traceRecords.length > 0 ? row.traceRecords.map((trace) => (
              <div className={styles.traceRecord} key={trace.recordId}>
                <div><span>记录编号</span><strong>{trace.recordId}</strong></div>
                <div><span>原始实物量</span><strong>{format(trace.originalAmount, trace.originalAmount < 10 ? 2 : 1)} {trace.originalUnit}</strong></div>
                <div><span>折标量</span><strong>{format(trace.standardCoalAmount, 2)} tce</strong></div>
                <div><span>折标系数</span><strong>{trace.factorDescription}</strong></div>
                <div><span>数据期间</span><strong>{trace.periodLabel}</strong></div>
                <div><span>数据来源类型</span><strong>{trace.sourceType}</strong></div>
                <div><span>对应转换/输出记录</span><strong>{trace.relatedRecordId}</strong></div>
                <div><span>最近修改时间</span><strong>{trace.updatedAt}</strong></div>
              </div>
            )) : (
              <div className={styles.modalNote}>该项由管理平衡关系计算，没有独立的上游数据记录。可返回流向明细查看其能源品种构成。</div>
            )}
          </section>
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
  const nodeHeight = 54;
  const columnOrder = data.viewLevel === 'level1'
    ? [['input'], ['conversion'], ['medium'], ['distribution'], ['external', 'unallocated']]
    : [['input'], ['conversion'], ['medium'], ['distribution'], ['utilization'], ['external', 'pending']];
  const grouped = columnOrder.map((stages) => data.nodes.filter((node) => stages.includes(node.stage)));
  const maxRows = Math.max(...grouped.map((nodes) => nodes.length), 1);
  const height = Math.max(390, maxRows * 64 + 62);
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes) => {
    const contentHeight = nodes.length * nodeHeight + Math.max(nodes.length - 1, 0) * 10;
    const startY = 42 + Math.max((height - 58 - contentHeight) / 2, 0);
    nodes.forEach((node, index) => positions.set(node.nodeId, { x: stageX.get(node.stage) ?? 0, y: startY + index * 64 }));
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
    const y1 = source.y + nodeHeight / 2;
    const x2 = target.x;
    const y2 = target.y + nodeHeight / 2;
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
    const valueY = lineTwo ? position.y + 46 : position.y + 39;
    return `<g class="node${selectedClass}${mutedClass}${anomalyClass}" data-key="${escape(node.nodeId)}"><title>${escape(`${node.name}｜${node.nodeType}｜${node.valueLabel}`)}</title><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="7" fill="#fff" stroke="${node.anomalous ? '#F04438' : stageColors[node.stage]}"/><rect x="${position.x}" y="${position.y}" width="7" height="${nodeHeight}" rx="3" fill="${node.anomalous ? '#F04438' : stageColors[node.stage]}"/><text x="${position.x + 16}" y="${position.y + 18}" font-size="11.5" fill="#172033">${escape(lineOne)}</text>${lineTwo ? `<text x="${position.x + 16}" y="${position.y + 31}" font-size="11.5" fill="#172033">${escape(lineTwo)}</text>` : ''}<text x="${position.x + 16}" y="${valueY}" font-size="10" fill="#5F6B7A">${escape(node.valueLabel)}</text></g>`;
  }).join('');
  const headings = data.viewLevel === 'level1'
    ? [
      ['能源输入', 18],
      ['能源转换', 220],
      ['厂内能源介质', 430],
      ['能源分配（一级用能单元）', 680],
      ['外部输出 / 未分配', 930],
    ].map(([label, x]) => `<text x="${x}" y="24" font-size="13" font-weight="700" fill="#172033">${label}</text>`).join('')
    : [
      ['能源输入', 10],
      ['能源转换', 180],
      ['厂内能源介质', 350],
      ['能源分配（一级）', 530],
      ['能源利用（二级）', 720],
      ['外部输出 / 待分解', 930],
    ].map(([label, x]) => `<text x="${x}" y="24" font-size="13" font-weight="700" fill="#172033">${label}</text>`).join('');
  return `<svg class="sankey" viewBox="0 0 1070 ${height}" aria-label="${escape(data.viewName)}">${headings}${links}${nodes}</svg>`;
}
