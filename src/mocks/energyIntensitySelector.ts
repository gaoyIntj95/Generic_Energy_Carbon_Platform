import {
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11OperationMetrics,
  listV11KeyDevices,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
  type V11EnergyRecord,
  type V11OperationMetric,
} from './dataManagementV11Store';
import { getProduct, listProducts } from './productMasterStore';
import { listEnergyUnits } from './energyUnitMockStore';
import {
  getDeviceIntensityParameter,
  type DeviceIntensityMetricCode,
} from './deviceIntensityParameterStore';

export type IntensityObjectType = 'factory' | 'unit' | 'product' | 'device';
export type IntensityResultStatus = '已计算' | '待完善' | '暂不可计算';
export type IntensityIssue = '能源数据未录入' | '能源数据部分录入' | '缺少能源数据' | '缺少产品产量' | '缺少供气量' | '缺少蒸汽产量' | '当前产品无法直接汇总' | '未关联生产用能单元' | '缺少必要关联关系';

export interface IntensityObjectOption {
  objectId: string;
  objectName: string;
  objectType: IntensityObjectType;
  energyUnitId: string | null;
  unitKind?: 'production' | 'utility';
  unitLevel?: 'enterprise' | 'level1' | 'level2';
}

export interface CalculatedIntensityMetric {
  intensityMetricId: string;
  name: string;
  value: number | null;
  unit: string;
  yearOnYear: null;
  resultStatus: IntensityResultStatus;
  resultType: 'ok' | 'warn';
  formula: string;
  numerator: string;
  denominator: string;
  numeratorSource?: string;
  denominatorSource?: string;
  energyBasis?: string;
  allocationDescription?: string;
  relatedProductName?: string;
  relatedEnergyUnitNames?: string[];
  allocationRecordCount?: number;
  energyTypeNames?: string[];
  allocationRatio?: number;
  relatedProductOutputTotal?: number;
  allocatedEnergyAmount?: number;
  allocatedElectricityAmount?: number;
  allocationRule?: string;
  source: string;
  period: string;
  issue?: IntensityIssue;
  energyRecordIds: string[];
  operationMetricIds: string[];
  trend: number[];
  trendBasis?: 'actual-monthly' | 'annual-allocated';
}

export interface IntensityCalculationView {
  object: IntensityObjectOption;
  metrics: CalculatedIntensityMetric[];
  energyCondition: { linked: boolean; description: string; recordIds: string[] };
  operationCondition: { linked: boolean; description: string; recordIds: string[] };
  calculationStatus: '可计算' | '部分可计算' | '待补充';
  pendingReasons: string[];
}

export interface DeviceIntensityRow {
  deviceId: string;
  deviceName: string;
  energyUnitName: string;
  energyUnitId: string;
  deviceType: string;
  metricCode: DeviceIntensityMetricCode;
  metricName: string;
  metricUnit: 'kWh/Nm³' | 'kgce/t';
  formula: string;
  annualEnergy: number;
  energyUnit: 'kWh' | 'Nm³';
  dataProgress: string;
  completeEnergy: boolean;
  parameter: ReturnType<typeof getDeviceIntensityParameter>;
  value: number | null;
  resultStatus: '已计算' | '待完善' | '暂不可计算';
  resultReason: '能源数据未录入' | '能源数据部分录入' | '缺少供气量' | '缺少蒸汽产量' | null;
  energyRecordId: string | null;
  energyTypeName: string;
  standardCoalFactor: number;
  standardCoalFactorUnit: string;
  reportedMonths: boolean[];
}

const factoryOption: IntensityObjectOption = { objectId: 'factory', objectName: '全厂', objectType: 'factory', energyUnitId: null };
const annualAmount = (record: V11EnergyRecord | V11OperationMetric) =>
  'monthlyValues' in record && record.entryMode === 'monthly'
    ? record.monthlyValues.reduce((sum, value) => sum + value, 0)
    : 'annualValue' in record ? record.annualValue : v11EnergyRecordAnnualAmount(record as V11EnergyRecord);
const energyTypeName = (id: string) => listV11EnergyTypes().find((item) => item.energyTypeId === id)?.energyTypeName ?? '';
const standardCoalFactor = (id: string) => {
  const type = listV11EnergyTypes().find((item) => item.energyTypeId === id);
  return type?.standardCoalFactorUnit.startsWith('kgce/') ? (type.standardCoalFactor / 1000) : (type?.standardCoalFactor ?? 0);
};
const standardCoalTotal = (records: V11EnergyRecord[]) => records.reduce((sum, record) => sum + annualAmount(record) * standardCoalFactor(record.energyTypeId), 0);
const operationByName = (records: V11OperationMetric[], names: string[]) => records.find((record) => names.some((name) => record.metricName.includes(name)));

function monthlyRecordAmounts(record: V11EnergyRecord) {
  return record.entryMode === 'monthly'
    ? [...record.monthlyAmounts]
    : Array.from({ length: 12 }, (_, index) => index === 11 ? record.annualAmount : 0);
}

function monthlyOperationAmounts(record: V11OperationMetric, annualFallback = false) {
  return record.entryMode === 'monthly'
    ? [...record.monthlyValues]
    : Array.from({ length: 12 }, () => annualFallback ? record.annualValue / 12 : record.annualValue);
}

function addMonthly(target: number[], values: number[]) {
  values.forEach((value, index) => { target[index] += value; });
}

function attachTrend(metric: CalculatedIntensityMetric, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  if (metric.value === null) return metric;
  const energyRecords = energy.filter((record) => metric.energyRecordIds.includes(record.energyRecordId));
  const operationRecords = operations.filter((record) => metric.operationMetricIds.includes(record.operationMetricId));
  const standardCoal = Array.from({ length: 12 }, () => 0);
  const electricity = Array.from({ length: 12 }, () => 0);
  energyRecords.forEach((record) => {
    const amounts = monthlyRecordAmounts(record);
    addMonthly(electricity, energyTypeName(record.energyTypeId) === '电力' ? amounts : Array(12).fill(0));
    addMonthly(standardCoal, amounts.map((amount) => amount * standardCoalFactor(record.energyTypeId)));
  });
  const denominator = Array.from({ length: 12 }, () => 0);
  const hasMonthlyOperation = operationRecords.some((record) => record.entryMode === 'monthly');
  const hasAnnualOperation = operationRecords.some((record) => record.entryMode === 'annual');
  operationRecords.forEach((record) => addMonthly(denominator, monthlyOperationAmounts(record, !hasMonthlyOperation && hasAnnualOperation)));
  const isElectricity = metric.name.includes('电耗') || metric.name.includes('电耗');
  const isProduct = metric.intensityMetricId.includes('product-energy') || metric.intensityMetricId.includes('product-electricity');
  const isAddedValue = metric.intensityMetricId.includes('added-value');
  const isOutputValue = metric.intensityMetricId.includes('output-value');
  const isRevenue = metric.intensityMetricId.includes('revenue-electricity');
  const hasMonthlyDenominator = denominator.some((value) => value > 0);
  const trendBasis: CalculatedIntensityMetric['trendBasis'] = hasMonthlyOperation
    ? 'actual-monthly'
    : hasAnnualOperation
      ? 'annual-allocated'
      : undefined;
  return {
    ...metric,
    trend: hasMonthlyDenominator && (isProduct || isAddedValue || isOutputValue || isRevenue)
      ? denominator.map((value, index) => {
        if (value <= 0) return 0;
        if (isRevenue) return electricity[index] / value;
        if (isOutputValue || isAddedValue) return standardCoal[index] / value;
        return (isElectricity ? electricity[index] : standardCoal[index] * 1000) / value;
      })
      : [],
    trendBasis,
  };
}

export function listIntensityObjects(objectType: IntensityObjectType): IntensityObjectOption[] {
  if (objectType === 'factory') return [factoryOption];
  if (objectType === 'product') {
    return listProducts().filter((item) => item.status === 'active').map((item) => ({ objectId: item.productId, objectName: item.productName, objectType, energyUnitId: item.linkedEnergyUnitIds[0] ?? null, unitKind: 'production' as const }));
  }
  if (objectType === 'device') return listV11KeyDevices().map((device) => ({ objectId: device.deviceId, objectName: device.deviceName, objectType, energyUnitId: device.energyUnitId }));
  return listEnergyUnits()
    .filter((unit) => unit.unitLevel !== 'enterprise')
    .map((unit) => ({ objectId: unit.energyUnitId, objectName: unit.energyUnitName, objectType, energyUnitId: unit.energyUnitId, unitKind: unit.unitType === '生产单元' ? 'production' : 'utility', unitLevel: unit.unitLevel }));
}

function utilityMetrics(object: IntensityObjectOption, year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const isBoiler = object.objectName.includes('锅炉');
  const output = operations.find((record) => record.metricCode === 'steam_output' || record.metricName.includes('蒸汽产量'));
  const typeName = isBoiler ? '单位蒸汽综合能耗' : '单位运行能耗';
  const unit = isBoiler ? 'kgce/t' : 'tce/业务量';
  const missing: IntensityIssue | undefined = isBoiler && !output ? '缺少蒸汽产量' : !output ? '缺少必要关联关系' : undefined;
  const coal = standardCoalTotal(energy);
  return [baseMetric(`${object.objectId}-utility`, typeName, unit, isBoiler ? '年度折标综合能耗 ÷ 蒸汽产量' : '年度综合能耗 ÷ 运营业务量', missing ? null : coal * 1000 / annualAmount(output!), `${object.objectName}综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `${output.metricName} ${annualAmount(output).toLocaleString('zh-CN')} ${output.metricUnit}` : isBoiler ? '未匹配到当前对象的运营数据' : '未匹配到当前对象的运营数据', year, energy.map((record) => record.energyRecordId), output ? [output.operationMetricId] : [], missing)];
}

function productMetrics(object: IntensityObjectOption, year: number, enterpriseEnergy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const output = operations.find((record) => record.metricCode === 'product_output' && record.productId === object.objectId && annualAmount(record) > 0);
  const coal = standardCoalTotal(enterpriseEnergy);
  const electricity = enterpriseEnergy.filter((record) => energyTypeName(record.energyTypeId) === '电力').reduce((sum, record) => sum + annualAmount(record), 0);
  const productUnit = output?.metricUnit ?? 't';
  const missing: IntensityIssue | undefined = !enterpriseEnergy.length ? '缺少能源数据' : !output ? '缺少产品产量' : undefined;
  return [
    baseMetric(`${object.objectId}-product-energy`, '单位产品综合能耗', `kgce/${productUnit}`, '企业边界综合能耗（tce）×1000 ÷ 当前产品产量', !missing ? coal * 1000 / annualAmount(output!) : null, `企业年度综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `${object.objectName}产量 ${annualAmount(output).toLocaleString('zh-CN')} ${productUnit}` : '缺少当前产品产量', year, enterpriseEnergy.map((record) => record.energyRecordId), output ? [output.operationMetricId] : [], missing),
    baseMetric(`${object.objectId}-product-electricity`, '单位产品电耗', `kWh/${productUnit}`, '企业边界电力消费量 ÷ 当前产品产量', !missing && electricity > 0 ? electricity / annualAmount(output!) : null, `企业年度电力消费量 ${electricity.toLocaleString('zh-CN')} kWh`, output ? `${object.objectName}产量 ${annualAmount(output).toLocaleString('zh-CN')} ${productUnit}` : '缺少当前产品产量', year, enterpriseEnergy.filter((record) => energyTypeName(record.energyTypeId) === '电力').map((record) => record.energyRecordId), output ? [output.operationMetricId] : [], missing ?? (!electricity ? '缺少能源数据' : undefined)),
  ];
}

function deviceTemplate(device: ReturnType<typeof listV11KeyDevices>[number]) {
  if (device.deviceType === '空压设备') return { metricCode: 'compressed-air-electricity' as const, metricName: '单位供气电耗', metricUnit: 'kWh/Nm³' as const, formula: '年度电耗 ÷ 年度供气量', parameterUnit: 'Nm³' as const };
  if (device.deviceId === 'v11-device-82' || device.deviceName.includes('蒸汽锅炉')) return { metricCode: 'boiler-standard-coal' as const, metricName: '单位蒸汽综合能耗', metricUnit: 'kgce/t' as const, formula: '年度折标综合能耗 ÷ 年度蒸汽产量', parameterUnit: 't' as const };
  return null;
}

export function buildDeviceIntensityRows(year: number, deviceType = 'all', energyUnitId = 'all', deviceId = 'all'): DeviceIntensityRow[] {
  const devices = listV11KeyDevices().filter((device) => deviceTemplate(device))
    .filter((device) => deviceType === 'all' || device.deviceType === deviceType)
    .filter((device) => energyUnitId === 'all' || device.energyUnitId === energyUnitId)
    .filter((device) => deviceId === 'all' || device.deviceId === deviceId);
  const records = listV11EnergyRecords().filter((record) => record.year === year && record.energyRole === '能源消费' && record.scopeType === 'device');
  return devices.map((device) => {
    const template = deviceTemplate(device)!;
    const record = records.find((item) => item.scopeId === device.deviceId && item.energyTypeId === (template.metricCode === 'compressed-air-electricity' ? 'v11-energy-electricity' : 'v11-energy-natural-gas'));
    const months = record?.monthlyReportedMonths ?? record?.monthlyAmounts.map((value) => value > 0);
    const reportedMonths = months ?? Array(12).fill(false);
    const reportedCount = reportedMonths.filter(Boolean).length;
    const completeEnergy = Boolean(record && reportedCount === 12);
    const annualEnergy = record ? annualAmount(record) : 0;
    const parameter = getDeviceIntensityParameter(device.deviceId, year, template.metricCode);
    const value = completeEnergy && parameter && parameter.value > 0
      ? template.metricCode === 'compressed-air-electricity' ? annualEnergy / parameter.value : annualEnergy * standardCoalFactor(record!.energyTypeId) / parameter.value
      : null;
    const energyType = listV11EnergyTypes().find((item) => item.energyTypeId === record?.energyTypeId);
    const resultReason = reportedCount === 0
      ? '能源数据未录入'
      : reportedCount < 12
        ? '能源数据部分录入'
        : !parameter
          ? (template.metricCode === 'compressed-air-electricity' ? '缺少供气量' : '缺少蒸汽产量')
          : null;
    const resultStatus = resultReason === null ? '已计算' : '待完善';
    return { deviceId: device.deviceId, deviceName: device.deviceName, energyUnitName: listEnergyUnits().find((unit) => unit.energyUnitId === device.energyUnitId)?.energyUnitName ?? '未知用能单元', energyUnitId: device.energyUnitId, deviceType: device.deviceType, metricCode: template.metricCode, metricName: template.metricName, metricUnit: template.metricUnit, formula: template.formula, annualEnergy, energyUnit: template.metricCode === 'compressed-air-electricity' ? 'kWh' : 'Nm³', dataProgress: `${reportedCount}/12月`, completeEnergy, parameter, value, resultStatus, resultReason, energyRecordId: record?.energyRecordId ?? null, energyTypeName: energyType?.energyTypeName ?? (template.metricCode === 'compressed-air-electricity' ? '电力' : '天然气'), standardCoalFactor: energyType ? standardCoalFactor(energyType.energyTypeId) : 0, standardCoalFactorUnit: energyType?.standardCoalFactorUnit ?? '', reportedMonths };
  });
}

function metric(input: Omit<CalculatedIntensityMetric, 'yearOnYear' | 'resultType' | 'resultStatus' | 'period'> & { year: number; missing?: IntensityIssue }) : CalculatedIntensityMetric {
  const valid = input.value !== null;
  const status: IntensityResultStatus = valid ? '已计算' : input.missing === '当前产品无法直接汇总' || input.missing === '未关联生产用能单元' || input.missing === '缺少必要关联关系' ? '暂不可计算' : '待完善';
  return { ...input, yearOnYear: null, resultType: valid ? 'ok' : 'warn', resultStatus: status, period: `${input.year}年度`, trend: [] };
}

function baseMetric(id: string, name: string, unit: string, formula: string, value: number | null, numerator: string, denominator: string, year: number, energyRecordIds: string[], operationMetricIds: string[], missing?: IntensityIssue): CalculatedIntensityMetric {
  return metric({ intensityMetricId: id, name, unit, value, formula, numerator, denominator, source: '能源数据与运营数据（按对象层级、对象ID和年度匹配）', numeratorSource: '能源数据', denominatorSource: '运营数据', energyBasis: '按能源品种折算为标准煤后计算', energyRecordIds, operationMetricIds, issue: value === null ? missing : undefined, year, missing, trend: [] });
}

function factoryMetrics(year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const coal = standardCoalTotal(energy);
  const electricity = energy.filter((r) => energyTypeName(r.energyTypeId) === '电力').reduce((sum, r) => sum + annualAmount(r), 0);
  const ids = energy.map((r) => r.energyRecordId);
  const output = operationByName(operations, ['企业产品产量', '产品产量']);
  const value = operationByName(operations, ['工业总产值']);
  const added = operationByName(operations, ['工业增加值']);
  const revenue = operationByName(operations, ['营业收入']);
  const productUnit = output?.metricUnit ?? 't';
  return [
    baseMetric('factory-product-energy', '单位产品综合能耗', `kgce/${productUnit}`, '企业级综合能耗 ÷ 企业产品产量', output && coal > 0 ? coal * 1000 / annualAmount(output) : null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `企业产品产量 ${annualAmount(output).toLocaleString('zh-CN')} ${productUnit}` : '缺少企业产品产量', year, ids, output ? [output.operationMetricId] : [], output ? undefined : '缺少产品产量'),
    baseMetric('factory-output-value-energy', '单位产值综合能耗', 'tce/万元', '企业级综合能耗 ÷ 工业总产值', value && coal > 0 ? coal / annualAmount(value) : null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, value ? `工业总产值 ${annualAmount(value).toLocaleString('zh-CN')} 万元` : '缺少工业总产值', year, ids, value ? [value.operationMetricId] : []),
    baseMetric('factory-added-value-energy', '单位增加值综合能耗', 'tce/万元', '企业级综合能耗 ÷ 工业增加值', added && coal > 0 ? coal / annualAmount(added) : null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, added ? `工业增加值 ${annualAmount(added).toLocaleString('zh-CN')} 万元` : '缺少工业增加值', year, ids, added ? [added.operationMetricId] : []),
    baseMetric('factory-revenue-electricity', '单位营业收入电耗', 'kWh/万元', '企业级电力消费量 ÷ 营业收入', revenue && electricity > 0 ? electricity / annualAmount(revenue) : null, `企业级电力消费量 ${electricity.toLocaleString('zh-CN')} kWh`, revenue ? `营业收入 ${annualAmount(revenue).toLocaleString('zh-CN')} 万元` : '缺少营业收入', year, energy.filter((r) => energyTypeName(r.energyTypeId) === '电力').map((r) => r.energyRecordId), revenue ? [revenue.operationMetricId] : []),
  ].map((item) => ({ ...item, energyTypeNames: [...new Set(energy.map((record) => energyTypeName(record.energyTypeId)))] }));
}

function unitMetrics(object: IntensityObjectOption, year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const coal = standardCoalTotal(energy);
  const electricity = energy.filter((r) => energyTypeName(r.energyTypeId) === '电力').reduce((sum, r) => sum + annualAmount(r), 0);
  const outputs = operations.filter((r) => r.metricCode === 'product_output' && r.energyUnitId === object.energyUnitId);
  const output = outputs[0];
  const name = object.objectName;
  const missing = !energy.length ? '缺少能源数据' : !output ? '缺少必要关联关系' : undefined;
  return [
    baseMetric(`${object.objectId}-product-energy`, '单位产品综合能耗', `kgce/${output?.metricUnit ?? 't'}`, `${name}综合能耗（tce）×1000 ÷ 关联产品产量`, missing ? null : coal * 1000 / annualAmount(output!), `${name}综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `${output.metricName} ${annualAmount(output).toLocaleString('zh-CN')} ${output.metricUnit}` : '未关联产品产量', year, energy.map((r) => r.energyRecordId), output ? [output.operationMetricId] : [], missing),
    baseMetric(`${object.objectId}-product-electricity`, '单位产品电耗', `kWh/${output?.metricUnit ?? 't'}`, `${name}电力消费量 ÷ 关联产品产量`, missing || !electricity ? null : electricity / annualAmount(output!), `${name}电力消费量 ${electricity.toLocaleString('zh-CN')} kWh`, output ? `${output.metricName} ${annualAmount(output).toLocaleString('zh-CN')} ${output.metricUnit}` : '未关联产品产量', year, energy.filter((r) => energyTypeName(r.energyTypeId) === '电力').map((r) => r.energyRecordId), output ? [output.operationMetricId] : [], missing ?? (!electricity ? '缺少能源数据' : undefined)),
  ].map((item) => ({ ...item, relatedProductName: output?.productId ? getProduct(output.productId)?.productName : undefined, allocationDescription: output?.productId ? `${getProduct(output.productId)?.productName ?? '关联产品'}按当前用能单元产量记录归属；多产品场景按已确认的能源分配结果计算。` : undefined, energyTypeNames: [...new Set(energy.map((record) => energyTypeName(record.energyTypeId)))] }));
}

function productSummaryMetrics(object: IntensityObjectOption, year: number, enterpriseEnergy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const products = listProducts().filter((item) => item.status === 'active');
  const productOutputs = products.flatMap((product) => {
    const records = operations.filter((record) => record.metricCode === 'product_output' && record.productId === product.productId);
    const enterpriseRecords = records.filter((record) => record.scopeLevel === '企业' && record.energyUnitId === null);
    return enterpriseRecords.length ? enterpriseRecords : records;
  });
  const units = [...new Set(productOutputs.map((record) => record.metricUnit))];
  const coal = standardCoalTotal(enterpriseEnergy);
  const electricityRecords = enterpriseEnergy.filter((record) => energyTypeName(record.energyTypeId) === '电力');
  const electricity = electricityRecords.reduce((sum, record) => sum + annualAmount(record), 0);
  const totalOutput = productOutputs.reduce((sum, record) => sum + annualAmount(record), 0);
  const missing: IntensityIssue | undefined = !enterpriseEnergy.length ? '缺少能源数据' : !productOutputs.length || totalOutput <= 0 ? '缺少产品产量' : units.length !== 1 ? '当前产品无法直接汇总' : undefined;
  const productUnit = units[0] ?? products[0]?.unit ?? 't';
  const denominator = productOutputs.length ? `运营数据—产品产量合计 ${totalOutput.toLocaleString('zh-CN')} ${productUnit}` : '缺少年度产品产量';
  const common = { energyTypeNames: [...new Set(enterpriseEnergy.map((record) => energyTypeName(record.energyTypeId)))], numeratorSource: '能源数据—企业层级—全厂', denominatorSource: '运营数据—产品产量' };
  return [
    { ...baseMetric(`${object.objectId}-product-energy`, '单位产品综合能耗', `kgce/${productUnit}`, '企业年度综合能耗（tce）×1000÷产品年度产量合计', !missing && coal > 0 ? coal * 1000 / totalOutput : null, `企业年度综合能耗 ${coal.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} tce`, denominator, year, enterpriseEnergy.map((record) => record.energyRecordId), productOutputs.map((record) => record.operationMetricId), missing), ...common, energyBasis: '企业边界能源消费按能源品种折算为标准煤' },
    { ...baseMetric(`${object.objectId}-product-electricity`, '单位产品电耗', `kWh/${productUnit}`, '企业年度电力消费量（kWh）÷产品年度产量合计', !missing && electricity > 0 ? electricity / totalOutput : null, `企业年度电力消费量 ${electricity.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} kWh`, denominator, year, electricityRecords.map((record) => record.energyRecordId), productOutputs.map((record) => record.operationMetricId), missing ?? (!electricity ? '缺少能源数据' : undefined)), ...common },
  ];
}

export function buildIntensityCalculationView(year: number, objectType: IntensityObjectType, objectId: string): IntensityCalculationView {
  const object = listIntensityObjects(objectType).find((item) => item.objectId === objectId) ?? (objectType === 'product' ? { objectId: 'product-summary', objectName: '企业产品综合口径', objectType, energyUnitId: null } : factoryOption);
  const all = listV11EnergyRecords().filter((r) => r.year === year && r.energyRole === '能源消费');
  const energy = objectType === 'factory' || objectType === 'product'
    ? all.filter((r) => v11RecordScopeType(r) === 'enterprise' || r.scopeLevel === '企业')
    : all.filter((r) => v11RecordScopeType(r) !== 'device' && r.energyUnitId === object.energyUnitId);
  const operations = listV11OperationMetrics().filter((r) => r.year === year && (objectType === 'factory' || objectType === 'product' ? r.scopeLevel === '企业' : r.energyUnitId === object.energyUnitId));
  const metrics = (objectType === 'factory' ? factoryMetrics(year, energy, operations) : objectType === 'product' ? productMetrics(object, year, energy, operations) : object.unitKind === 'production' ? unitMetrics(object, year, energy, operations) : utilityMetrics(object, year, energy, operations))
    .map((item) => attachTrend(item, energy, operations));
  const calculated = metrics.filter((item) => item.resultType === 'ok').length;
  return { object, metrics, energyCondition: { linked: energy.length > 0, description: energy.length ? `已关联 ${energy.length} 条能源消费记录` : '未匹配到当前对象的能源消费记录', recordIds: energy.map((r) => r.energyRecordId) }, operationCondition: { linked: operations.length > 0, description: operations.length ? '已关联产品产量或经济指标' : '未匹配到当前对象的运营数据', recordIds: operations.map((r) => r.operationMetricId) }, calculationStatus: calculated === metrics.length ? '可计算' : calculated > 0 ? '部分可计算' : '待补充', pendingReasons: [...new Set(metrics.filter((m) => m.issue).map((m) => m.issue!))] };
}

export function buildIntensityCalculationViews(year: number, objectType: IntensityObjectType, unitLevel: 'all' | 'level1' | 'level2' = 'all', objectId?: string) {
  return listIntensityObjects(objectType).filter((item) => objectType !== 'unit' || unitLevel === 'all' || item.unitLevel === unitLevel).filter((item) => !objectId || objectId === 'all' || item.objectId === objectId).map((item) => buildIntensityCalculationView(year, objectType, item.objectId));
}
