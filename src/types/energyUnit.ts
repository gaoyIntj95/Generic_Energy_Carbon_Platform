export type EnergyUnitLevel = 'enterprise' | 'level1' | 'level2' | 'level3';

export type EnergyUnitType = '生产单元' | '工序/环节' | '公辅系统' | '建筑/区域' | '其他';

export type EnergyConversionScene =
  | '锅炉产汽/产热'
  | '余能回收'
  | '电力转换/分配'
  | '其他转换';

export interface EnergyUnit {
  energyUnitId: string;
  organizationId: string;
  energyUnitName: string;
  parentEnergyUnitId: string | null;
  unitLevel: EnergyUnitLevel;
  unitType: EnergyUnitType;
  conversionScene: EnergyConversionScene | null;
  remark?: string;
}

export type EnergyUnitReferenceType =
  | 'energyRecord'
  | 'operationRecord'
  | 'device'
  | 'conversionRelation';

export interface EnergyUnitReference {
  referenceId: string;
  energyUnitId: string;
  referenceType: EnergyUnitReferenceType;
}

export interface EnergyUnitWriteInput {
  energyUnitName: string;
  unitType: EnergyUnitType;
  conversionScene: EnergyConversionScene | null;
  remark?: string;
}

export interface EnergyUnitReferenceSummary {
  childCount: number;
  energyRecordCount: number;
  operationRecordCount: number;
  deviceCount: number;
  conversionRelationCount: number;
}

export interface EnergyUnitMutationResult {
  ok: boolean;
  unit?: EnergyUnit;
  error?: 'notFound' | 'duplicateName' | 'maxLevel' | 'referenced';
  references?: EnergyUnitReferenceSummary;
}
