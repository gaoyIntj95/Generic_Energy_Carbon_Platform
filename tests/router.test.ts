import { describe, expect, it } from 'vitest';
import { allNavItems, navigation } from '../src/app/router';

describe('navigation manifest', () => {
  it('contains every confirmed page as a unique route', () => {
    expect(allNavItems).toHaveLength(18);
    expect(new Set(allNavItems.map((item) => item.path)).size).toBe(18);
    expect(navigation.map((group) => group.label)).toEqual([
      '能源监测与分析',
      '碳排放核算与合规',
      '能碳资产运营与策略',
      '数据管理',
    ]);
    expect(allNavItems.map((item) => item.label)).toEqual(expect.arrayContaining([
      '能耗指标',
      '碳因子参数',
      '用能与碳排放预算管理',
      '用能单元',
      '能源数据',
      '重点设备',
    ]));
    expect(allNavItems.some((item) => item.label === '能碳数据采集')).toBe(false);
    expect(navigation.find((group) => group.key === 'data-management')?.items.map((item) => item.label)).toEqual([
      '用能单元',
      '能源品种',
      '重点设备',
      '能源数据',
      '运营数据',
    ]);
    const carbonDisplay = navigation.find((group) => group.key === 'carbon-accounting')?.display;
    const carbonCalculation = carbonDisplay?.find((entry) => 'items' in entry);
    expect(carbonCalculation && 'items' in carbonCalculation
      ? carbonCalculation.items.map((item) => item.label)
      : []).toEqual([
      '碳排放预览',
      '碳核算清单',
      '碳核查支撑',
      '碳排放报告',
    ]);
    expect(carbonDisplay?.map((entry) => entry.label)).toEqual([
      '碳排放核算',
      '碳因子参数',
      '供应链碳管理',
      '碳足迹核算',
    ]);
    expect(carbonDisplay?.filter((entry) => 'planned' in entry)).toEqual([
      expect.objectContaining({ label: '供应链碳管理', planned: true, badge: '规划中' }),
      expect.objectContaining({ label: '碳足迹核算', planned: true, badge: '规划中' }),
    ]);
    expect(allNavItems.some((item) => item.label === '供应链碳管理')).toBe(false);
    expect(allNavItems.some((item) => item.label === '碳足迹核算')).toBe(false);
  });
});
