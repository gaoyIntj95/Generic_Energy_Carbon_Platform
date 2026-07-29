/* eslint-disable no-irregular-whitespace */
import { useState, type ReactNode } from 'react';
import {
  getBudgetTarget,
  listCarbonAssets,
  saveBudgetTarget,
  saveCarbonAsset,
} from '../../mocks/platformMockStore';
import { DEMO_ORGANIZATION_ID } from '../../mocks/energyUnitMockStore';
import type { BudgetType, CarbonAsset, CarbonAssetType } from '../../types/platformDomain';
import { Button, Drawer, Field, Modal, Tag, Toast } from './PrototypeUI';
import styles from './AssetOperationsV2.module.css';

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const scopes = ['全企业', '生产单元A', '生产单元B', '公辅系统'];

const balanceRows = [
  { name: '生产单元A', input: 8900, effective: 6320, recovered: 1230, output: 860, deviation: 490, rate: 5.5, state: '关注' },
  { name: '生产单元B', input: 6700, effective: 4650, recovered: 780, output: 570, deviation: 700, rate: 10.4, state: '异常' },
  { name: '公辅系统', input: 4950, effective: 3330, recovered: 520, output: 420, deviation: 680, rate: 13.7, state: '异常' },
  { name: '回收能源系统', input: 3950, effective: 2880, recovered: 1020, output: 100, deviation: -50, rate: -1.3, state: '正常' },
  { name: '辅助车间', input: 3950, effective: 2640, recovered: 310, output: 360, deviation: 640, rate: 16.2, state: '异常' },
];

const analysisRows = [
  { name: '生产单元A', consumption: 6320, share: '50.2%', cost: 2450, change: '+2.8%', attention: '重点关注' },
  { name: '生产单元B', consumption: 4650, share: '37.0%', cost: 1830, change: '+1.6%', attention: '关注' },
  { name: '公辅系统', consumption: 3330, share: '26.5%', cost: 1120, change: '-0.4%', attention: '一般关注' },
  { name: '回收能源系统', consumption: 2880, share: '22.9%', cost: 760, change: '-1.2%', attention: '一般关注' },
  { name: '辅助车间', consumption: 2640, share: '21.0%', cost: 520, change: '+1.9%', attention: '关注' },
];

const budgetRows = {
  energy: [
    ['全企业', 120600, 65000, 125600],
    ['生产单元A', 48000, 28000, 52500],
    ['生产单元B', 39000, 19000, 38200],
    ['公辅系统', 33600, 18000, 34900],
  ],
  carbon: [
    ['全企业', 95000, 51200, 99500],
    ['生产单元A', 42000, 23800, 45200],
    ['生产单元B', 31000, 16600, 30300],
    ['公辅系统', 22000, 10800, 24000],
  ],
} as const;

type Overlay =
  | { kind: 'balance'; name: string }
  | { kind: 'ai'; title: string }
  | { kind: 'budget'; type: BudgetType }
  | { kind: 'budgetDetail'; row: readonly [string, number, number, number]; type: BudgetType }
  | { kind: 'asset'; asset?: CarbonAsset }
  | { kind: 'assetDetail'; asset: CarbonAsset }
  | { kind: 'estimate' }
  | null;

function useFeedback() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };
  return { toast, notify };
}

function format(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function Page({ children, toast }: { children: ReactNode; toast: string }) {
  return <div className={styles.page}>{children}<Toast message={toast} /></div>;
}

function CommonFilters({
  cycle = false,
  compare = false,
  period,
  setPeriod,
  scope,
  setScope,
  onQuery,
  onReset,
}: {
  cycle?: boolean;
  compare?: boolean;
  period?: 'month' | 'year';
  setPeriod?: (period: 'month' | 'year') => void;
  scope: string;
  setScope: (scope: string) => void;
  onQuery: () => void;
  onReset: () => void;
}) {
  return <section className={`${styles.card} ${styles.filters}`}>
    {!cycle && <div className={styles.filterField}><span>分析周期</span><div className={styles.segment}><button type="button" className={period === 'month' ? styles.segmentActive : ''} onClick={() => setPeriod?.('month')}>月度</button><button type="button" className={period === 'year' ? styles.segmentActive : ''} onClick={() => setPeriod?.('year')}>年度</button></div></div>}
    <Field label={cycle ? '履约周期' : '年份'}><select><option>{cycle ? '2026年度' : '2026年'}</option><option>{cycle ? '2025年度' : '2025年'}</option></select></Field>
    {!cycle && period !== 'year' && <Field label="月份"><select><option>6月</option><option>5月</option><option>4月</option></select></Field>}
    <Field label="统计范围"><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((value) => <option key={value}>{value}</option>)}</select></Field>
    {compare && <Field label="对比口径"><select><option>同比</option><option>环比</option></select></Field>}
    <div className={styles.filterSpacer} />
    <Button primary onClick={onQuery}>查询</Button><Button onClick={onReset}>重置</Button>
  </section>;
}

function Kpi({ label, value, unit, sub, danger = false, icon }: { label: string; value: string; unit: string; sub: ReactNode; danger?: boolean; icon?: string }) {
  return <div className={`${styles.card} ${styles.kpi} ${danger ? styles.kpiDanger : ''}`}>{icon && <i>{icon}</i>}<span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{sub}</p></div>;
}

function Status({ value }: { value: string }) {
  const tone = value.includes('异常') || value.includes('超预算') ? 'red' : value === '正常' ? 'green' : 'orange';
  return <Tag tone={tone}>{value}</Tag>;
}

export function AssetOperationsV2({ pathname }: { pathname: string }) {
  if (pathname.endsWith('/balance')) return <BalancePage />;
  if (pathname.endsWith('/analysis')) return <AnalysisPage />;
  if (pathname.endsWith('/budget')) return <BudgetPage />;
  return <CarbonAssetsPage />;
}

function BalancePage() {
  const { toast, notify } = useFeedback();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const visibleRows = appliedScope === '全企业' ? balanceRows : balanceRows.filter((row) => row.name === appliedScope);
  return <Page toast={toast}>
    <CommonFilters period={period} setPeriod={setPeriod} scope={scope} setScope={setScope} compare onQuery={() => { setAppliedScope(scope); notify('查询条件已更新'); }} onReset={() => { setPeriod('month'); setScope('全企业'); setAppliedScope('全企业'); notify('已重置查询条件'); }} />
    <div className={styles.kpiFive}>
      <Kpi label="能源输入量" value="28,450" unit="tce" sub={<>同比：<b className={styles.up}>+3.6%</b></>} />
      <Kpi label="终端有效利用量" value="19,820" unit="tce" sub={<>占比：<b className={styles.down}>69.7%</b>　同比：<b className={styles.up}>+2.1%</b></>} />
      <Kpi label="回收利用量" value="3,860" unit="tce" sub={<>占比：<b className={styles.down}>13.6%</b>　同比：<b className={styles.up}>+1.4%</b></>} />
      <Kpi label="外部输出量" value="3,130" unit="tce" sub={<>占比：<b className={styles.down}>11.0%</b>　同比：<b className={styles.down}>-0.8%</b></>} />
      <Kpi label="平衡偏差" value="1,640" unit="tce" danger sub={<>偏差率：<b className={styles.up}>6.1%</b>　同比：<b className={styles.up}>+1.7%</b></>} />
    </div>
    <div className={styles.twoColumns}>
      <section className={`${styles.card} ${styles.panel}`}><h2>能效平衡总览</h2><BalanceFlow onOpen={(name) => setOverlay({ kind: 'balance', name })} /></section>
      <section className={`${styles.card} ${styles.panel}`}><div className={styles.panelHead}><h2>关键偏差对象 TOP5</h2><span>差异量（tce）　　偏差率</span></div><RankList onOpen={(name) => setOverlay({ kind: 'balance', name })} /></section>
    </div>
    <section className={`${styles.card} ${styles.tableCard}`}><h2>用能单元平衡清单</h2><div className={styles.tableWrap}><table><thead><tr><th>用能单元</th><th>能源输入量（tce）</th><th>终端有效利用量（tce）</th><th>回收利用量（tce）</th><th>外部输出量（tce）</th><th>平衡偏差（tce）</th><th>偏差率</th><th>状态</th><th>操作</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{format(row.input)}</td><td>{format(row.effective)}</td><td>{format(row.recovered)}</td><td>{format(row.output)}</td><td>{format(row.deviation)}</td><td>{row.rate}%</td><td><Status value={row.state} /></td><td><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'balance', name: row.name })}>查看详情</button></td></tr>)}</tbody></table></div><div className={styles.formula}>ⓘ　公式说明：平衡偏差 = 能源输入量 - 终端有效利用量 - 回收利用量 - 外部输出量；当偏差率超过阈值时标记为异常。</div></section>
    <AiBalance onOpen={(title) => setOverlay({ kind: 'ai', title })} onDiagnose={() => notify('AI分析已更新')} onExport={() => notify('报告已生成')} />
    {overlay?.kind === 'balance' && <BalanceDrawer name={overlay.name} onClose={() => setOverlay(null)} onAction={() => notify('优化方案已生成')} />}
    {overlay?.kind === 'ai' && <AiDrawer title={overlay.title} onClose={() => setOverlay(null)} onAction={() => notify('优化方案已生成')} />}
  </Page>;
}

function BalanceFlow({ onOpen }: { onOpen: (name: string) => void }) {
  const nodes = [
    { name: '终端有效利用量', value: '19,820', share: '69.7%', y: 25, h: 62, fill: '#D4E5FF', stroke: '#B9D2FB', color: '#1769C2' },
    { name: '回收利用量', value: '3,860', share: '13.6%', y: 94, h: 42, fill: '#D6F0E1', stroke: '#BCE4CD', color: '#168157' },
    { name: '外部输出量', value: '3,130', share: '11.0%', y: 142, h: 38, fill: '#FFE5B8', stroke: '#FFD38A', color: '#D46C00' },
    { name: '平衡偏差', value: '1,640', share: '6.1%', y: 187, h: 33, fill: '#FFD8D5', stroke: '#F5B7B1', color: '#D92D20' },
  ];
  return <div className={styles.flow}><svg viewBox="0 0 700 250" preserveAspectRatio="none">
    <path d="M151 72 C260 72 280 33 420 33 L510 33 L510 82 L420 82 C280 82 260 101 151 101Z" fill="#C9DEFF" opacity=".92" />
    <path d="M151 101 C265 101 290 95 425 95 L510 95 L510 134 L425 134 C290 134 265 126 151 126Z" fill="#C8EAD7" opacity=".9" />
    <path d="M151 126 C275 126 300 142 430 142 L510 142 L510 178 L430 178 C300 178 275 151 151 151Z" fill="#FFE2B2" opacity=".92" />
    <path d="M151 151 C265 151 300 185 430 185 L510 185 L510 215 L430 215 C300 215 265 176 151 176Z" fill="#F8C3BF" opacity=".88" />
    <g role="button" tabIndex={0} onClick={() => onOpen('能源输入量')}><rect x="20" y="72" width="131" height="104" rx="6" fill="#D9F3E7" stroke="#C9EADB" /><text x="38" y="115" fill="#14765A" fontWeight="700" fontSize="14">能源输入量</text><text x="38" y="145" fill="#09845E" fontWeight="700" fontSize="24">28,450</text><text x="112" y="145" fill="#4E655D" fontSize="12">tce</text><text x="38" y="166" fill="#53645F" fontSize="12">100%</text></g>
    {nodes.map((node) => <g role="button" tabIndex={0} key={node.name} onClick={() => onOpen(node.name)}><rect x="510" y={node.y} width="170" height={node.h} rx="6" fill={node.fill} stroke={node.stroke} /><text x="530" y={node.y + 16} fill={node.color} fontWeight="700" fontSize="11">{node.name}</text><text x="530" y={node.y + node.h - 6} fill={node.color} fontWeight="700" fontSize={node.h < 40 ? 14 : 16}>{node.value}</text><text x="588" y={node.y + node.h - 6} fill="#4D5E6D" fontSize="10">tce　{node.share}</text></g>)}
  </svg></div>;
}

function RankList({ onOpen }: { onOpen: (name: string) => void }) {
  const colors = ['#3478F6', '#0AA06C', '#FF8700', '#7A54E8', '#37B5C3'];
  const ranks = [
    ['生产单元A', 860, 8.9, 100],
    ['生产单元B', 520, 6.3, 65],
    ['公辅系统', 300, 5.8, 36],
    ['回收能源系统', 220, 4.2, 27],
    ['辅助车间', 150, 3.1, 17],
  ] as const;
  return <div className={styles.ranks}><div className={styles.rankHead}><span /><span /><span /><span>差异量</span><span>偏差率</span></div>{ranks.map(([name, value, rate, width], index) => <button type="button" key={name} onClick={() => onOpen(name)}><i style={{ background: colors[index] }}>{index + 1}</i><b>{name}</b><span><em style={{ width: `${width}%`, background: colors[index] }} /></span><strong>{value}</strong><small>{rate}%</small></button>)}</div>;
}

function AiBalance({ onOpen, onDiagnose, onExport }: { onOpen: (title: string) => void; onDiagnose: () => void; onExport: () => void }) {
  const cards = [
    ['异常识别', '发现3个用能单元偏差率异常：生产单元B、公辅系统、辅助车间。', '查看详情'],
    ['对标结论', '公辅系统输配损耗高于企业目标值，生产单元B综合能效低于内部标杆。', '查看对标'],
    ['可能原因', '可能由于计量缺失、工艺波动、设备效率下降或能源回收不足。', '查看原因分析'],
    ['建议动作', '建议优先排查公辅系统输配过程损耗，并优化生产单元B运行效率。', '生成优化方案'],
  ];
  return <section className={`${styles.card} ${styles.aiCard}`}><div className={styles.aiHead}><h2>AI优化建议 <small>（基于能流分析与能效对标自动生成）</small></h2><button type="button" className={styles.link} onClick={onExport}>⇩ 导出报告</button></div><div className={styles.aiFour}><div><Button primary onClick={onDiagnose}>▣ AI诊断</Button></div>{cards.map(([title, text, action], index) => <article key={title}><h3><i>{index + 1}</i>{title}</h3><p>{text}</p><button type="button" className={styles.link} onClick={() => onOpen(title)}>{action} ＞</button></article>)}</div></section>;
}

function BalanceDrawer({ name, onClose, onAction }: { name: string; onClose: () => void; onAction: () => void }) {
  const row = balanceRows.find((item) => item.name === name) ?? balanceRows[0];
  return <Drawer title={`${name}｜平衡详情`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onAction}>生成优化方案</Button></>}><h3 className={styles.detailTitle}>平衡概览</h3><DetailGrid values={[['能源输入量', `${format(row.input)} tce`], ['终端有效利用量', `${format(row.effective)} tce`], ['回收利用量', `${format(row.recovered)} tce`], ['平衡偏差', `${format(row.deviation)} tce（${row.rate}%）`]]} /><h3 className={styles.detailTitle}>能源流向</h3><div className={styles.detailFlow}>能源输入 → 终端利用 / 回收利用 / 外部输出</div><h3 className={styles.detailTitle}>可能原因</h3><p className={styles.detailText}>计量点覆盖不足、工艺波动、设备效率下降或能源回收不足，可能导致能源去向不清晰。</p><h3 className={styles.detailTitle}>建议动作</h3><p className={styles.detailText}>建议核查计量完整性，结合能效对标结果排查高损失环节，并跟踪后续月份偏差变化。</p></Drawer>;
}

function AiDrawer({ title, onClose, onAction }: { title: string; onClose: () => void; onAction: () => void }) {
  return <Drawer title={`AI分析｜${title}`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onAction}>生成优化方案</Button></>}><h3 className={styles.detailTitle}>分析结论</h3><p className={styles.detailText}>系统基于当前周期能源平衡数据、历史变化和内部对标结果生成辅助判断。该结论用于提示排查方向，最终应结合现场运行情况确认。</p><h3 className={styles.detailTitle}>关联对象</h3><DetailGrid values={[['重点对象', '生产单元B'], ['偏差率', '10.4%'], ['对标状态', '低于内部标杆'], ['建议优先级', '高']]} /></Drawer>;
}

function AnalysisPage() {
  const { toast, notify } = useFeedback();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const rows = appliedScope === '全企业' ? analysisRows : analysisRows.filter((row) => row.name === appliedScope);
  return <Page toast={toast}>
    <CommonFilters period={period} setPeriod={setPeriod} scope={scope} setScope={setScope} onQuery={() => { setAppliedScope(scope); notify('查询条件已更新'); }} onReset={() => { setPeriod('month'); setScope('全企业'); setAppliedScope('全企业'); notify('已重置查询条件'); }} />
    <div className={styles.kpiThree}><Kpi label="能源消费总量" value="12,580" unit="tce" icon="◔" sub={<>同比　<b className={styles.up}>+2.3%</b></>} /><Kpi label="综合能源成本" value="10,837" unit="万元" icon="◉" sub={<>同比　<b className={styles.up}>+2.3%</b></>} /><Kpi label="单位产品综合能耗" value="97.6" unit="kgce/t" icon="↗" sub={<>同比　<b className={styles.down}>-0.7%</b></>} /></div>
    <div className={styles.twoColumns}><section className={`${styles.card} ${styles.panel}`}><h2>能源消费结构</h2><EnergyDonut /></section><section className={`${styles.card} ${styles.panel}`}><h2>能源成本结构</h2><CostBars /></section></div>
    <section className={`${styles.card} ${styles.tableCard}`}><h2>重点用能单元分析</h2><div className={styles.tableWrap}><table><thead><tr><th>用能单元</th><th>能源消费量（tce）</th><th>占比</th><th>能源成本（万元）</th><th>同比变化</th><th>关注建议</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{format(row.consumption)}</td><td>{row.share}</td><td>{format(row.cost)}</td><td className={row.change.startsWith('+') ? styles.up : styles.down}>{row.change}</td><td><Status value={row.attention} /></td></tr>)}</tbody></table></div></section>
    <section className={`${styles.card} ${styles.aiCard}`}><div className={styles.aiHead}><h2>AI分析建议</h2></div><div className={styles.aiThree}>{[['能耗变化','本期能源消费总量同比上升2.3%，主要增量来自生产单元A，建议持续跟踪其用能变化。'],['成本变化','煤炭为主要成本来源，占57.6%；电力成本占比21.6%，建议关注煤炭及电力价格变化。'],['优化方向','建议关注高耗能单元的用能变化与成本结构，持续跟踪能效指标，挖掘优化空间。']].map(([title, text], index) => <article key={title}><h3><i>{index + 1}</i>{title}</h3><p>{text}</p></article>)}</div></section>
  </Page>;
}

function EnergyDonut() {
  const data = [['#3B82F6','煤炭','7,692 tce','61.2%'],['#35B99A','外购电力','3,546 tce','28.2%'],['#FF9D24','替代燃料','1,734 tce','13.8%'],['#7D61E8','天然气','226 tce','1.8%'],['#9BA7B6','其他','100 tce','0.8%']];
  return <div className={styles.donutLayout}><div className={styles.donut}><div>12,580<small>tce</small></div></div><div className={styles.legend}>{data.map(([color, name, value, share]) => <div key={name}><i style={{ background: color }} /><span>{name}</span><b>{value}</b><em>{share}</em></div>)}</div></div>;
}

function CostBars() {
  const rows = [['煤炭','6,240 万元','57.6%',100,'#2878FF'],['外购电力','2,340 万元','21.6%',55,'#14AA72'],['替代燃料','1,260 万元','11.6%',29,'#FF8A00'],['天然气','488 万元','4.5%',10,'#7657F6'],['其他','209 万元','1.9%',3,'#8D98A8']] as const;
  return <div className={styles.costBars}>{rows.map(([name, value, share, width, color], index) => <div key={name}><i style={{ background: color }}>{index + 1}</i><span>{name}</span><b><em style={{ width: `${width}%`, background: color }} /></b><strong>{value}</strong><small>{share}</small></div>)}</div>;
}

function BudgetPage() {
  const { toast, notify } = useFeedback();
  const [budgetType, setBudgetType] = useState<BudgetType>('energy');
  const [scope, setScope] = useState('全企业');
  const [appliedScope, setAppliedScope] = useState('全企业');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const target = getBudgetTarget(budgetType)?.targetValue ?? (budgetType === 'energy' ? 120600 : 95000);
  const baseRows = budgetRows[budgetType].map((row, index) => index === 0 ? [row[0], target, row[2], row[3]] as const : row);
  const rows = appliedScope === '全企业' ? baseRows : baseRows.filter((row) => row[0] === appliedScope);
  const current = budgetType === 'energy' ? 65000 : 51200;
  const forecast = budgetType === 'energy' ? 125600 : 99500;
  const unit = budgetType === 'energy' ? 'tce' : 'tCO₂';
  void version;
  return <Page toast={toast}>
    <div className={styles.pageActions}><Button primary onClick={() => setOverlay({ kind: 'budget', type: budgetType })}>目标预算配置</Button></div>
    <CommonFilters cycle scope={scope} setScope={setScope} onQuery={() => { setAppliedScope(scope); notify('查询条件已更新'); }} onReset={() => { setScope('全企业'); setAppliedScope('全企业'); notify('已重置查询条件'); }} />
    <section className={`${styles.card} ${styles.budgetCard}`}>
      <div className={styles.budgetTabs}><button type="button" className={budgetType === 'energy' ? styles.activeBudget : ''} onClick={() => setBudgetType('energy')}>能源预算管理</button><button type="button" className={budgetType === 'carbon' ? styles.activeBudget : ''} onClick={() => setBudgetType('carbon')}>碳排放预算管理</button></div>
      <div className={styles.budgetSummary}>{[['年度目标',target],['当前累计',current],['预计全年',forecast],['预测偏差',forecast-target]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong className={label === '预测偏差' ? styles.up : ''}>{label === '预测偏差' && Number(value) >= 0 ? '+' : ''}{format(Number(value))} {unit}{label === '预测偏差' && <small>（{((Number(value) / target) * 100).toFixed(1)}%）</small>}</strong></div>)}<div><span>预算执行状态</span><strong><Tag tone="red">超预算风险</Tag></strong><small>消耗进度高于时间进度</small></div></div>
      <div className={styles.linePanel}><div className={styles.chartHead}><h2>年度预算累计趋势 <small>（单位：{unit}）</small></h2><Button primary onClick={() => notify('已根据最新数据重新预测')}>↻ 重新预测</Button></div><BudgetLine type={budgetType} target={target} /></div>
      <div className={styles.execution}><h2>预算执行分析</h2><div className={styles.tableWrap}><table><thead><tr><th>管理对象</th><th>年度目标（{unit}）</th><th>当前累计（{unit}）</th><th>预计全年（{unit}）</th><th>偏差（{unit}）</th><th>偏差（%）</th><th>状态</th></tr></thead><tbody>{rows.map((row) => { const diff = row[3] - row[1]; const rate = diff / row[1] * 100; const state = diff <= 0 ? '正常' : row[0] === '全企业' ? '超预算风险' : '关注'; return <tr key={row[0]} onClick={() => setOverlay({ kind: 'budgetDetail', row, type: budgetType })}><td>{row[0]}</td><td>{format(row[1])}</td><td>{format(row[2])}</td><td>{format(row[3])}</td><td className={diff > 0 ? styles.up : styles.down}>{diff > 0 ? '+' : ''}{format(diff)}</td><td className={rate > 0 ? styles.up : styles.down}>{rate > 0 ? '+' : ''}{rate.toFixed(1)}%</td><td><Status value={state} /></td></tr>; })}</tbody></table></div></div>
      <BudgetAi type={budgetType} onExport={() => notify('报告已导出')} />
    </section>
    {overlay?.kind === 'budget' && <BudgetDialog type={overlay.type} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setVersion((value) => value + 1); notify('目标预算配置已保存'); }} />}
    {overlay?.kind === 'budgetDetail' && <BudgetDetailDrawer row={overlay.row} type={overlay.type} onClose={() => setOverlay(null)} onAdjust={() => setOverlay({ kind: 'budget', type: overlay.type })} />}
  </Page>;
}

function BudgetLine({ type, target }: { type: BudgetType; target: number }) {
  const actual = type === 'energy' ? [20000,31000,41000,50000,59000,65000] : [12000,21000,29000,36000,44000,51200];
  const forecast = type === 'energy' ? [65000,78000,88000,98000,108000,118000,130000] : [51200,61000,71000,80000,89000,99500,108000];
  const max = type === 'energy' ? 160000 : 120000;
  const point = (value: number, index: number, start = 0) => `${60 + (915 * (start + index) / 11)},${25 + 200 * (1 - value / max)}`;
  const ty = 25 + 200 * (1 - target / max);
  return <div className={styles.lineChart}><svg viewBox="0 0 1000 260" preserveAspectRatio="none"><g className={styles.chartGrid}>{[25,75,125,175,225].map((y) => <line key={y} x1="60" x2="975" y1={y} y2={y} />)}</g><line x1="60" x2="975" y1={ty} y2={ty} className={styles.targetLine} /><polyline points={actual.map((value, index) => point(value,index)).join(' ')} className={styles.actualLine} /><polyline points={forecast.map((value, index) => point(value,index,5)).join(' ')} className={styles.forecastLine} />{actual.map((value,index) => { const [x,y] = point(value,index).split(','); return <circle key={index} cx={x} cy={y} r="4" className={styles.actualDot} />; })}{forecast.map((value,index) => { const [x,y] = point(value,index,5).split(','); return <circle key={index} cx={x} cy={y} r="4" className={styles.forecastDot} />; })}{months.map((month,index) => <text key={month} x={60 + 915 * index / 11} y="250" textAnchor="middle">{month}</text>)}<g className={styles.chartLegend}><line x1="390" x2="420" y1="12" y2="12" className={styles.actualLine} /><text x="427" y="16">实际累计值</text><line x1="510" x2="540" y1="12" y2="12" className={styles.forecastLine} /><text x="547" y="16">预测累计值</text><line x1="630" x2="660" y1="12" y2="12" className={styles.targetLine} /><text x="667" y="16">年度目标线</text></g></svg></div>;
}

function BudgetAi({ type, onExport }: { type: BudgetType; onExport: () => void }) {
  return <div className={styles.budgetAi}><div className={styles.aiHead}><h2>AI分析建议</h2><button type="button" className={styles.link} onClick={onExport}>⇩ 导出报告</button></div><div className={styles.aiThree}>{[['风险识别',type === 'carbon' ? '预计全年碳排放将超过年度目标，存在碳排放预算超标风险。' : '生产单元A和公辅系统是导致超预算的主要来源，需重点关注其能耗增长风险。'],['偏差原因','当前累计进度高于时间进度，主要受生产负荷提升及部分设备能效波动影响。'],['调整建议','建议聚焦高耗能单元，优化运行策略，调整后续月份预算计划，控制全年目标偏差。']].map(([title,text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></div>;
}

function BudgetDialog({ type, onClose, onSaved }: { type: BudgetType; onClose: () => void; onSaved: () => void }) {
  const current = getBudgetTarget(type);
  const [target, setTarget] = useState(String(current?.targetValue ?? (type === 'energy' ? 120600 : 95000)));
  const [method, setMethod] = useState('按历史趋势分解');
  const [description, setDescription] = useState('');
  return <Modal title="目标预算配置" width={620} onClose={onClose} onSubmit={() => {
    saveBudgetTarget({
      budgetTargetId: current?.budgetTargetId ?? `bt-${type}-2026`,
      budgetType: type,
      organizationId: DEMO_ORGANIZATION_ID,
      energyUnitId: null,
      year: 2026,
      targetValue: Number(target),
      warningThreshold: 0.95,
      targetUnit: type === 'energy' ? 'tce' : 'tCO₂e',
      description: type === 'energy' ? '年度能源消费预算' : '年度碳排放预算',
      version: current?.version ?? 1,
      versionState: '生效',
      forecastMethod: method === '按历史趋势分解' ? 'recentAverage' : 'categoryProjection',
      adjustmentReason: description,
    });
    onSaved();
  }}><div className={styles.formGrid}><Field label="预算年度" required><select><option>2026年</option></select></Field><Field label="管理范围" required><select><option>全企业</option><option>生产单元A</option></select></Field><Field label="预算类型" required><select value={type === 'energy' ? '能源消费预算' : '碳排放预算'} disabled><option>{type === 'energy' ? '能源消费预算' : '碳排放预算'}</option></select></Field><Field label="年度目标" required><input aria-label="年度目标" required type="number" min="0" value={target} onChange={(event) => setTarget(event.target.value)} /></Field><Field label="目标单位" required><input value={type === 'energy' ? 'tce' : 'tCO₂'} readOnly /></Field><Field label="分解方式" required><select value={method} onChange={(event) => setMethod(event.target.value)}><option>按历史趋势分解</option><option>月度平均分解</option><option>自定义分解</option></select></Field><div className={styles.full}><Field label="调整说明"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="填写预算制定或调整说明" /></Field></div></div></Modal>;
}

function BudgetDetailDrawer({ row, type, onClose, onAdjust }: { row: readonly [string, number, number, number]; type: BudgetType; onClose: () => void; onAdjust: () => void }) {
  const unit = type === 'energy' ? 'tce' : 'tCO₂';
  return <Drawer title={`${row[0]}｜预算执行详情`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onAdjust}>调整预算</Button></>}><h3 className={styles.detailTitle}>执行概览</h3><DetailGrid values={[['年度目标', `${format(row[1])} ${unit}`],['当前累计',`${format(row[2])} ${unit}`],['预计全年',`${format(row[3])} ${unit}`],['预测偏差',`${row[3]-row[1] > 0 ? '+' : ''}${format(row[3]-row[1])} ${unit}`]]} /><h3 className={styles.detailTitle}>偏差说明</h3><p className={styles.detailText}>当前累计消耗进度高于时间进度，预计全年存在超目标风险。建议结合后续生产计划调整月度预算。</p></Drawer>;
}

function CarbonAssetsPage() {
  const { toast, notify } = useFeedback();
  const [scope, setScope] = useState('全企业');
  const [cycle, setCycle] = useState('2026年度');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [estimate, setEstimate] = useState({ baseline: 98500, result: 96000, change: 1.1 });
  const assets = listCarbonAssets(cycle);
  const quota = assets.find((asset) => asset.assetType === '碳配额');
  const ccer = assets.filter((asset) => asset.assetType === 'CCER').reduce((sum, asset) => sum + asset.totalAmount - asset.usedAmount - asset.lockedAmount, 0);
  const allocated = quota?.totalAmount ?? 95000;
  const used = quota?.usedAmount ?? 56000;
  const available = Math.max(0, allocated - used) + ccer;
  const forecast = 105000;
  const gap = Math.max(0, forecast - used - available);
  void version;
  return <Page toast={toast}>
    <div className={styles.pageActions}><Button primary onClick={() => setOverlay({ kind: 'asset' })}>录入碳资产</Button><Button onClick={() => setOverlay({ kind: 'estimate' })}>新周期配额测算</Button></div>
    <section className={`${styles.card} ${styles.filters}`}><Field label="履约周期"><select value={cycle} onChange={(event) => setCycle(event.target.value)}><option>2026年度</option><option>2025年度</option></select></Field><Field label="统计范围"><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((value) => <option key={value}>{value}</option>)}</select></Field><div className={styles.filterSpacer} /><Button primary onClick={() => notify('查询条件已更新')}>查询</Button><Button onClick={() => { setCycle('2026年度'); setScope('全企业'); notify('已重置查询条件'); }}>重置</Button></section>
    <section className={`${styles.card} ${styles.assetOverview}`}><h2>当前履约状态</h2><div className={styles.assetKpis}><AssetKpi label="已分配配额" value={allocated} tone="blue" /><AssetKpi label="已使用配额" value={used} /><AssetKpi label="CCER可用量" value={ccer} tone="purple" /><AssetKpi label="预计全年排放" value={forecast} tone="orange" /><AssetKpi label="预计缺口" value={gap} tone="red" /></div><div className={styles.assetProgress}><b>配额与预计排放对比</b><div><i style={{ width: '53.3%' }} /><i style={{ width: '41.9%' }} /><i style={{ width: '4.8%' }} /></div><span><em className={styles.dotGreen} />已使用配额　{format(used)} tCO₂（53.3%）　<em className={styles.dotBlue} />剩余可用资产　{format(available)} tCO₂（41.9%）　<em className={styles.dotRed} />预计缺口　{format(gap)} tCO₂（4.8%）</span></div></section>
    <div className={styles.assetGrid}><section className={`${styles.card} ${styles.tableCard}`}><h2>碳资产台账</h2><div className={styles.tableWrap}><table className={styles.assetTable}><thead><tr><th>资产类型</th><th>履约周期</th><th>来源</th><th>数量(tCO₂)</th><th>已使用(tCO₂)</th><th>剩余量(tCO₂)</th><th>操作</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.carbonAssetId}><td>{asset.assetType}</td><td>{asset.complianceCycle}</td><td>{asset.assetSource}</td><td>{format(asset.totalAmount)}</td><td>{format(asset.usedAmount)}</td><td>{format(asset.totalAmount - asset.usedAmount - asset.lockedAmount)}</td><td><button type="button" className={styles.link} onClick={() => setOverlay({ kind: 'assetDetail', asset })}>{asset.assetType === '绿证折算减排量' ? '待确认详情' : '编辑　查看凭证'}</button></td></tr>)}</tbody></table></div></section><section className={`${styles.card} ${styles.linePanel}`}><h2>履约缺口趋势</h2><AssetLine /></section></div>
    <section className={`${styles.card} ${styles.newCycle}`}><h2>新周期配额测算</h2><div className={styles.cycleGrid}><div><span>基准历史排放</span><strong>{format(estimate.baseline)} <small>tCO₂</small></strong></div><div><span>初步测算配额</span><strong>{format(estimate.result)} <small>tCO₂</small></strong></div><div><span>较本周期变化</span><strong className={styles.blueText}>+{estimate.change}%</strong></div><button type="button" className={styles.cycleLink} onClick={() => setOverlay({ kind: 'estimate' })}>查看测算说明 ＞</button></div></section>
    <AssetAi onExport={() => notify('报告已导出')} />
    {overlay?.kind === 'asset' && <AssetDialog asset={overlay.asset} onClose={() => setOverlay(null)} onSaved={() => { setOverlay(null); setVersion((value) => value + 1); notify('碳资产已保存'); }} />}
    {overlay?.kind === 'assetDetail' && <AssetDrawer asset={overlay.asset} onClose={() => setOverlay(null)} onEdit={() => setOverlay({ kind: 'asset', asset: overlay.asset })} />}
    {overlay?.kind === 'estimate' && <EstimateDialog estimate={estimate} onClose={() => setOverlay(null)} onSaved={(value) => { setEstimate(value); setOverlay(null); notify('新周期配额测算已保存'); }} />}
  </Page>;
}

function AssetKpi({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return <div className={`${styles.assetKpi} ${styles[tone] ?? ''}`}><span>{label}</span><strong>{format(value)}<small>tCO₂</small></strong></div>;
}

function AssetLine() {
  const actual = [12000,25000,34000,44000,53000,62000];
  const forecast = [62000,75000,88000,103000,118000,135000];
  const max = 150000;
  const point = (value: number, index: number, start = 0) => `${48 + 532 * (start + index) / 11},${28 + 162 * (1 - value / max)}`;
  const targetY = 28 + 162 * (1 - 100000 / max);
  return <div className={styles.assetLine}><svg viewBox="0 0 600 220" preserveAspectRatio="none"><g className={styles.chartGrid}>{[28,82,136,190].map((y) => <line key={y} x1="48" x2="580" y1={y} y2={y} />)}</g><line x1="48" x2="580" y1={targetY} y2={targetY} className={styles.assetTarget} /><polyline points={actual.map((value,index) => point(value,index)).join(' ')} className={styles.actualLine} /><polyline points={forecast.map((value,index) => point(value,index,5)).join(' ')} className={styles.forecastLine} />{months.map((month,index) => <text key={month} x={48 + 532 * index / 11} y="212" textAnchor="middle">{month}</text>)}<g className={styles.chartLegend}><line x1="130" x2="155" y1="12" y2="12" className={styles.actualLine} /><text x="161" y="16">实际累计排放</text><line x1="255" x2="280" y1="12" y2="12" className={styles.forecastLine} /><text x="286" y="16">预测累计排放</text><line x1="408" x2="433" y1="12" y2="12" className={styles.assetTarget} /><text x="439" y="16">年度可用资产上限</text></g></svg></div>;
}

function AssetAi({ onExport }: { onExport: () => void }) {
  return <section className={`${styles.card} ${styles.aiCard}`}><div className={styles.aiHead}><h2>AI分析建议</h2><button type="button" className={styles.link} onClick={onExport}>⇩ 导出报告</button></div><div className={styles.aiThree}>{[['风险识别','预计全年排放将超过当前可用资产上限，存在履约缺口风险。'],['原因分析','生产单元A与公辅系统排放增长较快，是缺口形成的主要来源。'],['管理建议','建议提前评估配额补充或CCER采购方案，并持续跟踪月度排放进度。']].map(([title,text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>;
}

function AssetDialog({ asset, onClose, onSaved }: { asset?: CarbonAsset; onClose: () => void; onSaved: () => void }) {
  const [assetType, setAssetType] = useState<CarbonAssetType>(asset?.assetType ?? '碳配额');
  const [source, setSource] = useState(asset?.assetSource ?? '政府分配');
  const [amount, setAmount] = useState(String(asset?.totalAmount ?? ''));
  const [remark, setRemark] = useState(asset?.remark ?? '');
  const [error, setError] = useState('');
  return <Modal title={asset ? '编辑碳资产' : '录入碳资产'} width={620} onClose={onClose} onSubmit={() => {
    if (!(Number(amount) > 0)) return setError('请输入有效的资产数量。');
    const used = asset?.usedAmount ?? 0;
    const locked = asset?.lockedAmount ?? 0;
    const eligible = assetType === '绿证折算减排量' ? 0 : Math.max(0, Number(amount) - used - locked);
    const result = saveCarbonAsset({ complianceCycle: '2026年度', assetType, assetSource: source, totalAmount: Number(amount), eligibleAmount: eligible, lockedAmount: locked, usedAmount: used, voucherNumber: asset?.voucherNumber ?? `MOCK-${Date.now()}`, bookedAt: asset?.bookedAt ?? '2026-07-28', remark }, asset?.carbonAssetId);
    if (!result.ok) return setError(result.error);
    onSaved();
  }}><div className={styles.formGrid}><Field label="资产类型" required><select value={assetType} onChange={(event) => setAssetType(event.target.value as CarbonAssetType)}><option>碳配额</option><option>CCER</option><option>绿证折算减排量</option></select></Field><Field label="履约周期" required><select><option>2026年度</option></select></Field><Field label="资产来源" required><select value={source} onChange={(event) => setSource(event.target.value)}><option>政府分配</option><option>市场购买</option><option>内部转化</option></select></Field><Field label="资产数量（tCO₂）" required><input aria-label="资产数量（tCO₂）" required type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="请输入数量" /></Field><div className={styles.full}><Field label="凭证材料"><input type="file" /><span className={styles.hint}>支持PDF、图片等格式，单个文件不超过20MB。</span></Field></div><div className={styles.full}><Field label="备注"><textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="填写资产来源或使用限制说明" /></Field></div>{error && <div className={`${styles.error} ${styles.full}`}>{error}</div>}</div></Modal>;
}

function EstimateDialog({ estimate, onClose, onSaved }: { estimate: { baseline: number; result: number; change: number }; onClose: () => void; onSaved: (value: { baseline: number; result: number; change: number }) => void }) {
  const [baseline, setBaseline] = useState(String(estimate.baseline));
  const [change, setChange] = useState(String(estimate.change));
  const [result, setResult] = useState(String(estimate.result));
  return <Modal title="新周期配额测算" width={620} submitText="保存测算" onClose={onClose} onSubmit={() => onSaved({ baseline: Number(baseline), change: Number(change), result: Number(result) })}><div className={styles.formGrid}><Field label="测算周期" required><select><option>2027年度</option></select></Field><Field label="测算范围" required><select><option>全企业</option></select></Field><Field label="基准历史排放" required><input aria-label="基准历史排放" type="number" value={baseline} onChange={(event) => setBaseline(event.target.value)} /></Field><Field label="预计产能变化" required><div className={styles.suffixInput}><input aria-label="预计产能变化" type="number" value={change} onChange={(event) => setChange(event.target.value)} /><span>%</span></div></Field><Field label="测算方法" required><select><option>历史排放与业务增长综合测算</option></select></Field><Field label="初步测算结果"><input aria-label="初步测算结果" type="number" value={result} onChange={(event) => setResult(event.target.value)} /></Field><div className={`${styles.formula} ${styles.full}`}>测算结果仅用于企业内部规划，不代表主管部门最终分配结果。</div></div></Modal>;
}

function AssetDrawer({ asset, onClose, onEdit }: { asset: CarbonAsset; onClose: () => void; onEdit: () => void }) {
  return <Drawer title={`${asset.assetType}｜资产详情`} width={500} onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button primary onClick={onEdit}>编辑资产</Button></>}><h3 className={styles.detailTitle}>资产信息</h3><DetailGrid values={[['资产类型',asset.assetType],['履约周期',asset.complianceCycle],['资产来源',asset.assetSource],['剩余数量',`${format(asset.totalAmount-asset.usedAmount-asset.lockedAmount)} tCO₂`]]} /><h3 className={styles.detailTitle}>凭证材料</h3><div className={styles.voucher}><span>文件名称</span><b>{asset.voucherNumber || `2026年度_${asset.assetType}_凭证.pdf`}</b></div><h3 className={styles.detailTitle}>使用记录</h3><div className={styles.tableWrap}><table><thead><tr><th>日期</th><th>用途</th><th>使用量</th></tr></thead><tbody><tr><td>2026-06-30</td><td>履约预占用</td><td>{format(asset.usedAmount)} tCO₂</td></tr></tbody></table></div></Drawer>;
}

function DetailGrid({ values }: { values: [string, string][] }) {
  return <div className={styles.detailGrid}>{values.map(([label,value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}
