import { listEnergyUnits } from './energyUnitMockStore';

export type AnalysisCategory =
  | '电力'
  | '热力'
  | '化石燃料'
  | '可再生及替代能源'
  | '回收能源'
  | '其他能源';

export type EnergyRole = '能源消费' | '回收能源' | '能源产出' | '外供能源';
export type ScopeLevel = '企业' | '一级用能单元' | '二级用能单元';

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

export interface V11ConversionRelation {
  conversionRelationId: string;
  year: number;
  conversionEnergyUnitId: string;
  conversionScene: '锅炉产汽/产热' | '余热发电' | '自发电' | '其他转换';
  inputEnergyRecordIds: string[];
  outputEnergyRecordIds: string[];
  remark: string;
}

export interface V11OperationMetric {
  operationMetricId: string;
  year: number;
  scopeLevel: ScopeLevel;
  energyUnitId: string | null;
  metricCategory: '产量与业务量' | '经济指标';
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
  { energyRecordId: 'v11-er-30', year: 2026, scopeLevel: '企业', energyUnitId: null, energyRole: '能源消费', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [4100000,4050000,4220000,4300000,4380000,4450000,4520000,4480000,4410000,4390000,4460000,4590000] },
  { energyRecordId: 'v11-er-31', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-coal', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [690,670,705,720,730,740,752,746,735,728,742,816] },
  { energyRecordId: 'v11-er-32', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', energyRole: '能源消费', energyTypeId: 'v11-energy-rdf', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [160,155,168,175,180,185,190,188,182,178,185,194] },
  { energyRecordId: 'v11-er-33', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-waste-heat-power', energyRole: '能源产出', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [530000,520000,550000,570000,590000,610000,620000,615000,600000,590000,605000,630000] },
  { energyRecordId: 'v11-er-34', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-waste-heat-power', energyRole: '回收能源', energyTypeId: 'v11-energy-waste-heat', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [6200,6100,6300,6500,6700,6800,6900,6880,6750,6680,6800,7100] },
  { energyRecordId: 'v11-er-35', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-waste-heat-power', energyRole: '外供能源', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [30000,28000,32000,35000,36000,38000,40000,39000,37000,36000,38000,41000] },
  { energyRecordId: 'v11-er-36', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-gas-boiler', energyRole: '能源消费', energyTypeId: 'v11-energy-natural-gas', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [112000,108000,118000,121000,126000,129000,132000,131000,128000,125000,127000,136000] },
  { energyRecordId: 'v11-er-37', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-gas-boiler', energyRole: '能源产出', energyTypeId: 'v11-energy-steam', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [4200,4100,4400,4550,4700,4850,4960,4910,4780,4690,4800,5050] },
  { energyRecordId: 'v11-er-38', year: 2026, scopeLevel: '二级用能单元', energyUnitId: 'eu-distributed-pv', energyRole: '能源产出', energyTypeId: 'v11-energy-electricity', entryMode: 'monthly', annualAmount: 0, monthlyAmounts: [120000,135000,158000,176000,192000,205000,214000,208000,187000,165000,142000,118000] },
];

const seedEnergyCosts: V11EnergyCost[] = [
  { energyCostId: 'v11-cost-40', year: 2026, energyTypeId: 'v11-energy-electricity', monthlyCosts: [310,306,318,325,330,334,339,336,331,329,335,345] },
  { energyCostId: 'v11-cost-41', year: 2026, energyTypeId: 'v11-energy-coal', monthlyCosts: [78,75,80,82,83,84,86,85,84,83,85,93] },
  { energyCostId: 'v11-cost-42', year: 2026, energyTypeId: 'v11-energy-rdf', monthlyCosts: [13,12.5,13.4,14,14.5,14.8,15.2,15,14.6,14.2,14.8,15.5] },
];

const seedRelations: V11ConversionRelation[] = [
  { conversionRelationId: 'v11-relation-80', year: 2026, conversionEnergyUnitId: 'eu-waste-heat-power', conversionScene: '余热发电', inputEnergyRecordIds: ['v11-er-34'], outputEnergyRecordIds: ['v11-er-33'], remark: '余热由烧成环节回收后进入余热发电系统，产出电力总量。' },
  { conversionRelationId: 'v11-relation-81', year: 2026, conversionEnergyUnitId: 'eu-gas-boiler', conversionScene: '锅炉产汽/产热', inputEnergyRecordIds: ['v11-er-36'], outputEnergyRecordIds: ['v11-er-37'], remark: '天然气经燃气锅炉转换为蒸汽，供厂内生产和公辅系统使用。' },
  { conversionRelationId: 'v11-relation-82', year: 2026, conversionEnergyUnitId: 'eu-distributed-pv', conversionScene: '自发电', inputEnergyRecordIds: [], outputEnergyRecordIds: ['v11-er-38'], remark: '光伏系统无可计量燃料投入，直接形成电力产出。' },
];

const seedOperations: V11OperationMetric[] = [
  { operationMetricId: 'v11-operation-50', year: 2026, scopeLevel: '企业', energyUnitId: null, metricCategory: '经济指标', aggregationMethod: '年度单值', metricName: '工业增加值', metricUnit: '万元', entryMode: 'annual', annualValue: 56000, monthlyValues: [] },
  { operationMetricId: 'v11-operation-51', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-clinker-line-1', metricCategory: '产量与业务量', aggregationMethod: '月度求和', metricName: '熟料产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [76000,73500,78000,79200,80500,81200,82000,81600,80400,79800,81000,83500] },
  { operationMetricId: 'v11-operation-52', year: 2026, scopeLevel: '一级用能单元', energyUnitId: 'eu-cement-grinding-line', metricCategory: '产量与业务量', aggregationMethod: '月度求和', metricName: '水泥产量', metricUnit: 't', entryMode: 'monthly', annualValue: 0, monthlyValues: [91000,89500,92500,94000,95800,97000,98200,97800,96500,95200,97000,100000] },
];

const seedDevices: V11KeyDevice[] = [
  { deviceId: 'v11-device-60', deviceName: '生料磨1', deviceType: '生料磨', energyUnitId: 'eu-raw-material', mainEnergyTypeId: 'v11-energy-electricity', remark: '水泥行业自定义设备' },
  { deviceId: 'v11-device-61', deviceName: '水泥磨1', deviceType: '水泥磨', energyUnitId: 'eu-cement-grinding', mainEnergyTypeId: 'v11-energy-electricity', remark: '水泥行业自定义设备' },
  { deviceId: 'v11-device-62', deviceName: '空压机1', deviceType: '空压设备', energyUnitId: 'eu-compressed-air', mainEnergyTypeId: 'v11-energy-electricity', remark: '' },
];

let energyTypes = seedEnergyTypes.map((item) => ({ ...item }));
let energyRecords = seedEnergyRecords.map(cloneRecord);
let energyCosts = seedEnergyCosts.map(cloneCost);
let relations = seedRelations.map(cloneRelation);
let operations = seedOperations.map(cloneOperation);
let devices = seedDevices.map((item) => ({ ...item }));
let sequence = 100;

function cloneRecord(item: V11EnergyRecord): V11EnergyRecord {
  return { ...item, monthlyAmounts: [...item.monthlyAmounts] };
}
function cloneCost(item: V11EnergyCost): V11EnergyCost {
  return { ...item, monthlyCosts: [...item.monthlyCosts] };
}
function cloneRelation(item: V11ConversionRelation): V11ConversionRelation {
  return { ...item, inputEnergyRecordIds: [...item.inputEnergyRecordIds], outputEnergyRecordIds: [...item.outputEnergyRecordIds] };
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
export function listV11ConversionRelations() { return relations.map(cloneRelation); }
export function listV11OperationMetrics() { return operations.map(cloneOperation); }
export function listV11KeyDevices() { return devices.map((item) => ({ ...item })); }

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
    + devices.filter((item) => item.mainEnergyTypeId === id).length;
  if (references) return { ok: false as const, error: `该能源品种存在 ${references} 条业务引用，不能删除。` };
  energyTypes = energyTypes.filter((item) => item.energyTypeId !== id);
  return { ok: true as const };
}

export function saveV11EnergyRecord(input: Omit<V11EnergyRecord, 'energyRecordId'>, id?: string) {
  const duplicate = energyRecords.some((item) => item.energyRecordId !== id && item.year === input.year && item.energyRole === input.energyRole && item.energyUnitId === input.energyUnitId && item.energyTypeId === input.energyTypeId);
  if (duplicate) return { ok: false as const, error: '相同年度、数据角色、归属范围和能源品种的记录已存在。' };
  if (id) {
    const index = energyRecords.findIndex((item) => item.energyRecordId === id);
    if (index < 0) return { ok: false as const, error: '能源数据不存在。' };
    energyRecords[index] = { ...input, energyRecordId: id, monthlyAmounts: [...input.monthlyAmounts] };
    return { ok: true as const };
  }
  energyRecords.push({ ...input, energyRecordId: nextId('v11-er'), monthlyAmounts: [...input.monthlyAmounts] });
  return { ok: true as const };
}

export function deleteV11EnergyRecord(id: string) {
  const count = relations.filter((item) => item.inputEnergyRecordIds.includes(id) || item.outputEnergyRecordIds.includes(id)).length;
  if (count) return { ok: false as const, error: `该能源数据被 ${count} 条能源转换关系引用，不能删除。` };
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

export function saveV11ConversionRelation(input: Omit<V11ConversionRelation, 'conversionRelationId'>, id?: string) {
  const outputConflict = relations.some((item) => item.conversionRelationId !== id && item.outputEnergyRecordIds.some((recordId) => input.outputEnergyRecordIds.includes(recordId)));
  if (outputConflict) return { ok: false as const, error: '所选产出能源数据已被其他转换关系引用。' };
  if (id) {
    const index = relations.findIndex((item) => item.conversionRelationId === id);
    if (index < 0) return { ok: false as const, error: '能源转换关系不存在。' };
    relations[index] = { ...input, conversionRelationId: id, inputEnergyRecordIds: [...input.inputEnergyRecordIds], outputEnergyRecordIds: [...input.outputEnergyRecordIds] };
  } else relations.push({ ...input, conversionRelationId: nextId('v11-relation'), inputEnergyRecordIds: [...input.inputEnergyRecordIds], outputEnergyRecordIds: [...input.outputEnergyRecordIds] });
  return { ok: true as const };
}

export function deleteV11ConversionRelation(id: string) {
  relations = relations.filter((item) => item.conversionRelationId !== id);
}

export function saveV11OperationMetric(input: Omit<V11OperationMetric, 'operationMetricId'>, id?: string) {
  const duplicate = operations.some((item) => item.operationMetricId !== id && item.year === input.year && item.energyUnitId === input.energyUnitId && item.metricName.trim() === input.metricName.trim());
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
  devices = devices.filter((item) => item.deviceId !== id);
}

export function v11ScopeName(energyUnitId: string | null) {
  return energyUnitId ? listEnergyUnits().find((item) => item.energyUnitId === energyUnitId)?.energyUnitName ?? '未知单元' : '全厂';
}

export function resetDataManagementV11Store() {
  energyTypes = seedEnergyTypes.map((item) => ({ ...item }));
  energyRecords = seedEnergyRecords.map(cloneRecord);
  energyCosts = seedEnergyCosts.map(cloneCost);
  relations = seedRelations.map(cloneRelation);
  operations = seedOperations.map(cloneOperation);
  devices = seedDevices.map((item) => ({ ...item }));
  sequence = 100;
}
