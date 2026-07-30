import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

export type AssetAiKey = 'balance' | 'analysis' | 'budgetEnergy' | 'budgetCarbon' | 'asset';

type AiStatus = 'generated' | 'loading' | 'stale';

export interface AssetAiEvidence {
  label: string;
  value: string;
  note: string;
}

export interface AssetAiConfig {
  tone: 'aiBalance' | 'aiAnalysis' | 'aiBudget' | 'aiAsset';
  title: string;
  description: string;
  period: string;
  scope: string;
  cutoff: string;
  level: string;
  reasoningType: string;
  judgement: string;
  logic: string;
  evidence: AssetAiEvidence[];
  priorityAction: string;
  uncertainty: string;
  inputs: string[];
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
    title: 'AI平衡研判',
    description: '关联能流平衡、重点用能单元和层级差额，提示优先核查与优化对象。',
    period: '2026年6月',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '重点对象研判',
    reasoningType: '能流勾稽与优化优先级研判',
    judgement: '当前能源分配与利用数据已形成统一管理口径，建议优先核查待细分量和层级异常量较高的用能单元。',
    logic: '企业能源输入、一级分配和二级利用读取同一能流聚合结果；一级与二级数据仅作层级勾稽，不重复计入企业总量。',
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
    title: 'AI用能洞察',
    description: '关联总量、单耗、成本和重点单元，解释指标变化背后的业务含义。',
    period: '2026年6月',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '趋势判断',
    reasoningType: '跨指标关联研判',
    judgement: '本期能源消费增长更可能由生产规模变化驱动，而不是企业整体能效恶化。能源消费总量同比上升2.3%，但单位产品综合能耗同比下降0.7%，两项指标方向相反。',
    logic: '能源总量上升 ＋ 单位产品能耗下降 → 应先验证产量、运行时长和负荷变化，不宜直接判定为能效下降。',
    evidence: [
      { label: '能源消费总量同比', value: '+2.3%', note: '总量有所增加' },
      { label: '单位产品能耗同比', value: '-0.7%', note: '效率指标有所改善' },
      { label: '主要增量对象', value: '生产单元A', note: '需结合产量进一步判断' },
    ],
    priorityAction: '优先分析生产单元A同期产量、运行时长和单位产品能耗，避免将正常的生产规模增长误判为能效恶化。',
    uncertainty: '若同期产量或运行负荷数据不完整，当前结论仅为趋势性判断，不能作为严格归因结果。',
    inputs: ['能源消费总量', '单位产品综合能耗', '重点用能单元', '能源结构', '能源成本', '运营数据'],
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
    title: 'AI履约研判',
    description: '关联预计排放、资产台账和履约条件，提示履约准备重点。',
    period: '2026年度',
    scope: '全企业',
    cutoff: '2026-06-30',
    level: '缺口：5,000 tCO₂',
    reasoningType: '履约可用性研判',
    judgement: '当前账面碳资产仍无法完全覆盖预计全年排放；在补充资产前，应先确认CCER及待确认减排资产的实际可履约数量，避免将账面数量直接视为可用资产。',
    logic: '预计排放105,000 tCO₂ ＞ 已分配配额95,000 tCO₂ ＋ 可用CCER5,000 tCO₂ → 初步缺口5,000 tCO₂，待确认资产暂不计入。',
    evidence: [
      { label: '预计全年排放', value: '105,000 tCO₂', note: '当前预测结果' },
      { label: '配额＋可用CCER', value: '100,000 tCO₂', note: '已确认可用资产' },
      { label: '初步履约缺口', value: '5,000 tCO₂', note: '待确认资产未计入' },
    ],
    priorityAction: '先核实各类资产的有效期、适用履约周期和可抵销比例，再确定需要补充的配额数量。',
    uncertainty: 'AI不直接判定某类资产是否符合履约规则，最终以系统维护的政策规则和人工审核结果为准。',
    inputs: ['预计全年排放', '已分配配额', 'CCER可用量', '资产有效状态', '履约规则'],
  },
};

function initialState(key: AssetAiKey): AiResultState {
  return {
    status: 'generated',
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
    balance: initialState('balance'),
    analysis: initialState('analysis'),
    budgetEnergy: initialState('budgetEnergy'),
    budgetCarbon: initialState('budgetCarbon'),
    asset: initialState('asset'),
  });
  const [drawer, setDrawer] = useState<'evidence' | 'basis' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const previousInvalidation = useRef(invalidationVersion);
  const config = configOverride ?? aiConfigs[analysisKey];
  const result = states[analysisKey];

  useEffect(() => {
    if (previousInvalidation.current === invalidationVersion) return;
    previousInvalidation.current = invalidationVersion;
    setStates((current) => ({
      ...current,
      [analysisKey]: {
        ...current[analysisKey],
        status: current[analysisKey].status === 'loading' ? 'loading' : 'stale',
      },
    }));
  }, [analysisKey, invalidationVersion]);

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
        {result.status === 'generated' && <Button onClick={generate}>重新生成</Button>}
      </div>
      <div className={styles.aiLiteBody}>
        {result.status === 'loading' ? <AiLoading /> : <>
          {result.status === 'stale' && <div className={styles.aiWarning}><span>筛选条件或业务数据已变化，当前摘要与报告仍基于上一版数据快照。</span><Button onClick={generate}>重新生成</Button></div>}
          <div className={styles.aiCompact}>
            <div className={styles.aiCompactTop}>
              <div className={styles.aiCompactCopy}>
                <div className={styles.aiKicker}><b>AI辅助研判</b><span>{config.level}</span></div>
                <div className={styles.aiJudgement}>{config.judgement}</div>
                <div className={styles.aiPriority}><b>优先建议</b>{config.priorityAction}</div>
              </div>
              <div className={styles.aiCompactActions}>
                <Button onClick={() => setDrawer('evidence')}>查看研判依据</Button>
                <Button primary onClick={() => setReportOpen(true)}>导出分析报告</Button>
              </div>
            </div>
            <div className={styles.aiCompactBottom}>
              <div className={styles.aiMeta}>
                <span>范围：<b>{config.scope}</b></span>
                <span>周期：<b>{config.period}</b></span>
                <span>数据截止：<b>{config.cutoff}</b></span>
                <span>生成：<b>{result.generatedAt}</b></span>
              </div>
              <button type="button" className={styles.aiTextLink} onClick={() => setDrawer('basis')}>研发实现说明</button>
            </div>
          </div>
        </>}
      </div>
    </section>
    {drawer === 'evidence' && <EvidenceDrawer config={config} onClose={() => setDrawer(null)} notify={notify} />}
    {drawer === 'basis' && <BasisDrawer config={config} result={result} onClose={() => setDrawer(null)} />}
    {reportOpen && <AiReportModal config={config} result={result} onClose={() => setReportOpen(false)} notify={notify} />}
  </>;
}

function AiStatusLabel({ status }: { status: AiStatus }) {
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
  return <Drawer title={`${config.title}｜研判依据`} width={540} onClose={onClose} footer={<Button primary onClick={() => { onClose(); notify('研判依据已标记为已阅'); }}>标记已阅</Button>}>
    <AiDrawerSection title="页面引用的系统事实">
      <table className={styles.aiBasisTable}><thead><tr><th>指标</th><th>当前值</th><th>说明</th></tr></thead><tbody>{config.evidence.map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td></tr>)}</tbody></table>
    </AiDrawerSection>
    <AiDrawerSection title="跨指标关联逻辑"><p className={styles.aiDrawerText}>{config.logic}</p></AiDrawerSection>
    <AiDrawerSection title="待核实与适用边界"><div className={styles.aiBoundary}>{config.uncertainty}</div></AiDrawerSection>
    <AiDrawerSection title="数据来源范围"><div className={styles.aiInputTags}>{config.inputs.map((item) => <span key={item}>{item}</span>)}</div></AiDrawerSection>
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
    anchor.download = `${config.period}_${config.title.replace('AI', '')}_专项分析报告.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('分析报告已下载');
  };
  return <div className={styles.aiReportOverlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.aiReportModal} role="dialog" aria-label={`${config.title}专项分析报告`}>
      <header>
        <div><h2>{config.title.replace('AI', '')}专项分析报告</h2><p>页面摘要与报告基于同一分析任务和数据快照</p></div>
        <div><Button onClick={download}>下载HTML报告</Button><Button primary onClick={() => window.print()}>打印 / 另存为PDF</Button><button type="button" aria-label="关闭分析报告" onClick={onClose}>×</button></div>
      </header>
      <div className={styles.aiReportBody}><ReportPaper config={config} result={result} /></div>
    </section>
  </div>;
}

function ReportPaper({ config, result }: { config: AssetAiConfig; result: AiResultState }) {
  return <article className={styles.reportPaper}>
    <div className={styles.reportCover}><b>工业企业能碳管理平台 · AI辅助研判</b><h1>{config.title.replace('AI', '')}专项分析报告</h1><p>基于系统业务数据快照与结构化AI研判生成</p><div>{[['分析范围', config.scope], ['分析周期', config.period], ['数据截止', config.cutoff], ['生成时间', result.generatedAt], ['分析编号', result.analysisId], ['报告版本', 'V1.0']].map(([label, value]) => <span key={label}><i>{label}</i><strong>{value}</strong></span>)}</div></div>
    <ReportSection title="一、核心研判"><div className={styles.reportSummary}>{config.judgement}</div><div className={styles.reportAction}><b>优先建议：</b>{config.priorityAction}</div></ReportSection>
    <ReportSection title="二、关键数据与判断依据"><table className={styles.reportTable}><thead><tr><th>关键指标</th><th>指标值</th><th>业务说明</th><th>来源属性</th></tr></thead><tbody>{config.evidence.map((item) => <tr key={item.label}><td>{item.label}</td><td><b>{item.value}</b></td><td>{item.note}</td><td><span>系统计算</span></td></tr>)}</tbody></table></ReportSection>
    <ReportSection title="三、详细分析"><p><b>指标关联逻辑：</b>{config.logic}</p><p><b>重点对象与管理含义：</b>{config.judgement}</p><ul><li>{config.priorityAction}</li><li>持续跟踪相关指标在后续周期的变化，条件变化后重新生成分析。</li><li>将系统事实、现场信息与管理计划结合后，由业务人员作出最终决策。</li></ul></ReportSection>
    <ReportSection title="四、待核实事项与数据限制"><p>{config.uncertainty}</p></ReportSection>
    <ReportSection title="五、分析口径与生成说明"><table className={styles.reportTable}><tbody><tr><th>结构化输入</th><td>{config.inputs.join('、')}</td></tr><tr><th>确定性内容</th><td>页面指标、同比/偏差、阈值、预测、排名和履约缺口由业务系统计算。</td></tr><tr><th>AI生成内容</th><td>核心研判、指标关联解释、优先建议与待核实说明。</td></tr><tr><th>一致性机制</th><td>页面摘要与本报告读取同一个 analysisId 和数据快照，报告导出时不再次调用大模型。</td></tr></tbody></table><div className={styles.reportDisclaimer}>本报告基于系统内现有数据和配置规则生成，AI分析用于辅助识别问题和提供管理参考，不替代现场诊断、专业审计、合规判断或企业最终决策。</div></ReportSection>
    <div className={styles.reportVersion}>分析编号：{result.analysisId} ｜ 模板版本：AI-REPORT-V1.0</div>
  </article>;
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.reportSection}><h2>{title}</h2>{children}</section>;
}

function buildReportDocument(config: AssetAiConfig, result: AiResultState) {
  const evidence = config.evidence.map((item) => `<tr><td>${item.label}</td><td><b>${item.value}</b></td><td>${item.note}</td><td>系统计算</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${config.period}_${config.title}_专项分析报告</title><style>body{margin:0;background:#f4f7f6;font-family:"Microsoft YaHei","PingFang SC",Arial;color:#24313b}.paper{width:794px;margin:20px auto;background:#fff;padding:38px 44px;box-sizing:border-box}.cover{padding-bottom:26px;border-bottom:2px solid #0a9667}.cover>small{color:#078a5d;font-weight:700}.cover h1{font-size:25px;margin:25px 0 9px}.info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px;font-size:12px}.section{padding:24px 0;border-bottom:1px solid #e6ebe8}.section h2{font-size:17px}.summary{border-left:4px solid #009b68;background:#f6fbf8;padding:14px 16px;font-weight:600;line-height:1.8}.action{margin-top:12px;border:1px solid #bfe3d4;background:#f7fcfa;padding:12px 14px}.action b{color:#078a5d}table{width:100%;border-collapse:collapse}th,td{padding:9px 10px;border:1px solid #dee5e2;text-align:left;font-size:11px;line-height:1.5}th{background:#f2f8f5}p,li{font-size:12px;line-height:1.8}.note{background:#f7f8f8;padding:12px 14px;font-size:10px;color:#77827d}@media print{body{background:#fff}.paper{margin:0;width:auto}}</style></head><body><article class="paper"><div class="cover"><small>工业企业能碳管理平台 · AI辅助研判</small><h1>${config.title.replace('AI', '')}专项分析报告</h1><p>基于系统业务数据快照与结构化AI研判生成</p><div class="info"><span>分析范围：<b>${config.scope}</b></span><span>分析周期：<b>${config.period}</b></span><span>数据截止：<b>${config.cutoff}</b></span><span>生成时间：<b>${result.generatedAt}</b></span><span>分析编号：<b>${result.analysisId}</b></span><span>报告版本：<b>V1.0</b></span></div></div><section class="section"><h2>一、核心研判</h2><div class="summary">${config.judgement}</div><div class="action"><b>优先建议：</b>${config.priorityAction}</div></section><section class="section"><h2>二、关键数据与判断依据</h2><table><tr><th>关键指标</th><th>指标值</th><th>业务说明</th><th>来源属性</th></tr>${evidence}</table></section><section class="section"><h2>三、详细分析</h2><p><b>指标关联逻辑：</b>${config.logic}</p><p><b>重点对象与管理含义：</b>${config.judgement}</p><ul><li>${config.priorityAction}</li><li>持续跟踪相关指标在后续周期的变化，条件变化后重新生成分析。</li><li>将系统事实、现场信息与管理计划结合后，由业务人员作出最终决策。</li></ul></section><section class="section"><h2>四、待核实事项与数据限制</h2><p>${config.uncertainty}</p></section><section class="section"><h2>五、分析口径与生成说明</h2><p>页面指标、同比、偏差、阈值、预测、排名和履约缺口由业务系统计算；AI仅生成解释、建议与待核实说明。</p><div class="note">本报告用于辅助识别问题和提供管理参考，不替代现场诊断、专业审计、合规判断或企业最终决策。</div></section></article></body></html>`;
}
