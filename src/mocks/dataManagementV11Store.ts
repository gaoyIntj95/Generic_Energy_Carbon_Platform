import { listEnergyUnits } from './energyUnitMockStore';
import { countBenchmarkTargets, resetBenchmarkTargetStore } from './benchmarkTargetStore';
import { resetProductMasterStore } from './productMasterStore';

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
export type ConversionOutputType = '锅炉产汽/产热' | '余热发电' | '自发电' | '回收利用' | '直接外供' | '其他转换';
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
}

export interface V11EnergyCost {
  energyCostId: string;
  year: number;
  energyTypeId: string;
  monthlyCosts: number[];
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
  externalAmount: number;
  lossAmount?: number;
  receiver?: string;
  remark: string;
}

export interface V11OperationMetric {
  operationMetricId: string;
  metricCode: string;
  productId: string | null;
  year: number;
  scopeLevel: ScopeLevel;
  energyUnitId: string | null;
  metricCategory: '产量' | '经济指标';
  aggregationMethod: '月度求和' | '年度单值';
  metricName: string;
  metricUnit: string;
  entryMode: 'monthly' | 'annual';
  monthlyValues: number[];
  annualValue: number;
}

export interface V11KeyDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  energyUnitId: string;
  mainEnergyTypeId: string;
  remark: string;
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
  { energyTypeId: 'v11-energy-compressed-air', analysisCategory: '其他能源', energyTypeName: '压缩空气', measurementUnit: 'Nm³', standardCoalFactor: 0, standardCoalFactorUnit: 'kgce/Nm³', remark: '内部能源介质' },
];

const seedEnergyRecords: V11EnergyRecord[] = [
  { energyRecordId: 'v11-er-30', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [12710000,12555000,13082000,13330000,13578000,13795000,14012000,13888000,13671000,13609000,13826000,14229000] },
  { energyRecordId: 'v11-er-31', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-coal', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [6900,6700,7050,7200,7300,7400,7520,7460,7350,7280,7420,8160] },
  { energyRecordId: 'v11-er-32', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-rdf', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1600,1550,1680,1750,1800,1850,1900,1880,1820,1780,1850,1940] },
  { energyRecordId: 'v11-er-33', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2991723,2942409,3041037,3090351,3149528,3188980,3228431,3215280,3172542,3129803,3188980,3287608] },
  { energyRecordId: 'v11-er-34', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-coal', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [6900,6700,7050,7200,7300,7400,7520,7460,7350,7280,7420,8160] },
  { energyRecordId: 'v11-er-35', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-rdf', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1600,1550,1680,1750,1800,1850,1900,1880,1820,1780,1850,1940] },
  { energyRecordId: 'v11-er-36', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-gas-boiler', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [112000,108000,118000,121000,126000,129000,132000,131000,128000,125000,127000,136000] },
  { energyRecordId: 'v11-er-37', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [8000000,7800000,8100000,8200000,8300000,8400000,8500000,8400000,8300000,8200000,8400000,9400000] },
  { energyRecordId: 'v11-er-38', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [2500,2500,2500,2500,2500,2500,2500,2500,2500,2500,2500,2500] },
  { energyRecordId: 'v11-er-39', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [25000,25000,25000,25000,25000,25000,25000,25000,25000,25000,25000,25000] },
  { energyRecordId: 'v11-er-40', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-distributed-pv', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [650000,630000,660000,670000,680000,690000,700000,690000,680000,670000,690000,690000] },
  { energyRecordId: 'v11-er-41', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-public-support', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [480000,470000,490000,500000,510000,520000,530000,520000,510000,500000,520000,520000] },
  { energyRecordId: 'v11-er-42', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-office-hvac', energyRole: '能源消费', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1667,1667,1667,1667,1667,1667,1667,1667,1667,1667,1667,1663] },
  { energyRecordId: 'v11-er-43', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-office', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [240000,235000,245000,250000,255000,260000,265000,260000,255000,250000,260000,260000] },
  { energyRecordId: 'v11-er-44', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [137000,133000,143000,146000,151000,154000,157000,156000,153000,150000,152000,161000] },
  { energyRecordId: 'v11-er-45', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000] },
  { energyRecordId: 'v11-er-device-60', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-60', energyUnitId: 'eu-raw-material', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [252000,248000,260000,265000,271000,276000,282000,279000,274000,270000,278000,285000] },
  { energyRecordId: 'v11-er-device-61', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-61', energyUnitId: 'eu-cement-grinding', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [138000,142000,145000,149000,151000,154000,157000,160000,0,0,0,0], monthlyReportedMonths: [true,true,true,true,true,true,true,true,false,false,false,false] },
  { energyRecordId: 'v11-er-device-63', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-63', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [115000,112000,118000,120000,123000,125000,128000,126000,124000,121000,126000,130000] },
  { energyRecordId: 'v11-er-device-64', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-64', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [42000,40000,43500,44800,46200,47000,48100,47600,46500,45500,0,0], monthlyReportedMonths: [true,true,true,true,true,true,true,true,true,true,false,false] },
  { energyRecordId: 'v11-er-device-66', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-66', energyUnitId: 'eu-raw-material', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [94000,90000,97000,99000,101000,103000,105000,104000,101000,100000,103000,107000] },
  { energyRecordId: 'v11-er-device-70', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-70', energyUnitId: 'eu-cement-grinding-line', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [185000,182000,190000,194000,198000,201000,205000,203000,199000,196000,202000,210000] },
  { energyRecordId: 'v11-er-device-74', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-74', energyUnitId: 'eu-production-processing', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [126000,123000,130000,133000,136000,138000,142000,140000,137000,134000,0,0], monthlyReportedMonths: [true,true,true,true,true,true,true,true,true,true,false,false] },
  { energyRecordId: 'v11-er-device-78', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-78', energyUnitId: 'eu-utilities', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [72000,70000,73500,75000,77000,78500,80000,79200,77500,76000,78000,81000] },
  { energyRecordId: 'v11-er-device-79', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-79', energyUnitId: 'eu-compressed-air', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [106000,103000,110000,112000,115000,118000,120000,119000,116000,114000,0,0], monthlyReportedMonths: [true,true,true,true,true,true,true,true,true,true,false,false] },
  { energyRecordId: 'v11-er-device-81', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-81', energyUnitId: 'eu-waste-heat-power', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [54000,52000,56000,57000,58000,59000,60000,59500,58000,57000,59000,61000] },
  { energyRecordId: 'v11-er-device-82', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-82', energyUnitId: 'eu-gas-boiler', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [78000,75000,81000,83500,86000,88000,90000,89500,87000,85000,88000,93000] },
  { energyRecordId: 'v11-er-device-84', year: 2026, scopeLevel: '一级用能单元', scopeType: 'device', scopeId: 'v11-device-84', energyUnitId: 'eu-office', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [62000,60000,64000,67000,71000,76000,82000,80000,72000,68000,65000,63000] },
];

const seedEnergyCosts: V11EnergyCost[] = [
  { energyCostId: 'v11-cost-40', year: 2026, energyTypeId: 'v11-energy-electricity', monthlyCosts: [310,306,318,325,330,334,339,336,331,329,335,345] },
  { energyCostId: 'v11-cost-41', year: 2026, energyTypeId: 'v11-energy-coal', monthlyCosts: [78,75,80,82,83,84,86,85,84,83,85,93] },
  { energyCostId: 'v11-cost-42', year: 2026, energyTypeId: 'v11-energy-rdf', monthlyCosts: [13,12.5,13.4,14,14.5,14.8,15.2,15,14.6,14.2,14.8,15.5] },
];

const seedConversionOutputs: V11ConversionOutput[] = [
  { conversionOutputId: 'v11-output-200', year: 2026, recordType: '余热发电', conversionEnergyUnitId: 'eu-waste-heat-power', inputMode: 'recovery', recoverySourceEnergyUnitId: 'eu-production-processing', recoveryEnergyName: '余热', recoveryAmount: 85000, recoveryUnit: 'GJ', outputAnalysisCategory: '电力', outputEnergyTypeId: 'v11-energy-electricity', outputEnergyName: '电力', outputUnit: 'kWh', outputAmount: 18300000, internalAmount: 16300000, externalAmount: 2000000, lossAmount: 0, remark: '生产加工过程余热经能源回收系统转换为电力。' },
  { conversionOutputId: 'v11-output-201', year: 2026, recordType: '锅炉产汽/产热', conversionEnergyUnitId: 'eu-gas-boiler', inputMode: 'linked', inputEnergyRecordId: 'v11-er-36', outputAnalysisCategory: '热力', outputEnergyTypeId: 'v11-energy-steam', outputEnergyName: '蒸汽', outputUnit: 'GJ', outputAmount: 52000, internalAmount: 50000, externalAmount: 2000, lossAmount: 0, remark: '天然气经锅炉系统转换为蒸汽。' },
  { conversionOutputId: 'v11-output-202', year: 2026, recordType: '其他转换', conversionEnergyUnitId: 'eu-distributed-pv', inputMode: 'linked', inputEnergyRecordId: 'v11-er-40', outputAnalysisCategory: '电力', outputEnergyTypeId: 'v11-energy-electricity', outputEnergyName: '电力', outputUnit: 'kWh', outputAmount: 8000000, internalAmount: 8000000, externalAmount: 0, lossAmount: 0, remark: '配电系统完成厂内电力转换与分配。' },
];

const seedOperations: V11OperationMetric[] = [
  { operationMetricId: 'v11-operation-50', metricCode: 'industrial_added_value', productId: null, year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '经济指标', aggregationMethod: '年度单值', metricName: '工业增加值', metricUnit: '万元', entryMode: 'annual', annualValue: 56000, monthlyValues: [] },
  { operationMetricId: 'v11-operation-51', metricCode: 'product_output', productId: 'product-a', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [76000,73500,78000,79200,80500,81200,82000,81600,80400,79800,81000,83500] },
  { operationMetricId: 'v11-operation-52', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [91000,89500,92500,94000,95800,97000,98200,97800,96500,95200,97000,100000] },
  { operationMetricId: 'v11-operation-53', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [30000,28500,31000,31500,32000,32500,33000,32800,32200,31800,32500,33800] },
  { operationMetricId: 'v11-operation-54', metricCode: 'product_output', productId: 'product-c', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: '件', entryMode: 'monthly', annualValue: 0, monthlyValues: [8200,8100,8400,8500,8600,8750,8900,8850,8700,8600,8750,9100] },
];

/** 重点用能设备字典样例：仅保留具有显著用能、独立计量或优化价值的典型设备。 */
const industrialDeviceDictionary: V11KeyDevice[] = [
  { deviceId: 'v11-device-60', deviceName: '1#数控加工中心', deviceType: '加工设备', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', remark: '三轴数控加工，生产车间A重点用电设备' },
  { deviceId: 'v11-device-63', deviceName: '2#数控加工中心', deviceType: '加工设备', energyUnitId: 'eu-clinker-line-1', mainEnergyTypeId: 'v11-energy-electricity', remark: '五轴数控加工，直属生产车间A' },
  { deviceId: 'v11-device-64', deviceName: '连续式热处理炉', deviceType: '加热/锅炉设备', energyUnitId: 'eu-clinker-line-1', mainEnergyTypeId: 'v11-energy-natural-gas', remark: '天然气加热，直属生产车间A' },
  { deviceId: 'v11-device-66', deviceName: '颚式破碎机', deviceType: '加工设备', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', remark: '原料预处理重点设备' },
  { deviceId: 'v11-device-70', deviceName: '1#注塑机', deviceType: '加工设备', energyUnitId: 'eu-cement-grinding-line', mainEnergyTypeId: 'v11-energy-electricity', remark: '直属生产车间B的主生产设备' },
  { deviceId: 'v11-device-61', deviceName: '前处理清洗线', deviceType: '表面处理设备', energyUnitId: 'eu-cement-grinding', mainEnergyTypeId: 'v11-energy-electricity', remark: '脱脂、清洗及表调工序设备' },
  { deviceId: 'v11-device-74', deviceName: '自动喷涂线', deviceType: '表面处理设备', energyUnitId: 'eu-production-processing', mainEnergyTypeId: 'v11-energy-electricity', remark: '喷涂及输送联动生产线' },
  { deviceId: 'v11-device-75', deviceName: '燃气烘干炉', deviceType: '加热/锅炉设备', energyUnitId: 'eu-production-processing', mainEnergyTypeId: 'v11-energy-natural-gas', remark: '涂层固化设备' },
  { deviceId: 'v11-device-78', deviceName: '冷却水循环泵组', deviceType: '泵类', energyUnitId: 'eu-utilities', mainEnergyTypeId: 'v11-energy-electricity', remark: '直属动力中心的公辅循环设备' },
  { deviceId: 'v11-device-62', deviceName: '1#螺杆空压机', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', remark: '额定排气量 20m³/min' },
  { deviceId: 'v11-device-79', deviceName: '2#螺杆空压机', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', remark: '备用及调峰空压设备' },
  { deviceId: 'v11-device-81', deviceName: '余热发电机组', deviceType: '动力设备', energyUnitId: 'eu-waste-heat-power', mainEnergyTypeId: 'v11-energy-electricity', remark: '余热回收发电辅助用电设备' },
  { deviceId: 'v11-device-82', deviceName: '2t/h天然气蒸汽锅炉', deviceType: '加热/锅炉设备', energyUnitId: 'eu-gas-boiler', mainEnergyTypeId: 'v11-energy-natural-gas', remark: '公辅蒸汽供应设备' },
  { deviceId: 'v11-device-83', deviceName: '1#配电变压器', deviceType: '动力设备', energyUnitId: 'eu-distributed-pv', mainEnergyTypeId: 'v11-energy-electricity', remark: '厂内配电及电能分配设备' },
  { deviceId: 'v11-device-84', deviceName: '中央空调主机', deviceType: '制冷/空调设备', energyUnitId: 'eu-office', mainEnergyTypeId: 'v11-energy-electricity', remark: '办公区域集中制冷设备' },
];

const seedDevices = industrialDeviceDictionary.map((item) => ({ ...item }));

let energyTypes = seedEnergyTypes.map((item) => ({ ...item }));
let energyRecords = seedEnergyRecords.map(cloneRecord);
let energyCosts = seedEnergyCosts.map(cloneCost);
let conversionOutputs = seedConversionOutputs.map((item) => ({ ...item }));
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
  return { ...item, monthlyCosts: [...item.monthlyCosts] };
}
function cloneOperation(item: V11OperationMetric): V11OperationMetric {
  return { ...item, monthlyValues: [...item.monthlyValues] };
}
function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function listV11EnergyTypes() { return energyTypes.map((item) => ({ ...item })); }
export function listV11EnergyRecords() { return energyRecords.map(cloneRecord); }
export function listV11EnergyCosts() { return energyCosts.map(cloneCost); }
export function listV11ConversionOutputs() { return conversionOutputs.map((item) => ({ ...item })); }
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
  if (count) return { ok: false as const, error: `该能源数据被 ${count} 条“能源转换与输出”记录引用，不能删除。` };
  energyRecords = energyRecords.filter((item) => item.energyRecordId !== id);
  return { ok: true as const };
}

export function saveV11EnergyCost(input: Omit<V11EnergyCost, 'energyCostId'>, id?: string) {
  if (energyCosts.some((item) => item.energyCostId !== id && item.year === input.year && item.energyTypeId === input.energyTypeId)) return { ok: false as const, error: '同一年度和能源品种只能维护一条成本数据。' };
  if (id) {
    const index = energyCosts.findIndex((item) => item.energyCostId === id);
    if (index < 0) return { ok: false as const, error: '能源成本不存在。' };
    energyCosts[index] = { ...input, energyCostId: id, monthlyCosts: [...input.monthlyCosts] };
  } else energyCosts.push({ ...input, energyCostId: nextId('v11-cost'), monthlyCosts: [...input.monthlyCosts] });
  return { ok: true as const };
}

export function deleteV11EnergyCost(id: string) {
  energyCosts = energyCosts.filter((item) => item.energyCostId !== id);
}

export function saveV11ConversionOutput(input: Omit<V11ConversionOutput, 'conversionOutputId'>, id?: string) {
  const normalizedInput = input;
  const duplicate = conversionOutputs.some((item) =>
    item.conversionOutputId !== id
    && item.year === normalizedInput.year
    && item.recordType === normalizedInput.recordType
    && item.conversionEnergyUnitId === normalizedInput.conversionEnergyUnitId,
  );
  if (duplicate) return { ok: false as const, error: '该年度、该系统的同类业务记录已维护，请编辑已有记录。' };
  if (normalizedInput.recordType === '直接外供' && normalizedInput.inputEnergyRecordId) {
    const source = energyRecords.find((item) => item.energyRecordId === normalizedInput.inputEnergyRecordId);
    if (!source) return { ok: false as const, error: '外供来源能源数据不存在。' };
    const sourceAmount = v11EnergyRecordAnnualAmount(source);
    if (normalizedInput.externalAmount > sourceAmount) return { ok: false as const, error: '外供量不能超过来源能源数据的年度总量。' };
  }
  if (normalizedInput.recordType !== '直接外供') {
    const assigned = (normalizedInput.internalAmount ?? 0) + normalizedInput.externalAmount + (normalizedInput.lossAmount ?? 0);
    if (Math.abs((normalizedInput.outputAmount ?? 0) - assigned) > 1e-8) return { ok: false as const, error: '产出总量与内部使用、外供及损失/未分配量不平衡。' };
  }
  if (id) {
    const index = conversionOutputs.findIndex((item) => item.conversionOutputId === id);
    if (index < 0) return { ok: false as const, error: '能源转换/输出记录不存在。' };
    conversionOutputs[index] = { ...normalizedInput, conversionOutputId: id };
  } else conversionOutputs.push({ ...normalizedInput, conversionOutputId: nextId('v11-output') });
  return { ok: true as const };
}

export function deleteV11ConversionOutput(id: string) {
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
    operations[index] = { ...input, operationMetricId: id, monthlyValues: [...input.monthlyValues] };
  } else operations.push({ ...input, operationMetricId: nextId('v11-operation'), monthlyValues: [...input.monthlyValues] });
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
  energyRecords = seedEnergyRecords.map(cloneRecord);
  energyCosts = seedEnergyCosts.map(cloneCost);
  conversionOutputs = seedConversionOutputs.map((item) => ({ ...item }));
  operations = seedOperations.map(cloneOperation);
  devices = seedDevices.map((item) => ({ ...item }));
  sequence = 100;
  resetProductMasterStore();
  resetBenchmarkTargetStore();
}
