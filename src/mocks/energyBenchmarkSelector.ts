import {
  listV11EnergyRecords,
  listV11EnergyTypes,
  listV11KeyDevices,
  listV11OperationMetrics,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
  type V11EnergyRecord,
  type V11EnergyType,
  type V11OperationMetric,
} from './dataManagementV11Store';
import { getBenchmarkTarget } from './benchmarkTargetStore';
import { listEnergyUnits } from './energyUnitMockStore';
import {
  listProducts,
  resolveProductEnergyAllocation,
} from './productMasterStore';
import type { BenchmarkType } from './energyAnalysisV4Mock';
import type { ProductMaster } from '../types/product';

export interface BenchmarkMetric {
  benchmarkMetricId: string;
  metricCode: string;
  objectId: string;
  objectName: string;
  objectType: '企业' | '用能单元' | '产品' | '设备';
  objectTypeKey: Exclude<BenchmarkType, 'all'> | 'enterprise';
  metricName: string;
  unit: string;
  actual: number;
  target: number;
  targetConfigured: boolean;
  direction: 'low' | 'high';
  trend: number[];
  available: boolean;
  unavailableReason: string;
  availabilityLabel: '可对标' | '待完善';
  energyUnitId: string | null;
  productId: string | null;
  energyRecordIds: string[];
  operationMetricIds: string[];
  scopeNames: string[];
  energyScopeDescription: string;
  outputScopeDescription: string;
  allocationDescription: string;
  formulaDescription: string;
  periodDescription: string;
  monthlyTargets?: number[];
  dataCompleteness?: string;
}

export interface BenchmarkDataset {
  rows: BenchmarkMetric[];
  unavailableReasons: Record<Exclude<BenchmarkType, 'all'>, string>;
}

type AllocatedEnergyRecord = {
  record: V11EnergyRecord;
  share: number;
};

const annualRecordAmount = (record: V11EnergyRecord) => v11EnergyRecordAnnualAmount(record);

const annualOperationAmount = (record: V11OperationMetric) =>
  record.entryMode === 'monthly'
    ? record.monthlyValues.reduce((sum, value) => sum + value, 0)
    : record.annualValue;

function standardCoalTce(amount: number, type: V11EnergyType) {
  const converted = amount * type.standardCoalFactor;
  return type.standardCoalFactorUnit.startsWith('kgce') ? converted / 1000 : converted;
}

function recordStandardCoal(record: V11EnergyRecord, types: V11EnergyType[]) {
  const type = types.find((item) => item.energyTypeId === record.energyTypeId);
  return type ? standardCoalTce(annualRecordAmount(record), type) : 0;
}

function monthlyStandardCoal(record: V11EnergyRecord, types: V11EnergyType[]) {
  const type = types.find((item) => item.energyTypeId === record.energyTypeId);
  if (!type) return Array.from({ length: 12 }, () => 0);
  if (record.entryMode === 'monthly') {
    return record.monthlyAmounts.map((amount) => standardCoalTce(amount, type));
  }
  return Array.from({ length: 12 }, () => 0);
}

function sumMonthlyEnergy(records: AllocatedEnergyRecord[], types: V11EnergyType[]) {
  return records.reduce(
    (totals, item) => monthlyStandardCoal(item.record, types)
      .map((amount, index) => totals[index] + amount * item.share),
    Array.from({ length: 12 }, () => 0),
  );
}

function monthlyOperation(record: V11OperationMetric) {
  if (record.entryMode === 'monthly') return [...record.monthlyValues];
  return Array.from({ length: 12 }, (_, index) => index === 11 ? record.annualValue : 0);
}

function sumMonthlyOperations(records: V11OperationMetric[]) {
  return records.reduce(
    (totals, record) => monthlyOperation(record).map((amount, index) => totals[index] + amount),
    Array.from({ length: 12 }, () => 0),
  );
}

function ratioTrend(
  energyRecords: AllocatedEnergyRecord[],
  operations: V11OperationMetric[],
  types: V11EnergyType[],
) {
  const energy = sumMonthlyEnergy(energyRecords, types);
  const outputs = sumMonthlyOperations(operations);
  return energy.map((amount, index) => outputs[index] > 0 ? amount * 1000 / outputs[index] : 0);
}

function targetValue(
  objectType: 'enterprise' | 'unit' | 'product' | 'device',
  objectId: string,
  metricCode: string,
  year: number,
  energyUnitId: string | null = null,
) {
  return getBenchmarkTarget(objectType, objectId, metricCode, year, energyUnitId);
}

function unitMetric(
  energyUnitId: string,
  objectName: string,
  records: V11EnergyRecord[],
  operation: V11OperationMetric,
  types: V11EnergyType[],
  year: number,
): BenchmarkMetric {
  const target = targetValue('unit', energyUnitId, 'energy_per_product', year, energyUnitId);
  const totalEnergy = records.reduce((sum, record) => sum + recordStandardCoal(record, types), 0);
  const output = annualOperationAmount(operation);
  return {
    benchmarkMetricId: `benchmark-unit-${energyUnitId}`,
    metricCode: 'energy_per_product',
    objectId: energyUnitId,
    objectName,
    objectType: '用能单元',
    objectTypeKey: 'unit',
    metricName: '单位产品综合能耗',
    unit: 'kgce/t',
    actual: totalEnergy * 1000 / output,
    target: target?.value ?? 0,
    targetConfigured: Boolean(target),
    direction: 'low',
    trend: ratioTrend(records.map((record) => ({ record, share: 1 })), [operation], types),
    available: Boolean(target),
    unavailableReason: target ? '' : '当前指标尚未配置目标值。',
    availabilityLabel: target ? '可对标' : '待完善',
    energyUnitId,
    productId: null,
    energyRecordIds: records.map((record) => record.energyRecordId),
    operationMetricIds: [operation.operationMetricId],
    scopeNames: [objectName],
    energyScopeDescription: `${objectName}同期综合能耗`,
    outputScopeDescription: `${objectName}同期产量或业务量`,
    allocationDescription: '用能单元能源与本单元运营数据按相同年度匹配',
    formulaDescription: '用能单元综合能耗 ÷ 同期产品产量',
    periodDescription: `${year}年度（月度数据汇总）`,
  };
}

function unavailableProductMetric(
  product: ProductMaster,
  year: number,
  reason: string,
  scopeNames: string[],
  target: number,
  targetConfigured: boolean,
  operationIds: string[],
): BenchmarkMetric {
  return {
    benchmarkMetricId: `benchmark-product-${product.productId}`,
    metricCode: 'energy_per_product',
    objectId: product.productId,
    objectName: product.productName,
    objectType: '产品',
    objectTypeKey: 'product',
    metricName: '单位产品综合能耗',
    unit: `kgce/${product.unit}`,
    actual: 0,
    target,
    targetConfigured,
    direction: 'low',
    trend: [],
    available: false,
    unavailableReason: reason,
    availabilityLabel: '待完善',
    energyUnitId: product.linkedEnergyUnitIds[0] ?? null,
    productId: product.productId,
    energyRecordIds: [],
    operationMetricIds: operationIds,
    scopeNames,
    energyScopeDescription: '尚未形成可计算的产品能源归属',
    outputScopeDescription: `${product.productName}产品产量`,
    allocationDescription: product.allocationMode === 'ratio' ? '比例分摊尚未完成' : '产品生产单元关系尚未完成',
    formulaDescription: '产品归属综合能耗 ÷ 同期产品产量',
    periodDescription: `${year}年度（月度数据汇总）`,
  };
}

function productMetric(
  product: ProductMaster,
  year: number,
  energyRecords: V11EnergyRecord[],
  operations: V11OperationMetric[],
  types: V11EnergyType[],
  unitNames: Map<string, string>,
): BenchmarkMetric {
  const scopeNames = product.linkedEnergyUnitIds.map((energyUnitId) =>
    unitNames.get(energyUnitId) ?? energyUnitId);
  const target = targetValue('product', product.productId, 'energy_per_product', year);
  const allProductOperations = operations.filter((record) =>
    record.productId === product.productId && record.metricCode === 'product_output');
  const productOperations = allProductOperations.filter((record) =>
    Boolean(record.energyUnitId)
    && product.linkedEnergyUnitIds.includes(record.energyUnitId!));
  if (product.status === 'inactive') {
    return unavailableProductMetric(product, year, '产品已停用，历史运营数据仍保留。', scopeNames, target?.value ?? 0, Boolean(target), productOperations.map((item) => item.operationMetricId));
  }
  if (!product.linkedEnergyUnitIds.length) {
    return unavailableProductMetric(product, year, '未关联生产单元。', scopeNames, target?.value ?? 0, Boolean(target), productOperations.map((item) => item.operationMetricId));
  }
  const outOfScopeOperation = allProductOperations.find((record) =>
    record.energyUnitId && !product.linkedEnergyUnitIds.includes(record.energyUnitId));
  if (outOfScopeOperation) {
    return unavailableProductMetric(product, year, '产品产量记录的归属范围未纳入产品生产单元关系。', scopeNames, target?.value ?? 0, Boolean(target), productOperations.map((item) => item.operationMetricId));
  }
  if (!productOperations.length || productOperations.every((record) => annualOperationAmount(record) <= 0)) {
    return unavailableProductMetric(product, year, '缺少当前年度产品产量。', scopeNames, target?.value ?? 0, Boolean(target), productOperations.map((item) => item.operationMetricId));
  }
  if (!target) {
    return unavailableProductMetric(product, year, '缺少当前年度指标目标值。', scopeNames, 0, false, productOperations.map((item) => item.operationMetricId));
  }

  const allocatedEnergyRecords: AllocatedEnergyRecord[] = [];
  const allocationParts: string[] = [];
  for (const energyUnitId of product.linkedEnergyUnitIds) {
    const allocation = resolveProductEnergyAllocation(product.productId, energyUnitId);
    if (!allocation.ok) {
      return unavailableProductMetric(
        product,
        year,
        allocation.reason,
        scopeNames,
        target.value,
        true,
        productOperations.map((item) => item.operationMetricId),
      );
    }
    const records = product.allocationMode === 'metered'
      ? energyRecords.filter((record) =>
          product.directEnergyRecordIds.includes(record.energyRecordId)
          && record.energyUnitId === energyUnitId)
      : energyRecords.filter((record) => record.energyUnitId === energyUnitId);
    if (!records.length) {
      return unavailableProductMetric(
        product,
        year,
        `生产单元“${unitNames.get(energyUnitId) ?? energyUnitId}”缺少同期能源数据。`,
        scopeNames,
        target.value,
        true,
        productOperations.map((item) => item.operationMetricId),
      );
    }
    records.forEach((record) => allocatedEnergyRecords.push({ record, share: allocation.share }));
    allocationParts.push(`${unitNames.get(energyUnitId) ?? energyUnitId}${allocation.share < 1 ? `按${allocation.share * 100}%分摊` : '全部归属'}`);
  }

  const totalEnergy = allocatedEnergyRecords.reduce(
    (total, item) => total + recordStandardCoal(item.record, types) * item.share,
    0,
  );
  const totalOutput = productOperations.reduce((total, record) => total + annualOperationAmount(record), 0);
  return {
    benchmarkMetricId: `benchmark-product-${product.productId}`,
    metricCode: 'energy_per_product',
    objectId: product.productId,
    objectName: product.productName,
    objectType: '产品',
    objectTypeKey: 'product',
    metricName: '单位产品综合能耗',
    unit: `kgce/${product.unit}`,
    actual: totalEnergy * 1000 / totalOutput,
    target: target.value,
    targetConfigured: true,
    direction: 'low',
    trend: ratioTrend(allocatedEnergyRecords, productOperations, types),
    available: true,
    unavailableReason: '',
    availabilityLabel: '可对标',
    energyUnitId: product.linkedEnergyUnitIds[0],
    productId: product.productId,
    energyRecordIds: [...new Set(allocatedEnergyRecords.map((item) => item.record.energyRecordId))],
    operationMetricIds: productOperations.map((record) => record.operationMetricId),
    scopeNames,
    energyScopeDescription: `${scopeNames.join('、')}中归属于${product.productName}的综合能耗`,
    outputScopeDescription: `${scopeNames.join('、')}的${product.productName}产品产量合计`,
    allocationDescription: product.allocationMode === 'ratio'
      ? allocationParts.join('；')
      : product.allocationMode === 'metered'
        ? '读取产品独立计量能源记录'
        : '独占生产单元自动归属',
    formulaDescription: '产品归属综合能耗（折标）÷ 同期产品产量',
    periodDescription: `${year}年度（月度数据同期汇总）`,
  };
}

function deviceMetricCode(energyTypeId: string) {
  if (energyTypeId === 'v11-energy-electricity') return 'electricity_consumption';
  if (energyTypeId === 'v11-energy-natural-gas') return 'natural_gas_consumption';
  if (energyTypeId === 'v11-energy-steam') return 'steam_consumption';
  return `energy_consumption:${energyTypeId}`;
}

function unavailableDeviceMetric(
  deviceId: string,
  deviceName: string,
  deviceType: string,
  energyUnitId: string,
  energyUnitName: string,
  year: number,
): BenchmarkMetric {
  return {
    benchmarkMetricId: `benchmark-device-${deviceId}-empty`,
    metricCode: 'device_energy_data',
    objectId: deviceId,
    objectName: deviceName,
    objectType: '设备',
    objectTypeKey: 'device',
    metricName: '设备能源数据',
    unit: '—',
    actual: 0,
    target: 0,
    targetConfigured: false,
    direction: 'low',
    trend: [],
    available: false,
    unavailableReason: '尚未录入设备级能源数据。',
    availabilityLabel: '待完善',
    energyUnitId,
    productId: null,
    energyRecordIds: [],
    operationMetricIds: [],
    scopeNames: [energyUnitName],
    energyScopeDescription: `${deviceName}尚无独立设备能源记录`,
    outputScopeDescription: '设备消费量指标不需要运营数据分母',
    allocationDescription: `设备档案类型：${deviceType}`,
    formulaDescription: '设备能源记录年度合计',
    periodDescription: `${year}年度`,
    dataCompleteness: '0/12月',
  };
}

function deviceMetric(
  device: ReturnType<typeof listV11KeyDevices>[number],
  record: V11EnergyRecord,
  type: V11EnergyType,
  energyUnitName: string,
  year: number,
): BenchmarkMetric {
  const metricCode = deviceMetricCode(type.energyTypeId);
  const target = targetValue('device', device.deviceId, metricCode, year);
  const actual = annualRecordAmount(record);
  const monthCount = (record.monthlyReportedMonths ?? record.monthlyAmounts.map((value) => value > 0)).filter(Boolean).length;
  const hasAnnualSupplement = record.annualAmount > 0;
  return {
    benchmarkMetricId: `benchmark-device-${device.deviceId}-${type.energyTypeId}`,
    metricCode,
    objectId: device.deviceId,
    objectName: device.deviceName,
    objectType: '设备',
    objectTypeKey: 'device',
    metricName: `${type.energyTypeName}消费量`,
    unit: type.measurementUnit,
    actual,
    target: target?.value ?? 0,
    targetConfigured: Boolean(target),
    direction: target?.direction ?? 'low',
    trend: record.entryMode === 'monthly'
      ? [...record.monthlyAmounts]
      : Array.from({ length: 12 }, () => 0),
    available: true,
    unavailableReason: target ? '' : '当前指标尚未配置目标值，暂不判定达标状态。',
    availabilityLabel: target ? '可对标' : '待完善',
    energyUnitId: device.energyUnitId,
    productId: null,
    energyRecordIds: [record.energyRecordId],
    operationMetricIds: [],
    scopeNames: [energyUnitName],
    energyScopeDescription: `${device.deviceName}设备级${type.energyTypeName}记录`,
    outputScopeDescription: '设备消费量指标不需要运营数据分母',
    allocationDescription: '设备能源记录通过稳定设备ID独立归属，不计入企业或用能单元汇总',
    formulaDescription: `${type.energyTypeName}消费量＝设备月度能源量合计`,
    periodDescription: `${year}年度（${monthCount ? hasAnnualSupplement && monthCount < 12 ? '月度数据+年度补录' : '月度数据汇总' : '年度汇总录入'}）`,
    monthlyTargets: target?.monthlyTargets ? [...target.monthlyTargets] : undefined,
    dataCompleteness: !monthCount ? '年度汇总录入' : monthCount < 12 ? hasAnnualSupplement ? `${monthCount}/12月｜年度已补录` : `${monthCount}/12月｜年度待完善` : '12/12月',
  };
}

export function buildBenchmarkDataset(year: number): BenchmarkDataset {
  const units = listEnergyUnits();
  const unitNames = new Map(units.map((unit) => [unit.energyUnitId, unit.energyUnitName]));
  const types = listV11EnergyTypes();
  const allEnergyRecords = listV11EnergyRecords()
    .filter((record) => record.year === year && record.energyRole === '能源消费');
  const energyRecords = allEnergyRecords.filter((record) => v11RecordScopeType(record) !== 'device');
  const deviceEnergyRecords = allEnergyRecords.filter((record) => v11RecordScopeType(record) === 'device');
  const operations = listV11OperationMetrics().filter((record) => record.year === year);
  const rows: BenchmarkMetric[] = [];

  const enterpriseEnergy = energyRecords.filter((record) => record.energyUnitId === null);
  const addedValue = operations.find((record) =>
    record.energyUnitId === null && record.metricCode === 'industrial_added_value');
  if (enterpriseEnergy.length && addedValue && annualOperationAmount(addedValue) > 0) {
    const target = targetValue('enterprise', 'enterprise', 'energy_per_added_value', year);
    const actual = enterpriseEnergy.reduce((total, record) => total + recordStandardCoal(record, types), 0)
      / annualOperationAmount(addedValue);
    rows.push({
      benchmarkMetricId: 'benchmark-enterprise-added-value',
      metricCode: 'energy_per_added_value',
      objectId: 'enterprise',
      objectName: '全厂',
      objectType: '企业',
      objectTypeKey: 'enterprise',
      metricName: '单位增加值综合能耗',
      unit: 'tce/万元',
      actual,
      target: target?.value ?? 0,
      targetConfigured: Boolean(target),
      direction: 'low',
      trend: [0.128, 0.126, 0.124, 0.122, 0.121, 0.119, 0.118, 0.117, 0.116, 0.116, 0.115, actual],
      available: Boolean(target),
      unavailableReason: target ? '' : '缺少当前年度指标目标值。',
      availabilityLabel: target ? '可对标' : '待完善',
      energyUnitId: null,
      productId: null,
      energyRecordIds: enterpriseEnergy.map((record) => record.energyRecordId),
      operationMetricIds: [addedValue.operationMetricId],
      scopeNames: ['全厂'],
      energyScopeDescription: '企业级能源消费折标量',
      outputScopeDescription: '企业工业增加值',
      allocationDescription: '企业级能源与企业级经济指标按相同年度匹配',
      formulaDescription: '企业综合能耗 ÷ 工业增加值',
      periodDescription: `${year}年度`,
    });
  }

  units.filter((unit) => unit.unitType === '生产单元').forEach((unit) => {
    const records = energyRecords.filter((record) => record.energyUnitId === unit.energyUnitId);
    const operation = operations.find((record) =>
      record.energyUnitId === unit.energyUnitId
      && record.metricCategory === '产量'
      && annualOperationAmount(record) > 0);
    if (records.length && operation) {
      rows.push(unitMetric(unit.energyUnitId, unit.energyUnitName, records, operation, types, year));
    }
  });

  listProducts().forEach((product) => {
    rows.push(productMetric(product, year, energyRecords, operations, types, unitNames));
  });

  listV11KeyDevices().forEach((device) => {
    const records = deviceEnergyRecords.filter((record) => record.scopeId === device.deviceId);
    const energyUnitName = unitNames.get(device.energyUnitId) ?? device.energyUnitId;
    if (!records.length) {
      rows.push(unavailableDeviceMetric(
        device.deviceId,
        device.deviceName,
        device.deviceType,
        device.energyUnitId,
        energyUnitName,
        year,
      ));
      return;
    }
    records.forEach((record) => {
      const type = types.find((item) => item.energyTypeId === record.energyTypeId);
      if (type) rows.push(deviceMetric(device, record, type, energyUnitName, year));
    });
  });

  return {
    rows,
    unavailableReasons: {
      unit: rows.some((row) => row.objectTypeKey === 'unit')
        ? ''
        : '未找到同时具备能源消费数据和运营数据的用能单元。',
      product: rows.some((row) => row.objectTypeKey === 'product')
        ? ''
        : '当前企业尚未维护产品基础信息。',
      device: listV11KeyDevices().length
        ? '已维护重点设备，但尚未录入当前年度设备级能源数据。'
        : '暂无重点设备，请先前往数据管理维护重点设备档案。',
    },
  };
}
