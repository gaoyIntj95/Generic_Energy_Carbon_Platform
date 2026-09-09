import {
  listV11ConversionOutputs,
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
import type { EnergyUnit } from '../types/energyUnit';
import {
  getDeviceIntensityParameter,
  getDeviceIntensityTemplateConfig,
  type DeviceIntensityMetricCode,
  type DeviceIntensityTemplateConfig,
} from './deviceIntensityParameterStore';

export type IntensityObjectType = 'factory' | 'unit' | 'product' | 'device';
export type IntensityResultStatus = '已计算' | '待完善' | '暂不可计算' | '数据缺失';
export type IntensityIssue = '能源数据未录入' | '能源数据部分录入' | '缺少能源数据' | '缺少产品产量' | '缺少工业增加值' | '缺少供气量' | '缺少蒸汽产量' | '缺少余热发电转换数据' | '当前产品无法直接汇总' | '未关联生产用能单元' | '缺少必要关联关系' | '缺少适用运营分母' | '暂无适用典型指标模板' | '多产品共用生产用能单元，未配置能源分配' | '数据缺失';
export type IntensityMonthlyDataStatus = 'complete' | 'incomplete' | 'unavailable';
export type IntensityMonthlyValueStatus = '已计算' | '数据不完整' | '暂无月度数据';

export interface IntensityMonthlyMetric {
  month: number;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  momChange: number | null;
  yoyChange: number | null;
  status: IntensityMonthlyValueStatus;
}

export interface IntensityObjectOption {
  objectId: string;
  objectName: string;
  objectType: IntensityObjectType;
  energyUnitId: string | null;
  unitKind?: 'production' | 'utility';
  unitLevel?: 'enterprise' | 'level1' | 'level2';
  unitType?: EnergyUnit['unitType'];
  conversionScenarios?: EnergyUnit['conversionScenarios'];
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
  monthlyMetrics: IntensityMonthlyMetric[];
  monthlyDataStatus: IntensityMonthlyDataStatus;
  /** 仅有统计值、没有独立强度口径的指标不得流入能效对标。 */
  benchmarkable?: boolean;
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
  metricCode: DeviceIntensityMetricCode | null;
  metricName: string;
  metricUnit: string;
  formula: string;
  annualEnergy: number;
  energyUnit: string;
  dataProgress: string;
  completeEnergy: boolean;
  parameter: ReturnType<typeof getDeviceIntensityParameter>;
  value: number | null;
  resultStatus: '已计算' | '待完善' | '暂不可计算';
  resultReason: string | null;
  energyRecordId: string | null;
  energyTypeName: string;
  standardCoalFactor: number;
  standardCoalFactorUnit: string;
  reportedMonths: boolean[];
  monthlyEnergy: number[];
  monthlyDenominator: Array<number | null>;
  denominatorUnit: string;
  monthlyMetricValues: Array<number | null>;
  calculationInputs?: {
    conversionOutputId?: string;
    denominatorEnergyRecordId?: string;
    numerator: number;
    denominator: number;
    unit: string;
    numeratorRaw?: number;
    numeratorRawUnit?: string;
    numeratorFactor?: number;
    numeratorFactorUnit?: string;
    denominatorRaw?: number;
    denominatorRawUnit?: string;
    denominatorFactor?: number;
    denominatorFactorUnit?: string;
  };
  templateConfig?: DeviceIntensityTemplateConfig;
}

const factoryOption: IntensityObjectOption = { objectId: 'factory', objectName: '全厂', objectType: 'factory', energyUnitId: null };
const annualAmount = (record: V11EnergyRecord | V11OperationMetric) =>
  'monthlyValues' in record && record.entryMode === 'monthly'
    ? (record.monthlyReportedMonths?.every(Boolean) ?? record.monthlyValues.length === 12)
      ? record.monthlyValues.reduce((sum, value) => sum + value, 0)
      : record.annualValue > 0 ? record.annualValue : record.monthlyValues.reduce((sum, value) => sum + value, 0)
    : 'annualValue' in record ? record.annualValue : v11EnergyRecordAnnualAmount(record as V11EnergyRecord);
const energyTypeName = (id: string) => listV11EnergyTypes().find((item) => item.energyTypeId === id)?.energyTypeName ?? '';
const standardCoalFactor = (id: string) => {
  const type = listV11EnergyTypes().find((item) => item.energyTypeId === id);
  return type?.standardCoalFactorUnit.startsWith('kgce/') ? (type.standardCoalFactor / 1000) : (type?.standardCoalFactor ?? 0);
};
const standardCoalTotal = (records: V11EnergyRecord[]) => records.reduce((sum, record) => sum + annualAmount(record) * standardCoalFactor(record.energyTypeId), 0);
const operationByName = (records: V11OperationMetric[], names: string[]) => records.find((record) => names.some((name) => record.metricName.includes(name)));

function conversionAmountToGJ(amount: number, unit?: string) {
  if (!Number.isFinite(amount)) return null;
  if (unit === 'GJ') return amount;
  if (unit === 'MJ') return amount / 1000;
  if (unit === 'kWh') return amount * 0.0036;
  if (unit === 'MWh') return amount * 3.6;
  return null;
}

function derivedUtilitySupplyOperation(year: number, utilityId: string): V11OperationMetric | null {
  const units = listEnergyUnits();
  const utilityChildren = new Set(units.filter((unit) => unit.parentEnergyUnitId === utilityId).map((unit) => unit.energyUnitId));
  const conversions = listV11ConversionOutputs().filter((record) => record.year === year && record.conversionEnergyUnitId !== null && utilityChildren.has(record.conversionEnergyUnitId));
  if (!conversions.length) return null;
  const hasMonthlyValues = conversions.every((record) => record.monthlyInternalAmounts?.length === 12);

  const monthlyValues = Array.from({ length: 12 }, (_, month) => conversions.reduce<number>((sum, record) => {
    const amount = record.monthlyInternalAmounts?.[month];
    const converted = amount === undefined ? 0 : conversionAmountToGJ(amount, record.outputUnit);
    return sum + (converted ?? NaN);
  }, 0));
  const annualValues = conversions.map((record) => conversionAmountToGJ(
    record.internalAmount ?? record.monthlyInternalAmounts?.reduce((sum, value) => sum + value, 0) ?? 0,
    record.outputUnit,
  ));
  if (annualValues.some((value) => value === null) || monthlyValues.some((value) => !Number.isFinite(value))) return null;
  return {
    operationMetricId: `derived-energy-conversion-supply-${utilityId}-${year}`,
    metricCode: 'energy_supply_derived',
    productId: null,
    year,
    scopeLevel: '一级用能单元',
    energyUnitId: utilityId,
    metricCategory: '运行指标',
    aggregationMethod: '月度求和',
    metricName: '动力中心有效供能量',
    metricUnit: 'GJ',
    entryMode: hasMonthlyValues ? 'monthly' : 'annual',
    annualValue: annualValues.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    monthlyValues: hasMonthlyValues ? monthlyValues : [],
  };
}

function monthlyRecordAmounts(record: V11EnergyRecord) {
  return record.entryMode === 'monthly' ? [...record.monthlyAmounts] : [];
}

function monthlyOperationAmounts(record: V11OperationMetric) {
  return record.entryMode === 'monthly' ? [...record.monthlyValues] : [];
}

function addMonthly(target: number[], values: number[]) {
  values.forEach((value, index) => { target[index] += value; });
}

function hasActualMonthlyData(energyRecords: V11EnergyRecord[], operationRecords: V11OperationMetric[]) {
  return energyRecords.length > 0
    && energyRecords.every((record) => record.entryMode === 'monthly')
    && operationRecords.length > 0
    && operationRecords.every((record) => record.entryMode === 'monthly');
}

function calculateMonthlyMetrics(metric: CalculatedIntensityMetric, energyRecords: V11EnergyRecord[], operationRecords: V11OperationMetric[]) {
  const standardCoal = Array.from({ length: 12 }, () => 0);
  const electricity = Array.from({ length: 12 }, () => 0);
  const energyReported = Array.from({ length: 12 }, () => true);
  energyRecords.forEach((record) => {
    const amounts = monthlyRecordAmounts(record);
    const reported = record.monthlyReportedMonths ?? record.monthlyAmounts.map((value) => value !== 0);
    reported.forEach((isReported, index) => { energyReported[index] = energyReported[index] && Boolean(isReported); });
    addMonthly(electricity, energyTypeName(record.energyTypeId) === '电力' ? amounts : Array(12).fill(0));
    addMonthly(standardCoal, amounts.map((amount) => amount * standardCoalFactor(record.energyTypeId)));
  });
  const denominator = Array.from({ length: 12 }, () => 0);
  const operationReported = Array.from({ length: 12 }, () => true);
  operationRecords.forEach((record) => {
    const amounts = monthlyOperationAmounts(record);
    amounts.forEach((value, index) => { operationReported[index] = operationReported[index] && Number.isFinite(value); });
    addMonthly(denominator, amounts);
  });
  const isElectricity = metric.name.includes('电耗');
  const isProduct = metric.intensityMetricId.includes('product-energy') || metric.intensityMetricId.includes('product-electricity');
  const isAddedValue = metric.intensityMetricId.includes('added-value');
  const isOutputValue = metric.intensityMetricId.includes('output-value');
  return Array.from({ length: 12 }, (_, index) => {
    const numerator = isElectricity ? electricity[index] : standardCoal[index];
    const hasData = energyReported[index] && operationReported[index] && denominator[index] > 0;
    const value = hasData
      ? isOutputValue || isAddedValue
        ? standardCoal[index] / denominator[index]
        : (isElectricity ? electricity[index] : standardCoal[index] * 1000) / denominator[index]
      : null;
    return {
      month: index + 1,
      numerator,
      denominator: operationReported[index] ? denominator[index] : null,
      value,
      momChange: null,
      yoyChange: null,
      status: value === null ? '数据不完整' as const : '已计算' as const,
    };
  }).map((item, index, items) => {
    const previousValue = items[index - 1]?.value;
    return {
      ...item,
      momChange: index > 0 && item.value !== null && previousValue !== null && previousValue !== undefined && previousValue !== 0
        ? (item.value - previousValue) / previousValue * 100
        : null,
    };
  });
}

function attachTrend(
  metric: CalculatedIntensityMetric,
  energy: V11EnergyRecord[],
  operations: V11OperationMetric[],
  previousEnergy: V11EnergyRecord[] = [],
  previousOperations: V11OperationMetric[] = [],
) {
  const energyRecords = energy.filter((record) => metric.energyRecordIds.includes(record.energyRecordId));
  const operationRecords = operations.filter((record) => metric.operationMetricIds.includes(record.operationMetricId));
  if (!hasActualMonthlyData(energyRecords, operationRecords)) {
    return {
      ...metric,
      trend: [],
      trendBasis: undefined,
      monthlyMetrics: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        numerator: null,
        denominator: null,
        value: null,
        momChange: null,
        yoyChange: null,
        status: '暂无月度数据' as const,
      })),
      monthlyDataStatus: 'unavailable' as const,
    };
  }
  const monthlyMetrics = calculateMonthlyMetrics(metric, energyRecords, operationRecords);
  const priorEnergyRecords = previousEnergy.filter((record) => energyRecords.some((current) => current.energyTypeId === record.energyTypeId && current.energyUnitId === record.energyUnitId && current.scopeId === record.scopeId));
  const priorOperationRecords = previousOperations.filter((record) => operationRecords.some((current) => current.metricCode === record.metricCode && current.productId === record.productId && current.energyUnitId === record.energyUnitId && current.metricName === record.metricName));
  const priorMetrics = priorEnergyRecords.length > 0 && priorOperationRecords.length > 0
    ? calculateMonthlyMetrics(metric, priorEnergyRecords, priorOperationRecords)
    : [];
  const monthlyMetricsWithYoy = monthlyMetrics.map((item, index) => {
    const priorValue = priorMetrics[index]?.value;
    return {
      ...item,
      yoyChange: item.value !== null && priorValue !== null && priorValue !== undefined && priorValue !== 0
        ? (item.value - priorValue) / priorValue * 100
        : null,
    };
  });
  const complete = monthlyMetricsWithYoy.every((item) => item.status === '已计算');
  const monthlyDataStatus: IntensityMonthlyDataStatus = complete ? 'complete' : 'incomplete';
  const isProduct = metric.intensityMetricId.includes('product-energy') || metric.intensityMetricId.includes('product-electricity');
  const isAddedValue = metric.intensityMetricId.includes('added-value');
  const isOutputValue = metric.intensityMetricId.includes('output-value');
  return {
    ...metric,
    trend: complete && (isProduct || isAddedValue || isOutputValue)
      ? monthlyMetricsWithYoy.map((item) => item.value ?? 0)
      : [],
    trendBasis: 'actual-monthly' as const,
    monthlyMetrics: monthlyMetricsWithYoy,
    monthlyDataStatus,
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
    .map((unit) => ({ objectId: unit.energyUnitId, objectName: unit.energyUnitName, objectType, energyUnitId: unit.energyUnitId, unitKind: unit.unitType === '生产单元' || unit.unitType === '工序/环节' ? 'production' : 'utility', unitLevel: unit.unitLevel, unitType: unit.unitType, conversionScenarios: unit.conversionScenarios }));
}

function utilityMetrics(object: IntensityObjectOption, year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const isBoiler = object.conversionScenarios?.includes('锅炉产汽/产热') ?? false;
  const isWasteHeatPower = object.conversionScenarios?.includes('余热发电') ?? false;
  const isCompressedAir = object.conversionScenarios?.includes('空压产气/压缩空气') ?? false;
  if (isCompressedAir) {
    const electricity = energy.filter((record) => energyTypeName(record.energyTypeId) === '电力');
    return [baseMetric(
      `${object.objectId}-supply-electricity`,
      '单位供气电耗',
      'kWh/Nm³',
      '空压系统电力消费量 ÷ 供气量',
      null,
      `${electricity.reduce((sum, record) => sum + annualAmount(record), 0).toLocaleString('zh-CN')} kWh`,
      '缺少供气量',
      year,
      electricity.map((record) => record.energyRecordId),
      [],
      '缺少供气量',
    )];
  }
  if (isWasteHeatPower) {
    const conversion = listV11ConversionOutputs().find((item) => item.year === year && item.recordType === '余热发电' && item.conversionEnergyUnitId === object.energyUnitId);
    const input = conversion?.recoveryAmount && conversion.recoveryUnit === 'GJ'
      ? standardCoalAmount(conversion.recoveryAmount, 'v11-energy-waste-heat')
      : 0;
    const output = conversion?.outputAmount && conversion.outputEnergyTypeId
      ? standardCoalAmount(conversion.outputAmount, conversion.outputEnergyTypeId)
      : 0;
    const missing: IntensityIssue | undefined = input <= 0 || output <= 0 ? '缺少余热发电转换数据' : undefined;
    return [baseMetric(
      `${object.objectId}-conversion-efficiency`,
      '余热发电转换效率',
      '%',
      '发电量折标值 ÷ 回收余热折标值 × 100%',
      missing ? null : output / input * 100,
      `回收余热折标量 ${input.toLocaleString('zh-CN')} tce`,
      `发电量折标量 ${output.toLocaleString('zh-CN')} tce`,
      year,
      [],
      [],
      missing,
    )];
  }
  const outputCandidates = operations.filter((record) => isBoiler
    ? record.metricCode === 'steam_output' || record.metricName.includes('蒸汽产量')
    : record.energyUnitId === object.energyUnitId && (record.metricCode === 'energy_supply_derived' || record.metricCode === 'energy_supply' || record.metricCode === 'building_area' || record.metricCode === 'logistics_throughput' || record.metricCode === 'business_volume' || record.metricName.includes('业务量') || record.metricName.includes('运行量')));
  // 月度分析优先使用月度运营记录；年度单值只作为年度模式的回退来源。
  const output = outputCandidates.find((record) => record.entryMode === 'monthly') ?? outputCandidates[0];
  const isLogistics = output?.metricCode === 'logistics_throughput';
  const expectedDenominator = object.unitType === '公辅系统'
    ? { name: '动力中心供能量', unit: 'GJ' }
    : object.unitType === '建筑/区域'
      ? isLogistics ? { name: '货物吞吐量', unit: 't' } : { name: '办公建筑面积', unit: 'm²' }
      : { name: '运营量', unit: '运营量' };
  const typeName = isBoiler
    ? '单位蒸汽综合能耗'
    : object.unitType === '公辅系统'
      ? '单位供能量综合能耗'
      : object.unitType === '建筑/区域'
        ? isLogistics ? '单位物流作业量综合能耗' : '单位建筑面积综合能耗'
        : output ? `单位运行能耗（按${output.metricName}）` : '单位运行能耗';
  const unit = isBoiler ? 'kgce/t' : `kgce/${output?.metricUnit ?? expectedDenominator.unit}`;
  const annualOutputAmount = output?.metricCode === 'building_area' && output.annualValue > 0
    ? output.annualValue
    : output ? annualAmount(output) : 0;
  const denominatorLabel = output?.metricName ?? (isBoiler ? '蒸汽产量' : expectedDenominator.name);
  const missing: IntensityIssue | undefined = isBoiler && !output ? '缺少蒸汽产量' : !output ? '缺少适用运营分母' : undefined;
  const coal = standardCoalTotal(energy);
  const result = baseMetric(`${object.objectId}-utility`, typeName, unit, isBoiler ? '年度折标综合能耗 ÷ 蒸汽产量' : `年度综合能耗 ÷ ${denominatorLabel}`, missing ? null : coal * 1000 / annualOutputAmount, `${object.objectName}综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `${output.metricName} ${annualOutputAmount.toLocaleString('zh-CN')} ${output.metricUnit}` : '未匹配到当前对象的运营数据', year, energy.map((record) => record.energyRecordId), output ? [output.operationMetricId] : [], missing);
  return [{
    ...result,
    denominatorSource: output?.metricCode === 'energy_supply_derived' ? '能源转换与流向—动力中心下属二级系统有效内部供能汇总' : '运营数据',
    source: output?.metricCode === 'energy_supply_derived' ? '能源数据与能源转换与流向（按动力中心及年度匹配）' : result.source,
  }];
}

function productMetrics(object: IntensityObjectOption, year: number, enterpriseEnergy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  // 一期产品口径：产品产量来自一级用能单元运营数据，能源量取关联生产单元统计。
  // 不做多产品能源分配；同一生产单元关联多个产品时不计算产品独立能耗。
  const scopedOutputRecords = operations.filter((record) => record.metricCode === 'product_output' && record.productId === object.objectId && annualAmount(record) > 0);
  const outputByUnit = new Map<string, V11OperationMetric[]>();
  scopedOutputRecords.forEach((record) => {
    const key = record.energyUnitId ?? record.operationMetricId;
    outputByUnit.set(key, [...(outputByUnit.get(key) ?? []), record]);
  });
  const selectedOutputs = [...outputByUnit.values()].flatMap((records) => {
    const monthly = records.filter((record) => record.entryMode === 'monthly');
    return monthly.length ? monthly : records;
  });
  const output = selectedOutputs[0];
  const outputAmount = selectedOutputs.reduce((sum, record) => sum + annualAmount(record), 0);
  const coal = standardCoalTotal(enterpriseEnergy);
  const productUnit = output?.metricUnit ?? 't';
  const unitProductIds = new Map<string, Set<string>>();
  operations
    .filter((record) => record.metricCode === 'product_output' && record.energyUnitId && annualAmount(record) > 0)
    .forEach((record) => {
      const products = unitProductIds.get(record.energyUnitId!) ?? new Set<string>();
      if (record.productId) products.add(record.productId);
      unitProductIds.set(record.energyUnitId!, products);
    });
  const relatedUnitIds = [...new Set(selectedOutputs.map((record) => record.energyUnitId).filter((id): id is string => Boolean(id)))];
  const hasSharedUnit = relatedUnitIds.some((unitId) => (unitProductIds.get(unitId)?.size ?? 0) > 1);
  const missing: IntensityIssue | undefined = !relatedUnitIds.length
      ? '未关联生产用能单元'
    : !enterpriseEnergy.length
      ? '缺少能源数据'
      : undefined;
  const operationIds = selectedOutputs.map((record) => record.operationMetricId);
  const denominator = output ? `${object.objectName}产量 ${outputAmount.toLocaleString('zh-CN')} ${productUnit}` : '缺少当前产品产量';
  const relatedUnits = relatedUnitIds;
  const directMetric = baseMetric(`${object.objectId}-linked-unit-energy`, '关联生产单元综合能耗', 'tce', '产品关联一级用能单元综合能源消费量（tce）', enterpriseEnergy.length ? coal : null, `关联生产用能单元综合能耗 ${coal.toLocaleString('zh-CN')} tce`, denominator, year, enterpriseEnergy.map((record) => record.energyRecordId), operationIds, missing);
  return [
    { ...directMetric, benchmarkable: false, relatedEnergyUnitNames: relatedUnits.map((id) => listEnergyUnits().find((unit) => unit.energyUnitId === id)?.energyUnitName ?? id), relatedProductName: object.objectName, allocationDescription: hasSharedUnit ? '同一生产用能单元关联多个产品，一期不进行能源分配。' : '一期按产品关联一级用能单元展示综合能源消费量。', relatedProductOutputTotal: outputAmount },
  ];
}

function deviceTemplate(device: ReturnType<typeof listV11KeyDevices>[number], year: number): DeviceIntensityTemplateConfig | null {
  const customConfig = getDeviceIntensityTemplateConfig(device.deviceId, year);
  const outputBasis = device.outputBasis?.trim();
  if (!outputBasis) return customConfig ?? null;
  if (!customConfig) {
    const energyType = listV11EnergyTypes().find((item) => item.energyTypeId === device.mainEnergyTypeId);
    const numeratorUnit = device.mainEnergyTypeId === 'v11-energy-electricity' ? 'kWh' : 'kgce';
    const numeratorName = device.mainEnergyTypeId === 'v11-energy-electricity' ? '电力消耗' : `${energyType?.energyTypeName ?? '能源'}折标综合能耗`;
    return {
      templateId: 'unit-output-energy',
      metricCode: 'custom-device-work',
      metricName: '单位产出能耗',
      calculationMethod: 'ratio',
      numerator: { source: 'device-energy', energyTypeId: device.mainEnergyTypeId, name: numeratorName, unit: numeratorUnit },
      denominator: { source: 'operation-data', name: outputBasis, unit: '' },
      resultUnit: '',
      factor: 1,
      formula: `${numeratorName} ÷ ${outputBasis}`,
    };
  }
  const formula = customConfig.factor && customConfig.factor !== 1
    ? `${customConfig.numerator.name} × ${customConfig.factor} ÷ ${outputBasis}`
    : `${customConfig.numerator.name} ÷ ${outputBasis}`;
  return {
    ...customConfig,
    denominator: { ...customConfig.denominator, name: outputBasis },
    denominatorName: outputBasis,
    formula,
  };
}

export function calculateDeviceMetric({ numerator, denominator, method, factor = 1 }: { numerator: number; denominator: number; method: 'ratio' | 'percentage'; factor?: number }) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator * (method === 'percentage' ? factor : 1);
}

function standardCoalAmount(amount: number, energyTypeId: string) {
  const type = listV11EnergyTypes().find((item) => item.energyTypeId === energyTypeId);
  if (!type) return 0;
  const converted = amount * type.standardCoalFactor;
  return type.standardCoalFactorUnit.startsWith('kgce') ? converted / 1000 : converted;
}

function deviceMonthlyMetricValues(
  value: number | null,
  monthlyEnergy: number[],
  reportedMonths: boolean[],
  monthlyDenominator: Array<number | null>,
  denominatorReportedMonths: boolean[],
  numeratorFactor = 1,
) {
  if (value === null) return Array(12).fill(null) as Array<number | null>;
  return monthlyEnergy.map((energy, index) => reportedMonths[index] && denominatorReportedMonths[index] && (monthlyDenominator[index] ?? 0) > 0
    ? energy * numeratorFactor / monthlyDenominator[index]!
    : null);
}

export function buildDeviceIntensityRows(year: number, deviceType = 'all', energyUnitId = 'all', deviceId = 'all'): DeviceIntensityRow[] {
  const devices = listV11KeyDevices()
    .filter((device) => deviceType === 'all' || device.deviceType === deviceType)
    .filter((device) => energyUnitId === 'all' || device.energyUnitId === energyUnitId)
    .filter((device) => deviceId === 'all' || device.deviceId === deviceId);
  const records = listV11EnergyRecords().filter((record) => record.year === year && record.energyRole === '能源消费' && record.scopeType === 'device');
  return devices.map((device) => {
    const template = deviceTemplate(device, year);
    if (!template) {
      const record = records.find((item) => item.scopeId === device.deviceId);
      const months = record?.monthlyReportedMonths ?? record?.monthlyAmounts.map((value) => value > 0);
      const reportedMonths = months ?? Array(12).fill(false);
      const reportedCount = reportedMonths.filter(Boolean).length;
      const energyType = listV11EnergyTypes().find((item) => item.energyTypeId === (record?.energyTypeId ?? device.mainEnergyTypeId));
      return {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        energyUnitName: listEnergyUnits().find((unit) => unit.energyUnitId === device.energyUnitId)?.energyUnitName ?? '未知用能单元',
        energyUnitId: device.energyUnitId,
        deviceType: device.deviceType,
        metricCode: null,
        metricName: '暂无适用典型指标',
        metricUnit: '—',
        formula: '当前设备暂无适用的典型能效指标模板',
        annualEnergy: record ? annualAmount(record) : 0,
        energyUnit: energyType?.measurementUnit === 'Nm³' ? 'Nm³' : 'kWh',
        dataProgress: `${reportedCount}/12月`,
        completeEnergy: Boolean(record && reportedCount === 12),
        parameter: undefined,
        value: null,
        resultStatus: '暂不可计算',
        resultReason: '暂无适用典型指标模板',
        energyRecordId: record?.energyRecordId ?? null,
        energyTypeName: energyType?.energyTypeName ?? '—',
        standardCoalFactor: energyType ? standardCoalFactor(energyType.energyTypeId) : 0,
        standardCoalFactorUnit: energyType?.standardCoalFactorUnit ?? '',
        reportedMonths,
        monthlyEnergy: record?.monthlyAmounts ?? Array(12).fill(0),
        monthlyDenominator: Array(12).fill(null),
        denominatorUnit: '—',
        monthlyMetricValues: Array(12).fill(null),
        templateConfig: undefined,
      };
    }
    const record = records.find((item) => item.scopeId === device.deviceId && item.energyTypeId === template.numerator.energyTypeId);
    const months = record?.monthlyReportedMonths ?? record?.monthlyAmounts.map((value) => value > 0);
    const reportedMonths = months ?? Array(12).fill(false);
    const reportedCount = reportedMonths.filter(Boolean).length;
    const completeEnergy = Boolean(record && reportedCount === 12);
    const annualEnergy = record ? annualAmount(record) : 0;
    const parameter = getDeviceIntensityParameter(device.deviceId, year, template.metricCode);
    const conversion = template.denominator.source === 'energy-conversion'
      ? listV11ConversionOutputs().find((item) => item.year === year && item.recordType === template.denominator.recordType && item.conversionEnergyUnitId === device.energyUnitId)
      : undefined;
    const monthlyParameterValues = parameter?.monthlyValues ?? [];
    const monthlyDenominator = conversion?.monthlyOutputAmounts
      ? conversion.monthlyOutputAmounts.map((value) => value ?? null)
      : monthlyParameterValues.length === 12
        ? monthlyParameterValues
        : Array(12).fill(null);
    const denominatorReportedMonths = conversion
      ? monthlyDenominator.map((value) => value !== null && value > 0)
      : monthlyDenominator.map((value) => value !== null && Number.isFinite(value) && value > 0);
    const hasCompleteMonthlyDenominator = denominatorReportedMonths.length === 12 && denominatorReportedMonths.every(Boolean);
    const effectiveParameterValue = hasCompleteMonthlyDenominator
      ? monthlyDenominator.reduce<number>((total, item) => total + (item ?? 0), 0)
      : parameter?.entryMode === 'annual-fallback'
        ? parameter.annualValue ?? parameter.value
        : conversion?.outputAmount ?? parameter?.value;
    const numerator = template.numerator.energyTypeId === 'v11-energy-electricity' ? annualEnergy : annualEnergy * standardCoalFactor(record?.energyTypeId ?? template.numerator.energyTypeId ?? '');
    const value = completeEnergy && effectiveParameterValue && effectiveParameterValue > 0
      ? calculateDeviceMetric({ numerator: numerator * (template.factor ?? 1), denominator: effectiveParameterValue, method: 'ratio' })
      : null;
    const denominatorUnit = template.denominator.source === 'operation-data'
      ? parameter?.unit?.trim() || template.denominator.unit
      : template.denominator.unit;
    const resultUnit = denominatorUnit ? `${template.numerator.unit}/${denominatorUnit}` : '—';
    const energyType = listV11EnergyTypes().find((item) => item.energyTypeId === record?.energyTypeId);
    const resultReason = reportedCount === 0
      ? '能源数据未录入'
      : reportedCount < 12
        ? '能源数据部分录入'
        : !effectiveParameterValue
          ? `缺少${template.denominator.name}`
          : null;
    const resultStatus = resultReason === null ? '已计算' : '待完善';
    const monthlyEnergy = record?.monthlyAmounts ?? Array(12).fill(0);
    const denominatorReportedCount = denominatorReportedMonths.filter(Boolean).length;
    const dataProgress = template.denominator.source === 'energy-conversion'
      ? `${reportedCount}/12月｜产出${denominatorReportedCount}/12月`
      : `${reportedCount}/12月`;
    return { deviceId: device.deviceId, deviceName: device.deviceName, energyUnitName: listEnergyUnits().find((unit) => unit.energyUnitId === device.energyUnitId)?.energyUnitName ?? '未知用能单元', energyUnitId: device.energyUnitId, deviceType: device.deviceType, metricCode: template.metricCode, metricName: template.metricName, metricUnit: resultUnit, formula: template.formula ?? `${template.numerator.name} ÷ ${template.denominator.name}`, annualEnergy, energyUnit: template.numerator.unit, dataProgress, completeEnergy, parameter, value, resultStatus, resultReason, energyRecordId: record?.energyRecordId ?? null, energyTypeName: energyType?.energyTypeName ?? '—', standardCoalFactor: energyType ? standardCoalFactor(energyType.energyTypeId) : 0, standardCoalFactorUnit: energyType?.standardCoalFactorUnit ?? '', reportedMonths, monthlyEnergy, monthlyDenominator, denominatorUnit, monthlyMetricValues: deviceMonthlyMetricValues(value, monthlyEnergy, reportedMonths, monthlyDenominator, denominatorReportedMonths, template.factor ?? 1), calculationInputs: conversion ? { conversionOutputId: conversion.conversionOutputId, numerator, denominator: effectiveParameterValue ?? 0, unit: resultUnit, numeratorRaw: annualEnergy, numeratorRawUnit: template.numerator.unit, denominatorRaw: effectiveParameterValue, denominatorRawUnit: denominatorUnit } : undefined, templateConfig: template };
  });
}

function metric(input: Omit<CalculatedIntensityMetric, 'yearOnYear' | 'resultType' | 'resultStatus' | 'period' | 'monthlyMetrics' | 'monthlyDataStatus'> & { year: number; missing?: IntensityIssue }) : CalculatedIntensityMetric {
  const valid = input.value !== null;
  const status: IntensityResultStatus = valid
    ? '已计算'
    : input.missing === '当前产品无法直接汇总' || input.missing === '未关联生产用能单元' || input.missing === '缺少必要关联关系' || input.missing === '多产品共用生产用能单元，未配置能源分配'
      ? '暂不可计算'
      : input.missing === '缺少工业增加值' || input.missing === '数据缺失' || input.missing === '缺少能源数据'
        ? '数据缺失'
        : '待完善';
  return {
    ...input,
    yearOnYear: null,
    resultType: valid ? 'ok' : 'warn',
    resultStatus: status,
    period: `${input.year}年度`,
    trend: [],
    monthlyMetrics: [],
    monthlyDataStatus: 'unavailable',
  };
}

function baseMetric(id: string, name: string, unit: string, formula: string, value: number | null, numerator: string, denominator: string, year: number, energyRecordIds: string[], operationMetricIds: string[], missing?: IntensityIssue): CalculatedIntensityMetric {
  return metric({ intensityMetricId: id, name, unit, value, formula, numerator, denominator, source: '能源数据与运营数据（按对象层级、对象ID和年度匹配）', numeratorSource: '能源数据', denominatorSource: '运营数据', energyBasis: '按能源品种折算为标准煤后计算', energyRecordIds, operationMetricIds, issue: value === null ? missing : undefined, year, missing, trend: [] });
}

function factoryMetrics(year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const coal = standardCoalTotal(energy);
  const ids = energy.map((r) => r.energyRecordId);
  const output = operationByName(operations, ['企业产品产量', '产品产量']);
  const value = operationByName(operations, ['工业总产值']);
  // 保留“单位增加值综合能耗”无分母的展示场景，验证页面对数据缺失的处理。
  const added = undefined;
  const productUnit = output?.metricUnit ?? 't';
  return [
    baseMetric('factory-product-energy', '单位产品综合能耗', `kgce/${productUnit}`, '企业级综合能耗 ÷ 企业产品产量', output && coal > 0 ? coal * 1000 / annualAmount(output) : null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `企业产品产量 ${annualAmount(output).toLocaleString('zh-CN')} ${productUnit}` : '缺少企业产品产量', year, ids, output ? [output.operationMetricId] : [], output ? undefined : '缺少产品产量'),
    baseMetric('factory-output-value-energy', '单位产值综合能耗', 'tce/万元', '企业级综合能耗 ÷ 工业总产值', value && coal > 0 ? coal / annualAmount(value) : null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, value ? `工业总产值 ${annualAmount(value).toLocaleString('zh-CN')} 万元` : '缺少工业总产值', year, ids, value ? [value.operationMetricId] : []),
    baseMetric('factory-added-value-energy', '单位增加值综合能耗', 'tce/万元', '企业级综合能耗 ÷ 工业增加值', null, `企业级综合能耗 ${coal.toLocaleString('zh-CN')} tce`, '缺少工业增加值', year, ids, [], '缺少工业增加值'),
  ].map((item) => ({ ...item, energyTypeNames: [...new Set(energy.map((record) => energyTypeName(record.energyTypeId)))] }));
}

function unitMetrics(object: IntensityObjectOption, year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const coal = standardCoalTotal(energy);
  const outputGroups = new Map<string, V11OperationMetric[]>();
  operations
    .filter((record) => record.metricCode === 'product_output' && record.energyUnitId === object.energyUnitId && annualAmount(record) > 0)
    .forEach((record) => {
      const key = record.productId ?? record.operationMetricId;
      outputGroups.set(key, [...(outputGroups.get(key) ?? []), record]);
    });
  const outputs = [...outputGroups.values()].map((records) => records.find((record) => record.entryMode === 'monthly') ?? records[0]);
  const output = outputs[0];
  const productUnit = output?.metricUnit ?? 't';
  const sameUnit = outputs.every((record) => record.metricUnit === productUnit);
  const outputAmount = outputs.reduce((sum, record) => sum + annualAmount(record), 0);
  const outputNames = outputs.map((record) => record.productId ? getProduct(record.productId)?.productName ?? '关联产品' : '关联产品');
  const name = object.objectName;
  const missing = !energy.length ? '缺少能源数据' : !outputs.length || !sameUnit ? '缺少产品产量' : undefined;
  return [
    baseMetric(`${object.objectId}-product-energy`, '单位产品综合能耗', `kgce/${productUnit}`, `${name}综合能耗（tce）×1000 ÷ 关联产品产量合计`, missing ? null : coal * 1000 / outputAmount, `${name}综合能耗 ${coal.toLocaleString('zh-CN')} tce`, outputs.length ? `关联产品产量合计 ${outputAmount.toLocaleString('zh-CN')} ${productUnit}` : '未关联产品产量', year, energy.map((r) => r.energyRecordId), outputs.map((record) => record.operationMetricId), missing),
  ].map((item) => ({ ...item, relatedProductName: outputNames.length ? outputNames.join('、') : undefined, allocationDescription: outputNames.length ? `${outputNames.join('、')}按当前用能单元产量记录合计；仅汇总计量单位一致的产品产量。` : undefined, energyTypeNames: [...new Set(energy.map((record) => energyTypeName(record.energyTypeId)))] }));
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
  const totalOutput = productOutputs.reduce((sum, record) => sum + annualAmount(record), 0);
  const missing: IntensityIssue | undefined = !enterpriseEnergy.length ? '缺少能源数据' : !productOutputs.length || totalOutput <= 0 ? '缺少产品产量' : units.length !== 1 ? '当前产品无法直接汇总' : undefined;
  const productUnit = units[0] ?? products[0]?.unit ?? 't';
  const denominator = productOutputs.length ? `运营数据—产品产量合计 ${totalOutput.toLocaleString('zh-CN')} ${productUnit}` : '缺少年度产品产量';
  const common = { energyTypeNames: [...new Set(enterpriseEnergy.map((record) => energyTypeName(record.energyTypeId)))], numeratorSource: '能源数据—企业层级—全厂', denominatorSource: '运营数据—产品产量' };
  return [
    { ...baseMetric(`${object.objectId}-product-energy`, '单位产品综合能耗', `kgce/${productUnit}`, '企业年度综合能耗（tce）×1000÷产品年度产量合计', !missing && coal > 0 ? coal * 1000 / totalOutput : null, `企业年度综合能耗 ${coal.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} tce`, denominator, year, enterpriseEnergy.map((record) => record.energyRecordId), productOutputs.map((record) => record.operationMetricId), missing), ...common, energyBasis: '企业边界能源消费按能源品种折算为标准煤' },
  ];
}

export function buildIntensityCalculationView(year: number, objectType: IntensityObjectType, objectId: string): IntensityCalculationView {
  const object = listIntensityObjects(objectType).find((item) => item.objectId === objectId) ?? (objectType === 'product' ? { objectId: 'product-summary', objectName: '企业产品综合口径', objectType, energyUnitId: null } : factoryOption);
  const all = listV11EnergyRecords().filter((r) => r.year === year && r.energyRole === '能源消费');
  const previousAll = listV11EnergyRecords().filter((r) => r.year === year - 1 && r.energyRole === '能源消费');
  const productUnitIds = objectType === 'product'
    ? new Set(listV11OperationMetrics().filter((r) => r.year === year && r.metricCode === 'product_output' && r.productId === object.objectId && r.energyUnitId).map((r) => r.energyUnitId!))
    : new Set<string>();
  const previousProductUnitIds = objectType === 'product'
    ? new Set(listV11OperationMetrics().filter((r) => r.year === year - 1 && r.metricCode === 'product_output' && r.productId === object.objectId && r.energyUnitId).map((r) => r.energyUnitId!))
    : new Set<string>();
  const energy = objectType === 'factory'
    ? all.filter((r) => v11RecordScopeType(r) === 'enterprise' || r.scopeLevel === '企业')
    : objectType === 'product'
      ? all.filter((r) => v11RecordScopeType(r) !== 'device' && productUnitIds.has(r.energyUnitId ?? ''))
    : all.filter((r) => v11RecordScopeType(r) !== 'device' && r.energyUnitId === object.energyUnitId);
  const previousEnergy = objectType === 'factory'
    ? previousAll.filter((r) => v11RecordScopeType(r) === 'enterprise' || r.scopeLevel === '企业')
    : objectType === 'product'
      ? previousAll.filter((r) => v11RecordScopeType(r) !== 'device' && previousProductUnitIds.has(r.energyUnitId ?? ''))
    : previousAll.filter((r) => v11RecordScopeType(r) !== 'device' && r.energyUnitId === object.energyUnitId);
  const operations = listV11OperationMetrics().filter((r) => r.year === year && (objectType === 'factory' ? r.scopeLevel === '企业' : objectType === 'product' ? r.productId === object.objectId : r.energyUnitId === object.energyUnitId));
  const derivedSupply = objectType === 'unit' && object.objectId === 'eu-utilities' ? derivedUtilitySupplyOperation(year, object.objectId) : null;
  const effectiveOperations = derivedSupply ? [...operations.filter((record) => record.metricCode !== 'energy_supply'), derivedSupply] : operations;
  const previousOperations = listV11OperationMetrics().filter((r) => r.year === year - 1 && (objectType === 'factory' ? r.scopeLevel === '企业' : objectType === 'product' ? r.productId === object.objectId : r.energyUnitId === object.energyUnitId));
  const previousDerivedSupply = objectType === 'unit' && object.objectId === 'eu-utilities' ? derivedUtilitySupplyOperation(year - 1, object.objectId) : null;
  const effectivePreviousOperations = previousDerivedSupply ? [...previousOperations.filter((record) => record.metricCode !== 'energy_supply'), previousDerivedSupply] : previousOperations;
  const metricEnergy = energy;
  const metricPreviousEnergy = previousEnergy;
  const metrics = (objectType === 'factory' ? factoryMetrics(year, energy, effectiveOperations) : objectType === 'product' ? productMetrics(object, year, energy, effectiveOperations) : object.unitKind === 'production' ? unitMetrics(object, year, energy, effectiveOperations) : utilityMetrics(object, year, energy, effectiveOperations))
    .map((item) => attachTrend(item, metricEnergy, effectiveOperations, metricPreviousEnergy, effectivePreviousOperations));
  const calculated = metrics.filter((item) => item.resultType === 'ok').length;
  const operationNames = [...new Set(effectiveOperations.map((record) => `${record.productId ? `${getProduct(record.productId)?.productName ?? '关联产品'}` : ''}${record.productId ? record.metricName.replace(/^产品/, '') : record.metricName}`))];
  return { object, metrics, energyCondition: { linked: energy.length > 0, description: energy.length ? `已关联 ${energy.length} 条能源消费记录` : '未匹配到当前对象的能源消费记录', recordIds: energy.map((r) => r.energyRecordId) }, operationCondition: { linked: effectiveOperations.length > 0, description: effectiveOperations.length ? `已关联：${operationNames.join('、')}` : '未匹配到当前对象的运营数据', recordIds: effectiveOperations.map((r) => r.operationMetricId) }, calculationStatus: calculated === metrics.length ? '可计算' : calculated > 0 ? '部分可计算' : '待补充', pendingReasons: [...new Set(metrics.filter((m) => m.issue).map((m) => m.issue!))] };
}

export function buildIntensityCalculationViews(year: number, objectType: IntensityObjectType, unitLevel: 'all' | 'level1' | 'level2' = 'all', objectId?: string) {
  return listIntensityObjects(objectType).filter((item) => objectType !== 'unit' || unitLevel === 'all' || item.unitLevel === unitLevel).filter((item) => !objectId || objectId === 'all' || item.objectId === objectId).map((item) => buildIntensityCalculationView(year, objectType, item.objectId));
}
