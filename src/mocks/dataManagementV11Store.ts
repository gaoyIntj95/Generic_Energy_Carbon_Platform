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
  { energyRecordId: 'v11-er-device-61', year: 2026, scopeLevel: '二级用能单元', scopeType: 'device', scopeId: 'v11-device-61', energyUnitId: 'eu-cement-grinding', energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [138000,142000,145000,149000,151000,154000,157000,160000,0,0,0,0] },
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
  { operationMetricId: 'v11-operation-55', metricCode: 'product_output', productId: 'product-a', year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [76000,73500,78000,79200,80500,81200,82000,81600,80400,79800,81000,83500] },
  { operationMetricId: 'v11-operation-51', metricCode: 'product_output', productId: 'product-a', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [76000,73500,78000,79200,80500,81200,82000,81600,80400,79800,81000,83500] },
  { operationMetricId: 'v11-operation-52', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [91000,89500,92500,94000,95800,97000,98200,97800,96500,95200,97000,100000] },
  { operationMetricId: 'v11-operation-53', metricCode: 'product_output', productId: 'product-b', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [30000,28500,31000,31500,32000,32500,33000,32800,32200,31800,32500,33800] },
  { operationMetricId: 'v11-operation-54', metricCode: 'product_output', productId: 'product-c', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量', aggregationMethod: '月度求和', metricName: '产品产量', metricUnit: '件', entryMode: 'monthly', annualValue: 0, monthlyValues: [8200,8100,8400,8500,8600,8750,8900,8850,8700,8600,8750,9100] },
];

const seedDevices: V11KeyDevice[] = [
  { deviceId: 'v11-device-60', deviceName: '加工中心1', deviceType: '加工设备', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', remark: '生产车间A重点用能设备' },
  { deviceId: 'v11-device-61', deviceName: '前处理设备1', deviceType: '表面处理设备', energyUnitId: 'eu-cement-grinding', mainEnergyTypeId: 'v11-energy-electricity', remark: '生产车间B重点用能设备' },
  { deviceId: 'v11-device-62', deviceName: '空压机1', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', remark: '' },
];

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
  const normalized = { ...input, scopeType, scopeId };
  const duplicate = energyRecords.some((item) => {
    const current = cloneRecord(item);
    return item.energyRecordId !== id
      && item.year === input.year
      && item.energyRole === input.energyRole
      && current.scopeType === scopeType
      && current.scopeId === scopeId
      && item.energyTypeId === input.energyTypeId;
  });
  if (duplicate) return { ok: false as const, error: '相同年度、数据角色、归属范围和能源品种的记录已存在。' };
  if (id) {
    const index = energyRecords.findIndex((item) => item.energyRecordId === id);
    if (index < 0) return { ok: false as const, error: '能源数据不存在。' };
    energyRecords[index] = { ...normalized, energyRecordId: id, monthlyAmounts: [...input.monthlyAmounts] };
    return { ok: true as const };
  }
  energyRecords.push({ ...normalized, energyRecordId: nextId('v11-er'), monthlyAmounts: [...input.monthlyAmounts] });
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
  const duplicate = conversionOutputs.some((item) =>
    item.conversionOutputId !== id
    && item.year === input.year
    && item.recordType === input.recordType
    && item.conversionEnergyUnitId === input.conversionEnergyUnitId,
  );
  if (duplicate) return { ok: false as const, error: '同一年度、记录类型和转换单元已存在记录，请编辑原记录。' };
  if (input.recordType === '直接外供' && input.inputEnergyRecordId) {
    const source = energyRecords.find((item) => item.energyRecordId === input.inputEnergyRecordId);
    if (!source) return { ok: false as const, error: '外供来源能源数据不存在。' };
    const sourceAmount = source.entryMode === 'monthly'
      ? source.monthlyAmounts.reduce((sum, value) => sum + value, 0)
      : source.annualAmount;
    if (input.externalAmount > sourceAmount) return { ok: false as const, error: '外供量不能超过来源能源数据的年度总量。' };
  }
  if (input.recordType !== '直接外供') {
    const assigned = (input.internalAmount ?? 0) + input.externalAmount + (input.lossAmount ?? 0);
    if (Math.abs((input.outputAmount ?? 0) - assigned) > 1e-8) return { ok: false as const, error: '产出总量与内部使用、外供及损失/未分配量不平衡。' };
  }
  if (id) {
    const index = conversionOutputs.findIndex((item) => item.conversionOutputId === id);
    if (index < 0) return { ok: false as const, error: '能源转换/输出记录不存在。' };
    conversionOutputs[index] = { ...input, conversionOutputId: id };
  } else conversionOutputs.push({ ...input, conversionOutputId: nextId('v11-output') });
  return { ok: true as const };
}

export function deleteV11ConversionOutput(id: string) {
  conversionOutputs = conversionOutputs.filter((item) => item.conversionOutputId !== id);
}

export function saveV11OperationMetric(input: Omit<V11OperationMetric, 'operationMetricId'>, id?: string) {
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

export function deleteV11KeyDevice(id: string) {
  const energyRecordCount = energyRecords.filter((item) => {
    const record = cloneRecord(item);
    return record.scopeType === 'device' && record.scopeId === id;
  }).length;
  const targetCount = countBenchmarkTargets('device', id);
  if (energyRecordCount || targetCount) {
    return {
      ok: false as const,
      error: `该设备已关联${energyRecordCount ? ` ${energyRecordCount} 条能源数据` : ''}${energyRecordCount && targetCount ? '及' : ''}${targetCount ? ` ${targetCount} 项指标目标` : ''}，无法直接删除。请先处理关联数据。`,
    };
  }
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
