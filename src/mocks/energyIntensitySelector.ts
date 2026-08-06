import {
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11OperationMetrics,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
  type V11EnergyRecord,
  type V11OperationMetric,
} from './dataManagementV11Store';
import { getProduct } from './productMasterStore';
import { listEnergyUnits } from './energyUnitMockStore';

export type IntensityObjectType = 'factory' | 'production' | 'utility';

export interface IntensityObjectOption {
  objectId: string;
  objectName: string;
  objectType: IntensityObjectType;
  energyUnitId: string | null;
}

export interface CalculatedIntensityMetric {
  intensityMetricId: string;
  name: string;
  value: number | null;
  unit: string;
  yearOnYear: number | null;
  resultStatus: '可计算' | '待补充';
  resultType: 'ok' | 'warn';
  formula: string;
  numerator: string;
  denominator: string;
  source: string;
  period: string;
  issue?: string;
  energyRecordIds: string[];
  operationMetricIds: string[];
}

export interface IntensityCalculationView {
  object: IntensityObjectOption;
  metrics: CalculatedIntensityMetric[];
  energyCondition: {
    linked: boolean;
    description: string;
    recordIds: string[];
  };
  operationCondition: {
    linked: boolean;
    description: string;
    recordIds: string[];
  };
  calculationStatus: '可计算' | '部分可计算' | '待补充';
  pendingReasons: string[];
}

const factoryOption: IntensityObjectOption = {
  objectId: 'factory',
  objectName: '全厂',
  objectType: 'factory',
  energyUnitId: null,
};

const publicSystemIds = new Set(['eu-compressed-air', 'eu-gas-boiler', 'eu-waste-heat-power']);

export function listIntensityObjects(objectType: IntensityObjectType): IntensityObjectOption[] {
  if (objectType === 'factory') return [factoryOption];
  return listEnergyUnits()
    .filter((unit) => objectType === 'production'
      ? unit.unitLevel === 'level1' && unit.unitType === '生产单元'
      : publicSystemIds.has(unit.energyUnitId))
    .map((unit) => ({
      objectId: unit.energyUnitId,
      objectName: unit.energyUnitName,
      objectType,
      energyUnitId: unit.energyUnitId,
    }));
}

<<<<<<< Updated upstream
function annualEnergyAmount(record: V11EnergyRecord) {
  return v11EnergyRecordAnnualAmount(record);
=======
function utilityMetrics(object: IntensityObjectOption, year: number, energy: V11EnergyRecord[], operations: V11OperationMetric[]) {
  const isBoiler = object.objectName.includes('锅炉');
  const output = operations.find((record) => isBoiler
    ? record.metricCode === 'steam_output' || record.metricName.includes('蒸汽产量')
    : record.metricCode === 'business_volume' || record.metricName.includes('业务量') || record.metricName.includes('运行量'));
  const typeName = isBoiler ? '单位蒸汽综合能耗' : '单位运行能耗';
  const unit = isBoiler ? 'kgce/t' : 'tce/业务量';
  const missing: IntensityIssue | undefined = isBoiler && !output ? '缺少蒸汽产量' : !output ? '缺少必要关联关系' : undefined;
  const coal = standardCoalTotal(energy);
  return [baseMetric(`${object.objectId}-utility`, typeName, unit, isBoiler ? '年度折标综合能耗 ÷ 蒸汽产量' : '年度综合能耗 ÷ 运营业务量', missing ? null : coal * 1000 / annualAmount(output!), `${object.objectName}综合能耗 ${coal.toLocaleString('zh-CN')} tce`, output ? `${output.metricName} ${annualAmount(output).toLocaleString('zh-CN')} ${output.metricUnit}` : isBoiler ? '未匹配到当前对象的运营数据' : '未匹配到当前对象的运营数据', year, energy.map((record) => record.energyRecordId), output ? [output.operationMetricId] : [], missing)];
>>>>>>> Stashed changes
}

function annualOperationAmount(record: V11OperationMetric) {
  return record.entryMode === 'monthly'
    ? record.monthlyValues.reduce((sum, value) => sum + value, 0)
    : record.annualValue;
}

function standardCoalFactor(energyTypeId: string) {
  const type = listV11EnergyTypes().find((item) => item.energyTypeId === energyTypeId);
  if (!type) return 0;
  return type.standardCoalFactorUnit.startsWith('kgce/') ? type.standardCoalFactor / 1000 : type.standardCoalFactor;
}

function standardCoalTotal(records: V11EnergyRecord[]) {
  return records.reduce((sum, record) => sum + annualEnergyAmount(record) * standardCoalFactor(record.energyTypeId), 0);
}

function findEnergyTypeName(energyTypeId: string) {
  return listV11EnergyTypes().find((item) => item.energyTypeId === energyTypeId)?.energyTypeName ?? '';
}

function describeEnergy(records: V11EnergyRecord[], standardCoal: number) {
  if (!records.length) return '未匹配到当前对象的能源消费记录';
  return `已关联 ${records.length} 条能源消费记录｜${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`;
}

function describeOperations(records: V11OperationMetric[]) {
  if (!records.length) return '未匹配到当前对象的运营数据';
  return `已关联：${records.map((item) => {
    const productName = item.productId ? getProduct(item.productId)?.productName : '';
    return productName && item.metricCode === 'product_output'
      ? `${productName}产量`
      : item.metricName;
  }).join('、')}`;
}

interface MetricInput {
  id: string;
  name: string;
  unit: string;
  formula: string;
  numeratorValue: number | null;
  numeratorDescription: string;
  denominatorRecord?: V11OperationMetric;
  denominatorNames: string;
  calculate: (numerator: number, denominator: number) => number;
  energyRecordIds: string[];
  missingNumerator?: string;
}

function createMetric(input: MetricInput, year: number): CalculatedIntensityMetric {
  const denominatorValue = input.denominatorRecord ? annualOperationAmount(input.denominatorRecord) : null;
  const missing: string[] = [];
  if (input.numeratorValue === null || input.numeratorValue <= 0) missing.push(input.missingNumerator ?? '对应能源消费数据');
  if (denominatorValue === null || denominatorValue <= 0) missing.push(input.denominatorNames);
  const available = missing.length === 0;
  return {
    intensityMetricId: input.id,
    name: input.name,
    value: available ? input.calculate(input.numeratorValue!, denominatorValue!) : null,
    unit: input.unit,
    yearOnYear: null,
    resultStatus: available ? '可计算' : '待补充',
    resultType: available ? 'ok' : 'warn',
    formula: input.formula,
    numerator: input.numeratorDescription,
    denominator: input.denominatorRecord
      ? `运营数据：${input.denominatorRecord.metricName} ${annualOperationAmount(input.denominatorRecord).toLocaleString('zh-CN')} ${input.denominatorRecord.metricUnit}`
      : `运营数据：缺少${input.denominatorNames}`,
    source: '数据管理—能源数据 + 数据管理—运营数据（按 energyUnitId 与年度匹配）',
    period: `${year}年度`,
    issue: available ? undefined : `缺少${missing.join('、')}。`,
    energyRecordIds: [...input.energyRecordIds],
    operationMetricIds: input.denominatorRecord ? [input.denominatorRecord.operationMetricId] : [],
  };
}

function operationByName(records: V11OperationMetric[], names: string[]) {
  return records.find((record) => names.some((name) => record.metricName.includes(name)));
}

function factoryMetrics(
  year: number,
  energyRecords: V11EnergyRecord[],
  operations: V11OperationMetric[],
): CalculatedIntensityMetric[] {
  const standardCoal = standardCoalTotal(energyRecords);
  const electricityRecords = energyRecords.filter((record) => findEnergyTypeName(record.energyTypeId) === '电力');
  const electricity = electricityRecords.reduce((sum, record) => sum + annualEnergyAmount(record), 0);
  const energyIds = energyRecords.map((record) => record.energyRecordId);
  return [
    createMetric({
      id: 'factory-product-energy',
      name: '单位产品综合能耗',
      unit: 'kgce/t',
      formula: '全厂综合能耗 ÷ 企业产品产量',
      numeratorValue: standardCoal,
      numeratorDescription: `能源数据：全厂能源消费折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`,
      denominatorRecord: operationByName(operations, ['企业产品产量', '产品产量']),
      denominatorNames: '企业产品产量',
      calculate: (numerator, denominator) => numerator * 1000 / denominator,
      energyRecordIds: energyIds,
    }, year),
    createMetric({
      id: 'factory-output-value-energy',
      name: '单位产值综合能耗',
      unit: 'tce/万元',
      formula: '全厂综合能耗 ÷ 工业总产值',
      numeratorValue: standardCoal,
      numeratorDescription: `能源数据：全厂能源消费折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`,
      denominatorRecord: operationByName(operations, ['工业总产值']),
      denominatorNames: '工业总产值',
      calculate: (numerator, denominator) => numerator / denominator,
      energyRecordIds: energyIds,
    }, year),
    createMetric({
      id: 'factory-added-value-energy',
      name: '单位增加值综合能耗',
      unit: 'tce/万元',
      formula: '全厂综合能耗 ÷ 工业增加值',
      numeratorValue: standardCoal,
      numeratorDescription: `能源数据：全厂能源消费折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`,
      denominatorRecord: operationByName(operations, ['工业增加值']),
      denominatorNames: '工业增加值',
      calculate: (numerator, denominator) => numerator / denominator,
      energyRecordIds: energyIds,
    }, year),
    createMetric({
      id: 'factory-revenue-electricity',
      name: '单位营业收入电耗',
      unit: 'kWh/万元',
      formula: '全厂电力消费量 ÷ 营业收入',
      numeratorValue: electricity || null,
      numeratorDescription: electricity
        ? `能源数据：全厂电力消费量 ${electricity.toLocaleString('zh-CN')} kWh`
        : '能源数据：缺少全厂电力消费记录',
      denominatorRecord: operationByName(operations, ['营业收入']),
      denominatorNames: '营业收入',
      calculate: (numerator, denominator) => numerator / denominator,
      energyRecordIds: electricityRecords.map((record) => record.energyRecordId),
      missingNumerator: '全厂电力消费数据',
    }, year),
  ];
}

function productionMetrics(
  object: IntensityObjectOption,
  year: number,
  energyRecords: V11EnergyRecord[],
  operations: V11OperationMetric[],
): CalculatedIntensityMetric[] {
  const standardCoal = standardCoalTotal(energyRecords);
  const electricityRecords = energyRecords.filter((record) => findEnergyTypeName(record.energyTypeId) === '电力');
  const electricity = electricityRecords.reduce((sum, record) => sum + annualEnergyAmount(record), 0);
  const productOutput = operationByName(operations, ['产品A产量', '产品B产量', '产品产量']);
  const businessAmount = operationByName(operations, ['业务量']);
  return [
    createMetric({
      id: `${object.objectId}-product-energy`,
      name: '单位产品综合能耗',
      unit: 'kgce/t',
      formula: `${object.objectName}能源消费折标量 ÷ 对应产品产量`,
      numeratorValue: standardCoal || null,
      numeratorDescription: energyRecords.length
        ? `能源数据：${object.objectName} ${energyRecords.length}条记录｜${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`
        : `能源数据：缺少${object.objectName}能源消费记录`,
      denominatorRecord: productOutput,
      denominatorNames: '对应产品产量',
      calculate: (numerator, denominator) => numerator * 1000 / denominator,
      energyRecordIds: energyRecords.map((record) => record.energyRecordId),
    }, year),
    createMetric({
      id: `${object.objectId}-product-electricity`,
      name: '单位产品电耗',
      unit: 'kWh/t',
      formula: `${object.objectName}电力消费量 ÷ 对应产品产量`,
      numeratorValue: electricity || null,
      numeratorDescription: electricity
        ? `能源数据：${object.objectName}电力消费量 ${electricity.toLocaleString('zh-CN')} kWh`
        : `能源数据：缺少${object.objectName}电力消费记录`,
      denominatorRecord: productOutput,
      denominatorNames: '对应产品产量',
      calculate: (numerator, denominator) => numerator / denominator,
      energyRecordIds: electricityRecords.map((record) => record.energyRecordId),
      missingNumerator: '对应电力消费数据',
    }, year),
    createMetric({
      id: `${object.objectId}-business-energy`,
      name: '单位业务量综合能耗',
      unit: 'kgce/业务量',
      formula: `${object.objectName}能源消费折标量 ÷ 业务量`,
      numeratorValue: standardCoal || null,
      numeratorDescription: energyRecords.length
        ? `能源数据：${object.objectName}能源消费折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce`
        : `能源数据：缺少${object.objectName}能源消费记录`,
      denominatorRecord: businessAmount,
      denominatorNames: '业务量数据',
      calculate: (numerator, denominator) => numerator * 1000 / denominator,
      energyRecordIds: energyRecords.map((record) => record.energyRecordId),
    }, year),
  ];
}

function utilityMetrics(
  object: IntensityObjectOption,
  year: number,
  energyRecords: V11EnergyRecord[],
  operations: V11OperationMetric[],
): CalculatedIntensityMetric[] {
  const standardCoal = standardCoalTotal(energyRecords);
  const energyIds = energyRecords.map((record) => record.energyRecordId);
  const electricityRecords = energyRecords.filter((record) => findEnergyTypeName(record.energyTypeId) === '电力');
  const electricity = electricityRecords.reduce((sum, record) => sum + annualEnergyAmount(record), 0);
  const primaryEnergy = energyRecords[0];
  const primaryPhysical = primaryEnergy ? annualEnergyAmount(primaryEnergy) : null;

  if (object.objectId === 'eu-compressed-air') {
    const supply = operationByName(operations, ['压缩空气供应量', '供气量']);
    return [
      createMetric({
        id: `${object.objectId}-electricity`,
        name: '单位供气电耗',
        unit: 'kWh/Nm³',
        formula: '空压系统电力消费量 ÷ 压缩空气供应量',
        numeratorValue: electricity || null,
        numeratorDescription: electricity ? `能源数据：空压系统电力消费量 ${electricity.toLocaleString('zh-CN')} kWh` : '能源数据：缺少空压系统电力消费记录',
        denominatorRecord: supply,
        denominatorNames: '压缩空气供应量',
        calculate: (numerator, denominator) => numerator / denominator,
        energyRecordIds: electricityRecords.map((record) => record.energyRecordId),
        missingNumerator: '空压系统电力消费数据',
      }, year),
      createMetric({
        id: `${object.objectId}-standard-coal`,
        name: '单位供气综合能耗',
        unit: 'kgce/Nm³',
        formula: '空压系统能源消费折标量 ÷ 压缩空气供应量',
        numeratorValue: standardCoal || null,
        numeratorDescription: energyRecords.length ? `能源数据：空压系统能源消费折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce` : '能源数据：缺少空压系统能源消费记录',
        denominatorRecord: supply,
        denominatorNames: '压缩空气供应量',
        calculate: (numerator, denominator) => numerator * 1000 / denominator,
        energyRecordIds: energyIds,
      }, year),
    ];
  }

  if (object.objectId === 'eu-gas-boiler') {
    const steamOutput = operationByName(operations, ['蒸汽产量']);
    return [
      createMetric({
        id: `${object.objectId}-steam-energy`,
        name: '单位蒸汽综合能耗',
        unit: 'kgce/t蒸汽',
        formula: '锅炉燃料消费折标量 ÷ 蒸汽产量',
        numeratorValue: standardCoal || null,
        numeratorDescription: energyRecords.length ? `能源数据：锅炉燃料折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce` : '能源数据：缺少锅炉燃料消费记录',
        denominatorRecord: steamOutput,
        denominatorNames: '蒸汽产量',
        calculate: (numerator, denominator) => numerator * 1000 / denominator,
        energyRecordIds: energyIds,
      }, year),
      createMetric({
        id: `${object.objectId}-steam-gas`,
        name: '单位蒸汽燃料消耗',
        unit: 'Nm³/t蒸汽',
        formula: '天然气消费量 ÷ 蒸汽产量',
        numeratorValue: primaryPhysical,
        numeratorDescription: primaryEnergy ? `能源数据：天然气消费量 ${primaryPhysical!.toLocaleString('zh-CN')} Nm³` : '能源数据：缺少天然气消费记录',
        denominatorRecord: steamOutput,
        denominatorNames: '蒸汽产量',
        calculate: (numerator, denominator) => numerator / denominator,
        energyRecordIds: primaryEnergy ? [primaryEnergy.energyRecordId] : [],
        missingNumerator: '天然气消费数据',
      }, year),
    ];
  }

  const generation = operationByName(operations, ['发电量']);
  return [
    createMetric({
      id: `${object.objectId}-generation-energy`,
      name: '单位发电量回收能源折标量',
      unit: 'kgce/kWh',
      formula: '余热回收折标量 ÷ 发电量',
      numeratorValue: standardCoal || null,
      numeratorDescription: energyRecords.length ? `能源数据：余热回收折标量 ${standardCoal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce` : '能源数据：缺少余热回收能源记录',
      denominatorRecord: generation,
      denominatorNames: '发电量',
      calculate: (numerator, denominator) => numerator * 1000 / denominator,
      energyRecordIds: energyIds,
    }, year),
  ];
}

export function buildIntensityCalculationView(
  year: number,
  objectType: IntensityObjectType,
  objectId: string,
): IntensityCalculationView {
  const objects = listIntensityObjects(objectType);
  const object = objects.find((item) => item.objectId === objectId) ?? objects[0] ?? factoryOption;
  const energyRecords = listV11EnergyRecords().filter((record) =>
    record.year === year
    && record.energyRole === '能源消费'
    && v11RecordScopeType(record) !== 'device'
    && record.energyUnitId === object.energyUnitId);
  const operations = listV11OperationMetrics().filter((record) =>
    record.year === year && record.energyUnitId === object.energyUnitId);
  const standardCoal = standardCoalTotal(energyRecords);
  const metrics = objectType === 'factory'
    ? factoryMetrics(year, energyRecords, operations)
    : objectType === 'production'
      ? productionMetrics(object, year, energyRecords, operations)
      : utilityMetrics(object, year, energyRecords, operations);
  const available = metrics.filter((metric) => metric.resultType === 'ok').length;
  const pendingReasons = [...new Set(metrics.flatMap((metric) =>
    metric.issue ? [metric.issue.replace(/^缺少/, '').replace(/。$/, '')] : []))];
  return {
    object,
    metrics,
    energyCondition: {
      linked: energyRecords.length > 0,
      description: describeEnergy(energyRecords, standardCoal),
      recordIds: energyRecords.map((record) => record.energyRecordId),
    },
    operationCondition: {
      linked: operations.length > 0,
      description: describeOperations(operations),
      recordIds: operations.map((record) => record.operationMetricId),
    },
    calculationStatus: available === metrics.length ? '可计算' : available > 0 ? '部分可计算' : '待补充',
    pendingReasons,
  };
}
