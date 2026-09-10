import styles from './DataManagementV11.module.css';

export function MonthlyDataDetails({ values, reported, annualValue, annualSupplemented = false, unit, title = '月度明细', onCollapse }: {
  values: Array<number | null | undefined>;
  reported?: boolean[];
  annualValue?: number;
  annualSupplemented?: boolean;
  unit: string;
  title?: string;
  onCollapse?: () => void;
}) {
  const visibleMonths = Array.from({ length: 12 }, (_, index) =>
    values[index] != null && (reported?.[index] ?? true));
  const format = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  return <div className={styles.detailPanel} role="region" aria-label={title}>
    <div className={styles.detailHead}><span>{title}</span><span>计量单位：{unit}</span></div>
    <div className={styles.monthDetailGrid}>{visibleMonths.map((visible, index) => <div key={index} data-month={index + 1}>
      <span>{index + 1}月</span><strong>{visible ? format(values[index]!) : '—'}</strong>
    </div>)}</div>
    {!visibleMonths.some(Boolean) && <p className={styles.helpText}>{annualValue != null ? '仅有年度数据，暂无月度明细。' : '暂无月度数据。'}</p>}
    <div className={styles.summaryLine}>{annualSupplemented ? '年度总量（补录）' : '年度合计'} <strong>{annualValue == null ? '—' : format(annualValue)}</strong> {unit}</div>
    {onCollapse && <div className={styles.detailCollapse}><button type="button" onClick={onCollapse}>收起明细</button></div>}
  </div>;
}
