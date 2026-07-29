/* eslint-disable no-irregular-whitespace, react-refresh/only-export-components */
import { type FormEvent, type ReactNode } from 'react';
import s from './Prototype.module.css';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`${s.card} ${className}`}>{children}</section>;
}

export function Button({ children, primary, danger, onClick, type = 'button', disabled }: {
  children: ReactNode; primary?: boolean; danger?: boolean; onClick?: () => void;
  type?: 'button' | 'submit'; disabled?: boolean;
}) {
  return <button className={`${s.btn} ${primary ? s.btnPrimary : ''} ${danger ? s.btnDanger : ''}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'blue' | 'orange' | 'red' | 'gray' }) {
  return <span className={`${s.tag} ${s[`tag${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>{children}</span>;
}

export function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className={s.tabs}>{items.map((item) => <button type="button" key={item} onClick={() => onChange(item)} className={item === active ? s.tabActive : ''}>{item}</button>)}</div>;
}

export function FilterBar({ children, onSearch, onReset, actions }: { children: ReactNode; onSearch?: () => void; onReset?: () => void; actions?: ReactNode }) {
  return <Card className={s.filters}><div className={s.filterFields}>{children}</div><div className={s.filterButtons}>{onSearch && <Button primary onClick={onSearch}>查询</Button>}{onReset && <Button onClick={onReset}>重置</Button>}{actions}</div></Card>;
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className={s.field}><span>{required && <i>*</i>}{label}</span>{children}</label>;
}

export function Table({ headers, rows, onRow }: { headers: string[]; rows: ReactNode[][]; onRow?: (index: number) => void }) {
  return <div className={s.tableWrap}><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} onClick={() => onRow?.(i)}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  render?: (record: T, index: number) => ReactNode;
}

export function DataTable<T>({ columns, data, rowKey, rowClassName, emptyText = '暂无数据' }: {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (record: T, index: number) => string;
  rowClassName?: (record: T, index: number) => string;
  emptyText?: string;
}) {
  return <div className={s.tableWrap}><table><colgroup>{columns.map((column) => <col key={String(column.key)} style={column.width ? { width: column.width } : undefined} />)}</colgroup><thead><tr>{columns.map((column) => <th key={String(column.key)}>{column.title}</th>)}</tr></thead><tbody>{data.length ? data.map((record, index) => <tr key={rowKey(record, index)} className={rowClassName?.(record, index)}>{columns.map((column) => <td key={String(column.key)}>{column.render ? column.render(record, index) : String((record as Record<string, unknown>)[String(column.key)] ?? '')}</td>)}</tr>) : <tr><td className={s.tableEmpty} colSpan={columns.length}>{emptyText}</td></tr>}</tbody></table></div>;
}

export function Modal({ title, children, onClose, onSubmit, width = 680, submitText = '保存', cancelText = '取消' }: {
  title: string; children: ReactNode; onClose: () => void; onSubmit?: () => void; width?: number; submitText?: string; cancelText?: string;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (e.currentTarget.reportValidity()) onSubmit?.();
  };
  return <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className={s.modal} style={{ width }} onSubmit={submit}>
      <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
      <div className={s.modalBody}>{children}</div>
      <footer><Button onClick={onClose}>{cancelText}</Button>{onSubmit && <Button primary type="submit">{submitText}</Button>}</footer>
    </form>
  </div>;
}

export function Drawer({ title, children, onClose, footer, width = 620 }: {
  title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: number;
}) {
  return <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className={s.drawer} style={{ width }}>
      <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
      <div className={s.drawerBody}>{children}</div>
      <footer>{footer ?? <Button onClick={onClose}>关闭</Button>}</footer>
    </aside>
  </div>;
}

export function Toast({ message }: { message: string }) {
  return message ? <div className={s.toast}>✓　{message}</div> : null;
}

export function SectionHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return <div className={s.sectionHead}><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div><div>{actions}</div></div>;
}

export function Kpis({ items }: { items: { label: string; value: string; unit?: string; sub?: string; tone?: string }[] }) {
  return <div className={s.kpis}>{items.map((x) => <Card className={`${s.kpi} ${x.tone ? s[x.tone] : ''}`} key={x.label}><span>{x.label}</span><strong>{x.value}<small>{x.unit}</small></strong>{x.sub && <p>{x.sub}</p>}</Card>)}</div>;
}

export function Donut({ values, labels, colors, total, unit = 'tCO₂e' }: {
  values: number[]; labels: string[]; colors: string[]; total: string; unit?: string;
}) {
  const sum = values.reduce((a, b) => a + b, 0);
  return <div className={s.donutBox}><svg className={s.donut} viewBox="0 0 140 140"><circle cx="70" cy="70" r="48" fill="none" stroke="#edf1f4" strokeWidth="18" />{values.map((v, i) => {
    const len = v / sum * 301.6;
    const offset = values.slice(0, i).reduce((acc, value) => acc + value / sum * 301.6, 0);
    return <circle key={labels[i]} cx="70" cy="70" r="48" fill="none" stroke={colors[i]} strokeWidth="18" strokeDasharray={`${len} ${301.6 - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
  })}<text x="70" y="68" textAnchor="middle">{total}</text><text x="70" y="86" textAnchor="middle" className={s.svgUnit}>{unit}</text></svg><div className={s.legend}>{labels.map((l, i) => <div key={l}><i style={{ background: colors[i] }} /><span>{l}</span><b>{Math.round(values[i] / sum * 100)}%</b></div>)}</div></div>;
}

export function LineChart({ values, labels, color = '#2385f5', compare, target }: {
  values: number[]; labels: string[]; color?: string; compare?: number[]; target?: number;
}) {
  const all = [...values, ...(compare ?? []), target ?? 0];
  const max = Math.max(...all) * 1.12;
  const point = (v: number, i: number, count: number) => `${7 + i / Math.max(1, count - 1) * 88},${88 - v / max * 72}`;
  return <div className={s.chart}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><g className={s.grid}>{[16, 40, 64, 88].map((y) => <line x1="7" x2="95" y1={y} y2={y} key={y} />)}</g>{target !== undefined && <line x1="7" x2="95" y1={88 - target / max * 72} y2={88 - target / max * 72} className={s.target} />}<polyline points={values.map((v, i) => point(v, i, labels.length)).join(' ')} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />{compare && <polyline points={compare.map((v, i) => point(v, i, labels.length)).join(' ')} fill="none" stroke="#ff9e36" strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}</svg><div className={s.axis}>{labels.map((l) => <span key={l}>{l}</span>)}</div></div>;
}

export { s };
