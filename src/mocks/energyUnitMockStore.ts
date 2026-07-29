import type {
  EnergyUnit,
  EnergyUnitLevel,
  EnergyUnitMutationResult,
  EnergyUnitReference,
  EnergyUnitReferenceSummary,
  EnergyUnitWriteInput,
} from '../types/energyUnit';

export const DEMO_ORGANIZATION_ID = 'org-demo-001';

const seedEnergyUnits: EnergyUnit[] = [
  {
    energyUnitId: 'eu-clinker-line-1',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '1号熟料生产线',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '生产单元',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-raw-material',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '原料制备',
    parentEnergyUnitId: 'eu-clinker-line-1',
    unitLevel: 'level2',
    unitType: '工序/环节',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-clinker-burning',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '熟料烧成',
    parentEnergyUnitId: 'eu-clinker-line-1',
    unitLevel: 'level2',
    unitType: '工序/环节',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-cement-grinding-line',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '水泥粉磨线',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '生产单元',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-cement-grinding',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '水泥粉磨',
    parentEnergyUnitId: 'eu-cement-grinding-line',
    unitLevel: 'level2',
    unitType: '工序/环节',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-packaging',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '包装发运',
    parentEnergyUnitId: 'eu-cement-grinding-line',
    unitLevel: 'level2',
    unitType: '工序/环节',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-utilities',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '公辅系统',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '公辅系统',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-compressed-air',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '空压系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    conversionScene: '其他转换',
    remark: '',
  },
  {
    energyUnitId: 'eu-waste-heat-power',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '余热发电系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    conversionScene: '余热发电',
    remark: '',
  },
  {
    energyUnitId: 'eu-gas-boiler',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '燃气锅炉',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    conversionScene: '锅炉产汽/产热',
    remark: '',
  },
  {
    energyUnitId: 'eu-distributed-pv',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '分布式光伏系统',
    parentEnergyUnitId: 'eu-utilities',
    unitLevel: 'level2',
    unitType: '公辅系统',
    conversionScene: '自发电',
    remark: '',
  },
  {
    energyUnitId: 'eu-office',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '办公楼',
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: '建筑/区域',
    conversionScene: null,
    remark: '',
  },
  {
    energyUnitId: 'eu-office-hvac',
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: '空调系统',
    parentEnergyUnitId: 'eu-office',
    unitLevel: 'level2',
    unitType: '公辅系统',
    conversionScene: null,
    remark: '',
  },
];

const seedReferences: EnergyUnitReference[] = [
  { referenceId: 'energy-record-31', energyUnitId: 'eu-clinker-line-1', referenceType: 'energyRecord' },
  { referenceId: 'energy-record-32', energyUnitId: 'eu-clinker-line-1', referenceType: 'energyRecord' },
  { referenceId: 'operation-record-51', energyUnitId: 'eu-clinker-line-1', referenceType: 'operationRecord' },
  { referenceId: 'device-60', energyUnitId: 'eu-raw-material', referenceType: 'device' },
  { referenceId: 'energy-record-34', energyUnitId: 'eu-waste-heat-power', referenceType: 'energyRecord' },
  { referenceId: 'energy-record-33', energyUnitId: 'eu-waste-heat-power', referenceType: 'energyRecord' },
  { referenceId: 'conversion-relation-80', energyUnitId: 'eu-waste-heat-power', referenceType: 'conversionRelation' },
  { referenceId: 'energy-record-36', energyUnitId: 'eu-gas-boiler', referenceType: 'energyRecord' },
  { referenceId: 'conversion-relation-81', energyUnitId: 'eu-gas-boiler', referenceType: 'conversionRelation' },
  { referenceId: 'energy-record-38', energyUnitId: 'eu-distributed-pv', referenceType: 'energyRecord' },
  { referenceId: 'conversion-relation-82', energyUnitId: 'eu-distributed-pv', referenceType: 'conversionRelation' },
];

let energyUnits = cloneUnits(seedEnergyUnits);
let energyUnitReferences = cloneReferences(seedReferences);
let nextMockId = 100;

function cloneUnits(units: EnergyUnit[]) {
  return units.map((unit) => ({ ...unit }));
}

function cloneReferences(references: EnergyUnitReference[]) {
  return references.map((reference) => ({ ...reference }));
}

function normalizeName(name: string) {
  return name.trim();
}

function isDuplicateName(name: string, excludeEnergyUnitId?: string) {
  const normalized = normalizeName(name);
  return energyUnits.some(
    (unit) => unit.energyUnitId !== excludeEnergyUnitId && unit.energyUnitName === normalized,
  );
}

function nextLevel(level: EnergyUnitLevel): EnergyUnitLevel | null {
  if (level === 'enterprise') return 'level1';
  if (level === 'level1') return 'level2';
  if (level === 'level2') return 'level3';
  return null;
}

function makeId() {
  const id = `eu-mock-${nextMockId}`;
  nextMockId += 1;
  return id;
}

export function listEnergyUnits() {
  return cloneUnits(energyUnits);
}

export function getEnergyUnit(energyUnitId: string) {
  const unit = energyUnits.find((item) => item.energyUnitId === energyUnitId);
  return unit ? { ...unit } : undefined;
}

export function createEnergyUnit(input: EnergyUnitWriteInput): EnergyUnitMutationResult {
  if (isDuplicateName(input.energyUnitName)) return { ok: false, error: 'duplicateName' };

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: DEMO_ORGANIZATION_ID,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId: null,
    unitLevel: 'level1',
    unitType: input.unitType,
    conversionScene: input.conversionScene,
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
  if (isDuplicateName(input.energyUnitName)) return { ok: false, error: 'duplicateName' };

  const unit: EnergyUnit = {
    energyUnitId: makeId(),
    organizationId: parent.organizationId,
    energyUnitName: normalizeName(input.energyUnitName),
    parentEnergyUnitId,
    unitLevel,
    unitType: input.unitType,
    conversionScene: input.conversionScene,
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
  if (isDuplicateName(input.energyUnitName, energyUnitId)) {
    return { ok: false, error: 'duplicateName' };
  }

  Object.assign(unit, {
    energyUnitName: normalizeName(input.energyUnitName),
    unitType: input.unitType,
    conversionScene: input.conversionScene,
    remark: input.remark?.trim() ?? '',
  });
  return { ok: true, unit: { ...unit } };
}

export function inspectEnergyUnitDeletion(energyUnitId: string): EnergyUnitReferenceSummary {
  const references = energyUnitReferences.filter(
    (reference) => reference.energyUnitId === energyUnitId,
  );
  return {
    childCount: energyUnits.filter((unit) => unit.parentEnergyUnitId === energyUnitId).length,
    energyRecordCount: references.filter((item) => item.referenceType === 'energyRecord').length,
    operationRecordCount: references.filter((item) => item.referenceType === 'operationRecord').length,
    deviceCount: references.filter((item) => item.referenceType === 'device').length,
    conversionRelationCount: references.filter(
      (item) => item.referenceType === 'conversionRelation',
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
  energyUnitReferences = energyUnitReferences.filter(
    (reference) => reference.energyUnitId !== energyUnitId,
  );
  return { ok: true, unit: { ...unit } };
}

export function resetEnergyUnitMockStore() {
  energyUnits = cloneUnits(seedEnergyUnits);
  energyUnitReferences = cloneReferences(seedReferences);
  nextMockId = 100;
}
