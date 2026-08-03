import {
  listV11ConversionOutputs,
  listV11EnergyRecords,
  listV11EnergyTypes,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
  type V11ConversionOutput,
  type V11EnergyRecord,
  type V11EnergyType,
} from './dataManagementV11Store';
import { listEnergyUnits } from './energyUnitMockStore';
import type { EnergyUnit } from '../types/energyUnit';

export type FlowViewLevel = 'level1' | 'level2';
export type FlowPeriod = { year: number; grain: 'month' | 'year'; month: number };
export type FlowStage =
  | 'input'
  | 'conversion'
  | 'medium'
  | 'distribution'
  | 'utilization'
  | 'external'
  | 'unallocated'
  | 'pending';

export interface FlowNode {
  nodeId: string;
  stage: FlowStage;
  name: string;
  valueLabel: string;
  standardCoalAmount: number;
  nodeType: string;
  share: number;
  energyUnitId?: string;
  parentEnergyUnitId?: string | null;
  anomalous?: boolean;
}

export interface FlowLink {
  linkId: string;
  sourceNodeId: string;
  targetNodeId: string;
  standardCoalAmount: number;
  tooltip?: string;
}

export interface FlowLevelOneBalanceRow {
  energyTypeId: string;
  energyTypeName: string;
  measurementUnit: string;
  externalInputStandardAmount: number;
  internalRecoveryStandardAmount: number;
  conversionInputStandardAmount: number;
  conversionOutputStandardAmount: number;
  availableAmount: number;
  availableStandardAmount: number;
  distributionAmount: number;
  distributionStandardAmount: number;
  externalOutputAmount: number;
  externalOutputStandardAmount: number;
  unallocatedAmount: number;
  unallocatedStandardAmount: number;
  distributionRate: number;
  status: '已分配' | '存在未分配' | '一级分配超出可用量';
}

export interface FlowLevelTwoBalanceRow {
  rowId: string;
  level1EnergyUnitId: string;
  level1EnergyUnitName: string;
  energyTypeId: string;
  energyTypeName: string;
  measurementUnit: string;
  distributionAmount: number;
  distributionStandardAmount: number;
  utilizationAmount: number;
  utilizationStandardAmount: number;
  pendingAmount: number;
  pendingStandardAmount: number;
  overAllocatedAmount: number;
  overAllocatedStandardAmount: number;
  collectionRate: number;
  status: '已归集' | '待分解' | '层级异常' | '无数据';
}

export interface FlowTraceRecord {
  recordId: string;
  recordType: string;
  originalAmount: number;
  originalUnit: string;
  standardCoalAmount: number;
  factorDescription: string;
  periodLabel: string;
  sourceType: string;
  relatedRecordId: string;
  updatedAt: string;
}

export interface FlowDetailRow {
  flowDetailId: string;
  stage: '能源输入' | '能源转换' | '能源分配' | '能源利用' | '外部输出' | '未分配' | '待分解';
  source: string;
  target: string;
  energyTypeName: string;
  amount: number;
  amountUnit: string;
  standardCoalAmount: number;
  energyUnitName: string;
  sourceRecordIds: string[];
  traceDescription: string;
  traceRecords: FlowTraceRecord[];
  abnormal: boolean;
  relatedNodeIds: string[];
  level1EnergyUnitName?: string;
  level2EnergyUnitName?: string;
  level2ObjectType?: string;
  distributionStandardAmount?: number;
  utilizationStandardAmount?: number;
  pendingStandardAmount?: number;
  status?: FlowLevelTwoBalanceRow['status'];
}

export interface FlowRankItem {
  energyUnitId: string;
  name: string;
  standardCoalAmount: number;
  share: number;
}

export interface FlowConversionDifferenceRow {
  conversionOutputId: string;
  conversionUnitName: string;
  inputEnergyTypeName: string;
  outputEnergyTypeName: string;
  inputStandardAmount: number;
  outputStandardAmount: number;
  externalOutputStandardAmount: number;
  differenceStandardAmount: number;
  absoluteDifferenceStandardAmount: number;
  dataStatus: '已校验' | '待校验';
}

export interface FlowAnalysisDataset {
  viewLevel: FlowViewLevel;
  viewName: string;
  internalMetricLabel: '内部分配量' | '内部利用量';
  differenceMetricLabel: '未分配量' | '待分解量';
  inputStandardCoalAmount: number;
  internalAvailableStandardCoalAmount: number;
  utilizationStandardCoalAmount: number;
  differenceStandardCoalAmount: number;
  conversionLossStandardCoalAmount: number;
  conversionDifferenceStandardCoalAmount: number;
  externalStandardCoalAmount: number;
  utilizationRate: number;
  inputTypeCount: number;
  conversionCount: number;
  utilizationRecordCount: number;
  unallocatedTypeCount: number;
  pendingObjectCount: number;
  overAllocatedObjectCount: number;
  overAllocatedStandardCoalAmount: number;
  nodes: FlowNode[];
  links: FlowLink[];
  levelOneBalanceRows: FlowLevelOneBalanceRow[];
  levelTwoBalanceRows: FlowLevelTwoBalanceRow[];
  conversionDifferenceRows: FlowConversionDifferenceRow[];
  detailRows: FlowDetailRow[];
  rankRows: FlowRankItem[];
  dataNotice: string;
}

type Amount = { physical: number; standard: number; unit: string };
type RecordBucket = Amount & { records: V11EnergyRecord[] };
type ConversionAmount = {
  conversion: V11ConversionOutput;
  inputType: V11EnergyType | null;
  outputType: V11EnergyType | null;
  input: Amount;
  output: Amount;
  internal: Amount;
  external: Amount;
  lossStandard: number;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const amountLabel = (amount: number, unit = 'tce') =>
  `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} ${unit}`;

function firstLevelUnit(energyUnitId: string | null, units: EnergyUnit[]) {
  if (!energyUnitId) return null;
  let unit = units.find((item) => item.energyUnitId === energyUnitId) ?? null;
  while (unit?.parentEnergyUnitId) {
    unit = units.find((item) => item.energyUnitId === unit?.parentEnergyUnitId) ?? unit;
  }
  return unit?.unitLevel === 'level1' ? unit : null;
}

function directSecondLevelUnit(energyUnitId: string | null, units: EnergyUnit[]) {
  const unit = units.find((item) => item.energyUnitId === energyUnitId) ?? null;
  return unit?.unitLevel === 'level2' ? unit : null;
}

function recordPhysicalAmount(record: V11EnergyRecord, period: FlowPeriod) {
  if (period.grain === 'year') return v11EnergyRecordAnnualAmount(record);
  if (record.entryMode === 'annual') return 0;
  return record.monthlyAmounts[period.month - 1] ?? 0;
}

function standardAmount(physical: number, type: V11EnergyType | null) {
  if (!type) return 0;
  const converted = physical * type.standardCoalFactor;
  return type.standardCoalFactorUnit.startsWith('kgce') ? converted / 1000 : converted;
}

function recordAmount(record: V11EnergyRecord, type: V11EnergyType | null, period: FlowPeriod): Amount {
  const physical = recordPhysicalAmount(record, period);
  return {
    physical,
    standard: standardAmount(physical, type),
    unit: type?.measurementUnit ?? '',
  };
}

function conversionScale(conversion: V11ConversionOutput, records: V11EnergyRecord[], period: FlowPeriod) {
  if (period.grain === 'year') return 1;
  const input = records.find((record) => record.energyRecordId === conversion.inputEnergyRecordId);
  if (!input) return 1 / 12;
  const annual = v11EnergyRecordAnnualAmount(input);
  return annual > 0 ? recordPhysicalAmount(input, period) / annual : 0;
}

function conversionAmount(
  conversion: V11ConversionOutput,
  records: V11EnergyRecord[],
  types: V11EnergyType[],
  period: FlowPeriod,
): ConversionAmount {
  const scale = conversionScale(conversion, records, period);
  const linkedInput = records.find((record) => record.energyRecordId === conversion.inputEnergyRecordId);
  const inputType = linkedInput
    ? types.find((type) => type.energyTypeId === linkedInput.energyTypeId) ?? null
    : types.find((type) => type.energyTypeId === conversion.inputEnergyTypeId)
      ?? types.find((type) => type.energyTypeName === conversion.recoveryEnergyName)
      ?? null;
  const outputType = types.find((type) => type.energyTypeId === conversion.outputEnergyTypeId)
    ?? types.find((type) => type.energyTypeName === conversion.outputEnergyName)
    ?? types.find((type) => type.analysisCategory === conversion.outputAnalysisCategory)
    ?? inputType;
  const linkedAmount = linkedInput ? recordAmount(linkedInput, inputType, period) : null;
  const inputPhysical = linkedAmount?.physical
    ?? (conversion.recoveryAmount ?? conversion.inputAmount ?? 0) * scale;
  const outputPhysical = (conversion.outputAmount ?? 0) * scale;
  const internalPhysical = (conversion.internalAmount ?? 0) * scale;
  const externalPhysical = conversion.externalAmount * scale;
  const input = {
    physical: inputPhysical,
    standard: linkedAmount?.standard ?? standardAmount(inputPhysical, inputType),
    unit: linkedAmount?.unit ?? conversion.recoveryUnit ?? conversion.inputUnit ?? inputType?.measurementUnit ?? '',
  };
  const output = {
    physical: outputPhysical,
    standard: standardAmount(outputPhysical, outputType),
    unit: conversion.outputUnit ?? outputType?.measurementUnit ?? '',
  };
  return {
    conversion,
    inputType,
    outputType,
    input,
    output,
    internal: {
      physical: internalPhysical,
      standard: standardAmount(internalPhysical, outputType),
      unit: output.unit,
    },
    external: {
      physical: externalPhysical,
      standard: standardAmount(externalPhysical, outputType),
      unit: output.unit,
    },
    lossStandard: Math.max(input.standard - output.standard, 0),
  };
}

function addAmount(map: Map<string, Amount>, type: V11EnergyType, amount: Amount) {
  const current = map.get(type.energyTypeId) ?? { physical: 0, standard: 0, unit: type.measurementUnit };
  map.set(type.energyTypeId, {
    physical: current.physical + amount.physical,
    standard: current.standard + amount.standard,
    unit: type.measurementUnit,
  });
}

function addRecordBucket(
  map: Map<string, RecordBucket>,
  key: string,
  record: V11EnergyRecord,
  type: V11EnergyType,
  period: FlowPeriod,
) {
  const amount = recordAmount(record, type, period);
  const current = map.get(key) ?? {
    physical: 0,
    standard: 0,
    unit: type.measurementUnit,
    records: [],
  };
  map.set(key, {
    physical: current.physical + amount.physical,
    standard: current.standard + amount.standard,
    unit: type.measurementUnit,
    records: [...current.records, record],
  });
}

function periodLabel(period: FlowPeriod) {
  return period.grain === 'year' ? `${period.year}年度` : `${period.year}年${period.month}月`;
}

function factorDescription(type: V11EnergyType | null) {
  return type ? `${type.standardCoalFactor} ${type.standardCoalFactorUnit}` : '上游记录未配置折标系数';
}

function recordTrace(
  record: V11EnergyRecord,
  type: V11EnergyType,
  amount: Amount,
  period: FlowPeriod,
): FlowTraceRecord {
  return {
    recordId: record.energyRecordId,
    recordType: '能源数据',
    originalAmount: amount.physical,
    originalUnit: amount.unit,
    standardCoalAmount: amount.standard,
    factorDescription: factorDescription(type),
    periodLabel: periodLabel(period),
    sourceType: record.entryMode === 'monthly' ? '月度能源记录' : '年度能源记录',
    relatedRecordId: '—',
    updatedAt: '上游记录未提供修改时间',
  };
}

function objectTypeLabel(unit: EnergyUnit) {
  if (unit.unitType === '生产单元') return '工序/环节';
  if (unit.unitType === '公辅系统') return '公辅系统';
  if (unit.unitType === '建筑/区域') return '建筑/区域';
  return '其他';
}

function conversionTrace(item: ConversionAmount, period: FlowPeriod, external = false): FlowTraceRecord {
  const amount = external ? item.external : item.output;
  return {
    recordId: item.conversion.conversionOutputId,
    recordType: '能源转换与输出',
    originalAmount: amount.physical,
    originalUnit: amount.unit,
    standardCoalAmount: amount.standard,
    factorDescription: factorDescription(item.outputType),
    periodLabel: periodLabel(period),
    sourceType: external ? '外部输出' : item.conversion.recordType,
    relatedRecordId: item.conversion.inputEnergyRecordId ?? '无投入自产/回收能源',
    updatedAt: '上游记录未提供修改时间',
  };
}

export function buildFlowAnalysisDataset(
  period: FlowPeriod,
  viewLevel: FlowViewLevel = 'level1',
): FlowAnalysisDataset {
  const units = listEnergyUnits();
  const types = listV11EnergyTypes();
  const typeById = new Map(types.map((type) => [type.energyTypeId, type]));
  const unitById = new Map(units.map((unit) => [unit.energyUnitId, unit]));
  const records = listV11EnergyRecords().filter((record) =>
    record.year === period.year
    && record.energyRole === '能源消费'
    && v11RecordScopeType(record) !== 'device');
  const conversionAmounts = listV11ConversionOutputs()
    .filter((conversion) => conversion.year === period.year)
    .map((conversion) => conversionAmount(conversion, records, types, period));
  const linkedInputIds = new Set(conversionAmounts.flatMap((item) =>
    item.conversion.inputEnergyRecordId ? [item.conversion.inputEnergyRecordId] : []));
  const boundaryRecords = records.filter((record) => record.energyUnitId === null);
  const levelOneRecords = records.filter((record) =>
    Boolean(record.energyUnitId)
    && !linkedInputIds.has(record.energyRecordId)
    && unitById.get(record.energyUnitId!)?.unitLevel === 'level1');
  const levelTwoRecords = records.filter((record) =>
    Boolean(record.energyUnitId)
    && !linkedInputIds.has(record.energyRecordId)
    && unitById.get(record.energyUnitId!)?.unitLevel === 'level2');

  const inputByType = new Map<string, Amount>();
  const externalInputByType = new Map<string, Amount>();
  const internalRecoveryByType = new Map<string, Amount>();
  boundaryRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    if (!type) return;
    const amount = recordAmount(record, type, period);
    addAmount(inputByType, type, amount);
    addAmount(externalInputByType, type, amount);
  });
  conversionAmounts
    .filter((item) => item.conversion.inputMode === 'recovery' && item.inputType)
    .forEach((item) => {
      addAmount(inputByType, item.inputType!, item.input);
      addAmount(internalRecoveryByType, item.inputType!, item.input);
    });

  const distributionByType = new Map<string, Amount>();
  const distributionByUnit = new Map<string, number>();
  levelOneRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    if (!type || !record.energyUnitId) return;
    const amount = recordAmount(record, type, period);
    addAmount(distributionByType, type, amount);
    distributionByUnit.set(
      record.energyUnitId,
      (distributionByUnit.get(record.energyUnitId) ?? 0) + amount.standard,
    );
  });

  const allTypeIds = new Set([
    ...inputByType.keys(),
    ...distributionByType.keys(),
    ...conversionAmounts.flatMap((item) => [
      item.inputType?.energyTypeId ?? '',
      item.outputType?.energyTypeId ?? '',
    ]).filter(Boolean),
  ]);
  const levelOneBalanceRows: FlowLevelOneBalanceRow[] = [...allTypeIds].map((energyTypeId) => {
    const type = typeById.get(energyTypeId)!;
    const input = inputByType.get(energyTypeId) ?? { physical: 0, standard: 0, unit: type.measurementUnit };
    const conversionInput = {
      physical: sum(conversionAmounts.filter((item) => item.inputType?.energyTypeId === energyTypeId).map((item) => item.input.physical)),
      standard: sum(conversionAmounts.filter((item) => item.inputType?.energyTypeId === energyTypeId).map((item) => item.input.standard)),
    };
    const conversionOutput = {
      physical: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.output.physical)),
      standard: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.output.standard)),
    };
    const external = {
      physical: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.external.physical)),
      standard: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.external.standard)),
    };
    const distribution = distributionByType.get(energyTypeId) ?? {
      physical: 0,
      standard: 0,
      unit: type.measurementUnit,
    };
    const externalInput = externalInputByType.get(energyTypeId)?.standard ?? 0;
    const internalRecovery = internalRecoveryByType.get(energyTypeId)?.standard ?? 0;
    const availableAmount = input.physical + conversionOutput.physical - conversionInput.physical;
    const availableStandardAmount = input.standard + conversionOutput.standard - conversionInput.standard;
    const difference = availableAmount - distribution.physical - external.physical;
    const standardDifference = availableStandardAmount - distribution.standard - external.standard;
    return {
      energyTypeId,
      energyTypeName: type.energyTypeName,
      measurementUnit: type.measurementUnit,
      externalInputStandardAmount: externalInput,
      internalRecoveryStandardAmount: internalRecovery,
      conversionInputStandardAmount: conversionInput.standard,
      conversionOutputStandardAmount: conversionOutput.standard,
      availableAmount,
      availableStandardAmount,
      distributionAmount: distribution.physical,
      distributionStandardAmount: distribution.standard,
      externalOutputAmount: external.physical,
      externalOutputStandardAmount: external.standard,
      unallocatedAmount: Math.max(difference, 0),
      unallocatedStandardAmount: Math.max(standardDifference, 0),
      distributionRate: availableStandardAmount > 0
        ? distribution.standard / availableStandardAmount * 100
        : 0,
      status: difference < -0.01
        ? '一级分配超出可用量'
        : difference > 0.01
          ? '存在未分配'
          : '已分配',
    };
  });

  const levelOneBuckets = new Map<string, RecordBucket>();
  const levelTwoBuckets = new Map<string, RecordBucket>();
  levelOneRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    if (type && record.energyUnitId) {
      addRecordBucket(levelOneBuckets, `${record.energyUnitId}|${record.energyTypeId}`, record, type, period);
    }
  });
  levelTwoRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    const child = directSecondLevelUnit(record.energyUnitId, units);
    if (type && child?.parentEnergyUnitId) {
      addRecordBucket(levelTwoBuckets, `${child.parentEnergyUnitId}|${record.energyTypeId}`, record, type, period);
    }
  });

  const levelTwoBalanceRows: FlowLevelTwoBalanceRow[] = [
    ...new Set([...levelOneBuckets.keys(), ...levelTwoBuckets.keys()]),
  ].map((rowId) => {
    const [level1EnergyUnitId, energyTypeId] = rowId.split('|');
    const levelOne = levelOneBuckets.get(rowId);
    const levelTwo = levelTwoBuckets.get(rowId);
    const distributionAmount = levelOne?.physical ?? 0;
    const distributionStandardAmount = levelOne?.standard ?? 0;
    const utilizationAmount = levelTwo?.physical ?? 0;
    const utilizationStandardAmount = levelTwo?.standard ?? 0;
    const difference = distributionAmount - utilizationAmount;
    const standardDifference = distributionStandardAmount - utilizationStandardAmount;
    const status: FlowLevelTwoBalanceRow['status'] =
      distributionAmount === 0 && utilizationAmount === 0
        ? '无数据'
        : distributionAmount === 0 || difference < -0.01
          ? '层级异常'
          : difference > 0.01
            ? '待分解'
            : '已归集';
    return {
      rowId,
      level1EnergyUnitId,
      level1EnergyUnitName: unitById.get(level1EnergyUnitId)?.energyUnitName ?? level1EnergyUnitId,
      energyTypeId,
      energyTypeName: typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId,
      measurementUnit: typeById.get(energyTypeId)?.measurementUnit ?? '',
      distributionAmount,
      distributionStandardAmount,
      utilizationAmount,
      utilizationStandardAmount,
      pendingAmount: Math.max(difference, 0),
      pendingStandardAmount: Math.max(standardDifference, 0),
      overAllocatedAmount: Math.max(-difference, 0),
      overAllocatedStandardAmount: Math.max(-standardDifference, 0),
      collectionRate: distributionStandardAmount > 0
        ? utilizationStandardAmount / distributionStandardAmount * 100
        : utilizationStandardAmount > 0
          ? Number.POSITIVE_INFINITY
          : 0,
      status,
    };
  }).sort((left, right) =>
    left.level1EnergyUnitName.localeCompare(right.level1EnergyUnitName, 'zh-CN')
    || left.energyTypeName.localeCompare(right.energyTypeName, 'zh-CN'));

  const inputStandard = sum([...inputByType.values()].map((amount) => amount.standard));
  const distributionStandard = sum([...distributionByType.values()].map((amount) => amount.standard));
  const utilizationStandard = sum([...levelTwoBuckets.values()].map((amount) => amount.standard));
  const externalStandard = sum(conversionAmounts.map((item) => item.external.standard));
  const conversionLossStandard = sum(conversionAmounts.map((item) => item.lossStandard));
  const unallocatedStandard = sum(levelOneBalanceRows.map((row) => row.unallocatedStandardAmount));
  const pendingStandard = sum(levelTwoBalanceRows.map((row) => row.pendingStandardAmount));
  const overAllocatedStandard = sum(levelTwoBalanceRows.map((row) => row.overAllocatedStandardAmount));
  const conversionOutputStandard = sum(conversionAmounts.map((item) => item.output.standard));
  const availableForInternal = Math.max(
    inputStandard - sum(conversionAmounts.map((item) => item.input.standard)) + conversionOutputStandard,
    0,
  );
  const conversionDifferenceRows: FlowConversionDifferenceRow[] = conversionAmounts.map((item) => {
    const hasMeasuredInput = item.input.standard > 0;
    const differenceStandardAmount = hasMeasuredInput
      ? item.input.standard - item.output.standard
      : 0;
    const conversionUnitName = item.conversion.conversionEnergyUnitId
      ? unitById.get(item.conversion.conversionEnergyUnitId)?.energyUnitName
      : null;
    return {
      conversionOutputId: item.conversion.conversionOutputId,
      conversionUnitName: conversionUnitName ?? item.conversion.recordType,
      inputEnergyTypeName: item.inputType?.energyTypeName ?? '无投入自产/回收能源',
      outputEnergyTypeName: item.outputType?.energyTypeName ?? item.conversion.outputEnergyName ?? '产出能源',
      inputStandardAmount: item.input.standard,
      outputStandardAmount: item.output.standard,
      externalOutputStandardAmount: item.external.standard,
      differenceStandardAmount,
      absoluteDifferenceStandardAmount: Math.abs(differenceStandardAmount),
      dataStatus: !hasMeasuredInput || Math.abs(differenceStandardAmount) <= 0.01
        ? '已校验'
        : '待校验',
    };
  });
  const conversionDifferenceStandard = sum(
    conversionDifferenceRows.map((row) => row.absoluteDifferenceStandardAmount),
  );

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const terminalTotal = distributionStandard + externalStandard
    + (viewLevel === 'level1' ? unallocatedStandard : pendingStandard);
  const nodeShare = (amount: number) => terminalTotal > 0 ? amount / terminalTotal * 100 : 0;
  inputByType.forEach((amount, energyTypeId) => {
    if (amount.standard <= 0) return;
    nodes.push({
      nodeId: `input:${energyTypeId}`,
      stage: 'input',
      name: `企业输入·${typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId}`,
      valueLabel: amountLabel(amount.standard),
      standardCoalAmount: amount.standard,
      nodeType: '企业能源输入',
      share: inputStandard > 0 ? amount.standard / inputStandard * 100 : 0,
    });
  });
  conversionAmounts.forEach((item) => {
    if (item.input.standard <= 0 && item.output.standard <= 0) return;
    const nodeId = `conversion:${item.conversion.conversionOutputId}`;
    nodes.push({
      nodeId,
      stage: 'conversion',
      name: (item.conversion.conversionEnergyUnitId
        ? unitById.get(item.conversion.conversionEnergyUnitId)?.energyUnitName
        : null) ?? item.conversion.recordType,
      valueLabel: `${item.inputType?.energyTypeName ?? '无投入自产'} → ${item.outputType?.energyTypeName ?? '产出能源'}`,
      standardCoalAmount: item.output.standard,
      nodeType: '能源转换',
      share: conversionOutputStandard > 0 ? item.output.standard / conversionOutputStandard * 100 : 0,
    });
    if (item.inputType && nodes.some((node) => node.nodeId === `input:${item.inputType!.energyTypeId}`)) {
      links.push({
        linkId: `${nodeId}:input`,
        sourceNodeId: `input:${item.inputType.energyTypeId}`,
        targetNodeId: nodeId,
        standardCoalAmount: item.input.standard,
      });
    }
  });
  allTypeIds.forEach((energyTypeId) => {
    const input = inputByType.get(energyTypeId)?.standard ?? 0;
    const conversionInput = sum(conversionAmounts
      .filter((item) => item.inputType?.energyTypeId === energyTypeId)
      .map((item) => item.input.standard));
    const internalOutput = sum(conversionAmounts
      .filter((item) => item.outputType?.energyTypeId === energyTypeId)
      .map((item) => item.internal.standard));
    const available = Math.max(input - conversionInput, 0) + internalOutput;
    if (available <= 0 && !distributionByType.has(energyTypeId)) return;
    nodes.push({
      nodeId: `medium:${energyTypeId}`,
      stage: 'medium',
      name: `厂内${typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId}`,
      valueLabel: amountLabel(available),
      standardCoalAmount: available,
      nodeType: '厂内能源介质',
      share: availableForInternal > 0 ? available / availableForInternal * 100 : 0,
    });
    const direct = Math.max(input - conversionInput, 0);
    if (direct > 0 && nodes.some((node) => node.nodeId === `input:${energyTypeId}`)) {
      links.push({
        linkId: `input-medium:${energyTypeId}`,
        sourceNodeId: `input:${energyTypeId}`,
        targetNodeId: `medium:${energyTypeId}`,
        standardCoalAmount: direct,
      });
    }
    conversionAmounts
      .filter((item) => item.outputType?.energyTypeId === energyTypeId && item.internal.standard > 0)
      .forEach((item) => links.push({
        linkId: `conversion-medium:${item.conversion.conversionOutputId}`,
        sourceNodeId: `conversion:${item.conversion.conversionOutputId}`,
        targetNodeId: `medium:${energyTypeId}`,
        standardCoalAmount: item.internal.standard,
      }));
  });
  distributionByUnit.forEach((amount, energyUnitId) => {
    if (amount <= 0) return;
    const unit = unitById.get(energyUnitId);
    if (!unit) return;
    nodes.push({
      nodeId: `distribution:${energyUnitId}`,
      stage: 'distribution',
      name: unit.energyUnitName,
      valueLabel: amountLabel(amount),
      standardCoalAmount: amount,
      nodeType: '一级用能单元',
      share: nodeShare(amount),
      energyUnitId,
      anomalous: levelTwoBalanceRows.some((row) =>
        row.level1EnergyUnitId === energyUnitId && row.status === '层级异常'),
    });
  });
  levelOneRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    if (!type || !record.energyUnitId) return;
    const sourceNodeId = `medium:${type.energyTypeId}`;
    const targetNodeId = `distribution:${record.energyUnitId}`;
    if (nodes.some((node) => node.nodeId === sourceNodeId)
      && nodes.some((node) => node.nodeId === targetNodeId)) {
      links.push({
        linkId: `distribution:${record.energyRecordId}`,
        sourceNodeId,
        targetNodeId,
        standardCoalAmount: recordAmount(record, type, period).standard,
      });
    }
  });
  conversionAmounts.filter((item) => item.external.standard > 0 && item.outputType).forEach((item) => {
    const nodeId = `external:${item.outputType!.energyTypeId}`;
    if (!nodes.some((node) => node.nodeId === nodeId)) {
      const total = sum(conversionAmounts
        .filter((other) => other.outputType?.energyTypeId === item.outputType!.energyTypeId)
        .map((other) => other.external.standard));
      nodes.push({
        nodeId,
        stage: 'external',
        name: `外部输出·${item.outputType!.energyTypeName}`,
        valueLabel: amountLabel(total),
        standardCoalAmount: total,
        nodeType: '外部输出',
        share: nodeShare(total),
      });
    }
    links.push({
      linkId: `external:${item.conversion.conversionOutputId}`,
      sourceNodeId: `conversion:${item.conversion.conversionOutputId}`,
      targetNodeId: nodeId,
      standardCoalAmount: item.external.standard,
    });
  });

  if (viewLevel === 'level1') {
    levelOneBalanceRows.filter((row) => row.unallocatedStandardAmount > 0).forEach((row) => {
      nodes.push({
        nodeId: `unallocated:${row.energyTypeId}`,
        stage: 'unallocated',
        name: `未分配·${row.energyTypeName}`,
        valueLabel: amountLabel(row.unallocatedStandardAmount),
        standardCoalAmount: row.unallocatedStandardAmount,
        nodeType: '一级管理差额',
        share: nodeShare(row.unallocatedStandardAmount),
      });
      if (nodes.some((node) => node.nodeId === `medium:${row.energyTypeId}`)) {
        links.push({
          linkId: `unallocated:${row.energyTypeId}`,
          sourceNodeId: `medium:${row.energyTypeId}`,
          targetNodeId: `unallocated:${row.energyTypeId}`,
          standardCoalAmount: row.unallocatedStandardAmount,
        });
      }
    });
  } else {
    const utilizationByUnit = new Map<string, number>();
    const childBuckets = new Map<string, RecordBucket>();
    levelTwoRecords.forEach((record) => {
      const type = typeById.get(record.energyTypeId);
      const child = directSecondLevelUnit(record.energyUnitId, units);
      if (!type || !child?.parentEnergyUnitId) return;
      const amount = recordAmount(record, type, period).standard;
      utilizationByUnit.set(child.energyUnitId, (utilizationByUnit.get(child.energyUnitId) ?? 0) + amount);
      addRecordBucket(
        childBuckets,
        `${child.parentEnergyUnitId}|${child.energyUnitId}|${record.energyTypeId}`,
        record,
        type,
        period,
      );
    });
    utilizationByUnit.forEach((amount, energyUnitId) => {
      const child = unitById.get(energyUnitId);
      if (!child?.parentEnergyUnitId || amount <= 0) return;
      const parentAmount = distributionByUnit.get(child.parentEnergyUnitId) ?? 0;
      nodes.push({
        nodeId: `utilization:${energyUnitId}`,
        stage: 'utilization',
        name: child.energyUnitName,
        valueLabel: amountLabel(amount),
        standardCoalAmount: amount,
        nodeType: objectTypeLabel(child),
        share: parentAmount > 0 ? amount / parentAmount * 100 : 0,
        energyUnitId,
        parentEnergyUnitId: child.parentEnergyUnitId,
      });
    });
    childBuckets.forEach((bucket, key) => {
      const [parentId, childId, energyTypeId] = key.split('|');
      if (!nodes.some((node) => node.nodeId === `distribution:${parentId}`)
        || !nodes.some((node) => node.nodeId === `utilization:${childId}`)) return;
      links.push({
        linkId: `utilization:${key}`,
        sourceNodeId: `distribution:${parentId}`,
        targetNodeId: `utilization:${childId}`,
        standardCoalAmount: bucket.standard,
        tooltip: `${unitById.get(parentId)?.energyUnitName ?? parentId}｜${typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId}｜二级利用 ${amountLabel(bucket.standard)}`,
      });
    });
    if (pendingStandard > 0) {
      const parentIds = new Set(levelTwoBalanceRows
        .filter((row) => row.pendingStandardAmount > 0)
        .map((row) => row.level1EnergyUnitId));
      nodes.push({
        nodeId: 'pending',
        stage: 'pending',
        name: '待分解',
        valueLabel: amountLabel(pendingStandard),
        standardCoalAmount: pendingStandard,
        nodeType: `涉及 ${parentIds.size} 个一级用能单元`,
        share: nodeShare(pendingStandard),
      });
      levelTwoBalanceRows.filter((row) => row.pendingStandardAmount > 0).forEach((row) => {
        if (!nodes.some((node) => node.nodeId === `distribution:${row.level1EnergyUnitId}`)) return;
        links.push({
          linkId: `pending:${row.rowId}`,
          sourceNodeId: `distribution:${row.level1EnergyUnitId}`,
          targetNodeId: 'pending',
          standardCoalAmount: row.pendingStandardAmount,
          tooltip: `${row.level1EnergyUnitName}｜能源品种：${row.energyTypeName}｜一级分配 ${amountLabel(row.distributionStandardAmount)}｜二级利用 ${amountLabel(row.utilizationStandardAmount)}｜待分解 ${amountLabel(row.pendingStandardAmount)}`,
        });
      });
    }
  }

  const levelOneDetails: FlowDetailRow[] = [];
  boundaryRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    if (!type) return;
    const amount = recordAmount(record, type, period);
    levelOneDetails.push({
      flowDetailId: `input:${record.energyRecordId}`,
      stage: '能源输入',
      source: '企业边界',
      target: `厂内${type.energyTypeName}`,
      energyTypeName: type.energyTypeName,
      amount: amount.standard,
      amountUnit: 'tce',
      standardCoalAmount: amount.standard,
      energyUnitName: '全厂',
      sourceRecordIds: [record.energyRecordId],
      traceDescription: '企业级能源输入记录',
      traceRecords: [recordTrace(record, type, amount, period)],
      abnormal: false,
      relatedNodeIds: [`input:${type.energyTypeId}`, `medium:${type.energyTypeId}`],
    });
  });
  conversionAmounts.forEach((item) => {
    const outputName = item.outputType?.energyTypeName ?? item.conversion.outputEnergyName ?? '能源产出';
    levelOneDetails.push({
      flowDetailId: `conversion:${item.conversion.conversionOutputId}`,
      stage: '能源转换',
      source: item.inputType?.energyTypeName ?? '无投入自产',
      target: outputName,
      energyTypeName: outputName,
      amount: item.output.standard,
      amountUnit: 'tce',
      standardCoalAmount: item.output.standard,
      energyUnitName: firstLevelUnit(item.conversion.conversionEnergyUnitId, units)?.energyUnitName ?? '—',
      sourceRecordIds: [item.conversion.conversionOutputId],
      traceDescription: '能源转换与输出记录',
      traceRecords: [conversionTrace(item, period)],
      abnormal: false,
      relatedNodeIds: [
        `conversion:${item.conversion.conversionOutputId}`,
        ...(item.inputType ? [`input:${item.inputType.energyTypeId}`] : []),
        ...(item.outputType ? [`medium:${item.outputType.energyTypeId}`] : []),
      ],
    });
  });
  levelOneRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    const unit = record.energyUnitId ? unitById.get(record.energyUnitId) : null;
    if (!type || !unit) return;
    const amount = recordAmount(record, type, period);
    levelOneDetails.push({
      flowDetailId: `distribution:${record.energyRecordId}`,
      stage: '能源分配',
      source: `厂内${type.energyTypeName}`,
      target: unit.energyUnitName,
      energyTypeName: type.energyTypeName,
      amount: amount.standard,
      amountUnit: 'tce',
      standardCoalAmount: amount.standard,
      energyUnitName: unit.energyUnitName,
      sourceRecordIds: [record.energyRecordId],
      traceDescription: '一级用能单元能源分配记录',
      traceRecords: [recordTrace(record, type, amount, period)],
      abnormal: false,
      relatedNodeIds: [`medium:${type.energyTypeId}`, `distribution:${unit.energyUnitId}`],
    });
  });
  conversionAmounts.filter((item) => item.external.standard > 0).forEach((item) => {
    const outputName = item.outputType?.energyTypeName ?? item.conversion.outputEnergyName ?? '能源产出';
    levelOneDetails.push({
      flowDetailId: `external:${item.conversion.conversionOutputId}`,
      stage: '外部输出',
      source: outputName,
      target: item.conversion.receiver || '企业外部',
      energyTypeName: outputName,
      amount: item.external.standard,
      amountUnit: 'tce',
      standardCoalAmount: item.external.standard,
      energyUnitName: firstLevelUnit(item.conversion.conversionEnergyUnitId, units)?.energyUnitName ?? '全厂',
      sourceRecordIds: [item.conversion.conversionOutputId],
      traceDescription: '能源转换与输出记录（外部输出）',
      traceRecords: [conversionTrace(item, period, true)],
      abnormal: false,
      relatedNodeIds: [
        `conversion:${item.conversion.conversionOutputId}`,
        ...(item.outputType ? [`external:${item.outputType.energyTypeId}`] : []),
      ],
    });
  });
  levelOneBalanceRows.filter((row) => row.unallocatedStandardAmount > 0).forEach((row) => {
    levelOneDetails.push({
      flowDetailId: `unallocated:${row.energyTypeId}`,
      stage: '未分配',
      source: `厂内${row.energyTypeName}`,
      target: '一级未分配',
      energyTypeName: row.energyTypeName,
      amount: row.unallocatedStandardAmount,
      amountUnit: 'tce',
      standardCoalAmount: row.unallocatedStandardAmount,
      energyUnitName: '全厂',
      sourceRecordIds: [],
      traceDescription: '按一级管理平衡关系计算，非独立上游记录',
      traceRecords: [],
      abnormal: true,
      relatedNodeIds: [`medium:${row.energyTypeId}`, `unallocated:${row.energyTypeId}`],
    });
  });

  const levelTwoDetails: FlowDetailRow[] = [];
  const childBuckets = new Map<string, RecordBucket>();
  levelTwoRecords.forEach((record) => {
    const type = typeById.get(record.energyTypeId);
    const child = directSecondLevelUnit(record.energyUnitId, units);
    if (type && child?.parentEnergyUnitId) {
      addRecordBucket(
        childBuckets,
        `${child.parentEnergyUnitId}|${child.energyUnitId}|${record.energyTypeId}`,
        record,
        type,
        period,
      );
    }
  });
  childBuckets.forEach((bucket, key) => {
    const [parentId, childId, energyTypeId] = key.split('|');
    const parent = unitById.get(parentId);
    const child = unitById.get(childId);
    const type = typeById.get(energyTypeId);
    const balance = levelTwoBalanceRows.find((row) =>
      row.level1EnergyUnitId === parentId && row.energyTypeId === energyTypeId);
    if (!parent || !child || !type || !balance) return;
    levelTwoDetails.push({
      flowDetailId: `utilization:${key}`,
      stage: '能源利用',
      source: parent.energyUnitName,
      target: child.energyUnitName,
      energyTypeName: type.energyTypeName,
      amount: bucket.standard,
      amountUnit: 'tce',
      standardCoalAmount: bucket.standard,
      energyUnitName: `${parent.energyUnitName} / ${child.energyUnitName}`,
      sourceRecordIds: bucket.records.map((record) => record.energyRecordId),
      traceDescription: '二级用能单元能源利用记录',
      traceRecords: bucket.records.map((record) =>
        recordTrace(record, type, recordAmount(record, type, period), period)),
      abnormal: balance.status === '层级异常',
      relatedNodeIds: [
        `input:${energyTypeId}`,
        `medium:${energyTypeId}`,
        `distribution:${parentId}`,
        `utilization:${childId}`,
      ],
      level1EnergyUnitName: parent.energyUnitName,
      level2EnergyUnitName: child.energyUnitName,
      level2ObjectType: objectTypeLabel(child),
      distributionStandardAmount: balance.distributionStandardAmount,
      utilizationStandardAmount: bucket.standard,
      pendingStandardAmount: 0,
      status: balance.status,
    });
  });
  levelTwoBalanceRows.filter((row) => row.pendingStandardAmount > 0).forEach((row) => {
    const type = typeById.get(row.energyTypeId)!;
    const levelOne = levelOneBuckets.get(row.rowId);
    levelTwoDetails.push({
      flowDetailId: `pending:${row.rowId}`,
      stage: '待分解',
      source: row.level1EnergyUnitName,
      target: '待分解',
      energyTypeName: row.energyTypeName,
      amount: row.pendingStandardAmount,
      amountUnit: 'tce',
      standardCoalAmount: row.pendingStandardAmount,
      energyUnitName: row.level1EnergyUnitName,
      sourceRecordIds: levelOne?.records.map((record) => record.energyRecordId) ?? [],
      traceDescription: '一级分配量与二级利用量的差额，不代表能源未被实际使用',
      traceRecords: levelOne?.records.map((record) =>
        recordTrace(record, type, recordAmount(record, type, period), period)) ?? [],
      abnormal: false,
      relatedNodeIds: [
        `input:${row.energyTypeId}`,
        `medium:${row.energyTypeId}`,
        `distribution:${row.level1EnergyUnitId}`,
        'pending',
      ],
      level1EnergyUnitName: row.level1EnergyUnitName,
      level2EnergyUnitName: '—',
      level2ObjectType: '—',
      distributionStandardAmount: row.distributionStandardAmount,
      utilizationStandardAmount: row.utilizationStandardAmount,
      pendingStandardAmount: row.pendingStandardAmount,
      status: row.status,
    });
  });

  const rankSource = viewLevel === 'level1'
    ? distributionByUnit
    : levelTwoRecords.reduce((map, record) => {
      const type = typeById.get(record.energyTypeId);
      if (type && record.energyUnitId) {
        map.set(
          record.energyUnitId,
          (map.get(record.energyUnitId) ?? 0) + recordAmount(record, type, period).standard,
        );
      }
      return map;
    }, new Map<string, number>());
  const rankTotal = sum([...rankSource.values()]);
  const rankRows = [...rankSource.entries()]
    .map(([energyUnitId, standardCoalAmount]) => ({
      energyUnitId,
      name: unitById.get(energyUnitId)?.energyUnitName ?? energyUnitId,
      standardCoalAmount,
      share: rankTotal > 0 ? standardCoalAmount / rankTotal * 100 : 0,
    }))
    .filter((row) => row.standardCoalAmount > 0)
    .sort((left, right) => right.standardCoalAmount - left.standardCoalAmount)
    .slice(0, 5);

  const pendingObjectCount = new Set(levelTwoBalanceRows
    .filter((row) => row.pendingStandardAmount > 0)
    .map((row) => row.level1EnergyUnitId)).size;
  const overAllocatedObjectCount = new Set(levelTwoBalanceRows
    .filter((row) => row.status === '层级异常')
    .map((row) => row.level1EnergyUnitId)).size;
  const dataNotice = levelOneRecords.length === 0
    ? '当前期间尚未维护一级用能单元能源分配数据，暂无法生成能流分析。'
    : viewLevel === 'level2' && (pendingObjectCount > 0 || overAllocatedObjectCount > 0)
      ? [
        pendingObjectCount
          ? '部分一级用能单元尚未完整维护二级能源利用记录，相关差额统一计入“待分解”。'
          : '',
        overAllocatedObjectCount
          ? `${overAllocatedObjectCount} 个一级用能单元存在二级利用超出一级分配的层级勾稽异常。`
          : '',
      ].filter(Boolean).join(' ')
      : '';

  return {
    viewLevel,
    viewName: viewLevel === 'level1' ? '全厂一级能源分配视图' : '全厂二级能源利用视图',
    internalMetricLabel: viewLevel === 'level1' ? '内部分配量' : '内部利用量',
    differenceMetricLabel: viewLevel === 'level1' ? '未分配量' : '待分解量',
    inputStandardCoalAmount: inputStandard,
    internalAvailableStandardCoalAmount: availableForInternal,
    utilizationStandardCoalAmount: viewLevel === 'level1' ? distributionStandard : utilizationStandard,
    differenceStandardCoalAmount: viewLevel === 'level1' ? unallocatedStandard : pendingStandard,
    conversionLossStandardCoalAmount: conversionLossStandard,
    conversionDifferenceStandardCoalAmount: conversionDifferenceStandard,
    externalStandardCoalAmount: externalStandard,
    utilizationRate: viewLevel === 'level1'
      ? (availableForInternal > 0 ? distributionStandard / availableForInternal * 100 : 0)
      : (distributionStandard > 0 ? utilizationStandard / distributionStandard * 100 : 0),
    inputTypeCount: inputByType.size,
    conversionCount: conversionAmounts.length,
    utilizationRecordCount: viewLevel === 'level1' ? levelOneRecords.length : levelTwoRecords.length,
    unallocatedTypeCount: viewLevel === 'level1'
      ? levelOneBalanceRows.filter((row) => row.unallocatedStandardAmount > 0).length
      : levelTwoBalanceRows.filter((row) => row.pendingStandardAmount > 0).length,
    pendingObjectCount,
    overAllocatedObjectCount,
    overAllocatedStandardCoalAmount: overAllocatedStandard,
    nodes: levelOneRecords.length ? nodes : [],
    links: levelOneRecords.length ? links : [],
    levelOneBalanceRows,
    levelTwoBalanceRows,
    conversionDifferenceRows,
    detailRows: viewLevel === 'level1' ? levelOneDetails : levelTwoDetails,
    rankRows: levelOneRecords.length ? rankRows : [],
    dataNotice,
  };
}
