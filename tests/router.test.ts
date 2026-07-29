import { describe, expect, it } from 'vitest';
import { allNavItems, navigation } from '../src/app/router';

describe('navigation manifest', () => {
  it('contains every confirmed page as a unique route', () => {
    expect(allNavItems).toHaveLength(20);
    expect(new Set(allNavItems.map((item) => item.path)).size).toBe(20);
    expect(navigation.map((group) => group.label)).toEqual([
      '能源监测与分析',
      '碳排核算与合规',
      '能碳资产运营与策略',
      '数据管理',
    ]);
    expect(allNavItems.map((item) => item.label)).toEqual(expect.arrayContaining([
      '能耗强度指标',
      '碳因子与参数库',
      '用能与碳排放预算管理',
      '用能单元管理',
      '重点设备',
    ]));
    expect(allNavItems.some((item) => item.label === '能碳数据采集')).toBe(false);
  });
});
