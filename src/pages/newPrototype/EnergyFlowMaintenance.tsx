import { InlineDataForm as InlineFlowForm } from './InlineDataForm';
import { useInlineEditGuard } from './useInlineEditGuard';
import { DATA_YEARS } from '../../mocks/annualData';
import { MonthlyDataDetails } from './MonthlyDataDetails';
import { useDataYear } from './useDataYear';
import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import {
  listV11ConversionOutputs, listV11ExternalSupplyRecords, listV11EnergyRecords, listV11EnergyTypes,
  v11ScopeName, v11RecordScopeType, saveFlowConversion, saveFlowExternal, saveFlowExternalMonth,
  deleteFlowConversionData, deleteFlowExternalData, flowExternalIssue,
  type V11ConversionOutput, type V11ExternalSupplyRecord, type ConversionOutputType,
} from '../../mocks/dataManagementV11Store';
import { Button, Field, Modal, Toast } from './PrototypeUI';
import s from './EnergyFlowMaintenance.module.css';

// 本页弹窗统一键盘操作及焦点恢复，不影响其他原型页面。
function FlowModal(props: ComponentProps<typeof Modal>) {
  const { onClose } = props;
  const scope = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = scope.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const title = dialog.querySelector('h2');
    if (title) { title.id = titleId; dialog.setAttribute('aria-labelledby', titleId); }
    dialog.querySelector('header > button')?.setAttribute('aria-label', '关闭弹窗');
    const first = dialog.querySelector<HTMLElement>('input:not([readonly]), select, textarea, footer button');
    first?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); };
  }, [titleId]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const targets = [...(scope.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])].filter((el) => !el.closest('details:not([open])') || el.tagName === 'SUMMARY');
      const first = targets[0]; const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return <div ref={scope} className={s.modalScope}><Modal {...props} /></div>;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const number = (value: number | undefined) => value == null ? '待填报' : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
function patchMonth(values: number[] | undefined, index: number, value: number) {
  return Array.from({ length: 12 }, (_, i) => i === index ? value : values?.[i] ?? 0);
}
function patchReported(values: boolean[] | undefined, amounts: number[] | undefined, index: number) {
  return Array.from({ length: 12 }, (_, i) => i === index || (values?.[i] ?? amounts?.[i] != null));
}
function conversionUnitName(unitId: string | null, year = 2026) {
  const unit = listEnergyUnits(year).find((item) => item.energyUnitId === unitId);
  return unit?.parentEnergyUnitId ? `${v11ScopeName(unit.parentEnergyUnitId, year)} / ${unit.energyUnitName}` : v11ScopeName(unitId, year);
}
function inputRecord(row: V11ConversionOutput) { return listV11EnergyRecords().find((r) => r.energyRecordId === row.inputEnergyRecordId && r.year === row.year && v11RecordScopeType(r) === 'energyUnit' && r.scopeLevel === '二级用能单元' && r.energyUnitId === row.conversionEnergyUnitId); }
function inputName(row: V11ConversionOutput) {
  const source = inputRecord(row);
  return listV11EnergyTypes(row.year).find((t) => t.energyTypeId === (source?.energyTypeId ?? row.inputEnergyTypeId))?.energyTypeName ?? row.recoveryEnergyName ?? '投入能源';
}
function reportedTotal(amounts: number[] | undefined, reported?: boolean[], annualAmount?: number) {
  if (!amounts) return annualAmount;
  const values = amounts.filter((value, i) => value != null && reported?.[i] !== false);
  return values.length ? sum(values) : undefined;
}
function outputAmount(row: V11ConversionOutput, index: number | null) {
  return index === null ? reportedTotal(row.monthlyOutputAmounts, row.monthlyOutputReported, row.outputAmount)
    : row.monthlyOutputReported?.[index] === false ? undefined : row.monthlyOutputAmounts?.[index];
}
function lossAmount(row: V11ConversionOutput, index: number | null) {
  return index === null ? reportedTotal(row.monthlyLossAmounts, row.monthlyLossReported, row.monthlyLossAmounts ? undefined : row.lossAmount || undefined)
    : row.monthlyLossReported?.[index] === false ? undefined : row.monthlyLossAmounts?.[index];
}
function outputIssue(row: V11ConversionOutput, index: number | null) {
  return outputAmount(row, index) == null ? '本期产出待填报' : '';
}
function inputAmount(row: V11ConversionOutput, index: number | null) {
  const source = inputRecord(row);
  if (!source) return undefined;
  if (index === null) return source.entryMode === 'annual' || source.annualAmount > 0 ? source.annualAmount : reportedTotal(source.monthlyAmounts, source.monthlyReportedMonths);
  if (source?.entryMode === 'annual') return undefined;
  return source.monthlyReportedMonths?.[index] === false ? undefined : source.monthlyAmounts[index];
}
function inputUnit(row: V11ConversionOutput) {
  return listV11EnergyTypes(row.year).find((t) => t.energyTypeId === inputRecord(row)?.energyTypeId)?.measurementUnit ?? row.recoveryUnit ?? row.inputUnit ?? '';
}
function isRecovery(row: V11ConversionOutput) {
  return row.inputMode === 'recovery' || inputRecord(row)?.energyRole === '回收能源';
}
function recoverySourceName(row: V11ConversionOutput) {
  const units = listEnergyUnits(row.year);
  const sourceId = row.recoverySourceEnergyUnitId ?? inputRecord(row)?.energyUnitId;
  const unit = units.find((item) => item.energyUnitId === sourceId);
  return unit ? v11ScopeName(unit.unitLevel === 'level2' ? unit.parentEnergyUnitId : unit.energyUnitId, row.year) : '来源待完善';
}

function externalAmount(row: V11ExternalSupplyRecord, index: number | null) {
  return index === null ? reportedTotal(row.monthlyAmounts, row.monthlyReported, row.amount)
    : row.monthlyReported?.[index] === false ? undefined : row.monthlyAmounts?.[index];
}
function externalIssue(row: V11ExternalSupplyRecord, index: number | null) {
  if (index !== null) return flowExternalIssue(row, index + 1);
  if (!row.monthlyAmounts) return '缺少月度数据，待核验';
  for (let i = 0; i < 12; i += 1) {
    if (externalAmount(row, i) == null) continue;
    const issue = flowExternalIssue(row, i + 1);
    if (issue) return `${i + 1}月：${issue}`;
  }
  return '';
}

type Editor = { kind: 'external'; item?: V11ExternalSupplyRecord } | { kind: 'conversion'; unitId: string; conversionId?: string };

export function EnergyFlowMaintenance() {
  const [year] = useDataYear();
  return <AnnualFlowMaintenance key={year} />;
}
function AnnualFlowMaintenance() {
  const [maintenanceYear, changeYear] = useDataYear();
  const { guard, onDirtyChange, confirmation } = useInlineEditGuard();
  const changeMaintenanceYear = (next: string) => guard(() => changeYear(next));
  const year = Number(maintenanceYear);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const linkedMonth = Number(params.get('month'));
  const linkedConversionId = params.get('editConversionId') ?? '';
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedConversionId, setExpandedConversionId] = useState(linkedMonth >= 1 && linkedMonth <= 12 ? linkedConversionId : '');
  const [expandedExternalId, setExpandedExternalId] = useState('');
  const editingMonth = linkedMonth >= 1 && linkedMonth <= 12 ? linkedMonth : 1;
  const [editingConversionId, setEditingConversionId] = useState(linkedMonth >= 1 && linkedMonth <= 12 ? linkedConversionId : '');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'conversion' | 'external'; id: string; name: string; month?: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const refresh = (text: string) => { setVersion((value) => value + 1); setMessage(text); };
  const conversions = listV11ConversionOutputs().filter((row) => row.year === year && row.recordType !== '直接外供');
  const external = listV11ExternalSupplyRecords().filter((row) => row.year === year);
  const units = listEnergyUnits(year);
  const types = listV11EnergyTypes(year);
  const energyRecords = listV11EnergyRecords().filter((row) => row.year === year);
  const pendingUnits = units.filter((unit) => unit.unitLevel === 'level2' && (unit.parentEnergyUnitId === 'eu-utilities' || unit.conversionScenarios?.length) && !conversions.some((row) => row.conversionEnergyUnitId === unit.energyUnitId));
  const parentIds = [...new Set([...conversions.map((row) => units.find((unit) => unit.energyUnitId === row.conversionEnergyUnitId)?.parentEnergyUnitId), ...pendingUnits.map((unit) => unit.parentEnergyUnitId)])];
  const commonParentId = parentIds.length === 1 ? parentIds[0] : undefined;
  const unitColumnLabel = commonParentId ? `用能单元（${v11ScopeName(commonParentId, year)}）` : '用能单元';
  const unitRowName = (id: string | null) => commonParentId ? v11ScopeName(id, year) : conversionUnitName(id, year);
  const goConversionInput = (row: V11ConversionOutput, month: number) => {
    const record = inputRecord(row);
    const energyTypeId = record?.energyTypeId ?? row.inputEnergyTypeId ?? types.find((type) => type.energyTypeName === row.recoveryEnergyName)?.energyTypeId ?? '';
    const unitId = row.conversionEnergyUnitId ?? '';
    const returnParams = new URLSearchParams({ tab: 'conversion', year: String(year), month: String(month), editConversionId: row.conversionOutputId });
    const target = new URLSearchParams({ year: String(year), month: String(month), unitId, scopeLevel: '二级用能单元', energyTypeId, keyword: v11ScopeName(unitId, year), entry: 'list', conversionInputId: row.conversionOutputId, returnTo: `/data-management/energy-data?${returnParams}` });
    if (record) target.set('recordId', record.energyRecordId);
    navigate(`/data-management/energy-data?${target}`);
  };
  const externalSourceLabel = (row: V11ExternalSupplyRecord) => {
    const system = conversions.find((item) => item.conversionOutputId === row.conversionOutputId);
    if (system) return unitRowName(system.conversionEnergyUnitId);
    const record = energyRecords.find((item) => item.energyRecordId === row.inputEnergyRecordId);
    return record ? `外购直供 · ${types.find((type) => type.energyTypeId === record.energyTypeId)?.energyTypeName ?? '能源'}` : '来源待完善';
  };
  const filtered = conversions.filter((row) => `${conversionUnitName(row.conversionEnergyUnitId, year)}${inputName(row)}${row.outputEnergyName}${isRecovery(row) ? recoverySourceName(row) : ''}`.toLowerCase().includes(keyword.trim().toLowerCase()));
  const visiblePendingUnits = pendingUnits.filter((unit) => conversionUnitName(unit.energyUnitId, year).toLowerCase().includes(keyword.trim().toLowerCase()));
  const visibleExternal = external.filter((row) => `${row.receiver ?? ''}${types.find((type) => type.energyTypeId === row.energyTypeId)?.energyTypeName ?? ''}${externalSourceLabel(row)}`.toLowerCase().includes(keyword.trim().toLowerCase()));
  const collapseDetails = () => guard(() => { setEditingConversionId(''); setEditor(null); setExpandedConversionId(''); setExpandedExternalId(''); });
  const deletionPeriod = deleting?.month ? `${year}年${deleting.month}月` : `${year}年`;
  return <div className={s.page}>
    <p className={s.hint} role="note"><strong>{year} 年度独立维护</strong> · 列表展示年度汇总，查看和编辑均从月度明细进入，修改不影响其他年度。</p>
    <form className={s.toolbar} onSubmit={(event) => { event.preventDefault(); guard(() => { setEditingConversionId(''); setEditor(null); setKeyword(keywordInput); setExpandedConversionId(''); setExpandedExternalId(''); }); }}>
      <Field label="年度"><select aria-label="数据年度" value={maintenanceYear} onChange={(event) => changeMaintenanceYear(event.target.value)}>{[...new Set([year, ...DATA_YEARS])].sort((a, b) => b - a).map((option) => <option key={option}>{option}</option>)}</select></Field>
      <Field label="关键词"><input aria-label="流转关键字" placeholder="用能单元、能源或接收方" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} /></Field>
      <div className={s.spacer} />
      <Button onClick={() => guard(() => { setEditingConversionId(''); setEditor(null); setKeywordInput(''); setKeyword(''); setExpandedConversionId(''); setExpandedExternalId(''); setMessage(''); })}>重置</Button>
      <Button primary type="submit">查询</Button>
    </form>
    <section className={s.card} aria-label="用能单元数据">
      <div className={s.sectionHeader}><h2>转换与回收</h2></div>
      <div className={s.tableWrap}><table className={s.conversionTable}><thead><tr><th>{unitColumnLabel}</th><th>能源关系</th><th>产出能源</th><th>年度能源投入</th><th>年度产出</th><th>年度损失</th><th>操作</th></tr></thead><tbody>
        {filtered.flatMap((row) => {
          const detail = expandedConversionId === row.conversionOutputId;
          const missingInputMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => inputAmount(row, month - 1) == null);
          return [<tr key={row.conversionOutputId} className={detail ? s.selected : ''}>
            <td><strong>{unitRowName(row.conversionEnergyUnitId)}</strong></td><td className={s.relation}>{inputName(row)} → {row.outputEnergyName}</td><td>{row.outputEnergyName}</td>
            <td><strong className={inputAmount(row, null) == null ? s.missing : s.value}>{inputAmount(row, null) == null ? '待补充' : `${number(inputAmount(row, null))} ${inputUnit(row)}`}</strong>{missingInputMonths.length > 0 && <div className={s.inputMissing}><span>{missingInputMonths.length === 12 ? '全年月度投入待补充' : `缺 ${missingInputMonths.join('、')} 月投入`}</span><button className={s.link} onClick={() => guard(() => goConversionInput(row, missingInputMonths[0]))}>补充数据</button></div>}</td>
            <td><strong className={outputIssue(row, null) ? s.missing : s.value}>{outputIssue(row, null) ? '待填报' : `${number(outputAmount(row, null))} ${row.outputUnit}`}</strong></td>
            <td><span className={lossAmount(row, null) == null ? s.muted : s.value}>{lossAmount(row, null) == null ? '未填写' : `${number(lossAmount(row, null))} ${row.outputUnit}`}</span></td>
            <td><div className={s.actions}><button className={s.link} onClick={() => guard(() => { setEditingConversionId(''); setEditor(null); setExpandedConversionId(detail ? '' : row.conversionOutputId); })} aria-expanded={detail}>{detail ? '收起' : '查看'}</button><button className={s.link} onClick={() => guard(() => { setEditor(null); setExpandedExternalId(''); setExpandedConversionId(row.conversionOutputId); setEditingConversionId(row.conversionOutputId); })}>编辑</button><button className={`${s.link} ${s.danger}`} disabled={outputAmount(row, null) == null && lossAmount(row, null) == null} onClick={() => guard(() => setDeleting({ kind: 'conversion', id: row.conversionOutputId, name: unitRowName(row.conversionEnergyUnitId) }))}>删除</button></div></td>
          </tr>, detail && <tr key={`${row.conversionOutputId}-detail`} className={s.monthDetailRow}><td colSpan={7}>
            {editingConversionId === row.conversionOutputId ? <ConversionDetails key={`${row.conversionOutputId}:${version}`} row={row} initialMonth={editingMonth} onDirtyChange={onDirtyChange} onClose={() => setEditingConversionId('')} onSaved={(text) => { setEditingConversionId(''); refresh(text); }} onSource={(month) => guard(() => goConversionInput(row, month))} /> : <>
              <MonthlyDataDetails title="能源投入月度明细" values={Array.from({ length: 12 }, (_, index) => inputAmount(row, index))} annualValue={inputAmount(row, null)} unit={inputUnit(row)} />
              <MonthlyDataDetails title="能源产出月度明细" values={Array.from({ length: 12 }, (_, index) => outputAmount(row, index))} annualValue={outputAmount(row, null)} unit={row.outputUnit ?? ''} />
              <MonthlyDataDetails onCollapse={collapseDetails} title="已确认损失月度明细" values={Array.from({ length: 12 }, (_, index) => lossAmount(row, index))} annualValue={lossAmount(row, null)} unit={row.outputUnit ?? ''} />
            </>}
          </td></tr>];
        })}
        {visiblePendingUnits.map((unit) => <tr key={unit.energyUnitId}><td><strong>{unitRowName(unit.energyUnitId)}</strong></td><td>—</td><td>—</td><td>—</td><td>待填报</td><td>未填写</td><td><div className={s.actions}><button className={s.link} disabled>查看</button><button className={s.link} onClick={() => guard(() => { setEditingConversionId(''); setEditor(null); setEditor({ kind: 'conversion', unitId: unit.energyUnitId }); })}>编辑</button><button className={`${s.link} ${s.danger}`} disabled>删除</button></div></td></tr>)}
        {!filtered.length && !visiblePendingUnits.length && <tr><td colSpan={7} className={s.empty}>{keyword.trim() ? '没有匹配的用能单元，请调整关键词。' : '暂无参与转换与回收的用能单元，请在用能单元管理中维护。'}</td></tr>}
      </tbody></table></div>
    </section>
    <section className={s.card} aria-label="对外供能台账">
      <div className={s.sectionHeader}><h2>外供记录</h2><Button primary onClick={() => guard(() => { setEditingConversionId(''); setEditor(null); setEditor({ kind: 'external' }); })}>＋ 登记外供</Button></div>
      <div id="external-records"><div className={s.tableWrap}><table className={s.externalTable}><thead><tr><th>外供能源</th><th>供能来源</th><th>接收方</th><th>年度数量</th><th>操作</th></tr></thead><tbody>
        {visibleExternal.flatMap((row) => {
          const energy = types.find((type) => type.energyTypeId === row.energyTypeId);
          const reported = externalAmount(row, null) != null;
          const issue = externalIssue(row, null);
          const detail = expandedExternalId === row.externalSupplyId;
          return [<tr key={row.externalSupplyId}><td><strong>{energy?.energyTypeName ?? '能源'}</strong></td><td>{externalSourceLabel(row)}</td><td>{row.receiver || '接收方待完善'}</td><td><strong className={reported ? s.value : s.missing}>{reported ? `${number(externalAmount(row, null))} ${row.unit ?? ''}` : '待填报'}</strong>{reported && issue && <small className={s.externalIssue}>待核验：{issue}</small>}</td><td><div className={s.actions}><button className={s.link} onClick={() => guard(() => { setEditor(null); setEditingConversionId(''); setExpandedExternalId(detail ? '' : row.externalSupplyId); })} aria-expanded={detail}>{detail ? '收起' : '查看'}</button><button className={s.link} onClick={() => guard(() => { setEditingConversionId(''); setExpandedConversionId(''); setExpandedExternalId(row.externalSupplyId); setEditor({ kind: 'external', item: row }); })}>编辑</button><button className={`${s.link} ${s.danger}`} disabled={!reported} onClick={() => guard(() => setDeleting({ kind: 'external', id: row.externalSupplyId, name: `${energy?.energyTypeName ?? '能源'} · ${row.receiver || '未填写接收方'}` }))}>删除</button></div></td></tr>,
            detail && <tr key={`${row.externalSupplyId}-detail`} className={s.monthDetailRow}><td colSpan={5}><MonthlyDataDetails onCollapse={collapseDetails} title="外供月度明细" editor={editor?.kind === 'external' && editor.item?.externalSupplyId === row.externalSupplyId ? <FlowRecordDialog onDirtyChange={onDirtyChange} inline key={`${row.externalSupplyId}:${version}`} editor={editor} year={year} index={editingMonth - 1} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh('记录已保存'); }} /> : undefined} values={Array.from({ length: 12 }, (_, index) => externalAmount(row, index))} annualValue={externalAmount(row, null)} unit={row.unit ?? ''} />{row.remark && <p className={s.hint}>备注：{row.remark}</p>}</td></tr>];
        })}
        {!visibleExternal.length && <tr><td colSpan={5} className={s.empty}>{external.length ? '没有匹配的外供记录，请调整关键词。' : '本年度暂无外供记录。'}</td></tr>}
      </tbody></table></div></div>
    </section>
    {editor && !(editor.kind === 'external' && editor.item) && <FlowRecordDialog key={`${editor.kind}:${editingMonth}`} editor={editor} year={year} index={editingMonth - 1} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh('记录已保存'); }} />}
    {deleting && <FlowModal title={deleting.kind === 'conversion' ? '删除产出与损失数据' : '删除外供数据'} width={520} onClose={() => setDeleting(null)} footer={<><Button onClick={() => setDeleting(null)}>取消</Button><Button danger type="submit">确认删除</Button></>} onSubmit={() => { if (deleting.kind === 'conversion') deleteFlowConversionData(deleting.id, deleting.month); else deleteFlowExternalData(deleting.id, deleting.month); setDeleting(null); refresh('所选期间数据已删除'); }}><div className={s.deleteNotice}><p>确认删除“{deleting.name}”{deletionPeriod}的{deleting.kind === 'conversion' ? '产出与损失数据' : '外供数据'}？{deleting.month ? '其他月份保留。' : '将清除该年度全部月份。'}</p>{deleting.kind === 'conversion' && <p className={s.hint}>投入记录、用能单元及已登记外供保留；相关外供将提示来源待补录。</p>}</div></FlowModal>}
    {confirmation}
    <Toast message={message} />
  </div>;
}

function ConversionDetails({ row, initialMonth, onClose, onSaved, onSource, onDirtyChange }: { row: V11ConversionOutput; initialMonth: number; onClose: () => void; onSaved: (text: string) => void; onSource: (month: number) => void; onDirtyChange: (dirty: boolean) => void }) {
  const initialOutputs = Array.from({ length: 12 }, (_, index) => String(outputAmount(row, index) ?? ''));
  const initialLosses = Array.from({ length: 12 }, (_, index) => String(lossAmount(row, index) ?? ''));
  const initialRemark = row.lossBasis ?? ((row.lossAmount ?? 0) > 0 ? row.remark : '') ?? '';
  const [outputs, setOutputs] = useState(initialOutputs);
  const [losses, setLosses] = useState(initialLosses);
  const [remark, setRemark] = useState(initialRemark);
  const [error, setError] = useState('');
  const outputChanged = outputs.some((value, index) => value !== initialOutputs[index]);
  const lossChanged = losses.some((value, index) => value !== initialLosses[index]);
  const changed = outputChanged || lossChanged || remark !== initialRemark;
  const missingInput = Array.from({ length: 12 }, (_, index) => inputAmount(row, index)).findIndex((value) => value == null);
  const save = () => {
    const next = { ...row };
    if (outputChanged) { next.monthlyOutputAmounts = outputs.map((value) => Number(value || 0)); next.monthlyOutputReported = outputs.map((value) => value !== ''); next.outputAmount = sum(next.monthlyOutputAmounts); }
    if (lossChanged) { next.monthlyLossAmounts = losses.map((value) => Number(value || 0)); next.monthlyLossReported = losses.map((value) => value !== ''); next.lossAmount = sum(next.monthlyLossAmounts); }
    if (remark !== initialRemark || lossChanged) next.lossBasis = remark;
    const result = saveFlowConversion(next, row.conversionOutputId);
    if (!result.ok) { setError(result.error); return; }
    onSaved('年度月度数据已保存');
  };
  return <InlineFlowForm draft={[outputs, losses, remark]} onDirtyChange={onDirtyChange} title={`${conversionUnitName(row.conversionEnergyUnitId, row.year)} · ${row.year}年度`} description="直接填写各月产出与已确认损失，空白表示未填报，实际为零请填 0。" onClose={onClose} onSubmit={save} footer={<><Button onClick={onClose}>取消</Button><Button primary type="submit" disabled={!changed}>保存</Button></>}>
    {missingInput >= 0 && <p className={s.hint}>投入数据来自能源消费。<button type="button" className={s.link} onClick={() => onSource(missingInput + 1)}>补充数据</button></p>}
    <div className={s.monthEditorWrap}><table className={s.monthEditorTable}><thead><tr><th>月份</th><th>能源投入（{inputUnit(row)}）</th><th>产出（{row.outputUnit}）</th><th>已确认损失（{row.outputUnit}）</th></tr></thead><tbody>{outputs.map((value, index) => <tr key={index} data-month={index + 1}><td>{index + 1}月</td><td>{number(inputAmount(row, index))}</td><td><input autoFocus={initialMonth === index + 1} aria-label={`${index + 1}月产出量`} type="number" min="0" step="any" value={value} onChange={(event) => setOutputs((current) => current.map((item, i) => i === index ? event.target.value : item))} /></td><td><input aria-label={`${index + 1}月已确认损失`} type="number" min="0" step="any" value={losses[index]} onChange={(event) => setLosses((current) => current.map((item, i) => i === index ? event.target.value : item))} /></td></tr>)}</tbody></table></div>
    <Field label="损失备注（选填）"><input aria-label="损失备注" value={remark} onChange={(event) => setRemark(event.target.value)} /></Field>
    {error && <p role="alert" className={s.error}>{error}</p>}
  </InlineFlowForm>;
}

function FlowRecordDialog({ editor, year, index, onClose, onSaved, inline = false, onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void; inline?: boolean; editor: Editor; year: number; index: number; onClose: () => void; onSaved: () => void }) {
  const Form = inline ? InlineFlowForm : FlowModal;
  const e = editor.kind === 'external' ? editor.item : undefined;
  const kind = editor.kind;
  const [error, setError] = useState('');
  const conversions = listV11ConversionOutputs().filter((r) => r.year === year && r.recordType !== '直接外供');
  const records = listV11EnergyRecords().filter((r) => r.year === year && ['能源消费', '回收能源'].includes(r.energyRole));
  const types = listV11EnergyTypes(year);
  const units = listEnergyUnits(year);
  const [externalSource, setExternalSource] = useState(e?.conversionOutputId ?? e?.inputEnergyRecordId ?? '');
  const externalConversion = conversions.find((r) => r.conversionOutputId === externalSource);
  const externalRecord = records.find((r) => r.energyRecordId === externalSource);
  const externalType = types.find((t) => t.energyTypeId === (externalConversion?.outputEnergyTypeId ?? externalRecord?.energyTypeId));
  const [receiver, setReceiver] = useState(e?.receiver ?? '');
  const initialAmounts = Array.from({ length: 12 }, (_, i) => e?.monthlyReported?.[i] === false ? '' : String(e?.monthlyAmounts?.[i] ?? ''));
  const [amounts, setAmounts] = useState(initialAmounts);
  const [sourceMonth, setSourceMonth] = useState(index);
  const sourceChanged = Boolean(e && externalSource !== (e.conversionOutputId ?? e.inputEnergyRecordId));
  const quantityChanged = amounts.some((value, i) => value !== initialAmounts[i]);
  const [remark, setRemark] = useState(e?.remark ?? '');
  const unitId = editor.kind === 'conversion' ? editor.unitId : '';
  const [inputId, setInputId] = useState('');
  const selectedInput = records.find((record) => record.energyRecordId === inputId);
  const recoveryEditor = kind === 'conversion' && (inputId === 'recovery' || selectedInput?.energyRole === '回收能源');
  const [sourceUnit, setSourceUnit] = useState('');
  const [recoveryType, setRecoveryType] = useState('v11-energy-waste-heat');
  const [outputType, setOutputType] = useState('');
  const save = () => {
    if (kind === 'external') {
      if (!externalType || !(sourceChanged ? amounts[sourceMonth] !== '' : amounts.some((value) => value !== ''))) { setError('请选择供能来源并填写月度外供数量。'); return; }
      const monthlyAmounts = sourceChanged ? patchMonth(e?.monthlyAmounts, sourceMonth, Number(amounts[sourceMonth])) : amounts.map((value) => Number(value || 0));
      const input = { ...e, year, conversionOutputId: externalConversion?.conversionOutputId, inputEnergyRecordId: externalRecord?.energyRecordId, energyTypeId: externalType.energyTypeId, unit: externalConversion?.outputUnit ?? externalType.measurementUnit, receiver: receiver.trim(), remark, amount: sum(monthlyAmounts), monthlyAmounts, monthlyReported: sourceChanged ? patchReported(e?.monthlyReported, e?.monthlyAmounts, sourceMonth) : amounts.map((value) => value !== '') };
      const result = sourceChanged ? saveFlowExternalMonth(input, sourceMonth, e?.externalSupplyId) : saveFlowExternal(input, e?.externalSupplyId);
      if (!result.ok) { setError(result.error); return; }
    } else {
      const source = records.find((r) => r.energyRecordId === inputId);
      const recovery = recoveryEditor;
      if (!recovery && !source) { setError('请选择投入数据来源。'); return; }
      const rt = types.find((t) => t.energyTypeId === recoveryType);
      const scene = units.find((u) => u.energyUnitId === unitId)?.conversionScenarios?.[0] as ConversionOutputType | undefined;
      const monthlyOutputAmounts = amounts.map((value) => Number(value || 0));
      const result = saveFlowConversion({ year, recordType: recovery ? scene === '余热发电' ? scene : '回收利用' : scene ?? '其他转换', conversionEnergyUnitId: unitId, inputMode: recovery ? 'recovery' : 'linked', inputEnergyRecordId: source?.energyRecordId, recoverySourceEnergyUnitId: recovery ? source?.energyUnitId ?? sourceUnit : undefined, recoveryEnergyName: recovery ? source ? types.find((t) => t.energyTypeId === source.energyTypeId)?.energyTypeName : rt?.energyTypeName : undefined, recoveryUnit: recovery ? source ? types.find((t) => t.energyTypeId === source.energyTypeId)?.measurementUnit : rt?.measurementUnit : undefined, recoveryAmount: 0, outputEnergyTypeId: outputType, externalAmount: 0, outputAmount: sum(monthlyOutputAmounts), monthlyOutputAmounts, monthlyOutputReported: amounts.map((value) => value !== ''), remark });
      if (!result.ok) { setError(result.error); return; }
    }
    onSaved();
  };
  return <Form draft={[externalSource, receiver, amounts, remark, inputId, sourceUnit, recoveryType, outputType, sourceMonth]} onDirtyChange={onDirtyChange} title={kind === 'external' ? e ? '编辑外供数据' : '登记外供' : '补数据'} description={`${year}年度`} width={680} onClose={onClose} onSubmit={save} submitText="保存"><div className={s.form}>
    <p className={s.hint}>{kind === 'external' ? '直接填写各月外供数量，空白表示未填报，实际为零请填 0。' : '选择已有投入记录和产出能源，填写已取得月份的产出。'}</p>
    {kind === 'external' ? <><div className={s.formGrid}><Field label="供能来源" required><select aria-label="供能来源" disabled={Boolean(e) && !sourceChanged && quantityChanged} value={externalSource} onChange={(event) => { const next = event.target.value; setExternalSource(next); setAmounts(initialAmounts.map((value, i) => next === (e?.conversionOutputId ?? e?.inputEnergyRecordId) || i !== sourceMonth ? value : '')); }}><option value="">请选择来源</option><optgroup label="用能单元转换与回收产出">{conversions.map((r) => <option key={r.conversionOutputId} value={r.conversionOutputId}>{v11ScopeName(r.conversionEnergyUnitId, year)} · {r.outputEnergyName}</option>)}</optgroup><optgroup label="外购能源直接外供">{records.filter((r) => v11RecordScopeType(r) === 'enterprise' && r.energyRole === '能源消费').map((r) => <option key={r.energyRecordId} value={r.energyRecordId}>{types.find((t) => t.energyTypeId === r.energyTypeId)?.energyTypeName} · {r.year}年企业能源消费</option>)}</optgroup></select></Field><Field label="外供能源"><input readOnly value={externalType ? `${externalType.energyTypeName} · ${externalConversion?.outputUnit ?? externalType.measurementUnit}` : '选择来源后带出'} /></Field><Field label="接收方" required><input aria-label="接收方" required value={receiver} onChange={(event) => setReceiver(event.target.value)} /></Field></div>{Boolean(e) && !sourceChanged && quantityChanged && <p className={s.hint}>保存数量修改后可调整供能来源。</p>}{sourceChanged && <><Field label="调整来源月份"><select aria-label="调整来源月份" value={sourceMonth} onChange={(event) => { const month = Number(event.target.value); setSourceMonth(month); setAmounts(initialAmounts.map((value, i) => i === month ? '' : value)); }}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i + 1}月</option>)}</select></Field><p className={s.hint}>仅将所选月份调整至新来源并重新填写数量，其余月份保留原来源。</p></>}
      <div className={s.monthInputGrid}>{amounts.map((value, i) => <Field key={i} label={`${i + 1}月（${sourceChanged && i !== sourceMonth ? e?.unit : externalConversion?.outputUnit ?? externalType?.measurementUnit ?? '—'}）`}><input aria-label={`${i + 1}月外供数量`} type="number" min="0" step="any" readOnly={sourceChanged && i !== sourceMonth} value={value} onChange={(event) => setAmounts((current) => current.map((item, j) => i === j ? event.target.value : item))} /></Field>)}</div></> : <>
      <div className={s.formGrid}><Field label="用能单元"><input aria-label="用能单元" readOnly value={conversionUnitName(unitId, year)} /></Field><Field label="投入数据来源" required><select aria-label="投入数据来源" value={inputId} disabled={!unitId} onChange={(event) => setInputId(event.target.value)}><option value="">请选择已有记录</option><option value="recovery">无已有记录，补充回收来源</option>{records.filter((record) => v11RecordScopeType(record) === 'energyUnit' && record.scopeLevel === '二级用能单元' && record.energyUnitId === unitId).map((record) => <option key={record.energyRecordId} value={record.energyRecordId}>{v11ScopeName(record.energyUnitId, year)} · {types.find((type) => type.energyTypeId === record.energyTypeId)?.energyTypeName} · {record.energyRole}</option>)}</select></Field>
      {recoveryEditor && !selectedInput && <><Field label="回收来源" required><select aria-label="回收来源" required value={sourceUnit} onChange={(event) => setSourceUnit(event.target.value)}><option value="">请选择产生单元</option>{units.filter((u) => u.unitLevel !== 'enterprise').map((u) => <option key={u.energyUnitId} value={u.energyUnitId}>{u.energyUnitName}</option>)}</select></Field><Field label="回收能源"><select value={recoveryType} onChange={(event) => setRecoveryType(event.target.value)}>{types.filter((t) => t.analysisCategory === '回收能源').map((t) => <option key={t.energyTypeId} value={t.energyTypeId}>{t.energyTypeName}</option>)}</select></Field></>}
      <Field label="产出能源" required><select aria-label="产出能源" required value={outputType} onChange={(event) => setOutputType(event.target.value)}><option value="">请选择能源</option>{types.map((t) => <option key={t.energyTypeId} value={t.energyTypeId}>{t.energyTypeName}（{t.measurementUnit}）</option>)}</select></Field>
      </div><div className={s.monthInputGrid}>{amounts.map((value, i) => <Field key={i} label={`${i + 1}月产出（${types.find((type) => type.energyTypeId === outputType)?.measurementUnit ?? '—'}）`}><input aria-label={`${i + 1}月产出量`} type="number" min="0" step="any" value={value} onChange={(event) => setAmounts((current) => current.map((item, j) => i === j ? event.target.value : item))} /></Field>)}</div></>}
    <details className={s.remarkDetails}><summary>备注<span>选填</span></summary><Field label="备注"><textarea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></details>{error && <p className={s.error} role="alert">{error}</p>}
  </div></Form>;
}
