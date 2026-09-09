import { listV11EnergyRecords, listV11OperationMetrics, listV11KeyDevices, listV11ConversionOutputs } from './dataManagementV11Store';
import { createAnnualStore } from './annualData';
import type {
  EnergyUnit,
  EnergyUnitLevel,
  EnergyUnitMutationResult,
  EnergyUnitReferenceSummary,
  EnergyUnitWriteInput,
} from '../types/energyUnit';
import {
  listEnergyActivityRecords,
  listEnergyConversionRelations,
  listKeyDevices,
  listOperationMetrics,
} from './platformMockStore';
import { DEMO_ORGANIZATION_ID } from './demoOrganization';

export { DEMO_ORGANIZATION_ID, DEMO_ORGANIZATION_NAME } from './demoOrganization';

const seedEnergyUnits: EnergyUnit[] = [
  {
    energyUnitId: 'eu-clinker-line-1',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '生产车间A',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '生产单元',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-raw-material',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '加工工段',
    parentEnergyUnitId: 'eu-clinker-line-1',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-clinker-burning',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '装配工段',
    parentEnergyUnitId: 'eu-clinker-line-1',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 20,
    remark: '',
  },
  {
    energyUnitId: 'eu-quality-inspection',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '检测工段',
    parentEnergyUnitId: 'eu-clinker-line-1',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 30,
    remark: '',
  },
  {
    energyUnitId: 'eu-cement-grinding-line',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '生产车间B',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '生产单元',
    displayOrder: 20,
    remark: '',
  },
  {
    energyUnitId: 'eu-cement-grinding',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '前处理区域',
    parentEnergyUnitId: 'eu-cement-grinding-line',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-production-processing',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '生产加工区域',
    parentEnergyUnitId: 'eu-cement-grinding-line',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 20,
    remark: '',
  },
  {
    energyUnitId: 'eu-packaging',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '包装区域',
    parentEnergyUnitId: 'eu-cement-grinding-line',
    unitLevel: 'level2',
    unitType: '工序/环节',
    displayOrder: 30,
    remark: '',
  },
  {
    energyUnitId: 'eu-utilities',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '动力中心',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '公辅系统',
    displayOrder: 30,
    remark: '',
  },
  {
    energyUnitId: 'eu-compressed-air',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '空压系统',
    conversionScenarios: ['空压产气/压缩空气'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-waste-heat-power',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '余热发电机组',
    conversionScenarios: ['余热发电'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 20,
    remark: '',
  },
  {
    energyUnitId: 'eu-captive-power',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '自备发电机组',
    conversionScenarios: ['其他转换'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 22,
    remark: '企业自备燃料发电设施。',
  },
  {
    energyUnitId: 'eu-waste-heat-utilization',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '余热回收利用系统',
    conversionScenarios: ['回收利用'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 25,
    remark: '回收余热后直接产生或补充蒸汽、热水等能源，不含余热发电。',
  },
  {
    energyUnitId: 'eu-pressure-recovery',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '余压回收系统',
    conversionScenarios: ['回收利用'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 27,
    remark: '回收动力中心生产过程产生的余压并转换为可利用能源。',
  },
  {
    energyUnitId: 'eu-gas-boiler',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '锅炉系统',
    conversionScenarios: ['锅炉产汽/产热'],
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 30,
    remark: '',
  },
  {
    energyUnitId: 'eu-office',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '办公区域',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '建筑/区域',
    displayOrder: 40,
    remark: '',
  },
  {
    energyUnitId: 'eu-office-hvac',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '空调系统',
    parentEnergyUnitId: 'eu-office',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-public-support',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '仓储物流区域',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '建筑/区域',
    displayOrder: 50,
    remark: '',
  },
];

const annualUnits = createAnnualStore(seedEnergyUnits);
let nextMockId = 100;

function cloneUnits(units: EnergyUnit[]): EnergyUnit[] {
  return units.map((unit) => ({ ...unit, conversionScenarios: unit.conversionScenarios ? [...unit.conversionScenarios] : undefined }));
}

function normalizeName(name: string) {
  return name.trim();
}

function isDuplicateName(
  name: string,
  parentEnergyUnitId: string | null,
  excludeEnergyUnitId?: string,
  year = 2026,
) {
  const energyUnits = annualUnits.get(year);
  const normalized = normalizeName(name);
  return energyUnits.some(
    (unit) =>
      unit.energyUnitId !== excludeEnergyUnitId &&
      unit.parentEnergyUnitId === parentEnergyUnitId &&
      unit.energyUnitName === normalized,
  );
}

function nextLevel(level: EnergyUnitLevel): EnergyUnitLevel | null {
  if (level === 'enterprise') return 'level1';
  if (level === 'level1') return 'level2';
  return null;
}

function makeId() {
  const id = `eu-mock-${nextMockId}`;
  nextMockId += 1;
  return id;
}

function nextDisplayOrder(parentEnergyUnitId: string | null, year = 2026) {
  const energyUnits = annualUnits.get(year);
  const siblingOrders = energyUnits
    .filter((unit) => unit.parentEnergyUnitId === parentEnergyUnitId)
    .map((unit) => unit.displayOrder);
  return (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 10;
}

export function listEnergyUnits(year = 2026) {
  const energyUnits = annualUnits.get(year);
  return cloneUnits(energyUnits).sort((left, right) => {
    const parent = String(left.parentEnergyUnitId ?? '').localeCompare(String(right.parentEnergyUnitId ?? ''), 'zh-CN');
    if (parent) return parent;
    return left.displayOrder - right.displayOrder;
  });
}

export function getEnergyUnit(energyUnitId: string, year = 2026) {
  const energyUnits = annualUnits.get(year);
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  return unit ? { ...unit } : undefined;
}

export function createEnergyUnit(input: EnergyUnitWriteInput, year = 2026): EnergyUnitMutationResult {
  const energyUnits = annualUnits.get(year);
  if (isDuplicateName(input.energyUnitName, null, undefined, year)) return { ok: false, error: 'duplicateName' };

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: input.unitType,
    displayOrder: nextDisplayOrder(null, year),
    remark: input.remark?.trim() ?? '',
    conversionScenarios: input.conversionScenarios ? [...input.conversionScenarios] : undefined,
  };
  energyUnits.push(unit);
  return { ok: true, unit: { ...unit } };
}

export function addChildEnergyUnit(
  parentEnergyUnitId: string,
  input: EnergyUnitWriteInput,
  year = 2026,
): EnergyUnitMutationResult {
  const energyUnits = annualUnits.get(year);
  const parent = energyUnits.find((item) => item.energyUnitId === parentEnergyUnitId);
  if (!parent) return { ok: false, error: 'notFound' };

  const unitLevel = nextLevel(parent.unitLevel);
  if (!unitLevel) return { ok: false, error: 'maxLevel' };
  if (isDuplicateName(input.energyUnitName, parentEnergyUnitId, undefined, year)) {
    return { ok: false, error: 'duplicateName' };
  }

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: parent.organizationId,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId,
    unitLevel,
    unitType: input.unitType,
    displayOrder: nextDisplayOrder(parentEnergyUnitId, year),
    remark: input.remark?.trim() ?? '',
    conversionScenarios: input.conversionScenarios ? [...input.conversionScenarios] : undefined,
  };
  energyUnits.push(unit);
  return { ok: true, unit: { ...unit } };
}

export function updateEnergyUnit(
  energyUnitId: string,
  input: EnergyUnitWriteInput,
  year = 2026,
): EnergyUnitMutationResult {
  const energyUnits = annualUnits.get(year);
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  if (!unit) return { ok: false, error: 'notFound' };
  if (isDuplicateName(input.energyUnitName, unit.parentEnergyUnitId, energyUnitId, year)) {
    return { ok: false, error: 'duplicateName' };
  }

  Object.assign(unit, {
    energyUnitName: normalizeName(input.energyUnitName),
    unitType: input.unitType,
    remark: input.remark?.trim() ?? '',
    conversionScenarios: input.conversionScenarios ? [...input.conversionScenarios] : undefined,
  });
  return { ok: true, unit: { ...unit } };
}

export function reorderEnergyUnits(
  parentEnergyUnitId: string | null,
  orderedEnergyUnitIds: string[],
  year = 2026,
): EnergyUnitMutationResult {
  const energyUnits = annualUnits.get(year);
  const siblings = energyUnits.filter((unit) => unit.parentEnergyUnitId === parentEnergyUnitId);
  const siblingIds = new Set(siblings.map((unit) => unit.energyUnitId));
  const valid = orderedEnergyUnitIds.length === siblings.length
    && orderedEnergyUnitIds.every((id) => siblingIds.has(id))
    && new Set(orderedEnergyUnitIds).size === orderedEnergyUnitIds.length;
  if (!valid) return { ok: false, error: 'invalidOrder' };

  orderedEnergyUnitIds.forEach((energyUnitId, index) => {
    const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
    if (unit) unit.displayOrder = (index + 1) * 10;
  });
  return { ok: true };
}

export function inspectEnergyUnitDeletion(energyUnitId: string, year = 2026): EnergyUnitReferenceSummary {
  const energyUnits = annualUnits.get(year);
  return {
    childCount: energyUnits.filter((unit) => unit.parentEnergyUnitId === energyUnitId).length,
    energyRecordCount: listV11EnergyRecords().filter((record) => record.year === year && record.energyUnitId === energyUnitId).length + listEnergyActivityRecords().filter(
      (record) => record.year === year && record.energyUnitId === energyUnitId,
    ).length,
    operationRecordCount: listV11OperationMetrics().filter((record) => record.year === year && record.energyUnitId === energyUnitId).length + listOperationMetrics().filter(
      (record) => record.year === year && record.energyUnitId === energyUnitId,
    ).length,
    deviceCount: listV11KeyDevices(year).filter((device) => device.energyUnitId === energyUnitId).length + (year === 2026 ? listKeyDevices() : []).filter((device) => device.energyUnitId === energyUnitId).length,
    conversionRelationCount: listV11ConversionOutputs().filter((record) => record.year === year && [record.conversionEnergyUnitId, record.recoverySourceEnergyUnitId, record.outputTargetEnergyUnitId].includes(energyUnitId)).length + (year === 2026 ? listEnergyConversionRelations() : []).filter(
      (relation) => relation.conversionEnergyUnitId === energyUnitId,
    ).length,
  };
}

export function deleteEnergyUnit(energyUnitId: string, year = 2026): EnergyUnitMutationResult {
  const energyUnits = annualUnits.get(year);
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  if (!unit) return { ok: false, error: 'notFound' };

  const references = inspectEnergyUnitDeletion(energyUnitId, year);
  if (Object.values(references).some((count) => count > 0)) {
    return { ok: false, error: 'referenced', references };
  }

  energyUnits.splice(energyUnits.findIndex((item) => item.energyUnitId === energyUnitId), 1);
  return { ok: true, unit: { ...unit } };
}

export function resetEnergyUnitMockStore() {
  annualUnits.reset();
  nextMockId = 100;
}
