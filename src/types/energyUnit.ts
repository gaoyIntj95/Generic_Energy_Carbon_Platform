export type EnergyUnitLevel = 'enterprise' | 'level1' | 'level2';

export type EnergyUnitType = '生产单元' | '工序/环节' | '公辅系统' | '建筑/区域' | '其他';

export interface EnergyUnit {
  energyUnitId: string;
  organizationId: string;
  energyUnitName: string;
  parentEnergyUnitId: string | null;
  unitLevel: EnergyUnitLevel;
  unitType: EnergyUnitType;
  /** 同一父级下的展示顺序；不参与能源量、能流或工艺关系计算。 */
  displayOrder: number;
  remark?: string;
}

export interface EnergyUnitWriteInput {
  energyUnitName: string;
  unitType: EnergyUnitType;
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
  error?: 'notFound' | 'duplicateName' | 'maxLevel' | 'referenced' | 'invalidOrder';
  references?: EnergyUnitReferenceSummary;
}
