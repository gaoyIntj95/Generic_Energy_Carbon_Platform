import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { FileDropzone } from '../../components/FileDropzone';
import { EVIDENCE_FILE_ACCEPT, filterEvidenceFiles } from '../../utils/evidenceFile';
import styles from './CarbonFootprintFactorLibrary.module.css';

type Library = 'public' | 'enterprise';

type Factor = {
  id: number;
  lib: Library;
  name: string;
  sourceCategory?: string;
  value: number;
  unit: string;
  region: string;
  year: string;
  source?: string;
  originalId?: string;
  tech?: string;
  dataType?: string;
  standardSource?: string;
  description: string;
  boundary?: string;
  stages?: Array<{ name: string; value: number }>;
  note?: string;
  attachments?: string[];
}

const publicCategories = [
  '核心数据库',
  '建筑和建筑服务',
  '金属制品、机械和设备',
  '经营行业服务',
  '矿石和矿物；电、气和水',
  '农业、林业和水产品',
  '其他可运输货物',
  '商业和生产服务',
  '社区、社会和个人服务',
  '食品、饮料和烟草；纺织、服装和皮革制品',
  '碳移除',
];

const seedFactors: Factor[] = [
  { id: 1, lib: 'public', name: '中华绒螯蟹-成蟹', sourceCategory: '核心数据库 > 食品与水产品', value: 11.746, unit: 'kgCO₂e / 千克产品', region: '中国江苏', year: '2022', source: 'CPCD', originalId: '04312X0012022C', tech: '全国平均', dataType: '核心数据', description: '中华绒螯蟹为典型水产品，本数据用于表征相关产品生命周期温室气体排放水平。', boundary: '生命周期包含原材料获取、生产和包装等阶段。', stages: [{ name: '原材料获取', value: 5.381 }, { name: '生产', value: 5.136 }, { name: '包装', value: 1.229 }], note: 'Mock 数据，字段结构参考 CPCD 原始记录。' },
  { id: 2, lib: 'public', name: '公共建筑施工服务', sourceCategory: '建筑和建筑服务 > 建筑施工服务', value: 286.4, unit: 'kgCO₂e / m²', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-BUILD-2024-001', tech: '行业平均', dataType: '行业数据', description: '用于表征典型公共建筑施工阶段单位建筑面积温室气体排放。', boundary: '包含主要建材生产、运输及现场施工过程。', stages: [{ name: '建筑材料', value: 212.3 }, { name: '运输', value: 28.6 }, { name: '现场施工', value: 45.5 }], note: 'Mock 数据，用于原型展示。' },
  { id: 3, lib: 'public', name: '热轧钢板', sourceCategory: '金属制品、机械和设备 > 钢铁产品', value: 2.31, unit: 'kgCO₂e / kg', region: '中国', year: '2024', source: 'CPCD', originalId: 'CPCD-METAL-2024-128', tech: '行业平均', dataType: '核心数据', description: '用于表征典型热轧钢板产品生命周期温室气体排放。', boundary: '包含原料获取、冶炼轧制及出厂前相关过程。', stages: [{ name: '原材料获取', value: 1.18 }, { name: '生产', value: 1.04 }, { name: '运输及其他', value: 0.09 }] },
  { id: 4, lib: 'public', name: '重型柴油货车运输', sourceCategory: '经营行业服务 > 运输服务 > 公路运输', value: 0.0978, unit: 'kgCO₂e / (t·km)', region: '中国', year: '2024', source: 'CPCD', originalId: 'CPCD-TRANS-2024-066', tech: '行业平均', dataType: '行业数据', description: '适用于典型重型柴油货车公路货运过程。', boundary: '包含运输车辆燃料消耗及相关上游过程。', stages: [{ name: '燃料上游', value: 0.0184 }, { name: '运输使用', value: 0.0794 }] },
  { id: 5, lib: 'public', name: '全国电网电力', sourceCategory: '矿石和矿物；电、气和水 > 电力', value: 0.5306, unit: 'kgCO₂e / kWh', region: '全国', year: '2022', source: 'CPCD', originalId: 'CPCD-ELEC-2022-001', tech: '全国平均', dataType: '核心数据', description: '用于表征全国平均电力消费相关温室气体排放。', boundary: '包含电力生产及相关上游过程。', stages: [{ name: '燃料获取', value: 0.0821 }, { name: '发电过程', value: 0.4304 }, { name: '输配损耗', value: 0.0181 }] },
  { id: 6, lib: 'public', name: '小麦（田间生产）', sourceCategory: '农业、林业和水产品 > 农业产品 > 谷物', value: 0.742, unit: 'kgCO₂e / kg', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-AGRI-2024-001', tech: '行业平均', dataType: '行业数据', description: '用于表征典型小麦田间生产过程的生命周期温室气体排放。', boundary: '包含种子、化肥、农机作业及田间直接排放。', stages: [{ name: '农业投入品', value: 0.214 }, { name: '田间排放', value: 0.403 }, { name: '农机作业', value: 0.125 }], note: 'Mock 数据，用于原型展示。' },
  { id: 7, lib: 'public', name: '瓦楞纸箱', sourceCategory: '其他可运输货物 > 纸和纸制品 > 包装材料', value: 0.681, unit: 'kgCO₂e / kg', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-GOODS-2024-001', tech: '行业平均', dataType: '行业数据', description: '用于表征典型瓦楞纸箱产品生命周期温室气体排放。', boundary: '包含原纸生产、纸箱加工及厂内能源使用。', stages: [{ name: '原纸生产', value: 0.491 }, { name: '纸箱加工', value: 0.146 }, { name: '其他', value: 0.044 }], note: 'Mock 数据，用于原型展示。' },
  { id: 8, lib: 'public', name: '工业设备维修服务', sourceCategory: '商业和生产服务 > 生产性服务 > 设备维修', value: 38.6, unit: 'kgCO₂e / 次', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-SERVICE-2024-001', tech: '行业平均', dataType: '服务数据', description: '用于表征一次典型工业设备维修服务相关温室气体排放。', boundary: '包含人员出行、备件使用及现场能源消耗。', stages: [{ name: '人员出行', value: 9.4 }, { name: '备件耗用', value: 23.8 }, { name: '现场能源', value: 5.4 }], note: 'Mock 数据，用于原型展示。' },
  { id: 9, lib: 'public', name: '城市生活垃圾收集服务', sourceCategory: '社区、社会和个人服务 > 环境卫生服务 > 垃圾收集', value: 0.031, unit: 'kgCO₂e / kg废弃物', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-COMMUNITY-2024-001', tech: '城市平均', dataType: '服务数据', description: '用于表征城市生活垃圾收集和短途转运服务的温室气体排放。', boundary: '包含收运车辆燃料消耗及作业能源使用。', stages: [{ name: '垃圾收集', value: 0.019 }, { name: '短途转运', value: 0.012 }], note: 'Mock 数据，用于原型展示。' },
  { id: 10, lib: 'public', name: 'PET瓶装饮用水', sourceCategory: '食品、饮料和烟草；纺织、服装和皮革制品 > 饮料 > 包装饮用水', value: 0.184, unit: 'kgCO₂e / L', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-FOOD-2024-001', tech: '行业平均', dataType: '核心数据', description: '用于表征典型 PET 瓶装饮用水生命周期温室气体排放。', boundary: '包含取水处理、PET包装、灌装及出厂前过程。', stages: [{ name: '水处理', value: 0.016 }, { name: '包装材料', value: 0.138 }, { name: '灌装生产', value: 0.030 }], note: 'Mock 数据，用于原型展示。' },
  { id: 11, lib: 'public', name: '造林碳移除', sourceCategory: '碳移除 > 林业碳汇 > 造林', value: -8.42, unit: 'kgCO₂e / 株·年', region: '中国', year: '2024', source: 'CPCD', originalId: 'MOCK-CDR-2024-001', tech: '示例情景', dataType: '碳移除数据', description: '用于原型展示的造林碳移除示例因子，负值表示从大气中移除温室气体。', boundary: '示例边界为林木生长阶段年度净碳吸收。', stages: [{ name: '生物量增长', value: -9.10 }, { name: '维护活动', value: 0.68 }], note: 'Mock 数据，仅用于页面交互演示。' },
  { id: 12, lib: 'enterprise', name: '电工钢（供应商A）', value: 2.15, unit: 'kgCO₂e / kg', region: '中国', year: '2026', source: '企业专属', standardSource: '供应商A产品碳足迹核算报告', description: '仅适用于供应商A指定牌号电工钢。', attachments: ['电工钢供应商检测报告.pdf'] },
  { id: 13, lib: 'enterprise', name: '园区绿电（2026）', value: 0.032, unit: 'kgCO₂e / kWh', region: '华东', year: '2026', source: '企业专属', standardSource: '年度购电协议及绿证核验材料', description: '适用于企业2026年度已核验绿电采购量。', attachments: ['2026年电力采购凭证.pdf'] },
  { id: 14, lib: 'enterprise', name: '再生铝材（供应商B）', value: 1.84, unit: 'kgCO₂e / kg', region: '中国', year: '2026', source: '企业专属', standardSource: '供应商B第三方产品碳足迹报告', description: '适用于供应商B再生铝材产品，按2026版报告口径使用。', attachments: ['供应商B第三方产品碳足迹报告.pdf'] },
];

type FactorForm = Omit<Factor, 'id' | 'lib' | 'source'>;

export function CarbonFootprintFactorLibrary({ addModal, onCloseAddModal }: { addModal: boolean; onCloseAddModal: () => void }) {
  const [library, setLibrary] = useState<Library>('public');
  const [category, setCategory] = useState('');
  const [sideSearch, setSideSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [region, setRegion] = useState('');
  const [year, setYear] = useState('');
  const [factors, setFactors] = useState(seedFactors);
  const [selected, setSelected] = useState<Factor | null>(null);
  const [editing, setEditing] = useState<Factor | null>(null);
  const [deleting, setDeleting] = useState<Factor | null>(null);
  const visibleCategories = publicCategories.filter((item) => item.toLowerCase().includes(sideSearch.trim().toLowerCase()));
  const rows = useMemo(() => factors.filter((factor) => {
    if (factor.lib !== library) return false;
    if (keyword && !`${factor.name} ${factor.sourceCategory ?? ''} ${factor.originalId ?? ''} ${factor.standardSource ?? ''}`.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (region && factor.region !== region) return false;
    if (year && factor.year !== year) return false;
    if (category && library === 'public' && !(factor.sourceCategory ?? '').startsWith(category)) return false;
    return true;
  }), [category, factors, keyword, library, region, year]);

  const selectEnterprise = () => {
    setLibrary('enterprise');
    setCategory('企业专属因子');
    setSideSearch('');
  };
  const selectPublicCategory = (item: string) => {
    setLibrary('public');
    setCategory(item);
  };
  const reset = () => { setKeyword(''); setRegion(''); setYear(''); setCategory(library === 'public' ? '' : '企业专属因子'); };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const value = Number(data.get('value'));
    const unit = String(data.get('unit') ?? '').trim();
    const attachments = filterEvidenceFiles(Array.from(data.getAll('attachments')).filter((value): value is File => value instanceof File && Boolean(value.name))).map((file) => file.name);
    const nextAttachments = attachments.length ? attachments : editing?.attachments ?? [];
    const next: FactorForm = { name, value, unit, region: String(data.get('region') ?? '').trim(), year: String(data.get('year') ?? '').trim(), description: String(data.get('description') ?? '').trim(), attachments: nextAttachments };
    if (!name || !Number.isFinite(value) || !unit || !next.region || !next.year || !nextAttachments.length) return;
    if (editing) setFactors((items) => items.map((item) => item.id === editing.id ? { ...item, ...next, source: '企业专属' } : item));
    else setFactors((items) => [...items, { ...next, id: Date.now(), lib: 'enterprise', source: '企业专属' } as Factor]);
    setEditing(null);
    onCloseAddModal();
  };
  const formOpen = addModal || Boolean(editing);
  return <div className={styles.page}>
    <main className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sideTitle}><span>CPCD 分类</span><small>公共分类</small></div>
        <input className={styles.sideSearch} value={sideSearch} onChange={(event) => setSideSearch(event.target.value)} placeholder="搜索分类" />
        <div className={styles.tree}>
          <button type="button" className={`${styles.treeItem} ${library === 'enterprise' ? styles.treeItemActive : ''}`} onClick={selectEnterprise}><span className={styles.treeDot} />企业专属因子</button>
          {visibleCategories.map((item) => <button type="button" className={`${styles.treeItem} ${library === 'public' && category === item ? styles.treeItemActive : ''}`} key={item} onClick={() => selectPublicCategory(item)}><span className={styles.treeDot} />{item}</button>)}
        </div>
      </aside>
      <section className={styles.main}>
        <div className={styles.filterCard}><div className={styles.filters}>
          <label className={styles.field}><span>因子名称 / 关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="如：钢材、电力、运输、中华绒螯蟹" /></label>
          <label className={styles.field}><span>地区代表性</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option><option>全国</option><option>中国江苏</option><option>中国</option><option>华东</option></select></label>
          <label className={styles.field}><span>数据年份</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">全部年份</option><option>2026</option><option>2024</option><option>2022</option></select></label>
          <button type="button" className={`${styles.btn} ${styles.searchBtn}`}>查询</button><button type="button" className={styles.btn} onClick={reset}>重置</button>
        </div></div>
        <div className={styles.tableCard}><div className={styles.tableHead}><strong>{library === 'public' ? '公共因子' : '企业专属因子'}</strong><span>共 {rows.length} 条</span></div><div className={styles.tableWrap}><table><thead><tr><th>因子名称</th><th>碳足迹因子值</th><th>功能单位</th><th>地区代表性</th><th>数据年份</th><th>操作</th></tr></thead><tbody>{rows.map((factor) => <tr key={factor.id}><td>{factor.name}</td><td><strong>{factor.value}</strong></td><td>{factor.unit}</td><td>{factor.region}</td><td>{factor.year}</td><td><div className={styles.ops}><button type="button" className={styles.link} onClick={() => setSelected(factor)}>查看</button>{library === 'enterprise' && <><button type="button" className={styles.link} onClick={() => setEditing(factor)}>编辑</button><button type="button" className={`${styles.link} ${styles.danger}`} onClick={() => setDeleting(factor)}>删除</button></>}</div></td></tr>)}</tbody></table>{!rows.length && <div className={styles.empty}>暂无符合条件的数据</div>}</div><div className={styles.note}>{library === 'public' ? 'CPCD 因子保留原始记录编号及代表性信息；核算时的应用场景由核算清单决定。' : '企业专属因子仅维护核算所需的核心字段，凭证附件用于保留数据依据。'}</div></div>
      </section>
    </main>
    {selected && <FactorDetail factor={selected} onClose={() => setSelected(null)} />}
    {formOpen && <FactorForm factor={editing} onClose={() => { setEditing(null); onCloseAddModal(); }} onSubmit={save} />}
    {deleting && <div className={styles.modalMask} onMouseDown={() => setDeleting(null)}><section className={styles.confirmModal} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHead}><strong>删除企业专属因子</strong><button type="button" className={styles.close} onClick={() => setDeleting(null)}>×</button></div><div className={styles.confirmBody}>确认删除“{deleting.name}”吗？<small>删除后该因子将无法恢复。</small></div><div className={styles.modalFoot}><button type="button" className={styles.btn} onClick={() => setDeleting(null)}>取消</button><button type="button" className={`${styles.btn} ${styles.deleteBtn}`} onClick={() => { setFactors((items) => items.filter((item) => item.id !== deleting.id)); setDeleting(null); }}>确定删除</button></div></section></div>}
  </div>;
}

function FactorDetail({ factor, onClose }: { factor: Factor; onClose: () => void }) {
  const stages = factor.stages ?? [];
  const max = Math.max(...stages.map((item) => Math.abs(item.value)), 1);
  const functionUnit = factor.unit.split('/').slice(1).join('/').trim() || factor.unit;
  const detail = (label: string, value?: string, full = false) => <div className={`${styles.detail} ${full ? styles.detailFull : ''}`}><span>{label}</span><strong>{value || '-'}</strong></div>;
  return <div className={styles.modalMask} onMouseDown={onClose}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="因子详情" onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHead}><strong>{factor.lib === 'public' ? <>{factor.name}<span className={styles.titleBadge} aria-hidden="true">♛</span></> : '因子详情'}</strong><button type="button" className={styles.close} onClick={onClose}>×</button></div><div className={styles.modalBody}>{factor.lib === 'public' && <div className={styles.publicIdentity}><div><span>因子名称</span><strong>{factor.name}</strong></div><div><span>因子值</span><b>{factor.value}</b><em>{factor.unit}</em></div></div>}
    {factor.lib === 'public' ? <><section className={`${styles.section} ${styles.factorSummary}`}><div><span className={styles.factorCategory}>产品碳足迹</span><div className={styles.factorValue}><b>{factor.value}</b><span>{factor.unit}</span></div></div></section><section className={styles.section}><div className={styles.sectionTitle}>基本信息</div><div className={styles.detailGrid}>{detail('功能单元', functionUnit)}{detail('核算边界', factor.boundary)}{detail('技术代表性', factor.tech)}{detail('地域代表性', factor.region)}{detail('数据来源', factor.dataType)}{detail('数据时间', factor.year)}{detail('产品描述', factor.description, true)}</div></section><section className={styles.section}><div className={styles.sectionTitle}>生命周期各阶段碳足迹 <small>（单位：kgCO₂e）</small></div><div className={styles.stageList}>{stages.length ? stages.map((stage) => <div className={styles.stageRow} key={stage.name}><b>{stage.name}</b><span className={styles.barBg}><i style={{ width: `${Math.min(100, Math.abs(stage.value) / max * 100)}%` }} /></span><strong>{stage.value} kgCO₂e</strong></div>) : <div className={styles.emptyMaterial}>暂无生命周期阶段数据</div>}</div></section></> : <EnterpriseFactorDetail factor={factor} detail={detail} />}
  </div><div className={styles.modalFoot}><button type="button" className={styles.btn} onClick={onClose}>关闭</button></div></section></div>;
}

function EnterpriseFactorDetail({ factor, detail }: { factor: Factor; detail: (label: string, value?: string, full?: boolean) => ReactElement }) {
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  return <><section className={styles.section}><div className={styles.sectionTitle}>因子基本信息</div><div className={styles.factorValue}><b>{factor.value}</b><span>{factor.unit}</span></div><div className={`${styles.detailGrid} ${styles.enterpriseDetailGrid}`}>{detail('因子名称', factor.name)}{detail('地区', factor.region)}{detail('数据年份', factor.year)}</div></section><section className={styles.section}><div className={styles.sectionTitle}>企业专属因子</div><div className={styles.detailGrid}>{detail('适用说明', factor.description, true)}</div></section><section className={styles.section}><div className={styles.sectionTitle}>凭证附件</div>{factor.attachments?.length ? <div className={styles.attachmentList}>{factor.attachments.map((file) => <div className={styles.attachmentRow} key={file}><span className={styles.attachmentName}>📎 <span>{file}</span></span><button type="button" className={styles.attachmentPreview} onClick={() => setPreviewFile(file)}>预览</button></div>)}</div> : <div className={styles.emptyMaterial}>暂无凭证附件</div>}</section>{previewFile && <AttachmentPreview file={previewFile} onClose={() => setPreviewFile(null)} />}</>;
}

function AttachmentPreview({ file, onClose }: { file: string; onClose: () => void }) {
  const extension = file.includes('.') ? file.split('.').pop()?.toUpperCase() : '文件';
  return <div className={styles.modalMask} onMouseDown={onClose}><section className={styles.previewModal} role="dialog" aria-modal="true" aria-label="凭证附件预览" onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHead}><strong>凭证附件预览</strong><button type="button" className={styles.close} onClick={onClose}>×</button></div><div className={styles.previewBody}><div className={styles.previewIcon}>📄</div><strong>{file}</strong><span>{extension} 文件</span><p>当前为原型预览，实际文件内容将在接入附件存储后展示。</p></div><div className={styles.modalFoot}><button type="button" className={styles.btn} onClick={onClose}>关闭</button></div></section></div>;
}

function FactorForm({ factor, onClose, onSubmit }: { factor: Factor | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className={styles.modalMask} onMouseDown={onClose}><form className={styles.modal} onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}><div className={styles.modalHead}><strong>{factor ? '编辑企业专属因子' : '新增企业专属因子'}</strong><button type="button" className={styles.close} onClick={onClose}>×</button></div><div className={styles.modalBody}><div className={styles.tip}>企业专属因子只维护企业实际核算需要的信息，不要求套用 CPCD 的分类体系。</div><div className={styles.formGrid}><label className={styles.formFull}>因子名称<input name="name" required defaultValue={factor?.name} placeholder="请输入因子名称" /></label><label>因子值<input name="value" required type="number" step="0.0001" defaultValue={factor?.value} placeholder="请输入数值" /></label><label>功能单位<input name="unit" required defaultValue={factor?.unit} placeholder="如 kgCO₂e/kg" /></label><label>地区<input name="region" required defaultValue={factor?.region} placeholder="如 中国" /></label><label>年份<input name="year" required type="number" defaultValue={factor?.year} placeholder="如 2026" /></label><div className={`${styles.formFull} ${styles.uploadField}`}><FileDropzone name="attachments" title="点击或拖拽文件到此处上传" hint={factor?.attachments?.length ? `已上传：${factor.attachments.join('、')}；重新选择后将替换原附件。` : '仅支持 PDF 或图片，可多选。'} accept={EVIDENCE_FILE_ACCEPT} multiple required={!factor?.attachments?.length} clearAfterChange={false} onFiles={() => undefined} /></div><label className={styles.formFull}>适用说明<textarea name="description" defaultValue={factor?.description} placeholder="说明适用产品、供应商、边界或其他必要条件" /></label></div></div><div className={styles.modalFoot}><button type="button" className={styles.btn} onClick={onClose}>取消</button><button type="submit" className={styles.primary}>保存</button></div></form></div>;
}
