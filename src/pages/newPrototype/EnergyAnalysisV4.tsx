import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
  listIntensityObjects,
  type CalculatedIntensityMetric,
  type IntensityObjectType,
} from '../../mocks/energyIntensitySelector';
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

function EnergyButton({
  children,
  primary,
  outline,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  outline?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`${styles.button} ${primary ? styles.buttonPrimary : ''} ${outline ? styles.buttonOutline : ''}`}
      onClick={onClick}
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
          <EnergyButton onClick={close}>{state.onSubmit ? '取消' : '关闭'}</EnergyButton>
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
          <input
            aria-label="时间"
            type={draftPeriod === 'month' ? 'month' : 'number'}
            value={draftTime}
            onChange={(event) => setDraftTime(event.target.value)}
          />
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
        <EnergyButton onClick={() => notify('能源消费明细已导出')}>⇩ 导出明细</EnergyButton>
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

function IntensityPage() {
  const [draftYear, setDraftYear] = useState('2026');
  const [draftObjectType, setDraftObjectType] = useState<IntensityObjectType>('factory');
  const [draftObjectId, setDraftObjectId] = useState('factory');
  const [applied, setApplied] = useState({
    year: 2026,
    objectType: 'factory' as IntensityObjectType,
    objectId: 'factory',
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const draftObjects = listIntensityObjects(draftObjectType);
  const view = useMemo(
    () => buildIntensityCalculationView(applied.year, applied.objectType, applied.objectId),
    [applied],
  );
  const rows = view.metrics;
  const calculatedCount = rows.filter((row) => row.resultType === 'ok').length;
  const pendingCount = rows.filter((row) => row.resultType === 'warn').length;

  const openMetricDialog = (metric: CalculatedIntensityMetric, action: boolean) => {
    if (action && metric.resultType === 'warn') {
      setDialog({
        title: '补充指标数据',
        body: (
          <>
            <DetailGrid items={[
              ['分析对象', view.object.objectName],
              ['指标名称', metric.name],
              ['当前分子', metric.numerator],
              ['当前分母', metric.denominator],
            ]} />
            <div className={styles.modalNote}>
              <strong>待补充原因：</strong>{metric.issue}<br />
              请在“数据管理—能源数据”或“数据管理—运营数据”补充相同年度、相同用能单元的数据；系统将按当前分析对象自动匹配并重新计算。
            </div>
          </>
        ),
        submitText: '前往数据管理',
        onSubmit: () => notify('已定位数据管理，请按当前分析对象补充数据'),
      });
      return;
    }
    setDialog({
      title: '指标计算详情',
      body: (
        <>
          <DetailGrid items={[
            ['分析对象', view.object.objectName],
            ['指标名称', metric.name],
            ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`],
            ['分子', metric.numerator],
            ['分母', metric.denominator],
            ['统计期间', metric.period],
            ['数据来源', metric.source],
          ]} />
          <div className={styles.formulaBox}><strong>计算公式：</strong>{metric.formula}</div>
          <div className={styles.modalNote}>
            <strong>数据追溯：</strong>
            已关联能源记录 {metric.energyRecordIds.length} 条、运营记录 {metric.operationMetricIds.length} 条；具体源数据可在数据管理中查看。
          </div>
        </>
      ),
    });
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard}`}>
        <FilterField label="分析年度">
          <input aria-label="分析年度" type="number" value={draftYear} onChange={(event) => setDraftYear(event.target.value)} />
        </FilterField>
        <FilterField label="分析对象" wide>
          <select
            aria-label="分析对象"
            value={draftObjectType}
            onChange={(event) => {
              const next = event.target.value as IntensityObjectType;
              setDraftObjectType(next);
              setDraftObjectId(listIntensityObjects(next)[0]?.objectId ?? 'factory');
            }}
          >
            <option value="factory">全厂</option>
            <option value="production">生产单元</option>
            <option value="utility">公辅系统</option>
          </select>
        </FilterField>
        {draftObjectType !== 'factory' && (
          <FilterField label="具体对象" wide>
            <select aria-label="具体对象" value={draftObjectId} onChange={(event) => setDraftObjectId(event.target.value)}>
              {draftObjects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectName}</option>)}
            </select>
          </FilterField>
        )}
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => {
          setApplied({
            year: Number(draftYear) || 2026,
            objectType: draftObjectType,
            objectId: draftObjectType === 'factory' ? 'factory' : draftObjectId,
          });
          notify('已按分析对象匹配能源数据与运营数据');
        }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026');
          setDraftObjectType('factory');
          setDraftObjectId('factory');
          setApplied({ year: 2026, objectType: 'factory', objectId: 'factory' });
          notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.tableCard} ${styles.intensityResults}`}>
        <div className={styles.tableToolbar}>
          <div>
            <div className={styles.chartTitle}>指标结果明细</div>
            <div className={styles.subtleCount}>
              {view.object.objectName}已生成 {rows.length} 项指标，其中 {calculatedCount} 项已计算
              {pendingCount ? `，${pendingCount} 项待完善` : ''}
            </div>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>序号</th><th>指标名称</th><th>数值</th><th>单位</th><th>同比</th><th>结果状态</th><th>操作</th></tr></thead>
            <tbody>
              {rows.map((metric, index) => (
                <tr key={metric.intensityMetricId}>
                  <td>{index + 1}</td>
                  <td>{metric.name} <button type="button" aria-label={`查看${metric.name}口径`} className={styles.infoLink} onClick={() => openMetricDialog(metric, false)}>ⓘ</button></td>
                  <td>{metric.value === null ? '—' : format(metric.value, metricDigits(metric.value))}</td>
                  <td>{metric.unit}</td>
                  <td className={metric.yearOnYear === null ? styles.muted : metric.yearOnYear < 0 ? styles.down : styles.up}>{percent(metric.yearOnYear)}</td>
                  <td><StatusTag tone={metric.resultType}>{metric.resultType === 'warn' ? '待完善' : '已计算'}</StatusTag></td>
                  <td><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true)}>{metric.resultType === 'warn' ? '完善数据' : '查看详情'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${styles.card} ${styles.calculationCondition}`}>
        <div className={styles.conditionHeader}>
          <div>
            <h2>指标计算条件</h2>
            <p>辅助说明当前分析对象的数据关联情况，以及暂未形成指标结果的原因。</p>
          </div>
          <StatusTag tone={pendingCount ? 'warn' : 'ok'}>{pendingCount ? '存在待完善项' : '数据已关联'}</StatusTag>
        </div>
        <div className={styles.conditionSummary}>
          <span><b>分析对象</b>{view.object.objectName}（{applied.year}年）</span>
          <span><b>能源数据</b>{view.energyCondition.description}</span>
          <span><b>运营数据</b>{view.operationCondition.description}</span>
        </div>
        {view.pendingReasons.length > 0 && (
          <div className={styles.conditionReasons}>
            <strong>待完善原因：</strong>缺少{view.pendingReasons.join('；缺少')}。
          </div>
        )}
      </section>

      <div className={styles.slimNote}>
        <div><i>i</i><span>指标按当前分析对象自动关联能源数据与运营数据，计算依据：GB/T 2589—2020。</span></div>
        <button type="button" className={styles.link} onClick={() => setDialog({
          title: '能耗强度计算口径',
          body: (
            <>
              <div className={styles.formulaBox}>
                <strong>单位产品综合能耗</strong>＝综合能耗 ÷ 产品产量<br />
                <strong>单位产品电耗</strong>＝电力消费量 ÷ 产品产量<br />
                <strong>单位产值综合能耗</strong>＝综合能耗 ÷ 工业总产值<br />
                <strong>单位增加值综合能耗</strong>＝综合能耗 ÷ 工业增加值
              </div>
              <div className={styles.modalNote}>分子与分母必须属于同一分析对象和统计期间；缺少必要能源数据或运营数据时，指标状态显示“待完善”。</div>
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
  const [year, setYear] = useState('2026');
  const [type, setType] = useState<BenchmarkType>('all');
  const [objectId, setObjectId] = useState('');
  const [selectedId, setSelectedId] = useState('benchmark-enterprise-added-value');
  const [grain, setGrain] = useState<'month' | 'quarter' | 'year'>('month');
  const [dataVersion, setDataVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();

  const dataset = useMemo(() => {
    void dataVersion;
    return buildBenchmarkDataset(Number(year) || 2026);
  }, [year, dataVersion]);
  const metrics = dataset.rows;
  const filteredRows = type === 'all'
    ? metrics
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
  const targetConfigured = Boolean(selected?.targetConfigured && selected.target > 0);
  const good = selected && targetConfigured ? isBenchmarkGood(selected) : false;
  const deviation = targetConfigured && selected ? (selected.actual - selected.target) / selected.target * 100 : 0;
  const absoluteGap = targetConfigured && selected ? selected.actual - selected.target : 0;

  const selectType = (nextType: BenchmarkType) => {
    setType(nextType);
    if (nextType === 'all') {
      setObjectId('');
      setSelectedId(metrics[0]?.benchmarkMetricId ?? '');
      return;
    }
    const first = metrics.find((row) => row.objectTypeKey === nextType);
    setObjectId(first?.objectId ?? '');
    setSelectedId(first?.benchmarkMetricId ?? 'b1');
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
          <div className={`${styles.modalNote} ${styles.full}`}>年度目标用于年度结果判断；未配置月度目标时，月度趋势仅展示实际值，不将年度目标直接作为月度目标线。</div>
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
      <div className={styles.headAction}><EnergyButton outline onClick={openTarget}>⚙ 指标目标配置</EnergyButton></div>
      <section className={`${styles.card} ${styles.filterCard} ${styles.benchmarkFilters}`}>
        <FilterField label="分析年度"><input aria-label="分析年度" type="number" value={year} onChange={(event) => setYear(event.target.value)} /></FilterField>
        <FilterField label="对象类型">
          <span className={styles.objectSegment}>
            {([
              ['all', '全部'],
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
              ? <option value="">选择对象</option>
              : objects.length
                ? objects.map((item) => <option key={item.objectId} value={item.objectId}>{item.objectName}｜{item.availabilityLabel}{item.available ? '' : `：${item.unavailableReason}`}</option>)
                : <option value="">暂无已维护对象</option>}
          </select>
        </FilterField>
        <FilterField label="指标" wide>
          <select aria-label="指标" disabled={type === 'all' || metricRows.length === 0} value={type === 'all' ? '' : selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {type === 'all'
              ? <option value="">选择指标</option>
              : metricRows.length
                ? metricRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.metricName}</option>)
                : <option value="">暂无已维护指标</option>}
          </select>
        </FilterField>
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={grain} onChange={(event) => setGrain(event.target.value as typeof grain)}>
            <option value="month">月度</option><option value="quarter">季度</option><option value="year">年度</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => notify('对标结果已更新')}>查询</EnergyButton>
        <EnergyButton onClick={() => { setYear('2026'); setType('all'); setObjectId(''); setSelectedId('benchmark-enterprise-added-value'); setGrain('month'); notify('筛选条件已重置'); }}>重置</EnergyButton>
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
            <section className={styles.benchmarkBasisStrip}>
              <div>
                <span>指标口径</span>
                <strong>{selected.objectTypeKey === 'device'
                  ? `当前指标读取${selected.objectName}独立设备能源记录，按所选年度汇总，不重复计入所属用能单元总量。`
                  : `当前指标按${selected.scopeNames.join('、')}中归属于${selected.objectName}的综合能耗，结合同期${selected.objectName}产量计算。`}</strong>
                <small>{selected.allocationDescription}｜{selected.periodDescription}</small>
              </div>
              <EnergyButton outline onClick={openBasis}>查看口径说明</EnergyButton>
            </section>
            <div className={styles.benchmarkMain}>
            <section className={`${styles.card} ${styles.benchmarkChart}`}>
              <div className={styles.benchmarkHead}>
                <div><div className={styles.chartTitle}>指标趋势（{selected.metricName}）</div><div className={styles.chartSub}>{selected.objectName}｜单位：{selected.unit}</div></div>
              </div>
              <div className={styles.lineChart} dangerouslySetInnerHTML={{ __html: benchmarkLineSvg(selected, grain, Number(year) || 2026) }} />
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
                {!targetConfigured && <EnergyButton primary onClick={openTarget}>配置指标目标</EnergyButton>}
              </div>
            </section>
            </div>
          </> : <section className={`${styles.card} ${styles.emptyState}`}>
            <strong>{selected.objectName}｜待完善</strong>
            <span>{selected.objectTypeKey === 'device' ? '已维护重点设备，但尚未录入设备级能源数据，暂无法形成设备用能指标。' : '当前产品暂无法计算单位产品综合能耗。'}</span>
            <small>原因：{selected.unavailableReason}</small>
            <div className={styles.emptyActions}>
              {selected.objectTypeKey === 'device'
                ? <EnergyButton primary onClick={() => goToData(`/data-management/energy-data?scope=device&deviceId=${selected.objectId}&new=1`)}>录入设备能源数据</EnergyButton>
                : selected.unavailableReason.includes('目标值')
                ? <EnergyButton primary onClick={openTarget}>配置指标目标</EnergyButton>
                : <EnergyButton primary onClick={() => goToData('/data-management/operations')}>补充产品及运营数据</EnergyButton>}
              {selected.unavailableReason.includes('能源数据') && <EnergyButton onClick={() => goToData('/data-management/energy-data')}>补充能源数据</EnergyButton>}
              <EnergyButton outline onClick={openBasis}>查看所需口径</EnergyButton>
            </div>
          </section>}
          <section className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.tableToolbar}><div><div className={styles.chartTitle}>{type === 'product' ? '全部产品指标对标明细' : type === 'device' ? '设备用能与能效对标明细' : '指标对标明细'}（{year}年）</div>{type === 'product' && <div className={styles.chartSub}>点击产品行可联动切换上方单产品趋势与口径。</div>}{type === 'device' && <div className={styles.chartSub}>设备消费量来自重点设备独立能源记录；具备运行时长、产量或供气量等分母前，不虚构设备效率指标。</div>}</div></div>
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
  let values = [...row.trend];
  let targetValues: number[] | null = row.monthlyTargets?.length === 12
    ? [...row.monthlyTargets]
    : null;
  let labels = values.map((_, index) => `${index + 1}月`);
  if (grain === 'quarter') {
    const aggregateQuarter = (source: number[]) => [0, 1, 2, 3].map((quarter) => {
      const quarterValues = source.slice(quarter * 3, quarter * 3 + 3);
      const total = quarterValues.reduce((sum, value) => sum + value, 0);
      return row.objectTypeKey === 'device' ? total : total / Math.max(quarterValues.length, 1);
    });
    values = aggregateQuarter(values);
    targetValues = targetValues ? aggregateQuarter(targetValues) : null;
    labels = ['一季度', '二季度', '三季度', '四季度'];
  } else if (grain === 'year') {
    values = [row.actual];
    targetValues = row.targetConfigured ? [row.target] : null;
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
  const targetGraphic = targetValues
    ? targetValues.length === 1
      ? `<line x1="${padding.left}" y1="${y(targetValues[0])}" x2="${width - padding.right}" y2="${y(targetValues[0])}" stroke="#00A870" stroke-width="2" stroke-dasharray="7 5"/><text x="${width - padding.right - 4}" y="${y(targetValues[0]) - 7}" text-anchor="end" font-size="11" fill="#00875A">年度目标 ${format(targetValues[0], metricDigits(targetValues[0]))}</text>`
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
          <input aria-label="分析年度" type="number" value={draftYear} onChange={(event) => setDraftYear(event.target.value)} />
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
