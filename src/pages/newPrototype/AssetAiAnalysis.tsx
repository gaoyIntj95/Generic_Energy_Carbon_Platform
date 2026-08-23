import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

export type AssetAiKey = 'balance' | 'analysis' | 'budgetEnergy' | 'budgetCarbon' | 'asset';

type AiStatus = 'idle' | 'generated' | 'loading' | 'stale';

export interface AssetAiEvidence {
  label: string;
  value: string;
  note: string;
}

export interface AssetAiDeepAnalysis {
  evidenceChain: string[];
  hypotheses: Array<{ level: '较高可能' | '待核实'; text: string }>;
  verificationSteps: string[];
  limitation: string;
}

export interface AssetAiConfig {
  tone: 'aiBalance' | 'aiAnalysis' | 'aiBudget' | 'aiAsset';
  title: string;
  reportTitle?: string;
  generateLabel?: string;
  description: string;
  period: string;
  scope: string;
  cutoff: string;
  level: string;
  reasoningType: string;
  judgement: string;
  logic: string;
  logicSteps?: string[];
  evidence: AssetAiEvidence[];
  priorityAction: string;
  actionLabel?: string;
  uncertainty: string;
  inputs: string[];
  deepAnalysis?: AssetAiDeepAnalysis;
}

interface AiResultState {
  status: AiStatus;
  generatedAt: string;
  analysisId: string;
  snapshotVersion: string;
}

const generatedAt = '2026-07-29 10:20';

const aiConfigs: Record<AssetAiKey, AssetAiConfig> = {
  balance: {
    tone: 'aiBalance',
    title: '能源平衡与优化调度',
    reportTitle: '能源平衡与优化调度分析报告',
    generateLabel: '开始优化诊断',
    description: '结合能效对标、能流分析和运行数据，辅助优化工艺、设备运行参数，实现能源平衡与优化调度。',
    period: '2026年6月',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '重点对象研判',
    reasoningType: '能流勾稽与优化优先级研判',
    judgement: '结合能源分配、能效对标和指标变化，识别需要优先调整的工艺、设备和用能单元。',
    logic: '企业能源输入、一级分配和二级利用读取同一能流聚合结果；一级与二级数据仅作层级勾稽，不重复计入企业总量。',
    logicSteps: ['读取能源分配完整性结果', '结合能效指标、趋势与对标结果', '生成重点对象辅助解读'],
    evidence: [
      { label: '能源输入量', value: '—', note: '来自能流分析统一聚合结果' },
      { label: '一级未分配量', value: '—', note: '厂内可分配量与一级分配、外部输出的管理差额' },
      { label: '二级待细分量', value: '—', note: '一级分配量尚未细分至下级对象的部分' },
    ],
    priorityAction: '先核查差额量较高的用能单元及对应能源记录，再结合设备、运行负荷和运营数据制定优化措施。',
    uncertainty: '管理差额用于数据勾稽，不直接等同于物理损失；具体节能措施仍需结合现场工艺和设备运行情况确认。',
    inputs: ['能源输入', '一级分配', '二级利用', '外部输出', '未分配量', '层级异常量'],
  },
  analysis: {
    tone: 'aiAnalysis',
    title: '用能分析与策略推荐',
    reportTitle: '用能分析与策略推荐报告',
    generateLabel: '开始策略分析',
    description: '结合时间周期内的用能结构、成本和能效表现，推荐更合理的用能配置和清洁能源使用策略。',
    period: '2026年6月',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '用能策略分析',
    reasoningType: '跨指标关联研判',
    judgement: '本期用能结构、成本和能效表现已完成综合分析，建议优先调整高成本或低效率用能环节，并评估清洁能源替代机会。',
    logic: '按时间周期汇总各用能单元的能源品种、用能量、成本和能效指标，识别结构偏重、成本偏高或效率偏低的环节，再形成配置调整建议。',
    evidence: [
      { label: '主要用能结构', value: '电力 / 天然气', note: '按用能品种和用能单元汇总' },
      { label: '重点成本环节', value: '生产单元A', note: '建议结合成本和产量进一步核查' },
      { label: '清洁能源机会', value: '待评估', note: '结合可再生能源可用量和负荷时段判断' },
    ],
    priorityAction: '优先核查生产单元A的能源品种、用能时段、能源成本和单位产品能耗，再制定能源替代、错峰用能或设备运行方式调整方案。',
    actionLabel: '推荐策略',
    uncertainty: '清洁能源替代和用能配置调整需要结合生产连续性、设备适配条件、能源价格和现场安全要求确认。',
    inputs: ['用能结构', '能源成本', '单位产品综合能耗', '重点用能单元', '清洁能源可用量', '生产运营数据'],
  },
  budgetEnergy: {
    tone: 'aiBudget',
    title: 'AI预算研判',
    description: '关联目标、预测与分单元偏差，识别需要重点控制的对象。',
    period: '2026年度',
    scope: '全企业｜能源预算',
    cutoff: '2026-06-30',
    level: '风险：高',
    reasoningType: '风险集中度研判',
    judgement: '年度能源预算存在超支风险，但风险主要集中在生产单元A和公辅系统，不宜对所有用能单元采取统一压降措施。',
    logic: '预计总偏差 +5,000 tce；生产单元A和公辅系统贡献主要正偏差，生产单元B仍低于预算 → 应实施定向控制。',
    evidence: [
      { label: '全年预测偏差', value: '+5,000 tce', note: '预计超出目标4.2%' },
      { label: '生产单元A偏差', value: '+4,500 tce', note: '主要风险来源' },
      { label: '生产单元B偏差', value: '-800 tce', note: '仍处于预算范围内' },
    ],
    priorityAction: '后续控制重点放在生产单元A和公辅系统；生产单元B维持当前策略，避免一刀切压降影响正常生产。',
    uncertainty: '全年预测依赖当前生产计划和历史趋势，生产计划或能源价格发生明显变化后需重新预测。',
    inputs: ['年度能源预算', '当前累计能耗', '全年预测能耗', '分单元预测偏差', '生产计划'],
  },
  budgetCarbon: {
    tone: 'aiBudget',
    title: 'AI预算研判',
    description: '关联碳预算、排放预测和重点排放对象，识别控制优先级。',
    period: '2026年度',
    scope: '全企业｜碳排放预算',
    cutoff: '2026-06-30',
    level: '风险：高',
    reasoningType: '碳预算风险研判',
    judgement: '年度碳排放预算存在超标风险，当前正偏差主要集中在生产单元A和公辅系统，控制措施应优先覆盖重点排放源，而不是平均分摊。',
    logic: '预计全年排放高于目标4,500 tCO₂ ＋ 偏差集中于少数对象 → 应按排放贡献和可控程度确定控制优先级。',
    evidence: [
      { label: '预计全年排放', value: '99,500 tCO₂', note: '高于年度目标' },
      { label: '预测偏差', value: '+4,500 tCO₂', note: '偏差率4.7%' },
      { label: '重点偏差对象', value: '2个', note: '生产单元A、公辅系统' },
    ],
    priorityAction: '优先核查生产单元A和公辅系统的重点排放源，并结合后续生产计划调整分月碳排放控制目标。',
    uncertainty: '预测结果依赖当前核算清单和生产计划；活动数据或排放因子调整后，应重新生成预算研判。',
    inputs: ['年度碳预算', '当前累计排放', '全年预测排放', '分单元排放偏差', '重点排放源'],
  },
  asset: {
    tone: 'aiAsset',
    title: 'AI履约准备分析',
    reportTitle: '碳资产履约准备分析报告',
    description: '围绕预计排放、可用资产和履约周期，帮你看清能否覆盖、缺口多大、哪些资产还需确认。',
    period: '2026年度',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '重点：先确认可用资产',
    reasoningType: '履约覆盖与缺口研判',
    judgement: '按当前数据，预计全年排放约10.5万吨，已确认可用资产约10万吨，暂有约5,000 tCO₂待补足。待确认资产暂未计入。',
    logic: '先用预计全年排放与已确认可用配额、CCER比较覆盖情况，再单独核对待确认资产，不把账面数量直接视为可履约数量。',
    evidence: [
      { label: '预计全年排放', value: '105,000 tCO₂', note: '当前预测结果' },
      { label: '配额＋可用CCER', value: '100,000 tCO₂', note: '已确认可用资产' },
      { label: '初步履约缺口', value: '5,000 tCO₂', note: '待确认资产未计入' },
    ],
    priorityAction: '先确认资产的有效期、履约周期和可抵销比例，再决定是否补充以及补充多少。',
    uncertainty: 'AI不直接判定某类资产是否符合履约规则，最终以系统维护的政策规则和人工审核结果为准。',
    inputs: ['预计全年排放', '已分配配额', 'CCER可用量', '资产有效状态', '履约规则'],
  },
};

function initialState(key: AssetAiKey, startOnDemand = false): AiResultState {
  return {
    status: startOnDemand ? 'idle' : 'generated',
    generatedAt,
    analysisId: `AI-20260630-${key.toUpperCase()}-001`,
    snapshotVersion: 'SNAP-20260630-01',
  };
}

function formatNow() {
  const value = new Date();
  const part = (number: number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ${part(value.getHours())}:${part(value.getMinutes())}`;
}

export function AssetAiAnalysis({
  analysisKey,
  invalidationVersion,
  notify,
  configOverride,
}: {
  analysisKey: AssetAiKey;
  invalidationVersion: number;
  notify: (message: string) => void;
  configOverride?: AssetAiConfig;
}) {
  const [states, setStates] = useState<Record<AssetAiKey, AiResultState>>({
    balance: initialState('balance', true),
    analysis: initialState('analysis', true),
    budgetEnergy: initialState('budgetEnergy', true),
    budgetCarbon: initialState('budgetCarbon', true),
    asset: initialState('asset', true),
  });
  const [drawer, setDrawer] = useState<'evidence' | 'basis' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const previousInvalidation = useRef(invalidationVersion);
  const config = configOverride ?? aiConfigs[analysisKey];
  const result = states[analysisKey];
  const isBalanceSummary = analysisKey === 'balance';
  const isStrategyAnalysis = analysisKey === 'analysis';
  const isBudgetJudgement = analysisKey === 'budgetEnergy' || analysisKey === 'budgetCarbon';
  const isAssetAnalysis = analysisKey === 'asset';

  useEffect(() => {
    if (previousInvalidation.current === invalidationVersion) return;
    previousInvalidation.current = invalidationVersion;
    setStates((current) => ({
      ...current,
      [analysisKey]: {
        ...current[analysisKey],
        status: isBalanceSummary || isBudgetJudgement || isStrategyAnalysis || isAssetAnalysis ? 'idle' : 'stale',
      },
    }));
  }, [analysisKey, invalidationVersion, isBalanceSummary, isBudgetJudgement, isStrategyAnalysis, isAssetAnalysis]);

  const generate = () => {
    setStates((current) => ({ ...current, [analysisKey]: { ...current[analysisKey], status: 'loading' } }));
    window.setTimeout(() => {
      setStates((current) => ({
        ...current,
        [analysisKey]: {
          ...current[analysisKey],
          status: 'generated',
          generatedAt: formatNow(),
          analysisId: `AI-${config.cutoff.replaceAll('-', '')}-${analysisKey.toUpperCase()}-001`,
        },
      }));
      notify(`${config.title}已生成`);
    }, 700);
  };

  return <>
    <section className={`${styles.card} ${styles.aiLite} ${styles[config.tone]}`}>
      <div className={styles.aiLiteHead}>
        <div className={styles.aiTitleBox}>
          <div className={styles.aiLogo}>AI</div>
          <div>
            <div className={styles.aiTitle}>{config.title}<AiStatusLabel status={result.status} /></div>
            <div className={styles.aiDescription}>{config.description}</div>
          </div>
        </div>
        {!isBalanceSummary && !isBudgetJudgement && !isStrategyAnalysis && !isAssetAnalysis && result.status === 'generated' && <Button onClick={generate}>重新生成</Button>}
      </div>
      <div className={styles.aiLiteBody}>
        {result.status === 'loading' ? <AiLoading /> : (isBalanceSummary || isBudgetJudgement || isStrategyAnalysis || isAssetAnalysis) && result.status === 'idle' ? <div className={styles.aiEmptyState}>
          <p>{isAssetAnalysis ? '还没有履约准备分析。点击“开始分析”，系统将根据预计排放和已确认可用资产，帮你快速判断覆盖情况与待补足缺口。' : isBudgetJudgement ? '暂无AI研判摘要。点击“开始研判”后，系统将根据当前预算数据生成摘要；详细分析请在导出分析报告中查看。' : isBalanceSummary ? '还没有优化诊断结果。点击“开始优化诊断”，系统会结合能效对标、能流分析和运行数据，给出工艺、设备和用能安排方面的优化建议。' : '还没有策略分析结果。点击“开始策略分析”，系统会根据当前周期的用能结构、成本和能效表现，推荐用能配置和清洁能源使用策略。'}</p>
          <Button primary onClick={generate}>{isAssetAnalysis ? '开始分析' : isBudgetJudgement ? '开始研判' : config.generateLabel ?? '开始诊断'}</Button>
        </div> : <>
          {result.status === 'stale' && <div className={styles.aiWarning}><span>筛选条件或业务数据已变化，当前摘要与报告仍基于上一版数据快照。</span>{!isStrategyAnalysis && !isAssetAnalysis && <Button onClick={generate}>重新生成</Button>}</div>}
          <div className={styles.aiCompact}>
            <div className={styles.aiCompactTop}>
              <div className={styles.aiCompactCopy}>
                {!isBalanceSummary && <div className={styles.aiKicker}><b>{isAssetAnalysis ? '履约准备' : isStrategyAnalysis ? '策略推荐' : 'AI辅助分析'}</b><span>{config.level}</span></div>}
                <div className={styles.aiJudgement}>{config.judgement}</div>
                <div className={styles.aiPriority}><b>{isBalanceSummary ? '优化建议' : config.actionLabel ?? '优化建议'}</b>{config.priorityAction}</div>
              </div>
              <div className={styles.aiCompactActions}>
                {!isBalanceSummary && !isBudgetJudgement && !isStrategyAnalysis && !isAssetAnalysis && <Button onClick={() => setDrawer('evidence')}>{config.deepAnalysis ? '查看深度诊断' : '查看研判依据'}</Button>}
                <Button primary onClick={() => setReportOpen(true)}>导出分析报告</Button>
              </div>
            </div>
            {(!isBalanceSummary && !isBudgetJudgement && !isStrategyAnalysis) ? (
              <div className={styles.aiCompactBottom}>
                <div className={styles.aiMeta}>
                  <span>范围：<b>{config.scope}</b></span>
                  <span>周期：<b>{config.period}</b></span>
                  <span>数据截止：<b>{config.cutoff}</b></span>
                </div>
                <button type="button" className={styles.aiTextLink} onClick={() => setDrawer('basis')}>研发实现说明</button>
              </div>
            ) : null}
          </div>
        </>}
      </div>
    </section>
    {drawer === 'evidence' && <EvidenceDrawer config={config} onClose={() => setDrawer(null)} notify={notify} />}
    {drawer === 'basis' && <BasisDrawer config={config} result={result} onClose={() => setDrawer(null)} />}
    {reportOpen && <AiReportModal config={config} result={result} onClose={() => setReportOpen(false)} notify={notify} />}
  </>;
}

function AiDeepAnalysis({ analysis }: { analysis: AssetAiDeepAnalysis }) {
  return <div className={styles.aiDeepAnalysis}>
    <article><b>证据链</b><ul>{analysis.evidenceChain.map((item) => <li key={item}>{item}</li>)}</ul></article>
    <article><b>可能原因</b><ul>{analysis.hypotheses.map((item) => <li key={item.text}><span className={item.level === '较高可能' ? styles.aiLikelihoodHigh : styles.aiLikelihoodPending}>{item.level}</span>{item.text}</li>)}</ul></article>
    <article className={styles.aiVerification}><b>建议核查顺序</b><ol>{analysis.verificationSteps.map((item) => <li key={item}>{item}</li>)}</ol><small>数据限制：{analysis.limitation}</small></article>
  </div>;
}

function AiStatusLabel({ status }: { status: AiStatus }) {
  if (status === 'idle') return null;
  const text = status === 'loading' ? '生成中' : status === 'stale' ? '需更新' : '已生成';
  return <span className={`${styles.aiStatus} ${styles[`aiStatus${status}`]}`}>{text}</span>;
}

function AiLoading() {
  return <div className={styles.aiLoading}>
    <div><span className={styles.aiSpinner} />正在冻结数据快照、关联指标并生成摘要与报告内容……</div>
    <div className={styles.aiSkeletons}><i /><i /><i /></div>
  </div>;
}

function EvidenceDrawer({ config, onClose, notify }: { config: AssetAiConfig; onClose: () => void; notify: (message: string) => void }) {
  return <Drawer title={`${config.title}｜${config.deepAnalysis ? '深度诊断' : '研判依据'}`} width={620} onClose={onClose} footer={<Button primary onClick={() => { onClose(); notify('研判依据已标记为已阅'); }}>标记已阅</Button>}>
    <AiDrawerSection title="本次研判范围">
      <div className={styles.aiScopeSummary}>
        <div><span>分析周期</span><b>{config.period}</b></div>
        <div><span>组织范围</span><b>{config.scope}</b></div>
      </div>
    </AiDrawerSection>
    <AiDrawerSection title="页面引用的系统事实">
      <table className={styles.aiBasisTable}><thead><tr><th>指标</th><th>当前值</th><th>说明</th></tr></thead><tbody>{config.evidence.map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td></tr>)}</tbody></table>
    </AiDrawerSection>
    {config.deepAnalysis && <AiDrawerSection title="AI深度诊断"><AiDeepAnalysis analysis={config.deepAnalysis} /></AiDrawerSection>}
    <AiDrawerSection title="跨指标关联逻辑">
      {config.logicSteps ? <div className={styles.aiLogicFlow}>{config.logicSteps.map((step, index) => <div key={step}><span>{index + 1}</span><b>{step}</b>{index < config.logicSteps!.length - 1 && <i>→</i>}</div>)}</div> : <p className={styles.aiDrawerText}>{config.logic}</p>}
      {config.logicSteps && <p className={styles.aiLogicNote}>{config.logic}</p>}
    </AiDrawerSection>
    <AiDrawerSection title="待核实与适用边界"><div className={styles.aiBoundary}>{config.uncertainty}</div></AiDrawerSection>
    <AiDrawerSection title="数据来源范围">
      <p className={styles.aiSourceHint}>以下字段均来自本次数据快照，标签用于说明研判实际读取范围。</p>
      <div className={styles.aiInputTags}>{config.inputs.map((item) => <span key={item}>{item}</span>)}</div>
    </AiDrawerSection>
  </Drawer>;
}

function BasisDrawer({ config, result, onClose }: { config: AssetAiConfig; result: AiResultState; onClose: () => void }) {
  return <Drawer title={`${config.title}｜一期研发实现说明`} width={600} onClose={onClose} footer={<Button onClick={onClose}>关闭说明</Button>}>
    <AiDrawerSection title="核心实现原则"><div className={styles.aiBoundary}>一次生成形成一份结构化分析结果；页面摘要和导出报告读取同一个 analysisId，不分别调用大模型。</div></AiDrawerSection>
    <AiDrawerSection title="实现链路">
      <div className={styles.aiLayers}>
        {[
          ['1. 数据快照', '冻结当前范围、周期、业务指标和数据版本，形成 snapshotVersion。'],
          ['2. 业务计算', '提供同比、偏差、阈值、排名、预测和履约缺口等确定性事实。'],
          ['3. AI研判', '仅生成跨指标解释、优先建议、待核实项和报告分析文字，不重新计算数值。'],
          ['4. 结果保存', '保存 analysisId、结构化结果、模型与提示词版本，支持追溯。'],
          ['5. 双端呈现', '页面读取 summary；报告读取 summary、evidence 和 detail，并套用固定模板。'],
        ].map(([title, text]) => <div key={title}><b>{title}</b><span>{text}</span></div>)}
      </div>
    </AiDrawerSection>
    <AiDrawerSection title="本页差异化配置">
      <table className={styles.aiBasisTable}><tbody>
        <tr><th>研判类型</th><td>{config.reasoningType}</td></tr>
        <tr><th>输入数据</th><td>{config.inputs.join('、')}</td></tr>
        <tr><th>页面输出</th><td>judgement、priorityAction</td></tr>
        <tr><th>报告输出</th><td>核心研判、关键指标、关联逻辑、详细建议、待核实与说明</td></tr>
      </tbody></table>
    </AiDrawerSection>
    <AiDrawerSection title="统一结果对象">
      <pre className={styles.aiCode}>{JSON.stringify({
        analysisId: result.analysisId,
        status: 'completed',
        snapshotVersion: result.snapshotVersion,
        summary: { judgement: '...', priorityAction: '...' },
        evidence: [{ evidenceId: 'E001', label: '...', value: '...', source: '...' }],
        reportStatus: 'ready',
        generatedAt: result.generatedAt,
      }, null, 2)}</pre>
    </AiDrawerSection>
  </Drawer>;
}

function AiDrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.aiDrawerSection}><h3>{title}</h3>{children}</section>;
}

function AiReportModal({ config, result, onClose, notify }: { config: AssetAiConfig; result: AiResultState; onClose: () => void; notify: (message: string) => void }) {
  const download = () => {
    const documentHtml = buildReportDocument(config, result);
    if (!URL.createObjectURL) return notify('当前环境不支持下载，请使用打印或另存为PDF');
    const url = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.period}_${reportTitle(config)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('分析报告已下载');
  };
  return <div className={styles.aiReportOverlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.aiReportModal} role="dialog" aria-label={reportTitle(config)}>
      <header>
        <div><h2>{reportTitle(config)}</h2><p>{reportIntro(config)}</p></div>
        <div><Button onClick={download}>下载HTML报告</Button><Button primary onClick={() => window.print()}>打印 / 另存为PDF</Button><button type="button" aria-label="关闭分析报告" onClick={onClose}>×</button></div>
      </header>
      <div className={styles.aiReportBody}><ReportPaper config={config} result={result} /></div>
    </section>
  </div>;
}

function ReportPaper({ config, result }: { config: AssetAiConfig; result: AiResultState }) {
  const isBalanceReport = config.tone === 'aiBalance';
  const isStrategyReport = config.tone === 'aiAnalysis';
  return <article className={styles.reportPaper}>
    <div className={styles.reportCover}><b>{reportDomainLabel(config)}</b><h1>{reportTitle(config)}</h1><p>{reportIntro(config)}</p><div>{[['分析范围', config.scope], ['分析周期', config.period], ['数据截止', config.cutoff], ['生成时间', result.generatedAt], ['分析编号', result.analysisId], ['报告版本', 'V1.0']].map(([label, value]) => <span key={label}><i>{label}</i><strong>{value}</strong></span>)}</div></div>
    {isBalanceReport ? <>
      <ReportSection title="一、诊断结论"><div className={styles.reportSummary}>{config.judgement}</div><div className={styles.reportAction}><b>优先优化建议：</b>{config.priorityAction}</div></ReportSection>
      <ReportSection title="二、能源平衡现状"><table className={styles.reportTable}><thead><tr><th>观察内容</th><th>结果</th><th>说明</th></tr></thead><tbody>{config.evidence.slice(0, 4).map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td></tr>)}</tbody></table></ReportSection>
      <ReportSection title="三、能效对标与指标变化"><p>{config.logic}</p><p>系统将能效对标结果、同比/环比变化、能源分配情况结合起来，优先识别需要进一步核对或优化的用能对象。</p></ReportSection>
      <ReportSection title="四、工艺、设备与调度建议"><ul><li>{config.priorityAction}</li><li>结合生产负荷和设备运行状态，调整工艺参数、设备运行方式和用能时段。</li><li>优化能源分配顺序，优先保障关键生产环节，减少闲置和重复供能。</li><li>持续跟踪优化后的能耗指标和能源平衡结果，确认措施效果。</li></ul></ReportSection>
      <ReportSection title="五、执行前需要确认的事项"><p>{config.uncertainty}</p><p>建议由生产、设备和能源管理人员共同确认现场条件后再执行调整。</p></ReportSection>
    </> : isStrategyReport ? <>
      <ReportSection title="一、分析结论"><div className={styles.reportSummary}>{config.judgement}</div><div className={styles.reportAction}><b>优先推荐：</b>{config.priorityAction}</div></ReportSection>
      <ReportSection title="二、用能结构与成本分析"><table className={styles.reportTable}><thead><tr><th>分析内容</th><th>结果</th><th>说明</th></tr></thead><tbody>{config.evidence.map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td></tr>)}</tbody></table></ReportSection>
      <ReportSection title="三、能效表现与问题识别"><p>{config.logic}</p><p>重点关注能源品种占比、单位产品能耗、用能成本和重点用能单元之间的关系，避免只看总量变化作出片面判断。</p></ReportSection>
      <ReportSection title="四、优化用能配置建议"><ul><li>{config.priorityAction}</li><li>根据不同用能单元的负荷和能效表现，优化能源品种、供能比例和使用时段。</li><li>对成本较高或效率偏低的环节，结合设备适配条件制定替代、错峰或运行方式调整方案。</li></ul></ReportSection>
      <ReportSection title="五、清洁能源使用建议"><ul><li>结合清洁能源可用量、生产负荷和用能时段，评估优先替代的能源环节。</li><li>确认清洁能源接入、储存、设备适配和生产连续性条件后，再制定实施计划。</li></ul></ReportSection>
      <ReportSection title="六、执行前需要确认的事项"><p>{config.uncertainty}</p><p>推荐策略用于辅助决策，正式调整前应由能源、生产和设备管理人员共同确认。</p></ReportSection>
    </> : <>
      <ReportSection title="一、核心研判"><div className={styles.reportSummary}>{config.judgement}</div><div className={styles.reportAction}><b>优先建议：</b>{config.priorityAction}</div></ReportSection>
      <ReportSection title="二、关键数据与判断依据"><table className={styles.reportTable}><thead><tr><th>关键指标</th><th>指标值</th><th>业务说明</th><th>来源属性</th></tr></thead><tbody>{config.evidence.map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td><td><span>系统计算</span></td></tr>)}</tbody></table></ReportSection>
      <ReportSection title="三、详细分析"><p><b>指标关联逻辑：</b>{config.logic}</p><p><b>重点对象与管理含义：</b>{config.judgement}</p><ul><li>{config.priorityAction}</li><li>持续跟踪相关指标在后续周期的变化，条件变化后重新生成分析。</li><li>将系统事实、现场信息与管理计划结合后，由业务人员作出最终决策。</li></ul></ReportSection>
      <ReportSection title="四、待核实事项与数据限制"><p>{config.uncertainty}</p></ReportSection>
      <ReportSection title="五、分析口径与生成说明"><table className={styles.reportTable}><tbody><tr><th>结构化输入</th><td>{config.inputs.join('、')}</td></tr><tr><th>确定性内容</th><td>页面指标、同比/偏差、阈值、预测、排名和履约缺口由业务系统计算。</td></tr><tr><th>AI生成内容</th><td>核心研判、指标关联解释、优先建议与待核实说明。</td></tr><tr><th>一致性机制</th><td>页面摘要与本报告读取同一个 analysisId 和数据快照，报告导出时不再次调用大模型。</td></tr></tbody></table><div className={styles.reportDisclaimer}>本报告基于系统内现有数据和配置规则生成，AI分析用于辅助识别问题和提供管理参考，不替代现场诊断、专业审计、合规判断或企业最终决策。</div></ReportSection>
    </>}
    <div className={styles.reportVersion}>分析编号：{result.analysisId} ｜ 模板版本：AI-REPORT-V1.0</div>
  </article>;
}

function reportTitle(config: AssetAiConfig) {
  return config.reportTitle ?? `${config.title.replace(/^AI/, '')}专项分析报告`;
}

function reportDomainLabel(config: AssetAiConfig) {
  if (config.tone === 'aiBalance') return '工业企业能碳管理平台 · 能源平衡与优化调度';
  if (config.tone === 'aiAnalysis') return '工业企业能碳管理平台 · 用能分析与策略推荐';
  if (config.tone === 'aiAsset') return '工业企业能碳管理平台 · 碳资产管理';
  return '工业企业能碳管理平台 · 预算管理';
}

function reportIntro(config: AssetAiConfig) {
  if (config.tone === 'aiBalance') return '结合能效对标、能流分析和运行数据生成';
  if (config.tone === 'aiAnalysis') return '结合用能结构、成本和能效表现生成';
  if (config.tone === 'aiAsset') return '结合预计排放、资产台账和履约条件生成';
  return '基于预算目标、执行数据和预测结果生成';
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.reportSection}><h2>{title}</h2>{children}</section>;
}

function buildReportDocument(config: AssetAiConfig, result: AiResultState) {
  const evidence = config.evidence.map((item) => `<tr><td>${item.label}</td><td><b>${item.value}</b></td><td>${item.note}</td><td>系统计算</td></tr>`).join('');
  const isBalanceReport = config.tone === 'aiBalance';
  const isStrategyReport = config.tone === 'aiAnalysis';
  const title = reportTitle(config);
  const balanceSections = `
    <section class="section"><h2>一、诊断结论</h2><div class="summary">${config.judgement}</div><div class="action"><b>优先优化建议：</b>${config.priorityAction}</div></section>
    <section class="section"><h2>二、能源平衡现状</h2><table><tr><th>观察内容</th><th>结果</th><th>说明</th></tr>${config.evidence.slice(0, 4).map((item) => `<tr><td>${item.label}</td><td><b>${item.value}</b></td><td>${item.note}</td></tr>`).join('')}</table></section>
    <section class="section"><h2>三、能效对标与指标变化</h2><p>${config.logic}</p><p>系统将能效对标结果、同比/环比变化和能源分配情况结合起来，优先识别需要进一步核对或优化的用能对象。</p></section>
    <section class="section"><h2>四、工艺、设备与调度建议</h2><ul><li>${config.priorityAction}</li><li>结合生产负荷和设备运行状态，调整工艺参数、设备运行方式和用能时段。</li><li>优化能源分配顺序，优先保障关键生产环节，减少闲置和重复供能。</li><li>持续跟踪优化后的能耗指标和能源平衡结果，确认措施效果。</li></ul></section>
    <section class="section"><h2>五、执行前需要确认的事项</h2><p>${config.uncertainty}</p><p>建议由生产、设备和能源管理人员共同确认现场条件后再执行调整。</p></section>`;
  const strategySections = `
    <section class="section"><h2>一、分析结论</h2><div class="summary">${config.judgement}</div><div class="action"><b>优先推荐：</b>${config.priorityAction}</div></section>
    <section class="section"><h2>二、用能结构与成本分析</h2><table><tr><th>分析内容</th><th>结果</th><th>说明</th></tr>${config.evidence.map((item) => `<tr><td>${item.label}</td><td><b>${item.value}</b></td><td>${item.note}</td></tr>`).join('')}</table></section>
    <section class="section"><h2>三、能效表现与问题识别</h2><p>${config.logic}</p><p>重点关注能源品种占比、单位产品能耗、用能成本和重点用能单元之间的关系，避免只看总量变化作出片面判断。</p></section>
    <section class="section"><h2>四、优化用能配置建议</h2><ul><li>${config.priorityAction}</li><li>根据不同用能单元的负荷和能效表现，优化能源品种、供能比例和使用时段。</li><li>对成本较高或效率偏低的环节，结合设备适配条件制定替代、错峰或运行方式调整方案。</li></ul></section>
    <section class="section"><h2>五、清洁能源使用建议</h2><ul><li>结合清洁能源可用量、生产负荷和用能时段，评估优先替代的能源环节。</li><li>确认清洁能源接入、储存、设备适配和生产连续性条件后，再制定实施计划。</li></ul></section>
    <section class="section"><h2>六、执行前需要确认的事项</h2><p>${config.uncertainty}</p><p>推荐策略用于辅助决策，正式调整前应由能源、生产和设备管理人员共同确认。</p></section>`;
  const standardSections = `
    <section class="section"><h2>一、核心研判</h2><div class="summary">${config.judgement}</div><div class="action"><b>优先建议：</b>${config.priorityAction}</div></section>
    <section class="section"><h2>二、关键数据与判断依据</h2><table><tr><th>关键指标</th><th>指标值</th><th>业务说明</th><th>来源属性</th></tr>${evidence}</table></section>
    <section class="section"><h2>三、详细分析</h2><p><b>指标关联逻辑：</b>${config.logic}</p><p><b>重点对象与管理含义：</b>${config.judgement}</p><ul><li>${config.priorityAction}</li><li>持续跟踪相关指标在后续周期的变化，条件变化后重新生成分析。</li><li>将系统事实、现场信息与管理计划结合后，由业务人员作出最终决策。</li></ul></section>
    <section class="section"><h2>四、待核实事项与数据限制</h2><p>${config.uncertainty}</p></section>
    <section class="section"><h2>五、分析口径与生成说明</h2><p>页面指标、同比、偏差、阈值、预测、排名和履约缺口由业务系统计算；AI仅生成解释、建议与待核实说明。</p><div class="note">本报告用于辅助识别问题和提供管理参考，不替代现场诊断、专业审计、合规判断或企业最终决策。</div></section>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${config.period}_${title}</title><style>body{margin:0;background:#f4f7f6;font-family:"Microsoft YaHei","PingFang SC",Arial;color:#24313b}.paper{width:794px;margin:20px auto;background:#fff;padding:38px 44px;box-sizing:border-box}.cover{padding-bottom:26px;border-bottom:2px solid #0a9667}.cover>small{color:#078a5d;font-weight:700}.cover h1{font-size:25px;margin:25px 0 9px}.info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px;font-size:12px}.section{padding:24px 0;border-bottom:1px solid #e6ebe8}.section h2{font-size:17px}.summary{border-left:4px solid #009b68;background:#f6fbf8;padding:14px 16px;font-weight:600;line-height:1.8}.action{margin-top:12px;border:1px solid #bfe3d4;background:#f7fcfa;padding:12px 14px}.action b{color:#078a5d}table{width:100%;border-collapse:collapse}th,td{padding:9px 10px;border:1px solid #dee5e2;text-align:left;font-size:11px;line-height:1.5}th{background:#f2f8f5}p,li{font-size:12px;line-height:1.8}.note{background:#f7f8f8;padding:12px 14px;font-size:10px;color:#77827d}@media print{body{background:#fff}.paper{margin:0;width:auto}}</style></head><body><article class="paper"><div class="cover"><small>${reportDomainLabel(config)}</small><h1>${title}</h1><p>${reportIntro(config)}</p><div class="info"><span>分析范围：<b>${config.scope}</b></span><span>分析周期：<b>${config.period}</b></span><span>数据截止：<b>${config.cutoff}</b></span><span>生成时间：<b>${result.generatedAt}</b></span><span>分析编号：<b>${result.analysisId}</b></span><span>报告版本：<b>V1.0</b></span></div></div>${isBalanceReport ? balanceSections : isStrategyReport ? strategySections : standardSections}</article></body></html>`;
}
