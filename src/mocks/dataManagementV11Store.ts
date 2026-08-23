import { listEnergyUnits } from './energyUnitMockStore';
import { countBenchmarkTargets, resetBenchmarkTargetStore } from './benchmarkTargetStore';
import { resetProductMasterStore } from './productMasterStore';
import { resetDeviceIntensityParameters } from './deviceIntensityParameterStore';

export type AnalysisCategory =
  | '电力'
  | '热力'
  | '化石燃料'
  | '可再生及替代能源'
  | '回收能源'
  | '其他能源';

export type EnergyRole = '能源消费' | '回收能源' | '能源产出' | '外供能源';
export type ScopeLevel = '企业' | '一级用能单元' | '二级用能单元';
export type EnergyRecordScopeType = 'enterprise' | 'energyUnit' | 'device';
export type ConversionOutputType = '锅炉产汽/产热' | '余热发电' | '空压产气/压缩空气' | '回收利用' | '直接外供' | '其他转换';
export type ConversionInputMode = 'linked' | 'manual' | 'recovery' | 'none' | 'direct';

export interface V11EnergyType {
  energyTypeId: string;
  analysisCategory: AnalysisCategory;
  energyTypeName: string;
  measurementUnit: string;
  standardCoalFactor: number;
  standardCoalFactorUnit: string;
  remark: string;
}

export interface V11EnergyRecord {
  energyRecordId: string;
  year: number;
  energyRole: EnergyRole;
  scopeLevel: ScopeLevel;
  scopeType?: EnergyRecordScopeType;
  scopeId?: string | null;
  energyUnitId: string | null;
  energyTypeId: string;
  entryMode: 'monthly' | 'annual';
  monthlyAmounts: number[];
  /** 标记实际已取得的月份；金额为 0 也可视为已填报。 */
  monthlyReportedMonths?: boolean[];
  /** 月度不完整时补录的全年台账总量。 */
  annualAmount: number;
  /** 回收能源来源的具体设备或工艺，可选；能源消费记录不使用。 */
  sourceDeviceId?: string;
  /** 没有设备档案时记录具体来源工艺。 */
  sourceProcess?: string;
  /** 回收能源来源介质，例如烟气、冷却水、热风。 */
  sourceMedium?: string;
}

export interface V11EnergyCost {
  energyCostId: string;
  year: number;
  energyTypeId: string;
  monthlyCosts: number[];
  monthlyReportedMonths?: boolean[];
  annualCost?: number;
}

export interface V11ConversionOutput {
  conversionOutputId: string;
  year: number;
  recordType: ConversionOutputType;
  conversionEnergyUnitId: string | null;
  inputMode: ConversionInputMode;
  inputEnergyRecordId?: string;
  inputAnalysisCategory?: AnalysisCategory;
  inputEnergyTypeId?: string;
  inputAmount?: number;
  inputUnit?: string;
  recoverySourceEnergyUnitId?: string;
  recoveryEnergyName?: string;
  recoveryAmount?: number | null;
  recoveryUnit?: string;
  outputAnalysisCategory?: AnalysisCategory;
  outputEnergyTypeId?: string;
  outputEnergyName?: string;
  outputUnit?: string;
  outputAmount?: number;
  internalAmount?: number;
  /** 产出能源的主要内部使用去向；一期先支持一个主要去向单元。 */
  outputTargetEnergyUnitId?: string;
  externalAmount: number;
  lossAmount?: number;
  /** 月度转换量；存在时优先用于月度能流分析，不以年度值平均摊分。 */
  monthlyInputAmounts?: number[];
  monthlyOutputAmounts?: number[];
  monthlyInternalAmounts?: number[];
  monthlyExternalAmounts?: number[];
  monthlyLossAmounts?: number[];
  receiver?: string;
  remark: string;
}

/** 能源供能台账。供能来源可以是企业级能源记录，也可以是转换产出。 */
export interface V11ExternalSupplyRecord {
  externalSupplyId: string;
  year: number;
  inputEnergyRecordId?: string;
  conversionOutputId?: string;
  energyTypeId?: string;
  amount: number;
  unit?: string;
  monthlyAmounts?: number[];
  receiver?: string;
  /** 原型阶段保存已选择的凭证文件名；正式接入文件服务后替换为附件元数据。 */
  evidenceNames?: string[];
  remark: string;
}

export interface V11OperationMetric {
  operationMetricId: string;
  metricCode: string;
  productId: string | null;
  year: number;
  scopeLevel: ScopeLevel;
  energyUnitId: string | null;
  metricCategory: '产量' | '经济指标' | '运行指标';
  aggregationMethod: '月度求和' | '年度单值';
  metricName: string;
  metricUnit: string;
  entryMode: 'monthly' | 'annual';
  monthlyValues: number[];
  monthlyReportedMonths?: boolean[];
  annualValue: number;
}

export interface V11KeyDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  energyUnitId: string;
  mainEnergyTypeId: string;
  outputBasis?: string;
  remark: string;
}

export type V11EnergyTypeReferenceKind = 'energyRecords' | 'energyCosts' | 'keyDevices' | 'conversionOutputs';
export interface V11EnergyTypeReferenceSummary {
  kind: V11EnergyTypeReferenceKind;
  label: string;
  count: number;
  path: string;
}

const seedEnergyTypes: V11EnergyType[] = [
  { energyTypeId: 'v11-energy-electricity', analysisCategory: '电力', energyTypeName: '电力', measurementUnit: 'kWh', standardCoalFactor: 0.1229, standardCoalFactorUnit: 'kgce/kWh', remark: '' },
  { energyTypeId: 'v11-energy-steam', analysisCategory: '热力', energyTypeName: '蒸汽', measurementUnit: 'GJ', standardCoalFactor: 0.0341, standardCoalFactorUnit: 'tce/GJ', remark: '' },
  { energyTypeId: 'v11-energy-coal', analysisCategory: '化石燃料', energyTypeName: '原煤', measurementUnit: 't', standardCoalFactor: 0.7143, standardCoalFactorUnit: 'tce/t', remark: '' },
  { energyTypeId: 'v11-energy-petcoke', analysisCategory: '化石燃料', energyTypeName: '石油焦', measurementUnit: 't', standardCoalFactor: 1.0918, standardCoalFactorUnit: 'tce/t', remark: '' },
  { energyTypeId: 'v11-energy-natural-gas', analysisCategory: '化石燃料', energyTypeName: '天然气', measurementUnit: 'Nm³', standardCoalFactor: 1.33, standardCoalFactorUnit: 'kgce/Nm³', remark: '' },
  { energyTypeId: 'v11-energy-rdf', analysisCategory: '可再生及替代能源', energyTypeName: 'RDF', measurementUnit: 't', standardCoalFactor: 0.6, standardCoalFactorUnit: 'tce/t', remark: '' },
  { energyTypeId: 'v11-energy-biomass', analysisCategory: '可再生及替代能源', energyTypeName: '生物质燃料', measurementUnit: 't', standardCoalFactor: 0.5, standardCoalFactorUnit: 'tce/t', remark: '' },
  { energyTypeId: 'v11-energy-waste-heat', analysisCategory: '回收能源', energyTypeName: '余热', measurementUnit: 'GJ', standardCoalFactor: 0.0341, standardCoalFactorUnit: 'tce/GJ', remark: '' },
  { energyTypeId: 'v11-energy-recovered-steam', analysisCategory: '回收能源', energyTypeName: '回收蒸汽', measurementUnit: 'GJ', standardCoalFactor: 0.0341, standardCoalFactorUnit: 'tce/GJ', remark: '由余热回收利用系统直接产生，优先用于厂内生产工艺' },
  { energyTypeId: 'v11-energy-compressed-air', analysisCategory: '其他能源', energyTypeName: '压缩空气', measurementUnit: 'Nm³', standardCoalFactor: 0.04, standardCoalFactorUnit: 'kgce/Nm³', remark: '内部能源介质；参考值，企业可按实测耗电量/产气量修正' },
];

const seedEnergyRecords: V11EnergyRecord[] = [
  { energyRecordId: 'v11-er-30', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [12710000,12555000,13082000,13330000,13578000,13795000,14012000,13888000,13671000,13609000,13826000,14229000] },
  { energyRecordId: 'v11-er-31', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-coal', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [6900,6700,7050,7200,7300,7400,7520,7460,7350,7280,7420,8160] },
  { energyRecordId: 'v11-er-32', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-rdf', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1600,1550,1680,1750,1800,1850,1900,1880,1820,1780,1850,1940] },
  { energyRecordId: 'v11-er-33', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2991723,2942409,3041037,3090351,3149528,3188980,3228431,3215280,3172542,3129803,3188980,3287608] },
  { energyRecordId: 'v11-er-34', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-coal', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [6900,6700,7050,7200,7300,7400,7520,7460,7350,7280,7420,8160] },
  { energyRecordId: 'v11-er-35', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-rdf', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1600,1550,1680,1750,1800,1850,1900,1880,1820,1780,1850,1940] },
  { energyRecordId: 'v11-er-36', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-gas-boiler', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [112000,108000,118000,121000,126000,129000,132000,131000,128000,125000,127000,136000] },
  { energyRecordId: 'v11-er-51', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-compressed-air', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [146000,140000,151000,154000,159000,163000,168000,165000,160000,157000,164000,171000] },
  { energyRecordId: 'v11-er-49', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-production-processing', energyRole: '回收能源', energyTypeId: 'v11-energy-waste-heat', entryMode: 'monthly', annualAmount: 0, sourceDeviceId: 'v11-device-74', monthlyAmounts: [6500,6200,7000,7200,7400,7600,7800,7600,7200,7000,7600,5900] },
  // 回收能源来源示例：这些是中央能源记录，后续可被能源直接利用与转换记录关联。
  { energyRecordId: 'v11-er-recovery-device-70', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', energyRole: '回收能源', energyTypeId: 'v11-energy-waste-heat', entryMode: 'monthly', annualAmount: 0, sourceDeviceId: 'v11-device-70', monthlyAmounts: [1250,1180,1320,1380,1450,1510,1580,1540,1460,1390,1500,1620] },
  { energyRecordId: 'v11-er-recovery-device-62', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-compressed-air', energyRole: '回收能源', energyTypeId: 'v11-energy-waste-heat', entryMode: 'monthly', annualAmount: 0, sourceDeviceId: 'v11-device-62', monthlyAmounts: [980,930,1040,1090,1160,1210,1280,1240,1170,1110,1200,1300] },
  { energyRecordId: 'v11-er-recovery-device-82', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-gas-boiler', energyRole: '回收能源', energyTypeId: 'v11-energy-waste-heat', entryMode: 'monthly', annualAmount: 0, sourceDeviceId: 'v11-device-82', monthlyAmounts: [1680,1590,1780,1860,1950,2040,2140,2080,1980,1880,2020,2200] },
  { energyRecordId: 'v11-er-37', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [8000000,7800000,8100000,8200000,8300000,8400000,8500000,8400000,8300000,8200000,8400000,9400000] },
  { energyRecordId: 'v11-er-38', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2500,2500,2500,2500,2500,2500,2500,2500,2500,2500,2500,2500] },
  { energyRecordId: 'v11-er-39', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [25000,25000,25000,25000,25000,25000,25000,25000,25000,25000,25000,25000] },
  { energyRecordId: 'v11-er-43', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-office', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [240000,235000,245000,250000,255000,260000,265000,260000,255000,250000,260000,260000] },
  { energyRecordId: 'v11-er-52', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-public-support', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [185000,180000,190000,195000,202000,208000,214000,210000,204000,198000,206000,220000] },
  { energyRecordId: 'v11-er-44', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [137000,133000,143000,146000,151000,154000,157000,156000,153000,150000,152000,161000] },
  { energyRecordId: 'v11-er-45', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000] },
  { energyRecordId: 'v11-er-device-60', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-60', energyUnitId: 'eu-raw-material', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [252000,248000,260000,265000,271000,276000,282000,279000,274000,270000,278000,285000] },
  { energyRecordId: 'v11-er-device-62', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-62', energyUnitId: 'eu-compressed-air', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [92000,88000,95000,97000,101000,104000,108000,106000,102000,99000,105000,110000] },
  { energyRecordId: 'v11-er-device-63', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-63', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [115000,112000,118000,120000,123000,125000,128000,126000,124000,121000,126000,130000] },
  { energyRecordId: 'v11-er-device-64', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-64', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [42000,40000,43500,44800,46200,47000,48100,47600,46500,45500,46800,47200] },
  { energyRecordId: 'v11-er-device-66', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-66', energyUnitId: 'eu-raw-material', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [94000,90000,97000,99000,101000,103000,105000,104000,101000,100000,103000,107000] },
  { energyRecordId: 'v11-er-device-70', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-70', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [185000,182000,190000,194000,198000,201000,205000,203000,199000,196000,202000,210000] },
  { energyRecordId: 'v11-er-device-74', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-74', energyUnitId: 'eu-production-processing', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [126000,123000,130000,133000,136000,138000,142000,140000,137000,134000,139000,141000] },
  { energyRecordId: 'v11-er-device-78', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-78', energyUnitId: 'eu-utilities', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [72000,70000,73500,75000,77000,78500,80000,79200,77500,76000,78000,81000] },
  { energyRecordId: 'v11-er-device-79', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-79', energyUnitId: 'eu-compressed-air', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [106000,103000,110000,112000,115000,118000,120000,119000,116000,114000,0,0], monthlyReportedMonths: [true,true,true,true,true,true,true,true,true,true,false,false] },
  { energyRecordId: 'v11-er-device-81', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-81', energyUnitId: 'eu-waste-heat-power', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [54000,52000,56000,57000,58000,59000,60000,59500,58000,57000,59000,61000] },
  { energyRecordId: 'v11-er-device-82', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-82', energyUnitId: 'eu-gas-boiler', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [78000,75000,81000,83500,86000,88000,90000,89500,87000,85000,88000,93000] },
];

// 查询页使用的公辅系统归属数据，统一维护在能源数据 Tab，避免分析页自行拼接。
seedEnergyRecords.push(
  { energyRecordId: 'v11-er-46', year: 2026, scopeLevel: seedEnergyRecords[1].scopeLevel, energyUnitId: 'eu-utilities', energyRole: seedEnergyRecords[0].energyRole, energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2100000,2050000,2150000,2200000,2250000,2300000,2350000,2320000,2280000,2240000,2300000,2400000] },
  // 锅炉产汽已经通过转换记录进入能流；这里仅维护扣除外供后的一级分配结果，避免同一批蒸汽重复计入。
  { energyRecordId: 'v11-er-47', year: 2026, scopeLevel: seedEnergyRecords[1].scopeLevel, energyUnitId: 'eu-utilities', energyRole: seedEnergyRecords[0].energyRole, energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2400,2200,2500,2550,2750,2950,3000,2850,2650,2550,2750,2850] },
  { energyRecordId: 'v11-er-48', year: 2026, scopeLevel: seedEnergyRecords[1].scopeLevel, energyUnitId: 'eu-utilities', energyRole: seedEnergyRecords[0].energyRole, energyTypeId: 'v11-energy-compressed-air', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [900000,880000,920000,940000,960000,980000,1000000,990000,970000,950000,980000,1020000] },
);

const historyScaling: Record<number, number> = {
  2022: 0.865,
  2023: 0.902,
  2024: 0.936,
  2025: 0.969,
};
const historySourceRecords = seedEnergyRecords.filter((record) => record.year === 2026 && record.scopeType !== 'device');

// 历史年度沿用 2026 年已确认的能源结构和季节性，并体现产能逐年提升后的合理增长。
seedEnergyRecords.push(...historySourceRecords.flatMap((source) => {
  return Object.entries(historyScaling).map(([year, factor]) => ({
    ...source,
    energyRecordId: `${source.energyRecordId}-${year}`,
    year: Number(year),
    monthlyAmounts: source.monthlyAmounts.map((amount) => Math.round(amount * factor)),
  }));
}));

const seedEnergyCosts: V11EnergyCost[] = [
  { energyCostId: 'v11-cost-40', year: 2026, energyTypeId: 'v11-energy-electricity', monthlyCosts: [310,306,318,325,330,334,339,336,331,329,335,345] },
  { energyCostId: 'v11-cost-41', year: 2026, energyTypeId: 'v11-energy-coal', monthlyCosts: [78,75,80,82,83,84,86,85,84,83,85,93] },
  { energyCostId: 'v11-cost-42', year: 2026, energyTypeId: 'v11-energy-rdf', monthlyCosts: [13,12.5,13.4,14,14.5,14.8,15.2,15,14.6,14.2,14.8,15.5] },
  { energyCostId: 'v11-cost-43', year: 2026, energyTypeId: 'v11-energy-natural-gas', monthlyCosts: [32.4,31.6,33.8,34.7,36.1,36.8,37.9,37.4,36.6,35.9,36.7,39.2] },
  { energyCostId: 'v11-cost-44', year: 2026, energyTypeId: 'v11-energy-steam', monthlyCosts: [5.1,5.1,5.2,5.2,5.3,5.3,5.4,5.3,5.3,5.2,5.3,5.4] },
];

const seedConversionOutputs: V11ConversionOutput[] = [
  { conversionOutputId: 'v11-output-200', year: 2026, recordType: '余热发电', conversionEnergyUnitId: 'eu-waste-heat-power', inputMode: 'recovery', inputEnergyRecordId: 'v11-er-49', recoverySourceEnergyUnitId: 'eu-production-processing', recoveryEnergyName: '余热', recoveryAmount: 85000, recoveryUnit: 'GJ', monthlyInputAmounts: [6500,6200,7000,7200,7400,7600,7800,7600,7200,7000,7600,5900], outputAnalysisCategory: '电力', outputEnergyTypeId: 'v11-energy-electricity', outputEnergyName: '电力', outputUnit: 'kWh', outputAmount: 18300000, monthlyOutputAmounts: [1400000,1350000,1450000,1500000,1550000,1600000,1650000,1600000,1500000,1450000,1600000,1650000], internalAmount: 16300000, monthlyInternalAmounts: [1300000,1250000,1300000,1350000,1400000,1450000,1450000,1450000,1350000,1300000,1400000,1300000], externalAmount: 2000000, monthlyExternalAmounts: [100000,100000,150000,150000,150000,150000,200000,150000,150000,150000,200000,350000], lossAmount: 0, remark: '生产加工过程余热经能源回收系统转换为电力。' },
  { conversionOutputId: 'v11-output-201', year: 2026, recordType: '锅炉产汽/产热', conversionEnergyUnitId: 'eu-gas-boiler', inputMode: 'linked', inputEnergyRecordId: 'v11-er-36', outputAnalysisCategory: '热力', outputEnergyTypeId: 'v11-energy-steam', outputEnergyName: '蒸汽', outputUnit: 'GJ', outputAmount: 52000, monthlyOutputAmounts: [4000,3800,4200,4300,4500,4600,4700,4500,4300,4200,4400,4500], internalAmount: 50000, monthlyInternalAmounts: [3900,3700,4050,4150,4350,4450,4500,4350,4150,4050,4200,4150], externalAmount: 2000, monthlyExternalAmounts: [100,100,150,150,150,150,200,150,150,150,200,350], lossAmount: 0, remark: '天然气经锅炉系统转换为蒸汽。' },
  { conversionOutputId: 'v11-output-202', year: 2026, recordType: '回收利用', conversionEnergyUnitId: 'eu-waste-heat-utilization', inputMode: 'recovery', inputEnergyRecordId: 'v11-er-recovery-device-70', recoverySourceEnergyUnitId: 'eu-cement-grinding-line', recoveryEnergyName: '余热', recoveryAmount: 17180, recoveryUnit: 'GJ', monthlyInputAmounts: [1250,1180,1320,1380,1450,1510,1580,1540,1460,1390,1500,1620], outputAnalysisCategory: '回收能源', outputEnergyTypeId: 'v11-energy-recovered-steam', outputEnergyName: '回收蒸汽', outputUnit: 'GJ', outputAmount: 12500, monthlyOutputAmounts: [900,850,950,1000,1050,1100,1150,1120,1060,1020,1100,1200], internalAmount: 12260, monthlyInternalAmounts: [880,830,930,980,1030,1080,1130,1100,1040,1000,1080,1180], externalAmount: 0, monthlyExternalAmounts: [0,0,0,0,0,0,0,0,0,0,0,0], lossAmount: 240, monthlyLossAmounts: [20,20,20,20,20,20,20,20,20,20,20,20], outputTargetEnergyUnitId: 'eu-production-processing', receiver: '', remark: '1#注塑机冷却系统产生的余热，经余热回收利用系统转换为回收蒸汽，供生产加工区域厂内使用。' },
];

// Keep historical analysis connected to the same conversion chain as the current year.
// Historical input record IDs point to the corresponding scaled energy records above.
const historicalConversionOutputs = Object.entries(historyScaling).flatMap(([year, factor]) =>
  seedConversionOutputs.map((source) => ({
    ...source,
    conversionOutputId: `${source.conversionOutputId}-${year}`,
    year: Number(year),
    inputEnergyRecordId: source.inputEnergyRecordId ? `${source.inputEnergyRecordId}-${year}` : undefined,
    recoveryAmount: source.recoveryAmount == null ? source.recoveryAmount : Math.round(source.recoveryAmount * factor),
    inputAmount: source.inputAmount == null ? source.inputAmount : Math.round(source.inputAmount * factor),
    outputAmount: source.outputAmount == null ? source.outputAmount : Math.round(source.outputAmount * factor),
    internalAmount: source.internalAmount == null ? source.internalAmount : Math.round(source.internalAmount * factor),
    externalAmount: Math.round(source.externalAmount * factor),
    lossAmount: source.lossAmount == null ? source.lossAmount : Math.round(source.lossAmount * factor),
    monthlyInputAmounts: source.monthlyInputAmounts?.map((amount) => Math.round(amount * factor)),
    monthlyOutputAmounts: source.monthlyOutputAmounts?.map((amount) => Math.round(amount * factor)),
    monthlyInternalAmounts: source.monthlyInternalAmounts?.map((amount) => Math.round(amount * factor)),
    monthlyExternalAmounts: source.monthlyExternalAmounts?.map((amount) => Math.round(amount * factor)),
    monthlyLossAmounts: source.monthlyLossAmounts?.map((amount) => Math.round(amount * factor)),
  })),
);
const seedCompressedAirConversion: V11ConversionOutput = {
  conversionOutputId: 'v11-output-compressed-air-2026',
  year: 2026,
  recordType: '空压产气/压缩空气',
  conversionEnergyUnitId: 'eu-compressed-air',
  inputMode: 'linked',
  inputEnergyRecordId: 'v11-er-51',
  inputAnalysisCategory: '电力',
  inputEnergyTypeId: 'v11-energy-electricity',
  inputUnit: 'kWh',
  outputAnalysisCategory: '其他能源',
  outputEnergyTypeId: 'v11-energy-compressed-air',
  outputEnergyName: '压缩空气',
  outputUnit: 'Nm³',
  outputAmount: 11490000,
  monthlyOutputAmounts: [900000,880000,920000,940000,960000,980000,1000000,990000,970000,950000,980000,1020000],
  internalAmount: 11490000,
  monthlyInternalAmounts: [900000,880000,920000,940000,960000,980000,1000000,990000,970000,950000,980000,1020000],
  externalAmount: 0,
  monthlyExternalAmounts: Array(12).fill(0),
  lossAmount: 0,
  outputTargetEnergyUnitId: 'eu-utilities',
  receiver: '',
  remark: '空压机电力投入转换为压缩空气，供厂内用气设备使用。',
};
const allSeedConversionOutputs = [...seedConversionOutputs, ...historicalConversionOutputs, seedCompressedAirConversion];

const seedOperations: V11OperationMetric[] = [
  { operationMetricId: 'v11-operation-50', metricCode: 'industrial_added_value', productId: null, year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '经济指标', aggregationMethod: '年度单值', metricName: '工业增加值', metricUnit: '万元', entryMode: 'annual', annualValue: 56000, monthlyValues: [] },
  { operationMetricId: 'v11-operation-55', metricCode: 'product_output', productId: null, year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '产量', aggregationMethod: '月度求和', metricName: '企业产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [22500,21800,23200,23800,24500,24900,25200,25100,24700,24400,25000,26000] },
  { operationMetricId: 'v11-operation-product-a-enterprise', metricCode: 'product_output', productId: 'product-a', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '年度单值', metricName: '产品产量', metricUnit: 't', entryMode: 'annual', annualValue: 956700, monthlyValues: [] },
  { operationMetricId: 'v11-operation-56', metricCode: 'industrial_output_value', productId: null, year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '经济指标', aggregationMethod: '年度单值', metricName: '工业总产值', metricUnit: '万元', entryMode: 'annual', annualValue: 286000, monthlyValues: [] },
  { operationMetricId: 'v11-operation-51', metricCode: 'product_output', productId: 'product-a', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [76000,73500,78000,79200,80500,81200,82000,81600,80400,79800,81000,83500] },
  { operationMetricId: 'v11-operation-53', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [30000,28500,31000,31500,32000,32500,33000,32800,32200,31800,32500,33800] },
  { operationMetricId: 'v11-operation-product-b-annual', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '年度单值', metricName: '产品产量', metricUnit: 't', entryMode: 'annual', annualValue: 1260000, monthlyValues: [] },
  { operationMetricId: 'v11-operation-product-b-monthly', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [7600,7350,7800,7900,8000,7400,8200,8100,8000,7900,8100,8400] },
  { operationMetricId: 'v11-operation-utility-volume', metricCode: 'energy_supply', productId: null, year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-utilities', metricCategory: '运行指标', aggregationMethod: '月度求和', metricName: '动力中心供能量', metricUnit: 'GJ', entryMode: 'monthly', annualValue: 0, monthlyValues: [420,405,438,450,465,480,495,488,472,460,478,510] },
  { operationMetricId: 'v11-operation-office-area', metricCode: 'building_area', productId: null, year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-office', metricCategory: '运行指标', aggregationMethod: '年度单值', metricName: '办公建筑面积', metricUnit: 'm²', entryMode: 'annual', annualValue: 18500, monthlyValues: [] },
  { operationMetricId: 'v11-operation-warehouse-volume', metricCode: 'logistics_throughput', productId: null, year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-public-support', metricCategory: '运行指标', aggregationMethod: '月度求和', metricName: '货物吞吐量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [205,198,214,220,230,238,245,240,232,225,236,252] },
  // 2025 年保留同一产量口径，用于同比计算；异常应由真实数据变化触发，而不是由断崖式 mock 值制造。
  { operationMetricId: 'v11-operation-product-b-2025-baseline', metricCode: 'product_output', productId: 'product-b', year: 2025, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [7600,7350,7800,7900,8000,8000,8200,8100,8000,7900,8100,8400] },
];

/** 重点用能设备字典样例：仅保留具有显著用能、独立计量或优化价值的典型设备。 */
const operationHistoryScaling: Record<number, number> = {
  2022: 0.830,
  2023: 0.868,
  2024: 0.910,
  2025: 0.955,
};
// 生产车间B 已提供一份明确的 2025 基线。不要再把 2026 月度记录复制成另一份 2025
// 历史记录，否则同比计算会把同一产量口径重复计入，导致同比被不合理放大。
const operationHistorySources = seedOperations
  .filter((source) => ![
    'v11-operation-product-b-monthly',
    'v11-operation-product-b-2025-baseline',
  ].includes(source.operationMetricId))
  .map(cloneOperation);

// 产量和经营指标的历史增长略快于能源消费，反映产能爬坡及单位能耗逐年改善。
seedOperations.push(...operationHistorySources.flatMap((source) => Object.entries(operationHistoryScaling).map(([year, factor]) => ({
  ...source,
  operationMetricId: `${source.operationMetricId}-${year}`,
  year: Number(year),
  annualValue: source.annualValue ? Math.round(source.annualValue * factor) : 0,
  monthlyValues: source.monthlyValues.map((value) => Math.round(value * factor)),
}))));


const industrialDeviceDictionary: V11KeyDevice[] = [
  { deviceId: 'v11-device-60', deviceName: '1#数控加工中心', deviceType: '加工设备', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '加工件产量', remark: '三轴数控加工，生产车间A重点用电设备' },
  { deviceId: 'v11-device-63', deviceName: '2#数控加工中心', deviceType: '加工设备', energyUnitId: 'eu-clinker-line-1', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '加工件产量', remark: '五轴数控加工，直属生产车间A' },
  { deviceId: 'v11-device-64', deviceName: '连续式热处理炉', deviceType: '加热/锅炉设备', energyUnitId: 'eu-clinker-line-1', mainEnergyTypeId: 'v11-energy-natural-gas', outputBasis: '热处理件产量', remark: '天然气加热，直属生产车间A' },
  { deviceId: 'v11-device-66', deviceName: '颚式破碎机', deviceType: '加工设备', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '原料处理量', remark: '原料预处理重点设备' },
  { deviceId: 'v11-device-70', deviceName: '1#注塑机', deviceType: '加工设备', energyUnitId: 'eu-cement-grinding-line', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '注塑件产量', remark: '直属生产车间B的主生产设备' },
  { deviceId: 'v11-device-74', deviceName: '自动喷涂线', deviceType: '表面处理设备', energyUnitId: 'eu-production-processing', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '喷涂面积', remark: '喷涂及输送联动生产线' },
  { deviceId: 'v11-device-78', deviceName: '冷却水循环泵组', deviceType: '泵类', energyUnitId: 'eu-utilities', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '循环水量', remark: '直属动力中心的公辅循环设备' },
  { deviceId: 'v11-device-62', deviceName: '1#螺杆空压机', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '供气量', remark: '额定排气量 20m³/min' },
  { deviceId: 'v11-device-79', deviceName: '2#螺杆空压机', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '供气量', remark: '备用及调峰空压设备' },
  { deviceId: 'v11-device-81', deviceName: '余热发电机组', deviceType: '能源转换设备', energyUnitId: 'eu-waste-heat-power', mainEnergyTypeId: 'v11-energy-electricity', outputBasis: '发电量', remark: '余热回收发电辅助用电设备' },
  { deviceId: 'v11-device-82', deviceName: '2t/h天然气蒸汽锅炉', deviceType: '加热/锅炉设备', energyUnitId: 'eu-gas-boiler', mainEnergyTypeId: 'v11-energy-natural-gas', outputBasis: '蒸汽产量', remark: '公辅蒸汽供应设备' },
];

const seedDevices = industrialDeviceDictionary.map((item) => ({ ...item }));

let energyTypes = seedEnergyTypes.map((item) => ({ ...item }));
const disabledEnergyTypeIds = new Set<string>();
let energyRecords = seedEnergyRecords.map(cloneRecord);
let energyCosts = seedEnergyCosts.map(cloneCost);
let conversionOutputs = allSeedConversionOutputs.map((item) => ({
  ...item,
  outputTargetEnergyUnitId: item.outputTargetEnergyUnitId
    ?? (item.recordType === '锅炉产汽/产热' || item.recordType === '回收利用' ? 'eu-raw-material' : item.recordType === '余热发电' ? 'eu-production-processing' : undefined),
}));
let externalSupplyRecords: V11ExternalSupplyRecord[] = allSeedConversionOutputs
  .filter((item) => item.recordType === '直接外供' || (item.externalAmount ?? 0) > 0)
  .map((item) => ({
    externalSupplyId: `v11-external-legacy-${item.conversionOutputId}`,
    year: item.year,
    inputEnergyRecordId: item.recordType === '直接外供' ? item.inputEnergyRecordId : undefined,
    conversionOutputId: item.recordType === '直接外供' ? undefined : item.conversionOutputId,
    energyTypeId: item.outputEnergyTypeId ?? (item.recordType === '直接外供' ? undefined : item.inputEnergyTypeId),
    amount: item.recordType === '直接外供' ? item.externalAmount : (item.externalAmount ?? 0),
    unit: item.outputUnit ?? item.inputUnit,
    monthlyAmounts: item.monthlyExternalAmounts ? [...item.monthlyExternalAmounts] : undefined,
    receiver: item.receiver,
    remark: item.remark,
  }));
let operations = seedOperations.map(cloneOperation);
let devices = seedDevices.map((item) => ({ ...item }));
let sequence = 100;

function cloneRecord(item: V11EnergyRecord): V11EnergyRecord {
  const scopeType = item.scopeType
    ?? (item.scopeLevel === '企业' ? 'enterprise' : 'energyUnit');
  return {
    ...item,
    scopeType,
    scopeId: item.scopeId ?? (scopeType === 'enterprise' ? null : item.energyUnitId),
    monthlyAmounts: [...item.monthlyAmounts],
    monthlyReportedMonths: item.monthlyReportedMonths ? [...item.monthlyReportedMonths] : undefined,
  };
}
function cloneCost(item: V11EnergyCost): V11EnergyCost {
  return { ...item, monthlyCosts: [...item.monthlyCosts], monthlyReportedMonths: item.monthlyReportedMonths ? [...item.monthlyReportedMonths] : undefined };
}
function cloneOperation(item: V11OperationMetric): V11OperationMetric {
  return { ...item, monthlyValues: [...item.monthlyValues] };
}

// Balance completion: the source ledger contains level-one allocation while
// only a small part has level-two terminal data. Complete the missing
// terminal path at monthly granularity; annual totals then roll up naturally.
const annualCompletionChildren: Record<string, string[]> = {
  'eu-clinker-line-1': ['eu-raw-material', 'eu-clinker-burning', 'eu-quality-inspection'],
  'eu-cement-grinding-line': ['eu-cement-grinding', 'eu-production-processing', 'eu-packaging'],
  // Conversion systems have their own measured input/output records and must
  // not inherit every energy type from the parent utility center.
  'eu-utilities': ['eu-compressed-air'],
  'eu-office': ['eu-office-hvac'],
};
const energyTypeById = new Map(seedEnergyTypes.map((item) => [item.energyTypeId, item]));
const annualAmount = (record: V11EnergyRecord) => record.annualAmount > 0
  ? record.annualAmount
  : record.monthlyAmounts.reduce((total, value) => total + value, 0);
const linkedConversionInputs = new Set(
  conversionOutputs.map((item) => item.inputEnergyRecordId).filter(Boolean),
);
const completionCandidates = Object.entries(annualCompletionChildren).flatMap(([parentId, children]) => {
  const levelOne = energyRecords.filter((record) => record.year === 2026
    && record.energyUnitId === parentId
    && record.scopeType !== 'device'
    && !linkedConversionInputs.has(record.energyRecordId));
  const byType = new Map<string, number>();
  levelOne.forEach((record) => byType.set(record.energyTypeId,
    (byType.get(record.energyTypeId) ?? 0) + annualAmount(record)));
  const existingByType = new Map<string, number>();
  energyRecords.filter((record) => record.year === 2026
    && record.energyUnitId
    && children.includes(record.energyUnitId)
    && record.scopeType !== 'device'
    && !linkedConversionInputs.has(record.energyRecordId))
    .forEach((record) => existingByType.set(record.energyTypeId,
      (existingByType.get(record.energyTypeId) ?? 0) + annualAmount(record)));
  return [...byType.entries()].flatMap(([energyTypeId, allocatedPhysical]) => {
    const type = energyTypeById.get(energyTypeId);
    if (!type || type.standardCoalFactor <= 0) return [];
    const existingPhysical = existingByType.get(energyTypeId) ?? 0;
    const missingStandard = Math.max(allocatedPhysical - existingPhysical, 0) * type.standardCoalFactor
      / (type.standardCoalFactorUnit.startsWith('kgce') ? 1000 : 1);
    return children.map((childId, index) => ({
      energyRecordId: `v11-er-completion-${parentId}-${energyTypeId}-${index}`,
      parentId,
      childId,
      childCount: children.length,
      energyTypeId,
      missingStandard: missingStandard / children.length,
      factor: type.standardCoalFactor,
      factorUnit: type.standardCoalFactorUnit,
    }));
  });
});
const monthlyMissingByKey = new Map<string, number[]>();
Object.entries(annualCompletionChildren).forEach(([parentId, children]) => {
  const levelOne = energyRecords.filter((record) => record.year === 2026
    && record.energyUnitId === parentId
    && record.scopeType !== 'device'
    && !linkedConversionInputs.has(record.energyRecordId));
  const existing = energyRecords.filter((record) => record.year === 2026
    && record.energyUnitId
    && children.includes(record.energyUnitId)
    && record.scopeType !== 'device'
    && !linkedConversionInputs.has(record.energyRecordId));
  const typeIds = new Set([...levelOne, ...existing].map((record) => record.energyTypeId));
  typeIds.forEach((energyTypeId) => {
    const type = energyTypeById.get(energyTypeId);
    if (!type || type.standardCoalFactor <= 0) return;
    const values = Array.from({ length: 12 }, (_, month) => {
      const allocated = levelOne
        .filter((record) => record.energyTypeId === energyTypeId)
        .reduce((total, record) => total + (record.monthlyAmounts[month] ?? 0), 0);
      const used = existing
        .filter((record) => record.energyTypeId === energyTypeId)
        .reduce((total, record) => total + (record.monthlyAmounts[month] ?? 0), 0);
      return Math.max(allocated - used, 0) * type.standardCoalFactor
        / (type.standardCoalFactorUnit.startsWith('kgce') ? 1000 : 1);
    });
    monthlyMissingByKey.set(`${parentId}|${energyTypeId}`, values);
  });
});
const monthlyBranchStandard = Array.from({ length: 12 }, (_, month) => conversionOutputs.reduce((total, output) => {
  const outputType = energyTypeById.get(output.outputEnergyTypeId ?? '');
  const external = (output.monthlyExternalAmounts?.[month] ?? 0) * (outputType?.standardCoalFactor ?? 0)
    / (outputType?.standardCoalFactorUnit.startsWith('kgce') ? 1000 : 1);
  const recovery = output.inputMode === 'recovery'
    ? (output.monthlyInputAmounts?.[month] ?? 0) * (energyTypeById.get('v11-energy-waste-heat')?.standardCoalFactor ?? 0)
    : 0;
  return total + external + recovery;
}, 0));
const monthlyScale = Array.from({ length: 12 }, (_, month) => {
  const total = [...monthlyMissingByKey.values()].reduce((sum, values) => sum + values[month], 0);
  return total > 0 ? Math.max(total - monthlyBranchStandard[month], 0) / total : 0;
});
const completionRows = completionCandidates.map((row) => ({
  energyRecordId: row.energyRecordId,
  year: 2026,
  scopeLevel: '二级用能单元' as const,
  energyUnitId: row.childId,
  energyRole: '能源消费' as const,
  energyTypeId: row.energyTypeId,
  entryMode: 'monthly' as const,
  annualAmount: 0,
  monthlyAmounts: Array.from({ length: 12 }, (_, month) => {
    const missing = monthlyMissingByKey.get(`${row.parentId}|${row.energyTypeId}`)?.[month] ?? 0;
    return missing / row.childCount * monthlyScale[month]
      / row.factor * (row.factorUnit.startsWith('kgce') ? 1000 : 1);
  }),
}));

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function listV11EnergyTypes() { return energyTypes.map((item) => ({ ...item })); }
export function listV11EnergyTypeReferences(id: string): V11EnergyTypeReferenceSummary[] {
  const references: V11EnergyTypeReferenceSummary[] = [
    { kind: 'energyRecords', label: '能源数据', count: energyRecords.filter((item) => item.energyTypeId === id).length, path: `/data-management/energy-data?energyTypeId=${encodeURIComponent(id)}` },
    { kind: 'energyCosts', label: '能源成本', count: energyCosts.filter((item) => item.energyTypeId === id).length, path: `/data-management/energy-data?tab=costs&energyTypeId=${encodeURIComponent(id)}` },
    { kind: 'keyDevices', label: '重点设备', count: devices.filter((item) => item.mainEnergyTypeId === id).length, path: `/data-management/devices?energyTypeId=${encodeURIComponent(id)}` },
    { kind: 'conversionOutputs', label: '能源回收、转换与外供', count: conversionOutputs.filter((item) => item.inputEnergyTypeId === id || item.outputEnergyTypeId === id).length, path: `/data-management/energy-data?tab=recovery&energyTypeId=${encodeURIComponent(id)}` },
  ];
  return references.filter((item) => item.count > 0);
}
export function disableV11EnergyType(id: string) {
  if (!energyTypes.some((item) => item.energyTypeId === id)) return { ok: false as const, error: '能源品种不存在。' };
  disabledEnergyTypeIds.add(id);
  return { ok: true as const };
}
export function isV11EnergyTypeEnabled(id: string) { return !disabledEnergyTypeIds.has(id); }
export function listV11EnergyRecords() { return energyRecords.map(cloneRecord); }
export function listV11EnergyCosts() { return energyCosts.map(cloneCost); }
export function listV11ConversionOutputs() { return conversionOutputs.map((item) => ({ ...item })); }
export function listV11ExternalSupplyRecords() {
  return externalSupplyRecords.map((item) => ({ ...item, monthlyAmounts: item.monthlyAmounts ? [...item.monthlyAmounts] : undefined, evidenceNames: item.evidenceNames ? [...item.evidenceNames] : undefined }));
}
export function listV11OperationMetrics() { return operations.map(cloneOperation); }
export function listV11KeyDevices() { return devices.map((item) => ({ ...item })); }

export function v11RecordScopeType(record: V11EnergyRecord): EnergyRecordScopeType {
  return record.scopeType
    ?? (record.scopeLevel === '企业' ? 'enterprise' : 'energyUnit');
}

/**
 * 年度总量优先使用已补录的年度台账值；未补录时由已录月度值汇总。
 * 月度缺失不在此处自动分摊，避免将年度数据伪造成月度实测数据。
 */
export function v11EnergyRecordAnnualAmount(record: V11EnergyRecord) {
  const monthlyTotal = record.monthlyAmounts.reduce((sum, value) => sum + value, 0);
  return record.annualAmount > 0 ? record.annualAmount : monthlyTotal;
}

export function saveV11EnergyType(input: Omit<V11EnergyType, 'energyTypeId'>, id?: string) {
  if (energyTypes.some((item) => item.energyTypeName.trim() === input.energyTypeName.trim() && item.energyTypeId !== id)) return { ok: false as const, error: '能源品种名称不能重复。' };
  if (id) {
    const index = energyTypes.findIndex((item) => item.energyTypeId === id);
    if (index < 0) return { ok: false as const, error: '能源品种不存在。' };
    energyTypes[index] = { ...input, energyTypeId: id };
    return { ok: true as const };
  }
  energyTypes.push({ ...input, energyTypeId: nextId('v11-energy') });
  return { ok: true as const };
}

export function deleteV11EnergyType(id: string) {
  const references = energyRecords.filter((item) => item.energyTypeId === id).length
    + energyCosts.filter((item) => item.energyTypeId === id).length
    + devices.filter((item) => item.mainEnergyTypeId === id).length
    + conversionOutputs.filter((item) => item.inputEnergyTypeId === id || item.outputEnergyTypeId === id).length;
  if (references) return { ok: false as const, error: `该能源品种存在 ${references} 条业务引用，不能删除。` };
  energyTypes = energyTypes.filter((item) => item.energyTypeId !== id);
  return { ok: true as const };
}

export function saveV11EnergyRecord(input: Omit<V11EnergyRecord, 'energyRecordId'>, id?: string) {
  const scopeType = input.scopeType
    ?? (input.scopeLevel === '企业' ? 'enterprise' : 'energyUnit');
  const scopeId = input.scopeId ?? (scopeType === 'enterprise' ? null : input.energyUnitId);
  const monthlyTotal = input.monthlyAmounts.reduce((sum, value) => sum + value, 0);
  if (!(monthlyTotal > 0) && !(input.annualAmount > 0)) {
    return { ok: false as const, error: '请至少填写一个月度数据，或补录年度总量。' };
  }
  if (input.annualAmount > 0 && input.annualAmount < monthlyTotal) {
    return { ok: false as const, error: '年度总量不能小于已填报月份合计。' };
  }
  const normalized = {
    ...input,
    entryMode: monthlyTotal > 0 ? 'monthly' as const : 'annual' as const,
    scopeType,
    scopeId,
  };
  const duplicate = energyRecords.some((item) => {
    const current = cloneRecord(item);
    return item.energyRecordId !== id
      && item.year === input.year
      && item.energyRole === input.energyRole
      && current.scopeType === scopeType
      && current.scopeId === scopeId
      && item.energyTypeId === input.energyTypeId;
  });
  if (duplicate) return { ok: false as const, error: '同一年度、归属对象和能源品种只能维护一条能源消费记录。' };
  if (id) {
    const index = energyRecords.findIndex((item) => item.energyRecordId === id);
    if (index < 0) return { ok: false as const, error: '能源数据不存在。' };
    energyRecords[index] = {
      ...normalized,
      energyRecordId: id,
      monthlyAmounts: [...input.monthlyAmounts],
      monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined,
    };
    return { ok: true as const };
  }
  energyRecords.push({
    ...normalized,
    energyRecordId: nextId('v11-er'),
    monthlyAmounts: [...input.monthlyAmounts],
    monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined,
  });
  return { ok: true as const };
}

export function deleteV11EnergyRecord(id: string) {
  const count = conversionOutputs.filter((item) => item.inputEnergyRecordId === id).length;
  const externalCount = externalSupplyRecords.filter((item) => item.inputEnergyRecordId === id).length;
  if (count || externalCount) return { ok: false as const, error: `该能源数据被 ${count + externalCount} 条能源转换或外供记录引用，不能删除。` };
  energyRecords = energyRecords.filter((item) => item.energyRecordId !== id);
  return { ok: true as const };
}

export function saveV11EnergyCost(input: Omit<V11EnergyCost, 'energyCostId'>, id?: string) {
  if (energyCosts.some((item) => item.energyCostId !== id && item.year === input.year && item.energyTypeId === input.energyTypeId)) return { ok: false as const, error: '同一年度和能源品种只能维护一条成本数据。' };
  if (id) {
    const index = energyCosts.findIndex((item) => item.energyCostId === id);
    if (index < 0) return { ok: false as const, error: '能源成本不存在。' };
    energyCosts[index] = { ...input, energyCostId: id, monthlyCosts: [...input.monthlyCosts], monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined };
  } else energyCosts.push({ ...input, energyCostId: nextId('v11-cost'), monthlyCosts: [...input.monthlyCosts], monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined });
  return { ok: true as const };
}

export function deleteV11EnergyCost(id: string) {
  energyCosts = energyCosts.filter((item) => item.energyCostId !== id);
}

export function saveV11ConversionOutput(input: Omit<V11ConversionOutput, 'conversionOutputId'>, id?: string) {
  const normalizedInput = {
    ...input,
    // 兼容历史记录：旧调用未提供产出去向时，暂以转换系统作为默认去向。
    outputTargetEnergyUnitId: input.outputTargetEnergyUnitId ?? (input.recordType === '回收利用' ? 'eu-raw-material' : input.recordType !== '直接外供' ? input.conversionEnergyUnitId ?? undefined : undefined),
  };
  const duplicate = conversionOutputs.some((item) =>
    item.conversionOutputId !== id
    && item.year === normalizedInput.year
    && item.recordType === normalizedInput.recordType
    && item.conversionEnergyUnitId === normalizedInput.conversionEnergyUnitId,
  );
  if (duplicate) return { ok: false as const, error: '该年度、该系统的同类业务记录已维护，请编辑已有记录。' };
  const amounts = [
    normalizedInput.outputAmount ?? 0,
    normalizedInput.internalAmount ?? 0,
    normalizedInput.externalAmount,
    normalizedInput.lossAmount ?? 0,
  ];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return { ok: false as const, error: '产出、内部去向、外部输出和损失量不能为负数。' };
  }
  if (normalizedInput.externalAmount > (normalizedInput.outputAmount ?? 0)) {
    return { ok: false as const, error: '外部输出量不能超过能源产出总量。' };
  }
  const monthlyFields = [
    normalizedInput.monthlyInputAmounts,
    normalizedInput.monthlyOutputAmounts,
    normalizedInput.monthlyInternalAmounts,
    normalizedInput.monthlyExternalAmounts,
    normalizedInput.monthlyLossAmounts,
  ].filter((values): values is number[] => Boolean(values));
  if (monthlyFields.some((values) => values.length !== 12 || values.some((value) => !Number.isFinite(value) || value < 0))) {
    return { ok: false as const, error: '转换月度数据必须填写12个月且不能为负数。' };
  }
  if (normalizedInput.monthlyOutputAmounts) {
    for (let index = 0; index < 12; index += 1) {
      const assigned = (normalizedInput.monthlyInternalAmounts?.[index] ?? 0)
        + (normalizedInput.monthlyExternalAmounts?.[index] ?? 0)
        + (normalizedInput.monthlyLossAmounts?.[index] ?? 0);
      if (Math.abs(normalizedInput.monthlyOutputAmounts[index] - assigned) > 1e-8) {
        return { ok: false as const, error: '转换月度产出与内部使用、外供及损失不平衡。' };
      }
    }
  }
  if (normalizedInput.inputMode === 'linked') {
    if (!normalizedInput.inputEnergyRecordId) return { ok: false as const, error: '关联投入模式必须选择上游能源数据记录。' };
    const source = energyRecords.find((item) => item.energyRecordId === normalizedInput.inputEnergyRecordId);
    if (!source) return { ok: false as const, error: '关联的投入能源数据不存在。' };
    if (source.year !== normalizedInput.year) return { ok: false as const, error: '转换记录与投入能源数据必须属于同一年度。' };
    if (!['能源消费', '回收能源'].includes(source.energyRole)) {
      return { ok: false as const, error: '只有能源消费或回收能源记录可以作为转换投入。' };
    }
  }
  if (normalizedInput.inputEnergyRecordId) {
    const source = energyRecords.find((item) => item.energyRecordId === normalizedInput.inputEnergyRecordId);
    const recoveryAlreadyUsed = source?.energyRole === '回收能源'
      && conversionOutputs.some((item) =>
        item.conversionOutputId !== id
        && item.inputEnergyRecordId === normalizedInput.inputEnergyRecordId);
    if (recoveryAlreadyUsed) {
      return { ok: false as const, error: '同一回收能源来源只能关联一条转换记录，避免重复计入能流。' };
    }
  }
  if (normalizedInput.inputMode === 'recovery'
    && (!(normalizedInput.recoveryAmount ?? 0) || !normalizedInput.recoveryEnergyName)) {
    return { ok: false as const, error: '回收能源模式必须填写回收能源品种和投入量。' };
  }
  if (normalizedInput.recordType === '直接外供' && normalizedInput.inputEnergyRecordId) {
    const source = energyRecords.find((item) => item.energyRecordId === normalizedInput.inputEnergyRecordId);
    if (!source) return { ok: false as const, error: '外供来源能源数据不存在。' };
    const sourceAmount = v11EnergyRecordAnnualAmount(source);
    if (normalizedInput.externalAmount > sourceAmount) return { ok: false as const, error: '外供量不能超过来源能源数据的年度总量。' };
  }
  if (normalizedInput.recordType !== '直接外供') {
    if (normalizedInput.outputTargetEnergyUnitId) {
      const targetUnit = listEnergyUnits().find((unit) => unit.energyUnitId === normalizedInput.outputTargetEnergyUnitId);
      if (!targetUnit || targetUnit.unitLevel === 'enterprise') return { ok: false as const, error: '产出去向必须绑定一级或二级用能单元。' };
    }
    const assigned = (normalizedInput.internalAmount ?? 0) + normalizedInput.externalAmount + (normalizedInput.lossAmount ?? 0);
    if (Math.abs((normalizedInput.outputAmount ?? 0) - assigned) > 1e-8) return { ok: false as const, error: '产出总量与内部使用、外供及损失/未分配量不平衡。' };
  }
  if (id) {
    const index = conversionOutputs.findIndex((item) => item.conversionOutputId === id);
    if (index < 0) return { ok: false as const, error: '能源转换/输出记录不存在。' };
    conversionOutputs[index] = { ...normalizedInput, conversionOutputId: id };
    syncLegacyExternalSupply(normalizedInput, id);
  } else {
    const newId = nextId('v11-output');
    conversionOutputs.push({ ...normalizedInput, conversionOutputId: newId });
    syncLegacyExternalSupply(normalizedInput, newId);
  }
  return { ok: true as const };
}

function syncLegacyExternalSupply(input: Omit<V11ConversionOutput, 'conversionOutputId'>, conversionOutputId: string) {
  if (input.recordType === '直接外供') {
    const existing = externalSupplyRecords.find((item) => item.externalSupplyId === `v11-external-legacy-${conversionOutputId}`);
    const next = {
      externalSupplyId: existing?.externalSupplyId ?? `v11-external-legacy-${conversionOutputId}`,
      year: input.year,
      inputEnergyRecordId: input.inputEnergyRecordId,
      amount: input.externalAmount,
      unit: input.inputUnit,
      monthlyAmounts: input.monthlyExternalAmounts ? [...input.monthlyExternalAmounts] : undefined,
      receiver: input.receiver,
      remark: input.remark,
    } satisfies V11ExternalSupplyRecord;
    if (existing) Object.assign(existing, next);
    else externalSupplyRecords.push(next);
  } else if (input.externalAmount > 0) {
    const existing = externalSupplyRecords.find((item) => item.externalSupplyId === `v11-external-legacy-${conversionOutputId}`);
    const next = {
      externalSupplyId: existing?.externalSupplyId ?? `v11-external-legacy-${conversionOutputId}`,
      year: input.year,
      conversionOutputId,
      energyTypeId: input.outputEnergyTypeId,
      amount: input.externalAmount,
      unit: input.outputUnit,
      monthlyAmounts: input.monthlyExternalAmounts ? [...input.monthlyExternalAmounts] : undefined,
      receiver: input.receiver,
      remark: input.remark,
    } satisfies V11ExternalSupplyRecord;
    if (existing) Object.assign(existing, next);
    else externalSupplyRecords.push(next);
  } else {
    externalSupplyRecords = externalSupplyRecords.filter((item) => item.externalSupplyId !== `v11-external-legacy-${conversionOutputId}`);
  }
}

export function saveV11ExternalSupplyRecord(input: Omit<V11ExternalSupplyRecord, 'externalSupplyId'>, id?: string) {
  const amounts = [input.amount, ...(input.monthlyAmounts ?? [])];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return { ok: false as const, error: '外供量不能为负数。' };
  }
  if (!input.inputEnergyRecordId && !input.conversionOutputId) {
    return { ok: false as const, error: '外供记录必须关联企业级能源数据或转换产出。' };
  }
  if (input.inputEnergyRecordId && input.conversionOutputId) {
    return { ok: false as const, error: '外供记录只能选择一种来源。' };
  }
  if (input.inputEnergyRecordId) {
    const source = energyRecords.find((record) => record.energyRecordId === input.inputEnergyRecordId);
    if (!source) return { ok: false as const, error: '直接转供来源能源数据不存在。' };
    if (source.year !== input.year) return { ok: false as const, error: '直接转供来源与外供年度不一致。' };
    if (source.scopeType !== 'enterprise' || source.energyUnitId !== null) {
      return { ok: false as const, error: '直接转供只能关联企业级能源输入，不能关联厂内用能单元数据。' };
    }
    const siblingSupplies = externalSupplyRecords.filter((item) =>
      item.inputEnergyRecordId === input.inputEnergyRecordId && item.externalSupplyId !== id,
    );
    const annualExternal = siblingSupplies.reduce((total, item) => total + item.amount, 0) + input.amount;
    if (annualExternal > v11EnergyRecordAnnualAmount(source)) {
      return { ok: false as const, error: '直接转供量不能超过企业级能源输入总量。' };
    }
    if (input.monthlyAmounts) {
      const monthlyOverflow = input.monthlyAmounts.some((amount, index) => {
        const siblingAmount = siblingSupplies.reduce(
          (total, item) => total + (item.monthlyAmounts?.[index] ?? 0),
          0,
        );
        return siblingAmount + amount > (source.monthlyAmounts[index] ?? 0);
      });
      if (monthlyOverflow) return { ok: false as const, error: '直接转供月度合计不能超过对应月份企业级能源输入量。' };
    }
  }
  if (input.conversionOutputId) {
    const conversion = conversionOutputs.find((item) => item.conversionOutputId === input.conversionOutputId);
    if (!conversion) return { ok: false as const, error: '转换产出来源不存在。' };
    if (conversion.year !== input.year) return { ok: false as const, error: '转换产出与外供年度不一致。' };
    const siblingSupplies = externalSupplyRecords.filter((item) =>
      item.conversionOutputId === input.conversionOutputId && item.externalSupplyId !== id,
    );
    const annualExternal = siblingSupplies.reduce((total, item) => total + item.amount, 0) + input.amount;
    const externalCapacity = (conversion.outputAmount ?? 0)
      - (conversion.internalAmount ?? 0)
      - (conversion.lossAmount ?? 0);
    if (annualExternal > externalCapacity) {
      return { ok: false as const, error: '同一转换产出的外供合计不能超过扣除内部使用和损失后的可外供量。' };
    }
    if (input.monthlyAmounts && conversion.monthlyOutputAmounts) {
      const monthlyOverflow = input.monthlyAmounts.some((amount, index) => {
        const siblingAmount = siblingSupplies.reduce(
          (total, item) => total + (item.monthlyAmounts?.[index] ?? 0),
          0,
        );
        const externalCapacity = (conversion.monthlyOutputAmounts?.[index] ?? 0)
          - (conversion.monthlyInternalAmounts?.[index] ?? 0)
          - (conversion.monthlyLossAmounts?.[index] ?? 0);
        return siblingAmount + amount > externalCapacity;
      });
      if (monthlyOverflow) return { ok: false as const, error: '同一转换产出的月度外供合计不能超过扣除内部使用和损失后的可外供量。' };
    }
  }
  if (input.monthlyAmounts && input.monthlyAmounts.length !== 12) {
    return { ok: false as const, error: '外供月度数据必须填写12个月。' };
  }
  const record = { ...input, monthlyAmounts: input.monthlyAmounts ? [...input.monthlyAmounts] : undefined, evidenceNames: input.evidenceNames ? [...input.evidenceNames] : undefined };
  if (id) {
    const index = externalSupplyRecords.findIndex((item) => item.externalSupplyId === id);
    if (index < 0) return { ok: false as const, error: '能源外供记录不存在。' };
    externalSupplyRecords[index] = { ...record, externalSupplyId: id };
  } else externalSupplyRecords.push({ ...record, externalSupplyId: nextId('v11-external') });
  return { ok: true as const };
}

export function deleteV11ExternalSupplyRecord(id: string) {
  externalSupplyRecords = externalSupplyRecords.filter((item) => item.externalSupplyId !== id);
}

export function deleteV11ConversionOutput(id: string) {
  externalSupplyRecords = externalSupplyRecords.filter((item) => item.conversionOutputId !== id);
  conversionOutputs = conversionOutputs.filter((item) => item.conversionOutputId !== id);
}

export function saveV11OperationMetric(input: Omit<V11OperationMetric, 'operationMetricId'>, id?: string) {
  if (input.metricCode === 'product_output' && input.productId) {
    const productRecords = operations.filter((item) => item.operationMetricId !== id && item.year === input.year && item.metricCode === 'product_output' && item.productId === input.productId);
    const hasEnterpriseRecord = productRecords.some((item) => item.energyUnitId === null);
    const hasUnitRecord = productRecords.some((item) => item.energyUnitId !== null);
    if ((input.energyUnitId === null && hasUnitRecord) || (input.energyUnitId !== null && hasEnterpriseRecord)) {
      return { ok: false as const, error: '同一产品同一年度只能维护企业汇总口径或用能单元拆分口径，不能同时维护。' };
    }
  }
  const duplicate = operations.some((item) =>
    item.operationMetricId !== id
    && item.year === input.year
    && item.energyUnitId === input.energyUnitId
    && item.metricCode === input.metricCode
    && item.productId === input.productId);
  if (duplicate) return { ok: false as const, error: '相同年度、归属范围和指标名称的记录已存在。' };
  if (id) {
    const index = operations.findIndex((item) => item.operationMetricId === id);
    if (index < 0) return { ok: false as const, error: '运营数据不存在。' };
    operations[index] = { ...input, operationMetricId: id, monthlyValues: [...input.monthlyValues], monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined };
  } else operations.push({ ...input, operationMetricId: nextId('v11-operation'), monthlyValues: [...input.monthlyValues], monthlyReportedMonths: input.monthlyReportedMonths ? [...input.monthlyReportedMonths] : undefined });
  return { ok: true as const };
}

export function deleteV11OperationMetric(id: string) {
  operations = operations.filter((item) => item.operationMetricId !== id);
}

export function saveV11KeyDevice(input: Omit<V11KeyDevice, 'deviceId'>, id?: string) {
  if (devices.some((item) => item.deviceId !== id && item.deviceName.trim() === input.deviceName.trim())) return { ok: false as const, error: '重点设备名称不能重复。' };
  if (id) {
    const index = devices.findIndex((item) => item.deviceId === id);
    if (index < 0) return { ok: false as const, error: '重点设备不存在。' };
    devices[index] = { ...input, deviceId: id };
  } else devices.push({ ...input, deviceId: nextId('v11-device') });
  return { ok: true as const };
}

export function inspectV11KeyDeviceDeletion(id: string) {
  const energyRecordCount = energyRecords.filter((item) => {
    const record = cloneRecord(item);
    return record.scopeType === 'device' && record.scopeId === id;
  }).length;
  const targetCount = countBenchmarkTargets('device', id);
  const references = { energyRecordCount, benchmarkTargetCount: targetCount };
  if (energyRecordCount || targetCount) {
    return {
      ok: false as const,
      error: '该重点设备已关联能源数据或指标目标，暂不能删除。请先处理关联数据。',
      references,
    };
  }
  return { ok: true as const, references };
}

export function deleteV11KeyDevice(id: string) {
  const inspection = inspectV11KeyDeviceDeletion(id);
  if (!inspection.ok) return inspection;
  devices = devices.filter((item) => item.deviceId !== id);
  return { ok: true as const };
}

export function v11ScopeName(energyUnitId: string | null) {
  return energyUnitId ? listEnergyUnits().find((item) => item.energyUnitId === energyUnitId)?.energyUnitName ?? '未知单元' : '全厂';
}

export function resetDataManagementV11Store() {
  energyTypes = seedEnergyTypes.map((item) => ({ ...item }));
  disabledEnergyTypeIds.clear();
  energyRecords = seedEnergyRecords.map(cloneRecord);
  energyCosts = seedEnergyCosts.map(cloneCost);
  conversionOutputs = allSeedConversionOutputs.map((item) => ({
    ...item,
    outputTargetEnergyUnitId: item.outputTargetEnergyUnitId
      ?? (item.recordType === '锅炉产汽/产热' || item.recordType === '回收利用' ? 'eu-raw-material' : item.recordType === '余热发电' ? 'eu-production-processing' : undefined),
  }));
  externalSupplyRecords = allSeedConversionOutputs
    .filter((item) => item.recordType === '直接外供' || (item.externalAmount ?? 0) > 0)
    .map((item) => ({
      externalSupplyId: `v11-external-legacy-${item.conversionOutputId}`,
      year: item.year,
      inputEnergyRecordId: item.recordType === '直接外供' ? item.inputEnergyRecordId : undefined,
      conversionOutputId: item.recordType === '直接外供' ? undefined : item.conversionOutputId,
      energyTypeId: item.outputEnergyTypeId ?? item.inputEnergyTypeId,
      amount: item.externalAmount ?? 0,
      unit: item.outputUnit ?? item.inputUnit,
      monthlyAmounts: item.monthlyExternalAmounts ? [...item.monthlyExternalAmounts] : undefined,
      receiver: item.receiver,
      remark: item.remark,
    }));
  operations = seedOperations.map(cloneOperation);
  devices = seedDevices.map((item) => ({ ...item }));
  sequence = 100;
  resetProductMasterStore();
  resetDeviceIntensityParameters();
  resetBenchmarkTargetStore();
}
