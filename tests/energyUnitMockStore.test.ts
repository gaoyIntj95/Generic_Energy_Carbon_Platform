import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChildEnergyUnit,
  createEnergyUnit,
  deleteEnergyUnit,
  getEnergyUnit,
  inspectEnergyUnitDeletion,
  listEnergyUnits,
  reorderEnergyUnits,
  resetEnergyUnitMockStore,
  updateEnergyUnit,
} from '../src/mocks/energyUnitMockStore';

describe('energy unit centralized mock store', () => {
  beforeEach(() => resetEnergyUnitMockStore());

  it('creates a level-one unit with a stable id', () => {
    const result = createEnergyUnit({
      energyUnitName: '新建生产车间',
      unitType: '生产单元',
      remark: '测试',
    });

    expect(result.ok).toBe(true);
    expect(result.unit).toMatchObject({
      energyUnitName: '新建生产车间',
      parentEnergyUnitId: null,
      unitLevel: 'level1',
    });
    expect(result.unit?.energyUnitId).toMatch(/^eu-mock-/);
    expect(getEnergyUnit(result.unit!.energyUnitId)).toEqual(result.unit);
  });

  it('adds a second-level unit using its level-one parent id', () => {
    const result = addChildEnergyUnit('eu-clinker-line-1', {
      energyUnitName: '包装输送设备区',
      unitType: '工序/环节',
    });

    expect(result.unit).toMatchObject({
      parentEnergyUnitId: 'eu-clinker-line-1',
      unitLevel: 'level2',
    });
  });

  it('prevents adding below a second-level unit', () => {
    const result = addChildEnergyUnit('eu-packaging', {
      energyUnitName: '不允许的三级单元',
      unitType: '工序/环节',
    });

    expect(result).toMatchObject({ ok: false, error: 'maxLevel' });
  });

  it('updates the original object without changing id or hierarchy', () => {
    const before = getEnergyUnit('eu-packaging')!;
    const result = updateEnergyUnit('eu-packaging', {
      energyUnitName: '包装与发运',
      unitType: '工序/环节',
      remark: '名称已更新',
    });

    expect(result.ok).toBe(true);
    expect(result.unit).toMatchObject({
      energyUnitId: before.energyUnitId,
      parentEnergyUnitId: before.parentEnergyUnitId,
      unitLevel: before.unitLevel,
      energyUnitName: '包装与发运',
    });
  });

  it('rejects duplicate names within the same parent scope', () => {
    const createResult = createEnergyUnit({
      energyUnitName: '办公区域',
      unitType: '建筑/区域',
    });
    const editResult = updateEnergyUnit('eu-packaging', {
      energyUnitName: '前处理区域',
      unitType: '工序/环节',
    });

    expect(createResult).toMatchObject({ ok: false, error: 'duplicateName' });
    expect(editResult).toMatchObject({ ok: false, error: 'duplicateName' });
  });

  it('blocks deletion when child units exist', () => {
    const references = inspectEnergyUnitDeletion('eu-utilities');
    const result = deleteEnergyUnit('eu-utilities');

    expect(references.childCount).toBe(4);
    expect(result).toMatchObject({ ok: false, error: 'referenced' });
  });

  it('uses the generic manufacturing hierarchy without storing conversion rules on units', () => {
    const units = listEnergyUnits();
    const rootNames = units
      .filter((unit) => unit.unitLevel === 'level1')
      .map((unit) => unit.energyUnitName);

    expect(rootNames).toEqual([
      '生产车间A',
      '生产车间B',
      '动力中心',
      '办公区域',
      '仓储物流区域',
    ]);
    expect(units.filter((unit) => unit.parentEnergyUnitId === 'eu-clinker-line-1')
      .map((unit) => unit.energyUnitName)).toEqual(['加工工段', '装配工段', '检测工段']);
    expect(units.filter((unit) => unit.parentEnergyUnitId === 'eu-cement-grinding-line')
      .map((unit) => unit.energyUnitName)).toEqual(['前处理区域', '生产加工区域', '包装区域']);
    expect(units.filter((unit) => unit.parentEnergyUnitId === 'eu-utilities')
      .map((unit) => unit.energyUnitName)).toEqual([
        '空压系统',
        '能源回收系统',
        '锅炉系统',
        '配电系统',
      ]);
  });

  it('updates only the display order of same-parent units', () => {
    const result = reorderEnergyUnits('eu-clinker-line-1', [
      'eu-quality-inspection',
      'eu-raw-material',
      'eu-clinker-burning',
    ]);

    expect(result).toMatchObject({ ok: true });
    expect(listEnergyUnits()
      .filter((unit) => unit.parentEnergyUnitId === 'eu-clinker-line-1')
      .map((unit) => unit.energyUnitName)).toEqual(['检测工段', '加工工段', '装配工段']);
    expect(getEnergyUnit('eu-quality-inspection')).toMatchObject({
      parentEnergyUnitId: 'eu-clinker-line-1',
      unitLevel: 'level2',
    });
  });

  it('blocks deletion using actual business records', () => {
    const references = inspectEnergyUnitDeletion('eu-waste-heat-power');
    const result = deleteEnergyUnit('eu-waste-heat-power');

    expect(references).toMatchObject({
      childCount: 0,
      energyRecordCount: 3,
      conversionRelationCount: 1,
    });
    expect(result.references?.energyRecordCount).toBe(3);
    expect(result.ok).toBe(false);
  });

  it('deletes an unreferenced unit from the actual list', () => {
    const before = listEnergyUnits().length;
    const result = deleteEnergyUnit('eu-packaging');

    expect(result.ok).toBe(true);
    expect(listEnergyUnits()).toHaveLength(before - 1);
    expect(getEnergyUnit('eu-packaging')).toBeUndefined();
  });

  it('keeps in-memory changes across reads and resets to the fixed seed on refresh simulation', () => {
    createEnergyUnit({
      energyUnitName: '会话内单元',
      unitType: '其他',
    });
    expect(listEnergyUnits().some((unit) => unit.energyUnitName === '会话内单元')).toBe(true);

    resetEnergyUnitMockStore();
    expect(listEnergyUnits().some((unit) => unit.energyUnitName === '会话内单元')).toBe(false);
    expect(listEnergyUnits()).toHaveLength(16);
  });
});
