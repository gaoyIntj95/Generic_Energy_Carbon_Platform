import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChildEnergyUnit,
  createEnergyUnit,
  deleteEnergyUnit,
  getEnergyUnit,
  inspectEnergyUnitDeletion,
  listEnergyUnits,
  resetEnergyUnitMockStore,
  updateEnergyUnit,
} from '../src/mocks/energyUnitMockStore';

describe('energy unit centralized mock store', () => {
  beforeEach(() => resetEnergyUnitMockStore());

  it('creates a level-one unit with a stable id', () => {
    const result = createEnergyUnit({
      energyUnitName: '新建生产车间',
      unitType: '生产单元',
      conversionScene: null,
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

  it('adds a child using parent id and computes its level', () => {
    const result = addChildEnergyUnit('eu-packaging', {
      energyUnitName: '包装输送设备区',
      unitType: '工序/环节',
      conversionScene: null,
    });

    expect(result.unit).toMatchObject({
      parentEnergyUnitId: 'eu-packaging',
      unitLevel: 'level3',
    });
  });

  it('prevents adding below the maximum third level', () => {
    const levelThree = addChildEnergyUnit('eu-packaging', {
      energyUnitName: '包装三级单元',
      unitType: '工序/环节',
      conversionScene: null,
    }).unit!;

    const result = addChildEnergyUnit(levelThree.energyUnitId, {
      energyUnitName: '不允许的四级单元',
      unitType: '工序/环节',
      conversionScene: null,
    });

    expect(result).toMatchObject({ ok: false, error: 'maxLevel' });
  });

  it('updates the original object without changing id or hierarchy', () => {
    const before = getEnergyUnit('eu-packaging')!;
    const result = updateEnergyUnit('eu-packaging', {
      energyUnitName: '包装与发运',
      unitType: '工序/环节',
      conversionScene: null,
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

  it('rejects duplicate names for create and edit', () => {
    const createResult = createEnergyUnit({
      energyUnitName: '办公区域',
      unitType: '建筑/区域',
      conversionScene: null,
    });
    const editResult = updateEnergyUnit('eu-packaging', {
      energyUnitName: '办公区域',
      unitType: '工序/环节',
      conversionScene: null,
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

  it('uses the generic manufacturing hierarchy and conversion scene dictionary', () => {
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
      .map((unit) => [unit.energyUnitName, unit.conversionScene])).toEqual([
        ['空压系统', null],
        ['能源回收系统', '余能回收'],
        ['锅炉系统', '锅炉产汽/产热'],
        ['配电系统', '电力转换/分配'],
      ]);
  });

  it('blocks deletion and reports business reference counts', () => {
    const references = inspectEnergyUnitDeletion('eu-raw-material');
    const result = deleteEnergyUnit('eu-raw-material');

    expect(references).toMatchObject({
      childCount: 0,
      deviceCount: 1,
    });
    expect(result.references?.deviceCount).toBe(1);
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
      conversionScene: null,
    });
    expect(listEnergyUnits().some((unit) => unit.energyUnitName === '会话内单元')).toBe(true);

    resetEnergyUnitMockStore();
    expect(listEnergyUnits().some((unit) => unit.energyUnitName === '会话内单元')).toBe(false);
    expect(listEnergyUnits()).toHaveLength(16);
  });
});
