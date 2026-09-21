export type CarbonFactorEvidenceFile = {
  evidenceFileId: string;
  fileName: string;
  fileType?: string;
};

export type CarbonFactorParameter = {
  key: string;
  name: string;
  value: number;
  display: string;
  unit: string;
  sourceType: string;
  source: string;
  editable: boolean;
  valueMode?: '检测值' | '计算值' | '缺省值' | '官方发布值' | '方法学常数';
  method?: string;
  monitoringFrequency?: string;
  effectivePeriod?: string;
  evidenceRequired?: boolean;
  evidenceFiles?: CarbonFactorEvidenceFile[];
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
  calculationType: 'direct' | 'fuelParameter' | 'processParameter' | 'wastewaterParameter' | 'recoveryParameter' | 'parameter';
  calculationScenario?: 'fuelCombustion' | 'carbonateProcess' | 'wastewaterAnaerobic' | 'methaneRecovery' | 'co2Recovery' | 'purchasedElectricity' | 'purchasedHeat' | 'otherSignificant' | 'extension';
  approval?: string;
  factorObject?: string;
  emissionSourceType?: string;
  calculationBasis?: 'volume' | 'mass' | 'heat' | 'electricity' | 'process' | 'other';
  activityUnit?: string;
  ghgType?: string;
  publishedYear?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  enterpriseId?: string;
};

const fuelParameters = (kind: 'gas' | 'diesel' | 'coal' | 'rdf'): CarbonFactorParameter[] => [
  {
    key: 'ncv',
    name: '低位发热量 NCV',
    value: kind === 'gas' ? 0.038931 : kind === 'diesel' ? 42.652 : kind === 'coal' ? 20.908 : 18.5,
    display: kind === 'gas' ? '0.038931' : kind === 'diesel' ? '42.652' : kind === 'coal' ? '20.908' : '18.500',
    unit: kind === 'gas' ? 'GJ/Nm³' : 'GJ/t',
    sourceType: kind === 'rdf' ? '企业实测' : '官方缺省值',
    source: kind === 'rdf' ? '证明材料：RDF燃料检测报告_2026.xlsx' : '国家因子库第二版',
    editable: true, valueMode: '缺省值', method: 'GB/T 213、GB/T 384 或 GB/T 22723', monitoringFrequency: kind === 'gas' ? '每批次或至少每半年' : kind === 'diesel' ? '每批次或至少每季度' : '每批次或至少每月', evidenceRequired: true,
  },
  {
    key: 'cc',
    name: '单位热值含碳量 CC',
    value: kind === 'gas' ? 15.242055 : kind === 'diesel' ? 20.480956 : kind === 'coal' ? 33.17 : 27.8293,
    display: kind === 'gas' ? '15.242055' : kind === 'diesel' ? '20.480956' : kind === 'coal' ? '33.170000' : '27.829300',
    unit: 'tC/TJ',
    sourceType: '官方缺省值',
    source: '国家因子库第二版',
    editable: true, valueMode: '缺省值', method: '实测燃料含碳量，或按 NCV × 单位热值含碳量计算', monitoringFrequency: kind === 'gas' ? '每批次或至少每半年' : kind === 'diesel' ? '每批次或至少每季度' : '每批次或至少每月', evidenceRequired: true,
  },
  { key: 'of', name: '碳氧化率 OF', value: kind === 'coal' || kind === 'rdf' ? 98 : 99, display: kind === 'coal' || kind === 'rdf' ? '98' : '99', unit: '%', sourceType: '官方缺省值', source: '通用工业核算方法', editable: true, valueMode: '缺省值', monitoringFrequency: '按适用核算方法', evidenceRequired: true },
  { key: 'mw', name: '碳转化为二氧化碳系数', value: 44 / 12, display: '44/12', unit: '—', sourceType: '方法学常数', source: '化学计量关系', editable: false, valueMode: '方法学常数' },
];

const structuredFactorMetadata: Record<string, Pick<CarbonFactor, 'name' | 'factorObject' | 'emissionSourceType' | 'calculationBasis' | 'activityUnit' | 'ghgType' | 'publishedYear' | 'enterpriseId' | 'calculationScenario'>> = {
  'pf-ng': { name: '天然气—固定燃烧（按体积）', factorObject: '天然气', emissionSourceType: '固定燃烧', calculationBasis: 'volume', activityUnit: 'Nm³', ghgType: 'CO₂', publishedYear: 2026, calculationScenario: 'fuelCombustion' },
  'ef-ng': { name: '天然气—固定燃烧（企业参数）', factorObject: '天然气', emissionSourceType: '固定燃烧', calculationBasis: 'volume', activityUnit: 'Nm³', ghgType: 'CO₂', publishedYear: 2026, enterpriseId: 'org-xx-tech' },
  'pf-coal': { name: '原煤—固定燃烧（按质量）', factorObject: '原煤', emissionSourceType: '固定燃烧', calculationBasis: 'mass', activityUnit: 't', ghgType: 'CO₂', publishedYear: 2026, calculationScenario: 'fuelCombustion' },
  'pf-rdf': { name: 'RDF—固定燃烧（按质量）', factorObject: 'RDF', emissionSourceType: '固定燃烧', calculationBasis: 'mass', activityUnit: 't', ghgType: 'CO₂e', publishedYear: 2026, calculationScenario: 'fuelCombustion' },
  'pf-diesel': { name: '柴油—移动燃烧（按质量）', factorObject: '柴油', emissionSourceType: '移动燃烧', calculationBasis: 'mass', activityUnit: 't', ghgType: 'CO₂', publishedYear: 2026, calculationScenario: 'fuelCombustion' },
  'pf-power': { name: '外购电力—购入电力', factorObject: '外购电力', emissionSourceType: '购入电力', calculationBasis: 'electricity', activityUnit: 'MWh', ghgType: 'CO₂e', publishedYear: 2026, calculationScenario: 'purchasedElectricity' },
  'ef-power': { name: '外购电力—购入电力（企业参数）', factorObject: '外购电力', emissionSourceType: '购入电力', calculationBasis: 'electricity', activityUnit: 'MWh', ghgType: 'CO₂e', publishedYear: 2026, enterpriseId: 'org-xx-tech' },
  'pf-heat': { name: '外购热力—购入热力', factorObject: '外购热力', emissionSourceType: '购入热力', calculationBasis: 'heat', activityUnit: 'GJ', ghgType: 'CO₂', publishedYear: 2026, calculationScenario: 'purchasedHeat' },
  'pf-process': { name: '碳酸盐原料—生产过程（按质量）', factorObject: '碳酸盐原料', emissionSourceType: '生产过程', calculationBasis: 'process', activityUnit: 't', ghgType: 'CO₂', publishedYear: 2026 },
  'pf-waste': { name: '工业废水—厌氧处理', factorObject: '工业废水', emissionSourceType: '废水厌氧处理', calculationBasis: 'other', activityUnit: 'm³/年', ghgType: 'CH₄', publishedYear: 2026, calculationScenario: 'wastewaterAnaerobic' },
  'pf-r134a': { name: 'R134a—制冷剂逸散（按质量）', factorObject: 'R134a', emissionSourceType: '逸散', calculationBasis: 'mass', activityUnit: 'kg', ghgType: 'CO₂e', publishedYear: 2026 },
  'pf-transport': { name: '公路货运—交通运输（按周转量）', factorObject: '公路货运', emissionSourceType: '交通运输', calculationBasis: 'other', activityUnit: 't·km', ghgType: 'CO₂e', publishedYear: 2026, calculationScenario: 'extension' },
  'pf-ch4-recovery': { name: '甲烷回收与销毁', factorObject: '甲烷回收与销毁', emissionSourceType: '其他边界外排放', calculationBasis: 'other', activityUnit: 'Nm³', ghgType: 'CH₄', publishedYear: 2026, calculationScenario: 'methaneRecovery' },
  'pf-co2-recovery': { name: '二氧化碳回收利用', factorObject: 'CO₂回收利用', emissionSourceType: '其他边界外排放', calculationBasis: 'other', activityUnit: '万Nm³', ghgType: 'CO₂', publishedYear: 2026, calculationScenario: 'co2Recovery' },
};

export const carbonFactorsV4: CarbonFactor[] = [
  {
    factorId: 'pf-rdf', scope: 'enterprise', name: 'RDF固定燃烧参数组', objectType: '参数组/公式模板', activity: '固定燃烧', gas: 'CO₂e',
    value: '1.850', unit: 'tCO₂e/t', source: '企业核算参数库', version: '2026年度', geo: 'XX科技有限公司', industry: '通用工业企业',
    validity: '当前有效', raw: '1.850 tCO₂e/t', quality: '企业核算参数', effective: '2026年度', reference: 'RDF燃料企业核算口径',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('rdf'), selectable: true, calculationType: 'fuelParameter', approval: '已审核',
  },
  {
    factorId: 'pf-ng', scope: 'public', name: '天然气', objectType: '参数组/公式模板', activity: '固定燃烧', gas: 'CO₂',
    value: '折算因子 2.154', unit: 'kgCO₂/Nm³', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '由NCV、CC、OF及44/12折算', quality: '官方参数与方法学常数组合',
    effective: '2026-03-01起', reference: '能源活动-化石燃料燃烧-天然气-二氧化碳-固定燃烧',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('gas'), selectable: true, calculationType: 'fuelParameter',
  },
  {
    factorId: 'pf-diesel', scope: 'public', name: '柴油', objectType: '参数组/公式模板', activity: '移动燃烧', gas: 'CO₂',
    value: '折算因子 3.171', unit: 'tCO₂/t', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '由NCV、CC、OF及44/12折算', quality: '官方参数与方法学常数组合',
    effective: '2026-03-01起', reference: '能源活动-化石燃料燃烧-石油-二氧化碳-移动源燃烧-道路运输-柴油',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('diesel'), selectable: true, calculationType: 'fuelParameter',
  },
  {
    factorId: 'pf-power', scope: 'public', name: '电力平均二氧化碳排放因子（全国）', objectType: '综合排放因子', activity: '购入电力', gas: 'CO₂e',
    value: '0.5703', unit: 'tCO₂e/MWh', source: '国家温室气体排放因子数据库', version: '当前年度适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '0.5703 kgCO₂e/kWh', quality: '官方发布值', effective: '按核算年度匹配',
    reference: '净购入电力与热力-电力消费-电力平均二氧化碳排放因子-全国', formula: '排放量 = 外购电量 × 电力排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-heat', scope: 'public', name: '热力', objectType: '综合排放因子', activity: '购入热力', gas: 'CO₂',
    value: '0.1110', unit: 'tCO₂/GJ', source: '国家温室气体排放因子数据库', version: '现行适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '0.1110 tCO₂/GJ', quality: '标准推荐值', effective: '长期有效',
    reference: '净购入电力与热力-热力消费-热力二氧化碳排放因子', formula: '排放量 = 外购热量 × 热力排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-process', scope: 'public', name: '碳酸盐原料', objectType: '参数组/公式模板', activity: '工业过程', gas: 'CO₂',
    value: '参数组（2项）', unit: '参数组', source: '工业其他行业企业核算指南', version: '试行版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '纯度及CO₂排放因子', quality: '按碳酸盐种类分别录入；支持企业实测或供应商数据',
    effective: '按行业方法匹配', reference: '工业生产过程-碳酸盐使用-二氧化碳-碳酸盐原料',
    formula: '排放量 = Σ（碳酸盐消耗量 × 纯度 × CO₂排放因子）',
    parameters: [
      { key: 'purity', name: '碳酸盐质量百分比纯度', value: 92, display: '92', unit: '%', sourceType: '企业实测/供应商数据', source: '原料成分检测或商品性状数据', editable: true, valueMode: '缺省值', method: 'GB/T 3286.1、GB/T 3286.9', monitoringFrequency: '按批次或按企业监测计划', evidenceRequired: true },
      { key: 'co2Factor', name: 'CO₂排放因子', value: 0.478, display: '0.478', unit: 'tCO₂/t碳酸盐', sourceType: '方法学参数', source: '附录二表2.2或按化学组分计算', editable: true, valueMode: '缺省值', method: '按化学组分、分子式及 CO₃²⁻ 数量计算', evidenceRequired: true },
    ],
    selectable: true, calculationType: 'processParameter', calculationScenario: 'carbonateProcess',
  },
  {
    factorId: 'pf-waste', scope: 'public', name: '工业废水厌氧处理', objectType: '参数组/公式模板', activity: '废水厌氧处理', gas: 'CH₄',
    value: '参数组（5项）', unit: '参数组', source: '工业其他行业企业核算指南', version: '试行版', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: 'COD、Bo、MCF及GWP参数组', quality: '支持企业实测 COD 和 MCF', effective: '按适用指南',
    reference: '工业废水厌氧处理-甲烷排放', formula: 'CH₄排放量 =（COD总量 − 污泥清除COD量）× Bo × MCF；CO₂e = CH₄ × GWP', parameters: [
      { key: 'codRemoved', name: '厌氧系统去除 COD 量', value: 5206.89, display: '5,206.89', unit: 'kg COD', sourceType: '企业监测值', source: '废水处理系统台账', editable: true, valueMode: '检测值', method: '环保部门水质监测标准方法', monitoringFrequency: '至少每2小时采样，采用24小时混合样', evidenceRequired: true },
      { key: 'sludgeCod', name: '污泥清除 COD 量', value: 0, display: '0', unit: 'kg COD', sourceType: '企业数据', source: '无污泥COD统计时按0', editable: true, valueMode: '缺省值', evidenceRequired: true },
      { key: 'bo', name: '甲烷最大生产能力 Bo', value: 0.25, display: '0.25', unit: 'kg CH₄/kg COD', sourceType: '官方缺省值', source: '工业其他行业企业核算指南', editable: true, valueMode: '缺省值', evidenceRequired: true },
      { key: 'mcf', name: '甲烷修正因子 MCF', value: 0.8, display: '0.8', unit: '—', sourceType: '系统类型缺省值', source: '附录二表2.3；支持企业实测', editable: true, valueMode: '缺省值', method: '按处理和排放途径选取', evidenceRequired: true },
      { key: 'gwp', name: 'CH₄全球变暖潜势（GWP100）', value: 27, display: '27', unit: 'tCO₂e/tCH₄', sourceType: '方法学常数', source: 'IPCC AR6 WGI（Forster 等，2021）', editable: false, valueMode: '方法学常数' },
    ], selectable: true, calculationType: 'wastewaterParameter',
  },
  {
    factorId: 'pf-r134a', scope: 'public', name: 'R134a', objectType: 'GWP值', activity: '逸散排放', gas: 'CO₂e',
    value: '1.526', unit: 'tCO₂e/kg', source: 'IPCC AR6 WGI（Forster 等，2021）', version: 'AR6 GWP100', geo: '全球', industry: '通用工业',
    validity: '当前有效', raw: 'GWP100=1526 kgCO₂e/kg', quality: '国际权威参数', effective: '按核算方法选用',
    reference: '逸散排放-制冷剂使用-含氢氟碳化合物-R134a', formula: '排放量 = 制冷剂逸散量 × GWP', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-transport', scope: 'public', name: '公路货运', objectType: '综合排放因子', activity: '其他间接排放', gas: 'CO₂e',
    value: '0.119', unit: 'kgCO₂e/t·km', source: '国家温室气体排放因子数据库', version: '第二版（2026）', geo: '全国',
    industry: '通用工业', validity: '当前有效', raw: '0.119 kgCO₂e/t·km', quality: '官方推荐值', effective: '2026-03-01起',
    reference: '运输活动-公路货运-二氧化碳当量', formula: '排放量 = 运输周转量 × 排放因子', selectable: true, calculationType: 'direct',
  },
  {
    factorId: 'pf-ch4-recovery', scope: 'public', name: '甲烷回收与销毁', objectType: '参数组/公式模板', activity: 'CH₄回收与销毁', gas: 'CH₄',
    value: '参数组（8项）', unit: '参数组', source: '工业其他行业企业核算指南', version: '试行版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '回收、浓度、氧化系数及销毁效率参数组', quality: '用于从工业废水厌氧处理排放中扣除回收与销毁量', effective: '按适用指南',
    reference: 'CH₄回收与销毁量', formula: '回收与销毁量 = 自用回收量 + 外供回收量 + 火炬销毁量', parameters: [
      { key: 'selfUseVolume', name: '回收现场自用甲烷气量', value: 0, display: '0', unit: 'Nm³', sourceType: '企业台账', source: '回收利用记录', editable: true, valueMode: '检测值', monitoringFrequency: '按月汇总', evidenceRequired: true },
      { key: 'selfUseConcentration', name: '自用甲烷体积浓度', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: 'GB/T 8984', editable: true, valueMode: '检测值', monitoringFrequency: '至少每周一次', evidenceRequired: true },
      { key: 'selfUseOxidation', name: '自用过程氧化系数', value: 99, display: '99', unit: '%', sourceType: '官方缺省值', source: '燃料燃烧场景缺省值', editable: true, valueMode: '缺省值', evidenceRequired: true },
      { key: 'externalVolume', name: '回收外供甲烷气量', value: 0, display: '0', unit: 'Nm³', sourceType: '企业台账', source: '外供结算记录', editable: true, valueMode: '检测值', monitoringFrequency: '按月汇总', evidenceRequired: true },
      { key: 'externalConcentration', name: '外供甲烷体积浓度', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: 'GB/T 8984', editable: true, valueMode: '检测值', monitoringFrequency: '至少每周一次', evidenceRequired: true },
      { key: 'flareVolume', name: '火炬销毁甲烷气体积量', value: 0, display: '0', unit: 'Nm³', sourceType: '流量监测值', source: '火炬入口流量计', editable: true, valueMode: '检测值', monitoringFrequency: '连续或至少每小时一次', evidenceRequired: true },
      { key: 'flareConcentration', name: '火炬入口甲烷体积浓度', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: 'GB/T 8984', editable: true, valueMode: '检测值', monitoringFrequency: '至少每周一次', evidenceRequired: true },
      { key: 'flareEfficiency', name: '火炬平均销毁效率', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: '火炬进出口质量变化测试', editable: true, valueMode: '检测值', monitoringFrequency: '至少每月一次', evidenceRequired: true },
    ], selectable: false, calculationType: 'recoveryParameter',
  },
  {
    factorId: 'pf-co2-recovery', scope: 'public', name: '二氧化碳回收利用', objectType: '参数组/公式模板', activity: 'CO₂回收利用', gas: 'CO₂',
    value: '参数组（4项）', unit: '参数组', source: '工业其他行业企业核算指南', version: '试行版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '外供及自用体积、纯度参数组', quality: '用于从排放总量中扣除回收利用量', effective: '按适用指南',
    reference: 'CO₂回收利用量', formula: '回收利用量 = 外供量 × 外供纯度 + 自用量 × 自用纯度', parameters: [
      { key: 'externalVolume', name: 'CO₂回收外供量', value: 0, display: '0', unit: '万Nm³', sourceType: '企业台账', source: '外供结算记录', editable: true, valueMode: '检测值', monitoringFrequency: '按月汇总', evidenceRequired: true },
      { key: 'externalPurity', name: '外供气体 CO₂ 体积浓度', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: 'GB/T 8984', editable: true, valueMode: '检测值', monitoringFrequency: '至少每周一次', evidenceRequired: true },
      { key: 'selfUseVolume', name: 'CO₂回收作原料量', value: 0, display: '0', unit: '万Nm³', sourceType: '企业台账', source: '生产原料使用记录', editable: true, valueMode: '检测值', monitoringFrequency: '按月汇总', evidenceRequired: true },
      { key: 'selfUsePurity', name: '自用原料气 CO₂ 体积浓度', value: 0, display: '0', unit: '%', sourceType: '企业监测值', source: 'GB/T 8984', editable: true, valueMode: '检测值', monitoringFrequency: '至少每周一次', evidenceRequired: true },
    ], selectable: false, calculationType: 'recoveryParameter',
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
    value: '折算因子 2.086', unit: 'kgCO₂/Nm³', source: '企业检测报告+公共参数', version: '2026年度', geo: 'XX科技有限公司',
    industry: '通用工业', validity: '当前有效', raw: '企业实测NCV与公共缺省参数组合', quality: '低位发热量采用企业检测加权平均值，其余采用适用缺省值',
    effective: '2026-01-01~2026-12-31', reference: '检测报告 JC-2026-016、燃料台账',
    formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12',
    parameters: [{ ...fuelParameters('gas')[0], value: 0.03772, display: '0.037720', sourceType: '企业实测值', source: '检测报告 JC-2026-016' }, ...fuelParameters('gas').slice(1)],
    selectable: true, calculationType: 'fuelParameter', approval: '已审核',
  },
  {
    factorId: 'ef-ng-ncv', scope: 'enterprise', name: '天然气低位发热量（企业实测）', objectType: '基础核算参数', activity: '固定燃烧', gas: '—',
    value: '0.037720', unit: 'GJ/Nm³', source: '企业检测报告', version: '2026年度', geo: 'XX科技有限公司', industry: '通用工业',
    validity: '当前有效', raw: '0.037720 GJ/Nm³', quality: '多批次检测加权平均', effective: '2026年度',
    reference: '检测报告 JC-2026-016、燃料台账', selectable: false, calculationType: 'parameter', approval: '已审核',
  },
  {
    factorId: 'ef-power', scope: 'enterprise', name: '外购电力企业特定因子', objectType: '综合排放因子', activity: '购入电力', gas: 'CO₂e',
    value: '0.5321', unit: 'tCO₂e/MWh', source: '企业证明材料', version: '2025年度', geo: 'XX科技有限公司', industry: '通用工业',
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
    factorId: 'pf-coal', scope: 'public', name: '原煤', objectType: '参数组/公式模板', activity: '固定燃烧', gas: 'CO₂',
    value: '2.493', unit: 'tCO₂/t', source: '国家温室气体排放因子数据库', version: '当前年度适用版', geo: '全国', industry: '通用工业',
    validity: '当前有效', raw: '2.493 tCO₂/t', quality: '标准推荐值；按核算年度匹配', effective: '按核算年度匹配',
    reference: '能源活动-化石燃料燃烧-煤炭-二氧化碳-固定燃烧-原煤', formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12', parameters: fuelParameters('coal'), selectable: true, calculationType: 'fuelParameter',
  },
].map((factor) => ({ ...factor, ...structuredFactorMetadata[factor.factorId] } as CarbonFactor));

export const supportBasicV4 = [
  { group: '核算主体与边界', item: '核算主体与组织边界', activity: '主体身份、企业法人边界及设施清单', origin: '组织档案快照、年度核算·边界设置', materials: 5, state: '已上传' as const },
  { group: '质量保证', item: '碳排放管理制度', activity: '核算数据收集与复核制度', origin: '在线上传', materials: 0, state: '待补充' as const },
];

const customCarbonFactorsV4: CarbonFactor[] = [];

export const saveCarbonFactorV4 = (factor: CarbonFactor) => {
  const index = customCarbonFactorsV4.findIndex((item) => item.factorId === factor.factorId);
  if (index >= 0) customCarbonFactorsV4[index] = factor;
  else customCarbonFactorsV4.push(factor);
  return { ...factor };
};

export const listCarbonFactorsV4 = () => [
  ...carbonFactorsV4.map((factor) => customCarbonFactorsV4.find((item) => item.factorId === factor.factorId) ?? factor),
  ...customCarbonFactorsV4.filter((factor) => !carbonFactorsV4.some((item) => item.factorId === factor.factorId)),
];

export const getCarbonFactorV4 = (factorId: string) =>
  customCarbonFactorsV4.find((factor) => factor.factorId === factorId) ?? carbonFactorsV4.find((factor) => factor.factorId === factorId);
