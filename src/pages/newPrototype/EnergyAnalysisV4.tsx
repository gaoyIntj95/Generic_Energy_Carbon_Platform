import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import {
  benchmarkRows as benchmarkSeed,
  energyAnalysisUnitLabels,
  energyQueryData,
  factoryBalanceRows,
  factoryFlowRows,
  flowDatasets,
  intensityData,
  prodABalanceRows,
  prodAFlowRows,
  type BalanceRow,
  type BenchmarkMetric,
  type BenchmarkType,
  type EnergyAnalysisPeriod,
  type EnergyAnalysisScope,
  type EnergyQueryRow,
  type FlowDetailRow,
  type FlowLevel,
  type FlowScope,
  type IntensityMetric,
  type IntensityScope,
} from '../../mocks/energyAnalysisV4Mock';
import styles from './EnergyAnalysisV4.module.css';

type DialogState = {
  title: string;
  body: ReactNode;
  submitText?: string;
  onSubmit?: () => void;
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
      <form className={styles.modal} onSubmit={submit}>
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

  const openDetail = (row: EnergyQueryRow) => {
    setDialog({
      title: '能源消费记录详情',
      body: (
        <>
          <DetailGrid items={[
            ['用能单元', row.energyUnitName],
            ['能源类别', row.analysisCategory],
            ['能源品种', row.energyTypeName],
            ['实物量', `${format(row.physicalAmount)} ${row.measurementUnit}`],
            ['折标量', `${format(row.standardCoalAmount)} tce`],
            ['占比', `${format(row.share, 1)}%`],
            ['同比', percent(row.yearOnYear)],
            ['环比', monthMode ? percent(row.monthOnMonth) : '—'],
          ]} />
          <div className={styles.modalNote}>
            <strong>数据来源：</strong>{row.sourceDescription}<br />
            <strong>折标口径：</strong>读取“能源品种”中的默认折标参数。
          </div>
        </>
      ),
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
            <option value="prodA">生产单元A</option>
            <option value="prodB">生产单元B</option>
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
                  <td><button type="button" className={styles.link} onClick={() => openDetail(row)}>查看</button></td>
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
  const [draftScope, setDraftScope] = useState<IntensityScope>('factory');
  const [appliedScope, setAppliedScope] = useState<IntensityScope>('factory');
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const rows = intensityData[appliedScope];
  const available = rows.filter((row) => row.resultType === 'ok').length;
  const pending = rows.filter((row) => row.resultType === 'warn').length;
  const checking = rows.filter((row) => row.resultType === 'check').length;

  const openMetricDialog = (metric: IntensityMetric, action: boolean) => {
    if (action && metric.resultType === 'warn') {
      setDialog({
        title: '补充指标数据',
        body: (
          <>
            <DetailGrid items={[['指标名称', metric.name], ['缺失内容', metric.denominator]]} />
            <div className={styles.modalNote}>{metric.issue}<br />请在“数据管理—运营数据”补充相同年度、相同组织范围的数据，保存后系统自动重新计算。</div>
          </>
        ),
        submitText: '前往运营数据',
        onSubmit: () => notify('已定位到运营数据'),
      });
      return;
    }
    if (action && metric.resultType === 'check') {
      setDialog({
        title: '指标核验问题',
        body: (
          <>
            <DetailGrid items={[
              ['指标名称', metric.name],
              ['当前结果', `${format(metric.value, metric.value ? metricDigits(metric.value) : 1)} ${metric.unit}`],
              ['分子来源', metric.numerator],
              ['分母来源', metric.denominator],
            ]} />
            <div className={styles.modalNote}><strong>需核验原因：</strong>{metric.issue}</div>
          </>
        ),
      });
      return;
    }
    setDialog({
      title: '指标计算详情',
      body: (
        <>
          <DetailGrid items={[
            ['指标名称', metric.name],
            ['计算结果', metric.value === null ? '—' : `${format(metric.value, metricDigits(metric.value))} ${metric.unit}`],
            ['分子', metric.numerator],
            ['分母', metric.denominator],
            ['统计期间', metric.period],
            ['数据来源', metric.source],
          ]} />
          <div className={styles.formulaBox}><strong>计算公式：</strong>{metric.formula}</div>
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
        <FilterField label="组织范围" wide>
          <select aria-label="组织范围" value={draftScope} onChange={(event) => setDraftScope(event.target.value as IntensityScope)}>
            <option value="factory">全厂</option>
            <option value="prodA">生产单元A</option>
            <option value="utilities">公辅系统</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => { setAppliedScope(draftScope); notify('指标结果已更新'); }}>查询</EnergyButton>
        <EnergyButton onClick={() => { setDraftYear('2026'); setDraftScope('factory'); setAppliedScope('factory'); notify('筛选条件已重置'); }}>重置</EnergyButton>
      </section>

      <section className={`${styles.card} ${styles.tableCard}`}>
        <div className={styles.tableToolbar}>
          <div>
            <div className={styles.chartTitle}>指标结果明细</div>
            <div className={styles.subtleCount}>共生成 {rows.length} 项指标，其中 {available} 项可用{pending ? `，${pending} 项待补充` : ''}{checking ? `，${checking} 项需核验` : ''}</div>
          </div>
          <EnergyButton onClick={() => notify('指标明细台账已导出')}>⇩ 导出明细台账</EnergyButton>
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
                  <td><StatusTag tone={metric.resultType}>{metric.resultStatus}</StatusTag></td>
                  <td><button type="button" className={styles.link} onClick={() => openMetricDialog(metric, true)}>{metric.resultType === 'warn' ? '去补充' : metric.resultType === 'check' ? '查看问题' : '查看详情'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.slimNote}>
        <div><i>i</i><span>指标由能源数据与运营数据自动计算，计算依据：GB/T 2589—2020。</span></div>
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
              <div className={styles.modalNote}>分子与分母必须采用相同组织范围和统计期间；缺少必要运营数据时，指标状态显示“待补充”。</div>
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
  const [metrics, setMetrics] = useState(() => benchmarkSeed.map((row) => ({ ...row, trend: [...row.trend] })));
  const [year, setYear] = useState('2026');
  const [type, setType] = useState<BenchmarkType>('all');
  const [objectName, setObjectName] = useState('');
  const [selectedId, setSelectedId] = useState('b1');
  const [grain, setGrain] = useState<'month' | 'quarter' | 'year'>('month');
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();

  const filteredRows = type === 'all'
    ? metrics
    : metrics.filter((row) => row.objectTypeKey === type);
  const objects = [...new Set(filteredRows.map((row) => row.objectName))];
  const selected = metrics.find((row) => row.benchmarkMetricId === selectedId) ?? metrics[0];
  const metricRows = type === 'all' ? [] : filteredRows.filter((row) => row.objectName === (objectName || objects[0]));
  const noProductData = type === 'product' && filteredRows.length === 0;
  const good = isBenchmarkGood(selected);
  const deviation = (selected.actual - selected.target) / selected.target * 100;

  const selectType = (nextType: BenchmarkType) => {
    setType(nextType);
    if (nextType === 'all') {
      setObjectName('');
      setSelectedId('b1');
      return;
    }
    const first = metrics.find((row) => row.objectTypeKey === nextType);
    setObjectName(first?.objectName ?? '');
    setSelectedId(first?.benchmarkMetricId ?? 'b1');
  };

  const openTarget = () => {
    if (noProductData) {
      notify('当前暂无可配置的产品能效指标');
      return;
    }
    let draftTargetValue = selected.target;
    setDialog({
      title: '指标目标配置',
      body: (
        <div className={styles.modalForm}>
          <FilterField label="目标年度"><input value={year} readOnly /></FilterField>
          <FilterField label="对象类型"><input value={selected.objectType} readOnly /></FilterField>
          <FilterField label="对标对象"><input value={selected.objectName} readOnly /></FilterField>
          <FilterField label="指标名称"><input value={selected.metricName} readOnly /></FilterField>
          <label className={styles.modalField}><span className={styles.required}>目标值（{selected.unit}）</span><input aria-label="目标值" required min="0.001" step="0.001" type="number" defaultValue={selected.target} onChange={(event) => { draftTargetValue = Number(event.target.value); }} /></label>
          <label className={styles.modalField}><span>评价方向</span><span className={styles.targetDirection}><button type="button" className={selected.direction === 'low' ? styles.active : ''}>越低越好</button><button type="button" className={selected.direction === 'high' ? styles.active : ''}>越高越好</button></span></label>
          <div className={`${styles.modalNote} ${styles.full}`}>目标值是能效对标的唯一评价基准；实际值由能源数据、运营数据或能源转换关系自动计算。</div>
        </div>
      ),
      submitText: '保存配置',
      onSubmit: () => {
        const value = draftTargetValue;
        if (Number.isFinite(value) && value > 0) {
          setMetrics((current) => current.map((row) => row.benchmarkMetricId === selected.benchmarkMetricId ? { ...row, target: value } : row));
          notify('指标目标值已保存');
        }
      },
    });
  };

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
            value={objectName}
            onChange={(event) => {
              const next = event.target.value;
              setObjectName(next);
              const first = filteredRows.find((row) => row.objectName === next);
              if (first) setSelectedId(first.benchmarkMetricId);
            }}
          >
            {type === 'all'
              ? <option value="">选择对象</option>
              : objects.length
                ? objects.map((item) => <option key={item} value={item}>{item}</option>)
                : <option value="">暂无可计算对象</option>}
          </select>
        </FilterField>
        <FilterField label="指标" wide>
          <select aria-label="指标" disabled={type === 'all' || metricRows.length === 0} value={type === 'all' ? '' : selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {type === 'all'
              ? <option value="">选择指标</option>
              : metricRows.length
                ? metricRows.map((row) => <option key={row.benchmarkMetricId} value={row.benchmarkMetricId}>{row.metricName}</option>)
                : <option value="">暂无可计算指标</option>}
          </select>
        </FilterField>
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={grain} onChange={(event) => setGrain(event.target.value as typeof grain)}>
            <option value="month">月度</option><option value="quarter">季度</option><option value="year">年度</option>
          </select>
        </FilterField>
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => notify('对标结果已更新')}>查询</EnergyButton>
        <EnergyButton onClick={() => { setYear('2026'); setType('all'); setObjectName(''); setSelectedId('b1'); setGrain('month'); notify('筛选条件已重置'); }}>重置</EnergyButton>
      </section>

      {noProductData ? (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <strong>暂无可计算的产品能效指标</strong>
          产品级指标需要建立产品产量与能源归属关系；当前仅展示具备数据支撑的用能单元和设备指标。
        </section>
      ) : (
        <>
          <section className={`${styles.card} ${styles.benchmarkChart}`}>
            <div className={styles.benchmarkHead}>
              <div><div className={styles.chartTitle}>指标趋势（{selected.metricName}）</div><div className={styles.chartSub}>{selected.objectName}｜单位：{selected.unit}</div></div>
              <div className={styles.inlineResult}>
                <span>当前值 <b>{format(selected.actual, metricDigits(selected.actual))} {selected.unit}</b></span>
                <span>目标值 <b>{format(selected.target, metricDigits(selected.target))} {selected.unit}</b></span>
                <span>偏差率 <b className={good ? styles.down : styles.up}>{percent(deviation)}</b></span>
                <span>状态 <b className={good ? styles.down : styles.up}>{good ? '达标' : '未达标'}</b></span>
              </div>
            </div>
            <div className={styles.lineChart} dangerouslySetInnerHTML={{ __html: benchmarkLineSvg(selected, grain) }} />
          </section>
          <section className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.tableToolbar}><div className={styles.chartTitle}>指标对标明细（{year}年）</div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>对标对象</th><th>对象类型</th><th>指标名称</th><th>单位</th><th>实际值</th><th>目标值</th><th>偏差率</th><th>状态</th></tr></thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const rowGood = isBenchmarkGood(row);
                    const rowDeviation = (row.actual - row.target) / row.target * 100;
                    return (
                      <tr key={row.benchmarkMetricId} className={row.benchmarkMetricId === selected.benchmarkMetricId ? styles.selectedRow : ''} onClick={() => setSelectedId(row.benchmarkMetricId)}>
                        <td>{row.objectName}</td><td>{row.objectType}</td><td>{row.metricName}</td><td>{row.unit}</td>
                        <td>{format(row.actual, metricDigits(row.actual))}</td><td>{format(row.target, metricDigits(row.target))}</td>
                        <td className={rowGood ? styles.down : styles.up}>{percent(rowDeviation)}</td>
                        <td><StatusTag tone={rowGood ? 'ok' : 'bad'}>{rowGood ? '达标' : '未达标'}</StatusTag></td>
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
  return row.direction === 'high' ? row.actual >= row.target : row.actual <= row.target;
}

function benchmarkLineSvg(row: BenchmarkMetric, grain: 'month' | 'quarter' | 'year') {
  let values = [...row.trend];
  let labels = values.map((_, index) => `${index + 1}月`);
  if (grain === 'quarter') {
    values = [0, 1, 2, 3].map((quarter) => values.slice(quarter * 3, quarter * 3 + 3).reduce((sum, value) => sum + value, 0) / 3);
    labels = ['一季度', '二季度', '三季度', '四季度'];
  } else if (grain === 'year') {
    values = [row.actual];
    labels = ['2026年'];
  }
  const width = 1120;
  const height = 300;
  const padding = { left: 55, right: 36, top: 28, bottom: 46 };
  const min = Math.min(...values, row.target);
  const max = Math.max(...values, row.target);
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
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="指标趋势图">${grid}<line x1="${padding.left}" y1="${y(row.target)}" x2="${width - padding.right}" y2="${y(row.target)}" stroke="#00A870" stroke-width="2" stroke-dasharray="7 5"/><text x="${width - padding.right - 4}" y="${y(row.target) - 7}" text-anchor="end" font-size="11" fill="#00875A">目标值 ${format(row.target, metricDigits(row.target))}</text>${values.length > 1 ? `<polyline points="${points}" fill="none" stroke="#1677FF" stroke-width="3"/>` : ''}${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="5" fill="#fff" stroke="#1677FF" stroke-width="2"/><text x="${x(index)}" y="${y(value) - 11}" text-anchor="middle" font-size="11" fill="#365A7A">${format(value, metricDigits(value))}</text><text x="${x(index)}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#667085">${labels[index]}</text>`).join('')}</svg>`;
}

type FlowTab = 'diagram' | 'balance' | 'detail';

function FlowAnalysisPage() {
  const [draftYear, setDraftYear] = useState('2026');
  const [draftScope, setDraftScope] = useState<FlowScope>('factory');
  const [draftGrain, setDraftGrain] = useState<'month' | 'year'>('month');
  const [draftMonth, setDraftMonth] = useState('6月');
  const [applied, setApplied] = useState({ year: '2026', scope: 'factory' as FlowScope, grain: 'month' as 'month' | 'year', month: '6月' });
  const [tab, setTab] = useState<FlowTab>('diagram');
  const [level, setLevel] = useState<FlowLevel>('level1');
  const [selectedNode, setSelectedNode] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const { toast, notify } = useFeedback();
  const data = flowDatasets[applied.scope];
  const rows = applied.scope === 'prodA' ? prodAFlowRows : factoryFlowRows;
  const stageName = level === 'level1' ? '能源分配' : '能源利用';
  const rateName = level === 'level1' ? '能源分配率' : '能源利用归属率';
  const capabilityTags = applied.scope === 'prodA'
    ? ['本级能源控制量', '二级利用可展开', '未配置转换关系']
    : ['一级能源分配', '2条能源转换', '1条外部输出'];

  const handleSankeyClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const node = target.closest<SVGGElement>('g[data-key]');
    if (!node) return;
    const key = node.dataset.key ?? '';
    setSelectedNode((current) => current === key ? '' : key);
  };

  const openLossDetail = () => {
    setDialog({
      title: '能流分析口径',
      body: (
        <>
          <DetailGrid items={[
            ['未分配量', `${format(data.unallocated)} tce`],
            ['计算口径', '本级输入控制量－当前层级分配/利用量'],
            ['可计算转换损失', data.loss === null ? '当前范围不适用' : `${format(data.loss)} tce`],
            ['计算口径', '各能源转换关系投入折标量－产出折标量'],
            ['外部输出', `${format(data.external)} tce`],
            ['数据来源', '外供能源数据自动识别'],
          ]} />
          <div className={styles.modalNote}>未分配量属于管理口径差额，不等同于物理能源损失。输配损失只有在来源端与去向端均存在可比计量数据时才计算；一期未配置双侧计量时不展示具体数值。能源平衡表用于当前组织范围和折标量校验，不等同于专业工艺热平衡。</div>
        </>
      ),
    });
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.filterCard}`}>
        <FilterField label="分析年度"><input aria-label="分析年度" type="number" value={draftYear} onChange={(event) => setDraftYear(event.target.value)} /></FilterField>
        <FilterField label="组织范围" wide>
          <select aria-label="组织范围" value={draftScope} onChange={(event) => setDraftScope(event.target.value as FlowScope)}>
            <option value="factory">全厂</option><option value="prodA">生产单元A</option>
          </select>
        </FilterField>
        <FilterField label="时间粒度">
          <select aria-label="时间粒度" value={draftGrain} onChange={(event) => setDraftGrain(event.target.value as 'month' | 'year')}>
            <option value="month">月度</option><option value="year">年度</option>
          </select>
        </FilterField>
        {draftGrain === 'month' && (
          <FilterField label="月份">
            <select aria-label="月份" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>
              <option>6月</option><option>5月</option><option>4月</option>
            </select>
          </FilterField>
        )}
        <div className={styles.filterSpacer} />
        <EnergyButton primary onClick={() => { setApplied({ year: draftYear || '2026', scope: draftScope, grain: draftGrain, month: draftMonth }); notify('能流数据已更新'); }}>查询</EnergyButton>
        <EnergyButton onClick={() => {
          setDraftYear('2026'); setDraftScope('factory'); setDraftGrain('month'); setDraftMonth('6月');
          setApplied({ year: '2026', scope: 'factory', grain: 'month', month: '6月' });
          setLevel('level1'); setTab('diagram'); setSelectedNode(''); notify('筛选条件已重置');
        }}>重置</EnergyButton>
      </section>

      <div className={styles.capabilityStrip}>
        <div><i>i</i><span><strong>当前数据能力：</strong>{data.capability}</span></div>
        <span className={styles.capabilityTags}>{capabilityTags.map((tag) => <em key={tag}>{tag}</em>)}</span>
      </div>

      <section className={`${styles.card} ${styles.flowSummary}`}>
        <FlowStat icon="⇥" label="能源输入量" value={data.input} />
        <FlowStat icon="✓" label={`${stageName}量`} value={data.allocated} />
        <FlowStat icon="!" label="未分配量" value={data.unallocated} orange />
        <FlowStat icon="◔" label={rateName} value={data.rate} percentValue />
      </section>

      <section className={`${styles.card} ${styles.flowMain}`}>
        <div className={styles.flowTabs}>
          <div>
            <button type="button" className={tab === 'diagram' ? styles.active : ''} onClick={() => setTab('diagram')}>能流图</button>
            <button type="button" className={tab === 'balance' ? styles.active : ''} onClick={() => setTab('balance')}>能源平衡表</button>
            <button type="button" className={tab === 'detail' ? styles.active : ''} onClick={() => setTab('detail')}>流向明细</button>
          </div>
          <div className={styles.flowLevel}>
            <span>展示层级：</span>
            <span className={styles.segment}>
              <button type="button" className={level === 'level1' ? styles.active : ''} onClick={() => { setLevel('level1'); setSelectedNode(''); }}>一级用能单元</button>
              <button type="button" className={level === 'level2' ? styles.active : ''} onClick={() => { setLevel('level2'); setSelectedNode(''); }}>展开到二级</button>
            </span>
          </div>
        </div>

        {tab === 'diagram' && (
          <>
            <div className={styles.flowLegend}>
              <span><i style={{ background: '#1677FF' }} />能源输入</span>
              <span><i style={{ background: '#F79009' }} />能源转换</span>
              <span><i style={{ background: '#00A870' }} />厂内能源介质</span>
              <span><i style={{ background: '#23A35A' }} />{stageName}</span>
              <span><i style={{ background: '#7A5AF8' }} />外部输出</span>
              <span><i style={{ background: '#98A2B3' }} />未分配</span>
            </div>
            <div className={styles.sankeyWrap} onClick={handleSankeyClick}>
              <div dangerouslySetInnerHTML={{ __html: flowSankeySvg(level, applied.scope, selectedNode) }} />
              {selectedNode && <div className={styles.nodeTooltip}>已选择节点<br /><strong>点击相关节点可高亮流向</strong></div>}
            </div>
            <div className={styles.flowMethodNote}>一级视图展示能源向用能单元的<strong>分配</strong>；展开二级后进一步展示工序、系统或功能区域的<strong>利用</strong>。当同一种能源同时存在外购、自产或回收来源时，系统先汇入厂内能源介质；缺少专线计量或分配规则时，不推断各终端的具体来源比例。未分配量是管理口径差额，不等同于物理损失。</div>
            <div className={styles.stageNotes}>
              <StageNote title="能源输入">企业边界购入、输入或可计量回收的能源。</StageNote>
              <StageNote title="能源转换">锅炉、余热发电、自发电等已配置转换关系。</StageNote>
              <StageNote title="能源分配">本级能源向一级用能单元的归属。</StageNote>
              <StageNote title="能源利用">展开二级后，能源在工序、系统或区域中的实际使用。</StageNote>
            </div>
            <FlowRank level={level} scope={applied.scope} />
          </>
        )}
        {tab === 'balance' && <BalanceTable scope={applied.scope} level={level} />}
        {tab === 'detail' && <FlowDetailTable rows={rows} level={level} notify={notify} open={(row) => setDialog(flowDetailDialog(row))} />}
      </section>

      <div className={styles.differenceStrip}>
        <strong>分析提示</strong>
        <span>未分配量：<b className={styles.orangeText}>{format(data.unallocated)} tce</b></span>
        <span>可计算转换损失：<b className={styles.redText}>{data.loss === null ? '当前范围不适用' : `${format(data.loss)} tce`}</b></span>
        {data.external > 0 && <span>外部输出：<strong>{format(data.external)} tce</strong></span>}
        <button type="button" className={styles.link} onClick={openLossDetail}>查看口径</button>
      </div>
      <EnergyDialog state={dialog} close={() => setDialog(null)} />
      <EnergyToast message={toast} />
    </div>
  );
}

function FlowStat({
  icon,
  label,
  value,
  orange,
  percentValue,
}: {
  icon: string;
  label: string;
  value: number;
  orange?: boolean;
  percentValue?: boolean;
}) {
  return (
    <div className={styles.flowStat}>
      <i>{icon}</i>
      <div><span>{label}</span><strong className={orange ? styles.orangeText : ''}>{format(value, percentValue ? 1 : 0)}{percentValue ? '%' : <small>tce</small>}</strong></div>
    </div>
  );
}

function StageNote({ title, children }: { title: string; children: ReactNode }) {
  return <div><strong>{title}</strong><span>{children}</span></div>;
}

function FlowRank({ level, scope }: { level: FlowLevel; scope: FlowScope }) {
  const rows = useMemo(() => {
    if (scope === 'prodA') {
      return level === 'level2'
        ? [['核心工序', 2959, 57.3], ['原料制备', 1480, 28.7], ['包装发运', 621, 12], ['未分配', 100, 1.9]] as const
        : [['生产单元A', 5060, 98.1], ['未分配', 100, 1.9]] as const;
    }
    return level === 'level2'
      ? [['核心工序A', 3800, 28.5], ['核心工序B', 3480, 26.1], ['原料制备', 2420, 18.2], ['空压系统', 1150, 8.6], ['办公区域', 640, 4.8]] as const
      : [['生产单元A', 6220, 46.6], ['生产单元B', 3480, 26.1], ['公辅系统', 2300, 17.2], ['办公区域', 640, 4.8], ['其他单元', 340, 2.6]] as const;
  }, [level, scope]);
  const max = Math.max(...rows.map((row) => row[2]), 1);
  return (
    <section className={`${styles.card} ${styles.rankCard}`}>
      <div className={styles.rankHead}>
        <div><div className={styles.chartTitle}>重点用能单元 TOP5</div><div className={styles.chartSub}>{level === 'level1' ? '按一级能源分配量排序' : '按二级能源利用量排序'}｜折标量口径</div></div>
        <StatusTag tone="check">{rows.length} 个对象</StatusTag>
      </div>
      <div className={styles.rankList}>
        {rows.map((row, index) => (
          <div key={row[0]}>
            <b>{index + 1}</b><span>{row[0]}</span>
            <i><em style={{ width: `${Math.max(row[2] / max * 100, 3)}%` }} /></i>
            <span>{format(row[1])} tce</span><span>{format(row[2], 1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BalanceTable({ scope, level }: { scope: FlowScope; level: FlowLevel }) {
  const rows = scope === 'prodA' ? prodABalanceRows : factoryBalanceRows;
  const stageColumn = level === 'level1' ? '分配量' : '利用量';
  return (
    <div className={styles.balanceCard}>
      <div className={styles.balanceHead}>
        <div><div className={styles.chartTitle}>能源平衡表</div><div className={styles.balanceCaption}>按当前组织范围和折标量进行管理口径平衡校验，不等同于锅炉、窑炉等专业工艺热平衡。一级视图校验能源分配，展开二级后校验能源利用，避免父子层级重复计算。</div></div>
        <StatusTag tone="check">{level === 'level1' ? '一级分配口径' : '二级利用口径'}</StatusTag>
      </div>
      <div className={styles.tableWrap}>
        <table><thead><tr><th>能源品种</th><th>输入量</th><th>转换产出</th><th>转换投入</th><th>{stageColumn}</th><th>外部输出</th><th>未分配量</th><th>平衡状态</th></tr></thead>
          <tbody>{rows.map((row) => <BalanceTableRow key={row.energyTypeName} row={row} />)}</tbody>
        </table>
      </div>
      <div className={styles.flowMethodNote}>平衡关系：输入量 + 转换产出 = 转换投入 + {stageColumn} + 外部输出 + 未分配量。转换产出包括能源转换产出、无投入自产能源和可计量回收能源；同一能源量不同时计入一级分配和二级利用。</div>
    </div>
  );
}

function BalanceTableRow({ row }: { row: BalanceRow }) {
  const value = (number: number) => number ? format(number) : '—';
  return (
    <tr>
      <td>{row.energyTypeName}</td><td>{value(row.boundaryInput)}</td><td>{value(row.conversionOutput)}</td><td>{value(row.conversionInput)}</td>
      <td>{value(row.terminalAmount)}</td><td>{value(row.externalOutput)}</td><td className={row.unallocated ? styles.up : ''}>{value(row.unallocated)}</td>
      <td><StatusTag tone={row.unallocated ? 'warn' : 'ok'}>{row.balanceStatus}</StatusTag></td>
    </tr>
  );
}

function FlowDetailTable({
  rows,
  level,
  notify,
  open,
}: {
  rows: FlowDetailRow[];
  level: FlowLevel;
  notify: (message: string) => void;
  open: (row: FlowDetailRow) => void;
}) {
  const stage = level === 'level1' ? '能源分配' : '能源利用';
  const displayType = (row: FlowDetailRow) => {
    if (['终端消费', '直接消费'].includes(row.type)) return stage;
    if (['未归属', '未分配'].includes(row.type)) return '未分配';
    return row.type;
  };
  return (
    <div className={styles.flowDetailTab}>
      <div className={styles.tableToolbar}>
        <div><div className={styles.chartTitle}>能源流向明细</div><div className={styles.subtleCount}>用于精确核对流向数值、查看数据来源和能源转换关系；与当前组织范围、期间和展示层级一致。</div></div>
        <EnergyButton onClick={() => notify('已按当前筛选条件导出能源流向明细')}>⇩ 导出当前明细</EnergyButton>
      </div>
      <div className={styles.flowDetailSummary}><span>当前阶段：<strong>{stage}</strong></span><span>明细条数：<strong>{rows.length}</strong></span><span>计量口径：<strong>折标量（tce）</strong></span></div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>能流阶段</th><th>能源介质/输入</th><th>转换单元或关系</th><th>{level === 'level1' ? '分配去向' : '利用去向'}</th><th>折标量（tce）</th><th>占比</th><th>数据追溯</th></tr></thead>
          <tbody>{rows.map((row) => {
            const type = displayType(row);
            return (
              <tr key={row.flowDetailId}>
                <td><StatusTag tone={type === '未分配' ? 'warn' : type === '能源转换' ? 'check' : 'ok'}>{type}</StatusTag></td>
                <td>{row.input}</td><td>{row.relation}</td><td>{row.target}</td><td>{format(row.standardCoalAmount)}</td><td>{format(row.share, 1)}%</td>
                <td>{row.action === 'none' ? '—' : <button type="button" className={styles.link} onClick={() => open(row)}>{row.action === 'source' ? '查看来源' : row.action === 'external' ? '查看数据' : '查看关系'}</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function flowDetailDialog(row: FlowDetailRow): NonNullable<DialogState> {
  if (row.action === 'source') {
    return {
      title: '能源流向来源',
      body: (
        <>
          <DetailGrid items={[
            ['流向类型', row.type],
            ['分配/利用去向', row.target],
            ['能源介质', row.input],
            ['折标量', `${format(row.standardCoalAmount)} tce`],
          ]} />
          <div className={styles.modalNote}><strong>引用数据：</strong>{row.source}<br />存在多种同类能源来源时，系统不自动拆分各分配或利用对象的具体能源来源比例。</div>
        </>
      ),
    };
  }
  if (row.action === 'external') {
    return {
      title: '外部输出数据',
      body: (
        <>
          <DetailGrid items={[
            ['能源品种', row.input],
            ['输出去向', row.target],
            ['折标量', `${format(row.standardCoalAmount)} tce`],
            ['识别方式', '由外供能源数据自动生成'],
          ]} />
          <div className={styles.modalNote}><strong>引用数据：</strong>{row.source}</div>
        </>
      ),
    };
  }
  return {
    title: '能源转换关系',
    body: (
      <>
        <DetailGrid items={[
          ['投入能源', row.input],
          ['转换关系', row.relation],
          ['产出介质', row.target],
          ['产出折标量', `${format(row.standardCoalAmount)} tce`],
          ['转换投入', `${format(row.inputStandardCoalAmount)} tce`],
          ['转换产出', `${format(row.outputStandardCoalAmount)} tce`],
          ['转换效率', `${format(row.efficiency, 1)}%`],
          ['转换损失', `${format(row.loss)} tce`],
        ]} />
        <div className={styles.modalNote}><strong>引用数据：</strong>{row.source}</div>
      </>
    ),
  };
}

function flowSankeySvg(level: FlowLevel, scope: FlowScope, selected: string) {
  if (scope === 'prodA') return prodASankeySvg(level, selected);
  const node = (id: string, name: string, value: string, x: number, y: number, color: string, tip: string, width = 118, height = 50) =>
    `<g class="node ${selected === id ? 'selected' : ''}" data-key="${id}" data-name="${name}" data-value="${value}" data-tip="${tip}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="#fff" stroke="${color}"/><rect x="${x}" y="${y}" width="7" height="${height}" rx="3" fill="${color}"/><text x="${x + 17}" y="${y + 20}" font-size="11.5" fill="#172033">${name}</text><text x="${x + 17}" y="${y + 38}" font-size="10.5" fill="#5F6B7A">${value}</text></g>`;
  const flow = (a: string, b: string, path: string, color: string, width: number) =>
    `<path class="flow ${selected && [a, b].includes(selected) ? 'active' : ''}" data-keys="${a} ${b}" d="${path}" stroke="${color}" stroke-width="${width}"/>`;

  if (level === 'level1') {
    const nodes = [
      node('purchaseElectric', '外购电力', '6,127 tce', 18, 42, '#1677FF', '企业边界能源输入'),
      node('gasSource', '天然气', '3,256 tce', 18, 112, '#1677FF', '企业边界能源输入'),
      node('coalSource', '原煤', '2,000 tce', 18, 182, '#1677FF', '企业边界能源输入'),
      node('steamSource', '外购蒸汽', '1,937 tce', 18, 252, '#1677FF', '企业边界能源输入'),
      node('heatSource', '回收余热', '1,120 tce', 18, 322, '#1677FF', '可计量回收能源'),
      node('boilerPlant', '燃气锅炉', '天然气→蒸汽', 220, 96, '#F79009', '锅炉产汽/产热转换关系'),
      node('wasteHeatPlant', '余热发电系统', '余热→电力', 220, 262, '#F79009', '余热发电转换关系'),
      node('electricPool', '厂内电力', '可用 7,087 tce', 430, 42, '#00A870', '外购电力与自产电力汇总'),
      node('gasPool', '厂内天然气', '终端 1,316 tce', 430, 122, '#00A870', '转换投入后剩余可分配天然气'),
      node('coalPool', '厂内原煤', '可用 2,000 tce', 430, 202, '#00A870', '厂内原煤能源介质'),
      node('steamPool', '厂内蒸汽', '可用 3,817 tce', 430, 282, '#00A870', '外购蒸汽与锅炉产汽汇总'),
      node('prodA', '生产单元A', '6,220 tce', 680, 42, '#23A35A', '一级能源分配对象'),
      node('prodB', '生产单元B', '3,480 tce', 680, 122, '#23A35A', '一级能源分配对象'),
      node('utilities', '公辅系统', '2,300 tce', 680, 202, '#23A35A', '一级能源分配对象'),
      node('office', '办公区域', '640 tce', 680, 282, '#23A35A', '一级能源分配对象'),
      node('external', '企业外部', '340 tce', 930, 82, '#7A5AF8', '由外供能源数据自动识别'),
      node('unallocated', '未分配量', '340 tce', 930, 262, '#98A2B3', '输入量与一级分配量的管理口径差额'),
    ].join('');
    const paths = [
      flow('gasSource', 'boilerPlant', 'M136 137 C175 137 185 121 220 121', '#1677FF', 18),
      flow('heatSource', 'wasteHeatPlant', 'M136 347 C176 347 186 287 220 287', '#1677FF', 13),
      flow('purchaseElectric', 'electricPool', 'M136 67 C250 67 330 67 430 67', '#1677FF', 27),
      flow('wasteHeatPlant', 'electricPool', 'M338 287 C385 255 405 86 430 67', '#F79009', 12),
      flow('gasSource', 'gasPool', 'M136 137 C260 145 330 147 430 147', '#1677FF', 12),
      flow('coalSource', 'coalPool', 'M136 207 C250 207 330 227 430 227', '#1677FF', 16),
      flow('steamSource', 'steamPool', 'M136 277 C250 277 330 307 430 307', '#1677FF', 15),
      flow('boilerPlant', 'steamPool', 'M338 121 C390 142 405 286 430 307', '#F79009', 18),
      flow('electricPool', 'prodA', 'M548 67 C590 67 635 67 680 67', '#00A870', 18),
      flow('electricPool', 'utilities', 'M548 67 C600 80 635 210 680 227', '#00A870', 10),
      flow('gasPool', 'prodA', 'M548 147 C600 135 635 78 680 67', '#00A870', 8),
      flow('gasPool', 'prodB', 'M548 147 C600 147 635 147 680 147', '#00A870', 10),
      flow('coalPool', 'prodA', 'M548 227 C600 190 635 90 680 67', '#00A870', 12),
      flow('coalPool', 'prodB', 'M548 227 C605 205 640 155 680 147', '#00A870', 7),
      flow('steamPool', 'prodB', 'M548 307 C600 260 635 170 680 147', '#00A870', 11),
      flow('steamPool', 'utilities', 'M548 307 C600 285 635 230 680 227', '#00A870', 8),
      flow('electricPool', 'office', 'M548 67 C650 100 720 300 680 307', '#00A870', 5),
      flow('electricPool', 'external', 'M548 67 C720 68 820 107 930 107', '#7A5AF8', 5),
      flow('coalPool', 'unallocated', 'M548 227 C720 230 820 287 930 287', '#98A2B3', 3),
      flow('steamPool', 'unallocated', 'M548 307 C720 307 820 287 930 287', '#98A2B3', 6),
    ].join('');
    return `<svg class="sankey" viewBox="0 0 1070 390" aria-label="企业一级能源分配图"><text x="18" y="20" font-size="13" font-weight="700">能源输入</text><text x="220" y="20" font-size="13" font-weight="700">能源转换</text><text x="430" y="20" font-size="13" font-weight="700">厂内能源介质</text><text x="680" y="20" font-size="13" font-weight="700">能源分配（一级用能单元）</text><text x="930" y="20" font-size="13" font-weight="700">外部输出 / 未分配</text>${paths}${nodes}</svg>`;
  }

  const nodes = [
    node('purchaseElectric', '外购电力', '6,127 tce', 12, 38, '#1677FF', '企业边界能源输入', 104, 46),
    node('gasSource', '天然气', '3,256 tce', 12, 96, '#1677FF', '企业边界能源输入', 104, 46),
    node('coalSource', '原煤', '2,000 tce', 12, 154, '#1677FF', '企业边界能源输入', 104, 46),
    node('steamSource', '外购蒸汽', '1,937 tce', 12, 212, '#1677FF', '企业边界能源输入', 104, 46),
    node('heatSource', '回收余热', '1,120 tce', 12, 270, '#1677FF', '可计量回收能源', 104, 46),
    node('boilerPlant', '燃气锅炉', '天然气→蒸汽', 160, 82, '#F79009', '锅炉产汽/产热转换关系', 112, 48),
    node('wasteHeatPlant', '余热发电', '余热→电力', 160, 226, '#F79009', '余热发电转换关系', 112, 48),
    node('electricPool', '厂内电力', '7,087 tce', 325, 38, '#00A870', '厂内能源介质汇总', 112, 48),
    node('gasPool', '厂内天然气', '1,316 tce', 325, 104, '#00A870', '厂内能源介质汇总', 112, 48),
    node('coalPool', '厂内原煤', '2,000 tce', 325, 170, '#00A870', '厂内能源介质汇总', 112, 48),
    node('steamPool', '厂内蒸汽', '3,817 tce', 325, 236, '#00A870', '厂内能源介质汇总', 112, 48),
    node('prodA', '生产单元A', '6,220 tce', 505, 30, '#23A35A', '一级能源分配对象', 112, 48),
    node('prodB', '生产单元B', '3,480 tce', 505, 96, '#23A35A', '一级能源分配对象', 112, 48),
    node('utilities', '公辅系统', '2,300 tce', 505, 162, '#23A35A', '一级能源分配对象', 112, 48),
    node('office', '办公区域', '640 tce', 505, 228, '#23A35A', '一级能源分配对象', 112, 48),
    node('rawPrep', '原料制备', '2,420 tce', 690, 16, '#23A35A', '二级能源利用环节', 112, 44),
    node('coreA', '核心工序A', '3,800 tce', 690, 68, '#23A35A', '二级能源利用环节', 112, 44),
    node('coreB', '核心工序B', '3,480 tce', 690, 120, '#23A35A', '二级能源利用环节', 112, 44),
    node('air', '空压系统', '1,150 tce', 690, 172, '#23A35A', '二级能源利用环节', 112, 44),
    node('otherUtility', '其他公辅环节', '1,150 tce', 690, 224, '#23A35A', '二级能源利用环节', 112, 44),
    node('officeUse', '办公区域', '640 tce', 690, 276, '#23A35A', '二级能源利用环节', 112, 44),
    node('external', '企业外部', '340 tce', 900, 82, '#7A5AF8', '由外供能源数据自动识别', 112, 48),
    node('unallocated', '未分配量', '340 tce', 900, 240, '#98A2B3', '当前层级管理口径差额', 112, 48),
  ].join('');
  const paths = [
    flow('gasSource', 'boilerPlant', 'M116 119 C135 119 142 106 160 106', '#1677FF', 15),
    flow('heatSource', 'wasteHeatPlant', 'M116 293 C135 293 145 250 160 250', '#1677FF', 11),
    flow('purchaseElectric', 'electricPool', 'M116 61 C205 61 250 62 325 62', '#1677FF', 22),
    flow('wasteHeatPlant', 'electricPool', 'M272 250 C300 220 310 85 325 62', '#F79009', 10),
    flow('gasSource', 'gasPool', 'M116 119 C210 125 255 128 325 128', '#1677FF', 10),
    flow('coalSource', 'coalPool', 'M116 177 C205 178 260 194 325 194', '#1677FF', 13),
    flow('steamSource', 'steamPool', 'M116 235 C205 236 260 260 325 260', '#1677FF', 12),
    flow('boilerPlant', 'steamPool', 'M272 106 C305 130 310 245 325 260', '#F79009', 15),
    flow('electricPool', 'prodA', 'M437 62 C465 62 480 54 505 54', '#00A870', 14),
    flow('gasPool', 'prodA', 'M437 128 C470 110 480 70 505 54', '#00A870', 7),
    flow('coalPool', 'prodA', 'M437 194 C472 160 485 80 505 54', '#00A870', 10),
    flow('electricPool', 'prodB', 'M437 62 C470 75 485 112 505 120', '#00A870', 9),
    flow('gasPool', 'prodB', 'M437 128 C470 128 485 122 505 120', '#00A870', 8),
    flow('steamPool', 'prodB', 'M437 260 C470 220 490 135 505 120', '#00A870', 10),
    flow('electricPool', 'utilities', 'M437 62 C475 95 495 176 505 186', '#00A870', 8),
    flow('steamPool', 'utilities', 'M437 260 C475 235 495 195 505 186', '#00A870', 7),
    flow('electricPool', 'office', 'M437 62 C500 105 520 240 505 252', '#00A870', 4),
    flow('prodA', 'rawPrep', 'M617 54 C645 45 665 38 690 38', '#23A35A', 10),
    flow('prodA', 'coreA', 'M617 54 C648 58 670 90 690 90', '#23A35A', 14),
    flow('prodB', 'coreB', 'M617 120 C648 120 670 142 690 142', '#23A35A', 14),
    flow('utilities', 'air', 'M617 186 C648 184 670 194 690 194', '#23A35A', 8),
    flow('utilities', 'otherUtility', 'M617 186 C650 202 672 246 690 246', '#23A35A', 8),
    flow('office', 'officeUse', 'M617 252 C648 260 670 298 690 298', '#23A35A', 5),
    flow('electricPool', 'external', 'M437 62 C610 62 790 105 900 106', '#7A5AF8', 4),
    flow('coalPool', 'unallocated', 'M437 194 C610 200 790 264 900 264', '#98A2B3', 3),
    flow('steamPool', 'unallocated', 'M437 260 C610 260 790 264 900 264', '#98A2B3', 5),
  ].join('');
  return `<svg class="sankey" viewBox="0 0 1040 350" aria-label="企业能源分配与利用图"><text x="12" y="18" font-size="12" font-weight="700">能源输入</text><text x="160" y="18" font-size="12" font-weight="700">能源转换</text><text x="325" y="18" font-size="12" font-weight="700">厂内能源介质</text><text x="505" y="18" font-size="12" font-weight="700">能源分配（一级）</text><text x="690" y="12" font-size="12" font-weight="700">能源利用（二级）</text><text x="900" y="18" font-size="12" font-weight="700">外部输出 / 未分配</text>${paths}${nodes}</svg>`;
}

function prodASankeySvg(level: FlowLevel, selected: string) {
  const node = (id: string, name: string, value: string, x: number, y: number, color: string, tip: string, width = 122, height = 52) =>
    `<g class="node ${selected === id ? 'selected' : ''}" data-key="${id}" data-name="${name}" data-value="${value}" data-tip="${tip}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="#fff" stroke="${color}"/><rect x="${x}" y="${y}" width="7" height="${height}" rx="3" fill="${color}"/><text x="${x + 18}" y="${y + 21}" font-size="12" fill="#172033">${name}</text><text x="${x + 18}" y="${y + 40}" font-size="10.5" fill="#5F6B7A">${value}</text></g>`;
  const flow = (a: string, b: string, path: string, color: string, width: number) =>
    `<path class="flow ${selected && [a, b].includes(selected) ? 'active' : ''}" data-keys="${a} ${b}" d="${path}" stroke="${color}" stroke-width="${width}"/>`;
  if (level === 'level1') {
    const nodes = [
      node('paElectric', '电力', '3,199 tce', 35, 62, '#1677FF', '生产单元A本级能源输入控制量'),
      node('paGas', '天然气', '1,240 tce', 35, 142, '#1677FF', '生产单元A本级能源输入控制量'),
      node('paSteam', '蒸汽', '465 tce', 35, 222, '#1677FF', '生产单元A本级能源输入控制量'),
      node('paOther', '其他能源', '256 tce', 35, 302, '#1677FF', '压缩空气等其他能源'),
      node('paUnit', '生产单元A', '已分配 5,060 tce', 500, 162, '#23A35A', '当前组织范围向下级的能源分配量'),
      node('paUnallocated', '未分配量', '100 tce', 850, 202, '#98A2B3', '本级控制量与下级分配量差额'),
    ].join('');
    const paths = [
      flow('paElectric', 'paUnit', 'M157 88 C310 100 410 185 500 188', '#1677FF', 25),
      flow('paGas', 'paUnit', 'M157 168 C310 168 410 188 500 188', '#1677FF', 17),
      flow('paSteam', 'paUnit', 'M157 248 C320 230 420 195 500 188', '#1677FF', 9),
      flow('paOther', 'paUnit', 'M157 328 C330 280 430 205 500 190', '#1677FF', 6),
      flow('paOther', 'paUnallocated', 'M157 330 C470 350 720 230 850 228', '#98A2B3', 4),
    ].join('');
    return `<svg class="sankey" viewBox="0 0 1000 390" aria-label="生产单元A一级能源分配图"><text x="35" y="27" font-size="14" font-weight="700">能源输入</text><text x="500" y="27" font-size="14" font-weight="700">能源分配（一级用能单元）</text><text x="850" y="27" font-size="14" font-weight="700">未分配</text>${paths}${nodes}</svg>`;
  }
  const nodes = [
    node('paElectric', '电力', '3,199 tce', 25, 54, '#1677FF', '生产单元A本级能源输入控制量', 112, 48),
    node('paGas', '天然气', '1,240 tce', 25, 124, '#1677FF', '生产单元A本级能源输入控制量', 112, 48),
    node('paSteam', '蒸汽', '465 tce', 25, 194, '#1677FF', '生产单元A本级能源输入控制量', 112, 48),
    node('paOther', '其他能源', '256 tce', 25, 264, '#1677FF', '压缩空气等其他能源', 112, 48),
    node('paDistribution', '生产单元A', '分配 5,060 tce', 360, 138, '#23A35A', '一级能源分配对象', 124, 50),
    node('paRaw', '原料制备', '1,480 tce', 650, 54, '#23A35A', '二级能源利用环节', 118, 48),
    node('paCore', '核心工序', '2,959 tce', 650, 144, '#23A35A', '二级能源利用环节', 118, 48),
    node('paPack', '包装发运', '621 tce', 650, 234, '#23A35A', '二级能源利用环节', 118, 48),
    node('paUnallocated', '未分配量', '100 tce', 875, 184, '#98A2B3', '本级控制量与二级利用量差额', 112, 48),
  ].join('');
  const paths = [
    flow('paElectric', 'paDistribution', 'M137 78 C235 85 300 150 360 162', '#1677FF', 22),
    flow('paGas', 'paDistribution', 'M137 148 C235 148 300 160 360 162', '#1677FF', 15),
    flow('paSteam', 'paDistribution', 'M137 218 C235 205 300 172 360 162', '#1677FF', 8),
    flow('paOther', 'paDistribution', 'M137 288 C235 250 300 185 360 164', '#1677FF', 6),
    flow('paDistribution', 'paRaw', 'M484 162 C540 125 590 80 650 78', '#23A35A', 11),
    flow('paDistribution', 'paCore', 'M484 162 C540 162 590 168 650 168', '#23A35A', 18),
    flow('paDistribution', 'paPack', 'M484 162 C540 205 590 258 650 258', '#23A35A', 8),
    flow('paOther', 'paUnallocated', 'M137 288 C430 320 710 210 875 208', '#98A2B3', 4),
  ].join('');
  return `<svg class="sankey" viewBox="0 0 1020 350" aria-label="生产单元A能源分配与利用图"><text x="25" y="24" font-size="13" font-weight="700">能源输入</text><text x="360" y="24" font-size="13" font-weight="700">能源分配（一级）</text><text x="650" y="24" font-size="13" font-weight="700">能源利用（二级）</text><text x="875" y="24" font-size="13" font-weight="700">未分配</text>${paths}${nodes}</svg>`;
}
