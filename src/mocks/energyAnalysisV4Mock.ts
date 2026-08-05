export type EnergyAnalysisScope = 'all' | 'prodA' | 'prodB' | 'utilities';
export type EnergyAnalysisPeriod = 'month' | 'year';
export type BenchmarkType = 'all' | 'unit' | 'product' | 'device';

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
  /** 月度汇总不一定具备可下钻的日度计量数据。 */
  dailyDataAvailable?: boolean;
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

export interface EnergyQueryMonthDetail {
  detailId: string;
  month: string;
  physicalAmount: number;
  standardCoalAmount: number;
  share: number;
  yearOnYear: number;
  monthOnMonth: number | null;
}

export interface EnergyQueryDayDetail {
  detailId: string;
  date: string;
  physicalAmount: number;
  standardCoalAmount: number;
  deviationFromDailyAverage: number;
  dataStatus: '正常' | '偏高';
}

const annualMonthWeights = [0.074, 0.071, 0.078, 0.079, 0.083, 0.081, 0.087, 0.089, 0.086, 0.09, 0.088, 0.094];
const monthDayWeights = [
  0.91, 0.94, 0.89, 0.97, 1.04, 1.08, 0.92, 0.88, 0.96, 1.01,
  1.07, 1.12, 0.95, 0.9, 0.98, 1.03, 1.09, 1.16, 0.93, 0.87,
  0.99, 1.05, 1.11, 1.18, 0.96, 0.92, 1.02, 1.08, 1.14, 1.2,
];

function allocateIntegerTotal(total: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => total * weight / totalWeight);
  const allocated = raw.map(Math.floor);
  let remainder = Math.round(total - allocated.reduce((sum, value) => sum + value, 0));
  raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      allocated[index] += 1;
      remainder -= 1;
    });
  return allocated;
}

export function createEnergyQueryAnnualDetails(row: EnergyQueryRow): EnergyQueryMonthDetail[] {
  const physicalAmounts = allocateIntegerTotal(row.physicalAmount, annualMonthWeights);
  const standardCoalAmounts = allocateIntegerTotal(row.standardCoalAmount, annualMonthWeights);
  return annualMonthWeights.map((_, index) => {
    const previous = index === 0 ? standardCoalAmounts[index] / (1 + row.yearOnYear / 100) : standardCoalAmounts[index - 1];
    return {
      detailId: `${row.energyQueryRowId}-month-${String(index + 1).padStart(2, '0')}`,
      month: `${index + 1}月`,
      physicalAmount: physicalAmounts[index],
      standardCoalAmount: standardCoalAmounts[index],
      share: standardCoalAmounts[index] / row.standardCoalAmount * 100,
      yearOnYear: row.yearOnYear + ((index % 5) - 2) * 0.35,
      monthOnMonth: previous ? (standardCoalAmounts[index] - previous) / previous * 100 : null,
    };
  });
}

export function createEnergyQueryMonthlyDetails(row: EnergyQueryRow): EnergyQueryDayDetail[] {
  if (row.dailyDataAvailable === false) return [];

  const physicalAmounts = allocateIntegerTotal(row.physicalAmount, monthDayWeights);
  const standardCoalAmounts = allocateIntegerTotal(row.standardCoalAmount, monthDayWeights);
  const dailyAverage = row.standardCoalAmount / monthDayWeights.length;
  return monthDayWeights.map((_, index) => {
    const deviation = (standardCoalAmounts[index] - dailyAverage) / dailyAverage * 100;
    return {
      detailId: `${row.energyQueryRowId}-day-${String(index + 1).padStart(2, '0')}`,
      date: `2026-06-${String(index + 1).padStart(2, '0')}`,
      physicalAmount: physicalAmounts[index],
      standardCoalAmount: standardCoalAmounts[index],
      deviationFromDailyAverage: deviation,
      dataStatus: deviation >= 12 ? '偏高' : '正常',
    };
  });
}

const allMonthRows: EnergyQueryRow[] = [
  { energyQueryRowId: 'eqr-prod-a-electricity-202606', energyUnitName: '生产车间A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 5380000, measurementUnit: 'kWh', standardCoalAmount: 5160, share: 38.7, yearOnYear: 2.8, monthOnMonth: 1.2, sourceDescription: '能源数据｜生产车间A｜电力｜2026年6月' },
  { energyQueryRowId: 'eqr-power-gas-202606', energyUnitName: '动力中心', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 610000, measurementUnit: 'Nm³', standardCoalAmount: 3190, share: 23.9, yearOnYear: 1.6, monthOnMonth: 0.9, sourceDescription: '能源数据｜动力中心｜天然气｜2026年6月' },
  { energyQueryRowId: 'eqr-boiler-steam-202606', energyUnitName: '锅炉系统', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 8250, measurementUnit: 'GJ', standardCoalAmount: 1999, share: 15, yearOnYear: -0.8, monthOnMonth: 0.3, sourceDescription: '能源数据｜锅炉系统｜蒸汽｜2026年6月' },
  { energyQueryRowId: 'eqr-air-electricity-202606', energyUnitName: '空压系统', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 1150000, measurementUnit: 'kWh', standardCoalAmount: 1103, share: 8.3, yearOnYear: 3.4, monthOnMonth: 1.5, dailyDataAvailable: false, sourceDescription: '能源数据｜空压系统｜电力｜2026年6月' },
];

const allYearRows: EnergyQueryRow[] = [
  { energyQueryRowId: 'eqr-prod-a-electricity-2026', energyUnitName: '生产车间A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 58900000, measurementUnit: 'kWh', standardCoalAmount: 58900, share: 42.5, yearOnYear: -1.1, sourceDescription: '能源数据｜生产车间A｜电力｜2026年度' },
  { energyQueryRowId: 'eqr-power-gas-2026', energyUnitName: '动力中心', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 7200000, measurementUnit: 'Nm³', standardCoalAmount: 38500, share: 27.8, yearOnYear: -2.2, sourceDescription: '能源数据｜动力中心｜天然气｜2026年度' },
  { energyQueryRowId: 'eqr-boiler-steam-2026', energyUnitName: '锅炉系统', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 98500, measurementUnit: 'GJ', standardCoalAmount: 19390, share: 14, yearOnYear: -0.7, sourceDescription: '能源数据｜锅炉系统｜蒸汽｜2026年度' },
  { energyQueryRowId: 'eqr-air-electricity-2026', energyUnitName: '空压系统', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 13100000, measurementUnit: 'kWh', standardCoalAmount: 13100, share: 9.5, yearOnYear: 0.6, sourceDescription: '能源数据｜空压系统｜电力｜2026年度' },
];

export const energyQueryData: Record<EnergyAnalysisScope, Record<EnergyAnalysisPeriod, EnergyQueryDataset>> = {
  all: {
    month: {
      total: 12382,
      yearOnYear: 2.1,
      monthOnMonth: 0.8,
      trend: [7482, 8272, 9402, 10342, 11322, 12382],
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      structure: [
        { color: '#00A870', label: '电力', share: 49.5, amount: 6127 },
        { color: '#1677FF', label: '燃料', share: 34.4, amount: 4256 },
        { color: '#F79009', label: '热力', share: 16.1, amount: 1999 },
      ],
      rows: allMonthRows,
    },
    year: {
      total: 129890,
      yearOnYear: -1.8,
      trend: [104190, 110790, 117990, 123590, 129890],
      labels: ['2022', '2023', '2024', '2025', '2026'],
      structure: [
        { color: '#00A870', label: '电力', share: 48.8, amount: 63410 },
        { color: '#1677FF', label: '燃料', share: 36.3, amount: 47090 },
        { color: '#F79009', label: '热力', share: 14.9, amount: 19390 },
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
        { energyQueryRowId: 'eqr-pa-electricity-202606', energyUnitName: '生产车间A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 5380000, measurementUnit: 'kWh', standardCoalAmount: 3199, share: 62, yearOnYear: 2.8, monthOnMonth: 1.2, sourceDescription: '能源数据｜生产车间A｜外购电力｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-gas-202606', energyUnitName: '生产车间A', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 610000, measurementUnit: 'Nm³', standardCoalAmount: 1240, share: 24, yearOnYear: 1.6, monthOnMonth: 0.9, sourceDescription: '能源数据｜生产车间A｜天然气｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-steam-202606', energyUnitName: '生产车间A', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 8250, measurementUnit: 'GJ', standardCoalAmount: 465, share: 9, yearOnYear: -0.8, monthOnMonth: 0.3, sourceDescription: '能源数据｜生产车间A｜蒸汽｜2026年6月' },
        { energyQueryRowId: 'eqr-pa-air-202606', energyUnitName: '生产车间A', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 1250000, measurementUnit: 'Nm³', standardCoalAmount: 256, share: 5, yearOnYear: 0.5, monthOnMonth: 0.2, sourceDescription: '能源数据｜生产车间A｜压缩空气｜2026年6月' },
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
        { energyQueryRowId: 'eqr-pa-electricity-2026', energyUnitName: '生产车间A', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 58900000, measurementUnit: 'kWh', standardCoalAmount: 35929, share: 61, yearOnYear: -0.9, sourceDescription: '能源数据｜生产车间A｜外购电力｜2026年度' },
        { energyQueryRowId: 'eqr-pa-gas-2026', energyUnitName: '生产车间A', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 7200000, measurementUnit: 'Nm³', standardCoalAmount: 14725, share: 25, yearOnYear: -1.5, sourceDescription: '能源数据｜生产车间A｜天然气｜2026年度' },
        { energyQueryRowId: 'eqr-pa-steam-2026', energyUnitName: '生产车间A', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 98500, measurementUnit: 'GJ', standardCoalAmount: 5301, share: 9, yearOnYear: -0.6, sourceDescription: '能源数据｜生产车间A｜蒸汽｜2026年度' },
        { energyQueryRowId: 'eqr-pa-air-2026', energyUnitName: '生产车间A', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 14900000, measurementUnit: 'Nm³', standardCoalAmount: 2945, share: 5, yearOnYear: -2.2, sourceDescription: '能源数据｜生产车间A｜压缩空气｜2026年度' },
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
        { energyQueryRowId: 'eqr-pb-electricity-202606', energyUnitName: '生产车间B', analysisCategory: '电力', energyTypeName: '外购电力', physicalAmount: 3200000, measurementUnit: 'kWh', standardCoalAmount: 1879, share: 54, yearOnYear: 1.9, monthOnMonth: 0.8, sourceDescription: '能源数据｜生产车间B｜外购电力｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-gas-202606', energyUnitName: '生产车间B', analysisCategory: '燃料', energyTypeName: '天然气', physicalAmount: 420000, measurementUnit: 'Nm³', standardCoalAmount: 1044, share: 30, yearOnYear: 0.9, monthOnMonth: 0.3, sourceDescription: '能源数据｜生产车间B｜天然气｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-steam-202606', energyUnitName: '生产车间B', analysisCategory: '热力', energyTypeName: '蒸汽', physicalAmount: 6100, measurementUnit: 'GJ', standardCoalAmount: 418, share: 12, yearOnYear: -0.4, monthOnMonth: 0.2, sourceDescription: '能源数据｜生产车间B｜蒸汽｜2026年6月' },
        { energyQueryRowId: 'eqr-pb-air-202606', energyUnitName: '生产车间B', analysisCategory: '其他', energyTypeName: '压缩空气', physicalAmount: 680000, measurementUnit: 'Nm³', standardCoalAmount: 139, share: 4, yearOnYear: 0.2, monthOnMonth: 0.1, sourceDescription: '能源数据｜生产车间B｜压缩空气｜2026年6月' },
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
      rows: allYearRows.filter((row) => row.energyUnitName === '生产车间B'),
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

export const energyAnalysisUnitLabels: Record<EnergyAnalysisScope, string> = {
  all: '全部',
  prodA: '生产车间A',
  prodB: '生产车间B',
  utilities: '公辅系统',
};
