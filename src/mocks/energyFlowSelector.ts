import {
  listV11ConversionOutputs,
  flowExternalIssue,
  listV11ExternalSupplyRecords,
  listV11EnergyRecords,
  listV11EnergyTypes,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
  type V11ConversionOutput,
  type V11ExternalSupplyRecord,
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
  | 'recovery'
  | 'external'
  | 'unallocated'
  | 'pending';

export interface FlowNode {
  nodeId: string;
  stage: FlowStage;
  name: string;
  valueLabel: string;
  detailLabel?: string;
  detailLabelSecondary?: string;
  sourceLabel?: string;
  standardCoalAmount: number;
  nodeType: string;
  share: number;
  energyUnitId?: string;
  parentEnergyUnitId?: string | null;
  anomalous?: boolean;
}

export interface FlowCalculation {
  physicalAmount: number;
  physicalUnit: string;
  standardCoalFactor: number;
  standardCoalFactorUnit: string;
}

export interface FlowLink {
  linkId: string;
  sourceNodeId: string;
  targetNodeId: string;
  standardCoalAmount: number;
  tooltip?: string;
  energyTypeName?: string;
  calculation?: FlowCalculation;
  flowType?: 'boundary_input' | 'conversion_input' | 'conversion_output' | 'consumption' | 'recovery_input' | 'recovery_output' | 'boundary_output' | 'conversion_loss' | 'distribution_loss' | 'unallocated';
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
  confirmedConversionLossAmount: number;
  confirmedConversionLossStandardAmount: number;
  unallocatedAmount: number;
  unallocatedStandardAmount: number;
  overAllocatedAmount: number;
  overAllocatedStandardAmount: number;
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
  relatedLinkIds: string[];
  flowStageLabel?: string;
  calculation?: FlowCalculation;
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
  confirmedConversionLossStandardCoalAmount: number;
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

export interface EnergyBalanceSummary {
  inputStandardCoalAmount: number;
  effectiveUseStandardCoalAmount: number;
  recoveredStandardCoalAmount: number;
  externalOutputStandardCoalAmount: number;
  differenceStandardCoalAmount: number;
}

export function summarizeFlowBalance(
  levelOneDataset: FlowAnalysisDataset,
  levelTwoDataset: FlowAnalysisDataset,
  scope = 'enterprise',
): EnergyBalanceSummary {
  if (scope === 'enterprise') {
    // Phase one diagnoses the management balance that is already closed by the
    // level-one flow view. Level-two utilization is an optional decomposition
    // and must not turn undisaggregated level-one energy into a false loss.
    const distributed = levelOneDataset.utilizationStandardCoalAmount;
    const external = levelOneDataset.externalStandardCoalAmount;
    const difference = levelOneDataset.differenceStandardCoalAmount;
    return {
      inputStandardCoalAmount: distributed + external + difference,
      effectiveUseStandardCoalAmount: distributed,
      recoveredStandardCoalAmount: 0,
      externalOutputStandardCoalAmount: external,
      differenceStandardCoalAmount: difference,
    };
  }

  const rows = levelTwoDataset.levelTwoBalanceRows.filter(
    (row) => row.level1EnergyUnitId === scope,
  );
  const distributed = sum(rows.map((row) => row.distributionStandardAmount));
  const unitName = rows[0]?.level1EnergyUnitName;
  const external = sum(levelOneDataset.detailRows
    .filter((row) => row.stage === '外部输出' && row.level1EnergyUnitName === unitName)
    .map((row) => row.standardCoalAmount));
  return {
    inputStandardCoalAmount: distributed + external,
    effectiveUseStandardCoalAmount: distributed,
    recoveredStandardCoalAmount: 0,
    externalOutputStandardCoalAmount: external,
    differenceStandardCoalAmount: 0,
  };
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
  confirmedLoss: Amount;
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
  if (record.entryMode === 'annual' || record.monthlyReportedMonths?.[period.month - 1] === false) return 0;
  return record.monthlyAmounts[period.month - 1] ?? 0;
}

function hasPeriodData(record: V11EnergyRecord, period: FlowPeriod) {
  if (period.grain === 'month' && record.entryMode === 'annual') return false;
  if (period.grain === 'year') return recordPhysicalAmount(record, period) > 0;
  const monthIndex = period.month - 1;
  return record.monthlyReportedMonths?.[monthIndex]
    ?? (record.monthlyAmounts[monthIndex] ?? 0) > 0;
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

function periodQuantity(annualValue: number | undefined, monthlyValues: number[] | undefined, period: FlowPeriod, reported?: boolean[]) {
  if (period.grain === 'year') {
    return monthlyValues
      ? monthlyValues.reduce((total, value, i) => total + (reported?.[i] === false ? 0 : value ?? 0), 0)
      : annualValue ?? 0;
  }
  const index = period.month - 1;
  return reported?.[index] === false ? 0 : monthlyValues?.[index] ?? 0;
}

function conversionAmount(
  conversion: V11ConversionOutput,
  records: V11EnergyRecord[],
  types: V11EnergyType[],
  period: FlowPeriod,
  externalSupplies: V11ExternalSupplyRecord[],
): ConversionAmount {
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
  const inputPhysical = linkedAmount?.physical ?? 0;
  const outputPhysical = periodQuantity(conversion.outputAmount, conversion.monthlyOutputAmounts, period, conversion.monthlyOutputReported);
  const internalPhysical = periodQuantity(conversion.internalAmount, conversion.monthlyInternalAmounts, period, conversion.monthlyOutputReported);
  const externalPhysical = externalSupplies
    .filter((item) => item.conversionOutputId === conversion.conversionOutputId)
    .reduce((total, item) => total + externalSupplyAmount(item, period), 0);
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
  const confirmedLossPhysical = periodQuantity(conversion.lossAmount, conversion.monthlyLossAmounts, period, conversion.monthlyLossReported);
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
    confirmedLoss: {
      physical: confirmedLossPhysical,
      standard: standardAmount(confirmedLossPhysical, outputType),
      unit: output.unit,
    },
    lossStandard: Math.max(input.standard - output.standard, 0),
  };
}

function externalSupplyAmount(item: V11ExternalSupplyRecord, period: FlowPeriod) {
  return periodQuantity(item.amount, item.monthlyAmounts, period, item.monthlyReported);
}

function conversionDataQualityIssues(
  conversions: V11ConversionOutput[],
  records: V11EnergyRecord[],
  types: V11EnergyType[],
  period: FlowPeriod,
  externalSupplies: V11ExternalSupplyRecord[],
) {
  const issues: string[] = [];
  conversions.forEach((conversion) => {
    const source = conversion.inputEnergyRecordId
      ? records.find((record) => record.energyRecordId === conversion.inputEnergyRecordId)
      : null;
    if (!source && conversion.inputMode !== 'none') {
      const name = listEnergyUnits(conversion.year).find(unit => unit.energyUnitId === conversion.conversionEnergyUnitId)?.energyUnitName ?? conversion.recordType;
      issues.push(`${name}：投入待填报，请在能源消费补充二级用能单元数据`);
    }
    if (conversion.inputMode === 'linked' && !source) {
      issues.push(`${conversion.recordType}缺少有效的投入能源数据引用`);
      return;
    }
    if (source && source.year !== conversion.year) {
      issues.push(`${conversion.recordType}引用了不同年度的能源数据`);
    }
    if (source && !['能源消费', '回收能源'].includes(source.energyRole)) {
      issues.push(`${conversion.recordType}引用的能源记录角色为“${source.energyRole}”，不能作为转换投入`);
    }
    if (source && period.grain === 'month' && !hasPeriodData(source, period)) {
      const name = listEnergyUnits(conversion.year).find(unit => unit.energyUnitId === conversion.conversionEnergyUnitId)?.energyUnitName ?? conversion.recordType;
      issues.push(`${name}：本月投入待填报`);
    }
    const inputType = source
      ? types.find((type) => type.energyTypeId === source.energyTypeId)
      : types.find((type) => type.energyTypeId === conversion.inputEnergyTypeId)
        ?? types.find((type) => type.energyTypeName === conversion.recoveryEnergyName);
    const outputType = types.find((type) => type.energyTypeId === conversion.outputEnergyTypeId)
      ?? types.find((type) => type.energyTypeName === conversion.outputEnergyName);
    if (inputType && outputType && inputType.energyTypeId === outputType.energyTypeId && conversion.recordType === '其他转换') {
      issues.push(`${conversion.recordType}存在“${inputType.energyTypeName}→${outputType.energyTypeName}”同品种转换，请确认是否应改为能源分配或自产能源`);
    }
    const externalAmount = externalSupplies
      .filter((item) => item.conversionOutputId === conversion.conversionOutputId)
      .reduce((total, item) => total + externalSupplyAmount(item, period), 0);
    const outputAmount = periodQuantity(conversion.outputAmount, conversion.monthlyOutputAmounts, period, conversion.monthlyOutputReported);
    const internalAmount = periodQuantity(conversion.internalAmount, conversion.monthlyInternalAmounts, period, conversion.monthlyOutputReported);
    const lossAmount = periodQuantity(conversion.lossAmount, conversion.monthlyLossAmounts, period, conversion.monthlyLossReported);
    const assigned = internalAmount + externalAmount + lossAmount;
    if (Math.abs(outputAmount - assigned) > 1e-8) {
      issues.push(`${conversion.recordType}产出总量与内部去向、外部输出及损失不一致`);
    }
    if (period.grain === 'month'
      && !source
      && conversion.inputMode !== 'none'
      && !conversion.monthlyInputAmounts?.length) {
      issues.push(`${conversion.recordType}没有月度投入数据，本月未生成转换量`);
    }
  });
  return [...new Set(issues)];
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

function mediumName(energyTypeId: string, fallback: string) {
  if (energyTypeId === 'v11-energy-steam') return '锅炉蒸汽';
  if (energyTypeId === 'v11-energy-recovered-steam') return '回收蒸汽';
  return fallback;
}

function conversionTrace(item: ConversionAmount, period: FlowPeriod, external = false): FlowTraceRecord {
  const amount = external ? item.external : item.output;
  return {
    recordId: item.conversion.conversionOutputId,
    recordType: '能源转换与外供补充',
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
  const units = listEnergyUnits(period.year);
  const types = listV11EnergyTypes(period.year);
  const typeById = new Map(types.map((type) => [type.energyTypeId, type]));
  const unitById = new Map(units.map((unit) => [unit.energyUnitId, unit]));
  const sourceRecords = listV11EnergyRecords().filter((record) =>
    record.year === period.year);
  const records = sourceRecords.filter((record) => record.energyRole === '能源消费' && v11RecordScopeType(record) !== 'device');
  const allExternalSupplies = listV11ExternalSupplyRecords().filter((item) => item.year === period.year);
  const externalSupplies = allExternalSupplies.map((item) => {
    const conversion = listV11ConversionOutputs().find((c) => c.conversionOutputId === item.conversionOutputId);
    if (!item.monthlyReported && !conversion?.flowManaged) return item;
    const monthlyAmounts = (item.monthlyAmounts ?? Array(12).fill(0)).map((amount, i) => flowExternalIssue(item, i + 1) ? 0 : amount);
    return { ...item, monthlyAmounts, amount: sum(monthlyAmounts) };
  });
  const periodRecords = records.filter((record) => hasPeriodData(record, period));
  const conversionAmounts = listV11ConversionOutputs()
    .filter((conversion) => conversion.year === period.year)
    .filter((conversion) => conversion.recordType !== '直接外供')
    .map((conversion) => conversionAmount(conversion, sourceRecords, types, period, externalSupplies));
  const conversionIssues = conversionDataQualityIssues(
    listV11ConversionOutputs().filter((conversion) => conversion.year === period.year && conversion.recordType !== '直接外供'),
    sourceRecords,
    types,
    period,
    externalSupplies,
  );
  listV11ConversionOutputs().filter((c) => c.year === period.year && c.flowManaged).forEach((c) => {
    if (period.grain === 'month' && c.monthlyOutputReported?.[period.month - 1] === false) conversionIssues.push(`${units.find((u) => u.energyUnitId === c.conversionEnergyUnitId)?.energyUnitName ?? '转换系统'}：本月单元产出待填报`);
  });
  if (allExternalSupplies.some((item) => item.monthlyReported && (period.grain === 'month' ? flowExternalIssue(item, period.month) : item.monthlyReported.some((reported, i) => reported && flowExternalIssue(item, i + 1))))) conversionIssues.push('部分外供记录待核验，未纳入有效流量');
  const linkedInputIds = new Set(conversionAmounts.flatMap((item) =>
    item.conversion.inputEnergyRecordId ? [item.conversion.inputEnergyRecordId] : []));
  const boundaryRecords = periodRecords.filter((record) => record.energyUnitId === null);
  const levelOneRecords = periodRecords.filter((record) =>
    Boolean(record.energyUnitId)
    && !linkedInputIds.has(record.energyRecordId)
    && unitById.get(record.energyUnitId!)?.unitLevel === 'level1');
  const levelTwoRecords = periodRecords.filter((record) =>
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
      // 保留内部回收量用于企业平衡口径，但不把它渲染成企业边界输入节点。
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
  // 转换产出的内部使用量按录入的目标单元归入一级分配；二级目标向上归并到其一级父单元。
  conversionAmounts.forEach((item) => {
    if (!item.conversion.outputTargetEnergyUnitId || item.internal.standard <= 0 || !item.outputType) return;
    const target = unitById.get(item.conversion.outputTargetEnergyUnitId);
    if (!target) return;
    const levelOneTargetId = target.unitLevel === 'level1' ? target.energyUnitId : target.parentEnergyUnitId;
    if (!levelOneTargetId) return;
    // If the target level already has a same-type distribution ledger, that ledger
    // is the downstream allocation of this conversion output. Do not add the
    // conversion internal amount a second time.
    const hasDownstreamDistribution = levelOneRecords.some((record) =>
      record.energyUnitId === levelOneTargetId && record.energyTypeId === item.outputType!.energyTypeId,
    );
    if (hasDownstreamDistribution) return;
    addAmount(distributionByType, item.outputType, item.internal);
    distributionByUnit.set(
      levelOneTargetId,
      (distributionByUnit.get(levelOneTargetId) ?? 0) + item.internal.standard,
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
    // 转换产出中的直接外供从转换节点流向企业外部，并不进入“厂内可供分配”节点；
    // 直接外供则从厂内能源池流出，需在计算该节点的未分配差额时扣除。
    const conversionInternalOutput = {
      physical: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.internal.physical)),
      standard: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.internal.standard)),
    };
    const conversionExternal = {
      physical: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.external.physical)),
      standard: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.external.standard)),
    };
    const directExternal = {
      physical: sum(externalSupplies.filter((item) => !item.conversionOutputId && (item.energyTypeId ?? '') === energyTypeId).map((item) => externalSupplyAmount(item, period))),
      standard: sum(externalSupplies.filter((item) => !item.conversionOutputId && (item.energyTypeId ?? '') === energyTypeId).map((item) => standardAmount(externalSupplyAmount(item, period), type))),
    };
    const external = {
      physical: conversionExternal.physical + directExternal.physical,
      standard: conversionExternal.standard + directExternal.standard,
    };
    const confirmedLoss = {
      physical: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.confirmedLoss.physical)),
      standard: sum(conversionAmounts.filter((item) => item.outputType?.energyTypeId === energyTypeId).map((item) => item.confirmedLoss.standard)),
    };
    const distribution = distributionByType.get(energyTypeId) ?? {
      physical: 0,
      standard: 0,
      unit: type.measurementUnit,
    };
    const externalInput = externalInputByType.get(energyTypeId)?.standard ?? 0;
    const internalRecovery = internalRecoveryByType.get(energyTypeId)?.standard ?? 0;
    const availableAmount = input.physical + conversionInternalOutput.physical - conversionInput.physical;
    const availableStandardAmount = input.standard + conversionInternalOutput.standard - conversionInput.standard;
    const difference = availableAmount - distribution.physical - directExternal.physical;
    const standardDifference = availableStandardAmount - distribution.standard - directExternal.standard;
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
      confirmedConversionLossAmount: confirmedLoss.physical,
      confirmedConversionLossStandardAmount: confirmedLoss.standard,
      unallocatedAmount: Math.max(difference, 0),
      unallocatedStandardAmount: Math.max(standardDifference, 0),
      overAllocatedAmount: Math.max(-difference, 0),
      overAllocatedStandardAmount: Math.max(-standardDifference, 0),
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
  // 外供既可能挂在转换产出上，也可能直接挂在企业级能源输入上。
  // 两类记录都必须进入同一个外部输出口径，否则能流图/平衡表有数据，KPI
  // 的外部输出量却会漏算直接外供。
  const directExternalStandard = externalSupplies
    .filter((item) => !item.conversionOutputId)
    .reduce((total, item) => {
      const source = item.inputEnergyRecordId
        ? sourceRecords.find((record) => record.energyRecordId === item.inputEnergyRecordId)
        : null;
      const type = typeById.get(item.energyTypeId ?? source?.energyTypeId ?? '');
      return total + (type ? standardAmount(externalSupplyAmount(item, period), type) : 0);
    }, 0);
  const externalStandard = sum(conversionAmounts.map((item) => item.external.standard))
    + directExternalStandard;
  const confirmedConversionLossStandard = sum(conversionAmounts.map((item) => item.confirmedLoss.standard));
  const conversionLossStandard = sum(conversionAmounts.map((item) => item.lossStandard));
  const unallocatedStandard = sum(levelOneBalanceRows.map((row) => row.unallocatedStandardAmount));
  const pendingStandard = sum(levelTwoBalanceRows.map((row) => row.pendingStandardAmount));
  const overAllocatedStandard = sum(levelTwoBalanceRows.map((row) => row.overAllocatedStandardAmount));
  const conversionOutputStandard = sum(conversionAmounts.map((item) => item.output.standard));
  const conversionInternalOutputStandard = sum(conversionAmounts.map((item) => item.internal.standard));
  const availableForInternal = Math.max(
    inputStandard - sum(conversionAmounts.map((item) => item.input.standard)) + conversionInternalOutputStandard,
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
    if (amount.standard <= 0 || (externalInputByType.get(energyTypeId)?.standard ?? 0) <= 0) return;
    const boundaryAmount = externalInputByType.get(energyTypeId)!;
    nodes.push({
      nodeId: `input:${energyTypeId}`,
      stage: 'input',
      name: `企业输入·${typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId}`,
      valueLabel: amountLabel(boundaryAmount.standard),
      standardCoalAmount: boundaryAmount.standard,
      nodeType: '企业边界输入',
      share: inputStandard > 0 ? boundaryAmount.standard / inputStandard * 100 : 0,
    });
  });
  conversionAmounts.forEach((item) => {
    if (item.input.standard <= 0 && item.output.standard <= 0) return;
    const nodeId = `conversion:${item.conversion.conversionOutputId}`;
    const isRecovery = item.conversion.inputMode === 'recovery';
    const recoverySource = firstLevelUnit(item.conversion.recoverySourceEnergyUnitId ?? null, units);
    const sourceLabel = isRecovery
      ? `来源：${recoverySource?.energyUnitName ?? '生产过程'}${item.conversion.recoveryEnergyName ?? item.inputType?.energyTypeName ?? '余能'}`
      : item.conversion.conversionEnergyUnitId === 'eu-compressed-air'
        ? '设备：1#、2#螺杆空压机'
        : undefined;
    const lossReported = period.grain === 'month'
      ? item.conversion.monthlyLossReported?.[period.month - 1] ?? item.conversion.monthlyLossAmounts?.[period.month - 1] != null
      : item.conversion.monthlyLossAmounts?.some((value, i) => value != null && item.conversion.monthlyLossReported?.[i] !== false) ?? (item.conversion.lossAmount ?? 0) > 0;
    nodes.push({
      nodeId,
      stage: isRecovery ? 'recovery' : 'conversion',
      name: (item.conversion.conversionEnergyUnitId
        ? unitById.get(item.conversion.conversionEnergyUnitId)?.energyUnitName
        : null) ?? item.conversion.recordType,
      valueLabel: `${item.inputType?.energyTypeName ?? '无投入自产'} → ${item.outputType?.energyTypeName ?? '产出能源'}`,
      sourceLabel,
      detailLabel: `${isRecovery ? '回收投入' : '投入'} ${amountLabel(item.input.standard)}`,
      detailLabelSecondary: `产出 ${amountLabel(item.output.standard)}｜${lossReported ? `已确认损失 ${amountLabel(item.confirmedLoss.standard)}` : '损失未填写'}`,
      standardCoalAmount: item.output.standard,
      nodeType: isRecovery ? '能源回收与循环利用' : '能源转换',
      share: conversionOutputStandard > 0 ? item.output.standard / conversionOutputStandard * 100 : 0,
    });
    if (!isRecovery && item.inputType && nodes.some((node) => node.nodeId === `input:${item.inputType!.energyTypeId}`)) {
      links.push({
        linkId: `${nodeId}:input`,
        sourceNodeId: `input:${item.inputType.energyTypeId}`,
        targetNodeId: nodeId,
        standardCoalAmount: item.input.standard,
        flowType: 'conversion_input',
      });
    }
    if (isRecovery && item.input.standard > 0) {
      const sourceRecord = item.conversion.inputEnergyRecordId
        ? sourceRecords.find((record) => record.energyRecordId === item.conversion.inputEnergyRecordId)
        : null;
      const sourceUnit = item.conversion.recoverySourceEnergyUnitId
        ? unitById.get(item.conversion.recoverySourceEnergyUnitId)
        : sourceRecord?.energyUnitId
          ? unitById.get(sourceRecord.energyUnitId)
          : null;
      const levelOneSourceId = sourceUnit?.unitLevel === 'level1' ? sourceUnit.energyUnitId : sourceUnit?.parentEnergyUnitId;
      const sourceNodeId = levelOneSourceId ? `distribution:${levelOneSourceId}` : '';
      if (sourceNodeId && distributionByUnit.has(levelOneSourceId!)) {
        links.push({
          linkId: `${nodeId}:recovery-input`,
          sourceNodeId,
          targetNodeId: nodeId,
          standardCoalAmount: item.input.standard,
          flowType: 'recovery_input',
        });
      }
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
      name: mediumName(energyTypeId, `厂内${typeById.get(energyTypeId)?.energyTypeName ?? energyTypeId}`),
      valueLabel: amountLabel(available),
      standardCoalAmount: available,
      nodeType: '厂内可供分配能源',
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
        flowType: item.conversion.inputMode === 'recovery' ? 'recovery_output' : 'conversion_output',
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
  conversionAmounts.forEach((item) => {
    if (!item.conversion.outputTargetEnergyUnitId || item.internal.standard <= 0 || !item.outputType) return;
    const target = unitById.get(item.conversion.outputTargetEnergyUnitId);
    const levelOneTargetId = target?.unitLevel === 'level1' ? target.energyUnitId : target?.parentEnergyUnitId;
    if (!levelOneTargetId) return;
    const hasDownstreamDistribution = levelOneRecords.some((record) =>
      record.energyUnitId === levelOneTargetId && record.energyTypeId === item.outputType!.energyTypeId,
    );
    if (hasDownstreamDistribution) return;
    const sourceNodeId = `medium:${item.outputType.energyTypeId}`;
    const targetNodeId = `distribution:${levelOneTargetId}`;
    if (nodes.some((node) => node.nodeId === sourceNodeId) && nodes.some((node) => node.nodeId === targetNodeId)) {
      links.push({
        linkId: `conversion-distribution:${item.conversion.conversionOutputId}`,
        sourceNodeId,
        targetNodeId,
        standardCoalAmount: item.internal.standard,
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
  externalSupplies.filter((item) => item.inputEnergyRecordId).forEach((item) => {
    const source = sourceRecords.find((record) => record.energyRecordId === item.inputEnergyRecordId);
    const type = typeById.get(item.energyTypeId ?? source?.energyTypeId ?? '');
    if (!source || !type) return;
    const amount = externalSupplyAmount(item, period);
    const standard = standardAmount(amount, type);
    if (standard <= 0) return;
    const nodeId = `external:${type.energyTypeId}`;
    const existing = nodes.find((node) => node.nodeId === nodeId);
    if (existing) {
      existing.standardCoalAmount += standard;
      existing.valueLabel = amountLabel(existing.standardCoalAmount);
      existing.share = nodeShare(existing.standardCoalAmount);
    } else {
      nodes.push({
        nodeId,
        stage: 'external',
        name: `外部输出·${type.energyTypeName}`,
        valueLabel: amountLabel(standard),
        standardCoalAmount: standard,
        nodeType: '外部输出',
        share: nodeShare(standard),
      });
    }
    links.push({
      linkId: `external:direct:${item.externalSupplyId}`,
      sourceNodeId: `medium:${type.energyTypeId}`,
      targetNodeId: nodeId,
      standardCoalAmount: standard,
    });
  });

  // 图中外供从能源池分支；能源池包含外供前的可供量，平衡表仍保留厂内净可供口径。
  conversionAmounts.filter((item) => item.external.standard > 0 && item.outputType).forEach((item) => {
    const medium = nodes.find((node) => node.nodeId === `medium:${item.outputType!.energyTypeId}`);
    const externalLink = links.find((link) => link.linkId === `external:${item.conversion.conversionOutputId}`);
    if (!medium || !externalLink) return;
    externalLink.sourceNodeId = medium.nodeId;
    externalLink.flowType = 'boundary_output';
    medium.standardCoalAmount += item.external.standard;
    medium.valueLabel = amountLabel(medium.standardCoalAmount);
    const outputLink = links.find((link) => link.linkId === `conversion-medium:${item.conversion.conversionOutputId}`);
    if (outputLink) outputLink.standardCoalAmount += item.external.standard;
    else links.push({ linkId: `conversion-medium:${item.conversion.conversionOutputId}`, sourceNodeId: `conversion:${item.conversion.conversionOutputId}`, targetNodeId: medium.nodeId, standardCoalAmount: item.external.standard, flowType: item.conversion.inputMode === 'recovery' ? 'recovery_output' : 'conversion_output' });
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
      relatedLinkIds: links.filter((link) => link.sourceNodeId === `input:${type.energyTypeId}`).map((link) => link.linkId),
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
      relatedLinkIds: [`conversion:${item.conversion.conversionOutputId}:input`, `conversion:${item.conversion.conversionOutputId}:recovery-input`, `conversion-medium:${item.conversion.conversionOutputId}`],
      stage: '能源转换',
      source: item.inputType?.energyTypeName ?? '无投入自产',
      target: outputName,
      energyTypeName: outputName,
      amount: item.output.standard,
      amountUnit: 'tce',
      standardCoalAmount: item.output.standard,
      energyUnitName: firstLevelUnit(item.conversion.conversionEnergyUnitId, units)?.energyUnitName ?? '—',
      sourceRecordIds: [item.conversion.conversionOutputId],
      traceDescription: '用能单元产出在能源转换与外供维护',
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
      relatedLinkIds: [`distribution:${record.energyRecordId}`],
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
  // 当转换产出没有对应的一级分配台账时，图和余额会自动将其内部使用量归入目标一级单元；
  // 流向明细也必须生成同一条分配记录，才能完成图、表、明细的可追溯核对。
  conversionAmounts.forEach((item) => {
    if (!item.conversion.outputTargetEnergyUnitId || item.internal.standard <= 0 || !item.outputType) return;
    const target = unitById.get(item.conversion.outputTargetEnergyUnitId);
    const levelOneTargetId = target?.unitLevel === 'level1' ? target.energyUnitId : target?.parentEnergyUnitId;
    const levelOneTarget = levelOneTargetId ? unitById.get(levelOneTargetId) : null;
    if (!levelOneTarget) return;
    const hasDownstreamDistribution = levelOneRecords.some((record) =>
      record.energyUnitId === levelOneTargetId && record.energyTypeId === item.outputType!.energyTypeId,
    );
    if (hasDownstreamDistribution) return;
    levelOneDetails.push({
      flowDetailId: `distribution:conversion:${item.conversion.conversionOutputId}`,
      relatedLinkIds: [`conversion-distribution:${item.conversion.conversionOutputId}`],
      stage: '能源分配',
      source: `厂内${item.outputType.energyTypeName}`,
      target: levelOneTarget.energyUnitName,
      energyTypeName: item.outputType.energyTypeName,
      amount: item.internal.standard,
      amountUnit: 'tce',
      standardCoalAmount: item.internal.standard,
      energyUnitName: levelOneTarget.energyUnitName,
      sourceRecordIds: [item.conversion.conversionOutputId],
      traceDescription: '根据转换记录的内部使用量自动生成的一级分配记录',
      traceRecords: [{
        recordId: item.conversion.conversionOutputId,
        recordType: '能源转换与输出',
        originalAmount: item.internal.physical,
        originalUnit: item.internal.unit,
        standardCoalAmount: item.internal.standard,
        factorDescription: factorDescription(item.outputType),
        periodLabel: periodLabel(period),
        sourceType: '转换产出内部使用',
        relatedRecordId: item.conversion.inputEnergyRecordId ?? '无投入自产/回收能源',
        updatedAt: '上游记录未提供修改时间',
      }],
      abnormal: false,
      relatedNodeIds: [
        `conversion:${item.conversion.conversionOutputId}`,
        `medium:${item.outputType.energyTypeId}`,
        `distribution:${levelOneTargetId}`,
      ],
    });
  });
  externalSupplies
    .filter((item) => item.inputEnergyRecordId)
    .forEach((item) => {
      const source = sourceRecords.find((record) => record.energyRecordId === item.inputEnergyRecordId);
      const type = typeById.get(item.energyTypeId ?? source?.energyTypeId ?? '');
      if (!source || !type) return;
      const amount = externalSupplyAmount(item, period);
      const output = { physical: amount, standard: standardAmount(amount, type), unit: item.unit ?? type.measurementUnit };
      if (output.standard <= 0) return;
      levelOneDetails.push({
        flowDetailId: `external:${item.externalSupplyId}`,
        relatedLinkIds: [`external:direct:${item.externalSupplyId}`],
        stage: '外部输出',
        source: `厂内${type.energyTypeName}`,
        target: item.receiver || '企业外部',
        energyTypeName: type.energyTypeName,
        amount: output.standard,
        amountUnit: 'tce',
        standardCoalAmount: output.standard,
        energyUnitName: '全厂',
        sourceRecordIds: [item.externalSupplyId, item.inputEnergyRecordId!],
        traceDescription: '能源外供台账',
        traceRecords: [{
          recordId: item.externalSupplyId,
          recordType: '能源外供',
          originalAmount: output.physical,
          originalUnit: output.unit,
          standardCoalAmount: output.standard,
          factorDescription: factorDescription(type),
          periodLabel: periodLabel(period),
          sourceType: '直接外供',
          relatedRecordId: item.inputEnergyRecordId!,
          updatedAt: '上游记录未提供修改时间',
        }],
        abnormal: false,
        relatedNodeIds: [`medium:${type.energyTypeId}`, `external:${type.energyTypeId}`],
      });
    });
  conversionAmounts.filter((item) => item.external.standard > 0).forEach((item) => {
    const outputName = item.outputType?.energyTypeName ?? item.conversion.outputEnergyName ?? '能源产出';
    levelOneDetails.push({
      flowDetailId: `external:conversion:${item.conversion.conversionOutputId}`,
      relatedLinkIds: [`external:${item.conversion.conversionOutputId}`],
      stage: '外部输出',
      source: outputName,
      target: item.conversion.receiver || '企业外部',
      energyTypeName: outputName,
      amount: item.external.standard,
      amountUnit: 'tce',
      standardCoalAmount: item.external.standard,
      energyUnitName: firstLevelUnit(item.conversion.conversionEnergyUnitId, units)?.energyUnitName ?? '全厂',
      sourceRecordIds: externalSupplies.filter((supply) => supply.conversionOutputId === item.conversion.conversionOutputId).map((supply) => supply.externalSupplyId),
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
      relatedLinkIds: [`unallocated:${row.energyTypeId}`],
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
      relatedLinkIds: [`utilization:${key}`],
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
      relatedLinkIds: [`pending:${row.rowId}`],
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
  const levelOneOverAllocatedStandard = sum(levelOneBalanceRows.map((row) => row.overAllocatedStandardAmount));
  const levelOneOverAllocatedTypes = levelOneBalanceRows
    .filter((row) => row.overAllocatedStandardAmount > 0.01)
    .map((row) => row.energyTypeName);
  const missingPeriodRecordCount = records.filter((record) => !hasPeriodData(record, period)).length;
  const periodDataNotice = period.grain === 'month' && missingPeriodRecordCount > 0
    ? `\u5f53\u524d\u6708\u4efd\u6709 ${missingPeriodRecordCount} \u6761\u80fd\u6e90\u6570\u636e\u4ec5\u7ef4\u62a4\u5e74\u5ea6\u503c\u6216\u5c1a\u672a\u586b\u62a5\u6708\u5ea6\u503c\uff0c\u672c\u6b21\u5206\u6790\u4e0d\u6309\u5e74\u5ea6\u503c\u5206\u644a\u5230\u6708\u5ea6\u3002`
    : '';
  const externalSupplyDataNotice = period.grain === 'month'
    && externalSupplies.some((item) => item.amount > 0 && !item.monthlyAmounts)
    ? '\u5f53\u524d\u6708\u4efd\u5b58\u5728\u4ec5\u7ef4\u62a4\u5e74\u5ea6\u503c\u7684\u5916\u4f9b\u53f0\u8d26\uff0c\u672c\u6b21\u5206\u6790\u4e0d\u5c06\u5e74\u5ea6\u5916\u4f9b\u91cf\u5206\u644a\u5230\u6708\u5ea6\u3002'
    : '';
  const levelOneBalanceNotice = levelOneOverAllocatedStandard > 0.01
    ? `\u4e00\u7ea7\u5206\u914d\u8d85\u51fa\u53ef\u4f9b\u80fd\u6e90 ${levelOneOverAllocatedStandard.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} tce\uff08${[...new Set(levelOneOverAllocatedTypes)].join('\u3001')}\uff09\uff0c\u8bf7\u8865\u5145\u5bf9\u5e94\u7684\u8f6c\u6362\u4ea7出\u6216\u6838\u67e5\u5206\u914d\u53f0\u8d26\u662f\u5426\u91cd\u590d\u8ba1\u5165\u3002`
    : '';
  const baseDataNotice = levelOneRecords.length === 0
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

  const dataNotice = [
    conversionIssues.length ? `能源转换源头校验：${conversionIssues.join('；')}` : '',
    periodDataNotice,
    externalSupplyDataNotice,
    levelOneBalanceNotice,
    baseDataNotice,
  ].filter(Boolean).join(' ');

  const energyByNode = new Map<string, V11EnergyType>([...typeById.values()].flatMap((type) =>
    ['input', 'medium', 'external', 'unallocated'].map((stage) => [`${stage}:${type.energyTypeId}`, type] as const)));
  const conversionByNode = new Map(conversionAmounts.map((item) => [`conversion:${item.conversion.conversionOutputId}`, item]));
  links.forEach((link) => {
    const inputType = conversionByNode.get(link.targetNodeId)?.inputType;
    const outputType = conversionByNode.get(link.sourceNodeId)?.outputType;
    const type = inputType ?? outputType ?? energyByNode.get(link.sourceNodeId) ?? energyByNode.get(link.targetNodeId);
    link.energyTypeName = type?.energyTypeName
      ?? levelTwoDetails.find((row) => row.relatedLinkIds.includes(link.linkId))?.energyTypeName;
    if (type && Number.isFinite(type.standardCoalFactor) && type.standardCoalFactor > 0) {
      // Use this branch's amount in the energy type's canonical unit, not the entire source record.
      link.calculation = {
        physicalAmount: link.standardCoalAmount * (type.standardCoalFactorUnit.startsWith('kgce') ? 1000 : 1) / type.standardCoalFactor,
        physicalUnit: type.measurementUnit,
        standardCoalFactor: type.standardCoalFactor,
        standardCoalFactorUnit: type.standardCoalFactorUnit,
      };
    }
  });

  return {
    viewLevel,
    viewName: viewLevel === 'level1' ? '全厂一级能源分配视图' : '全厂二级能源利用视图',
    internalMetricLabel: viewLevel === 'level1' ? '内部分配量' : '内部利用量',
    differenceMetricLabel: viewLevel === 'level1' ? '未分配量' : '待分解量',
    inputStandardCoalAmount: inputStandard,
    internalAvailableStandardCoalAmount: availableForInternal,
    utilizationStandardCoalAmount: viewLevel === 'level1' ? distributionStandard : utilizationStandard,
    differenceStandardCoalAmount: viewLevel === 'level1' ? unallocatedStandard : pendingStandard,
    confirmedConversionLossStandardCoalAmount: confirmedConversionLossStandard,
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

/** Select registered upstream/downstream relations without inferring physical supply attribution. */
export function selectFlowRelations(
  dataset: Pick<FlowAnalysisDataset, 'nodes' | 'links' | 'detailRows'>,
  selectedNodeId = '',
  showExternal = true,
): Pick<FlowAnalysisDataset, 'nodes' | 'links' | 'detailRows'> {
  const nodes = dataset.nodes.filter((node) => showExternal || node.stage !== 'external');
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const links = dataset.links.filter((link) => link.standardCoalAmount > 0
    && nodeById.has(link.sourceNodeId) && nodeById.has(link.targetNodeId));
  if (!selectedNodeId || !nodeById.has(selectedNodeId)) {
    return { nodes, links, detailRows: dataset.detailRows.filter((row) => showExternal || row.stage !== '外部输出') };
  }

  const incoming = new Map<string, FlowLink[]>();
  const outgoing = new Map<string, FlowLink[]>();
  links.forEach((link) => {
    incoming.set(link.targetNodeId, [...(incoming.get(link.targetNodeId) ?? []), link]);
    outgoing.set(link.sourceNodeId, [...(outgoing.get(link.sourceNodeId) ?? []), link]);
  });
  const relatedNodes = new Set([selectedNodeId]);
  const relatedLinks = new Set<string>();
  const walk = (direction: 'upstream' | 'downstream') => {
    const graph = direction === 'upstream' ? incoming : outgoing;
    const visited = new Set<string>();
    const pending = [selectedNodeId];
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const stage = nodeById.get(current)!.stage;
      // A unit aggregates several energy types. Its other flows do not prove a supply path.
      if (current !== selectedNodeId && (stage === 'distribution' || stage === 'utilization')) continue;
      for (const link of graph.get(current) ?? []) {
        const next = direction === 'upstream' ? link.sourceNodeId : link.targetNodeId;
        relatedLinks.add(link.linkId);
        relatedNodes.add(next);
        // Keep the recovery return itself, but do not redistribute it through the shared pool.
        if (direction === 'downstream' && link.flowType === 'recovery_output') continue;
        pending.push(next);
      }
    }
  };
  walk('upstream');
  walk('downstream');
  return {
    nodes: nodes.filter((node) => relatedNodes.has(node.nodeId)),
    links: links.filter((link) => relatedLinks.has(link.linkId)),
    detailRows: dataset.detailRows.filter((row) => row.relatedLinkIds.some((id) => relatedLinks.has(id))),
  };
}

export interface FlowNodeBalanceRow {
  nodeId: string;
  name: string;
  nodeType: string;
  incoming: number;
  outgoing: number;
  difference: number | null;
  note: string;
}

/** Graph and tabs use the same registered links, never sums of overlapping source records. */
export function buildFlowViewTables(
  dataset: Pick<FlowAnalysisDataset, 'nodes' | 'links' | 'detailRows'>,
  view: Pick<FlowAnalysisDataset, 'nodes' | 'links'>,
): { balanceRows: FlowNodeBalanceRow[]; detailRows: FlowDetailRow[] } {
  const nodeById = new Map(view.nodes.map((node) => [node.nodeId, node]));
  const links = view.links.filter((link) => link.standardCoalAmount > 0 && nodeById.has(link.sourceNodeId) && nodeById.has(link.targetNodeId));
  const visibleIds = new Set(links.map((link) => link.linkId));
  const balanceRows = view.nodes.map((node): FlowNodeBalanceRow => {
    const incoming = sum(links.filter((link) => link.targetNodeId === node.nodeId).map((link) => link.standardCoalAmount));
    const outgoing = sum(links.filter((link) => link.sourceNodeId === node.nodeId).map((link) => link.standardCoalAmount));
    const omitted = dataset.links.filter((link) => link.standardCoalAmount > 0 && !visibleIds.has(link.linkId));
    const hiddenInput = omitted.some((link) => link.targetNodeId === node.nodeId);
    const hiddenOutput = omitted.some((link) => link.sourceNodeId === node.nodeId);
    let difference: number | null = null;
    let note: string;
    if (hiddenInput || hiddenOutput) note = [hiddenInput ? '部分来源未展开' : '', hiddenOutput ? '部分去向未展开' : ''].filter(Boolean).join('；');
    else if (node.stage === 'input') note = '企业边界来源';
    else if (node.stage === 'external') note = '企业边界去向';
    else if (node.stage === 'distribution' || node.stage === 'utilization') note = '用能及回收量不作收支闭合校验';
    else if (node.stage === 'unallocated' || node.stage === 'pending') note = '管理差额去向，不代表物理损失';
    else {
      difference = Math.abs(incoming - outgoing) < .000001 ? 0 : incoming - outgoing;
      note = node.stage === 'conversion' || node.stage === 'recovery'
        ? '转换投入与产出的折标差额，不等同于已确认损失'
        : Math.abs(difference) <= .01 ? '当前节点收支闭合' : '当前节点收支存在差额，需核对';
    }
    return { nodeId: node.nodeId, name: node.name, nodeType: node.nodeType, incoming, outgoing, difference, note };
  });
  const detailRows = links.map((link): FlowDetailRow => {
    const source = nodeById.get(link.sourceNodeId)!;
    const target = nodeById.get(link.targetNodeId)!;
    const originals = dataset.detailRows.filter((row) => row.relatedLinkIds.includes(link.linkId));
    const original = originals.find((row) => row.energyTypeName === link.energyTypeName) ?? originals[0];
    let stage: FlowDetailRow['stage'] = '能源分配';
    let flowStageLabel = '一级分配';
    if (target.stage === 'recovery') { stage = '能源转换'; flowStageLabel = '回收投入'; }
    else if (source.stage === 'recovery') { stage = '能源转换'; flowStageLabel = '回收回流'; }
    else if (target.stage === 'conversion') { stage = '能源转换'; flowStageLabel = '转换投入'; }
    else if (source.stage === 'conversion') { stage = '能源转换'; flowStageLabel = '转换产出'; }
    else if (source.stage === 'input') { stage = '能源输入'; flowStageLabel = '企业输入'; }
    else if (target.stage === 'external') { stage = '外部输出'; flowStageLabel = '外部输出'; }
    else if (target.stage === 'unallocated') { stage = '未分配'; flowStageLabel = '未分配'; }
    else if (target.stage === 'pending') { stage = '待分解'; flowStageLabel = '待分解'; }
    else if (target.stage === 'utilization') { stage = '能源利用'; flowStageLabel = '二级利用'; }
    return {
      flowDetailId: link.linkId, stage, flowStageLabel, source: source.name, target: target.name,
      energyTypeName: link.energyTypeName ?? original?.energyTypeName ?? '未标明',
      calculation: link.calculation,
      amount: link.standardCoalAmount, amountUnit: 'tce', standardCoalAmount: link.standardCoalAmount,
      energyUnitName: original?.energyUnitName ?? '—',
      sourceRecordIds: [...new Set(originals.flatMap((row) => row.sourceRecordIds))],
      traceDescription: original
        ? `当前关系流量来自登记连线；关联台账：${original.source} → ${original.target}（${original.energyTypeName}）。下列原始值为来源记录整体口径，不一定等于当前支路流量。`
        : '当前关系流量来自登记连线，暂无独立原始台账。',
      traceRecords: original?.traceRecords ?? [],
      abnormal: target.stage === 'unallocated' || target.stage === 'pending' || originals.some((row) => row.abnormal),
      relatedNodeIds: [source.nodeId, target.nodeId], relatedLinkIds: [link.linkId],
    };
  });
  return { balanceRows, detailRows };
}
