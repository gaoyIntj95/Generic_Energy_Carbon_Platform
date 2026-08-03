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
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 10,
    remark: '',
  },
  {
    energyUnitId: 'eu-waste-heat-power',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '能源回收系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 20,
    remark: '',
  },
  {
    energyUnitId: 'eu-gas-boiler',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '锅炉系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 30,
    remark: '',
  },
  {
    energyUnitId: 'eu-distributed-pv',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '配电系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    displayOrder: 40,
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

let energyUnits = cloneUnits(seedEnergyUnits);
let nextMockId = 100;

function cloneUnits(units: EnergyUnit[]) {
  return units.map((unit) => ({ ...unit }));
}

function normalizeName(name: string) {
  return name.trim();
}

function isDuplicateName(
  name: string,
  parentEnergyUnitId: string | null,
  excludeEnergyUnitId?: string,
) {
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

function nextDisplayOrder(parentEnergyUnitId: string | null) {
  const siblingOrders = energyUnits
    .filter((unit) => unit.parentEnergyUnitId === parentEnergyUnitId)
    .map((unit) => unit.displayOrder);
  return (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 10;
}

export function listEnergyUnits() {
  return cloneUnits(energyUnits).sort((left, right) => {
    const parent = String(left.parentEnergyUnitId ?? '').localeCompare(String(right.parentEnergyUnitId ?? ''), 'zh-CN');
    if (parent) return parent;
    return left.displayOrder - right.displayOrder;
  });
}

export function getEnergyUnit(energyUnitId: string) {
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  return unit ? { ...unit } : undefined;
}

export function createEnergyUnit(input: EnergyUnitWriteInput): EnergyUnitMutationResult {
  if (isDuplicateName(input.energyUnitName, null)) return { ok: false, error: 'duplicateName' };

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: input.unitType,
    displayOrder: nextDisplayOrder(null),
    remark: input.remark?.trim() ?? '',
  };
  energyUnits.push(unit);
  return { ok: true, unit: { ...unit } };
}

export function addChildEnergyUnit(
  parentEnergyUnitId: string,
  input: EnergyUnitWriteInput,
): EnergyUnitMutationResult {
  const parent = energyUnits.find((item) => item.energyUnitId === parentEnergyUnitId);
  if (!parent) return { ok: false, error: 'notFound' };

  const unitLevel = nextLevel(parent.unitLevel);
  if (!unitLevel) return { ok: false, error: 'maxLevel' };
  if (isDuplicateName(input.energyUnitName, parentEnergyUnitId)) {
    return { ok: false, error: 'duplicateName' };
  }

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: parent.organizationId,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId,
    unitLevel,
    unitType: input.unitType,
    displayOrder: nextDisplayOrder(parentEnergyUnitId),
    remark: input.remark?.trim() ?? '',
  };
  energyUnits.push(unit);
  return { ok: true, unit: { ...unit } };
}

export function updateEnergyUnit(
  energyUnitId: string,
  input: EnergyUnitWriteInput,
): EnergyUnitMutationResult {
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  if (!unit) return { ok: false, error: 'notFound' };
  if (isDuplicateName(input.energyUnitName, unit.parentEnergyUnitId, energyUnitId)) {
    return { ok: false, error: 'duplicateName' };
  }

  Object.assign(unit, {
    energyUnitName: normalizeName(input.energyUnitName),
    unitType: input.unitType,
    remark: input.remark?.trim() ?? '',
  });
  return { ok: true, unit: { ...unit } };
}

export function reorderEnergyUnits(
  parentEnergyUnitId: string | null,
  orderedEnergyUnitIds: string[],
): EnergyUnitMutationResult {
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

export function inspectEnergyUnitDeletion(energyUnitId: string): EnergyUnitReferenceSummary {
  return {
    childCount: energyUnits.filter((unit) => unit.parentEnergyUnitId === energyUnitId).length,
    energyRecordCount: listEnergyActivityRecords().filter(
      (record) => record.energyUnitId === energyUnitId,
    ).length,
    operationRecordCount: listOperationMetrics().filter(
      (record) => record.energyUnitId === energyUnitId,
    ).length,
    deviceCount: listKeyDevices().filter((device) => device.energyUnitId === energyUnitId).length,
    conversionRelationCount: listEnergyConversionRelations().filter(
      (relation) => relation.conversionEnergyUnitId === energyUnitId,
    ).length,
  };
}

export function deleteEnergyUnit(energyUnitId: string): EnergyUnitMutationResult {
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  if (!unit) return { ok: false, error: 'notFound' };

  const references = inspectEnergyUnitDeletion(energyUnitId);
  if (Object.values(references).some((count) => count > 0)) {
    return { ok: false, error: 'referenced', references };
  }

  energyUnits = energyUnits.filter((item) => item.energyUnitId !== energyUnitId);
  return { ok: true, unit: { ...unit } };
}

export function resetEnergyUnitMockStore() {
  energyUnits = cloneUnits(seedEnergyUnits);
  nextMockId = 100;
}
