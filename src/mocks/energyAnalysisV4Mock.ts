export type EnergyAnalysisScope = 'all' | 'prodA' | 'prodB' | 'utilities';
export type EnergyAnalysisPeriod = 'month' | 'year';
export type IntensityScope = 'factory' | 'prodA' | 'utilities';
export type BenchmarkType = 'all' | 'unit' | 'product' | 'device';
export type FlowScope = 'factory' | 'prodA';
export type FlowLevel = 'level1' | 'level2';

export interface EnergyQueryRow {
  energyQueryRowId: string;
  energyUnitName: string;
  analysisCategory: string;
  energyTypeName: string;
  physicalAmount: number;
  measurementUnit: string;
  standardCoalAmount: number;
  share: number;
  yearOnYear: number;
  monthOnMonth?: number;
  sourceDescription: string;
}

export interface EnergyQueryDataset {
  total: number;
  yearOnYear: number;
  monthOnMonth?: number;
  trend: number[];
  labels: string[];
  structure: Array<{
    color: string;
    label: string;
    share: number;
    amount: number;
  }>;
  rows: EnergyQueryRow[];
}

const allMonthRows: EnergyQueryRow[] = [
  { energyQueryRowId: 'eqr-prod-a-electricity-202606', energyUnitName: '生产单元A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 5380000, measurementUnit: 'kWh', standardCoalAmount: 5160, share: 38.7, yearOnYear: 2.8, monthOnMonth: 1.2, sourceDescription: '能源数据｜生产单元A｜电力｜2026年6月' },
  { energyQueryRowId: 'eqr-power-gas-202606', energyUnitName: '动力车间', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 610000, measurementUnit: 'Nm³', standardCoalAmount: 3190, share: 23.9, yearOnYear: 1.6, monthOnMonth: 0.9, sourceDescription: '能源数据｜动力车间｜天然气｜2026年6月' },
  { energyQueryRowId: 'eqr-boiler-steam-202606', energyUnitName: '锅炉房', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 8250, measurementUnit: 'GJ', standardCoalAmount: 1999, share: 15, yearOnYear: -0.8, monthOnMonth: 0.3, sourceDescription: '能源数据｜锅炉房｜蒸汽｜2026年6月' },
  { energyQueryRowId: 'eqr-air-electricity-202606', energyUnitName: '空压站', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 1150000, measurementUnit: 'kWh', standardCoalAmount: 1103, share: 8.3, yearOnYear: 3.4, monthOnMonth: 1.5, sourceDescription: '能源数据｜空压站｜电力｜2026年6月' },
  { energyQueryRowId: 'eqr-heat-recovery-202606', energyUnitName: '余热回收系统', analysisCategory: '其他', energyTypeName: '余热回收', physicalAmount: 2600, measurementUnit: 'GJ', standardCoalAmount: 938, share: 7, yearOnYear: -1.2, monthOnMonth: -0.4, sourceDescription: '能源数据｜余热回收系统｜余热｜2026年6月' },
];

const allYearRows: EnergyQueryRow[] = [
  { energyQueryRowId: 'eqr-prod-a-electricity-2026', energyUnitName: '生产单元A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 58900000, measurementUnit: 'kWh', standardCoalAmount: 58900, share: 42.5, yearOnYear: -1.1, sourceDescription: '能源数据｜生产单元A｜电力｜2026年度' },
  { energyQueryRowId: 'eqr-power-gas-2026', energyUnitName: '动力车间', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 7200000, measurementUnit: 'Nm³', standardCoalAmount: 38500, share: 27.8, yearOnYear: -2.2, sourceDescription: '能源数据｜动力车间｜天然气｜2026年度' },
  { energyQueryRowId: 'eqr-boiler-steam-2026', energyUnitName: '锅炉房', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 98500, measurementUnit: 'GJ', standardCoalAmount: 19390, share: 14, yearOnYear: -0.7, sourceDescription: '能源数据｜锅炉房｜蒸汽｜2026年度' },
  { energyQueryRowId: 'eqr-air-electricity-2026', energyUnitName: '空压站', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 13100000, measurementUnit: 'kWh', standardCoalAmount: 13100, share: 9.5, yearOnYear: 0.6, sourceDescription: '能源数据｜空压站｜电力｜2026年度' },
  { energyQueryRowId: 'eqr-heat-recovery-2026', energyUnitName: '余热回收系统', analysisCategory: '其他', energyTypeName: '余热回收', physicalAmount: 31100, measurementUnit: 'GJ', standardCoalAmount: 8610, share: 6.2, yearOnYear: -3.1, sourceDescription: '能源数据｜余热回收系统｜余热｜2026年度' },
];

export const energyQueryData: Record<EnergyAnalysisScope, Record<EnergyAnalysisPeriod, EnergyQueryDataset>> = {
  all: {
    month: {
      total: 13320,
      yearOnYear: 2.1,
      monthOnMonth: 0.8,
      trend: [8420, 9210, 10340, 11280, 12260, 13320],
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      structure: [
        { color: '#00A870', label: '电力', share: 46, amount: 6127 },
        { color: '#1677FF', label: '燃料', share: 32, amount: 4256 },
        { color: '#F79009', label: '热力', share: 15, amount: 1999 },
        { color: '#7A5AF8', label: '其他', share: 7, amount: 938 },
      ],
      rows: allMonthRows,
    },
    year: {
      total: 138500,
      yearOnYear: -1.8,
      trend: [112800, 119400, 126600, 132200, 138500],
      labels: ['2022', '2023', '2024', '2025', '2026'],
      structure: [
        { color: '#00A870', label: '电力', share: 45, amount: 62325 },
        { color: '#1677FF', label: '燃料', share: 34, amount: 47090 },
        { color: '#F79009', label: '热力', share: 14, amount: 19390 },
        { color: '#7A5AF8', label: '其他', share: 7, amount: 9695 },
      ],
      rows: allYearRows,
    },
  },
  prodA: {
    month: {
      total: 5160,
      yearOnYear: 2.8,
      monthOnMonth: 1.2,
      trend: [3800, 4020, 4330, 4560, 4860, 5160],
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      structure: [
        { color: '#00A870', label: '电力', share: 62, amount: 3199 },
        { color: '#1677FF', label: '燃料', share: 24, amount: 1240 },
        { color: '#F79009', label: '热力', share: 9, amount: 465 },
        { color: '#7A5AF8', label: '其他', share: 5, amount: 256 },
      ],
      rows: [
        { energyQueryRowId: 'eqr-pa-electricity-202606', energyUnitName: '生产单元A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 5380000, measurementUnit: 'kWh', standardCoalAmount: 3199, share: 62, yearOnYear: 2.8, monthOnMonth: 1.2, sourceDescription: '能源数据｜生产单元A｜外购电力｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-gas-202606', energyUnitName: '生产单元A', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 610000, measurementUnit: 'Nm³', standardCoalAmount: 1240, share: 24, yearOnYear: 1.6, monthOnMonth: 0.9, sourceDescription: '能源数据｜生产单元A｜天然气｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-steam-202606', energyUnitName: '生产单元A', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 8250, measurementUnit: 'GJ', standardCoalAmount: 465, share: 9, yearOnYear: -0.8, monthOnMonth: 0.3, sourceDescription: '能源数据｜生产单元A｜蒸汽｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-air-202606', energyUnitName: '生产单元A', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 1250000, measurementUnit: 'Nm³', standardCoalAmount: 256, share: 5, yearOnYear: 0.5, monthOnMonth: 0.2, sourceDescription: '能源数据｜生产单元A｜压缩空气｜2026年6月' },
      ],
    },
    year: {
      total: 58900,
      yearOnYear: -1.1,
      trend: [51000, 54200, 56100, 57400, 58900],
      labels: ['2022', '2023', '2024', '2025', '2026'],
      structure: [
        { color: '#00A870', label: '电力', share: 61, amount: 35929 },
        { color: '#1677FF', label: '燃料', share: 25, amount: 14725 },
        { color: '#F79009', label: '热力', share: 9, amount: 5301 },
        { color: '#7A5AF8', label: '其他', share: 5, amount: 2945 },
      ],
      rows: [
        { energyQueryRowId: 'eqr-pa-electricity-2026', energyUnitName: '生产单元A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 58900000, measurementUnit: 'kWh', standardCoalAmount: 35929, share: 61, yearOnYear: -0.9, sourceDescription: '能源数据｜生产单元A｜外购电力｜2026年度' },
        { energyQueryRowId: 'eqr-pa-gas-2026', energyUnitName: '生产单元A', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 7200000, measurementUnit: 'Nm³', standardCoalAmount: 14725, share: 25, yearOnYear: -1.5, sourceDescription: '能源数据｜生产单元A｜天然气｜2026年度' },
        { energyQueryRowId: 'eqr-pa-steam-2026', energyUnitName: '生产单元A', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 98500, measurementUnit: 'GJ', standardCoalAmount: 5301, share: 9, yearOnYear: -0.6, sourceDescription: '能源数据｜生产单元A｜蒸汽｜2026年度' },
        { energyQueryRowId: 'eqr-pa-air-2026', energyUnitName: '生产单元A', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 14900000, measurementUnit: 'Nm³', standardCoalAmount: 2945, share: 5, yearOnYear: -2.2, sourceDescription: '能源数据｜生产单元A｜压缩空气｜2026年度' },
      ],
    },
  },
  prodB: {
    month: {
      total: 3480,
      yearOnYear: 1.4,
      monthOnMonth: 0.6,
      trend: [2800, 2920, 3060, 3190, 3350, 3480],
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      structure: [
        { color: '#00A870', label: '电力', share: 54, amount: 1879 },
        { color: '#1677FF', label: '燃料', share: 30, amount: 1044 },
        { color: '#F79009', label: '热力', share: 12, amount: 418 },
        { color: '#7A5AF8', label: '其他', share: 4, amount: 139 },
      ],
      rows: [
        { energyQueryRowId: 'eqr-pb-electricity-202606', energyUnitName: '生产单元B', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 3200000, measurementUnit: 'kWh', standardCoalAmount: 1879, share: 54, yearOnYear: 1.9, monthOnMonth: 0.8, sourceDescription: '能源数据｜生产单元B｜外购电力｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-gas-202606', energyUnitName: '生产单元B', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 420000, measurementUnit: 'Nm³', standardCoalAmount: 1044, share: 30, yearOnYear: 0.9, monthOnMonth: 0.3, sourceDescription: '能源数据｜生产单元B｜天然气｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-steam-202606', energyUnitName: '生产单元B', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 6100, measurementUnit: 'GJ', standardCoalAmount: 418, share: 12, yearOnYear: -0.4, monthOnMonth: 0.2, sourceDescription: '能源数据｜生产单元B｜蒸汽｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-air-202606', energyUnitName: '生产单元B', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 680000, measurementUnit: 'Nm³', standardCoalAmount: 139, share: 4, yearOnYear: 0.2, monthOnMonth: 0.1, sourceDescription: '能源数据｜生产单元B｜压缩空气｜2026年6月' },
      ],
    },
    year: {
      total: 41300,
      yearOnYear: -0.7,
      trend: [36500, 38200, 39500, 40600, 41300],
      labels: ['2022', '2023', '2024', '2025', '2026'],
      structure: [
        { color: '#00A870', label: '电力', share: 55, amount: 22715 },
        { color: '#1677FF', label: '燃料', share: 29, amount: 11977 },
        { color: '#F79009', label: '热力', share: 12, amount: 4956 },
        { color: '#7A5AF8', label: '其他', share: 4, amount: 1652 },
      ],
      rows: allYearRows.filter((row) => row.energyUnitName === '生产单元B'),
    },
  },
  utilities: {
    month: {
      total: 2300,
      yearOnYear: 3.1,
      monthOnMonth: 1.7,
      trend: [1760, 1840, 1970, 2050, 2190, 2300],
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      structure: [
        { color: '#00A870', label: '电力', share: 70, amount: 1610 },
        { color: '#F79009', label: '热力', share: 18, amount: 414 },
        { color: '#7A5AF8', label: '其他', share: 12, amount: 276 },
      ],
      rows: [
        { energyQueryRowId: 'eqr-u-electricity-202606', energyUnitName: '公辅系统', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 2100000, measurementUnit: 'kWh', standardCoalAmount: 1610, share: 70, yearOnYear: 3.4, monthOnMonth: 1.9, sourceDescription: '能源数据｜公辅系统｜外购电力｜2026年6月' },
        { energyQueryRowId: 'eqr-u-steam-202606', energyUnitName: '公辅系统', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 5200, measurementUnit: 'GJ', standardCoalAmount: 414, share: 18, yearOnYear: 1.1, monthOnMonth: 0.6, sourceDescription: '能源数据｜公辅系统｜蒸汽｜2026年6月' },
        { energyQueryRowId: 'eqr-u-air-202606', energyUnitName: '公辅系统', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 900000, measurementUnit: 'Nm³', standardCoalAmount: 276, share: 12, yearOnYear: 0.4, monthOnMonth: 0.2, sourceDescription: '能源数据｜公辅系统｜压缩空气｜2026年6月' },
      ],
    },
    year: {
      total: 27600,
      yearOnYear: 1.2,
      trend: [24100, 25200, 26000, 26900, 27600],
      labels: ['2022', '2023', '2024', '2025', '2026'],
      structure: [
        { color: '#00A870', label: '电力', share: 70, amount: 19320 },
        { color: '#F79009', label: '热力', share: 18, amount: 4968 },
        { color: '#7A5AF8', label: '其他', share: 12, amount: 3312 },
      ],
      rows: allYearRows.filter((row) => row.energyUnitName === '公辅系统'),
    },
  },
};

export interface IntensityMetric {
  intensityMetricId: string;
  name: string;
  value: number | null;
  unit: string;
  yearOnYear: number | null;
  resultStatus: '可用' | '待补充' | '需核验';
  resultType: 'ok' | 'warn' | 'check';
  formula: string;
  numerator: string;
  denominator: string;
  source: string;
  period: string;
  issue?: string;
}

export const intensityData: Record<IntensityScope, IntensityMetric[]> = {
  factory: [
    { intensityMetricId: 'i1', name: '单位产品综合能耗', value: 91.8, unit: 'kgce/t', yearOnYear: -2.3, resultStatus: '可用', resultType: 'ok', formula: '综合能耗 ÷ 产品产量', numerator: '综合能耗 138,500 tce', denominator: '产品产量 1,508,715 t', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'i2', name: '单位产品电耗', value: 76.5, unit: 'kWh/t', yearOnYear: -3.1, resultStatus: '可用', resultType: 'ok', formula: '电力消费量 ÷ 产品产量', numerator: '电力消费量 115,427,000 kWh', denominator: '产品产量 1,508,715 t', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'i3', name: '单位产值综合能耗', value: 0.351, unit: 'tce/万元', yearOnYear: 1.1, resultStatus: '可用', resultType: 'ok', formula: '综合能耗 ÷ 工业总产值', numerator: '综合能耗 138,500 tce', denominator: '工业总产值 394,587 万元', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'i4', name: '单位增加值综合能耗', value: null, unit: 'tce/万元', yearOnYear: null, resultStatus: '待补充', resultType: 'warn', formula: '综合能耗 ÷ 工业增加值', numerator: '综合能耗 138,500 tce', denominator: '工业增加值未录入', source: '能源数据 + 运营数据', period: '2026年度', issue: '缺少2026年度工业增加值。' },
    { intensityMetricId: 'i5', name: '单位营业收入电耗', value: 152.3, unit: 'kWh/万元', yearOnYear: -2, resultStatus: '需核验', resultType: 'check', formula: '电力消费量 ÷ 营业收入', numerator: '电力消费量 115,427,000 kWh', denominator: '营业收入 757,900 万元', source: '能源数据 + 运营数据', period: '能源数据截至12月，营业收入截至11月', issue: '分子与分母的统计期间不一致。' },
  ],
  prodA: [
    { intensityMetricId: 'pa1', name: '单位产品综合能耗', value: 91.8, unit: 'kgce/t', yearOnYear: -2.3, resultStatus: '可用', resultType: 'ok', formula: '生产单元A综合能耗 ÷ 生产单元A产品产量', numerator: '综合能耗 58,900 tce', denominator: '产品产量 641,612 t', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'pa2', name: '单位产品电耗', value: 76.5, unit: 'kWh/t', yearOnYear: -3.1, resultStatus: '可用', resultType: 'ok', formula: '生产单元A电力消费量 ÷ 产品产量', numerator: '电力消费量 49,084,318 kWh', denominator: '产品产量 641,612 t', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'pa3', name: '单位业务量能耗', value: null, unit: 'kgce/件', yearOnYear: null, resultStatus: '待补充', resultType: 'warn', formula: '综合能耗 ÷ 业务量', numerator: '综合能耗 58,900 tce', denominator: '业务量未录入', source: '能源数据 + 运营数据', period: '2026年度', issue: '缺少生产单元A业务量数据。' },
  ],
  utilities: [
    { intensityMetricId: 'u1', name: '单位供气电耗', value: 0.102, unit: 'kWh/Nm³', yearOnYear: -1.4, resultStatus: '可用', resultType: 'ok', formula: '空压系统电耗 ÷ 压缩空气供应量', numerator: '空压系统电耗 13,100,000 kWh', denominator: '压缩空气供应量 128,431,373 Nm³', source: '能源数据 + 运营数据', period: '2026年度' },
    { intensityMetricId: 'u2', name: '单位蒸汽综合能耗', value: null, unit: 'kgce/t蒸汽', yearOnYear: null, resultStatus: '待补充', resultType: 'warn', formula: '锅炉燃料综合能耗 ÷ 蒸汽产出量', numerator: '燃料综合能耗已录入', denominator: '蒸汽产出量未录入', source: '能源数据 + 运营数据', period: '2026年度', issue: '缺少锅炉系统蒸汽产出量。' },
  ],
};

export interface BenchmarkMetric {
  benchmarkMetricId: string;
  objectName: string;
  objectType: string;
  objectTypeKey: Exclude<BenchmarkType, 'all' | 'product'> | 'enterprise';
  metricName: string;
  unit: string;
  actual: number;
  target: number;
  direction: 'low' | 'high';
  trend: number[];
}

export const benchmarkRows: BenchmarkMetric[] = [
  { benchmarkMetricId: 'b1', objectName: '全厂', objectType: '企业', objectTypeKey: 'enterprise', metricName: '单位产值综合能耗', unit: 'tce/万元', actual: 0.351, target: 0.34, direction: 'low', trend: [0.39, 0.37, 0.36, 0.35, 0.34, 0.33, 0.34, 0.35, 0.36, 0.31, 0.32, 0.351] },
  { benchmarkMetricId: 'b2', objectName: '生产单元A', objectType: '用能单元', objectTypeKey: 'unit', metricName: '单位产品综合能耗', unit: 'kgce/t', actual: 91.8, target: 90, direction: 'low', trend: [94, 93.6, 92.9, 92.5, 92.1, 91.4, 91, 91.3, 91.8, 92.2, 91.9, 91.8] },
  { benchmarkMetricId: 'b3', objectName: '生产单元A', objectType: '用能单元', objectTypeKey: 'unit', metricName: '单位产品电耗', unit: 'kWh/t', actual: 76.5, target: 78, direction: 'low', trend: [82, 81, 80.5, 79.4, 78.8, 78, 77.4, 76.9, 76.6, 76.3, 76.1, 76.5] },
  { benchmarkMetricId: 'b4', objectName: '余热发电系统', objectType: '用能单元', objectTypeKey: 'unit', metricName: '能源转换效率', unit: '%', actual: 85.7, target: 84, direction: 'high', trend: [82, 82.8, 83.5, 84.1, 84.5, 85, 85.2, 85.6, 85.4, 85.8, 85.6, 85.7] },
  { benchmarkMetricId: 'b5', objectName: '重点设备A', objectType: '设备', objectTypeKey: 'device', metricName: '年度电耗', unit: 'kWh', actual: 325000, target: 320000, direction: 'low', trend: [27800, 26500, 27100, 26900, 26600, 27000, 26800, 27200, 27100, 26900, 27300, 28500] },
];

export interface FlowDataset {
  input: number;
  allocated: number;
  unallocated: number;
  loss: number | null;
  rate: number;
  external: number;
  relations: number;
  capability: string;
}

export const flowDatasets: Record<FlowScope, FlowDataset> = {
  factory: { input: 13320, allocated: 12980, unallocated: 340, loss: 220, rate: 97.4, external: 340, relations: 2, capability: '已具备全厂控制量、一级用能单元归属、能源转换和外供数据。' },
  prodA: { input: 5160, allocated: 5060, unallocated: 100, loss: null, rate: 98.1, external: 0, relations: 0, capability: '当前范围可生成用能分配；未配置能源转换或外部输出。' },
};

export type FlowAction = 'source' | 'relation' | 'external' | 'none';

export interface FlowDetailRow {
  flowDetailId: string;
  type: string;
  input: string;
  relation: string;
  target: string;
  standardCoalAmount: number;
  share: number;
  action: FlowAction;
  source: string;
  inputStandardCoalAmount?: number;
  outputStandardCoalAmount?: number;
  efficiency?: number;
  loss?: number;
}

export const factoryFlowRows: FlowDetailRow[] = [
  { flowDetailId: 'fdr-prod-a', type: '终端消费', input: '厂内电力', relation: '能源介质汇总', target: '生产单元A', standardCoalAmount: 3780, share: 28.4, action: 'source', source: '能源数据｜生产单元A｜电力｜2026年6月' },
  { flowDetailId: 'fdr-utilities', type: '终端消费', input: '厂内电力', relation: '能源介质汇总', target: '公辅系统', standardCoalAmount: 1103, share: 8.3, action: 'source', source: '能源数据｜公辅系统｜电力｜2026年6月' },
  { flowDetailId: 'fdr-waste-heat', type: '能源转换', input: '余热', relation: '余热发电系统 → 电力', target: '厂内电力', standardCoalAmount: 960, share: 7.2, action: 'relation', inputStandardCoalAmount: 1120, outputStandardCoalAmount: 960, efficiency: 85.7, loss: 160, source: '能源转换关系｜余热发电系统｜余热→电力｜2026年6月' },
  { flowDetailId: 'fdr-boiler', type: '能源转换', input: '天然气', relation: '燃气锅炉 → 蒸汽', target: '厂内蒸汽', standardCoalAmount: 1880, share: 14.1, action: 'relation', inputStandardCoalAmount: 1940, outputStandardCoalAmount: 1880, efficiency: 96.9, loss: 60, source: '能源转换关系｜燃气锅炉｜天然气→蒸汽｜2026年6月' },
  { flowDetailId: 'fdr-external', type: '外部输出', input: '厂内电力', relation: '由外供能源数据自动识别', target: '企业外部', standardCoalAmount: 340, share: 2.6, action: 'external', source: '能源数据｜余热发电系统｜电力｜外供能源｜2026年6月' },
  { flowDetailId: 'fdr-unallocated', type: '未归属', input: '—', relation: '本级控制量与下级归属量差额', target: '未归属差额', standardCoalAmount: 340, share: 2.6, action: 'none', source: '系统计算' },
];

export const prodAFlowRows: FlowDetailRow[] = [
  { flowDetailId: 'fdr-pa-raw-electricity', type: '直接消费', input: '外购电力', relation: '—', target: '原料制备', standardCoalAmount: 1480, share: 28.7, action: 'source', source: '能源数据｜生产单元A—原料制备｜外购电力｜2026年6月' },
  { flowDetailId: 'fdr-pa-core-electricity', type: '直接消费', input: '外购电力', relation: '—', target: '核心工序', standardCoalAmount: 1719, share: 33.3, action: 'source', source: '能源数据｜生产单元A—核心工序｜外购电力｜2026年6月' },
  { flowDetailId: 'fdr-pa-core-gas', type: '直接消费', input: '天然气', relation: '—', target: '核心工序', standardCoalAmount: 1240, share: 24, action: 'source', source: '能源数据｜生产单元A—核心工序｜天然气｜2026年6月' },
  { flowDetailId: 'fdr-pa-pack-steam', type: '直接消费', input: '蒸汽', relation: '—', target: '包装发运', standardCoalAmount: 465, share: 9, action: 'source', source: '能源数据｜生产单元A—包装发运｜蒸汽｜2026年6月' },
  { flowDetailId: 'fdr-pa-pack-air', type: '直接消费', input: '压缩空气', relation: '—', target: '包装发运', standardCoalAmount: 156, share: 3, action: 'source', source: '能源数据｜生产单元A—包装发运｜压缩空气｜2026年6月' },
  { flowDetailId: 'fdr-pa-unallocated', type: '未分配', input: '—', relation: '—', target: '未分配能源量', standardCoalAmount: 100, share: 1.9, action: 'none', source: '生产单元A能源量与下级工序合计的差额' },
];

export interface BalanceRow {
  energyTypeName: string;
  boundaryInput: number;
  conversionOutput: number;
  conversionInput: number;
  terminalAmount: number;
  externalOutput: number;
  unallocated: number;
  balanceStatus: string;
}

export const factoryBalanceRows: BalanceRow[] = [
  { energyTypeName: '电力', boundaryInput: 6127, conversionOutput: 960, conversionInput: 0, terminalAmount: 6747, externalOutput: 340, unallocated: 0, balanceStatus: '已校验' },
  { energyTypeName: '天然气', boundaryInput: 3256, conversionOutput: 0, conversionInput: 1940, terminalAmount: 1316, externalOutput: 0, unallocated: 0, balanceStatus: '已校验' },
  { energyTypeName: '原煤', boundaryInput: 2000, conversionOutput: 0, conversionInput: 0, terminalAmount: 1960, externalOutput: 0, unallocated: 40, balanceStatus: '存在未归属' },
  { energyTypeName: '蒸汽', boundaryInput: 1937, conversionOutput: 1880, conversionInput: 0, terminalAmount: 3517, externalOutput: 0, unallocated: 300, balanceStatus: '存在未归属' },
  { energyTypeName: '余热', boundaryInput: 0, conversionOutput: 1120, conversionInput: 1120, terminalAmount: 0, externalOutput: 0, unallocated: 0, balanceStatus: '已校验' },
];

export const prodABalanceRows: BalanceRow[] = [
  { energyTypeName: '电力', boundaryInput: 3199, conversionOutput: 0, conversionInput: 0, terminalAmount: 3199, externalOutput: 0, unallocated: 0, balanceStatus: '已校验' },
  { energyTypeName: '天然气', boundaryInput: 1240, conversionOutput: 0, conversionInput: 0, terminalAmount: 1240, externalOutput: 0, unallocated: 0, balanceStatus: '已校验' },
  { energyTypeName: '蒸汽', boundaryInput: 465, conversionOutput: 0, conversionInput: 0, terminalAmount: 465, externalOutput: 0, unallocated: 0, balanceStatus: '已校验' },
  { energyTypeName: '其他', boundaryInput: 256, conversionOutput: 0, conversionInput: 0, terminalAmount: 156, externalOutput: 0, unallocated: 100, balanceStatus: '存在未归属' },
];

export const energyAnalysisUnitLabels: Record<EnergyAnalysisScope | IntensityScope, string> = {
  all: '全部',
  factory: '全厂',
  prodA: '生产单元A',
  prodB: '生产单元B',
  utilities: '公辅系统',
};
