export type CarbonFactorParameter = {
  key: string;
  name: string;
  value: number;
  display: string;
  unit: string;
  sourceType: string;
  source: string;
  editable: boolean;
};

export type CarbonFactor = {
  factorId: string;
  scope: 'public' | 'enterprise';
  name: string;
  objectType: '综合排放因子' | '基础核算参数' | '参数组/公式模板' | 'GWP值' | '方法学常数';
  activity: string;
  gas: string;
  value: string;
  unit: string;
  source: string;
  version: string;
  geo: string;
  industry: string;
  validity: '当前有效' | '已被替代' | '停用';
  raw: string;
  quality: string;
  effective: string;
  reference: string;
  formula?: string;
  parameters?: CarbonFactorParameter[];
  selectable: boolean;
  calculationType: 'direct' | 'fuelParameter' | 'processParameter' | 'parameter';
  approval?: string;
};

const fuelParameters = (kind: 'gas' | 'diesel'): CarbonFactorParameter[] => [
  {
    key: 'ncv',
    name: '低位发热量 NCV',
    value: kind === 'gas' ? 0.038931 : 42.652,
    display: kind === 'gas' ? '0.038931' : '42.652',
    unit: kind === 'gas' ? 'GJ/Nm³' : 'GJ/t',
    sourceType: '标准缺省值',
    source: '国家因子库第二版',
    editable: true,
  },
  {
    key: 'cc',
    name: '单位热值含碳量 CC',
    value: kind === 'gas' ? 15.242055 : 20.480956,
    display: kind === 'gas' ? '15.242055' : '20.480956',
    unit: 'tC/TJ',
    sourceType: '标准缺省值',
    source: '国家因子库第二版',
    editable: true,
  },
  { key: 'of', name: '碳氧化率 OF', value: 99, display: '99', unit: '%', sourceType: '标准缺省值', source: '通用工业核算方法', editable: true },
  { key: 'mw', name: '分子量换算', value: 44 / 12, display: '44/12', unit: '—', sourceType: '方法学常数', source: '化学计量关系', editable: false },
];

export const carbonFactorsV4: CarbonFactor[] = [
  {
    factorId: 'pf-rdf', scope: 'enterprise', name: 'RDF企业示例排放因子', objectType: '综合排放因子', activity: '固定燃烧', gas: 'CO₂e',
    value: '1.850', unit: 'tCO₂e/t', source: '企业示例参数（待研发接入参数库）', version: '2026年度', geo: '当前企业', industry: '通用工业企业',
    validity: '当前有效', raw: '1.850 tCO₂e/t', quality: '演示参数，正式使用前应由企业实测或适用标准替换', effective: '2026年度', reference: 'RDF燃料企业层级示例口径',
    formula: '排放量 = RDF消耗量 × RDF排放因子', selectable: true, calculationType: 'direct', approval: '演示数据',
  },
  {
    factorId: 'pf-ng', scope: 'public', name: '天然气固定燃烧参数组', objectType: '参数组/公式模板', activity: '固定燃烧', gas: 'CO₂',
    value: '折算因子 2.154', unit: 'kgCO₂/Nm³', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '由NCV、CC、OF及44/12折算', quality: '官方参数与方法学常数组合',
    effective: '2026-03-01起', reference: '能源活动—化石燃料固定燃烧—天然气',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('gas'), selectable: true, calculationType: 'fuelParameter',
  },
  {
    factorId: 'pf-diesel', scope: 'public', name: '柴油移动燃烧参数组', objectType: '参数组/公式模板', activity: '移动燃烧', gas: 'CO₂',
    value: '折算因子 3.171', unit: 'tCO₂/t', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '由NCV、CC、OF及44/12折算', quality: '官方参数与方法学常数组合',
    effective: '2026-03-01起', reference: '能源活动—移动源燃烧—柴油',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('diesel'), selectable: true, calculationType: 'fuelParameter',
  },
  {
    factorId: 'pf-power', scope: 'public', name: '外购电力排放因子（全国）', objectType: '综合排放因子', activity: '购入电力', gas: 'CO₂e',
    value: '0.5703', unit: 'tCO₂e/MWh', source: '生态环境部公告', version: '当前任务适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '0.5703 kgCO₂e/kWh', quality: '官方发布值', effective: '按核算年度匹配',
    reference: '净购入电力排放', formula: '排放量 = 外购电量 × 电力排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-heat', scope: 'public', name: '外购热力排放因子', objectType: '综合排放因子', activity: '购入热力', gas: 'CO₂',
    value: '0.1110', unit: 'tCO₂/GJ', source: 'GB/T 32151系列', version: '现行适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '0.1110 tCO₂/GJ', quality: '标准推荐值', effective: '长期有效',
    reference: '购入热力排放', formula: '排放量 = 外购热量 × 热力排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-process', scope: 'public', name: '工业过程碳酸盐分解参数组', objectType: '参数组/公式模板', activity: '工业过程', gas: 'CO₂',
    value: '参数组（3项）', unit: '参数组', source: 'GB/T 32151系列', version: '通用过程排放示例方法', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '质量分数、转化系数及转化率', quality: '适用于存在碳酸盐分解的工业过程；具体行业应加载适用方法',
    effective: '按行业方法匹配', reference: '工业生产过程—碳酸盐分解',
    formula: '排放量 = 原料消耗量 × 碳酸盐质量分数 × CO₂转化系数 × 过程转化率 − 扣减量',
    parameters: [
      { key: 'content', name: '碳酸盐质量分数', value: 92, display: '92', unit: '%', sourceType: '企业实测/标准值', source: '原料成分检测或行业缺省值', editable: true },
      { key: 'conversion', name: 'CO₂转化系数', value: 0.478, display: '0.478', unit: 'tCO₂/t碳酸盐', sourceType: '方法学参数', source: '适用行业核算方法', editable: true },
      { key: 'rate', name: '过程转化率', value: 99.8, display: '99.8', unit: '%', sourceType: '企业实测/标准值', source: '工艺检测或行业缺省值', editable: true },
      { key: 'deduction', name: '扣减量', value: 0, display: '0', unit: 'tCO₂', sourceType: '企业数据', source: '符合方法要求的扣减项目', editable: true },
    ],
    selectable: true, calculationType: 'processParameter',
  },
  {
    factorId: 'pf-waste', scope: 'public', name: '工业废水处理排放因子', objectType: '综合排放因子', activity: '废弃物处理', gas: 'CO₂e',
    value: '0.000315', unit: 'tCO₂e/人·天/年', source: '企业核查口径（缺省值法）', version: '2026年度', geo: '当前企业',
    industry: '通用工业', validity: '当前有效', raw: '0.004294 tCO₂e/t废水', quality: '官方推荐值', effective: '2026-03-01起',
    reference: '废弃物处理—人员人天法', formula: '排放量 = 人天数 × BOD × 0.001 × I × Bo × MCF × GWP ÷ 1000', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-r134a', scope: 'public', name: 'R134a全球变暖潜势', objectType: 'GWP值', activity: '逸散排放', gas: 'CO₂e',
    value: '1.430', unit: 'tCO₂e/kg', source: 'IPCC', version: 'AR5 GWP100', geo: '全球', industry: '通用工业',
    validity: '当前有效', raw: 'GWP100=1430 kgCO₂e/kg', quality: '国际权威参数', effective: '按核算方法选用',
    reference: '含氟气体—R134a', formula: '排放量 = 制冷剂逸散量 × GWP', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-transport', scope: 'public', name: '公路货运排放因子', objectType: '综合排放因子', activity: '其他间接排放', gas: 'CO₂e',
    value: '0.119', unit: 'kgCO₂e/t·km', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '0.119 kgCO₂e/t·km', quality: '官方推荐值', effective: '2026-03-01起',
    reference: '运输活动—公路货运', formula: '排放量 = 运输周转量 × 排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'p-ng-ncv', scope: 'public', name: '天然气低位发热量 NCV', objectType: '基础核算参数', activity: '固定燃烧', gas: '—',
    value: '0.038931', unit: 'GJ/Nm³', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '0.038931 GJ/Nm³', quality: '可被合规企业实测值替换', effective: '2026-03-01起',
    reference: '天然气固定燃烧参数', selectable: false, calculationType: 'parameter',
  },
  {
    factorId: 'p-ng-cc', scope: 'public', name: '天然气单位热值含碳量 CC', objectType: '基础核算参数', activity: '固定燃烧', gas: 'CO₂',
    value: '15.242055', unit: 'tC/TJ', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '15.242055 tC/TJ', quality: '标准缺省参数', effective: '2026-03-01起',
    reference: '天然气固定燃烧参数', selectable: false, calculationType: 'parameter',
  },
  {
    factorId: 'p-carbon-oxidation', scope: 'public', name: '燃料碳氧化率 OF', objectType: '基础核算参数', activity: '固定燃烧', gas: 'CO₂',
    value: '99', unit: '%', source: '通用工业核算方法', version: '现行适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '99%', quality: '应按适用方法或实测条件选取', effective: '按方法适用',
    reference: '燃料燃烧核算参数', selectable: false, calculationType: 'parameter',
  },
  {
    factorId: 'p-mw-44-12', scope: 'public', name: '碳转化为二氧化碳分子量系数', objectType: '方法学常数', activity: '固定燃烧', gas: 'CO₂',
    value: '44/12', unit: '—', source: '化学计量关系', version: '固定常数', geo: '全球', industry: '通用工业',
    validity: '当前有效', raw: '44/12', quality: '固定只读，不允许企业修改', effective: '长期有效',
    reference: 'C→CO₂分子量换算', selectable: false, calculationType: 'parameter',
  },
  {
    factorId: 'ef-ng', scope: 'enterprise', name: '天然气固定燃烧企业参数组', objectType: '参数组/公式模板', activity: '固定燃烧', gas: 'CO₂',
    value: '折算因子 2.086', unit: 'kgCO₂/Nm³', source: '企业检测报告+公共参数', version: '2026年度', geo: '当前企业',
    industry: '通用工业', validity: '当前有效', raw: '企业实测NCV与公共缺省参数组合', quality: '低位发热量采用企业检测加权平均值，其余采用适用缺省值',
    effective: '2026-01-01~2026-12-31', reference: '检测报告 JC-2026-016、燃料台账',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12',
    parameters: [{ ...fuelParameters('gas')[0], value: 0.03772, display: '0.037720', sourceType: '企业实测值', source: '检测报告 JC-2026-016' }, ...fuelParameters('gas').slice(1)],
    selectable: true, calculationType: 'fuelParameter', approval: '已审核',
  },
  {
    factorId: 'ef-ng-ncv', scope: 'enterprise', name: '天然气低位发热量（企业实测）', objectType: '基础核算参数', activity: '固定燃烧', gas: '—',
    value: '0.037720', unit: 'GJ/Nm³', source: '企业检测报告', version: '2026年度', geo: '当前企业', industry: '通用工业',
    validity: '当前有效', raw: '0.037720 GJ/Nm³', quality: '多批次检测加权平均', effective: '2026年度',
    reference: '检测报告 JC-2026-016、燃料台账', selectable: false, calculationType: 'parameter', approval: '已审核',
  },
  {
    factorId: 'ef-power', scope: 'enterprise', name: '外购电力企业特定因子', objectType: '综合排放因子', activity: '购入电力', gas: 'CO₂e',
    value: '0.5321', unit: 'tCO₂e/MWh', source: '企业证明材料', version: '2025年度', geo: '当前企业', industry: '通用工业',
    validity: '停用', raw: '0.5321 tCO₂e/MWh', quality: '历史年度材料', effective: '2025年度',
    reference: '绿电及电力交易证明', selectable: false, calculationType: 'direct', approval: '已停用',
  },
  {
    factorId: 'pf-power-old', scope: 'public', name: '外购电力排放因子（历史区域版）', objectType: '综合排放因子', activity: '购入电力', gas: 'CO₂e',
    value: '0.7035', unit: 'tCO₂e/MWh', source: '生态环境部公告', version: '历史区域版', geo: '华东地区', industry: '通用工业',
    validity: '已被替代', raw: '0.7035 kgCO₂e/kWh', quality: '历史区域因子', effective: '历史年度',
    reference: '区域电网排放因子', formula: '排放量 = 外购电量 × 电力排放因子', selectable: false, calculationType: 'direct',
  },
  {
    factorId: 'pf-coal', scope: 'public', name: '原煤固定燃烧排放因子', objectType: '综合排放因子', activity: '固定燃烧', gas: 'CO₂',
    value: '2.493', unit: 'tCO₂/t', source: '国家温室气体排放因子数据库', version: '当前任务适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '2.493 tCO₂/t', quality: '标准推荐值；按核算年度匹配', effective: '按核算年度匹配',
    reference: '能源活动—化石燃料固定燃烧—原煤', formula: '排放量 = 原煤消费量 × 原煤排放因子', selectable: true, calculationType: 'direct',
  },
];

export const supportBasicV4 = [
  { group: '核算主体与边界', item: '报告主体信息', activity: '主体名称及统一社会信用代码', origin: '组织档案快照', materials: 2, state: '已上传' as const },
  { group: '核算主体与边界', item: '组织边界', activity: '企业法人边界及设施清单', origin: '核算任务·边界设置', materials: 3, state: '已上传' as const },
  { group: '核算制度与方法', item: '核算方法说明', activity: 'GB/T 32150—2025、ISO 14064-1:2018', origin: '核算任务·方法设置', materials: 1, state: '已上传' as const },
  { group: '质量保证', item: '数据管理制度', activity: '核算数据收集与复核制度', origin: '在线上传', materials: 0, state: '待补充' as const },
];

const customCarbonFactorsV4: CarbonFactor[] = [];

export const saveCarbonFactorV4 = (factor: CarbonFactor) => {
  const index = customCarbonFactorsV4.findIndex((item) => item.factorId === factor.factorId);
  if (index >= 0) customCarbonFactorsV4[index] = factor;
  else customCarbonFactorsV4.push(factor);
  return { ...factor };
};

export const getCarbonFactorV4 = (factorId: string) =>
  customCarbonFactorsV4.find((factor) => factor.factorId === factorId) ?? carbonFactorsV4.find((factor) => factor.factorId === factorId);
