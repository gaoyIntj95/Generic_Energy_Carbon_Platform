import { Fragment, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import { getDeviceIntensityParameter, getDeviceIntensityTemplate, getDeviceIntensityTemplateConfig } from '../../mocks/deviceIntensityParameterStore';
import {
  listV11ConversionOutputs, listV11ExternalSupplyRecords, listV11EnergyRecords, listV11EnergyTypes,
  listV11KeyDevices, v11ScopeName, v11RecordScopeType, saveFlowConversion, saveFlowExternal,
  saveV11EnergyRecord, deleteV11ConversionOutput, deleteV11ExternalSupplyRecord, flowExternalIssue,
  type V11ConversionOutput, type V11ExternalSupplyRecord, type V11EnergyRecord, type ConversionOutputType,
} from '../../mocks/dataManagementV11Store';
import { Button, Field, Modal, Tag, Toast } from './PrototypeUI';
import s from './EnergyFlowMaintenance.module.css';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const number = (value: number | undefined) => value == null ? '待填报' : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
function patchMonth(values: number[] | undefined, index: number, value: number) {
  return Array.from({ length: 12 }, (_, i) => i === index ? value : values?.[i] ?? 0);
}
function patchReported(values: boolean[] | undefined, amounts: number[] | undefined, index: number) {
  return Array.from({ length: 12 }, (_, i) => i === index || (values?.[i] ?? amounts?.[i] != null));
}
function inputRecord(row: V11ConversionOutput) { return listV11EnergyRecords().find((r) => r.energyRecordId === row.inputEnergyRecordId); }
function inputName(row: V11ConversionOutput) {
  const source = inputRecord(row);
  return listV11EnergyTypes().find((t) => t.energyTypeId === source?.energyTypeId)?.energyTypeName ?? row.recoveryEnergyName ?? '投入能源';
}
function outputIssue(row: V11ConversionOutput, index: number) {
  return row.outputSourceIssue || ((row.monthlyOutputReported?.[index] ?? row.monthlyOutputAmounts?.[index] != null) ? '' : '本期产出待补录');
}
type Editor = { kind: 'external'; item?: V11ExternalSupplyRecord; sourceId?: string } | { kind: 'conversion'; item?: V11ConversionOutput };

export function EnergyFlowMaintenance() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [period, setPeriod] = useState(`${params.get('year') ?? '2026'}-${String(params.get('month') ?? '6').padStart(2, '0')}`);
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5));
  const index = month - 1;
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(params.get('editConversionId') ?? '');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; kind: 'external' | 'conversion' } | null>(null);
  const [source, setSource] = useState<V11EnergyRecord | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const refresh = (text: string) => { setVersion((v) => v + 1); setMessage(text); };
  const conversions = listV11ConversionOutputs().filter((r) => r.year === year && r.recordType !== '直接外供');
  const external = listV11ExternalSupplyRecords().filter((r) => r.year === year);
  const types = listV11EnergyTypes();
  const returnPath = `/data-management/energy-data?tab=conversion&year=${year}&month=${month}`;
  const goOutput = (row: V11ConversionOutput) => {
    const device = row.outputDeviceId || listV11KeyDevices().find((d) => d.energyUnitId === row.conversionEnergyUnitId && getDeviceIntensityTemplate(d.deviceId, year))?.deviceId;
    if (!device) { setEditor({ kind: 'conversion', item: row }); return; }
    navigate(`/data-management/device-output?deviceId=${encodeURIComponent(device)}&year=${year}&month=${month}&returnTo=${encodeURIComponent(`${returnPath}&editConversionId=${row.conversionOutputId}`)}`);
  };
  const returnTo = params.get('returnTo');
  const missing = conversions.filter((row) => outputIssue(row, index));
  const filtered = conversions.filter((row) => `${v11ScopeName(row.conversionEnergyUnitId)}${inputName(row)}${row.outputEnergyName}`.includes(keyword.trim()));
  const visibleExternal = external.filter((row) => `${row.receiver ?? ''}${types.find((t) => t.energyTypeId === row.energyTypeId)?.energyTypeName ?? ''}${v11ScopeName(conversions.find((c) => c.conversionOutputId === row.conversionOutputId)?.conversionEnergyUnitId ?? null)}`.includes(keyword.trim()));
  return <div className={s.page}>
    <section className={s.toolbar}><Field label="数据期间"><input aria-label="数据期间" type="month" value={period} onChange={(e) => { if (e.target.value) { setPeriod(e.target.value); setExpanded(''); setMessage(''); } }} /></Field><Field label="关键字"><input aria-label="流转关键字" placeholder="系统、能源或接收方" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field><div className={s.spacer} /><Button primary onClick={() => setEditor({ kind: 'external' })}>＋ 新增记录</Button></section>
    {missing.length > 0 && <div className={s.notice}>{missing.length} 条转换记录待完善：{missing.map((r) => `${v11ScopeName(r.conversionEnergyUnitId)}（${outputIssue(r, index)}）`).join('、')}</div>}
    <section className={s.card}><div className={s.tableWrap}><table><thead><tr><th>记录</th><th>能源关系</th><th>本期数据</th><th>操作</th></tr></thead><tbody>
      {filtered.map((row) => <Fragment key={row.conversionOutputId}><tr className={expanded === row.conversionOutputId ? s.selected : ''}><td><strong>{v11ScopeName(row.conversionEnergyUnitId)}</strong></td><td>{inputName(row)} → {row.outputEnergyName}</td><td><Tag tone={outputIssue(row, index) ? 'orange' : row.outputDeviceId ? 'green' : 'gray'}>{outputIssue(row, index) || (row.outputDeviceId ? '设备产出已关联' : '补充产出')}</Tag></td><td><button className={s.link} aria-expanded={expanded === row.conversionOutputId} onClick={() => setExpanded(expanded === row.conversionOutputId ? '' : row.conversionOutputId)}>{expanded === row.conversionOutputId ? '收起' : '展开'}</button></td></tr>
        {expanded === row.conversionOutputId && <tr><td colSpan={4} className={s.expandedCell}><ConversionDetails key={`${row.conversionOutputId}:${period}:${version}`} row={row} index={index} onSaved={refresh} onOutput={() => goOutput(row)} onSource={(record) => setSource(record)} onEdit={() => setEditor({ kind: 'conversion', item: row })} onExternal={() => setEditor({ kind: 'external', sourceId: row.conversionOutputId })} onDelete={() => setDeleting({ kind: 'conversion', id: row.conversionOutputId })} /></td></tr>}
      </Fragment>)}
      {visibleExternal.map((row) => { const c = conversions.find((r) => r.conversionOutputId === row.conversionOutputId); const energy = types.find((t) => t.energyTypeId === row.energyTypeId); const reported = row.monthlyReported?.[index] ?? row.monthlyAmounts?.[index] != null; const issue = flowExternalIssue(row, month); return <tr key={row.externalSupplyId}><td><strong>{energy?.energyTypeName ?? '能源'}外供</strong></td><td>{c ? v11ScopeName(c.conversionEnergyUnitId) : `厂内${energy?.energyTypeName ?? '能源'}`} → {row.receiver || '接收方待完善'}</td><td>{reported ? `${number(row.monthlyAmounts?.[index])} ${row.unit ?? ''}` : '本期待填报'}{reported && issue && <small className={s.warning}>待核验：{issue}</small>}</td><td><div className={s.actions}><button className={s.link} onClick={() => setEditor({ kind: 'external', item: row })}>编辑</button><button className={s.link} onClick={() => setDeleting({ kind: 'external', id: row.externalSupplyId })}>删除</button></div></td></tr>; })}
      {!filtered.length && !visibleExternal.length && <tr><td colSpan={4} className={s.empty}>暂无记录，可新增转换关联或补充外供。</td></tr>}
    </tbody></table></div></section>
    <div className={s.footer}><span>消费和设备产出引用原始数据，完整流向与平衡结果在能流分析查看。</span><button className={s.link} onClick={() => navigate(`/energy-analysis/flow-analysis?year=${year}&grain=month&month=${month}`)}>查看能流分析 →</button>{returnTo?.startsWith('/energy-analysis/') && <button className={s.link} onClick={() => navigate(returnTo)}>返回能耗指标</button>}</div>
    {editor && <FlowRecordDialog key={`${editor.kind}:${editor.item ? 'externalSupplyId' in editor.item ? editor.item.externalSupplyId : editor.item.conversionOutputId : 'new'}:${period}`} editor={editor} year={year} index={index} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh('记录已保存，能流分析将使用最新数据。'); }} />}
    {deleting && <Modal title="删除记录" width={480} onClose={() => setDeleting(null)} submitText="确认删除" onSubmit={() => { if (deleting.kind === 'external') deleteV11ExternalSupplyRecord(deleting.id); else deleteV11ConversionOutput(deleting.id); setDeleting(null); setExpanded(''); refresh('记录已删除'); }}><p>{deleting.kind === 'conversion' ? '删除转换关联会同时删除其关联外供记录；原始能源消费与设备产出保留。' : '确认删除该接收方的整年度外供记录？'}</p></Modal>}
    {source && <Modal title="投入数据来源" onClose={() => setSource(null)} footer={<><Button onClick={() => setSource(null)}>关闭</Button><Button primary onClick={() => navigate(`/data-management/energy-data?year=${year}&unitId=${source.energyUnitId ?? ''}&scopeLevel=${encodeURIComponent(source.scopeLevel)}`)}>前往能源消费</Button></>}><p>{v11ScopeName(source.energyUnitId)} · {types.find((t) => t.energyTypeId === source.energyTypeId)?.energyTypeName}</p><p>{year}年{month}月：{number(source.monthlyReportedMonths?.[index] === false ? undefined : source.monthlyAmounts[index])} {types.find((t) => t.energyTypeId === source.energyTypeId)?.measurementUnit}</p></Modal>}
    <Toast message={message} />
  </div>;
}

function ConversionDetails({ row, index, onSaved, onOutput, onSource, onEdit, onExternal, onDelete }: { row: V11ConversionOutput; index: number; onSaved: (text: string) => void; onOutput: () => void; onSource: (record: V11EnergyRecord) => void; onEdit: () => void; onExternal: () => void; onDelete: () => void }) {
  const source = inputRecord(row);
  const recovery = source?.energyRole === '回收能源' || row.inputMode === 'recovery';
  const initialInput = source ? source.monthlyReportedMonths?.[index] === false ? '' : source.monthlyAmounts[index] ?? '' : row.monthlyInputReported?.[index] === false ? '' : row.monthlyInputAmounts?.[index] ?? '';
  const [input, setInput] = useState(String(initialInput));
  const [output, setOutput] = useState(row.monthlyOutputReported?.[index] === false ? '' : String(row.monthlyOutputAmounts?.[index] ?? ''));
  const [loss, setLoss] = useState(String(row.monthlyLossAmounts?.[index] ?? ''));
  const [basis, setBasis] = useState(row.lossBasis ?? ((row.lossAmount ?? 0) > 0 ? row.remark : ''));
  const [error, setError] = useState('');
  const hasDevice = Boolean(row.outputDeviceId);
  const candidate = listV11KeyDevices().some((d) => d.energyUnitId === row.conversionEnergyUnitId && getDeviceIntensityTemplate(d.deviceId, row.year));
  const save = () => {
    if ((!hasDevice && !candidate && output === '') || (recovery && input === '')) { setError('请填写本期回收投入和补充产出，实际为零时填写0。'); return; }
    const next = { ...row };
    if (!hasDevice && !candidate) {
      next.monthlyOutputAmounts = patchMonth(row.monthlyOutputAmounts, index, Number(output));
      next.monthlyOutputReported = patchReported(row.monthlyOutputReported, row.monthlyOutputAmounts, index);
      next.outputAmount = sum(next.monthlyOutputAmounts);
    }
    if (loss !== '') { next.monthlyLossAmounts = patchMonth(row.monthlyLossAmounts, index, Number(loss)); next.lossAmount = sum(next.monthlyLossAmounts); next.lossBasis = basis; }
    if (recovery) {
      next.monthlyInputAmounts = patchMonth(row.monthlyInputAmounts, index, Number(input));
      next.monthlyInputReported = patchReported(row.monthlyInputReported, row.monthlyInputAmounts, index);
      next.recoveryAmount = sum(next.monthlyInputAmounts);
    }
    const result = saveFlowConversion(next, row.conversionOutputId);
    if (!result.ok) { setError(result.error); return; }
    if (recovery && source) {
      const monthlyAmounts = patchMonth(source.monthlyAmounts, index, Number(input));
      const saved = saveV11EnergyRecord({ ...source, entryMode: 'monthly', monthlyAmounts, monthlyReportedMonths: patchReported(source.monthlyReportedMonths, source.monthlyAmounts, index), annualAmount: source.annualAmount > 0 ? Math.max(source.annualAmount, sum(monthlyAmounts)) : 0 }, source.energyRecordId);
      if (!saved.ok) { setError(saved.error); return; }
    }
    onSaved('本期补充已保存');
  };
  return <div className={s.details}>
    <div className={s.dataLine}><span>{inputName(row)}投入</span>{recovery ? <Field label="本期回收量（GJ）"><input aria-label="本期回收量" type="number" min="0" step="any" value={input} onChange={(e) => setInput(e.target.value)} /></Field> : <strong>{number(source?.monthlyReportedMonths?.[index] === false ? undefined : source?.monthlyAmounts[index])} {listV11EnergyTypes().find((t) => t.energyTypeId === source?.energyTypeId)?.measurementUnit}</strong>}<div>{recovery ? <small>本页维护回收来源，不重复新增台账</small> : source && <button className={s.link} onClick={() => onSource(source)}>查看能源消费</button>}</div></div>
    <div className={s.dataLine}><span>{row.outputEnergyName}产出</span>{hasDevice || candidate ? <strong>{outputIssue(row, index) || `${number(row.monthlyOutputAmounts?.[index])} ${row.outputUnit}`}<small>{hasDevice ? '来源：设备产出数据' : '来源：历史补录，待切换设备关联'}</small></strong> : <Field label={`本期产出量（${row.outputUnit}）`}><input aria-label="本期产出量" type="number" min="0" step="any" value={output} onChange={(e) => setOutput(e.target.value)} /></Field>}<button className={s.link} onClick={candidate || hasDevice ? onOutput : onEdit}>{candidate || hasDevice ? '查看／补录设备产出' : '调整来源'}</button></div>
    <div className={s.dataLine}><span>直接外供</span><strong>{number(row.monthlyExternalAmounts?.[index] ?? 0)} {row.outputUnit}</strong><button className={s.link} onClick={onExternal}>新增外供</button></div>
    <div className={s.dataLine}><span>厂内可供量</span><strong>{outputIssue(row, index) ? '待产出完善后计算' : `${number(Math.max(0, (row.monthlyOutputAmounts?.[index] ?? 0) - (row.monthlyExternalAmounts?.[index] ?? 0) - (row.monthlyLossAmounts?.[index] ?? 0)))} ${row.outputUnit}`}</strong><small>扣除已登记外供与已确认损失</small></div>
    <details><summary>关联设置与损失补充</summary><p>投入：{v11ScopeName(source?.energyUnitId ?? row.recoverySourceEnergyUnitId ?? null)}；产出：{row.outputDeviceId ? listV11KeyDevices().find((d) => d.deviceId === row.outputDeviceId)?.deviceName : '本页补充／历史台账'}。</p><div className={s.formGrid}><Field label={`已确认损失（${row.outputUnit}）`}><input aria-label="已确认损失" type="number" min="0" step="any" value={loss} placeholder="未填报" onChange={(e) => setLoss(e.target.value)} /></Field><Field label="确认依据"><input aria-label="损失确认依据" value={basis} onChange={(e) => setBasis(e.target.value)} /></Field></div><div className={s.actions}><button className={s.link} onClick={onEdit}>调整关联</button><button className={s.link} onClick={onDelete}>删除转换关联</button></div></details>
    {error && <p role="alert" className={s.error}>{error}</p>}
    <div className={s.footer}><span>一级分配引用能源消费，无需在这里重复填写。</span><Button primary onClick={save}>保存本期补充</Button></div>
  </div>;
}

function FlowRecordDialog({ editor, year, index, onClose, onSaved }: { editor: Editor; year: number; index: number; onClose: () => void; onSaved: () => void }) {
  const c = editor.kind === 'conversion' ? editor.item : undefined;
  const e = editor.kind === 'external' ? editor.item : undefined;
  const [kind, setKind] = useState(editor.kind);
  const [error, setError] = useState('');
  const conversions = listV11ConversionOutputs().filter((r) => r.year === year && r.recordType !== '直接外供');
  const records = listV11EnergyRecords().filter((r) => r.year === year && ['能源消费', '回收能源'].includes(r.energyRole));
  const types = listV11EnergyTypes();
  const units = listEnergyUnits();
  const [externalSource, setExternalSource] = useState(e?.conversionOutputId ?? e?.inputEnergyRecordId ?? (editor.kind === 'external' ? editor.sourceId ?? '' : ''));
  const externalConversion = conversions.find((r) => r.conversionOutputId === externalSource);
  const externalRecord = records.find((r) => r.energyRecordId === externalSource);
  const externalType = types.find((t) => t.energyTypeId === (externalConversion?.outputEnergyTypeId ?? externalRecord?.energyTypeId));
  const [receiver, setReceiver] = useState(e?.receiver ?? '');
  const [amount, setAmount] = useState(e?.monthlyReported?.[index] === false ? '' : String(e?.monthlyAmounts?.[index] ?? ''));
  const [remark, setRemark] = useState(e?.remark ?? c?.remark ?? '');
  const [unitId, setUnitId] = useState(c?.conversionEnergyUnitId ?? '');
  const [inputId, setInputId] = useState(c?.inputEnergyRecordId ?? '');
  const [sourceUnit, setSourceUnit] = useState(c?.recoverySourceEnergyUnitId ?? '');
  const [recoveryType, setRecoveryType] = useState(types.find((t) => t.energyTypeName === c?.recoveryEnergyName)?.energyTypeId ?? 'v11-energy-waste-heat');
  const [outputType, setOutputType] = useState(c?.outputEnergyTypeId ?? '');
  const [deviceId, setDeviceId] = useState(c?.outputDeviceId ?? '');
  const [factor, setFactor] = useState(String(c?.outputUnitFactor ?? ''));
  const [basis, setBasis] = useState(c?.outputUnitBasis ?? '');
  const deviceCandidates = listV11KeyDevices().filter((d) => d.energyUnitId === unitId && getDeviceIntensityTemplate(d.deviceId, year));
  const metric = deviceId ? getDeviceIntensityTemplate(deviceId, year) : undefined;
  const parameter = deviceId && metric ? getDeviceIntensityParameter(deviceId, year, metric) : undefined;
  const parameterUnit = parameter?.unit ?? (deviceId ? getDeviceIntensityTemplateConfig(deviceId, year)?.denominator.unit : undefined);
  const targetType = types.find((t) => t.energyTypeId === outputType);
  const mismatch = deviceId && parameterUnit && targetType && parameterUnit !== targetType.measurementUnit;
  const save = () => {
    if (kind === 'external') {
      if (!externalType || amount === '') { setError('请选择供能来源并填写本期外供数量。'); return; }
      const monthlyAmounts = patchMonth(e?.monthlyAmounts, index, Number(amount));
      const result = saveFlowExternal({ ...e, year, conversionOutputId: externalConversion?.conversionOutputId, inputEnergyRecordId: externalRecord?.energyRecordId, energyTypeId: externalType.energyTypeId, unit: externalConversion?.outputUnit ?? externalType.measurementUnit, receiver: receiver.trim(), remark, amount: sum(monthlyAmounts), monthlyAmounts, monthlyReported: patchReported(e?.monthlyReported, e?.monthlyAmounts, index) }, e?.externalSupplyId);
      if (!result.ok) { setError(result.error); return; }
    } else {
      if (deviceCandidates.length && !deviceId) { setError('该系统已有设备产出入口，请选择关联设备；缺失数据请在设备产出页补录。'); return; }
      if (mismatch && (!factor || !basis.trim())) { setError('请填写产出单位换算系数和依据，不能直接将吨数当作热量。'); return; }
      const source = records.find((r) => r.energyRecordId === inputId);
      const recovery = source?.energyRole === '回收能源' || !source;
      const rt = types.find((t) => t.energyTypeId === recoveryType);
      const scene = units.find((u) => u.energyUnitId === unitId)?.conversionScenarios?.[0] as ConversionOutputType | undefined;
      const result = saveFlowConversion({ ...c, year, recordType: c?.recordType ?? scene ?? '其他转换', conversionEnergyUnitId: unitId, inputMode: recovery ? 'recovery' : 'linked', inputEnergyRecordId: source?.energyRecordId, recoverySourceEnergyUnitId: recovery ? source?.energyUnitId ?? sourceUnit : undefined, recoveryEnergyName: recovery ? source ? types.find((t) => t.energyTypeId === source.energyTypeId)?.energyTypeName : rt?.energyTypeName : undefined, recoveryUnit: recovery ? source ? types.find((t) => t.energyTypeId === source.energyTypeId)?.measurementUnit : rt?.measurementUnit : undefined, recoveryAmount: c?.recoveryAmount ?? 0, outputEnergyTypeId: outputType, outputDeviceId: deviceId || undefined, outputUnitFactor: mismatch ? Number(factor) : undefined, outputUnitBasis: mismatch ? basis.trim() : undefined, externalAmount: c?.externalAmount ?? 0, outputAmount: c?.outputAmount ?? 0, monthlyOutputAmounts: c?.monthlyOutputAmounts ?? Array(12).fill(0), monthlyOutputReported: c?.monthlyOutputReported ?? (c?.monthlyOutputAmounts ? Array(12).fill(true) : Array(12).fill(false)), lossBasis: c?.lossBasis ?? ((c?.lossAmount ?? 0) > 0 ? c?.remark : undefined), remark }, c?.conversionOutputId);
      if (!result.ok) { setError(result.error); return; }
    }
    onSaved();
  };
  return <Modal title={editor.item ? kind === 'external' ? '编辑外供记录' : '调整转换关联' : '新增记录'} width={720} onClose={onClose} onSubmit={save} submitText="保存记录"><div className={s.form}>
    <div className={s.formGrid}><Field label="记录用途"><select aria-label="记录用途" value={kind} disabled={Boolean(editor.item)} onChange={(event) => { setKind(event.target.value as typeof kind); setError(''); }}><option value="external">能源外供</option><option value="conversion">转换／回收关联</option></select></Field><Field label="数据期间"><input readOnly value={`${year}年${index + 1}月`} /></Field></div>
    {kind === 'external' ? <><div className={s.formGrid}><Field label="供能来源" required><select aria-label="供能来源" value={externalSource} disabled={Boolean(e)} onChange={(event) => setExternalSource(event.target.value)}><option value="">请选择来源</option><optgroup label="转换系统">{conversions.map((r) => <option key={r.conversionOutputId} value={r.conversionOutputId}>{v11ScopeName(r.conversionEnergyUnitId)} · {r.outputEnergyName}</option>)}</optgroup><optgroup label="企业能源直接转供">{records.filter((r) => v11RecordScopeType(r) === 'enterprise' && r.energyRole === '能源消费').map((r) => <option key={r.energyRecordId} value={r.energyRecordId}>厂内{types.find((t) => t.energyTypeId === r.energyTypeId)?.energyTypeName}</option>)}</optgroup></select></Field><Field label="外供能源"><input readOnly value={externalType ? `${externalType.energyTypeName} · ${externalConversion?.outputUnit ?? externalType.measurementUnit}` : '选择来源后带出'} /></Field><Field label="接收方" required><input aria-label="接收方" required value={receiver} onChange={(event) => setReceiver(event.target.value)} /></Field><Field label={`本期外供数量（${externalConversion?.outputUnit ?? externalType?.measurementUnit ?? '—'}）`} required><input aria-label="本期外供数量" required type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div><p className={s.hint}>同一来源的外供累计核验；来源未填报时保存为待核验，不生成虚假流量。</p></> : <>
      <div className={s.formGrid}><Field label="转换系统" required><select aria-label="转换系统" required value={unitId} disabled={Boolean(c)} onChange={(event) => { setUnitId(event.target.value); setDeviceId(''); setInputId(''); }}><option value="">请选择系统</option>{units.filter((u) => u.unitLevel === 'level2' && ['公辅系统', '其他'].includes(u.unitType)).map((u) => <option key={u.energyUnitId} value={u.energyUnitId}>{u.energyUnitName}</option>)}</select></Field><Field label="投入数据来源" required><select aria-label="投入数据来源" value={inputId} onChange={(event) => setInputId(event.target.value)}><option value="">本页补充回收来源</option>{records.filter((r) => r.energyRole === '回收能源' || r.energyUnitId === unitId || r.energyRecordId === c?.inputEnergyRecordId).map((r) => <option key={r.energyRecordId} value={r.energyRecordId}>{v11ScopeName(r.energyUnitId)} · {types.find((t) => t.energyTypeId === r.energyTypeId)?.energyTypeName} · {v11RecordScopeType(r) === 'device' ? '设备计量' : '单元计量'}</option>)}</select></Field>
      {!inputId && <><Field label="回收来源" required><select aria-label="回收来源" required value={sourceUnit} onChange={(event) => setSourceUnit(event.target.value)}><option value="">请选择产生单元</option>{units.filter((u) => u.unitLevel !== 'enterprise').map((u) => <option key={u.energyUnitId} value={u.energyUnitId}>{u.energyUnitName}</option>)}</select></Field><Field label="回收能源"><select value={recoveryType} onChange={(event) => setRecoveryType(event.target.value)}>{types.filter((t) => t.analysisCategory === '回收能源').map((t) => <option key={t.energyTypeId} value={t.energyTypeId}>{t.energyTypeName}</option>)}</select></Field></>}
      <Field label="产出能源" required><select aria-label="产出能源" required value={outputType} onChange={(event) => setOutputType(event.target.value)}><option value="">请选择能源</option>{types.map((t) => <option key={t.energyTypeId} value={t.energyTypeId}>{t.energyTypeName}（{t.measurementUnit}）</option>)}</select></Field><Field label="产出数据来源"><select aria-label="产出数据来源" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">{deviceCandidates.length ? '请选择设备产出' : '无对应设备产出，本页补充'}</option>{deviceCandidates.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.deviceName} · {d.outputBasis}</option>)}</select></Field>
      {mismatch && <><Field label={`换算系数（${targetType.measurementUnit}/${parameterUnit}）`} required><input aria-label="产出换算系数" type="number" min="0.000001" step="any" required value={factor} onChange={(event) => setFactor(event.target.value)} /></Field><Field label="换算依据" required><input aria-label="换算依据" required value={basis} onChange={(event) => setBasis(event.target.value)} /></Field></>}
      </div><p className={s.hint}>只关联同一事实的权威计量来源，不同时汇总系统总表和设备分表。保存后按期补齐缺失数据。</p></>}
    <details><summary>备注</summary><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} /></Field></details>{error && <p className={s.error} role="alert">{error}</p>}
  </div></Modal>;
}
