import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import styles from './ProductCarbonFootprint.module.css';

type Project = { id: number; name: string; category: string; unit: string; boundary: string; year: string; footprint: number; updated: string; status: '已完成' | '数据待完善' };

const initialProjects: Project[] = [
  { id: 1, name: '工业变频器 VFD-75', category: '机械设备', unit: '1 台产品', boundary: '摇篮到大门', year: '2026', footprint: 86.4, updated: '2026-09-14 16:20', status: '已完成' },
  { id: 2, name: '铝合金型材 6063', category: '金属制品', unit: '1 t 产品', boundary: '摇篮到大门', year: '2026', footprint: 1240.8, updated: '2026-09-12 14:30', status: '已完成' },
  { id: 3, name: '电子控制器 EC-20', category: '电子电器', unit: '1 件产品', boundary: '摇篮到大门', year: '2026', footprint: 42.8, updated: '2026-09-10 09:10', status: '已完成' },
  { id: 4, name: '环保包装箱 E-50', category: '包装制品', unit: '1 个产品', boundary: '摇篮到大门', year: '2026', footprint: 0, updated: '2026-09-08 11:45', status: '数据待完善' },
];

const resultStages = [{ label: '原材料获取', value: 187.55, color: '#4d87da' }, { label: '生产制造', value: 54.62, color: '#24a8b5' }, { label: '分销与运输', value: 4.22, color: '#68bd69' }];
const resultActivities = [
  ['原材料获取', '主要原材料A', '58.00 kg/功能单位', '2.150 kgCO₂e/kg', '供应商特定因子', '124.70'],
  ['原材料获取', '主要原材料B', '12.00 kg/功能单位', '4.320 kgCO₂e/kg', 'CPCD', '51.84'],
  ['原材料获取', '辅助材料', '3.50 kg/功能单位', '1.860 kgCO₂e/kg', 'CPCD', '6.51'],
  ['原材料获取', '原材料入厂运输', '46.00 t·km/功能单位', '0.0978 kgCO₂e/(t·km)', 'CPCD', '4.50'],
  ['生产制造', '外购电力', '82.00 kWh/功能单位', '0.5306 kgCO₂e/kWh', '国家电力因子', '43.51'],
  ['生产制造', '天然气燃烧', '4.20 Nm³/功能单位', '2.162 kgCO₂e/Nm³', '国家因子库', '9.08'],
  ['生产制造', '工艺过程排放', '1.00 功能单位', '0.850 kgCO₂e/功能单位', '企业特定数据', '0.85'],
  ['生产制造', '生产废弃物处理', '2.80 kg/功能单位', '0.420 kgCO₂e/kg', 'CPCD', '1.18'],
  ['分销与运输', '成品公路运输', '35.00 t·km/功能单位', '0.0978 kgCO₂e/(t·km)', 'CPCD', '3.42'],
  ['分销与运输', '成品仓储用电', '1.50 kWh/功能单位', '0.5306 kgCO₂e/kWh', '国家电力因子', '0.80'],
];
const factorRows = [
  { id: 'factor-steel', name: '电工钢', category: '原辅材料', value: '2.150', unit: 'kgCO₂e/kg', region: '中国', year: '示例', source: '供应商/数据库' },
  { id: 'factor-aluminum', name: '铝材', category: '原辅材料', value: '4.320', unit: 'kgCO₂e/kg', region: '中国', year: '示例', source: 'CPCD' },
  { id: 'factor-electricity', name: '外购电力', category: '能源与燃料', value: '0.5306', unit: 'kgCO₂e/kWh', region: '全国', year: '2024', source: '国家因子库' },
  { id: 'factor-gas', name: '天然气燃烧', category: '能源与燃料', value: '2.162', unit: 'kgCO₂e/Nm³', region: '中国', year: '示例', source: '国家因子库' },
  { id: 'factor-transport', name: '重型柴油货车运输', category: '运输', value: '0.0978', unit: 'kgCO₂e/(t·km)', region: '中国', year: '示例', source: 'CPCD' },
  { id: 'factor-waste', name: '一般工业固废处理', category: '废弃物处理', value: '0.120', unit: 'kgCO₂e/kg', region: '中国', year: '示例', source: 'CPCD' },
];

export function ProductCarbonFootprint({ pathname }: { pathname: string }) {
  const [projects, setProjects] = useState(initialProjects);
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const navigate = useNavigate();
  const page = pathname.split('/').pop() ?? 'projects';
  const filtered = useMemo(() => projects.filter((item) => item.name.includes(keyword) || item.category.includes(keyword)), [projects, keyword]);
  usePageHeaderActions(useMemo(() => page === 'projects' ? <button className={styles.primary} onClick={() => setModal(true)}>＋ 新建碳足迹项目</button> : page === 'factors' ? <button className={styles.primary}>＋ 新增因子</button> : undefined, [page]));
  const addProject = () => { setProjects((items) => [{ id: Date.now(), name: '新建产品碳足迹项目', category: '待完善', unit: '1 件产品', boundary: '摇篮到大门', year: '2026', footprint: 0, updated: '刚刚', status: '数据待完善' }, ...items]); setModal(false); };

  if (page === 'data') return <DataPage />;
  if (page === 'results') return <ResultsPage />;
  if (page === 'reports') return <ReportsPage />;
  if (page === 'factors') return <FactorsPage />;
  if (currentProject) return <ProjectDetail project={currentProject} onBack={() => setCurrentProject(null)} />;
  return <div className={styles.page}>
    <div className={styles.notice}><b>通用版 V1：</b>先确定产品与核算范围，再按生命周期阶段维护原辅材料、能源、运输、工艺排放和废弃物等活动数据。</div>
    <div className={styles.filters}><label>产品名称<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入产品名称" /></label><label>产品类别<select><option>全部类别</option><option>机械设备</option><option>金属制品</option><option>电子电器</option></select></label><label>核算年度<select><option>2026 年度</option><option>2025 年度</option></select></label><button className={styles.primary}>查询</button><button className={styles.button} onClick={() => setKeyword('')}>重置</button></div>
    <section className={styles.card}><div className={styles.cardHead}><b>产品碳足迹项目列表</b><span>共 {filtered.length} 个项目</span></div><div className={styles.tableWrap}><table><thead><tr>{['序号', '产品名称', '产品类别', '功能单位', '系统边界', '核算年度', '产品碳足迹', '更新时间', '状态', '操作'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><button className={styles.projectLink} onClick={() => setCurrentProject(item)}>{item.name}</button></td><td>{item.category}</td><td>{item.unit}</td><td>{item.boundary}</td><td>{item.year}</td><td>{item.footprint ? <strong className={styles.footprint}>{item.footprint} <small>kgCO₂e/功能单位</small></strong> : '—'}</td><td>{item.updated}</td><td><span className={item.status === '已完成' ? styles.success : styles.warning}>{item.status}</span></td><td><button className={styles.text} onClick={() => setCurrentProject(item)}>查看项目</button><button className={styles.text} onClick={() => navigate('/product-carbon-footprint/data')}>维护数据</button></td></tr>)}</tbody></table></div><div className={styles.pager}>共 {filtered.length} 条 <span>10 条/页 &lt; <b>1</b> &gt;</span></div></section>
    {modal && <ProjectModal onClose={() => setModal(false)} onSubmit={addProject} />}
  </div>;
}

function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
  const [tab, setTab] = useState<'lifecycle' | 'data' | 'result' | 'report'>('lifecycle');
  const labels = { lifecycle: '生命周期模型', data: '数据管理', result: '核算结果', report: '报告' };
  return <div className={styles.page}><button className={styles.back} onClick={onBack}>‹ 返回项目管理</button><section className={styles.projectHeader}><div><h2>{project.name} 碳足迹项目</h2><div className={styles.projectMeta}><span>产品类别<b>{project.category}</b></span><span>功能单位<b>{project.unit}</b></span><span>系统边界<b>{project.boundary}</b></span><span>核算年度<b>{project.year}</b></span></div></div><button className={styles.button}>编辑项目</button></section><div className={styles.projectTabs}>{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <button key={key} className={tab === key ? styles.projectTabActive : ''} onClick={() => setTab(key)}>{labels[key]}</button>)}</div>{tab === 'lifecycle' && <LifecycleTab />}{tab === 'data' && <section className={styles.card}><div className={styles.cardHead}><b>项目活动数据</b><button className={styles.primary}>＋ 新增活动数据</button></div><ActivityTable /></section>}{tab === 'result' && <ResultsPage />}{tab === 'report' && <ProjectReport project={project} />}</div>;
}
function LifecycleTab() { return <><div className={styles.notice}>当前系统边界内的生命周期阶段均可维护活动数据；未选择的阶段不会参与本项目的核算结果。</div><div className={styles.lifecycleFlow}>{[['01', '原材料获取', '原辅材料及上游供应链数据'], ['02', '生产制造', '能源消耗、工艺排放与产出数据'], ['03', '运输配送', '运输方式、距离及装载率'], ['04', '废弃物处理', '废弃物类型、数量与处置方式']].map(([number, title, detail]) => <section className={styles.lifecycleStage} key={title}><div><span>{number}</span><b>{title}</b></div><p>{detail}</p><ul><li>✓ 已维护活动数据</li><li>✓ 已选择排放因子</li></ul><button className={styles.text}>维护该阶段数据 →</button></section>)}</div></>; }
function ProjectReport({ project }: { project: Project }) { return <><div className={styles.notice}>报告将自动汇集产品信息、功能单位、系统边界、数据来源、因子来源与核算结果；适用 PCR 或行业标准可按项目选择。</div><section className={styles.card}><div className={styles.cardHead}><b>{project.name} 产品碳足迹报告</b><div><button className={styles.button}>预览报告</button> <button className={styles.primary}>⇩ 下载报告</button></div></div><div className={styles.reportReady}><span>✓</span><div><b>报告已具备生成条件</b><p>最近核算：2026-09-14 16:20 | 报告格式：产品碳足迹量化报告</p></div></div></section></>; }

function DataPage() { return <div className={styles.page}><div className={styles.notice}>活动数据按生命周期阶段统一维护；系统根据活动数据、排放因子与分配规则自动汇总至产品碳足迹结果。</div><div className={styles.stageGrid}>{['原材料获取', '生产制造', '运输配送', '废弃物处理'].map((stage, i) => <section className={styles.stageCard} key={stage}><span>{`0${i + 1}`}</span><b>{stage}</b><p>{i === 0 ? '原辅材料及上游供应链数据' : i === 1 ? '能源消耗、工艺排放与产出数据' : i === 2 ? '运输方式、距离及装载率' : '废弃物类型、数量与处置方式'}</p><button className={styles.text}>维护活动数据 →</button></section>)}</div><section className={styles.card}><div className={styles.cardHead}><b>工业变频器 VFD-75 · 活动数据</b><button className={styles.primary}>＋ 新增活动数据</button></div><ActivityTable /></section></div>; }
function ActivityTable() { return <div className={styles.tableWrap}><table><thead><tr>{['生命周期阶段', '排放活动', '活动数据', '单位', '排放因子', '因子来源', '排放量（kgCO₂e）', '操作'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{[['原材料获取', '热轧钢卷', '36.2', 'kg', '1.82', '供应商报告', '65.88'], ['生产制造', '外购电力', '25.6', 'kWh', '0.5703', '全国电力因子', '14.60'], ['运输配送', '公路运输', '42.0', 't·km', '0.108', 'IPCC 2006', '4.54']].map((row) => <tr key={row[1]}>{row.map((cell) => <td key={cell}>{cell}</td>)}<td><button className={styles.text}>编辑</button></td></tr>)}</tbody></table></div>; }
function ResultsPage() {
  const total = 246.39;
  const topRows = resultActivities.slice().sort((a, b) => Number(b[5]) - Number(a[5])).slice(0, 5);
  return <div className={`${styles.page} ${styles.resultPage}`}>
    <div className={`${styles.filters} ${styles.resultFilters}`}><label>产品名称<select><option>工业产品 A-100（2026年度）</option><option>铝合金型材 6063（2026年度）</option></select></label><label>产品类别<select><option>全部类别</option><option>机械设备</option><option>金属制品</option></select></label><label>核算年度<select><option>2026年度</option><option>2025年度</option></select></label><button className={styles.primary}>查询</button><button className={styles.button}>重置</button></div>
    <div className={styles.resultSummary}><section className={`${styles.card} ${styles.bigNumber}`}><b>产品碳足迹</b><strong>{total.toFixed(2)}</strong><span>kgCO₂e/功能单位</span></section><section className={`${styles.card} ${styles.resultInfo}`}>{[['产品名称', '工业产品 A-100'], ['功能单位', '1 台产品'], ['产品规格', 'A-100 标准型'], ['系统边界', '原材料获取—生产制造—分销与运输'], ['核算期间', '2026年度'], ['核算依据', 'ISO 14067 / 适用PCR（如有）']].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</section></div>
    <div className={styles.resultCharts}><section className={`${styles.card} ${styles.chartCard}`}><h3>生命周期阶段贡献</h3><div className={styles.donutLayout}><div className={styles.donutWrap}><div className={styles.donut} /><div className={styles.donutCenter}><strong>{total.toFixed(2)}</strong><span>已核算 kgCO₂e</span></div></div><div className={styles.resultLegend}><div><i /><b>阶段</b><b>排放量</b><b>占比</b></div>{resultStages.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><span>{item.value.toFixed(2)}</span><span>{(item.value / total * 100).toFixed(2)}%</span></div>)}</div></div></section><section className={`${styles.card} ${styles.chartCard}`}><h3>主要排放来源（TOP5）</h3><div className={styles.resultBars}>{topRows.map((row) => <div key={row[1]}><span>{row[1]}</span><i><b style={{ width: `${Number(row[5]) / Number(topRows[0][5]) * 100}%` }} /></i><span>{Number(row[5]).toFixed(2)}</span><span>{(Number(row[5]) / total * 100).toFixed(2)}%</span></div>)}</div></section></div>
    <section className={`${styles.card} ${styles.resultTable}`}><h3>排放活动明细</h3><div className={styles.tableWrap}><table><thead><tr>{['生命周期阶段', '排放活动', '活动数据', '排放因子', '因子来源', '排放量(kgCO₂e/功能单位)', '占比'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{resultActivities.map((row) => <tr key={row[1]}>{row.map((cell) => <td key={cell}>{cell}</td>)}<td>{(Number(row[5]) / total * 100).toFixed(2)}%</td></tr>)}<tr className={styles.totalRow}><td>已核算合计</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{total.toFixed(2)}</td><td>100.00%</td></tr></tbody></table></div></section>
  </div>;
}
function ReportsPage() { return <div className={`${styles.page} ${styles.reportLayout}`}><section className={styles.card}><div className={styles.cardHead}><b>报告列表</b><button className={styles.primary}>＋ 生成报告</button></div>{['工业变频器 VFD-75 产品碳足迹报告', '铝合金型材 6063 产品碳足迹报告', '电子控制器 EC-20 产品碳足迹报告'].map((name, i) => <button className={`${styles.reportItem} ${i === 0 ? styles.selected : ''}`} key={name}><b>{name}</b><span>2026-09-{14 - i * 2} 已生成</span></button>)}</section><section className={styles.card}><div className={styles.cardHead}><b>报告预览</b><div><button className={styles.button}>重新生成</button> <button className={styles.primary}>⇩ 下载报告</button></div></div><article className={styles.paper}><div>ISO 14067 / 适用 PCR</div><h2>产品碳足迹报告</h2><p>报告编号：CFP-2026-VFD75-001</p><dl><dt>产品名称</dt><dd>工业变频器 VFD-75</dd><dt>功能单位</dt><dd>1 台产品</dd><dt>系统边界</dt><dd>摇篮到大门</dd><dt>核算期间</dt><dd>2026 年度</dd></dl><strong>86.4 <small>kgCO₂e/功能单位</small></strong></article></section></div>; }
function FactorsPage() {
  const [keyword, setKeyword] = useState(''); const [category, setCategory] = useState('全部因子'); const [view, setView] = useState<'category' | 'source'>('category'); const [selected, setSelected] = useState<(typeof factorRows)[number] | null>(null);
  const categories = view === 'category' ? ['全部因子', '原辅材料', '能源与燃料', '运输', '工艺过程排放', '废弃物处理'] : ['全部因子', 'CPCD', '国家因子库', '供应商/数据库'];
  const rows = factorRows.filter((item) => (category === '全部因子' || (view === 'category' ? item.category === category : item.source === category)) && item.name.includes(keyword));
  return <div className={`${styles.page} ${styles.factorLayout}`}>
    <aside className={`${styles.card} ${styles.factorSide}`}><div className={styles.factorTabs}><button className={view === 'category' ? styles.factorTabActive : ''} onClick={() => { setView('category'); setCategory('全部因子'); }}>按业务类别</button><button className={view === 'source' ? styles.factorTabActive : ''} onClick={() => { setView('source'); setCategory('全部因子'); }}>按来源</button></div><input placeholder="搜索分类" /><nav>{categories.map((item) => <button key={item} className={category === item ? styles.treeActive : ''} onClick={() => setCategory(item)}>▰ {item}</button>)}</nav></aside>
    <div><div className={`${styles.filters} ${styles.factorFilters}`}><label>因子名称<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入因子名称" /></label><label>适用区域<select><option>全部区域</option><option>中国</option></select></label><label>数据年份<select><option>全部年份</option><option>2024</option><option>2022</option></select></label><label>数据来源<select><option>全部来源</option><option>CPCD</option><option>国家因子库</option></select></label><button className={styles.primary}>查询</button><button className={styles.button} onClick={() => setKeyword('')}>重置</button></div><section className={styles.card}><div className={styles.tableWrap}><table className={styles.factorTable}><thead><tr>{['因子名称', '分类', '因子值', '因子单位', '区域', '年份', '来源', '操作'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.name}</b></td><td>{row.category}</td><td><strong className={styles.footprint}>{row.value}</strong></td><td>{row.unit}</td><td>{row.region}</td><td>{row.year}</td><td>{row.source}</td><td><button className={styles.factorDetailLink} onClick={() => setSelected(row)}>查看详情</button></td></tr>)}</tbody></table></div></section></div>
    {selected && <div className={styles.drawerMask} onMouseDown={() => setSelected(null)}><aside className={styles.factorDrawer} onMouseDown={(event) => event.stopPropagation()}><header><b>因子详情</b><button className={styles.button} onClick={() => setSelected(null)}>× 关闭</button></header><div><FactorDetail title="基本信息" rows={[["因子名称", selected.name], ["分类", selected.category], ["区域", selected.region], ["年份", selected.year]]} /><FactorDetail title="因子信息" rows={[["因子值", selected.value], ["因子单位", selected.unit], ["数据来源", selected.source]]} /></div></aside></div>}
  </div>;
}
function FactorDetail({ title, rows }: { title: string; rows: string[][] }) { return <section className={styles.detailCard}><b>{title}</b><div className={styles.detailGrid}>{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>; }
function ProjectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) { return <div className={styles.overlay} onMouseDown={onClose}><form className={styles.modal} onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><header><b>新建产品碳足迹项目</b><button type="button" onClick={onClose}>×</button></header><div><h3>产品信息</h3><div className={styles.formGrid}><label>产品名称<input required placeholder="请输入产品名称" /></label><label>产品类别<select><option>机械设备</option><option>金属制品</option><option>电子电器</option></select></label><label>功能单位<input defaultValue="1 件产品" /></label><label>核算年度<select><option>2026 年度</option><option>2025 年度</option></select></label></div><h3>核算范围</h3><label>系统边界<select><option>摇篮到大门（Cradle to Gate）</option><option>摇篮到坟墓（Cradle to Grave）</option></select></label></div><footer><button type="button" className={styles.button} onClick={onClose}>取消</button><button className={styles.primary}>创建项目</button></footer></form></div>; }
